'use strict';
// Permisos por usuario. El administrador lo puede todo. Cada profesor tiene su lista de permisos (se tildan de a uno,
// se copian de otro usuario o se parte del perfil "Profesor estándar"). Los módulos Usuarios y Ajustes son solo del administrador.

// Árbol por módulo: [clave, texto, ayuda]
const ARBOL = [
  { id: 'inicio', nombre: 'Inicio', items: [
    ['inicio.ver', 'Ver el panel de inicio', 'Indicadores, alumnos en riesgo y avisos'],
  ] },
  { id: 'asist', nombre: 'Asistencias', items: [
    ['asist.ver', 'Ver asistencias', 'Listado y reservas del día'],
    ['asist.registrar', 'Registrar asistencias', 'Carga manual y escáner de QR'],
    ['asist.borrar', 'Eliminar asistencias', 'Corregir una asistencia cargada por error'],
  ] },
  { id: 'cli', nombre: 'Clientes', items: [
    ['cli.ver', 'Ver clientes y su ficha', 'Semáforos, historial y rutinas'],
    ['cli.editar', 'Crear y editar clientes', 'Altas, datos, accesos al celular, importación'],
    ['cli.renovar', 'Renovar planes y registrar pagos', ''],
    ['cli.deshacer_pago', 'Deshacer pagos', ''],
    ['cli.eliminar', 'Eliminar clientes', ''],
  ] },
  { id: 'crm', nombre: 'CRM (visitas)', items: [
    ['crm.ver', 'Ver visitas y consultas', ''],
    ['crm.gestionar', 'Cargar y editar visitas, pasarlas a clientes', ''],
    ['crm.eliminar', 'Eliminar visitas', ''],
  ] },
  { id: 'plan', nombre: 'Planificación', items: [
    ['plan.semana', 'Ver la semana de clases', ''],
    ['plan.generar', 'Generar, eliminar y editar la semana', 'Generar con IA, armar a mano, eliminar semana, cambiar ejercicios'],
    ['plan.staff', 'Ver la agenda del staff', ''],
    ['plan.staff_editar', 'Asignar profesores a los turnos', ''],
    ['plan.rutinas', 'Ver rutinas', ''],
    ['plan.rutinas_editar', 'Crear, editar y asignar rutinas', ''],
    ['plan.biblioteca', 'Ver la biblioteca de ejercicios', ''],
    ['plan.biblioteca_editar', 'Cargar, editar y borrar ejercicios', ''],
    ['plan.config', 'Configurar formatos, agenda y equipamiento', 'Intervalos, intensidad mínima, horarios, equipos'],
  ] },
  { id: 'fin', nombre: 'Finanzas', items: [
    ['fin.caja', 'Ver la caja diaria', ''],
    ['fin.saldo', 'Caja: fijar el saldo inicial', ''],
    ['fin.ingresos', 'Caja: registrar ingresos', ''],
    ['fin.egresos', 'Caja: registrar egresos', ''],
    ['fin.caja_borrar', 'Caja: quitar movimientos cargados', ''],
    ['fin.analisis', 'Análisis del mes y precios de los planes', 'Incluye cargar egresos e ingresos del mes'],
    ['fin.resultados', 'Estado de resultados', ''],
    ['fin.presupuesto', 'Presupuesto 12 meses', ''],
  ] },
];
const TODAS = ARBOL.flatMap(m => m.items.map(i => i[0]));
// Profesor estándar: todas las tareas operativas, y en Finanzas solamente la caja (ver, saldo inicial, ingresos y egresos)
const ESTANDAR = TODAS.filter(k => !['fin.caja_borrar', 'fin.analisis', 'fin.resultados', 'fin.presupuesto'].includes(k));

// Qué permiso exige cada ruta del servidor (la primera que coincide). Lo que no figura acá sigue sus reglas por rol.
const REGLAS = [
  ['GET', '/api/dashboard', 'inicio.ver'], ['GET', '/api/notificaciones', 'inicio.ver'],
  ['GET', '/api/asistencias', 'asist.ver'], ['GET', '/api/asistencias/qr-fijo', 'asist.ver'], ['POST', '/api/asistencias/qr', 'asist.registrar'], ['POST', '/api/asistencias', 'asist.registrar'], ['DELETE', '/api/asistencias/:x', 'asist.borrar'],
  ['GET', '/api/clientes', 'cli.ver'], ['GET', '/api/clientes/:x', 'cli.ver'],
  ['POST', '/api/clientes/importar', 'cli.editar'], ['POST', '/api/clientes', 'cli.editar'], ['PUT', '/api/clientes/:x', 'cli.editar'], ['POST', '/api/clientes/:x/acceso', 'cli.editar'],
  ['POST', '/api/clientes/:x/renovar', 'cli.renovar'], ['POST', '/api/pagos/:x/anular', 'cli.deshacer_pago'], ['DELETE', '/api/clientes/:x', 'cli.eliminar'],
  ['GET', '/api/leads', 'crm.ver'], ['POST', '/api/leads', 'crm.gestionar'], ['PUT', '/api/leads/:x', 'crm.gestionar'], ['POST', '/api/leads/:x/vincular', 'crm.gestionar'], ['DELETE', '/api/leads/:x', 'crm.eliminar'],
  ['GET', '/api/planificacion', 'plan.semana'], ['GET', '/api/planificacion/circuito/:x', 'plan.semana'], ['GET', '/api/planificacion/circuito/:x/sugerencias', 'plan.semana'],
  ['POST', '/api/planificacion/generar', 'plan.generar'], ['POST', '/api/planificacion/eliminar', 'plan.generar'], ['POST', '/api/planificacion/circuito/:x/regenerar', 'plan.generar'],
  ['PUT', '/api/planificacion/circuito/:x/slot', 'plan.generar'], ['PUT', '/api/planificacion/modo', 'plan.generar'],
  ['PUT', '/api/staff/agenda', 'plan.staff_editar'], ['PUT', '/api/staff/sesion', 'plan.staff_editar'],
  ['POST', '/api/rutinas/asignar', 'plan.rutinas_editar'], ['DELETE', '/api/rutinas/asignaciones/:x', 'plan.rutinas_editar'], ['PUT', '/api/rutinas-dia', 'plan.rutinas_editar'],
  ['POST', '/api/rutinas', 'plan.rutinas_editar'], ['PUT', '/api/rutinas/:x', 'plan.rutinas_editar'], ['DELETE', '/api/rutinas/:x', 'plan.rutinas_editar'],
  ['POST', '/api/ejercicios', 'plan.biblioteca_editar'], ['PUT', '/api/ejercicios/:x', 'plan.biblioteca_editar'], ['DELETE', '/api/ejercicios/:x', 'plan.biblioteca_editar'],
  ['PUT', '/api/formatos', 'plan.config'], ['DELETE', '/api/formatos/:x', 'plan.config'], ['PUT', '/api/agenda', 'plan.config'], ['POST', '/api/equipamiento', 'plan.config'], ['PUT', '/api/equipamiento', 'plan.config'],
  ['PUT', '/api/equipamiento/:x', 'plan.config'], ['POST', '/api/equipamiento/:x/sugerir', 'plan.config'], ['POST', '/api/sugerencias/aceptar-todas', 'plan.config'], ['POST', '/api/sugerencias/:x/aceptar', 'plan.config'], ['DELETE', '/api/sugerencias/:x', 'plan.config'],
  ['GET', '/api/caja', 'fin.caja'], ['PUT', '/api/caja/saldo-inicial', 'fin.saldo'], ['POST', '/api/caja/movimiento', 'fin.ingresos|fin.egresos'], ['DELETE', '/api/caja/movimiento/:x', 'fin.caja_borrar'],
  ['GET', '/api/finanzas', 'fin.analisis'], ['POST', '/api/finanzas', 'fin.analisis'], ['DELETE', '/api/finanzas/:x', 'fin.analisis'], ['POST', '/api/finanzas/replicar', 'fin.analisis'], ['GET', '/api/finanzas/analisis', 'fin.analisis'],
  ['GET', '/api/planes', 'cli.renovar|cli.editar|cli.ver|fin.analisis'], ['POST', '/api/planes', 'fin.analisis'], ['PUT', '/api/planes/:x', 'fin.analisis'], ['DELETE', '/api/planes/:x', 'fin.analisis'],
  ['GET', '/api/finanzas/estado-resultados', 'fin.resultados'],
  ['GET', '/api/finanzas/forecast', 'fin.presupuesto'], ['PUT', '/api/finanzas/forecast', 'fin.presupuesto'], ['GET', '/api/finanzas/base-proyeccion', 'fin.presupuesto'],
].map(([m, p, k]) => ({ m, rx: new RegExp('^' + p.replace(/:x/g, '[^/]+') + '$'), k }));

function requerido(metodo, ruta) {
  const r = REGLAS.find(x => x.m === metodo && x.rx.test(ruta));
  return r ? r.k : null;
}
function limpiar(lista) {
  const ok = new Set(TODAS);
  return [...new Set((Array.isArray(lista) ? lista : []).filter(k => ok.has(k)))];
}
// Permisos efectivos de un usuario (fila de la base o sesión). El administrador tiene todos.
function deUsuario(u) {
  if (!u) return [];
  if (u.rol === 'admin') return TODAS.slice();
  if (u.rol !== 'profesor') return [];
  if (u.permisos === null || u.permisos === undefined || u.permisos === '') return ESTANDAR.slice();
  if (Array.isArray(u.permisos)) return limpiar(u.permisos);
  try { return limpiar(JSON.parse(u.permisos)); } catch (_) { return ESTANDAR.slice(); }
}
function tiene(u, clave) {
  if (!u) return false;
  if (u.rol === 'admin') return true;
  const lista = deUsuario(u);
  return String(clave).split('|').some(k => lista.includes(k));
}

module.exports = { ARBOL, TODAS, ESTANDAR, requerido, limpiar, deUsuario, tiene };
