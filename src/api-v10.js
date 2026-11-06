'use strict';
// Versión 10: seguridad (recuperar clave), frecuencias semanales, Hark Pro (aprendizaje y WhatsApp), equipamiento.
function registrar(ctx) {
  const { route, ADM, STAFF, PUB, HttpError, bad, readBody, str } = ctx;
  const { get, run, getConfig, setConfig } = require('./db');
  const { hashPassword, verifyPassword } = require('./auth');
  const seg = require('./seguridad');

  // ---------- Seguridad: preguntas de recuperación ----------
  const leerPreg = () => { try { const j = JSON.parse(getConfig('seguridad_preguntas') || '[]'); return Array.isArray(j) ? j : []; } catch (_) { return []; } };
  const fallos = () => { try { return JSON.parse(getConfig('sync_seg_fallos') || '{}') || {}; } catch (_) { return {}; } };
  const bloqueado = () => { const f = fallos(); return f.hasta && Date.now() < f.hasta ? Math.ceil((f.hasta - Date.now()) / 60000) : 0; };
  function falla() {
    const f = fallos(); const n = (f.hasta && Date.now() >= f.hasta ? 0 : (f.n || 0)) + 1;
    setConfig('sync_seg_fallos', JSON.stringify(n >= seg.MAX_FALLOS ? { n: 0, hasta: Date.now() + seg.BLOQUEO_MIN * 60000 } : { n }));
  }

  route('GET', '/api/seguridad', ADM, () => {
    const g = leerPreg();
    return { catalogo: seg.CATALOGO, configurada: g.length === 3, elegidas: g.map(x => x.id) };
  });
  route('PUT', '/api/seguridad', ADM, async ({ req, user }) => {
    const b = await readBody(req);
    const u = get('SELECT * FROM usuarios WHERE id = ?', user.id);
    if (!verifyPassword(String(b.clave_actual || ''), u.password_hash)) throw bad('La contraseña actual no es correcta');
    const r = seg.armar(b.preguntas);
    if (r.error) throw bad(r.error);
    setConfig('seguridad_preguntas', JSON.stringify(r.guardar));
    setConfig('sync_seg_fallos', '{}');
    return { ok: true, configurada: true };
  });
  route('GET', '/api/recuperar/preguntas', PUB, () => {
    const g = leerPreg();
    const min = bloqueado();
    if (g.length !== 3) return { configurada: false, preguntas: [] };
    return { configurada: true, bloqueado_min: min, preguntas: min ? [] : seg.publicas(g) };
  });
  route('POST', '/api/recuperar/reset', PUB, async ({ req }) => {
    const b = await readBody(req);
    const g = leerPreg();
    if (g.length !== 3) throw bad('Todavía no hay preguntas de seguridad configuradas. Un administrador debe cargarlas en Ajustes → Seguridad.');
    const min = bloqueado();
    if (min) throw new HttpError(429, 'Demasiados intentos fallidos. Probá de nuevo en ' + min + ' minutos.');
    const nueva = String(b.nueva || '');
    if (nueva.length < 8) throw bad('La nueva contraseña debe tener al menos 8 caracteres');
    const u = get("SELECT * FROM usuarios WHERE username = ? AND rol = 'admin' AND activo = 1", str(b.username, 60));
    const ok = seg.comprobar(g, b.respuestas);
    if (!u || !ok) { falla(); throw new HttpError(401, 'Los datos no coinciden. Revisá el usuario y las 3 respuestas.'); }
    run('UPDATE usuarios SET password_hash = ? WHERE id = ?', hashPassword(nueva), u.id);
    setConfig('sync_seg_fallos', '{}');
    return { ok: true };
  });

  // ---------- Hark Pro (solo administrador; todo empieza apagado) ----------
  const hark = require('./hark');
  const crypto = require('node:crypto');
  route('GET', '/api/hark', ADM, () => ({ plan: hark.resumenPlan(), wa: hark.estadoWA(), seg: hark.estadoSeg(), escritorio_token: !!process.env.OMEGA_HOME }));
  route('PUT', '/api/hark/plan', ADM, async ({ req }) => {
    const b = await readBody(req);
    try { return hark.configurarPlan({ activo: !!b.activo, desde: b.desde, hasta: b.hasta }); } catch (e) { throw bad(e.message); }
  });
  route('DELETE', '/api/hark/plan/datos', ADM, () => { hark.borrarPlan(); return { ok: true }; });
  route('PUT', '/api/hark/wa', ADM, async ({ req, user }) => {
    const b = await readBody(req);
    try { hark.configurarWA({ activo: !!b.activo, consentimiento: !!b.consentimiento }, user.nombre || user.username); } catch (e) { throw bad(e.message); }
    return hark.estadoWA();
  });
  route('DELETE', '/api/hark/wa/datos', ADM, () => { hark.borrarWA(); return { ok: true }; });
  route('POST', '/api/clientes/:id/hark-importar', STAFF, ({ params }) => {
    const id = Number(params.id); if (!get('SELECT 1 AS x FROM clientes WHERE id = ?', id)) throw new HttpError(404, 'Alumno inexistente');
    return hark.importarCliente(id);
  });
  route('POST', '/api/hark/wa/resumir', ADM, () => ({ ...hark.procesarResumenes({ forzar: true }), estado: hark.estadoWA() }));
  route('PUT', '/api/hark/seg', ADM, async ({ req }) => hark.configurarSeg(await readBody(req)));
  // Lo envía la ventana de WhatsApp Web de OMEGA de escritorio (solo desde esta misma PC y con la clave local)
  route('POST', '/api/hark/wa/captura', PUB, async ({ req }) => {
    const ip = (req.socket && req.socket.remoteAddress) || '';
    if (!/^(127\.0\.0\.1|::1|::ffff:127\.0\.0\.1)$/.test(ip)) throw new HttpError(403, 'Solo desde la PC del gimnasio');
    const t = String(req.headers['x-hark-token'] || ''), real = hark.tokenCaptura();
    const a = Buffer.from(t), b = Buffer.from(real);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new HttpError(401, 'Clave de captura inválida');
    if (!hark.leerWA().activo) throw new HttpError(403, 'La lectura de WhatsApp está apagada');
    const body = await readBody(req);
    return { nuevos: hark.guardarMensajes(Array.isArray(body.mensajes) ? body.mensajes : []) };
  });
  if (process.env.OMEGA_NODO !== 'nube') {
    const suelto = (t) => { if (t && typeof t.unref === 'function') t.unref(); return t; };
    suelto(setTimeout(() => { try { if (hark.leerWA().activo) hark.escribirTokenArchivo(); } catch (_) {} }, 3000));
    suelto(setInterval(() => { try { if (hark.leerWA().activo) hark.procesarResumenes(); } catch (_) {} }, 5 * 60 * 1000));
  }
}
module.exports = { registrar };
