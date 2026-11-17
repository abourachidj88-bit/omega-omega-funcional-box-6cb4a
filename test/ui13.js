'use strict';
// Prueba de interfaz V13: tamaño de la persona en el dibujo, peso del equipamiento y depurador de la biblioteca.
const { spawn, execFileSync } = require('node:child_process');
const path = require('node:path'), fs = require('node:fs');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..');
const DATA = process.env.E2E_DATA || '/tmp/omega-e2e13/data', SHOTS = process.env.E2E_SHOTS || '/tmp/omega-e2e13/shots';
const PORT = 3123, BASE = 'http://127.0.0.1:' + PORT;
fs.rmSync(DATA, { recursive: true, force: true }); fs.mkdirSync(SHOTS, { recursive: true });
const env = { ...process.env, DATA_DIR: DATA, PORT: String(PORT), HOST: '127.0.0.1', NODE_NO_WARNINGS: '1' };
(async () => {
  execFileSync('node', ['-e', "console.log(JSON.stringify(require('./src/demo-data').cargarDemo()))"], { cwd: ROOT, env, stdio: 'inherit' });
  const srv = spawn('node', ['server.js'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
  srv.stderr.on('data', d => process.stderr.write('[srv] ' + d));
  await new Promise(r => srv.stdout.on('data', d => { if (String(d).includes('escuchando')) r(); }));
  const browser = await chromium.launch(); const problems = []; const log = (m) => console.log(m);
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

  // ---- Dibujo: tamaño de la persona
  await page.evaluate(async () => { const eq = await api('GET', '/equipamiento'); window.__res = undefined; disenarPosiciones({ poses: null, patronBase: 'sentadilla', zona: 'Empujar (Push)', eq }).then(r => { window.__res = r || 'cancelado'; }); });
  await page.waitForSelector('#lienzo svg'); await page.waitForTimeout(200);
  chk(await page.locator('#zoom').count() === 1 && await page.locator('#ajustar').count() === 1, 'el dibujo tiene el control «Tamaño de la persona» y «Ajustar al cuadro»');
  const ext = () => page.evaluate(() => { const s = document.querySelector('#lienzo svg'); const c = [...s.querySelectorAll('[data-h] circle:nth-child(2)')].map(e => [Number(e.getAttribute('cx')), Number(e.getAttribute('cy'))]); const xs = c.map(p => p[0]), ys = c.map(p => p[1]); return { w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }; });
  const e100 = await ext();
  await page.locator('#zoom').fill('50'); await page.waitForTimeout(150);
  const e50 = await ext();
  chk(e50.h < e100.h * 0.6 && e50.h > e100.h * 0.4, 'al 50 % la figura mide la mitad (' + e100.h.toFixed(0) + ' → ' + e50.h.toFixed(0) + ')');
  chk(/50%/.test(await page.locator('#zoomv').innerText()), 'muestra el porcentaje');
  await page.locator('[data-p="1"]').click(); await page.waitForTimeout(100);
  chk((await page.locator('#zoom').inputValue()) === '50', 'el tamaño es el mismo en las 3 posiciones');
  chk((await ext()).h < e100.h * 0.6, 'la posición 2 también se ve achicada');
  await shot('v13-dibujo-50');
  await page.locator('#zoom').fill('100'); await page.waitForTimeout(100);
  // una figura enorme (brazo y pierna estirados con cadera arriba) no cabe: «Ajustar al cuadro» la achica sola
  await page.evaluate(() => { const b = document.querySelector('#ajustar'); b.click(); });
  await page.waitForTimeout(200);
  const vAj = Number(await page.locator('#zoom').inputValue());
  chk(vAj <= 100 && vAj >= 40, 'Ajustar al cuadro deja un tamaño válido (' + vAj + ' %)');
  await page.locator('#zoom').fill('70'); await page.waitForTimeout(100);
  await page.locator('#ok').click(); await page.waitForFunction(() => window.__res !== undefined, null, { timeout: 5000 });
  const res = await page.evaluate(() => window.__res);
  chk(res && res.poses && res.poses.poses.length === 3 && res.poses.poses.every(p => p.z === 0.7), 'al guardar, las 3 posiciones llevan el tamaño elegido (70 %)');
  chk(res.imgs.every(u => /^data:image\/svg\+xml/.test(u)), 'las 3 imágenes se generan con ese tamaño');

  // ---- Equipamiento: peso con tilde
  await ir('/planificacion/equipos');
  const nT = await page.locator('[data-tp]').count(), nC = await page.locator('.eq-card').count();
  chk(nT === nC && nT > 5, 'cada tarjeta de equipamiento tiene el tilde «Tiene peso» (' + nT + ')');
  const man = page.locator('.eq-card', { hasText: 'Mancuernas' });
  chk(await man.locator('[data-tp]').isChecked() && (await man.locator('[data-pk]').inputValue()) === '4 a 20', 'las mancuernas ya vienen con su peso (4 a 20)');
  const rueda = page.locator('.eq-card', { hasText: 'Ruedas abdominales' });
  chk(!(await rueda.locator('[data-tp]').isChecked()) && !(await rueda.locator('[data-pk]').isVisible()), 'sin tilde el campo de peso está oculto');
  await rueda.locator('[data-tp]').check();
  chk(await rueda.locator('[data-pk]').isVisible(), 'al tildar aparece el campo de kg');
  await rueda.locator('[data-pk]').fill('2'); await shot('v13-equipos-peso');
  await page.click('#ok'); await page.waitForTimeout(600); await esperar();
  const guardado = await page.evaluate(async () => (await api('GET', '/equipamiento')).find(e => e.clave === 'rueda_abdominal'));
  chk(guardado.tiene_peso === 1 && guardado.peso === '2', 'Guardar cantidades guarda el tilde y el peso');
  await page.click('#nuevo'); await page.waitForSelector('#n-tp');
  chk(!(await page.locator('#n-pk').isVisible()), 'en «Nuevo equipamiento» el kg aparece recién al tildar');
  await page.locator('#n-tp').check(); chk(await page.locator('#n-pk').isVisible(), 'al tildar en el alta aparece el campo de peso');
  await page.fill('[name=nombre]', 'Chalecos lastrados'); await page.fill('#n-pk', '6');
  await page.locator('#f button.primary').click(); await page.waitForTimeout(700); await esperar();
  const ch = await page.evaluate(async () => (await api('GET', '/equipamiento')).find(e => e.nombre === 'Chalecos lastrados'));
  chk(ch && ch.tiene_peso === 1 && ch.peso === '6', 'el equipamiento nuevo se crea con su peso');

  // ---- Ajustes: depurar la biblioteca
  await ir('/ajustes');
  await page.waitForSelector('[data-r="biblioteca"]'); await page.click('[data-r="biblioteca"]'); await page.waitForSelector('[data-f="ia"]');
  chk(await page.locator('[data-f="ia"]').count() === 1 && await page.locator('[data-f="propio"]').count() === 1, 'hay 2 pestañas: importados por IA y creados por el usuario');
  const nIA = Number(await page.locator('[data-f="ia"] .pill').innerText()); chk(nIA > 100, 'la pestaña IA lista los ejercicios cargados (' + nIA + ')');
  chk(await page.locator('[data-sec]').count() === 7, 'agrupa por estímulo: 7 patrones de movimiento (' + await page.locator('[data-sec]').count() + ')');
  chk(/Seleccionar todos \(\d+\)/.test(await page.locator('#dp-todos-b').innerText()), 'tiene «Seleccionar todos»');
  await page.selectOption('#dp-g', 'capacidades'); chk(await page.locator('[data-sec]').count() === 4, 'por capacidades físicas: 4 grupos');
  await page.selectOption('#dp-g', 'energias'); chk(await page.locator('[data-sec]').count() === 2, 'por sistema energético: 2 grupos');
  await page.selectOption('#dp-g', 'patrones');
  const sec = page.locator('[data-sec]').first(); const nSec = Number(await sec.locator('xpath=ancestor::label//span[contains(@class,"pill")]').innerText());
  await sec.check(); await page.waitForTimeout(100);
  const tild = await page.locator('table [data-s]:checked').count(); chk(tild >= nSec - 0 && /\d+ tildados/.test(await page.locator('#dp-go').innerText() + ' ' + await page.locator('.small.muted', { hasText: 'tildados' }).first().innerText()), 'tildar el grupo tilda todos sus ejercicios (' + tild + ')');
  chk(!(await page.locator('#dp-go').isDisabled()), 'se habilita «Quitar de la biblioteca»');
  await shot('v13-depurar-biblioteca');
  await page.click('#dp-ning'); chk(await page.locator('table [data-s]:checked').count() === 0, 'Destildar todo');
  await page.click('#dp-todos-b'); chk(Number(await page.locator('#dp-go').innerText().then(t => (/\((\d+)\)/.exec(t) || [])[1])) === nIA, 'Seleccionar todos tilda los ' + nIA + ' de la pestaña');
  await page.click('[data-f="propio"]'); await page.waitForTimeout(100);
  chk((await page.locator('table [data-s]:checked').count()) === 0, 'al cambiar de pestaña se destilda todo (no se mezclan)');
  await page.click('[data-f="ia"]'); await page.locator('table [data-s]').first().check();
  const antes = Number(await page.locator('[data-f="ia"] .pill').innerText());
  await page.click('#dp-go'); await page.waitForSelector('.modal button.danger, dialog button.danger, button:has-text("Quitar")', { timeout: 4000 });
  await page.locator('button.danger:has-text("Quitar"), button:has-text("Quitar")').last().click(); await page.waitForTimeout(800);
  chk(Number(await page.locator('[data-f="ia"] .pill').innerText()) === antes - 1, 'se quitó el ejercicio tildado (' + antes + ' → ' + (antes - 1) + ')');
  await browser.close(); srv.kill();
  if (problems.length) { console.error('FALLÓ:\n - ' + problems.join('\n - ')); process.exit(1); }
  console.log('UI V13 OK');
})().catch(e => { console.error(e); process.exit(1); });
