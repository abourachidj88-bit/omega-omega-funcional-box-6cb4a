'use strict';
// Pruebas de la Versión 4: servicio de alta + alta automática desde la PC (con GitHub y Render simulados; la "nube" creada es un nodo OMEGA real).
const { spawn } = require('node:child_process');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');

const rnd = () => 5000 + Math.floor(Math.random() * 1500);
const ROOT = path.join(__dirname, '..');
let ok = 0; const paso = (n) => { ok++; console.log('  ✓ ' + n); };
const hijos = [];
const arrancar = (env) => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'omega-v4-')); const h = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', path.join(ROOT, 'server.js')], { env: { ...process.env, DATA_DIR: d, HOST: '127.0.0.1', ...env }, stdio: 'ignore' }); hijos.push(h); return h; };
async function esperar(url) { for (let i = 0; i < 80; i++) { try { await fetch(url + '/api/estado'); return; } catch (_) { await new Promise(r => setTimeout(r, 100)); } } throw new Error('no arrancó ' + url); }
async function api(base, metodo, ruta, cuerpo, token) {
  const r = await fetch(base + ruta, { method: metodo, headers: { ...(cuerpo !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined });
  const t = await r.text(); let j; try { j = JSON.parse(t); } catch (_) { j = t; } return { status: r.status, data: j };
}
const pausa = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  let mock, alta;
  try {
    // --- GitHub y Render simulados (Render "crea" un nodo OMEGA real con las variables recibidas)
    const llamadas = []; const PN = rnd(); let ramas = 0, intentosSv = 0;
    mock = http.createServer((req, res) => {
      let b = ''; req.on('data', d => b += d); req.on('end', () => {
        const cuerpo = b ? JSON.parse(b) : null; llamadas.push([req.method, req.url, req.headers.authorization, cuerpo]);
        const j = (c, o) => { res.writeHead(c, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
        if (req.url === '/user') return j(200, { login: 'dueno' });
        if (req.url.endsWith('/generate')) return j(201, { html_url: 'https://github.com/dueno/' + cuerpo.name });
        if (/\/branches\//.test(req.url)) { ramas++; return ramas <= 2 ? j(404, { message: 'Branch not found' }) : j(200, { name: 'main' }); }
        if (req.url.startsWith('/owners')) return j(200, [{ owner: { id: 'tea-1' } }]);
        if (req.url === '/services' && req.method === 'POST' && ++intentosSv === 1) return j(400, { message: 'branch main does not exist in the repository' });
        if (req.url === '/services' && req.method === 'POST') {
          const env = Object.fromEntries(cuerpo.envVars.map(e => [e.key, e.value])); const pn = rnd() + 1500;
          arrancar({ PORT: pn, OMEGA_NODO: env.OMEGA_NODO, SYNC_CLAVE: env.SYNC_CLAVE });
          return j(201, { service: { id: 'srv-1', serviceDetails: { url: 'http://127.0.0.1:' + pn } } });
        }
        j(404, { message: 'no' });
      });
    }).listen(PN);
    await pausa(100);
    process.env.GITHUB_API = process.env.RENDER_API = 'http://127.0.0.1:' + PN;
    const { crearServidor } = require('../servicio-alta/server');
    const CLAVE_ALTA = 'clave-de-alta-de-prueba-1234';
    const PA = rnd() + 3000; const ALTA = 'http://127.0.0.1:' + PA;
    process.env.GITHUB_TOKEN = 'ghp_prueba'; process.env.RENDER_API_KEY = 'rnd_prueba';
    alta = crearServidor({ clave: CLAVE_ALTA, cadaMs: 100, esperaMs: 20000 }).listen(PA);

    console.log('Servicio de alta');
    let r = await api(ALTA, 'POST', '/alta', { nombre: 'Sol', instalacion: 'a'.repeat(20) }); assert.equal(r.status, 401); paso('sin la clave de alta no crea nada');
    r = await fetch(ALTA + '/alta', { method: 'POST', headers: { Authorization: 'Bearer clave-equivocada-0000000', 'Content-Type': 'application/json' }, body: '{}' }); assert.equal(r.status, 401); paso('con una clave equivocada tampoco');
    assert.equal(llamadas.length, 0); paso('GitHub y Render no recibieron ninguna llamada sin autorización');
    r = await fetch(ALTA + '/alta', { method: 'POST', headers: { Authorization: 'Bearer ' + CLAVE_ALTA, 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre: 'Sol', instalacion: 'corto' }) }); assert.equal(r.status, 400); paso('rechaza identificadores de instalación inválidos');

    console.log('PC de un gimnasio nuevo');
    const PP = rnd(); const PC = 'http://127.0.0.1:' + PP;
    arrancar({ PORT: PP, ALTA_URL: ALTA, ALTA_CLAVE: CLAVE_ALTA }); await esperar(PC);
    r = await api(PC, 'GET', '/api/estado'); assert.equal(r.data.configurada, false); paso('instalación nueva: pide el alta del gimnasio');
    r = await api(PC, 'POST', '/api/setup', { username: 'dueno', password: 'Omega#2026', nombre: 'Julio' }); const tk = r.data.token;
    r = await api(PC, 'PUT', '/api/marca', { nombre: 'Gimnasio Sol' }, tk); assert.equal(r.status, 200);
    r = await api(PC, 'GET', '/api/sync/estado', undefined, tk); assert.equal(r.data.alta, true); assert.equal(r.data.configurado, false); paso('la PC sabe que puede crear su aplicación web sola y todavía no está conectada');
    r = await api(PC, 'POST', '/api/sync/crear-nube', {}); assert.equal(r.status, 401); paso('solo el administrador puede crear la aplicación web');
    r = await api(PC, 'POST', '/api/sync/crear-nube', {}, tk); assert.equal(r.status, 200); paso('botón Sincronizar: arranca el alta automática');
    let e = null; for (let i = 0; i < 300; i++) { e = (await api(PC, 'GET', '/api/sync/crear-nube', undefined, tk)).data; if (e.estado !== 'en_curso') break; await pausa(200); }
    assert.equal(e.estado, 'listo', JSON.stringify(e)); paso('el alta termina sola: repositorio + servicio + conexión');
    r = await api(PC, 'GET', '/api/sync/estado', undefined, tk); assert.equal(r.data.configurado, true); assert.ok(r.data.ultimo); paso('la PC queda conectada y sincronizada, sin pasos manuales');
    assert.ok(ramas >= 3 && intentosSv >= 2); paso('espera a que GitHub termine de copiar la plantilla y reintenta si Render todavía no ve la rama (error real que apareció en la prueba)');
    const gen = llamadas.find(l => l[1].endsWith('/generate')); assert.match(gen[3].name, /^omega-gimnasio-sol-[0-9a-f]{5}$/); assert.equal(gen[2], 'Bearer ghp_prueba'); paso('el repositorio se creó con el nombre del gimnasio y la clave de GitHub vive solo en el servicio');
    const srvLl = llamadas.find(l => l[1] === '/services'); const claveSync = srvLl[3].envVars.find(x => x.key === 'SYNC_CLAVE').value; assert.ok(claveSync.length >= 30);
    const nube = (await api(PC, 'GET', '/api/sync/estado', undefined, tk)).data.url;
    r = await api(nube, 'GET', '/api/marca'); assert.equal(r.data.nombre, 'Gimnasio Sol'); paso('la aplicación web creada ya muestra el nombre del gimnasio');
    assert.ok(!JSON.stringify(llamadas).includes(CLAVE_ALTA)); paso('la clave de alta nunca viaja a GitHub ni a Render');

    console.log('Idempotencia y límites');
    r = await api(PC, 'POST', '/api/sync/crear-nube', {}, tk); assert.equal(r.status, 409); paso('si ya está conectado no vuelve a crear nada');
    const antes = llamadas.filter(l => l[1].endsWith('/generate')).length;
    const post = (inst) => fetch(ALTA + '/alta', { method: 'POST', headers: { Authorization: 'Bearer ' + CLAVE_ALTA, 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre: 'Otro', instalacion: inst }) });
    await post('b'.repeat(20)); await post('b'.repeat(20)); await pausa(600);
    assert.equal(llamadas.filter(l => l[1].endsWith('/generate')).length, antes + 1); paso('reintentar con la misma instalación no duplica repositorios');
    const estados = []; for (let k = 0; k < 6; k++) estados.push((await post('c' + String(k).repeat(19))).status);
    assert.ok(estados.includes(429)); paso('límite de altas por hora');

    // --- sin acceso al servicio de alta (instalación vieja / manual)
    const PQ = rnd() + 200; const PC2 = 'http://127.0.0.1:' + PQ; arrancar({ PORT: PQ }); await esperar(PC2);
    r = await api(PC2, 'POST', '/api/setup', { username: 'dueno', password: 'Omega#2026' }); const t2 = r.data.token;
    r = await api(PC2, 'GET', '/api/sync/estado', undefined, t2); assert.equal(r.data.alta, false);
    r = await api(PC2, 'POST', '/api/sync/crear-nube', {}, t2); assert.equal(r.status, 400); assert.match(r.data.error, /dirección y la clave/); paso('sin acceso al servicio de alta queda el modo manual (dirección y clave)');
    console.log('\nTodo OK: ' + ok + ' verificaciones de la Versión 4');
  } catch (e) { console.error('\n✗ FALLÓ:', e.message, e.stack ? e.stack.split('\n')[1] : ''); process.exitCode = 1; }
  finally { hijos.forEach(h => h.kill()); if (mock) mock.close(); if (alta) alta.close(); setTimeout(() => process.exit(), 300); }
})();
