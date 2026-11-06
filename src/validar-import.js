'use strict';
// Versión 9: validación de los archivos de importación (clientes y rutinas). Un solo juego de reglas: lo usan la
// previsualización ("Revisar archivo") y la importación real, así lo que se avisa antes es lo que se aplica después.
// Cada error indica la fila del Excel (la fila 1 es el encabezado) y la columna.

const claveNombre = (n) => String(n || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const soloDig = (t) => String(t ?? '').replace(/\D+/g, '');

// Fecha: DD/MM/AAAA (2 dígitos de día y mes, 4 de año) o AAAA-MM-DD (uso interno / API). Devuelve 'AAAA-MM-DD' o null.
function fechaISO(v) {
  const s = String(v ?? '').trim();
  let d, m, a;
  let x = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (x) { d = +x[1]; m = +x[2]; a = +x[3]; }
  else if ((x = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s))) { a = +x[1]; m = +x[2]; d = +x[3]; }
  else return null;
  if (a < 1990 || a > 2100 || m < 1 || m > 12 || d < 1) return null;
  const dias = new Date(Date.UTC(a, m, 0)).getUTCDate();
  if (d > dias) return null;
  return a + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
}

// Celular: numérico libre. Se aceptan espacios, guiones, paréntesis, puntos y un "+" inicial como separadores; se guardan solo los dígitos.
function celularValido(v) {
  const s = String(v ?? '').trim();
  if (!s) return { ok: true, valor: '' };
  if (!/^\+?[\d\s\-().]+$/.test(s) || !/\d/.test(s)) return { ok: false };
  return { ok: true, valor: (s.startsWith('+') ? '+' : '') + soloDig(s) };
}

// filas: [{ fila, nombre, plan, fecha_alta, fecha_baja, celular, instagram }]; planes: [{ nombre }]
function validarClientes(filas, planes) {
  const errores = [], avisos = [], duplicadas = [], validas = [];
  const buscarPlan = (txt) => {
    const k = claveNombre(String(txt).replace(/\(.*$/, ''));
    return k ? (planes || []).find(p => claveNombre(p.nombre) === k) || null : null;
  };
  const vistos = [];
  filas.forEach((f, i) => {
    const n = f.fila || (i + 2);
    const err = (campo, msg) => errores.push({ fila: n, campo, mensaje: msg, texto: `Fila ${n} · ${campo}: ${msg}` });
    const antes = errores.length;
    const nombre = String(f.nombre ?? '').trim();
    if (!nombre) err('Nombre y Apellido', 'está vacío (es obligatorio)');
    else if (nombre.length > 120) err('Nombre y Apellido', 'es demasiado largo (máximo 120 caracteres)');
    if (f.plan !== undefined && String(f.plan).trim() !== '' && !buscarPlan(f.plan)) err('Plan', `“${String(f.plan).trim().slice(0, 40)}” no es un plan de la lista`);
    let alta = null, baja = null;
    if (f.fecha_alta !== undefined && String(f.fecha_alta).trim() !== '') { alta = fechaISO(f.fecha_alta); if (!alta) err('Fecha de alta', `“${String(f.fecha_alta).trim().slice(0, 20)}” no es una fecha válida (formato DD/MM/AAAA)`); }
    if (f.fecha_baja !== undefined && String(f.fecha_baja).trim() !== '') { baja = fechaISO(f.fecha_baja); if (!baja) err('Fecha de baja', `“${String(f.fecha_baja).trim().slice(0, 20)}” no es una fecha válida (formato DD/MM/AAAA)`); }
    if (alta && baja && baja < alta) err('Fecha de baja', 'es anterior a la fecha de alta');
    const cel = celularValido(f.celular);
    if (!cel.ok) err('Celular', `“${String(f.celular).trim().slice(0, 25)}” tiene letras o símbolos (solo números)`);
    if (String(f.instagram ?? '').length > 60) err('Instagram', 'es demasiado largo (máximo 60 caracteres)');
    if (errores.length > antes || !nombre) return;
    // repetidos dentro del archivo: se carga uno solo (el primero) y se avisa
    const k = claveNombre(nombre), c8 = soloDig(cel.valor).slice(-8);
    const rep = vistos.find(v => (c8.length === 8 && v.c8 === c8 && (v.k === k || v.k.split(' ').some(w => w.length > 2 && k.split(' ').includes(w)))) || (v.k === k && (!c8 || !v.c8 || v.c8 === c8)));
    if (rep) { duplicadas.push({ fila: n, de: rep.fila, nombre }); return; }
    vistos.push({ k, c8, fila: n });
    validas.push({ ...f, fila: n, nombre, fecha_alta: alta || undefined, fecha_baja: baja || undefined, celular: cel.valor || undefined });
  });
  return { errores, avisos, duplicadas, validas };
}

const enteroEn = (v, min, max) => {
  const s = String(v ?? '').trim().replace(',', '.');
  if (!/^\d{1,4}(\.0+)?$/.test(s)) return null;
  const n = Math.round(Number(s));
  return n >= min && n <= max ? n : null;
};

// filas: [{ fila, rutina, descripcion, patron, ejercicio, series, repeticiones, peso, descanso, seg_serie }]
// ejercicios: [{ id, nombre, zona }] (zona = patrón de movimiento). Devuelve las rutinas agrupadas por nombre.
function validarRutinas(filas, ejercicios) {
  const errores = [], grupos = new Map();
  const porPatron = new Map();
  for (const e of ejercicios || []) {
    const k = claveNombre(e.zona);
    if (!porPatron.has(k)) porPatron.set(k, []);
    porPatron.get(k).push(e);
  }
  filas.forEach((f, i) => {
    const n = f.fila || (i + 2);
    const antes = errores.length;
    const err = (campo, msg) => errores.push({ fila: n, campo, mensaje: msg, texto: `Fila ${n} · ${campo}: ${msg}` });
    const nombre = String(f.rutina ?? '').trim();
    if (!nombre) err('Nombre de la rutina', 'está vacío (es obligatorio)');
    else if (nombre.length > 80) err('Nombre de la rutina', 'es demasiado largo (máximo 80 caracteres)');
    if (String(f.descripcion ?? '').length > 300) err('Descripción', 'es demasiado larga (máximo 300 caracteres)');
    const pk = claveNombre(f.patron);
    let ej = null;
    if (!pk) err('Patrón de movimiento', 'está vacío');
    else if (!porPatron.has(pk)) err('Patrón de movimiento', `“${String(f.patron).trim().slice(0, 40)}” no es un patrón de la lista`);
    const ek = claveNombre(f.ejercicio);
    if (!ek) err('Ejercicio', 'está vacío');
    else if (porPatron.has(pk)) {
      ej = porPatron.get(pk).find(e => claveNombre(e.nombre) === ek) || null;
      if (!ej) {
        const otro = (ejercicios || []).find(e => claveNombre(e.nombre) === ek);
        err('Ejercicio', otro ? `“${String(f.ejercicio).trim().slice(0, 40)}” pertenece al patrón “${otro.zona}”, no a “${String(f.patron).trim().slice(0, 40)}”` : `“${String(f.ejercicio).trim().slice(0, 40)}” no está en la biblioteca para ese patrón`);
      }
    }
    const series = enteroEn(f.series, 1, 99); if (series === null) err('Series', 'debe ser un número entero de 1 a 99');
    const reps = enteroEn(f.repeticiones, 1, 99); if (reps === null) err('Repeticiones', 'debe ser un número entero de 1 a 99');
    const vacioPeso = String(f.peso ?? '').trim() === '';
    const peso = vacioPeso ? 0 : enteroEn(f.peso, 0, 999); if (peso === null) err('Peso', 'debe ser un número de 0 a 999 (vacío o 0 = peso corporal)');
    const desc = enteroEn(f.descanso, 0, 999); if (desc === null) err('Descanso (seg)', 'debe ser un número entero de 0 a 999');
    const seg = enteroEn(f.seg_serie, 0, 999); if (seg === null) err('Segundos por serie', 'debe ser un número entero de 0 a 999');
    if (errores.length > antes) return;
    const k = claveNombre(nombre);
    if (!grupos.has(k)) grupos.set(k, { nombre, descripcion: String(f.descripcion ?? '').trim(), fila: n, items: [] });
    const g = grupos.get(k);
    if (!g.descripcion && String(f.descripcion ?? '').trim()) g.descripcion = String(f.descripcion).trim();
    g.items.push({ fila: n, ejercicio_id: ej.id, series, repeticiones: String(reps), peso: peso ? String(peso) : '', descanso_seg: desc, seg_serie: seg });
  });
  for (const g of grupos.values()) {
    const dur = Math.round(g.items.reduce((a, i) => a + i.series * (i.seg_serie + i.descanso_seg), 0) / 60);
    if (dur > 180) errores.push({ fila: g.fila, campo: 'Rutina', mensaje: 'dura ' + dur + ' minutos', texto: `Fila ${g.fila} · Rutina “${g.nombre}”: dura ${dur} minutos y el máximo es 180 (revisá series, descanso y segundos por serie)` });
  }
  for (const g of grupos.values()) if (g.items.length > 60) errores.push({ fila: g.fila, campo: 'Rutina', mensaje: 'tiene más de 60 ejercicios', texto: `Fila ${g.fila} · Rutina “${g.nombre}”: tiene más de 60 ejercicios` });
  return { errores, rutinas: [...grupos.values()] };
}

// Posiciones dibujadas de un ejercicio (diseñador de la Versión 9). Devuelve el JSON normalizado (texto) o null; undefined = sin cambios.
const EQUIPOS_POSE = ['mancuerna', 'pesa_rusa', 'barra_discos', 'pelota', 'bolso', 'rueda_abdominal', 'colchoneta', 'cajon', 'banco', 'barra_dominadas', 'conos', 'soga', 'banda_rtx'];
function validarPoses(v) {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  let o = v;
  if (typeof v === 'string') { if (v.length > 30000) throw new Error('El dibujo es demasiado grande'); try { o = JSON.parse(v); } catch (_) { throw new Error('El dibujo de posiciones no es válido'); } }
  if (!o || !Array.isArray(o.poses) || o.poses.length !== 3) throw new Error('El dibujo debe tener las 3 posiciones');
  const num = (x, a, b, nom) => { const n = Number(x); if (!Number.isFinite(n) || n < a || n > b) throw new Error('Dibujo inválido (' + nom + ')'); return Math.round(n * 10) / 10; };
  const par = (p, nom) => { if (p === null || p === undefined) return null; if (!Array.isArray(p) || p.length !== 2) throw new Error('Dibujo inválido (' + nom + ')'); return [num(p[0], -720, 720, nom), num(p[1], -720, 720, nom)]; };
  const poses = o.poses.map((p) => {
    if (!p || typeof p !== 'object') throw new Error('Dibujo inválido');
    const eq = Array.isArray(p.eq) ? p.eq : [];
    if (eq.length > 8) throw new Error('Máximo 8 elementos de equipamiento por posición');
    const out = { t: num(p.t, -720, 720, 'tronco'), a: par(p.a, 'brazo') || [90, 90], a2: par(p.a2, 'brazo'), l: par(p.l, 'pierna') || [90, 90], b: par(p.b, 'pierna'), hx: num(p.hx ?? 100, -20, 220, 'x'), hy: num(p.hy ?? 78, -20, 220, 'y'),
      eq: eq.map(it => {
        if (!it || !(EQUIPOS_POSE.includes(it.k) || /^[a-z0-9_]{1,40}$/.test(String(it.k || '')))) throw new Error('Equipamiento inválido en el dibujo');
        return { k: it.k, x: num(it.x ?? 100, -20, 220, 'x'), y: num(it.y ?? 100, -20, 220, 'y'), m: [0, 1, 2].includes(Number(it.m)) ? Number(it.m) : 0, s: it.s === undefined || it.s === null ? 1 : num(it.s, 0.4, 3.5, 'tamaño') };
      }) };
    if (p.ht !== undefined && p.ht !== null) out.ht = num(p.ht, -720, 720, 'cabeza');
    return out;
  });
  return JSON.stringify({ v: 1, poses });
}

// Dibujo de un equipamiento (V10): formas simples dentro de un cuadro de 60 x 40. { v:1, agarre:0|1, formas:[{t:'r'|'o'|'l'|'a'|'p', ...}] }
const COLORES_DIB = /^#[0-9a-fA-F]{6}$/;
function validarDibujo(v) {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  let o = v;
  if (typeof v === 'string') { if (v.length > 20000) throw new Error('El dibujo del equipamiento es demasiado grande'); try { o = JSON.parse(v); } catch (_) { throw new Error('El dibujo del equipamiento no es válido'); } }
  if (!o || !Array.isArray(o.formas)) throw new Error('El dibujo del equipamiento no es válido');
  if (o.formas.length > 40) throw new Error('Máximo 40 formas por dibujo');
  const n = (x, a, b) => { const z = Number(x); if (!Number.isFinite(z)) throw new Error('Dibujo del equipamiento inválido'); return Math.round(Math.max(a, Math.min(b, z)) * 10) / 10; };
  const formas = o.formas.map((f) => {
    if (!f || typeof f !== 'object') throw new Error('Dibujo del equipamiento inválido');
    const c = COLORES_DIB.test(String(f.c || '')) ? String(f.c).toLowerCase() : '#4da3ff', g = n(f.g ?? 2.5, 0.8, 6), rel = f.f ? 1 : 0;
    switch (f.t) {
      case 'r': return { t: 'r', x: n(f.x, 0, 60), y: n(f.y, 0, 40), w: n(f.w, 0.5, 60), h: n(f.h, 0.5, 40), c, g, f: rel };
      case 'o': case 'a': return { t: f.t, x: n(f.x, 0, 60), y: n(f.y, 0, 40), rx: n(f.rx, 0.5, 30), ry: n(f.ry, 0.5, 20), c, g, f: rel };
      case 'l': return { t: 'l', x1: n(f.x1, 0, 60), y1: n(f.y1, 0, 40), x2: n(f.x2, 0, 60), y2: n(f.y2, 0, 40), c, g };
      case 'p': { if (!Array.isArray(f.pts) || f.pts.length < 2 || f.pts.length > 80) throw new Error('Trazo inválido'); return { t: 'p', pts: f.pts.map(q => [n(q[0], 0, 60), n(q[1], 0, 40)]), c, g }; }
      default: throw new Error('Forma inválida en el dibujo del equipamiento');
    }
  });
  return JSON.stringify({ v: 1, agarre: o.agarre ? 1 : 0, formas });
}

module.exports = { validarDibujo, validarPoses, fechaISO, celularValido, validarClientes, validarRutinas, claveNombre };
