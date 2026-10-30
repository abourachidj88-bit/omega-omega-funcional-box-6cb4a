'use strict';
// Interfaz de la Versión 3 con un navegador real: lector de QR, QR fijo del gimnasio y registro del alumno.
const { spawn, execFileSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..');
const DATA = '/tmp/omega-e2e3/data', SHOTS = '/tmp/omega-e2e3/shots';
const PORT = 3112, BASE = 'http://127.0.0.1:' + PORT;
fs.rmSync(DATA, { recursive: true, force: true }); fs.mkdirSync(SHOTS, { recursive: true });
const env = { ...process.env, DATA_DIR: DATA, PORT: String(PORT), HOST: '127.0.0.1', NODE_NO_WARNINGS: '1' };
const ok = (m) => console.log('  ✓ ' + m);
(async () => {
  execFileSync('node', ['-e', "require('./src/demo-data').cargarDemo()"], { cwd: ROOT, env, stdio: 'inherit' });
  const srv = spawn('node', ['server.js'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
  srv.stderr.on('data', d => process.stderr.write('[srv] ' + d));
  await new Promise(r => srv.stdout.on('data', d => { if (String(d).includes('escuchando')) r(); }));
  const browser = await chromium.launch(); const problems = [];
  const api = async (m, u, b, t) => { const r = await fetch(BASE + u, { method: m, headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: b ? JSON.stringify(b) : undefined }); return { status: r.status, data: await r.json().catch(() => null) }; };
  try {
    let r = await api('POST', '/api/login', { username: 'admin', password: 'omega2026' });
    if (r.status !== 200) throw new Error('No encontré el usuario del demo: ' + JSON.stringify(r.data));
    const admin = r.data.token;
    // --- lector de QR: QR de pantalla de celular con desenfoque, reflejo y poca resolución
    const page = await (await browser.newContext({ viewport: { width: 1200, height: 800 } })).newPage();
    page.on('pageerror', e => problems.push('pageerror: ' + e.message));
    await page.goto(BASE + '/'); await page.waitForSelector('form#f-acceso');
    const res = await page.evaluate(async () => {
      const codigo = 'OMEGA|27|1893456000|AbCdEfGhIjKlMnOp';
      const out = {};
      const casos = [
        { n: 'nítido', px: 6, blur: 0, glare: 0, inv: false },
        { n: 'chico y desenfocado', px: 3, blur: 1.2, glare: 0, inv: false },
        { n: 'con reflejo', px: 4, blur: 0.6, glare: 0.55, inv: false },
        { n: 'colores invertidos', px: 5, blur: 0, glare: 0, inv: true },
        { n: 'muy chico', px: 2.4, blur: 0.5, glare: 0.2, inv: false },
      ];
      for (const c of casos) {
        const q = qrcode(0, 'M'); q.addData(codigo); q.make(); const n = q.getModuleCount();
        const W = 1280, H = 720, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
        g.fillStyle = '#2a2d33'; g.fillRect(0, 0, W, H);
        const m = Math.round(c.px * (n + 8)); const ox = 500, oy = 200;
        g.fillStyle = c.inv ? '#000' : '#fff'; g.fillRect(ox, oy, m, m);
        g.fillStyle = c.inv ? '#fff' : '#000';
        for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (q.isDark(y, x)) g.fillRect(ox + (x + 4) * c.px, oy + (y + 4) * c.px, Math.ceil(c.px), Math.ceil(c.px));
        const cv2 = document.createElement('canvas'); cv2.width = W; cv2.height = H; const g2 = cv2.getContext('2d');
        g2.filter = 'blur(' + c.blur + 'px)'; g2.drawImage(cv, 0, 0); g2.filter = 'none';
        if (c.glare) { const gr = g2.createLinearGradient(ox, oy, ox + m, oy + m); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,' + c.glare + ')'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g2.fillStyle = gr; g2.fillRect(ox, oy, m, m); }
        const t = await LectorQR.decodificar(cv2, W, H, true);
        out[c.n] = t === codigo;
      }
      return out;
    });
    console.log('Lector de QR (sin detector nativo):', JSON.stringify(res));
    for (const [k, v] of Object.entries(res)) if (!v) problems.push('el lector no leyó el QR: ' + k); else ok('lee el QR ' + k);
    await page.close();

    // --- QR fijo del gimnasio y registro del alumno desde el celular
    let tk = (await api('GET', '/api/asistencias/qr-fijo', undefined, admin)).data.token;
    const cl = (await api('GET', '/api/clientes', undefined, admin)).data.find(c => c.semaforo_alta === 'verde');
    const acc = (await api('POST', '/api/clientes/' + cl.id + '/acceso', undefined, admin)).data;
    // agenda con clases durante todo el día para que siempre haya una clase "ahora"
    const horasDia = Array.from({ length: 17 }, (_, i) => 7 + i); const f0 = (await api('GET', '/api/formatos', undefined, admin)).data[0];
    const celdas = []; for (let d = 1; d <= 7; d++) for (const h of horasDia) celdas.push({ dia: d, hora: h, formato_id: f0.id });
    await api('PUT', '/api/agenda', { celdas, cambios: celdas }, admin);
    const ctx = await browser.newContext({ viewport: { width: 390, height: 800 }, isMobile: true, locale: 'es-AR', timezoneId: 'America/Argentina/Buenos_Aires' });
    const cel = await ctx.newPage(); cel.on('pageerror', e => problems.push('cel pageerror: ' + e.message));
    await cel.goto(BASE + '/#/asistir/' + tk); await cel.waitForSelector('form#f-acceso');
    await cel.fill('[name=username]', acc.usuario); await cel.fill('[name=password]', acc.clave); await cel.click('form#f-acceso button');
    await cel.waitForSelector('#a-rut', { timeout: 8000 }); ok('el alumno escanea, entra y ve Clase / Rutina sin perder el destino');
    await cel.screenshot({ path: SHOTS + '/alumno-asistir.png' });
    const horaClase = await cel.locator('#main').innerText();
    if (!/Clase|clase/.test(horaClase)) problems.push('no muestra la clase actual');
    await cel.click('#a-clase'); await cel.waitForSelector('.okbox', { timeout: 6000 });
    if (!/Asistencia registrada|Ya ten/.test(await cel.locator('.okbox').innerText())) problems.push('no confirmó la asistencia'); else ok('Clase: asistencia registrada');
    if (!(await cel.locator('#ti').count())) problems.push('falta la tarjeta para dejar el acceso directo en el celular'); else ok('se ofrece el acceso directo en la pantalla de inicio');
    await cel.screenshot({ path: SHOTS + '/alumno-registrada.png' });
    await cel.goto(BASE + '/#/'); await cel.goto(BASE + '/#/asistir/' + tk); await cel.waitForSelector('#a-clase'); await cel.click('#a-clase'); await cel.waitForSelector('.okbox');
    if (!/Ya ten/.test(await cel.locator('.okbox').innerText())) problems.push('escanear de nuevo en la misma clase debería avisar que ya estaba'); else ok('escanear otra vez en la misma clase no duplica');
    await cel.goto(BASE + '/#/'); await cel.waitForTimeout(300); await cel.goto(BASE + '/#/asistir/' + tk); await cel.waitForSelector('#a-rut'); await cel.click('#a-rut');
    await cel.waitForFunction(() => location.hash.includes('/entrenamiento/'), null, { timeout: 6000 }); ok('Rutina: lo lleva directo a sus rutinas');
    await cel.screenshot({ path: SHOTS + '/alumno-rutina.png' });
    // --- pantalla del staff con el QR fijo
    const adm = await (await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true })).newPage();
    adm.on('pageerror', e => problems.push('adm pageerror: ' + e.message));
    await adm.goto(BASE + '/'); await adm.waitForSelector('form#f-acceso'); await adm.fill('[name=username]', 'admin'); await adm.fill('[name=password]', 'omega2026'); await adm.click('form#f-acceso button'); await adm.waitForSelector('#main');
    await adm.evaluate(() => { location.hash = '#/asistencias/qr-gimnasio'; }); await adm.waitForSelector('#b-png'); ok('el administrador ve el QR fijo del gimnasio');
    const [dl] = await Promise.all([adm.waitForEvent('download'), adm.click('#b-png')]); const fn = SHOTS + '/banner.png'; await dl.saveAs(fn); if (fs.statSync(fn).size < 5000) problems.push('el banner está vacío'); else ok('descarga el banner del QR');
    await adm.screenshot({ path: SHOTS + '/admin-qr-gimnasio.png' });
    await adm.evaluate(() => { location.hash = '#/asistencias/qr'; }); await adm.waitForSelector('#b-cam'); ok('la pantalla del escáner carga con el lector nuevo');

    // --- diseño de la app: fondo, letras, botones e ícono
    await adm.evaluate(() => { location.hash = '#/'; }); await adm.waitForSelector('#btn-diseno'); await adm.click('#btn-diseno'); await adm.waitForSelector('#t-fondo');
    await adm.click('[data-f="color"]'); await adm.waitForSelector('#c-fondo');
    await adm.evaluate(() => { const set = (id, v) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }; set('c-fondo', '#13294b'); set('c-btn', '#22b573'); set('c-txt', '#f5f7ff'); const sel = document.getElementById('s-fuente'); sel.value = 'Poppins'; sel.dispatchEvent(new Event('change', { bubbles: true })); });
    const vars = await adm.evaluate(() => { const c = getComputedStyle(document.documentElement); return { bg: c.getPropertyValue('--bg').trim(), brand: c.getPropertyValue('--brand').trim(), txt: c.getPropertyValue('--txt').trim() }; });
    if (vars.bg !== '#13294b' || vars.brand !== '#22b573' || vars.txt !== '#f5f7ff') problems.push('el diseño no se aplicó en vivo: ' + JSON.stringify(vars)); else ok('el fondo, las letras y los botones cambian en vivo');
    await adm.screenshot({ path: SHOTS + '/admin-diseno.png' });
    await adm.click('#t-ok'); await adm.waitForTimeout(500);
    await adm.reload(); await adm.waitForSelector('#main'); const b2 = await adm.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--brand').trim());
    if (b2 !== '#22b573') problems.push('el diseño no quedó guardado'); else ok('el diseño queda guardado');
    // foto de fondo
    await adm.click('#btn-diseno'); await adm.waitForSelector('#t-fondo'); await adm.click('[data-f="imagen"]'); await adm.waitForSelector('#a-foto', { state: 'attached' });
    const fotoPng = await adm.evaluate(() => { const c = document.createElement('canvas'); c.width = 800; c.height = 500; const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 800, 500); gr.addColorStop(0, '#7a1f3d'); gr.addColorStop(1, '#1f3d7a'); g.fillStyle = gr; g.fillRect(0, 0, 800, 500); g.fillStyle = '#fff'; g.font = '900 90px sans-serif'; g.fillText('MI GIMNASIO', 120, 280); return c.toDataURL('image/png').split(',')[1]; });
    fs.writeFileSync(SHOTS + '/fondo.png', Buffer.from(fotoPng, 'base64'));
    await adm.setInputFiles('#a-foto', SHOTS + '/fondo.png'); await adm.waitForSelector('#q-foto', { timeout: 6000 });
    if (!(await adm.evaluate(() => document.body.classList.contains('con-foto')))) problems.push('la foto de fondo no se aplicó'); else ok('la foto con el diseño del gimnasio se aplica de fondo');
    await adm.screenshot({ path: SHOTS + '/admin-fondo-foto.png' }); await adm.click('#t-ok'); await adm.waitForTimeout(500);
    // ícono desde el logo
    await adm.click('#btn-logo'); await adm.waitForSelector('#arch', { state: 'attached' });
    const logoPng = await adm.evaluate(() => { const c = document.createElement('canvas'); c.width = 300; c.height = 300; const g = c.getContext('2d'); g.fillStyle = '#ffcc00'; g.beginPath(); g.arc(150, 150, 120, 0, 7); g.fill(); g.fillStyle = '#000'; g.font = '900 120px sans-serif'; g.fillText('G', 110, 195); return c.toDataURL('image/png').split(',')[1]; });
    fs.writeFileSync(SHOTS + '/logo.png', Buffer.from(logoPng, 'base64'));
    await adm.setInputFiles('#arch', SHOTS + '/logo.png'); await adm.waitForTimeout(400);
    await adm.screenshot({ path: SHOTS + '/admin-logo-icono.png' });
    await adm.click('#f button.primary'); await adm.waitForTimeout(900);
    const man = await adm.evaluate(() => document.querySelector('link[rel="manifest"]').getAttribute('href')); if (!/\?v=\d+/.test(man)) problems.push('el manifiesto no apunta al ícono nuevo: ' + man); else ok('al subir el logo cambia también el ícono de la app');
    const ic = await (await fetch(BASE + '/icons/app-192.png')).arrayBuffer(); if (ic.byteLength < 300) problems.push('ícono vacío'); else ok('el ícono propio se sirve (' + ic.byteLength + ' bytes)');
    const icoOk = fs.existsSync(path.join(DATA, 'omega.ico')); if (!icoOk) problems.push('no se creó omega.ico'); else ok('se creó el ícono para el acceso directo de la PC');
    // el alumno ve el mismo diseño
    await cel.goto(BASE + '/#/'); await cel.reload(); await cel.waitForSelector('#main'); const bc = await cel.evaluate(() => document.body.classList.contains('con-foto')); if (!bc) problems.push('el alumno no ve el diseño del gimnasio'); else ok('los alumnos ven el mismo diseño');
    await cel.screenshot({ path: SHOTS + '/alumno-diseno.png' });
  } catch (e) { problems.push(e.stack); }
  await browser.close(); srv.kill();
  if (problems.length) { console.error('\n✗ PROBLEMAS:\n' + problems.join('\n')); process.exit(1); }
  console.log('\nTodo OK (interfaz V3)'); process.exit(0);
})();
