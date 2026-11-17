'use strict';
// Versión 13: peso del equipamiento, tamaño de la persona en el dibujo y depurador de la biblioteca (importados por IA / creados por el usuario).
const { spawn } = require('node:child_process');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const assert = require('node:assert/strict');
let ok = 0; const paso = (n) => { ok++; console.log('  ✓ ' + n); };
const P = 7500 + Math.floor(Math.random() * 300), D1 = fs.mkdtempSync(path.join(os.tmpdir(), 'omega-v13a-')), BASE = 'http://127.0.0.1:' + P;
async function api(metodo, ruta, cuerpo, token) {
  const r = await fetch(BASE + ruta, { method: metodo, headers: { ...(cuerpo !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined });
  const t = await r.text(); let j; try { j = JSON.parse(t); } catch (_) { j = t; } return { status: r.status, data: j };
}
const srv = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', path.join(__dirname, '..', 'server.js')], { env: { ...process.env, PORT: P, DATA_DIR: D1, HOST: '127.0.0.1' }, stdio: ['ignore', 'pipe', 'pipe'] });
let log = ''; srv.stdout.on('data', d => log += d); srv.stderr.on('data', d => log += d);
async function esperar() { for (let i = 0; i < 80; i++) { try { await fetch(BASE + '/api/estado'); return; } catch (_) { await new Promise(r => setTimeout(r, 100)); } } throw new Error('no arrancó'); }
const pose = (z) => ({ t: -90, a: [90, 90], a2: null, l: [90, 90], b: null, hx: 100, hy: 78, ...(z !== undefined ? { z } : {}), eq: [] });

(async () => {
  try {
    await esperar();
    let r = await api('POST', '/api/setup', { username: 'dueno', password: 'Omega#2026', nombre: 'Dueño' }); const admin = r.data.token;
    r = await api('GET', '/api/estado'); assert.match(r.data.version, /Versión 1[34]/); paso('la app informa Versión 13');

    // ---- peso del equipamiento
    r = await api('GET', '/api/equipamiento', undefined, admin);
    assert.ok(r.data.every(e => 'tiene_peso' in e && 'peso' in e)); paso('el equipamiento trae los campos tiene_peso y peso');
    const conKg = r.data.filter(e => /kg/i.test(e.nombre)); console.log('   nombres con kg:', conKg.map(e => e.nombre + ' → ' + e.peso).join(' | '));
    assert.ok(conKg.length === 0 || conKg.every(e => e.tiene_peso === 1 && /\d/.test(e.peso))); paso('el equipamiento que traía el peso en el nombre queda tildado con su valor');
    r = await api('POST', '/api/equipamiento', { nombre: 'Chalecos lastrados', cantidad: 4, tiene_peso: true, peso: '8 kg' }, admin); assert.equal(r.status, 200, JSON.stringify(r.data));
    r = await api('GET', '/api/equipamiento', undefined, admin); const ch = r.data.find(e => e.nombre === 'Chalecos lastrados');
    assert.equal(ch.tiene_peso, 1); assert.equal(ch.peso, '8'); paso('se guarda el tilde y el peso al crear un equipamiento (el "kg" se normaliza)');
    r = await api('POST', '/api/equipamiento', { nombre: 'Aros', cantidad: 4, tiene_peso: true, peso: 'pesado' }, admin); assert.equal(r.status, 400); paso('con el tilde puesto el peso tiene que ser un número');
    r = await api('POST', '/api/equipamiento', { nombre: 'Aros', cantidad: 4 }, admin); assert.equal(r.status, 200);
    r = await api('GET', '/api/equipamiento', undefined, admin); const aro = r.data.find(e => e.nombre === 'Aros'); assert.equal(aro.tiene_peso, 0); assert.equal(aro.peso, null); paso('sin tilde queda sin peso');
    r = await api('PUT', '/api/equipamiento', { equipamiento: [{ clave: aro.clave, cantidad: 4, tiene_peso: true, peso: '4 a 20' }] }, admin); assert.equal(r.status, 200, JSON.stringify(r.data));
    r = await api('GET', '/api/equipamiento', undefined, admin); assert.equal(r.data.find(e => e.clave === aro.clave).peso, '4 a 20'); paso('"Guardar cantidades" también guarda el peso (admite rangos)');
    r = await api('PUT', '/api/equipamiento', { equipamiento: [{ clave: aro.clave, cantidad: 4, tiene_peso: false }] }, admin);
    r = await api('GET', '/api/equipamiento', undefined, admin); assert.equal(r.data.find(e => e.clave === aro.clave).peso, null); paso('al destildar se borra el peso');
    r = await api('PUT', '/api/equipamiento', { equipamiento: [{ clave: aro.clave, cantidad: 7 }] }, admin);
    r = await api('GET', '/api/equipamiento', undefined, admin); assert.equal(r.data.find(e => e.clave === aro.clave).cantidad, 7); paso('guardar solo la cantidad (versiones anteriores de la pantalla) sigue funcionando');

    // ---- tamaño de la persona en el dibujo
    const pz = (z) => ({ v: 1, poses: [pose(z), pose(z), pose(z)] });
    const nuevo = (nombre, poses) => api('POST', '/api/ejercicios', { zona: 'Empujar (Push)', nombre, prog2: 'a', prog3: 'b', equipo: 'ninguno', poses }, admin);
    r = await nuevo('Dibujo achicado', pz(0.6)); assert.equal(r.status, 200, JSON.stringify(r.data)); const idZ = r.data.id;
    r = await api('GET', '/api/ejercicios/' + idZ, undefined, admin); assert.equal(JSON.parse(r.data.poses).poses[0].z, 0.6); paso('el tamaño de la persona (60 %) queda guardado en las 3 posiciones');
    r = await nuevo('Dibujo normal', pz(1)); assert.equal(r.status, 200); r = await api('GET', '/api/ejercicios/' + r.data.id, undefined, admin); assert.equal(JSON.parse(r.data.poses).poses[0].z, undefined); paso('al 100 % no se guarda nada (igual que antes)');
    r = await nuevo('Dibujo enano', pz(0.1)); assert.equal(r.status, 400); paso('un tamaño fuera de 40 %–100 % se rechaza');

    // ---- depurador de la biblioteca
    r = await api('GET', '/api/depurar/ejercicios', undefined, admin); assert.equal(r.status, 200);
    const lista = r.data; assert.ok(lista.some(e => e.fuente === 'ia') && lista.some(e => e.fuente === 'propio'));
    assert.ok(lista.filter(e => e.fuente === 'propio').every(e => e.origen === 'propio') && lista.filter(e => e.fuente === 'ia').every(e => e.origen !== 'propio')); paso('la lista separa los ejercicios importados por IA de los creados por el usuario');
    assert.ok(lista.every(e => e.zona && 'capacidad' in e && 'energia' in e && 'equipo_nombre' in e)); paso('cada ejercicio trae su estímulo (patrón, capacidades y energía) para agruparlo');
    const propios = lista.filter(e => e.fuente === 'propio').map(e => e.id);
    r = await api('POST', '/api/depurar/ejercicios', { ids: [] }, admin); assert.equal(r.status, 400); paso('sin tildar nada no hace nada');
    r = await api('POST', '/api/depurar/ejercicios', { ids: propios }, admin); assert.equal(r.status, 200); assert.equal(r.data.eliminados, propios.length);
    r = await api('GET', '/api/ejercicios', undefined, admin); assert.ok(!r.data.some(e => propios.includes(e.id))); paso('los tildados salen de la biblioteca');
    r = await api('GET', '/api/depurar/ejercicios', undefined, admin); assert.ok(r.data.every(e => e.fuente === 'ia')); paso('los de IA siguen intactos');
    const ia = r.data.filter(e => e.zona === 'Empujar (Push)').map(e => e.id), antes = r.data.length;
    r = await api('POST', '/api/depurar/ejercicios', { ids: ia }, admin); assert.equal(r.data.eliminados, ia.length);
    r = await api('GET', '/api/depurar/ejercicios', undefined, admin); assert.equal(r.data.length, antes - ia.length); assert.ok(!r.data.some(e => e.zona === 'Empujar (Push)')); paso('se puede quitar todo un estímulo de una vez');
    r = await api('POST', '/api/depurar/ejercicios', { ids: ia }, admin); assert.equal(r.data.eliminados, 0); paso('repetir la baja no cuenta dos veces');
    r = await api('GET', '/api/depurar/ejercicios'); assert.equal(r.status, 401); paso('sin iniciar sesión no se puede');
    r = await api('POST', '/api/usuarios', { username: 'prof1', password: 'Omega#2026', nombre: 'Profe', rol: 'profesor' }, admin);
    if (r.status === 200) { const l = await api('POST', '/api/login', { username: 'prof1', password: 'Omega#2026' }); const x = await api('GET', '/api/depurar/ejercicios', undefined, l.data.token); assert.equal(x.status, 403); paso('un profesor no puede depurar la biblioteca'); }
  } catch (e) { console.error('✗', e.message, '\n', log.slice(-800)); process.exitCode = 1; } finally { srv.kill(); }
  console.log(process.exitCode ? 'FALLÓ' : ok + ' pruebas OK');
})();
