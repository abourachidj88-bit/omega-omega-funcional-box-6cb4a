'use strict';
// Pruebas de la Versión 7: biblioteca balanceada sin avisos, descuentos, seguimiento de alumnos y visitas, asistencias, finanzas sobre Plan Full.
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');

const P = 5800 + Math.floor(Math.random() * 400);
const D = fs.mkdtempSync(path.join(os.tmpdir(), 'omega-v7-'));
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
    const L0 = lunesDe(hoy());
    r = await api('GET', '/api/estado'); assert.match(r.data.version, /Versión 7/); paso('la app informa Versión 7');

    console.log('Biblioteca balanceada y circuitos sin avisos');
    r = await api('GET', '/api/ejercicios', undefined, admin); const ej = r.data;
    const cuenta = (k) => ej.filter(e => String(e.capacidad).split(',').includes(k)).length;
    assert.ok(cuenta('movilidad') >= 50, 'movilidad ' + cuenta('movilidad')); assert.ok(cuenta('equilibrio') >= 50, 'equilibrio ' + cuenta('equilibrio')); paso('al menos 50 ejercicios de movilidad y 50 de equilibrio (' + cuenta('movilidad') + ' y ' + cuenta('equilibrio') + ')');
    for (const z of new Set(ej.map(e => e.zona))) for (const k of ['movilidad', 'equilibrio']) assert.ok(ej.filter(e => e.zona === z && String(e.capacidad).split(',').includes(k)).length >= 6, z + ' ' + k);
    for (const z of new Set(ej.map(e => e.zona))) assert.ok(ej.filter(e => e.zona === z && String(e.energia).split(',').includes('anaerobico')).length >= 6, z + ' anaeróbico');
    paso('cada patrón tiene ejercicios de movilidad, equilibrio y anaeróbicos para cualquier formato');
    r = await api('GET', '/api/formatos-semana?semana=' + L0, undefined, admin); const fm = r.data.formatos;
    // agenda con todos los formatos, todos los días, y estaciones/intensidades exigentes
    const celdas = []; for (let d = 1; d <= 6; d++) fm.forEach((f, i) => celdas.push({ dia: d, hora: 8 + i, formato_id: f.id }));
    for (const L of [suma(L0, 14), suma(L0, 21), suma(L0, 28), suma(L0, 35)]) {
      r = await api('PUT', '/api/agenda-semanal', { semana: L, celdas }, admin); assert.equal(r.status, 200, JSON.stringify(r.data));
    }
    const estac = [5, 6, 8, 4];
    for (let i = 0; i < 4; i++) {
      const L = suma(L0, 14 + 7 * i);
      const body = fm.map(f => ({ id: f.id, estaciones: estac[i], trabajo_seg: 40, descanso_seg: 20, sin_trabajo: f.sin_trabajo ? 1 : 0, intensidad_min: ['Hiitcross', 'QDX', 'Z7'].includes(f.nombre) ? 'alta' : 'baja', patrones: f.patrones, capacidades: f.capacidades, energias: f.energias }));
      r = await api('PUT', '/api/formatos-semana', { semana: L, formatos: body }, admin); assert.equal(r.status, 200, JSON.stringify(r.data));
    }
    let circuitos = 0; const avisos = [];
    for (let i = 0; i < 4; i++) {
      r = await api('GET', '/api/planificacion?desde=' + suma(L0, 14 + 7 * i) + '&dias=7', undefined, admin);
      for (const d of r.data) for (const c of d.clases) if (c.circuito) { circuitos++; (c.circuito.advertencias || []).forEach(a => avisos.push(c.formato.nombre + ' ' + d.fecha + ': ' + a)); }
    }
    assert.ok(circuitos > 40, 'circuitos ' + circuitos); assert.deepEqual(avisos, [], avisos.slice(0, 5).join(' | ')); paso(circuitos + ' circuitos de todos los formatos en 4 semanas, con 4 a 8 estaciones e intensidad alta: ninguno con aviso');

    console.log('Permisos');
    r = await api('POST', '/api/usuarios', { username: 'prof1', password: 'prof12345', nombre: 'Profe Uno', rol: 'profesor' }, admin); const pid = r.data.id;
    r = await api('POST', '/api/login', { username: 'prof1', password: 'prof12345' }); const prof = r.data.token;
    r = await api('GET', '/api/yo', undefined, prof); assert.ok(r.data.permisos.includes('plan.agenda') && r.data.permisos.includes('cli.seguimiento') && !r.data.permisos.includes('cfg.diseno')); paso('el profesor estándar puede editar agenda y staff y cargar seguimientos, pero no el diseño');
    const L1 = suma(L0, 7);
    r = await api('PUT', '/api/agenda-semanal', { semana: L1, celdas: [{ dia: 1, hora: 9, formato_id: fm[0].id }] }, prof); assert.equal(r.status, 200, JSON.stringify(r.data)); paso('el profesor modifica la agenda general');
    r = await api('PUT', '/api/staff/sesion', { fecha: L1, hora: 9, profesor_id: pid }, prof); assert.equal(r.status, 200, JSON.stringify(r.data)); paso('el profesor asigna el staff');
    r = await api('PUT', '/api/marca', { tema: { boton_color: '#112233' } }, prof); assert.equal(r.status, 403); paso('sin el permiso de diseño, el profesor no cambia el diseño');
    r = await api('GET', '/api/usuarios', undefined, admin); const u = r.data.find(x => x.id === pid);
    r = await api('PUT', '/api/usuarios/' + pid, { permisos: [...u.permisos, 'cfg.diseno'] }, admin); assert.equal(r.status, 200, JSON.stringify(r.data));
    r = await api('PUT', '/api/marca', { tema: { boton_color: '#112233' } }, prof); assert.equal(r.status, 200, JSON.stringify(r.data)); paso('con el permiso de diseño (tildado por el administrador) sí puede');

    console.log('Descuentos y renovación');
    r = await api('POST', '/api/descuentos', { tipo: 'pct', valor: 15, meses: 1 }, admin); const d15 = r.data; assert.equal(d15.nombre, '15% por 1 mes');
    r = await api('POST', '/api/descuentos', { tipo: 'monto', valor: 5000, meses: 3 }, admin); const d5k = r.data;
    r = await api('POST', '/api/descuentos', { tipo: 'pct', valor: 10, meses: 13 }, admin); assert.equal(r.status, 400); paso('los descuentos van de 1 a 12 meses');
    r = await api('POST', '/api/planes', { nombre: 'Full', precio_efectivo: 40000, precio_mp: 44000 }, admin); const planId = r.data.id;
    r = await api('POST', '/api/clientes', { nombre: 'Ana Recomendada', precio_plan: 40000, plan_id: planId }, admin); const ana = r.data.id || r.data.cliente?.id; assert.ok(ana, JSON.stringify(r.data));
    r = await api('POST', '/api/clientes/' + ana + '/renovar', { meses: 1, metodo_pago: 'efectivo', descuento_id: d15.id }, admin);
    assert.equal(r.status, 200, JSON.stringify(r.data)); assert.equal(r.data.plan_full, 40000); assert.equal(r.data.descuento, 6000); assert.equal(r.data.monto, 34000); paso('Plan Full $40.000 − 15% = ingreso neto $34.000');
    r = await api('POST', '/api/clientes/' + ana + '/renovar', { meses: 2, metodo_pago: 'efectivo', descuento_id: d5k.id }, admin);
    assert.equal(r.data.plan_full, 80000); assert.equal(r.data.descuento, 10000); assert.equal(r.data.monto, 70000); paso('descuento en pesos por mes: $5.000 × 2 meses');
    r = await api('GET', '/api/clientes/' + ana, undefined, admin); assert.equal(r.data.descuento_pendiente.restantes, 1); paso('si el descuento dura más que la renovación, queda el resto pendiente');
    r = await api('POST', '/api/clientes/' + ana + '/renovar', { meses: 1, metodo_pago: 'efectivo' }, admin); assert.equal(r.data.descuento, 5000); assert.equal(r.data.monto, 35000); paso('la próxima renovación aplica sola el descuento pendiente');
    r = await api('GET', '/api/clientes/' + ana, undefined, admin); assert.equal(r.data.descuento_pendiente, null);

    console.log('Premio por recomendación');
    r = await api('POST', '/api/clientes', { nombre: 'Beto Referente', precio_plan: 40000, plan_id: planId }, admin); const beto = r.data.id || r.data.cliente?.id;
    r = await api('GET', '/api/campanas', undefined, admin); const camp = r.data.find(c => c.tipo === 'recomendado');
    r = await api('POST', '/api/leads', { nombre: 'Carla Nueva', campana_id: camp.id, referido_id: beto, profesor_id: pid, objetivo: 'Tonificar' }, admin); assert.equal(r.status, 200, JSON.stringify(r.data)); const leadId = r.data.id;
    r = await api('POST', '/api/clientes', { nombre: 'Carla Nueva', precio_plan: 40000, plan_id: planId }, admin); const carla = r.data.id || r.data.cliente?.id;
    r = await api('POST', '/api/leads/' + leadId + '/vincular', { cliente_id: carla }, admin);
    r = await api('POST', '/api/clientes/' + carla + '/renovar', { meses: 1, metodo_pago: 'efectivo' }, admin);
    r = await api('GET', '/api/notificaciones', undefined, admin); const nt = r.data.items.find(n => n.cliente_id === beto && n.estado === 'pendiente'); assert.ok(nt, 'aviso de premio'); paso('al pagar quien fue recomendado, se avisa del premio');
    r = await api('PUT', '/api/notificaciones/' + nt.id, { descuento_id: d15.id }, admin); assert.equal(r.status, 200, JSON.stringify(r.data));
    r = await api('POST', '/api/clientes/' + beto + '/renovar', { meses: 1, metodo_pago: 'efectivo' }, admin); assert.equal(r.data.descuento, 6000); assert.equal(r.data.monto, 34000); paso('el premio (15%) se aplica en la renovación del alumno que recomendó');

    console.log('Finanzas sobre Plan Full');
    const mes = hoy().slice(0, 7);
    r = await api('GET', '/api/finanzas/estado-resultados?mes=' + mes, undefined, admin); const col = r.data.columnas[0];
    assert.equal(col.ingresos.plan_full - col.ingresos.descuentos, col.ingresos.neto); assert.ok(col.ingresos.descuentos >= 6000 + 10000 + 5000 + 6000);
    assert.equal(col.ingresos.descuentos_pct, Math.round(1000 * col.ingresos.descuentos / col.ingresos.plan_full) / 10); paso('Ingreso neto = Plan Full − Descuentos, y los % se calculan sobre el Plan Full');
    assert.equal(col.ingresos.ticket, Math.round(col.ingresos.cuotas_full / col.ingresos.alumnos)); paso('el precio por alumno es el Plan Full, sin descuentos');
    r = await api('GET', '/api/finanzas/analisis?mes=' + mes, undefined, admin); assert.equal(r.status, 200);

    console.log('Seguimiento del alumno');
    r = await api('GET', '/api/clases?fecha=' + hoy(), undefined, admin);
    for (const dd of [0, 1, 2]) { const rr = await api('POST', '/api/asistencias', { cliente_id: ana, fecha: suma(hoy(), -dd), hora: 9 }, admin); assert.equal(rr.status, 200, JSON.stringify(rr.data)); }
    r = await api('GET', '/api/clientes/' + ana + '/seguimiento', undefined, admin); assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.ok(Array.isArray(r.data.por_clase) && Array.isArray(r.data.dias_horarios) && r.data.semana_actual); paso('la pestaña Seguimiento trae clases, días/horarios y calificaciones');
    r = await api('PUT', '/api/clientes/' + ana + '/seguimiento', { progreso: 8 }, prof); assert.equal(r.status, 200, JSON.stringify(r.data)); assert.equal(r.data.semana_actual.progreso, 8);
    r = await api('PUT', '/api/clientes/' + ana + '/seguimiento', { progreso: 11 }, prof); assert.equal(r.status, 400); paso('el profesor califica el progreso de 1 a 10');
    r = await api('POST', '/api/comentarios', { tipo: 'cliente', ref_id: ana, texto: 'Quiere sumar un día más', fecha: hoy() }, prof); assert.equal(r.status, 200);
    r = await api('GET', '/api/clientes/' + ana + '/seguimiento', undefined, admin); assert.equal(r.data.comentarios.length, 1); assert.equal(r.data.comentarios[0].autor, 'Profe Uno'); paso('los comentarios del profesor quedan con fecha y autor');
    r = await api('POST', '/api/clientes/' + ana + '/acceso', {}, admin); const acc = r.data;
    r = await api('POST', '/api/login', { username: acc.usuario || acc.username, password: acc.clave || acc.password }); const alu = r.data.token;
    r = await api('PUT', '/api/mi/sensacion', { sensacion: 9 }, alu); assert.equal(r.status, 200, JSON.stringify(r.data));
    r = await api('PUT', '/api/mi/sensacion', { sensacion: 0 }, alu); assert.equal(r.status, 400);
    r = await api('GET', '/api/clientes/' + ana + '/seguimiento', undefined, admin); assert.equal(r.data.semana_actual.sensacion, 9); assert.equal(r.data.semana_actual.progreso, 8); paso('el alumno califica cómo se siente (1 a 10) desde su celular');
    r = await api('GET', '/api/clientes/' + ana + '/seguimiento', undefined, alu); assert.equal(r.status, 403); paso('el alumno no ve el seguimiento de los profesores');

    console.log('Asistencias');
    r = await api('GET', '/api/dashboard?fecha=' + hoy(), undefined, admin);
    assert.ok(!('ineficiencias' in r.data)); assert.ok(r.data.listas.activos.length >= 3); assert.equal(r.data.listas.activos.length, r.data.kpis.activos); assert.equal(r.data.listas.bajas_recuperables.length, r.data.kpis.bajas_recuperables); assert.equal(r.data.listas.activos_en_riesgo.length, r.data.kpis.activos_en_riesgo); assert.ok(r.data.listas.asistentes_dia.length >= 1); paso('el dashboard trae los listados de activos, en riesgo, bajas recuperables y asistentes del día, y ya no trae ineficiencias');
    r = await api('GET', '/api/asistencias/seguimiento?mes=' + mes, undefined, admin); assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.ok(r.data.asistencias >= 3); assert.ok(r.data.horarios.length && r.data.clases.length && r.data.renovacion.mes_anterior && r.data.renovacion.promedio_3_meses); paso('el seguimiento mensual muestra clases, profesores, horarios y no renovaciones vs mes anterior y vs promedio de 3 meses');


    console.log('Descuento de varios meses: se pierde si el plan vence 7 días o más sin renovar');
    r = await api('POST', '/api/clientes', { nombre: 'Gus Vencido', precio_plan: 40000, plan_id: planId }, admin); const gus = r.data.id || r.data.cliente?.id;
    r = await api('POST', '/api/clientes/' + gus + '/renovar', { meses: 1, metodo_pago: 'efectivo', descuento_id: d5k.id }, admin); assert.equal(r.data.descuento, 5000);
    r = await api('PUT', '/api/clientes/' + gus, { fecha_baja: suma(hoy(), -20) }, admin); assert.equal(r.status, 200, JSON.stringify(r.data));
    r = await api('POST', '/api/clientes/' + gus + '/renovar', { meses: 1, metodo_pago: 'efectivo' }, admin); assert.equal(r.status, 200, JSON.stringify(r.data)); assert.equal(r.data.descuento, 0); assert.equal(r.data.monto, 40000); paso('al renovar tarde (20 días vencido) ya no tiene el descuento de varios meses');
    r = await api('GET', '/api/asistencias/seguimiento?mes=' + mes, undefined, admin); assert.ok(Array.isArray(r.data.renovacion.renovaron_lista) && Array.isArray(r.data.renovacion.lista_mes_anterior)); paso('el seguimiento trae los listados que respaldan cada número');

    console.log('CRM · seguimiento');
    r = await api('GET', '/api/crm/seguimiento', undefined, admin); assert.ok(r.data.en_seguimiento.some(l => l.id === leadId) === false, 'la visita vinculada ya es alumna');
    r = await api('POST', '/api/leads', { nombre: 'Dani Visitante', profesor_id: pid, objetivo: 'Bajar de peso', fecha: hoy() }, admin); const lead2 = r.data.id;
    r = await api('GET', '/api/crm/seguimiento', undefined, prof); const l2 = r.data.en_seguimiento.find(l => l.id === lead2); assert.ok(l2); assert.equal(l2.profesor, 'Profe Uno'); assert.equal(l2.objetivo, 'Bajar de peso'); paso('la visita no inscripta aparece en seguimiento con profesor, objetivo y fecha');
    r = await api('POST', '/api/comentarios', { tipo: 'lead', ref_id: lead2, texto: 'Lo llamé, viene el lunes', fecha: hoy() }, prof); assert.equal(r.status, 200);
    r = await api('GET', '/api/mis-seguimientos', undefined, prof); assert.equal(r.data.leads.length, 1); assert.equal(r.data.leads[0].ultimo_comentario.texto, 'Lo llamé, viene el lunes'); paso('cada profesor ve en su perfil sus visitas a seguir');
    r = await api('PUT', '/api/leads/' + lead2 + '/perdido', { motivo: 'Le queda lejos' }, prof); assert.equal(r.status, 200);
    r = await api('GET', '/api/crm/seguimiento', undefined, admin); assert.ok(!r.data.en_seguimiento.some(l => l.id === lead2)); assert.equal(r.data.perdidos.find(l => l.id === lead2).motivo_perdido, 'Le queda lejos'); paso('quitar de seguimiento lo pasa a Clientes perdidos con su motivo');
    r = await api('PUT', '/api/leads/' + lead2 + '/reabrir', {}, prof); r = await api('GET', '/api/crm/seguimiento', undefined, admin); assert.ok(r.data.en_seguimiento.some(l => l.id === lead2)); paso('un perdido se puede volver a poner en seguimiento');

    console.log('Rutinas personalizadas con profesor de seguimiento');
    const ejs = ej.slice(0, 3);
    r = await api('POST', '/api/rutinas', { nombre: 'Rutina A', items: ejs.map(e => ({ ejercicio_id: e.id, series: 3, repeticiones: '10' })) }, admin); const rid = r.data.id; assert.ok(rid, JSON.stringify(r.data));
    r = await api('POST', '/api/rutinas/asignar', { rutina_id: rid, cliente_ids: [ana], dias: [1, 3, 5], profesor_id: pid }, admin); assert.equal(r.status, 200, JSON.stringify(r.data));
    r = await api('GET', '/api/rutinas/asignaciones?cliente_id=' + ana, undefined, admin); assert.equal(r.data[0].profesor, 'Profe Uno'); paso('la rutina asignada lleva su profesor de seguimiento');
    r = await api('GET', '/api/mis-seguimientos', undefined, prof); assert.equal(r.data.rutinas.length, 1); assert.equal(r.data.rutinas[0].cliente, 'Ana Recomendada'); assert.equal(typeof r.data.rutinas[0].entrenos, 'number'); assert.equal(typeof r.data.rutinas[0].rutinas_realizadas, 'number'); paso('el profesor ve sus alumnos en seguimiento con cuántas veces entrenaron y hicieron la rutina');

    console.log('\nTodo OK: ' + ok + ' verificaciones de la Versión 7');
  } catch (e) { console.error('\n✗ FALLÓ:', e.message); console.error(e.stack); console.error('--- log ---\n' + log.slice(-1500)); process.exitCode = 1; }
  finally { srv.kill(); fs.rmSync(D, { recursive: true, force: true }); }
})();
