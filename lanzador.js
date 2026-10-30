'use strict';
// Lanzador de OMEGA para Windows. Lo ejecuta el acceso directo del escritorio con el motor incluido (omega-node.exe).
//   (sin parámetros)  inicia el servidor si no está andando y abre OMEGA en una ventana propia
//   --silencioso      solo inicia el servidor (se usa al encender Windows)
//   --detener         apaga el servidor
// Lee C:\OMEGA\config.txt, nube.txt y alta.txt. Se ejecuta con el motor sin consola (omega-oculto.exe): el servidor corre en segundo plano,
// sin ninguna ventana (copias de las 22:00, sincronización y acceso desde los celulares). Para apagarlo usá "Detener OMEGA" del menú Inicio.
// Lo que el servidor escribe queda en C:\OMEGA\omega.log. Para verlo en pantalla (diagnóstico): modo-visible.bat.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const cp = require('node:child_process');

const HOME = process.env.OMEGA_HOME || 'C:\\OMEGA';
const args = process.argv.slice(2);
const silencioso = args.includes('--silencioso') || args.includes('--reiniciar'), detener = args.includes('--detener'), reiniciar = args.includes('--reiniciar');

function leerCfg(archivo) {
  const out = {};
  try {
    for (const linea of fs.readFileSync(archivo, 'utf8').split(/\r?\n/)) {
      const t = linea.trim(); const i = t.indexOf('=');
      if (i > 0 && t[0] !== '#') out[t.slice(0, i).trim().toUpperCase()] = t.slice(i + 1).trim();
    }
  } catch (_) {}
  return out;
}
const cfg = { PORT: '3000', DATA_DIR: path.join(HOME, 'datos'), BACKUP_DIR: path.join(HOME, 'copias'), ...leerCfg(path.join(HOME, 'config.txt')), ...leerCfg(path.join(HOME, 'nube.txt')), ...leerCfg(path.join(HOME, 'alta.txt')) };
for (const [k, v] of Object.entries(cfg)) if (v !== '' && (k === 'PORT' || k === 'DATA_DIR' || k === 'BACKUP_DIR' || k === 'NUBE_URL' || k === 'NUBE_CLAVE' || k === 'ALTA_URL' || k === 'ALTA_CLAVE')) process.env[k] = v;
process.env.OMEGA_LANZADOR_JS = __filename; process.env.OMEGA_HOME = HOME; process.env.OMEGA_NUBE_TXT = path.join(HOME, 'nube.txt'); process.env.OMEGA_LANZADOR = '1';
const PORT = parseInt(cfg.PORT, 10) || 3000;
const LOG = path.join(HOME, 'omega.log');

function activo() {
  return new Promise((res) => {
    const r = http.get({ host: '127.0.0.1', port: PORT, path: '/api/estado', timeout: 1500 }, (x) => { x.resume(); res(x.statusCode === 200); });
    r.on('timeout', () => { r.destroy(); res(false); }); r.on('error', () => res(false));
  });
}
const esperar = (ms) => new Promise(r => setTimeout(r, ms));
function colaLog(n = 600) { try { const t = fs.readFileSync(LOG, 'utf8'); return t.slice(-n); } catch (_) { return ''; } }

function abrirNavegador(url) {
  const pf = process.env.ProgramFiles || 'C:\\Program Files', pf86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', local = process.env.LocalAppData || '';
  const cand = [pf86 + '\\Microsoft\\Edge\\Application\\msedge.exe', pf + '\\Microsoft\\Edge\\Application\\msedge.exe', pf + '\\Google\\Chrome\\Application\\chrome.exe', pf86 + '\\Google\\Chrome\\Application\\chrome.exe', local + '\\Google\\Chrome\\Application\\chrome.exe'];
  const exe = cand.find(c => { try { return fs.existsSync(c); } catch (_) { return false; } });
  try {
    if (exe) cp.spawn(exe, ['--app=' + url, '--window-size=1280,860'], { detached: true, stdio: 'ignore' }).unref();
    else if (process.platform === 'win32') cp.spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
  } catch (_) {}
}
function mostrarError(titulo, detalle) {
  console.error('\n[OMEGA] ' + titulo + '\n' + detalle);
  try {
    const f = path.join(HOME, 'error.html');
    const esc = (s) => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    fs.writeFileSync(f, '<!doctype html><meta charset="utf-8"><title>OMEGA</title><body style="font-family:Segoe UI,Arial;max-width:680px;margin:40px auto;padding:0 16px"><h2>OMEGA no pudo iniciar</h2><p>' + esc(titulo) + '</p><pre style="background:#f3f3f3;padding:12px;white-space:pre-wrap">' + esc(detalle) + '</pre><p>Archivo completo: ' + esc(LOG) + '</p></body>');
    if (process.platform === 'win32') cp.spawn('cmd', ['/c', 'start', '', f], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
  } catch (_) {}
}

// ---- registro (omega.log): lo que el servidor escribe en pantalla también queda en el archivo
function registrarEnArchivo() {
  try {
    fs.mkdirSync(HOME, { recursive: true });
    try { if (fs.statSync(LOG).size > 3 * 1024 * 1024) fs.renameSync(LOG, LOG + '.old'); } catch (_) {}
    const out = fs.createWriteStream(LOG, { flags: 'a' });
    for (const canal of [process.stdout, process.stderr]) {
      const original = canal.write.bind(canal);
      canal.write = (chunk, ...resto) => { try { out.write(chunk); } catch (_) {} return original(chunk, ...resto); };
    }
    out.write('\n--- ' + new Date().toISOString() + ' inicio de OMEGA ---\n');
  } catch (_) {}
}


// ---- actualización automática: si hay una versión nueva descargada (C:\OMEGA\actualizacion) y es más nueva que la instalada, se usa esa.
// Si no arranca, se marca como fallida y se vuelve a la versión instalada.
const ACT_DIR = path.join(HOME, 'actualizacion'), ACT_JSON = path.join(ACT_DIR, 'actual.json');
const numVer = (v) => (Number(v && v.numero) || 0) * 1000 + (Number(v && v.revision) || 0);
function leerAct() { try { return JSON.parse(fs.readFileSync(ACT_JSON, 'utf8')); } catch (_) { return null; } }
function guardarAct(a) { try { fs.writeFileSync(ACT_JSON, JSON.stringify(a, null, 1)); } catch (_) {} }
function elegirApp() {
  const a = leerAct();
  if (!a || !a.dir || a.estado === 'fallida') return { dir: __dirname, act: null };
  if (a.estado === 'probando') { a.estado = 'fallida'; a.motivo = 'no arrancó (se volvió a la versión instalada)'; guardarAct(a); console.log('La versión descargada no arrancó la vez anterior: se usa la instalada.'); return { dir: __dirname, act: null }; }
  let base = {}; try { base = require(path.join(__dirname, 'src', 'version.js')); } catch (_) {}
  if (numVer(a) <= numVer(base) || !fs.existsSync(path.join(a.dir, 'server.js'))) return { dir: __dirname, act: null };
  return { dir: a.dir, act: a };
}

async function apagar() {
  const token = (() => { try { return fs.readFileSync(path.join(cfg.DATA_DIR, '.apagar'), 'utf8').trim(); } catch (_) { return ''; } })();
  if (!(await activo())) { console.log('OMEGA ya estaba detenido.'); return 0; }
  await new Promise((res) => {
    const r = http.request({ host: '127.0.0.1', port: PORT, path: '/__omega/apagar', method: 'POST', headers: { 'x-omega-token': token, 'content-length': 0 }, timeout: 3000 }, (x) => { x.resume(); x.on('end', res); });
    r.on('error', res); r.on('timeout', () => { r.destroy(); res(); }); r.end();
  });
  for (let i = 0; i < 20; i++) { await esperar(400); if (!(await activo())) { console.log('OMEGA detenido.'); return 0; } }
  console.log('No se pudo detener OMEGA. Cerralo desde el Administrador de tareas (proceso omega-oculto.exe).');
  return 1;
}

(async () => {
  if (detener) { const c = await apagar(); await esperar(1500); process.exit(c); }
  if (reiniciar) { await apagar(); await esperar(600); }
  if (await activo()) { if (!silencioso) abrirNavegador('http://localhost:' + PORT + '/'); await esperar(300); process.exit(0); }
  registrarEnArchivo();
  process.title = 'OMEGA servidor';
  console.log('OMEGA se está iniciando (servidor en segundo plano; el registro queda en ' + LOG + ').');
  let listo = false;
  const elegida = elegirApp();
  const fallo = (e) => { if (listo) { console.error(e && e.stack || e); return; }
    if (elegida.act) { // la versión descargada no pudo iniciar: se la descarta y se arranca la instalada
      const a = leerAct(); if (a) { a.estado = 'fallida'; a.motivo = String(e && e.message || e).slice(0, 300); guardarAct(a); }
      console.error('La versión descargada falló al iniciar; vuelvo a la instalada. ' + (e && e.message || ''));
      try { cp.spawn(process.execPath, ['--disable-warning=ExperimentalWarning', __filename, '--reiniciar'], { detached: true, stdio: 'ignore', windowsHide: true, env: process.env }).unref(); } catch (_) {}
      setTimeout(() => process.exit(1), 500); return;
    } mostrarError(e && e.code === 'EADDRINUSE' ? 'El puerto ' + PORT + ' está ocupado por otro programa.' : 'El servidor se detuvo al iniciar.', (e && (e.stack || e.message) || String(e)) + '\n\n' + colaLog()); setTimeout(() => process.exit(1), 800); };
  process.on('uncaughtException', fallo); process.on('unhandledRejection', fallo);
  try { fs.mkdirSync(cfg.DATA_DIR, { recursive: true }); fs.mkdirSync(cfg.BACKUP_DIR, { recursive: true }); } catch (_) {}
  if (elegida.act) { elegida.act.estado = 'probando'; guardarAct(elegida.act); console.log('Usando la versión descargada: ' + (elegida.act.nombre || elegida.act.numero) + ' (' + elegida.dir + ')'); }
  try { process.chdir(elegida.dir); require(path.join(elegida.dir, 'server.js')); } catch (e) { return fallo(e); }
  for (let i = 0; i < 80; i++) { await esperar(400); if (await activo()) { listo = true; break; } }
  if (!listo) return fallo(new Error('El servidor no respondió a tiempo.'));
  if (elegida.act) { elegida.act.estado = 'ok'; delete elegida.act.motivo; guardarAct(elegida.act); }
  console.log('OMEGA listo en http://localhost:' + PORT + '/');
  if (!silencioso) abrirNavegador('http://localhost:' + PORT + '/');
})();
