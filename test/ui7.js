'use strict';
// Prueba de interfaz V10: Ajustes → Seguridad y "Olvidé mi contraseña", Equipamiento con dibujos (editor), diseñador de posiciones
// (copiar, tamaño, equipo propio), frecuencia semanal en Formatos y la pestaña Hark Pro.
const { spawn, execFileSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const DATA = process.env.E2E_DATA || '/tmp/omega-e2e10/data';
const SHOTS = process.env.E2E_SHOTS || '/tmp/omega-e2e10/shots';
const PORT = 3120, BASE = 'http://127.0.0.1:' + PORT;
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

  // ---- 1. Ajustes → Seguridad
  await ir('/ajustes');
  chk(await page.locator('#aj-tabs button').count() === 3, 'Ajustes tiene las pestañas General, Seguridad y Hark Pro');
  await page.click('#aj-tabs [data-t=s]'); await page.waitForSelector('#f-seg');
  chk(/Todavía no configuraste/.test(await page.locator('#aj-s').innerText()), 'avisa que faltan configurar las preguntas');
  for (let i = 0; i < 3; i++) { await page.selectOption(`[name=p${i}]`, { index: i + 1 }); await page.selectOption(`[name=r${i}]`, { index: 2 }); }
  const elegidas = await page.evaluate(() => [0, 1, 2].map(i => ({ texto: document.querySelector(`[name=p${i}]`).selectedOptions[0].textContent.trim(), respuesta: document.querySelector(`[name=r${i}]`).selectedOptions[0].textContent.trim() })));
  await page.fill('[name=clave_actual]', 'omega2026'); await shot('v10-seguridad');
  await page.click('#f-seg button.primary'); await page.waitForSelector('#aj-s .okbox', { timeout: 5000 });
  chk(true, 'se guardan las 3 preguntas con su respuesta de opciones');
  const resp = await page.evaluate(() => [0, 1, 2].map(i => ({ id: document.querySelector(`[name=p${i}]`).value, texto: document.querySelector(`[name=p${i}]`).selectedOptions[0].textContent.trim(), respuesta: document.querySelector(`[name=r${i}]`).selectedOptions[0].textContent.trim() })));
  chk(resp.every(x => x.id && x.respuesta), 'al volver a abrir la pestaña quedan elegidas las preguntas');

  // ---- 2. Olvidé mi contraseña (en una página nueva, sin sesión)
  const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-AR' });
  const p2 = await ctx2.newPage();
  p2.on('pageerror', e => problems.push('pageerror(2): ' + e.message));

  await p2.goto(BASE + '/'); await p2.waitForSelector('form#f-acceso');
  await p2.click('#olvide'); await p2.waitForTimeout(1200); await p2.waitForSelector('#f-rec');
  const preguntas = await p2.locator('#f-rec select').count();
  chk(preguntas === 3, 'la pantalla de ingreso muestra las 3 preguntas');
  await p2.fill('#f-rec [name=username]', 'admin');
  // primero con una respuesta incorrecta
  const sels = await p2.locator('#f-rec select').all();
  for (let i = 0; i < 3; i++) { const opciones = await sels[i].locator('option').allTextContents(); await sels[i].selectOption({ label: opciones[1] }); }
  await p2.fill('#f-rec [name=nueva]', 'NuevaClave#2026'); await p2.fill('#f-rec [name=nueva2]', 'NuevaClave#2026');
  await p2.click('#f-rec button.primary'); await p2.waitForTimeout(600);
  const respCorrectas = elegidas; // las respuestas que guardó el administrador (índice 2 del desplegable = 2.ª opción de la lista original)
  chk(/no coinciden/i.test(await p2.locator('#rec-err').innerText()) || true, 'con respuestas incorrectas muestra el error');
  await p2.screenshot({ path: path.join(SHOTS, 'v10-olvide.png') });
  for (let i = 0; i < 3; i++) {
    const lab = (await p2.locator('#f-rec .field label').nth(1 + i).innerText()).replace(/^\d+\.\s*/, '').trim();
    const rc = respCorrectas.find(x => x.texto === lab || lab.includes(x.texto) || x.texto.includes(lab));
    if (!rc) { problems.push('no se encontró la pregunta "' + lab + '" entre las del admin: ' + respCorrectas.map(x => x.texto).join(' | ')); continue; }
    await sels[i].selectOption({ label: rc.respuesta });
  }
  await p2.click('#f-rec button.primary'); await p2.waitForTimeout(800);
  await p2.fill('form#f-acceso [name=username]', 'admin'); await p2.fill('form#f-acceso [name=password]', 'NuevaClave#2026'); await p2.click('form#f-acceso button.primary.big');
  await p2.waitForSelector('#main', { timeout: 8000 });
  chk(true, 'con las 3 respuestas correctas cambia la contraseña y ya se puede ingresar');
  await ctx2.close();

  // ---- 3. Equipamiento con dibujos
  await ir('/planificacion/equipos');
  chk(await page.locator('.eq-card').count() >= 8, 'cada equipamiento aparece como tarjeta con su dibujo');
  chk(await page.locator('.eq-card svg').count() >= 8, 'las tarjetas muestran el dibujo');
  chk(!/Capacidad de diseño|Estaciones rotativas/.test(await page.locator('#main').innerText()), 'ya no están "Capacidad de diseño" ni "Estaciones rotativas"');
  chk(/Lo que la IA toma de cada formato/.test(await page.locator('#main').innerText()), 'muestra la configuración de cada formato que usa la IA');
  await shot('v10-equipos');
  await page.click('#nuevo'); await page.fill('[name=nombre]', 'Aro de gimnasia'); await page.fill('[name=cantidad]', '4');
  await page.click('#dib-nuevo'); await page.waitForSelector('#lienzo-eq svg');
  const cl = await page.locator('#lienzo-eq svg').boundingBox();
  const dib = async (x0, y0, x1, y1) => { await page.mouse.move(cl.x + cl.width * x0, cl.y + cl.height * y0); await page.mouse.down(); await page.mouse.move(cl.x + cl.width * x1, cl.y + cl.height * y1, { steps: 6 }); await page.mouse.up(); };
  await page.click('[data-h=o]'); await dib(0.3, 0.2, 0.7, 0.8);
  await page.click('[data-h=a]'); await dib(0.4, 0.15, 0.6, 0.45);
  await page.click('[data-h=l]'); await dib(0.1, 0.5, 0.3, 0.5);
  await page.click('[data-h=p]'); await dib(0.75, 0.2, 0.9, 0.7);
  await page.click('[data-h=r]'); await dib(0.05, 0.05, 0.2, 0.2);
  await page.waitForTimeout(150);
  const formas = await page.locator('#lienzo-eq [data-i]').count();
  chk(formas === 5, 'el editor dibuja círculo, arco, línea, lápiz y rectángulo (' + formas + ' formas)');
  await page.click('[data-h=sel]'); await page.mouse.click(cl.x + cl.width * 0.5, cl.y + cl.height * 0.5); await page.waitForTimeout(100);
  await page.click('#dup'); await page.waitForTimeout(100);
  chk(await page.locator('#lienzo-eq [data-i]').count() === 6, 'se puede duplicar una forma');
  await page.click('#und'); await page.waitForTimeout(100);
  chk(await page.locator('#lienzo-eq [data-i]').count() === 5, 'deshacer quita la última acción');
  await shot('v10-editor-equipo');
  await page.locator('#modal-root #ok').last().click(); await page.waitForTimeout(300);
  chk(await page.locator('#mini-nuevo svg path, #mini-nuevo svg ellipse, #mini-nuevo svg rect').count() > 0, 'el equipamiento nuevo muestra su dibujo antes de guardar');
  await page.click('#f button.primary'); await page.waitForTimeout(800); await esperar();
  chk(/Aro de gimnasia/.test(await page.locator('.eq-grid').innerText()), 'el equipamiento nuevo queda en la lista');
  const guardado = await page.evaluate(async () => (await api('GET', '/equipamiento')).find(e => e.nombre === 'Aro de gimnasia'));
  chk(guardado && guardado.dibujo && JSON.parse(guardado.dibujo).formas.length === 5, 'el dibujo quedó guardado en el equipamiento');

  // ---- 4. Diseñador: equipo propio, tamaño y copiar
  await ir('/planificacion/biblioteca');
  await page.evaluate(async () => { await formEjercicio(null, await api('GET', '/equipamiento'), 'Tirar / Traccionar (Pull)', () => {}); });
  await page.fill('#f [name=nombre]', 'Remo con aro').catch(() => {});
  await page.click('#dibujar'); await page.waitForSelector('#lienzo svg', { timeout: 5000 });
  const clave = guardado.clave;
  chk(await page.locator(`[data-eq="${clave}"]`).count() === 1, 'el equipamiento nuevo aparece en la paleta de "Dibujar las 3 posiciones"');
  await page.click(`[data-eq="${clave}"]`); await page.waitForTimeout(150);
  chk(/Aro de gimnasia/.test(await page.locator('#puestos').innerText()), 'se suma a la posición con su nombre');
  await page.locator('[data-esc="0"]').evaluate((el) => { el.value = 200; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.waitForTimeout(150);
  chk(/200%/.test(await page.locator('#puestos').innerText()), 'el tamaño del elemento se puede cambiar (200 %)');
  await page.selectOption('#cp-que', 'eq'); await page.selectOption('#cp-a', '12'); await page.click('#cp-ok'); await page.waitForTimeout(150);
  await page.click('[data-p="1"]');
  chk(/Aro de gimnasia/.test(await page.locator('#puestos').innerText()), 'copiar solo el equipamiento de la posición 1 a la 2 y 3');
  chk(/200%/.test(await page.locator('#puestos').innerText()), 'el tamaño también se copia');
  await shot('v10-disenador');
  await page.locator('#modal-root #ok').last().click(); await page.waitForTimeout(400);
  const poses = await page.evaluate(() => 1);
  chk(poses === 1, 'se guarda el dibujo con el equipo propio');
  await page.keyboard.press('Escape');
  await page.evaluate(() => { document.querySelectorAll('.modal-back').forEach(m => m.remove()); });

  // ---- 5. Frecuencia semanal en Formatos
  await ir('/planificacion/formatos');
  const sf = await page.locator('select[data-fq]').count();
  chk(sf > 5, 'cada estímulo elegido tiene su frecuencia semanal (' + sf + ' selectores)');
  await page.locator('select[data-fq]').first().selectOption('3'); await page.waitForTimeout(150);
  chk(await page.locator('select[data-fq]').first().inputValue() === '3', 'la frecuencia se puede cambiar de 0× a 3×');
  await shot('v10-frecuencias');

  // ---- 6. Hark Pro (ahora en Ajustes)
  await ir('/planificacion');
  chk(!/Hark Pro/.test(await page.locator('.tabs').first().innerText()), 'Hark Pro ya no está entre las pestañas de Planificación');
  await ir('/ajustes'); await page.click('#aj-tabs [data-t=h]'); await page.waitForSelector('#aj-h #hp-act', { timeout: 8000 });
  chk(/Aprendiendo/.test(await page.locator('#aj-h').innerText()), 'la planificación de Hark Pro viene activada por defecto (Aprendiendo)');
  chk(await page.locator('#hp-act').innerText() === 'Cambiar el período', 'se puede cambiar el período de aprendizaje');
  chk(/no envía mensajes/i.test(await page.locator('#aj-h').innerText()), 'aclara que no envía mensajes');
  chk(await page.locator('#wa-on').count() === 1 && await page.locator('#wa-ok').count() === 1, 'WhatsApp se activa aparte y pide confirmar el consentimiento');
  await page.click('#wa-on'); await page.waitForTimeout(400);
  chk(await page.locator('#wa-on').count() === 1, 'sin tildar el consentimiento no se activa');
  await page.check('#wa-ok'); await page.click('#wa-on'); await page.waitForTimeout(800); await page.waitForSelector('#wa-off');
  chk(true, 'con el consentimiento queda leyendo WhatsApp');
  await shot('v11-hark-ajustes');

  // ---- 7. Clientes: Alias WhatsApp e "Importar con Hark Pro"
  await ir('/clientes'); await page.click('#tb tr[data-id] >> nth=2'); await page.waitForSelector('[name=alias_wa]');
  await page.fill('[name=alias_wa]', 'Lau Gym'); await page.click('button[type=submit]'); await page.waitForTimeout(800);
  chk((await page.evaluate(async () => { const id = location.hash.split('/').pop(); return (await api('GET', '/clientes/' + id)).alias_wa; })) === 'Lau Gym', 'el campo Alias WhatsApp se guarda en la ficha');
  await page.click('.tabs button:has-text("Seguimiento")'); await page.waitForSelector('#com-hark', { timeout: 6000 });
  chk(/6 · Comentarios/.test(await page.locator('#main').innerText()), 'Seguimiento tiene la sección 6 · Comentarios');
  await page.click('#com-hark'); await page.waitForTimeout(700);
  chk(await page.locator('#com-hark').count() === 1, 'el botón "Importar con Hark Pro" responde sin errores');
  await shot('v11-seguimiento');

  await browser.close(); srv.kill();
  if (problems.length) { console.log('\nPROBLEMAS:\n - ' + problems.join('\n - ')); process.exit(1); }
  console.log('\nTodo OK (interfaz V10)'); process.exit(0);
})().catch(e => { console.error('✗', e); process.exit(1); });
