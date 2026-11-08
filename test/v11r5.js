'use strict';
// V11 r5: dirección de respaldo. Si la nube que usa la PC desaparece, la PC lee un puntero (sin claves), comprueba que el servidor nuevo
// conoce la clave y pasa a usarlo sola, tanto para sincronizar como para buscar actualizaciones.
const { spawn, execFileSync } = require('node:child_process');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const ROOT = path.join(__dirname, '..');
let ok = 0; const paso = (n) => { ok++; console.log('  ✓ ' + n); };
const hijos = []; const pausa = (ms) => new Promise(r => setTimeout(r, ms));
const base = 7000 + Math.floor(Math.random() * 1500);
const CLAVE = 'clave-de-prueba-123456';
function nube(port, clave) {
  const h = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', path.join(ROOT, 'server.js')], { env: { ...process.env, PORT: String(port), DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'omega-r5n-')), HOST: '127.0.0.1', OMEGA_NODO: 'nube', SYNC_CLAVE: clave }, stdio: 'ignore', cwd: ROOT });
  hijos.push(h); return h;
}
async function esperar(url) { for (let i = 0; i < 120; i++) { try { if ((await fetch(url + '/api/estado')).ok) return; } catch (_) {} await pausa(150); } throw new Error('no arrancó ' + url); }
// la PC se ejecuta en un proceso aparte con su propia base
function pc(datos, env, codigo) { // asíncrono: el servidor del puntero vive en este mismo proceso y tiene que poder responder
  return new Promise((res, rej) => {
    const h = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', '-e', codigo], { cwd: ROOT, env: { ...process.env, DATA_DIR: datos, HOST: '127.0.0.1', ...env }, stdio: ['ignore', 'pipe', 'inherit'] });
    let out = ''; h.stdout.on('data', d => { out += d; });
    h.on('close', () => { try { res(JSON.parse(out.trim().split('\n').pop())); } catch (e) { rej(new Error('salida inválida: ' + out)); } });
  });
}
const SYNC = "const s=require('./src/sync');s.sincronizar('t').then(r=>console.log(JSON.stringify({r,url:s.estado().url}))).catch(e=>console.log(JSON.stringify({err:e.message})))";
const ACT = "const a=require('./src/actualizar');a.buscar().then(r=>console.log(JSON.stringify({error:r.error,disponible:r.disponible}))).catch(e=>console.log(JSON.stringify({err:e.message})))";
(async () => {
  let puntero = null; const sp = http.createServer((q, r) => { if (puntero === null) { r.statusCode = 404; return r.end('x'); } r.setHeader('content-type', 'application/json'); r.end(JSON.stringify({ url: puntero })); });
  await new Promise(r => sp.listen(base + 9, '127.0.0.1', r));
  try {
    const A = 'http://127.0.0.1:' + base, B = 'http://127.0.0.1:' + (base + 1), C = 'http://127.0.0.1:' + (base + 2);
    const datos = fs.mkdtempSync(path.join(os.tmpdir(), 'omega-r5pc-')); const act = fs.mkdtempSync(path.join(os.tmpdir(), 'omega-r5act-'));
    const env = { NUBE_URL: A, NUBE_CLAVE: CLAVE, OMEGA_PUNTERO: 'http://127.0.0.1:' + (base + 9) + '/nube.json', OMEGA_ACT_DIR: act };
    nube(base + 1, CLAVE); nube(base + 2, 'otra-clave-distinta-999'); await esperar(B); await esperar(C);
    // 1) la nube A no existe y no hay puntero: error normal y no se desvía a ningún lado
    let x = await pc(datos, env, SYNC); assert.equal(x.r.ok, false, JSON.stringify(x)); assert.equal(x.url, A); paso('sin puntero, el error se muestra y la dirección no cambia');
    // 2) el puntero apunta a un servidor que NO conoce la clave: se rechaza
    puntero = C; x = await pc(datos, env, SYNC); assert.equal(x.r.ok, false, JSON.stringify(x)); assert.equal(x.url, A); paso('un puntero que lleva a un servidor sin la clave se rechaza (no desvía a la PC)');
    // 3) el puntero apunta a la nube nueva que sí conoce la clave: se adopta y sincroniza
    puntero = B; x = await pc(datos, env, SYNC); assert.equal(x.r.ok, true, JSON.stringify(x)); assert.equal(x.url, B); paso('con el puntero a la nube nueva, la PC la encuentra, verifica la clave y sincroniza sola');
    // 4) ya recordada: funciona aunque el puntero no responda
    puntero = null; x = await pc(datos, env, SYNC); assert.equal(x.r.ok, true, JSON.stringify(x)); assert.equal(x.url, B); paso('recuerda la dirección nueva y no vuelve a depender del puntero');
    // 5) la búsqueda de actualizaciones también usa la dirección nueva
    x = await pc(datos, env, ACT); assert.equal(x.error, null, JSON.stringify(x)); paso('buscar actualización también funciona con la nube nueva');
    // 5b) la conexión incluida en el instalador sigue valiendo cuando el programa corre desde una versión descargada (sin ese archivo)
    const inst = fs.mkdtempSync(path.join(os.tmpdir(), 'omega-r5inst-')); fs.mkdirSync(path.join(inst, 'src'));
    fs.writeFileSync(path.join(inst, 'src', 'nube-embebida.json'), JSON.stringify({ url: B, clave: CLAVE })); fs.writeFileSync(path.join(inst, 'lanzador.js'), '');
    x = await pc(fs.mkdtempSync(path.join(os.tmpdir(), 'omega-r5e-')), { NUBE_URL: A, NUBE_CLAVE: 'clave-vieja-de-nube-txt-000', OMEGA_LANZADOR_JS: path.join(inst, 'lanzador.js') }, "const s=require('./src/sync');console.log(JSON.stringify(s.configuracion()))");
    assert.equal(x.url, B); assert.equal(x.clave, CLAVE); paso('ejecutando una versión descargada, la conexión del instalador pisa a un nube.txt viejo (dirección y clave)');
    // 6) una PC sin clave ni nube no hace nada raro
    x = await pc(fs.mkdtempSync(path.join(os.tmpdir(), 'omega-r5v-')), { NUBE_URL: '', NUBE_CLAVE: '', OMEGA_PUNTERO: env.OMEGA_PUNTERO }, SYNC); assert.equal(x.r.ok, false); paso('sin conexión configurada no intenta ninguna dirección');
    console.log('\n' + ok + ' pruebas OK');
  } catch (e) { console.error('FALLÓ:', e.stack || e.message); process.exitCode = 1; }
  finally { for (const h of hijos) { try { h.kill(); } catch (_) {} } sp.close(); setTimeout(() => process.exit(process.exitCode || 0), 300); }
})();
