'use strict';
const { all, get, run, tx, getConfig } = require('./db');
const { addDays, diffDays, dowDe } = require('./util');

// Cada día de entrenamiento rota entre 3 plantillas de zonas, de modo que entrenando 3 días por semana
// se cubren las 9 zonas: resistencia aeróbica, piernas, glúteos, core, espalda, pecho, hombros, bíceps y tríceps.
const PLANTILLAS = {
  A: ['Piernas', 'Pecho', 'Espalda', 'Core', 'Resistencia aeróbica'],
  B: ['Glúteos', 'Hombros', 'Bíceps', 'Espalda', 'Core'],
  C: ['Resistencia aeróbica', 'Pecho', 'Hombros', 'Tríceps', 'Glúteos'],
};
function plantillaDe(fecha) {
  const d = dowDe(fecha);
  if (d === 1 || d === 4) return 'A';
  if (d === 2 || d === 5) return 'B';
  return 'C';
}

const DIAS_REPETICION_FORMATO = 21; // un ejercicio puede volver al mismo formato recién a las 3 semanas
const DIAS_CAMBIO_SEMANAL = 6; // todos los ejercicios cambian cada semana (en cualquier formato)

function cfg() {
  const capacidad = parseInt(getConfig('capacidad_clase', '20'), 10) || 20;
  const estaciones = parseInt(getConfig('estaciones', '5'), 10) || 5;
  return { capacidad, estaciones, porEstacion: Math.ceil(capacidad / estaciones) };
}
// Personas por estación: si el formato define su propio cupo, manda ese; si no, el general del gimnasio.
function cfgFormato(f) {
  const c = cfg();
  if (f && f.cupo_estacion > 0) return { ...c, porEstacion: f.cupo_estacion, capacidad: f.cupo_estacion * c.estaciones };
  return c;
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

function construirManual(fecha) {
  const zonas = PLANTILLAS[plantillaDe(fecha)];
  return { plantilla: plantillaDe(fecha), slots: zonas.map(z => ({ ejercicio_id: 0, zona: z })), advertencias: ['Armado manual: elegí a mano el ejercicio de cada estación.'] };
}

function construirCircuito(fecha, formatoId) {
  const formato = get('SELECT * FROM formatos WHERE id = ?', formatoId);
  const { porEstacion } = cfgFormato(formato);
  const minInt = formato && formato.intensidad_min ? RANGO_INT[formato.intensidad_min] : 0;
  const stock = stockMap();
  const zonas = PLANTILLAS[plantillaDe(fecha)];
  const todos = all('SELECT id, zona, nombre, prog2, prog3, equipo, unidades, descripcion, video, activo, patron, origen, intensidad, (img1 IS NOT NULL) AS img1, (img2 IS NOT NULL) AS img2, (img3 IS NOT NULL) AS img3 FROM ejercicios WHERE activo = 1');

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
  const advertencias = [];
  for (const zona of zonas) {
    let pool = todos.filter(e => e.zona === zona && !elegidos.some(x => x.id === e.id));
    const dura = (e) => !minInt || (RANGO_INT[e.intensidad] || 1) >= minInt; // clases HIIT: ejercicios que suben las pulsaciones
    const prueba = (e) => factible(demandaDe([...elegidos, e], porEstacion), stock);
    const etapas = [
      { f: e => dura(e) && !usadoFormato.has(e.id) && !usadoSemana.has(e.id) && prueba(e) },
      { f: e => !usadoFormato.has(e.id) && !usadoSemana.has(e.id) && prueba(e), aviso: minInt ? 'hay pocos ejercicios de intensidad ' + formato.intensidad_min + ' o más en ' + zona : null },
      { f: e => !usadoFormato.has(e.id) && prueba(e), aviso: 'repite un ejercicio usado esta semana en otro formato (' + zona + ')' },
      { f: e => prueba(e), aviso: 'no hay suficientes ejercicios nuevos para ' + zona + ': se repite uno antes de las 3 semanas. Cargá más ejercicios a esta zona.' },
      { f: () => true, aviso: 'el equipamiento no alcanza para ' + zona + ' con ' + porEstacion + ' personas por estación' },
    ];
    let elegido = null;
    for (const et of etapas) {
      const cand = pool.filter(et.f);
      if (cand.length) {
        // preferir los que hace más tiempo no se usan
        const ord = cand.map(e => ({ e, d: ultimaVez.has(e.id) ? ultimaVez.get(e.id) : 9999 })).sort((a, b) => b.d - a.d);
        const mejor = ord.filter(x => x.d === ord[0].d).map(x => x.e);
        elegido = elegirAleatorio(mejor);
        if (et.aviso) advertencias.push(et.aviso);
        break;
      }
    }
    if (!elegido) { advertencias.push('no hay ejercicios cargados para ' + zona); continue; }
    elegidos.push(elegido);
  }
  return { plantilla: plantillaDe(fecha), slots: elegidos.map(e => ({ ejercicio_id: e.id, zona: e.zona })), advertencias };
}

function guardarCircuito(fecha, formatoId, c, modo = 'ia') {
  run('DELETE FROM uso_ejercicio WHERE fecha = ? AND formato_id = ?', fecha, formatoId);
  run(`INSERT INTO circuitos (fecha, formato_id, plantilla, slots, advertencias, modo) VALUES (?,?,?,?,?,?)
       ON CONFLICT(fecha, formato_id) DO UPDATE SET plantilla = excluded.plantilla, slots = excluded.slots, advertencias = excluded.advertencias, modo = excluded.modo`,
    fecha, formatoId, c.plantilla, JSON.stringify(c.slots), JSON.stringify(c.advertencias), modo);
  for (const s of c.slots.filter(x => x.ejercicio_id)) run('INSERT OR IGNORE INTO uso_ejercicio (ejercicio_id, formato_id, fecha) VALUES (?,?,?)', s.ejercicio_id, formatoId, fecha);
}

function formatosSinConfigurar() {
  return all('SELECT nombre FROM formatos WHERE activo = 1 AND sin_trabajo = 0 AND (trabajo_seg IS NULL OR (sin_descanso = 0 AND descanso_seg IS NULL))').map(f => f.nombre);
}

// Genera la planificación de un rango de fechas a partir de la agenda semanal.
function modoPlanificacion() { return getConfig('modo_planificacion', 'ia') === 'manual' ? 'manual' : 'ia'; }
function generarRango(desde, dias, rehacer = false, modo = null) {
  modo = modo || modoPlanificacion();
  const pendientes = formatosSinConfigurar();
  if (pendientes.length) {
    const e = new Error('Primero configurá los intervalos de trabajo y descanso de: ' + pendientes.join(', '));
    e.status = 409; throw e;
  }
  const resumen = { creados: 0, mantenidos: 0, sesiones: 0 };
  tx(() => {
    for (let i = 0; i < dias; i++) {
      const fecha = addDays(desde, i);
      const dia = dowDe(fecha);
      const agenda = all('SELECT hora, formato_id FROM agenda WHERE dia = ? AND formato_id IS NOT NULL ORDER BY hora', dia);
      const formatos = [...new Set(agenda.map(a => a.formato_id))];
      for (const f of formatos) {
        const existe = get('SELECT id FROM circuitos WHERE fecha = ? AND formato_id = ?', fecha, f);
        if (existe && !rehacer) { resumen.mantenidos++; continue; }
        guardarCircuito(fecha, f, modo === 'manual' ? construirManual(fecha) : construirCircuito(fecha, f), modo);
        resumen.creados++;
      }
      // sesiones del día (conservan su id si ya existían, para no perder asistencias)
      for (const a of agenda) {
        run('INSERT INTO sesiones (fecha, hora, formato_id) VALUES (?,?,?) ON CONFLICT(fecha, hora) DO UPDATE SET formato_id = excluded.formato_id', fecha, a.hora, a.formato_id);
        resumen.sesiones++;
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
  const { porEstacion, estaciones } = cfgFormato(formato);
  const slots = JSON.parse(circ.slots);
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
      if (!s.ejercicio_id) return { slot: i, ejercicio_id: 0, zona: s.zona, nombre: '(elegir ejercicio)', vacio: true };
      if (!e) return { slot: i, ejercicio_id: s.ejercicio_id, zona: s.zona, nombre: '(ejercicio eliminado)' };
      return {
        slot: i, ejercicio_id: e.id, zona: e.zona, equipo: e.equipo, unidades: e.unidades,
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
  for (const e of all('SELECT id, zona, nombre, prog2, prog3, equipo, unidades, descripcion, video, activo, patron, origen, intensidad, (img1 IS NOT NULL) AS img1, (img2 IS NOT NULL) AS img2, (img3 IS NOT NULL) AS img3 FROM ejercicios')) m.set(e.id, e);
  return m;
}

function claseDelDia(fecha) {
  const ejMap = ejercicioMap();
  const formatos = new Map(all('SELECT * FROM formatos').map(f => [f.id, f]));
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
  const f = get('SELECT * FROM formatos WHERE id = ?', circ.formato_id);
  return expandirCircuito(circ, f, ejercicioMap());
}

// Alternativas para reemplazar un ejercicio del circuito (misma zona o la que se elija)
function sugerencias(circuitoId, slot, zona) {
  const circ = get('SELECT * FROM circuitos WHERE id = ?', circuitoId);
  if (!circ) return null;
  const { porEstacion } = cfgFormato(get('SELECT * FROM formatos WHERE id = ?', circ.formato_id));
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
  const { porEstacion } = cfgFormato(get('SELECT * FROM formatos WHERE id = ?', circ.formato_id));
  const advertencias = JSON.parse(circ.advertencias || '[]').filter(a => !/^Armado manual/.test(a) || slots.some((x, i) => i !== slot && !x.ejercicio_id));
  if (!factible(demandaDe([...otros, nuevo], porEstacion), stockMap())) {
    advertencias.push('El reemplazo "' + nuevo.nombre + '" supera el equipamiento disponible con ' + porEstacion + ' personas por estación.');
  }
  const viejo = slots[slot].ejercicio_id;
  slots[slot] = { ejercicio_id: nuevo.id, zona: nuevo.zona };
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
  const { estaciones } = cfg();
  const stock = stockMap();
  const porEst = Math.ceil(asistentes / estaciones);
  const ejMap = ejercicioMap();
  const slots = circuito.slots ? JSON.parse(circuito.slots) : [];
  const dem = demandaDe(slots.map(s => ejMap.get(s.ejercicio_id)), porEst);
  const out = [];
  for (const [k, v] of Object.entries(dem)) {
    const st = stock[k];
    if (st && v > st.cantidad) out.push({ clave: k, nombre: st.nombre, demanda: v, stock: st.cantidad, faltan: v - st.cantidad });
  }
  return out;
}

module.exports = { cfgFormato, modoPlanificacion, PLANTILLAS, plantillaDe, generarRango, claseDelDia, circuitoPorId, sugerencias, reemplazarSlot, faltantesEquipo, formatosSinConfigurar, cfg };
