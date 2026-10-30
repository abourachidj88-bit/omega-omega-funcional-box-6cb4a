#!/usr/bin/env node
'use strict';
// OMEGA - Alta manual de un gimnasio desde la línea de comandos (alternativa al servicio de alta automático).
// Variables de entorno: GITHUB_TOKEN, RENDER_API_KEY.
// Uso: node herramientas/alta-gimnasio.js --nombre "Gimnasio Sol" [--plantilla dueño/repo] [--privado] [--plan free] [--region oregon]
const { altaGimnasio } = require('../servicio-alta/alta-core');
const arg = (n, def) => { const i = process.argv.indexOf('--' + n); return i < 0 ? def : (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true); };
const nombre = arg('nombre');
if (!nombre || nombre === true || arg('ayuda')) {
  console.log('Uso: node herramientas/alta-gimnasio.js --nombre "Gimnasio Sol" [--plantilla dueño/repo] [--privado] [--plan free] [--region oregon]\nRequiere GITHUB_TOKEN y RENDER_API_KEY en el entorno.');
  process.exit(nombre ? 0 : 1);
}
altaGimnasio({ nombre, plantilla: arg('plantilla', process.env.OMEGA_PLANTILLA || 'abourachidj88-bit/omega-gimnasio'), privado: arg('privado') === true, plan: arg('plan'), region: arg('region'),
  githubToken: process.env.GITHUB_TOKEN, renderKey: process.env.RENDER_API_KEY, log: m => console.log(m) })
  .then(r => {
    console.log('\n=== Gimnasio listo ===');
    console.log('Repositorio :', r.repo);
    console.log('Dirección   :', r.url || '(Render todavía no la informó; mirá el panel)');
    console.log('Clave SYNC  :', r.clave);
    console.log('Código de conexión (pegar en la app > Sincronizar):\n' + (r.codigo || '(no disponible)'));
    if (!r.vivo) console.log('\nAviso: el servicio aún no respondía; puede seguir desplegándose. Probá la dirección en unos minutos.');
  })
  .catch(e => { console.error('\nError:', e.message); process.exit(1); });
