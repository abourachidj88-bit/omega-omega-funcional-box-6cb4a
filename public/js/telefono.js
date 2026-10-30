'use strict';
// Estandariza teléfonos con el prefijo internacional del país configurado (ej. +54 para Argentina),
// para que el enlace de WhatsApp (wa.me/PREFIJO+NUMERO) funcione siempre.
// Devuelve "+<dígitos>" (o '' si no hay un número usable). Los celulares argentinos llevan el 9 después del 54.
function normalizar(valor, prefijo) {
  const crudo = String(valor == null ? '' : valor).trim();
  if (!crudo) return '';
  const pref = String(prefijo || '').replace(/\D/g, '');
  let d = crudo.replace(/\D/g, '');
  if (d.length < 6) return crudo.replace(/\s+/g, ' ');
  const internacional = /^\s*(\+|00)/.test(crudo);
  if (d.startsWith('00')) d = d.slice(2);
  if (!internacional) {
    if (pref && d.startsWith(pref) && d.length >= pref.length + 8) {
      // ya trae el prefijo sin el "+"
    } else {
      d = d.replace(/^0+/, '');
      if (pref === '54') {
        // quita el 15 de los celulares escritos a la manera local (11 15 5555-1234)
        for (const k of [2, 3, 4]) { if (d.length === 12 && d.slice(k, k + 2) === '15') { d = d.slice(0, k) + d.slice(k + 2); break; } }
        if (d.length === 10) d = '9' + d;
      }
      d = pref + d;
    }
  }
  if (d.startsWith('54') && !d.startsWith('549') && d.length === 12) d = '549' + d.slice(2); // 54 + 10 dígitos -> celular
  return '+' + d;
}
function digitosWA(valor, prefijo) {
  const n = normalizar(valor, prefijo);
  return n.startsWith('+') ? n.slice(1) : String(valor || '').replace(/\D/g, '');
}
function enlaceWA(valor, prefijo) { const d = digitosWA(valor, prefijo); return d.length >= 8 ? 'https://wa.me/' + d : ''; }
const API = { normalizar, digitosWA, enlaceWA };
if (typeof module !== 'undefined') module.exports = API;
if (typeof window !== 'undefined') window.Telefono = API;
