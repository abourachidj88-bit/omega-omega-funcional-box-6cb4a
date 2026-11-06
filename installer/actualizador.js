'use strict';
// Actualizador de OMEGA (se ejecuta con el motor ya instalado: omega-node.exe). Lo usa OMEGA-Actualizador-VersionN.exe.
//   1) detecta la versión instalada y la compara con la del paquete (si ya está igual o más nueva, no hace nada)
//   2) apaga OMEGA de forma ordenada y COPIA los datos (C:\OMEGA\datos) en C:\OMEGA\respaldo-actualizacion
//   3) reemplaza el programa (carpeta app); el anterior queda en app-anterior
//   4) inicia OMEGA y comprueba que responda con la versión nueva. Si no arranca, vuelve solo a la versión anterior.
// Los datos nunca se borran ni se modifican: las bases de datos se actualizan solas al iniciar (cada versión suma lo que falta, desde cualquier versión anterior).
// Códigos de salida: 0 actualizado · 2 ya estaba al día · 3 no hay una instalación compatible · 4 motor viejo · 5 la nueva no arrancó (se volvió a la anterior) · 6 no se pudo apagar OMEGA · 7 no se pudo reemplazar el programa
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const cp = require('node:child_process');

const valor = (n, d) => { const i = process.argv.indexOf('--' + n); if (i < 0) return d; const v = process.argv[i + 1]; return v && !v.startsWith('--') ? v : true; };
const INST = String(valor('instdir', '')), HOME = String(valor('home', 'C:\\OMEGA')), PAY = String(valor('payload', __dirname));
const SOLO = !!valor('solo-comprobar', false), SALIDA = valor('salida', ''), ESPERA = Number(valor('espera', 90)) || 90;
const LOG = path.join(HOME, 'actualizador.log');
const plano = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, ''); // la ventana del instalador no muestra bien los acentos
function say(m) {
  console.log(plano(m));
  try { fs.mkdirSync(HOME, { recursive: true }); fs.appendFileSync(LOG, '[' + new Date().toISOString() + '] ' + m + '\n'); } catch (_) {}
}
const esperar = (ms) => new Promise(r => setTimeout(r, ms));
const num = (v) => (v ? (v.numero || 0) * 1000 + (v.revision || 0) : -1);
const txt = (v) => (v ? v.nombre + (v.revision ? ' (revision ' + v.revision + ')' : '') : 'desconocida');

function leerVersion(dir) {
  try {
    const t = fs.readFileSync(path.join(dir, 'src', 'version.js'), 'utf8');
    const n = /numero:\s*(\d+)/.exec(t), r = /revision:\s*(\d+)/.exec(t), nom = /nombre:\s*'([^']+)'/.exec(t);
    return n ? { numero: Number(n[1]), revision: r ? Number(r[1]) : 0, nombre: nom ? nom[1] : 'Versión ' + n[1] } : null;
  } catch (_) { return null; }
}
function leerCfg(archivo) {
  const out = {};
  try { for (const l of fs.readFileSync(archivo, 'utf8').split(/\r?\n/)) { const t = l.trim(), i = t.indexOf('='); if (i > 0 && t[0] !== '#') out[t.slice(0, i).trim().toUpperCase()] = t.slice(i + 1).trim(); } } catch (_) {}
  return out;
}
const cfg = { PORT: '3000', DATA_DIR: path.join(HOME, 'datos'), ...leerCfg(path.join(HOME, 'config.txt')) };
const PORT = parseInt(cfg.PORT, 10) || 3000;
function estadoServidor() {
  return new Promise((res) => {
    const r = http.get({ host: '127.0.0.1', port: PORT, path: '/api/estado', timeout: 1500 }, (x) => {
      let b = ''; x.on('data', d => b += d); x.on('end', () => { let j = null; try { j = JSON.parse(b); } catch (_) {} res({ ok: x.statusCode === 200, version: j && j.version }); });
    });
    r.on('timeout', () => { r.destroy(); res({ ok: false }); }); r.on('error', () => res({ ok: false }));
  });
}
const env = () => ({ ...process.env, OMEGA_HOME: HOME });
function lanzador(args, ruta) { return cp.spawnSync(process.execPath, ['--disable-warning=ExperimentalWarning', path.join(ruta, 'lanzador.js'), ...args], { env: env(), timeout: 40000, windowsHide: true, encoding: 'utf8' }); }
async function conReintentos(fn, veces = 6) {
  let ult;
  for (let i = 0; i < veces; i++) { try { return fn(); } catch (e) { ult = e; await esperar(1200); } }
  throw ult;
}
async function apagar(app) {
  if (!(await estadoServidor()).ok) return true;
  if (fs.existsSync(path.join(app, 'lanzador.js'))) lanzador(['--detener'], app);
  for (let i = 0; i < 25; i++) { if (!(await estadoServidor()).ok) return true; await esperar(500); }
  return false;
}
function iniciar(app) {
  try { cp.spawn(process.execPath, ['--disable-warning=ExperimentalWarning', path.join(app, 'lanzador.js'), '--silencioso'], { cwd: app, env: env(), detached: true, stdio: 'ignore', windowsHide: true }).unref(); } catch (e) { say('No se pudo iniciar OMEGA: ' + e.message); }
}
function ini(codigo, instalada, nueva, mensaje) {
  if (!SALIDA || SALIDA === true) return;
  try { fs.writeFileSync(SALIDA, '[r]\r\ncodigo=' + codigo + '\r\ninstalada=' + plano(instalada) + '\r\nnueva=' + plano(nueva) + '\r\nmensaje=' + plano(mensaje) + '\r\n'); } catch (_) {}
}

(async () => {
  const app = path.join(INST, 'app'), ant = path.join(INST, 'app-anterior');
  const nueva = leerVersion(path.join(PAY, 'app'));
  if (!nueva) { say('El paquete del actualizador esta incompleto.'); ini(3, '', '', 'Paquete incompleto'); process.exit(3); }
  let instalada = leerVersion(app);
  // una versión ya descargada por el botón "Actualizar" (C:\OMEGA\actualizacion) cuenta como instalada si es más nueva y no falló
  try {
    const a = JSON.parse(fs.readFileSync(path.join(HOME, 'actualizacion', 'actual.json'), 'utf8'));
    if (a && a.estado !== 'fallida' && a.dir && fs.existsSync(path.join(a.dir, 'server.js')) && num(a) > num(instalada)) instalada = { numero: a.numero, revision: a.revision || 0, nombre: a.nombre };
  } catch (_) {}
  // 1) ¿hay una instalación compatible?
  if (!INST || !fs.existsSync(path.join(app, 'lanzador.js')) || !fs.existsSync(path.join(app, 'server.js'))) {
    say('No se encontro una instalacion de OMEGA compatible en "' + INST + '". En una PC sin OMEGA (o con una version muy antigua) usa el Instalador Base.');
    ini(3, '', txt(nueva), 'No hay instalacion compatible'); process.exit(3);
  }
  const [maj, min] = process.versions.node.split('.').map(Number);
  if (maj < 22 || (maj === 22 && min < 13)) {
    say('El motor instalado (Node ' + process.versions.node + ') es anterior al que necesita esta version (22.13). Usa el Instalador Base.');
    ini(4, txt(instalada), txt(nueva), 'Motor viejo'); process.exit(4);
  }
  say('Version instalada: ' + txt(instalada) + '  ->  version del actualizador: ' + txt(nueva));
  if (instalada && num(instalada) >= num(nueva)) {
    say('OMEGA ya esta actualizado (la version instalada es igual o mas nueva). No se cambia nada.');
    ini(2, txt(instalada), txt(nueva), 'Ya esta al dia'); process.exit(2);
  }
  ini(0, txt(instalada), txt(nueva), 'Listo para actualizar');
  if (SOLO) process.exit(0);

  // 2) apagar OMEGA y copiar los datos
  say('Apagando OMEGA de forma ordenada...');
  if (!(await apagar(app))) { say('No se pudo apagar OMEGA. Cerralo desde el menu Inicio (Detener OMEGA) y volve a ejecutar el actualizador.'); process.exit(6); }
  const sello = new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 16).replace(/[-:T]/g, (c) => (c === 'T' ? '-' : ''));
  const respaldo = path.join(HOME, 'respaldo-actualizacion', sello + '-de-version-' + (instalada ? instalada.numero + '-r' + instalada.revision : 'desconocida'));
  try {
    if (fs.existsSync(cfg.DATA_DIR)) {
      fs.mkdirSync(path.dirname(respaldo), { recursive: true });
      fs.cpSync(cfg.DATA_DIR, respaldo, { recursive: true });
      say('Copia de los datos guardada en ' + respaldo);
      const todas = fs.readdirSync(path.dirname(respaldo)).sort();
      for (const v of todas.slice(0, Math.max(0, todas.length - 3))) fs.rmSync(path.join(path.dirname(respaldo), v), { recursive: true, force: true });
    } else say('Todavia no hay datos para copiar (' + cfg.DATA_DIR + ').');
  } catch (e) { say('No se pudo copiar los datos (' + e.message + '). Por seguridad no se actualiza.'); iniciar(app); process.exit(7); }

  // 3) reemplazar el programa
  say('Instalando ' + txt(nueva) + '...');
  try {
    fs.rmSync(ant, { recursive: true, force: true });
    await conReintentos(() => fs.renameSync(app, ant));
  } catch (e) { say('No se pudo reemplazar el programa (' + e.message + '). Cerra OMEGA y los antivirus que lo esten analizando y reintenta.'); iniciar(app); process.exit(7); }
  try { fs.cpSync(path.join(PAY, 'app'), app, { recursive: true }); }
  catch (e) { try { fs.rmSync(app, { recursive: true, force: true }); fs.renameSync(ant, app); } catch (_) {} say('No se pudo copiar el programa nuevo (' + e.message + '). Se dejo la version anterior.'); iniciar(app); process.exit(7); }
  // ventana de escritorio (Electron): solo se renueva su archivo principal, y solo si esta PC la tiene
  try {
    const dest = path.join(INST, 'escritorio', 'resources', 'app');
    if (fs.existsSync(dest) && fs.existsSync(path.join(PAY, 'electron-app'))) { fs.cpSync(path.join(PAY, 'electron-app'), dest, { recursive: true }); say('Ventana de escritorio actualizada.'); }
  } catch (e) { say('Aviso: no se pudo actualizar la ventana de escritorio (' + e.message + ').'); }
  try { fs.rmSync(path.join(HOME, 'actualizacion'), { recursive: true, force: true }); } catch (_) {} // descargas pendientes de versiones anteriores: ya no hacen falta

  // 4) iniciar y comprobar
  say('Iniciando OMEGA y comprobando que responda...');
  iniciar(app);
  let bien = false;
  for (let i = 0; i < ESPERA; i++) {
    await esperar(1000);
    const e = await estadoServidor();
    if (e.ok && String(e.version || '') === nueva.nombre) { bien = true; break; }
    if (e.ok && e.version && i > 20) { say('OMEGA responde pero informa "' + e.version + '".'); }
  }
  if (bien) { say('Listo: OMEGA ' + txt(nueva) + ' esta funcionando. Los datos se conservaron.'); process.exit(0); }

  // la versión nueva no arrancó: se vuelve a la anterior
  say('La version nueva no arranco. Volviendo a la version anterior...');
  await apagar(app);
  try {
    fs.rmSync(path.join(INST, 'app-fallida'), { recursive: true, force: true });
    await conReintentos(() => fs.renameSync(app, path.join(INST, 'app-fallida')));
    fs.renameSync(ant, app);
    iniciar(app);
    say('Se restauro la version anterior. El detalle esta en ' + path.join(HOME, 'omega.log') + ' y ' + LOG + '. Tus datos estan intactos (copia en ' + respaldo + ').');
  } catch (e) { say('No se pudo volver automaticamente (' + e.message + '). La version anterior esta en ' + ant + '.'); }
  process.exit(5);
})().catch((e) => { say('Error inesperado: ' + (e && e.stack || e)); process.exit(7); });
