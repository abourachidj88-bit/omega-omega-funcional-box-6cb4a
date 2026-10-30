'use strict';
// Prueba el backend empaquetado en Node usando sql.js (asm) como base de datos
const { empaquetar } = require('./bundle-backend');
const crypto = require('node:crypto');
const code = empaquetar();
(async () => {
  const sha = require('/tmp/sqljs/node_modules/sql.js/dist/sql-asm.js');
  const SQL = await sha();
  globalThis.__OMEGA_SQL = SQL; globalThis.__OMEGA_DBBYTES = null;
  const be = (new Function(code + '; return OMEGA_BACKEND;'))()();
  const c = be.require('shim/crypto.js');
  console.log('sha256 ok:', Buffer.from(c.sha256(Buffer.from('abc'))).toString('hex') === crypto.createHash('sha256').update('abc').digest('hex'));
  console.log('hmac ok:', c.createHmac('sha256', 'k').update('msg').digest('base64url') === crypto.createHmac('sha256', 'k').update('msg').digest('base64url'));
  let t = Date.now();
  const { cargarDemo } = be.require('src/demo-data.js');
  console.log(cargarDemo()); console.log('demo seed ms:', Date.now() - t);
  const api = be.require('src/api.js');
  const call = async (method, p, body, token) => api.dispatch({ method, headers: token ? { authorization: 'Bearer ' + token } : {}, readJson: async () => body || {} }, p.split('?')[0], Object.fromEntries(new URLSearchParams(p.split('?')[1] || '')));
  t = Date.now();
  const r = await call('POST', '/api/login', { username: 'admin', password: 'omega2026' });
  console.log('login', r.status, Date.now() - t, 'ms');
  const tk = r.body.token;
  for (const p of ['/api/clientes', '/api/dashboard', '/api/finanzas', '/api/planificacion?desde=2026-10-19', '/api/ejercicios']) {
    t = Date.now(); const x = await call('GET', p, null, tk); console.log(p, x.status, Date.now() - t, 'ms', Array.isArray(x.body) ? x.body.length : Object.keys(x.body).length);
  }
  const q = await call('POST', '/api/login', { username: 'ana.garcia', password: 'ana2026' });
  const qr = await call('GET', '/api/mi-qr', null, q.body.token); console.log('qr', qr.status, qr.body.codigo);
  const bad = await call('POST', '/api/login', { username: 'admin', password: 'x' }); console.log('bad login', bad.status);
  const bk = await call('POST', '/api/backups/ahora', {}, tk); console.log('backup', bk.status, bk.body);
})().catch(e => { console.error(e); process.exit(1); });
