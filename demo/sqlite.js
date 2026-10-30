'use strict';
// Sustituto de node:sqlite para el navegador, apoyado en sql.js (SQLite compilado a JavaScript).
class Sentencia {
  constructor(base, sql) { this.base = base; this.sql = sql; }
  _params(p) { return p.map(v => (v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : typeof v === 'bigint' ? Number(v) : v)); }
  all(...p) {
    const s = this.base._db.prepare(this.sql); const rows = [];
    try { if (p.length) s.bind(this._params(p)); while (s.step()) rows.push(s.getAsObject()); } finally { s.free(); }
    return rows;
  }
  get(...p) { return this.all(...p)[0]; }
  run(...p) {
    const s = this.base._db.prepare(this.sql);
    try { if (p.length) s.bind(this._params(p)); s.step(); } finally { s.free(); }
    const r = this.base._db.exec('SELECT last_insert_rowid() AS id');
    return { changes: this.base._db.getRowsModified(), lastInsertRowid: r[0].values[0][0] };
  }
}
class DatabaseSync {
  constructor() {
    const SQL = globalThis.__OMEGA_SQL;
    this._db = new SQL.Database(globalThis.__OMEGA_DBBYTES || undefined);
    this._db.exec('PRAGMA foreign_keys = ON;');
  }
  exec(sql) { if (/journal_mode|busy_timeout/i.test(sql)) sql = sql.replace(/PRAGMA\s+(journal_mode|busy_timeout)\s*=\s*[A-Za-z0-9]+\s*;?/gi, ''); if (sql.trim()) this._db.exec(sql); }
  prepare(sql) { return new Sentencia(this, sql); }
  exportar() { const b = this._db.export(); this._db.exec('PRAGMA foreign_keys = ON;'); return b; }
}
module.exports = { DatabaseSync };
