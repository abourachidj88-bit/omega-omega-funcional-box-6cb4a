'use strict';
// Prueba de la versión de prueba (archivo único) con una política de seguridad estricta parecida a la del visor.
const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const { chromium } = require('playwright');
const FILE = path.join(__dirname, '..', 'dist', 'omega-prueba.html');
const SHOTS = '/tmp/omega-demo/shots'; fs.mkdirSync(SHOTS, { recursive: true });
const CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src data: blob:; media-src blob: data:; connect-src 'none'; frame-src 'none'";
(async () => {
  const srv = http.createServer((q, s) => { s.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': CSP }); s.end(fs.readFileSync(FILE)); }).listen(3222);
  const problems = [];
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-AR', timezoneId: 'America/Argentina/Buenos_Aires', acceptDownloads: true });
  const page = await ctx.newPage();
  page.on('pageerror', e => problems.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') problems.push('console: ' + m.text()); });
  const t0 = Date.now();
  await page.goto('http://localhost:3222/');
  await page.waitForSelector('.demo-cred', { timeout: 60000 });
  console.log('Listo para ingresar en ' + (Date.now() - t0) + ' ms');
  await page.screenshot({ path: SHOTS + '/d01-login.png' });
  await page.click('[data-demo-user=admin]');
  await page.waitForSelector('#tb tr[data-id]', { timeout: 15000 });
  console.log('Inicio admin: filas =', await page.locator('#tb tr[data-id]').count());
  await page.screenshot({ path: SHOTS + '/d02-inicio.png' });
  const ir = async (txt) => { await page.click('.nav a:has-text("' + txt + '")'); await page.waitForTimeout(500); await page.waitForFunction(() => !document.querySelector('#main .spinner'), null, { timeout: 15000 }); };
  for (const [t, n] of [['Asistencias', 'd03-asist'], ['Clientes', 'd04-clientes'], ['Planificación', 'd05-plan'], ['Finanzas', 'd06-fin'], ['Usuarios', 'd07-usr'], ['Ajustes', 'd08-ajustes']]) { await ir(t); await page.screenshot({ path: SHOTS + '/' + n + '.png' }); console.log('  ✓ ' + t); }
  // copia de seguridad
  await page.click('#bk-ya'); await page.waitForTimeout(800);
  // nuevo alumno
  await ir('Clientes'); await page.click('a:has-text("Nuevo alumno")'); await page.waitForSelector('[name=nombre]');
  await page.fill('[name=nombre]', 'Alumno Persistente'); await page.fill('[name=precio_plan]', '50000'); await page.click('button[type=submit]');
  await page.waitForSelector('.modal'); await page.click('.modal button.primary'); await page.waitForSelector('.tabs');
  console.log('  ✓ alumno creado');
  // planificación: abrir circuito y subir un video a un ejercicio
  await ir('Planificación'); await page.click('.tabs button:has-text("Biblioteca"), a:has-text("Biblioteca")'); await page.waitForTimeout(600);
  await page.screenshot({ path: SHOTS + '/d09-biblioteca.png' });
  const subir = page.locator('tbody tr').first().locator('button').first();
  console.log('  botones en 1ra fila:', await page.locator('tbody tr').first().locator('button').allInnerTexts());
  // exportar a Excel (descarga)
  await ir('Clientes');
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 8000 }).catch(() => null), page.click('#b-exp').catch(() => {})]);
  console.log('  exportar Excel:', dl ? dl.suggestedFilename() : 'sin descarga (ok si pide permiso al visor)');
  // persistencia: recargar
  await page.waitForTimeout(1200);
  await page.reload(); await page.waitForSelector('#tb tr[data-id], .demo-cred', { timeout: 60000 });
  const sesion = await page.locator('#tb tr[data-id]').count();
  console.log('Tras recargar: ' + (sesion ? 'sesión y datos conservados (' + sesion + ' filas)' : 'volvió al login'));
  if (!sesion) { await page.click('[data-demo-user=admin]'); await page.waitForSelector('#tb tr[data-id]'); }
  await page.fill('[data-f=nombre]', 'Persistente'); await page.waitForTimeout(300);
  const hay = await page.locator('#tb tr[data-id]').count(); console.log('Alumno creado sigue en la base:', hay === 1);
  if (hay !== 1) problems.push('el alumno creado no persistió');
  // alumno
  await page.click('#btn-salir'); await page.click('[data-si]'); await page.waitForSelector('.demo-cred');
  await page.click('[data-demo-user=ana\\.garcia]'); await page.waitForSelector('#qr svg', { timeout: 10000 }); await page.screenshot({ path: SHOTS + '/d10-alumno.png' });
  console.log('  ✓ alumno ve su QR');
  // empezar de cero
  await page.click('#btn-salir'); await page.click('[data-si]'); await page.waitForSelector('.demo-cred');
  await page.click('#demo-vacio'); await page.click('[data-si]'); await page.waitForSelector('[name=password2]', { timeout: 15000 });
  await page.screenshot({ path: SHOTS + '/d11-primer-acceso.png' });
  await page.fill('[name=gimnasio]', 'Gimnasio Sol'); await page.fill('[name=nombre]', 'Julio'); await page.fill('[name=username]', 'julio'); await page.fill('[name=password]', 'clave1234'); await page.fill('[name=password2]', 'clave1234'); await page.click('form#f-acceso button');
  await page.waitForSelector('#main', { timeout: 10000 }); await page.waitForTimeout(500);
  await page.screenshot({ path: SHOTS + '/d12-vacio.png' });
  console.log('  ✓ primer acceso crea administrador y arranca vacío');
  await browser.close(); srv.close();
  console.log(problems.length ? 'PROBLEMAS:\n - ' + [...new Set(problems)].join('\n - ') : 'Sin problemas');
  process.exit(problems.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
