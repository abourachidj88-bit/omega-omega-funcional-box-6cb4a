'use strict';
// Arma la versión de prueba como UN solo archivo HTML (sin servidor).
const fs = require('node:fs');
const path = require('node:path');
const { empaquetar } = require('./bundle-backend');
const ROOT = path.join(__dirname, '..');
const r = (...p) => fs.readFileSync(path.join(ROOT, ...p), 'utf8');
const safe = (js) => js.replace(/<\/script/gi, '<\\/script');
const SQLASM = process.env.SQLASM || '/tmp/sqljs/node_modules/sql.js/dist/sql-asm.js';

const js = ['core', 'telefono', 'v2-comun', 'ilustraciones', 'marca', 'auth-view', 'reporting', 'lector-qr', 'asistencia', 'xlsx-modelo', 'clientes', 'planificacion', 'rutinas', 'crm', 'finanzas-ajustes', 'finanzas-v1', 'forecast', 'alumno', 'main'].map(n => r('public/js/' + n + '.js'));
const partes = [
  '<title>OMEGA</title>',
  '<style>' + r('public/css/app.css') + '\n</style>',
  '<div id="app"><div class="auth"><div class="card center"><div class="big-logo"><b>Ω</b> MEGA</div><p class="muted"><span class="spinner"></span> Preparando la aplicación y los datos de ejemplo…</p></div></div></div>',
  '<div id="modal-root"></div><div id="toast-root" aria-live="polite"></div>',
  ...['qrcode', 'jsQR', 'xlsx.mini.min'].map(n => '<script>' + safe(r('public/vendor/' + n + '.js')) + '\n</script>'),
  '<script>' + safe(fs.readFileSync(SQLASM, 'utf8')) + '\n</script>',
  '<script>' + safe(empaquetar()) + '\n</script>',
  ...js.map(c => '<script>' + safe(c) + '\n</script>'),
  '<script>' + safe(r('demo/runtime.js')) + '\n</script>',
];
fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
const out = path.join(ROOT, 'dist', 'omega-prueba.html');
fs.writeFileSync(out, partes.join('\n'));
console.log('OK', out, (fs.statSync(out).size / 1048576).toFixed(2) + ' MB');
