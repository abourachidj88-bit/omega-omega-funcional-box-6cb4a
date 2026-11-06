'use strict';
// Pruebas de la Versión 9: validación del Excel de clientes (formato y fila del error), importador de rutinas,
// diseñador de posiciones (datos) y colores por patrón.
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');

const P = 6700 + Math.floor(Math.random() * 400);
const D = fs.mkdtempSync(path.join(os.tmpdir(), 'omega-v9-'));
const BASE = 'http://127.0.0.1:' + P;
let ok = 0; const paso = (n) => { ok++; console.log('  ✓ ' + n); };
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
    r = await api('GET', '/api/estado'); assert.match(r.data.version, /Versión \d+/); paso('la app informa su versión');

    console.log('Clientes: validación del archivo');
    r = await api('POST', '/api/planes', { nombre: 'Libre', precio_efectivo: 40000, precio_mp: 44000 }, admin); assert.equal(r.status, 200, JSON.stringify(r.data));
    const malas = [
      { fila: 2, nombre: 'Ana Gómez', plan: 'Libre', fecha_alta: '05/11/2026', fecha_baja: '05/12/2026', celular: '11 5555-1234', instagram: '@ana.g' },   // ok
      { fila: 3, nombre: '', celular: '1155550000' },                                                  // sin nombre
      { fila: 4, nombre: 'Beto Díaz', fecha_alta: '31/02/2026' },                                      // fecha inexistente
      { fila: 5, nombre: 'Carla Paz', fecha_alta: '3/13/2026' },                                       // formato
      { fila: 6, nombre: 'Dani Ruiz', fecha_alta: '2026-11-05x' },                                      // formato
      { fila: 7, nombre: 'Eli Soto', plan: 'Premium', celular: '1144443333' },                          // plan que no existe
      { fila: 8, nombre: 'Fede Luna', celular: '11-abc-444' },                                         // celular con letras
      { fila: 9, nombre: 'Gabi Rey', fecha_alta: '10/11/2026', fecha_baja: '09/11/2026' },              // baja anterior al alta
    ];
    r = await api('POST', '/api/clientes/importar/validar', { filas: malas }, admin); assert.equal(r.status, 200);
    assert.equal(r.data.errores.length, 7, JSON.stringify(r.data.errores));
    const txt = r.data.errores.join('\n');
    for (const f of [3, 4, 5, 6, 7, 8, 9]) if (f !== 6 || true) assert.match(txt, new RegExp('Fila ' + f + ' ·'), 'falta la fila ' + f + ':\n' + txt);
    assert.doesNotMatch(txt, /Fila 2 ·/); paso('indica en qué fila y en qué columna está cada error (nombre, fechas, plan, celular, baja < alta)');
    r = await api('POST', '/api/clientes/importar', { filas: malas }, admin);
    assert.equal(r.data.rechazado, true); assert.equal(r.data.errores.length, 7);
    r = await api('GET', '/api/clientes', undefined, admin); assert.equal(r.data.length, 0); paso('con errores no se importa ni una fila');

    const buenas = [
      { fila: 2, nombre: 'Ana Gómez', plan: 'Libre', fecha_alta: '05/11/2026', fecha_baja: '05/12/2026', celular: '+54 11 (5555) 1234', instagram: '@ana.g' },
      { fila: 3, nombre: 'Beto Díaz', celular: 1155550002 },
      { fila: 4, nombre: 'ana gomez', celular: '1155551234' },        // repetida de la fila 2
      { fila: 5, nombre: 'Carla Paz!', instagram: 'carla_#1 ✨' },     // símbolos libres en nombre/instagram
    ];
    r = await api('POST', '/api/clientes/importar/validar', { filas: buenas }, admin); assert.equal(r.data.errores.length, 0, JSON.stringify(r.data)); assert.equal(r.data.duplicadas.length, 1); assert.equal(r.data.duplicadas[0].fila, 4); assert.equal(r.data.duplicadas[0].de, 2); paso('detecta la fila repetida dentro del archivo');
    r = await api('POST', '/api/clientes/importar', { filas: buenas }, admin); assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.equal(r.data.creados, 3); assert.equal(r.data.duplicadas.length, 1); assert.equal(r.data.errores.length, 0); paso('se carga una sola vez cada persona y se informa la repetida');
    r = await api('GET', '/api/clientes', undefined, admin); const ana = r.data.find(c => c.nombre === 'Ana Gómez'); assert.ok(ana); assert.equal(r.data.length, 3);
    r = await api('GET', '/api/clientes/' + ana.id, undefined, admin);
    assert.equal(r.data.fecha_alta, '2026-11-05'); assert.equal(r.data.fecha_baja, '2026-12-05'); assert.match(r.data.celular.replace(/\D/g, ''), /1155551234$/); assert.equal(r.data.instagram, 'ana.g'); paso('las fechas DD/MM/AAAA y el celular con separadores se guardan bien');

    console.log('Rutinas: importador');
    r = await api('GET', '/api/ejercicios', undefined, admin); const todos = r.data;
    const z1 = todos[0].zona, e1 = todos.filter(e => e.zona === z1).slice(0, 2);
    const z2 = todos.find(e => e.zona !== z1).zona, e2 = todos.find(e => e.zona === z2);
    const fila = (n, rutina, patron, ejercicio, extra) => ({ fila: n, rutina, patron, ejercicio, series: 3, repeticiones: 10, peso: '', descanso: 60, seg_serie: 40, ...extra });
    let filasR = [
      fila(2, 'Full body A', z1, e1[0].nombre, { descripcion: 'Rutina base' }),
      fila(3, 'Full body A', z1, e1[1].nombre, { peso: 20 }),
      fila(4, 'Full body A', z2, e2.nombre, { peso: 0, descanso: 0, seg_serie: 0 }),
      fila(5, 'Solo core', z2, e2.nombre, { series: 99, repeticiones: 99, peso: 999, descanso: 0, seg_serie: 1 }),
      fila(6, 'Solo core', z2, e2.nombre, { series: 1, repeticiones: 1, peso: 1, descanso: 999, seg_serie: 999 }),
    ];
    r = await api('POST', '/api/rutinas/importar/validar', { filas: filasR }, admin); assert.equal(r.status, 200); assert.equal(r.data.errores.length, 0, JSON.stringify(r.data.errores)); assert.equal(r.data.rutinas, 2); paso('el archivo correcto agrupa las filas por nombre de rutina (límites 99 / 999 aceptados)');
    r = await api('POST', '/api/rutinas/importar/validar', { filas: [fila(2, 'Eterna', z1, e1[0].nombre, { series: 99, seg_serie: 999 })] }, admin); assert.match(r.data.errores.join(), /dura \d+ minutos y el máximo es 180/); paso('avisa antes de importar si una rutina supera los 180 minutos');
    const malasR = [
      fila(2, '', z1, e1[0].nombre),                                        // sin nombre
      fila(3, 'X', 'Patrón inventado', e1[0].nombre),                       // patrón
      fila(4, 'X', z1, 'Ejercicio inexistente'),                            // ejercicio
      fila(5, 'X', z1, e2.nombre),                                          // ejercicio de otro patrón
      fila(6, 'X', z1, e1[0].nombre, { series: 0 }),                        // series fuera de rango
      fila(7, 'X', z1, e1[0].nombre, { series: 100 }),
      fila(8, 'X', z1, e1[0].nombre, { repeticiones: 'diez' }),
      fila(9, 'X', z1, e1[0].nombre, { peso: 1000 }),
      fila(10, 'X', z1, e1[0].nombre, { descanso: 1000 }),
      fila(11, 'X', z1, e1[0].nombre, { seg_serie: -5 }),
      fila(12, 'X', z1, e1[0].nombre, { series: 2.5 }),
    ];
    r = await api('POST', '/api/rutinas/importar/validar', { filas: malasR }, admin); const t2 = r.data.errores.join('\n');
    for (let f = 2; f <= 12; f++) assert.match(t2, new RegExp('Fila ' + f + ' ·'), 'falta la fila ' + f + '\n' + t2);
    assert.match(t2, /pertenece al patrón/); paso('marca la fila de cada error (nombre, patrón, ejercicio de otro patrón, series, repeticiones, peso, descanso, segundos)');
    r = await api('POST', '/api/rutinas/importar', { filas: malasR }, admin); assert.equal(r.data.rechazado, true);
    r = await api('GET', '/api/rutinas', undefined, admin); assert.equal(r.data.length, 0); paso('con errores no se crea ninguna rutina');
    r = await api('POST', '/api/rutinas/importar', { filas: filasR }, admin); assert.equal(r.status, 200, JSON.stringify(r.data)); assert.equal(r.data.creadas.length, 2); assert.equal(r.data.renombradas.length, 0);
    r = await api('GET', '/api/rutinas', undefined, admin); assert.equal(r.data.length, 2); const fb = r.data.find(x => x.nombre === 'Full body A'); assert.equal(fb.ejercicios, 3);
    r = await api('GET', '/api/rutinas/' + fb.id, undefined, admin); assert.equal(r.data.descripcion, 'Rutina base'); assert.equal(r.data.items[0].peso || '', ''); assert.equal(r.data.items[1].peso, '20'); assert.equal(r.data.items[2].descanso_seg, 0); assert.equal(r.data.items[2].seg_serie, 0); paso('la rutina importada conserva orden, descripción, peso corporal (vacío / 0) y descanso 0');
    r = await api('GET', '/api/rutinas', undefined, admin); const so = r.data.find(x => x.nombre === 'Solo core'); r = await api('GET', '/api/rutinas/' + so.id, undefined, admin); assert.equal(r.data.items[0].series, 99); assert.equal(r.data.items[0].repeticiones, '99'); assert.equal(r.data.items[0].peso, '999'); assert.equal(r.data.items[1].seg_serie, 999); assert.equal(r.data.items[1].descanso_seg, 999); paso('no se recortan series, descanso ni segundos hasta los máximos pedidos');
    r = await api('POST', '/api/rutinas/importar', { filas: [fila(2, 'Full body A', z1, e1[0].nombre), fila(3, 'Full body A', z1, e1[1].nombre)] }, admin);
    assert.equal(r.data.creadas.length, 1); assert.equal(r.data.renombradas.length, 1); assert.match(r.data.creadas[0].nombre, /^Full body A \(\d{2}\/\d{2}\/\d{4}\)$/);
    r = await api('GET', '/api/rutinas', undefined, admin); assert.equal(r.data.filter(x => /^Full body A/.test(x.nombre)).length, 2); paso('un nombre repetido se guarda como “Nombre (fecha de creación)” y no pisa la anterior');

    console.log('Biblioteca: posiciones dibujadas y colores');
    const pose = (t) => ({ t, a: [90, 90], a2: null, l: [90, 90], b: null, hx: 100, hy: 78, eq: [{ k: 'mancuerna', x: 100, y: 100, m: 1 }] });
    const poses = { v: 1, poses: [pose(-90), pose(-80), pose(-70)] };
    const png = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 160"><circle cx="5" cy="5" r="3"/></svg>').toString('base64');
    r = await api('POST', '/api/ejercicios', { zona: z1, nombre: 'Ejercicio dibujado', prog2: 'Más difícil', prog3: 'Aún más', equipo: 'ninguno', img1: png, img2: png, img3: png, poses }, admin);
    assert.equal(r.status, 200, JSON.stringify(r.data)); const eid = r.data.id;
    r = await api('GET', '/api/ejercicios/' + eid, undefined, admin); const guard = JSON.parse(r.data.poses); assert.equal(guard.poses.length, 3); assert.equal(guard.poses[0].eq[0].k, 'mancuerna'); assert.ok(r.data.img1.startsWith('data:image/svg+xml')); paso('el ejercicio guarda las 3 posiciones dibujadas, el equipamiento y sus imágenes');
    r = await api('POST', '/api/ejercicios', { zona: z1, nombre: 'Ejercicio roto', prog2: 'a', prog3: 'b', poses: { v: 1, poses: [pose(-90)] } }, admin); assert.equal(r.status, 400);
    r = await api('POST', '/api/ejercicios', { zona: z1, nombre: 'Equipo raro', prog2: 'a', prog3: 'b', poses: { v: 1, poses: [pose(1), pose(2), { ...pose(3), eq: [{ k: 'bomba', x: 1, y: 1 }] }] } }, admin); assert.equal(r.status, 400); paso('rechaza dibujos incompletos o con equipamiento inválido');
    r = await api('PUT', '/api/ejercicios/' + eid, { poses: { v: 1, poses: [pose(-60), pose(-50), pose(-40)] } }, admin); assert.equal(r.status, 200);
    r = await api('GET', '/api/ejercicios/' + eid, undefined, admin); assert.equal(JSON.parse(r.data.poses).poses[0].t, -60);
    r = await api('PUT', '/api/ejercicios/' + eid, { nombre: 'Ejercicio dibujado 2' }, admin); r = await api('GET', '/api/ejercicios/' + eid, undefined, admin); assert.equal(JSON.parse(r.data.poses).poses[0].t, -60); paso('se puede reeditar el dibujo, y editar otros datos no lo pierde');
    r = await api('PUT', '/api/ejercicios/' + eid, { poses: null, img1: null, img2: null, img3: null }, admin); r = await api('GET', '/api/ejercicios/' + eid, undefined, admin); assert.equal(r.data.poses, null); assert.equal(r.data.img1, null); paso('“Usar dibujo automático” borra el dibujo propio');

    r = await api('GET', '/api/patrones/colores', undefined, admin); assert.equal(r.data.length, 7); assert.ok(r.data.every(c => /^#[0-9a-f]{6}$/i.test(c.color)));
    r = await api('PUT', '/api/patrones/colores', { colores: [{ clave: 'empujar', color: '#112233' }] }, admin); assert.equal(r.data.find(c => c.clave === 'empujar').color, '#112233');
    r = await api('PUT', '/api/patrones/colores', { colores: [{ clave: 'empujar', color: 'rojo' }] }, admin); assert.equal(r.status, 400); paso('cada patrón de movimiento tiene su color configurable (por defecto ya trae uno)');

    console.log('\nTodo OK: ' + ok + ' verificaciones de la Versión 9');
    srv.kill(); process.exit(0);
  } catch (e) { console.error('\n✗ FALLÓ:', e.message, '\n', e.stack.split('\n').slice(1, 3).join('\n'), '\n--- log ---\n' + log.slice(-1500)); srv.kill(); process.exit(1); }
})();
