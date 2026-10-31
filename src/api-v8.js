'use strict';
// Versión 8: "Depurar la base" (Ajustes, solo administrador). Eliminar es excepcional: los clientes y las rutinas se inhabilitan en el uso diario.
function registrar(ctx) {
  const { route, ADM, bad, readBody, HttpError } = ctx;
  const { all, get, run, tx } = require('./db');
  const { nowAR, addMeses } = require('./util');
  const { bajaEfectiva } = require('./semaforos');

  const ids = (b) => [...new Set((Array.isArray(b.ids) ? b.ids : []).map(Number).filter(n => Number.isInteger(n) && n > 0))];

  // ---------- Clientes
  function borrarCliente(id) {
    const tablas = all("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'sync_%'").map(t => t.name);
    for (const t of tablas) {
      if (t === 'clientes' || t === 'leads' || t === 'usuarios') continue;
      const cols = all('PRAGMA table_info(' + t + ')').map(c => c.name);
      if (cols.includes('cliente_id')) run('DELETE FROM ' + t + ' WHERE cliente_id = ?', id);
    }
    run("DELETE FROM comentarios WHERE tipo = 'cliente' AND ref_id = ?", id);
    run('UPDATE leads SET cliente_id = NULL WHERE cliente_id = ?', id);
    run('DELETE FROM usuarios WHERE cliente_id = ?', id);
    run('DELETE FROM clientes WHERE id = ?', id);
  }
  route('GET', '/api/depurar/clientes', ADM, () => {
    const hoy = nowAR().fecha;
    return all(`SELECT c.*, (SELECT COUNT(*) FROM pagos p WHERE p.cliente_id = c.id) AS pagos, (SELECT COUNT(*) FROM asistencias a WHERE a.cliente_id = c.id) AS asistencias FROM clientes c ORDER BY c.nombre COLLATE NOCASE`)
      .map(c => { const baja = bajaEfectiva(c); return { id: c.id, nombre: c.nombre, fecha_alta: c.fecha_alta, fecha_baja: baja, activo: baja >= hoy, pagos: c.pagos, asistencias: c.asistencias }; });
  });
  route('POST', '/api/depurar/clientes', ADM, async ({ req }) => {
    const b = await readBody(req), lista = ids(b); if (!lista.length) throw bad('Tildá al menos un cliente');
    const hoy = nowAR().fecha;
    const activos = lista.map(id => get('SELECT * FROM clientes WHERE id = ?', id)).filter(c => c && bajaEfectiva(c) >= hoy);
    if (activos.length && !b.incluir_activos) throw bad('Hay ' + activos.length + ' cliente(s) activo(s) en la selección. Confirmá que querés eliminarlos igual.');
    let n = 0; tx(() => lista.forEach(id => { if (get('SELECT 1 AS x FROM clientes WHERE id = ?', id)) { borrarCliente(id); n++; } }));
    return { ok: true, eliminados: n };
  });

  // ---------- CRM: clientes perdidos
  const limite = (meses) => { const m = Math.max(1, Math.min(120, parseInt(meses, 10) || 12)); return { m, fecha: addMeses(nowAR().fecha, -m) }; };
  const SQL_PERD = "FROM leads WHERE estado = 'descartado' AND COALESCE(perdido_fecha, fecha) <= ?";
  route('GET', '/api/depurar/perdidos', ADM, ({ query }) => {
    const { m, fecha } = limite(query.meses);
    return { meses: m, hasta: fecha, total: get("SELECT COUNT(*) AS n FROM leads WHERE estado = 'descartado'").n, antiguos: get('SELECT COUNT(*) AS n ' + SQL_PERD, fecha).n };
  });
  route('POST', '/api/depurar/perdidos', ADM, async ({ req }) => {
    const b = await readBody(req), { fecha } = limite(b.meses);
    let n = 0;
    tx(() => { const ls = all('SELECT id ' + SQL_PERD, fecha); ls.forEach(l => { run("DELETE FROM comentarios WHERE tipo = 'lead' AND ref_id = ?", l.id); run('DELETE FROM leads WHERE id = ?', l.id); n++; }); });
    return { ok: true, eliminados: n };
  });

  // ---------- Rutinas personalizadas
  route('GET', '/api/depurar/rutinas', ADM, () => all(`SELECT r.id, r.nombre, r.activo, COALESCE(u.nombre, 'Rutinas anteriores (sin profesor)') AS profesor,
    (SELECT COUNT(*) FROM rutina_clientes rc WHERE rc.rutina_id = r.id) AS alumnos FROM rutinas r LEFT JOIN usuarios u ON u.id = r.creador_id ORDER BY r.activo, profesor COLLATE NOCASE, r.nombre COLLATE NOCASE`));
  route('POST', '/api/depurar/rutinas', ADM, async ({ req }) => {
    const b = await readBody(req), lista = ids(b); if (!lista.length) throw bad('Tildá al menos una rutina');
    const act = lista.filter(id => (get('SELECT activo FROM rutinas WHERE id = ?', id) || {}).activo === 1);
    if (act.length && !b.incluir_activas) throw bad('Hay ' + act.length + ' rutina(s) activa(s) en la selección. Confirmá que querés eliminarlas igual.');
    let n = 0;
    tx(() => lista.forEach(id => {
      if (!get('SELECT 1 AS x FROM rutinas WHERE id = ?', id)) return;
      run('DELETE FROM rutina_items WHERE rutina_id = ?', id); run('DELETE FROM rutina_dia WHERE rutina_id = ?', id); run('DELETE FROM rutina_clientes WHERE rutina_id = ?', id); run('DELETE FROM rutinas WHERE id = ?', id); n++;
    }));
    return { ok: true, eliminadas: n };
  });
}
module.exports = { registrar };
