'use strict';
// Datos de ejemplo para probar toda la aplicación (alumnos, asistencias, pagos, finanzas, planificación).
// No se usa en el servidor real: solo en la versión de demostración y en las pruebas.
const { all, get, run, tx } = require('./db');
const { hashPassword } = require('./auth');
const { nowAR, addDays, addMeses, dowDe, lunesDe } = require('./util');
const planner = require('./planner');

const CREDENCIALES = [
  { rol: 'Administrador (dueño)', usuario: 'admin', clave: 'omega2026' },
  { rol: 'Profesor', usuario: 'profe', clave: 'profe2026' },
  { rol: 'Alumno', usuario: 'ana.garcia', clave: 'ana2026' },
];

function prng(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const NOMBRES = ['Ana', 'Lucas', 'Sofía', 'Martín', 'Valentina', 'Joaquín', 'Camila', 'Nicolás', 'Julieta', 'Franco', 'Agustina', 'Matías', 'Florencia', 'Tomás', 'Micaela', 'Santiago', 'Rocío', 'Facundo', 'Carolina', 'Gonzalo', 'Paula', 'Federico', 'Lucía', 'Ezequiel', 'Daniela', 'Bruno', 'Natalia', 'Ignacio', 'Belén', 'Maximiliano', 'Romina', 'Leandro', 'Celeste', 'Damián', 'Noelia', 'Sebastián', 'Brenda', 'Ramiro', 'Yamila', 'Pablo'];
const APELLIDOS = ['García', 'Rodríguez', 'Fernández', 'López', 'Martínez', 'González', 'Pérez', 'Sánchez', 'Romero', 'Díaz', 'Álvarez', 'Torres', 'Ruiz', 'Gutiérrez', 'Benítez', 'Acosta', 'Medina', 'Herrera', 'Suárez', 'Aguirre', 'Giménez', 'Molina', 'Castro', 'Ortiz', 'Silva', 'Núñez', 'Rojas', 'Vega', 'Ramos', 'Ibarra'];
const HORAS = [8, 9, 10, 11, 12, 15, 16, 17, 18, 19, 20];
const PESOS_HORA = [9, 8, 4, 2, 2, 3, 4, 7, 10, 11, 8];

function cargarDemo() {
  if (get("SELECT 1 AS x FROM usuarios WHERE rol = 'admin'")) throw Object.assign(new Error('Ya hay un administrador creado'), { status: 409 });
  const rnd = prng(20261025);
  const hoy = nowAR().fecha;
  const ahoraIso = new Date().toISOString();
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const pesoHora = () => { let r = rnd() * PESOS_HORA.reduce((a, b) => a + b, 0); for (let i = 0; i < HORAS.length; i++) { r -= PESOS_HORA[i]; if (r <= 0) return HORAS[i]; } return 18; };

  tx(() => {
    run('INSERT INTO usuarios (username, password_hash, rol, nombre, creado) VALUES (?,?,?,?,?)', 'admin', hashPassword('omega2026'), 'admin', 'Dueño de OMEGA', ahoraIso);
    run('INSERT INTO usuarios (username, password_hash, rol, nombre, creado) VALUES (?,?,?,?,?)', 'profe', hashPassword('profe2026'), 'profesor', 'Martín (profesor)', ahoraIso);
    run('INSERT INTO usuarios (username, password_hash, rol, nombre, creado) VALUES (?,?,?,?,?)', 'lucia', hashPassword('lucia2026'), 'profesor', 'Lucía (profesora)', ahoraIso);
    // Intervalos de ejemplo (el dueño carga los reales desde Planificación > Formatos e intervalos)
    const ej = { Endurance: [40, 20], Flex: [45, 15], Funcional: [40, 20], Hiitcross: [30, 30], QDX: [50, 10], Z7: [45, 15] };
    for (const [n, [t, d]] of Object.entries(ej)) run('UPDATE formatos SET trabajo_seg = ?, descanso_seg = ? WHERE nombre = ?', t, d, n);
  });

  // Planes de precios (efectivo vs Mercado Pago)
  tx(() => {
    run('DELETE FROM planes');
    run("INSERT INTO planes (id, nombre, precio_efectivo, precio_mp) VALUES (1, 'Plan mensual', 46000, 50000)");
    run("INSERT INTO planes (id, nombre, precio_efectivo, precio_mp) VALUES (2, 'Plan libre', 52000, 56000)");
    run("INSERT INTO planes (id, nombre, precio_efectivo, precio_mp) VALUES (3, 'Plan antiguo (2 veces por semana)', 42000, 45000)");
  });

  // Planificación: 3 semanas hacia atrás y 3 hacia adelante
  const lun = lunesDe(hoy);
  planner.generarRango(addDays(lun, -21), 42, false);

  // Alumnos
  const perfiles = [];
  const usados = new Set();
  const nuevoNombre = (i) => { if (i === 0) return 'Ana García'; let n; do { n = pick(NOMBRES) + ' ' + pick(APELLIDOS); } while (usados.has(n)); return n; };
  const planes = [42000, 46000, 46000, 52000];
  for (let i = 0; i < 44; i++) {
    let tipo;
    if (i === 0) tipo = 'regular';
    else if (i < 23) tipo = 'regular';
    else if (i < 28) tipo = 'medio';
    else if (i < 31) tipo = 'amarillo';
    else if (i < 34) tipo = 'naranja';
    else if (i < 36) tipo = 'rojo';
    else if (i < 40) tipo = 'baja_reciente';
    else tipo = 'baja_larga';
    const nombre = nuevoNombre(i); usados.add(nombre);
    perfiles.push({ nombre, tipo, precio: pick(planes), antig: 1 + Math.floor(rnd() * 8) });
  }

  tx(() => {
    perfiles.forEach((p, i) => {
      const activoTipos = ['regular', 'medio', 'amarillo', 'naranja', 'rojo'];
      let baja, alta;
      if (activoTipos.includes(p.tipo)) { baja = addDays(hoy, 3 + Math.floor(rnd() * 27)); alta = addMeses(baja, -p.antig - 1); }
      else if (p.tipo === 'baja_reciente') { baja = addDays(hoy, -(15 + Math.floor(rnd() * 70))); alta = addMeses(baja, -p.antig); }
      else { baja = addDays(hoy, -(110 + Math.floor(rnd() * 90))); alta = addMeses(baja, -p.antig); }
      if (p.tipo === 'rojo' || p.tipo === 'naranja') { /* siguen activos pero dejaron de venir */ }
      const cel = '11' + String(40000000 + Math.floor(rnd() * 59999999));
      const insta = rnd() < 0.55 ? p.nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]+/g, '.') : null;
      const planId = p.precio === 46000 ? 1 : p.precio === 52000 ? 2 : 3;
      const r = run('INSERT INTO clientes (nombre, foto, fecha_alta, precio_plan, fecha_baja, celular, instagram, creado, plan_id) VALUES (?,?,?,?,?,?,?,?,?)', p.nombre, null, alta, p.precio, baja, cel, insta, ahoraIso, planId);
      p.id = Number(r.lastInsertRowid); p.alta = alta; p.baja = baja;
      // pagos mensuales desde el alta hasta cubrir la baja
      let desde = alta, n = 0;
      while (desde < baja && n < 24) {
        const hasta = addMeses(desde, 1);
        const metodo = (i + n) % 3 === 0 ? 'mercadopago' : 'efectivo';
        const pr = run('INSERT INTO pagos (cliente_id, fecha, monto, concepto, cubre_hasta, metodo, plan_id) VALUES (?,?,?,?,?,?,?)', p.id, desde, p.precio, n === 0 ? 'Alta de plan' : 'Renovación de plan (1 mes)', hasta, metodo, planId);
        run('INSERT INTO finanzas (tipo, categoria, concepto, monto, fecha, fijo, pago_id, medio, en_caja) VALUES (?,?,?,?,?,0,?,?,?)', 'ingreso', 'Cuotas', p.nombre + ' · ' + (metodo === 'efectivo' ? 'Efectivo' : 'Mercado Pago'), p.precio, desde, Number(pr.lastInsertRowid), metodo, metodo === 'efectivo' ? 1 : 0);
        desde = hasta; n++;
      }
      // acceso a la app solo para el alumno de ejemplo
      if (i === 0) run('INSERT INTO usuarios (username, password_hash, rol, nombre, cliente_id, creado) VALUES (?,?,?,?,?,?)', 'ana.garcia', hashPassword('ana2026'), 'cliente', p.nombre, p.id, ahoraIso);
    });
  });

  // Asistencias de las últimas 6 semanas
  const sesion = (fecha, hora) => {
    let s = get('SELECT id FROM sesiones WHERE fecha = ? AND hora = ?', fecha, hora);
    if (!s) { run('INSERT OR IGNORE INTO sesiones (fecha, hora, formato_id) VALUES (?,?,NULL)', fecha, hora); s = get('SELECT id FROM sesiones WHERE fecha = ? AND hora = ?', fecha, hora); }
    return s.id;
  };
  const marcar = (cid, fecha, hora, origen) => {
    run('INSERT OR IGNORE INTO asistencias (cliente_id, sesion_id, fecha, hora, registrado, origen, cargado_por) VALUES (?,?,?,?,?,?,NULL)', cid, sesion(fecha, hora), fecha, hora, fecha + 'T' + String(hora).padStart(2, '0') + ':05:00.000Z', origen);
  };
  tx(() => {
    for (const p of perfiles) {
      for (let w = 0; w < 7; w++) {
        const ini = addDays(lun, -7 * w);
        // semanas sin venir según perfil (0 = esta semana)
        if (p.tipo === 'amarillo' && w < 1) continue;
        if (p.tipo === 'naranja' && w < 2) continue;
        if (p.tipo === 'rojo' && w < 4) continue;
        const freq = p.tipo === 'medio' ? (rnd() < 0.5 ? 2 : 1) : (rnd() < 0.8 ? 3 : 2);
        const dias = [1, 2, 3, 4, 5, 6].sort(() => rnd() - 0.5).slice(0, freq);
        const horaHabitual = pesoHora();
        for (const d of dias) {
          const f = addDays(ini, d - 1);
          if (f > hoy || f < p.alta || f > p.baja) continue;
          if (f === hoy) continue;
          marcar(p.id, f, rnd() < 0.7 ? horaHabitual : pesoHora(), rnd() < 0.6 ? 'qr' : 'manual');
        }
      }
    }
    // Una clase muy llena para mostrar la ineficiencia de materiales en el dashboard
    let f = addDays(hoy, -2); while (dowDe(f) === 7) f = addDays(f, -1);
    const activos = perfiles.filter(p => ['regular', 'medio', 'amarillo'].includes(p.tipo));
    const ya = new Set(all('SELECT cliente_id FROM asistencias WHERE fecha = ? AND hora = 19', f).map(r => r.cliente_id));
    for (const p of activos) { if (ya.size >= 24) break; if (!ya.has(p.id) && f >= p.alta) { marcar(p.id, f, 19, 'manual'); ya.add(p.id); } }
  });

  // Egresos de los últimos 4 meses (los gastos fijos se repiten cada mes)
  tx(() => {
    for (let m = 3; m >= 0; m--) {
      const mes = addMeses(hoy.slice(0, 8) + '01', -m);
      const fijos = [['Alquiler', 'Alquiler del local', 450000], ['Salarios', 'Sueldos de 3 profesores', 640000], ['Luz', 'Factura de luz', 72000], ['Monotributo', 'Cuota mensual', 46000], ['Tasas municipales', 'Tasa de comercio', 28000]];
      for (const [c, con, mo] of fijos) run('INSERT INTO finanzas (tipo, categoria, concepto, monto, fecha, fijo) VALUES (?,?,?,?,?,1)', 'egreso', c, con, Math.round(mo * (1 + (3 - m) * 0.03)), mes);
      run('INSERT INTO finanzas (tipo, categoria, concepto, monto, fecha, fijo) VALUES (?,?,?,?,?,0)', 'egreso', 'Mantenimiento', 'Reposición de bandas y mantenimiento', 30000 + Math.floor(rnd() * 25000), addDays(mes, 12));
    }
  });
  // Profesores asignados a cada clase de la semana
  tx(() => {
    const profs = all("SELECT id FROM usuarios WHERE rol = 'profesor' ORDER BY id").map(r => r.id);
    for (const a of all('SELECT dia, hora FROM agenda WHERE formato_id IS NOT NULL')) run('UPDATE agenda SET profesor_id = ? WHERE dia = ? AND hora = ?', profs[(a.dia + (a.hora >= 15 ? 1 : 0)) % profs.length], a.dia, a.hora);
  });
  // Caja de hoy y visitas del mes (CRM)
  tx(() => {
    run('INSERT OR REPLACE INTO caja_dia (fecha, saldo_inicial) VALUES (?,?)', hoy, 85000);
    run("INSERT INTO finanzas (tipo, categoria, concepto, monto, fecha, fijo, medio, en_caja) VALUES ('ingreso','Ingresos en efectivo','Venta de agua y bebidas',9500,?,0,'efectivo',1)", hoy);
    run("INSERT INTO finanzas (tipo, categoria, concepto, monto, fecha, fijo, medio, en_caja) VALUES ('egreso','Limpieza','Artículos de limpieza',12000,?,0,'efectivo',1)", hoy);
    const profs = all("SELECT id FROM usuarios WHERE rol = 'profesor' ORDER BY id").map(r => r.id);
    const mes = hoy.slice(0, 8);
    const visitas = [['Carla Domínguez', 'Bajar de peso', 0], ['Hernán Paz', 'Ganar músculo', 1], ['Mía Quiroga', 'Tonificar', 0], ['Julián Ferrari', 'Salud y bienestar', 1], ['Abril Soto', 'Bajar de peso', 0], ['Gastón Luna', 'Rendimiento deportivo', 1], ['Ornella Bravo', 'Tonificar', 0], ['Iván Cabrera', 'Ganar músculo', 1], ['Agustín Pereyra', 'Mejorar mi condición física', 0], ['Lara Montes', 'Bajar de peso', 1]];
    visitas.forEach(([n, o, k], i) => {
      const dia = Math.min(Number(hoy.slice(8)), 1 + i * 2);
      const cli = i < 4 ? perfiles[5 + i] : null; // los primeros 4 se inscribieron
      run('INSERT INTO leads (nombre, telefono, redes, objetivo, profesor_id, estado, cliente_id, fecha, origen, creado) VALUES (?,?,?,?,?,?,?,?,?,?)', n, '11' + String(50000000 + i * 111111), '@' + n.split(' ')[0].toLowerCase(), o, profs[(i + k) % profs.length], cli ? 'convertido' : 'visita', cli ? cli.id : null, mes + String(dia).padStart(2, '0'), i % 3 === 0 ? 'qr' : 'manual', ahoraIso);
    });
  });

  // ---- Versión 2: campañas, referido, reservas, rutina, equipamiento devengado, ajustes de país
  tx(() => {
    const setC = (k, v) => run('INSERT INTO config (clave, valor) VALUES (?,?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor', k, v);
    setC('whatsapp_gym', '+5491155551234');
    const camp = Object.fromEntries(all('SELECT id, nombre FROM campanas').map(c => [c.nombre, c.id]));
    const nom = ['Instagram', 'Recorrida', 'Recomendado por', 'Instagram', 'Google / Maps', 'Volanteo', 'Recorrida', 'Instagram', 'Recomendado por', 'Otro'];
    const ref = all("SELECT id FROM clientes WHERE nombre LIKE 'Ana%' ORDER BY id LIMIT 2").map(r => r.id);
    all('SELECT id FROM leads ORDER BY id').forEach((l, i) => {
      const n = nom[i % nom.length];
      run('UPDATE leads SET campana_id = ?, referido_id = ? WHERE id = ?', camp[n] || null, n === 'Recomendado por' ? (ref[i % 2] || null) : null, l.id);
    });
    // una venta por recomendación con aviso pendiente de premio
    const lr = get("SELECT l.id, l.cliente_id, l.referido_id, l.nombre FROM leads l WHERE l.referido_id IS NOT NULL AND l.cliente_id IS NOT NULL LIMIT 1");
    if (lr) run("INSERT INTO notificaciones (tipo, titulo, detalle, lead_id, cliente_id, estado, creado) VALUES ('referido', ?, ?, ?, ?, 'pendiente', ?)",
      'Premio para quien recomendó', lr.nombre + ' se inscribió por recomendación. Conviene decidir un premio o descuento para el alumno que lo recomendó.', lr.id, lr.referido_id, new Date().toISOString());
    // un alumno con la baja movida sin pago asociado
    const fp = get("SELECT id FROM clientes WHERE fecha_baja >= ? AND id NOT IN (SELECT cliente_id FROM pagos WHERE fecha >= ?) ORDER BY id DESC LIMIT 1", hoy, addDays(hoy, -400));
    if (fp) run('UPDATE clientes SET falta_pago = 1 WHERE id = ?', fp.id);
    // egreso de equipamiento repartido en 12 meses
    run("INSERT INTO finanzas (tipo, categoria, concepto, monto, fecha, fijo, devengar_meses) VALUES ('egreso','Equipamiento','Compra de 10 barras y discos',960000,?,0,12)", addMeses(hoy.slice(0, 8) + '01', -1));
    run("INSERT INTO finanzas (tipo, categoria, concepto, monto, fecha, fijo, devengar_meses) VALUES ('egreso','Marketing','Anuncios en Instagram',45000,?,0,1)", hoy.slice(0, 8) + '01');
    // reservas de mañana: una clase pasa el límite de materiales
    const alumnos = all("SELECT id FROM clientes WHERE fecha_baja >= ? ORDER BY id", hoy).map(r => r.id);
    for (const dia of [hoy, addDays(hoy, 1)]) {
      const ag = all('SELECT hora FROM agenda WHERE dia = ? AND formato_id IS NOT NULL ORDER BY hora', dowDe(dia));
      ag.forEach((a, k) => {
        const cant = k === ag.length - 3 ? 23 : 3 + (k % 5);
        alumnos.slice(0, cant).forEach(id => run('INSERT OR IGNORE INTO reservas (cliente_id, fecha, hora, creado) VALUES (?,?,?,?)', id, dia, a.hora, new Date().toISOString()));
      });
    }
    // rutina de musculación asignada a hoy (pestaña Rutina) y a mañana
    const ej = (zona, n) => all('SELECT id FROM ejercicios WHERE zona = ? AND activo = 1 ORDER BY id LIMIT ?', zona, n).map(r => r.id);
    const items = [['Piernas', 4, '8-10', '40 kg', 90], ['Glúteos', 4, '10-12', '30 kg', 75], ['Espalda', 3, '10', '25 kg', 75], ['Pecho', 3, '10', '20 kg', 75], ['Core', 3, '12', '', 45]];
    const rid = Number(run('INSERT INTO rutinas (nombre, descripcion, duracion_min, creado) VALUES (?,?,?,?)', 'Fuerza total A', 'Fuerza general, 5 bloques', 0, new Date().toISOString()).lastInsertRowid);
    let tot = 0;
    items.forEach(([z, se, rp, pe, de], i) => { const e = ej(z, 1)[0]; if (!e) return; run('INSERT INTO rutina_items (rutina_id, orden, ejercicio_id, zona, series, repeticiones, peso, descanso_seg, seg_serie) VALUES (?,?,?,?,?,?,?,?,?)', rid, i + 1, e, z, se, rp, pe, de, 40); tot += se * (40 + de); });
    run('UPDATE rutinas SET duracion_min = ? WHERE id = ?', Math.round(tot / 60), rid);
    run('INSERT OR REPLACE INTO rutina_dia (fecha, formato_id, rutina_id) VALUES (?,0,?)', hoy, rid);
    // presupuesto: escenario de ejemplo con aguinaldos
    const mesIni = addMeses(hoy.slice(0, 8) + '01', 1).slice(0, 7);
    const meses = Array.from({ length: 12 }, (_, i) => ({ inflacion: 2.5, en_precios: true, en_costos: true, alumnos: null, salto: i === 3 ? 10 : 0 }));
    setC('forecast', JSON.stringify({ meses, picos: [] }));
  });
  return { clientes: perfiles.length, credenciales: CREDENCIALES };
}

module.exports = { cargarDemo, CREDENCIALES };
