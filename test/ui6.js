'use strict';
// Prueba de interfaz V9: fecha DD/MM/AAAA con calendario, revisión del Excel de clientes y rutinas (con errores por fila),
// planillas modelo y diseñador de posiciones (arrastre de articulaciones y equipamiento).
const { spawn, execFileSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const DATA = process.env.E2E_DATA || '/tmp/omega-e2e9/data';
const SHOTS = process.env.E2E_SHOTS || '/tmp/omega-e2e9/shots';
const PORT = 3119, BASE = 'http://127.0.0.1:' + PORT;
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
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-AR', timezoneId: 'America/Argentina/Buenos_Aires', acceptDownloads: true });
  const page = await ctx.newPage();
  page.on('pageerror', e => problems.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) problems.push('console: ' + m.text()); });
  page.on('response', r => { if (r.status() >= 400 && !r.url().includes('/api/login') && !r.url().includes('/api/finanzas') && !r.url().includes('/asistencias/qr')) problems.push('HTTP ' + r.status() + ' ' + r.url()); });
  const shot = (n) => page.screenshot({ path: path.join(SHOTS, n + '.png') });
  const esperar = () => page.waitForFunction(() => !document.querySelector('#main .spinner'), null, { timeout: 8000 });
  const ir = async (h) => { await page.evaluate(x => { location.hash = x; }, '#' + h); await page.waitForTimeout(300); await esperar(); };
  const xlsxBuf = (filas, hoja = 'Clientes') => page.evaluate(([f, h]) => { const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(f), h); return XLSX.write(wb, { bookType: 'xlsx', type: 'base64' }); }, [filas, hoja]).then(b => Buffer.from(b, 'base64'));
  const chk = (c, m) => { if (!c) problems.push(m); else log('  ✓ ' + m); };

  await page.goto(BASE + '/'); await page.waitForSelector('form#f-acceso');
  await page.fill('[name=username]', 'admin'); await page.fill('[name=password]', 'omega2026'); await page.click('form#f-acceso button');
  await page.waitForSelector('#main', { timeout: 8000 });

  // ---- 1. Fecha DD/MM/AAAA
  await ir('/clientes/nuevo');
  const t = page.locator('.fecha-dma[data-fecha=fecha_alta] .fd-txt');
  await t.fill(''); await t.pressSequentially('05112026');
  chk((await t.inputValue()) === '05/11/2026', 'al escribir 05112026 el campo completa las barras: 05/11/2026');
  chk((await page.locator('input[name=fecha_alta]').inputValue()) === '2026-11-05', 'el valor interno queda en AAAA-MM-DD');
  await t.fill(''); await t.pressSequentially('31022026');
  chk(await t.evaluate(el => !el.checkValidity()), 'una fecha inexistente (31/02/2026) se marca inválida');
  await page.locator('.fecha-dma[data-fecha=fecha_alta] .fd-pick').evaluate(el => { el.value = '2026-12-24'; el.dispatchEvent(new Event('change')); });
  chk((await t.inputValue()) === '24/12/2026' && (await page.locator('input[name=fecha_alta]').inputValue()) === '2026-12-24', 'elegir en el calendario completa 24/12/2026');
  await shot('v9-fecha');
  const b = page.locator('.fecha-dma[data-fecha=fecha_baja] .fd-txt'); await b.fill('01/01/2027');
  await page.fill('[name=nombre]', 'Prueba Fecha'); await page.click('button[type=submit]'); await page.waitForTimeout(700); await esperar();
  chk(/#\/clientes\/\d+/.test(await page.evaluate(() => location.hash)), 'el alta con fechas DD/MM/AAAA se guarda');

  // ---- 2. Importar clientes: planilla modelo y revisión
  await ir('/clientes');
  await page.click('#b-imp');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#plantilla')]);
  const plant = path.join(SHOTS, 'planilla-clientes.xlsx'); await dl.saveAs(plant);
  log('  planilla modelo de clientes: ' + fs.statSync(plant).size + ' bytes');
  const malo = await xlsxBuf([
    { 'Nombre y Apellido': 'Ok Uno', Plan: '', 'Fecha de alta': '05/11/2026', 'Fecha de baja': '05/12/2026', Celular: '1155550001', Instagram: '@ok' },
    { 'Nombre y Apellido': 'Fecha Mala', 'Fecha de alta': '32/13/2026', Celular: '1155550002' },
    { 'Nombre y Apellido': 'Cel Malo', Celular: '11-abc' },
    { 'Nombre y Apellido': '', Celular: '1155550004' },
  ]);
  await page.setInputFiles('#arch', { name: 'malo.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: malo });
  await page.waitForSelector('#imp-res .warnbox', { timeout: 6000 });
  const errTxt = await page.locator('#imp-res .warnbox').innerText();
  chk(/Fila 3 · Fecha de alta/.test(errTxt) && /Fila 4 · Celular/.test(errTxt) && /Fila 5 · Nombre/.test(errTxt), 'el alerta lista las filas con error (3, 4 y 5)');
  chk((await page.locator('#go').count()) === 0, 'con errores no aparece el botón Importar');
  await shot('v9-clientes-errores');
  const bueno = await xlsxBuf([
    { 'Nombre y Apellido': 'Importado Uno', Plan: '', 'Fecha de alta': '05/11/2026', 'Fecha de baja': '05/12/2026', Celular: '1155550011', Instagram: '@uno' },
    { 'Nombre y Apellido': 'Importado Dos', Celular: '11 5555-0012' },
    { 'Nombre y Apellido': 'Importado Uno', Celular: '1155550011' },
  ]);
  await page.setInputFiles('#arch', { name: 'bueno.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: bueno });
  await page.waitForSelector('#go', { timeout: 6000 });
  chk(/repetida/.test(await page.locator('#imp-res').innerText()), 'el archivo correcto avisa de las filas repetidas antes de importar');
  await page.click('#go'); await page.waitForFunction(() => /Listo:/.test(document.querySelector('#imp-res').innerText), null, { timeout: 10000 });
  const fin = await page.locator('#imp-res').innerText();
  chk(/Listo: 2 nuevos/.test(fin), 'se importaron 2 nuevos (la repetida no se duplicó)');
  chk(/Filas repetidas en el archivo \(1\)/.test(fin), 'al terminar muestra el cartel de la fila repetida');
  await shot('v9-clientes-ok');
  await page.click('[data-close]'); await page.waitForTimeout(300);

  // ---- 3. Importar rutinas
  await ir('/planificacion/rutinas');
  await page.click('#imp-rut');
  const [dl2] = await Promise.all([page.waitForEvent('download'), page.click('#plantilla')]);
  const plantR = path.join(SHOTS, 'planilla-rutinas.xlsx'); await dl2.saveAs(plantR);
  log('  planilla modelo de rutinas: ' + fs.statSync(plantR).size + ' bytes');
  const ej = await page.evaluate(() => api('GET', '/ejercicios'));
  const z1 = ej[0].zona, e1 = ej.find(e => e.zona === z1), z2 = ej.find(e => e.zona !== z1);
  const filaR = (rut, pat, eje, x = {}) => ({ 'Nombre de la rutina': rut, 'Descripción (opcional)': '', 'Patrón de movimiento': pat, Ejercicio: eje, 'Series (1-99)': 3, 'Repeticiones (1-99)': 10, 'Peso': '', 'Descanso en segundos (0-999)': 60, 'Segundos por serie (0-999)': 40, ...x });
  const rMala = await xlsxBuf([filaR('R1', z1, e1.nombre), filaR('R1', z1, z2.nombre), filaR('R2', 'Inventado', e1.nombre, { 'Series (1-99)': 120 })], 'Rutinas');
  await page.setInputFiles('#arch', { name: 'rutinas-mala.xlsx', mimeType: 'application/octet-stream', buffer: rMala });
  await page.waitForSelector('#imp-res .warnbox', { timeout: 6000 });
  const eR = await page.locator('#imp-res .warnbox').innerText();
  chk(/Fila 3 · Ejercicio/.test(eR) && /Fila 4 · Patrón/.test(eR) && /Fila 4 · Series/.test(eR), 'el alerta de rutinas indica fila y columna de cada error');
  await shot('v9-rutinas-errores');
  const rBuena = await xlsxBuf([filaR('Importada A', z1, e1.nombre, { 'Descripción (opcional)': 'desde Excel' }), filaR('Importada A', z2.zona, z2.nombre, { Peso: 15 })], 'Rutinas');
  await page.setInputFiles('#arch', { name: 'rutinas-buena.xlsx', mimeType: 'application/octet-stream', buffer: rBuena });
  await page.waitForSelector('#go', { timeout: 6000 }); await page.click('#go');
  await page.waitForFunction(() => /Listo:/.test(document.querySelector('#imp-res').innerText), null, { timeout: 8000 });
  chk(/Listo: se crearon 1 rutina\./.test(await page.locator('#imp-res').innerText()), 'la rutina importada se creó');
  await page.click('#imp-res [data-close]'); await page.waitForTimeout(400);
  await page.evaluate(() => sessionStorage.setItem('omega_rut_modo', 'biblioteca'));
  await ir('/planificacion'); await ir('/planificacion/rutinas');
  await page.screenshot({ path: path.join(SHOTS, 'v9-rutinas-biblioteca.png') });
  chk(/Importada A/.test(await page.locator('#main').innerText()), 'la rutina aparece en la biblioteca');

  // ---- 4. Diseñador de posiciones
  await ir('/planificacion/biblioteca');
  await page.click('#nuevo');
  await page.fill('#f [name=nombre]', 'Press dibujado'); await page.fill('#f [name=prog2]', 'Con pausa'); await page.fill('#f [name=prog3]', 'Con carga');
  await page.click('#dibujar'); await page.waitForSelector('#lienzo svg', { timeout: 5000 });
  const hdrs = await page.locator('#lienzo [data-h]').count(); chk(hdrs >= 6, 'el lienzo muestra las articulaciones arrastrables (' + hdrs + ')');
  await shot('v9-dis-inicio');
  const caja = async (sel) => (await page.locator(sel).first().boundingBox());
  const antes = await page.locator('#lienzo svg').innerHTML();
  const mu = await caja('#lienzo [data-h=mu1] circle:nth-child(2)'); const lz = await caja('#lienzo svg');
  await page.mouse.move(mu.x + mu.width / 2, mu.y + mu.height / 2); await page.mouse.down();
  await page.mouse.move(mu.x + mu.width / 2 + 60, mu.y + mu.height / 2 - 70, { steps: 8 }); await page.mouse.up();
  chk((await page.locator('#lienzo svg').innerHTML()) !== antes, 'arrastrar la muñeca cambia la pose');
  await page.click('[data-eq=mancuerna]'); await page.waitForTimeout(150);
  chk(/Mancuerna/.test(await page.locator('#puestos').innerText()), 'tocar un equipo lo suma a la posición');
  // arrastrar desde la paleta hasta el dibujo (HTML5 drag & drop)
  await page.dragAndDrop('[data-eq=banco]', '#lienzo svg', { targetPosition: { x: Math.round(lz.width * 0.5), y: Math.round(lz.height * 0.85) } });
  await page.waitForTimeout(200);
  chk(/Banco/.test(await page.locator('#puestos').innerText()), 'arrastrar un equipo desde la paleta al dibujo lo suma');
  await page.click('#cp-ok'); await page.waitForTimeout(150);   // V10: copia la posición 1 a las demás
  await shot('v9-dis-equipo');
  await page.click('#ok'); await page.waitForTimeout(400);
  chk((await page.locator('#pos img').count()) === 3, 'al guardar, las 3 posiciones quedan como imágenes en el ejercicio');
  await page.click('#f button.primary:not(#dibujar)'); await page.waitForTimeout(800); await esperar();
  const id = await page.evaluate(async () => (await api('GET', '/ejercicios')).find(e => e.nombre === 'Press dibujado').id);
  const full = await page.evaluate((i) => api('GET', '/ejercicios/' + i), id);
  chk(full.poses && JSON.parse(full.poses).poses.length === 3 && full.img1.startsWith('data:image/svg+xml'), 'el ejercicio quedó guardado con sus datos de dibujo');
  const svgTxt = Buffer.from(full.img1.split(',')[1], 'base64').toString();
  chk(/stroke="#[0-9a-f]{6}"/i.test(svgTxt) && !/var\(--/.test(svgTxt), 'la imagen guardada usa colores fijos (se ve en cualquier tema)');
  // reeditar
  await page.evaluate((i) => { location.hash = '#/planificacion/biblioteca'; }, id); await page.waitForTimeout(500); await esperar();
  const editado = await page.evaluate(async (i) => { const e = await api('GET', '/ejercicios/' + i); await formEjercicio(e, await api('GET', '/equipamiento'), e.zona, () => {}); return true; }, id);
  await page.click('#dibujar'); await page.waitForSelector('#lienzo svg');
  chk((await page.locator('#puestos').innerText()).length > 0 && /Mancuerna|Banco/.test(await page.locator('#puestos').innerText()), 'al reeditar vuelve el dibujo y el equipamiento guardados');
  await shot('v9-dis-reedicion');
  await page.click('#base ~ button#aplicar-base'); await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(SHOTS, 'v9-dis-confirma.png') });

  await browser.close(); srv.kill();
  if (problems.length) { console.log('\nPROBLEMAS:\n - ' + problems.join('\n - ')); process.exit(1); }
  console.log('\nTodo OK (interfaz V9)'); process.exit(0);
})().catch(e => { console.error('✗', e); process.exit(1); });
