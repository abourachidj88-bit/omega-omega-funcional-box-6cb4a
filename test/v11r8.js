'use strict';
// r8: la dirección del QR vieja de Render se cambia sola por la de la nube actual; una propia no se toca.
const os = require('os'), path = require('path'), fs = require('fs'), assert = require('assert');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'omega-r8-'));
process.env.DATA_DIR = dir; process.env.NUBE_URL = 'https://omega-gimnasio-24lr.onrender.com'; process.env.NUBE_CLAVE = 'x'.repeat(20);
delete process.env.OMEGA_NODO;
const { setConfig, getConfig } = require('../src/db');
const sync = require('../src/sync');
let n = 0; const ok = (m) => { n++; console.log('  ✓ ' + m); };
setConfig('url_app', 'https://omega-omega-funcional-box-82a6d.onrender.com/');
sync.alinearDireccionApp(); assert.strictEqual(getConfig('url_app'), 'https://omega-gimnasio-24lr.onrender.com'); ok('la dirección vieja de Render pasa a la de la nube nueva');
setConfig('url_app', 'https://gimnasio-omega.com.ar');
sync.alinearDireccionApp(); assert.strictEqual(getConfig('url_app'), 'https://gimnasio-omega.com.ar'); ok('un dominio propio no se toca');
setConfig('url_app', '');
sync.alinearDireccionApp(); assert.strictEqual(getConfig('url_app'), ''); ok('si no hay dirección guardada, el QR usa la nube');
setConfig('url_app', 'https://omega-gimnasio-24lr.onrender.com');
sync.alinearDireccionApp(); assert.strictEqual(getConfig('url_app'), 'https://omega-gimnasio-24lr.onrender.com'); ok('si ya es la misma, no cambia');
console.log(n + ' pruebas OK'); process.exit(0);
