'use strict';
// Pruebas de la Versión 1: caja, CRM, planes, agenda del staff, marca, equipamiento y sincronización PC <-> nube.
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');

const P1 = 3800 + Math.floor(Math.random() * 400), P2 = P1 + 500;
const D1 = fs.mkdtempSync(path.join(os.tmpdir(), 'omega-pc-')), D2 = fs.mkdtempSync(path.join(os.tmpdir(), 'omega-nube-'));
const PC = 'http://127.0.0.1:' + P1, NUBE = 'http://127.0.0.1:' + P2, CLAVE = 'clave-de-prueba-123';
let ok = 0; const paso = (n) => { ok++; console.log('  ✓ ' + n); };
const hoy = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
async function api(base, metodo, ruta, cuerpo, token) {
  const r = await fetch(base + ruta, { method: metodo, headers: { ...(cuerpo !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined });
  const t = await r.text(); let j; try { j = JSON.parse(t); } catch (_) { j = t; } return { status: r.status, data: j };
}
const procs = [];
function lanzar(puerto, datos, env) {
  const p = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', path.join(__dirname, '..', 'server.js')], { env: { ...process.env, PORT: puerto, DATA_DIR: datos, HOST: '127.0.0.1', ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  p.log = ''; p.stdout.on('data', d => p.log += d); p.stderr.on('data', d => p.log += d); procs.push(p); return p;
}
async function esperar(base) { for (let i = 0; i < 60; i++) { try { await fetch(base + '/api/estado'); return; } catch (_) { await new Promise(r => setTimeout(r, 100)); } } throw new Error('no arrancó ' + base); }

(async () => {
  let nubeProc = lanzar(P2, D2, { OMEGA_NODO: 'nube', SYNC_CLAVE: CLAVE });
  const pcProc = lanzar(P1, D1, { NUBE_URL: NUBE, NUBE_CLAVE: CLAVE });
  try {
    await esperar(PC); await esperar(NUBE);
    console.log('Nube vacía');
    let r = await api(NUBE, 'GET', '/api/estado'); assert.equal(r.data.esperando_sync, true); paso('la nube arranca vacía y espera a la PC');
    r = await api(NUBE, 'POST', '/api/setup', { username: 'x', password: 'Omega#2026' }); assert.equal(r.status, 403); paso('la nube no permite crear el administrador (se hace en la PC)');
    r = await api(NUBE, 'POST', '/api/sync', { epoch: 'x', cambios: [] }); assert.equal(r.status, 401); paso('la nube rechaza pedidos de sincronización sin firma');

    console.log('Alta, planes y cobros');
    r = await api(PC, 'POST', '/api/setup', { username: 'dueno', password: 'Omega#2026', nombre: 'Dueño' }); const admin = r.data.token;
    r = await api(PC, 'POST', '/api/usuarios', { username: 'prof1', password: 'profe123', rol: 'profesor', nombre: 'Profe Uno' }, admin);
    r = await api(PC, 'POST', '/api/login', { username: 'prof1', password: 'profe123' }); const prof = r.data.token; const profId = r.data.usuario.id;
    r = await api(PC, 'POST', '/api/usuarios', { rol: 'profesor', nombre: 'Sin permisos', username: 'sinperm', password: 'sinperm123', permisos: [] }, admin); assert.equal(r.status, 200); r = await api(PC, 'POST', '/api/login', { username: 'sinperm', password: 'sinperm123' }); const profSin = r.data.token;
    r = await api(PC, 'GET', '/api/planes', undefined, admin); assert.equal(r.data.length, 1); const plan = r.data[0]; paso('existe un plan inicial');
    r = await api(PC, 'PUT', '/api/planes/' + plan.id, { precio_efectivo: 30000, precio_mp: 33000 }, admin); assert.equal(r.status, 200);
    r = await api(PC, 'POST', '/api/planes', { nombre: 'Plan trimestral', precio_efectivo: 80000, precio_mp: 88000 }, admin); assert.equal(r.status, 200); paso('el dueño edita precios de planes (efectivo vs Mercado Pago)');
    r = await api(PC, 'GET', '/api/planes', undefined, profSin); assert.equal(r.status, 403); paso('el profesor no ve los planes ni precios');
    r = await api(PC, 'POST', '/api/clientes', { nombre: 'María Pérez', celular: '11-5555-0001', plan_id: plan.id, precio_plan: 30000 }, admin);
    assert.equal(r.data.acceso.usuario, 'maria.perez'); assert.equal(r.data.acceso.clave, '12345678'); const maria = r.data.id; paso('usuario nombre.apellido = maria.perez y clave 12345678');
    r = await api(PC, 'POST', '/api/clientes', { nombre: 'María Pérez', celular: '11-5555-0002' }, admin); assert.equal(r.data.acceso.usuario, 'maria.perez2'); paso('si el usuario existe se agrega un número');
    r = await api(PC, 'POST', '/api/clientes/' + maria + '/renovar', { meses: 1 }, admin); assert.equal(r.status, 400); paso('renovar exige método de pago');
    r = await api(PC, 'POST', '/api/clientes/' + maria + '/renovar', { meses: 1, metodo_pago: 'efectivo' }, admin); assert.equal(r.data.monto, 30000); assert.equal(r.data.a_caja, true); paso('renovación en efectivo toma el precio efectivo del plan y va a la caja');
    r = await api(PC, 'POST', '/api/clientes/' + maria + '/renovar', { meses: 1, metodo_pago: 'mercadopago' }, admin); assert.equal(r.data.monto, 33000); assert.equal(r.data.a_caja, false); paso('renovación en Mercado Pago toma el precio MP y no toca la caja');

    console.log('Caja diaria');
    r = await api(PC, 'GET', '/api/caja', undefined, admin);
    assert.equal(r.data.total_ingresos, 30000); assert.equal(r.data.ingresos.length, 1); assert.equal(r.data.saldo_inicial, 0); paso('la caja muestra solo el efectivo (MP no aparece)');
    r = await api(PC, 'PUT', '/api/caja/saldo-inicial', { fecha: hoy(), monto: 5000 }, admin); assert.equal(r.data.saldo_final, 35000); paso('saldo inicial editable');
    r = await api(PC, 'POST', '/api/caja/movimiento', { tipo: 'egreso', concepto: 'Artículos de limpieza', monto: 4000 }, admin); const mov = r.data.id;
    r = await api(PC, 'POST', '/api/caja/movimiento', { tipo: 'ingreso', concepto: 'Venta de agua', monto: 1500 }, admin);
    r = await api(PC, 'GET', '/api/caja', undefined, admin); assert.equal(r.data.saldo_final, 5000 + 30000 + 1500 - 4000); paso('saldo final = inicial + ingresos − egresos (' + r.data.saldo_final + ')');
    r = await api(PC, 'DELETE', '/api/caja/movimiento/' + r.data.ingresos[0].id, undefined, admin); assert.equal(r.status, 400); paso('las cuotas en efectivo no se borran desde la caja');
    r = await api(PC, 'DELETE', '/api/caja/movimiento/' + mov, undefined, admin); assert.equal(r.status, 200);
    r = await api(PC, 'GET', '/api/caja?fecha=' + new Date(Date.parse(hoy()) + 86400000).toISOString().slice(0, 10), undefined, admin); assert.equal(r.data.saldo_inicial, 36500); paso('el saldo final de hoy pasa como saldo inicial de mañana');
    r = await api(PC, 'GET', '/api/caja', undefined, profSin); assert.equal(r.status, 403); paso('un profesor sin permiso de caja no accede a la caja');

    console.log('CRM de visitas');
    r = await api(PC, 'POST', '/api/leads', { nombre: 'Juan Visita', telefono: '11-6000-0001', redes: '@juanv', objetivo: 'Bajar de peso', profesor_id: profId }, prof); assert.equal(r.status, 200);
    r = await api(PC, 'POST', '/api/publico/visita', { nombre: 'Lucía Torres', telefono: '11 6000 0002', redes: '@lu', objetivo: 'Tonificar', profesor_id: profId }); assert.equal(r.status, 200); paso('el visitante carga sus datos desde el formulario público (QR)');
    r = await api(PC, 'POST', '/api/publico/visita', { nombre: 'X', telefono: '1' }); assert.equal(r.status, 400); paso('el formulario público valida los datos');
    r = await api(PC, 'GET', '/api/leads', undefined, prof); assert.equal(r.data.kpis.visitantes, 2); assert.equal(r.data.kpis.convertidos, 0); paso('KPI: 2 visitantes del mes, 0% de conversión');
    r = await api(PC, 'POST', '/api/clientes', { nombre: 'Juan Visita', celular: '11-6000-0001', plan_id: plan.id, precio_plan: 30000, metodo_pago: 'efectivo' }, admin); assert.equal(r.status, 200);
    r = await api(PC, 'GET', '/api/leads', undefined, admin);
    assert.equal(r.data.kpis.convertidos, 1); assert.equal(r.data.kpis.tasa_conversion, 50); const pp = r.data.por_profesor.find(x => x.profesor_id === profId); assert.equal(pp.convertidos, 1); assert.equal(pp.visitas, 2); paso('al pagar el abono la visita se convierte: 50% y efectividad por profesor');
    r = await api(PC, 'GET', '/api/caja', undefined, admin); assert.equal(r.data.ingresos.length, 3); paso('el alta con pago en efectivo también entra a la caja');

    console.log('Biblioteca, equipamiento y agenda del staff');
    r = await api(PC, 'POST', '/api/ejercicios', { zona: 'Empujar (Push)', nombre: 'Press Arnold propio', prog2: 'Arnold lento', prog3: 'Arnold sentado con pausa', equipo: 'ninguno', patron: 'press_vert', img1: 'data:image/png;base64,iVBORw0KGgo=', img2: 'data:image/png;base64,iVBORw0KGgo=', img3: 'data:image/png;base64,iVBORw0KGgo=' }, prof); assert.equal(r.status, 200); const ejId = r.data.id; paso('el profesor agrega un ejercicio nuevo con 3 imágenes');
    r = await api(PC, 'GET', '/api/ejercicios/' + ejId, undefined, prof); assert.ok(r.data.img1 && r.data.img3); paso('la ficha del ejercicio devuelve las 3 posiciones');
    r = await api(PC, 'PUT', '/api/ejercicios/' + ejId, { nombre: 'Press Arnold editado', prog2: 'Arnold muy lento' }, prof); assert.equal(r.status, 200);
    r = await api(PC, 'GET', '/api/ejercicios?zona=' + encodeURIComponent('Empujar (Push)'), undefined, prof); assert.ok(r.data.find(e => e.nombre === 'Press Arnold editado' && e.foto1)); assert.ok(r.data.length > 50); paso('el ejercicio se edita (nombre, progresiones, equipamiento)');
    r = await api(PC, 'POST', '/api/ejercicios', { zona: 'Empujar (Push)', nombre: 'Malo', prog2: 'a', prog3: 'b', img1: 'data:text/html;base64,AAAA' }, prof); assert.equal(r.status, 400); paso('rechaza imágenes que no son imágenes');
    r = await api(PC, 'POST', '/api/equipamiento', { nombre: 'Cintas TRX', cantidad: 8 }, admin); assert.equal(r.status, 200); const claveEq = r.data.clave; assert.ok(r.data.sugerencias >= 5); paso('alta de equipamiento "Cintas TRX": ' + r.data.sugerencias + ' ejercicios sugeridos');
    r = await api(PC, 'GET', '/api/sugerencias', undefined, admin); assert.ok(r.data.every(s => s.equipo_clave === claveEq)); const s0 = r.data[0];
    r = await api(PC, 'POST', '/api/sugerencias/' + s0.id + '/aceptar', {}, admin); assert.equal(r.status, 200);
    r = await api(PC, 'GET', '/api/ejercicios?zona=' + encodeURIComponent(s0.zona), undefined, admin); assert.ok(r.data.find(e => e.nombre === s0.nombre && e.equipo === claveEq)); paso('al aceptar una sugerencia entra a la biblioteca con ese equipamiento');
    r = await api(PC, 'PUT', '/api/equipamiento/' + claveEq, { cantidad: 12 }, admin); assert.equal(r.status, 200);
    r = await api(PC, 'GET', '/api/equipamiento', undefined, admin); assert.equal(r.data.find(e => e.clave === claveEq).cantidad, 12); paso('se actualiza la cantidad de equipamiento');
    r = await api(PC, 'GET', '/api/agenda', undefined, admin); const celda = r.data.find(c => c.dia === 2 && c.formato_id);
    r = await api(PC, 'PUT', '/api/staff/agenda', { celdas: [{ dia: celda.dia, hora: celda.hora, profesor_id: profId }] }, admin); assert.equal(r.status, 200);
    r = await api(PC, 'GET', '/api/staff/agenda', undefined, prof); const martes = r.data.dias.find(d => d.dia === 2); assert.equal(martes.clases.find(c => c.hora === celda.hora).profesor.id, profId); paso('Agenda Staff: cada clase muestra su profesor');
    r = await api(PC, 'GET', '/api/staff/mis-turnos', undefined, prof); assert.ok(r.data.turnos.length >= 2); paso('el profesor ve sus turnos de las próximas 2 semanas (' + r.data.turnos.length + ')');
    r = await api(PC, 'PUT', '/api/staff/agenda', { celdas: [] }, profSin); assert.equal(r.status, 403); paso('solo el dueño asigna profesores');

    console.log('Finanzas: análisis y proyección');
    r = await api(PC, 'POST', '/api/finanzas', { tipo: 'egreso', categoria: 'Alquiler', monto: 200000, fecha: hoy(), fijo: true }, admin);
    r = await api(PC, 'POST', '/api/finanzas', { tipo: 'egreso', categoria: 'Luz', monto: 30000, fecha: hoy(), fijo: true }, admin);
    r = await api(PC, 'GET', '/api/finanzas/analisis', undefined, admin); assert.equal(r.data.tickets.alumnos, 2); assert.ok(r.data.tickets.precio_promedio > 0); assert.ok(r.data.tickets.percentiles.p50 > 0); paso('análisis: precio promedio pagado ' + r.data.tickets.precio_promedio + ' y percentiles');
    r = await api(PC, 'GET', '/api/finanzas/base-proyeccion', undefined, admin); assert.equal(r.data.alumnos_activos, 3); assert.ok(r.data.gastos_fijos >= 230000); assert.equal(r.data.grupos.luz, 30000); paso('base del simulador: fijos ' + r.data.gastos_fijos + ' (luz y alquiler separados)');

    console.log('Marca blanca');
    r = await api(PC, 'PUT', '/api/marca', { nombre: 'Gym Prueba', fuente: 'Oswald', logo: 'data:image/png;base64,iVBORw0KGgo=' }, admin); assert.equal(r.data.nombre, 'Gym Prueba');
    r = await api(PC, 'GET', '/api/marca'); assert.equal(r.data.fuente, 'Oswald'); assert.ok(r.data.logo); paso('nombre, tipografía y logo del gimnasio (público para el login)');
    r = await api(PC, 'PUT', '/api/marca', { fuente: 'Comic Sans' }, admin); assert.equal(r.status, 400);
    r = await api(PC, 'PUT', '/api/marca', { nombre: 'x' }, prof); assert.equal(r.status, 403); paso('solo el dueño cambia la marca');

    console.log('Planificación anticipada');
    r = await api(PC, 'GET', '/api/formatos', undefined, admin);
    await api(PC, 'PUT', '/api/formatos', { formatos: r.data.map((f, i) => ({ id: f.id, trabajo_seg: 30, descanso_seg: 15 })) }, admin);
    const lun = (() => { const d = new Date(hoy() + 'T00:00:00Z'); return new Date(d - ((d.getUTCDay() + 6) % 7) * 86400000).toISOString().slice(0, 10); })();
    r = await api(PC, 'POST', '/api/planificacion/generar', { desde: lun, dias: 14 }, admin); assert.equal(r.status, 200);
    r = await api(PC, 'GET', '/api/grilla?desde=' + lun, undefined, admin);
    const conProf = r.data.flatMap(d => d.clases).find(c => c.profesor); assert.ok(conProf); paso('la grilla semanal de la app incluye horarios y profesor');

    console.log('Sincronización PC → nube');
    r = await api(PC, 'GET', '/api/sync/estado', undefined, admin); assert.equal(r.data.configurado, true); assert.ok(r.data.pendientes > 0);
    r = await api(PC, 'POST', '/api/sync/ahora', {}, admin); assert.equal(r.data.ok, true, JSON.stringify(r.data)); assert.equal(r.data.repoblada, true); paso('primer sincronizado: la PC carga toda la base en la nube (' + r.data.enviados + ' registros)');
    r = await api(NUBE, 'GET', '/api/estado'); assert.equal(r.data.configurada, true);
    r = await api(NUBE, 'POST', '/api/login', { username: 'maria.perez', password: '12345678' }); assert.equal(r.status, 200); const tMariaNube = r.data.token; paso('la alumna ingresa en la app web con maria.perez / 12345678');
    r = await api(NUBE, 'GET', '/api/grilla?desde=' + lun, undefined, tMariaNube); assert.ok(r.data.flatMap(d => d.clases).length > 10); paso('el alumno ve todas las clases de la semana desde la nube');
    r = await api(NUBE, 'GET', '/api/marca'); assert.equal(r.data.nombre, 'Gym Prueba'); paso('la nube muestra la marca del gimnasio');
    r = await api(NUBE, 'GET', '/api/ejercicios', undefined, tMariaNube); assert.equal(r.status, 403);
    r = await api(NUBE, 'GET', '/api/finanzas', undefined, tMariaNube); assert.equal(r.status, 403); paso('el alumno no ve ejercicios ni finanzas');
    r = await api(NUBE, 'GET', '/api/mi-qr', undefined, tMariaNube); assert.equal(r.status, 200); const codigo = r.data.codigo;
    r = await api(PC, 'POST', '/api/asistencias/qr', { codigo, hora: 10 }, prof); assert.equal(r.status, 200); paso('el QR generado en la nube lo valida la PC del gimnasio');

    console.log('Sincronización nube → PC');
    r = await api(NUBE, 'POST', '/api/publico/visita', { nombre: 'Pedro Web', telefono: '11-7000-0000', objetivo: 'Ganar fuerza' }); assert.equal(r.status, 200);
    r = await api(PC, 'POST', '/api/sync/ahora', {}, admin); assert.equal(r.data.ok, true, JSON.stringify(r.data));
    r = await api(PC, 'GET', '/api/leads', undefined, admin); assert.ok(r.data.leads.find(l => l.nombre === 'Pedro Web' && l.origen === 'qr')); paso('una visita que llega por el QR a la nube aparece en la PC');
    await api(PC, 'PUT', '/api/ejercicios/' + ejId, { nombre: 'Press Arnold v2' }, admin);
    await api(PC, 'POST', '/api/sync/ahora', {}, admin);
    r = await api(NUBE, 'POST', '/api/login', { username: 'prof1', password: 'profe123' }); const tProfNube = r.data.token;
    r = await api(NUBE, 'GET', '/api/ejercicios/' + ejId, undefined, tProfNube); assert.equal(r.data.nombre, 'Press Arnold v2'); paso('los cambios de la PC llegan a la nube (ejercicio editado)');
    r = await api(NUBE, 'GET', '/api/leads', undefined, tProfNube); assert.equal(r.status, 200);

    console.log('La nube pierde sus datos (plan gratuito)');
    nubeProc.kill(); await new Promise(r => setTimeout(r, 400));
    fs.rmSync(D2, { recursive: true, force: true }); fs.mkdirSync(D2, { recursive: true });
    nubeProc = lanzar(P2, D2, { OMEGA_NODO: 'nube', SYNC_CLAVE: CLAVE }); await esperar(NUBE);
    r = await api(NUBE, 'GET', '/api/estado'); assert.equal(r.data.esperando_sync, true);
    r = await api(PC, 'POST', '/api/sync/ahora', {}, admin); assert.equal(r.data.ok, true, JSON.stringify(r.data)); assert.equal(r.data.repoblada, true); paso('la PC detecta la nube vacía y la repuebla sola');
    r = await api(NUBE, 'POST', '/api/login', { username: 'maria.perez', password: '12345678' }); assert.equal(r.status, 200); paso('después del reinicio todo vuelve a funcionar (usuarios, clases, marca)');
    r = await api(PC, 'GET', '/api/caja', undefined, admin); assert.equal(r.data.ingresos.length, 3); paso('la PC conserva todos sus datos');

    console.log('\nTodo OK: ' + ok + ' verificaciones de la Versión 1');
  } catch (e) {
    console.error('\n✗ FALLÓ:', e.message); console.error(e.stack.split('\n').slice(1, 4).join('\n'));
    console.error('--- PC ---\n' + pcProc.log.slice(-1200) + '\n--- NUBE ---\n' + nubeProc.log.slice(-1200)); process.exitCode = 1;
  } finally { procs.forEach(p => p.kill()); setTimeout(() => { for (const d of [D1, D2]) fs.rmSync(d, { recursive: true, force: true }); process.exit(process.exitCode || 0); }, 400); }
})();
