'use strict';
// Estado de resultados mensual (formato vertical): Ingresos - Costos operativos = Margen bruto; Margen bruto - Gastos = Resultado.
// Los egresos con "devengamiento" (por ejemplo equipamiento nuevo) se reparten en X meses para no hundir el margen de un solo mes.
const { all, get } = require('./db');

const COSTOS = ['Salarios', 'Alquiler', 'Luz', 'Agua', 'Gas', 'Monotributo', 'IIBB', 'Tasas'];
const GASTOS = ['Limpieza', 'Agua para clientes', 'Eventos', 'Marketing', 'Equipamiento', 'Mantenimiento', 'Otros'];
const ALIAS = {
  'salarios de profesores': 'Salarios', 'sueldos': 'Salarios', 'sueldos del staff': 'Salarios', 'salario': 'Salarios',
  'tasas municipales': 'Tasas', 'tasa': 'Tasas', 'otros impuestos': 'IIBB', 'ingresos brutos': 'IIBB',
  'mantenimiento y equipamiento': 'Mantenimiento', 'mantenimiento y equipos': 'Mantenimiento', 'equipos': 'Equipamiento', 'equipamiento nuevo': 'Equipamiento',
};
function linea(categoria) {
  const k = String(categoria || '').trim().toLowerCase();
  for (const n of COSTOS) if (n.toLowerCase() === k) return { grupo: 'costos', nombre: n };
  for (const n of GASTOS) if (n.toLowerCase() === k) return { grupo: 'gastos', nombre: n };
  const a = ALIAS[k];
  if (a) return { grupo: COSTOS.includes(a) ? 'costos' : 'gastos', nombre: a };
  return { grupo: 'gastos', nombre: 'Otros' };
}
const mesNum = (m) => { const [y, mm] = m.split('-').map(Number); return y * 12 + (mm - 1); };
const mesMas = (m, n) => { const t = mesNum(m) + n; return Math.floor(t / 12) + '-' + String((t % 12) + 1).padStart(2, '0'); };
const pct = (a, b) => (b > 0 ? Math.round(1000 * a / b) / 10 : 0);
const r0 = (n) => Math.round(n);

function estadoDelMes(mes) {
  // ---- ingresos
  const ing = all(`SELECT f.categoria, f.monto, f.medio, f.pago_id, p.cliente_id, p.plan_id, pl.nombre AS plan, COALESCE(p.plan_full, f.monto) AS full, COALESCE(p.descuento, 0) AS descuento
    FROM finanzas f LEFT JOIN pagos p ON p.id = f.pago_id LEFT JOIN planes pl ON pl.id = p.plan_id
    WHERE f.tipo = 'ingreso' AND f.fecha BETWEEN ? AND ?`, mes + '-01', mes + '-31');
  const cuotas = ing.filter(r => r.categoria === 'Cuotas');
  const itemsIng = new Map();
  const sumar = (m, k, v) => { const x = m.get(k) || { nombre: k, monto: 0, n: 0 }; x.monto += v; x.n++; m.set(k, x); };
  // Plan Full = abonos sin descuento; Ingreso neto = Plan Full - Descuentos. Todos los porcentajes se calculan sobre el Plan Full.
  for (const r of cuotas) sumar(itemsIng, 'Cuotas · ' + (r.medio === 'efectivo' ? 'Efectivo' : r.medio === 'mercadopago' ? 'Mercado Pago' : 'Otro medio'), r.full);
  for (const r of ing.filter(r => r.categoria !== 'Cuotas')) sumar(itemsIng, r.categoria || 'Otros ingresos', r.monto);
  const totalNeto = ing.reduce((a, r) => a + r.monto, 0);
  const totalCuotas = cuotas.reduce((a, r) => a + r.monto, 0);
  const cuotasFull = cuotas.reduce((a, r) => a + r.full, 0);
  const descuentos = cuotas.reduce((a, r) => a + r.descuento, 0);
  const totalIng = totalNeto + descuentos;      // Plan Full total (base de todos los porcentajes)
  const alumnos = new Set(cuotas.map(r => r.cliente_id).filter(Boolean)).size;
  const porPlan = new Map();
  for (const r of cuotas) {
    const k = r.plan || 'Sin plan';
    const x = porPlan.get(k) || { plan: k, alumnos: new Set(), cuotas: 0, total: 0 };
    if (r.cliente_id) x.alumnos.add(r.cliente_id); x.cuotas++; x.total += r.full; porPlan.set(k, x);
  }
  const por_plan = [...porPlan.values()].map(x => ({ plan: x.plan, alumnos: x.alumnos.size, cuotas: x.cuotas, total: r0(x.total), precio_promedio: x.cuotas ? r0(x.total / x.cuotas) : 0 })).sort((a, b) => b.total - a.total);

  // ---- egresos devengados en el mes
  const filas = all(`SELECT categoria, monto, fecha, devengar_meses FROM finanzas WHERE tipo = 'egreso' AND substr(fecha,1,7) <= ?
    AND (substr(fecha,1,7) = ? OR devengar_meses > 1)`, mes, mes);
  const costos = new Map(COSTOS.map(n => [n, 0])), gastos = new Map(GASTOS.map(n => [n, 0]));
  for (const f of filas) {
    const n = Math.max(1, f.devengar_meses || 1);
    const dif = mesNum(mes) - mesNum(f.fecha.slice(0, 7));
    if (dif < 0 || dif >= n) continue;
    const l = linea(f.categoria);
    const m = l.grupo === 'costos' ? costos : gastos;
    m.set(l.nombre, m.get(l.nombre) + f.monto / n);
  }
  const lista = (m) => [...m.entries()].map(([nombre, monto]) => ({ nombre, monto: r0(monto), pct: pct(monto, totalIng) }));
  const totCostos = [...costos.values()].reduce((a, b) => a + b, 0), totGastos = [...gastos.values()].reduce((a, b) => a + b, 0);
  const margen = totalNeto - totCostos, resultado = margen - totGastos;
  return {
    mes,
    ingresos: { plan_full: r0(totalIng), descuentos: r0(descuentos), descuentos_pct: pct(descuentos, totalIng), neto: r0(totalNeto), neto_pct: pct(totalNeto, totalIng), total: r0(totalNeto), cuotas_total: r0(totalCuotas), cuotas_full: r0(cuotasFull), alumnos, cuotas_n: cuotas.length, ticket: alumnos ? r0(cuotasFull / alumnos) : 0,
      items: [...itemsIng.values()].map(x => ({ nombre: x.nombre, monto: r0(x.monto), n: x.n, pct: pct(x.monto, totalIng) })), por_plan },
    costos: { total: r0(totCostos), pct: pct(totCostos, totalIng), items: lista(costos) },
    margen_bruto: { monto: r0(margen), pct: pct(margen, totalIng) },
    gastos: { total: r0(totGastos), pct: pct(totGastos, totalIng), items: lista(gastos) },
    resultado: { monto: r0(resultado), pct: pct(resultado, totalIng) },
  };
}
function rolling(mes, n) {
  n = Math.max(1, Math.min(13, n | 0 || 1));
  const cols = [];
  for (let i = n - 1; i >= 0; i--) cols.push(estadoDelMes(mesMas(mes, -i)));
  return cols;
}
// Sensibilidad de alta: cuánto absorbe un alumno nuevo adicional de los costos fijos del negocio
function sensibilidad(er, activos) {
  const fijos = er.costos.total + er.gastos.total;
  const n = er.ingresos.alumnos || activos || 0;
  const ticket = er.ingresos.ticket || 0;
  if (!(n > 0) || !(fijos > 0)) return { alumnos: n, costos_fijos: fijos, ticket, disponible: false };
  const antes = fijos / n, despues = fijos / (n + 1);
  return {
    disponible: true, alumnos: n, costos_fijos: fijos, ticket,
    fijo_por_alumno: r0(antes), fijo_por_alumno_con_nuevo: r0(despues), baja_pct: Math.round(1000 * (antes - despues) / antes) / 10,
    absorbe_pct: Math.round(1000 * ticket / fijos) / 10, resultado_extra: ticket,
  };
}
// Base para el presupuesto: promedio de los últimos meses con movimientos (o el mes actual si no hay otros)
function baseForecast(mesActual, opc = {}) {
  const prom = () => {
    const prev = [1, 2, 3].map(i => estadoDelMes(mesMas(mesActual, -i))).filter(e => e.ingresos.total > 0 || e.costos.total > 0 || e.gastos.total > 0);
    return prev.length ? prev : [estadoDelMes(mesActual)];
  };
  const fuente = (mes) => (/^\d{4}-\d{2}$/.test(mes || '') && mes <= mesActual ? [estadoDelMes(mes)] : prom());
  const uCostos = fuente(opc.costos), uIng = fuente(opc.ingresos);
  const avg = (usar, f) => usar.reduce((a, e) => a + f(e), 0) / usar.length;
  const lineas = {};
  for (const n of COSTOS) lineas[n] = r0(avg(uCostos, e => e.costos.items.find(i => i.nombre === n).monto));
  for (const n of GASTOS) lineas[n] = r0(avg(uCostos, e => e.gastos.items.find(i => i.nombre === n).monto));
  const alumnos = Math.round(avg(uIng, e => e.ingresos.alumnos));
  const cuotas = avg(uIng, e => e.ingresos.cuotas_full != null ? e.ingresos.cuotas_full : e.ingresos.cuotas_total);
  const opciones = Array.from({ length: 13 }, (_, i) => mesMas(mesActual, -i));
  return {
    meses_base: uIng.map(e => e.mes), meses_base_costos: uCostos.map(e => e.mes), alumnos, ticket: alumnos ? r0(cuotas / alumnos) : 0,
    otros_ingresos: r0(avg(uIng, e => e.ingresos.plan_full - e.ingresos.cuotas_full)), lineas, costos: COSTOS, gastos: GASTOS,
    desde: mesMas(mesActual, 1), opciones, fuente_costos: /^\d{4}-\d{2}$/.test(opc.costos || '') && opc.costos <= mesActual ? opc.costos : null,
    fuente_ingresos: /^\d{4}-\d{2}$/.test(opc.ingresos || '') && opc.ingresos <= mesActual ? opc.ingresos : null,
  };
}
module.exports = { COSTOS, GASTOS, linea, estadoDelMes, rolling, sensibilidad, baseForecast, mesMas };
