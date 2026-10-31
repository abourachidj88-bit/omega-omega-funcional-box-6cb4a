'use strict';
// Lógica de la aplicación (rutas de la API). No depende de http ni del sistema de archivos,
// así que corre igual en el servidor y en la versión de prueba dentro del navegador.
const crypto = require('node:crypto');
const { all, get, run, tx, getConfig, setConfig, ZONAS } = require('./db');
const { hashPassword, verifyPassword, emitirSesion, usuarioDeToken, emitirQR, validarQR } = require('./auth');
const { nowAR, addDays, diffDays, dowDe, lunesDe, addMeses, mesesEntre, esFecha } = require('./util');
const { bajaEfectiva, semaforoAlta, semaforoAsistencia } = require('./semaforos');
const planner = require('./planner');
const semana = require('./semana');
const estim = require('./estimulos');
const backup = require('./backup');
const VERSION = require('./version');
const sync = require('./sync');
const v1 = require('./api-v1');
const v2 = require('./api-v2');
const telefono = require('./telefono');
const permisos = require('./permisos');
const normTel = (v) => telefono.normalizar(v, getConfig('prefijo', '54'));
const { PATRON_ZONA } = require('./seed-ejercicios-v1');

class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const bad = (m) => new HttpError(400, m);
const forbidden = () => new HttpError(403, 'No tenés permiso para esta acción');
const readBody = (req, limit) => (req.readJson ? req.readJson(limit) : Promise.resolve({}));

// ------------------------------------------------------------ validaciones
const str = (v, max = 200) => (v == null ? '' : String(v).trim().slice(0, max));
const num = (v, def = 0) => { const n = Number(String(v).replace(',', '.')); return Number.isFinite(n) ? n : def; };
function fechaOpc(v) { if (v == null || v === '') return null; if (!esFecha(v)) throw bad('Fecha inválida: ' + v); return v; }
function requireFecha(v, nombre = 'fecha') { if (!esFecha(v)) throw bad('Falta la ' + nombre + ' (AAAA-MM-DD)'); return v; }
function soloDigitos(s) { return String(s || '').replace(/\D/g, ''); }

const intentos = new Map();
function limitarLogin(clave) {
  const ahora = Date.now();
  const l = (intentos.get(clave) || []).filter(t => ahora - t < 10 * 60 * 1000);
  intentos.set(clave, l);
  return l.length >= 10;
}

// ------------------------------------------------------------ clientes
function ultimaAsist(cid) {
  return get('SELECT fecha, hora FROM asistencias WHERE cliente_id = ? ORDER BY fecha DESC, hora DESC LIMIT 1', cid);
}
function enriquecerCliente(c, hoy, ultima, total, user) {
  const sa = semaforoAlta(c, hoy);
  const ss = semaforoAsistencia(ultima ? ultima.fecha : null, c, hoy);
  const out = {
    id: c.id, nombre: c.nombre, foto: c.foto || null, fecha_alta: c.fecha_alta, fecha_baja: bajaEfectiva(c),
    celular: c.celular || '', instagram: c.instagram || '', falta_pago: !!c.falta_pago && semaforoAlta(c, hoy).color === 'verde',
    ultima_clase: ultima ? ultima.fecha + ' ' + String(ultima.hora).padStart(2, '0') + ':00' : null,
    total_asistencias: total || 0,
    semaforo_alta: sa.color, estado_alta: sa.estado, meses_baja: sa.mesesBaja, dias_baja: sa.diasBaja,
    semaforo_asistencia: ss.color, texto_asistencia: ss.texto, semanas_sin_entrenar: ss.semanasSin,
  };
  if (user.rol === 'admin') { out.precio_plan = c.precio_plan; out.plan_id = c.plan_id || null; }
  return out;
}
function listaClientes(user) {
  const hoy = nowAR().fecha;
  const rows = all(`SELECT c.*,
     (SELECT MAX(fecha) FROM asistencias a WHERE a.cliente_id = c.id) AS u_fecha,
     (SELECT hora FROM asistencias a WHERE a.cliente_id = c.id ORDER BY fecha DESC, hora DESC LIMIT 1) AS u_hora,
     (SELECT COUNT(*) FROM asistencias a WHERE a.cliente_id = c.id) AS total
     FROM clientes c ORDER BY c.nombre COLLATE NOCASE`);
  return rows.map(r => enriquecerCliente(r, hoy, r.u_fecha ? { fecha: r.u_fecha, hora: r.u_hora } : null, r.total, user));
}
function detalleCliente(id, user) {
  const c = get('SELECT * FROM clientes WHERE id = ?', id);
  if (!c) throw new HttpError(404, 'Cliente no encontrado');
  const hoy = nowAR().fecha;
  const ult = ultimaAsist(id);
  const total = get('SELECT COUNT(*) AS n FROM asistencias WHERE cliente_id = ?', id).n;
  const base = enriquecerCliente(c, hoy, ult, total, user);
  const asist = all(`SELECT a.id, a.fecha, a.hora, a.origen, f.nombre AS formato FROM asistencias a
     LEFT JOIN sesiones s ON s.id = a.sesion_id LEFT JOIN formatos f ON f.id = s.formato_id
     WHERE a.cliente_id = ? ORDER BY a.fecha DESC, a.hora DESC LIMIT 200`, id);
  // asistencias por semana (últimas 12) contra el objetivo de 3 por semana
  const lunesHoy = lunesDe(hoy);
  const semanas = [];
  for (let i = 11; i >= 0; i--) {
    const ini = addDays(lunesHoy, -7 * i), fin = addDays(ini, 6);
    const n = get('SELECT COUNT(*) AS n FROM asistencias WHERE cliente_id = ? AND fecha BETWEEN ? AND ?', id, ini, fin).n;
    semanas.push({ desde: ini, asistencias: n });
  }
  const mensual = all("SELECT substr(fecha,1,7) AS mes, COUNT(*) AS n FROM asistencias WHERE cliente_id = ? GROUP BY mes ORDER BY mes DESC LIMIT 12", id).reverse();
  const activas = semanas.slice(Math.max(0, semanas.findIndex(s => addDays(s.desde, 6) >= c.fecha_alta)));
  const cumpl = activas.length ? Math.round(100 * activas.reduce((a, s) => a + Math.min(s.asistencias, 3), 0) / (3 * activas.length)) : 0;
  const out = { ...base, asistencias: asist, semanas, mensual, cumplimiento_objetivo: cumpl, objetivo_semanal: 3 };
  const u = get('SELECT username FROM usuarios WHERE cliente_id = ?', id);
  out.usuario = u ? u.username : null;
  if (user.rol === 'admin' || user.rol === 'profesor') { const dp = c.desc_id && c.desc_restantes > 0 ? get('SELECT id, nombre, tipo, valor, meses FROM descuentos WHERE id = ?', c.desc_id) : null; out.descuento_pendiente = dp ? { ...dp, restantes: c.desc_restantes } : null; out.precio_plan = c.precio_plan; out.pagos = all('SELECT id, fecha, monto, plan_full, descuento, descuento_nombre, concepto, cubre_hasta, metodo, meses FROM pagos WHERE cliente_id = ? ORDER BY fecha DESC, id DESC', id); out.plan_id = c.plan_id || null; }
  return out;
}
const CLAVE_INICIAL = '12345678';
function slugUsuario(nombre) {
  // formato nombre.apellido (minúsculas, sin acentos ni espacios): primera y última palabra del nombre completo
  const limpio = nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9\s]+/g, ' ').trim().split(/\s+/).filter(Boolean);
  const base = (limpio.length > 1 ? limpio[0] + '.' + limpio[limpio.length - 1] : limpio[0]) || 'alumno';
  let u = base, i = 1;
  while (get('SELECT 1 AS x FROM usuarios WHERE username = ?', u)) { i++; u = base + i; }
  return u;
}
function claveInicial() { return CLAVE_INICIAL; }
function crearAccesoCliente(cid, nombre, celular) {
  const username = slugUsuario(nombre);
  const clave = claveInicial(celular);
  run('INSERT INTO usuarios (username, password_hash, rol, nombre, cliente_id, creado) VALUES (?,?,?,?,?,?)', username, hashPassword(clave), 'cliente', nombre, cid, new Date().toISOString());
  return { usuario: username, clave };
}
function validarFoto(f) {
  if (f == null || f === '') return null;
  if (typeof f !== 'string' || !/^data:image\/(png|jpe?g|webp);base64,/.test(f)) throw bad('Foto inválida');
  if (f.length > 600 * 1024) throw bad('La foto es demasiado pesada');
  return f;
}
function crearCliente(b, user) {
  const nombre = str(b.nombre, 120);
  if (!nombre) throw bad('El nombre y apellido es obligatorio');
  const alta = requireFecha(b.fecha_alta || nowAR().fecha, 'fecha de alta');
  const precio = user.rol === 'admin' ? Math.max(0, num(b.precio_plan)) : 0;
  const baja = fechaOpc(b.fecha_baja) || addMeses(alta, 1);
  const planId = user.rol === 'admin' && b.plan_id ? Number(b.plan_id) : null;
  const r = run('INSERT INTO clientes (nombre, foto, fecha_alta, precio_plan, fecha_baja, celular, instagram, creado, plan_id) VALUES (?,?,?,?,?,?,?,?,?)',
    nombre, validarFoto(b.foto), alta, precio, baja, normTel(str(b.celular, 40)) || null, str(b.instagram, 60).replace(/^@/, '') || null, new Date().toISOString(), planId);
  const id = Number(r.lastInsertRowid);
  let acceso = null;
  if (b.crear_acceso !== false) acceso = crearAccesoCliente(id, nombre, b.celular);
  // Pago del alta (opcional): si se elige el medio de pago queda registrado y, si es efectivo, entra a la caja
  if (user.rol === 'admin' && b.metodo_pago) {
    const metodo = validarMetodo(b.metodo_pago);
    const monto = b.monto !== undefined && b.monto !== '' ? Math.max(0, num(b.monto)) : precio;
    registrarPago(id, nombre, monto, metodo, 'Alta de plan', alta, baja, planId, { meses: Math.max(1, mesesEntre(alta, baja)), bajaAnterior: alta });
  }
  // si el alumno había dejado sus datos como visita, la visita queda convertida
  const dig = soloDigitos(b.celular);
  if (dig.length >= 8) {
    const lead = get("SELECT id FROM leads WHERE cliente_id IS NULL AND substr(REPLACE(REPLACE(REPLACE(COALESCE(telefono,''),' ',''),'-',''),'+',''), -8) = ? ORDER BY id DESC LIMIT 1", dig.slice(-8));
    if (lead) run("UPDATE leads SET cliente_id = ?, estado = 'convertido' WHERE id = ?", id, lead.id);
    if (lead) v2.chequearReferido(id);
  }
  return { id, acceso };
}
function actualizarCliente(id, b, user) {
  const c = get('SELECT * FROM clientes WHERE id = ?', id);
  if (!c) throw new HttpError(404, 'Cliente no encontrado');
  const nombre = b.nombre !== undefined ? str(b.nombre, 120) : c.nombre;
  if (!nombre) throw bad('El nombre y apellido es obligatorio');
  const foto = b.foto !== undefined ? validarFoto(b.foto) : c.foto;
  const alta = b.fecha_alta ? requireFecha(b.fecha_alta, 'fecha de alta') : c.fecha_alta;
  const baja = b.fecha_baja !== undefined ? (fechaOpc(b.fecha_baja) || addMeses(alta, 1)) : c.fecha_baja;
  const precio = user.rol === 'admin' && b.precio_plan !== undefined ? Math.max(0, num(b.precio_plan)) : c.precio_plan;
  // Alerta de deuda: se corrió la fecha de baja hacia adelante a mano y no hay un pago registrado hoy
  let faltaPago = c.falta_pago;
  if (b.fecha_baja !== undefined && baja > bajaEfectiva(c)) {
    const hoy = nowAR().fecha;
    if (!get('SELECT 1 AS x FROM pagos WHERE cliente_id = ? AND fecha >= ?', id, hoy)) faltaPago = 1;
  }
  run('UPDATE clientes SET nombre=?, foto=?, fecha_alta=?, precio_plan=?, fecha_baja=?, celular=?, instagram=?, plan_id=?, falta_pago=? WHERE id=?',
    nombre, foto, alta, precio, baja,
    b.celular !== undefined ? (normTel(str(b.celular, 40)) || null) : c.celular,
    b.instagram !== undefined ? (str(b.instagram, 60).replace(/^@/, '') || null) : c.instagram,
    user.rol === 'admin' && b.plan_id !== undefined ? (b.plan_id ? Number(b.plan_id) : null) : c.plan_id, faltaPago, id);
  run('UPDATE usuarios SET nombre = ? WHERE cliente_id = ?', nombre, id);
}
function validarMetodo(m) {
  const v = String(m || '').toLowerCase().replace(/\s+/g, '');
  if (v === 'efectivo') return 'efectivo';
  if (v === 'mercadopago' || v === 'mp') return 'mercadopago';
  throw bad('Elegí el método de pago: Efectivo o Mercado Pago');
}
const NOMBRE_METODO = { efectivo: 'Efectivo', mercadopago: 'Mercado Pago' };
// Registra un cobro de cuota: ficha de pagos + ingreso financiero. Solo el efectivo mueve la caja física.
function registrarPago(clienteId, nombreCliente, monto, metodo, concepto, fecha, cubreHasta, planId, extra = {}) {
  const antes = get('SELECT falta_pago FROM clientes WHERE id = ?', clienteId);
  const p = run('INSERT INTO pagos (cliente_id, fecha, monto, concepto, cubre_hasta, metodo, plan_id, meses, baja_anterior) VALUES (?,?,?,?,?,?,?,?,?)', clienteId, fecha, monto, concepto, cubreHasta, metodo, planId || null, extra.meses || null, extra.bajaAnterior || null);
  run('UPDATE pagos SET falta_antes = ?, plan_full = ?, descuento = ?, descuento_nombre = ? WHERE id = ?', antes && antes.falta_pago ? 1 : 0, extra.planFull != null ? extra.planFull : monto, extra.descuento || 0, extra.descuentoNombre || null, Number(p.lastInsertRowid));
  run('UPDATE clientes SET falta_pago = 0 WHERE id = ?', clienteId);
  v2.alRegistrarPago(clienteId);
  run('INSERT INTO finanzas (tipo, categoria, concepto, monto, fecha, fijo, pago_id, medio, en_caja) VALUES (?,?,?,?,?,0,?,?,?)',
    'ingreso', 'Cuotas', nombreCliente + ' · ' + NOMBRE_METODO[metodo], monto, fecha, Number(p.lastInsertRowid), metodo, metodo === 'efectivo' ? 1 : 0);
  return Number(p.lastInsertRowid);
}
function renovarCliente(id, b) {
  const c = get('SELECT * FROM clientes WHERE id = ?', id);
  if (!c) throw new HttpError(404, 'Cliente no encontrado');
  const hoy = nowAR().fecha;
  const baja = bajaEfectiva(c);
  const meses = Math.max(1, Math.min(12, parseInt(b.meses || 1, 10)));
  const desde = baja >= hoy ? baja : hoy;
  const nueva = addMeses(desde, meses);
  const metodo = validarMetodo(b.metodo_pago);
  const plan = c.plan_id ? get('SELECT * FROM planes WHERE id = ?', c.plan_id) : null;
  const precioMes = plan ? (metodo === 'efectivo' ? plan.precio_efectivo : plan.precio_mp) : c.precio_plan;
  // Descuento: el elegido en la renovación o, si no se elige otro, el que el alumno tiene pendiente (por ejemplo un premio por recomendar)
  const manual = b.monto !== undefined && b.monto !== '';
  const planFull = manual ? Math.max(0, num(b.monto)) : precioMes * meses;
  // Si el alumno dejó vencer el plan 7 días o más sin renovar, pierde el descuento que le quedaba de varios meses
  if (c.desc_id && c.desc_restantes > 0 && baja < addDays(hoy, -7)) {
    const dp = get('SELECT meses FROM descuentos WHERE id = ?', c.desc_id);
    if (dp && dp.meses > 1) { run('UPDATE clientes SET desc_id = NULL, desc_restantes = 0 WHERE id = ?', id); c.desc_id = null; c.desc_restantes = 0; }
  }
  let d = null, restan = 0, deElegido = false;
  if (!manual && b.descuento_id) {
    d = get('SELECT * FROM descuentos WHERE id = ? AND activo = 1', Number(b.descuento_id));
    if (!d) throw bad('El descuento elegido no existe');
    restan = d.meses; deElegido = true;
  } else if (!manual && b.descuento_id === undefined && c.desc_id && c.desc_restantes > 0) {
    d = get('SELECT * FROM descuentos WHERE id = ?', c.desc_id); restan = c.desc_restantes;
  }
  const mesesCon = d ? Math.min(meses, restan) : 0;
  const porMes = d ? Math.min(precioMes, d.tipo === 'pct' ? precioMes * d.valor / 100 : d.valor) : 0;
  const descuento = Math.round(porMes * mesesCon);
  const monto = Math.max(0, planFull - descuento);
  tx(() => {
    run('UPDATE clientes SET fecha_baja = ? WHERE id = ?', nueva, id);
    registrarPago(id, c.nombre, monto, metodo, 'Renovación de plan (' + meses + ' mes' + (meses > 1 ? 'es' : '') + ')' + (descuento ? ' · descuento ' + d.nombre : ''), hoy, nueva, c.plan_id,
      { meses, bajaAnterior: baja, planFull, descuento, descuentoNombre: descuento ? d.nombre : null });
    if (d && (deElegido || descuento)) {
      const quedan = restan - mesesCon;
      run('UPDATE clientes SET desc_id = ?, desc_restantes = ? WHERE id = ?', quedan > 0 ? d.id : null, Math.max(0, quedan), id);
    }
  });
  return { fecha_baja: nueva, monto, plan_full: planFull, descuento, metodo_pago: metodo, a_caja: metodo === 'efectivo' };
}

// ------------------------------------------------------------ asistencias
function horasDeAgenda(fecha) {
  return semana.horasDe(fecha);
}
// Identifica automáticamente la clase según el horario: se admite entrar hasta 15 min antes del turno
function claseAhora(ahora) {
  const horas = horasDeAgenda(ahora.fecha);
  let h = ahora.hora;
  if (ahora.min >= 45 && horas.includes(h + 1)) h = h + 1;
  return horas.includes(h) ? h : null;
}
function asegurarSesion(fecha, hora) {
  let s = get('SELECT * FROM sesiones WHERE fecha = ? AND hora = ?', fecha, hora);
  if (!s) {
    const a = semana.celda(fecha, hora);
    run('INSERT OR IGNORE INTO sesiones (fecha, hora, formato_id) VALUES (?,?,?)', fecha, hora, a ? a.formato_id : null);
    s = get('SELECT * FROM sesiones WHERE fecha = ? AND hora = ?', fecha, hora);
  }
  return s;
}
function registrarAsistencia(clienteId, fecha, hora, origen, usuarioId) {
  const c = get('SELECT id, nombre FROM clientes WHERE id = ?', clienteId);
  if (!c) throw new HttpError(404, 'Cliente no encontrado');
  const s = asegurarSesion(fecha, hora);
  const ya = get('SELECT id FROM asistencias WHERE cliente_id = ? AND fecha = ? AND hora = ?', clienteId, fecha, hora);
  if (ya) return { duplicada: true, cliente: c.nombre, fecha, hora, sesion_id: s.id };
  run('INSERT INTO asistencias (cliente_id, sesion_id, fecha, hora, registrado, origen, cargado_por) VALUES (?,?,?,?,?,?,?)',
    clienteId, s.id, fecha, hora, new Date().toISOString(), origen, usuarioId || null);
  const total = get('SELECT COUNT(*) AS n FROM asistencias WHERE fecha = ? AND hora = ?', fecha, hora).n;
  return { duplicada: false, cliente: c.nombre, fecha, hora, sesion_id: s.id, asistentes_clase: total };
}

// ------------------------------------------------------------ dashboard
function dashboard(fecha) {
  const hoy = nowAR().fecha;
  const { capacidad } = planner.cfg();
  const dia = dowDe(fecha);
  const horas = new Set(horasDeAgenda(fecha));
  for (const r of all("SELECT DISTINCT hora FROM asistencias WHERE fecha = ? AND origen <> 'rutina'", fecha)) horas.add(r.hora);
  const formatos = new Map(all('SELECT * FROM formatos').map(f => [f.id, f]));
  const porHora = [...horas].sort((a, b) => a - b).map(h => {
    const s = get('SELECT * FROM sesiones WHERE fecha = ? AND hora = ?', fecha, h);
    const ag = semana.celda(fecha, h);
    const fid = s ? s.formato_id : (ag ? ag.formato_id : null);
    const f = fid ? formatos.get(fid) : null;
    const qr = get("SELECT COUNT(*) AS n FROM asistencias WHERE fecha = ? AND hora = ? AND origen = 'qr'", fecha, h).n;
    const man = get("SELECT COUNT(*) AS n FROM asistencias WHERE fecha = ? AND hora = ? AND origen NOT IN ('qr','rutina')", fecha, h).n;
    const rs = v2.reservasDeClase(fecha, h, f);
    return { hora: h, formato: f ? f.nombre : null, color: f ? f.color : null, total: qr + man, qr, manual: man, exceso: Math.max(0, qr + man - capacidad), reservas: rs.total, limite_reservas: rs.limite, exceso_reservas: rs.exceso };
  });
  const semanaAsist = [];
  for (let i = 13; i >= 0; i--) {
    const d = addDays(fecha, -i);
    semanaAsist.push({ fecha: d, total: get('SELECT COUNT(*) AS n FROM asistencias WHERE fecha = ?', d).n });
  }
  const cl = listaClientes({ rol: 'profesor' });
  const kpis = {
    activos: cl.filter(c => c.semaforo_alta === 'verde').length,
    bajas_recuperables: cl.filter(c => c.semaforo_alta === 'amarillo').length,
    bajas_largas: cl.filter(c => c.semaforo_alta === 'rojo').length,
    activos_en_riesgo: cl.filter(c => c.semaforo_alta === 'verde' && (c.semaforo_asistencia === 'naranja' || c.semaforo_asistencia === 'rojo')).length,
    asistencias_dia: porHora.reduce((a, h) => a + h.total, 0),
    rutinas_dia: get("SELECT COUNT(*) AS n FROM asistencias WHERE fecha = ? AND origen = 'rutina'", fecha).n,
  };
  // listados detrás de cada indicador (botones Alumnos activos / Activos en riesgo / Bajas recuperables)
  const fila = (c) => ({ id: c.id, nombre: c.nombre, ultima_clase: c.ultima_clase, fecha_baja: c.fecha_baja, total_asistencias: c.total_asistencias, semaforo_asistencia: c.semaforo_asistencia, texto_asistencia: c.texto_asistencia, estado_alta: c.estado_alta, dias_baja: c.dias_baja, celular: c.celular });
  const listas = {
    activos: cl.filter(c => c.semaforo_alta === 'verde').map(fila),
    activos_en_riesgo: cl.filter(c => c.semaforo_alta === 'verde' && (c.semaforo_asistencia === 'naranja' || c.semaforo_asistencia === 'rojo')).map(fila),
    bajas_recuperables: cl.filter(c => c.semaforo_alta === 'amarillo').map(fila),
    asistentes_dia: all("SELECT a.cliente_id AS id, c.nombre, a.hora, a.origen FROM asistencias a JOIN clientes c ON c.id = a.cliente_id WHERE a.fecha = ? AND a.origen <> 'rutina' ORDER BY a.hora, c.nombre COLLATE NOCASE", fecha),
  };
  return { fecha, capacidad, porHora, semana: semanaAsist, kpis, listas };
}

// ------------------------------------------------------------ finanzas
function resumenFinanzas(mes) {
  const ini = mes + '-01', fin = mes + '-31';
  const movs = all('SELECT * FROM finanzas WHERE fecha BETWEEN ? AND ? ORDER BY fecha DESC, id DESC', ini, fin);
  const ing = movs.filter(m => m.tipo === 'ingreso').reduce((a, m) => a + m.monto, 0);
  const egr = movs.filter(m => m.tipo === 'egreso');
  const fijos = egr.filter(m => m.fijo).reduce((a, m) => a + m.monto, 0);
  const variables = egr.filter(m => !m.fijo).reduce((a, m) => a + m.monto, 0);
  const totalEgr = fijos + variables;
  const hoy = nowAR().fecha;
  const activos = all('SELECT * FROM clientes').filter(c => semaforoAlta(c, hoy).color === 'verde');
  const ticket = activos.length ? activos.reduce((a, c) => a + c.precio_plan, 0) / activos.length : 0;
  const margen = ing > 0 ? Math.max(0.01, 1 - variables / ing) : 1;
  const equilibrioMonto = fijos / margen;
  const serie = [];
  let [y, m] = mes.split('-').map(Number);
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1)); const mm = d.toISOString().slice(0, 7);
    const r = get("SELECT COALESCE(SUM(CASE WHEN tipo='ingreso' THEN monto END),0) AS i, COALESCE(SUM(CASE WHEN tipo='egreso' THEN monto END),0) AS e FROM finanzas WHERE fecha BETWEEN ? AND ?", mm + '-01', mm + '-31');
    serie.push({ mes: mm, ingresos: r.i, egresos: r.e, ganancia: r.i - r.e });
  }
  const porCategoria = {};
  for (const e of egr) porCategoria[e.categoria] = (porCategoria[e.categoria] || 0) + e.monto;
  return {
    mes, movimientos: movs, ingresos: ing, egresos: totalEgr, gastos_fijos: fijos, gastos_variables: variables,
    ganancia_neta: ing - totalEgr, ticket_promedio: ticket, alumnos_activos: activos.length,
    punto_equilibrio_monto: equilibrioMonto,
    punto_equilibrio_alumnos: ticket > 0 ? Math.ceil(equilibrioMonto / ticket) : null,
    por_categoria: porCategoria, serie,
  };
}

// ------------------------------------------------------------ rutas
const routes = [];
function route(method, pattern, roles, handler) {
  const keys = [];
  const rx = new RegExp('^' + pattern.replace(/:([a-z]+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
  routes.push({ method, rx, keys, roles, handler });
}
const ADM = ['admin'], STAFF = ['admin', 'profesor'], TODOS = ['admin', 'profesor', 'cliente'], PUB = null;

route('GET', '/api/estado', PUB, () => {
  const hayAdmin = !!get("SELECT 1 AS x FROM usuarios WHERE rol = 'admin'");
  const nube = sync.NODO === 'nube';
  return { configurada: hayAdmin || nube, esperando_sync: nube && !hayAdmin, nodo: sync.NODO, nombre: 'OMEGA', version: VERSION.nombre };
});

route('POST', '/api/setup', PUB, async ({ req, res }) => {
  if (sync.NODO === 'nube') throw new HttpError(403, 'El primer acceso se hace en la PC del gimnasio; esta copia se completa sola al sincronizar');
  if (get("SELECT 1 AS x FROM usuarios WHERE rol = 'admin'")) throw new HttpError(409, 'La aplicación ya fue configurada');
  const b = await readBody(req);
  const username = str(b.username, 40), password = String(b.password || '');
  if (username.length < 3) throw bad('El usuario debe tener al menos 3 caracteres');
  if (password.length < 8) throw bad('La contraseña debe tener al menos 8 caracteres');
  const r = run('INSERT INTO usuarios (username, password_hash, rol, nombre, creado) VALUES (?,?,?,?,?)', username, hashPassword(password), 'admin', str(b.nombre, 80) || 'Administrador', new Date().toISOString());
  const u = get('SELECT id, username, rol, nombre FROM usuarios WHERE id = ?', Number(r.lastInsertRowid));
  return { token: emitirSesion(u), usuario: u };
});

route('POST', '/api/login', PUB, async ({ req }) => {
  const b = await readBody(req);
  const username = str(b.username, 60), password = String(b.password || '');
  const ip = ((req.socket && req.socket.remoteAddress) || 'local') + '|' + username.toLowerCase();
  if (limitarLogin(ip)) throw new HttpError(429, 'Demasiados intentos. Esperá unos minutos.');
  const u = get('SELECT * FROM usuarios WHERE username = ?', username);
  if (!u || !u.activo || !verifyPassword(password, u.password_hash)) { intentos.get(ip).push(Date.now()); throw new HttpError(401, 'Usuario o contraseña incorrectos'); }
  return { token: emitirSesion(u), usuario: { id: u.id, username: u.username, rol: u.rol, nombre: u.nombre, cliente_id: u.cliente_id, permisos: permisos.deUsuario(u) } };
});

route('GET', '/api/yo', TODOS, ({ user }) => ({ id: user.id, username: user.username, rol: user.rol, nombre: user.nombre, cliente_id: user.cliente_id, permisos: permisos.deUsuario(user), notif_pendientes: user.rol === 'cliente' ? 0 : v2.notifPendientes() }));

route('POST', '/api/yo/clave', TODOS, async ({ req, user }) => {
  const b = await readBody(req);
  const u = get('SELECT * FROM usuarios WHERE id = ?', user.id);
  if (!verifyPassword(String(b.actual || ''), u.password_hash)) throw bad('La contraseña actual no es correcta');
  const nueva = String(b.nueva || '');
  if (nueva.length < 6) throw bad('La nueva contraseña debe tener al menos 6 caracteres');
  run('UPDATE usuarios SET password_hash = ? WHERE id = ?', hashPassword(nueva), user.id);
  return { ok: true };
});

// --- Módulo 1: usuarios
route('GET', '/api/usuarios', ADM, () => all("SELECT id, username, rol, nombre, cliente_id, activo, creado, permisos FROM usuarios ORDER BY CASE rol WHEN 'admin' THEN 0 WHEN 'profesor' THEN 1 ELSE 2 END, nombre COLLATE NOCASE").map(u => ({ ...u, permisos: u.rol === 'cliente' ? [] : permisos.deUsuario(u) })));
route('GET', '/api/permisos', ADM, () => ({ arbol: permisos.ARBOL, estandar: permisos.ESTANDAR }));
// permisos que llegan del formulario: lista tildada o "copiar de" otro usuario (administrador o profesor)
function permisosDelBody(b) {
  if (b.copiar_de) { const o = get("SELECT * FROM usuarios WHERE id = ? AND rol IN ('admin','profesor')", Number(b.copiar_de)); if (!o) throw bad('El usuario a copiar no existe'); return permisos.deUsuario(o); }
  if (Array.isArray(b.permisos)) return permisos.limpiar(b.permisos);
  return null;
}
route('POST', '/api/usuarios', ADM, async ({ req }) => {
  const b = await readBody(req);
  if (!['admin', 'profesor'].includes(b.rol)) throw bad('Rol inválido (los alumnos se crean desde Clientes)');
  const username = str(b.username, 40);
  if (username.length < 3) throw bad('Usuario demasiado corto');
  if (String(b.password || '').length < 6) throw bad('La contraseña debe tener al menos 6 caracteres');
  if (get('SELECT 1 AS x FROM usuarios WHERE username = ?', username)) throw bad('Ese nombre de usuario ya existe');
  const perm = b.rol === 'profesor' ? (permisosDelBody(b) || permisos.ESTANDAR) : null;
  const r = run('INSERT INTO usuarios (username, password_hash, rol, nombre, creado, permisos) VALUES (?,?,?,?,?,?)', username, hashPassword(String(b.password)), b.rol, str(b.nombre, 80) || username, new Date().toISOString(), perm ? JSON.stringify(perm) : null);
  return { id: Number(r.lastInsertRowid) };
});
route('PUT', '/api/usuarios/:id', ADM, async ({ req, params, user }) => {
  const b = await readBody(req);
  const id = Number(params.id);
  const u = get('SELECT * FROM usuarios WHERE id = ?', id);
  if (!u) throw new HttpError(404, 'Usuario no encontrado');
  if (b.activo === false && u.id === user.id) throw bad('No podés desactivar tu propio usuario');
  if (b.password) { if (String(b.password).length < 6) throw bad('La contraseña debe tener al menos 6 caracteres'); run('UPDATE usuarios SET password_hash = ? WHERE id = ?', hashPassword(String(b.password)), id); }
  if (b.nombre !== undefined) run('UPDATE usuarios SET nombre = ? WHERE id = ?', str(b.nombre, 80), id);
  if (b.activo !== undefined) run('UPDATE usuarios SET activo = ? WHERE id = ?', b.activo ? 1 : 0, id);
  if ((b.permisos !== undefined || b.copiar_de) && u.rol === 'profesor') { const perm = permisosDelBody(b); if (perm) run('UPDATE usuarios SET permisos = ? WHERE id = ?', JSON.stringify(perm), id); }
  return { ok: true };
});
route('DELETE', '/api/usuarios/:id', ADM, ({ params, user }) => {
  const id = Number(params.id);
  if (id === user.id) throw bad('No podés eliminar tu propio usuario');
  const u = get('SELECT * FROM usuarios WHERE id = ?', id);
  if (!u) throw new HttpError(404, 'Usuario no encontrado');
  if (u.cliente_id) throw bad('Los accesos de alumnos se administran desde la ficha del cliente');
  run('DELETE FROM usuarios WHERE id = ?', id);
  return { ok: true };
});

// --- Módulo 3 y 4: clientes
route('GET', '/api/clientes', STAFF, ({ user }) => listaClientes(user));
route('GET', '/api/clientes/:id', STAFF, ({ params, user }) => detalleCliente(Number(params.id), user));
route('POST', '/api/clientes', STAFF, async ({ req, user }) => crearCliente(await readBody(req), user));
route('PUT', '/api/clientes/:id', STAFF, async ({ req, params, user }) => { actualizarCliente(Number(params.id), await readBody(req), user); return { ok: true }; });
route('POST', '/api/clientes/:id/renovar', STAFF, async ({ req, params }) => renovarCliente(Number(params.id), await readBody(req)));
route('POST', '/api/clientes/:id/acceso', STAFF, ({ params }) => {
  const id = Number(params.id);
  const c = get('SELECT * FROM clientes WHERE id = ?', id);
  if (!c) throw new HttpError(404, 'Cliente no encontrado');
  const u = get('SELECT * FROM usuarios WHERE cliente_id = ?', id);
  if (!u) return crearAccesoCliente(id, c.nombre, c.celular);
  const clave = CLAVE_INICIAL;
  run('UPDATE usuarios SET password_hash = ?, activo = 1 WHERE id = ?', hashPassword(clave), u.id);
  return { usuario: u.username, clave };
});
// Importación de alumnos: solo el nombre y apellido es obligatorio. Si el alumno ya existe se completan sus datos
// (nunca se borra lo que ya tenía) y si es nuevo se da de alta con su acceso a la app web. Importar de nuevo no duplica.
const claveNombre = (n) => String(n || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const ultimos8 = (t) => soloDigitos(t).slice(-8);
route('POST', '/api/clientes/importar', STAFF, async ({ req, user }) => {
  const b = await readBody(req, 25 * 1024 * 1024);
  const filas = Array.isArray(b.filas) ? b.filas : [];
  if (!filas.length) throw bad('El archivo no tiene filas para importar');
  if (filas.length > 5000) throw bad('Máximo 5000 filas por importación');
  const out = { creados: 0, actualizados: 0, sin_cambios: 0, errores: [], avisos: [], accesos: [] };
  const planes = all('SELECT * FROM planes WHERE activo = 1');
  const buscarPlan = (txt) => {
    const k = claveNombre(String(txt).replace(/\(.*$/, ''));
    return k ? planes.find(p => claveNombre(p.nombre) === k) || null : null;
  };
  const todos = all('SELECT id, nombre, celular FROM clientes');
  tx(() => {
    filas.forEach((f, i) => {
      const fila = 'Fila ' + (i + 2);
      try {
        const nombre = str(f.nombre, 120);
        if (!nombre) throw new Error('falta el nombre y apellido');
        const cel = normTel(str(f.celular, 40));
        const k8 = ultimos8(cel);
        let ex = null;
        if (k8.length === 8) ex = todos.find(c => ultimos8(c.celular) === k8) || null;
        if (ex && claveNombre(ex.nombre) !== claveNombre(nombre)) {
          // mismo celular con otro nombre: solo es la misma persona si coincide alguna palabra (ej. "Ana García" / "García Ana")
          const a = new Set(claveNombre(ex.nombre).split(' ')), c2 = claveNombre(nombre).split(' ');
          if (!c2.some(w => w.length > 2 && a.has(w))) ex = null;
        }
        if (!ex) {
          const mismos = todos.filter(c => claveNombre(c.nombre) === claveNombre(nombre));
          if (mismos.length === 1) ex = mismos[0];
          else if (mismos.length > 1) { ex = mismos[0]; out.avisos.push(fila + ': hay varios alumnos llamados “' + nombre + '”; se actualizó el primero'); }
        }
        const plan = f.plan ? buscarPlan(f.plan) : null;
        if (f.plan && !plan) out.avisos.push(fila + ': el plan “' + String(f.plan).slice(0, 40) + '” no existe; se cargó sin plan');
        const esAdmin = user.rol === 'admin';
        const precio = f.precio_plan !== undefined && f.precio_plan !== '' && f.precio_plan !== null ? f.precio_plan : (plan && esAdmin ? plan.precio_efectivo : undefined);
        const datos = {
          nombre,
          fecha_alta: f.fecha_alta ? requireFecha(f.fecha_alta, 'fecha de alta') : undefined,
          fecha_baja: f.fecha_baja ? requireFecha(f.fecha_baja, 'fecha de baja') : undefined,
          precio_plan: precio, plan_id: plan ? plan.id : undefined,
          celular: cel || undefined, instagram: str(f.instagram, 60) || undefined,
        };
        if (ex) {
          if (cel && ex.celular && ultimos8(ex.celular) !== k8) out.avisos.push(fila + ': “' + nombre + '” ya estaba con otro celular; se actualizó al nuevo');
          const antes = JSON.stringify(get('SELECT nombre, fecha_alta, fecha_baja, precio_plan, celular, instagram, plan_id FROM clientes WHERE id = ?', ex.id));
          if (claveNombre(ex.nombre) === claveNombre(nombre)) datos.nombre = ex.nombre; // no se cambia la forma en que ya estaba escrito
          actualizarCliente(ex.id, datos, user);
          if (!get('SELECT 1 AS x FROM usuarios WHERE cliente_id = ?', ex.id)) { const a = crearAccesoCliente(ex.id, datos.nombre, cel || ex.celular); out.accesos.push({ nombre, ...a }); }
          const despues = JSON.stringify(get('SELECT nombre, fecha_alta, fecha_baja, precio_plan, celular, instagram, plan_id FROM clientes WHERE id = ?', ex.id));
          if (antes === despues) out.sin_cambios++; else out.actualizados++;
          ex.nombre = datos.nombre; if (cel) ex.celular = cel;
        } else {
          const r = crearCliente({ ...datos, fecha_alta: datos.fecha_alta || nowAR().fecha }, user); out.creados++; todos.push({ id: r.id, nombre, celular: cel });
          if (r.acceso) out.accesos.push({ nombre, ...r.acceso });
        }
      } catch (e) { out.errores.push(fila + ': ' + e.message); }
    });
  });
  return out;
});

// --- Asistencias
route('GET', '/api/asistencias', STAFF, ({ query }) => {
  const fecha = query.fecha && esFecha(query.fecha) ? query.fecha : nowAR().fecha;
  const hora = query.hora !== undefined ? parseInt(query.hora, 10) : null;
  const rows = all(`SELECT a.id, a.cliente_id, a.fecha, a.hora, a.origen, c.nombre, c.foto FROM asistencias a JOIN clientes c ON c.id = a.cliente_id
    WHERE a.fecha = ? ${hora !== null ? 'AND a.hora = ?' : ''} ORDER BY a.hora, c.nombre COLLATE NOCASE`, ...(hora !== null ? [fecha, hora] : [fecha]));
  return rows;
});
route('POST', '/api/asistencias', STAFF, async ({ req, user }) => {
  const b = await readBody(req);
  const ahora = nowAR();
  const fecha = b.fecha ? requireFecha(b.fecha) : ahora.fecha;
  let hora = b.hora !== undefined && b.hora !== null && b.hora !== '' ? parseInt(b.hora, 10) : null;
  if (hora === null) {
    if (fecha !== ahora.fecha) throw bad('Indicá el horario de la clase');
    hora = claseAhora(ahora);
    if (hora === null) throw bad('No hay una clase en este horario. Elegí el horario manualmente.');
  }
  const ids = Array.isArray(b.cliente_ids) ? b.cliente_ids : [b.cliente_id];
  if (!ids.length || ids.some(x => !Number.isInteger(Number(x)))) throw bad('Elegí al menos un alumno');
  const res = tx(() => ids.map(id => registrarAsistencia(Number(id), fecha, hora, 'manual', user.id)));
  return { hora, fecha, resultados: res };
});
route('POST', '/api/asistencias/qr', STAFF, async ({ req, user }) => {
  const b = await readBody(req);
  const v = validarQR(b.codigo);
  if (!v.ok) throw bad(v.error);
  const ahora = nowAR();
  const hora = b.hora !== undefined && b.hora !== null && b.hora !== '' ? parseInt(b.hora, 10) : claseAhora(ahora);
  if (hora === null || Number.isNaN(hora)) throw bad('No hay una clase en este horario. Cargá la asistencia manualmente eligiendo la clase.');
  const r = registrarAsistencia(v.cliente_id, ahora.fecha, hora, 'qr', user.id);
  const c = get('SELECT * FROM clientes WHERE id = ?', v.cliente_id);
  r.alerta_plan = semaforoAlta(c, ahora.fecha).color !== 'verde' ? 'El plan de este alumno está vencido' : null;
  r.foto = c.foto || null;
  return r;
});
route('DELETE', '/api/asistencias/:id', STAFF, ({ params }) => { run('DELETE FROM asistencias WHERE id = ?', Number(params.id)); return { ok: true }; });

route('GET', '/api/dashboard', STAFF, ({ query }) => dashboard(query.fecha && esFecha(query.fecha) ? query.fecha : nowAR().fecha));

// --- Cliente (app del alumno)
route('GET', '/api/mi-qr', ['cliente'], ({ user }) => {
  if (!user.cliente_id) throw bad('Usuario sin ficha de alumno');
  return { codigo: emitirQR(user.cliente_id), vence_en: 90 };
});
route('GET', '/api/mi-perfil', ['cliente'], ({ user }) => {
  const d = detalleCliente(user.cliente_id, { rol: 'cliente' });
  return { id: d.id, nombre: d.nombre, foto: d.foto, fecha_alta: d.fecha_alta, fecha_baja: d.fecha_baja, precio_plan: d.precio_plan ?? get('SELECT precio_plan FROM clientes WHERE id = ?', d.id).precio_plan,
    estado_alta: d.estado_alta, semaforo_alta: d.semaforo_alta, semaforo_asistencia: d.semaforo_asistencia, texto_asistencia: d.texto_asistencia,
    whatsapp_gym: telefono.enlaceWA(getConfig('whatsapp_gym', ''), getConfig('prefijo', '54')), dias_restantes: diffDays(d.fecha_baja, nowAR().fecha), total_asistencias: d.total_asistencias, asistencias: d.asistencias.slice(0, 60), semanas: d.semanas, mensual: d.mensual, cumplimiento_objetivo: d.cumplimiento_objetivo };
});

// --- Módulo 2: planificación
// Formatos con la configuración de la semana pedida (por defecto la actual): estaciones, intervalos, rounds y estímulos
const lunesQ = (v) => lunesDe(v && esFecha(String(v)) ? String(v) : nowAR().fecha);
route('GET', '/api/formatos', TODOS, ({ query }) => semana.formatosDeSemana(lunesQ(query.semana)).formatos);
route('PUT', '/api/formatos', ADM, async ({ req }) => {
  const b = await readBody(req);
  if (!Array.isArray(b.formatos)) throw bad('Formato inválido');
  // Los tiempos son libres (de 1 segundo en adelante, sin tope práctico); 0 se interpreta como "sin intervalo".
  const seg = (v) => { if (v === null || v === '' || v === undefined) return undefined; const n = parseInt(v, 10); if (!(n >= 0 && n <= 86400)) throw bad('El tiempo debe ser un número de segundos válido'); return n; };
  const flag = (v, ex) => v === undefined ? ex : (v ? 1 : 0);
  tx(() => {
    b.formatos.forEach((f, i) => {
      const nombre = str(f.nombre, 40);
      if (f.id) {
        const ex = get('SELECT * FROM formatos WHERE id = ?', Number(f.id));
        if (!ex) return;
        const t = f.trabajo_seg !== undefined ? seg(f.trabajo_seg) : undefined;
        const d = f.descanso_seg !== undefined ? seg(f.descanso_seg) : undefined;
        const cupo = f.cupo_estacion === undefined ? ex.cupo_estacion : (f.cupo_estacion === null || f.cupo_estacion === '' ? null : Math.max(1, Math.min(30, parseInt(f.cupo_estacion, 10) || 1)));
        const imin = f.intensidad_min === undefined ? ex.intensidad_min : (['baja', 'moderada', 'alta'].includes(f.intensidad_min) ? f.intensidad_min : null);
        const dur = f.duracion_min === undefined ? ex.duracion_min : (f.duracion_min === null || f.duracion_min === '' ? null : Math.max(1, Math.min(600, parseInt(f.duracion_min, 10) || 60)));
        const rondas = f.rondas === undefined ? (ex.rondas || 3) : Math.max(1, Math.min(3, parseInt(f.rondas, 10) || 3));
        run('UPDATE formatos SET nombre = ?, trabajo_seg = ?, descanso_seg = ?, color = ?, orden = ?, cupo_estacion = ?, intensidad_min = ?, sin_trabajo = ?, sin_descanso = ?, duracion_min = ?, rondas = ? WHERE id = ?',
          nombre || ex.nombre, t !== undefined ? t : (f.trabajo_seg === null ? null : ex.trabajo_seg), d !== undefined ? d : (f.descanso_seg === null ? null : ex.descanso_seg), f.color || ex.color, f.orden ?? i + 1, cupo, imin,
          flag(f.sin_trabajo, ex.sin_trabajo), flag(f.sin_descanso, ex.sin_descanso), dur, rondas, ex.id);
      } else if (nombre) {
        if (get('SELECT 1 AS x FROM formatos WHERE nombre = ?', nombre)) throw bad('Ya existe el formato ' + nombre);
        run('INSERT INTO formatos (nombre, trabajo_seg, descanso_seg, color, orden, sin_trabajo, sin_descanso, duracion_min, rondas) VALUES (?,?,?,?,?,?,?,?,?)', nombre, seg(f.trabajo_seg) ?? null, seg(f.descanso_seg) ?? null, f.color || '#4da3ff', i + 1, flag(f.sin_trabajo, 0), flag(f.sin_descanso, 0), f.duracion_min ? Math.max(1, Math.min(600, parseInt(f.duracion_min, 10) || 60)) : null, f.rondas === undefined ? 3 : Math.max(1, Math.min(3, parseInt(f.rondas, 10) || 3)));
      }
    });
  });
  { const d0 = require('./estimulos'); for (const f of all('SELECT id, nombre FROM formatos WHERE patrones IS NULL')) { const d = d0.defaultsFormato(f.nombre); run('UPDATE formatos SET patrones = ?, capacidades = ?, energias = ? WHERE id = ?', d.patrones, d.capacidades, d.energias, f.id); } }
  return semana.formatosDeSemana(lunesQ(b.semana)).formatos;
});
route('DELETE', '/api/formatos/:id', ADM, ({ params }) => {
  run('UPDATE formatos SET activo = 0 WHERE id = ?', Number(params.id));
  run('UPDATE agenda SET formato_id = NULL WHERE formato_id = ?', Number(params.id));
  return { ok: true };
});
route('GET', '/api/agenda', STAFF, ({ query }) => semana.celdasDe(lunesQ(query.semana)).celdas.map(c => ({ dia: c.dia, hora: c.hora, formato_id: c.formato_id })));
route('PUT', '/api/agenda', ADM, async ({ req }) => {
  const b = await readBody(req);
  if (!Array.isArray(b.celdas)) throw bad('Formato inválido');
  // (ruta anterior, se mantiene por compatibilidad: modifica la agenda de la semana indicada, por defecto la actual)
  const lunes = lunesQ(b.semana);
  const mapa = new Map(semana.celdasDe(lunes).celdas.filter(c => c.formato_id).map(c => [c.dia + ':' + c.hora, { dia: c.dia, hora: c.hora, formato_id: c.formato_id }]));
  for (const c of b.celdas) {
    const dia = parseInt(c.dia, 10), hora = parseInt(c.hora, 10);
    if (!(dia >= 1 && dia <= 7) || !(hora >= 0 && hora <= 23)) throw bad('Día u hora inválidos');
    if (c.formato_id) mapa.set(dia + ':' + hora, { dia, hora, formato_id: Number(c.formato_id) }); else mapa.delete(dia + ':' + hora);
  }
  semana.guardarAgenda(lunes, [...mapa.values()]);
  return { ok: true };
});
route('GET', '/api/equipamiento', STAFF, () => all('SELECT * FROM equipamiento ORDER BY nombre'));
route('PUT', '/api/equipamiento', ADM, async ({ req }) => {
  const b = await readBody(req);
  tx(() => {
    for (const e of (b.equipamiento || [])) { const q = parseInt(e.cantidad, 10); if (q >= 0) run('UPDATE equipamiento SET cantidad = ? WHERE clave = ?', q, String(e.clave)); }
    if (b.capacidad_clase !== undefined) { const c = parseInt(b.capacidad_clase, 10); if (c >= 5 && c <= 60) setConfig('capacidad_clase', c); }
    if (b.estaciones !== undefined) { const c = parseInt(b.estaciones, 10); if (c >= 3 && c <= 10) setConfig('estaciones', c); }
  });
  return { ok: true, ...planner.cfg() };
});
route('GET', '/api/config-clase', STAFF, () => planner.cfg());

const COLS_EJ = 'id, zona, nombre, prog2, prog3, equipo, unidades, descripcion, video, activo, patron, origen, intensidad, capacidad, energia, (img1 IS NOT NULL) AS foto1, (img2 IS NOT NULL) AS foto2, (img3 IS NOT NULL) AS foto3';
route('GET', '/api/ejercicios', STAFF, ({ query }) => {
  const rows = query.zona ? all('SELECT ' + COLS_EJ + ' FROM ejercicios WHERE activo = 1 AND zona = ? ORDER BY nombre', query.zona) : all('SELECT ' + COLS_EJ + ' FROM ejercicios WHERE activo = 1 ORDER BY zona, nombre');
  return rows;
});
// Ficha completa de un ejercicio (con sus 3 imágenes si hay fotos propias). La ven también los alumnos.
route('GET', '/api/ejercicios/:id', TODOS, ({ params }) => {
  const e = get('SELECT * FROM ejercicios WHERE id = ?', Number(params.id));
  if (!e) throw new HttpError(404, 'Ejercicio no encontrado');
  const eq = get('SELECT nombre FROM equipamiento WHERE clave = ?', e.equipo);
  return { ...e, equipo_nombre: eq ? eq.nombre : e.equipo };
});
function validarImagen(v) {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  if (typeof v !== 'string' || !/^data:image\/(png|jpe?g|webp|svg\+xml);base64,/.test(v)) throw bad('La imagen del ejercicio no es válida');
  if (v.length > 420 * 1024) throw bad('La imagen es demasiado pesada (máximo 300 KB)');
  return v;
}
function validarIntensidad(v, def) {
  if (v === undefined || v === null || v === '') return def;
  if (!['baja', 'moderada', 'alta'].includes(v)) throw bad('Intensidad inválida');
  return v;
}
function validarPatron(v, def) {
  if (v === undefined || v === null || v === '') return def;
  const p = String(v).toLowerCase();
  if (!/^[a-z_]{2,24}$/.test(p)) throw bad('Tipo de movimiento inválido');
  return p;
}
route('POST', '/api/ejercicios', STAFF, async ({ req, user }) => {
  const b = await readBody(req);
  const zona = str(b.zona, 40), nombre = str(b.nombre, 120), p2 = str(b.prog2, 120), p3 = str(b.prog3, 120);
  if (!ZONAS.includes(zona)) throw bad('Elegí el patrón de movimiento');
  if (!nombre || !p2 || !p3) throw bad('Completá el ejercicio y sus dos progresiones');
  const eq = str(b.equipo, 40) || 'ninguno';
  if (!get('SELECT 1 AS x FROM equipamiento WHERE clave = ?', eq)) throw bad('Equipo inválido');
  if (get('SELECT 1 AS x FROM ejercicios WHERE activo = 1 AND zona = ? AND nombre = ? COLLATE NOCASE', zona, nombre)) throw bad('Ya existe un ejercicio con ese nombre en ' + zona);
  const patron = validarPatron(b.patron, estim.ILUSTRACION[estim.claveDeZona(zona)] || 'sentadilla');
  const capac = estim.aTexto(estim.lista(b.capacidades ?? b.capacidad, estim.CLAVES.capacidades)) || 'fuerza', energ = estim.aTexto(estim.lista(b.energias ?? b.energia, estim.CLAVES.energias)) || 'aerobico';
  const r = run("INSERT INTO ejercicios (zona, nombre, prog2, prog3, equipo, unidades, descripcion, patron, img1, img2, img3, origen, intensidad, capacidad, energia) VALUES (?,?,?,?,?,?,?,?,?,?,?,'propio',?,?,?)",
    zona, nombre, p2, p3, eq, Math.max(1, parseInt(b.unidades || 1, 10)), str(b.descripcion, 500) || null, patron,
    validarImagen(b.img1) ?? null, validarImagen(b.img2) ?? null, validarImagen(b.img3) ?? null, validarIntensidad(b.intensidad, v2.intensidadDe(zona, patron, nombre)), capac, energ);
  return { id: Number(r.lastInsertRowid) };
});
route('PUT', '/api/ejercicios/:id', STAFF, async ({ req, params }) => {
  const b = await readBody(req);
  const e = get('SELECT * FROM ejercicios WHERE id = ?', Number(params.id));
  if (!e) throw new HttpError(404, 'Ejercicio no encontrado');
  const eq = b.equipo !== undefined ? str(b.equipo, 40) : e.equipo;
  if (!get('SELECT 1 AS x FROM equipamiento WHERE clave = ?', eq)) throw bad('Equipo inválido');
  const zona = b.zona !== undefined ? str(b.zona, 40) : e.zona;
  if (!ZONAS.includes(zona)) throw bad('Elegí el patrón de movimiento');
  const capac = b.capacidades !== undefined || b.capacidad !== undefined ? (estim.aTexto(estim.lista(b.capacidades ?? b.capacidad, estim.CLAVES.capacidades)) || e.capacidad || 'fuerza') : e.capacidad;
  const energ = b.energias !== undefined || b.energia !== undefined ? (estim.aTexto(estim.lista(b.energias ?? b.energia, estim.CLAVES.energias)) || e.energia || 'aerobico') : e.energia;
  const img = (k) => { const v = validarImagen(b[k]); return v === undefined ? e[k] : v; };
  run('UPDATE ejercicios SET zona=?, nombre=?, prog2=?, prog3=?, equipo=?, unidades=?, descripcion=?, patron=?, img1=?, img2=?, img3=?, intensidad=?, capacidad=?, energia=? WHERE id=?',
    zona, str(b.nombre ?? e.nombre, 120) || e.nombre, str(b.prog2 ?? e.prog2, 120) || e.prog2, str(b.prog3 ?? e.prog3, 120) || e.prog3, eq,
    Math.max(1, parseInt(b.unidades ?? e.unidades, 10)), b.descripcion !== undefined ? (str(b.descripcion, 500) || null) : e.descripcion,
    validarPatron(b.patron, e.patron || estim.ILUSTRACION[estim.claveDeZona(zona)] || 'sentadilla'), img('img1'), img('img2'), img('img3'), validarIntensidad(b.intensidad, e.intensidad || v2.intensidadDe(zona, e.patron, e.nombre)), capac, energ, e.id);
  return { ok: true };
});
route('DELETE', '/api/ejercicios/:id', ADM, ({ params }) => { run('UPDATE ejercicios SET activo = 0 WHERE id = ?', Number(params.id)); return { ok: true }; });


route('POST', '/api/planificacion/generar', STAFF, async ({ req }) => {
  const b = await readBody(req);
  const desde = requireFecha(b.desde || lunesDe(nowAR().fecha), 'fecha de inicio');
  const dias = Math.max(1, Math.min(28, parseInt(b.dias || 7, 10)));
  const modo = b.modo === 'manual' ? 'manual' : b.modo === 'ia' ? 'ia' : null;
  if (!b.rehacer || !b.conservar_pasado) return planner.generarRango(desde, dias, !!b.rehacer, modo);
  // regenera de hoy en adelante; los días que ya pasaron conservan lo que tenían
  const hoy = nowAR().fecha, pasados = Math.max(0, Math.min(dias, diffDays(hoy, desde)));
  const a = pasados ? planner.generarRango(desde, pasados, false, modo) : { creados: 0, mantenidos: 0, sesiones: 0 };
  const r = pasados < dias ? planner.generarRango(addDays(desde, pasados), dias - pasados, true, modo) : { creados: 0, mantenidos: 0, sesiones: 0 };
  return { creados: a.creados + r.creados, mantenidos: a.mantenidos + r.mantenidos, sesiones: a.sesiones + r.sesiones, regenerados: r.creados };
});
// Elimina los circuitos (sean de IA o manuales) de hoy en adelante dentro del rango; los días pasados no se tocan
route('POST', '/api/planificacion/eliminar', STAFF, async ({ req }) => {
  const b = await readBody(req);
  const hoy = nowAR().fecha, desde0 = requireFecha(b.desde || lunesDe(hoy), 'fecha de inicio');
  const dias = Math.max(1, Math.min(28, parseInt(b.dias || 7, 10)));
  const desde = desde0 < hoy ? hoy : desde0, hasta = addDays(desde0, dias - 1);
  if (hasta < desde) return { eliminados: 0 };
  let n = 0;
  tx(() => { n = Number(run('DELETE FROM circuitos WHERE fecha BETWEEN ? AND ?', desde, hasta).changes); run('DELETE FROM uso_ejercicio WHERE fecha BETWEEN ? AND ?', desde, hasta); });
  return { eliminados: n, desde };
});
route('GET', '/api/planificacion', STAFF, ({ query }) => {
  const desde = query.desde && esFecha(query.desde) ? query.desde : lunesDe(nowAR().fecha);
  const dias = Math.max(1, Math.min(14, parseInt(query.dias || 7, 10)));
  return Array.from({ length: dias }, (_, i) => { const f = addDays(desde, i); return { fecha: f, dia: dowDe(f), clases: planner.claseDelDia(f) }; });
});
route('GET', '/api/planificacion/circuito/:id', STAFF, ({ params }) => { const c = planner.circuitoPorId(Number(params.id)); if (!c) throw new HttpError(404, 'Circuito no encontrado'); return c; });
route('GET', '/api/planificacion/circuito/:id/sugerencias', STAFF, ({ params, query }) => {
  const r = planner.sugerencias(Number(params.id), parseInt(query.slot || '0', 10), query.zona || null);
  if (!r) throw new HttpError(404, 'Circuito no encontrado');
  return r;
});
route('PUT', '/api/planificacion/circuito/:id/slot', STAFF, async ({ req, params }) => {
  const b = await readBody(req);
  return planner.reemplazarSlot(Number(params.id), parseInt(b.slot, 10), Number(b.ejercicio_id));
});
route('POST', '/api/planificacion/circuito/:id/regenerar', STAFF, ({ params }) => {
  const c = get('SELECT * FROM circuitos WHERE id = ?', Number(params.id));
  if (!c) throw new HttpError(404, 'Circuito no encontrado');
  planner.generarRango(c.fecha, 1, true);
  return { ok: true };
});

// Vista de clases (alumno, profesor y admin)
route('GET', '/api/clase', TODOS, ({ query, user }) => {
  const fecha = query.fecha && esFecha(query.fecha) ? query.fecha : nowAR().fecha;
  // el alumno ve SUS rutinas (personalizadas); el personal ve las generales del día
  if (user.rol === 'cliente') {
    const mias = user.cliente_id ? v2.rutinasDeCliente(user.cliente_id, fecha) : [];
    const clases = planner.claseDelDia(fecha).map(c => ({ ...c, rutina: c.formato ? (mias[0] || null) : null }));
    return { fecha, clases, rutina_libre: mias[0] || null, rutinas: mias };
  }
  const clases = planner.claseDelDia(fecha).map(c => ({ ...c, rutina: c.formato ? v2.rutinaDeDia(fecha, c.formato.id) : null }));
  return { fecha, clases, rutina_libre: v2.rutinaDeDia(fecha, 0) };
});
route('GET', '/api/grilla', TODOS, ({ query, user }) => {
  const desde = query.desde && esFecha(query.desde) ? query.desde : lunesDe(nowAR().fecha);
  return Array.from({ length: 7 }, (_, i) => {
    const f = addDays(desde, i);
    const clases = planner.claseDelDia(f).map(c => { const pr = v1.profesorDeClase(f, c.hora); const rs = v2.reservasDeClase(f, c.hora, c.formato ? { id: c.formato.id } : null, user); return { sesion_id: c.sesion_id, hora: c.hora, formato: c.formato, planificada: !!c.circuito, profesor: pr ? pr.nombre : null, reservas: rs.total, reservada: rs.reservada, exceso_reservas: user.rol === 'cliente' ? undefined : rs.exceso, limite_reservas: user.rol === 'cliente' ? undefined : rs.limite, rutina: c.formato ? !!v2.rutinaDeDia(f, c.formato.id) : false }; });
    return { fecha: f, dia: dowDe(f), clases };
  });
});

// --- Finanzas (solo administrador)
route('GET', '/api/finanzas', ADM, ({ query }) => resumenFinanzas(/^\d{4}-\d{2}$/.test(query.mes || '') ? query.mes : nowAR().fecha.slice(0, 7)));
route('POST', '/api/finanzas', ADM, async ({ req }) => {
  const b = await readBody(req);
  if (!['ingreso', 'egreso'].includes(b.tipo)) throw bad('Tipo inválido');
  const monto = num(b.monto, NaN);
  if (!(monto > 0)) throw bad('El monto debe ser mayor a cero');
  const cat = str(b.categoria, 40) || 'Otros';
  const dev = b.tipo === 'egreso' ? Math.max(1, Math.min(60, parseInt(b.devengar_meses || 1, 10) || 1)) : 1;
  const fechaMov = requireFecha(b.fecha || nowAR().fecha);
  const r = run('INSERT INTO finanzas (tipo, categoria, concepto, monto, fecha, fijo, devengar_meses) VALUES (?,?,?,?,?,?,?)', b.tipo, cat, str(b.concepto, 120) || null, monto, requireFecha(b.fecha || nowAR().fecha), b.tipo === 'egreso' && b.fijo ? 1 : 0, dev);
  const id = Number(r.lastInsertRowid);
  if (b.tipo === 'egreso' && fechaMov > nowAR().fecha) { const mes = v2.enviarAPresupuesto(fechaMov, cat, monto, str(b.concepto, 120), dev, id); return { id, presupuestado: true, mes }; }
  return { id };
});
route('DELETE', '/api/finanzas/:id', ADM, ({ params }) => { const id = Number(params.id); const r = run('DELETE FROM finanzas WHERE id = ? AND pago_id IS NULL', id); if (r.changes) v2.quitarDePresupuesto(id); return { ok: true }; });
route('POST', '/api/finanzas/replicar', ADM, async ({ req }) => {
  const b = await readBody(req);
  if (!/^\d{4}-\d{2}$/.test(b.desde || '') || !/^\d{4}-\d{2}$/.test(b.hasta || '')) throw bad('Meses inválidos');
  const fijos = all("SELECT * FROM finanzas WHERE tipo = 'egreso' AND fijo = 1 AND fecha BETWEEN ? AND ?", b.desde + '-01', b.desde + '-31');
  let n = 0;
  tx(() => { for (const f of fijos) { run('INSERT INTO finanzas (tipo, categoria, concepto, monto, fecha, fijo) VALUES (?,?,?,?,?,1)', 'egreso', f.categoria, f.concepto, f.monto, b.hasta + '-01'); n++; } });
  return { copiados: n };
});

// --- Backups
route('GET', '/api/backups', ADM, () => ({ hora_programada: backup.HORA_BACKUP, carpeta: backup.BACKUP_DIR, ultimo: JSON.parse(getConfig('ultimo_backup', 'null')), archivos: backup.listar() }));
route('POST', '/api/backups/ahora', ADM, async () => backup.hacerBackup('manual'));
// ------------------------------------------------------------ Versión 1 (marca, sincronización, CRM, caja, finanzas, staff)
v1.registrar({ route, ADM, STAFF, TODOS, PUB, HttpError, bad, readBody, str, num, requireFecha, fechaOpc, soloDigitos, normTel });
// ------------------------------------------------------------ Versión 2 (país, campañas, reservas, rutinas, deshacer pagos, estado de resultados)
v2.registrar({ route, ADM, STAFF, TODOS, PUB, HttpError, bad, readBody, str, num, requireFecha, fechaOpc, soloDigitos, validarFoto, normTel, bajaEfectiva, semaforoAlta, listaClientes });
require('./api-v4').registrar({ route, ADM, STAFF, TODOS, PUB, HttpError, bad, readBody, str });
require('./api-v6').registrar({ route, ADM, STAFF, TODOS, PUB, HttpError, bad, readBody, str });
require('./api-v7').registrar({ route, ADM, STAFF, TODOS, PUB, HttpError, bad, readBody, str });
require('./api-v8').registrar({ route, ADM, STAFF, TODOS, PUB, HttpError, bad, readBody, str });
require('./api-v4').registrarV5({ route, ADM, STAFF, TODOS, PUB, HttpError, bad, readBody, str });
require('./api-v3').registrar({ route, ADM, STAFF, TODOS, PUB, HttpError, bad, readBody, str, num, requireFecha, fechaOpc, soloDigitos, normTel, claseAhora, registrarAsistencia, semaforoAlta, horasDeAgenda, asegurarSesion });
// ------------------------------------------------------------ despacho
async function dispatch(req, pathname, query) {
  try {
    for (const r of routes) {
      if (r.method !== req.method) continue;
      const m = r.rx.exec(pathname);
      if (!m) continue;
      const params = {}; r.keys.forEach((k, i) => params[k] = m[i + 1]);
      let user = null;
      if (r.roles) {
        const h = (req.headers && req.headers.authorization) || '';
        user = usuarioDeToken(h.startsWith('Bearer ') ? h.slice(7) : query.t);
        if (!user) throw new HttpError(401, 'Sesión vencida: volvé a ingresar');
        // el profesor se rige por sus permisos; el resto, por rol
        const need = user.rol === 'profesor' ? permisos.requerido(req.method, pathname) : null;
        if (need) { if (!permisos.tiene(user, need)) throw new HttpError(403, 'No tenés permiso para esto. Pedíselo al administrador.'); }
        else if (!r.roles.includes(user.rol)) throw forbidden();
      }
      const out = await r.handler({ req, params, query, user });
      return { status: 200, body: out === undefined ? { ok: true } : out };
    }
    throw new HttpError(404, 'Ruta no encontrada');
  } catch (e) {
    if (!(e instanceof HttpError) && !e.status) console.error('[error]', req.method, pathname, e);
    const status = e.status || 500;
    return { status, body: { error: e instanceof HttpError || e.status ? e.message : 'Error interno del servidor' } };
  }
}

module.exports = { iniciarAutoPlan: v1.iniciarAutoPlan, dispatch, route, routes, HttpError, bad, forbidden, readBody, str, ADM, STAFF, TODOS, PUB };
