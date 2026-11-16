'use strict';
// Versión 12: equipamiento por formato y patrones de movimiento con la rutina estándar de 3 días.
const { spawn } = require('node:child_process');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const assert = require('node:assert/strict');
let ok = 0; const paso = (n) => { ok++; console.log('  ✓ ' + n); };

// ---- 1) API (servidor aparte)
const P = 7100 + Math.floor(Math.random() * 300), D1 = fs.mkdtempSync(path.join(os.tmpdir(), 'omega-v12a-')), BASE = 'http://127.0.0.1:' + P;
async function api(metodo, ruta, cuerpo, token) {
  const r = await fetch(BASE + ruta, { method: metodo, headers: { ...(cuerpo !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined });
  const t = await r.text(); let j; try { j = JSON.parse(t); } catch (_) { j = t; } return { status: r.status, data: j };
}
const srv = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', path.join(__dirname, '..', 'server.js')], { env: { ...process.env, PORT: P, DATA_DIR: D1, HOST: '127.0.0.1' }, stdio: ['ignore', 'pipe', 'pipe'] });
let log = ''; srv.stdout.on('data', d => log += d); srv.stderr.on('data', d => log += d);
async function esperar() { for (let i = 0; i < 80; i++) { try { await fetch(BASE + '/api/estado'); return; } catch (_) { await new Promise(r => setTimeout(r, 100)); } } throw new Error('no arrancó'); }

(async () => {
  try {
    await esperar();
    let r = await api('POST', '/api/setup', { username: 'dueno', password: 'Omega#2026', nombre: 'Dueño' }); const admin = r.data.token;
    r = await api('GET', '/api/estado'); assert.match(r.data.version, /Versión 12/); paso('la app informa Versión 12');
    r = await api('GET', '/api/formatos', undefined, admin);
    assert.ok(r.data.length >= 6 && r.data.every(f => Array.isArray(f.equipos) && f.equipos.length === 0)); paso('los formatos arrancan usando todo el equipamiento (lista vacía)');
    const id = r.data[0].id;
    r = await api('PUT', `/api/formatos/${id}/equipos`, { equipos: ['ninguno'] }, admin); assert.equal(r.status, 200, JSON.stringify(r.data));
    r = await api('GET', '/api/formatos', undefined, admin); assert.deepEqual(r.data.find(f => f.id === id).equipos, ['ninguno']); paso('se guarda que el formato usa solo peso corporal');
    r = await api('PUT', `/api/formatos/${id}/equipos`, { equipos: ['banda_rtx', 'banda_rtx', 'colchoneta'] }, admin);
    r = await api('GET', '/api/formatos', undefined, admin); assert.deepEqual(r.data.find(f => f.id === id).equipos, ['banda_rtx', 'colchoneta']); paso('se pueden elegir varios equipos (sin repetir)');
    r = await api('PUT', `/api/formatos/${id}/equipos`, { equipos: ['no_existe'] }, admin); assert.equal(r.status, 400); paso('un equipo inexistente se rechaza');
    r = await api('POST', '/api/equipamiento', { nombre: 'Sogas navales', cantidad: 6 }, admin); assert.equal(r.status, 200, JSON.stringify(r.data));
    r = await api('GET', '/api/equipamiento', undefined, admin); const soga = r.data.find(e => /Sogas/.test(e.nombre)); assert.ok(soga);
    r = await api('PUT', `/api/formatos/${id}/equipos`, { equipos: [soga.clave] }, admin); assert.equal(r.status, 200);
    r = await api('GET', '/api/formatos', undefined, admin); assert.deepEqual(r.data.find(f => f.id === id).equipos, [soga.clave]); paso('el equipamiento nuevo aparece en la lista y se puede relacionar con un formato');
    r = await api('PUT', `/api/formatos/${id}/equipos`, { equipos: [] }, admin);
    r = await api('GET', '/api/formatos', undefined, admin); assert.deepEqual(r.data.find(f => f.id === id).equipos, []); paso('sin elegir ninguno vuelve a usar todo el equipamiento');
    r = await api('PUT', `/api/formatos/${id}/equipos`, { equipos: ['ninguno'] }); assert.equal(r.status, 401); paso('sin iniciar sesión no se puede cambiar');
  } catch (e) { console.error('✗', e.message, '\n', log.slice(-800)); process.exitCode = 1; } finally { srv.kill(); }

  if (process.exitCode) return;
  // ---- 2) Planificador (en el mismo proceso)
  try {
    process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'omega-v12b-')); delete process.env.OMEGA_NODO;
    const { all, run, get } = require('../src/db'); const planner = require('../src/planner'); const semana = require('../src/semana'); const util = require('../src/util');
    const lunes = util.lunesDe('2027-03-01');
    const hoy = '2027-03-01';
    const f = get('SELECT id FROM formatos ORDER BY id LIMIT 1');
    const usados = (c) => c.slots.map(s => get('SELECT equipo FROM ejercicios WHERE id = ?', s.ejercicio_id)).filter(Boolean).map(e => e.equipo);
    run('UPDATE formatos SET equipos = ? WHERE id = ?', JSON.stringify(['ninguno']), f.id);
    for (let d = 0; d < 6; d++) {
      const fecha = util.addDays(hoy, d); const c = planner.construirCircuito(fecha, f.id);
      assert.ok(usados(c).length > 0 && usados(c).every(e => e === 'ninguno'), 'día ' + d + ': ' + usados(c));
    }
    paso('un formato de solo peso corporal arma circuitos únicamente con ejercicios sin equipo');
    run('UPDATE formatos SET equipos = ? WHERE id = ?', JSON.stringify(['banda_rtx']), f.id);
    for (let d = 0; d < 6; d++) { const c = planner.construirCircuito(util.addDays(hoy, d), f.id); assert.ok(usados(c).every(e => e === 'banda_rtx'), 'día ' + d + ': ' + usados(c)); }
    paso('un formato de solo bandas arma circuitos únicamente con bandas');
    run('UPDATE formatos SET equipos = ? WHERE id = ?', JSON.stringify(['rueda_abdominal']), f.id);
    const c = planner.construirCircuito(hoy, f.id);
    assert.ok(!c.advertencias.some(a => /no hay ejercicios/.test(a)), JSON.stringify(c.advertencias)); assert.ok(c.slots.some(s => !s.ejercicio_id)); paso('si faltan ejercicios con ese equipo, deja el lugar para elegir a mano, sin usar otro equipo y sin avisar');
    run('UPDATE formatos SET equipos = NULL WHERE id = ?', f.id);
    // patrones: la frecuencia por patrón ya no se usa (rutina estándar de 3 días)
    run('UPDATE formatos SET frecuencias = ? WHERE id = ?', JSON.stringify({ patrones: { empuje: 0, tiron: 3 }, capacidades: { fuerza: 3 }, energias: { aerobico: 0 } }), f.id);
    assert.deepEqual(semana.formatoEf(f.id, hoy).frecuencias, {}); paso('las frecuencias por estímulo guardadas antes se ignoran');
    const dias = [1, 2, 3].map(d => planner.construirCircuito(util.addDays(hoy, d - 1), f.id).slots.map(s => s.patron));
    const cuenta = {}; dias.flat().forEach(p => { cuenta[p] = (cuenta[p] || 0) + 1; });
    assert.ok(Object.values(cuenta).every(n => n >= 1 && n <= 3), JSON.stringify(cuenta)); paso('los patrones se reparten en la rutina estándar de 3 días');
    console.log(ok + ' pruebas OK');
  } catch (e) { console.error('✗', e.message); process.exitCode = 1; }
  process.exit(process.exitCode || 0);
})();
