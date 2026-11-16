'use strict';
// Prueba de interfaz V12: equipamiento por formato (lista desplegable, botón «Ver equipamiento», columna en Equipamiento) y patrones sin frecuencia propia.
const { spawn, execFileSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const DATA = process.env.E2E_DATA || '/tmp/omega-e2e12/data';
const SHOTS = process.env.E2E_SHOTS || '/tmp/omega-e2e12/shots';
const PORT = 3122, BASE = 'http://127.0.0.1:' + PORT;
fs.rmSync(DATA, { recursive: true, force: true }); fs.mkdirSync(SHOTS, { recursive: true });
const env = { ...process.env, DATA_DIR: DATA, PORT: String(PORT), HOST: '127.0.0.1', NODE_NO_WARNINGS: '1' };

(async () => {
  execFileSync('node', ['-e', "console.log(JSON.stringify(require('./src/demo-data').cargarDemo()))"], { cwd: ROOT, env, stdio: 'inherit' });
  const srv = spawn('node', ['server.js'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
  srv.stderr.on('data', d => process.stderr.write('[srv] ' + d));
  await new Promise(r => srv.stdout.on('data', d => { if (String(d).includes('escuchando')) r(); }));
  const browser = await chromium.launch();
  const problems = [];
  const log = (m) => console.log(m);
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-AR', timezoneId: 'America/Argentina/Buenos_Aires' });
  const page = await ctx.newPage();
  page.on('pageerror', e => problems.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) problems.push('console: ' + m.text()); });
  page.on('response', r => { if (r.status() >= 400 && !/\/api\/(login|finanzas|recuperar|hark\/wa)|asistencias\/qr/.test(r.url())) problems.push('HTTP ' + r.status() + ' ' + r.url()); });
  const shot = (n) => page.screenshot({ path: path.join(SHOTS, n + '.png') });
  const esperar = () => page.waitForFunction(() => !document.querySelector('#main .spinner'), null, { timeout: 8000 });
  const ir = async (h) => { await page.evaluate(x => { location.hash = x; }, '#' + h); await page.waitForTimeout(300); await esperar(); };
  const chk = (c, m) => { if (!c) problems.push(m); else log('  ✓ ' + m); };

  await page.goto(BASE + '/'); await page.waitForSelector('form#f-acceso');
  await page.fill('[name=username]', 'admin'); await page.fill('[name=password]', 'omega2026'); await page.click('form#f-acceso button');
  await page.waitForSelector('#main', { timeout: 8000 });


  // ---- Formatos e Intervalos
  await ir('/planificacion/formatos');
  chk(await page.locator('select[data-fq]').count() === 0, 'ningún estímulo tiene selector de frecuencia (todo es estándar de 3 días)');
  chk(!/patrones elegidos dos veces/.test(await page.locator('#main').innerText()), 'ya no aparece el aviso de frecuencias de patrones');
  chk(/3 días óptimos/.test(await page.locator('#main').innerText()), 'aclara la rutina estándar de 3 días');
  const nd = await page.locator('details.dd-eq').count();
  chk(nd >= 6, 'cada formato tiene su lista desplegable de equipamiento (' + nd + ')');
  chk(await page.locator('button[data-veq]').count() === nd, 'cada formato tiene el botón «Ver equipamiento»');
  const dd0 = page.locator('details.dd-eq').first();
  chk(/Todo el equipamiento/.test(await dd0.locator('summary').innerText()), 'por defecto usa todo el equipamiento');
  await dd0.locator('summary').click(); await shot('v12-formatos-lista');
  const llamada = page.waitForResponse(r => /\/api\/formatos\/\d+\/equipos/.test(r.url()) && r.request().method() === 'PUT', { timeout: 8000 });
  await dd0.locator('label:has-text("Peso corporal") input').check();
  chk((await llamada).status() === 200, 'al tildar Peso corporal se guarda la relación');
  chk(/Peso corporal/.test(await dd0.locator('summary').innerText()), 'el resumen muestra el equipamiento elegido');
  const llamada2 = page.waitForResponse(r => /\/equipos/.test(r.url()) && r.request().method() === 'PUT', { timeout: 8000 });
  await dd0.locator('label:has-text("Bandas RTX") input').check(); await llamada2;
  const sm = await dd0.locator('summary').innerText(); console.log('   resumen:', JSON.stringify(sm));
  chk(/Bandas RTX \+ Peso corporal/.test(sm), 'se pueden elegir varios equipos');
  await page.mouse.click(5, 300); await page.waitForTimeout(200);
  chk(!(await dd0.evaluate(d => d.open)), 'la lista se cierra al tocar afuera');
  await shot('v12-formatos');

  // ---- botón: lleva al equipamiento de ese formato
  await page.locator('button[data-veq]').first().click(); await page.waitForTimeout(400); await esperar();
  chk(/planificacion\/equipos/.test(await page.evaluate(() => location.hash)), 'el botón lleva a Equipamiento');
  chk(/Mostrando el equipamiento del formato/.test(await page.locator('#main').innerText()), 'muestra el equipamiento de ese formato');
  const tarj = await page.locator('.eq-card').count();
  chk(tarj === 1, 'solo muestra las tarjetas de los equipos del formato (' + tarj + ')');
  await shot('v12-equipos-formato');
  await page.click('#ver-todo'); await page.waitForTimeout(400); await esperar();
  chk(await page.locator('.eq-card').count() > 5, 'Ver todo el equipamiento vuelve a mostrar todas las tarjetas');

  // ---- Equipamiento: columna con la lista
  await page.waitForSelector('table details.dd-eq'); console.log('   cols:', JSON.stringify(await page.locator('table thead').first().innerText()), await page.locator('table details.dd-eq').count());
  chk(/equipamiento/i.test(await page.locator('table thead').first().innerText()) && await page.locator('table details.dd-eq').count() >= 6, 'la tabla «Lo que la IA toma de cada formato» tiene la columna Equipamiento con su lista');
  const dd1 = page.locator('table details.dd-eq').nth(1);
  await dd1.locator('summary').click();
  const ll3 = page.waitForResponse(r => /\/equipos/.test(r.url()) && r.request().method() === 'PUT', { timeout: 8000 });
  await dd1.locator('label:has-text("Pesas rusas") input').check(); await ll3;
  await shot('v12-equipos-tabla');
  const hay = await page.evaluate(async () => (await api('GET', '/formatos')).map(f => f.equipos.length));
  chk(hay[0] === 2 && hay[1] === 1, 'las relaciones quedan guardadas en cada formato (' + hay.slice(0, 2).join(', ') + ')');
  // equipo nuevo: aparece en las listas
  await page.evaluate(async () => { await api('POST', '/equipamiento', { nombre: 'Sogas', cantidad: 4 }); });
  await ir('/planificacion/formatos');
  await page.locator('details.dd-eq').first().locator('summary').click();
  chk(await page.locator('details.dd-eq').first().locator('label:has-text("Sogas")').count() === 1, 'el equipamiento nuevo aparece en la lista de los formatos');

  await browser.close(); srv.kill();
  if (problems.length) { console.log('\nPROBLEMAS:\n - ' + problems.join('\n - ')); process.exit(1); }
  console.log('\nTodo OK (interfaz V12)'); process.exit(0);
})().catch(e => { console.error('✗', e); process.exit(1); });
