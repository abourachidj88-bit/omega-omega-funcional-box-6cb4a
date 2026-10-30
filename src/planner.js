'use strict';
const { all, get, run, tx, getConfig } = require('./db');
const { addDays, diffDays, dowDe } = require('./util');

const semana = require('./semana');
const est = require('./estimulos');

// Versión 6: cada día rota entre 3 "días tipo" (A, B, C) de patrones de movimiento. Cada patrón cae en 2 de los 3 días tipo, de modo que quien entrena
// 3 veces por semana recibe cada patrón con frecuencia 2 (y con 5 estaciones entran los 7 patrones dos veces: 14 de 15 lugares).
function plantillaDe(fecha) {
  const d = dowDe(fecha);
  if (d === 1 || d === 4) return 'A';
  if (d === 2 || d === 5) return 'B';
  return 'C';
}
const IDX_PLANTILLA = { A: 0, B: 1, C: 2 };
const PLANTILLAS = { A: [], B: [], C: [] };   // (compatibilidad: ya no son fijas; dependen de los patrones y las estaciones de cada formato)
// Patrones (claves) de las estaciones de un formato para una fecha
function patronesDelDia(fecha, f, avisos) {
  const N = Math.max(1, f.estaciones || 5);
  let permitidos = f.patrones && f.patrones.length ? [...f.patrones] : [...est.CLAVES.patrones];
  const k = permitidos.length;
  if (2 * k > 3 * N) {
    const w = Math.floor(Date.parse(semana.lunesDeFecha(fecha)) / (7 * 86400000)) % k;   // si no entran, la semana rota cuáles quedan afuera
    permitidos = permitidos.slice(w).concat(permitidos.slice(0, w));
    if (avisos) avisos.push('con ' + N + ' estaciones no entran todos los patrones elegidos dos veces por semana: esta semana quedan algunos con una sola vez. Subí las estaciones o sacá patrones del formato.');
  }
  const dias = [[], [], []];
  permitidos.forEach((p, j) => { for (const d of [j % 3, (j + 1) % 3]) dias[d].push(p); });
  dias.forEach((lista, d) => {
    while (lista.length > N) lista.pop();
    let n = 0;
    while (lista.length < N && n < 100) { const c = permitidos[(d + n) % k]; n++; if (!lista.includes(c) || n > k) lista.push(c); }
  });
  return dias[IDX_PLANTILLA[plantillaDe(fecha)]];
}

const DIAS_REPETICION_FORMATO = 21; // un ejercicio puede volver al mismo formato recién a las 3 semanas
const DIAS_CAMBIO_SEMANAL = 6; // todos los ejercicios cambian cada semana (en cualquier formato)

function cfg() {
  const capacidad = parseInt(getConfig('capacidad_clase', '20'), 10) || 20;
  const estaciones = parseInt(getConfig('estaciones', '5'), 10) || 5;
  return { capacidad, estaciones, porEstacion: Math.ceil(capacidad / estaciones) };
}
// Estaciones y personas por estación de un formato (ya con sus valores de la semana). Si define cupo por estación manda ese.
function cfgFormato(f) {
  const c = cfg();
  const estaciones = f && f.estaciones > 0 ? f.estaciones : c.estaciones;
  if (f && f.cupo_estacion > 0) return { ...c, estaciones, porEstacion: f.cupo_estacion, capacidad: f.cupo_estacion * estaciones };
  return { ...c, estaciones, porEstacion: Math.ceil(c.capacidad / estaciones) };
}
const RANGO_INT = { baja: 1, moderada: 2, alta: 3 };
function stockMap() {
  const m = {};
  for (const e of all('SELECT clave, nombre, cantidad FROM equipamiento')) m[e.clave] = e;
  return m;
}

function demandaDe(ejercicios, personasPorEstacion) {
  const d = {};
  for (const e of ejercicios) {
    if (!e || e.equipo === 'ninguno') continue;
    d[e.equipo] = (d[e.equipo] || 0) + (e.unidades || 1) * personasPorEstacion;
  }
  return d;
}
function factible(demanda, stock) {
  for (const k of Object.keys(demanda)) {
    if (stock[k] && demanda[k] > stock[k].cantidad) return false;
  }
  return true;
}

function elegirAleatorio(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function construirManual(fecha, formato) {
  const claves = patronesDelDia(fecha, formato, null);
  return { plantilla: plantillaDe(fecha), slots: claves.map(c => ({ ejercicio_id: 0, zona: est.zonaDeClave(c), patron: c })), advertencias: ['Armado manual: elegí a mano el ejercicio de cada estación.'] };
}

const COLS_PLAN = 'id, zona, nombre, prog2, prog3, equipo, unidades, descripcion, video, activo, patron, origen, intensidad, capacidad, energia, (img1 IS NOT NULL) AS img1, (img2 IS NOT NULL) AS img2, (img3 IS NOT NULL) AS img3';
const capsDe = (e) => est.lista(e.capacidad || 'fuerza', est.CLAVES.capacidades);
const ensDe = (e) => est.lista(e.energia || 'aerobico', est.CLAVES.energias);

function construirCircuito(fecha, formatoId) {
  const formato = semana.formatoEf(formatoId, fecha);
  const { porEstacion } = cfgFormato(formato);
  const minInt = formato && formato.intensidad_min ? RANGO_INT[formato.intensidad_min] : 0;
  const stock = stockMap();
  const advertencias = [];
  const claves = patronesDelDia(fecha, formato, advertencias);
  const capSel = formato.capacidades.length ? formato.capacidades : est.CLAVES.capacidades;
  const enSel = formato.energias.length ? formato.energias : est.CLAVES.energias;
  const t = IDX_PLANTILLA[plantillaDe(fecha)];
  const todos = all('SELECT ' + COLS_PLAN + ' FROM ejercicios WHERE activo = 1');

  // usos cercanos (en ambos sentidos, por si ya hay semanas posteriores planificadas)
  const ini = addDays(fecha, -DIAS_REPETICION_FORMATO + 1);
  const fin = addDays(fecha, DIAS_REPETICION_FORMATO - 1);
  const usos = all('SELECT ejercicio_id, formato_id, fecha FROM uso_ejercicio WHERE fecha BETWEEN ? AND ? AND NOT (formato_id = ? AND fecha = ?)', ini, fin, formatoId, fecha);
  const usadoFormato = new Map(); // ejercicio -> dias de distancia mínima
  const usadoSemana = new Set();
  const ultimaVez = new Map();
  for (const u of usos) {
    const dist = Math.abs(diffDays(u.fecha, fecha));
    if (u.formato_id === formatoId) {
      const prev = usadoFormato.get(u.ejercicio_id);
      if (prev === undefined || dist < prev) usadoFormato.set(u.ejercicio_id, dist);
    }
    if (dist <= DIAS_CAMBIO_SEMANAL) usadoSemana.add(u.ejercicio_id);
    const l = ultimaVez.get(u.ejercicio_id);
    if (l === undefined || dist < l) ultimaVez.set(u.ejercicio_id, dist);
  }

  const elegidos = [];
  const slots = [];
  claves.forEach((clave, i) => {
    const zona = est.zonaDeClave(clave);
    const objCap = capSel[(i + t) % capSel.length], objEn = enSel[(i + t + 1) % enSel.length];
    const pool = todos.filter(e => e.zona === zona && !elegidos.some(x => x.id === e.id));
    const dura = (e) => !minInt || (RANGO_INT[e.intensidad] || 1) >= minInt;       // clases HIIT: ejercicios que suben las pulsaciones
    const encaja = (e) => capsDe(e).some(c => capSel.includes(c)) && ensDe(e).some(c => enSel.includes(c));
    const prueba = (e) => factible(demandaDe([...elegidos, e], porEstacion), stock);
    const libre = (e) => !usadoFormato.has(e.id) && !usadoSemana.has(e.id);
    const etapas = [
      { f: e => encaja(e) && dura(e) && libre(e) && prueba(e) },
      { f: e => encaja(e) && libre(e) && prueba(e), aviso: minInt ? 'hay pocos ejercicios de intensidad ' + formato.intensidad_min + ' o más en ' + zona : null },
      { f: e => libre(e) && prueba(e), aviso: 'no hay ejercicios nuevos de ' + zona + ' con las capacidades y el sistema energético elegidos para el formato: se usa otro' },
      { f: e => !usadoFormato.has(e.id) && prueba(e), aviso: 'repite un ejercicio usado esta semana en otro formato (' + zona + ')' },
      { f: e => prueba(e), aviso: 'no hay suficientes ejercicios nuevos para ' + zona + ': se repite uno antes de las 3 semanas. Cargá más ejercicios a este patrón.' },
      { f: () => true, aviso: 'el equipamiento no alcanza para ' + zona + ' con ' + porEstacion + ' personas por estación' },
    ];
    let elegido = null;
    for (const et of etapas) {
      const cand = pool.filter(et.f);
      if (cand.length) {
        // preferir los que cumplen el objetivo de capacidad y energía de esta estación, y los que hace más tiempo no se usan
        const punt = (e) => (capsDe(e).includes(objCap) ? 2 : 0) + (ensDe(e).includes(objEn) ? 1 : 0);
        const ord = cand.map(e => ({ e, p: punt(e), d: ultimaVez.has(e.id) ? ultimaVez.get(e.id) : 9999 })).sort((a, b) => (b.p - a.p) || (b.d - a.d));
        const mejor = ord.filter(x => x.p === ord[0].p && x.d === ord[0].d).map(x => x.e);
        elegido = elegirAleatorio(mejor);
        if (et.aviso && !advertencias.includes(et.aviso)) advertencias.push(et.aviso);
        break;
      }
    }
    if (!elegido) { advertencias.push('no hay ejercicios cargados para ' + zona); slots.push({ ejercicio_id: 0, zona, patron: clave }); return; }
    elegidos.push(elegido);
    slots.push({ ejercicio_id: elegido.id, zona, patron: clave });
  });
  return { plantilla: plantillaDe(fecha), slots, advertencias };
}

function guardarCircuito(fecha, formatoId, c, modo = 'ia') {
  run('DELETE FROM uso_ejercicio WHERE fecha = ? AND formato_id = ?', fecha, formatoId);
  run(`INSERT INTO circuitos (fecha, formato_id, plantilla, slots, advertencias, modo) VALUES (?,?,?,?,?,?)
       ON CONFLICT(fecha, formato_id) DO UPDATE SET plantilla = excluded.plantilla, slots = excluded.slots, advertencias = excluded.advertencias, modo = excluded.modo`,
    fecha, formatoId, c.plantilla, JSON.stringify(c.slots), JSON.stringify(c.advertencias), modo);
  for (const s of c.slots.filter(x => x.ejercicio_id)) run('INSERT OR IGNORE INTO uso_ejercicio (ejercicio_id, formato_id, fecha) VALUES (?,?,?)', s.ejercicio_id, formatoId, fecha);
}

// Formatos que se usan en la agenda de la semana y todavía no tienen sus intervalos
function formatosSinConfigurar(lunes) {
  const l = lunes || semana.lunesDeFecha(require('./util').nowAR().fecha);
  const usados = new Set(semana.celdasDe(l).celdas.filter(c => c.formato_id).map(c => c.formato_id));
  return semana.formatosDeSemana(l).formatos
    .filter(f => (!lunes || usados.has(f.id)) && !f.sin_trabajo && (f.trabajo_seg == null || (!f.sin_descanso && f.descanso_seg == null))).map(f => f.nombre);
}

// Sesiones del día = clases de la agenda de esa semana (conservan su id si ya existían, para no perder asistencias ni reservas)
function sincronizarSesiones(fecha) {
  const agenda = semana.agendaDe(fecha);
  for (const a of agenda) {
    run('INSERT INTO sesiones (fecha, hora, formato_id, profesor_id) VALUES (?,?,?,?) ON CONFLICT(fecha, hora) DO UPDATE SET formato_id = excluded.formato_id, profesor_id = COALESCE(excluded.profesor_id, sesiones.profesor_id)', fecha, a.hora, a.formato_id, a.profesor_id || null);
  }
  const horas = agenda.map(a => a.hora);
  for (const s of all('SELECT id, hora FROM sesiones WHERE fecha = ?', fecha)) {
    if (horas.includes(s.hora)) continue;
    if (get('SELECT 1 AS x FROM asistencias WHERE sesion_id = ?', s.id)) continue;      // las clases con asistencias registradas no se borran
    run('DELETE FROM sesiones WHERE id = ?', s.id);
  }
  return agenda;
}
// Aplica la agenda / formatos de una semana a las clases de hoy en adelante (lo que ve el alumno en su app). Con rehacer=true también rehace los ejercicios.
function aplicarSemana(lunes, rehacer = false) {
  const hoy = require('./util').nowAR().fecha;
  const desde = lunes > hoy ? lunes : hoy, fin = addDays(lunes, 6);
  if (fin < hoy) return { sesiones: 0, circuitos: 0 };
  tx(() => { for (let f = desde; f <= fin; f = addDays(f, 1)) sincronizarSesiones(f); });
  try {
    const r = generarRango(desde, diffDays(fin, desde) + 1, rehacer);
    return { sesiones: r.sesiones, circuitos: r.creados };
  } catch (e) { if (e.status === 409) return { sesiones: 0, circuitos: 0, pendiente: e.message }; throw e; }
}

// Genera la planificación de un rango de fechas a partir de la agenda semanal.
function modoPlanificacion() { return getConfig('modo_planificacion', 'ia') === 'manual' ? 'manual' : 'ia'; }
function generarRango(desde, dias, rehacer = false, modo = null) {
  modo = modo || modoPlanificacion();
  const lunes = new Set(); for (let i = 0; i < dias; i++) lunes.add(semana.lunesDeFecha(addDays(desde, i)));
  const pendientes = [...new Set([...lunes].flatMap(l => formatosSinConfigurar(l)))];
  if (pendientes.length) {
    const e = new Error('Primero configurá los intervalos de trabajo y descanso de: ' + pendientes.join(', '));
    e.status = 409; throw e;
  }
  const resumen = { creados: 0, mantenidos: 0, sesiones: 0 };
  tx(() => {
    for (let i = 0; i < dias; i++) {
      const fecha = addDays(desde, i);
      const agenda = sincronizarSesiones(fecha);
      resumen.sesiones += agenda.length;
      const formatos = [...new Set(agenda.map(a => a.formato_id))];
      for (const f of formatos) {
        const existe = get('SELECT id, slots FROM circuitos WHERE fecha = ? AND formato_id = ?', fecha, f);
        if (existe && !rehacer) {
          // si cambiaron las estaciones del formato, el circuito existente ya no sirve: se arma de nuevo
          const ef = semana.formatoEf(f, fecha);
          let n = 0; try { n = JSON.parse(existe.slots).length; } catch (_) {}
          if (n === ef.estaciones) { resumen.mantenidos++; continue; }
        }
        const fe = semana.formatoEf(f, fecha);
        guardarCircuito(fecha, f, modo === 'manual' ? construirManual(fecha, fe) : construirCircuito(fecha, f), modo);
        resumen.creados++;
      }
      // circuitos de formatos que ya no están en la agenda de ese día
      const ids = formatos.length ? formatos.join(',') : '0';
      run(`DELETE FROM circuitos WHERE fecha = ? AND formato_id NOT IN (${ids})`, fecha);
      run(`DELETE FROM uso_ejercicio WHERE fecha = ? AND formato_id NOT IN (${ids})`, fecha);
    }
  });
  return resumen;
}

function expandirCircuito(circ, formato, ejMap) {
  const cf = cfgFormato(formato);
  const slots = JSON.parse(circ.slots);
  const porEstacion = cf.porEstacion, estaciones = slots.length || cf.estaciones;
  // Cada ejercicio tiene 3 niveles (base, progresión 1, progresión 2). Con 3 rounds se hacen los tres; con 2 rounds, las 2 más exigentes
  // (progresión 1 y 2); con 1 round, la más exigente.
  const nRondas = Math.max(1, Math.min(3, parseInt(formato.rondas, 10) || 3));
  const niveles = [1, 2, 3].slice(3 - nRondas);
  const NOMBRE_NIVEL = { 1: 'Base', 2: 'Progresión 1', 3: 'Progresión 2' };
  const rondas = niveles.map((n, k) => ({
    ronda: k + 1,
    nivel_n: n,
    ejercicios: slots.map((s, i) => {
      const e = ejMap.get(s.ejercicio_id);
      if (!s.ejercicio_id) return { slot: i, ejercicio_id: 0, zona: s.zona, patron_mov: s.patron || est.claveDeZona(s.zona), nombre: '(elegir ejercicio)', vacio: true };
      if (!e) return { slot: i, ejercicio_id: s.ejercicio_id, zona: s.zona, nombre: '(ejercicio eliminado)' };
      return {
        slot: i, ejercicio_id: e.id, zona: e.zona, capacidad: e.capacidad || null, energia: e.energia || null, equipo: e.equipo, unidades: e.unidades,
        nombre: n === 1 ? e.nombre : n === 2 ? e.prog2 : e.prog3,
        nivel: NOMBRE_NIVEL[n], nivel_n: n, variantes: [e.nombre, e.prog2, e.prog3],
        video: e.video || null, patron: e.patron || null, intensidad: e.intensidad || null, fotos: [e.img1, e.img2, e.img3].some(Boolean),
      };
    }),
  }));
  const sinTrabajo = !!formato.sin_trabajo, sinDescanso = sinTrabajo || !!formato.sin_descanso;
  const trabajo = sinTrabajo ? null : formato.trabajo_seg, descanso = sinDescanso ? 0 : formato.descanso_seg;
  const claseMin = formato.duracion_min || 60;
  const turno = sinTrabajo ? 0 : (trabajo || 0) + (descanso || 0);
  const rotacion = [];
  for (let t = 0; t < estaciones; t++) rotacion.push(Array.from({ length: estaciones }, (_, g) => (g + t) % estaciones));
  return {
    id: circ.id, fecha: circ.fecha, modo: circ.modo || 'ia', formato_id: formato.id, formato: formato.nombre, color: formato.color,
    trabajo_seg: trabajo, descanso_seg: descanso, sin_trabajo: sinTrabajo, sin_descanso: sinDescanso, plantilla: circ.plantilla,
    advertencias: circ.advertencias ? JSON.parse(circ.advertencias) : [],
    personas_por_estacion: porEstacion, estaciones,
    duracion_min: sinTrabajo ? claseMin : (turno ? Math.round((nRondas * estaciones * turno) / 60 * 10) / 10 : null),
    rondas_n: nRondas, rondas, rotacion,
    equipos: Object.entries(demandaDe(slots.map(s => ejMap.get(s.ejercicio_id)), porEstacion)).map(([k, v]) => ({ clave: k, necesita: v })),
  };
}

function ejercicioMap() {
  const m = new Map();
  for (const e of all('SELECT capacidad, energia, id, zona, nombre, prog2, prog3, equipo, unidades, descripcion, video, activo, patron, origen, intensidad, (img1 IS NOT NULL) AS img1, (img2 IS NOT NULL) AS img2, (img3 IS NOT NULL) AS img3 FROM ejercicios')) m.set(e.id, e);
  return m;
}

function claseDelDia(fecha) {
  const ejMap = ejercicioMap();
  const formatos = semana.formatosPorId(fecha);
  const ses = all('SELECT * FROM sesiones WHERE fecha = ? ORDER BY hora', fecha);
  return ses.map(s => {
    const f = formatos.get(s.formato_id);
    const circ = f ? get('SELECT * FROM circuitos WHERE fecha = ? AND formato_id = ?', fecha, f.id) : null;
    return { sesion_id: s.id, fecha, hora: s.hora, formato: f ? { id: f.id, nombre: f.nombre, color: f.color } : null, circuito: circ && f ? expandirCircuito(circ, f, ejMap) : null };
  });
}

function circuitoPorId(id) {
  const circ = get('SELECT * FROM circuitos WHERE id = ?', id);
  if (!circ) return null;
  const f = semana.formatoEf(circ.formato_id, circ.fecha);
  return expandirCircuito(circ, f, ejercicioMap());
}

// Alternativas para reemplazar un ejercicio del circuito (misma zona o la que se elija)
function sugerencias(circuitoId, slot, zona) {
  const circ = get('SELECT * FROM circuitos WHERE id = ?', circuitoId);
  if (!circ) return null;
  const { porEstacion } = cfgFormato(semana.formatoEf(circ.formato_id, circ.fecha));
  const stock = stockMap();
  const slots = JSON.parse(circ.slots);
  const ejMap = ejercicioMap();
  const porSlot = slots.map(s => ejMap.get(s.ejercicio_id));
  const actuales = porSlot.filter(Boolean);
  const otros = porSlot.filter((e, i) => i !== slot && e);
  const zonaBuscada = zona || (slots[slot] && slots[slot].zona);
  const ini = addDays(circ.fecha, -DIAS_REPETICION_FORMATO + 1);
  const fin = addDays(circ.fecha, DIAS_REPETICION_FORMATO - 1);
  const usos = all('SELECT ejercicio_id, formato_id, fecha FROM uso_ejercicio WHERE fecha BETWEEN ? AND ? AND NOT (formato_id = ? AND fecha = ?)', ini, fin, circ.formato_id, circ.fecha);
  const dist = new Map();
  for (const u of usos) {
    const d = Math.abs(diffDays(u.fecha, circ.fecha));
    const p = dist.get(u.ejercicio_id);
    if (p === undefined || d < p) dist.set(u.ejercicio_id, d);
  }
  return all('SELECT id, zona, nombre, prog2, prog3, equipo, unidades, descripcion, video, activo, patron, origen, intensidad, (img1 IS NOT NULL) AS img1, (img2 IS NOT NULL) AS img2, (img3 IS NOT NULL) AS img3 FROM ejercicios WHERE activo = 1 AND zona = ?', zonaBuscada)
    .filter(e => !actuales.some(a => a.id === e.id))
    .map(e => ({
      id: e.id, nombre: e.nombre, prog2: e.prog2, prog3: e.prog3, equipo: e.equipo, zona: e.zona, intensidad: e.intensidad || null, tiene_video: !!e.video,
      alcanza_equipo: factible(demandaDe([...otros, e], porEstacion), stock),
      dias_desde_uso: dist.has(e.id) ? dist.get(e.id) : null,
    }))
    .sort((a, b) => (b.alcanza_equipo - a.alcanza_equipo) || ((b.dias_desde_uso ?? 9999) - (a.dias_desde_uso ?? 9999)));
}

function reemplazarSlot(circuitoId, slot, ejercicioId) {
  const circ = get('SELECT * FROM circuitos WHERE id = ?', circuitoId);
  if (!circ) { const e = new Error('Circuito no encontrado'); e.status = 404; throw e; }
  const slots = JSON.parse(circ.slots);
  if (slot < 0 || slot >= slots.length) { const e = new Error('Posición inválida'); e.status = 400; throw e; }
  const nuevo = get('SELECT id, zona, nombre, prog2, prog3, equipo, unidades, descripcion, video, activo, patron, origen, intensidad, (img1 IS NOT NULL) AS img1, (img2 IS NOT NULL) AS img2, (img3 IS NOT NULL) AS img3 FROM ejercicios WHERE id = ? AND activo = 1', ejercicioId);
  if (!nuevo) { const e = new Error('Ejercicio no encontrado'); e.status = 404; throw e; }
  const ejMap = ejercicioMap();
  const otros = slots.filter((_, i) => i !== slot).map(s => ejMap.get(s.ejercicio_id));
  const { porEstacion } = cfgFormato(semana.formatoEf(circ.formato_id, circ.fecha));
  const advertencias = JSON.parse(circ.advertencias || '[]').filter(a => !/^Armado manual/.test(a) || slots.some((x, i) => i !== slot && !x.ejercicio_id));
  if (!factible(demandaDe([...otros, nuevo], porEstacion), stockMap())) {
    advertencias.push('El reemplazo "' + nuevo.nombre + '" supera el equipamiento disponible con ' + porEstacion + ' personas por estación.');
  }
  const viejo = slots[slot].ejercicio_id;
  slots[slot] = { ejercicio_id: nuevo.id, zona: nuevo.zona, patron: est.claveDeZona(nuevo.zona) };
  tx(() => {
    run('UPDATE circuitos SET slots = ?, advertencias = ? WHERE id = ?', JSON.stringify(slots), JSON.stringify(advertencias), circuitoId);
    if (!slots.some(s => s.ejercicio_id === viejo)) run('DELETE FROM uso_ejercicio WHERE ejercicio_id = ? AND formato_id = ? AND fecha = ?', viejo, circ.formato_id, circ.fecha);
    run('INSERT OR IGNORE INTO uso_ejercicio (ejercicio_id, formato_id, fecha) VALUES (?,?,?)', nuevo.id, circ.formato_id, circ.fecha);
  });
  return circuitoPorId(circuitoId);
}

// Faltante de equipamiento para una clase con N asistentes
function faltantesEquipo(circuito, asistentes) {
  if (!circuito) return [];
  const slots = circuito.slots ? JSON.parse(circuito.slots) : [];
  const estaciones = slots.length || cfg().estaciones;
  const stock = stockMap();
  const porEst = Math.ceil(asistentes / estaciones);
  const ejMap = ejercicioMap();
  const dem = demandaDe(slots.map(s => ejMap.get(s.ejercicio_id)), porEst);
  const out = [];
  for (const [k, v] of Object.entries(dem)) {
    const st = stock[k];
    if (st && v > st.cantidad) out.push({ clave: k, nombre: st.nombre, demanda: v, stock: st.cantidad, faltan: v - st.cantidad });
  }
  return out;
}

module.exports = { sincronizarSesiones, aplicarSemana, patronesDelDia, cfgFormato, modoPlanificacion, PLANTILLAS, plantillaDe, generarRango, claseDelDia, circuitoPorId, sugerencias, reemplazarSlot, faltantesEquipo, formatosSinConfigurar, cfg };
