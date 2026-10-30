'use strict';
// ---------- Marca blanca, QR de la app y sincronización con la aplicación web ----------
S.marca = S.marca || { nombre: 'OMEGA', fuente: 'Barlow Condensed', logo: null, ver_nombre: true, fuentes: [] };

async function cargarMarca() {
  try { S.marca = await api('GET', '/marca', undefined, { noRedirect: true }); } catch (_) {}
  aplicarMarca();
}
// ---------- diseño de la aplicación (fondo, letras, botones) ----------
const _h2r = (h) => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const _r2h = (r) => '#' + r.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const _mix = (a, b, t) => _r2h(_h2r(a).map((v, i) => v + (_h2r(b)[i] - v) * t));
const _lum = (h) => { const [r, g, b] = _h2r(h).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * r + .7152 * g + .0722 * b; };
const _rgba = (h, a) => 'rgba(' + _h2r(h).join(',') + ',' + a + ')';
const TEMA_DEF = { fondo: 'defecto', fondo_color: '#0e1013', fondo_imagen: null, fondo_veladura: 55, texto_color: '#eef1f6', fuente_texto: 'Sistema', boton_color: '#ff6b35', icono_fondo: '#0e1013' };
function aplicarTema(tema) {
  const t = { ...TEMA_DEF, ...(tema || S.marca.tema || {}) };
  const r = document.documentElement.style, b = document.body;
  const personal = t.fondo !== 'defecto' || t.texto_color !== TEMA_DEF.texto_color || t.boton_color !== TEMA_DEF.boton_color || t.fuente_texto !== 'Sistema';
  const props = ['--bg', '--bg2', '--card', '--card2', '--line', '--txt', '--muted', '--brand', '--brand2', '--on-brand', '--top-bg', '--bnav-bg', '--brand-suave', '--brand-suave2', '--fuente-texto', '--foto-fondo'];
  props.forEach(p => r.removeProperty(p)); if (b) b.classList.remove('con-foto');
  let l = document.getElementById('fuente-texto'); if (l && (t.fuente_texto === 'Sistema')) l.remove();
  if (!personal) { r.colorScheme = 'dark'; return; }
  // fondo: color sólido o foto; el resto de la paleta se calcula para que siempre se lea bien
  const base = t.fondo === 'defecto' ? TEMA_DEF.fondo_color : t.fondo_color;
  const claro = _lum(base) > .45;
  const polo = claro ? '#000000' : '#ffffff';
  const foto = t.fondo === 'imagen' && t.fondo_imagen;
  r.colorScheme = claro ? 'light' : 'dark';
  r.setProperty('--bg', base);
  r.setProperty('--bg2', _mix(base, polo, .05));
  const cardBase = _mix(base, polo, .07);
  r.setProperty('--card', foto ? _rgba(cardBase, .86) : cardBase);
  r.setProperty('--card2', foto ? _rgba(_mix(base, polo, .12), .9) : _mix(base, polo, .12));
  r.setProperty('--line', _mix(base, polo, .2));
  r.setProperty('--txt', t.texto_color);
  r.setProperty('--muted', _mix(t.texto_color, base, .42));
  r.setProperty('--brand', t.boton_color);
  r.setProperty('--brand2', _mix(t.boton_color, claro ? '#000000' : '#ffffff', .18));
  r.setProperty('--on-brand', _lum(t.boton_color) > .4 ? '#14100d' : '#ffffff');
  r.setProperty('--brand-suave', _rgba(t.boton_color, .22)); r.setProperty('--brand-suave2', _rgba(t.boton_color, .12));
  r.setProperty('--top-bg', _rgba(base, foto ? .8 : .92)); r.setProperty('--bnav-bg', _rgba(_mix(base, polo, .05), foto ? .85 : .96));
  if (t.fuente_texto !== 'Sistema') {
    r.setProperty('--fuente-texto', `'${t.fuente_texto}', system-ui, -apple-system, "Segoe UI", sans-serif`);
    const href = 'https://fonts.googleapis.com/css2?family=' + encodeURIComponent(t.fuente_texto).replace(/%20/g, '+') + ':wght@400;600;700;900&display=swap';
    if (!l) { l = document.createElement('link'); l.id = 'fuente-texto'; l.rel = 'stylesheet'; document.head.appendChild(l); }
    if (l.getAttribute('href') !== href) l.setAttribute('href', href);
  }
  if (foto && b) {
    const v = Math.max(0, Math.min(90, Number(t.fondo_veladura) || 0)) / 100;
    r.setProperty('--foto-fondo', `linear-gradient(${_rgba(base, v)}, ${_rgba(base, v)}), url("${t.fondo_imagen}")`);
    b.classList.add('con-foto');
  }
}
function aplicarIconos() {
  const v = S.marca.icono_v ? '?v=' + S.marca.icono_v : '';
  const set = (sel, href) => { const e = document.querySelector(sel); if (e && e.getAttribute('href') !== href) e.setAttribute('href', href); };
  set('link[rel="icon"]', '/icons/favicon.png' + v); set('link[rel="apple-touch-icon"]', '/icons/apple-touch-icon.png' + v); set('link[rel="manifest"]', '/manifest.webmanifest' + v);
}
function aplicarMarca() {
  const m = S.marca;
  aplicarTema(); aplicarIconos();
  document.title = (m.nombre || 'OMEGA') + ' · Gestión del gimnasio';
  const fam = m.fuente && m.fuente !== 'Sistema' ? `'${m.fuente}', ` : '';
  document.documentElement.style.setProperty('--fuente-marca', fam + 'system-ui, -apple-system, "Segoe UI", sans-serif');
  let l = document.getElementById('fuente-marca');
  if (m.fuente && m.fuente !== 'Sistema') {
    const href = 'https://fonts.googleapis.com/css2?family=' + encodeURIComponent(m.fuente).replace(/%20/g, '+') + ':wght@400;700;900&display=swap';
    if (!l) { l = document.createElement('link'); l.id = 'fuente-marca'; l.rel = 'stylesheet'; document.head.appendChild(l); }
    if (l.getAttribute('href') !== href) l.setAttribute('href', href);
  } else if (l) l.remove();
}
const marcaPorDefecto = () => (S.marca.nombre || 'OMEGA').toUpperCase() === 'OMEGA' && !S.marca.logo;
function logoHtml(grande) {
  const m = S.marca;
  if (marcaPorDefecto()) return grande ? '<div class="big-logo"><b>Ω</b> MEGA</div>' : '<span class="marca-txt"><b>Ω</b>MEGA</span>';
  const img = m.logo ? `<img class="marca-img${grande ? ' g' : ''}" src="${esc(m.logo)}" alt="">` : '';
  const txt = (m.ver_nombre || !m.logo) ? `<span class="marca-nombre${grande ? ' g' : ''}" style="font-family:var(--fuente-marca)">${esc(m.nombre)}</span>` : '';
  return `<span class="marca-logo${grande ? ' g' : ''}">${img}${txt}</span>`;
}

// Arma los PNG del ícono de la app (celular, navegador y acceso directo de la PC) a partir del logo o de una imagen propia
function cargarImg(src) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('No se pudo leer la imagen del ícono')); i.src = src; }); }
async function generarIconos(src, fondo) {
  const img = await cargarImg(src); const iw = img.naturalWidth || 300, ih = img.naturalHeight || 300;
  const hacer = (px, pad) => {
    const c = document.createElement('canvas'); c.width = c.height = px; const g = c.getContext('2d');
    g.fillStyle = fondo; g.fillRect(0, 0, px, px);
    const caja = px * (1 - 2 * pad), k = Math.min(caja / iw, caja / ih), w = iw * k, h = ih * k;
    g.drawImage(img, (px - w) / 2, (px - h) / 2, w, h);
    return c.toDataURL('image/png');
  };
  return { '64': hacer(64, .08), '180': hacer(180, .14), '192': hacer(192, .12), '256': hacer(256, .12), '512': hacer(512, .12), m512: hacer(512, .24) };
}
function editarMarca() {
  const M = S.marca; let logo = M.logo || null; let cambioLogo = false;
  let iconoSrc = M.icono_fuente || null, cambioIcono = false, cambioFondoIcono = false;
  const fondoIconoInicial = (M.tema && M.tema.icono_fondo) || '#0e1013';
  const fuentes = M.fuentes && M.fuentes.length ? M.fuentes : ['Barlow Condensed', 'Sistema'];
  const m = modal('Logo y nombre del gimnasio', `<form id="f" class="stack">
    <div class="row" style="align-items:center;gap:14px"><div class="marca-prev" id="prev"></div></div>
    ${campo('Nombre del gimnasio', `<input name="nombre" required maxlength="40" value="${esc(M.nombre)}" autocomplete="off">`)}
    ${campo('Tipografía del nombre', `<select name="fuente">${fuentes.map(f => `<option ${f === M.fuente ? 'selected' : ''} style="font-family:'${esc(f)}'">${esc(f)}</option>`).join('')}</select>`)}
    <div class="field"><label>Logo o isologo (imagen)</label><div class="row"><label class="btn" style="margin:0">Subir imagen<input type="file" id="arch" accept="image/*" class="hidden"></label><button type="button" class="ghost" id="q-logo">Quitar logo</button></div>
      <div class="small muted" style="margin-top:4px">PNG, JPG o SVG. Si tiene fondo transparente se ve mejor. Se reduce solo para que cargue rápido en el celular.</div></div>
    <label class="row" style="color:var(--txt)"><input type="checkbox" name="ver_nombre" ${M.ver_nombre ? 'checked' : ''}> Mostrar el nombre al lado del logo</label>
    <div class="field"><label>Ícono de la aplicación</label>
      <div class="row" style="align-items:center;gap:14px"><img class="icono-prev" id="ico-prev" alt="">
        <div class="stack" style="flex:1;min-width:200px"><div class="small muted" id="ico-txt"></div>
          <div class="row"><label class="btn sm" style="margin:0">Subir otro ícono<input type="file" id="arch-ico" accept="image/*" class="hidden"></label><button type="button" class="ghost sm" id="q-ico">Usar el logo</button></div>
          <div class="row small"><span>Color de fondo del ícono</span><input type="color" name="icono_fondo" value="${esc(fondoIconoInicial)}" style="width:46px;height:30px;padding:2px"></div></div></div>
      <div class="small muted" style="margin-top:4px">Al subir el logo, el ícono se actualiza solo: en el acceso directo de esta PC, en la pantalla de inicio del celular y en la pestaña del navegador (administrador, profesores y alumnos). Si querés uno distinto al logo, subilo acá.</div></div>
    <div class="row" style="justify-content:space-between"><button type="button" class="ghost" id="a-diseno">🎨 Colores, fondo y letras…</button><span class="row"><button type="button" data-close>Cancelar</button><button class="primary">Guardar</button></span></div></form>`);
  const f = $('#f', m);
  function prev() {
    const nom = f.nombre.value || 'Tu gimnasio';
    $('#prev', m).innerHTML = `${logo ? `<img class="marca-img g" src="${esc(logo)}" alt="">` : ''}${(f.ver_nombre.checked || !logo) ? `<span class="marca-nombre g" style="font-family:'${esc(f.fuente.value)}',system-ui,sans-serif">${esc(nom)}</span>` : ''}`;
    if (f.fuente.value !== 'Sistema' && !document.getElementById('f-' + f.fuente.value.replace(/\W/g, ''))) {
      const l = document.createElement('link'); l.id = 'f-' + f.fuente.value.replace(/\W/g, ''); l.rel = 'stylesheet';
      l.href = 'https://fonts.googleapis.com/css2?family=' + encodeURIComponent(f.fuente.value).replace(/%20/g, '+') + '&display=swap'; document.head.appendChild(l);
    }
  }
  function prevIcono() {
    const fuente = iconoSrc || logo; const img = $('#ico-prev', m);
    if (fuente) { img.style.background = f.icono_fondo.value; img.style.objectFit = 'contain'; img.style.padding = '10px'; img.src = fuente; }
    else { img.style.background = '#fff'; img.style.padding = '0'; img.src = '/icons/icon-192.png'; }
    $('#ico-txt', m).textContent = iconoSrc ? 'Se usa el ícono que subiste.' : logo ? 'Se usa tu logo como ícono.' : 'Todavía no hay logo: se usa el ícono de OMEGA.';
  }
  f.nombre.oninput = f.fuente.onchange = f.ver_nombre.onchange = prev;
  f.icono_fondo.oninput = () => { cambioFondoIcono = true; prevIcono(); };
  $('#q-logo', m).onclick = () => { logo = null; cambioLogo = true; prev(); prevIcono(); };
  $('#arch', m).onchange = async (e) => {
    const fl = e.target.files[0]; if (!fl) return;
    try { logo = await imagenLogo(fl); cambioLogo = true; prev(); prevIcono(); } catch (er) { fail(er); }
  };
  $('#arch-ico', m).onchange = async (e) => { const fl = e.target.files[0]; if (!fl) return; try { iconoSrc = await imagenLogo(fl, 512); cambioIcono = true; prevIcono(); } catch (er) { fail(er); } };
  $('#q-ico', m).onclick = () => { iconoSrc = null; cambioIcono = true; prevIcono(); };
  $('#a-diseno', m).onclick = () => { m.close(); editarDiseno(); };
  prev(); prevIcono();
  f.onsubmit = async (e) => {
    e.preventDefault();
    const body = { nombre: f.nombre.value, fuente: f.fuente.value, ver_nombre: f.ver_nombre.checked };
    if (cambioLogo) body.logo = logo;
    try {
      if (cambioLogo || cambioIcono || cambioFondoIcono) { // el ícono de la app sigue al logo (o a la imagen propia)
        const fuente = iconoSrc || logo;
        body.icono_fuente = iconoSrc || '';
        if (fuente) { body.iconos = await generarIconos(fuente, f.icono_fondo.value); body.tema = { icono_fondo: f.icono_fondo.value }; } else body.iconos = null;
      }
      S.marca = await api('PUT', '/marca', body); aplicarMarca(); m.close(); toast('Guardado' + (body.iconos ? ': el ícono de la app se actualizó' : '')); render();
      // gimnasio nuevo: si todavía no está conectado con su aplicación web, aparece el botón Sincronizar
      try { const e = await api('GET', '/sync/estado'); if (e.nodo === 'pc' && !e.configurado && body.nombre && body.nombre !== 'OMEGA') ofrecerSincronizar(); } catch (_) {}
    } catch (er) { fail(er); }
  };
}
function imagenLogo(file, max = 320) {
  return new Promise((res, rej) => {
    if (file.type === 'image/svg+xml') {
      if (file.size > 300 * 1024) return rej(new Error('El SVG es demasiado pesado'));
      const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(new Error('No se pudo leer la imagen')); return r.readAsDataURL(file);
    }
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      res(c.toDataURL(file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png', 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('No se pudo leer la imagen')); };
    img.src = url;
  });
}

// ---------- dirección de la app (para los QR) ----------
async function urlApp() {
  let info = {};
  try { info = await api('GET', '/app-url'); } catch (_) {}
  const local = /^(localhost|127\.|\[?::1)/.test(location.hostname);
  let url = info.guardada || info.nube || (!local && !window.OMEGA_DEMO ? location.origin : null) || (info.lan && info.lan[0]) || null;
  const origen = info.guardada ? 'guardada' : info.nube ? 'nube' : (!local && !window.OMEGA_DEMO) ? 'actual' : (info.lan && info.lan[0]) ? 'wifi' : 'ninguna';
  if (window.OMEGA_DEMO && !url) url = 'https://omega.ejemplo.com';
  return { url: url ? url.replace(/\/+$/, '') + '/' : null, origen, info };
}
function avisoUrl(u) {
  if (window.OMEGA_DEMO) return '<div class="infobox">Versión de prueba: en la instalación real este QR lleva a la dirección de tu app web (nube) para que cualquiera la abra desde su celular.</div>';
  if (u.origen === 'wifi') return '<div class="warnbox">Este QR solo funciona con el celular conectado al <b>WiFi del gimnasio</b>. Para que ande desde cualquier lugar publicá la app web (ver guía) y cargá su dirección abajo.</div>';
  if (u.origen === 'ninguna') return '<div class="warnbox">Todavía no hay una dirección para compartir. Publicá la app web (ver guía) y cargá su dirección abajo, o conectá la PC a una red.</div>';
  return '';
}
async function modalQRApp(esAdmin) {
  const u = await urlApp();
  const m = modal('Instalar la app en el celular', `<div class="center">${u.url ? `<div class="qrbox"><div style="width:min(70vw,280px)">${qrSvg(u.url)}</div></div><div style="margin:10px 0;word-break:break-all"><b>${esc(u.url)}</b></div>
    <p class="muted">Escaneá el código con la cámara del celular y abrí el link. Para instalarla: Android (Chrome) → “Instalar aplicación”; iPhone (Safari) → Compartir → “Agregar a inicio”.</p>
    <div class="row" style="justify-content:center"><button id="cp">Copiar link</button></div>` : ''}${avisoUrl(u)}
    ${esAdmin ? `<form id="fu" class="row" style="margin-top:10px;align-items:flex-end"><div class="field grow" style="margin:0;text-align:left"><label>Dirección de la app web (la que usan alumnos y profes)</label><input name="url" placeholder="https://omega-tugimnasio.onrender.com" value="${esc(u.info.guardada || '')}"></div><button class="primary">Guardar</button></form>` : ''}</div>`);
  const cp = $('#cp', m); if (cp) cp.onclick = () => copiarTexto(u.url);
  const fu = $('#fu', m); if (fu) fu.onsubmit = async (e) => { e.preventDefault(); try { await api('PUT', '/app-url', { url: new FormData(fu).get('url') }); m.close(); toast('Dirección guardada'); render(); } catch (er) { fail(er); } };
}
// Tarjeta chica del QR (esquina superior derecha del Inicio)
async function qrEsquina(cont, esAdmin) {
  const u = await urlApp();
  cont.innerHTML = `<button class="qr-esquina" id="qr-e" title="Tocá para ampliar">${u.url ? `<span class="qrbox" style="padding:6px;border-radius:10px;box-shadow:none"><span style="display:block;width:78px">${qrSvg(u.url)}</span></span>` : '<span class="avatar">QR</span>'}<span class="small"><b>App para celulares</b><br><span class="muted">Escaneá y descargá</span></span></button>`;
  $('#qr-e', cont).onclick = () => modalQRApp(esAdmin);
}

// ---------- sincronización con la aplicación web ----------
function textoSync(e) {
  if (!e.configurado) return '<span class="t-amarillo">Todavía no está conectada con la aplicación web (la que usan los alumnos desde el celular). Tocá “Sincronizar” para conectarla.</span>';
  const r = e.resultado;
  const cuando = e.ultimo ? 'Última sincronización: <b>' + fmtF(e.ultimo.slice(0, 10)) + ' ' + new Date(e.ultimo).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) + '</b>' : 'Todavía no se sincronizó';
  const est = r && !r.ok ? ` · <span class="t-rojo">${esc(r.error || 'error')}</span>` : e.pendientes ? ` · <span class="t-amarillo">${e.pendientes} cambios por enviar</span>` : ' · <span class="t-verde">al día ✓</span>';
  return cuando + est;
}
async function barraSync(cont) {
  let e;
  try { e = await api('GET', '/sync/estado'); } catch (_) { return; }
  if (e.nodo !== 'pc') return;
  const pintar = () => {
    cont.innerHTML = `<div class="card syncbar"><div class="row between"><div><b>Aplicación web</b><div class="small" id="sy-t">${textoSync(e)}</div></div>
      ${S.user.rol === 'admin' ? `<button class="primary" id="sy-b">⟳ ${e.configurado ? 'Sincronizar con la aplicación Web' : 'Sincronizar'}</button>` : ''}</div></div>`;
    const b = $('#sy-b', cont);
    if (b && !e.configurado) b.onclick = () => asistenteSync(() => { barraSync(cont); });
    else if (b) b.onclick = async () => {
      b.disabled = true; b.innerHTML = '<span class="spinner"></span> Sincronizando…';
      try {
        const r = await api('POST', '/sync/ahora', {});
        e = r.estado;
        if (r.ok) toast(r.repoblada ? 'Se cargó toda la información en la aplicación web' : 'Sincronizado: ' + r.enviados + ' enviados · ' + r.recibidos + ' recibidos'); else toast(r.error, 'err');
      } catch (er) { fail(er); }
      pintar();
    };
  };
  pintar();
}

// Asistente "Sincronizar" de un gimnasio nuevo. Con un solo botón la PC le pide al servicio de alta del dueño del sistema que cree
// el repositorio en GitHub y el servicio en Render, y se conecta sola. Si esta instalación no trae ese acceso, queda el modo manual
// (dirección + clave, o código de conexión).
function ofrecerSincronizar() {
  const m = modal('Conectar “' + (S.marca.nombre || 'tu gimnasio') + '” con la web', `<p class="muted">Tu gimnasio ya tiene nombre. El último paso es crear su aplicación web para que alumnos y profesores entren desde el celular.</p>
    <div class="row" style="justify-content:flex-end"><button data-close>Más tarde</button><button class="primary" id="of-sy">Sincronizar</button></div>`);
  $('#of-sy', m).onclick = () => { m.close(); asistenteSync(); };
}
async function asistenteSync(despues) {
  let est = {}; try { est = await api('GET', '/sync/estado'); } catch (_) {}
  const auto = !!est.alta;
  const m = modal('Sincronizar con la aplicación web', `<div class="stack">
    ${auto ? `<div id="sy-auto" class="stack">
      <p class="muted">OMEGA crea sola la aplicación web de tu gimnasio y la conecta. No tenés que hacer nada más. Puede tardar unos minutos: dejá esta ventana abierta.</p>
      <div id="sy-prog" class="warnbox" hidden></div><div id="sy-aerr" class="err"></div>
      <div class="row" style="justify-content:flex-end"><button type="button" data-close>Ahora no</button><button class="primary" id="sy-crear">Crear y conectar mi aplicación web</button></div></div>` : ''}
    <details id="sy-man" ${auto ? '' : 'open'}><summary class="small muted" style="cursor:pointer">${auto ? 'Ya tengo la dirección y la clave' : 'Cargar dirección y clave'}</summary>
    <form id="fsy" class="stack" style="margin-top:10px">
      ${auto ? '' : '<p class="muted">Esta instalación no trae el alta automática: pedile al dueño del sistema la dirección de la aplicación web y su clave.</p>'}
      ${campo('Dirección de la aplicación web', '<input name="url" placeholder="https://omega-migimnasio.onrender.com" autocomplete="off" required>')}
      ${campo('Clave de sincronización', '<input name="clave" type="password" placeholder="Pegá acá la clave" autocomplete="off" required>')}
      <div class="small muted">También podés pegar el <b>código de conexión</b> completo en el primer campo.</div>
      <div id="sy-err" class="err"></div>
      <div class="row" style="justify-content:flex-end"><button type="button" data-close>Ahora no</button><button class="primary" id="sy-ok">Conectar y sincronizar</button></div></form></details></div>`);
  const fin = (r) => { m.close(); toast(r || 'Conectado: tu aplicación web está lista'); if (despues) despues(); else render(); };
  const bc = $('#sy-crear', m);
  if (bc) {
    let timer = null; void timer;
    const mirar = async () => {
      if (!m.isConnected) return;
      try {
        const e = await api('GET', '/sync/crear-nube');
        const p = $('#sy-prog', m); if (!p) return;
        if (e.estado === 'en_curso') { p.hidden = false; p.innerHTML = '<span class="spinner"></span> ' + esc(e.fase || 'Trabajando…'); timer = setTimeout(mirar, 3000); }
        else if (e.estado === 'listo') fin();
        else if (e.estado === 'error') { p.hidden = true; $('#sy-aerr', m).textContent = e.error || 'No se pudo crear la aplicación web'; bc.disabled = false; bc.textContent = 'Reintentar'; }
      } catch (er) { if ($('#sy-prog', m)) timer = setTimeout(mirar, 5000); }
    };
    bc.onclick = async () => {
      bc.disabled = true; $('#sy-aerr', m).textContent = '';
      try { await api('POST', '/sync/crear-nube', {}); mirar(); } catch (er) { $('#sy-aerr', m).textContent = er.message; bc.disabled = false; }
    };
    api('GET', '/sync/crear-nube').then(e => { if (e.estado === 'en_curso') { bc.disabled = true; mirar(); } }).catch(() => {});
  }
  const f = $('#fsy', m);
  f.onsubmit = async (ev) => {
    ev.preventDefault();
    let url = f.url.value.trim(), clave = f.clave.value.trim();
    const cod = /^OMEGA1\.([A-Za-z0-9+/=_-]+)$/.exec(url);
    if (cod) { try { const [u, c] = atob(cod[1].replace(/-/g, '+').replace(/_/g, '/')).split('|'); url = u; clave = c; } catch (_) {} }
    const b = $('#sy-ok', m); b.disabled = true; b.innerHTML = '<span class="spinner"></span> Conectando…'; $('#sy-err', m).textContent = '';
    try { const r = await api('POST', '/sync/conectar', { url, clave }); fin(r.repoblada ? 'Conectado: se cargó toda la información en la aplicación web' : 'Conectado y sincronizado'); }
    catch (er) { $('#sy-err', m).textContent = er.message; b.disabled = false; b.textContent = 'Conectar y sincronizar'; }
  };
}

// ---------- formulario público de visitas (QR del CRM) ----------
async function pantallaVisita() {
  let profs = [], nombre = S.marca.nombre;
  try { const r = await api('GET', '/publico/profesores', undefined, { noRedirect: true }); profs = r.profesores; nombre = r.nombre || nombre; } catch (_) {}
  $('#app').innerHTML = `<div class="auth"><div class="card">${logoHtml(true)}
    <h2 class="center" style="margin-top:10px">¡Bienvenido/a!</h2><p class="center muted">Dejanos tus datos y un profe te contacta para coordinar tu clase de prueba.</p>
    <form id="fv" class="stack">
      <div class="field"><label>Nombre y apellido *</label><input name="nombre" required autocomplete="name"></div>
      <div class="field"><label>Teléfono / WhatsApp *</label><input name="telefono" required inputmode="tel" autocomplete="tel"></div>
      <div class="field"><label>Instagram u otra red (opcional)</label><input name="redes" autocapitalize="none" placeholder="@usuario"></div>
      <div class="field"><label>¿Qué querés lograr?</label><select name="objetivo"><option value="">Elegí una opción</option><option>Bajar de peso</option><option>Ganar músculo</option><option>Tonificar</option><option>Mejorar mi condición física</option><option>Salud y bienestar</option><option>Rendimiento deportivo</option><option>Otro</option></select></div>
      ${profs.length ? `<div class="field"><label>¿Quién te atendió? (opcional)</label><select name="profesor_id"><option value="">No sé / ninguno</option>${profs.map(p => `<option value="${p.id}">${esc(p.nombre)}</option>`).join('')}</select></div>` : ''}
      <input name="web" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px" aria-hidden="true">
      <div class="err" id="v-err"></div><button class="primary big" style="width:100%">Enviar mis datos</button></form></div></div>`;
  $('#fv').onsubmit = async (e) => {
    e.preventDefault(); const btn = $('button', e.target); btn.disabled = true;
    try {
      await api('POST', '/publico/visita', Object.fromEntries(new FormData(e.target)), { noRedirect: true });
      $('#app').innerHTML = `<div class="auth"><div class="card center">${logoHtml(true)}<h2 style="margin-top:12px">¡Gracias!</h2><p class="muted">Recibimos tus datos en ${esc(nombre)}. ¡Te vemos pronto en clase! 💪</p></div></div>`;
    } catch (er) { $('#v-err').textContent = er.message; btn.disabled = false; }
  };
}


// ---------- Diseño de la aplicación: fondo, letras y botones ----------
function imagenFondo(file) {
  return new Promise((res, rej) => {
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, 1600 / Math.max(img.width, img.height)); const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      let q = .82, d = c.toDataURL('image/jpeg', q); while (d.length > 800 * 1024 && q > .4) { q -= .1; d = c.toDataURL('image/jpeg', q); }
      d.length > 880 * 1024 ? rej(new Error('La imagen es muy pesada: probá con una más chica')) : res(d);
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('No se pudo leer la imagen')); };
    img.src = url;
  });
}
function editarDiseno() {
  const base = { ...TEMA_DEF, ...(S.marca.tema || {}) }; let t = { ...base };
  const fuentes = S.marca.fuentes_texto && S.marca.fuentes_texto.length ? S.marca.fuentes_texto : ['Sistema'];
  const m = modal('Diseño de la aplicación', `<div class="stack">
    <p class="muted">Cambiá cómo se ve la app para el administrador, los profesores y los alumnos. Los cambios se ven al instante; se guardan cuando tocás “Guardar”.</p>
    <div class="field"><label>Fondo</label>
      <div class="tabs" id="t-fondo"><button type="button" data-f="defecto">Original</button><button type="button" data-f="color">Color sólido</button><button type="button" data-f="imagen">Foto con el diseño del logo</button></div>
      <div id="fondo-opc"></div></div>
    <div class="tema-grid">
      ${campo('Color de las letras', '<div class="row"><input type="color" id="c-txt"><button type="button" class="ghost sm" id="r-txt">Restablecer</button></div>')}
      ${campo('Color de los botones (el naranja)', '<div class="row"><input type="color" id="c-btn"><button type="button" class="ghost sm" id="r-btn">Restablecer</button></div>')}
      ${campo('Fuente de las letras', `<select id="s-fuente">${fuentes.map(x => `<option ${x === t.fuente_texto ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>`)}</div>
    <div class="tema-prev"><div class="row"><b>Así se ve</b><span class="grow"></span><button class="primary sm" type="button">Botón</button><span class="pill verde">Activo</span></div><p class="muted small" style="margin:8px 0 0">Texto de ejemplo con la fuente y el color elegidos.</p></div>
    <div class="row" style="justify-content:space-between"><button type="button" class="ghost" id="t-orig">Volver al diseño original</button><span class="row"><button type="button" id="t-cancel">Cancelar</button><button class="primary" id="t-ok" type="button">Guardar</button></span></div></div>`, { wide: true, onClose: () => aplicarTema() });
  const vivo = () => aplicarTema(t);
  const pintarFondo = () => {
    $$('#t-fondo [data-f]', m).forEach(b => b.classList.toggle('on', b.dataset.f === t.fondo));
    const c = $('#fondo-opc', m);
    if (t.fondo === 'color') c.innerHTML = '<div class="row" style="margin-top:8px"><input type="color" id="c-fondo" value="' + esc(t.fondo_color) + '"><span class="small muted">Elegí el color de fondo de toda la app.</span></div>';
    else if (t.fondo === 'imagen') c.innerHTML = `<div class="stack" style="margin-top:8px"><div class="row"><label class="btn" style="margin:0">${t.fondo_imagen ? 'Cambiar foto' : 'Subir foto'}<input type="file" id="a-foto" accept="image/*" class="hidden"></label>${t.fondo_imagen ? '<button type="button" class="ghost" id="q-foto">Quitar foto</button>' : ''}</div>
      ${t.fondo_imagen ? `<img src="${esc(t.fondo_imagen)}" alt="" style="max-width:240px;max-height:130px;border-radius:10px;border:1px solid var(--line)">` : ''}
      <div class="field" style="margin:0"><label>Oscurecer la foto (para que se lean las letras): <b id="v-vel">${t.fondo_veladura}%</b></label><input type="range" id="r-vel" min="0" max="90" value="${t.fondo_veladura}"></div>
      <div class="row"><span class="small muted">Color base (se mezcla con la foto):</span><input type="color" id="c-fondo" value="${esc(t.fondo_color)}"></div>
      <div class="small muted">Usá una imagen con el diseño del logo del gimnasio. Se reduce sola para que cargue rápido en el celular.</div></div>`;
    else c.innerHTML = '';
    const cf = $('#c-fondo', m); if (cf) cf.oninput = () => { t.fondo_color = cf.value; vivo(); };
    const af = $('#a-foto', m); if (af) af.onchange = async (e) => { const fl = e.target.files[0]; if (!fl) return; try { t.fondo_imagen = await imagenFondo(fl); pintarFondo(); vivo(); } catch (er) { fail(er); } };
    const qf = $('#q-foto', m); if (qf) qf.onclick = () => { t.fondo_imagen = null; pintarFondo(); vivo(); };
    const rv = $('#r-vel', m); if (rv) rv.oninput = () => { t.fondo_veladura = Number(rv.value); $('#v-vel', m).textContent = rv.value + '%'; vivo(); };
  };
  $$('#t-fondo [data-f]', m).forEach(b => b.onclick = () => { t.fondo = b.dataset.f; pintarFondo(); vivo(); });
  $('#c-txt', m).value = t.texto_color; $('#c-btn', m).value = t.boton_color;
  $('#c-txt', m).oninput = (e) => { t.texto_color = e.target.value; vivo(); };
  $('#c-btn', m).oninput = (e) => { t.boton_color = e.target.value; vivo(); };
  $('#r-txt', m).onclick = () => { t.texto_color = TEMA_DEF.texto_color; $('#c-txt', m).value = t.texto_color; vivo(); };
  $('#r-btn', m).onclick = () => { t.boton_color = TEMA_DEF.boton_color; $('#c-btn', m).value = t.boton_color; vivo(); };
  $('#s-fuente', m).onchange = (e) => { t.fuente_texto = e.target.value; vivo(); };
  $('#t-orig', m).onclick = () => { t = { ...TEMA_DEF, icono_fondo: t.icono_fondo }; $('#c-txt', m).value = t.texto_color; $('#c-btn', m).value = t.boton_color; $('#s-fuente', m).value = 'Sistema'; pintarFondo(); vivo(); };
  const cerrarSinGuardar = () => { aplicarTema(); m.close(); };
  $('#t-cancel', m).onclick = cerrarSinGuardar;
  $('#t-ok', m).onclick = async () => {
    try {
      S.marca = await api('PUT', '/marca', { tema: { fondo: t.fondo, fondo_color: t.fondo_color, fondo_imagen: t.fondo === 'imagen' ? t.fondo_imagen : null, fondo_veladura: t.fondo_veladura, texto_color: t.texto_color, boton_color: t.boton_color, fuente_texto: t.fuente_texto } });
      aplicarMarca(); m.close(); toast('Diseño guardado');
    } catch (er) { fail(er); }
  };
  pintarFondo(); vivo();
}
