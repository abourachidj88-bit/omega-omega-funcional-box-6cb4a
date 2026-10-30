'use strict';
// Restaura la base de datos desde una copia de seguridad.
// Uso (con el servidor DETENIDO):   npm run restaurar -- "C:\ruta\omega-2026-10-25_2200.db"
const fs = require('node:fs');
const path = require('node:path');
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(__dirname, '..', 'data');
const BACKUP_DIR = process.env.BACKUP_DIR ? path.resolve(process.env.BACKUP_DIR) : path.join(DATA_DIR, 'backups');
const origen = process.argv[2];
if (!origen || !fs.existsSync(origen)) {
  console.error('Indicá la copia a restaurar. Copias disponibles en ' + BACKUP_DIR + ':');
  if (fs.existsSync(BACKUP_DIR)) fs.readdirSync(BACKUP_DIR).filter(f => /^omega-.*\.db$/.test(f)).sort().reverse().slice(0, 15).forEach(f => console.error('  ' + f));
  process.exit(1);
}
fs.mkdirSync(DATA_DIR, { recursive: true });
const destino = path.join(DATA_DIR, 'omega.db');
if (fs.existsSync(destino)) { const resguardo = destino + '.antes-de-restaurar-' + Date.now(); fs.copyFileSync(destino, resguardo); console.log('Base actual resguardada en ' + resguardo); }
for (const ext of ['-wal', '-shm']) { try { fs.rmSync(destino + ext); } catch (_) {} }
fs.copyFileSync(origen, destino);
// videos: se vuelven a copiar los que falten
const vOrigen = path.join(BACKUP_DIR, 'videos'), vDestino = path.join(DATA_DIR, 'uploads', 'videos');
let n = 0;
if (fs.existsSync(vOrigen)) { fs.mkdirSync(vDestino, { recursive: true }); for (const f of fs.readdirSync(vOrigen)) { const d = path.join(vDestino, f); if (!fs.existsSync(d)) { fs.copyFileSync(path.join(vOrigen, f), d); n++; } } }
console.log('Listo: base restaurada desde ' + origen + (n ? ' · ' + n + ' video(s) recuperados' : '') + '. Ya podés iniciar OMEGA.');
