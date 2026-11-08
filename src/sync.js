'use strict';
// Sincronización entre la PC del gimnasio (base de datos principal) y la copia en la nube (acceso 24/7 desde los celulares).
// Cada cambio queda anotado por triggers de SQLite (sync_log / sync_estado). Los cambios viajan fila por fila y,
// ante un conflicto, gana el más reciente. Si la nube se reinicia vacía (planes gratuitos), la PC la repuebla sola.
const crypto = require('node:crypto');

const OFFSET_NUBE = 1000000000; // los ids creados en la nube arrancan en 1.000.000.000 para no chocar con los de la PC
const NODO = (typeof process !== 'undefined' && process.env && process.env.OMEGA_NODO === 'nube') ? 'nube' : 'pc';
const EXCLUIR_TABLAS = new Set(((typeof process !== 'undefined' && process.env && process.env.SYNC_EXCLUIR) || '').split(',').map(s => s.trim()).filter(Boolean));
const CLAVES_LOCALES = /^(secreto|epoch|ultimo_backup.*|version_app|sync_.*|nodo.*|hark_.*)$/;
const NO_SINCRONIZAR = new Set(['sync_log', 'sync_estado', 'sync_ctl', 'sqlite_sequence', 'hark_cambios', 'hark_wa_msgs']);
const LOTE = 250;

let _db = null; // se completa en instalar()
const meta = new Map(); // tabla -> { cols, pk, auto }

function _tablas(db) {
  return db.prepare("SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all()
    .filter(t => !NO_SINCRONIZAR.has(t.name) && !EXCLUIR_TABLAS.has(t.name));
}

function instalar(db) {
  _db = db;
  db.exec(`
    CREATE TABLE IF NOT EXISTS sync_log (seq INTEGER PRIMARY KEY AUTOINCREMENT, tabla TEXT NOT NULL, pk TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sync_estado (tabla TEXT NOT NULL, pk TEXT NOT NULL, ts INTEGER NOT NULL, borrado INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (tabla, pk));
    CREATE TABLE IF NOT EXISTS sync_ctl (id INTEGER PRIMARY KEY CHECK (id = 1), aplicando INTEGER NOT NULL DEFAULT 0);
    INSERT OR IGNORE INTO sync_ctl (id, aplicando) VALUES (1, 0);
  `);
  const ahora = "CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER)";
  for (const t of _tablas(db)) {
    const info = db.prepare('PRAGMA table_info(' + t.name + ')').all();
    const cols = info.map(c => c.name);
    const pk = info.filter(c => c.pk > 0).sort((a, b) => a.pk - b.pk).map(c => c.name);
    const auto = /AUTOINCREMENT/i.test(t.sql || '');
    meta.set(t.name, { cols, pk, auto });
    const clave = (r) => pk.map(c => r + '.' + c).join(" || '|' || ");
    const filtro = t.name === 'config' ? " AND NEW.clave NOT GLOB 'sync_*' AND NEW.clave NOT IN ('secreto','epoch','version_app') AND NEW.clave NOT LIKE 'ultimo_backup%'" : '';
    const filtroOld = t.name === 'config' ? " AND OLD.clave NOT GLOB 'sync_*' AND OLD.clave NOT IN ('secreto','epoch','version_app') AND OLD.clave NOT LIKE 'ultimo_backup%'" : '';
    for (const ev of ['i', 'u']) {
      db.exec('DROP TRIGGER IF EXISTS sy_' + t.name + '_' + ev);
      db.exec(`CREATE TRIGGER sy_${t.name}_${ev} AFTER ${ev === 'i' ? 'INSERT' : 'UPDATE'} ON ${t.name} WHEN (SELECT aplicando FROM sync_ctl) = 0${filtro} BEGIN
        INSERT INTO sync_log (tabla, pk) VALUES ('${t.name}', ${clave('NEW')});
        INSERT INTO sync_estado (tabla, pk, ts, borrado) VALUES ('${t.name}', ${clave('NEW')}, ${ahora}, 0)
          ON CONFLICT (tabla, pk) DO UPDATE SET ts = excluded.ts, borrado = 0;
      END`);
    }
    db.exec('DROP TRIGGER IF EXISTS sy_' + t.name + '_d');
    db.exec(`CREATE TRIGGER sy_${t.name}_d AFTER DELETE ON ${t.name} WHEN (SELECT aplicando FROM sync_ctl) = 0${filtroOld} BEGIN
      INSERT INTO sync_log (tabla, pk) VALUES ('${t.name}', ${clave('OLD')});
      INSERT INTO sync_estado (tabla, pk, ts, borrado) VALUES ('${t.name}', ${clave('OLD')}, ${ahora}, 1)
        ON CONFLICT (tabla, pk) DO UPDATE SET ts = excluded.ts, borrado = 1;
    END`);
  }
  if (NODO === 'nube') {
    // la nube numera sus propios registros desde 1.000.000.000
    for (const [t, m] of meta) {
      if (!m.auto) continue;
      const r = db.prepare('SELECT seq FROM sqlite_sequence WHERE name = ?').get(t);
      if (!r) db.prepare('INSERT INTO sqlite_sequence (name, seq) VALUES (?, ?)').run(t, OFFSET_NUBE);
      else if (r.seq < OFFSET_NUBE) db.prepare('UPDATE sqlite_sequence SET seq = ? WHERE name = ?').run(OFFSET_NUBE, t);
    }
  }
}

// ------------------------------------------------------------ lectura de cambios
function _fila(tabla, pk) {
  const m = meta.get(tabla); if (!m) return null;
  const { get } = require('./db');
  const partes = String(pk).split('|');
  const where = m.pk.map(c => c + ' = ?').join(' AND ');
  const r = get('SELECT * FROM ' + tabla + ' WHERE ' + where, ...partes);
  return r || null;
}
function _clavePermitida(tabla, pk) { return !(tabla === 'config' && CLAVES_LOCALES.test(pk)); }

// Cambios pendientes con seq > desde (colapsados por fila). Devuelve { cambios, hasta, hay_mas }
function leerCambios(desde, limite = LOTE) {
  const { all, get } = require('./db');
  const filas = all('SELECT tabla, pk, MAX(seq) AS seq FROM sync_log WHERE seq > ? GROUP BY tabla, pk ORDER BY seq LIMIT ?', desde, limite + 1);
  const hayMas = filas.length > limite;
  const usadas = hayMas ? filas.slice(0, limite) : filas;
  const cambios = [];
  for (const f of usadas) {
    if (!meta.has(f.tabla) || !_clavePermitida(f.tabla, f.pk)) continue;
    const est = get('SELECT ts, borrado FROM sync_estado WHERE tabla = ? AND pk = ?', f.tabla, f.pk);
    const fila = est && est.borrado ? null : _fila(f.tabla, f.pk);
    cambios.push({ t: f.tabla, pk: f.pk, ts: est ? est.ts : 0, b: fila ? 0 : 1, f: fila });
  }
  const hasta = hayMas ? usadas[usadas.length - 1].seq : (get('SELECT COALESCE(MAX(seq), 0) AS m FROM sync_log').m);
  return { cambios, hasta: Math.max(hasta, Number(desde)), hay_mas: hayMas };
}

// Todas las filas de todas las tablas (para repoblar una nube vacía), en lotes
function* todasLasFilas() {
  const { all, get } = require('./db');
  for (const [tabla, m] of meta) {
    let off = 0;
    for (;;) {
      const filas = all('SELECT * FROM ' + tabla + ' ORDER BY ' + (m.pk.map(c => c).join(', ') || 'rowid') + ' LIMIT ? OFFSET ?', 150, off);
      if (!filas.length) break;
      yield filas.filter(f => _clavePermitida(tabla, m.pk.map(c => f[c]).join('|'))).map(f => {
        const pk = m.pk.map(c => f[c]).join('|');
        const est = get('SELECT ts FROM sync_estado WHERE tabla = ? AND pk = ?', tabla, pk);
        return { t: tabla, pk, ts: est ? est.ts : 0, b: 0, f };
      });
      off += filas.length;
      if (filas.length < 150) break;
    }
  }
}

// ------------------------------------------------------------ aplicación de cambios recibidos
function aplicar(cambios) {
  const { db, all, get, run } = require('./db');
  const r = { aplicados: 0, omitidos: 0, conflictos: 0, errores: [] };
  if (!cambios || !cambios.length) return r;
  db.exec('PRAGMA foreign_keys = OFF');
  run('UPDATE sync_ctl SET aplicando = 1');
  db.exec('BEGIN');
  try {
    for (const c of cambios) {
      const m = meta.get(c.t);
      if (!m || !_clavePermitida(c.t, c.pk)) { r.omitidos++; continue; }
      const est = get('SELECT ts, borrado FROM sync_estado WHERE tabla = ? AND pk = ?', c.t, c.pk);
      if (est && est.ts >= (c.ts || 0) && c.ts) { r.omitidos++; continue; }
      try {
        const partes = String(c.pk).split('|');
        if (c.b || !c.f) {
          run('DELETE FROM ' + c.t + ' WHERE ' + m.pk.map(k => k + ' = ?').join(' AND '), ...partes);
        } else {
          const cols = m.cols.filter(k => k in c.f);
          const sets = cols.filter(k => !m.pk.includes(k));
          const sql = 'INSERT INTO ' + c.t + ' (' + cols.join(',') + ') VALUES (' + cols.map(() => '?').join(',') + ') ON CONFLICT (' + m.pk.join(',') + ') ' +
            (sets.length ? 'DO UPDATE SET ' + sets.map(k => k + ' = excluded.' + k).join(', ') : 'DO NOTHING');
          run(sql, ...cols.map(k => (c.f[k] === undefined ? null : c.f[k])));
        }
        run('INSERT INTO sync_estado (tabla, pk, ts, borrado) VALUES (?,?,?,?) ON CONFLICT (tabla, pk) DO UPDATE SET ts = excluded.ts, borrado = excluded.borrado', c.t, c.pk, c.ts || 0, c.b ? 1 : 0);
        r.aplicados++;
      } catch (e) {
        r.conflictos++;
        if (r.errores.length < 5) r.errores.push(c.t + ' ' + c.pk + ': ' + e.message);
      }
    }
    db.exec('COMMIT');
  } catch (e) { try { db.exec('ROLLBACK'); } catch (_) {} throw e; }
  finally { run('UPDATE sync_ctl SET aplicando = 0'); db.exec('PRAGMA foreign_keys = ON'); }
  if (NODO === 'pc') ajustarSecuencias();
  return r;
}
// En la PC los ids nuevos siguen contando desde sus propios registros (no desde los 1.000.000.000 de la nube)
function ajustarSecuencias() {
  const { db } = require('./db');
  for (const [t, m] of meta) {
    if (!m.auto) continue;
    const mx = db.prepare('SELECT COALESCE(MAX(id), 0) AS m FROM ' + t + ' WHERE id < ' + OFFSET_NUBE).get().m;
    const s = db.prepare('SELECT seq FROM sqlite_sequence WHERE name = ?').get(t);
    if (s && s.seq > mx && s.seq >= OFFSET_NUBE) db.prepare('UPDATE sqlite_sequence SET seq = ? WHERE name = ?').run(mx, t);
  }
}

function podar(hasta) {
  const { run } = require('./db');
  run('DELETE FROM sync_log WHERE seq <= ?', hasta);
}

// ------------------------------------------------------------ servidor (nube)
function epochLocal() {
  const { getConfig, setConfig } = require('./db');
  let e = getConfig('epoch');
  if (!e) { e = crypto.randomBytes(8).toString('hex'); setConfig('epoch', e); }
  return e;
}
function firmar(clave, ts, cuerpo) { return crypto.createHmac('sha256', clave).update(ts + '.' + cuerpo).digest('hex'); }
function verificarFirma(clave, ts, firma, cuerpo) {
  if (!clave || !ts || !firma) return false;
  if (Math.abs(Date.now() - Number(ts)) > 5 * 60 * 1000) return false;
  const esperada = firmar(clave, ts, cuerpo);
  const a = Buffer.from(esperada), b = Buffer.from(String(firma));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function procesarPeticion(body) {
  if (body.epoch !== epochLocal()) return { reiniciar: true, epoch: epochLocal() };
  const res = aplicar(body.cambios || []);
  if (Number(body.desde) > 0) podar(Number(body.desde));
  const out = leerCambios(Number(body.desde) || 0, LOTE);
  return { epoch: epochLocal(), aplicados: res, cambios: out.cambios, hasta: out.hasta, hay_mas: out.hay_mas };
}

// ------------------------------------------------------------ cliente (PC)
const NUBE_OFICIAL = 'https://omega-gimnasio-24lr.onrender.com';
const NUBES_VIEJAS = ['omega-omega-funcional-box-86418'];
// Dirección de respaldo: un archivo (nube.json, SIN claves) en GitHub dice cuál es la nube vigente. Si la nube que usa esta PC desaparece
// (se cambió de servidor), la PC lee ese archivo, comprueba que el servidor nuevo conoce la clave de sincronización y pasa a usarlo sola.
const PUNTERO = process.env.OMEGA_PUNTERO || 'https://raw.githubusercontent.com/abourachidj88-bit/omega-omega-funcional-box-6cb4a/main/nube.json';
const URL_VALIDA = process.env.OMEGA_PUNTERO ? /^https?:\/\/[^\s]+$/i : /^https:\/\/[a-z0-9][a-z0-9-]*\.onrender\.com$/i; // con OMEGA_PUNTERO (solo pruebas) se admiten direcciones locales
let enCurso = null;
function leerEmbebida() {
  const cand = [];
  try { if (process.env.OMEGA_LANZADOR_JS) cand.push(require('node:path').join(require('node:path').dirname(process.env.OMEGA_LANZADOR_JS), 'src', 'nube-embebida.json')); } catch (_) {}
  cand.push(require('node:path').join(__dirname, 'nube-embebida.json'));
  for (const f of cand) { try { return JSON.parse(require('node:fs').readFileSync(f, 'utf8')); } catch (_) {} }
  return null;
}
function configuracion() {
  const env = (typeof process !== 'undefined' && process.env) || {};
  let url = env.NUBE_URL || '', clave = env.NUBE_CLAVE || '';
  if (!url || !clave) { try { const { getConfig } = require('./db'); url = url || getConfig('sync_url', ''); clave = clave || getConfig('sync_clave', ''); } catch (_) {} } // conexión cargada desde el botón Sincronizar
  // Conexión incluida al armar el instalador (tiene prioridad sobre nube.txt, que puede traer una conexión vieja; el archivo NO está en GitHub ni en la nube; lo genera installer/build*.sh desde la variable OMEGA_SYNC_CLAVE).
  // Se busca en la carpeta del programa INSTALADO (la que usa el lanzador) y no en la versión descargada de la web, que no lleva ese archivo.
  { const e = leerEmbebida(); if (e && e.clave) { clave = e.clave; if (e.url) url = e.url; } }
  url = String(url).replace(/\/+$/, '');
  // Dirección oficial de la nube de OMEGA (no es un secreto: la clave sí, y esa nunca va en el código).
  // Si hay clave pero no dirección, o quedó la de un servicio viejo dado de baja, se usa la oficial.
  if ((!url && clave) || (url && NUBES_VIEJAS.some((h) => url.toLowerCase().includes(h)))) url = NUBE_OFICIAL;
  const baseUrl = url;
  // si la PC ya encontró y verificó una dirección nueva a partir de esta misma base, se usa esa
  if (url && clave) { try { const a = JSON.parse(require('./db').getConfig('nube_url_activa', 'null')); if (a && a.desde === url && URL_VALIDA.test(a.url || '')) url = a.url; } catch (_) {} }
  return { url, clave: clave || '', base: baseUrl };
}
function marcarRecuperable(e, r) { if (!r || r.status === 404 || r.status === 410) e.recuperable = true; return e; }
// Prueba que el servidor realmente conoce la clave (si no, no se acepta: evita que un puntero falso desvíe la PC)
async function servidorConoceLaClave(url, clave) {
  const nonce = crypto.randomBytes(16).toString('hex'); const ts = String(Date.now()); const cuerpo = JSON.stringify({ nonce });
  const r = await fetch(url + '/api/sync/prueba', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-sync-ts': ts, 'x-sync-firma': firmar(clave, ts, cuerpo) }, body: cuerpo, signal: AbortSignal.timeout(60000) });
  if (!r.ok) return false;
  const j = await r.json();
  return typeof j.prueba === 'string' && crypto.timingSafeEqual(Buffer.from(j.prueba.padEnd(64, '0').slice(0, 64)), Buffer.from(pruebaServidor(clave, nonce)));
}
const pruebaServidor = (clave, nonce) => crypto.createHmac('sha256', clave).update('servidor:' + nonce).digest('hex');
// Lee el puntero y, si indica otra dirección que además prueba conocer la clave, la guarda. Devuelve la nueva configuración o null.
async function recuperarDireccion(cfg) {
  try {
    const r = await fetch(PUNTERO, { signal: AbortSignal.timeout(15000), headers: { 'Cache-Control': 'no-cache' } });
    if (!r.ok) return null;
    const j = await r.json(); const nueva = String((j && j.url) || '').replace(/\/+$/, '');
    if (!URL_VALIDA.test(nueva) || nueva === cfg.url) return null;
    if (!(await servidorConoceLaClave(nueva, cfg.clave))) return null;
    require('./db').setConfig('nube_url_activa', JSON.stringify({ desde: cfg.base || cfg.url, url: nueva, cuando: new Date().toISOString() }));
    return configuracion();
  } catch (e) { if (process.env.OMEGA_DEBUG_SYNC) console.error('puntero:', e.message); return null; }
}
// Ejecuta una operación contra la nube; si la nube no existe más (sin conexión al servidor, 404 o 410) prueba con la dirección de respaldo y reintenta una vez
async function conRespaldo(cfg, operacion) {
  { const fresca = configuracion(); if (fresca.base === cfg.base && fresca.clave === cfg.clave) cfg = fresca; } // si ya se encontró una dirección nueva, se usa directamente
  try { return await operacion(cfg); }
  catch (e) {
    if (!(e && e.recuperable) || NODO === 'nube') throw e;
    const nueva = await recuperarDireccion(cfg);
    if (!nueva) throw e;
    return operacion(nueva);
  }
}
async function _post(cfg, cuerpoObj) {
  const cuerpo = JSON.stringify(cuerpoObj);
  const ts = String(Date.now());
  return conRespaldo(cfg, async (c) => {
    let r;
    try { r = await fetch(c.url + '/api/sync', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-sync-ts': ts, 'x-sync-firma': firmar(c.clave, ts, cuerpo) }, body: cuerpo, signal: AbortSignal.timeout(60000) }); }
    catch (e) { throw marcarRecuperable(new Error('No se pudo conectar con la nube: ' + (e.cause && e.cause.code || e.message)), null); }
    if (r.status === 401 || r.status === 403) throw new Error('La nube rechazó la clave de sincronización (revisá NUBE_CLAVE)');
    if (!r.ok) throw marcarRecuperable(new Error('La nube respondió ' + r.status + (r.status === 503 ? ' (puede estar despertando: reintentá en un minuto)' : '')), r);
    return r.json();
  });
}
function sincronizar(motivo = 'manual') {
  if (enCurso) return enCurso;
  enCurso = _sincronizar(motivo).finally(() => { enCurso = null; });
  return enCurso;
}
async function _sincronizar(motivo) {
  const { getConfig, setConfig, get } = require('./db');
  const cfg = configuracion();
  const hecho = (obj) => { setConfig('sync_ultimo_intento', new Date().toISOString()); setConfig('sync_resultado', JSON.stringify({ ...obj, motivo, cuando: new Date().toISOString() })); if (obj.ok) setConfig('sync_ultimo', new Date().toISOString()); return obj; };
  if (NODO === 'nube') return { ok: false, error: 'Este es el servidor en la nube' };
  if (!cfg.url || !cfg.clave) return hecho({ ok: false, error: 'La sincronización no está configurada (faltan NUBE_URL y NUBE_CLAVE en C:\\OMEGA\\config.txt)' });
  let epoch = getConfig('sync_epoch', null), desde = Number(getConfig('sync_desde', 0)), enviado = Number(getConfig('sync_enviado', 0));
  const total = { enviados: 0, recibidos: 0, conflictos: 0, repoblada: false };
  try {
    for (let pasada = 0; pasada < 2; pasada++) {
    if (pasada === 1) { enviado = Number(getConfig('sync_enviado', 0)); }
    for (let vuelta = 0; vuelta < 40; vuelta++) {
      const lote = leerCambios(enviado, LOTE);
      const resp = await _post(cfg, { epoch, desde, cambios: lote.cambios });
      if (resp.reiniciar) {
        // la nube arrancó vacía (o es la primera vez): se le envía toda la base
        epoch = resp.epoch; desde = 0; total.repoblada = true;
        const corte = get('SELECT COALESCE(MAX(seq), 0) AS m FROM sync_log').m;
        let ultima = null;
        for (const filas of todasLasFilas()) {
          ultima = await _post(cfg, { epoch, desde: 0, cambios: filas });
          total.enviados += filas.length;
        }
        if (ultima) { const rec = aplicar(ultima.cambios || []); total.recibidos += rec.aplicados; desde = ultima.hasta || 0; }
        enviado = corte;
        setConfig('sync_epoch', epoch); setConfig('sync_desde', desde); setConfig('sync_enviado', enviado);
        continue;
      }
      const rec = aplicar(resp.cambios || []);
      total.enviados += lote.cambios.length; total.recibidos += rec.aplicados; total.conflictos += rec.conflictos + ((resp.aplicados && resp.aplicados.conflictos) || 0);
      desde = resp.hasta; enviado = lote.hasta; epoch = resp.epoch;
      setConfig('sync_epoch', epoch); setConfig('sync_desde', desde); setConfig('sync_enviado', enviado);
      podar(enviado);
      if (!lote.hay_mas && !resp.hay_mas) break;
    }
    // Primera sincronización terminada: si ni la nube ni esta PC tenían clave de QR, se crea ahora y viaja en la segunda pasada
    if (getConfig('secreto_qr', null)) break;
    require('./auth').secretoQR(true);
    }
    return hecho({ ok: true, ...total });
  } catch (e) {
    return hecho({ ok: false, error: e.message || String(e) });
  }
}
function estado() {
  const { getConfig, get } = require('./db');
  const cfg = configuracion();
  const pendientes = NODO === 'pc' ? get('SELECT COUNT(DISTINCT tabla || pk) AS n FROM sync_log WHERE seq > ?', Number(getConfig('sync_enviado', 0))).n : 0;
  let resultado = null; try { resultado = JSON.parse(getConfig('sync_resultado', 'null')); } catch (_) {}
  return { nodo: NODO, alta: !!(process.env.ALTA_URL && process.env.ALTA_CLAVE), configurado: !!(cfg.url && cfg.clave), url: cfg.url, ultimo: getConfig('sync_ultimo', null), resultado, pendientes };
}
let programado = false;
function iniciarProgramador() {
  if (NODO !== 'pc' || programado) return;
  const cfg = configuracion();
  if (!cfg.url || !cfg.clave) return;
  programado = true;
  const tick = () => sincronizar('automatica').catch(() => {});
  setTimeout(tick, 8000);
  setInterval(tick, 2 * 60 * 1000).unref();
}

module.exports = { NODO, OFFSET_NUBE, instalar, leerCambios, aplicar, procesarPeticion, verificarFirma, pruebaServidor, conRespaldo, marcarRecuperable, recuperarDireccion, sincronizar, estado, iniciarProgramador, epochLocal, configuracion };
