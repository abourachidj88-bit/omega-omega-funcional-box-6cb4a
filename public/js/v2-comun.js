'use strict';
// ---------- Versión 2: piezas compartidas (país y WhatsApp, avisos del staff, instalar la app, fotos, Ajustes) ----------
const ICONO_WA = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" style="vertical-align:-3px"><path fill="currentColor" d="M12.04 2a9.9 9.9 0 0 0-8.5 14.9L2 22l5.25-1.37A9.9 9.9 0 1 0 12.04 2Zm0 18.1a8.2 8.2 0 0 1-4.18-1.14l-.3-.18-3.12.82.83-3.04-.2-.31A8.2 8.2 0 1 1 12.04 20.1Zm4.5-6.14c-.25-.12-1.46-.72-1.69-.8-.23-.09-.39-.12-.56.12-.16.25-.64.8-.78.97-.15.16-.29.18-.54.06a6.7 6.7 0 0 1-3.34-2.92c-.25-.43.25-.4.72-1.34.08-.16.04-.3-.02-.42-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.41-.56-.42h-.47a.9.9 0 0 0-.66.3c-.23.25-.87.85-.87 2.07s.89 2.4 1.01 2.56c.12.17 1.75 2.67 4.24 3.74 1.58.68 2.2.74 3 .62.49-.07 1.46-.6 1.67-1.17.2-.58.2-1.07.14-1.17-.06-.1-.23-.16-.48-.28Z"/></svg>';

// País configurado (bandera y prefijo): se carga una vez después de ingresar
async function cargarPais() {
  try { S.pais = await api('GET', '/config-pais'); } catch (_) { S.pais = S.pais || { prefijo: '54', bandera: '🇦🇷', nombre: 'Argentina' }; }
  return S.pais;
}
function prefijoPais() { return (S.pais && S.pais.prefijo) || '54'; }
function enlaceWA(numero) { return window.Telefono ? Telefono.enlaceWA(numero, prefijoPais()) : ''; }
function botonWA(numero, texto = 'WhatsApp', cls = '') {
  const l = enlaceWA(numero);
  return l ? `<a class="btn wa ${cls}" href="${esc(l)}" target="_blank" rel="noopener" title="Abrir chat de WhatsApp">${ICONO_WA} ${esc(texto)}</a>` : '';
}

// ---------- campana de avisos del staff (premios por recomendaciones) ----------
async function actualizarCampana() {
  const b = $('#btn-notif'); if (!b) return;
  try {
    const r = await api('GET', '/notificaciones');
    S.notif = r.pendientes;
    b.querySelector('.badge').textContent = r.pendientes > 99 ? '99+' : String(r.pendientes);
    b.classList.toggle('hay', r.pendientes > 0);
  } catch (_) {}
}
function abrirNotificaciones() {
  Promise.all([api('GET', '/notificaciones?todas=1'), api('GET', '/descuentos').catch(() => [])]).then(([r, descs]) => {
    const m = modal('Avisos', `<div id="nl">${r.items.length ? r.items.map(n => `<div class="notif ${n.estado === 'pendiente' ? 'pend' : ''}">
      <div class="grow"><b>${esc(n.titulo)}</b><div class="small muted">${esc(n.detalle || '')}</div>
        ${n.estado === 'pendiente' ? `<div class="row" style="margin-top:8px">${n.cliente_id && descs.length ? `<select data-d="${n.id}" title="Descuento que se aplica solo en la próxima renovación del alumno"><option value="">Premio: elegir descuento…</option>${descs.map(d => `<option value="${d.id}">${esc(d.nombre)}</option>`).join('')}</select>` : ''}<input data-r="${n.id}" placeholder="Qué decidiste (ej. regalo, sin premio)" style="flex:1;min-width:160px"><button class="primary sm" data-ok="${n.id}">Resuelta</button>${n.cliente_id ? `<a class="btn sm" href="#/clientes/${n.cliente_id}" data-close>Ver alumno</a>` : ''}</div>`
          : `<div class="small t-verde" style="margin-top:4px">✓ ${esc(n.resolucion || 'Resuelta')}</div>`}</div></div>`).join('') : '<div class="empty">No hay avisos.</div>'}</div>`);
    $$('[data-ok]', m).forEach(b => b.onclick = async () => {
      try { await api('PUT', '/notificaciones/' + b.dataset.ok, { resolucion: ($(`[data-r="${b.dataset.ok}"]`, m).value || '').trim(), descuento_id: Number(($(`[data-d="${b.dataset.ok}"]`, m) || {}).value) || undefined }); toast('Aviso resuelto'); m.close(); actualizarCampana(); abrirNotificaciones(); } catch (e) { fail(e); }
    });
  }).catch(fail);
}

// ---------- instalar la app en el celular (primera vez que el alumno entra por el QR) ----------
function esIOS() { return /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream; }
function yaInstalada() { try { return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; } catch (_) { return false; } }
function bannerInstalar() {
  if (window.OMEGA_DEMO || yaInstalada()) return;
  try { if (localStorage.getItem('omega_inst_no')) return; } catch (_) {}
  if (!eventoInstalar && !esIOS()) return;
  if ($('#banner-inst')) return;
  const b = document.createElement('div'); b.id = 'banner-inst'; b.className = 'banner-inst';
  b.innerHTML = `<div class="grow"><b>Instalá OMEGA en tu celular</b><div class="small">${eventoInstalar ? 'Queda como una app más en tu pantalla de inicio.' : 'Tocá <b>Compartir</b> y después <b>“Agregar a inicio”</b>.'}</div></div>
    ${eventoInstalar ? '<button class="primary sm" id="bi-ok">Instalar</button>' : ''}<button class="ghost sm" id="bi-no">Ahora no</button>`;
  document.body.appendChild(b);
  const quitar = () => { b.remove(); try { localStorage.setItem('omega_inst_no', '1'); } catch (_) {} };
  $('#bi-no', b).onclick = quitar;
  const ok = $('#bi-ok', b); if (ok) ok.onclick = async () => { try { eventoInstalar.prompt(); await eventoInstalar.userChoice; } catch (_) {} eventoInstalar = null; b.remove(); };
}
window.addEventListener('beforeinstallprompt', () => setTimeout(() => { if (S.user && S.user.rol === 'cliente') bannerInstalar(); }, 300));

// ---------- foto de perfil: cámara o galería, reducida en el celular ----------
function pedirFoto(capturar) {
  return new Promise((res, rej) => {
    const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; if (capturar) i.capture = 'user';
    i.onchange = () => { const f = i.files && i.files[0]; if (!f) return res(null); fotoMiniatura(f, 360).then(res, rej); };
    i.click();
  });
}

// ---------- Ajustes: país y WhatsApp ----------
async function bloquePais(cont) {
  const c = await api('GET', '/config-pais'); S.pais = c;
  cont.innerHTML = `<h3>País y WhatsApp</h3>
    <p class="muted">El país define el prefijo internacional (ej. +54) que se agrega a todos los teléfonos para que el botón de WhatsApp siempre abra el chat correcto.</p>
    <div class="fgrid">${campo('País', `<select id="pa-pais">${c.paises.map(p => `<option value="${p.codigo}" ${p.codigo === c.codigo ? 'selected' : ''}>${p.bandera} ${esc(p.nombre)} (+${p.prefijo})</option>`).join('')}</select>`)}
      ${campo('WhatsApp oficial del gimnasio', `<input id="pa-wa" inputmode="tel" value="${esc(c.whatsapp_gym || '')}" placeholder="Ej. 11 5555-1234">`)}</div>
    <div class="small muted" style="margin-top:6px">Los alumnos lo ven en su app como “Escribinos por WhatsApp”. Se guarda con el prefijo (+${esc(c.prefijo)}).</div>
    <div class="row" style="margin-top:10px"><button class="primary" id="pa-g">Guardar</button><button id="pa-e" title="Pasa todos los teléfonos cargados al formato con prefijo">Estandarizar teléfonos existentes</button>${c.whatsapp_gym_link ? `<a class="btn wa" href="${esc(c.whatsapp_gym_link)}" target="_blank" rel="noopener">${ICONO_WA} Probar</a>` : ''}</div>`;
  $('#pa-g', cont).onclick = async () => { try { await api('PUT', '/config-pais', { pais: $('#pa-pais', cont).value, whatsapp_gym: $('#pa-wa', cont).value }); toast('Guardado'); bloquePais(cont); } catch (e) { fail(e); } };
  $('#pa-e', cont).onclick = async () => {
    if (!(await confirmar('Se van a reescribir los teléfonos de alumnos y visitas con el prefijo del país elegido. ¿Seguimos?', 'Estandarizar'))) return;
    try { const r = await api('POST', '/config-pais/estandarizar'); toast(r.clientes + ' alumnos y ' + r.visitas + ' visitas actualizados'); } catch (e) { fail(e); }
  };
}

// ---------- Ajustes: campañas de captación ----------
async function bloqueCampanas(cont) {
  const lista = await api('GET', '/campanas?todas=1');
  cont.innerHTML = `<h3>Campañas de captación</h3>
    <p class="muted">Canales por los que llegan las visitas (se eligen al cargar una visita en el CRM). Las de tipo <b>“Recomendado por”</b> piden elegir al alumno que recomendó y avisan para decidir un premio cuando la visita se inscribe.</p>
    <div class="tablewrap"><table><thead><tr><th>Campaña</th><th>Tipo</th><th class="num">Visitas</th><th></th></tr></thead><tbody>
    ${lista.map(x => `<tr style="cursor:default" class="${x.activo ? '' : 'muted'}"><td><b>${esc(x.nombre)}</b>${x.activo ? '' : ' <span class="pill">Inactiva</span>'}</td><td>${x.tipo === 'recomendado' ? '<span class="pill amarillo">Recomendado por</span>' : 'Normal'}</td><td class="num">${x.visitas}</td>
      <td class="right"><button class="sm" data-ed="${x.id}">Editar</button> ${x.activo ? `<button class="danger sm" data-del="${x.id}">Quitar</button>` : `<button class="sm" data-on="${x.id}">Reactivar</button>`}</td></tr>`).join('')}</tbody></table></div>
    <div class="row" style="margin-top:10px"><button class="primary" id="ca-n">＋ Nueva campaña</button></div>`;
  const form = (x) => {
    const m = modal(x ? 'Editar campaña' : 'Nueva campaña', `<form id="f" class="stack">${campo('Nombre', `<input name="nombre" required value="${esc(x ? x.nombre : '')}">`)}
      ${campo('Tipo', `<select name="tipo"><option value="normal">Normal (Instagram, recorrida, volanteo…)</option><option value="recomendado" ${x && x.tipo === 'recomendado' ? 'selected' : ''}>Recomendado por un alumno (permite premiar)</option></select>`)}
      <div class="row" style="justify-content:flex-end"><button type="button" data-close>Cancelar</button><button class="primary">Guardar</button></div></form>`);
    $('#f', m).onsubmit = async (e) => { e.preventDefault(); const fd = Object.fromEntries(new FormData(e.target)); try { x ? await api('PUT', '/campanas/' + x.id, fd) : await api('POST', '/campanas', fd); m.close(); bloqueCampanas(cont); } catch (er) { fail(er); } };
  };
  $('#ca-n', cont).onclick = () => form(null);
  $$('[data-ed]', cont).forEach(b => b.onclick = () => form(lista.find(x => x.id === Number(b.dataset.ed))));
  $$('[data-del]', cont).forEach(b => b.onclick = async () => { if (!(await confirmar('¿Quitar esta campaña? Las visitas ya cargadas la conservan.', 'Quitar', true))) return; try { await api('DELETE', '/campanas/' + b.dataset.del); bloqueCampanas(cont); } catch (e) { fail(e); } });
  $$('[data-on]', cont).forEach(b => b.onclick = async () => { try { await api('PUT', '/campanas/' + b.dataset.on, { activo: true }); bloqueCampanas(cont); } catch (e) { fail(e); } });
}

function pasada(fecha, hora) { const a = ahoraAR(); const h = hoyAR(); return fecha < h || (fecha === h && hora < a.hora); }
