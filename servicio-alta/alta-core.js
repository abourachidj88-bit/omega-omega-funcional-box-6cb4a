'use strict';
// OMEGA - Núcleo del alta de un gimnasio nuevo (lo usan el servicio de alta y la herramienta de línea de comandos).
// Crea un repositorio en GitHub a partir del repositorio plantilla y un servicio web en Render,
// y muestra la dirección, la clave de sincronización y un "código de conexión" para pegar en la app.
//
// Variables de entorno (nunca se guardan en archivos ni en el código):
//   GITHUB_TOKEN     token con permiso de crear repositorios
//   RENDER_API_KEY   clave de API de Render
// Uso:
//   node herramientas/alta-gimnasio.js --nombre "Gimnasio Sol" [--plantilla dueño/repo] [--privado] [--region oregon] [--plan free] [--prueba]
// Para pruebas: GITHUB_API / RENDER_API cambian las direcciones base.
const crypto = require('crypto');

const arg = (n, def) => { const i = process.argv.indexOf('--' + n); return i < 0 ? def : (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true); };
const GH = (process.env.GITHUB_API || 'https://api.github.com').replace(/\/$/, '');
const RD = (process.env.RENDER_API || 'https://api.render.com/v1').replace(/\/$/, '');
const slug = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
const pausa = ms => new Promise(r => setTimeout(r, ms));

async function http(base, token, method, ruta, cuerpo, extra) {
  const r = await fetch(base + ruta, {
    method,
    headers: Object.assign({ Authorization: 'Bearer ' + token, Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'omega-alta-gimnasio' }, extra || {}),
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const txt = await r.text(); let j = null; try { j = txt ? JSON.parse(txt) : null; } catch (_) {}
  if (!r.ok) { const e = new Error(`${method} ${ruta} -> ${r.status} ${(j && (j.message || j.error)) || txt.slice(0, 200)}`); e.status = r.status; throw e; }
  return j;
}

async function altaGimnasio(o) {
  const log = o.log || (() => {});
  const gh = o.githubToken, rd = o.renderKey;
  if (!gh || !rd) throw new Error('Faltan las variables de entorno GITHUB_TOKEN y RENDER_API_KEY.');
  if (!o.nombre || !slug(o.nombre)) throw new Error('Indicá el nombre del gimnasio con --nombre "…".');
  if (!/^[^/]+\/[^/]+$/.test(o.plantilla || '')) throw new Error('Indicá la plantilla como dueño/repositorio (--plantilla).');
  const [plOwner, plRepo] = o.plantilla.split('/');
  const nombreRepo = 'omega-' + slug(o.nombre) + (o.sufijo ? '-' + o.sufijo : '');
  const clave = crypto.randomBytes(24).toString('base64url');

  log('1/4 Creando el repositorio ' + nombreRepo + ' en GitHub…');
  const yo = await http(GH, gh, 'GET', '/user');
  let repo;
  try {
    repo = await http(GH, gh, 'POST', `/repos/${plOwner}/${plRepo}/generate`, { owner: yo.login, name: nombreRepo, description: 'OMEGA - nube de ' + o.nombre, private: !!o.privado, include_all_branches: false });
  } catch (e) {
    if (e.status !== 422) throw e;
    // ya existe (por ejemplo un intento anterior que se cortó): se reutiliza; si no existe, la plantilla no está marcada como Template
    try { repo = await http(GH, gh, 'GET', `/repos/${yo.login}/${nombreRepo}`); }
    catch (_) { throw new Error('GitHub rechazó crear ' + nombreRepo + ': revisá que el repositorio base esté marcado como "Template repository" (Settings).'); }
  }
  const repoUrl = repo.html_url || `https://github.com/${yo.login}/${nombreRepo}`;
  const rama = repo.default_branch || 'main';
  // GitHub copia la plantilla de forma asíncrona: antes de pedirle a Render que lo despliegue hay que esperar a que la rama exista
  log('1/4 Esperando que GitHub termine de copiar el repositorio…');
  let lista = false;
  for (let i = 0; i < (o.intentosRama || 45) && !lista; i++) {
    try { await http(GH, gh, 'GET', `/repos/${yo.login}/${nombreRepo}/branches/${encodeURIComponent(rama)}`); lista = true; }
    catch (e) { if (e.status !== 404) throw e; await pausa(o.cadaMs || 2000); }
  }
  if (!lista) throw new Error('GitHub todavía no terminó de copiar el repositorio ' + nombreRepo + '. Probá de nuevo en un minuto.');

  log('2/4 Buscando tu cuenta en Render…');
  const owners = await http(RD, rd, 'GET', '/owners?limit=20');
  const dueno = (Array.isArray(owners) ? owners : []).map(x => x.owner || x)[0];
  if (!dueno || !dueno.id) throw new Error('Render no devolvió ninguna cuenta/espacio de trabajo.');

  log('3/4 Creando el servicio web en Render…');
  const crear = () => http(RD, rd, 'POST', '/services', {
    type: 'web_service', name: nombreRepo, ownerId: dueno.id, repo: repoUrl, branch: rama, autoDeploy: 'yes',
    envVars: [{ key: 'OMEGA_NODO', value: 'nube' }, { key: 'SYNC_CLAVE', value: clave }],
    serviceDetails: { runtime: 'docker', plan: o.plan || 'free', region: o.region || 'oregon', healthCheckPath: '/api/estado', envSpecificDetails: { dockerfilePath: './Dockerfile', dockerContext: '.' } },
  });
  let sv;
  for (let i = 0; ; i++) {   // Render puede tardar unos segundos más que GitHub en ver la rama nueva
    try { sv = await crear(); break; }
    catch (e) { if (e.status === 400 && /branch/i.test(e.message) && i < 6) { await pausa(o.cadaMs || 5000); continue; } throw e; }
  }
  const s = sv.service || sv;
  let url = s.serviceDetails && s.serviceDetails.url;

  log('4/4 Esperando que Render publique el servicio (puede tardar varios minutos)…');
  const limite = Date.now() + (o.esperaMs != null ? o.esperaMs : 15 * 60e3);
  let vivo = false;
  while (Date.now() < limite && !o.sinEspera) {
    try {
      if (!url) { const d = await http(RD, rd, 'GET', '/services/' + s.id); url = (d.service || d).serviceDetails?.url; }
      if (url) { const r = await fetch(url + '/api/estado'); if (r.ok) { vivo = true; break; } }
    } catch (_) {}
    await pausa(o.cadaMs || 10e3);
  }
  if (url && !/^https?:/.test(url)) url = 'https://' + url;
  const codigo = url ? 'OMEGA1.' + Buffer.from(url + '|' + clave).toString('base64url') : null;
  return { nombre: o.nombre, repo: repoUrl, servicioId: s.id, url, clave, codigo, vivo };
}

module.exports = { altaGimnasio, slug };
