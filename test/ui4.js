'use strict';
// Interfaz de la Versión 4 con un navegador real: alta del gimnasio (nombre + logo) en el primer inicio y botón Sincronizar automático.
const { spawn } = require('node:child_process');
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..');
const SHOTS = '/tmp/omega-e2e4/shots'; fs.mkdirSync(SHOTS, { recursive: true });
const ok = (m) => console.log('  ✓ ' + m);
const hijos = []; const rnd = () => 6000 + Math.floor(Math.random() * 1500);
const arrancar = (env) => { const d = fs.mkdtempSync('/tmp/omega-ui4-'); const h = spawn('node', ['server.js'], { cwd: ROOT, env: { ...process.env, DATA_DIR: d, HOST: '127.0.0.1', NODE_NO_WARNINGS: '1', ...env }, stdio: 'ignore' }); hijos.push(h); };
const esperar = async (u) => { for (let i = 0; i < 80; i++) { try { await fetch(u + '/api/estado'); return; } catch (_) { await new Promise(r => setTimeout(r, 100)); } } };
(async () => {
  const problems = []; let mock, alta;
  const browser = await chromium.launch();
  try {
    const PN = rnd(); mock = http.createServer((req, res) => { let b = ''; req.on('data', d => b += d); req.on('end', () => {
      const c = b ? JSON.parse(b) : null; const j = (s, o) => { res.writeHead(s, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
      if (req.url === '/user') return j(200, { login: 'dueno' }); if (req.url.endsWith('/generate')) return j(201, { html_url: 'https://github.com/dueno/' + c.name });
      if (/\/branches\//.test(req.url)) return j(200, { name: 'main' }); if (req.url.startsWith('/owners')) return j(200, [{ owner: { id: 't' } }]);
      if (req.url === '/services') { const env = Object.fromEntries(c.envVars.map(e => [e.key, e.value])); const pn = rnd() + 1500; arrancar({ PORT: pn, OMEGA_NODO: env.OMEGA_NODO, SYNC_CLAVE: env.SYNC_CLAVE }); return j(201, { service: { id: 's', serviceDetails: { url: 'http://127.0.0.1:' + pn } } }); }
      j(404, {}); }); }).listen(PN);
    process.env.GITHUB_API = process.env.RENDER_API = 'http://127.0.0.1:' + PN; process.env.GITHUB_TOKEN = 'g'; process.env.RENDER_API_KEY = 'r';
    const PA = rnd() + 3000, CL = 'clave-alta-ui-prueba-12345';
    alta = require('../servicio-alta/server').crearServidor({ clave: CL, cadaMs: 100, esperaMs: 30000 }).listen(PA);
    const PP = rnd(); arrancar({ PORT: PP, ALTA_URL: 'http://127.0.0.1:' + PA, ALTA_CLAVE: CL }); await esperar('http://127.0.0.1:' + PP);

    // logo de prueba
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAWElEQVR4nO3PQQ0AIBDAsAP/nuGDBhI6BWufRfZ2zP0IAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADzyBwnVAAFaZQ4rAAAAAElFTkSuQmCC', 'base64');
    fs.writeFileSync('/tmp/omega-e2e4/logo.png', png);
    const page = await (await browser.newContext({ viewport: { width: 1200, height: 850 } })).newPage();
    page.on('pageerror', e => problems.push('pageerror: ' + e.message));
    await page.goto('http://127.0.0.1:' + PP + '/'); await page.waitForSelector('form#f-acceso');
    const tiene = await page.$('input[name=gimnasio]'); if (!tiene) problems.push('el primer acceso no pide el nombre del gimnasio'); else ok('el primer inicio pide Nombre del gimnasio y logo');
    await page.fill('input[name=gimnasio]', 'Gimnasio Sol'); await page.setInputFiles('#alta-logo', '/tmp/omega-e2e4/logo.png');
    await page.fill('input[name=nombre]', 'Julio'); await page.fill('input[name=username]', 'julio'); await page.fill('input[name=password]', 'Omega#2026'); await page.fill('input[name=password2]', 'Omega#2026');
    await page.screenshot({ path: path.join(SHOTS, 'v4-01-alta.png') });
    await page.click('#f-acceso button.primary');
    await page.waitForSelector('#of-sy', { timeout: 15000 }); ok('al terminar el alta aparece la propuesta de sincronizar');
    const nom = await page.evaluate(() => S.marca.nombre); if (nom !== 'Gimnasio Sol') problems.push('el nombre no quedó guardado: ' + nom);
    const ic = await page.evaluate(async () => (await fetch('/icons/icon-192.png')).headers.get('content-type')); if (!/png/.test(ic || '')) problems.push('no hay ícono');
    await page.click('#of-sy'); await page.waitForSelector('#sy-crear');
    await page.screenshot({ path: path.join(SHOTS, 'v4-02-sync.png') });
    await page.click('#sy-crear');
    await page.waitForSelector('#sy-prog:not([hidden])', { timeout: 10000 }).catch(() => problems.push('no se vio el progreso'));
    await page.screenshot({ path: path.join(SHOTS, 'v4-03-progreso.png') });
    await page.waitForFunction(() => !document.querySelector('#sy-crear'), null, { timeout: 60000 }); ok('el botón crea y conecta la aplicación web sin pedir nada');
    await page.waitForFunction(() => /Sincronizar con la aplicación Web|Aplicación web/.test(document.body.innerText), null, { timeout: 10000 });
    const est = await page.evaluate(async () => api('GET', '/sync/estado')); if (!est.configurado) problems.push('quedó sin conectar');
    await page.screenshot({ path: path.join(SHOTS, 'v4-04-listo.png') });
    ok('la pantalla de inicio muestra la aplicación web conectada');
  } catch (e) { problems.push(e.message); }
  await browser.close(); hijos.forEach(h => h.kill()); if (mock) mock.close(); if (alta) alta.close();
  if (problems.length) { console.log('PROBLEMAS (' + problems.length + '):'); problems.forEach(p => console.log(' - ' + p)); process.exitCode = 1; } else console.log('\nTodo OK (interfaz V4)');
  setTimeout(() => process.exit(), 300);
})();
