'use strict';
// Pruebas de la Versión 2: país/WhatsApp, campañas, referidos, deshacer pagos, deuda, avatar, reservas, rutinas,
// planificación manual, glúteos/intensidad y estado de resultados / presupuesto.
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');

const P = 4300 + Math.floor(Math.random() * 400);
const D = fs.mkdtempSync(path.join(os.tmpdir(), 'omega-v2-'));
const BASE = 'http://127.0.0.1:' + P;
let ok = 0; const paso = (n) => { ok++; console.log('  ✓ ' + n); };
const ar = () => new Date(Date.now() - 3 * 3600 * 1000);
const hoy = () => ar().toISOString().slice(0, 10);
const suma = (f, n) => { const [y, m, d] = f.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
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
    r = await api('POST', '/api/usuarios', { username: 'prof1', password: 'profe123', rol: 'profesor', nombre: 'Profe Uno' }, admin);
    r = await api('POST', '/api/login', { username: 'prof1', password: 'profe123' }); const prof = r.data.token;

    console.log('Ajustes: país, WhatsApp y campañas');
    r = await api('GET', '/api/config-pais', undefined, admin); assert.equal(r.data.codigo, 'AR'); assert.equal(r.data.prefijo, '54'); assert.ok(r.data.paises.length > 10); paso('país por defecto Argentina (+54)');
    r = await api('PUT', '/api/config-pais', { whatsapp_gym: '11 4444-5555' }, admin); assert.equal(r.data.whatsapp_gym, '+5491144445555'); assert.equal(r.data.whatsapp_gym_link, 'https://wa.me/5491144445555'); paso('el WhatsApp del gimnasio queda estandarizado con el prefijo');
    r = await api('PUT', '/api/config-pais', { pais: 'UY' }, admin); assert.equal(r.data.prefijo, '598'); r = await api('PUT', '/api/config-pais', { pais: 'AR' }, admin); assert.equal(r.data.prefijo, '54'); paso('cambiar de país cambia el prefijo');
    r = await api('GET', '/api/campanas', undefined, prof); assert.ok(r.data.some(c => c.nombre === 'Instagram')); assert.ok(r.data.some(c => c.tipo === 'recomendado')); paso('campañas iniciales (Instagram, Recorrida, Recomendado por…)');
    const campRec = r.data.find(c => c.tipo === 'recomendado'), campIg = r.data.find(c => c.nombre === 'Instagram');
    r = await api('POST', '/api/campanas', { nombre: 'Volante en la plaza' }, admin); assert.equal(r.status, 200); const nueva = r.data.id;
    r = await api('POST', '/api/campanas', { nombre: 'Volante en la plaza' }, admin); assert.equal(r.status, 400);
    r = await api('DELETE', '/api/campanas/' + nueva, undefined, admin); r = await api('GET', '/api/campanas', undefined, admin); assert.ok(!r.data.some(c => c.id === nueva)); paso('el administrador crea y elimina campañas');
    r = await api('POST', '/api/campanas', { nombre: 'X' }, prof); assert.equal(r.status, 403); paso('el profesor no administra campañas');

    console.log('Clientes: WhatsApp, deuda, deshacer pago, avatar');
    r = await api('POST', '/api/clientes', { nombre: 'María Pérez', celular: '011 15 5555-1234', fecha_alta: hoy(), precio_plan: 30000 }, admin); assert.equal(r.status, 200); const maria = r.data.id;
    r = await api('GET', '/api/clientes/' + maria, undefined, admin); assert.equal(r.data.celular, '+5491155551234'); paso('el celular del alumno se guarda estandarizado (+54 9 …)');
    const baja0 = r.data.fecha_baja;
    const futuro = suma(baja0, 20);
    r = await api('PUT', '/api/clientes/' + maria, { fecha_baja: futuro }, admin); r = await api('GET', '/api/clientes/' + maria, undefined, admin); assert.equal(r.data.fecha_baja, futuro); assert.equal(r.data.falta_pago, true); paso('mover la fecha de baja sin pago marca "Falta registrar pago"');
    r = await api('GET', '/api/clientes', undefined, prof); assert.equal(r.data.find(c => c.id === maria).falta_pago, true); paso('el profesor también ve la alerta amarilla');
    r = await api('POST', '/api/clientes/' + maria + '/renovar', { meses: 2, metodo_pago: 'efectivo' }, admin); assert.equal(r.status, 200); const bajaConPago = r.data.fecha_baja;
    r = await api('GET', '/api/clientes/' + maria, undefined, admin); assert.equal(r.data.falta_pago, false); const pagoId = r.data.pagos[0].id; assert.equal(r.data.pagos[0].meses, 2); paso('registrar el pago limpia la alerta');
    r = await api('GET', '/api/caja?fecha=' + hoy(), undefined, admin); assert.ok(r.data.ingresos.some(i => i.pago_id === pagoId)); const antesCaja = r.data.total_ingresos;
    r = await api('POST', '/api/pagos/' + pagoId + '/anular', undefined, admin); assert.equal(r.status, 200); assert.equal(r.data.de_caja, true); assert.equal(r.data.fecha_baja, futuro);
    assert.equal(r.data.falta_pago, true); r = await api('GET', '/api/clientes/' + maria, undefined, admin); assert.equal(r.data.falta_pago, true); paso('al deshacer el pago vuelve el cartel "Falta registrar pago" hasta que haya un pago definitivo');
    r = await api('GET', '/api/clientes/' + maria, undefined, admin); assert.equal(r.data.fecha_baja, futuro); assert.ok(!r.data.pagos.some(p => p.id === pagoId));
    r = await api('GET', '/api/caja?fecha=' + hoy(), undefined, admin); assert.ok(!r.data.ingresos.some(i => i.pago_id === pagoId)); assert.ok(r.data.total_ingresos < antesCaja); paso('deshacer pago: vuelve la fecha de baja y desaparece el ingreso de la Caja');
    { const vencida = suma(hoy(), -140); r = await api('POST', '/api/clientes', { nombre: 'Facundo Test', fecha_alta: suma(hoy(), -400), precio_plan: 30000, fecha_baja: vencida }, admin); const fid = r.data.id;
      r = await api('POST', '/api/clientes/' + fid + '/renovar', { meses: 1, metodo_pago: 'efectivo' }, admin); assert.notEqual(r.data.fecha_baja, vencida);
      r = await api('GET', '/api/clientes/' + fid, undefined, admin); const pid = r.data.pagos[0].id;
      r = await api('POST', '/api/pagos/' + pid + '/anular', undefined, admin); assert.equal(r.data.fecha_baja, vencida);
      r = await api('GET', '/api/clientes/' + fid, undefined, admin); assert.equal(r.data.fecha_baja, vencida); paso('deshacer el pago de una baja vencida vuelve a la fecha de baja original (no a hoy)'); }
    r = await api('POST', '/api/clientes/' + maria + '/renovar', { meses: 1, metodo_pago: 'mercadopago' }, admin); r = await api('GET', '/api/clientes/' + maria, undefined, admin); const pmp = r.data.pagos[0].id;
    r = await api('POST', '/api/pagos/' + pmp + '/anular', undefined, admin); assert.equal(r.data.de_caja, false); r = await api('GET', '/api/finanzas?mes=' + hoy().slice(0, 7), undefined, admin); assert.ok(!r.data.movimientos.some(m => m.pago_id === pmp)); paso('deshacer un pago de Mercado Pago lo quita del reporte (sin tocar la caja)');
    r = await api('POST', '/api/usuarios', { rol: 'profesor', nombre: 'Sin permisos', username: 'sinperm', password: 'sinperm123', permisos: [] }, admin); r = await api('POST', '/api/login', { username: 'sinperm', password: 'sinperm123' }); const profSin = r.data.token;
    r = await api('POST', '/api/pagos/' + pmp + '/anular', undefined, profSin); assert.equal(r.status, 403); paso('sin el permiso correspondiente no se deshacen pagos');
    r = await api('POST', '/api/login', { username: 'maria.perez', password: '12345678' }); assert.equal(r.status, 200); const alu = r.data.token;
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    r = await api('PUT', '/api/mi-perfil/foto', { foto: png }, alu); assert.equal(r.status, 200); r = await api('GET', '/api/mi-perfil', undefined, alu); assert.equal(r.data.foto, png); assert.ok(r.data.whatsapp_gym.startsWith('https://wa.me/')); paso('el alumno sube su foto de perfil y ve el WhatsApp del gimnasio');
    r = await api('PUT', '/api/mi-perfil/foto', { foto: 'hola' }, alu); assert.equal(r.status, 400); paso('foto inválida rechazada');

    console.log('CRM: campaña, referidos y notificaciones');
    r = await api('POST', '/api/leads', { nombre: 'Carlos Gómez', telefono: '11 6666-7777', campana_id: campRec.id, referido_id: maria, objetivo: 'Otro: preparar un maratón' }, prof); assert.equal(r.status, 200); const lead = r.data.id;
    r = await api('POST', '/api/leads', { nombre: 'Ana Ruiz', telefono: '11 6666-8888', campana_id: campIg.id, referido_id: maria }, prof); const leadIg = r.data.id;
    r = await api('GET', '/api/leads', undefined, prof); const l1 = r.data.leads.find(l => l.id === lead), l2 = r.data.leads.find(l => l.id === leadIg);
    assert.equal(l1.referido, 'María Pérez'); assert.equal(l1.campana, 'Recomendado por'); assert.equal(l2.referido, null); assert.equal(l1.telefono, '+5491166667777'); assert.ok(r.data.por_campana.length >= 2); paso('la visita guarda campaña y referido (solo si la campaña es "Recomendado por")');
    r = await api('GET', '/api/notificaciones', undefined, prof); assert.equal(r.data.pendientes, 0);
    r = await api('POST', '/api/clientes', { nombre: 'Carlos Gómez', celular: '11 6666-7777', fecha_alta: hoy(), precio_plan: 30000, metodo_pago: 'efectivo' }, admin); const carlos = r.data.id;
    r = await api('GET', '/api/notificaciones', undefined, prof); assert.equal(r.data.pendientes, 1); assert.match(r.data.items[0].titulo, /Carlos Gómez.*María Pérez/); paso('al cerrarse la venta por recomendación el staff recibe la notificación de premio');
    r = await api('GET', '/api/yo', undefined, prof); assert.equal(r.data.notif_pendientes, 1);
    const nid = (await api('GET', '/api/notificaciones', undefined, prof)).data.items[0].id;
    r = await api('PUT', '/api/notificaciones/' + nid, { resolucion: 'Se le aplicó 10% de descuento' }, prof); assert.equal(r.data.pendientes, 0); paso('el staff resuelve la notificación');
    r = await api('POST', '/api/leads/' + leadIg + '/vincular', { cliente_id: carlos }, admin); r = await api('GET', '/api/notificaciones', undefined, prof); assert.equal(r.data.pendientes, 0); paso('no hay premio si la campaña no es de recomendación');

    console.log('Reservas informativas');
    r = await api('GET', '/api/formatos', undefined, admin);
    r = await api('PUT', '/api/formatos', { formatos: r.data.map(f => ({ id: f.id, trabajo_seg: 40, descanso_seg: 20 })) }, admin); assert.equal(r.status, 200);
    r = await api('POST', '/api/planificacion/generar', { desde: hoy(), dias: 14, modo: 'ia' }, admin); assert.equal(r.status, 200);
    const ahora = ar();
    let fechaClase = null; for (let i = 1; i <= 7; i++) { const f = suma(hoy(), i); const dow = ((new Date(f + 'T12:00:00Z').getUTCDay() + 6) % 7) + 1; if (dow >= 1 && dow <= 6) { fechaClase = f; break; } }
    r = await api('PUT', '/api/equipamiento', { equipamiento: [], capacidad_clase: 5 }, admin);
    r = await api('POST', '/api/reservas', { fecha: fechaClase, hora: 18 }, alu); assert.equal(r.status, 200); assert.equal(r.data.reservas, 1);
    r = await api('POST', '/api/reservas', { fecha: fechaClase, hora: 18 }, alu); assert.equal(r.data.reservas, 1); paso('reservar una clase (y repetir no duplica)');
    r = await api('POST', '/api/reservas', { fecha: suma(hoy(), -1), hora: 18 }, alu); assert.equal(r.status, 400); paso('no se reserva una clase pasada');
    r = await api('POST', '/api/reservas', { fecha: fechaClase, hora: 3 }, alu); assert.equal(r.status, 400); paso('no se reserva si no hay clase en ese horario');
    r = await api('GET', '/api/reservas/mias', undefined, alu); assert.equal(r.data.length, 1);
    const alumnos = [];
    for (let i = 0; i < 6; i++) { r = await api('POST', '/api/clientes', { nombre: 'Alumno Extra' + String.fromCharCode(65 + i), fecha_alta: hoy() }, admin); alumnos.push(r.data.acceso.usuario); }
    for (const u of alumnos) { const t = (await api('POST', '/api/login', { username: u, password: '12345678' })).data.token; r = await api('POST', '/api/reservas', { fecha: fechaClase, hora: 18 }, t); assert.equal(r.status, 200); }
    r = await api('GET', '/api/reservas/dia?fecha=' + fechaClase, undefined, prof); const h18 = r.data.horas.find(h => h.hora === 18); assert.equal(h18.total, 7); assert.equal(h18.limite, 5); assert.equal(h18.exceso, 2); assert.equal(h18.alumnos.length, 7); paso('7 reservas con límite 5: se puede anotar igual y el staff ve el exceso (Ineficiencia de Materiales)');
    r = await api('GET', '/api/grilla?desde=' + fechaClase, undefined, alu); const c18 = r.data[0].clases.find(c => c.hora === 18); assert.equal(c18.reservada, true); assert.equal(c18.exceso_reservas, undefined); paso('el alumno ve su reserva en la grilla (sin datos internos)');
    r = await api('GET', '/api/grilla?desde=' + fechaClase, undefined, prof); assert.equal(r.data[0].clases.find(c => c.hora === 18).exceso_reservas, 2);
    r = await api('GET', '/api/dashboard?fecha=' + fechaClase, undefined, admin); const d18 = r.data.porHora.find(h => h.hora === 18); assert.equal(d18.reservas, 7); assert.equal(d18.exceso_reservas, 2); paso('el dashboard muestra reservas y exceso');
    r = await api('POST', '/api/reservas/cancelar', { fecha: fechaClase, hora: 18 }, alu); r = await api('GET', '/api/reservas/mias', undefined, alu); assert.equal(r.data.length, 0); paso('cancelar una reserva');
    r = await api('PUT', '/api/equipamiento', { equipamiento: [], capacidad_clase: 20 }, admin);

    console.log('Biblioteca: glúteos, intensidad y filtros');
    r = await api('GET', '/api/ejercicios?zona=' + encodeURIComponent('Glúteos'), undefined, prof); assert.equal(r.data.length, 50); assert.ok(r.data.every(e => e.prog2 && e.prog3 && e.patron && e.intensidad)); paso('zona Glúteos con 50 ejercicios, progresiones, tipo de movimiento e intensidad');
    r = await api('GET', '/api/ejercicios', undefined, prof); assert.ok(r.data.every(e => ['baja', 'moderada', 'alta'].includes(e.intensidad))); const cuenta = { baja: 0, moderada: 0, alta: 0 }; r.data.forEach(e => cuenta[e.intensidad]++); assert.ok(cuenta.alta > 20 && cuenta.baja > 20); paso('todos los ejercicios tienen intensidad cardiovascular (' + JSON.stringify(cuenta) + ')');
    r = await api('POST', '/api/ejercicios', { zona: 'Glúteos', nombre: 'Patada alta propia', prog2: 'Patada con pausa', prog3: 'Patada con banda', equipo: 'ninguno', patron: 'bird', intensidad: 'alta' }, prof); assert.equal(r.status, 200); const nuevoEj = r.data.id;
    r = await api('GET', '/api/ejercicios/' + nuevoEj, undefined, prof); assert.equal(r.data.intensidad, 'alta'); r = await api('POST', '/api/ejercicios', { zona: 'Glúteos', nombre: 'Otro', prog2: 'a', prog3: 'b', intensidad: 'rarísima' }, prof); assert.equal(r.status, 400); paso('un ejercicio nuevo guarda su intensidad');
    r = await api('PUT', '/api/ejercicios/' + nuevoEj, { intensidad: 'baja' }, prof); r = await api('GET', '/api/ejercicios/' + nuevoEj, undefined, prof); assert.equal(r.data.intensidad, 'baja'); paso('la intensidad se puede editar');

    console.log('Planificación: formatos HIIT, cupo por estación y modo manual');
    r = await api('GET', '/api/formatos', undefined, admin); const formatos = r.data;
    r = await api('PUT', '/api/formatos', { formatos: formatos.map(f => ({ id: f.id, trabajo_seg: 40, descanso_seg: 20, cupo_estacion: f.nombre === 'Funcional' ? 6 : undefined })) }, admin); assert.equal(r.status, 200);
    const hiit = r.data.find(f => f.nombre === 'Hiitcross'), fun = r.data.find(f => f.nombre === 'Funcional'); assert.equal(hiit.intensidad_min, 'moderada'); assert.equal(fun.cupo_estacion, 6); paso('Hiitcross exige intensidad y Funcional define su cupo por estación');
    const lunes = (() => { const d = ar(); const dow = (d.getUTCDay() + 6) % 7; return suma(hoy(), -dow + 7); })();
    r = await api('POST', '/api/planificacion/generar', { desde: lunes, dias: 7, rehacer: true, modo: 'ia' }, admin); assert.equal(r.status, 200);
    r = await api('GET', '/api/planificacion?desde=' + lunes + '&dias=7', undefined, admin);
    let nHiit = 0, nBaja = 0, nFlex = 0, nFlexBaja = 0, vioGluteos = false, personas = new Set();
    for (const d of r.data) for (const c of d.clases) if (c.circuito && c.formato.nombre === 'Hiitcross') { nHiit++; for (const e of c.circuito.rondas[0].ejercicios) { if (e.intensidad === 'baja') nBaja++; } }
    for (const d of r.data) for (const c of d.clases) if (c.circuito && c.formato.nombre === 'Flex') { nFlex++; for (const e of c.circuito.rondas[0].ejercicios) if (e.intensidad === 'baja') nFlexBaja++; }
    for (const d of r.data) for (const c of d.clases) if (c.circuito) { if (c.circuito.rondas[0].ejercicios.some(e => e.zona === 'Glúteos')) vioGluteos = true; personas.add(c.formato.nombre + ':' + c.circuito.personas_por_estacion); }
    assert.ok(nHiit > 0 && nFlex > 0); assert.ok(nBaja / (nHiit * 5) < 0.3 && nBaja / (nHiit * 5) < nFlexBaja / (nFlex * 5), 'HIIT con demasiados ejercicios suaves: ' + nBaja + '/' + nHiit * 5 + ' vs Flex ' + nFlexBaja + '/' + nFlex * 5); paso('las clases HIIT priorizan ejercicios que suben las pulsaciones (' + nBaja + ' suaves de ' + nHiit * 5 + ')');
    assert.ok(vioGluteos); paso('los Glúteos entran en la rotación de la semana');
    assert.ok([...personas].some(x => x === 'Funcional:6')); paso('el cupo por estación del formato se aplica (Funcional: 6 por estación)');
    r = await api('PUT', '/api/planificacion/modo', { modo: 'manual' }, prof); assert.equal(r.data.modo, 'manual');
    r = await api('POST', '/api/planificacion/generar', { desde: lunes, dias: 7, rehacer: true }, admin);
    r = await api('GET', '/api/planificacion?desde=' + lunes + '&dias=7', undefined, admin);
    const cm = r.data.flatMap(d => d.clases).find(c => c.circuito);
    assert.equal(cm.circuito.modo, 'manual'); assert.ok(cm.circuito.rondas[0].ejercicios.every(e => e.vacio)); paso('modo manual: el circuito se crea vacío para que el profesor elija a mano');
    { const lun = suma(hoy(), -((ar().getUTCDay() + 6) % 7)), h = hoy(); const cant = async (f) => (await api('GET', '/api/planificacion?desde=' + lun + '&dias=7', undefined, admin)).data.filter(d => f(d.fecha)).reduce((a, d) => a + d.clases.filter(c => c.circuito).length, 0);
      await api('POST', '/api/planificacion/generar', { desde: lun, dias: 7, modo: 'manual', rehacer: true }, admin);
      const pasadosAntes = await cant(f => f < h), futurosAntes = await cant(f => f >= h);
      r = await api('POST', '/api/planificacion/eliminar', { desde: lun, dias: 7 }, admin); assert.equal(r.status, 200);
      assert.equal(await cant(f => f >= h), 0); assert.equal(await cant(f => f < h), pasadosAntes); paso('Eliminar semana borra los circuitos de hoy en adelante (IA o manuales) y conserva los días pasados');
      r = await api('POST', '/api/planificacion/generar', { desde: lun, dias: 7, modo: 'ia', rehacer: true, conservar_pasado: true }, admin); assert.equal(r.status, 200); assert.ok(r.data.creados > 0);
      assert.equal(await cant(f => f >= h), futurosAntes); assert.equal(await cant(f => f < h), pasadosAntes);
      r = await api('POST', '/api/planificacion/generar', { desde: lun, dias: 7, modo: 'ia', rehacer: true, conservar_pasado: true }, admin); assert.ok(r.data.regenerados > 0);
      const ia = (await api('GET', '/api/planificacion?desde=' + lun + '&dias=7', undefined, admin)).data.filter(d => d.fecha >= h).flatMap(d => d.clases).filter(c => c.circuito);
      assert.ok(ia.length && ia.every(c => c.circuito.modo === 'ia')); paso('Generar con IA reemplaza lo que había (aunque fuera manual) desde hoy y no toca los días pasados'); }
    r = await api('GET', '/api/planificacion/circuito/' + cm.circuito.id + '/sugerencias?slot=0', undefined, prof); assert.ok(r.data.length > 10); const eleg = r.data[0];
    r = await api('PUT', '/api/planificacion/circuito/' + cm.circuito.id + '/slot', { slot: 0, ejercicio_id: eleg.id }, prof); assert.equal(r.status, 200); assert.equal(r.data.rondas[0].ejercicios[0].ejercicio_id, eleg.id); assert.equal(r.data.rondas[1].ejercicios[0].nombre, eleg.prog2); assert.ok(r.data.rondas[0].ejercicios.slice(1).every(e => e.vacio)); paso('el profesor elige el ejercicio y sus progresiones vienen incluidas');
    r = await api('PUT', '/api/planificacion/modo', { modo: 'ia' }, prof); assert.equal(r.data.modo, 'ia');

    console.log('Rutinas (musculación)');
    r = await api('GET', '/api/ejercicios?zona=Pecho', undefined, prof); const ejs = r.data.slice(0, 4);
    r = await api('POST', '/api/rutinas', { nombre: 'Pecho y hombros', items: ejs.map(e => ({ ejercicio_id: e.id, series: 4, repeticiones: '8-10', peso: '20 kg', descanso_seg: 90 })) }, prof); assert.equal(r.status, 200); const rid = r.data.id; assert.equal(r.data.duracion_min, Math.round(4 * 4 * (40 + 90) / 60)); paso('rutina creada con series, repeticiones, peso y descanso (duración calculada)');
    r = await api('POST', '/api/rutinas', { nombre: 'Eterna', items: Array.from({ length: 12 }, () => ({ ejercicio_id: ejs[0].id, series: 10, repeticiones: '10', descanso_seg: 120 })) }, prof); assert.equal(r.status, 400); assert.match(r.data.error || r.data.mensaje || JSON.stringify(r.data), /180/); paso('una rutina de más de 180 minutos se rechaza');
    r = await api('GET', '/api/rutinas/' + rid, undefined, prof); assert.equal(r.data.items.length, 4); assert.ok(r.data.items[0].nombre); assert.equal(r.data.items[0].series, 4);
    const manana = suma(hoy(), 1);
    const dowM = ((new Date(manana + 'T00:00:00Z').getUTCDay() + 6) % 7) + 1;
    r = await api('GET', '/api/yo', undefined, alu); const miId = r.data.cliente_id; assert.ok(miId);
    r = await api('GET', '/api/clase?fecha=' + manana, undefined, alu); assert.equal(r.data.rutina_libre, null); paso('sin rutina asignada el alumno no ve rutina');
    r = await api('POST', '/api/rutinas/asignar', { rutina_id: rid, cliente_ids: [miId], dias: [] }, prof); assert.equal(r.status, 400);
    r = await api('POST', '/api/rutinas/asignar', { rutina_id: rid, cliente_ids: [miId], dias: [dowM, 6] }, prof); assert.equal(r.status, 200); assert.equal(r.data.asignados, 1);
    r = await api('GET', '/api/clase?fecha=' + manana, undefined, alu); assert.equal(r.data.rutina_libre.id, rid); assert.equal(r.data.rutina_libre.items.length, 4); paso('la rutina asignada al cliente aparece en su app los días elegidos (se repite cada semana)');
    r = await api('GET', '/api/clase?fecha=' + suma(manana, 7), undefined, alu); assert.equal(r.data.rutina_libre.id, rid);
    const otroDia = [1, 2, 3, 4, 5, 6].find(d => d !== dowM && d !== 6); const fechaOtro = [1, 2, 3, 4, 5, 6, 7].map(n => suma(manana, n)).find(f => ((new Date(f + 'T00:00:00Z').getUTCDay() + 6) % 7) + 1 === otroDia);
    r = await api('GET', '/api/clase?fecha=' + fechaOtro, undefined, alu); assert.equal(r.data.rutina_libre, null); paso('los demás días no muestra la rutina');
    r = await api('GET', '/api/rutinas/asignaciones?cliente_id=' + miId, undefined, prof); assert.equal(r.data.length, 1); assert.deepEqual(r.data[0].dias, [dowM, 6].sort((a, b) => a - b)); assert.ok(r.data[0].cliente);
    const clasesManana = (await api('GET', '/api/clase?fecha=' + manana, undefined, alu)).data.clases.find(c => c.formato); if (clasesManana) { assert.equal(clasesManana.rutina.id, rid); paso('con formato, la rutina cuelga de la pestaña del formato del día'); }
    r = await api('GET', '/api/rutinas/asignaciones?cliente_id=' + miId, undefined, alu); assert.equal(r.status, 403);
    r = await api('DELETE', '/api/rutinas/asignaciones/' + (await api('GET', '/api/rutinas/asignaciones?cliente_id=' + miId, undefined, prof)).data[0].id, undefined, prof); assert.equal(r.status, 200);
    r = await api('POST', '/api/rutinas/asignar', { rutina_id: rid, cliente_ids: [miId], dias: [1, 2, 3, 4, 5, 6] }, prof);
    r = await api('GET', '/api/clase?fecha=' + manana, undefined, alu); assert.ok(r.data.rutina_libre || dowM === 7);
    r = await api('PUT', '/api/rutinas/' + rid, { nombre: 'Pecho y hombros v2', items: ejs.slice(0, 2).map(e => ({ ejercicio_id: e.id, series: 3, repeticiones: '12' })) }, prof); assert.equal(r.status, 200); r = await api('GET', '/api/rutinas/' + rid, undefined, prof); assert.equal(r.data.items.length, 2); paso('editar una rutina');
    r = await api('POST', '/api/rutinas', { nombre: 'x', items: [] }, alu); assert.equal(r.status, 403); paso('el alumno no crea rutinas');

    console.log('Finanzas: amortización, estado de resultados y presupuesto');
    const mes = hoy().slice(0, 7);
    r = await api('POST', '/api/finanzas', { tipo: 'egreso', categoria: 'Equipamiento', concepto: 'Compra de barras', monto: 120000, fecha: hoy(), devengar_meses: 3 }, admin); assert.equal(r.status, 200);
    r = await api('POST', '/api/finanzas', { tipo: 'egreso', categoria: 'Alquiler', concepto: 'Alquiler', monto: 200000, fecha: hoy(), fijo: true }, admin);
    r = await api('POST', '/api/finanzas', { tipo: 'egreso', categoria: 'Salarios de profesores', concepto: 'Sueldos', monto: 150000, fecha: hoy(), fijo: true }, admin);
    r = await api('POST', '/api/finanzas', { tipo: 'egreso', categoria: 'Limpieza', concepto: 'Limpieza', monto: 20000, fecha: hoy() }, admin);
    r = await api('POST', '/api/finanzas', { tipo: 'egreso', categoria: 'Equipamiento', concepto: 'Cinta', monto: 30000, fecha: hoy() }, admin);
    r = await api('GET', '/api/finanzas/estado-resultados?mes=' + mes, undefined, admin); assert.equal(r.status, 200);
    const e = r.data.columnas[0]; const it = (g, n) => e[g].items.find(i => i.nombre === n).monto;
    assert.equal(it('gastos', 'Equipamiento'), 40000 + 30000); assert.equal(it('costos', 'Alquiler'), 200000); assert.equal(it('costos', 'Salarios'), 150000); assert.equal(it('gastos', 'Limpieza'), 20000);
    assert.equal(e.costos.total, 350000); assert.equal(e.gastos.total, 90000); assert.equal(e.margen_bruto.monto, e.ingresos.total - 350000); assert.equal(e.resultado.monto, e.ingresos.total - 350000 - 90000); paso('estado de resultados: costos operativos, margen bruto, gastos (con equipamiento amortizado) y resultado');
    assert.ok(e.ingresos.total > 0 && e.ingresos.items.length >= 1); assert.ok(e.ingresos.items.every(i => typeof i.pct === 'number')); assert.ok(e.ingresos.alumnos >= 1); paso('ingresos con cantidad de alumnos, precio promedio y peso % de cada ítem');
    const sig = (() => { const [y, m] = mes.split('-').map(Number); return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7); })();
    r = await api('GET', '/api/finanzas/estado-resultados?mes=' + sig + '&meses=3', undefined, admin); assert.equal(r.data.columnas.length, 3); assert.equal(r.data.mes, mes); assert.equal(r.data.columnas[2].mes, mes); paso('el estado de resultados nunca va más allá del mes corriente');
    r = await api('GET', '/api/finanzas/estado-resultados?mes=' + mes + '&meses=13', undefined, admin); assert.equal(r.data.columnas.length, 13); paso('mes corriente + 12 meses anteriores para comparar');
    const antes = (await api('GET', '/api/finanzas?mes=' + mes, undefined, admin)).data.movimientos.length;
    r = await api('POST', '/api/finanzas', { tipo: 'egreso', categoria: 'Mantenimiento', concepto: 'Service futuro', monto: 90000, fecha: sig + '-15' }, admin); assert.equal(r.status, 200); assert.equal(r.data.presupuestado, true); assert.equal(r.data.mes, sig); const finFut = r.data.id; assert.ok(finFut);
    r = await api('GET', '/api/finanzas/forecast', undefined, admin); assert.ok(r.data.escenario.picos.some(p => p.mes === sig && p.linea === 'Mantenimiento' && p.monto === 90000));
    assert.equal((await api('GET', '/api/finanzas?mes=' + mes, undefined, admin)).data.movimientos.length, antes); assert.equal((await api('GET', '/api/finanzas?mes=' + sig, undefined, admin)).data.movimientos.length, 1); paso('un egreso con fecha futura queda en su mes y además se copia al Presupuesto de 12 meses');
    r = await api('DELETE', '/api/finanzas/' + finFut, undefined, admin); r = await api('GET', '/api/finanzas/forecast', undefined, admin); assert.ok(!r.data.escenario.picos.some(p => p.fin_id === finFut)); paso('si se borra ese egreso, también sale del presupuesto');
    r = await api('GET', '/api/finanzas/forecast?costos=' + mes + '&ingresos=' + mes, undefined, admin); assert.equal(r.data.base.lineas.Alquiler, 200000); assert.equal(r.data.base.fuente_costos, mes); assert.equal(r.data.base.opciones.length, 13); assert.ok(r.data.base.alumnos >= 1); paso('el presupuesto puede copiar costos, gastos e ingresos de un mes anterior como base');
    r = await api('POST', '/api/planes', { nombre: 'Plan viejo', precio_efectivo: 1000, precio_mp: 1200 }, admin); const pv = r.data.id;
    r = await api('PUT', '/api/planes/' + pv, { activo: false }, admin); assert.equal(r.status, 200);
    r = await api('GET', '/api/planes', undefined, admin); assert.ok(!r.data.some(p => p.id === pv)); r = await api('GET', '/api/planes?todos=1', undefined, admin); assert.equal(r.data.find(p => p.id === pv).activo, 0);
    r = await api('PUT', '/api/planes/' + pv, { activo: true }, admin); r = await api('GET', '/api/planes', undefined, admin); assert.ok(r.data.some(p => p.id === pv)); paso('un plan se puede deshabilitar y habilitar sin perder el historial');
    r = await api('GET', '/api/finanzas/estado-resultados?mes=' + mes, undefined, admin); const s = r.data.sensibilidad; assert.equal(s.disponible, true); assert.ok(s.fijo_por_alumno > s.fijo_por_alumno_con_nuevo); assert.ok(s.baja_pct > 0 && s.baja_pct < 100); paso('sensibilidad de alta: un alumno nuevo baja el costo fijo por alumno (' + s.baja_pct + '%)');
    r = await api('GET', '/api/finanzas/forecast', undefined, admin); assert.ok(r.data.base.lineas.Alquiler >= 0); assert.ok(r.data.base.desde > mes);
    r = await api('PUT', '/api/finanzas/forecast', { escenario: { inflacion: 2.5, meses: [] } }, admin); r = await api('GET', '/api/finanzas/forecast', undefined, admin); assert.equal(r.data.escenario.inflacion, 2.5); paso('base y escenario del presupuesto a 12 meses se guardan');
    r = await api('GET', '/api/finanzas/estado-resultados', undefined, prof); assert.equal(r.status, 403); paso('solo el administrador ve el estado de resultados');

    console.log('Permisos por usuario');
    r = await api('GET', '/api/permisos', undefined, admin); assert.ok(r.data.arbol.some(m => m.id === 'fin') && r.data.estandar.includes('fin.caja') && !r.data.estandar.includes('fin.analisis')); paso('el administrador ve el árbol de permisos por módulo');
    r = await api('GET', '/api/permisos', undefined, prof); assert.equal(r.status, 403);
    r = await api('POST', '/api/usuarios', { rol: 'profesor', nombre: 'Estándar', username: 'estandar', password: 'estandar1' }, admin); const idEst = r.data.id;
    r = await api('POST', '/api/login', { username: 'estandar', password: 'estandar1' }); const tEst = r.data.token; assert.ok(r.data.usuario.permisos.includes('fin.egresos') && !r.data.usuario.permisos.includes('fin.resultados')); paso('un profesor nuevo parte del perfil "Profesor estándar"');
    const hoyP = hoy();
    r = await api('PUT', '/api/caja/saldo-inicial', { fecha: hoyP, monto: 5000 }, tEst); assert.equal(r.status, 200);
    r = await api('POST', '/api/caja/movimiento', { tipo: 'ingreso', concepto: 'Venta de agua', monto: 1500, fecha: hoyP }, tEst); assert.equal(r.status, 200);
    r = await api('POST', '/api/caja/movimiento', { tipo: 'egreso', concepto: 'Limpieza', monto: 800, categoria: 'Limpieza', fecha: hoyP }, tEst); assert.equal(r.status, 200); const movId = r.data.id;
    r = await api('GET', '/api/caja?fecha=' + hoyP, undefined, tEst); assert.equal(r.data.saldo_inicial, 5000); assert.ok(r.data.egresos.some(e => e.id === movId)); assert.ok(r.data.ingresos.some(i => i.concepto === 'Venta de agua')); paso('el profesor estándar registra la caja: saldo inicial, ingresos y egresos');
    r = await api('DELETE', '/api/caja/movimiento/' + movId, undefined, tEst); assert.equal(r.status, 403); paso('…pero no puede quitar movimientos si no se lo dieron');
    for (const [m, ruta] of [['GET', '/api/finanzas?mes=' + hoyP.slice(0, 7)], ['GET', '/api/finanzas/analisis?mes=' + hoyP.slice(0, 7)], ['GET', '/api/finanzas/estado-resultados'], ['GET', '/api/finanzas/forecast'], ['POST', '/api/planes'], ['GET', '/api/usuarios'], ['PUT', '/api/marca']]) { r = await api(m, ruta, m === 'GET' ? undefined : {}, tEst); assert.equal(r.status, 403, m + ' ' + ruta); }
    paso('el profesor estándar no accede al resto de Finanzas, a Usuarios ni a Ajustes');
    r = await api('POST', '/api/leads', { nombre: 'Visita Estándar', celular: '1122334455' }, tEst); assert.equal(r.status, 200);
    r = await api('POST', '/api/planificacion/generar', { desde: hoyP, dias: 1, modo: 'ia' }, tEst); assert.equal(r.status, 200); paso('el profesor estándar sí hace las tareas de CRM y Planificación');
    r = await api('POST', '/api/usuarios', { rol: 'profesor', nombre: 'Solo ingresos', username: 'soloing', password: 'soloing1', permisos: ['fin.caja', 'fin.ingresos', 'clave.inventada'] }, admin);
    r = await api('POST', '/api/login', { username: 'soloing', password: 'soloing1' }); const tIng = r.data.token; assert.deepEqual(r.data.usuario.permisos, ['fin.caja', 'fin.ingresos']);
    r = await api('POST', '/api/caja/movimiento', { tipo: 'ingreso', concepto: 'x', monto: 100, fecha: hoyP }, tIng); assert.equal(r.status, 200);
    r = await api('POST', '/api/caja/movimiento', { tipo: 'egreso', concepto: 'x', monto: 100, fecha: hoyP }, tIng); assert.equal(r.status, 403);
    r = await api('GET', '/api/clientes', undefined, tIng); assert.equal(r.status, 403); paso('los permisos se tildan de a uno y se respetan (ingresos sí, egresos y clientes no)');
    r = await api('POST', '/api/usuarios', { rol: 'profesor', nombre: 'Copia', username: 'copia', password: 'copia123', copiar_de: idEst }, admin);
    r = await api('GET', '/api/usuarios', undefined, admin); const cp = r.data.find(u => u.username === 'copia'), ad = r.data.find(u => u.rol === 'admin'); assert.deepEqual(cp.permisos.slice().sort(), r.data.find(u => u.id === idEst).permisos.slice().sort()); assert.ok(ad.permisos.includes('fin.resultados')); paso('se pueden copiar los permisos de otro profesor (o del administrador)');
    r = await api('PUT', '/api/usuarios/' + cp.id, { copiar_de: ad.id }, admin); r = await api('GET', '/api/usuarios', undefined, admin); assert.ok(r.data.find(u => u.id === cp.id).permisos.includes('fin.presupuesto'));
    r = await api('POST', '/api/login', { username: 'copia', password: 'copia123' }); r = await api('GET', '/api/finanzas/estado-resultados', undefined, r.data.token); assert.equal(r.status, 200); paso('al darle permisos de administrador a un profesor, accede a esa parte');

    console.log('\nTodo OK: ' + ok + ' verificaciones de la Versión 2');
    srv.kill(); process.exit(0);
  } catch (e) { console.error('\n✗ FALLÓ:', e.message); console.error(e.stack.split('\n').slice(0, 4).join('\n')); console.error('--- log ---\n' + log.slice(-800)); srv.kill(); process.exit(1); }
})();
