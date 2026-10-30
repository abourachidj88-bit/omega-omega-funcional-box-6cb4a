'use strict';
// Empaqueta el backend (src/*.js) para que corra en el navegador: devuelve el código de OMEGA_BACKEND(SQL, bytes)
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.join(__dirname, '..');
const leer = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

function empaquetar() {
  const modulos = {
    'src/db.js': leer('src/db.js'), 'src/auth.js': leer('src/auth.js'), 'src/util.js': leer('src/util.js'),
    'src/semaforos.js': leer('src/semaforos.js'), 'src/planner.js': leer('src/planner.js'), 'src/seed-ejercicios.js': leer('src/seed-ejercicios.js'),
    'src/api.js': leer('src/api.js'), 'src/api-v1.js': leer('src/api-v1.js'), 'src/sync.js': leer('src/sync.js'), 'src/migraciones.js': leer('src/migraciones.js'), 'src/seed-ejercicios-v1.js': leer('src/seed-ejercicios-v1.js'), 'src/api-v2.js': leer('src/api-v2.js'), 'src/api-v3.js': leer('src/api-v3.js'), 'src/api-v4.js': leer('src/api-v4.js'), 'src/alta-nube.js': leer('src/alta-nube.js'), 'src/nube-conexion.js': leer('src/nube-conexion.js'), 'src/permisos.js': leer('src/permisos.js'), 'src/estado-resultados.js': leer('src/estado-resultados.js'), 'src/telefono.js': leer('src/telefono.js'), 'src/seed-ejercicios-v2.js': leer('src/seed-ejercicios-v2.js'), 'src/version.js': leer('src/version.js'), 'src/demo-data.js': leer('src/demo-data.js'),
    'src/backup.js': leer('demo/backup-demo.js'),
    'shim/buffer.js': leer('demo/buffer.js'), 'shim/crypto.js': leer('demo/crypto.js'), 'shim/sqlite.js': leer('demo/sqlite.js'), 'shim/misc.js': leer('demo/misc.js'),
  };
  // los shims se llaman entre sí con ./buffer
  modulos['src/db.js'] = modulos['src/db.js'];
  let out = 'function OMEGA_BACKEND(){\n"use strict";\nconst process = { env: {} };\nconst __defs = {};\nconst __cache = {};\n';
  for (const [n, src] of Object.entries(modulos)) {
    out += '__defs[' + JSON.stringify(n) + '] = function(module, exports, require, process, Buffer, __dirname){\n' + src + '\n};\n';
  }
  out += `
function __norm(p){ const o=[]; for (const s of p.split('/')) { if (s==='..') o.pop(); else if (s!=='.' && s!=='') o.push(s); } return o.join('/'); }
function __req(from, spec){
  if (spec === 'node:crypto') return __load('shim/crypto.js');
  if (spec === 'node:sqlite') return __load('shim/sqlite.js');
  if (spec === 'node:path') return __load('shim/misc.js').path;
  if (spec === 'node:fs') return __load('shim/misc.js').fs;
  if (spec === './buffer') return __load('shim/buffer.js');
  const dir = from.split('/').slice(0,-1).join('/');
  let n = __norm(dir + '/' + spec); if (!/\\.js$/.test(n)) n += '.js';
  return __load(n);
}
let __Buffer;
function __load(n){
  if (__cache[n]) return __cache[n].exports;
  if (!__defs[n]) throw new Error('Módulo no encontrado: ' + n);
  const m = { exports: {} }; __cache[n] = m;
  if (!__Buffer) { __Buffer = null; __Buffer = __load('shim/buffer.js'); }
  __defs[n].call(m.exports, m, m.exports, (s) => __req(n, s), process, __Buffer, '/app/src');
  return m.exports;
}
return { require: (n) => __load(n) };
}
`;
  return out;
}
module.exports = { empaquetar };
