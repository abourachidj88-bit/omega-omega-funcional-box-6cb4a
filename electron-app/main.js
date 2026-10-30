'use strict';
// OMEGA de escritorio (Versión 5). Ventana propia, independiente del navegador. El servidor de OMEGA sigue siendo el mismo (corre en segundo
// plano con el motor incluido); esta ventana solo lo muestra. Si el servidor se reinicia (actualización), la ventana se reconecta sola.
const { app, BrowserWindow, Menu, shell, session, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');
const cp = require('node:child_process');

const HOME = process.env.OMEGA_HOME || 'C:\\OMEGA';
const INSTALL = path.resolve(path.dirname(process.execPath), '..');           // ...\OMEGA   (esta app vive en ...\OMEGA\escritorio)
const MOTOR = path.join(INSTALL, 'runtime', 'omega-oculto.exe');
const LANZADOR = path.join(INSTALL, 'app', 'lanzador.js');
const LOG = path.join(HOME, 'omega-escritorio.log');
function log(m) { try { fs.mkdirSync(HOME, { recursive: true }); fs.appendFileSync(LOG, new Date().toISOString() + ' ' + m + '\n'); } catch (_) {} }
function leerPuerto() {
  try { const m = /^\s*PORT\s*=\s*(\d+)/im.exec(fs.readFileSync(path.join(HOME, 'config.txt'), 'utf8')); if (m) return parseInt(m[1], 10); } catch (_) {}
  return 3000;
}
const PORT = process.env.OMEGA_PORT ? parseInt(process.env.OMEGA_PORT, 10) : leerPuerto();
const URL_APP = 'http://127.0.0.1:' + PORT + '/';
const esperar = (ms) => new Promise(r => setTimeout(r, ms));
function activo() {
  return new Promise((res) => {
    const r = http.get({ host: '127.0.0.1', port: PORT, path: '/api/estado', timeout: 1500 }, (x) => { x.resume(); res(x.statusCode === 200); });
    r.on('timeout', () => { r.destroy(); res(false); }); r.on('error', () => res(false));
  });
}
function iniciarServidor() {
  try {
    if (!fs.existsSync(MOTOR) || !fs.existsSync(LANZADOR)) { log('no se encontró el motor o el lanzador: ' + MOTOR); return false; }
    cp.spawn(MOTOR, ['--disable-warning=ExperimentalWarning', LANZADOR, '--silencioso'], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
    return true;
  } catch (e) { log('no se pudo iniciar el servidor: ' + e.message); return false; }
}
const pagina = (titulo, cuerpo) => 'data:text/html;charset=utf-8,' + encodeURIComponent('<!doctype html><meta charset="utf-8"><title>OMEGA</title><body style="margin:0;height:100vh;display:flex;align-items:center;justify-content:center;background:#0f1115;color:#e8eaf0;font-family:Segoe UI,Arial,sans-serif;text-align:center"><div style="max-width:560px;padding:24px"><h2 style="margin:0 0 10px">' + titulo + '</h2>' + cuerpo + '</div></body>');
const PAG_INICIO = pagina('Iniciando OMEGA…', '<p style="color:#9aa3b2">Un momento, se está preparando el sistema.</p>');
function colaLog() { try { return fs.readFileSync(path.join(HOME, 'omega.log'), 'utf8').slice(-700); } catch (_) { return ''; } }

let ventana = null, reconectando = false;
async function cargar() {
  ventana.loadURL(PAG_INICIO).catch(() => {});
  if (!(await activo())) iniciarServidor();
  for (let i = 0; i < 100; i++) { if (await activo()) break; await esperar(500); }
  if (!(await activo())) {
    const esc = (s) => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    ventana.loadURL(pagina('OMEGA no pudo iniciar', '<p style="color:#9aa3b2">El servidor no respondió. Cerrá esta ventana y volvé a abrir OMEGA. Si sigue igual, usá “OMEGA (navegador)” del menú Inicio.</p><pre style="text-align:left;background:#1a1d24;padding:10px;white-space:pre-wrap;font-size:12px">' + esc(colaLog()) + '</pre>')).catch(() => {});
    return;
  }
  ventana.loadURL(URL_APP).catch((e) => log('loadURL: ' + e.message));
}
// si el servidor se reinicia (actualización), se vuelve a conectar solo
async function reconectar() {
  if (reconectando || !ventana) return; reconectando = true;
  try {
    ventana.loadURL(PAG_INICIO).catch(() => {});
    for (let i = 0; i < 120; i++) { if (await activo()) { ventana.loadURL(URL_APP).catch(() => {}); break; } await esperar(1000); if (i === 8) iniciarServidor(); }
  } finally { reconectando = false; }
}

function crearVentana() {
  const icono = [path.join(HOME, 'omega.ico'), path.join(INSTALL, 'omega.ico')].find(p => { try { return fs.existsSync(p); } catch (_) { return false; } });
  ventana = new BrowserWindow({ width: 1320, height: 880, minWidth: 420, minHeight: 600, title: 'OMEGA', backgroundColor: '#0f1115', autoHideMenuBar: true, show: false, ...(icono ? { icon: icono } : {}), webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false } });
  ventana.once('ready-to-show', () => { ventana.show(); });
  ventana.on('closed', () => { ventana = null; });
  ventana.webContents.on('page-title-updated', (e) => { e.preventDefault(); });
  ventana.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//i.test(url)) return { action: 'allow' };
    if (/^(https?|mailto|tel):/i.test(url)) shell.openExternal(url).catch(() => {});
    return { action: 'deny' };
  });
  ventana.webContents.on('will-navigate', (e, url) => {
    if (url.startsWith('data:') || /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//i.test(url)) return;
    e.preventDefault(); if (/^(https?|mailto|tel):/i.test(url)) shell.openExternal(url).catch(() => {});
  });
  ventana.webContents.on('did-fail-load', (e, codigo, desc, url, principal) => { if (principal && url && url.startsWith(URL_APP) && codigo !== -3) { log('falló la carga (' + desc + '), reconectando'); reconectar(); } });
  ventana.webContents.on('render-process-gone', (e, d) => { log('render-process-gone: ' + d.reason); reconectar(); });
  cargar();
}

if (!app.requestSingleInstanceLock()) { app.quit(); }
else {
  app.on('second-instance', () => { if (ventana) { if (ventana.isMinimized()) ventana.restore(); ventana.focus(); } else crearVentana(); });
  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    // cámara (lector de QR), portapapeles y notificaciones: solo para la propia OMEGA
    session.defaultSession.setPermissionRequestHandler((wc, permiso, cb, det) => cb(/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//i.test(det.requestingUrl || '') && ['media', 'clipboard-sanitized-write', 'notifications', 'fullscreen'].includes(permiso)));
    crearVentana();
    app.on('activate', () => { if (!ventana) crearVentana(); });
  });
  app.on('window-all-closed', () => { app.quit(); });   // el servidor sigue andando en segundo plano (copias de las 22:00, celulares, sincronización)
  process.on('uncaughtException', (e) => { log('error: ' + (e && e.stack || e)); });
}
