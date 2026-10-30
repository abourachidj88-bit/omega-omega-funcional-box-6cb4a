'use strict';
// Pruebas de la Versión 5: cantidad de rounds por formato (3, 2 o 1) y progresiones más exigentes.
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');

const P = 4800 + Math.floor(Math.random() * 400);
const D = fs.mkdtempSync(path.join(os.tmpdir(), 'omega-v5-'));
const BASE = 'http://127.0.0.1:' + P;
let ok = 0; const paso = (n) => { ok++; console.log('  ✓ ' + n); };
const ar = () => new Date(Date.now() - 3 * 3600 * 1000);
const hoy = () => ar().toISOString().slice(0, 10);
async function api(metodo, ruta, cuerpo, token) {
  const r = await fetch(BASE + ruta, { method: metodo, headers: { ...(cuerpo !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined });
  const t = await r.text(); let j; try { j = JSON.parse(t); } catch (_) { j = t; } return { status: r.status, data: j };
}
const srv = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', path.join(__dirname, '..', 'server.js')], { env: { ...process.env, PORT: P, DATA_DIR: D, HOST: '127.0.0.1' }, stdio: ['ignore', 'pipe', 'pipe'] });
let log = ''; srv.stdout.on('data', d => log += d); srv.stderr.on('data', d => log += d);
async function esperar() { for (let i = 0; i < 60; i++) { try { await fetch(BASE + '/api/estado'); return; } catch (_) { await new Promise(r => setTimeout(r, 100)); } } throw new Error('no arrancó'); }

(async () => {
  try {
    await esperar();
    let r = await api('POST', '/api/setup', { username: 'dueno', password: 'Omega#2026', nombre: 'Dueño' }); const admin = r.data.token;
    const v = await api('GET', '/api/estado'); assert.match(v.data.version, /^Versión \d+/); paso('la app informa su versión');

    console.log('Rounds por formato');
    r = await api('GET', '/api/formatos', undefined, admin); let fm = r.data;
    const flex = fm.find(f => f.nombre === 'Flex'), z7 = fm.find(f => f.nombre === 'Z7'), fun = fm.find(f => f.nombre === 'Funcional');
    assert.equal(flex.rondas, 2); assert.equal(z7.rondas, 2); assert.equal(fun.rondas, 3); paso('Flex y Z7 vienen con 2 rounds; el resto con 3');
    r = await api('PUT', '/api/formatos', { formatos: [{ id: fun.id, trabajo_seg: 40, descanso_seg: 20, rondas: 1 }] }, admin); assert.equal(r.status, 200);
    assert.equal(r.data.find(f => f.id === fun.id).rondas, 1); paso('el administrador cambia los rounds de un formato');
    r = await api('PUT', '/api/formatos', { formatos: [{ id: fun.id, rondas: 9 }] }, admin);
    r = await api('GET', '/api/formatos', undefined, admin); assert.ok([1, 2, 3].includes(r.data.find(f => f.id === fun.id).rondas)); paso('valores fuera de 1–3 se corrigen');
    r = await api('PUT', '/api/formatos', { formatos: fm.map(f => ({ id: f.id, trabajo_seg: 40, descanso_seg: 20, ...(f.id === fun.id ? { rondas: 3 } : {}) })) }, admin);
    r = await api('POST', '/api/planificacion/generar', { desde: hoy(), dias: 7 }, admin); assert.equal(r.status, 200, JSON.stringify(r.data));
    r = await api('GET', '/api/planificacion?desde=' + hoy() + '&dias=7', undefined, admin);
    const vistos = {};
    for (const d of r.data) for (const c of d.clases) if (c.circuito && c.formato) vistos[c.formato.nombre] = c.circuito;
    const cz = vistos.Z7;
    if (cz) { assert.equal(cz.rondas.length, 2); assert.deepEqual(cz.rondas.map(x => x.nivel_n), [2, 3]);
      cz.rondas[0].ejercicios.forEach((e, i) => { if (!e.vacio) { assert.equal(e.nombre, e.variantes[1]); assert.equal(cz.rondas[1].ejercicios[i].nombre, e.variantes[2]); } });
      paso('con 2 rounds se usan las 2 progresiones más exigentes de cada ejercicio'); }
    const cf = vistos.Funcional;
    if (cf) { assert.equal(cf.rondas.length, 3); assert.deepEqual(cf.rondas.map(x => x.nivel_n), [1, 2, 3]); paso('con 3 rounds se usan base, progresión 1 y 2'); }
    r = await api('PUT', '/api/formatos', { formatos: [{ id: fun.id, rondas: 1 }] }, admin);
    r = await api('GET', '/api/planificacion?desde=' + hoy() + '&dias=7', undefined, admin);
    let c1 = null; for (const d of r.data) for (const c of d.clases) if (c.circuito && c.formato && c.formato.id === fun.id) c1 = c1 || c.circuito;
    if (c1) { assert.equal(c1.rondas.length, 1); assert.equal(c1.rondas[0].nivel_n, 3); if (cf) assert.ok(c1.duracion_min < cf.duracion_min); paso('con 1 round se usa la más exigente y la duración baja'); }
    r = await api('GET', '/api/clase?fecha=' + hoy(), undefined, admin); assert.equal(r.status, 200); paso('la vista de clase sigue funcionando');
    console.log('\n' + ok + ' pruebas OK'); 
  } catch (e) { console.error('FALLÓ:', e.message, '\n', log.slice(-800)); process.exitCode = 1; }
  finally { srv.kill(); }
})();
