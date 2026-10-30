'use strict';
const crypto = require('node:crypto');
const { get, run, getConfig, setConfig } = require('./db');

// Clave secreta de firma: se genera una vez y queda guardada en la base de datos de la app.
function secreto() {
  let s = process.env.OMEGA_SECRET || getConfig('secreto');
  if (!s) { s = crypto.randomBytes(48).toString('hex'); setConfig('secreto', s); }
  return s;
}
const SECRET = secreto();

function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const h = crypto.scryptSync(pw, salt, 64);
  return 's1$' + salt.toString('hex') + '$' + h.toString('hex');
}
function verifyPassword(pw, stored) {
  try {
    const [v, saltHex, hashHex] = stored.split('$');
    if (v !== 's1') return false;
    const h = crypto.scryptSync(pw, Buffer.from(saltHex, 'hex'), 64);
    return crypto.timingSafeEqual(h, Buffer.from(hashHex, 'hex'));
  } catch (_) { return false; }
}

const b64 = (b) => Buffer.from(b).toString('base64url');
function firmar(payload) {
  const body = b64(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  return body + '.' + sig;
}
function verificar(token) {
  if (!token || typeof token !== 'string') return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const esperada = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  const a = Buffer.from(sig), b = Buffer.from(esperada);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (p.exp && Date.now() > p.exp) return null;
    return p;
  } catch (_) { return null; }
}

function emitirSesion(u) {
  return firmar({ uid: u.id, rol: u.rol, exp: Date.now() + 30 * 24 * 3600 * 1000 });
}
function usuarioDeToken(token) {
  const p = verificar(token);
  if (!p || !p.uid) return null;
  const u = get('SELECT id, username, rol, nombre, cliente_id, activo, permisos FROM usuarios WHERE id = ?', p.uid);
  return u && u.activo ? u : null;
}

// El QR del alumno se firma con una clave propia que viaja con la sincronización: así el QR generado en la app
// web (nube) lo valida la PC del gimnasio y viceversa. La nube no inventa la clave: espera a recibirla de la PC.
// Una PC nueva conectada a la nube NO inventa su clave antes de sincronizar por primera vez: así adopta la que ya usa el gimnasio
// (si no, los QR de los alumnos generados en la web no los reconocería esta PC y el escaneo parecería "no sincronizar").
function esperaPrimeraSync() { return !!require('./sync').configuracion().url && !getConfig('sync_ultimo'); }
function secretoQR(forzar) {
  let s = getConfig('secreto_qr');
  if (!s && process.env.OMEGA_NODO !== 'nube' && (forzar || !esperaPrimeraSync())) { s = crypto.randomBytes(32).toString('hex'); setConfig('secreto_qr', s); }
  return s || null;
}
secretoQR(); // en la PC se crea al iniciar (si ya sincronizó o no usa la nube), así viaja a la nube con la primera sincronización
// QR del alumno: código rotativo que vence en 90 s (evita capturas de pantalla compartidas)
function emitirQR(clienteId) {
  const SECRET = secretoQR();
  if (!SECRET) { const e = new Error('Todavía no se sincronizó con la aplicación web: sincronizá y volvé a intentar'); e.status = 503; throw e; }
  const exp = Math.floor(Date.now() / 1000) + 90;
  const base = 'OMEGA|' + clienteId + '|' + exp;
  const sig = crypto.createHmac('sha256', SECRET).update(base).digest('base64url').slice(0, 16);
  return base + '|' + sig;
}
function validarQR(codigo) {
  const partes = String(codigo || '').trim().split('|');
  if (partes.length !== 4 || partes[0] !== 'OMEGA') return { ok: false, error: 'Código QR no válido' };
  const base = partes.slice(0, 3).join('|');
  const SECRET = secretoQR();
  if (!SECRET) return { ok: false, error: 'Código QR no válido' };
  const sig = crypto.createHmac('sha256', SECRET).update(base).digest('base64url').slice(0, 16);
  if (sig !== partes[3]) return { ok: false, error: 'Código QR no válido' };
  if (Math.floor(Date.now() / 1000) > Number(partes[2])) return { ok: false, error: 'El QR venció: pedile al alumno que lo actualice en su app' };
  return { ok: true, cliente_id: Number(partes[1]) };
}

module.exports = { hashPassword, verifyPassword, emitirSesion, usuarioDeToken, emitirQR, validarQR, esperaPrimeraSync, secretoQR };
