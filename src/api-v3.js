'use strict';
// Rutas de la Versión 3: QR fijo del gimnasio (el alumno registra su propia asistencia con Clase o Rutina),
// personalización del diseño (fondo, letras, color de botones, ícono) y conexión de un gimnasio nuevo con su web.
const crypto = require('node:crypto');
const { all, get, run, getConfig, setConfig } = require('./db');
const { nowAR } = require('./util');

function tokenFijo() {
  let t = getConfig('qr_fijo');
  if (!t && process.env.OMEGA_NODO !== 'nube' && !require('./auth').esperaPrimeraSync()) { t = crypto.randomBytes(9).toString('base64url'); setConfig('qr_fijo', t); }
  return t || null;
}
function igual(a, b) {
  const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || ''));
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
}

function registrar(c) {
  const { route, ADM, STAFF, bad, readBody, str, claseAhora, registrarAsistencia, semaforoAlta, HttpError } = c;
  tokenFijo(); // en la PC se crea al iniciar, así viaja a la nube con la primera sincronización

  // ---------------- QR fijo del gimnasio (para imprimir o armar un banner)
  route('GET', '/api/asistencias/qr-fijo', STAFF, () => {
    const t = tokenFijo();
    if (!t) throw new HttpError(503, 'La app web todavía no recibió los datos de la PC del gimnasio: sincronizá y volvé a intentar');
    return { token: t };
  });
  route('POST', '/api/asistencias/qr-fijo/nuevo', ADM, () => {
    if (process.env.OMEGA_NODO === 'nube') throw new HttpError(403, 'El código se renueva desde la PC del gimnasio');
    const t = crypto.randomBytes(9).toString('base64url'); setConfig('qr_fijo', t);
    return { token: t };
  });

  // ---------------- el alumno escanea el QR fijo
  const validar = (k) => { if (!igual(k, tokenFijo())) throw bad('Este código QR no es el del gimnasio o fue reemplazado. Pedí el código actualizado en recepción.'); };
  const info = (user, ahora) => {
    const hora = claseAhora(ahora);
    const cli = get('SELECT * FROM clientes WHERE id = ?', user.cliente_id);
    if (!cli) throw bad('Tu usuario no tiene ficha de alumno');
    let clase = null;
    if (hora !== null) {
      const ag = get('SELECT f.nombre, f.color FROM agenda a JOIN formatos f ON f.id = a.formato_id WHERE a.dia = ? AND a.hora = ?', ahora.dow, hora);
      const reg = get('SELECT origen FROM asistencias WHERE cliente_id = ? AND fecha = ? AND hora = ?', cli.id, ahora.fecha, hora);
      clase = { hora, formato: ag ? { nombre: ag.nombre, color: ag.color } : null, registrada: !!reg && reg.origen !== 'rutina' };
    }
    return { fecha: ahora.fecha, hora_ahora: ahora.hora, nombre: cli.nombre, clase, plan_vencido: semaforoAlta(cli, ahora.fecha).color !== 'verde' };
  };
  route('GET', '/api/asistir/estado', ['cliente'], ({ query, user }) => { validar(query.k); return info(user, nowAR()); });
  route('POST', '/api/asistir', ['cliente'], async ({ req, user }) => {
    const b = await readBody(req);
    validar(b.k);
    const modo = b.modo === 'rutina' ? 'rutina' : (b.modo === 'clase' ? 'clase' : null);
    if (!modo) throw bad('Elegí Clase o Rutina');
    const ahora = nowAR();
    const i = info(user, ahora);
    const cid = user.cliente_id;
    if (modo === 'clase') {
      if (!i.clase) throw bad('No hay una clase en este horario. Si venís a entrenar por tu cuenta elegí Rutina.');
      const previa = get('SELECT id, origen FROM asistencias WHERE cliente_id = ? AND fecha = ? AND hora = ?', cid, ahora.fecha, i.clase.hora);
      if (previa && previa.origen === 'rutina') { run("UPDATE asistencias SET origen = 'qr' WHERE id = ?", previa.id); return { duplicada: false, hora: i.clase.hora, formato: i.clase.formato, plan_vencido: i.plan_vencido, modo }; }
      const r = registrarAsistencia(cid, ahora.fecha, i.clase.hora, 'qr', null);
      return { duplicada: r.duplicada, hora: i.clase.hora, formato: i.clase.formato, plan_vencido: i.plan_vencido, modo };
    }
    // Rutina: queda registrada la visita (sin ocupar un lugar en la capacidad de ninguna clase)
    const hora = ahora.hora;
    const ya = get('SELECT id FROM asistencias WHERE cliente_id = ? AND fecha = ? AND hora = ?', cid, ahora.fecha, hora);
    if (!ya) registrarAsistencia(cid, ahora.fecha, hora, 'rutina', null);
    return { duplicada: !!ya, hora, plan_vencido: i.plan_vencido, modo };
  });
}

module.exports = { registrar, tokenFijo };
