'use strict';
// ---------- App del alumno: QR de ingreso, entrenamiento del día, horarios y perfil ----------

vista('/', ['cliente'], async (main) => {
  const [p, hoy] = await Promise.all([api('GET', '/mi-perfil'), api('GET', '/clase?fecha=' + hoyAR())]);
  const prox = hoy.clases.find(c => c.hora >= ahoraAR().hora) || null;
  main.innerHTML = `
    <div class="center" style="margin-bottom:14px"><div class="muted">Hola,</div><h1 style="margin:0">${esc(p.nombre.split(' ')[0])}</h1></div>
    <div class="center"><div class="qrbox"><div id="qr" style="min-height:200px;display:flex;align-items:center;justify-content:center"><span class="spinner"></span></div></div>
      <p class="muted" style="margin-top:12px">Mostrale este código al profesor al llegar.<br><span class="small">Se actualiza solo cada minuto.</span></p></div>
    <div class="grid c2" style="margin-top:14px">
      <div class="card"><div class="small muted">Tu plan</div><div class="row" style="margin-top:4px"><span class="pill ${esc(p.semaforo_alta)}">${dot(p.semaforo_alta)} ${esc(p.estado_alta)}</span></div>
        <div style="margin-top:8px">${p.semaforo_alta === 'verde' ? 'Vence el <b>' + fmtF(p.fecha_baja) + '</b> · te quedan <b>' + p.dias_restantes + '</b> días' : 'Venció el <b>' + fmtF(p.fecha_baja) + '</b>. Pasá por el gimnasio para renovarlo.'}</div></div>
      <div class="card"><div class="small muted">Tu asistencia</div><div class="row" style="margin-top:4px"><span class="pill ${esc(p.semaforo_asistencia)}">${dot(p.semaforo_asistencia)} ${esc(p.texto_asistencia)}</span></div>
        <div style="margin-top:8px">Objetivo: 3 clases por semana · cumplís el <b>${p.cumplimiento_objetivo}%</b></div></div></div>
    ${prox ? `<div class="card" style="margin-top:14px;cursor:pointer" onclick="ir('#/entrenamiento/${hoyAR()}/${prox.hora}')"><div class="small muted">Próxima clase de hoy</div><div class="row between"><div><b style="font-size:1.2rem">${hh(prox.hora)}</b> ${chipFormato(prox.formato)}</div><span class="pill">Ver ejercicios ›</span></div></div>` : ''}`;
  async function qr() {
    try { const r = await api('GET', '/mi-qr'); const el = $('#qr', main); if (el) el.innerHTML = `<div style="width:min(72vw,300px)">${qrSvg(r.codigo)}</div>`; } catch (e) { const el = $('#qr', main); if (el) el.innerHTML = '<span class="t-rojo small">' + esc(e.message) + '</span>'; }
  }
  qr(); addTimer(setInterval(qr, 60000));
});

vista('/entrenamiento', ['cliente'], (main) => entrenamiento(main, hoyAR(), null));
vista('/entrenamiento/:fecha/:hora', ['cliente'], (main, { fecha, hora }) => { const h = hora === 'rutina' ? -1 : parseInt(hora, 10); return entrenamiento(main, fecha, Number.isNaN(h) ? null : h); });

async function entrenamiento(main, fecha, hora) {
  const d = await api('GET', '/clase?fecha=' + fecha);
  if (hora === null) { const base = fecha === hoyAR() ? ahoraAR().hora : 0; const c = d.clases.find(x => x.hora >= base) || d.clases[d.clases.length - 1]; hora = c ? c.hora : null; }
  const cls = d.clases.find(c => c.hora === hora) || null;
  const verRutinaLibre = hora === -1 && d.rutina_libre;
  main.innerHTML = `
    <div class="page-title"><h1>Entrenamiento</h1></div>
    <div class="row" style="margin-bottom:10px"><button class="sm" id="ant">‹</button><b>${fmtFlargo(fecha)}</b><button class="sm" id="sig">›</button>${fecha !== hoyAR() ? '<button class="sm ghost" id="hoy">Hoy</button>' : ''}</div>
    ${d.clases.length || d.rutina_libre ? `<div class="quick">${d.clases.map(c => `<button data-h="${c.hora}" class="${c.hora === hora ? 'on' : ''}">${hh(c.hora)}</button>`).join('')}${d.rutina_libre ? `<button data-h="rutina" class="${hora === -1 ? 'on' : ''}">🏋 Rutina</button>` : ''}</div>` : '<div class="empty">No hay clases este día.</div>'}
    <div id="det"></div>`;
  $('#ant', main).onclick = () => ir('#/entrenamiento/' + sumaDias(fecha, -1) + '/auto');
  $('#sig', main).onclick = () => ir('#/entrenamiento/' + sumaDias(fecha, 1) + '/auto');
  const hb = $('#hoy', main); if (hb) hb.onclick = () => ir('#/entrenamiento');
  $$('[data-h]', main).forEach(b => b.onclick = () => ir('#/entrenamiento/' + fecha + '/' + b.dataset.h));
  const det = $('#det', main);
  if (hora === -1 && !d.rutina_libre) { det.innerHTML = '<div class="card center"><h3>Todavía no tenés rutinas</h3><p class="muted">Pedile a tu profesor que te asigne una rutina y vas a verla acá.</p></div>'; return; }
  if (verRutinaLibre) {
    const lista = d.rutinas && d.rutinas.length ? d.rutinas : [d.rutina_libre];
    if (lista.length > 1) {
      det.innerHTML = `<div class="infobox" style="margin-bottom:10px">Elegí la rutina que vas a hacer hoy:</div><div class="tabs" id="rut-tabs">${lista.map((r, i) => `<button data-ri="${i}" class="${i === 0 ? 'on' : ''}">${esc(r.nombre)}</button>`).join('')}</div><div id="rut-det">${rutinaHtml(lista[0])}</div>`;
      $$('[data-ri]', det).forEach(b => b.onclick = () => { $$('[data-ri]', det).forEach(x => x.classList.toggle('on', x === b)); $('#rut-det', det).innerHTML = rutinaHtml(lista[Number(b.dataset.ri)]); });
    } else det.innerHTML = rutinaHtml(lista[0]);
    return;
  }
  if (!cls) return;
  if (!cls.circuito) { det.innerHTML = `<div class="card"><div class="row">${chipFormato(cls.formato)}<b>${hh(cls.hora)}</b></div><p class="muted" style="margin-top:8px">Esta clase todavía no tiene los ejercicios cargados.</p></div>`; return; }
  const c = cls.circuito;
  const tieneRut = !!cls.rutina;
  det.innerHTML = `${tieneRut ? '<div class="tabs" id="pest"><button data-pt="c" class="on">' + esc(cls.formato ? cls.formato.nombre : 'Circuito') + '</button><button data-pt="r">Rutina</button></div>' : ''}<div id="pc"><div class="card"><div class="row between"><div class="row">${chipFormato(cls.formato)}<b style="font-size:1.2rem">${hh(cls.hora)}</b></div><button class="primary" id="vids">▶ Ver videos de la clase</button></div>
    <div class="small muted" style="margin-top:6px">${c.sin_trabajo ? 'Clase corrida de ' + (c.duracion_min || 60) + ' min' : 'Trabajo ' + seg(c.trabajo_seg) + (c.sin_descanso ? ' · sin descanso' : ' · descanso ' + seg(c.descanso_seg))} · 3 rounds de ${c.rondas[0].ejercicios.filter(e => !e.vacio).length} estaciones</div></div>
    ${c.rondas.map(r => `<div class="round" style="margin-top:12px"><h4>Round ${r.ronda} · ${r.ejercicios[0].nivel}</h4>${r.ejercicios.filter(e => !e.vacio).map(e => `<div class="ej"><span class="n">${e.slot + 1}.</span><div class="grow"><div class="n">${esc(e.nombre)}</div><div class="z">${esc(e.zona)}</div></div><button class="sm" data-p="${e.slot}" data-r="${r.ronda}" title="Ver las 3 posiciones">▣</button>${e.video ? `<button class="sm" data-v="${e.ejercicio_id}">▶</button>` : ''}</div>`).join('')}</div>`).join('')}</div>${tieneRut ? `<div id="pr" hidden>${rutinaHtml(cls.rutina)}</div>` : ''}`;
  $$('[data-pt]', det).forEach(b => b.onclick = () => { $$('[data-pt]', det).forEach(x => x.classList.toggle('on', x === b)); $('#pc', det).hidden = b.dataset.pt !== 'c'; $('#pr', det).hidden = b.dataset.pt !== 'r'; });
  $$('[data-p]', main).forEach(b => b.onclick = () => { const e = c.rondas[Number(b.dataset.r) - 1].ejercicios[Number(b.dataset.p)]; verPosiciones({ id: e.ejercicio_id, nombre: e.nombre, zona: e.zona, equipo: e.equipo, patron: e.patron, fotos: e.fotos, foto1: e.fotos }, null); });
  $('#vids', main).onclick = () => listaVideos(c);
  $$('[data-v]', main).forEach(b => b.onclick = () => { const e = c.rondas[0].ejercicios.find(x => x.ejercicio_id === Number(b.dataset.v)); modal(e.nombre, `<video src="${esc(urlVideo(e.video))}" controls playsinline autoplay style="width:100%;border-radius:12px;background:#000;max-height:60vh"></video>`); });
}

vista('/horarios', ['cliente'], async (main) => {
  let desde = lunesDe(hoyAR());
  async function cargar() {
    const g = await api('GET', '/grilla?desde=' + desde);
    main.innerHTML = `<div class="page-title"><h1>Clases de la semana</h1></div>
      <div class="row" style="margin-bottom:10px"><button class="sm" id="ant">‹</button><b>${fmtF(desde)} al ${fmtF(sumaDias(desde, 6))}</b><button class="sm" id="sig">›</button>${desde !== lunesDe(hoyAR()) ? '<button class="sm ghost" id="hoy">Esta semana</button>' : ''}</div>
      ${g.map(d => `<div class="card dia" style="margin-bottom:10px;${d.fecha === hoyAR() ? 'border-color:var(--brand)' : ''}"><div class="row between"><h3 style="margin:0">${fmtFlargo(d.fecha)}${d.fecha === hoyAR() ? ' <span class="pill verde">Hoy</span>' : ''}</h3><span class="small muted">${d.clases.length ? d.clases.length + ' clases' : ''}</span></div>
        ${d.clases.length ? d.clases.map(c => `<div class="clase-row" ${c.planificada ? `onclick="ir('#/entrenamiento/${d.fecha}/${c.hora}')"` : ''}><span class="hora">${hh(c.hora)}</span><div class="grow">${chipFormato(c.formato)}${c.profesor ? `<div class="small muted" style="margin-top:3px">Profe ${esc(c.profesor)}</div>` : ''}</div>${c.formato && !pasada(d.fecha, c.hora) ? `<button class="sm ${c.reservada ? 'primary' : ''}" data-res="${d.fecha}|${c.hora}|${c.reservada ? 1 : 0}" onclick="event.stopPropagation()">${c.reservada ? '✓ Reservada' : 'Reservar'}</button>` : ''}${c.planificada ? '<span class="pill">Ver ejercicios ›</span>' : '<span class="small muted">Ejercicios próximamente</span>'}</div>`).join('') : '<div class="muted small" style="margin-top:6px">No hay clases este día.</div>'}</div>`).join('')}`;
    $$('[data-res]', main).forEach(b => b.onclick = async (e) => {
      e.stopPropagation(); const [f, h, ya] = b.dataset.res.split('|');
      try { ya === '1' ? await api('POST', '/reservas/cancelar', { fecha: f, hora: Number(h) }) : await api('POST', '/reservas', { fecha: f, hora: Number(h) }); toast(ya === '1' ? 'Reserva cancelada' : 'Reservaste tu lugar'); await cargar(); } catch (er) { fail(er); }
    });
    $('#ant', main).onclick = () => { desde = sumaDias(desde, -7); cargar().catch(fail); };
    $('#sig', main).onclick = () => { desde = sumaDias(desde, 7); cargar().catch(fail); };
    const h = $('#hoy', main); if (h) h.onclick = () => { desde = lunesDe(hoyAR()); cargar().catch(fail); };
  }
  await cargar();
});

vista('/perfil', ['cliente'], async (main) => {
  const p = await api('GET', '/mi-perfil');
  main.innerHTML = `
    <div class="row" style="gap:14px;margin-bottom:12px">${avatar(p, 'lg')}<div><h1 style="margin:0">${esc(p.nombre)}</h1><div class="muted">Alumno desde ${fmtF(p.fecha_alta)}</div>
      <div class="row" style="margin-top:6px"><button class="sm" id="f-cam">📷 Sacar foto</button><button class="sm" id="f-gal">🖼 Elegir de la galería</button></div></div></div>
    ${p.whatsapp_gym ? `<div class="card"><a class="btn wa" href="${esc(p.whatsapp_gym)}" target="_blank" rel="noopener">${ICONO_WA} Escribinos por WhatsApp</a><span class="small muted" style="margin-left:8px">Consultas, cambios de plan, dudas.</span></div>` : ''}
    <div class="sum"><div class="kpi"><div class="l">Tu plan</div><div class="v" style="font-size:1.05rem">${p.semaforo_alta === 'verde' ? 'Vence ' + fmtF(p.fecha_baja) : 'Vencido'}</div></div>
      <div class="kpi"><div class="l">Días restantes</div><div class="v ${p.semaforo_alta === 'verde' ? '' : 't-rojo'}">${Math.max(0, p.dias_restantes)}</div></div>
      <div class="kpi"><div class="l">Clases asistidas</div><div class="v">${p.total_asistencias}</div></div>
      <div class="kpi"><div class="l">Cumplimiento</div><div class="v">${p.cumplimiento_objetivo}%</div></div></div>
    <div class="card"><h3>Asistencia por semana</h3><div class="legend"><span><i style="background:var(--verde)"></i>3 o más clases</span><span><i style="background:var(--brand)"></i>Menos de 3</span></div>${barras(p.semanas.map(s => ({ x: s.desde.slice(8) + '/' + s.desde.slice(5, 7), v: s.asistencias, color: s.asistencias >= 3 ? 'var(--verde)' : '' })), { min: 3 })}</div>
    <div class="card"><h3>Mis clases (${p.asistencias.length})</h3>${p.asistencias.length ? p.asistencias.slice(0, 30).map(a => `<div class="list-item"><div class="grow"><b>${fmtFlargo(a.fecha)}</b><div class="small muted">${hh(a.hora)} · ${esc(a.formato || '')}</div></div></div>`).join('') : '<div class="empty">Todavía no registraste clases.</div>'}</div>
    <div class="card" id="clave"></div>`;
  formClave($('#clave', main));
  const subir = async (cap) => { try { const foto = await pedirFoto(cap); if (!foto) return; await api('PUT', '/mi-perfil/foto', { foto }); toast('Foto actualizada'); render(); } catch (e) { fail(e); } };
  $('#f-cam', main).onclick = () => subir(true); $('#f-gal', main).onclick = () => subir(false);
});

// Rutina de musculación (series, repeticiones, peso, descanso)
function rutinaHtml(r) {
  const seg = (n) => n >= 60 ? Math.floor(n / 60) + ' min' + (n % 60 ? ' ' + (n % 60) + ' s' : '') : n + ' s';
  return `<div class="card"><div class="row between"><h3 style="margin:0">${esc(r.nombre)}</h3><span class="pill">≈ ${r.duracion_min} min</span></div>${r.descripcion ? `<p class="muted small">${esc(r.descripcion)}</p>` : ''}</div>
    <div class="card" style="margin-top:10px"><div class="tablewrap"><table><thead><tr><th>#</th><th>Ejercicio</th><th class="num">Series</th><th class="num">Reps</th><th>Peso</th><th>Descanso</th></tr></thead><tbody>
    ${r.items.map((i, n) => `<tr style="cursor:default"><td>${n + 1}</td><td><b>${esc(i.nombre || '—')}</b><div class="small muted">${esc(i.zona || '')}</div></td><td class="num">${i.series}</td><td class="num">${esc(String(i.repeticiones))}</td><td>${esc(i.peso || '—')}</td><td>${seg(i.descanso_seg)}</td></tr>`).join('')}</tbody></table></div></div>`;
}


// ----- El alumno escanea el QR fijo del gimnasio: elige Clase o Rutina
// Tarjeta para dejar la app en la pantalla de inicio del celular (Android: botón de instalar; iPhone: pasos de Safari)
function tarjetaInstalar() {
  if (window.OMEGA_DEMO || yaInstalada()) return '';
  const pasos = esIOS()
    ? '<ol class="small" style="padding-left:18px;margin:6px 0 0;line-height:1.6"><li>Tocá el botón <b>Compartir</b> <span aria-hidden="true">⬆️</span> de Safari.</li><li>Elegí <b>“Agregar a inicio”</b>.</li><li>Tocá <b>Agregar</b>.</li></ol>'
    : (eventoInstalar ? '<button class="primary" id="ti-ok" style="margin-top:8px">Agregar a mi pantalla de inicio</button>' : '<div class="small muted" style="margin-top:6px">En el menú del navegador (⋮) elegí <b>“Instalar aplicación”</b> o <b>“Agregar a pantalla de inicio”</b>.</div>');
  return `<div class="card" id="ti" style="margin-top:14px;text-align:left"><b>📲 Dejá un acceso directo en tu celular</b><div class="small muted">Así entrás a ${esc(S.marca.nombre || 'OMEGA')} con un toque, sin escanear de nuevo.</div>${pasos}</div>`;
}
function conectarInstalar(cont) {
  const b = $('#ti-ok', cont);
  if (b) b.onclick = async () => { try { eventoInstalar.prompt(); await eventoInstalar.userChoice; } catch (_) {} eventoInstalar = null; const t = $('#ti', cont); if (t) t.remove(); };
}
vista('/asistir/:k', ['cliente', 'admin', 'profesor'], async (main, { k }) => {
  if (S.user.rol !== 'cliente') {
    main.innerHTML = '<div class="card center"><h2>Registro de asistencia</h2><p class="muted">Este código es para que los alumnos registren su asistencia desde su celular. Para ver el cartel y descargarlo entrá a Asistencias → QR del gimnasio.</p><a class="btn primary" href="#/asistencias/qr-gimnasio">Ir a QR del gimnasio</a></div>';
    return;
  }
  let e;
  try { e = await api('GET', '/asistir/estado?k=' + encodeURIComponent(k)); }
  catch (er) { main.innerHTML = `<div class="card center"><h2>No se pudo leer el código</h2><p class="muted">${esc(er.message)}</p><a class="btn" href="#/">Ir al inicio</a></div>`; return; }
  const pintar = (res) => {
    const c = e.clase;
    main.innerHTML = `<div class="center" style="margin-bottom:14px"><div class="muted">Hola,</div><h1 style="margin:0">${esc(e.nombre.split(' ')[0])}</h1></div>
      ${res ? `<div class="okbox center" style="font-size:1.05rem">${res.modo === 'rutina' ? '✓ Visita registrada' : (res.duplicada ? 'Ya tenías registrada la clase de las <b>' + hh(res.hora) + '</b>' : '✓ Asistencia registrada · clase de las <b>' + hh(res.hora) + '</b>')}</div>` : ''}
      ${e.plan_vencido ? '<div class="warnbox" style="margin-top:10px">Tu plan está vencido. Pasá por recepción para renovarlo.</div>' : ''}
      ${!res ? `<div class="card center" style="margin-top:6px"><div class="muted">${c ? 'Clase de las' : 'Ahora no hay una clase'}</div>${c ? `<div style="font-size:2.2rem;font-weight:900">${hh(c.hora)}</div>${c.formato ? chipFormato(c.formato) : ''}` : '<div class="small muted">Podés registrar que viniste a entrenar con tu rutina.</div>'}
        ${c && c.registrada ? '<div class="small t-verde" style="margin-top:8px">Ya registraste esta clase ✓</div>' : ''}</div>
      <div class="grid c2" style="margin-top:12px"><button class="primary big" id="a-clase" ${c ? '' : 'disabled'} style="padding:22px 10px;font-size:1.2rem">🏋️ Clase</button><button class="big" id="a-rut" style="padding:22px 10px;font-size:1.2rem">📋 Rutina</button></div>` : `<div class="grid c2" style="margin-top:12px">${res.modo === 'rutina' ? '' : '<button id="a-rut2">📋 Hacer una rutina también</button>'}<a class="btn primary" href="#/entrenamiento/${e.fecha}/${res.modo === 'clase' ? res.hora : 'rutina'}">Ver mi entrenamiento</a></div>`}
      ${tarjetaInstalar()}`;
    conectarInstalar(main);
    const reg = async (modo) => {
      try {
        const r = await api('POST', '/asistir', { k, modo });
        if (modo === 'rutina') { ir('#/entrenamiento/' + e.fecha + '/rutina'); return; }
        e = await api('GET', '/asistir/estado?k=' + encodeURIComponent(k)); pintar(r);
        if (navigator.vibrate) navigator.vibrate(40);
      } catch (er) { fail(er); }
    };
    const bc = $('#a-clase', main); if (bc) bc.onclick = () => reg('clase');
    const br = $('#a-rut', main); if (br) br.onclick = () => reg('rutina');
    const b2 = $('#a-rut2', main); if (b2) b2.onclick = () => reg('rutina');
  };
  pintar(null);
});
