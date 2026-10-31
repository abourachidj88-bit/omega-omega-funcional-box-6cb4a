'use strict';
// ---------- Módulo 3: Administrador de clientes ----------

vista('/clientes', ['admin', 'profesor'], async (main) => {
  const esAdmin = S.user.rol === 'admin';
  const clientes = await api('GET', '/clientes');
  main.innerHTML = `
    <div class="page-title"><h1>${esAdmin ? 'Clientes' : 'Alumnos'}</h1>
      <div class="actions">
        ${puede('cli.editar') ? '<a class="btn primary" href="#/clientes/nuevo">Nuevo alumno</a><button id="b-imp">Importar Excel</button>' : ''}
        <button id="b-exp">Exportar a Excel</button></div></div>
    <div id="lst"></div>`;
  const lst = listadoClientes($('#lst', main), clientes, esAdmin);
  $('#b-exp', main).onclick = () => {
    const filas = lst.filtrados.map(c => {
      const f = { 'Nombre y Apellido': c.nombre, 'Fecha de alta': c.fecha_alta };
      if (esAdmin) f['Precio del plan'] = c.precio_plan;
      Object.assign(f, { 'Fecha de baja': c.fecha_baja, 'Celular': c.celular, 'Instagram': c.instagram, 'Última clase': c.ultima_clase || '', 'Estado de alta': textoAlta(c), 'Asistencia': c.texto_asistencia, 'Asistencias totales': c.total_asistencias });
      return f;
    });
    if (!filas.length) return toast('No hay alumnos para exportar', 'warn');
    descargarXlsx('omega-clientes-' + hoyAR() + '.xlsx', { Clientes: filas });
  };
  if (puede('cli.editar')) $('#b-imp', main).onclick = importarClientes;
});

// ----- Importar desde Excel / Sheets (archivo .xlsx, .xls o .csv)
// Dos caminos: la planilla modelo de OMEGA (con lista desplegable de planes) o cualquier otro archivo de la PC.
// Solo el nombre y apellido es obligatorio. Importar otra vez el mismo archivo (o uno con más datos) no duplica: actualiza.
function leerFilasClientes(wb) {
  const nombreHoja = wb.SheetNames.find(n => norm(n) === 'clientes') || wb.SheetNames[0];
  const filasRaw = XLSX.utils.sheet_to_json(wb.Sheets[nombreHoja], { defval: '' });
  return filasRaw.map(r => {
    const o = { nombre: '', apellido: '' };
    for (const [k, v] of Object.entries(r)) {
      const n = norm(k);
      if (v === '' || v === null || v === undefined) continue;
      if (n.includes('apellido')) o.apellido = String(v).trim();
      else if (n.includes('nombre') || n.includes('alumno') || n.includes('cliente')) o.nombre = String(v).trim();
      else if (n.includes('baja') || n.includes('vencim')) o.fecha_baja = aFechaISO(v);
      else if (n.includes('alta') || n.includes('ingreso') || n.includes('inicio')) o.fecha_alta = aFechaISO(v);
      else if (n.includes('precio') || n.includes('cuota') || n.includes('monto') || n.includes('importe') || n.includes('valor')) o.precio_plan = v;
      else if (n === 'plan' || n.includes('plan') || n.includes('abono') || n.includes('membresia')) o.plan = String(v).trim();
      else if (n.includes('cel') || n.includes('tel') || n.includes('contacto') || n.includes('whats') || n.includes('movil')) o.celular = String(v).trim();
      else if (n.includes('insta')) o.instagram = String(v).trim();
    }
    const nom = o.nombre && o.apellido && !norm(o.nombre).includes(norm(o.apellido)) ? o.nombre + ' ' + o.apellido : (o.nombre || o.apellido);
    const f = { nombre: nom };
    for (const k of ['fecha_alta', 'fecha_baja', 'precio_plan', 'plan', 'celular', 'instagram']) if (o[k] !== undefined && o[k] !== '') f[k] = o[k];
    return f;
  }).filter(r => r.nombre);
}
function importarClientes() {
  const m = modal('Importar clientes desde Excel', `
    <div class="grid2" style="gap:12px">
      <div class="card" style="margin:0"><h4 style="margin-top:0">Opción 1 · Planilla modelo</h4>
        <p class="small muted">Descargá la planilla, completala y volvé a subirla. La columna <b>Plan</b> tiene una lista desplegable con los planes que cargaste en OMEGA, con sus precios.</p>
        <button id="plantilla">Descargar planilla modelo</button></div>
      <div class="card" style="margin:0"><h4 style="margin-top:0">Opción 2 · Otro archivo de tu PC</h4>
        <p class="small muted">Sirve cualquier Excel o CSV con tus alumnos. <b>Solo el nombre y apellido es obligatorio</b>; el resto (plan, fechas, celular, Instagram) es opcional.</p></div></div>
    <div class="field" style="margin-top:12px"><label>Archivo a importar (Excel o CSV)</label><input type="file" id="arch" accept=".xlsx,.xls,.csv"></div>
    <p class="small muted">Se crea la ficha y el acceso a la app web de cada alumno. Podés importar otro archivo más tarde con los datos que faltaban: <b>no se duplica nadie</b>, se completan los que ya existen y se agregan los nuevos.</p>
    <div id="imp-res"></div>`, { wide: true });
  $('#plantilla', m).onclick = async () => {
    try {
      const planes = await api('GET', '/planes');
      if (!planes.length) toast('Todavía no cargaste planes: la lista desplegable saldrá vacía. Cargalos en Finanzas → Planes.', 'warn');
      descargarArchivo('omega-planilla-clientes.xlsx', XlsxModelo.planillaClientes(planes));
    } catch (e) { fail(e); }
  };
  $('#arch', m).onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    const res = $('#imp-res', m); res.innerHTML = '<div class="empty"><span class="spinner"></span></div>';
    try {
      const wb = XLSX.read(await f.arrayBuffer(), { type: 'array', cellDates: true });
      const filas = leerFilasClientes(wb);
      if (!filas.length) { res.innerHTML = '<div class="warnbox">No encontré filas con nombre. Revisá que la primera fila tenga los títulos de columna (por ejemplo “Nombre y Apellido”).</div>'; return; }
      res.innerHTML = `<div class="infobox">Se leyeron <b>${filas.length}</b> filas de “${esc(f.name)}”.</div><div class="row" style="margin-top:10px"><button class="primary" id="go">Importar ${filas.length} alumnos</button></div>`;
      $('#go', res).onclick = async (ev) => {
        ev.target.disabled = true;
        try {
          const r = await api('POST', '/clientes/importar', { filas });
          res.innerHTML = `<div class="okbox">Listo: <b>${r.creados}</b> nuevos · <b>${r.actualizados}</b> actualizados · <b>${r.sin_cambios || 0}</b> sin cambios · <b>${r.errores.length}</b> con error.</div>
            ${r.avisos && r.avisos.length ? `<div class="infobox" style="margin-top:8px">${r.avisos.slice(0, 15).map(esc).join('<br>')}</div>` : ''}
            ${r.errores.length ? `<div class="warnbox" style="margin-top:8px">${r.errores.slice(0, 15).map(esc).join('<br>')}</div>` : ''}
            ${r.accesos.length ? `<p class="small muted" style="margin-top:10px">A cada alumno nuevo se le creó un acceso a la app (usuario y contraseña inicial). Descargá la lista para repartirla.</p>
            <button id="dl-acc">Descargar accesos (Excel)</button>` : ''}`;
          const b = $('#dl-acc', res); if (b) b.onclick = () => descargarXlsx('omega-accesos-alumnos.xlsx', { Accesos: r.accesos.map(a => ({ 'Nombre y Apellido': a.nombre, Usuario: a.usuario, Contraseña: a.clave })) });
          toast('Importación terminada');
        } catch (er) { fail(er); ev.target.disabled = false; }
      };
    } catch (er) { res.innerHTML = ''; fail(new Error('No se pudo leer el archivo: ' + er.message)); }
  };
}

// ----- Alta de alumno
vista('/clientes/nuevo', ['admin', 'profesor'], async (main) => {
  main.innerHTML = `<div class="page-title"><a class="btn ghost sm" href="#/clientes">← Clientes</a><h1>Nuevo alumno</h1></div><div class="card" id="form"></div>`;
  await formAlta($('#form', main), null);
});

async function formAlta(cont, c) {
  const esAdmin = S.user.rol === 'admin';
  const nuevo = !c;
  let planes = [];
  if (esAdmin) { try { planes = await api('GET', '/planes'); } catch (_) {} }
  let pre = null;
  if (nuevo) { try { pre = JSON.parse(sessionStorage.getItem('omega_prelead') || 'null'); sessionStorage.removeItem('omega_prelead'); } catch (_) {} }
  if (pre) c = null;
  let foto = undefined; // undefined = sin cambios
  cont.innerHTML = `<form id="f" class="stack">
    <div class="row" style="align-items:flex-start;flex-direction:row-reverse;justify-content:space-between">
      <div class="photo-slot" title="Tocá para elegir una foto (opcional)">
        <span id="foto-prev">${c ? avatar(c, 'lg') : '<span class="avatar lg">+</span>'}</span>
        <input type="file" id="foto" accept="image/*"></div>
      <div class="grow fgrid" style="min-width:240px">
        ${campo('a) Nombre y apellido *', `<input name="nombre" required value="${esc(c ? c.nombre : pre ? pre.nombre : '')}" autocomplete="off">`)}
        ${campo('c) Fecha de alta', `<input type="date" name="fecha_alta" value="${esc(c ? c.fecha_alta : hoyAR())}">`)}
        ${esAdmin && planes.length ? campo('Plan', `<select name="plan_id"><option value="">Sin plan fijo</option>${planes.map(p => `<option value="${p.id}" data-pe="${p.precio_efectivo}" data-pm="${p.precio_mp}" ${c && c.plan_id === p.id ? 'selected' : ''}>${esc(p.nombre)} · ${money(p.precio_efectivo)} efectivo / ${money(p.precio_mp)} MP</option>`).join('')}</select>`) : ''}
        ${esAdmin ? campo('d) Precio del plan ($)', `<input type="number" name="precio_plan" min="0" step="1" value="${c ? c.precio_plan ?? 0 : ''}" inputmode="numeric">`) : ''}
        ${esAdmin && nuevo ? campo('Pago del alta (opcional)', `<select name="metodo_pago"><option value="">Todavía no pagó</option><option value="efectivo">Efectivo (entra a la caja)</option><option value="mercadopago">Mercado Pago</option></select>`) : ''}
        ${campo('e) Fecha de baja', `<input type="date" name="fecha_baja" value="${esc(c ? c.fecha_baja : '')}">
          <div class="small muted" style="margin-top:4px">Si la dejás vacía se completa sola (alta + 1 mes) y se corre un mes con cada renovación.</div>`)}
        ${campo('f) Celular o contacto', `<input name="celular" inputmode="tel" value="${esc(c ? c.celular : pre ? pre.celular : '')}" autocomplete="off">`)}
        ${campo('g) Instagram', `<input name="instagram" placeholder="usuario" value="${esc(c ? c.instagram : pre ? pre.instagram : '')}" autocapitalize="none">`)}
      </div></div>
    ${nuevo ? '<label class="row" style="color:var(--txt);font-size:.95rem"><input type="checkbox" name="crear_acceso" checked> Crear acceso a la app para el alumno (usuario y contraseña)</label>' : ''}
    <div class="small muted">Los campos b) foto, f) celular y g) Instagram son opcionales.</div>
    <div class="row sticky-act"><button class="primary" type="submit">${nuevo ? 'Crear alumno' : 'Guardar cambios'}</button>${nuevo ? '' : ''}</div></form>`;
  const sp = $('[name=plan_id]', cont), pp = $('[name=precio_plan]', cont), mp = $('[name=metodo_pago]', cont);
  const precioSegunMedio = () => { const o = sp && sp.selectedOptions[0]; if (!o || !o.dataset.pe || !pp) return; pp.value = (mp && mp.value === 'mercadopago') ? o.dataset.pm : o.dataset.pe; };
  if (sp) sp.onchange = precioSegunMedio; if (mp) mp.onchange = precioSegunMedio;
  $('#foto', cont).onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { foto = await fotoMiniatura(f); $('#foto-prev', cont).innerHTML = `<img class="avatar lg" src="${foto}" alt="">`; } catch (er) { fail(er); }
  };
  $('#f', cont).onsubmit = async (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target));
    const body = { nombre: fd.nombre, fecha_alta: fd.fecha_alta, fecha_baja: fd.fecha_baja || null, celular: fd.celular, instagram: fd.instagram };
    if (esAdmin) { body.precio_plan = fd.precio_plan === '' ? 0 : fd.precio_plan; if (fd.plan_id !== undefined) body.plan_id = fd.plan_id || null; if (nuevo && fd.metodo_pago) { body.metodo_pago = fd.metodo_pago; body.monto = body.precio_plan; } }
    if (foto !== undefined) body.foto = foto;
    const btn = $('button[type=submit]', cont); btn.disabled = true;
    try {
      if (nuevo) {
        body.crear_acceso = !!fd.crear_acceso;
        const r = await api('POST', '/clientes', body);
        toast('Alumno creado');
        if (r.acceso) S.accesoNuevo = { id: r.id, acceso: r.acceso, nombre: fd.nombre };
        ir('#/clientes/' + r.id);
      } else {
        await api('PUT', '/clientes/' + c.id, body);
        toast('Cambios guardados');
        render();
      }
    } catch (er) { fail(er); btn.disabled = false; }
  };
}

// ----- Ficha del alumno: solapas “Alta” y “Asistencias”
vista('/clientes/:id', ['admin', 'profesor'], async (main, { id }) => {
  const esAdmin = S.user.rol === 'admin';
  const c = await api('GET', '/clientes/' + id);
  const activo = c.semaforo_alta === 'verde';
  const restan = Math.round((Date.parse(c.fecha_baja) - Date.parse(hoyAR())) / 86400000);
  main.innerHTML = `
    <div class="page-title"><a class="btn ghost sm" href="#/clientes">← ${esAdmin ? 'Clientes' : 'Alumnos'}</a></div>
    <div class="row" style="align-items:flex-start;justify-content:space-between;flex-direction:row-reverse;gap:14px">
      ${avatar(c, 'lg')}
      <div class="grow" style="min-width:220px"><h1 class="t-${esc(c.semaforo_alta)}" style="margin-bottom:6px">${esc(c.nombre)}</h1>
        <div class="row"><span class="pill ${esc(c.semaforo_alta)}">${dot(c.semaforo_alta)} ${esc(c.estado_alta)}</span>
        <span class="pill ${esc(c.semaforo_asistencia)}">${dot(c.semaforo_asistencia)} ${esc(c.texto_asistencia)}</span></div>
        <div class="row" style="margin-top:10px">
          ${puede('cli.renovar') ? '<button id="b-renovar" class="primary">Renovar plan</button>' : ''}
          ${puede('cli.editar') ? `<button id="b-acceso">${c.usuario ? 'Restablecer acceso a la app' : 'Crear acceso a la app'}</button>` : ''}
          ${puede('asist.registrar') ? '<a class="btn" href="#/asistencias/cargar" id="b-asist">Cargar asistencia</a>' : ''}
          ${botonWA(c.celular)}
          ${puede('cli.eliminar') ? '<button id="b-del" class="danger">Eliminar</button>' : ''}</div></div></div>
    ${c.falta_pago ? `<div class="aviso-amarillo"><b>⚠ Falta registrar pago.</b> La fecha de baja se movió hacia adelante sin un pago asociado. Usá “Renovar plan” para cargarlo.</div>` : ''}
    <div class="sum">
      <div class="kpi"><div class="l">${activo ? 'Vence / se da de baja' : 'Baja desde'}</div><div class="v">${fmtF(c.fecha_baja)}</div></div>
      <div class="kpi"><div class="l">${activo ? 'Días restantes' : 'Meses de baja'}</div><div class="v ${activo ? '' : 't-' + esc(c.semaforo_alta)}">${activo ? restan : c.meses_baja}</div></div>
      ${esAdmin ? `<div class="kpi"><div class="l">Precio del plan</div><div class="v">${money(c.precio_plan)}</div></div>` : ''}
      <div class="kpi"><div class="l">Asistencias totales</div><div class="v">${c.total_asistencias}</div></div>
      <div class="kpi"><div class="l">Última clase</div><div class="v" style="font-size:1rem">${fmtUltima(c.ultima_clase)}</div></div>
      <div class="kpi"><div class="l">Cumplimiento (${c.objetivo_semanal} por semana)</div><div class="v">${c.cumplimiento_objetivo}%</div></div>
    </div>
    <div class="tabs"><button data-t="alta" class="on">Alta</button><button data-t="asist">Asistencias</button><button data-t="rut">Rutinas</button><button data-t="seg">Seguimiento</button></div>
    <div id="tab"></div>`;
  const tab = $('#tab', main);
  function verAlta() {
    const card = document.createElement('div'); card.className = 'card'; tab.replaceChildren(card);
    formAlta(card, c).catch(fail);
    if (c.pagos && c.pagos.length) {
      const p = document.createElement('div'); p.className = 'card';
      p.innerHTML = `<h3>Pagos registrados</h3><div class="tablewrap"><table><thead><tr><th>Fecha</th><th>Concepto</th><th>Medio</th><th>Cubre hasta</th><th class="num">Ingreso neto</th><th></th></tr></thead><tbody>${c.pagos.map(x => `<tr style="cursor:default"><td>${fmtF(x.fecha)}</td><td>${esc(x.concepto || '')}</td><td>${x.metodo === 'efectivo' ? 'Efectivo' : x.metodo === 'mercadopago' ? 'Mercado Pago' : '—'}</td><td>${fmtF(x.cubre_hasta)}</td><td class="num">${money(x.monto)}${x.descuento ? `<div class="small muted">Plan Full ${money(x.plan_full)} − desc. ${money(x.descuento)}</div>` : ''}</td><td class="right">${puede('cli.deshacer_pago') ? `<button class="danger sm" data-undo="${x.id}" title="Anula el pago, retrocede la fecha de baja y quita el ingreso">Deshacer pago</button>` : ''}</td></tr>`).join('')}</tbody></table></div>`;
      tab.appendChild(p);
      $$('[data-undo]', p).forEach(b => b.onclick = async () => {
        if (!(await confirmar('Se anula este pago: la fecha de baja vuelve atrás y el ingreso se quita de la Caja (efectivo) o del reporte (Mercado Pago). ¿Seguimos?', 'Deshacer pago', true))) return;
        try { const r = await api('POST', '/pagos/' + b.dataset.undo + '/anular'); toast('Pago anulado. Nueva baja: ' + fmtF(r.fecha_baja) + (r.de_caja ? ' · salió de la Caja' : '')); render(); } catch (e) { fail(e); }
      });
    }
  }
  async function verRut() {
    tab.innerHTML = '<div class="card"><div class="empty"><span class="spinner"></span></div></div>';
    let asig = [], rutinas = [];
    try { [asig, rutinas] = await Promise.all([api('GET', '/rutinas/asignaciones?cliente_id=' + c.id), api('GET', '/rutinas')]); } catch (e) { return fail(e); }
    tab.innerHTML = `<div class="card"><div class="row between"><h3 style="margin:0">Rutinas de ${esc(c.nombre.split(' ')[0])}</h3>${!puede('plan.rutinas_editar') ? '' : rutinas.length ? '<button class="primary sm" id="r-as">＋ Asignar rutina</button>' : '<a class="btn sm" href="#/planificacion/rutinas">Crear una rutina</a>'}</div>
      ${asig.length ? asig.map(a => `<div class="list-item"><div class="grow"><b>${esc(a.rutina)}</b><div class="small muted">${esc(a.dias_txt)} · ≈ ${a.duracion_min} min</div><div class="small">${a.profesor ? 'Seguimiento: <b>' + esc(a.profesor) + '</b>' : '<span class="muted">Sin profesor de seguimiento</span>'}</div></div><button class="sm" data-v="${a.rutina_id}">Ver</button>${puede('plan.rutinas_editar') ? `<button class="ghost sm" data-q="${a.id}">Quitar</button>` : ''}</div>`).join('') : '<div class="muted" style="margin-top:8px">Este cliente todavía no tiene rutinas asignadas.</div>'}</div>`;
    const as = $('#r-as', tab); if (as) as.onclick = () => {
      const m = modal('Elegir rutina', rutinas.map(r => `<div class="list-item" data-r="${r.id}" style="cursor:pointer"><div class="grow"><b>${esc(r.nombre)}</b><div class="small muted">${r.ejercicios} ejercicios · ≈ ${r.duracion_min} min</div></div><span class="pill">Elegir ›</span></div>`).join(''));
      $$('[data-r]', m).forEach(el => el.onclick = () => { m.close(); asignarRutina(rutinas.find(x => x.id === Number(el.dataset.r)), verRut, { id: c.id, nombre: c.nombre }).catch(fail); });
    };
    $$('[data-q]', tab).forEach(b => b.onclick = async () => { try { await api('DELETE', '/rutinas/asignaciones/' + b.dataset.q); verRut(); } catch (e) { fail(e); } });
    $$('[data-v]', tab).forEach(b => b.onclick = async () => { try { const r = await api('GET', '/rutinas/' + b.dataset.v); modal(r.nombre, rutinaHtml(r)); } catch (e) { fail(e); } });
  }
  // ---- Seguimiento del alumno
  async function verSeg() {
    tab.innerHTML = '<div class="card"><div class="empty"><span class="spinner"></span></div></div>';
    let d; try { d = await api('GET', '/clientes/' + c.id + '/seguimiento'); } catch (e) { return fail(e); }
    const edita = puede('cli.seguimiento'), maxC = Math.max(1, ...d.por_clase.map(x => x.n));
    const notaTxt = (v) => v == null ? '<span class="muted">sin cargar</span>' : `<b class="${v >= 8 ? 't-verde' : v >= 5 ? 't-amarillo' : 't-rojo'}">${v}/10</b>`;
    const sa = d.semana_actual;
    tab.innerHTML = `
      <div class="grid k" style="margin-bottom:14px"><div class="kpi"><div class="v">${d.clases}</div><div class="l">1 · Clases que realizó</div></div>
        <div class="kpi"><div class="v">${d.rutinas}</div><div class="l">Entrenamientos con rutina</div></div>
        <div class="kpi"><div class="v" style="font-size:1.3rem">${notaTxt(sa.sensacion)}</div><div class="l">4 · Cómo se siente esta semana (él/ella)</div></div>
        <div class="kpi"><div class="v" style="font-size:1.3rem">${notaTxt(sa.progreso)}</div><div class="l">5 · Progreso esta semana (profesores)</div></div></div>
      <div class="grid c2">
        <div class="card"><h3>2 · Clases a las que más asistió</h3>${d.por_clase.length ? d.por_clase.map(x => `<div class="row" style="margin-bottom:6px;flex-wrap:nowrap">${chipFormato(x.clase === 'Sin formato' ? null : { nombre: x.clase, color: x.color })}<div class="grow"><div class="meter"><i style="width:${Math.round(100 * x.n / maxC)}%"></i></div></div><b>${x.n}</b></div>`).join('') : '<div class="empty">Todavía no asistió a ninguna clase.</div>'}</div>
        <div class="card"><h3>3 · Días y horarios a los que más asistió</h3>${d.dias_horarios.length ? `<div class="small muted" style="margin-bottom:6px">Combinaciones más frecuentes</div>${d.dias_horarios.map((x, i) => `<div class="list-item"><div class="grow">${i === 0 ? '🏆 ' : ''}<b>${x.dia} ${hh(x.hora)}</b></div><span class="pill">${x.n} ${x.n === 1 ? 'vez' : 'veces'}</span></div>`).join('')}
          <div class="small muted" style="margin:8px 0 4px">Por día: ${d.por_dia.map(x => esc(x.dia) + ' (' + x.n + ')').join(' · ')}</div>` : '<div class="empty">Sin datos todavía.</div>'}</div></div>
      <div class="card" style="margin-top:14px"><h3>5 · Progreso semanal (calificación de los profesores)</h3>
        ${edita ? `<div class="row" style="margin-bottom:8px;flex-wrap:wrap"><span class="small muted">Semana del ${fmtF(sa.semana)}:</span>${Array.from({ length: 10 }, (_, i) => `<button class="sm ${sa.progreso === i + 1 ? 'primary' : ''}" data-pr="${i + 1}">${i + 1}</button>`).join('')}</div>` : ''}
        ${d.semanas.length ? `<div class="tablewrap"><table><thead><tr><th>Semana</th><th class="num">Se siente (alumno)</th><th class="num">Progreso (profesor)</th><th>Cargó</th></tr></thead><tbody>${d.semanas.map(x => `<tr style="cursor:default"><td>${fmtF(x.semana)}</td><td class="num">${notaTxt(x.sensacion)}</td><td class="num">${notaTxt(x.progreso)}</td><td>${esc(x.profesor || '')}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">Todavía no hay calificaciones.</div>'}
        <p class="small muted" style="margin-top:6px">La calificación “cómo se siente” la carga el propio alumno desde su celular una vez por semana.</p></div>
      <div class="card" style="margin-top:14px"><h3>6 · Comentarios</h3>
        ${edita ? `<div class="row" style="align-items:flex-end;margin-bottom:10px;flex-wrap:wrap"><div class="grow" style="min-width:220px"><textarea id="com-t" rows="2" maxlength="1000" placeholder="Lo que conversaste con el alumno…" style="width:100%"></textarea></div><input type="date" id="com-f" value="${hoyAR()}" style="width:auto"><button class="primary" id="com-ok">Agregar comentario</button></div>` : ''}
        ${d.comentarios.length ? d.comentarios.map(x => `<div class="list-item"><div class="grow"><div class="small muted">${fmtF(x.fecha)} · ${esc(x.autor || '')}</div>${esc(x.texto)}</div>${edita ? `<button class="ghost sm" data-dc="${x.id}">Quitar</button>` : ''}</div>`).join('') : '<div class="empty">Sin comentarios.</div>'}</div>`;
    $$('[data-pr]', tab).forEach(b => b.onclick = async () => { try { await api('PUT', '/clientes/' + c.id + '/seguimiento', { progreso: Number(b.dataset.pr) }); verSeg(); } catch (e) { fail(e); } });
    const ok = $('#com-ok', tab); if (ok) ok.onclick = async () => {
      const t = $('#com-t', tab).value.trim(); if (!t) return toast('Escribí el comentario', 'warn');
      try { await api('POST', '/comentarios', { tipo: 'cliente', ref_id: c.id, texto: t, fecha: $('#com-f', tab).value }); verSeg(); } catch (e) { fail(e); }
    };
    $$('[data-dc]', tab).forEach(b => b.onclick = async () => { try { await api('DELETE', '/comentarios/' + b.dataset.dc); verSeg(); } catch (e) { fail(e); } });
  }
  function verAsist() {
    const sem = c.semanas.map(s => ({ x: s.desde.slice(8, 10) + '/' + s.desde.slice(5, 7), v: s.asistencias, color: s.asistencias >= c.objetivo_semanal ? 'var(--verde)' : '' }));
    tab.innerHTML = `
      <div class="card"><h3>Asistencia por semana (últimas 12)</h3>
        <div class="legend"><span><i style="background:var(--verde)"></i>Cumplió el objetivo de ${c.objetivo_semanal} clases</span><span><i style="background:var(--brand)"></i>Por debajo del objetivo</span></div>
        ${barras(sem, { min: 3 })}</div>
      ${c.mensual.length ? `<div class="card"><h3>Asistencia mensual</h3>${barras(c.mensual.map(m => ({ x: m.mes.slice(5) + '/' + m.mes.slice(2, 4), v: m.n })))}</div>` : ''}
      <div class="card"><h3>Clases asistidas (${c.asistencias.length}${c.total_asistencias > c.asistencias.length ? ' últimas' : ''})</h3>
        ${c.asistencias.length ? `<div class="tablewrap"><table><thead><tr><th>Fecha</th><th>Horario</th><th>Formato</th><th>Cómo</th><th></th></tr></thead><tbody>${c.asistencias.map(a => `<tr style="cursor:default"><td>${fmtFlargo(a.fecha)}</td><td>${hh(a.hora)}</td><td>${esc(a.formato || '—')}</td><td>${a.origen === 'qr' ? 'QR' : 'Manual'}</td><td class="right"><button class="danger sm" data-del="${a.id}">Quitar</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">Todavía no tiene asistencias registradas.</div>'}</div>`;
    $$('[data-del]', tab).forEach(b => b.onclick = async () => {
      if (!(await confirmar('¿Quitar esta asistencia?', 'Quitar', true))) return;
      try { await api('DELETE', '/asistencias/' + b.dataset.del); toast('Asistencia quitada'); render(); } catch (e) { fail(e); }
    });
  }
  $$('.tabs button', main).forEach(b => b.onclick = () => { $$('.tabs button', main).forEach(x => x.classList.toggle('on', x === b)); b.dataset.t === 'alta' ? verAlta() : b.dataset.t === 'rut' ? verRut() : b.dataset.t === 'seg' ? verSeg() : verAsist(); });
  verAlta();
  if (S.accesoNuevo && S.accesoNuevo.id === c.id) { const a = S.accesoNuevo; S.accesoNuevo = null; mostrarAcceso(a.acceso, a.nombre); }

  const basist = $('#b-asist', main); if (basist) basist.onclick = (e) => { e.preventDefault(); sessionStorage.setItem('omega_pre', String(c.id)); ir('#/asistencias/cargar'); };
  const bacc = $('#b-acceso', main); if (bacc) bacc.onclick = async () => {
    if (c.usuario && !(await confirmar('Se genera una contraseña nueva para ' + c.nombre + ' (usuario: ' + c.usuario + '). La anterior deja de funcionar.', 'Generar nueva'))) return;
    try { mostrarAcceso(await api('POST', '/clientes/' + c.id + '/acceso'), c.nombre, c.usuario ? null : render); } catch (e) { fail(e); }
  };
  {
    const bren = $('#b-renovar', main); if (bren) bren.onclick = async () => {
      let planes = [], descs = []; try { [planes, descs] = await Promise.all([api('GET', '/planes'), api('GET', '/descuentos')]); } catch (_) {}
      const plan = planes.find(p => p.id === c.plan_id) || null, pend = c.descuento_pendiente || null;
      const optD = '<option value="">Sin descuento</option>' + descs.map(d => `<option value="${d.id}" ${pend && pend.id === d.id ? 'selected' : ''}>${esc(d.nombre)}${pend && pend.id === d.id ? ' · pendiente del alumno (' + pend.restantes + (pend.restantes === 1 ? ' mes' : ' meses') + ')' : ''}</option>`).join('');
      const m = modal('Renovar plan', `<p>Se registra el pago y la baja se corre <b>1 mes</b> (o más) desde ${activo ? 'la fecha de vencimiento actual' : 'hoy'}.</p>
        <div class="fgrid">${campo('Meses', '<select id="meses">' + [1, 2, 3, 6, 12].map(n => `<option value="${n}">${n} ${n === 1 ? 'mes' : 'meses'}</option>`).join('') + '</select>')}
        ${campo('Método de pago *', `<select id="metodo"><option value="">Elegí cómo pagó…</option><option value="efectivo">Efectivo</option><option value="mercadopago">Mercado Pago</option></select>`)}
        ${campo('Descuento a aplicar', `<select id="desc" ${descs.length || pend ? '' : 'disabled'}>${optD}</select>`)}</div>
        ${pend && !descs.some(d => d.id === pend.id) ? '<div class="small t-amarillo">El descuento pendiente del alumno ya no está en la lista de descuentos activos.</div>' : ''}
        <div class="grid k" style="margin:10px 0"><div class="kpi"><div class="l">Plan Full</div><div class="v" id="r-full">—</div></div><div class="kpi amarillo"><div class="l">Descuento</div><div class="v" id="r-desc">—</div><div class="small muted" id="r-dn"></div></div><div class="kpi verde"><div class="l">Ingreso neto</div><div class="v" id="r-neto">—</div></div></div>
        <div class="small muted" id="nota">Elegí el método de pago para continuar.</div>
        <div class="row" style="justify-content:flex-end;margin-top:10px"><button data-close>Cancelar</button><button class="primary" id="ok" disabled>Registrar renovación</button></div>`);
      let calc = { full: 0, desc: 0, neto: 0 };
      const pm = () => {
        const met = $('#metodo', m).value, meses = Number($('#meses', m).value);
        const unit = plan ? (met === 'mercadopago' ? plan.precio_mp : plan.precio_efectivo) : (c.precio_plan || 0);
        const d = descs.find(x => String(x.id) === $('#desc', m).value) || null;
        const restan = d ? (pend && pend.id === d.id ? pend.restantes : d.meses) : 0;
        const k = d ? Math.min(meses, restan) : 0, porMes = d ? Math.min(unit, d.tipo === 'pct' ? unit * d.valor / 100 : d.valor) : 0;
        const full = Math.round(unit * meses), desc = Math.round(porMes * k);
        calc = { full, desc, neto: Math.max(0, full - desc) };
        $('#r-full', m).textContent = money(full); $('#r-desc', m).textContent = desc ? '− ' + money(desc) : money(0); $('#r-neto', m).textContent = money(calc.neto);
        $('#r-dn', m).textContent = d ? (k < meses ? 'aplica a ' + k + (k === 1 ? ' mes' : ' meses') + ' de ' + meses : esc(d.nombre)) : '';
        $('#ok', m).disabled = !met;
        $('#nota', m).innerHTML = !met ? 'Elegí el método de pago para continuar.' : met === 'efectivo' ? '💵 El ingreso neto entra a la <b>Caja</b> de hoy.' : '📱 Solo se actualiza la ficha del alumno: el dinero ya está en Mercado Pago.';
      };
      $('#meses', m).onchange = pm; $('#metodo', m).onchange = pm; $('#desc', m).onchange = pm; pm();
      $('#ok', m).onclick = async () => {
        try {
          const body = { meses: $('#meses', m).value, metodo_pago: $('#metodo', m).value, descuento_id: $('#desc', m).value ? Number($('#desc', m).value) : null };
          const r = await api('POST', '/clientes/' + c.id + '/renovar', body); m.close();
          toast('Renovado. Nueva baja: ' + fmtF(r.fecha_baja) + (r.descuento ? ' · descuento ' + money(r.descuento) : '') + (r.a_caja ? ' · sumado a la caja' : '')); render();
        } catch (e) { fail(e); }
      };
    };
    const bdel = $('#b-del', main); if (bdel) bdel.onclick = async () => {
      if (!(await confirmar('¿Eliminar a ' + c.nombre + ' con todo su historial? No se puede deshacer.', 'Eliminar', true))) return;
      try { await api('DELETE', '/clientes/' + c.id); toast('Alumno eliminado'); ir('#/clientes'); } catch (e) { fail(e); }
    };
  }
});
