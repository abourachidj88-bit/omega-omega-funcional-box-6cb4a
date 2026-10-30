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

// ---- Versión 5: actualización automática
function registrarV5(ctx) {
  const { route, ADM, STAFF, PUB, HttpError, readBody } = ctx;
  const sync = require('./sync');
  const act = new Proxy({}, { get: (_, k) => (...a) => require('./actualizar')[k](...a) });   // se carga solo cuando hace falta (la demo del navegador no lo usa)
  // la nube ofrece su código a las PC que se conectan con la SYNC_CLAVE (firma HMAC, igual que la sincronización)
  route('POST', '/api/actualizacion', PUB, async ({ req }) => {
    if (sync.NODO !== 'nube') throw new HttpError(404, 'Ruta no encontrada');
    const clave = process.env.SYNC_CLAVE || '';
    if (!clave) throw new HttpError(503, 'La nube no tiene configurada la SYNC_CLAVE');
    const body = await readBody(req, 1024 * 64);
    const h = req.headers || {};
    if (!sync.verificarFirma(clave, h['x-sync-ts'], h['x-sync-firma'], req.rawBody || '')) throw new HttpError(401, 'Firma inválida');
    return act.responder(body.accion === 'paquete' ? 'paquete' : 'info');
  });
  route('GET', '/api/actualizacion/estado', STAFF, () => { if (process.env.OMEGA_DEMO || globalThis.OMEGA_DEMO) return { habilitada: false }; return act.estadoActual(); });
  route('POST', '/api/actualizacion/buscar', ADM, async () => act.buscar());
  route('POST', '/api/actualizacion/aplicar', ADM, () => act.aplicar());
}
module.exports = { registrar, registrarV5 };
