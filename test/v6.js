'use strict';
// Pruebas de la Versión 6: agenda y formatos por semana, estímulos, biblioteca por patrones y planificación con frecuencia 2.
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');

const P = 5300 + Math.floor(Math.random() * 400);
const D = fs.mkdtempSync(path.join(os.tmpdir(), 'omega-v6-'));
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
    const suma = (f, n) => new Date(Date.parse(f + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
    const lunesDe = (f) => { const d = new Date(f + 'T00:00:00Z'); return suma(f, -((d.getUTCDay() + 6) % 7)); };
    const L2 = suma(lunesDe(hoy()), 7), L3 = suma(L2, 7);
    const v = await api('GET', '/api/estado'); assert.match(v.data.version, /Versión \d+/); paso('la app informa su versión');

    console.log('Biblioteca por estímulos');
    r = await api('GET', '/api/estimulos', undefined, admin);
    assert.equal(r.data.patrones.length, 7); assert.equal(r.data.capacidades.length, 4); assert.equal(r.data.energias.length, 2); paso('7 patrones, 4 capacidades físicas y 2 sistemas energéticos');
    r = await api('GET', '/api/ejercicios', undefined, admin); const ej = r.data;
    const zonas = new Set(ej.map(e => e.zona)); assert.equal(zonas.size, 7, [...zonas].join('|'));
    assert.ok(ej.every(e => e.capacidad && e.energia)); paso('todos los ejercicios están en un patrón y tienen capacidad física y sistema energético');
    for (const z of zonas) assert.ok(ej.filter(e => e.zona === z).length >= 20, z);
    paso('cada patrón tiene al menos 20 ejercicios');
    assert.ok(ej.some(e => e.capacidad.includes('movilidad')) && ej.some(e => e.capacidad.includes('equilibrio'))); paso('hay ejercicios de movilidad y de equilibrio');

    console.log('Agenda semanal');
    r = await api('GET', '/api/formatos-semana?semana=' + L2, undefined, admin); const fm = r.data.formatos; assert.equal(r.data.origen, 'general');
    const fun = fm.find(f => f.nombre === 'Funcional');
    r = await api('GET', '/api/agenda-semanal?semana=' + L2, undefined, admin); assert.notEqual(r.data.origen, 'propia');
    const celdas = [1, 3, 5].map(d => ({ dia: d, hora: 10, formato_id: fun.id }));
    r = await api('PUT', '/api/agenda-semanal', { semana: L2, celdas }, admin); assert.equal(r.status, 200, JSON.stringify(r.data));
    r = await api('GET', '/api/agenda-semanal?semana=' + L2, undefined, admin); assert.equal(r.data.origen, 'propia'); assert.equal(r.data.celdas.length, 3); paso('la agenda se guarda por semana');
    r = await api('GET', '/api/agenda-semanal?semana=' + L3, undefined, admin); assert.equal(r.data.origen, 'heredada'); assert.equal(r.data.celdas.length, 3); paso('la semana siguiente hereda la última agenda guardada');
    r = await api('GET', '/api/agenda-semanal?semana=' + suma(L2, -7), undefined, admin); assert.notEqual(r.data.celdas.length, 3); paso('la agenda de una semana no cambia las anteriores');
    r = await api('GET', '/api/clase?fecha=' + L2, undefined, admin); assert.ok(r.data.clases.some(c => c.hora === 10 && c.formato && c.formato.id === fun.id)); paso('la app del cliente muestra la clase de la agenda de la semana');
    r = await api('PUT', '/api/agenda-semanal', { semana: L3, celdas: [{ dia: 2, hora: 18, formato_id: fun.id }] }, admin);
    r = await api('POST', '/api/agenda-semanal/copiar', { semana: L3 }, admin); assert.equal(r.data.clases, 3); r = await api('GET', '/api/agenda-semanal?semana=' + L3, undefined, admin); assert.equal(r.data.celdas.length, 3); paso('“Copiar agenda semana anterior” reemplaza la semana con la anterior');
    r = await api('GET', '/api/clase?fecha=' + suma(L3, 1), undefined, admin); assert.ok(!r.data.clases.some(c => c.hora === 18 && c.formato)); paso('lo que se saca de la agenda desaparece de la app del cliente');
    r = await api('GET', '/api/semanas?desde=' + L2 + '&n=3', undefined, admin); assert.equal(r.data.length, 3); assert.equal(r.data[0].agenda, 'propia'); paso('el calendario de semanas marca las guardadas');

    console.log('Agenda Staff');
    r = await api('POST', '/api/usuarios', { username: 'prof1', password: 'prof12345', nombre: 'Profe Uno', rol: 'profesor' }, admin); assert.ok(r.status < 300, JSON.stringify(r.data)); const pid = r.data.id;
    r = await api('PUT', '/api/staff/sesion', { fecha: L2, hora: 10, profesor_id: pid }, admin); assert.equal(r.status, 200, JSON.stringify(r.data));
    r = await api('GET', '/api/staff/agenda?desde=' + L2, undefined, admin); assert.equal(r.data.dias[0].clases.find(c => c.hora === 10).profesor.id, pid); paso('se asigna el profesor de cada clase de la semana');
    r = await api('GET', '/api/staff/agenda?desde=' + L3, undefined, admin); assert.ok(!r.data.dias[0].clases.find(c => c.hora === 10).profesor); paso('el profesor de una semana no pasa solo a la otra');
    r = await api('POST', '/api/staff/copiar', { semana: L3 }, admin); assert.equal(r.data.asignados >= 1, true);
    r = await api('GET', '/api/staff/agenda?desde=' + L3, undefined, admin); assert.equal(r.data.dias[0].clases.find(c => c.hora === 10).profesor.id, pid); paso('“Copiar staff semana anterior” replica los profesores');

    console.log('Formatos e Intervalos por semana');
    const cuerpo = (extra) => fm.map(f => ({ id: f.id, trabajo_seg: 40, descanso_seg: 20, sin_trabajo: f.sin_trabajo ? 1 : 0, ...(f.id === fun.id ? extra : {}) }));
    r = await api('PUT', '/api/formatos-semana', { semana: L2, formatos: cuerpo({ estaciones: 4, patrones: [], capacidades: ['fuerza'], energias: ['anaerobico'] }) }, admin); assert.equal(r.status, 400); paso('cada grupo de estímulos necesita al menos una opción');
    r = await api('PUT', '/api/formatos-semana', { semana: L2, formatos: cuerpo({ estaciones: 4, rondas: 3, patrones: ['empujar', 'tirar'], capacidades: ['fuerza', 'core'], energias: ['anaerobico'] }) }, admin); assert.equal(r.status, 200, JSON.stringify(r.data));
    r = await api('GET', '/api/formatos-semana?semana=' + L2, undefined, admin); let f2 = r.data.formatos.find(f => f.id === fun.id);
    assert.equal(r.data.origen, 'propia'); assert.equal(f2.estaciones, 4); assert.deepEqual(f2.patrones, ['empujar', 'tirar']); assert.deepEqual(f2.energias, ['anaerobico']); paso('estaciones y los tres grupos de estímulos se guardan por formato y por semana');
    r = await api('GET', '/api/formatos-semana?semana=' + L3, undefined, admin); assert.equal(r.data.origen, 'heredada'); assert.equal(r.data.formatos.find(f => f.id === fun.id).estaciones, 4);
    r = await api('PUT', '/api/formatos-semana', { semana: L3, formatos: cuerpo({ estaciones: 6, patrones: ['sentadilla'], capacidades: ['fuerza'], energias: ['aerobico'] }) }, admin);
    r = await api('GET', '/api/formatos-semana?semana=' + L2, undefined, admin); assert.equal(r.data.formatos.find(f => f.id === fun.id).estaciones, 4); paso('cambiar los formatos de una semana no toca las demás');
    r = await api('POST', '/api/formatos-semana/copiar', { semana: L3 }, admin); r = await api('GET', '/api/formatos-semana?semana=' + L3, undefined, admin);
    assert.equal(r.data.formatos.find(f => f.id === fun.id).estaciones, 4); assert.deepEqual(r.data.formatos.find(f => f.id === fun.id).patrones, ['empujar', 'tirar']); paso('“Copiar formatos semana anterior” copia estaciones e intervalos y estímulos');

    console.log('Planificación semanal con IA');
    r = await api('GET', '/api/planificacion?desde=' + L2 + '&dias=7', undefined, admin); assert.equal(r.status, 200);
    const circ = r.data.flatMap(d => d.clases).filter(c => c.circuito && c.formato && c.formato.id === fun.id);
    assert.ok(circ.length >= 3, 'circuitos: ' + circ.length); paso('al guardar agenda y formatos se arman solos los circuitos de la semana');
    const unicos = new Map(circ.map(c => [c.circuito.id, c.circuito]));
    for (const c of unicos.values()) assert.equal(c.rondas[0].ejercicios.length, 4);
    paso('cada circuito tiene tantas estaciones como el formato de la semana (4)');
    const permitidas = new Set(['Empujar (Push)', 'Tirar / Traccionar (Pull)']);
    const dias = { 'Empujar (Push)': 0, 'Tirar / Traccionar (Pull)': 0 };
    for (const c of unicos.values()) { const vistas = new Set(c.rondas[0].ejercicios.map(e => e.zona)); for (const z of vistas) assert.ok(permitidas.has(z) || true); for (const z of Object.keys(dias)) if (vistas.has(z)) dias[z]++; }
    assert.ok(dias['Empujar (Push)'] >= 2 && dias['Tirar / Traccionar (Pull)'] >= 2, JSON.stringify(dias)); paso('cada patrón elegido se entrena en al menos 2 de los 3 días (frecuencia 2)');
    const fuera = [...unicos.values()].flatMap(c => c.rondas[0].ejercicios).filter(e => e.zona && !permitidas.has(e.zona));
    assert.equal(fuera.length, 0, 'ejercicios fuera de los patrones del formato: ' + fuera.map(e => e.zona).join(',')); paso('los ejercicios respetan los patrones elegidos para el formato');
    const c0 = circ[0].circuito;
    r = await api('GET', '/api/planificacion/circuito/' + c0.id, undefined, admin); const ex = r.data.rondas[0].ejercicios; assert.ok(ex.every(e => e.nombre));
    r = await api('PUT', '/api/formatos-semana', { semana: L2, formatos: cuerpo({ estaciones: 5, patrones: ['empujar', 'tirar'], capacidades: ['fuerza'], energias: ['anaerobico'] }) }, admin);
    r = await api('GET', '/api/planificacion?desde=' + L2 + '&dias=7', undefined, admin);
    const circ2 = r.data.flatMap(d => d.clases).filter(c => c.circuito && c.formato && c.formato.id === fun.id); assert.equal(circ2[0].circuito.rondas[0].ejercicios.length, 5); paso('cambiar las estaciones rehace los circuitos y llega a la app del cliente');
    r = await api('GET', '/api/clase?fecha=' + L2, undefined, admin); assert.ok(r.data.clases.find(c => c.formato && c.formato.id === fun.id)); paso('la clase del cliente sigue disponible tras el cambio');

    console.log('Biblioteca: alta con estímulos');
    r = await api('POST', '/api/ejercicios', { zona: 'Rotación y anti-rotación', nombre: 'Leñador de prueba', prog2: 'Leñador con pausa', prog3: 'Leñador con pesa', equipo: 'ninguno', patron: 'ruso', intensidad: 'moderada', capacidades: ['core', 'fuerza'], energias: ['anaerobico'] }, admin); assert.equal(r.status, 200, JSON.stringify(r.data));
    r = await api('GET', '/api/ejercicios', undefined, admin); const nuevo = r.data.find(e => e.nombre === 'Leñador de prueba'); assert.equal(nuevo.capacidad, 'core,fuerza'); assert.equal(nuevo.energia, 'anaerobico'); paso('un ejercicio nuevo guarda su patrón, capacidades y sistema energético');
    r = await api('POST', '/api/ejercicios', { zona: 'Pecho', nombre: 'x', prog2: 'y', prog3: 'z', equipo: 'ninguno', patron: 'flexion', intensidad: 'baja' }, admin); assert.equal(r.status, 400); paso('las zonas antiguas ya no se aceptan');

    console.log('\nTodo OK: ' + ok + ' verificaciones de la Versión 6');
  } catch (e) { console.error('\n✗ FALLÓ:', e.message); console.error(e.stack); console.error('--- log ---\n' + log.slice(-1500)); process.exitCode = 1; }
  finally { srv.kill(); fs.rmSync(D, { recursive: true, force: true }); }
})();
