'use strict';
// OMEGA - Servicio de alta de gimnasios. Lo despliega UNA vez el dueño del sistema (por ejemplo en Render).
// Guarda las claves de GitHub y Render como variables de entorno; las PCs de los gimnasios solo conocen ALTA_CLAVE
// (viene dentro del instalador) y nunca ven las claves de GitHub ni de Render.
//   GITHUB_TOKEN, RENDER_API_KEY, ALTA_CLAVE (obligatorias) · PLANTILLA (dueño/repo) · ALTA_MAX_HORA (def. 5) · PORT
const http = require('http');
const crypto = require('crypto');
const { altaGimnasio } = require('./alta-core');

const PORT = Number(process.env.PORT) || 4000;
const MAX_HORA = Number(process.env.ALTA_MAX_HORA) || 5;
const jobs = new Map();           // instalacion -> estado
const creadas = [];               // marcas de tiempo de altas iniciadas (límite por hora)
const igual = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
const json = (res, c, o) => { res.writeHead(c, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(o)); };
const leer = (req) => new Promise((ok, no) => { let b = ''; req.on('data', d => { b += d; if (b.length > 5000) { req.destroy(); no(new Error('grande')); } }); req.on('end', () => { try { ok(b ? JSON.parse(b) : {}); } catch (e) { no(e); } }); });

function iniciar(id, nombre, opciones) {
  const j = { estado: 'en_curso', fase: 'Creando el repositorio…', desde: Date.now() };
  jobs.set(id, j);
  const sufijo = crypto.createHash('sha1').update(id).digest('hex').slice(0, 5);
  (opciones.alta || altaGimnasio)({
    nombre, sufijo, plantilla: process.env.PLANTILLA || 'abourachidj88-bit/omega-gimnasio',
    githubToken: process.env.GITHUB_TOKEN, renderKey: process.env.RENDER_API_KEY, plan: process.env.RENDER_PLAN, region: process.env.RENDER_REGION,
    esperaMs: opciones.esperaMs, cadaMs: opciones.cadaMs,
    log: m => { j.fase = m.replace(/^\d\/\d\s*/, ''); },
  }).then(r => { Object.assign(j, { estado: 'listo', fase: 'Listo', url: r.url, clave: r.clave, codigo: r.codigo, vivo: r.vivo }); })
    .catch(e => { Object.assign(j, { estado: 'error', fase: 'Error', error: String(e.message || e).slice(0, 300) }); });
}

function crearServidor(opciones = {}) {
  const clave = opciones.clave || process.env.ALTA_CLAVE || '';
  return http.createServer(async (req, res) => {
    try {
      const ruta = req.url.split('?')[0];
      if (ruta === '/api/estado') return json(res, 200, { ok: true, servicio: 'omega-alta' });
      const aut = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
      if (!clave || clave.length < 16 || !igual(aut, clave)) return json(res, 401, { error: 'No autorizado' });
      // limpieza: los resultados se conservan 24 h
      for (const [k, v] of jobs) if (Date.now() - v.desde > 24 * 3600e3) jobs.delete(k);
      const idOk = (s) => /^[A-Za-z0-9_-]{16,64}$/.test(String(s || ''));
      if (req.method === 'POST' && ruta === '/alta') {
        const b = await leer(req);
        const nombre = String(b.nombre || '').trim().slice(0, 60);
        if (!idOk(b.instalacion)) return json(res, 400, { error: 'Identificador de instalación inválido' });
        if (nombre.length < 2) return json(res, 400, { error: 'Falta el nombre del gimnasio' });
        const ya = jobs.get(b.instalacion);
        if (ya && ya.estado !== 'error') return json(res, 200, { estado: ya.estado, fase: ya.fase });
        const hora = Date.now() - 3600e3; while (creadas.length && creadas[0] < hora) creadas.shift();
        if (creadas.length >= MAX_HORA) return json(res, 429, { error: 'Demasiadas altas en la última hora. Probá más tarde.' });
        creadas.push(Date.now());
        iniciar(b.instalacion, nombre, opciones);
        return json(res, 202, { estado: 'en_curso' });
      }
      const m = /^\/alta\/([A-Za-z0-9_-]{16,64})$/.exec(ruta);
      if (req.method === 'GET' && m) {
        const j = jobs.get(m[1]); if (!j) return json(res, 404, { error: 'No hay un alta en curso para esta instalación' });
        return json(res, 200, { estado: j.estado, fase: j.fase, url: j.url, clave: j.clave, codigo: j.codigo, error: j.error });
      }
      json(res, 404, { error: 'No encontrado' });
    } catch (e) { json(res, 400, { error: 'Solicitud inválida' }); }
  });
}
module.exports = { crearServidor };
if (require.main === module) {
  for (const k of ['GITHUB_TOKEN', 'RENDER_API_KEY', 'ALTA_CLAVE']) if (!process.env[k]) { console.error('Falta la variable de entorno ' + k); process.exit(1); }
  crearServidor().listen(PORT, () => console.log('Servicio de alta de OMEGA escuchando en el puerto ' + PORT));
}
