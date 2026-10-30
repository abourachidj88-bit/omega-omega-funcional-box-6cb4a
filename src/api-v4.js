'use strict';
// Versión 4: alta automática de la aplicación web desde el botón Sincronizar.
function registrar(ctx) {
  const { route, ADM, HttpError } = ctx;
  const { getConfig } = require('./db');
  const alta = require('./alta-nube');
  const sync = require('./sync');
  route('POST', '/api/sync/crear-nube', ADM, async () => {
    if (sync.NODO === 'nube') throw new HttpError(403, 'Esto se hace en la PC del gimnasio');
    if (sync.configuracion().url) throw new HttpError(409, 'Este gimnasio ya está conectado con su aplicación web');
    return alta.iniciar(getConfig('marca_nombre', 'Gimnasio'));
  });
  route('GET', '/api/sync/crear-nube', ADM, () => alta.estado());
}
module.exports = { registrar };
