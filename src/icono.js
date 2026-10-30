'use strict';
// Ícono de la app: arma el archivo .ico de Windows (que contiene el PNG de 256 px) para el acceso directo del escritorio.
const fs = require('node:fs');
const path = require('node:path');
function icoDesdePng(png) {
  const cab = Buffer.alloc(22);
  cab.writeUInt16LE(0, 0); cab.writeUInt16LE(1, 2); cab.writeUInt16LE(1, 4);       // ICONDIR: 1 imagen
  cab[6] = 0; cab[7] = 0; cab[8] = 0; cab[9] = 0;                                   // 256x256 (0 = 256), sin paleta
  cab.writeUInt16LE(1, 10); cab.writeUInt16LE(32, 12); cab.writeUInt32LE(png.length, 14); cab.writeUInt32LE(22, 18);
  return Buffer.concat([cab, png]);
}
function escribirIco(dataUrl) {
  const { DATA_DIR } = require('./db');
  // en Windows el lanzador define OMEGA_HOME (C:\OMEGA): ahí lo leen los accesos directos
  const destino = path.join(process.env.OMEGA_HOME || DATA_DIR, 'omega.ico');
  if (!dataUrl) { try { fs.rmSync(destino, { force: true }); } catch (_) {} return false; }
  const m = /^data:image\/png;base64,(.+)$/.exec(dataUrl); if (!m) return false;
  fs.writeFileSync(destino, icoDesdePng(Buffer.from(m[1], 'base64')));
  if (process.platform === 'win32') { try { require('node:child_process').spawn('ie4uinit.exe', ['-show'], { stdio: 'ignore', windowsHide: true, detached: true }).unref(); } catch (_) {} } // refresca los íconos del escritorio
  return true;
}
module.exports = { escribirIco, icoDesdePng };
