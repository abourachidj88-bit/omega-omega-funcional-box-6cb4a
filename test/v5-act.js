'use strict';
// Pruebas de la actualización automática: la nube ofrece una versión más nueva, la PC (con el lanzador real) la descarga, se reinicia con ella
// y, si la versión nueva no arranca, vuelve sola a la anterior.
const { spawn, execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const ROOT = path.join(__dirname, '..');
let ok = 0; const paso = (n) => { ok++; console.log('  ✓ ' + n); };
const hijos = [];
const pausa = (ms) => new Promise(r => setTimeout(r, ms));
const rnd = () => 6000 + Math.floor(Math.random() * 1800);
async function api(base, m, ruta, cuerpo, token) {
  const r = await fetch(base + ruta, { method: m, headers: { ...(cuerpo !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined });
  const t = await r.text(); let j; try { j = JSON.parse(t); } catch (_) { j = t; } return { status: r.status, data: j };
}
async function esperar(url, n = 120) { for (let i = 0; i < n; i++) { try { const r = await fetch(url + '/api/estado'); if (r.ok) return; } catch (_) {} await pausa(150); } throw new Error('no arrancó ' + url); }
function copiaApp(rev, romper) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'omega-nube-'));
  for (const f of ['server.js', 'lanzador.js', 'package.json']) fs.copyFileSync(path.join(ROOT, f), path.join(d, f));
  for (const c of ['src', 'public', 'scripts']) fs.cpSync(path.join(ROOT, c), path.join(d, c), { recursive: true });
  fs.writeFileSync(path.join(d, 'src', 'version.js'), "'use strict';\nmodule.exports = { numero: 6, nombre: 'Versión 6', fecha: '2026-10-30', revision: " + rev + " };\n");
  if (romper) fs.appendFileSync(path.join(d, 'server.js'), "\nthrow new Error('versión rota a propósito');\n");
  return d;
}
function nube(dir, port) {
  const datos = fs.mkdtempSync(path.join(os.tmpdir(), 'omega-nubedat-'));
  const h = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', path.join(dir, 'server.js')], { env: { ...process.env, PORT: port, DATA_DIR: datos, HOST: '127.0.0.1', OMEGA_NODO: 'nube', SYNC_CLAVE: 'clave-de-prueba-123456' }, stdio: 'ignore', cwd: dir });
  hijos.push(h); return h;
}
function pc(home, port, urlNube) {
  fs.mkdirSync(home, { recursive: true });
  fs.writeFileSync(path.join(home, 'config.txt'), 'PORT=' + port + '\nDATA_DIR=' + path.join(home, 'datos') + '\nBACKUP_DIR=' + path.join(home, 'copias') + '\n');
  fs.writeFileSync(path.join(home, 'nube.txt'), 'NUBE_URL=' + urlNube + '\nNUBE_CLAVE=clave-de-prueba-123456\n');
  const h = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', path.join(ROOT, 'lanzador.js'), '--silencioso'], { env: { ...process.env, OMEGA_HOME: home, HOST: '127.0.0.1' }, stdio: 'ignore', detached: true });
  hijos.push(h); return h;
}
async function hasta(f, ms = 25000) { const t = Date.now(); while (Date.now() - t < ms) { try { const v = await f(); if (v) return v; } catch (_) {} await pausa(300); } throw new Error('tiempo agotado'); }

(async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'omega-home-'));
  try {
    const PN = rnd(), PP = PN + 1;
    const nubeBase = 'http://127.0.0.1:' + PN, pcBase = 'http://127.0.0.1:' + PP;
    // 1) la nube trae la misma versión: no hay nada que actualizar
    nube(ROOT, PN); await esperar(nubeBase);
    pc(home, PP, nubeBase); await esperar(pcBase);
    let r = await api(pcBase, 'POST', '/api/setup', { username: 'dueno', password: 'Omega#2026', nombre: 'Dueño' }); const adm = r.data.token;
    r = await api(pcBase, 'POST', '/api/actualizacion/buscar', {}, adm); assert.equal(r.status, 200); assert.equal(r.data.disponible, null, JSON.stringify(r.data)); assert.equal(r.data.error, null, JSON.stringify(r.data)); paso('con la misma versión en la web, no hay actualización');
    r = await api(nubeBase, 'POST', '/api/actualizacion', { accion: 'info' }); assert.equal(r.status, 401); paso('la web no entrega su código sin la clave de conexión');
    hijos[0].kill();
    // 2) la nube publica una revisión más nueva
    const nuevaDir = copiaApp(99); const PN2 = rnd() + 2000; nube(nuevaDir, PN2); await esperar('http://127.0.0.1:' + PN2);
    fs.writeFileSync(path.join(home, 'nube.txt'), 'NUBE_URL=http://127.0.0.1:' + PN2 + '\nNUBE_CLAVE=clave-de-prueba-123456\n');
    // el servidor lee nube.txt al iniciar: reiniciamos la PC con el lanzador
    execFileSync(process.execPath, [path.join(ROOT, 'lanzador.js'), '--detener'], { env: { ...process.env, OMEGA_HOME: home }, stdio: 'ignore' }); await pausa(1200);
    pc(home, PP, 'http://127.0.0.1:' + PN2); await esperar(pcBase);
    r = await api(pcBase, 'POST', '/api/login', { username: 'dueno', password: 'Omega#2026' }); const adm2 = r.data.token;
    r = await api(pcBase, 'POST', '/api/actualizacion/buscar', {}, adm2); assert.equal(r.data.error, null, JSON.stringify(r.data)); assert.equal(r.data.lista_para_aplicar, true, JSON.stringify(r.data)); assert.equal(r.data.disponible.revision, 99); paso('la PC detecta y descarga la versión nueva de la web');
    assert.ok(fs.existsSync(path.join(home, 'actualizacion', 'actual.json'))); paso('queda lista en C:\\OMEGA\\actualizacion');
    r = await api(pcBase, 'GET', '/api/actualizacion/estado', undefined, adm2); assert.equal(r.status, 200);
    r = await api(pcBase, 'POST', '/api/actualizacion/aplicar', {}, adm2); assert.equal(r.data.ok, true, JSON.stringify(r.data));
    const e = await hasta(async () => { const x = await api(pcBase, 'GET', '/api/actualizacion/estado', undefined, adm2); return x.status === 200 && x.data.version.revision === 99 ? x.data : null; }, 30000);
    assert.equal(e.en_uso, true); paso('el servidor se reinició solo con la versión nueva (revisión 99)');
    r = await api(pcBase, 'POST', '/api/login', { username: 'dueno', password: 'Omega#2026' }); assert.equal(r.status, 200); paso('los datos y usuarios siguen intactos después de actualizar');
    // 3) una versión rota vuelve sola a la anterior
    execFileSync(process.execPath, [path.join(ROOT, 'lanzador.js'), '--detener'], { env: { ...process.env, OMEGA_HOME: home }, stdio: 'ignore' }); await pausa(1200);
    fs.rmSync(path.join(home, 'actualizacion'), { recursive: true, force: true });
    const rota = copiaApp(120, true); const PN3 = rnd() + 3500; nube(rota, PN3);
    // la nube rota no puede arrancar (lanza error), por eso se arma el paquete a mano desde el código válido y se rompe el server.js del paquete
    hijos[hijos.length - 1].kill();
    const ok2 = copiaApp(120); const PN4 = PN3 + 1; nube(ok2, PN4); await esperar('http://127.0.0.1:' + PN4);
    fs.writeFileSync(path.join(home, 'nube.txt'), 'NUBE_URL=http://127.0.0.1:' + PN4 + '\nNUBE_CLAVE=clave-de-prueba-123456\n');
    pc(home, PP, 'http://127.0.0.1:' + PN4); await esperar(pcBase);
    r = await api(pcBase, 'POST', '/api/login', { username: 'dueno', password: 'Omega#2026' }); const adm3 = r.data.token;
    r = await api(pcBase, 'POST', '/api/actualizacion/buscar', {}, adm3); assert.equal(r.data.lista_para_aplicar, true, JSON.stringify(r.data));
    const aj = JSON.parse(fs.readFileSync(path.join(home, 'actualizacion', 'actual.json'), 'utf8'));
    fs.appendFileSync(path.join(aj.dir, 'server.js'), "\nthrow new Error('versión rota a propósito');\n");
    r = await api(pcBase, 'POST', '/api/actualizacion/aplicar', {}, adm3);
    await hasta(async () => { const a = JSON.parse(fs.readFileSync(path.join(home, 'actualizacion', 'actual.json'), 'utf8')); return a.estado === 'fallida'; }, 30000);
    const e2 = await hasta(async () => { const x = await api(pcBase, 'POST', '/api/login', { username: 'dueno', password: 'Omega#2026' }); if (x.status !== 200) return null; const y = await api(pcBase, 'GET', '/api/actualizacion/estado', undefined, x.data.token); return y.status === 200 && y.data.version.revision === 0 ? y.data : null; }, 30000);
    assert.equal(e2.version.revision, 0); assert.equal(e2.en_uso, false); paso('si la versión nueva no arranca, vuelve sola a la anterior y sigue andando');
    console.log('\n' + ok + ' pruebas OK');
  } catch (e) { console.error('FALLÓ:', e.stack || e.message); process.exitCode = 1; }
  finally {
    try { execFileSync(process.execPath, [path.join(ROOT, 'lanzador.js'), '--detener'], { env: { ...process.env, OMEGA_HOME: home }, stdio: 'ignore', timeout: 8000 }); } catch (_) {}
    for (const h of hijos) { try { process.kill(h.pid); } catch (_) {} }
    setTimeout(() => process.exit(process.exitCode || 0), 500);
  }
})();
