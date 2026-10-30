'use strict';
// Versión 6: la agenda de clases y la configuración de los formatos pasan a ser POR SEMANA (de lunes a domingo).
// Regla de herencia: una semana usa su propia configuración si fue guardada; si no, la de la última semana anterior que se guardó;
// y si nunca se guardó ninguna, la general (tabla agenda / tabla formatos), como en las versiones anteriores.
const { all, get, run, tx, getConfig } = require('./db');
const { addDays, dowDe, lunesDe, nowAR } = require('./util');
const est = require('./estimulos');

const lunesDeFecha = (f) => lunesDe(f);

// ---------------------------------------------------------------- agenda
function origenAgenda(lunes) {
  if (get('SELECT 1 AS x FROM semanas_cfg WHERE semana = ? AND agenda = 1', lunes)) return { tipo: 'propia', semana: lunes };
  const prev = get('SELECT semana FROM semanas_cfg WHERE agenda = 1 AND semana < ? ORDER BY semana DESC LIMIT 1', lunes);
  if (prev) return { tipo: 'heredada', semana: prev.semana };
  return { tipo: 'general', semana: null };
}
function celdasDe(lunes) {
  const o = origenAgenda(lunes);
  const celdas = o.tipo === 'general'
    ? all('SELECT dia, hora, formato_id, profesor_id FROM agenda ORDER BY dia, hora')
    : all('SELECT dia, hora, formato_id, profesor_id FROM agenda_semana WHERE semana = ? ORDER BY dia, hora', o.semana);
  return { origen: o.tipo, desde: o.semana, celdas };
}
function agendaDe(fecha) {
  const dia = dowDe(fecha);
  return celdasDe(lunesDeFecha(fecha)).celdas.filter(c => c.dia === dia && c.formato_id).sort((a, b) => a.hora - b.hora);
}
function celda(fecha, hora) { return agendaDe(fecha).find(c => c.hora === hora) || null; }
function horasDe(fecha) { return agendaDe(fecha).map(c => c.hora); }

function marcar(lunes, campo) {
  run(`INSERT INTO semanas_cfg (semana, ${campo}) VALUES (?, 1) ON CONFLICT(semana) DO UPDATE SET ${campo} = 1`, lunes);
}
// Si la semana todavía usa la agenda heredada, la copia como propia (para poder editarla sin tocar las otras semanas)
function asegurarPropia(lunes) {
  const o = origenAgenda(lunes);
  if (o.tipo === 'propia') return;
  const base = celdasDe(lunes).celdas;
  tx(() => {
    run('DELETE FROM agenda_semana WHERE semana = ?', lunes);
    for (const c of base) run('INSERT INTO agenda_semana (semana, dia, hora, formato_id, profesor_id) VALUES (?,?,?,?,?)', lunes, c.dia, c.hora, c.formato_id, c.profesor_id);
    marcar(lunes, 'agenda');
  });
}
// Reemplaza la agenda de la semana. celdas: [{dia, hora, formato_id}] (solo las que tienen clase). Conserva el profesor de las celdas que siguen.
function guardarAgenda(lunes, celdas) {
  const previas = new Map(celdasDe(lunes).celdas.map(c => [c.dia + ':' + c.hora, c.profesor_id]));
  tx(() => {
    run('DELETE FROM agenda_semana WHERE semana = ?', lunes);
    for (const c of celdas) {
      if (!c.formato_id) continue;
      run('INSERT OR REPLACE INTO agenda_semana (semana, dia, hora, formato_id, profesor_id) VALUES (?,?,?,?,?)', lunes, c.dia, c.hora, c.formato_id, previas.get(c.dia + ':' + c.hora) || null);
    }
    marcar(lunes, 'agenda');
  });
}
// Copia la agenda efectiva de la semana anterior (solo las clases: los profesores se copian aparte desde Agenda Staff)
function copiarAgenda(lunes) {
  const prev = celdasDe(addDays(lunes, -7)).celdas.filter(c => c.formato_id);
  guardarAgenda(lunes, prev.map(c => ({ dia: c.dia, hora: c.hora, formato_id: c.formato_id })));
  return prev.length;
}
function asignarProfesor(lunes, dia, hora, pid) {
  asegurarPropia(lunes);
  run('UPDATE agenda_semana SET profesor_id = ? WHERE semana = ? AND dia = ? AND hora = ?', pid, lunes, dia, hora);
}
// Copia los profesores de la semana anterior a las mismas clases (día y hora) de esta semana
function copiarStaff(lunes) {
  asegurarPropia(lunes);
  const prev = new Map(celdasDe(addDays(lunes, -7)).celdas.filter(c => c.profesor_id).map(c => [c.dia + ':' + c.hora, c.profesor_id]));
  const actuales = all('SELECT dia, hora FROM agenda_semana WHERE semana = ? AND formato_id IS NOT NULL', lunes);
  let n = 0;
  tx(() => {
    for (const c of actuales) {
      const pid = prev.get(c.dia + ':' + c.hora);
      if (!pid) continue;
      run('UPDATE agenda_semana SET profesor_id = ? WHERE semana = ? AND dia = ? AND hora = ?', pid, lunes, c.dia, c.hora);
      n++;
    }
  });
  return n;
}

// ---------------------------------------------------------------- formatos
function origenFormatos(lunes) {
  if (get('SELECT 1 AS x FROM semanas_cfg WHERE semana = ? AND formatos = 1', lunes)) return { tipo: 'propia', semana: lunes };
  const prev = get('SELECT semana FROM semanas_cfg WHERE formatos = 1 AND semana < ? ORDER BY semana DESC LIMIT 1', lunes);
  if (prev) return { tipo: 'heredada', semana: prev.semana };
  return { tipo: 'general', semana: null };
}
const CAMPOS_SEMANA = ['estaciones', 'trabajo_seg', 'descanso_seg', 'sin_trabajo', 'sin_descanso', 'duracion_min', 'rondas', 'cupo_estacion', 'intensidad_min', 'patrones', 'capacidades', 'energias'];
function normalizar(f) {
  const d = est.defaultsFormato(f.nombre);
  const generales = parseInt(getConfig('estaciones', '5'), 10) || 5;
  return {
    ...f,
    estaciones_cfg: f.estaciones ?? null,
    estaciones: f.estaciones > 0 ? f.estaciones : generales,
    patrones: est.lista(f.patrones || d.patrones, est.CLAVES.patrones),
    capacidades: est.lista(f.capacidades || d.capacidades, est.CLAVES.capacidades),
    energias: est.lista(f.energias || d.energias, est.CLAVES.energias),
  };
}
function formatosDeSemana(lunes) {
  const o = origenFormatos(lunes);
  const base = all('SELECT * FROM formatos WHERE activo = 1 ORDER BY orden, id');
  const filas = o.tipo === 'general' ? new Map() : new Map(all('SELECT * FROM formatos_semana WHERE semana = ?', o.semana).map(r => [r.formato_id, r]));
  return { origen: o.tipo, desde: o.semana, formatos: base.map(f => { const r = filas.get(f.id); return normalizar(r ? { ...f, ...Object.fromEntries(CAMPOS_SEMANA.map(k => [k, r[k]])) } : f); }) };
}
function formatoEf(id, fecha) {
  const lunes = lunesDeFecha(fecha);
  const f = get('SELECT * FROM formatos WHERE id = ?', id);
  if (!f) return null;
  const o = origenFormatos(lunes);
  const r = o.tipo === 'general' ? null : get('SELECT * FROM formatos_semana WHERE semana = ? AND formato_id = ?', o.semana, id);
  return normalizar(r ? { ...f, ...Object.fromEntries(CAMPOS_SEMANA.map(k => [k, r[k]])) } : f);
}
function formatosPorId(fecha) {
  const m = new Map();
  for (const f of formatosDeSemana(lunesDeFecha(fecha)).formatos) m.set(f.id, f);
  for (const f of all('SELECT * FROM formatos WHERE activo = 0')) m.set(f.id, normalizar(f));
  return m;
}
// Guarda como propia de la semana la configuración de TODOS los formatos recibidos
function guardarFormatos(lunes, lista) {
  const actual = new Map(formatosDeSemana(lunes).formatos.map(f => [f.id, f]));
  tx(() => {
    for (const x of lista) {
      const ex = actual.get(Number(x.id));
      if (!ex) continue;
      const f = { ...ex, ...x };
      const estac = x.estaciones !== undefined ? (Math.max(1, Math.min(12, parseInt(x.estaciones, 10) || 0)) || null) : ex.estaciones_cfg;
      run(`INSERT OR REPLACE INTO formatos_semana (semana, formato_id, estaciones, trabajo_seg, descanso_seg, sin_trabajo, sin_descanso, duracion_min, rondas, cupo_estacion, intensidad_min, patrones, capacidades, energias)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        lunes, ex.id, estac, f.trabajo_seg ?? null, f.descanso_seg ?? null, f.sin_trabajo ? 1 : 0, f.sin_descanso ? 1 : 0, f.duracion_min ?? null,
        Math.max(1, Math.min(3, parseInt(f.rondas, 10) || 3)), f.cupo_estacion ?? null, f.intensidad_min ?? null,
        est.aTexto(est.lista(f.patrones, est.CLAVES.patrones)), est.aTexto(est.lista(f.capacidades, est.CLAVES.capacidades)), est.aTexto(est.lista(f.energias, est.CLAVES.energias)));
    }
    marcar(lunes, 'formatos');
  });
}
function copiarFormatos(lunes) {
  const prev = formatosDeSemana(addDays(lunes, -7)).formatos;
  guardarFormatos(lunes, prev.map(f => ({ ...f, estaciones: f.estaciones_cfg })));
  return prev.length;
}

// ---------------------------------------------------------------- calendario de semanas
function resumenSemanas(desde, n) {
  const hoyLunes = lunesDeFecha(nowAR().fecha);
  const out = [];
  for (let i = 0; i < n; i++) {
    const s = addDays(desde, i * 7);
    const circ = get('SELECT COUNT(*) AS n FROM circuitos WHERE fecha BETWEEN ? AND ?', s, addDays(s, 6)).n;
    out.push({ semana: s, actual: s === hoyLunes, agenda: origenAgenda(s).tipo, formatos: origenFormatos(s).tipo, circuitos: circ });
  }
  return out;
}

module.exports = { lunesDeFecha, origenAgenda, celdasDe, agendaDe, celda, horasDe, asegurarPropia, guardarAgenda, copiarAgenda, asignarProfesor, copiarStaff,
  origenFormatos, formatosDeSemana, formatoEf, formatosPorId, guardarFormatos, copiarFormatos, resumenSemanas, normalizar };
