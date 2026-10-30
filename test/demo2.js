'use strict';
// Versión de prueba: celular (sin scroll horizontal) y subida de video con reproducción
const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const { chromium } = require('playwright');
const FILE = path.join(__dirname, '..', 'dist', 'omega-prueba.html'); const SHOTS = '/tmp/omega-demo/shots';
const CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src data: blob:; media-src blob: data:; connect-src 'none'";
(async () => {
  const srv = http.createServer((q, s) => { s.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': CSP }); s.end(fs.readFileSync(FILE)); }).listen(3223);
  const browser = await chromium.launch(); const problems = [];
  const ctx = await browser.newContext({ viewport: { width: 390, height: 800 }, locale: 'es-AR', timezoneId: 'America/Argentina/Buenos_Aires' });
  const page = await ctx.newPage();
  page.on('pageerror', e => problems.push('pageerror: ' + e.message)); page.on('console', m => { if (m.type() === 'error') problems.push('console: ' + m.text()); });
  await page.goto('http://localhost:3223/'); await page.waitForSelector('.demo-cred', { timeout: 60000 });
  await page.screenshot({ path: SHOTS + '/c01-login.png' });
  const ancho = async (n) => { const ok = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1); if (!ok) problems.push('scroll horizontal en ' + n); };
  await ancho('login');
  await page.click('[data-demo-user=admin]'); await page.waitForSelector('#tb tr[data-id]'); await ancho('inicio'); await page.screenshot({ path: SHOTS + '/c02-inicio.png' });
  for (const t of ['Asistencias', 'Clientes', 'Planificación', 'Finanzas', 'Usuarios', 'Ajustes']) { await page.click('.nav a:has-text("' + t + '")'); await page.waitForTimeout(500); await page.waitForFunction(() => !document.querySelector('#main .spinner')); await ancho(t); await page.screenshot({ path: SHOTS + '/c-' + t + '.png' }); }
  // video: biblioteca
  await page.click('.nav a:has-text("Planificación")'); await page.waitForTimeout(400);
  await page.click('a:has-text("Biblioteca"), button:has-text("Biblioteca")'); await page.waitForSelector('[data-vid]', { state: 'attached' });
  await page.locator('[data-vid]').first().setInputFiles('/tmp/t.webm'); await page.waitForTimeout(1500);
  const txt = await page.locator('tbody tr').first().innerText(); console.log('1ra fila:', txt.replace(/\n/g, ' | '));
  if (!/Ver|Cambiar/.test(txt)) problems.push('el video no quedó cargado');
  const ver = page.locator('tbody tr').first().locator('button:has-text("▶")'); 
  if (await ver.count()) { await ver.first().click(); await page.waitForSelector('video'); const ok = await page.evaluate(async () => { const v = document.querySelector('video'); await new Promise(r => { v.onloadeddata = r; v.onerror = r; setTimeout(r, 3000); }); return v.readyState >= 2; }); console.log('video reproducible:', ok); await page.screenshot({ path: SHOTS + '/c-video.png' }); }
  await browser.close(); srv.close();
  console.log(problems.length ? 'PROBLEMAS:\n - ' + [...new Set(problems)].join('\n - ') : 'Sin problemas'); process.exit(problems.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
