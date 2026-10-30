'use strict';
// Prueba de la herramienta de alta contra un servidor simulado de GitHub y Render (no toca servicios reales).
const http = require('http'); const assert = require('assert');
const { altaGimnasio } = require('../servicio-alta/alta-core');
const visto = [];
const srv = http.createServer((req, res) => {
  let b = ''; req.on('data', d => b += d); req.on('end', () => {
    visto.push([req.method, req.url, req.headers.authorization, b ? JSON.parse(b) : null]);
    const j = (c, o) => { res.writeHead(c, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
    if (req.url === '/user') return j(200, { login: 'dueno' });
    if (req.url.endsWith('/generate')) return j(201, { html_url: 'https://github.com/dueno/omega-gimnasio-sol' });
    if (req.url.startsWith('/owners')) return j(200, [{ owner: { id: 'tea-1', name: 'x' } }]);
    if (req.url === '/services' && req.method === 'POST') return j(201, { service: { id: 'srv-1', serviceDetails: { url: 'http://127.0.0.1:' + srv.address().port } } });
    if (req.url === '/api/estado') return j(200, { ok: true });
    j(404, { message: 'no' });
  });
}).listen(0, async () => {
  const p = srv.address().port;
  process.env.GITHUB_API = process.env.RENDER_API = ''; 
  try {
    // las URLs base se leen al cargar: recargamos con las del simulado
    delete require.cache[require.resolve('../servicio-alta/alta-core')];
    process.env.GITHUB_API = 'http://127.0.0.1:' + p; process.env.RENDER_API = 'http://127.0.0.1:' + p;
    const { altaGimnasio: alta } = require('../servicio-alta/alta-core');
    const r = await alta({ nombre: 'Gimnasio Sol', plantilla: 'dueno/omega-gimnasio', githubToken: 'g', renderKey: 'r', cadaMs: 50 });
    assert.ok(r.vivo && r.clave.length >= 30 && r.codigo.startsWith('OMEGA1.'));
    const dec = Buffer.from(r.codigo.slice(7), 'base64url').toString();
    assert.strictEqual(dec, r.url + '|' + r.clave);
    const post = visto.find(v => v[1] === '/services')[3];
    assert.strictEqual(post.serviceDetails.runtime, 'docker'); assert.strictEqual(post.envVars.find(e => e.key === 'SYNC_CLAVE').value, r.clave);
    assert.strictEqual(visto.find(v => v[1] === '/user')[2], 'Bearer g');
    await assert.rejects(alta({ nombre: 'X', plantilla: 'a/b' }), /GITHUB_TOKEN/);
    console.log('alta: OK (' + visto.length + ' llamadas simuladas)');
  } catch (e) { console.error('FALLÓ', e); process.exitCode = 1; } finally { srv.close(); }
});
