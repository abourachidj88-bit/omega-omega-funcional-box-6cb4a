'use strict';
const { diffDays, lunesDe, addMeses, mesesEntre } = require('./util');

// Fecha de baja efectiva: si no se cargó, se completa automáticamente (alta + 1 mes)
// y se corre un mes con cada renovación (la renovación actualiza fecha_baja).
function bajaEfectiva(c) {
  return c.fecha_baja || addMeses(c.fecha_alta, 1);
}

// Semáforo 1 – estado del alta
// Verde: activo | Amarillo: baja hace hasta 3 meses (recuperable) | Rojo: baja hace más de 3 meses
function semaforoAlta(c, hoy) {
  const baja = bajaEfectiva(c);
  if (baja >= hoy) return { color: 'verde', estado: 'Activo', mesesBaja: 0, diasBaja: 0, baja };
  const meses = mesesEntre(baja, hoy);
  const dias = diffDays(hoy, baja);
  const reciente = addMeses(baja, 3) >= hoy;
  return { color: reciente ? 'amarillo' : 'rojo', estado: reciente ? 'Baja reciente (recuperable)' : 'Baja +3 meses', mesesBaja: meses, diasBaja: dias, baja };
}

// Semáforo 2 – asistencia (semanas calendario, lunes a domingo)
// Verde: entrenó esta semana | Amarillo: 1 semana sin entrenar | Naranja: 2 a 3 semanas | Rojo: más de 3 semanas
function semaforoAsistencia(ultima, c, hoy) {
  const ref = ultima || null;
  if (!ref) {
    // sin asistencias: se mide desde el alta
    const sem = diffDays(lunesDe(hoy), lunesDe(c.fecha_alta)) / 7;
    if (sem <= 0) return { color: 'verde', semanasSin: 0, texto: 'Alta esta semana' };
    return armarAsist(sem);
  }
  const sem = diffDays(lunesDe(hoy), lunesDe(ref)) / 7;
  return armarAsist(sem);
}
function armarAsist(sem) {
  if (sem <= 0) return { color: 'verde', semanasSin: 0, texto: 'Entrenó esta semana' };
  if (sem === 1) return { color: 'amarillo', semanasSin: 1, texto: '1 semana sin entrenar' };
  if (sem <= 3) return { color: 'naranja', semanasSin: sem, texto: sem + ' semanas sin entrenar (riesgo crítico)' };
  return { color: 'rojo', semanasSin: sem, texto: 'Más de 3 semanas sin entrenar' };
}

module.exports = { bajaEfectiva, semaforoAlta, semaforoAsistencia };
