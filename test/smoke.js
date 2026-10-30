'use strict';
// Prueba de humo de punta a punta: levanta el servidor con una base temporal y recorre los 5 módulos.
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');

const PORT = 3200 + Math.floor(Math.random() * 500);
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'omega-'));
const BASE = 'http://127.0.0.1:' + PORT;
let ok = 0;
const paso = (n) => { ok++; console.log('  ✓ ' + n); };

async function api(metodo, ruta, cuerpo, token, extra = {}) {
  const r = await fetch(BASE + ruta, { method: metodo, headers: { ...(cuerpo !== undefined && !extra.raw ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(extra.headers || {}) }, body: extra.raw ? cuerpo : cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined });
  const t = await r.text(); let j; try { j = JSON.parse(t); } catch (_) { j = t; }
  return { status: r.status, data: j };
}
const hoy = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
const suma = (f, n) => new Date(Date.parse(f + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const lunesSemana = () => { const d = new Date(hoy() + 'T00:00:00Z'); return suma(hoy(), -((d.getUTCDay() + 6) % 7)); };

(async () => {
  const srv = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', path.join(__dirname, '..', 'server.js')], { env: { ...process.env, PORT, DATA_DIR: DATA, HOST: '127.0.0.1' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; srv.stdout.on('data', d => log += d); srv.stderr.on('data', d => log += d);
  try {
    for (let i = 0; i < 50; i++) { try { await fetch(BASE + '/api/estado'); break; } catch (_) { await new Promise(r => setTimeout(r, 100)); } }
    console.log('Módulo 1 – Usuarios');
    let r = await api('GET', '/api/estado'); assert.equal(r.data.configurada, false); paso('app sin configurar al primer arranque');
    r = await api('POST', '/api/setup', { username: 'dueno', password: 'corta' }); assert.equal(r.status, 400); paso('rechaza contraseña débil');
    r = await api('POST', '/api/setup', { username: 'dueno', password: 'Omega#2026', nombre: 'Dueño' }); assert.equal(r.status, 200);
    const admin = r.data.token; paso('el primer acceso crea al administrador');
    r = await api('POST', '/api/setup', { username: 'otro', password: 'Omega#2026' }); assert.equal(r.status, 409); paso('no permite un segundo setup');
    r = await api('POST', '/api/login', { username: 'dueno', password: 'mala' }); assert.equal(r.status, 401); paso('login con clave incorrecta falla');
    r = await api('POST', '/api/usuarios', { username: 'prof1', password: 'profe123', rol: 'profesor', nombre: 'Profe Uno' }, admin); assert.equal(r.status, 200);
    r = await api('POST', '/api/login', { username: 'prof1', password: 'profe123' }); assert.equal(r.status, 200);
    const prof = r.data.token; paso('crea profesor y el profesor ingresa');
    r = await api('GET', '/api/finanzas', undefined, prof); assert.equal(r.status, 403); paso('el profesor NO accede a finanzas');
    r = await api('GET', '/api/usuarios', undefined, prof); assert.equal(r.status, 403); paso('el profesor NO administra usuarios');

    console.log('Módulo 2 – Planificación');
    r = await api('GET', '/api/ejercicios', undefined, admin);
    const porZona = {}; r.data.forEach(e => porZona[e.zona] = (porZona[e.zona] || 0) + 1);
    assert.equal(Object.keys(porZona).length, 9); Object.values(porZona).forEach(n => assert.equal(n, 50)); paso('9 zonas (con Hombros y Glúteos) con 50 ejercicios y su progresión cada una (' + r.data.length + ' ejercicios)');
    r = await api('POST', '/api/planificacion/generar', { desde: lunesSemana(), dias: 7 }, admin); assert.equal(r.status, 409); assert.match(r.data.error, /intervalos/); paso('no planifica hasta configurar intervalos de trabajo/descanso');
    r = await api('GET', '/api/formatos', undefined, admin); const formatos = r.data; assert.equal(formatos.length, 6);
    r = await api('PUT', '/api/formatos', { formatos: formatos.map((f, i) => ({ id: f.id, trabajo_seg: 30 + i * 5, descanso_seg: 15 })) }, admin); assert.equal(r.status, 200); paso('el dueño carga trabajo y descanso de los 6 formatos');
    r = await api('POST', '/api/planificacion/generar', { desde: lunesSemana(), dias: 28 }, prof); assert.equal(r.status, 200); assert.ok(r.data.creados > 0); paso('genera 4 semanas de circuitos (' + r.data.creados + ' circuitos)');
    r = await api('GET', '/api/planificacion?desde=' + lunesSemana() + '&dias=1', undefined, prof);
    const clases = r.data[0].clases; assert.ok(clases.length >= 1);
    const c0 = clases.find(c => c.circuito).circuito; assert.equal(c0.rondas.length, 3); c0.rondas.forEach(x => assert.equal(x.ejercicios.length, 5));
    c0.rondas[0].ejercicios.forEach((e, i) => { assert.notEqual(e.nombre, c0.rondas[1].ejercicios[i].nombre); assert.notEqual(c0.rondas[1].ejercicios[i].nombre, c0.rondas[2].ejercicios[i].nombre); });
    paso('cada formato tiene 3 rounds × 5 ejercicios con progresión distinta en cada round');
    // equipamiento nunca supera el stock
    const stock = Object.fromEntries((await api('GET', '/api/equipamiento', undefined, admin)).data.map(e => [e.clave, e.cantidad]));
    const dias = (await api('GET', '/api/planificacion?desde=' + lunesSemana() + '&dias=14', undefined, admin)).data;
    let circuitos = 0, mayor = 0;
    for (const d of dias) for (const c of d.clases) if (c.circuito) { circuitos++; for (const q of c.circuito.equipos) if (q.clave !== 'ninguno') { assert.ok(q.necesita <= stock[q.clave], q.clave + ' ' + q.necesita + '>' + stock[q.clave] + ' ' + d.fecha); mayor = Math.max(mayor, q.necesita); } }
    paso('el equipamiento requerido nunca supera el stock (' + circuitos + ' circuitos revisados)');
    // rotación: un ejercicio no se repite en el mismo formato antes de 21 días
    const usos = {};
    const todas = (await api('GET', '/api/planificacion?desde=' + lunesSemana() + '&dias=14', undefined, admin)).data;
    const vistos = new Set(); let viol = 0;
    for (const d of todas) for (const c of d.clases) if (c.circuito && !vistos.has(c.circuito.id)) { vistos.add(c.circuito.id); for (const e of c.circuito.rondas[0].ejercicios) { const k = c.circuito.formato_id + ':' + e.ejercicio_id; if (usos[k] && Math.abs((Date.parse(d.fecha) - Date.parse(usos[k])) / 86400000) < 21) viol++; usos[k] = d.fecha; } }
    assert.equal(viol, 0); paso('ningún ejercicio se repite en el mismo formato antes de 21 días');
    // cobertura muscular en 3 días
    const zonasA = new Set();
    for (let i = 0; i < 3; i++) { const dd = (await api('GET', '/api/planificacion?desde=' + suma(lunesSemana(), i) + '&dias=1', undefined, admin)).data[0].clases.find(c => c.circuito); if (dd) dd.circuito.rondas[0].ejercicios.forEach(e => zonasA.add(e.zona)); }
    assert.ok(zonasA.size >= 6, 'cobertura ' + [...zonasA]); paso('en 3 días de entrenamiento se cubren ' + zonasA.size + ' de 7 zonas');
    // reemplazo con sugerencias
    const circ = clases.find(c => c.circuito).circuito;
    r = await api('GET', '/api/planificacion/circuito/' + circ.id + '/sugerencias?slot=1', undefined, prof); assert.ok(r.data.length > 3);
    const alt = r.data.find(x => x.alcanza_equipo);
    r = await api('PUT', '/api/planificacion/circuito/' + circ.id + '/slot', { slot: 1, ejercicio_id: alt.id }, prof); assert.equal(r.data.rondas[0].ejercicios[1].ejercicio_id, alt.id); paso('el profesor reemplaza un ejercicio eligiendo entre alternativas');
    // video por ejercicio
    const video = Buffer.from('00000018667479706d703432', 'hex');
    r = await api('PUT', '/api/ejercicios/' + alt.id + '/video', video, prof, { raw: true, headers: { 'X-Extension': 'mp4', 'Content-Type': 'application/octet-stream' } }); assert.equal(r.status, 200);
    const rv = await fetch(BASE + r.data.video); assert.equal(rv.status, 200); assert.equal(rv.headers.get('content-type'), 'video/mp4');
    const rr = await fetch(BASE + r.data.video, { headers: { Range: 'bytes=0-3' } }); assert.equal(rr.status, 206); paso('sube y reproduce (con rangos) un video de ejercicio');
    r = await api('GET', '/api/planificacion/circuito/' + circ.id, undefined, prof); assert.ok(r.data.rondas[0].ejercicios[1].video); paso('el video queda asociado al circuito (lista de reproducción)');

    console.log('Módulo 3 – Clientes');
    const f0 = hoy();
    r = await api('POST', '/api/clientes', { nombre: 'Ana García', fecha_alta: suma(f0, -10), precio_plan: 30000, celular: '1155551234', instagram: '@anagarcia' }, admin); assert.equal(r.status, 200);
    const ana = r.data; assert.ok(ana.acceso.usuario); paso('alta de alumno con acceso automático (' + ana.acceso.usuario + ')');
    r = await api('POST', '/api/clientes', { nombre: 'Beto Pérez', fecha_alta: suma(f0, -80), precio_plan: 28000 }, admin); const beto = r.data;
    r = await api('POST', '/api/clientes', { nombre: 'Carla Sosa', fecha_alta: suma(f0, -300), precio_plan: 28000, fecha_baja: suma(f0, -200) }, admin); const carla = r.data;
    r = await api('POST', '/api/clientes', { nombre: 'Dani Ruiz', fecha_alta: suma(f0, -200), precio_plan: 28000, fecha_baja: suma(f0, -40) }, prof); const dani = r.data;
    r = await api('GET', '/api/clientes', undefined, prof); assert.equal(r.data.length, 4); assert.equal(r.data[0].precio_plan, undefined); paso('el profesor ve la lista SIN precios');
    const lista = (await api('GET', '/api/clientes', undefined, admin)).data; assert.ok(lista[0].precio_plan !== undefined);
    const por = Object.fromEntries(lista.map(c => [c.nombre, c]));
    assert.equal(por['Beto Pérez'].fecha_baja, suma(f0, -80).replace(/-\d\d$/, m => m) && por['Beto Pérez'].fecha_baja); // fecha de baja automática presente
    assert.ok(por['Ana García'].fecha_baja > f0); assert.equal(por['Ana García'].semaforo_alta, 'verde'); paso('fecha de baja automática (alta + 1 mes) y semáforo verde para activos');
    assert.equal(por['Beto Pérez'].semaforo_alta, 'amarillo'); assert.equal(por['Dani Ruiz'].semaforo_alta, 'amarillo'); assert.equal(por['Carla Sosa'].semaforo_alta, 'rojo'); paso('semáforo de alta: amarillo (baja 1-3 meses) y rojo (+3 meses)');
    // importación
    r = await api('POST', '/api/clientes/importar', { filas: [{ nombre: 'Eli Gómez', fecha_alta: f0, precio_plan: 30000, celular: '1144443333' }, { nombre: 'Ana García', celular: '1155551234', precio_plan: 32000 }, { fecha_alta: f0 }] }, admin);
    assert.equal(r.data.creados, 1); assert.equal(r.data.actualizados, 1); assert.equal(r.data.errores.length, 1); paso('importa filas: crea, actualiza duplicados e informa errores');
    // renovar
    r = await api('POST', '/api/clientes/' + beto.id + '/renovar', { meses: 1 }, admin); assert.equal(r.status, 400); assert.match(r.data.error, /método de pago/i); paso('renovar sin método de pago es rechazado (Efectivo o Mercado Pago obligatorio)');
    r = await api('POST', '/api/clientes/' + beto.id + '/renovar', { meses: 1, metodo_pago: 'mercadopago' }, admin); assert.ok(r.data.fecha_baja > f0); assert.equal(r.data.a_caja, false); paso('renovación con Mercado Pago extiende la baja y NO entra a la caja');

    console.log('Módulo 5 – Asistencias y QR');
    // aseguramos una clase "ahora": agenda para hoy a la hora actual
    const ar = new Date(Date.now() - 3 * 3600 * 1000); const horaAhora = ar.getUTCHours(); const dow = ar.getUTCDay() === 0 ? 7 : ar.getUTCDay();
    await api('PUT', '/api/agenda', { celdas: [{ dia: dow, hora: horaAhora, formato_id: formatos[0].id }] }, admin);
    // login alumno
    r = await api('POST', '/api/login', { username: ana.acceso.usuario, password: ana.acceso.clave }); assert.equal(r.status, 200); const tAna = r.data.token; paso('el alumno ingresa con el usuario creado (sin cuentas externas)');
    r = await api('GET', '/api/clientes', undefined, tAna); assert.equal(r.status, 403); paso('el alumno NO accede a la lista de clientes');
    r = await api('GET', '/api/mi-qr', undefined, tAna); assert.match(r.data.codigo, /^OMEGA\|/); const qr = r.data.codigo;
    r = await api('POST', '/api/asistencias/qr', { codigo: qr }, prof); assert.equal(r.status, 200, JSON.stringify(r.data)); assert.equal(r.data.duplicada, false); paso('el profesor escanea el QR del alumno y se registra la asistencia en la clase de este horario');
    r = await api('POST', '/api/asistencias/qr', { codigo: qr }, prof); assert.equal(r.data.duplicada, true); paso('un segundo escaneo no duplica la asistencia');
    r = await api('POST', '/api/asistencias/qr', { codigo: qr.slice(0, -3) + 'xyz' }, prof); assert.equal(r.status, 400); paso('un QR adulterado es rechazado');
    // exceso de cupo: sin límite en el check-in
    const extra = [];
    for (let i = 0; i < 22; i++) { const x = await api('POST', '/api/clientes', { nombre: 'Alumno Extra ' + i, fecha_alta: f0, crear_acceso: false }, admin); extra.push(x.data.id); }
    r = await api('POST', '/api/asistencias', { cliente_ids: extra }, prof); assert.equal(r.status, 200); assert.ok(r.data.resultados.every(x => !x.duplicada)); paso('el check-in manual no tiene límite de personas (23 en la clase)');
    r = await api('GET', '/api/dashboard', undefined, prof); const h = r.data.porHora.find(x => x.hora === horaAhora);
    assert.equal(h.total, 23); assert.equal(h.exceso, 3); assert.ok(r.data.ineficiencias.length >= 1); paso('el dashboard muestra la clase con 3 personas de exceso como ineficiencia de materiales');
    r = await api('GET', '/api/clientes/' + ana.id, undefined, admin); assert.equal(r.data.total_asistencias, 1); assert.ok(r.data.semanas.length === 12);
    paso('la ficha del alumno refleja la asistencia y su dashboard');

    console.log('Módulo 4 – Semáforo de asistencia');
    // Beto: asistencias hace 1 semana, 2 semanas y 5 semanas; Dani nunca
    const mk = async (id, dias) => { const lunes = (f) => { const d = new Date(f + 'T00:00:00Z'); const w = (d.getUTCDay() + 6) % 7; return suma(f, -w); }; return api('POST', '/api/asistencias', { cliente_id: id, fecha: suma(lunes(f0), -dias), hora: 9 }, admin); };
    await mk(beto.id, 7); await mk(carla.id, 14); await mk(dani.id, 35);
    const l2 = Object.fromEntries((await api('GET', '/api/clientes', undefined, admin)).data.map(c => [c.nombre, c]));
    assert.equal(l2['Ana García'].semaforo_asistencia, 'verde'); assert.equal(l2['Beto Pérez'].semaforo_asistencia, 'amarillo'); assert.equal(l2['Carla Sosa'].semaforo_asistencia, 'naranja'); assert.equal(l2['Dani Ruiz'].semaforo_asistencia, 'rojo');
    paso('semáforo de asistencia: verde / amarillo / NARANJA (2-3 semanas) / rojo (+3 semanas)');
    assert.ok(l2['Ana García'].ultima_clase); paso('la lista muestra la última clase asistida');

    console.log('Finanzas (solo administrador)');
    const mes = f0.slice(0, 7);
    for (const [cat, monto] of [['Alquiler', 400000], ['Salarios', 600000], ['Luz', 40000], ['Impuestos', 60000]]) await api('POST', '/api/finanzas', { tipo: 'egreso', categoria: cat, concepto: cat, monto, fecha: f0, fijo: true }, admin);
    r = await api('GET', '/api/finanzas?mes=' + mes, undefined, admin);
    assert.equal(r.data.gastos_fijos, 1100000); assert.ok(r.data.ingresos > 0); assert.equal(r.data.ganancia_neta, r.data.ingresos - r.data.egresos); assert.ok(r.data.punto_equilibrio_monto >= 1100000); assert.ok(r.data.punto_equilibrio_alumnos > 0);
    paso('ganancia neta ' + r.data.ganancia_neta + ' y punto de equilibrio de ' + r.data.punto_equilibrio_alumnos + ' alumnos');

    console.log('Backup');
    r = await api('POST', '/api/backups/ahora', {}, admin); assert.equal(r.data.ok, true);
    assert.ok(fs.readdirSync(path.join(DATA, 'backups')).some(f => /^omega-.*\.db$/.test(f))); paso('backup manual creado (el automático corre todos los días a las 22:00)');
    r = await api('GET', '/api/backups', undefined, admin); assert.equal(r.data.hora_programada, 22);

    console.log('\nTodo OK: ' + ok + ' verificaciones');
    srv.kill(); fs.rmSync(DATA, { recursive: true, force: true }); process.exit(0);
  } catch (e) {
    console.error('\n✗ FALLÓ:', e.message); console.error(e.stack.split('\n').slice(0, 4).join('\n')); console.error('--- log del servidor ---\n' + log.slice(-1500));
    srv.kill(); process.exit(1);
  }
})();
