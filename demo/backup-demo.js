'use strict';
// Copias de seguridad de la versión de prueba: se guardan dentro del navegador.
// (En el servidor real: archivo .db en la carpeta de backups, todos los días a las 22:00.)
const { getConfig, setConfig } = require('./db');
const { nowAR } = require('./util');
const HORA_BACKUP = 22;
const BACKUP_DIR = 'Navegador (versión de prueba)';
const lista = [];
async function hacerBackup(motivo = 'manual') {
  const a = nowAR();
  const nombre = 'omega-' + a.fecha.replace(/-/g, '') + '-' + String(a.hora).padStart(2, '0') + String(a.min).padStart(2, '0') + '.db';
  const bytes = globalThis.__OMEGA_EXPORTAR ? globalThis.__OMEGA_EXPORTAR().length : 0;
  lista.unshift({ archivo: nombre, bytes });
  if (lista.length > 30) lista.pop();
  setConfig('ultimo_backup', JSON.stringify({ fecha: a.fecha, hora: a.hora, min: a.min, archivo: nombre, motivo, videos_nuevos: 0, nube: { subido: false, motivo: 'versión de prueba' } }));
  return { ok: true, archivo: nombre, videos_nuevos: 0, nube: { subido: false } };
}
function listar() { return lista.slice(); }
function iniciarProgramador() {}
module.exports = { hacerBackup, listar, iniciarProgramador, BACKUP_DIR, HORA_BACKUP };
