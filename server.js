'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { pipeline } = require('node:stream/promises');

const { get, run, DATA_DIR } = require('./src/db');
const backup = require('./src/backup');
const { dispatch, route, HttpError, bad, STAFF, iniciarAutoPlan } = require('./src/api');
const sync = require('./src/sync');
// direcciones de la PC dentro de la red del gimnasio (para el QR de instalación)
try {
  globalThis.__OMEGA_IPS__ = Object.values(require('node:os').networkInterfaces()).flat()
    .filter(i => i && i.family === 'IPv4' && !i.internal && !/^169\.254\./.test(i.address)).map(i => i.address);
} catch (_) { globalThis.__OMEGA_IPS__ = []; }

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';
const PUBLIC_DIR = path.join(__dirname, 'public');
const VIDEO_DIR = path.join(DATA_DIR, 'uploads', 'videos');
const MAX_VIDEO = parseInt(process.env.MAX_VIDEO_MB || '400', 10) * 1024 * 1024;


function json(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}
function leerJson(req, limit = 12 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on('data', c => { size += c.length; if (size > limit) { reject(new HttpError(413, 'Contenido demasiado grande')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { req.rawBody = Buffer.concat(chunks).toString('utf8'); resolve(JSON.parse(req.rawBody)); } catch (_) { reject(bad('JSON inválido')); }
    });
    req.on('error', reject);
  });
}
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.m4v': 'video/mp4',
};
function sendFile(req, res, file, cache) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); return res.end('No encontrado'); }
    const ext = path.extname(file).toLowerCase();
    const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': cache || 'no-cache', 'Accept-Ranges': 'bytes' };
    const range = req.headers.range;
    if (range && /^bytes=/.test(range)) {
      const m = /bytes=(\d*)-(\d*)/.exec(range);
      let start = m[1] ? parseInt(m[1], 10) : 0;
      let end = m[2] ? parseInt(m[2], 10) : st.size - 1;
      if (!m[1] && m[2]) { start = Math.max(0, st.size - parseInt(m[2], 10)); end = st.size - 1; }
      if (start >= st.size || end >= st.size || start > end) { res.writeHead(416, { 'Content-Range': 'bytes */' + st.size }); return res.end(); }
      res.writeHead(206, { ...headers, 'Content-Range': 'bytes ' + start + '-' + end + '/' + st.size, 'Content-Length': end - start + 1 });
      return fs.createReadStream(file, { start, end }).pipe(res);
    }
    res.writeHead(200, { ...headers, 'Content-Length': st.size });
    fs.createReadStream(file).pipe(res);
  });
}

// ------------------------------------------------------------ videos (se guardan como archivos)
route('PUT', '/api/ejercicios/:id/video', STAFF, async ({ req, params }) => {
  const e = get('SELECT * FROM ejercicios WHERE id = ?', Number(params.id));
  if (!e) throw new HttpError(404, 'Ejercicio no encontrado');
  const ext = (String(req.headers['x-extension'] || '').toLowerCase().replace(/[^a-z0-9]/g, '')) || 'mp4';
  if (!['mp4', 'webm', 'mov', 'm4v'].includes(ext)) throw bad('Formato de video no admitido (mp4, webm, mov)');
  const len = parseInt(req.headers['content-length'] || '0', 10);
  if (len > MAX_VIDEO) throw new HttpError(413, 'El video supera el máximo de ' + Math.round(MAX_VIDEO / 1048576) + ' MB');
  const nombre = 'ej' + e.id + '-' + Date.now() + '.' + ext;
  const destino = path.join(VIDEO_DIR, nombre);
  let size = 0;
  const limite = async function* (src) { for await (const c of src) { size += c.length; if (size > MAX_VIDEO) throw new HttpError(413, 'El video supera el máximo permitido'); yield c; } };
  try { await pipeline(req, limite, fs.createWriteStream(destino)); }
  catch (err) { fs.rm(destino, () => {}); throw err; }
  if (size === 0) { fs.rm(destino, () => {}); throw bad('Archivo vacío'); }
  if (e.video) fs.rm(path.join(VIDEO_DIR, path.basename(e.video)), () => {});
  run('UPDATE ejercicios SET video = ? WHERE id = ?', '/media/videos/' + nombre, e.id);
  return { video: '/media/videos/' + nombre, bytes: size };
});
route('DELETE', '/api/ejercicios/:id/video', STAFF, ({ params }) => {
  const e = get('SELECT * FROM ejercicios WHERE id = ?', Number(params.id));
  if (!e) throw new HttpError(404, 'Ejercicio no encontrado');
  if (e.video) fs.rm(path.join(VIDEO_DIR, path.basename(e.video)), () => {});
  run('UPDATE ejercicios SET video = NULL WHERE id = ?', e.id);
  return { ok: true };
});

// ------------------------------------------------------------ servidor
async function handle(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const pathname = decodeURIComponent(url.pathname);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');

  if (pathname.startsWith('/api/')) {
    req.readJson = (limit) => leerJson(req, limit);
    const out = await dispatch(req, pathname, Object.fromEntries(url.searchParams));
    if (out.status === 413) res.setHeader('Connection', 'close');
    return json(res, out.status, out.body);
  }

  // Apagado ordenado desde "Detener OMEGA": solo desde esta misma PC y con la ficha secreta que el servidor deja en su carpeta de datos
  if (pathname === '/__omega/apagar' && req.method === 'POST') {
    const local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
    let ok = false; try { ok = local && String(req.headers['x-omega-token'] || '') === fs.readFileSync(path.join(DATA_DIR, '.apagar'), 'utf8').trim() && fs.readFileSync(path.join(DATA_DIR, '.apagar'), 'utf8').trim().length > 10; } catch (_) {}
    if (!ok) { res.writeHead(403); return res.end(); }
    res.writeHead(200, { 'Content-Length': 0 }); res.end();
    setTimeout(() => { try { server.close(); } catch (_) {} process.exit(0); }, 300);
    return;
  }

  // Ícono y manifiesto de la app: se arman con el logo del gimnasio (si cargó uno); si no, los de OMEGA
  if (pathname === '/manifest.webmanifest' || /^\/icons\/(app-(64|180|192|256|512)|maskable-512|apple-touch-icon|favicon)\.png$/.test(pathname)) {
    const { getConfig } = require('./src/db');
    const clave = { '/icons/favicon.png': 'icono_64', '/icons/apple-touch-icon.png': 'icono_180', '/icons/maskable-512.png': 'icono_m512' }[pathname] || (pathname.startsWith('/icons/app-') ? 'icono_' + /app-(\d+)/.exec(pathname)[1] : null);
    if (clave) {
      const d = getConfig(clave, '');
      const m = d && /^data:image\/png;base64,(.+)$/.exec(d);
      if (m) { const buf = Buffer.from(m[1], 'base64'); res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'no-cache', 'Content-Length': buf.length }); return res.end(buf); }
      if (pathname.startsWith('/icons/app-')) { const n = /app-(\d+)/.exec(pathname)[1]; return sendFile(req, res, path.join(PUBLIC_DIR, 'icons', n === '512' ? 'icon-512.png' : 'icon-192.png'), 'no-cache'); }
    } else {
      const man = JSON.parse(fs.readFileSync(path.join(PUBLIC_DIR, 'manifest.webmanifest'), 'utf8'));
      const nombre = getConfig('marca_nombre', 'OMEGA');
      let tema = {}; try { tema = JSON.parse(getConfig('tema', '{}') || '{}'); } catch (_) {}
      const v = getConfig('icono_v', '');
      man.name = nombre + ' · Gestión del gimnasio'; man.short_name = nombre.slice(0, 12);
      if (tema.fondo_color) { man.background_color = tema.fondo_color; man.theme_color = tema.fondo_color; }
      if (v) man.icons = [
        { src: '/icons/app-192.png?v=' + v, sizes: '192x192', type: 'image/png' }, { src: '/icons/app-512.png?v=' + v, sizes: '512x512', type: 'image/png' },
        { src: '/icons/maskable-512.png?v=' + v, sizes: '512x512', type: 'image/png', purpose: 'maskable' }];
      const out = Buffer.from(JSON.stringify(man));
      res.writeHead(200, { 'Content-Type': 'application/manifest+json', 'Cache-Control': 'no-cache', 'Content-Length': out.length }); return res.end(out);
    }
  }

  if (pathname.startsWith('/media/videos/')) return sendFile(req, res, path.join(VIDEO_DIR, path.basename(pathname)), 'public, max-age=31536000, immutable');

  let file = path.normalize(path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname));
  if (!file.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end(); }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(PUBLIC_DIR, 'index.html');
  const cache = /\/(vendor|icons)\//.test(file) ? 'public, max-age=86400' : 'no-cache';
  return sendFile(req, res, file, cache);
}

const server = http.createServer((req, res) => { handle(req, res).catch(e => { console.error(e); if (!res.headersSent) json(res, 500, { error: 'Error interno' }); }); });
server.requestTimeout = 0;
server.listen(PORT, HOST, () => {
  console.log('OMEGA escuchando en http://' + (HOST === '0.0.0.0' ? 'localhost' : HOST) + ':' + PORT);
  console.log('Datos: ' + DATA_DIR + ' | Backups: ' + backup.BACKUP_DIR + ' (todos los días a las ' + backup.HORA_BACKUP + ':00 hora Argentina)');
});
if (process.env.OMEGA_LANZADOR === '1') { // ficha para poder apagar el servidor de forma ordenada
  try { fs.writeFileSync(path.join(DATA_DIR, '.apagar'), require('node:crypto').randomBytes(24).toString('hex')); } catch (_) {}
}
backup.iniciarProgramador();
sync.iniciarProgramador();
try { require('./src/actualizar').iniciarProgramador(); } catch (e) { console.error('actualización automática:', e.message); }
iniciarAutoPlan();
// Al instalar una versión nueva se hace una copia de seguridad antes de seguir (los datos nunca se pierden)
{
  const { getConfig, setConfig } = require('./src/db');
  const V = require('./src/version');
  const anterior = getConfig('version_app', null);
  if (anterior !== V.nombre) {
    (anterior ? backup.hacerBackup('actualizacion') : Promise.resolve()).finally(() => setConfig('version_app', V.nombre));
  }
}
process.on('SIGTERM', () => { server.close(); process.exit(0); });

module.exports = { server };