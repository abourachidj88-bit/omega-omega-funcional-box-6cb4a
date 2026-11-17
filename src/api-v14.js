'use strict';
// Versión 14: equipamiento inteligente (ver equipo-ia.js). Cada equipamiento nuevo dispara un trabajo en segundo plano:
//   buscando → (si el nombre es ambiguo: elegir) → pensando → listo
// Al terminar deja un dibujo propuesto en el equipamiento y los ejercicios propuestos en "sugerencias", para que el usuario los acepte o los descarte.
// Sin clave o sin internet no se genera nada.
const { all, get, run, tx } = require('./db');
const est = require('./estimulos');
const ia = require('./equipo-ia');
const { validarDibujo } = require('./validar-import');

const trabajos = new Map();       // clave del equipamiento -> { estado, nombre, candidatos, fuentes, mensaje, t }
const ahora = () => Date.now();
const set = (clave, p) => { const t = { ...(trabajos.get(clave) || {}), ...p, t: ahora() }; trabajos.set(clave, t); return t; };

function guardarPropuesta(clave, cand, p, fuentesN) {
  let nuevas = 0;
  tx(() => {
    for (const e of p.ejercicios) {
      const zona = est.zonaDeClave(e.patron); if (!zona) continue;
      if (get('SELECT 1 AS x FROM ejercicios WHERE activo = 1 AND zona = ? AND nombre = ? COLLATE NOCASE', zona, e.nombre)) continue;
      if (get("SELECT 1 AS x FROM sugerencias WHERE estado = 'pendiente' AND zona = ? AND nombre = ? COLLATE NOCASE", zona, e.nombre)) continue;
      run('INSERT INTO sugerencias (equipo_clave, zona, nombre, prog2, prog3, patron, creado, capacidad, energia, intensidad, ia) VALUES (?,?,?,?,?,?,?,?,?,?,1)',
        clave, zona, e.nombre, e.prog2, e.prog3, est.ILUSTRACION[e.patron] || 'sentadilla', new Date().toISOString(), est.aTexto(e.capacidades) || 'fuerza', est.aTexto(e.energias) || 'aerobico', e.intensidad);
      nuevas++;
    }
    const notas = [];
    if (p.descripcion) notas.push(p.descripcion);
    if (!fuentesN) notas.push('No se encontró información en Wikipedia: la propuesta se basa en el conocimiento general de la IA, revisala con cuidado.');
    else if (!p.conImagen && p.dibujo) notas.push('No se encontró una foto de referencia: el dibujo es una interpretación de la IA.');
    if (p.peso.tiene) notas.push('Peso típico: ' + p.peso.kg + ' kg.');
    if (p.faltan.length) notas.push('No se llegó a ' + ia.MIN_POR_ESTIMULO + ' ejercicios en: ' + p.faltan.join(', ') + '.');
    run('UPDATE equipamiento SET dibujo_ia = ?, ia_nota = ? WHERE clave = ?', p.dibujo, notas.join(' ').slice(0, 900) || null, clave);
  });
  return nuevas;
}

async function correr(clave, nombre) {
  try {
    set(clave, { estado: 'buscando', nombre, candidatos: null, mensaje: null });
    let fuentes = [];
    try { fuentes = await ia.wikipedia(nombre); } catch (e) { if (e.codigo !== 'sin_internet') throw e; }
    const id = await ia.identificar(nombre, fuentes);        // si no hay internet, acá falla con sin_internet
    if (!id.entendido) return set(clave, { estado: 'no_entendido', mensaje: 'No pude reconocer «' + nombre + '» como equipamiento de entrenamiento. Queda como lo escribiste, sin propuestas.' });
    set(clave, { fuentes });
    if (id.ambiguo) return set(clave, { estado: 'elegir', candidatos: id.candidatos });
    await seguir(clave, nombre, id.candidatos[0]);
  } catch (e) { fin(clave, e); }
}
async function seguir(clave, nombre, cand) {
  try {
    set(clave, { estado: 'pensando', candidatos: null });
    const t = trabajos.get(clave) || {};
    const p = await ia.propuesta(nombre, cand, t.fuentes || [], validarDibujo);
    const n = guardarPropuesta(clave, cand, p, (t.fuentes || []).length);
    set(clave, { estado: 'listo', fuentes: null, mensaje: n + ' ejercicios propuestos' + (p.dibujo ? ' y un dibujo' : ''), ejercicios: n, dibujo: !!p.dibujo });
  } catch (e) { fin(clave, e); }
}
function fin(clave, e) {
  const c = e && e.codigo;
  if (c === 'sin_internet') return set(clave, { estado: 'sin_internet', fuentes: null, mensaje: 'Sin conexión a internet: no se generaron propuestas.' });
  if (c === 'sin_clave') return set(clave, { estado: 'sin_clave', fuentes: null, mensaje: 'La IA no está configurada en esta instalación.' });
  console.error('[ia equipamiento]', clave, e && e.message);
  return set(clave, { estado: 'error', fuentes: null, mensaje: (e && e.codigo ? e.message : 'No se pudo generar la propuesta') });
}
// Arranca el trabajo (sin esperar). Devuelve el estado inicial.
function iniciar(clave, nombre) {
  if (!ia.disponible()) { set(clave, { estado: 'sin_clave', nombre, mensaje: 'La IA no está configurada en esta instalación.' }); return 'sin_clave'; }
  const t = trabajos.get(clave); if (t && ['buscando', 'pensando', 'elegir'].includes(t.estado)) return t.estado;
  setImmediate(() => correr(clave, nombre));
  set(clave, { estado: 'buscando', nombre, candidatos: null, mensaje: null });
  return 'buscando';
}

function registrar(ctx) {
  const { route, ADM, STAFF, HttpError, bad, readBody } = ctx;
  const equipo = (clave) => { const e = get('SELECT * FROM equipamiento WHERE clave = ?', clave); if (!e) throw new HttpError(404, 'Equipamiento no encontrado'); return e; };
  const vista = (clave) => { const t = trabajos.get(clave); return t ? { clave, nombre: t.nombre, estado: t.estado, mensaje: t.mensaje || null, candidatos: t.candidatos || null, ejercicios: t.ejercicios || 0, dibujo: !!t.dibujo, hace_seg: Math.round((ahora() - t.t) / 1000) } : null; };

  route('POST', '/api/equipamiento/:clave/ia', ADM, ({ params }) => { const e = equipo(params.clave); return { estado: iniciar(e.clave, e.nombre) }; });
  // Trabajos en curso o terminados hace poco (la pantalla los consulta cada pocos segundos)
  route('GET', '/api/equipamiento-ia/pendientes', STAFF, () => {
    const out = []; for (const [clave, t] of trabajos) { if (['buscando', 'pensando', 'elegir'].includes(t.estado) || ahora() - t.t < 5 * 60 * 1000) { const v = vista(clave); if (v) out.push(v); } }
    return out;
  });
  route('POST', '/api/equipamiento/:clave/ia/elegir', ADM, async ({ req, params }) => {
    const e = equipo(params.clave), t = trabajos.get(e.clave), b = await readBody(req);
    if (!t || t.estado !== 'elegir') throw bad('No hay nada para elegir en este equipamiento');
    if (b.indice === null || b.indice === undefined || b.indice === '') { set(e.clave, { estado: 'omitido', candidatos: null, fuentes: null, mensaje: 'Queda como lo describiste, sin propuestas de ejercicios.' }); return { estado: 'omitido' }; }
    const i = Number(b.indice), cand = (t.candidatos || [])[i];
    if (!Number.isInteger(i) || !cand) throw bad('Opción inválida');
    set(e.clave, { estado: 'pensando', candidatos: null });
    setImmediate(() => seguir(e.clave, e.nombre, cand));
    return { estado: 'pensando' };
  });
  // Dibujo propuesto: usarlo (reemplaza el dibujo actual) o descartarlo
  route('POST', '/api/equipamiento/:clave/ia/dibujo', ADM, async ({ req, params }) => {
    const e = equipo(params.clave), b = await readBody(req);
    if (!e.dibujo_ia) throw bad('Este equipamiento no tiene un dibujo propuesto');
    if (b.accion === 'usar') run('UPDATE equipamiento SET dibujo = dibujo_ia, dibujo_ia = NULL, ia_nota = NULL WHERE clave = ?', e.clave);
    else if (b.accion === 'descartar') run('UPDATE equipamiento SET dibujo_ia = NULL WHERE clave = ?', e.clave);
    else throw bad('Acción inválida');
    return { ok: true };
  });
  route('POST', '/api/sugerencias/descartar-todas', ADM, async ({ req }) => {
    const b = await readBody(req); const clave = b.equipo ? String(b.equipo) : null;
    const r = clave ? run("UPDATE sugerencias SET estado = 'descartada' WHERE estado = 'pendiente' AND equipo_clave = ?", clave) : run("UPDATE sugerencias SET estado = 'descartada' WHERE estado = 'pendiente'");
    return { descartadas: r.changes };
  });
}
module.exports = { registrar, iniciar, _trabajos: trabajos };
