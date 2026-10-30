'use strict';
// Prueba de interfaz con un navegador real: recorre las pantallas de los tres roles.
const { spawn, execFileSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const DATA = process.env.E2E_DATA || '/tmp/omega-e2e/data';
const SHOTS = process.env.E2E_SHOTS || '/tmp/omega-e2e/shots';
const PORT = 3111, BASE = 'http://127.0.0.1:' + PORT;
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

  // ---------------- Administrador (escritorio)
  log('Administrador');
  let page = await nuevo({ width: 1280, height: 900 }, 'admin');
  await entrar(page, 'admin', 'omega2026');
  await page.waitForSelector('#tb tr[data-id]');
  await page.screenshot({ path: path.join(SHOTS, 'a01-inicio.png') });
  log('  ✓ inicio');
  await page.fill('[data-f=nombre]', 'ana'); await page.waitForTimeout(150);
  const n1 = await page.locator('#tb tr[data-id]').count(); if (n1 < 1) problems.push('filtro de nombre sin resultados');
  await page.fill('[data-f=nombre]', ''); await page.click('[data-q=riesgo]'); await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(SHOTS, 'a02-inicio-riesgo.png') });
  const nr = await page.locator('#tb tr[data-id]').count(); log('  activos en riesgo: ' + nr);
  await ver(page, '/clientes', 'a03-clientes');
  await page.click('#tb tr[data-id]'); await page.waitForSelector('.tabs'); await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(SHOTS, 'a04-ficha-alta.png'), fullPage: true });
  await page.click('.tabs button[data-t=asist]'); await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(SHOTS, 'a05-ficha-asistencias.png'), fullPage: true });
  await ver(page, '/clientes/nuevo', 'a06-nuevo');
  await page.fill('[name=nombre]', 'Prueba Navegador'); await page.fill('[name=precio_plan]', '47000'); await page.fill('[name=celular]', '1155550000');
  await page.click('button[type=submit]'); await page.waitForSelector('.modal', { timeout: 6000 });
  const acc = await page.locator('.modal').innerText(); if (!/Usuario:/.test(acc)) problems.push('no mostró el acceso del alumno nuevo');
  await page.screenshot({ path: path.join(SHOTS, 'a07-acceso.png') }); await page.click('.modal [data-close].primary, .modal button.primary');
  await page.waitForSelector('.tabs');
  await ver(page, '/asistencias', 'a08-dashboard');
  await ver(page, '/asistencias/cargar', 'a09-cargar');
  { const d = new Date(Date.now() - 3 * 86400000); let f = d.toISOString().slice(0, 10); if (d.getUTCDay() === 0) f = new Date(d.getTime() - 86400000).toISOString().slice(0, 10); await page.fill('#fecha', f); await page.dispatchEvent('#fecha', 'change'); await page.waitForTimeout(500); }
  await page.fill('#q', 'prueba'); await page.waitForTimeout(200); await page.click('[data-add]'); await page.click('#reg'); await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(SHOTS, 'a10-cargar-ok.png') });
  // QR del alumno de ejemplo -> escáner (ingreso manual del código)
  const codigo = await page.evaluate(async (base) => {
    const r = await fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'ana.garcia', password: 'ana2026' }) });
    const { token } = await r.json(); const q = await fetch(base + '/api/mi-qr', { headers: { Authorization: 'Bearer ' + token } }); return (await q.json()).codigo;
  }, BASE);
  await ver(page, '/asistencias/qr', 'a11-escaner');
  await page.fill('#cod', codigo); await page.click('#b-cod'); await page.waitForTimeout(600);
  const res = await page.locator('#resultado').innerText(); log('  QR: ' + res.replace(/\n/g, ' | ').slice(0, 90));
  if (!/Ana Garc/.test(res) && !/No hay una clase/.test(res)) problems.push('el QR de Ana no se registró: ' + res);
  await page.screenshot({ path: path.join(SHOTS, 'a12-escaner-ok.png') });
  await ver(page, '/planificacion/semana', 'a13-semana');
  await page.click('.clase-row'); await page.waitForSelector('.tablewrap'); await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(SHOTS, 'a14-circuito.png'), fullPage: true });
  await page.click('[data-rep="0"]'); await page.waitForSelector('[data-e]'); await page.screenshot({ path: path.join(SHOTS, 'a15-reemplazar.png') });
  await page.click('[data-e]'); await page.waitForTimeout(500);
  await page.click('#b-play'); await page.waitForSelector('.crono'); await page.click('#pp'); await page.waitForTimeout(1300);
  await page.screenshot({ path: path.join(SHOTS, 'a16-cronometro.png') }); await page.click('.modal [data-close]');
  await page.click('#b-list'); await page.waitForSelector('.pl-item'); await page.screenshot({ path: path.join(SHOTS, 'a17-videos.png') }); await page.click('.modal [data-close]');
  await ver(page, '/planificacion/formatos', 'a18-formatos');
  await page.waitForSelector('input[data-g="patrones"]'); await page.screenshot({ path: path.join(SHOTS, 'a19-trabajo.png'), fullPage: true });
  { const n = await page.locator('.card input[data-e]').count(); if (n < 1) problems.push('formatos sin estaciones por formato'); const g = await page.locator('input[data-g="capacidades"]').count(); if (g < 4) problems.push('faltan capacidades físicas: ' + g); }
  await ver(page, '/planificacion', 'a20-agenda');
  await ver(page, '/planificacion/biblioteca', 'a21-biblioteca');
  const filas = await page.locator('tbody tr').count(); log('  ejercicios en el primer patrón: ' + filas); if (filas < 20) problems.push('zona con menos de 20 ejercicios');
  await ver(page, '/planificacion/equipos', 'a22-equipos');
  await ver(page, '/finanzas', 'a23-finanzas');
  await ver(page, '/finanzas/mes', 'b01-fin-mes');
  await ver(page, '/crm', 'b03-crm');
  await ver(page, '/planificacion/staff', 'b04-staff');
  await ver(page, '/planificacion/biblioteca', 'b05-biblioteca');
  await page.click('tbody tr [data-ver], tbody tr button').catch(() => {}); await page.waitForTimeout(400); await page.screenshot({ path: path.join(SHOTS, 'b06-ejercicio.png') });
  await page.keyboard.press('Escape'); await page.evaluate(() => document.querySelectorAll('.modal [data-close]').forEach(b => b.click()));
  await ver(page, '/usuarios', 'a24-usuarios');
  await ver(page, '/ajustes', 'a25-ajustes');
  await page.evaluate(() => { document.querySelector('#bk-ya').click(); }); await page.waitForTimeout(1500);
  // ---- Versión 2
  log('Versión 2 (administrador)');
  await ver(page, '/ajustes', 'c01-ajustes-v2');
  { const t = await page.locator('#main').innerText(); if (!/País y WhatsApp/.test(t) || !/Campañas de captación/.test(t)) problems.push('Ajustes sin país/campañas'); }
  await ver(page, '/planificacion/rutinas', 'c02-rutinas');
  await page.click('#nueva'); await page.waitForSelector('#items select'); await page.fill('[name=nombre]', 'Tren superior A');
  await page.selectOption('#items select[data-k=ejercicio_id]', { index: 1 }); await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(SHOTS, 'c03-rutina-nueva.png') });
  await page.click('.modal button.primary'); await page.waitForTimeout(700);
  { const t = await page.locator('#main').innerText(); if (!/Tren superior A/.test(t)) problems.push('la rutina nueva no aparece en la lista'); }
  await ver(page, '/finanzas/resultados', 'c04-estado-resultados');
  await page.click('[data-cat=costos]'); await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(SHOTS, 'c05-er-costos.png') });
  { const t = await page.locator('#main').innerText(); if (!/Margen bruto/.test(t) || !/Resultado del negocio/.test(t) || !/Sensibilidad de alta/.test(t)) problems.push('estado de resultados incompleto'); }
  await page.click('[data-n="6"]'); await page.waitForTimeout(500); await page.screenshot({ path: path.join(SHOTS, 'c06-er-6m.png') });
  await page.click('[data-n="13"]'); await page.waitForTimeout(600); await page.screenshot({ path: path.join(SHOTS, 'c06b-er-13m.png') });
  { const o = await page.evaluate(() => { const w = document.querySelector('.tablewrap'); return { sw: w.scrollWidth, cw: w.clientWidth, cols: document.querySelectorAll('.er-tabla thead th').length, max: document.querySelector('#mes').max, sig: document.querySelector('#sig').disabled }; });
    if (o.cols !== 14) problems.push('ER 13 meses: columnas ' + o.cols); if (o.sw > o.cw + 2) problems.push('ER 13 meses desborda: ' + o.sw + ' > ' + o.cw); if (o.sig !== true) problems.push('ER permite mes futuro'); }
  { const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 5000 }).catch(() => null), page.click('#xls')]); if (!dl) problems.push('ER no exporta a Excel'); }
  await ver(page, '/finanzas/presupuesto', 'c07-presupuesto');
  await page.click('[data-cp^="c:"]'); await page.waitForTimeout(600);
  { const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 5000 }).catch(() => null), page.click('#xls')]); if (!dl) problems.push('Presupuesto no exporta a Excel'); }
  { const t = await page.locator('#main').innerText(); if (!/Punto de equilibrio/.test(t) || !/Inflación base/.test(t)) problems.push('presupuesto incompleto'); }
  await ver(page, '/crm', 'c08-crm');
  await page.click('#nueva'); await page.waitForSelector('#obj-sel'); await page.selectOption('#obj-sel', 'Otro'); await page.waitForTimeout(100);
  await page.selectOption('[name=campana_id]', { label: 'Recomendado por' }); await page.waitForTimeout(100);
  if (!(await page.locator('#ref-w').isVisible())) problems.push('no aparece el buscador de alumno recomendador');
  await page.fill('#ref-q', 'ana'); await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(SHOTS, 'c09-visita-recomendado.png') });
  await page.evaluate(() => document.querySelectorAll('.modal [data-close]').forEach(b => b.click()));
  await ver(page, '/planificacion/biblioteca', 'c10-biblioteca-v2');
  await page.click('#nuevo'); await page.waitForSelector('[name=patron]'); await page.selectOption('[name=zona]', 'Empujar (Push)'); await page.waitForTimeout(150);
  { const n = await page.locator('[name=patron] option').count(); log('  tipos de movimiento para Empujar: ' + n); if (n < 1 || n > 15) problems.push('filtro encadenado sospechoso: ' + n); }
  await page.screenshot({ path: path.join(SHOTS, 'c11-ejercicio-nuevo.png') });
  await page.evaluate(() => document.querySelectorAll('.modal [data-close]').forEach(b => b.click()));
  await ver(page, '/planificacion', 'c12-agenda-7-23');
  { const n = await page.locator('select[data-d="1"]').count(); if (n !== 17) problems.push('la agenda no tiene 17 horarios (7 a 23): ' + n); }
  await page.click('#btn-notif'); await page.waitForSelector('.modal'); await page.screenshot({ path: path.join(SHOTS, 'c13-avisos.png') });
  await page.evaluate(() => document.querySelectorAll('.modal [data-close]').forEach(b => b.click()));
  await ver(page, '/clientes', 'c14-clientes');
  await page.fill('[data-f=nombre]', 'prueba nav'); await page.waitForTimeout(200);
  await page.click('#tb tr[data-id]'); await page.waitForSelector('.tabs', { timeout: 6000 }).catch(async () => { await page.screenshot({ path: path.join(SHOTS, 'err-ficha.png') }); problems.push('ficha: ' + (await page.locator('#app').innerText()).slice(0, 200)); });
  await page.waitForTimeout(250);
  { const t = await page.locator('#main').innerText(); if (!/WhatsApp/.test(t)) problems.push('la ficha no tiene el botón de WhatsApp'); }
  await page.screenshot({ path: path.join(SHOTS, 'c15-ficha-v2.png'), fullPage: true });
  await page.close();

  // ---------------- Profesor (no ve datos económicos)
  log('Profesor');
  page = await nuevo({ width: 1280, height: 900 }, 'profe');
  await entrar(page, 'profe', 'profe2026'); await page.waitForSelector('#tb tr[data-id]');
  const th = await page.locator('thead').first().innerText(); if (/Plan/.test(th.split('\n').join(' ').replace(/Foto|Nombre|Fecha|Última|Alta|Asistencia/g, ''))) problems.push('el profesor ve la columna de precio');
  await page.screenshot({ path: path.join(SHOTS, 'p01-inicio.png') });
  await ver(page, '/clientes', 'p02-alumnos');
  await ver(page, '/planificacion', 'p03-clases');
  const nav = await page.locator('.nav').innerText(); if (/Finanzas|Usuarios|Ajustes/.test(nav)) problems.push('el profesor ve menús de administrador: ' + nav);
  const fin = await page.evaluate(async (base) => { const t = localStorage.getItem('omega_token'); const r = await fetch(base + '/api/finanzas', { headers: { Authorization: 'Bearer ' + t } }); return r.status; }, BASE);
  if (fin !== 403) problems.push('finanzas no devolvió 403 al profesor: ' + fin);
  await page.close();

  // ---------------- Permisos: el administrador arma los accesos de un profesor
  log('Permisos');
  page = await nuevo({ width: 1280, height: 900 }, 'permisos');
  await entrar(page, 'admin', 'omega2026');
  await ver(page, '/usuarios', 'd01-usuarios');
  await page.click('#nuevo'); await page.waitForSelector('.perm-arbol'); await page.waitForTimeout(200);
  { const n = await page.locator('[data-k]').count(); if (n < 25) problems.push('el árbol de permisos tiene pocos casilleros: ' + n); const t = await page.locator('#p-cnt').innerText(); if (!/de \d+ permisos/.test(t)) problems.push('sin contador de permisos'); }
  if (await page.locator('[data-k="fin.egresos"]').isChecked() !== true || await page.locator('[data-k="fin.resultados"]').isChecked() !== false) problems.push('el perfil Profesor estándar no es el esperado');
  await page.fill('[name=nombre]', 'Prof Árbol'); await page.fill('[name=username]', 'arbol'); await page.fill('[name=password]', 'arbol123');
  await page.uncheck('[data-k="fin.egresos"]'); await page.uncheck('[data-k="asist.borrar"]'); await page.waitForTimeout(100);
  await page.screenshot({ path: path.join(SHOTS, 'd02-arbol-permisos.png') });
  await page.click('form#f button.primary'); await page.waitForTimeout(800);
  { const t = await page.locator('#main').innerText(); if (!/Prof Árbol/.test(t) || !/\d+ de \d+ permisos/.test(t)) problems.push('el profesor nuevo no aparece con sus permisos'); }
  // copiar de otro + abrir "Accesos"
  await page.click('[data-perm]:near(:text("Prof Árbol"))').catch(() => {});
  { const filas = page.locator('tr:has-text("Prof Árbol") [data-perm]'); await filas.first().click(); await page.waitForSelector('.perm-arbol'); await page.selectOption('#p-copiar', { index: 1 }); await page.waitForTimeout(200); await page.screenshot({ path: path.join(SHOTS, 'd03-copiar-permisos.png') }); await page.click('.modal button[data-close]'); }
  await page.close();
  page = await nuevo({ width: 1280, height: 900 }, 'prof-arbol');
  await entrar(page, 'arbol', 'arbol123'); await page.waitForTimeout(400);
  { const nav = await page.locator('.nav').innerText(); if (!/Caja/.test(nav) || /Finanzas|Usuarios|Ajustes/.test(nav)) problems.push('menú del profesor con permisos: ' + nav); }
  await ver(page, '/finanzas', 'd04-caja-profesor');
  { const t = await page.locator('#main').innerText(); if (await page.locator('#b-ing').count() !== 1 || await page.locator('#b-egr').count() !== 0 || await page.locator('#b-ini').count() !== 1) problems.push('botones de la caja del profesor incorrectos'); if (/Estado de resultados|Presupuesto/.test(t)) problems.push('el profesor ve pestañas de Finanzas que no tiene'); }
  await page.evaluate(() => { location.hash = '#/finanzas/resultados'; }); await page.waitForTimeout(500);
  { const t = await page.locator('#main').innerText(); if (/Sensibilidad/.test(t)) problems.push('el profesor entró a Estado de resultados sin permiso'); }
  await page.close();

  // ---------------- Alumno (celular)
  log('Alumno (celular)');
  page = await nuevo({ width: 390, height: 800 }, 'alumno');
  await entrar(page, 'ana.garcia', 'ana2026'); await page.waitForSelector('#qr svg'); await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(SHOTS, 'm01-qr.png') }); log('  ✓ QR');
  await ver(page, '/entrenamiento', 'm02-entrenamiento');
  await ver(page, '/horarios', 'm03-horarios');
  await ver(page, '/perfil', 'm04-perfil');
  { const t = await page.locator('#main').innerText(); if (!/Sacar foto/.test(t)) problems.push('el perfil del alumno no tiene el botón de foto'); }
  await ver(page, '/horarios', 'm09-horarios-reservar');
  { const b = page.locator('[data-res]').first(); if (await b.count()) { await b.click(); await page.waitForTimeout(600); await page.screenshot({ path: path.join(SHOTS, 'm10-reservada.png') }); const t = await page.locator('#main').innerText(); if (!/Reservada/.test(t)) problems.push('la reserva no quedó marcada'); } else problems.push('no hay botones de reservar en horarios'); }
  const bn = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1); if (!bn) problems.push('el alumno tiene scroll horizontal en el celular');
  await page.close();

  // ---------------- Administrador en celular
  log('Administrador (celular)');
  page = await nuevo({ width: 390, height: 800 }, 'admin-cel');
  await entrar(page, 'admin', 'omega2026'); await page.waitForSelector('#tb tr[data-id]');
  await page.screenshot({ path: path.join(SHOTS, 'm05-admin-inicio.png') });
  const ov = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1); if (!ov) console.log('ANCHO', await page.evaluate(() => [...document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().right > innerWidth + 1).slice(0, 8).map(e => e.tagName + '.' + e.className + '#' + e.id + ' ' + Math.round(e.getBoundingClientRect().right)).join(' | ')));
  if (!ov) problems.push('el administrador tiene scroll horizontal en el celular (inicio)');
  await ver(page, '/asistencias', 'm06-admin-dashboard');
  await ver(page, '/planificacion', 'm07-admin-semana');
  await ver(page, '/finanzas', 'm08-admin-finanzas');
  await page.close();

  await browser.close(); srv.kill();
  console.log('\n' + (problems.length ? 'PROBLEMAS (' + problems.length + '):\n - ' + [...new Set(problems)].join('\n - ') : 'Sin problemas detectados'));
  process.exit(problems.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
