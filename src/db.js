'use strict';
const path = require('node:path');
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');
const { ZONAS, E, EQUIPAMIENTO } = require('./seed-ejercicios');
const { NUEVOS, patronDe } = require('./seed-ejercicios-v1');
const { GLUTEOS, intensidadDe, PAISES, CAMPANAS_BASE } = require('./seed-ejercicios-v2');
const migraciones = require('./migraciones');
const sync = require('./sync');

const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(__dirname, '..', 'data');
fs.mkdirSync(path.join(DATA_DIR, 'uploads', 'videos'), { recursive: true });
fs.mkdirSync(path.join(DATA_DIR, 'backups'), { recursive: true });

const DB_PATH = path.join(DATA_DIR, 'omega.db');
const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');

db.exec(`
CREATE TABLE IF NOT EXISTS config (clave TEXT PRIMARY KEY, valor TEXT);

CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  rol TEXT NOT NULL CHECK (rol IN ('admin','profesor','cliente')),
  nombre TEXT NOT NULL DEFAULT '',
  cliente_id INTEGER,
  activo INTEGER NOT NULL DEFAULT 1,
  creado TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS clientes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  foto TEXT,
  fecha_alta TEXT NOT NULL,
  precio_plan REAL NOT NULL DEFAULT 0,
  fecha_baja TEXT,
  celular TEXT,
  instagram TEXT,
  creado TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pagos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  fecha TEXT NOT NULL,
  monto REAL NOT NULL,
  concepto TEXT,
  cubre_hasta TEXT
);

CREATE TABLE IF NOT EXISTS formatos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL UNIQUE,
  trabajo_seg INTEGER,
  descanso_seg INTEGER,
  color TEXT,
  orden INTEGER NOT NULL DEFAULT 0,
  activo INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS equipamiento (
  clave TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  cantidad INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS ejercicios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  zona TEXT NOT NULL,
  nombre TEXT NOT NULL,
  prog2 TEXT NOT NULL,
  prog3 TEXT NOT NULL,
  equipo TEXT NOT NULL DEFAULT 'ninguno',
  unidades INTEGER NOT NULL DEFAULT 1,
  descripcion TEXT,
  video TEXT,
  activo INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS agenda (
  dia INTEGER NOT NULL,
  hora INTEGER NOT NULL,
  formato_id INTEGER REFERENCES formatos(id) ON DELETE SET NULL,
  PRIMARY KEY (dia, hora)
);

CREATE TABLE IF NOT EXISTS circuitos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha TEXT NOT NULL,
  formato_id INTEGER NOT NULL REFERENCES formatos(id) ON DELETE CASCADE,
  plantilla TEXT NOT NULL,
  slots TEXT NOT NULL,
  advertencias TEXT,
  UNIQUE (fecha, formato_id)
);

CREATE TABLE IF NOT EXISTS sesiones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha TEXT NOT NULL,
  hora INTEGER NOT NULL,
  formato_id INTEGER REFERENCES formatos(id) ON DELETE SET NULL,
  profesor_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  UNIQUE (fecha, hora)
);

CREATE TABLE IF NOT EXISTS uso_ejercicio (
  ejercicio_id INTEGER NOT NULL REFERENCES ejercicios(id) ON DELETE CASCADE,
  formato_id INTEGER NOT NULL,
  fecha TEXT NOT NULL,
  PRIMARY KEY (ejercicio_id, formato_id, fecha)
);

CREATE TABLE IF NOT EXISTS asistencias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  sesion_id INTEGER REFERENCES sesiones(id) ON DELETE SET NULL,
  fecha TEXT NOT NULL,
  hora INTEGER NOT NULL,
  registrado TEXT NOT NULL,
  origen TEXT NOT NULL DEFAULT 'manual',
  cargado_por INTEGER,
  UNIQUE (cliente_id, fecha, hora)
);
CREATE INDEX IF NOT EXISTS idx_asist_fecha ON asistencias(fecha, hora);
CREATE INDEX IF NOT EXISTS idx_asist_cliente ON asistencias(cliente_id, fecha);

CREATE TABLE IF NOT EXISTS finanzas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo TEXT NOT NULL CHECK (tipo IN ('ingreso','egreso')),
  categoria TEXT NOT NULL,
  concepto TEXT,
  monto REAL NOT NULL,
  fecha TEXT NOT NULL,
  fijo INTEGER NOT NULL DEFAULT 0,
  pago_id INTEGER
);
CREATE INDEX IF NOT EXISTS idx_fin_fecha ON finanzas(fecha);
`);

migraciones.aplicar(db);
sync.instalar(db);

// ---------- helpers ----------
const stmtCache = new Map();
function prep(sql) {
  let s = stmtCache.get(sql);
  if (!s) { s = db.prepare(sql); stmtCache.set(sql, s); }
  return s;
}
const all = (sql, ...p) => prep(sql).all(...p);
const get = (sql, ...p) => prep(sql).get(...p);
const run = (sql, ...p) => prep(sql).run(...p);
function tx(fn) {
  db.exec('BEGIN IMMEDIATE');
  try { const r = fn(); db.exec('COMMIT'); return r; }
  catch (e) { try { db.exec('ROLLBACK'); } catch (_) {} throw e; }
}
function getConfig(k, def = null) {
  const r = get('SELECT valor FROM config WHERE clave = ?', k);
  return r ? r.valor : def;
}
function setConfig(k, v) {
  run('INSERT INTO config (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor', k, String(v));
}

// ---------- datos iniciales ----------
function seed() {
  if (!get('SELECT 1 AS x FROM ejercicios LIMIT 1')) {
    tx(() => {
      for (const zona of ZONAS) {
        for (const [n, p2, p3, eq] of (E[zona] || [])) {
          run('INSERT INTO ejercicios (zona, nombre, prog2, prog3, equipo, unidades) VALUES (?,?,?,?,?,1)', zona, n, p2, p3, eq);
        }
      }
    });
  }
  if (!get('SELECT 1 AS x FROM equipamiento LIMIT 1')) {
    tx(() => { for (const [c, n, q] of EQUIPAMIENTO) run('INSERT INTO equipamiento (clave, nombre, cantidad) VALUES (?,?,?)', c, n, q); });
  }
  if (!get('SELECT 1 AS x FROM formatos LIMIT 1')) {
    const colores = ['#ff6b35', '#3ecf8e', '#4da3ff', '#ffc233', '#c084fc', '#ff4d6d'];
    tx(() => {
      ['Endurance', 'Flex', 'Funcional', 'Hiitcross', 'QDX', 'Z7'].forEach((n, i) =>
        run('INSERT INTO formatos (nombre, trabajo_seg, descanso_seg, color, orden) VALUES (?,NULL,NULL,?,?)', n, colores[i], i + 1));
    });
  }
  if (!get('SELECT 1 AS x FROM agenda LIMIT 1')) {
    const formatos = all('SELECT id FROM formatos ORDER BY orden');
    const horas = [8, 9, 10, 11, 12, 15, 16, 17, 18, 19, 20];
    tx(() => {
      for (let dia = 1; dia <= 6; dia++) {
        horas.forEach((h, i) => run('INSERT INTO agenda (dia, hora, formato_id) VALUES (?,?,?)', dia, h, formatos[(i + dia) % formatos.length].id));
      }
    });
  }
  if (!getConfig('capacidad_clase')) setConfig('capacidad_clase', '20');
  if (!getConfig('estaciones')) setConfig('estaciones', '5');
}
// Biblioteca de la Versión 1: completa hasta 50 ejercicios por zona (sin duplicar los que ya existen)
function seedV1() {
  tx(() => {
    for (const zona of ZONAS) {
      const existentes = new Set(all('SELECT nombre FROM ejercicios WHERE zona = ?', zona).map(r => r.nombre));
      for (const [n, p2, p3, eq, patron] of (NUEVOS[zona] || [])) {
        if (existentes.has(n)) continue;
        run("INSERT INTO ejercicios (zona, nombre, prog2, prog3, equipo, unidades, patron, origen) VALUES (?,?,?,?,?,1,?,'base')", zona, n, p2, p3, eq, patron);
      }
    }
    for (const e of all('SELECT id, zona, nombre FROM ejercicios WHERE patron IS NULL')) run('UPDATE ejercicios SET patron = ? WHERE id = ?', patronDe(e.zona, e.nombre), e.id);
    if (!get('SELECT 1 AS x FROM planes LIMIT 1')) {
      const top = get('SELECT precio_plan AS p, COUNT(*) AS n FROM clientes WHERE precio_plan > 0 GROUP BY precio_plan ORDER BY n DESC LIMIT 1');
      const p = top ? top.p : 0;
      run('INSERT INTO planes (nombre, precio_efectivo, precio_mp) VALUES (?,?,?)', 'Plan mensual', p, p);
    }
  });
}
// Versión 2: zona Glúteos, intensidad cardiovascular, campañas, país y formatos HIIT
function seedV2() {
  tx(() => {
    const ya = new Set(all("SELECT nombre FROM ejercicios WHERE zona = 'Glúteos'").map(r => r.nombre));
    for (const [n, p2, p3, eq, patron] of GLUTEOS) {
      if (ya.has(n)) continue;
      run("INSERT INTO ejercicios (zona, nombre, prog2, prog3, equipo, unidades, patron, origen) VALUES ('Glúteos',?,?,?,?,1,?,'base')", n, p2, p3, eq, patron);
    }
    for (const e of all('SELECT id, zona, nombre, patron FROM ejercicios WHERE intensidad IS NULL')) run('UPDATE ejercicios SET intensidad = ? WHERE id = ?', intensidadDe(e.zona, e.patron, e.nombre), e.id);
    if (!get('SELECT 1 AS x FROM campanas LIMIT 1')) for (const [n, t] of CAMPANAS_BASE) run('INSERT INTO campanas (nombre, tipo) VALUES (?,?)', n, t);
    if (!getConfig('pais')) { setConfig('pais', 'AR'); setConfig('prefijo', '54'); }
    if (!getConfig('limite_reservas')) setConfig('limite_reservas', '20');
    for (const f of all("SELECT id FROM formatos WHERE intensidad_min IS NULL AND (LOWER(nombre) LIKE '%hiit%')")) run("UPDATE formatos SET intensidad_min = 'moderada' WHERE id = ?", f.id);
  });
}
if (sync.NODO !== 'nube') { seed(); seedV1(); seedV2(); }

module.exports = { db, all, get, run, tx, getConfig, setConfig, DATA_DIR, DB_PATH, ZONAS, seedV1, seedV2, PAISES };
