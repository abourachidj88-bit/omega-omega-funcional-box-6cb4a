'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { db, DATA_DIR, getConfig, setConfig } = require('./db');
const { nowAR } = require('./util');

const BACKUP_DIR = process.env.BACKUP_DIR ? path.resolve(process.env.BACKUP_DIR) : path.join(DATA_DIR, 'backups');
const CONSERVAR = parseInt(process.env.BACKUP_CONSERVAR || '30', 10);
const HORA_BACKUP = parseInt(process.env.BACKUP_HORA || '22', 10);
fs.mkdirSync(BACKUP_DIR, { recursive: true });

function sello() {
  const a = nowAR();
  return a.fecha + '_' + String(a.hora).padStart(2, '0') + String(a.min).padStart(2, '0');
}

async function subirAOneDrive(archivo, nombre) {
  const { MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET, MS_USUARIO } = process.env;
  if (!MS_TENANT_ID || !MS_CLIENT_ID || !MS_CLIENT_SECRET || !MS_USUARIO) return { subido: false, motivo: 'API de OneDrive no configurada (se usa la carpeta sincronizada)' };
  const tk = await fetch('https://login.microsoftonline.com/' + MS_TENANT_ID + '/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: MS_CLIENT_ID, client_secret: MS_CLIENT_SECRET, scope: 'https://graph.microsoft.com/.default', grant_type: 'client_credentials' }),
  });
  if (!tk.ok) throw new Error('Microsoft Graph (token): ' + tk.status);
  const { access_token } = await tk.json();
  const contenido = fs.readFileSync(archivo);
  if (contenido.length > 4 * 1024 * 1024) {
    // Subida por sesión para archivos > 4 MB
    const ses = await fetch('https://graph.microsoft.com/v1.0/users/' + encodeURIComponent(MS_USUARIO) + '/drive/root:/omega/backups/' + nombre + ':/createUploadSession', {
      method: 'POST', headers: { Authorization: 'Bearer ' + access_token, 'Content-Type': 'application/json' }, body: JSON.stringify({ item: { '@microsoft.graph.conflictBehavior': 'replace' } }),
    });
    if (!ses.ok) throw new Error('Microsoft Graph (sesión): ' + ses.status);
    const { uploadUrl } = await ses.json();
    const CH = 5 * 320 * 1024;
    for (let i = 0; i < contenido.length; i += CH) {
      const parte = contenido.subarray(i, Math.min(i + CH, contenido.length));
      const r = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Length': String(parte.length), 'Content-Range': 'bytes ' + i + '-' + (i + parte.length - 1) + '/' + contenido.length }, body: parte });
      if (!r.ok && r.status !== 202) throw new Error('Microsoft Graph (parte): ' + r.status);
    }
  } else {
    const r = await fetch('https://graph.microsoft.com/v1.0/users/' + encodeURIComponent(MS_USUARIO) + '/drive/root:/omega/backups/' + nombre + ':/content', {
      method: 'PUT', headers: { Authorization: 'Bearer ' + access_token, 'Content-Type': 'application/octet-stream' }, body: contenido,
    });
    if (!r.ok) throw new Error('Microsoft Graph (subida): ' + r.status);
  }
  return { subido: true };
}

function copiarVideos() {
  const origen = path.join(DATA_DIR, 'uploads', 'videos');
  const destino = path.join(BACKUP_DIR, 'videos');
  if (!fs.existsSync(origen) || path.resolve(origen) === path.resolve(destino)) return 0;
  fs.mkdirSync(destino, { recursive: true });
  let n = 0;
  for (const f of fs.readdirSync(origen)) {
    const d = path.join(destino, f);
    if (!fs.existsSync(d)) { fs.copyFileSync(path.join(origen, f), d); n++; }
  }
  return n;
}

function rotar() {
  const files = fs.readdirSync(BACKUP_DIR).filter(f => /^omega-.*\.db$/.test(f)).sort();
  while (files.length > CONSERVAR) fs.unlinkSync(path.join(BACKUP_DIR, files.shift()));
}

let enCurso = false;
async function hacerBackup(motivo = 'manual') {
  if (enCurso) return { ok: false, error: 'Ya hay un backup en curso' };
  enCurso = true;
  try {
    const nombre = 'omega-' + sello() + '.db';
    const destino = path.join(BACKUP_DIR, nombre);
    if (fs.existsSync(destino)) fs.unlinkSync(destino);
    db.exec("VACUUM INTO '" + destino.replace(/'/g, "''") + "'");
    const videos = copiarVideos();
    rotar();
    let nube = { subido: false };
    try { nube = await subirAOneDrive(destino, nombre); } catch (e) { nube = { subido: false, motivo: e.message }; }
    const a = nowAR();
    setConfig('ultimo_backup', JSON.stringify({ fecha: a.fecha, hora: a.hora, min: a.min, archivo: nombre, motivo, videos_nuevos: videos, nube }));
    if (motivo === 'automatico') setConfig('ultimo_backup_auto_fecha', a.fecha);
    console.log('[backup] ' + nombre + ' (' + motivo + ')');
    return { ok: true, archivo: nombre, videos_nuevos: videos, nube };
  } catch (e) {
    console.error('[backup] error:', e.message);
    return { ok: false, error: e.message };
  } finally { enCurso = false; }
}

function listar() {
  return fs.readdirSync(BACKUP_DIR).filter(f => /^omega-.*\.db$/.test(f)).sort().reverse()
    .map(f => ({ archivo: f, bytes: fs.statSync(path.join(BACKUP_DIR, f)).size }));
}

function iniciarProgramador() {
  const revisar = () => {
    const a = nowAR();
    if (a.hora >= HORA_BACKUP && getConfig('ultimo_backup_auto_fecha') !== a.fecha) hacerBackup('automatico');
  };
  setInterval(revisar, 30 * 1000).unref();
  setTimeout(revisar, 3000).unref();
}

module.exports = { hacerBackup, listar, iniciarProgramador, BACKUP_DIR, HORA_BACKUP };
