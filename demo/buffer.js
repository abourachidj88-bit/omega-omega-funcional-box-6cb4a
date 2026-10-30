'use strict';
// Mini Buffer para el navegador (solo lo que usa la app)
const te = new TextEncoder(), td = new TextDecoder();
const b64chars = (s) => s.replace(/-/g, '+').replace(/_/g, '/');
class Buf extends Uint8Array {
  static from(v, enc) {
    if (typeof v === 'string') {
      if (enc === 'hex') { const o = new Buf(v.length >> 1); for (let i = 0; i < o.length; i++) o[i] = parseInt(v.substr(i * 2, 2), 16); return o; }
      if (enc === 'base64' || enc === 'base64url') {
        let s = b64chars(v); while (s.length % 4) s += '=';
        const bin = atob(s); const o = new Buf(bin.length); for (let i = 0; i < bin.length; i++) o[i] = bin.charCodeAt(i); return o;
      }
      const u = te.encode(v); const o = new Buf(u.length); o.set(u); return o;
    }
    const o = new Buf(v.length); o.set(v); return o;
  }
  static alloc(n) { return new Buf(n); }
  static concat(list) { const n = list.reduce((a, b) => a + b.length, 0); const o = new Buf(n); let p = 0; for (const b of list) { o.set(b, p); p += b.length; } return o; }
  toString(enc) {
    if (enc === 'hex') return Array.from(this, b => b.toString(16).padStart(2, '0')).join('');
    if (enc === 'base64' || enc === 'base64url') {
      let bin = ''; for (let i = 0; i < this.length; i++) bin += String.fromCharCode(this[i]);
      const s = btoa(bin); return enc === 'base64' ? s : s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }
    return td.decode(this);
  }
}
module.exports = Buf;
