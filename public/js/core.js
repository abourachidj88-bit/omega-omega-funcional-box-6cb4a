'use strict';
// ---------- estado y utilidades comunes ----------
const S = { token: null, user: null, cache: {} };
try { S.token = localStorage.getItem('omega_token'); } catch (_) {}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const money = (n) => '$ ' + Math.round(n || 0).toLocaleString('es-AR');
const DIAS = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const DIAS_CORTO = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function hoyAR() { return new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10); }
function ahoraAR() { const d = new Date(Date.now() - 3 * 3600 * 1000); return { hora: d.getUTCHours(), min: d.getUTCMinutes() }; }
function sumaDias(f, n) { return new Date(Date.parse(f + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10); }
function dowDe(f) { const d = new Date(f + 'T00:00:00Z').getUTCDay(); return d === 0 ? 7 : d; }
function lunesDe(f) { return sumaDias(f, -(dowDe(f) - 1)); }
function fmtF(f) { if (!f) return '—'; const [y, m, d] = f.slice(0, 10).split('-'); return d + '/' + m + '/' + y; }
function fmtFlargo(f) { const [y, m, d] = f.split('-').map(Number); return DIAS[dowDe(f)] + ' ' + d + ' de ' + MESES[m - 1]; }
function hh(h) { return String(h).padStart(2, '0') + ':00'; }
function seg(s) { if (s == null) return '—'; const m = Math.floor(s / 60), r = s % 60; return m ? (r ? m + ' min ' + r + ' s' : m + ' min') : r + ' s'; }
function iniciales(n) { return String(n || '?').split(/\s+/).slice(0, 2).map(x => x[0]).join('').toUpperCase(); }
function avatar(c, cls = '') {
  return c.foto ? `<img class="avatar ${cls}" src="${esc(c.foto)}" alt="">` : `<span class="avatar ${cls}">${esc(iniciales(c.nombre))}</span>`;
}
function dot(color) { return `<span class="dot ${esc(color)}" title="${esc(color)}"></span>`; }
function debounce(fn, ms = 200) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
function norm(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim(); }

// ---------- API ----------
async function api(method, path, body, opts = {}) {
  const headers = {};
  if (S.token) headers.Authorization = 'Bearer ' + S.token;
  let payload;
  if (body !== undefined && !opts.raw) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  let r;
  const doFetch = (window.OMEGA_DEMO && window.OMEGA_DEMO.fetch) || fetch;
  try { r = await doFetch(path.startsWith('/api') ? path : '/api' + path, { method, headers, body: payload }); }
  catch (_) { throw new Error('Sin conexión con el servidor. Revisá tu conexión a internet.'); }
  let data = null;
  try { data = await r.json(); } catch (_) {}
  if (r.status === 401 && S.token && !opts.noRedirect) { cerrarSesion(true); throw new Error((data && data.error) || 'Sesión vencida'); }
  if (!r.ok) throw new Error((data && data.error) || 'Error ' + r.status);
  return data;
}
function subirVideo(ejId, file, onProgress) {
  if (window.OMEGA_DEMO && window.OMEGA_DEMO.subirVideo) return window.OMEGA_DEMO.subirVideo(ejId, file, onProgress);
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open('PUT', '/api/ejercicios/' + ejId + '/video');
    x.setRequestHeader('Authorization', 'Bearer ' + S.token);
    x.setRequestHeader('X-Extension', (file.name.split('.').pop() || 'mp4').toLowerCase());
    x.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(Math.round(100 * e.loaded / e.total)); };
    x.onload = () => { let d = {}; try { d = JSON.parse(x.responseText); } catch (_) {} x.status < 300 ? resolve(d) : reject(new Error(d.error || 'Error al subir el video')); };
    x.onerror = () => reject(new Error('Se cortó la conexión al subir el video'));
    x.send(file);
  });
}

function guardarSesion(token, user) {
  S.token = token; S.user = user;
  try { localStorage.setItem('omega_token', token); } catch (_) {}
}
function cerrarSesion(vencida) {
  S.token = null; S.user = null; S.cache = {};
  try { localStorage.removeItem('omega_token'); } catch (_) {}
  stopTimers();
  setRuta('#/');
  render();
  if (vencida) toast('Tu sesión venció. Ingresá de nuevo.', 'warn');
}

// ---------- temporizadores que se limpian al cambiar de pantalla ----------
const timers = [];
function addTimer(id, kind = 'i') { timers.push([id, kind]); return id; }
function stopTimers() { while (timers.length) { const [id, k] = timers.pop(); if (k === 'fn') { try { id(); } catch (_) {} } else k === 'i' ? clearInterval(id) : clearTimeout(id); } if (S.stream) { S.stream.getTracks().forEach(t => t.stop()); S.stream = null; } }

// ---------- toasts y modales ----------
function toast(msg, tipo = '') {
  const el = document.createElement('div');
  el.className = 'toast ' + tipo; el.textContent = msg;
  $('#toast-root').appendChild(el);
  setTimeout(() => el.remove(), tipo === 'err' ? 6000 : 3500);
}
const fail = (e) => toast(e && e.message ? e.message : String(e), 'err');

const modales = [];
function modal(titulo, html, opts = {}) {
  const back = document.createElement('div');
  back.className = 'modal-back';
  back.innerHTML = `<div class="modal ${opts.wide ? 'wide' : ''}" role="dialog" aria-modal="true"><div class="modal-head"><h2>${esc(titulo)}</h2><button class="ghost sm" data-close aria-label="Cerrar">✕</button></div><div class="modal-body">${html}</div></div>`;
  const cerrar = () => { back.remove(); const i = modales.indexOf(back); if (i >= 0) modales.splice(i, 1); if (opts.onClose) opts.onClose(); };
  back.addEventListener('click', (e) => { if (e.target === back || e.target.closest('[data-close]')) cerrar(); });
  $('#modal-root').appendChild(back);
  modales.push(back);
  back.close = cerrar;
  back.body = $('.modal-body', back);
  return back;
}
function cerrarModales() { [...modales].forEach(m => m.close()); }
function confirmar(msg, textoOk = 'Confirmar', peligro = false) {
  return new Promise(res => {
    let resuelto = false;
    const m = modal('Confirmá', `<p>${esc(msg)}</p><div class="row" style="justify-content:flex-end"><button data-no>Cancelar</button><button data-si class="${peligro ? 'danger' : 'primary'}">${esc(textoOk)}</button></div>`, { onClose: () => { if (!resuelto) res(false); } });
    $('[data-no]', m).onclick = () => m.close();
    $('[data-si]', m).onclick = () => { resuelto = true; res(true); m.close(); };
  });
}

// ---------- gráficos mínimos ----------
function barras(items, opts = {}) {
  // items: [{x, v, color?, exc?}]
  const max = Math.max(1, ...items.map(i => i.v), opts.min || 0);
  return `<div class="bars">${items.map(i => `<div class="b"><div class="n">${i.label !== undefined ? i.label : (i.v || '')}</div><div class="col ${i.exc ? 'exc' : ''}" style="height:${Math.round(100 * i.v / max * 0.8)}%;${i.color ? 'background:' + i.color : ''}"></div><div class="x">${esc(i.x)}</div></div>`).join('')}</div>`;
}

// ---------- registro de pantallas y router ----------
const VISTAS = [];
// permiso del profesor (clave o 'a|b' = alguno de los dos); el administrador puede todo
function puede(k) {
  const u = S.user; if (!u) return false; if (u.rol === 'admin') return true; if (u.rol !== 'profesor') return false;
  const l = u.permisos || []; return String(k).split('|').some(x => l.includes(x));
}
const PERM_VISTA = {
  '/': 'inicio.ver', '/asistencias': 'asist.ver', '/asistencias/cargar': 'asist.registrar', '/asistencias/qr': 'asist.registrar',
  '/clientes': 'cli.ver', '/clientes/nuevo': 'cli.editar', '/clientes/:id': 'cli.ver', '/crm': 'crm.ver',
  '/planificacion': 'plan.semana', '/planificacion/circuito/:id': 'plan.semana', '/planificacion/staff': 'plan.staff', '/planificacion/rutinas': 'plan.rutinas',
  '/planificacion/biblioteca': 'plan.biblioteca', '/planificacion/formatos': 'plan.config', '/planificacion/agenda': 'plan.config', '/planificacion/equipos': 'plan.config',
  '/finanzas': 'fin.caja', '/finanzas/mes': 'fin.analisis', '/finanzas/resultados': 'fin.resultados', '/finanzas/presupuesto': 'fin.presupuesto',
};
function vista(patron, roles, fn) {
  const perm = PERM_VISTA[patron];
  const keys = [];
  const rx = new RegExp('^' + patron.replace(/:([a-z]+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
  VISTAS.push({ rx, keys, roles, fn, perm });
}
// En la versión de prueba (dentro de un marco) la ruta vive en memoria; en la app real, en el hash de la URL.
let rutaMem = null;
const enMemoria = () => !!(window.OMEGA_DEMO && window.OMEGA_DEMO.rutaEnMemoria);
function rutaActual() { return enMemoria() ? (rutaMem || '/') : ((location.hash || '#/').slice(1) || '/'); }
function setRuta(h) { if (enMemoria()) rutaMem = h.slice(1) || '/'; else location.hash = h; }
function ir(h) { if (enMemoria()) { rutaMem = h.slice(1) || '/'; render(); } else if (location.hash === h) render(); else location.hash = h; }

function descargarArchivo(nombre, blob) {
  if (window.OMEGA_DEMO && window.OMEGA_DEMO.descargar) return window.OMEGA_DEMO.descargar(nombre, blob);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = nombre; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
function descargarXlsx(nombre, hojas) {
  const wb = XLSX.utils.book_new();
  for (const [n, filas] of Object.entries(hojas)) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filas), n.slice(0, 31));
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  descargarArchivo(nombre, new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
}

// instalación como app
let eventoInstalar = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); eventoInstalar = e; });


// ---------- ayudas compartidas por las pantallas ----------
function urlVideo(v) { if (!v) return ''; return window.OMEGA_DEMO && window.OMEGA_DEMO.urlVideo ? window.OMEGA_DEMO.urlVideo(v) : v; }
function fotoMiniatura(file, lado = 160) {
  return new Promise((res, rej) => {
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => {
      const c = document.createElement('canvas'); const s = Math.min(img.width, img.height); c.width = c.height = lado;
      c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, lado, lado);
      URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg', 0.72));
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('No se pudo leer la imagen')); };
    img.src = url;
  });
}
function qrSvg(texto) {
  const q = qrcode(0, 'M'); q.addData(texto); q.make();
  return q.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
}
function chipFormato(f) {
  if (!f) return '<span class="muted">—</span>';
  return `<span class="chip" style="background:${esc(f.color || '#4da3ff')}">${esc(f.nombre)}</span>`;
}
function aFechaISO(v) {
  if (v === null || v === undefined || v === '') return '';
  if (v instanceof Date) { const d = new Date(v.getTime() + 12 * 3600 * 1000); return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0'); }
  if (typeof v === 'number') return new Date(Math.round((v - 25569) * 86400000)).toISOString().slice(0, 10);
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/.exec(s);
  if (m) { let y = Number(m[3]); if (y < 100) y += 2000; return y + '-' + String(m[2]).padStart(2, '0') + '-' + String(m[1]).padStart(2, '0'); }
  return '';
}
function campo(label, html, extra = '') { return `<div class="field ${extra}"><label>${label}</label>${html}</div>`; }
function copiarTexto(t) {
  const ok = () => toast('Copiado');
  const manual = () => { const m = modal('Copiá este texto', `<textarea readonly rows="4" style="width:100%">${esc(t)}</textarea><div class="row" style="justify-content:flex-end"><button class="primary" data-close>Listo</button></div>`); const ta = $('textarea', m); ta.focus(); ta.select(); };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(ok, manual);
  else manual();
}
function mostrarAcceso(a, nombre, despues) {
  const m = modal('Acceso a la app', `<p>${nombre ? '<b>' + esc(nombre) + '</b><br>' : ''}Pasale estos datos al alumno. Ingresa con ellos desde el link de la app del gimnasio.</p>
    <div class="card" style="font-size:1.2rem"><div>Usuario: <b>${esc(a.usuario)}</b></div><div>Contraseña: <b>${esc(a.clave)}</b></div></div>
    <p class="small muted" style="margin-top:10px">La contraseña solo se muestra ahora. Puede cambiarla desde “Mi perfil”.</p>
    <div class="row" style="justify-content:flex-end"><button id="cp">Copiar</button><button class="primary" data-close>Listo</button></div>`, { onClose: despues });
  $('#cp', m).onclick = () => copiarTexto('Usuario: ' + a.usuario + '\nContraseña: ' + a.clave);
}
