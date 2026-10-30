'use strict';
// Alta automática de la aplicación web del gimnasio: esta PC le pide al "servicio de alta" del dueño del sistema que cree el
// repositorio en GitHub y el servicio en Render. La PC solo conoce ALTA_URL y ALTA_CLAVE (vienen en el instalador, archivo alta.txt);
// las claves de GitHub y de Render viven únicamente en el servicio de alta.
const crypto = require('node:crypto');
const { getConfig, setConfig } = require('./db');
const { conectarNube } = require('./nube-conexion');

let job = null;
const pausa = (ms) => new Promise(r => setTimeout(r, ms));
const config = () => ({ url: String(process.env.ALTA_URL || '').replace(/\/+$/, ''), clave: process.env.ALTA_CLAVE || '' });
const disponible = () => { const c = config(); return !!(c.url && c.clave); };

async function llamar(metodo, ruta, cuerpo, ms = 90000) {
  const c = config();
  const r = await fetch(c.url + ruta, { method: metodo, headers: { Authorization: 'Bearer ' + c.clave, 'Content-Type': 'application/json' }, body: cuerpo ? JSON.stringify(cuerpo) : undefined, signal: AbortSignal.timeout(ms) });
  let j = null; try { j = await r.json(); } catch (_) {}
  if (!r.ok) { const e = new Error((j && j.error) || ('El servicio de alta respondió ' + r.status)); e.status = r.status; throw e; }
  return j;
}

function estado() { return job ? { estado: job.estado, fase: job.fase, error: job.error || null } : { estado: 'libre', fase: '', error: null }; }

function iniciar(nombre, opc = {}) {
  if (!disponible()) { const e = new Error('Esta instalación no trae el acceso al servicio de alta. Usá “Ya tengo la dirección y la clave”.'); e.status = 400; throw e; }
  if (job && job.estado === 'en_curso') return estado();
  let inst = getConfig('sync_instalacion', null);
  if (!inst) { inst = crypto.randomBytes(18).toString('hex'); setConfig('sync_instalacion', inst); }
  const j = job = { estado: 'en_curso', fase: 'Conectando con el servicio de alta…', error: null };
  const cada = opc.cadaMs || 4000, limite = Date.now() + (opc.esperaMs || 20 * 60e3);
  (async () => {
    try {
      let reintentos = 0;
      for (;;) { try { await llamar('POST', '/alta', { nombre, instalacion: inst }); break; } catch (e) { if (e.status || ++reintentos > 3) throw e; await pausa(cada); } }
      let res = null;
      while (Date.now() < limite) {
        let d;
        try { d = await llamar('GET', '/alta/' + inst, null, 30000); }
        catch (e) { if (e.status === 404) { await llamar('POST', '/alta', { nombre, instalacion: inst }); continue; } if (e.status) throw e; await pausa(cada); continue; }
        j.fase = d.fase || j.fase;
        if (d.estado === 'error') throw new Error(d.error || 'No se pudo crear la aplicación web');
        if (d.estado === 'listo') { res = d; break; }
        await pausa(cada);
      }
      if (!res) throw new Error('La creación está tardando más de lo normal. Probá de nuevo en unos minutos.');
      j.fase = 'Conectando y copiando los datos del gimnasio…';
      let r = null;
      for (let i = 0; i < 8; i++) { r = await conectarNube(res.url, res.clave); if (r.ok) break; await pausa(opc.reintentoMs || 10000); } // el servicio nuevo puede tardar en despertar
      if (!r || !r.ok) throw new Error('La aplicación web se creó pero todavía no responde: ' + ((r && r.error) || '') + '. Tocá Sincronizar en unos minutos.');
      j.estado = 'listo'; j.fase = 'Listo';
    } catch (e) { j.estado = 'error'; j.fase = 'Error'; j.error = String(e.message || e); }
  })();
  return estado();
}
module.exports = { disponible, iniciar, estado };
