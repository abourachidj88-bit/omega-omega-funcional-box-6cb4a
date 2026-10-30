'use strict';
// Actualización automática (Versión 5). La aplicación web del gimnasio (la nube) ofrece el código de la versión que está publicada; la PC
// lo descarga, lo verifica y lo deja listo en C:\OMEGA\actualizacion. El lanzador lo usa en el próximo inicio (o al tocar "Actualizar ahora").
// Si la versión nueva no arranca, el lanzador vuelve solo a la anterior. Los datos (base de datos) no se tocan nunca.
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const VERSION = require('./version');
const sync = require('./sync');

const RAIZ = path.join(__dirname, '..');
const HOME = process.env.OMEGA_HOME || '';
const DIR_ACT = process.env.OMEGA_ACT_DIR || (HOME ? path.join(HOME, 'actualizacion') : '');
const PERMITIDO = /^(server\.js|lanzador\.js|package\.json|(src|public|scripts)\/[A-Za-z0-9_.\-\/ ]+)$/;
const EXCLUIDO = /(^|\/)(demo-data\.js|\.DS_Store|Thumbs\.db)$/;
const num = (v) => (Number(v.numero) || 0) * 1000 + (Number(v.revision) || 0);
const actual = () => ({ numero: VERSION.numero, revision: VERSION.revision || 0, nombre: VERSION.nombre });

let estado = { ultima_busqueda: null, error: null, disponible: null, descargada: false, aplicando: false };

// ---------- lado nube: arma el paquete con el código que está corriendo
let cache = null;
function listar(dir, base, out) {
  for (const n of fs.readdirSync(path.join(dir, base), { withFileTypes: true })) {
    const rel = base ? base + '/' + n.name : n.name;
    if (n.isDirectory()) listar(dir, rel, out);
    else if (n.isFile() && PERMITIDO.test(rel) && !EXCLUIDO.test(rel)) out.push(rel);
  }
}
function armarPaquete() {
  if (cache) return cache;
  const rels = ['server.js', 'lanzador.js', 'package.json'].filter(f => fs.existsSync(path.join(RAIZ, f)));
  for (const d of ['src', 'public', 'scripts']) if (fs.existsSync(path.join(RAIZ, d))) listar(RAIZ, d, rels);
  rels.sort();
  const files = {}; const h = crypto.createHash('sha256');
  for (const r of rels) { const b = fs.readFileSync(path.join(RAIZ, r)); files[r] = b.toString('base64'); h.update(r + '\0').update(b); }
  const sha = h.digest('hex');
  const bin = zlib.gzipSync(Buffer.from(JSON.stringify({ version: actual(), sha256: sha, files })));
  cache = { info: { version: actual(), sha256: sha, archivos: rels.length, bytes: bin.length }, bin };
  return cache;
}
function hashArchivos(files) {
  const h = crypto.createHash('sha256');
  for (const r of Object.keys(files).sort()) h.update(r + '\0').update(Buffer.from(files[r], 'base64'));
  return h.digest('hex');
}
// Responde a la PC (la petición ya viene verificada con la firma de la SYNC_CLAVE)
function responder(accion) {
  const p = armarPaquete();
  if (accion === 'paquete') return { info: p.info, datos: p.bin.toString('base64') };
  return { info: p.info };
}

// ---------- lado PC
function leerActual() { try { return JSON.parse(fs.readFileSync(path.join(DIR_ACT, 'actual.json'), 'utf8')); } catch (_) { return null; } }
function puedeActualizar() { return !!DIR_ACT && sync.NODO !== 'nube'; }

async function pedir(cfg, accion) {
  const ts = String(Date.now()); const cuerpo = JSON.stringify({ accion });
  const r = await fetch(cfg.url + '/api/actualizacion', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-sync-ts': ts, 'x-sync-firma': crypto.createHmac('sha256', cfg.clave).update(ts + '.' + cuerpo).digest('hex') }, body: cuerpo, signal: AbortSignal.timeout(accion === 'paquete' ? 120000 : 20000) });
  if (r.status === 404) throw new Error('La aplicación web todavía no tiene la actualización automática (publicá la Versión 5 en GitHub).');
  if (r.status === 401) throw new Error('La aplicación web rechazó la clave de conexión.');
  if (!r.ok) throw new Error('La aplicación web respondió ' + r.status);
  return r;
}

async function buscar({ descargar = true } = {}) {
  if (!puedeActualizar()) return estadoActual();
  const cfg = sync.configuracion();
  estado.ultima_busqueda = new Date().toISOString();
  if (!cfg.url || !cfg.clave) { estado.error = null; estado.disponible = null; return estadoActual(); }
  try {
    const info = (await (await pedir(cfg, 'info')).json()).info;
    estado.error = null;
    const pend = leerActual();
    const yaTengo = pend && pend.estado !== 'fallida' && pend.sha256 === info.sha256 && fs.existsSync(path.join(pend.dir || '', 'server.js'));
    const fallida = !!(pend && pend.estado === 'fallida' && pend.sha256 === info.sha256);
    const nuevo = !fallida && num(info.version) > Math.max(num(actual()), pend && pend.estado !== 'fallida' ? num(pend) : 0);
    estado.disponible = nuevo || yaTengo ? info : null;
    estado.descargada = !!yaTengo && num(pend) > num(actual());
    if (nuevo && descargar && !yaTengo) await descargarPaquete(cfg, info);
  } catch (e) { estado.error = e.message || String(e); }
  return estadoActual();
}

async function descargarPaquete(cfg, info) {
  const r = await pedir(cfg, 'paquete');
  const bin = Buffer.from(String((await r.json()).datos || ''), 'base64');
  const cuerpo = JSON.parse(zlib.gunzipSync(bin).toString('utf8'));
  if (!cuerpo.files || typeof cuerpo.files !== 'object') throw new Error('Paquete de actualización inválido');
  if (hashArchivos(cuerpo.files) !== cuerpo.sha256 || cuerpo.sha256 !== info.sha256) throw new Error('El paquete de actualización llegó dañado; se reintenta más tarde');
  for (const rel of Object.keys(cuerpo.files)) if (!PERMITIDO.test(rel) || rel.includes('..') || EXCLUIDO.test(rel)) throw new Error('Paquete con archivos no permitidos: ' + rel);
  const nombre = 'app-' + info.version.numero + '-r' + (info.version.revision || 0) + '-' + cuerpo.sha256.slice(0, 8);
  const destino = path.join(DIR_ACT, nombre), tmp = destino + '.tmp';
  fs.rmSync(tmp, { recursive: true, force: true }); fs.rmSync(destino, { recursive: true, force: true });
  for (const [rel, b64] of Object.entries(cuerpo.files)) { const f = path.join(tmp, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, Buffer.from(b64, 'base64')); }
  if (!fs.existsSync(path.join(tmp, 'server.js'))) throw new Error('Paquete sin server.js');
  fs.renameSync(tmp, destino);
  fs.mkdirSync(DIR_ACT, { recursive: true });
  const meta = { dir: destino, numero: info.version.numero, revision: info.version.revision || 0, nombre: info.version.nombre, sha256: cuerpo.sha256, estado: 'pendiente', descargada: new Date().toISOString() };
  fs.writeFileSync(path.join(DIR_ACT, 'actual.json.tmp'), JSON.stringify(meta, null, 1)); fs.renameSync(path.join(DIR_ACT, 'actual.json.tmp'), path.join(DIR_ACT, 'actual.json'));
  for (const n of fs.readdirSync(DIR_ACT)) if (n.startsWith('app-') && path.join(DIR_ACT, n) !== destino) fs.rmSync(path.join(DIR_ACT, n), { recursive: true, force: true });
  estado.descargada = true; estado.disponible = info;
}

function estadoActual() {
  const pend = leerActual();
  return {
    habilitada: puedeActualizar(),
    version: actual(),
    disponible: estado.disponible ? { nombre: estado.disponible.version.nombre, numero: estado.disponible.version.numero, revision: estado.disponible.version.revision || 0 } : null,
    lista_para_aplicar: !!(pend && pend.estado !== 'fallida' && num(pend) > num(actual()) && fs.existsSync(path.join(pend.dir || '', 'server.js'))),
    en_uso: !!(pend && pend.dir && path.resolve(pend.dir) === path.resolve(RAIZ)),
    ultima_busqueda: estado.ultima_busqueda, error: estado.error, aplicando: estado.aplicando,
    reinicio_automatico: !!process.env.OMEGA_LANZADOR,
  };
}

// Reinicia el servidor con la versión descargada (lo hace el lanzador: apaga este servidor y lo inicia de nuevo)
function aplicar() {
  const e = estadoActual();
  if (!e.lista_para_aplicar) return { ok: false, mensaje: 'No hay una actualización descargada' };
  if (!process.env.OMEGA_LANZADOR) return { ok: false, mensaje: 'Reiniciá OMEGA para usar la versión nueva' };
  const lanz = process.env.OMEGA_LANZADOR_JS || path.join(RAIZ, 'lanzador.js');
  estado.aplicando = true;
  setTimeout(() => {
    try { cp.spawn(process.execPath, ['--disable-warning=ExperimentalWarning', lanz, '--reiniciar'], { detached: true, stdio: 'ignore', windowsHide: true, env: process.env }).unref(); }
    catch (err) { estado.aplicando = false; estado.error = err.message; }
  }, 600);
  return { ok: true };
}

let timer = null;
function iniciarProgramador() {
  if (timer || !puedeActualizar()) return;
  const t = setTimeout(() => buscar().catch(() => {}), 45 * 1000); t.unref();
  timer = setInterval(() => buscar().catch(() => {}), 6 * 3600 * 1000); timer.unref();
}

module.exports = { responder, buscar, aplicar, estadoActual, iniciarProgramador, armarPaquete, hashArchivos, num };
