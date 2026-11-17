'use strict';
// Prueba de interfaz V14: alta de equipamiento ambiguo → elegir → dibujo propuesto + ejercicios propuestos (Wikipedia y Gemini simulados).
const { spawn, execFileSync } = require('node:child_process');
const http = require('node:http');
const path = require('node:path'), fs = require('node:fs');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..');
const DATA = '/tmp/omega-e2e14/data', SHOTS = '/tmp/omega-e2e14/shots';
const PORT = 3124, BASE = 'http://127.0.0.1:' + PORT;
fs.rmSync(DATA, { recursive: true, force: true }); fs.mkdirSync(SHOTS, { recursive: true });
const PAT = ['empujar', 'tirar', 'sentadilla', 'bisagra_cadera', 'bisagra_rodilla', 'rotacion', 'locomocion'], CAP = ['fuerza', 'core', 'movilidad', 'equilibrio'];
const ejs = PAT.flatMap((p, i) => [0, 1, 2, 3, 4].map(n => ({ patron: p, nombre: `Soga ${p} ${n}`, prog2: 'más difícil', prog3: 'la más difícil', capacidades: [CAP[(i + n) % 4]], energias: [n % 2 ? 'aerobico' : 'anaerobico'], intensidad: 'moderada' })));
const DIB = { agarre: 1, formas: [{ t: 'r', x: 20, y: 15, w: 20, h: 10, c: '#4da3ff', g: 2.5, f: 1 }, { t: 'l', x1: 10, y1: 30, x2: 50, y2: 30, c: '#ff8a3d', g: 2 }] };
const mock = http.createServer((req, res) => {
  let b = ''; req.on('data', d => b += d); req.on('end', () => {
    res.setHeader('content-type', 'application/json');
    if (req.url.startsWith('/w/api.php')) return res.end(JSON.stringify({ batchcomplete: '' }));
    const t = b; let out;
    if (/ambiguo/.test(t)) out = { entendido: true, ambiguo: true, candidatos: [{ nombre: 'Soga de saltar', descripcion: 'Para saltar', pagina: null }, { nombre: 'Soga de batalla', descripcion: 'Gruesa y pesada', pagina: null }] };
    else out = { descripcion: 'Soga gruesa', peso: { tiene: false }, dibujo: DIB, ejercicios: ejs };
    res.end(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(out) }] } }] }));
  });
});
(async () => {
  await new Promise(r => mock.listen(0, '127.0.0.1', r)); const U = 'http://127.0.0.1:' + mock.address().port;
  const env = { ...process.env, DATA_DIR: DATA, PORT: String(PORT), HOST: '127.0.0.1', NODE_NO_WARNINGS: '1', OMEGA_WIKI_BASE: U, OMEGA_GEMINI_BASE: U, OMEGA_GEMINI_CLAVE: 'x' };
  execFileSync('node', ['-e', "console.log(JSON.stringify(require('./src/demo-data').cargarDemo()))"], { cwd: ROOT, env, stdio: 'inherit' });
  const srv = spawn('node', ['server.js'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
  srv.stderr.on('data', d => process.stderr.write('[srv] ' + d));
  await new Promise(r => srv.stdout.on('data', d => { if (String(d).includes('escuchando')) r(); }));
  const browser = await chromium.launch(); const problems = []; const log = m => console.log(m);
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-AR' })).newPage();
  page.on('pageerror', e => problems.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) problems.push('console: ' + m.text()); });
  const chk = (c, m) => { if (!c) problems.push(m); else log('  ✓ ' + m); };
  try {
    await page.goto(BASE + '/'); await page.waitForSelector('form#f-acceso');
    await page.fill('[name=username]', 'admin'); await page.fill('[name=password]', 'omega2026'); await page.click('form#f-acceso button');
    await page.waitForSelector('#main', { timeout: 8000 });
    await page.evaluate(() => { location.hash = '#/planificacion/equipos'; }); await page.waitForSelector('#nuevo');
    await page.click('#nuevo'); await page.fill('[name=nombre]', 'Cuerda'); await page.click('#f button.primary');
    await page.waitForSelector('#ia-op [data-ci]', { timeout: 15000 });
    chk(await page.locator('#ia-op [data-ci]').count() === 2 && await page.locator('#ia-dejar').count() === 1, 'aparecen las opciones y «Dejarlo como lo describí»');
    await page.screenshot({ path: SHOTS + '/ia-elegir.png' });
    await page.click('#ia-op [data-ci="1"]');
    await page.waitForSelector('[data-iau]', { timeout: 20000 }).catch(async () => { await page.evaluate(() => { location.hash = '#/planificacion/equipos'; location.reload(); }); await page.waitForSelector('[data-iau]', { timeout: 10000 }); });
    chk(await page.locator('[data-iau]').count() === 1, 'aparece la tarjeta con el dibujo propuesto');
    chk(/La IA sugiere 35 ejercicios/.test(await page.locator('#main').innerText()), 'lista los 35 ejercicios propuestos');
    await page.screenshot({ path: SHOTS + '/ia-propuesta.png', fullPage: true });
    await page.click('[data-iu]').catch(() => {});
    await page.click('[data-iau]'); await page.waitForTimeout(600);
    chk(await page.locator('[data-iau]').count() === 0, '«Usar este dibujo» cierra la tarjeta');
    await page.click('#s-nada'); await page.waitForTimeout(300);
    await page.locator('.modal button.danger, .modal button.primary').last().click().catch(() => {}); await page.waitForTimeout(600);
    chk(!/La IA sugiere/.test(await page.locator('#main').innerText()), '«Descartar todos» limpia las sugerencias');
  } catch (e) { problems.push(e.message); await page.screenshot({ path: SHOTS + '/error.png' }).catch(() => {}); }
  await browser.close(); srv.kill(); mock.close();
  if (problems.length) { console.log('FALLÓ\n' + problems.join('\n')); process.exitCode = 1; } else console.log('UI V14 OK');
})();
