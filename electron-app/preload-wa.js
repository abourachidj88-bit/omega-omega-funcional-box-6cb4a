'use strict';
// Hark Pro · lectura de WhatsApp Web. SOLO LECTURA: este archivo nunca escribe, hace clic ni envía nada en WhatsApp.
// Cada pocos segundos mira los mensajes que se ven en pantalla en el chat abierto y le pasa los nuevos al programa de escritorio.
const { ipcRenderer } = require('electron');
const vistos = new Set();
let ultimoChat = '';

function fechaISO(txt) { // "5/11/2026" (día/mes/año; si el mes no puede ser mayor a 12 se invierte)
  const m = /(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/.exec(txt || ''); if (!m) return '';
  let d = +m[1], mo = +m[2]; if (mo > 12 && d <= 12) { const t = d; d = mo; mo = t; }
  return m[3] + '-' + String(mo).padStart(2, '0') + '-' + String(d).padStart(2, '0');
}
function leer() {
  const main = document.querySelector('#main'); if (!main) return [];
  const titulo = main.querySelector('header span[title]'); const nombre = titulo ? (titulo.getAttribute('title') || titulo.textContent || '').trim() : '';
  const out = [];
  for (const el of main.querySelectorAll('[data-id]')) {
    const id = el.getAttribute('data-id') || '';
    const m = /^(true|false)_(\d{6,20})@(c\.us|s\.whatsapp\.net|lid)_/.exec(id);    // solo chats individuales (los grupos y canales se ignoran)
    if (!m || vistos.has(id)) continue;
    const info = el.querySelector('[data-pre-plain-text]'); if (!info) continue;
    const pre = info.getAttribute('data-pre-plain-text') || '';                    // "[10:32, 5/11/2026] Nombre: "
    const h = /\[(\d{1,2}:\d{2})[^,\]]*,\s*([^\]]+)\]/.exec(pre);
    const tx = el.querySelector('span.selectable-text, .copyable-text span');
    const texto = tx ? (tx.innerText || tx.textContent || '').trim() : '';
    if (!texto) continue;
    out.push({ uid: id, tel: m[2], nombre, dir: m[1] === 'true' ? 'out' : 'in', hora: h ? h[1] : '', fecha: h ? fechaISO(h[2]) : '', texto });
  }
  return out;
}
function tick() {
  try {
    const nuevos = leer();
    if (!nuevos.length) return;
    ipcRenderer.invoke('hark:mensajes', nuevos.slice(0, 200)).then((ok) => { if (ok) nuevos.slice(0, 200).forEach(x => vistos.add(x.uid)); }).catch(() => {});
  } catch (_) {}
}
setInterval(tick, 4000);
