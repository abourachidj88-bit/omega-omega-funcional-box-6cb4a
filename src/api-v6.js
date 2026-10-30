'use strict';
// Versión 6: agenda semanal, formatos por semana, copiar la semana anterior y catálogo de estímulos.
function registrar(ctx) {
  const { route, ADM, STAFF, TODOS, bad, readBody } = ctx;
  const semana = require('./semana');
  const planner = require('./planner');
  const est = require('./estimulos');
  const { nowAR, lunesDe, esFecha } = require('./util');
  const { all, get } = require('./db');

  const lunesDeBody = (v) => lunesDe(v && esFecha(String(v)) ? String(v) : nowAR().fecha);
  const aplicar = (lunes, rehacer) => { try { return planner.aplicarSemana(lunes, rehacer); } catch (e) { return { error: e.message }; } };

  route('GET', '/api/estimulos', TODOS, () => ({ patrones: est.PATRONES, capacidades: est.CAPACIDADES, energias: est.ENERGIAS }));

  route('GET', '/api/semanas', STAFF, ({ query }) => {
    const desde = lunesDeBody(query.desde), n = Math.max(1, Math.min(26, parseInt(query.n || '10', 10) || 10));
    return semana.resumenSemanas(desde, n);
  });

  // ---- agenda de clases de la semana
  route('GET', '/api/agenda-semanal', STAFF, ({ query }) => {
    const lunes = lunesDeBody(query.semana);
    const a = semana.celdasDe(lunes);
    return { semana: lunes, origen: a.origen, desde: a.desde, celdas: a.celdas.filter(c => c.formato_id) };
  });
  route('PUT', '/api/agenda-semanal', ADM, async ({ req }) => {
    const b = await readBody(req);
    if (!Array.isArray(b.celdas)) throw bad('Formato inválido');
    const lunes = lunesDeBody(b.semana);
    const celdas = [];
    for (const c of b.celdas) {
      const dia = parseInt(c.dia, 10), hora = parseInt(c.hora, 10), fid = c.formato_id ? Number(c.formato_id) : null;
      if (!(dia >= 1 && dia <= 7) || !(hora >= 0 && hora <= 23)) throw bad('Día u hora inválidos');
      if (fid && !get('SELECT 1 AS x FROM formatos WHERE id = ? AND activo = 1', fid)) throw bad('Formato inválido');
      celdas.push({ dia, hora, formato_id: fid });
    }
    semana.guardarAgenda(lunes, celdas);
    return { ok: true, semana: lunes, aplicado: aplicar(lunes, false) };
  });
  route('POST', '/api/agenda-semanal/copiar', ADM, async ({ req }) => {
    const b = await readBody(req);
    const lunes = lunesDeBody(b.semana);
    const n = semana.copiarAgenda(lunes);
    return { ok: true, semana: lunes, clases: n, aplicado: aplicar(lunes, false) };
  });

  // ---- formatos e intervalos de la semana
  route('GET', '/api/formatos-semana', TODOS, ({ query }) => {
    const lunes = lunesDeBody(query.semana);
    const f = semana.formatosDeSemana(lunes);
    return { semana: lunes, origen: f.origen, desde: f.desde, formatos: f.formatos, sin_configurar: planner.formatosSinConfigurar(lunes) };
  });
  route('PUT', '/api/formatos-semana', ADM, async ({ req }) => {
    const b = await readBody(req);
    if (!Array.isArray(b.formatos)) throw bad('Formato inválido');
    const lunes = lunesDeBody(b.semana);
    const seg = (v) => { if (v === null || v === '' || v === undefined) return null; const n = parseInt(v, 10); if (!(n >= 0 && n <= 86400)) throw bad('El tiempo debe ser un número de segundos válido'); return n; };
    const lista = b.formatos.map(f => {
      const o = { id: Number(f.id) };
      if (f.estaciones !== undefined) { const e = parseInt(f.estaciones, 10); if (!(e >= 1 && e <= 12)) throw bad('Las estaciones deben ser entre 1 y 12'); o.estaciones = e; }
      for (const k of ['trabajo_seg', 'descanso_seg']) if (f[k] !== undefined) o[k] = seg(f[k]);
      for (const k of ['sin_trabajo', 'sin_descanso']) if (f[k] !== undefined) o[k] = f[k] ? 1 : 0;
      if (f.duracion_min !== undefined) o.duracion_min = f.duracion_min === null || f.duracion_min === '' ? null : Math.max(1, Math.min(600, parseInt(f.duracion_min, 10) || 60));
      if (f.rondas !== undefined) o.rondas = Math.max(1, Math.min(3, parseInt(f.rondas, 10) || 3));
      if (f.cupo_estacion !== undefined) o.cupo_estacion = f.cupo_estacion === null || f.cupo_estacion === '' ? null : Math.max(1, Math.min(30, parseInt(f.cupo_estacion, 10) || 1));
      if (f.intensidad_min !== undefined) o.intensidad_min = ['baja', 'moderada', 'alta'].includes(f.intensidad_min) ? f.intensidad_min : null;
      if (f.patrones !== undefined) o.patrones = est.lista(f.patrones, est.CLAVES.patrones);
      if (f.capacidades !== undefined) o.capacidades = est.lista(f.capacidades, est.CLAVES.capacidades);
      if (f.energias !== undefined) o.energias = est.lista(f.energias, est.CLAVES.energias);
      for (const k of ['patrones', 'capacidades', 'energias']) if (o[k] && !o[k].length) throw bad('Cada formato necesita al menos una opción en patrones de movimiento, capacidades físicas y sistema energético');
      return o;
    });
    semana.guardarFormatos(lunes, lista);
    return { ok: true, semana: lunes, aplicado: aplicar(lunes, true) };
  });
  route('POST', '/api/formatos-semana/copiar', ADM, async ({ req }) => {
    const b = await readBody(req);
    const lunes = lunesDeBody(b.semana);
    const n = semana.copiarFormatos(lunes);
    return { ok: true, semana: lunes, formatos: n, aplicado: aplicar(lunes, true) };
  });

  // ---- staff de la semana
  route('POST', '/api/staff/copiar', ADM, async ({ req }) => {
    const b = await readBody(req);
    const lunes = lunesDeBody(b.semana);
    const n = semana.copiarStaff(lunes);
    return { ok: true, semana: lunes, asignados: n, aplicado: aplicar(lunes, false) };
  });
}
module.exports = { registrar };
