'use strict';
// Versión 7: descuentos, seguimiento de alumnos, seguimiento mensual de asistencias, seguimiento de visitas (CRM)
// y seguimiento de rutinas personalizadas por profesor.
function registrar(ctx) {
  const { route, ADM, STAFF, TODOS, bad, readBody, str, HttpError } = ctx;
  const { all, get, run, tx } = require('./db');
  const { nowAR, addDays, lunesDe, esFecha, addMeses } = require('./util');
  const { bajaEfectiva } = require('./semaforos');

  const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const dinero = (n) => '$' + Math.round(n).toLocaleString('es-AR');
  const nota = (v, nombre) => { if (v === null || v === '' || v === undefined) return null; const n = parseInt(v, 10); if (!(n >= 1 && n <= 10)) throw bad(nombre + ' debe ser un número del 1 al 10'); return n; };

  route('GET', '/api/profesores', STAFF, () => all("SELECT id, nombre FROM usuarios WHERE rol IN ('admin','profesor') AND activo = 1 ORDER BY nombre COLLATE NOCASE"));

  // ------------------------------------------------------------ descuentos (Ajustes)
  const nombreDesc = (tipo, valor, meses) => (tipo === 'pct' ? valor + '%' : dinero(valor)) + ' por ' + meses + (meses === 1 ? ' mes' : ' meses');
  function leerDesc(b, previo) {
    const tipo = (b.tipo ?? (previo && previo.tipo)) === 'monto' ? 'monto' : 'pct';
    const valor = Number(b.valor ?? (previo && previo.valor));
    const meses = parseInt(b.meses ?? (previo && previo.meses) ?? 1, 10);
    if (!(valor > 0)) throw bad('Indicá el valor del descuento');
    if (tipo === 'pct' && valor > 100) throw bad('El porcentaje no puede superar 100');
    if (!(meses >= 1 && meses <= 12)) throw bad('Los meses van de 1 a 12');
    return { tipo, valor, meses, nombre: str(b.nombre, 60) || nombreDesc(tipo, valor, meses) };
  }
  route('GET', '/api/descuentos', STAFF, ({ query }) => all('SELECT * FROM descuentos ' + (query.todos ? '' : 'WHERE activo = 1 ') + 'ORDER BY tipo, valor, meses'));
  route('POST', '/api/descuentos', ADM, async ({ req }) => {
    const d = leerDesc(await readBody(req));
    const r = run('INSERT INTO descuentos (nombre, tipo, valor, meses, creado) VALUES (?,?,?,?,?)', d.nombre, d.tipo, d.valor, d.meses, new Date().toISOString());
    return get('SELECT * FROM descuentos WHERE id = ?', Number(r.lastInsertRowid));
  });
  route('PUT', '/api/descuentos/:id', ADM, async ({ req, params }) => {
    const x = get('SELECT * FROM descuentos WHERE id = ?', Number(params.id)); if (!x) throw new HttpError(404, 'Descuento no encontrado');
    const b = await readBody(req); const d = leerDesc(b, x);
    run('UPDATE descuentos SET nombre = ?, tipo = ?, valor = ?, meses = ?, activo = ? WHERE id = ?', d.nombre, d.tipo, d.valor, d.meses, b.activo === undefined ? x.activo : (b.activo ? 1 : 0), x.id);
    return get('SELECT * FROM descuentos WHERE id = ?', x.id);
  });
  route('DELETE', '/api/descuentos/:id', ADM, ({ params }) => { run('UPDATE descuentos SET activo = 0 WHERE id = ?', Number(params.id)); return { ok: true }; });

  // ------------------------------------------------------------ seguimiento del alumno
  const lunesActual = () => lunesDe(nowAR().fecha);
  function seguimientoCliente(id) {
    const c = get('SELECT * FROM clientes WHERE id = ?', id); if (!c) throw new HttpError(404, 'Cliente no encontrado');
    const base = "FROM asistencias a LEFT JOIN sesiones s ON s.id = a.sesion_id LEFT JOIN formatos f ON f.id = s.formato_id WHERE a.cliente_id = ? AND a.origen <> 'rutina'";
    const total = get('SELECT COUNT(*) AS n ' + base, id).n;
    const rutinas = get("SELECT COUNT(*) AS n FROM asistencias WHERE cliente_id = ? AND origen = 'rutina'", id).n;
    const porClase = all('SELECT COALESCE(f.nombre, \'Sin formato\') AS clase, f.color, COUNT(*) AS n ' + base + ' GROUP BY clase ORDER BY n DESC, clase LIMIT 6', id);
    const porDia = all("SELECT CAST(strftime('%w', a.fecha) AS INTEGER) AS d, COUNT(*) AS n " + base + ' GROUP BY d ORDER BY n DESC', id).map(r => ({ dia: DIAS[r.d], n: r.n }));
    const porHora = all('SELECT a.hora, COUNT(*) AS n ' + base + ' GROUP BY a.hora ORDER BY n DESC, a.hora LIMIT 5', id);
    const dh = all("SELECT CAST(strftime('%w', a.fecha) AS INTEGER) AS d, a.hora, COUNT(*) AS n " + base + ' GROUP BY d, a.hora ORDER BY n DESC, a.hora LIMIT 5', id).map(r => ({ dia: DIAS[r.d], hora: r.hora, n: r.n }));
    const semanas = all('SELECT s.semana, s.sensacion, s.progreso, u.nombre AS profesor FROM seg_semana s LEFT JOIN usuarios u ON u.id = s.profesor_id WHERE s.cliente_id = ? ORDER BY s.semana DESC LIMIT 12', id);
    const actual = semanas.find(x => x.semana === lunesActual()) || { semana: lunesActual(), sensacion: null, progreso: null };
    const comentarios = all('SELECT id, fecha, texto, autor FROM comentarios WHERE tipo = \'cliente\' AND ref_id = ? ORDER BY fecha DESC, id DESC LIMIT 100', id);
    return { cliente: c.nombre, clases: total, rutinas, por_clase: porClase, por_dia: porDia, por_hora: porHora, dias_horarios: dh, semana_actual: actual, semanas, comentarios };
  }
  route('GET', '/api/clientes/:id/seguimiento', STAFF, ({ params }) => seguimientoCliente(Number(params.id)));
  route('PUT', '/api/clientes/:id/seguimiento', STAFF, async ({ req, params, user }) => {
    const id = Number(params.id); if (!get('SELECT 1 AS x FROM clientes WHERE id = ?', id)) throw new HttpError(404, 'Cliente no encontrado');
    const b = await readBody(req);
    const sem = b.semana && esFecha(String(b.semana)) ? lunesDe(String(b.semana)) : lunesActual();
    const progreso = nota(b.progreso, 'El progreso');
    run('INSERT INTO seg_semana (cliente_id, semana, progreso, profesor_id) VALUES (?,?,?,?) ON CONFLICT(cliente_id, semana) DO UPDATE SET progreso = excluded.progreso, profesor_id = excluded.profesor_id', id, sem, progreso, user.id);
    return seguimientoCliente(id);
  });
  route('POST', '/api/comentarios', STAFF, async ({ req, user }) => {
    const b = await readBody(req);
    const tipo = b.tipo === 'lead' ? 'lead' : 'cliente', ref = Number(b.ref_id);
    if (!get(tipo === 'lead' ? 'SELECT 1 AS x FROM leads WHERE id = ?' : 'SELECT 1 AS x FROM clientes WHERE id = ?', ref)) throw new HttpError(404, 'No se encontró a quién comentar');
    const texto = str(b.texto, 1000); if (!texto) throw bad('Escribí el comentario');
    const fecha = b.fecha && esFecha(String(b.fecha)) ? String(b.fecha) : nowAR().fecha;
    run('INSERT INTO comentarios (tipo, ref_id, fecha, texto, autor_id, autor, creado) VALUES (?,?,?,?,?,?,?)', tipo, ref, fecha, texto, user.id, user.nombre || user.username, new Date().toISOString());
    return { ok: true };
  });
  route('DELETE', '/api/comentarios/:id', STAFF, ({ params }) => { run('DELETE FROM comentarios WHERE id = ?', Number(params.id)); return { ok: true }; });
  // El alumno califica cómo se siente en el gimnasio esta semana
  route('GET', '/api/mi/sensacion', TODOS, ({ user }) => {
    if (user.rol !== 'cliente') return { semana: lunesActual(), sensacion: null };
    const r = get('SELECT sensacion FROM seg_semana WHERE cliente_id = ? AND semana = ?', user.cliente_id, lunesActual());
    return { semana: lunesActual(), sensacion: r ? r.sensacion : null };
  });
  route('PUT', '/api/mi/sensacion', TODOS, async ({ req, user }) => {
    if (user.rol !== 'cliente' || !user.cliente_id) throw bad('Solo los alumnos califican su semana');
    const v = nota((await readBody(req)).sensacion, 'La calificación'); if (v === null) throw bad('Elegí un número del 1 al 10');
    run('INSERT INTO seg_semana (cliente_id, semana, sensacion) VALUES (?,?,?) ON CONFLICT(cliente_id, semana) DO UPDATE SET sensacion = excluded.sensacion', user.cliente_id, lunesActual(), v);
    return { semana: lunesActual(), sensacion: v };
  });

  // ------------------------------------------------------------ asistencias: seguimiento mensual
  const mesMas = (m, n) => { const [y, mm] = m.split('-').map(Number); return new Date(Date.UTC(y, mm - 1 + n, 1)).toISOString().slice(0, 7); };
  // Alumnos cuyo plan venció en el mes y no renovaron (ni dentro de los 7 días siguientes). Si todavía no pasó el margen, no se cuenta.
  function noRenovaron(mes, hoy) {
    const filas = all(`SELECT p.cliente_id, c.nombre, MAX(p.cubre_hasta) AS hasta FROM pagos p JOIN clientes c ON c.id = p.cliente_id
      WHERE p.cubre_hasta IS NOT NULL AND substr(p.cubre_hasta,1,7) = ? GROUP BY p.cliente_id`, mes);
    const lista = [], renovaron = [];
    for (const f of filas) {
      if (addDays(f.hasta, 7) >= hoy) continue;
      const sigue = get('SELECT 1 AS x FROM pagos WHERE cliente_id = ? AND cubre_hasta > ? AND fecha <= ?', f.cliente_id, f.hasta, addDays(f.hasta, 7));
      (sigue ? renovaron : lista).push({ id: f.cliente_id, nombre: f.nombre, vencio: f.hasta });
    }
    return { no_renovaron: lista, renovaron: renovaron.length, renovaron_lista: renovaron, vencimientos: lista.length + renovaron.length };
  }
  route('GET', '/api/asistencias/seguimiento', STAFF, ({ query }) => {
    const hoy = nowAR().fecha, hoyMes = hoy.slice(0, 7);
    let mes = /^\d{4}-\d{2}$/.test(query.mes || '') ? query.mes : hoyMes; if (mes > hoyMes) mes = hoyMes;
    const rango = [mes + '-01', mes + '-31'];
    const base = "FROM asistencias a LEFT JOIN sesiones s ON s.id = a.sesion_id LEFT JOIN formatos f ON f.id = s.formato_id WHERE a.origen <> 'rutina' AND a.fecha BETWEEN ? AND ?";
    const total = get('SELECT COUNT(*) AS n ' + base, ...rango).n;
    const clases = all("SELECT COALESCE(f.nombre, 'Sin formato') AS clase, f.color, COUNT(*) AS asistencias, COUNT(DISTINCT a.fecha || '-' || a.hora) AS clases_dadas " + base + ' GROUP BY clase ORDER BY asistencias DESC', ...rango)
      .map(r => ({ ...r, promedio: r.clases_dadas ? Math.round(10 * r.asistencias / r.clases_dadas) / 10 : 0 }));
    const horarios = all('SELECT a.hora, COUNT(*) AS asistencias, COUNT(DISTINCT a.fecha) AS dias ' + base + ' GROUP BY a.hora ORDER BY asistencias DESC, a.hora', ...rango)
      .map(r => ({ ...r, promedio: r.dias ? Math.round(10 * r.asistencias / r.dias) / 10 : 0 }));
    const profesores = all("SELECT COALESCE(u.nombre, 'Sin profesor asignado') AS profesor, COUNT(*) AS asistencias, COUNT(DISTINCT a.fecha || '-' || a.hora) AS clases " + base.replace('LEFT JOIN formatos f ON f.id = s.formato_id', 'LEFT JOIN formatos f ON f.id = s.formato_id LEFT JOIN usuarios u ON u.id = s.profesor_id') + ' GROUP BY profesor ORDER BY asistencias DESC', ...rango);
    const act = noRenovaron(mes, hoy), ant = noRenovaron(mesMas(mes, -1), hoy);
    const previos = [1, 2, 3].map(i => noRenovaron(mesMas(mes, -i), hoy).no_renovaron.length);
    const prom3 = Math.round(10 * previos.reduce((a, b) => a + b, 0) / 3) / 10;
    const n = act.no_renovaron.length;
    return {
      mes, asistencias: total, clases, horarios, profesores,
      renovacion: { no_renovaron: n, lista: act.no_renovaron, renovaron_lista: act.renovaron_lista, lista_mes_anterior: ant.no_renovaron, renovaron: act.renovaron, vencimientos: act.vencimientos,
        mes_anterior: { mes: mesMas(mes, -1), n: ant.no_renovaron.length, dif: n - ant.no_renovaron.length },
        promedio_3_meses: { n: prom3, dif: Math.round(10 * (n - prom3)) / 10 } },
    };
  });

  // ------------------------------------------------------------ CRM: seguimiento de visitas
  function filaLead(l) {
    return { ...l, comentarios: all("SELECT id, fecha, texto, autor FROM comentarios WHERE tipo = 'lead' AND ref_id = ? ORDER BY fecha DESC, id DESC", l.id) };
  }
  const SQL_LEAD = `SELECT l.id, l.nombre, l.telefono, l.redes, l.objetivo, l.profesor_id, l.fecha, l.estado, l.nota, l.perdido_fecha, l.motivo_perdido, u.nombre AS profesor
    FROM leads l LEFT JOIN usuarios u ON u.id = l.profesor_id`;
  const sinPago = "l.estado = 'visita' AND l.cliente_id IS NULL";
  route('GET', '/api/crm/seguimiento', STAFF, ({ query, user }) => {
    const solo = query.profesor_id ? Number(query.profesor_id) : 0;
    const en = all(SQL_LEAD + ' WHERE ' + sinPago + ' AND (? = 0 OR l.profesor_id = ?) ORDER BY l.fecha DESC, l.id DESC', solo, solo).map(filaLead);
    const perdidos = all(SQL_LEAD + " WHERE l.estado = 'descartado' AND (? = 0 OR l.profesor_id = ?) ORDER BY COALESCE(l.perdido_fecha, l.fecha) DESC, l.id DESC LIMIT 300", solo, solo).map(filaLead);
    const profesores = all("SELECT id, nombre FROM usuarios WHERE rol IN ('admin','profesor') AND activo = 1 ORDER BY nombre COLLATE NOCASE");
    return { en_seguimiento: en, perdidos, profesores };
  });
  route('PUT', '/api/leads/:id/perdido', STAFF, async ({ req, params }) => {
    const l = get('SELECT * FROM leads WHERE id = ?', Number(params.id)); if (!l) throw new HttpError(404, 'Visita no encontrada');
    const b = await readBody(req);
    run("UPDATE leads SET estado = 'descartado', perdido_fecha = ?, motivo_perdido = ? WHERE id = ?", nowAR().fecha, str(b.motivo, 200) || null, l.id);
    return { ok: true };
  });
  route('PUT', '/api/leads/:id/reabrir', STAFF, ({ params }) => {
    const l = get('SELECT * FROM leads WHERE id = ?', Number(params.id)); if (!l) throw new HttpError(404, 'Visita no encontrada');
    run("UPDATE leads SET estado = 'visita', perdido_fecha = NULL, motivo_perdido = NULL WHERE id = ?", l.id);
    return { ok: true };
  });

  // ------------------------------------------------------------ perfil del profesor: sus seguimientos
  route('GET', '/api/mis-seguimientos', STAFF, ({ query, user }) => {
    const pid = user.rol === 'admin' && query.profesor_id ? Number(query.profesor_id) : user.id;
    const leads = all(SQL_LEAD + ' WHERE ' + sinPago + ' AND l.profesor_id = ? ORDER BY l.fecha DESC', pid).map(filaLead).map(l => ({ ...l, ultimo_comentario: l.comentarios[0] || null }));
    const rutinas = all(`SELECT rc.id, rc.cliente_id, rc.dias, rc.creado, c.nombre AS cliente, r.nombre AS rutina FROM rutina_clientes rc
      JOIN rutinas r ON r.id = rc.rutina_id AND r.activo = 1 JOIN clientes c ON c.id = rc.cliente_id WHERE rc.profesor_id = ? ORDER BY c.nombre COLLATE NOCASE`, pid).map(x => {
      const desde = (x.creado || '').slice(0, 10) || '2000-01-01';
      const ent = get('SELECT COUNT(*) AS n FROM asistencias WHERE cliente_id = ? AND fecha >= ?', x.cliente_id, desde).n;
      const rut = get("SELECT COUNT(*) AS n FROM asistencias WHERE cliente_id = ? AND fecha >= ? AND origen = 'rutina'", x.cliente_id, desde).n;
      const ult = get('SELECT MAX(fecha) AS f FROM asistencias WHERE cliente_id = ?', x.cliente_id).f;
      return { id: x.id, cliente_id: x.cliente_id, cliente: x.cliente, rutina: x.rutina, desde, entrenos: ent, rutinas_realizadas: rut, ultima_asistencia: ult };
    });
    return { profesor_id: pid, leads, rutinas };
  });
}
module.exports = { registrar };
