'use strict';
// Rutas de la Versión 2: país y WhatsApp, campañas, deshacer pagos, avatar, reservas, referidos y notificaciones,
// rutinas (musculación), modo de planificación manual y estado de resultados / presupuesto a 12 meses.
const { all, get, run, tx, getConfig, setConfig, PAISES } = require('./db');
const { nowAR, addDays, addMeses, dowDe, lunesDe, esFecha } = require('./util');
const planner = require('./planner');
const telefono = require('./telefono');
const ER = require('./estado-resultados');
const { intensidadDe } = require('./seed-ejercicios-v2');

const MAX_RUTINA_MIN = 180;

// ---------------------------------------------------------------- helpers compartidos (los usa api.js)
function notifPendientes() { return get("SELECT COUNT(*) AS n FROM notificaciones WHERE estado = 'pendiente'").n; }

// Si una visita que llegó por "Recomendado por" ya pagó su abono, se avisa al staff para decidir un premio al alumno que recomendó.
function chequearReferido(clienteId) {
  if (!clienteId) return;
  const l = get('SELECT * FROM leads WHERE cliente_id = ? AND referido_id IS NOT NULL AND notificado = 0 ORDER BY id DESC LIMIT 1', clienteId);
  if (!l) return;
  if (!get('SELECT 1 AS x FROM pagos WHERE cliente_id = ?', clienteId)) return;
  const nuevo = get('SELECT nombre FROM clientes WHERE id = ?', clienteId);
  const ref = get('SELECT nombre FROM clientes WHERE id = ?', l.referido_id);
  if (!nuevo || !ref) return;
  run("INSERT INTO notificaciones (tipo, titulo, detalle, lead_id, cliente_id, creado) VALUES ('referido', ?, ?, ?, ?, ?)",
    nuevo.nombre + ' se inscribió por recomendación de ' + ref.nombre,
    'Decidí si corresponde aplicarle un premio o descuento a ' + ref.nombre + ' por haber recomendado el gimnasio.', l.id, l.referido_id, new Date().toISOString());
  run('UPDATE leads SET notificado = 1 WHERE id = ?', l.id);
}
function alRegistrarPago(clienteId) { chequearReferido(clienteId); }

// Reservas de una clase: son solo informativas (no bloquean). Si superan el límite de materiales se avisa al staff.
function reservasDeClase(fecha, hora, formato, user) {
  const total = get('SELECT COUNT(*) AS n FROM reservas WHERE fecha = ? AND hora = ?', fecha, hora).n;
  const f = formato && formato.id ? get('SELECT * FROM formatos WHERE id = ?', formato.id) : null;
  const limite = planner.cfgFormato(f).capacidad;
  const reservada = !!(user && user.rol === 'cliente' && user.cliente_id && get('SELECT 1 AS x FROM reservas WHERE cliente_id = ? AND fecha = ? AND hora = ?', user.cliente_id, fecha, hora));
  return { total, limite, exceso: Math.max(0, total - limite), reservada };
}

function rutinaCompleta(id) {
  const r = get('SELECT * FROM rutinas WHERE id = ?', id);
  if (!r) return null;
  const items = all(`SELECT i.id, i.orden, i.ejercicio_id, COALESCE(e.zona, i.zona) AS zona, e.nombre, e.equipo, e.patron, i.series, i.repeticiones, i.peso, i.descanso_seg, i.seg_serie
    FROM rutina_items i LEFT JOIN ejercicios e ON e.id = i.ejercicio_id WHERE i.rutina_id = ? ORDER BY i.orden, i.id`, id);
  return { id: r.id, nombre: r.nombre, descripcion: r.descripcion || '', duracion_min: r.duracion_min, items };
}
function rutinaDeDia(fecha, formatoId) {
  const a = get('SELECT rutina_id FROM rutina_dia WHERE fecha = ? AND formato_id = ?', fecha, formatoId || 0);
  return a ? rutinaCompleta(a.rutina_id) : null;
}
// Rutinas personalizadas: cada cliente tiene las suyas, repetidas los días de la semana que se elijan (1 = lunes … 6 = sábado)
// Un egreso con fecha futura cargado en "Análisis del mes" no es un gasto real todavía: pasa al Presupuesto de 12 meses como pico puntual
function enviarAPresupuesto(fecha, categoria, monto, concepto, devengar, finId) {
  let esc = null; try { const j = getConfig('forecast', ''); esc = j ? JSON.parse(j) : null; } catch (_) { esc = null; }
  if (!esc || typeof esc !== 'object') esc = { meses: [], picos: [] };
  if (!Array.isArray(esc.picos)) esc.picos = [];
  const n = Math.max(1, devengar || 1), linea = ER.linea(categoria).nombre, mes0 = fecha.slice(0, 7);
  for (let i = 0; i < n; i++) esc.picos.push({ mes: ER.mesMas(mes0, i), linea, monto: Math.round(monto / n), concepto: concepto || categoria, origen: 'analisis', fin_id: finId || null });
  setConfig('forecast', JSON.stringify(esc));
  return mes0;
}
function quitarDePresupuesto(finId) {
  let esc = null; try { const j = getConfig('forecast', ''); esc = j ? JSON.parse(j) : null; } catch (_) { esc = null; }
  if (!esc || !Array.isArray(esc.picos)) return;
  const n = esc.picos.length; esc.picos = esc.picos.filter(p => p.fin_id !== finId);
  if (esc.picos.length !== n) setConfig('forecast', JSON.stringify(esc));
}
function rutinasDeCliente(clienteId, fecha) {
  const dow = dowDe(fecha);
  return all('SELECT rc.rutina_id, rc.dias FROM rutina_clientes rc JOIN rutinas r ON r.id = rc.rutina_id WHERE rc.cliente_id = ? AND r.activo = 1 ORDER BY rc.id', clienteId)
    .filter(x => String(x.dias).split(',').map(Number).includes(dow)).map(x => rutinaCompleta(x.rutina_id));
}
const duracionItems = (items) => Math.round(items.reduce((a, i) => a + i.series * (i.seg_serie + i.descanso_seg), 0) / 60);

// ---------------------------------------------------------------- rutas
function registrar(c) {
  const { route, ADM, STAFF, TODOS, HttpError, bad, readBody, str, num, requireFecha, validarFoto, normTel, bajaEfectiva } = c;
  const prefijo = () => getConfig('prefijo', '54');
  const paisActual = () => { const p = PAISES.find(x => x[0] === getConfig('pais', 'AR')) || PAISES[0]; return { codigo: p[0], nombre: p[1], prefijo: getConfig('prefijo', p[2]), bandera: p[3] }; };

  // --- País y WhatsApp del gimnasio
  const configPais = () => {
    const w = getConfig('whatsapp_gym', '');
    return { ...paisActual(), whatsapp_gym: w, whatsapp_gym_link: telefono.enlaceWA(w, prefijo()), paises: PAISES.map(p => ({ codigo: p[0], nombre: p[1], prefijo: p[2], bandera: p[3] })) };
  };
  route('GET', '/api/config-pais', TODOS, () => configPais());
  route('PUT', '/api/config-pais', ADM, async ({ req }) => {
    const b = await readBody(req);
    if (b.pais !== undefined) {
      const p = PAISES.find(x => x[0] === String(b.pais));
      if (!p) throw bad('País inválido');
      setConfig('pais', p[0]); setConfig('prefijo', p[2]);
    }
    if (b.whatsapp_gym !== undefined) setConfig('whatsapp_gym', normTel(str(b.whatsapp_gym, 40)));
    return configPais();
  });
  route('POST', '/api/config-pais/estandarizar', ADM, () => {
    let cl = 0, ld = 0;
    tx(() => {
      for (const x of all("SELECT id, celular FROM clientes WHERE COALESCE(celular,'') <> ''")) { const n = normTel(x.celular); if (n && n !== x.celular) { run('UPDATE clientes SET celular = ? WHERE id = ?', n, x.id); cl++; } }
      for (const x of all("SELECT id, telefono FROM leads WHERE COALESCE(telefono,'') <> ''")) { const n = normTel(x.telefono); if (n && n !== x.telefono) { run('UPDATE leads SET telefono = ? WHERE id = ?', n, x.id); ld++; } }
    });
    return { clientes: cl, visitas: ld };
  });

  // --- Campañas de captación
  route('GET', '/api/campanas', STAFF, ({ query }) => all('SELECT c.*, (SELECT COUNT(*) FROM leads l WHERE l.campana_id = c.id) AS visitas FROM campanas c ' + (query.todas ? '' : 'WHERE c.activo = 1 ') + 'ORDER BY c.id'));
  route('POST', '/api/campanas', ADM, async ({ req }) => {
    const b = await readBody(req);
    const nombre = str(b.nombre, 60); if (!nombre) throw bad('Escribí el nombre de la campaña');
    if (get('SELECT 1 AS x FROM campanas WHERE nombre = ? COLLATE NOCASE AND activo = 1', nombre)) throw bad('Ya existe esa campaña');
    const r = run('INSERT INTO campanas (nombre, tipo) VALUES (?,?)', nombre, b.tipo === 'recomendado' ? 'recomendado' : 'normal');
    return { id: Number(r.lastInsertRowid) };
  });
  route('PUT', '/api/campanas/:id', ADM, async ({ req, params }) => {
    const b = await readBody(req);
    const x = get('SELECT * FROM campanas WHERE id = ?', Number(params.id));
    if (!x) throw new HttpError(404, 'Campaña no encontrada');
    run('UPDATE campanas SET nombre = ?, tipo = ?, activo = ? WHERE id = ?', str(b.nombre ?? x.nombre, 60) || x.nombre, (b.tipo ?? x.tipo) === 'recomendado' ? 'recomendado' : 'normal', b.activo === undefined ? x.activo : (b.activo ? 1 : 0), x.id);
    return { ok: true };
  });
  route('DELETE', '/api/campanas/:id', ADM, ({ params }) => {
    const id = Number(params.id);
    if (get('SELECT 1 AS x FROM leads WHERE campana_id = ?', id)) run('UPDATE campanas SET activo = 0 WHERE id = ?', id); else run('DELETE FROM campanas WHERE id = ?', id);
    return { ok: true };
  });

  // --- Deshacer un pago cargado por error (rollback): vuelve la fecha de baja y borra el ingreso de la Caja / del reporte
  route('POST', '/api/pagos/:id/anular', STAFF, ({ params }) => {
    const p = get('SELECT * FROM pagos WHERE id = ?', Number(params.id));
    if (!p) throw new HttpError(404, 'Pago no encontrado');
    const cli = get('SELECT * FROM clientes WHERE id = ?', p.cliente_id);
    let meses = p.meses;
    if (!meses) { const m = /\((\d+) mes/.exec(p.concepto || ''); meses = m ? Number(m[1]) : 1; }
    const antes = cli ? bajaEfectiva(cli) : null;
    // se vuelve exactamente a la fecha de baja que tenía antes del pago (no se resta un mes a ciegas)
    const nueva = cli && antes ? (p.baja_anterior && antes === p.cubre_hasta ? p.baja_anterior : addMeses(antes, -meses)) : null;
    const fin = get('SELECT en_caja, medio FROM finanzas WHERE pago_id = ?', p.id);
    tx(() => {
      run('DELETE FROM finanzas WHERE pago_id = ?', p.id);
      run('DELETE FROM pagos WHERE id = ?', p.id);
      if (cli && nueva) run('UPDATE clientes SET fecha_baja = ? WHERE id = ?', nueva, cli.id);
      // si el cartel "Falta registrar pago" estaba activo cuando se cargó este pago, vuelve a mostrarse hasta que haya un pago definitivo
      let vuelve = p.falta_antes === 1;
      if (p.falta_antes == null && cli && nueva && nueva > nowAR().fecha) vuelve = !get('SELECT 1 AS x FROM pagos WHERE cliente_id = ? AND cubre_hasta >= ?', cli.id, nueva);
      if (cli && vuelve) run('UPDATE clientes SET falta_pago = 1 WHERE id = ?', cli.id);
    });
    return { ok: true, falta_pago: !!(cli && get('SELECT falta_pago FROM clientes WHERE id = ?', cli.id).falta_pago), fecha_baja: nueva, meses, monto: p.monto, de_caja: !!(fin && fin.en_caja), medio: fin ? fin.medio : p.metodo };
  });

  // --- Avatar del alumno (foto de la cámara o de la galería, ya reducida por el celular)
  route('PUT', '/api/mi-perfil/foto', ['cliente'], async ({ req, user }) => {
    if (!user.cliente_id) throw bad('Usuario sin ficha de alumno');
    const b = await readBody(req, 2 * 1024 * 1024);
    run('UPDATE clientes SET foto = ? WHERE id = ?', validarFoto(b.foto), user.cliente_id);
    return { ok: true };
  });

  // --- Reservas (informativas: sin bloqueos ni penalidades)
  const horaClase = (fecha, hora) => {
    const a = get('SELECT formato_id FROM agenda WHERE dia = ? AND hora = ?', dowDe(fecha), hora);
    if (!a || !a.formato_id) throw bad('Ese día no hay clase en ese horario');
    return a.formato_id;
  };
  route('POST', '/api/reservas', ['cliente'], async ({ req, user }) => {
    if (!user.cliente_id) throw bad('Usuario sin ficha de alumno');
    const b = await readBody(req);
    const fecha = requireFecha(b.fecha), hora = parseInt(b.hora, 10);
    const ahora = nowAR();
    if (fecha < ahora.fecha || (fecha === ahora.fecha && hora < ahora.hora)) throw bad('Esa clase ya pasó');
    const fid = horaClase(fecha, hora);
    run('INSERT OR IGNORE INTO reservas (cliente_id, fecha, hora, creado) VALUES (?,?,?,?)', user.cliente_id, fecha, hora, new Date().toISOString());
    const r = reservasDeClase(fecha, hora, { id: fid }, user);
    return { ok: true, reservas: r.total, reservada: true };
  });
  route('POST', '/api/reservas/cancelar', ['cliente'], async ({ req, user }) => {
    const b = await readBody(req);
    run('DELETE FROM reservas WHERE cliente_id = ? AND fecha = ? AND hora = ?', user.cliente_id, requireFecha(b.fecha), parseInt(b.hora, 10));
    return { ok: true };
  });
  route('GET', '/api/reservas/mias', ['cliente'], ({ user }) => {
    const hoy = nowAR().fecha;
    return all('SELECT fecha, hora FROM reservas WHERE cliente_id = ? AND fecha >= ? ORDER BY fecha, hora', user.cliente_id, hoy);
  });
  // listado para el staff: quién reservó cada horario y si se pasa del límite de materiales
  route('GET', '/api/reservas/dia', STAFF, ({ query }) => {
    const fecha = query.fecha && esFecha(query.fecha) ? query.fecha : nowAR().fecha;
    const horas = all('SELECT DISTINCT hora FROM reservas WHERE fecha = ? ORDER BY hora', fecha).map(r => r.hora);
    return { fecha, horas: horas.map(h => {
      const a = get('SELECT formato_id FROM agenda WHERE dia = ? AND hora = ?', dowDe(fecha), h);
      const f = a && a.formato_id ? get('SELECT id, nombre, color FROM formatos WHERE id = ?', a.formato_id) : null;
      const r = reservasDeClase(fecha, h, f);
      return { hora: h, formato: f, total: r.total, limite: r.limite, exceso: r.exceso,
        alumnos: all('SELECT c.id, c.nombre FROM reservas r JOIN clientes c ON c.id = r.cliente_id WHERE r.fecha = ? AND r.hora = ? ORDER BY r.id', fecha, h) };
    }) };
  });

  // --- Notificaciones del staff (premios por referidos)
  route('GET', '/api/notificaciones', STAFF, ({ query }) => ({
    pendientes: notifPendientes(),
    items: all('SELECT n.*, c.nombre AS alumno FROM notificaciones n LEFT JOIN clientes c ON c.id = n.cliente_id ' + (query.todas ? '' : "WHERE n.estado = 'pendiente' ") + 'ORDER BY n.id DESC LIMIT 100'),
  }));
  route('PUT', '/api/notificaciones/:id', STAFF, async ({ req, params }) => {
    const b = await readBody(req);
    const n = get('SELECT * FROM notificaciones WHERE id = ?', Number(params.id));
    if (!n) throw new HttpError(404, 'Notificación no encontrada');
    run("UPDATE notificaciones SET estado = 'resuelta', resolucion = ? WHERE id = ?", str(b.resolucion, 200) || 'Resuelta', n.id);
    return { ok: true, pendientes: notifPendientes() };
  });

  // --- Modo de planificación: con IA o manual
  route('GET', '/api/planificacion/modo', STAFF, () => ({ modo: planner.modoPlanificacion() }));
  route('PUT', '/api/planificacion/modo', STAFF, async ({ req }) => {
    const b = await readBody(req);
    setConfig('modo_planificacion', b.modo === 'manual' ? 'manual' : 'ia');
    return { modo: planner.modoPlanificacion() };
  });

  // --- Rutinas (musculación: series, repeticiones, peso, descanso y zona). Duración máxima: 180 minutos.
  const itemsDe = (b) => {
    if (!Array.isArray(b.items) || !b.items.length) throw bad('Agregá al menos un ejercicio a la rutina');
    if (b.items.length > 60) throw bad('Máximo 60 ejercicios por rutina');
    return b.items.map((x, i) => {
      const ej = get('SELECT id, zona FROM ejercicios WHERE id = ? AND activo = 1', Number(x.ejercicio_id));
      if (!ej) throw bad('El ejercicio ' + (i + 1) + ' no existe');
      const series = Math.max(1, Math.min(20, parseInt(x.series || 3, 10) || 3));
      const desc = Math.max(0, Math.min(600, parseInt(x.descanso_seg ?? 60, 10) || 0));
      const seg = Math.max(10, Math.min(300, parseInt(x.seg_serie || 40, 10) || 40));
      return { ejercicio_id: ej.id, zona: ej.zona, series, repeticiones: str(x.repeticiones, 20) || '10', peso: str(x.peso, 20), descanso_seg: desc, seg_serie: seg };
    });
  };
  const guardarRutina = (id, b) => {
    const nombre = str(b.nombre, 80); if (!nombre) throw bad('Escribí el nombre de la rutina');
    const items = itemsDe(b);
    const dur = duracionItems(items);
    if (dur > MAX_RUTINA_MIN) throw bad('La rutina dura ' + dur + ' minutos y el máximo es ' + MAX_RUTINA_MIN + '. Sacá ejercicios, series o descansos.');
    return tx(() => {
      if (id) { run('UPDATE rutinas SET nombre = ?, descripcion = ?, duracion_min = ? WHERE id = ?', nombre, str(b.descripcion, 300) || null, dur, id); run('DELETE FROM rutina_items WHERE rutina_id = ?', id); }
      else id = Number(run('INSERT INTO rutinas (nombre, descripcion, duracion_min, creado) VALUES (?,?,?,?)', nombre, str(b.descripcion, 300) || null, dur, new Date().toISOString()).lastInsertRowid);
      items.forEach((x, i) => run('INSERT INTO rutina_items (rutina_id, orden, ejercicio_id, zona, series, repeticiones, peso, descanso_seg, seg_serie) VALUES (?,?,?,?,?,?,?,?,?)', id, i + 1, x.ejercicio_id, x.zona, x.series, x.repeticiones, x.peso, x.descanso_seg, x.seg_serie));
      return { id, duracion_min: dur };
    });
  };
  route('GET', '/api/rutinas', STAFF, () => all('SELECT r.*, (SELECT COUNT(*) FROM rutina_items i WHERE i.rutina_id = r.id) AS ejercicios FROM rutinas r WHERE r.activo = 1 ORDER BY r.nombre COLLATE NOCASE'));
  const DIAS_TXT = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  const asignacionesSql = `SELECT rc.id, rc.rutina_id, rc.cliente_id, rc.dias, r.nombre AS rutina, r.duracion_min, c.nombre AS cliente
    FROM rutina_clientes rc JOIN rutinas r ON r.id = rc.rutina_id AND r.activo = 1 JOIN clientes c ON c.id = rc.cliente_id`;
  const conDias = (x) => ({ ...x, dias: String(x.dias).split(',').map(Number), dias_txt: String(x.dias).split(',').map(d => DIAS_TXT[Number(d)]).join(', ') });
  route('GET', '/api/rutinas/asignaciones', STAFF, ({ query }) => {
    const cid = Number(query.cliente_id || 0), rid = Number(query.rutina_id || 0);
    return all(asignacionesSql + ' WHERE (? = 0 OR rc.cliente_id = ?) AND (? = 0 OR rc.rutina_id = ?) ORDER BY c.nombre COLLATE NOCASE, r.nombre', cid, cid, rid, rid).map(conDias);
  });
  route('POST', '/api/rutinas/asignar', STAFF, async ({ req }) => {
    const b = await readBody(req);
    const rutina = get('SELECT id FROM rutinas WHERE id = ? AND activo = 1', Number(b.rutina_id)); if (!rutina) throw bad('Elegí una rutina');
    const ids = [...new Set((Array.isArray(b.cliente_ids) ? b.cliente_ids : []).map(Number).filter(n => n > 0))];
    if (!ids.length) throw bad('Elegí al menos un cliente');
    const dias = [...new Set((Array.isArray(b.dias) ? b.dias : []).map(Number).filter(n => n >= 1 && n <= 7))].sort((a, z) => a - z);
    if (!dias.length) throw bad('Marcá al menos un día de la semana');
    let n = 0;
    tx(() => ids.forEach(cid => {
      if (!get('SELECT 1 AS x FROM clientes WHERE id = ?', cid)) return;
      run('INSERT INTO rutina_clientes (rutina_id, cliente_id, dias, creado) VALUES (?,?,?,?) ON CONFLICT(rutina_id, cliente_id) DO UPDATE SET dias = excluded.dias', rutina.id, cid, dias.join(','), new Date().toISOString()); n++;
    }));
    return { ok: true, asignados: n };
  });
  route('DELETE', '/api/rutinas/asignaciones/:id', STAFF, ({ params }) => { run('DELETE FROM rutina_clientes WHERE id = ?', Number(params.id)); return { ok: true }; });
  route('GET', '/api/rutinas/asignadas', STAFF, ({ query }) => {
    const desde = query.desde && esFecha(query.desde) ? query.desde : lunesDe(nowAR().fecha);
    return all('SELECT d.id, d.fecha, d.formato_id, d.rutina_id, r.nombre AS rutina FROM rutina_dia d JOIN rutinas r ON r.id = d.rutina_id WHERE d.fecha BETWEEN ? AND ? ORDER BY d.fecha', desde, addDays(desde, 13));
  });
  route('GET', '/api/rutinas/:id', STAFF, ({ params }) => { const r = rutinaCompleta(Number(params.id)); if (!r) throw new HttpError(404, 'Rutina no encontrada'); return r; });
  route('POST', '/api/rutinas', STAFF, async ({ req }) => guardarRutina(null, await readBody(req)));
  route('PUT', '/api/rutinas/:id', STAFF, async ({ req, params }) => {
    if (!get('SELECT 1 AS x FROM rutinas WHERE id = ?', Number(params.id))) throw new HttpError(404, 'Rutina no encontrada');
    return guardarRutina(Number(params.id), await readBody(req));
  });
  route('DELETE', '/api/rutinas/:id', STAFF, ({ params }) => {
    const id = Number(params.id);
    tx(() => { run('UPDATE rutinas SET activo = 0 WHERE id = ?', id); run('DELETE FROM rutina_dia WHERE rutina_id = ?', id); run('DELETE FROM rutina_clientes WHERE rutina_id = ?', id); });
    return { ok: true };
  });
  // asigna una rutina a un día (a la pestaña de un formato, o "Rutina" si formato_id = 0)
  route('PUT', '/api/rutinas-dia', STAFF, async ({ req }) => {
    const b = await readBody(req);
    const fecha = requireFecha(b.fecha), fid = b.formato_id ? Number(b.formato_id) : 0;
    if (!b.rutina_id) { run('DELETE FROM rutina_dia WHERE fecha = ? AND formato_id = ?', fecha, fid); return { ok: true }; }
    if (!get('SELECT 1 AS x FROM rutinas WHERE id = ? AND activo = 1', Number(b.rutina_id))) throw bad('Rutina inexistente');
    run('INSERT INTO rutina_dia (fecha, formato_id, rutina_id) VALUES (?,?,?) ON CONFLICT(fecha, formato_id) DO UPDATE SET rutina_id = excluded.rutina_id', fecha, fid, Number(b.rutina_id));
    return { ok: true };
  });

  // --- Finanzas: estado de resultados, sensibilidad de alta y presupuesto de 12 meses
  const mesQ = (q) => (/^\d{4}-\d{2}$/.test(q.mes || '') ? q.mes : nowAR().fecha.slice(0, 7));
  route('GET', '/api/finanzas/estado-resultados', ADM, ({ query }) => {
    const hoyMes = nowAR().fecha.slice(0, 7);
    const mes = mesQ(query) > hoyMes ? hoyMes : mesQ(query), n = Math.max(1, Math.min(13, parseInt(query.meses || 1, 10) || 1)); // nunca posterior al mes corriente; hasta 12 meses anteriores
    const columnas = ER.rolling(mes, n);
    const actual = columnas[columnas.length - 1];
    const activos = c.listaClientes({ rol: 'profesor' }).filter(x => x.semaforo_alta === 'verde').length;
    return { mes, meses: n, columnas, sensibilidad: ER.sensibilidad(actual, activos), activos };
  });
  const leerEscenario = () => { try { const j = getConfig('forecast', ''); return j ? JSON.parse(j) : null; } catch (_) { return null; } };
  route('GET', '/api/finanzas/forecast', ADM, ({ query }) => {
    const mes = nowAR().fecha.slice(0, 7);
    const escenario = leerEscenario();
    const bc = query.costos !== undefined ? query.costos : (escenario && escenario.base_costos), bi = query.ingresos !== undefined ? query.ingresos : (escenario && escenario.base_ingresos);
    return { base: ER.baseForecast(mes, { costos: bc, ingresos: bi }), escenario, hoy: mes };
  });
  route('PUT', '/api/finanzas/forecast', ADM, async ({ req }) => {
    const b = await readBody(req, 256 * 1024);
    const j = JSON.stringify(b.escenario || null);
    if (j.length > 100 * 1024) throw bad('El escenario es demasiado grande');
    setConfig('forecast', j);
    return { ok: true };
  });
}

module.exports = { registrar, rutinasDeCliente, enviarAPresupuesto, quitarDePresupuesto, notifPendientes, chequearReferido, alRegistrarPago, reservasDeClase, rutinaDeDia, rutinaCompleta, intensidadDe, MAX_RUTINA_MIN };
