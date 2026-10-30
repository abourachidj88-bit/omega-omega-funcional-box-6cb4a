'use strict';
// Versión de prueba (navegador, sql.js): pantallas de la Versión 2
const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const { chromium } = require('playwright');
const FILE = path.join(__dirname, '..', 'dist', 'omega-prueba.html'); const SHOTS = '/tmp/omega-demo/shots'; fs.mkdirSync(SHOTS, { recursive: true });
const CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src data: blob:; media-src blob: data:; connect-src 'none'";
(async () => {
  const srv = http.createServer((q, s) => { s.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': CSP }); s.end(fs.readFileSync(FILE)); }).listen(3224);
  const browser = await chromium.launch(); const problems = [];
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-AR', timezoneId: 'America/Argentina/Buenos_Aires' });
  const page = await ctx.newPage();
  page.on('pageerror', e => problems.push('pageerror: ' + e.message)); page.on('console', m => { if (m.type() === 'error') problems.push('console: ' + m.text()); });
  await page.goto('http://localhost:3224/'); await page.waitForSelector('.demo-cred', { timeout: 60000 });
  await page.click('[data-demo-user=admin]'); await page.waitForSelector('#tb tr[data-id]');
  const chequeos = [
    ['/finanzas/resultados', /Margen bruto[\s\S]*Resultado del negocio[\s\S]*Sensibilidad de alta/], ['/finanzas/presupuesto', /Inflación base[\s\S]*Punto de equilibrio/],
    ['/planificacion/rutinas', /Fuerza total A/], ['/ajustes', /País y WhatsApp[\s\S]*Campañas de captación/], ['/crm', /Rendimiento por campaña/],
    ['/planificacion/agenda', /Agenda semanal/], ['/usuarios', /Accesos[\s\S]*de \d+ permisos/], ['/asistencias', /Ineficiencia de Materiales/],
  ];
  for (const [r, rx] of chequeos) {
    await page.evaluate(h => { ir(h); }, '#' + r); await page.waitForTimeout(700);
    await page.waitForFunction(() => !document.querySelector('#main .spinner'), null, { timeout: 15000 });
    const t = await page.locator('#main').innerText();
    if (!rx.test(t)) problems.push(r + ': no muestra lo esperado'); if (/undefined|NaN|\[object/.test(t)) problems.push(r + ': texto sospechoso');
    console.log('  ✓ ' + r);
  }
  await page.screenshot({ path: SHOTS + '/d01-asistencias-v2.png' });
  // deshacer pago: ficha de un alumno con pagos
  await page.evaluate(() => { ir('#/clientes'); }); await page.waitForSelector('#tb tr[data-id]');
  await page.click('#tb tr[data-id] >> nth=3'); await page.waitForSelector('.tabs');
  const hay = await page.locator('[data-undo]').count(); console.log('  pagos con "Deshacer pago": ' + hay);
  if (hay) { await page.click('[data-undo] >> nth=0'); await page.waitForSelector('.modal'); await page.screenshot({ path: SHOTS + '/d02-deshacer.png' }); await page.click('.modal button.danger, .modal button.primary'); await page.waitForTimeout(800); }
  await browser.close(); srv.close();
  console.log(problems.length ? 'PROBLEMAS:\n - ' + [...new Set(problems)].join('\n - ') : 'Sin problemas'); process.exit(problems.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
