'use strict';
// Rutas de la Versión 1: marca blanca, sincronización con la nube, equipamiento con sugerencias, agenda del staff,
// CRM de visitas, caja diaria, planes de precios y análisis / proyección financiera.
const { all, get, run, tx, getConfig, setConfig, ZONAS } = require('./db');
const { nowAR, addDays, diffDays, dowDe, lunesDe, esFecha } = require('./util');
const { semaforoAlta } = require('./semaforos');
const planner = require('./planner');
const semana = require('./semana');
const sync = require('./sync');
const v2 = require('./api-v2');
const permisos = require('./permisos');
const { PATRON_ZONA } = require('./seed-ejercicios-v1');

const FUENTES_TEXTO = ['Sistema', 'Inter', 'Roboto', 'Open Sans', 'Montserrat', 'Poppins', 'Lato', 'Nunito', 'Source Sans 3', 'Work Sans', 'Raleway', 'Barlow'];
const FUENTES = ['Barlow Condensed', 'Bebas Neue', 'Oswald', 'Montserrat', 'Poppins', 'Anton', 'Archivo Black', 'Rajdhani', 'Teko', 'Orbitron', 'Righteous', 'Playfair Display', 'Roboto Slab', 'Lobster', 'Sistema'];

// ---------------------------------------------------------------- sugerencias de ejercicios para equipamiento nuevo
// "IA" basada en reglas: reconoce la familia del equipo por su nombre y propone ejercicios (con progresiones y tipo de movimiento).
const FAMILIAS = [
  { re: /trx|suspensi|cinta|correa/i, ej: [
    ['Espalda', 'Remo en suspensión', 'Remo en suspensión con pies elevados', 'Remo en suspensión a una mano', 'remo_inv'],
    ['Pecho', 'Flexiones en suspensión', 'Flexiones en suspensión con pies elevados', 'Flexiones en suspensión a una mano', 'flexion'],
    ['Piernas', 'Sentadilla en suspensión asistida', 'Sentadilla en suspensión a una pierna', 'Pistol en suspensión', 'sentadilla'],
    ['Bíceps', 'Curl de bíceps en suspensión', 'Curl en suspensión con cuerpo más inclinado', 'Curl en suspensión a una mano', 'curl'],
    ['Tríceps', 'Extensión de tríceps en suspensión', 'Extensión en suspensión con cuerpo más inclinado', 'Extensión en suspensión a una mano', 'ext_tri'],
    ['Core', 'Plancha con pies en suspensión', 'Plancha con pies en suspensión y rodillas al pecho', 'Pica con pies en suspensión', 'plancha'],
    ['Hombros', 'Elevación en Y en suspensión', 'Elevación en Y con cuerpo más inclinado', 'Elevación en Y a una mano', 'elev_front'],
    ['Resistencia aeróbica', 'Escalador con pies en suspensión', 'Escalador con pies en suspensión veloz', 'Burpee con pies en suspensión', 'escalador'],
  ] },
  { re: /caj[oó]n|step|plataforma|banco|escal[oó]n/i, ej: [
    ['Piernas', 'Subida al cajón', 'Subida al cajón con rodilla arriba', 'Subida al cajón con salto', 'subida'],
    ['Piernas', 'Sentadilla búlgara con pie en el cajón', 'Búlgara con mancuernas', 'Búlgara con salto', 'zancada'],
    ['Resistencia aeróbica', 'Salto al cajón', 'Salto al cajón continuo', 'Salto al cajón con descenso lento', 'salto'],
    ['Tríceps', 'Fondos de tríceps en cajón', 'Fondos con piernas estiradas', 'Fondos con pies elevados', 'fondos'],
    ['Pecho', 'Flexiones con manos en el cajón', 'Flexiones con pies en el cajón', 'Flexiones con pies elevados y palmada', 'flexion'],
    ['Core', 'Abdominal con pies en el cajón', 'Abdominal completo con pies elevados', 'Abdominal con pausa arriba', 'abdominal'],
    ['Hombros', 'Pica con pies en el cajón', 'Pica con pies altos', 'Flexión pica con pausa', 'pica'],
  ] },
  { re: /soga|cuerda|battle|ondas/i, ej: [
    ['Resistencia aeróbica', 'Ondas alternadas con soga', 'Ondas alternadas en sentadilla', 'Ondas alternadas con salto', 'slam'],
    ['Resistencia aeróbica', 'Ondas simultáneas con soga', 'Ondas simultáneas en sentadilla', 'Ondas simultáneas con zancada', 'slam'],
    ['Hombros', 'Ondas altas con soga', 'Ondas altas en zancada', 'Ondas altas con salto', 'press_vert'],
    ['Core', 'Giros con soga en sentadilla', 'Giros con soga en plancha', 'Barrido lateral con soga', 'ruso'],
    ['Espalda', 'Remo con soga de batalla', 'Remo con soga semiagachado', 'Remo con soga a una mano', 'remo_inc'],
    ['Bíceps', 'Curl con soga de batalla', 'Curl alternado con soga', 'Curl con soga y sentadilla', 'curl'],
  ] },
  { re: /landmine|barra|olimp/i, ej: [
    ['Hombros', 'Press landmine a una mano', 'Press landmine en zancada', 'Press landmine con rotación', 'press_vert'],
    ['Espalda', 'Remo landmine', 'Remo landmine con pausa', 'Remo landmine a una mano', 'remo_inc'],
    ['Core', 'Rotaciones con landmine', 'Rotaciones landmine en zancada', 'Rotaciones landmine explosivas', 'ruso'],
    ['Piernas', 'Sentadilla goblet con landmine', 'Sentadilla landmine con pausa', 'Sentadilla landmine con salto', 'sentadilla'],
    ['Pecho', 'Press de pecho landmine', 'Press landmine en zancada', 'Press landmine explosivo', 'empuje'],
    ['Tríceps', 'Extensión de tríceps con barra', 'Press cerrado con barra', 'Press cerrado con pausa', 'ext_tri'],
  ] },
  { re: /slider|deslizador|disco|toalla/i, ej: [
    ['Core', 'Escalador con sliders', 'Escalador con sliders cruzado', 'Escalador con sliders veloz', 'escalador'],
    ['Piernas', 'Curl femoral con sliders', 'Curl femoral con sliders a una pierna', 'Curl femoral con pausa', 'puente'],
    ['Piernas', 'Zancada lateral con slider', 'Zancada lateral con slider y pausa', 'Zancada lateral con mancuerna', 'lateral'],
    ['Pecho', 'Aperturas con sliders', 'Aperturas con sliders en rodillas', 'Aperturas con sliders en puntas', 'apertura'],
    ['Core', 'Plancha con sliders y brazos al frente', 'Plancha con sliders y círculos', 'Plancha con sliders y paso lateral', 'plancha'],
    ['Hombros', 'Pica con sliders', 'Pica con sliders cruzada', 'Pica con sliders a una pierna', 'pica'],
  ] },
  { re: /bosu|bal[oó]n|fitball|pelota|swiss/i, ej: [
    ['Core', 'Plancha sobre pelota', 'Plancha con codos sobre pelota inestable', 'Plancha con círculos de codos', 'plancha'],
    ['Pecho', 'Flexiones con manos sobre pelota', 'Flexiones con pies sobre pelota', 'Flexiones con pies sobre pelota y rodillas al pecho', 'flexion'],
    ['Resistencia aeróbica', 'Slam con balón', 'Slam con balón en sentadilla', 'Slam con balón y salto', 'slam'],
    ['Piernas', 'Sentadilla sobre pelota contra la pared', 'Sentadilla a una pierna con pelota', 'Sentadilla con salto sobre pelota', 'sentadilla'],
    ['Core', 'Curl abdominal sobre pelota', 'Curl abdominal con pausa', 'Curl abdominal con balón', 'abdominal'],
    ['Espalda', 'Superman sobre pelota', 'Superman sobre pelota con pausa', 'Superman sobre pelota con elevación', 'superman'],
  ] },
  { re: /mancuerna|kettle|pesa|rusa|disco|barra z|mancuernas/i, ej: [
    ['Resistencia aeróbica', 'Swing con pesa', 'Swing con pesa y pausa', 'Swing alternado', 'swing'],
    ['Piernas', 'Sentadilla goblet', 'Goblet con pausa', 'Goblet con salto', 'sentadilla'],
    ['Piernas', 'Peso muerto rumano con peso', 'Peso muerto a una pierna', 'Peso muerto con pausa', 'bisagra'],
    ['Hombros', 'Press de hombros con peso', 'Press alternado', 'Push press', 'press_vert'],
    ['Hombros', 'Elevaciones laterales con peso', 'Elevaciones laterales con pausa', 'Elevaciones laterales parciales', 'elev_lat'],
    ['Espalda', 'Remo con peso inclinado', 'Remo a una mano', 'Remo con pausa', 'remo_inc'],
    ['Core', 'Giro ruso con peso', 'Giro ruso con pies elevados', 'Giro ruso con pausa', 'ruso'],
  ] },
];
const GENERICOS = (X) => [
  ['Piernas', 'Sentadilla con ' + X, 'Sentadilla con pausa y ' + X, 'Sentadilla con salto y ' + X, 'sentadilla'],
  ['Piernas', 'Zancada con ' + X, 'Zancada con pausa y ' + X, 'Zancada con salto y ' + X, 'zancada'],
  ['Pecho', 'Press de pecho con ' + X, 'Press de pecho lento con ' + X, 'Press de pecho explosivo con ' + X, 'press_piso'],
  ['Espalda', 'Remo con ' + X, 'Remo con pausa y ' + X, 'Remo a una mano con ' + X, 'remo_inc'],
  ['Hombros', 'Press de hombros con ' + X, 'Press de hombros lento con ' + X, 'Press de hombros explosivo con ' + X, 'press_vert'],
  ['Bíceps', 'Curl de bíceps con ' + X, 'Curl lento con ' + X, 'Curl alternado con ' + X, 'curl'],
  ['Tríceps', 'Extensión de tríceps con ' + X, 'Extensión lenta con ' + X, 'Extensión a una mano con ' + X, 'ext_tri'],
  ['Core', 'Plancha con ' + X, 'Plancha con ' + X + ' y desplazamiento', 'Plancha dinámica con ' + X, 'plancha'],
  ['Resistencia aeróbica', 'Circuito de cardio con ' + X, 'Circuito de cardio rápido con ' + X, 'Intervalos de cardio con ' + X, 'burpee'],
];
function generarSugerencias(clave, nombre) {
  const fam = FAMILIAS.find(f => f.re.test(nombre) || f.re.test(clave));
  const base = (fam ? fam.ej : GENERICOS(nombre)).slice(0, 8);
  let n = 0;
  tx(() => {
    for (let [zona, ej, p2, p3, patron] of base) {
      zona = require('./estimulos').clasificar(zona, patron, ej, null).zona;       // las familias de equipos usan las zonas del cuerpo: se pasan al patrón de movimiento
      if (!ZONAS.includes(zona)) continue;
      if (get('SELECT 1 AS x FROM ejercicios WHERE activo = 1 AND zona = ? AND nombre = ? COLLATE NOCASE', zona, ej)) continue;
      if (get("SELECT 1 AS x FROM sugerencias WHERE estado = 'pendiente' AND zona = ? AND nombre = ? COLLATE NOCASE", zona, ej)) continue;
      run('INSERT INTO sugerencias (equipo_clave, zona, nombre, prog2, prog3, patron, creado) VALUES (?,?,?,?,?,?,?)', clave, zona, ej, p2, p3, patron || require('./estimulos').ILUSTRACION[require('./estimulos').claveDeZona(zona)] || 'sentadilla', new Date().toISOString());
      n++;
    }
  });
  return n;
}

// ---------------------------------------------------------------- percentiles y análisis
function percentil(arr, p) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const i = (s.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i);
  return s[lo] + (s[hi] - s[lo]) * (i - lo);
}
// Precio mensual que realmente paga cada alumno activo: último pago dividido por los meses que cubre (o su precio de ficha)
function ticketsActivos() {
  const hoy = nowAR().fecha;
  const out = [];
  for (const c of all('SELECT * FROM clientes')) {
    if (semaforoAlta(c, hoy).color !== 'verde') continue;
    const p = get('SELECT monto, fecha, cubre_hasta FROM pagos WHERE cliente_id = ? AND monto > 0 ORDER BY fecha DESC, id DESC LIMIT 1', c.id);
    let precio = c.precio_plan;
    if (p) {
      const meses = p.cubre_hasta ? Math.max(1, Math.round(diffDays(p.cubre_hasta, p.fecha) / 30.4)) : 1;
      precio = p.monto / meses;
    }
    if (precio > 0) out.push({ cliente_id: c.id, nombre: c.nombre, precio: Math.round(precio) });
  }
  return out;
}
function analisisTickets() {
  const t = ticketsActivos();
  const valores = t.map(x => x.precio);
  const prom = valores.length ? valores.reduce((a, b) => a + b, 0) / valores.length : 0;
  const tiers = {};
  for (const v of valores) tiers[v] = (tiers[v] || 0) + 1;
  const escalones = Object.entries(tiers).map(([precio, alumnos]) => ({ precio: Number(precio), alumnos })).sort((a, b) => a.precio - b.precio);
  const planes = all('SELECT * FROM planes WHERE activo = 1');
  const vigente = planes.length ? Math.max(...planes.map(p => Math.max(p.precio_efectivo, p.precio_mp))) : 0;
  return {
    alumnos: valores.length, precio_promedio: Math.round(prom), minimo: valores.length ? Math.min(...valores) : 0, maximo: valores.length ? Math.max(...valores) : 0,
    percentiles: { p10: percentil(valores, .1), p25: percentil(valores, .25), p50: percentil(valores, .5), p75: percentil(valores, .75), p90: percentil(valores, .9) },
    escalones, precio_vigente_max: vigente,
    bajo_vigente: vigente ? valores.filter(v => v < vigente * 0.95).length : 0,
  };
}
const RE_GRUPOS = {
  sueldos: /sueldo|salario|profesor|personal|staff/i, luz: /luz|electric|energ/i, tasas: /tasa|municipal|abl|impuesto/i,
  monotributo: /monotributo|afip|arca|autonomo/i, limpieza: /limpieza|higiene/i, equipos: /equip|mantenim|compra/i, alquiler: /alquiler/i,
};
function grupoDe(cat) { for (const [g, re] of Object.entries(RE_GRUPOS)) if (re.test(cat)) return g; return 'otros'; }
// Base de datos para el simulador: promedio de los últimos 3 meses con movimientos
function baseProyeccion() {
  const hoy = nowAR().fecha;
  const meses = [];
  for (let i = 0; i < 4; i++) { const d = new Date(Date.UTC(Number(hoy.slice(0, 4)), Number(hoy.slice(5, 7)) - 1 - i, 1)); meses.push(d.toISOString().slice(0, 7)); }
  const con = meses.filter(m => get('SELECT 1 AS x FROM finanzas WHERE fecha BETWEEN ? AND ?', m + '-01', m + '-31'));
  const usar = (con.length > 1 ? con.filter(m => m !== meses[0]) : con).slice(0, 3); // el mes en curso está incompleto si hay otros
  const n = usar.length || 1;
  const grupos = { sueldos: 0, luz: 0, tasas: 0, monotributo: 0, limpieza: 0, equipos: 0, alquiler: 0, otros: 0 };
  let fijos = 0, variables = 0, ingresos = 0;
  const cats = {};
  for (const m of usar) {
    for (const e of all("SELECT categoria, monto, fijo FROM finanzas WHERE tipo = 'egreso' AND fecha BETWEEN ? AND ?", m + '-01', m + '-31')) {
      grupos[grupoDe(e.categoria)] += e.monto / n;
      if (e.fijo) fijos += e.monto / n; else variables += e.monto / n;
      cats[e.categoria] = (cats[e.categoria] || 0) + e.monto / n;
    }
    ingresos += get("SELECT COALESCE(SUM(monto),0) AS s FROM finanzas WHERE tipo = 'ingreso' AND fecha BETWEEN ? AND ?", m + '-01', m + '-31').s / n;
  }
  const t = analisisTickets();
  const hoy2 = hoy;
  const activos = all('SELECT * FROM clientes').filter(c => semaforoAlta(c, hoy2).color === 'verde').length;
  return {
    meses_base: usar, alumnos_activos: activos, ticket_promedio: t.precio_promedio, ingreso_cuotas_mensual: t.precio_promedio * t.alumnos,
    ingresos_promedio: Math.round(ingresos), gastos_fijos: Math.round(fijos), gastos_variables: Math.round(variables),
    grupos: Object.fromEntries(Object.entries(grupos).map(([k, v]) => [k, Math.round(v)])), categorias: Object.entries(cats).map(([categoria, monto]) => ({ categoria, monto: Math.round(monto), grupo: grupoDe(categoria) })),
    escalones: t.escalones, precio_vigente_max: t.precio_vigente_max,
  };
}

// ---------------------------------------------------------------- caja diaria
function cajaDelDia(fecha) {
  const movs = all('SELECT id, tipo, categoria, concepto, monto, fecha, pago_id FROM finanzas WHERE en_caja = 1 AND fecha = ? ORDER BY id', fecha);
  const base = get('SELECT * FROM caja_dia WHERE fecha <= ? ORDER BY fecha DESC LIMIT 1', fecha);
  let saldoIni = 0, explicito = false;
  if (base && base.fecha === fecha) { saldoIni = base.saldo_inicial; explicito = true; }
  else {
    const desde = base ? base.fecha : '0000-00-00';
    const r = get("SELECT COALESCE(SUM(CASE WHEN tipo='ingreso' THEN monto ELSE -monto END),0) AS s FROM finanzas WHERE en_caja = 1 AND fecha >= ? AND fecha < ?", desde, fecha);
    saldoIni = (base ? base.saldo_inicial : 0) + r.s;
  }
  const ing = movs.filter(m => m.tipo === 'ingreso'), egr = movs.filter(m => m.tipo === 'egreso');
  const tI = ing.reduce((a, m) => a + m.monto, 0), tE = egr.reduce((a, m) => a + m.monto, 0);
  return { fecha, saldo_inicial: saldoIni, saldo_inicial_manual: explicito, ingresos: ing, egresos: egr, total_ingresos: tI, total_egresos: tE, saldo_final: saldoIni + tI - tE };
}

// ---------------------------------------------------------------- agenda de profesores
function profesores() { return all("SELECT id, nombre, username, rol FROM usuarios WHERE rol IN ('admin','profesor') AND activo = 1 ORDER BY CASE rol WHEN 'profesor' THEN 0 ELSE 1 END, nombre"); }
function profesorDeClase(fecha, hora) {
  const s = get('SELECT profesor_id FROM sesiones WHERE fecha = ? AND hora = ?', fecha, hora);
  let pid = s ? s.profesor_id : null;
  let origen = 'excepcion';
  if (!pid) { const a = semana.celda(fecha, hora); pid = a ? a.profesor_id : null; origen = 'agenda'; }
  if (!pid) return null;
  const u = get('SELECT id, nombre FROM usuarios WHERE id = ?', pid);
  return u ? { id: u.id, nombre: u.nombre, origen } : null;
}
function agendaStaff(desde) {
  const formatos = new Map(all('SELECT * FROM formatos').map(f => [f.id, f]));
  const dias = [];
  for (let i = 0; i < 7; i++) {
    const fecha = addDays(desde, i);
    const filas = semana.agendaDe(fecha);
    dias.push({ fecha, dia: dowDe(fecha), clases: filas.map(a => {
      const f = formatos.get(a.formato_id);
      return { hora: a.hora, formato: f ? { id: f.id, nombre: f.nombre, color: f.color } : null, profesor: profesorDeClase(fecha, a.hora) };
    }) });
  }
  return { desde, dias, profesores: profesores() };
}

// ---------------------------------------------------------------- CRM
const visitas = new Map(); // limitador del formulario público
function limitarVisita(ip) {
  const ahora = Date.now();
  const lista = (visitas.get(ip) || []).filter(t => ahora - t < 10 * 60 * 1000);
  const global = (visitas.get('*') || []).filter(t => ahora - t < 60 * 60 * 1000);
  if (lista.length >= 4 || global.length >= 80) return true;
  lista.push(ahora); global.push(ahora); visitas.set(ip, lista); visitas.set('*', global);
  return false;
}
const SQL_LEADS = `SELECT l.*, u.nombre AS profesor, ca.nombre AS campana, ca.tipo AS campana_tipo, rc.nombre AS referido,
  (l.cliente_id IS NOT NULL AND EXISTS (SELECT 1 FROM pagos p WHERE p.cliente_id = l.cliente_id)) AS pago
  FROM leads l LEFT JOIN usuarios u ON u.id = l.profesor_id LEFT JOIN campanas ca ON ca.id = l.campana_id LEFT JOIN clientes rc ON rc.id = l.referido_id`;
function crmDelMes(mes) {
  const leads = all(SQL_LEADS + ' WHERE l.fecha BETWEEN ? AND ? ORDER BY l.fecha DESC, l.id DESC', mes + '-01', mes + '-31');
  const total = leads.length, conv = leads.filter(l => l.pago).length;
  const porProf = {};
  for (const l of leads) {
    const k = l.profesor_id || 0;
    const p = porProf[k] || (porProf[k] = { profesor_id: l.profesor_id || null, profesor: l.profesor || 'Sin asignar', visitas: 0, convertidos: 0 });
    p.visitas++; if (l.pago) p.convertidos++;
  }
  const por_profesor = Object.values(porProf).map(p => ({ ...p, tasa: p.visitas ? Math.round(1000 * p.convertidos / p.visitas) / 10 : 0 })).sort((a, b) => b.convertidos - a.convertidos || b.visitas - a.visitas);
  const porOrigen = { manual: leads.filter(l => l.origen === 'manual').length, qr: leads.filter(l => l.origen === 'qr').length };
  const porCamp = {};
  for (const l of leads) {
    const k = l.campana || 'Sin campaña';
    const p = porCamp[k] || (porCamp[k] = { campana: k, visitas: 0, convertidos: 0 });
    p.visitas++; if (l.pago) p.convertidos++;
  }
  const por_campana = Object.values(porCamp).map(p => ({ ...p, tasa: p.visitas ? Math.round(1000 * p.convertidos / p.visitas) / 10 : 0 })).sort((a, b) => b.visitas - a.visitas);
  return { mes, kpis: { visitantes: total, convertidos: conv, tasa_conversion: total ? Math.round(1000 * conv / total) / 10 : 0, por_origen: porOrigen }, por_profesor, por_campana, leads };
}

// ---------------------------------------------------------------- auto-planificación
let autoTimer = null;
function autoPlanificar() {
  if (sync.NODO === 'nube') return null;
  try { return planner.generarRango(nowAR().fecha, 21, false); } catch (e) { return { error: e.message }; }
}
function iniciarAutoPlan() {
  if (sync.NODO === 'nube' || autoTimer) return;
  setTimeout(autoPlanificar, 5000);
  autoTimer = setInterval(autoPlanificar, 60 * 60 * 1000);
  if (autoTimer.unref) autoTimer.unref();
}

// ---------------------------------------------------------------- registro de rutas
function registrar(c) {
  const { route, ADM, STAFF, TODOS, PUB, HttpError, bad, readBody, str, num, requireFecha, fechaOpc, soloDigitos } = c;
  const normTel = c.normTel || ((v) => v);
  const intOpc = (v) => (v === undefined || v === null || v === '' ? null : Number(v));

  // --- Marca blanca
  const TEMA_BASE = { fondo: 'defecto', fondo_color: '#0e1013', fondo_imagen: null, fondo_veladura: 55, texto_color: '#eef1f6', fuente_texto: 'Sistema', boton_color: '#ff6b35', icono_fondo: '#0e1013' };
  const leerTema = () => { try { return { ...TEMA_BASE, ...JSON.parse(getConfig('tema', '{}') || '{}') }; } catch (_) { return { ...TEMA_BASE }; } };
  const marca = () => ({
    nombre: getConfig('marca_nombre', 'OMEGA'), fuente: getConfig('marca_fuente', 'Barlow Condensed'),
    logo: getConfig('marca_logo', '') || null, ver_nombre: getConfig('marca_ver_nombre', '1') !== '0', fuentes: FUENTES, fuentes_texto: FUENTES_TEXTO,
    tema: leerTema(), icono_propio: !!getConfig('icono_192', ''), icono_fuente: getConfig('marca_icono', '') || null, icono_v: getConfig('icono_v', '') || '',
  });
  route('GET', '/api/marca', PUB, () => marca());
  route('PUT', '/api/marca', STAFF, async ({ req }) => {
    const b = await readBody(req, 4 * 1024 * 1024);
    if (b.nombre !== undefined) { const n = str(b.nombre, 40); if (!n) throw bad('Escribí el nombre del gimnasio'); setConfig('marca_nombre', n); }
    if (b.fuente !== undefined) { if (!FUENTES.includes(b.fuente)) throw bad('Tipografía no disponible'); setConfig('marca_fuente', b.fuente); }
    if (b.ver_nombre !== undefined) setConfig('marca_ver_nombre', b.ver_nombre ? '1' : '0');
    if (b.logo !== undefined) {
      if (!b.logo) setConfig('marca_logo', '');
      else {
        if (typeof b.logo !== 'string' || !/^data:image\/(png|jpe?g|webp|svg\+xml);base64,/.test(b.logo)) throw bad('La imagen del logo no es válida (PNG, JPG, WEBP o SVG)');
        if (b.logo.length > 600 * 1024) throw bad('El logo es demasiado pesado (máximo 400 KB)');
        setConfig('marca_logo', b.logo);
      }
    }
    // Diseño de la aplicación: fondo, letras y color de los botones
    if (b.tema !== undefined) {
      const t = b.tema || {}; const nuevo = { ...leerTema() };
      const hex = (v, d) => (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v.toLowerCase() : d);
      if (t.fondo !== undefined) nuevo.fondo = ['defecto', 'color', 'imagen'].includes(t.fondo) ? t.fondo : 'defecto';
      if (t.fondo_color !== undefined) nuevo.fondo_color = hex(t.fondo_color, nuevo.fondo_color);
      if (t.texto_color !== undefined) nuevo.texto_color = hex(t.texto_color, nuevo.texto_color);
      if (t.boton_color !== undefined) nuevo.boton_color = hex(t.boton_color, nuevo.boton_color);
      if (t.icono_fondo !== undefined) nuevo.icono_fondo = hex(t.icono_fondo, nuevo.icono_fondo);
      if (t.fondo_veladura !== undefined) nuevo.fondo_veladura = Math.max(0, Math.min(90, parseInt(t.fondo_veladura, 10) || 0));
      if (t.fuente_texto !== undefined) { if (!FUENTES_TEXTO.includes(t.fuente_texto)) throw bad('Tipografía no disponible'); nuevo.fuente_texto = t.fuente_texto; }
      if (t.fondo_imagen !== undefined) {
        if (!t.fondo_imagen) nuevo.fondo_imagen = null;
        else {
          if (typeof t.fondo_imagen !== 'string' || !/^data:image\/(png|jpe?g|webp);base64,/.test(t.fondo_imagen)) throw bad('La imagen de fondo no es válida (PNG, JPG o WEBP)');
          if (t.fondo_imagen.length > 900 * 1024) throw bad('La imagen de fondo es demasiado pesada');
          nuevo.fondo_imagen = t.fondo_imagen;
        }
      }
      if (nuevo.fondo === 'imagen' && !nuevo.fondo_imagen) nuevo.fondo = 'defecto';
      setConfig('tema', JSON.stringify(nuevo));
    }
    // Ícono de la app: la pantalla genera los PNG (a partir del logo o de una imagen propia) y acá se guardan para el celular y la PC
    if (b.icono_fuente !== undefined) {
      if (!b.icono_fuente) setConfig('marca_icono', '');
      else {
        if (typeof b.icono_fuente !== 'string' || !/^data:image\/(png|jpe?g|webp|svg\+xml);base64,/.test(b.icono_fuente)) throw bad('La imagen del ícono no es válida');
        if (b.icono_fuente.length > 600 * 1024) throw bad('La imagen del ícono es demasiado pesada');
        setConfig('marca_icono', b.icono_fuente);
      }
    }
    if (b.iconos !== undefined) {
      const MEDIDAS = ['64', '180', '192', '256', '512', 'm512'];
      if (!b.iconos) { for (const m of MEDIDAS) setConfig('icono_' + m, ''); setConfig('icono_v', ''); }
      else {
        for (const m of MEDIDAS) {
          const v = b.iconos[m]; if (v === undefined) continue;
          if (typeof v !== 'string' || !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(v)) throw bad('El ícono no es válido');
          if (v.length > 400 * 1024) throw bad('El ícono es demasiado pesado');
          setConfig('icono_' + m, v);
        }
        setConfig('icono_v', String(Date.now()));
        try { require('./icono').escribirIco(getConfig('icono_256', '')); } catch (_) {} // ícono del acceso directo de Windows
      }
    }
    return marca();
  });

  // --- Dirección de la app (para el QR de instalación)
  route('GET', '/api/app-url', STAFF, () => ({
    guardada: getConfig('url_app', '') || null,
    nube: sync.configuracion().url || null,
    lan: (globalThis.__OMEGA_IPS__ || []).map(ip => 'http://' + ip + ':' + (process.env.PORT || 3000)),
    nodo: sync.NODO,
  }));
  route('PUT', '/api/app-url', ADM, async ({ req }) => {
    const b = await readBody(req);
    const u = str(b.url, 200).replace(/\/+$/, '');
    if (u && !/^https?:\/\/[^\s]+$/i.test(u)) throw bad('La dirección debe empezar con http:// o https://');
    setConfig('url_app', u);
    return { guardada: u || null };
  });

  // --- Sincronización PC <-> nube
  route('POST', '/api/sync', PUB, async ({ req }) => {
    if (sync.NODO !== 'nube') throw new HttpError(404, 'Ruta no encontrada');
    const clave = process.env.SYNC_CLAVE || '';
    if (!clave) throw new HttpError(503, 'La nube no tiene configurada la SYNC_CLAVE');
    const body = await readBody(req, 60 * 1024 * 1024);
    const h = req.headers || {};
    if (!sync.verificarFirma(clave, h['x-sync-ts'], h['x-sync-firma'], req.rawBody || '')) throw new HttpError(401, 'Firma inválida');
    return sync.procesarPeticion(body);
  });
  route('GET', '/api/sync/estado', STAFF, () => sync.estado());
  // Botón "Sincronizar" de un gimnasio nuevo: se cargan la dirección de su aplicación web y su clave (las entrega la herramienta de alta),
  // se prueba la conexión y recién ahí se guardan. La clave queda solo en esta PC (C:\OMEGA\nube.txt), nunca en la base de datos que se copia.
  route('POST', '/api/sync/conectar', ADM, async ({ req }) => {
    if (sync.NODO === 'nube') throw new HttpError(403, 'Esto se configura en la PC del gimnasio');
    const b = await readBody(req);
    const url = str(b.url, 200).replace(/\/+$/, ''); const clave = str(b.clave, 200);
    if (!/^https?:\/\/[^\s]+$/i.test(url)) throw bad('La dirección debe empezar con https:// (ej. https://omega-migimnasio.onrender.com)');
    if (clave.length < 12 || /\s/.test(clave)) throw bad('La clave de sincronización no es válida');
    const r = await require('./nube-conexion').conectarNube(url, clave);
    if (!r.ok) throw bad('No se pudo conectar: ' + (r.error || 'sin respuesta de la nube'));
    return { ...r, estado: sync.estado() };
  });
  route('POST', '/api/sync/ahora', ADM, async () => { const r = await sync.sincronizar('manual'); return { ...r, estado: sync.estado() }; });

  // --- Equipamiento: alta y sugerencias de ejercicios
  route('POST', '/api/equipamiento', ADM, async ({ req }) => {
    const b = await readBody(req);
    const nombre = str(b.nombre, 60), cant = parseInt(b.cantidad, 10);
    if (!nombre) throw bad('Escribí el nombre del equipamiento');
    if (!(cant >= 0 && cant <= 999)) throw bad('Cantidad inválida');
    let clave = nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 30) || 'equipo';
    if (get('SELECT 1 AS x FROM equipamiento WHERE nombre = ? COLLATE NOCASE', nombre)) throw bad('Ya existe un equipamiento con ese nombre: actualizá su cantidad');
    let k = clave, i = 2; while (get('SELECT 1 AS x FROM equipamiento WHERE clave = ?', k)) k = clave + '_' + i++;
    run('INSERT INTO equipamiento (clave, nombre, cantidad) VALUES (?,?,?)', k, nombre, cant);
    const n = generarSugerencias(k, nombre);
    return { clave: k, sugerencias: n };
  });
  route('PUT', '/api/equipamiento/:clave', ADM, async ({ req, params }) => {
    const b = await readBody(req);
    const e = get('SELECT * FROM equipamiento WHERE clave = ?', params.clave);
    if (!e) throw new HttpError(404, 'Equipamiento no encontrado');
    const cant = b.cantidad !== undefined ? parseInt(b.cantidad, 10) : e.cantidad;
    if (!(cant >= 0 && cant <= 999)) throw bad('Cantidad inválida');
    run('UPDATE equipamiento SET nombre = ?, cantidad = ? WHERE clave = ?', str(b.nombre ?? e.nombre, 60) || e.nombre, cant, e.clave);
    return { ok: true };
  });
  route('POST', '/api/equipamiento/:clave/sugerir', ADM, ({ params }) => {
    const e = get('SELECT * FROM equipamiento WHERE clave = ?', params.clave);
    if (!e) throw new HttpError(404, 'Equipamiento no encontrado');
    return { sugerencias: generarSugerencias(e.clave, e.nombre) };
  });
  const sugerenciasPend = () => all(`SELECT s.*, q.nombre AS equipo_nombre FROM sugerencias s LEFT JOIN equipamiento q ON q.clave = s.equipo_clave WHERE s.estado = 'pendiente' ORDER BY s.id`);
  route('GET', '/api/sugerencias', STAFF, () => sugerenciasPend());
  function aceptar(s) {
    if (!get('SELECT 1 AS x FROM ejercicios WHERE activo = 1 AND zona = ? AND nombre = ? COLLATE NOCASE', s.zona, s.nombre)) {
      const cl = require('./estimulos').clasificar(s.zona, s.patron, s.nombre, null);
      run("INSERT INTO ejercicios (zona, nombre, prog2, prog3, equipo, unidades, patron, origen, capacidad, energia) VALUES (?,?,?,?,?,1,?,'sugerido',?,?)", s.zona, s.nombre, s.prog2, s.prog3, s.equipo_clave, s.patron || require('./estimulos').ILUSTRACION[require('./estimulos').claveDeZona(s.zona)] || 'sentadilla', cl.capacidad, cl.energia);
    }
    run("UPDATE sugerencias SET estado = 'aceptada' WHERE id = ?", s.id);
  }
  route('POST', '/api/sugerencias/aceptar-todas', ADM, () => { const l = sugerenciasPend(); tx(() => l.forEach(aceptar)); return { aceptadas: l.length }; });
  route('POST', '/api/sugerencias/:id/aceptar', ADM, ({ params }) => {
    const s = get("SELECT * FROM sugerencias WHERE id = ? AND estado = 'pendiente'", Number(params.id));
    if (!s) throw new HttpError(404, 'Sugerencia no encontrada');
    tx(() => aceptar(s)); return { ok: true };
  });
  route('DELETE', '/api/sugerencias/:id', ADM, ({ params }) => { run("UPDATE sugerencias SET estado = 'descartada' WHERE id = ?", Number(params.id)); return { ok: true }; });

  // --- Agenda del staff
  route('GET', '/api/staff/agenda', STAFF, ({ query }) => agendaStaff(query.desde && esFecha(query.desde) ? lunesDe(query.desde) : lunesDe(nowAR().fecha)));
  route('PUT', '/api/staff/agenda', STAFF, async ({ req }) => {
    const b = await readBody(req);
    if (!Array.isArray(b.celdas)) throw bad('Formato inválido');
    tx(() => {
      for (const x of b.celdas) {
        const dia = parseInt(x.dia, 10), hora = parseInt(x.hora, 10), pid = intOpc(x.profesor_id);
        if (pid && !get("SELECT 1 AS y FROM usuarios WHERE id = ? AND rol IN ('admin','profesor')", pid)) throw bad('Profesor inválido');
        semana.asignarProfesor(lunesDe(b.semana && esFecha(b.semana) ? b.semana : nowAR().fecha), dia, hora, pid);
      }
    });
    return { ok: true };
  });
  route('PUT', '/api/staff/sesion', STAFF, async ({ req }) => {
    const b = await readBody(req);
    const fecha = requireFecha(b.fecha), hora = parseInt(b.hora, 10), pid = intOpc(b.profesor_id);
    const a = semana.celda(fecha, hora);
    if (!a || !a.formato_id) throw bad('Ese día no hay clase en ese horario');
    if (pid && !get("SELECT 1 AS y FROM usuarios WHERE id = ? AND rol IN ('admin','profesor')", pid)) throw bad('Profesor inválido');
    run('INSERT INTO sesiones (fecha, hora, formato_id, profesor_id) VALUES (?,?,?,?) ON CONFLICT(fecha, hora) DO UPDATE SET profesor_id = excluded.profesor_id', fecha, hora, a.formato_id, pid);
    semana.asignarProfesor(lunesDe(fecha), dowDe(fecha), hora, pid);
    return { ok: true };
  });
  route('GET', '/api/staff/mis-turnos', STAFF, ({ user }) => {
    const hoy = nowAR().fecha, turnos = [];
    for (let i = 0; i < 14; i++) {
      const fecha = addDays(hoy, i);
      for (const a of semana.agendaDe(fecha)) {
        const p = profesorDeClase(fecha, a.hora);
        if (p && p.id === user.id) { const f = get('SELECT nombre, color FROM formatos WHERE id = ?', a.formato_id); { const ci = get('SELECT id FROM circuitos WHERE fecha = ? AND formato_id = ?', fecha, a.formato_id); turnos.push({ fecha, hora: a.hora, formato: f ? f.nombre : '', color: f ? f.color : null, circuito_id: ci ? ci.id : null }); } }
      }
    }
    return { turnos };
  });

  // --- CRM de visitas
  const mesQ = (q) => (/^\d{4}-\d{2}$/.test(q.mes || '') ? q.mes : nowAR().fecha.slice(0, 7));
  route('GET', '/api/leads', STAFF, ({ query }) => ({ ...crmDelMes(mesQ(query)), profesores: profesores() }));
  function datosLead(b, user, ant) {
    const nombre = str(b.nombre ?? (ant && ant.nombre), 120);
    if (!nombre) throw bad('Escribí el nombre y apellido');
    const pid = b.profesor_id !== undefined ? intOpc(b.profesor_id) : (ant ? ant.profesor_id : (user.rol === 'profesor' ? user.id : null));
    const cid = b.campana_id !== undefined ? intOpc(b.campana_id) : (ant ? ant.campana_id : null);
    const camp = cid ? get('SELECT * FROM campanas WHERE id = ?', cid) : null;
    if (cid && !camp) throw bad('Campaña inexistente');
    let rid = b.referido_id !== undefined ? intOpc(b.referido_id) : (ant ? ant.referido_id : null);
    if (!camp || camp.tipo !== 'recomendado') rid = null;
    else if (rid && !get('SELECT 1 AS x FROM clientes WHERE id = ?', rid)) throw bad('El alumno que recomendó no existe');
    return { nombre, telefono: normTel(str(b.telefono ?? (ant && ant.telefono), 40)) || null, redes: str(b.redes ?? (ant && ant.redes), 80) || null, objetivo: str(b.objetivo ?? (ant && ant.objetivo), 160) || null, pid, cid, rid,
      nota: str(b.nota ?? (ant && ant.nota), 300) || null, fecha: b.fecha !== undefined ? requireFecha(b.fecha) : (ant ? ant.fecha : nowAR().fecha) };
  }
  route('POST', '/api/leads', STAFF, async ({ req, user }) => {
    const d = datosLead(await readBody(req), user, null);
    const r = run("INSERT INTO leads (nombre, telefono, redes, objetivo, profesor_id, fecha, origen, nota, creado, campana_id, referido_id) VALUES (?,?,?,?,?,?,'manual',?,?,?,?)", d.nombre, d.telefono, d.redes, d.objetivo, d.pid, d.fecha, d.nota, new Date().toISOString(), d.cid, d.rid);
    return { id: Number(r.lastInsertRowid) };
  });
  route('PUT', '/api/leads/:id', STAFF, async ({ req, params, user }) => {
    const l = get('SELECT * FROM leads WHERE id = ?', Number(params.id));
    if (!l) throw new HttpError(404, 'Visita no encontrada');
    const b = await readBody(req);
    const d = datosLead(b, user, l);
    const estado = ['visita', 'convertido', 'descartado'].includes(b.estado) ? b.estado : l.estado;
    run('UPDATE leads SET nombre=?, telefono=?, redes=?, objetivo=?, profesor_id=?, fecha=?, nota=?, estado=?, campana_id=?, referido_id=? WHERE id=?', d.nombre, d.telefono, d.redes, d.objetivo, d.pid, d.fecha, d.nota, estado, d.cid, d.rid, l.id);
    v2.chequearReferido(l.cliente_id);
    return { ok: true };
  });
  route('DELETE', '/api/leads/:id', ADM, ({ params }) => { run('DELETE FROM leads WHERE id = ?', Number(params.id)); return { ok: true }; });
  // vincula una visita con un alumno ya cargado
  route('POST', '/api/leads/:id/vincular', ADM, async ({ req, params }) => {
    const b = await readBody(req);
    if (!get('SELECT 1 AS x FROM clientes WHERE id = ?', Number(b.cliente_id))) throw bad('Alumno inexistente');
    run("UPDATE leads SET cliente_id = ?, estado = 'convertido' WHERE id = ?", Number(b.cliente_id), Number(params.id));
    v2.chequearReferido(Number(b.cliente_id));
    return { ok: true };
  });
  // formulario público (QR de visitas)
  route('GET', '/api/publico/profesores', PUB, () => ({ profesores: profesores().filter(p => p.rol === 'profesor').map(p => ({ id: p.id, nombre: p.nombre })), nombre: getConfig('marca_nombre', 'OMEGA') }));
  route('POST', '/api/publico/visita', PUB, async ({ req }) => {
    const b = await readBody(req, 20 * 1024);
    if (b.web) return { ok: true }; // campo trampa para robots
    const ip = (req.socket && req.socket.remoteAddress) || 'x';
    if (limitarVisita(ip)) throw new HttpError(429, 'Ya enviaste tus datos. Si necesitás corregirlos, avisale al profesor.');
    const nombre = str(b.nombre, 120), tel = str(b.telefono, 40);
    if (nombre.length < 3) throw bad('Escribí tu nombre y apellido');
    if (soloDigitos(tel).length < 6) throw bad('Escribí un teléfono válido');
    const pid = intOpc(b.profesor_id);
    const prof = pid && get("SELECT id FROM usuarios WHERE id = ? AND rol IN ('admin','profesor') AND activo = 1", pid) ? pid : null;
    run("INSERT INTO leads (nombre, telefono, redes, objetivo, profesor_id, fecha, origen, creado) VALUES (?,?,?,?,?,?,'qr',?)", nombre, normTel(tel), str(b.redes, 80) || null, str(b.objetivo, 160) || null, prof, nowAR().fecha, new Date().toISOString());
    return { ok: true };
  });

  // --- Planes de precios
  route('GET', '/api/planes', STAFF, ({ query }) => all('SELECT p.*, (SELECT COUNT(*) FROM clientes c WHERE c.plan_id = p.id) AS alumnos FROM planes p ' + (query.todos ? '' : 'WHERE p.activo = 1 ') + 'ORDER BY p.activo DESC, p.id'));
  route('POST', '/api/planes', ADM, async ({ req }) => {
    const b = await readBody(req);
    const nombre = str(b.nombre, 60); if (!nombre) throw bad('Escribí el nombre del plan');
    const r = run('INSERT INTO planes (nombre, precio_efectivo, precio_mp) VALUES (?,?,?)', nombre, Math.max(0, num(b.precio_efectivo)), Math.max(0, num(b.precio_mp)));
    return { id: Number(r.lastInsertRowid) };
  });
  route('PUT', '/api/planes/:id', ADM, async ({ req, params }) => {
    const b = await readBody(req);
    const p = get('SELECT * FROM planes WHERE id = ?', Number(params.id));
    if (!p) throw new HttpError(404, 'Plan no encontrado');
    const pe = b.precio_efectivo !== undefined ? Math.max(0, num(b.precio_efectivo)) : p.precio_efectivo;
    const pm = b.precio_mp !== undefined ? Math.max(0, num(b.precio_mp)) : p.precio_mp;
    tx(() => {
      run('UPDATE planes SET nombre = ?, precio_efectivo = ?, precio_mp = ?, activo = ? WHERE id = ?', str(b.nombre ?? p.nombre, 60) || p.nombre, pe, pm, b.activo === undefined ? p.activo : (b.activo ? 1 : 0), p.id);
      // opcional: llevar el nuevo precio a la ficha de los alumnos que tienen este plan
      if (b.aplicar_a_alumnos) run('UPDATE clientes SET precio_plan = ? WHERE plan_id = ?', pe, p.id);
    });
    return { ok: true };
  });
  route('DELETE', '/api/planes/:id', ADM, ({ params }) => {
    const id = Number(params.id);
    if (get('SELECT 1 AS x FROM clientes WHERE plan_id = ?', id)) run('UPDATE planes SET activo = 0 WHERE id = ?', id); else run('DELETE FROM planes WHERE id = ?', id);
    return { ok: true };
  });

  // --- Caja diaria (efectivo físico)
  route('GET', '/api/caja', STAFF, ({ query }) => cajaDelDia(query.fecha && esFecha(query.fecha) ? query.fecha : nowAR().fecha));
  route('POST', '/api/caja/movimiento', STAFF, async ({ req, user }) => {
    const b = await readBody(req);
    if (!['ingreso', 'egreso'].includes(b.tipo)) throw bad('Tipo inválido');
    if (!permisos.tiene(user, b.tipo === 'ingreso' ? 'fin.ingresos' : 'fin.egresos')) throw new HttpError(403, 'No tenés permiso para registrar ' + (b.tipo === 'ingreso' ? 'ingresos' : 'egresos') + ' en la caja.');
    const monto = num(b.monto, NaN); if (!(monto > 0)) throw bad('El monto debe ser mayor a cero');
    const concepto = str(b.concepto, 120); if (!concepto) throw bad('Escribí el concepto');
    const dev = b.tipo === 'egreso' ? Math.max(1, Math.min(60, parseInt(b.devengar_meses || 1, 10) || 1)) : 1;
    const r = run("INSERT INTO finanzas (tipo, categoria, concepto, monto, fecha, fijo, medio, en_caja, devengar_meses) VALUES (?,?,?,?,?,0,'efectivo',1,?)",
      b.tipo, b.tipo === 'ingreso' ? 'Ingresos en efectivo' : (str(b.categoria, 40) || 'Otros'), concepto, monto, requireFecha(b.fecha || nowAR().fecha), dev);
    return { id: Number(r.lastInsertRowid) };
  });
  route('DELETE', '/api/caja/movimiento/:id', ADM, ({ params }) => {
    const r = run('DELETE FROM finanzas WHERE id = ? AND en_caja = 1 AND pago_id IS NULL', Number(params.id));
    if (!r.changes) throw bad('Las cuotas cobradas en efectivo se corrigen desde la ficha del alumno');
    return { ok: true };
  });
  route('PUT', '/api/caja/saldo-inicial', ADM, async ({ req }) => {
    const b = await readBody(req);
    const fecha = requireFecha(b.fecha || nowAR().fecha), monto = num(b.monto, NaN);
    if (!Number.isFinite(monto)) throw bad('Monto inválido');
    run('INSERT INTO caja_dia (fecha, saldo_inicial) VALUES (?,?) ON CONFLICT(fecha) DO UPDATE SET saldo_inicial = excluded.saldo_inicial', fecha, monto);
    return cajaDelDia(fecha);
  });

  // --- Análisis del mes y proyección
  route('GET', '/api/finanzas/analisis', ADM, ({ query }) => {
    const mes = mesQ(query);
    const ing = all("SELECT COALESCE(medio,'otro') AS medio, SUM(monto) AS total, COUNT(*) AS n FROM finanzas WHERE tipo = 'ingreso' AND categoria = 'Cuotas' AND fecha BETWEEN ? AND ? GROUP BY COALESCE(medio,'otro')", mes + '-01', mes + '-31');
    return { mes, tickets: analisisTickets(), cuotas_por_medio: ing, planes: all('SELECT p.*, (SELECT COUNT(*) FROM clientes c WHERE c.plan_id = p.id) AS alumnos FROM planes p ORDER BY p.activo DESC, p.id') };
  });
  route('GET', '/api/finanzas/base-proyeccion', ADM, () => baseProyeccion());
}

module.exports = { registrar, profesorDeClase, iniciarAutoPlan, autoPlanificar, generarSugerencias, percentil, FUENTES };
