'use strict';
// Prueba de interfaz V8: botón Volver, Rutinas por cliente / biblioteca y Planes y descuentos en Finanzas.
const { spawn, execFileSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const DATA = process.env.E2E_DATA || '/tmp/omega-e2e8/data';
const SHOTS = process.env.E2E_SHOTS || '/tmp/omega-e2e8/shots';
const PORT = 3118, BASE = 'http://127.0.0.1:' + PORT;
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
  async function nuevo(vp, nombre) {
    const ctx = await browser.newContext({ viewport: vp, locale: 'es-AR', timezoneId: 'America/Argentina/Buenos_Aires', permissions: [] });
    const page = await ctx.newPage();
    page.on('pageerror', e => problems.push(nombre + ' pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) problems.push(nombre + ' console: ' + m.text()); });
    page.on('response', r => { if (r.status() >= 400 && !r.url().includes('/api/login') && !r.url().includes('/api/finanzas') && !r.url().includes('/asistencias/qr')) problems.push(nombre + ' HTTP ' + r.status() + ' ' + r.url()); });
    return page;
  }
  async function entrar(page, u, p) {
    await page.goto(BASE + '/'); await page.waitForSelector('form#f-acceso');
    await page.fill('[name=username]', u); await page.fill('[name=password]', p); await page.click('form#f-acceso button');
    await page.waitForSelector('#main', { timeout: 8000 });
  }
  async function ver(page, ruta, nombre, espera = '#main') {
    await page.evaluate(h => { location.hash = h; }, '#' + ruta);
    await page.waitForTimeout(250);
    await page.waitForFunction(() => !document.querySelector('#main .spinner'), null, { timeout: 8000 });
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(SHOTS, nombre + '.png'), fullPage: false });
    const txt = await page.locator('#main').innerText();
    if (/undefined|NaN|\[object/.test(txt)) problems.push(nombre + ': texto sospechoso -> ' + (txt.match(/.{0,30}(undefined|NaN|\[object).{0,30}/) || [''])[0]);
    log('  ✓ ' + nombre);
  }

  let page = await nuevo({ width: 1280, height: 900 }, 'admin');
  await entrar(page, 'admin', 'omega2026');
  const hash = () => page.evaluate(() => location.hash);
  // Volver desde un circuito regresa a Planificación Semanal (y no a la Agenda)
  await ver(page, '/planificacion', 'v8-agenda');
  await ver(page, '/planificacion/semana', 'v8-semana');
  const enl = page.locator('#main .clase-row[onclick*="circuito"]').first();
  if (await enl.count()) {
    await enl.click(); await page.waitForTimeout(500); await page.waitForFunction(() => !document.querySelector('#main .spinner'), null, { timeout: 8000 });
    if (!/circuito/.test(await hash())) problems.push('no se abrió el circuito: ' + await hash());
    await page.click('#btn-volver'); await page.waitForTimeout(500);
    if ((await hash()) !== '#/planificacion/semana') problems.push('Volver desde el circuito fue a ' + await hash());
    else log('  ✓ Volver desde el circuito regresa a Planificación Semanal');
    await page.click('#btn-volver'); await page.waitForTimeout(400);
    if ((await hash()) !== '#/planificacion') problems.push('segundo Volver fue a ' + await hash()); else log('  ✓ el segundo Volver regresa a la pantalla anterior');
  } else log('  (sin circuitos en la demo: se omite)');
  // Rutinas: Por cliente y Biblioteca
  await ver(page, '/planificacion/rutinas', 'v8-rutinas-cliente');
  { const t = await page.locator('#main').innerText(); if (!/Por cliente/.test(t) || !/Biblioteca de rutinas/.test(t)) problems.push('Rutinas sin las dos vistas'); }
  await page.click('#m-bib'); await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(SHOTS, 'v8-biblioteca.png') });
  { const t = await page.locator('#main').innerText(); if (!/Profesor:/.test(t) && !/Todavía no hay rutinas/.test(t)) problems.push('Biblioteca sin agrupar por profesor'); log('  ✓ biblioteca'); }
  await page.click('#nueva'); await page.waitForSelector('#items select'); await page.fill('[name=nombre]', 'Rutina de prueba V8');
  await page.selectOption('#items select[data-k=ejercicio_id]', { index: 1 }); await page.click('.modal button.primary'); await page.waitForTimeout(800);
  { const t = await page.locator('#main').innerText(); if (!/Rutina de prueba V8/.test(t)) problems.push('la rutina nueva no aparece en la biblioteca'); else log('  ✓ la rutina nueva queda en la biblioteca'); }
  // Finanzas: Planes y descuentos juntos
  await ver(page, '/finanzas/planes', 'v8-planes-descuentos');
  { const t = await page.locator('#main').innerText(); if (!/Precios de los planes/.test(t) || !/Descuentos/.test(t)) problems.push('Planes y descuentos incompleto'); }
  await ver(page, '/finanzas/mes', 'v8-analisis');
  { const t = await page.locator('#main').innerText(); if (/Precios de los planes/.test(t)) problems.push('los planes siguen en Análisis del mes'); }
  await ver(page, '/ajustes', 'v8-ajustes');
  { const t = await page.locator('#main').innerText(); if (/Armá descuentos/.test(t)) problems.push('los descuentos siguen en Ajustes'); }
  // Biblioteca de ejercicios: nombre clickeable, barra arriba
  await ver(page, '/planificacion/biblioteca', 'v8-biblioteca-ej');
  { const n = await page.locator('#tw-ej .lnk-ej').count(); if (!n) problems.push('la biblioteca no tiene nombres clickeables');
    else { await page.locator('#tw-ej .lnk-ej').first().click(); await page.waitForSelector('.modal', { timeout: 5000 }); log('  ✓ el nombre del ejercicio abre su ficha'); await page.click('.modal [data-close]'); }
    const top = await page.locator('.top-scroll').count(); if (!top) problems.push('falta la barra de desplazamiento superior'); else log('  ✓ barra de desplazamiento arriba'); }
  // Ajustes: depurar la base
  await ver(page, '/ajustes', 'v8-ajustes2');
  { const t = await page.locator('#main').innerText(); if (!/Depurar la base/.test(t)) problems.push('Ajustes sin Depurar la base'); else {
      await page.click('[data-r=perdidos]'); await page.waitForTimeout(400); await page.click('[data-r=rutinas]'); await page.waitForTimeout(400);
      const t2 = await page.locator('#dep').innerText(); if (!/Rutina/.test(t2)) problems.push('depurar rutinas sin listado'); else log('  ✓ depurar la base (clientes, perdidos, rutinas)'); } }
  // Ficha del cliente: ya no se elimina, se inhabilita
  await ver(page, '/clientes', 'v8-clientes');
  await page.click('#tb tr[data-id]'); await page.waitForSelector('.tabs'); await page.waitForTimeout(300);
  { const t = await page.locator('#main').innerText(); if (/\bEliminar\b/.test(t) && !/Eliminar de/.test(t)) problems.push('la ficha del cliente todavía tiene Eliminar'); else log('  ✓ la ficha del cliente no se elimina'); }
  await browser.close(); srv.kill();
  console.log(problems.length ? '\nPROBLEMAS (' + problems.length + '):\n - ' + problems.join('\n - ') : '\nSin problemas detectados');
  process.exit(problems.length ? 1 : 0);
})();
