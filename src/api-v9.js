'use strict';
// Versión 9: color de cada patrón de movimiento (se usa para dibujar las posiciones de los ejercicios nuevos).
function registrar(ctx) {
  const { route, ADM, STAFF, bad, readBody } = ctx;
  const { getConfig, setConfig } = require('./db');
  const est = require('./estimulos');
  const COLORES = { empujar: '#ff6b35', tirar: '#4da3ff', sentadilla: '#3ecf8e', bisagra_cadera: '#c084fc', bisagra_rodilla: '#ffc233', rotacion: '#2dd4bf', locomocion: '#f472b6' };
  const leer = () => { let g = {}; try { g = JSON.parse(getConfig('patron_colores') || '{}') || {}; } catch (_) {} return g; };
  const lista = () => { const g = leer(); return est.PATRONES.map(p => ({ clave: p.clave, nombre: p.nombre, color: /^#[0-9a-fA-F]{6}$/.test(g[p.clave] || '') ? g[p.clave] : COLORES[p.clave] || '#ff6b35' })); };
  route('GET', '/api/patrones/colores', STAFF, () => lista());
  route('PUT', '/api/patrones/colores', ADM, async ({ req }) => {
    const b = await readBody(req);
    const nuevo = leer();
    for (const x of (Array.isArray(b.colores) ? b.colores : [])) {
      if (!est.PATRONES.some(p => p.clave === x.clave)) continue;
      if (!/^#[0-9a-fA-F]{6}$/.test(String(x.color || ''))) throw bad('Color inválido');
      nuevo[x.clave] = String(x.color).toLowerCase();
    }
    setConfig('patron_colores', JSON.stringify(nuevo));
    return lista();
  });
}
module.exports = { registrar };
