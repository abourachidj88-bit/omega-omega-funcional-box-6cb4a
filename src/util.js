'use strict';
// Utilidades de fechas (zona horaria Argentina, UTC-3 sin horario de verano)

const AR_OFFSET_MS = -3 * 60 * 60 * 1000;

function nowAR(date = new Date()) {
  const d = new Date(date.getTime() + AR_OFFSET_MS);
  const fecha = d.toISOString().slice(0, 10);
  let dow = d.getUTCDay(); // 0=domingo
  dow = dow === 0 ? 7 : dow; // 1=lunes ... 7=domingo
  return { fecha, hora: d.getUTCHours(), min: d.getUTCMinutes(), dow, iso: d.toISOString() };
}

function parseFecha(s) {
  const [y, m, d] = String(s).slice(0, 10).split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function fmtFecha(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

function addDays(fecha, n) {
  return fmtFecha(parseFecha(fecha) + n * 86400000);
}

function diffDays(a, b) {
  // a - b en días
  return Math.round((parseFecha(a) - parseFecha(b)) / 86400000);
}

function dowDe(fecha) {
  let dow = new Date(parseFecha(fecha)).getUTCDay();
  return dow === 0 ? 7 : dow;
}

function lunesDe(fecha) {
  return addDays(fecha, -(dowDe(fecha) - 1));
}

function addMeses(fecha, n) {
  const [y, m, d] = fecha.split('-').map(Number);
  const total = (m - 1) + n;
  const ny = y + Math.floor(total / 12);
  const nm = ((total % 12) + 12) % 12;
  const ultimo = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  return fmtFecha(Date.UTC(ny, nm, Math.min(d, ultimo)));
}

function mesesEntre(desde, hasta) {
  // meses completos transcurridos entre dos fechas (>= 0)
  const [y1, m1, d1] = desde.split('-').map(Number);
  const [y2, m2, d2] = hasta.split('-').map(Number);
  let m = (y2 - y1) * 12 + (m2 - m1);
  if (d2 < d1) m -= 1;
  return Math.max(0, m);
}

function esFecha(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(parseFecha(s));
}

module.exports = { nowAR, parseFecha, fmtFecha, addDays, diffDays, dowDe, lunesDe, addMeses, mesesEntre, esFecha };
