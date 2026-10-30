'use strict';
// Conecta esta PC con la aplicación web de su gimnasio: prueba la conexión y recién ahí guarda la dirección y la clave.
// La clave queda solo en esta PC (C:\OMEGA\nube.txt), nunca en la base de datos que se copia.
const sync = require('./sync');
const { setConfig } = require('./db');

async function conectarNube(url, clave) {
  const antes = { u: process.env.NUBE_URL, c: process.env.NUBE_CLAVE };
  process.env.NUBE_URL = url; process.env.NUBE_CLAVE = clave;
  const r = await sync.sincronizar('conexion');
  if (!r.ok) {
    if (antes.u === undefined) delete process.env.NUBE_URL; else process.env.NUBE_URL = antes.u;
    if (antes.c === undefined) delete process.env.NUBE_CLAVE; else process.env.NUBE_CLAVE = antes.c;
    return r;
  }
  const archivo = process.env.OMEGA_NUBE_TXT;
  if (archivo) require('node:fs').writeFileSync(archivo, '# Conexión con la aplicación web (cargada desde el botón Sincronizar de OMEGA).\r\nNUBE_URL=' + url + '\r\nNUBE_CLAVE=' + clave + '\r\n');
  else { setConfig('sync_url', url); setConfig('sync_clave', clave); }
  sync.iniciarProgramador();
  return r;
}
module.exports = { conectarNube };
