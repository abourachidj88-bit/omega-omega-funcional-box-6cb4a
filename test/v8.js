'use strict';
// Pruebas de la Versión 8: rutinas por cliente y biblioteca de rutinas por profesor.
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');

const P = 6300 + Math.floor(Math.random() * 400);
const D = fs.mkdtempSync(path.join(os.tmpdir(), 'omega-v8-'));
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
    r = await api('GET', '/api/estado'); assert.match(r.data.version, /Versión 8/); paso('la app informa Versión 8');
    r = await api('POST', '/api/usuarios', { username: 'profa', password: 'prof12345', nombre: 'Profe Ana', rol: 'profesor' }, admin); const pa = r.data.id;
    r = await api('POST', '/api/usuarios', { username: 'profb', password: 'prof12345', nombre: 'Profe Beto', rol: 'profesor' }, admin); const pb = r.data.id;
    r = await api('POST', '/api/login', { username: 'profa', password: 'prof12345' }); const tA = r.data.token;
    r = await api('POST', '/api/login', { username: 'profb', password: 'prof12345' }); const tB = r.data.token;
    r = await api('GET', '/api/ejercicios', undefined, admin); const ej = r.data.slice(0, 3);
    const items = ej.map(e => ({ ejercicio_id: e.id, series: 3, repeticiones: '10', descanso_seg: 60, seg_serie: 40 }));
    const cli = async (n) => (await api('POST', '/api/clientes', { nombre: n, precio_plan: 30000 }, admin)).data.id;
    const c1 = await cli('Alumno Uno'), c2 = await cli('Alumno Dos');

    console.log('Biblioteca por profesor');
    r = await api('POST', '/api/rutinas', { nombre: 'Full body', items }, tA); assert.equal(r.status, 200, JSON.stringify(r.data)); const rA = r.data.id;
    r = await api('POST', '/api/rutinas', { nombre: 'Full body', items }, tB); assert.equal(r.status, 200, JSON.stringify(r.data)); const rB = r.data.id; paso('dos profesores crean una rutina con el mismo nombre y quedan separadas');
    r = await api('POST', '/api/rutinas', { nombre: 'full body', items }, tA); assert.equal(r.status, 400); paso('el mismo profesor no repite nombre');
    r = await api('GET', '/api/rutinas/biblioteca', undefined, tA); assert.equal(r.status, 200);
    assert.equal(r.data.length, 2); assert.equal(r.data[0].profesor, 'Profe Ana'); assert.equal(r.data[0].propio, true); assert.equal(r.data[1].profesor, 'Profe Beto');
    assert.equal(r.data[0].rutinas[0].editable, true); assert.equal(r.data[1].rutinas[0].editable, false); paso('la biblioteca agrupa por profesor, con las propias primero y marcando cuáles puede editar');

    console.log('Solo el creador modifica');
    r = await api('PUT', '/api/rutinas/' + rB, { nombre: 'Hackeada', items }, tA); assert.equal(r.status, 403); paso('un profesor no puede modificar la rutina de otro');
    r = await api('POST', '/api/rutinas/' + rB + '/inhabilitar', {}, tA); assert.equal(r.status, 403);
    r = await api('PUT', '/api/rutinas/' + rA, { nombre: 'Full body A', items }, tA); assert.equal(r.status, 200); paso('el creador sí la modifica');
    r = await api('PUT', '/api/rutinas/' + rB, { nombre: 'Full body B', items }, admin); assert.equal(r.status, 200); paso('el administrador también');

    console.log('Uso libre y varias rutinas por cliente');
    r = await api('POST', '/api/rutinas/asignar', { rutina_id: rB, cliente_ids: [c1, c2], dias: [1, 3] }, tA); assert.equal(r.status, 200, JSON.stringify(r.data)); paso('el profesor A asigna la rutina de B a dos alumnos');
    r = await api('POST', '/api/rutinas/asignar', { rutina_id: rA, cliente_ids: [c1], dias: [2, 4], profesor_id: pa }, tA); assert.equal(r.status, 200); paso('un alumno puede tener varias rutinas');
    r = await api('GET', '/api/rutinas/por-cliente', undefined, tB); assert.equal(r.status, 200);
    const u1 = r.data.find(x => x.cliente_id === c1), u2 = r.data.find(x => x.cliente_id === c2);
    assert.equal(u1.rutinas.length, 2); assert.equal(u2.rutinas.length, 1); assert.equal(u1.cliente, 'Alumno Uno'); paso('la vista es Cliente → Rutinas (Alumno Uno tiene 2, Alumno Dos 1)');
    r = await api('GET', '/api/rutinas/biblioteca', undefined, tB);
    const bB = r.data.find(g => g.profesor === 'Profe Beto').rutinas[0]; assert.equal(bB.asignados.length, 2); assert.ok(bB.asignados.some(a => a.cliente === 'Alumno Dos')); paso('la biblioteca muestra a quién está asignada cada rutina');

    console.log('Duplicar como propia');
    r = await api('POST', '/api/rutinas/' + rB + '/duplicar', {}, tA); assert.equal(r.status, 200, JSON.stringify(r.data)); const dup = r.data.id;
    r = await api('GET', '/api/rutinas/' + dup, undefined, tA); assert.equal(r.data.items.length, 3); assert.match(r.data.nombre, /Full body B/);
    r = await api('PUT', '/api/rutinas/' + dup, { nombre: 'Adaptada', items: items.slice(0, 2) }, tA); assert.equal(r.status, 200); paso('la copia es del profesor que duplica y la puede adaptar sin tocar la original');
    r = await api('GET', '/api/rutinas/' + rB, undefined, tA); assert.equal(r.data.items.length, 3);


    console.log('Inhabilitar en vez de eliminar');
    r = await api('DELETE', '/api/rutinas/' + dup, undefined, tA); assert.ok(r.status === 404 || r.status === 405, 'DELETE ya no existe: ' + r.status); paso('las rutinas ya no se eliminan desde el uso diario');
    r = await api('POST', '/api/rutinas/' + dup + '/inhabilitar', {}, tA); assert.equal(r.status, 200);
    r = await api('GET', '/api/rutinas-inhabilitadas', undefined, tB); assert.ok(r.data.some(x => x.id === dup)); paso('la rutina inhabilitada pasa a la lista de Inhabilitadas');
    r = await api('GET', '/api/rutinas/biblioteca', undefined, tA); assert.ok(!r.data.flatMap(g => g.rutinas).some(x => x.id === dup));
    r = await api('POST', '/api/rutinas/' + dup + '/habilitar', {}, tB); assert.equal(r.status, 403);
    r = await api('POST', '/api/rutinas/' + dup + '/habilitar', {}, tA); assert.equal(r.status, 200); paso('se puede activar de nuevo (solo su creador)');
    r = await api('POST', '/api/rutinas/' + rB + '/inhabilitar', {}, admin); assert.equal(r.status, 200);
    r = await api('GET', '/api/rutinas/por-cliente', undefined, tA); assert.ok(!r.data.some(x => x.rutinas.some(y => y.rutina_id === rB))); paso('una rutina inhabilitada deja de verse en los clientes');
    r = await api('POST', '/api/rutinas/' + rB + '/habilitar', {}, admin); r = await api('GET', '/api/rutinas/por-cliente', undefined, tA); assert.equal(r.data.find(x => x.cliente_id === c1).rutinas.length, 2); paso('al reactivarla, vuelve con sus alumnos asignados');

    console.log('Depurar la base (solo administrador)');
    r = await api('GET', '/api/depurar/clientes', undefined, tA); assert.equal(r.status, 403); paso('un profesor no puede depurar');
    r = await api('GET', '/api/depurar/clientes', undefined, admin); assert.equal(r.data.length, 2);
    r = await api('POST', '/api/depurar/clientes', { ids: [c2] }, admin); assert.equal(r.status, 400); paso('eliminar clientes activos pide confirmación extra');
    r = await api('POST', '/api/depurar/clientes', { ids: [c2], incluir_activos: true }, admin); assert.equal(r.status, 200); assert.equal(r.data.eliminados, 1);
    r = await api('GET', '/api/rutinas/por-cliente', undefined, admin); assert.ok(!r.data.some(x => x.cliente_id === c2)); paso('el cliente eliminado se va con sus rutinas asignadas');
    r = await api('GET', '/api/depurar/clientes', undefined, admin); assert.equal(r.data.length, 1);
    r = await api('POST', '/api/leads', { nombre: 'Perdido viejo', fecha: '2024-01-10' }, admin); const lp = r.data.id;
    assert.ok(lp, JSON.stringify(r.data)); r = await api('PUT', '/api/leads/' + lp + '/perdido', { motivo: 'x' }, admin); assert.equal(r.status, 200); { const { DatabaseSync } = require('node:sqlite'); const x = new DatabaseSync(require('path').join(D, 'omega.db')); x.exec("UPDATE leads SET perdido_fecha = '2024-02-01' WHERE id = " + lp); x.close(); }
    r = await api('GET', '/api/depurar/perdidos?meses=12', undefined, admin); assert.equal(r.data.total, 1); assert.equal(r.data.antiguos, 1);
    r = await api('POST', '/api/depurar/perdidos', { meses: 12 }, admin); assert.equal(r.data.eliminados, 1);
    r = await api('GET', '/api/crm/seguimiento', undefined, admin); assert.equal(r.data.perdidos.length, 0); paso('se eliminan los perdidos de más de X meses');
    r = await api('POST', '/api/leads', { nombre: 'Perdido reciente' }, admin); await api('PUT', '/api/leads/' + r.data.id + '/perdido', {}, admin);
    r = await api('POST', '/api/depurar/perdidos', { meses: 12 }, admin); assert.equal(r.data.eliminados, 0); paso('los perdidos recientes no se tocan');
    r = await api('GET', '/api/depurar/rutinas', undefined, admin); assert.ok(r.data.length >= 3);
    r = await api('POST', '/api/depurar/rutinas', { ids: [dup] }, admin); assert.equal(r.status, 400);
    r = await api('POST', '/api/depurar/rutinas', { ids: [dup], incluir_activas: true }, admin); assert.equal(r.data.eliminadas, 1);
    r = await api('GET', '/api/rutinas/' + dup, undefined, admin); assert.equal(r.status, 404); paso('las rutinas elegidas se eliminan de la base');

    console.log('Rutinas anteriores sin creador');
    r = await api('GET', '/api/rutinas', undefined, tA); assert.ok(r.data.every(x => 'editable' in x)); paso('el listado general informa quién puede editar cada una');
    console.log('\nTodo OK: ' + ok + ' verificaciones de la Versión 8');
  } catch (e) { console.error('\n✗ FALLÓ:', e.message); console.error(e.stack); console.error('--- log ---\n' + log.slice(-1500)); process.exitCode = 1; }
  finally { srv.kill(); fs.rmSync(D, { recursive: true, force: true }); }
})();
