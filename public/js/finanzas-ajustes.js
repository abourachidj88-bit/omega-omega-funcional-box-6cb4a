'use strict';
// ---------- Submódulo financiero (solo administrador), usuarios (módulo 1) y ajustes ----------
const compacto = (n) => new Intl.NumberFormat('es-AR', { notation: 'compact', maximumFractionDigits: 1 }).format(n || 0);
const CATS_EGRESO = ['Salarios', 'Alquiler', 'Luz', 'Agua', 'Gas', 'Monotributo', 'IIBB', 'Tasas', 'Limpieza', 'Agua para clientes', 'Eventos', 'Marketing', 'Equipamiento', 'Mantenimiento', 'Otros'];
const CATS_FIJAS = ['Salarios', 'Alquiler', 'Luz', 'Agua', 'Gas', 'Monotributo', 'IIBB', 'Tasas'];
function mesMas(mes, n) { const [y, m] = mes.split('-').map(Number); return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7); }
function nombreMes(mes) { const [y, m] = mes.split('-').map(Number); return MESES[m - 1] + ' ' + y; }

vista('/finanzas/mes', ['admin', 'profesor'], async (main) => {
  let mes = sessionStorage.getItem('omega_mes') || hoyAR().slice(0, 7);
  async function cargar() {
    sessionStorage.setItem('omega_mes', mes);
    const [f, an] = await Promise.all([api('GET', '/finanzas?mes=' + mes), api('GET', '/finanzas/analisis?mes=' + mes)]);
    const max = Math.max(1, ...f.serie.map(s => Math.max(s.ingresos, s.egresos)));
    const faltan = f.punto_equilibrio_alumnos == null ? null : Math.max(0, f.punto_equilibrio_alumnos - f.alumnos_activos);
    const pct = f.punto_equilibrio_alumnos ? Math.min(100, Math.round(100 * f.alumnos_activos / f.punto_equilibrio_alumnos)) : 0;
    const totCat = Object.values(f.por_categoria).reduce((a, b) => a + b, 0) || 1;
    main.innerHTML = `
      <div class="page-title"><h1>Finanzas</h1><div class="actions"><button class="primary" id="b-egr">Cargar egreso</button><button id="b-ing">Otro ingreso</button><button id="b-rep" class="ghost">Copiar gastos fijos del mes anterior</button><button id="b-xls" class="ghost">Exportar</button></div></div>
      ${tabsFin('/finanzas/mes')}
      <div class="infobox" style="margin-bottom:12px">Esta información es privada: solo la ve el administrador. Los ingresos por cuotas se cargan solos cuando renovás un plan.</div>
      <div class="row" style="margin-bottom:12px"><button class="sm" id="ant">‹</button><input type="month" id="mes" value="${mes}" style="width:auto"><button class="sm" id="sig">›</button><b style="text-transform:capitalize">${nombreMes(mes)}</b></div>
      <div class="grid k" style="margin-bottom:14px">
        <div class="kpi verde"><div class="v">${money(f.ingresos)}</div><div class="l">Ingresos</div></div>
        <div class="kpi rojo"><div class="v">${money(f.egresos)}</div><div class="l">Egresos</div></div>
        <div class="kpi ${f.ganancia_neta >= 0 ? 'verde' : 'rojo'}"><div class="v">${money(f.ganancia_neta)}</div><div class="l">Ganancia neta</div></div>
        <div class="kpi"><div class="v">${f.punto_equilibrio_alumnos ?? '—'}</div><div class="l">Alumnos para el punto de equilibrio</div></div></div>
      <div class="grid c2">
        <div class="card"><h3>Punto de equilibrio</h3>
          <p class="muted small">Es lo que tiene que facturar el gimnasio para cubrir los gastos fijos (${money(f.gastos_fijos)} este mes)${f.gastos_variables ? ' considerando los gastos variables' : ''}.</p>
          <div class="row between"><span>Facturación necesaria</span><b>${money(f.punto_equilibrio_monto)}</b></div>
          <div class="row between"><span>Ticket promedio por alumno activo</span><b>${money(f.ticket_promedio)}</b></div>
          <div class="row between" style="margin-bottom:8px"><span>Alumnos activos hoy</span><b>${f.alumnos_activos}${f.punto_equilibrio_alumnos ? ' de ' + f.punto_equilibrio_alumnos : ''}</b></div>
          ${f.punto_equilibrio_alumnos ? `<div class="meter"><i style="width:${pct}%"></i></div><div class="small ${faltan ? 't-amarillo' : 't-verde'}" style="margin-top:6px">${faltan ? 'Faltan ' + faltan + ' alumnos para cubrir los gastos.' : 'Con los alumnos activos ya se cubren los gastos.'}</div>` : '<div class="small muted">Cargá egresos y precios de plan para calcularlo.</div>'}</div>
        <div class="card"><h3>Egresos por categoría</h3>${Object.keys(f.por_categoria).length ? Object.entries(f.por_categoria).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<div style="margin-bottom:8px"><div class="row between small"><span>${esc(k)}</span><b>${money(v)}</b></div><div class="meter"><i style="width:${Math.round(100 * v / totCat)}%"></i></div></div>`).join('') : '<div class="empty">Todavía no cargaste egresos este mes.</div>'}</div></div>
      <div class="grid c2" style="margin-top:14px">
        <div class="card" id="planes"><h3>Precios de los planes</h3>
          <p class="small muted">Precio vigente de cada plan según cómo paga el alumno. Al renovar se usa el precio del medio de pago elegido.</p>
          ${an.planes.map(p => `<div class="plan-fila" data-id="${p.id}" style="${p.activo ? '' : 'opacity:.6'}"><div class="grow"><b>${esc(p.nombre)}</b>${p.activo ? '' : ' <span class="pill">Deshabilitado</span>'}<div class="small muted">${p.alumnos} alumnos</div></div>
            <label class="small">Efectivo<input type="number" min="0" step="100" data-k="precio_efectivo" value="${p.precio_efectivo}"></label><label class="small">Mercado Pago<input type="number" min="0" step="100" data-k="precio_mp" value="${p.precio_mp}"></label>
            <button class="primary sm" data-sv>Guardar</button><button class="${p.activo ? 'danger' : ''} sm" data-tg="${p.activo ? 0 : 1}" title="${p.activo ? 'Ya no se ofrece: deja de aparecer al renovar o dar de alta, pero conserva su historial' : 'Vuelve a ofrecerse'}">${p.activo ? 'Deshabilitar' : 'Habilitar'}</button></div>`).join('') || '<div class="empty">Todavía no hay planes.</div>'}
          <button class="ghost sm" id="p-nuevo" style="margin-top:8px">＋ Nuevo plan</button></div>
        <div class="card"><h3>Qué paga cada alumno activo</h3>
          ${an.tickets.alumnos ? `<div class="row between"><span>Precio promedio pagado</span><b style="font-size:1.4rem">${money(an.tickets.precio_promedio)}</b></div>
          <div class="small muted" style="margin-bottom:8px">${an.tickets.alumnos} alumnos activos con pago${an.tickets.precio_vigente_max ? ` · precio de lista más alto: ${money(an.tickets.precio_vigente_max)}` : ''}${an.tickets.bajo_vigente ? ` · <span class="t-amarillo">${an.tickets.bajo_vigente} pagan menos (planes antiguos)</span>` : ''}</div>
          <div class="perc">${[['10%', 'p10'], ['25%', 'p25'], ['Mediana', 'p50'], ['75%', 'p75'], ['90%', 'p90']].map(([n, k]) => `<div><div class="small muted">${n}</div><b>${money(an.tickets.percentiles[k])}</b></div>`).join('')}</div>
          <div class="small muted" style="margin:10px 0 4px">Cuántos alumnos pagan cada precio:</div>
          ${an.tickets.escalones.map(e => `<div style="margin-bottom:5px"><div class="row between small"><span>${money(e.precio)}</span><b>${e.alumnos} alumnos · ${Math.round(100 * e.alumnos / an.tickets.alumnos)}%</b></div><div class="meter"><i style="width:${Math.round(100 * e.alumnos / Math.max(...an.tickets.escalones.map(x => x.alumnos)))}%"></i></div></div>`).join('')}` : '<div class="empty">Cuando haya alumnos activos con pagos registrados se muestra la distribución.</div>'}
          ${an.cuotas_por_medio.length ? `<div class="small muted" style="margin-top:10px">Cuotas del mes: ${an.cuotas_por_medio.map(x => `${x.medio === 'efectivo' ? 'Efectivo' : x.medio === 'mercadopago' ? 'Mercado Pago' : 'Otros'} ${money(x.total)} (${x.n})`).join(' · ')}</div>` : ''}</div></div>
      <div class="card"><h3>Ingresos y egresos de los últimos 6 meses</h3>
        <div class="legend"><span><i style="background:var(--verde)"></i>Ingresos</span><span><i style="background:var(--rojo)"></i>Egresos</span></div>
        <div class="twobars">${f.serie.map(s => `<div class="m"><div class="small" style="font-weight:700;color:${s.ganancia >= 0 ? 'var(--verde)' : 'var(--rojo)'}">${compacto(s.ganancia)}</div><div class="pair"><i style="height:${Math.round(100 * s.ingresos / max)}%;background:var(--verde)" title="Ingresos ${money(s.ingresos)}"></i><i style="height:${Math.round(100 * s.egresos / max)}%;background:var(--rojo)" title="Egresos ${money(s.egresos)}"></i></div><div class="x">${s.mes.slice(5)}/${s.mes.slice(2, 4)}</div></div>`).join('')}</div>
        <div class="small muted" style="margin-top:6px">El número sobre cada mes es la ganancia neta.</div></div>
      <div class="card"><h3>Movimientos de ${nombreMes(mes)}</h3>${f.movimientos.length ? `<div class="tablewrap"><table><thead><tr><th>Fecha</th><th>Tipo</th><th>Categoría</th><th>Concepto</th><th class="num">Monto</th><th></th></tr></thead><tbody>
        ${f.movimientos.map(x => `<tr style="cursor:default"><td>${fmtF(x.fecha)}</td><td><span class="pill ${x.tipo === 'ingreso' ? 'verde' : 'rojo'}">${x.tipo === 'ingreso' ? 'Ingreso' : x.fijo ? 'Egreso fijo' : 'Egreso'}</span></td><td>${esc(x.categoria)}</td><td>${esc(x.concepto || '')}</td><td class="num ${x.tipo === 'ingreso' ? 't-verde' : ''}">${x.tipo === 'ingreso' ? '' : '−'}${money(x.monto)}</td><td class="right">${x.pago_id ? '<span class="small muted">cuota</span>' : `<button class="danger sm" data-del="${x.id}">Quitar</button>`}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">No hay movimientos en este mes.</div>'}</div>`;
    const set = (m) => { mes = m; cargar().catch(fail); };
    $$('#planes [data-sv]', main).forEach(b => b.onclick = async () => {
      const fila = b.closest('.plan-fila'); const body = {}; $$('input[data-k]', fila).forEach(i => { body[i.dataset.k] = i.value; });
      const aplicar = await confirmar('¿Querés que el nuevo precio en efectivo también quede en la ficha de los alumnos de este plan?', 'Sí, actualizar fichas');
      body.aplicar_a_alumnos = aplicar;
      try { await api('PUT', '/planes/' + fila.dataset.id, body); toast('Precios guardados'); cargar(); } catch (e) { fail(e); }
    });
    $$('#planes [data-tg]', main).forEach(b => b.onclick = async () => {
      const fila = b.closest('.plan-fila'), deshab = b.dataset.tg === '0';
      if (deshab && !(await confirmar('¿Deshabilitar este plan? Deja de ofrecerse al renovar o dar de alta alumnos; los alumnos y pagos que lo usaron en el pasado se conservan. Podés volver a habilitarlo cuando quieras.', 'Deshabilitar', true))) return;
      try { await api('PUT', '/planes/' + fila.dataset.id, { activo: !deshab }); toast(deshab ? 'Plan deshabilitado' : 'Plan habilitado'); cargar(); } catch (e) { fail(e); }
    });
    $('#p-nuevo', main).onclick = () => {
      const m = modal('Nuevo plan', `<form id="fp" class="stack">${campo('Nombre', '<input name="nombre" required placeholder="Ej.: Plan trimestral">')}<div class="fgrid">${campo('Precio efectivo ($)', '<input name="precio_efectivo" type="number" min="0" required>')}${campo('Precio Mercado Pago ($)', '<input name="precio_mp" type="number" min="0" required>')}</div><div class="row" style="justify-content:flex-end"><button type="button" data-close>Cancelar</button><button class="primary">Crear</button></div></form>`);
      $('#fp', m).onsubmit = async (e) => { e.preventDefault(); try { await api('POST', '/planes', Object.fromEntries(new FormData(e.target))); m.close(); cargar(); } catch (er) { fail(er); } };
    };
    $('#mes', main).onchange = (e) => e.target.value && set(e.target.value);
    $('#ant', main).onclick = () => set(mesMas(mes, -1)); $('#sig', main).onclick = () => set(mesMas(mes, 1));
    $('#b-egr', main).onclick = () => formMovimiento('egreso', cargar);
    $('#b-ing', main).onclick = () => formMovimiento('ingreso', cargar);
    $('#b-rep', main).onclick = async () => {
      if (!(await confirmar('Se copian a ' + nombreMes(mes) + ' los gastos fijos de ' + nombreMes(mesMas(mes, -1)) + '.', 'Copiar'))) return;
      try { const r = await api('POST', '/finanzas/replicar', { desde: mesMas(mes, -1), hasta: mes }); toast(r.copiados + ' gastos fijos copiados'); cargar(); } catch (e) { fail(e); }
    };
    $('#b-xls', main).onclick = () => descargarXlsx('omega-finanzas-' + mes + '.xlsx', {
      Resumen: [{ Mes: mes, Ingresos: f.ingresos, Egresos: f.egresos, 'Ganancia neta': f.ganancia_neta, 'Gastos fijos': f.gastos_fijos, 'Punto de equilibrio ($)': Math.round(f.punto_equilibrio_monto), 'Alumnos para equilibrio': f.punto_equilibrio_alumnos, 'Alumnos activos': f.alumnos_activos }],
      Movimientos: f.movimientos.map(x => ({ Fecha: x.fecha, Tipo: x.tipo, Categoría: x.categoria, Concepto: x.concepto || '', Monto: x.monto, Fijo: x.fijo ? 'Sí' : 'No' })),
    });
    $$('[data-del]', main).forEach(b => b.onclick = async () => { if (!(await confirmar('¿Quitar este movimiento?', 'Quitar', true))) return; try { await api('DELETE', '/finanzas/' + b.dataset.del); cargar(); } catch (e) { fail(e); } });
  }
  function formMovimiento(tipo, despues) {
    const m = modal(tipo === 'egreso' ? 'Cargar egreso' : 'Cargar otro ingreso', `<form id="f" class="stack"><div class="fgrid">
      ${campo('Categoría', tipo === 'egreso' ? `<select name="categoria">${CATS_EGRESO.map(c => `<option>${c}</option>`).join('')}</select>` : '<input name="categoria" value="Otros ingresos">')}
      ${campo('Monto ($)', '<input name="monto" type="number" min="1" step="1" required inputmode="numeric">')}
      ${campo('Fecha', `<input name="fecha" type="date" value="${mes === hoyAR().slice(0, 7) ? hoyAR() : mes + '-01'}">`)}${tipo === 'egreso' ? '<div class="small muted" style="grid-column:1/-1;margin-top:-6px">Si la fecha es posterior a hoy, el egreso queda en su mes y además se copia al Presupuesto 12 meses.</div>' : ''}
      ${campo('Concepto (opcional)', '<input name="concepto" autocomplete="off">')}
      ${tipo === 'egreso' ? campo('Impacto en el resultado', `<select name="devengar_meses"><option value="1">100% en el mes de la compra</option>${[2, 3, 4, 6, 9, 12, 18, 24, 36].map(n => `<option value="${n}">Repartido en ${n} meses (amortización)</option>`).join('')}</select>`) : ''}</div>
      ${tipo === 'egreso' ? '<label class="row" style="color:var(--txt)"><input type="checkbox" name="fijo" checked> Gasto fijo mensual (alquiler, salarios, luz, impuestos…)</label>' : ''}
      <div class="row" style="justify-content:flex-end"><button type="button" data-close>Cancelar</button><button class="primary">Guardar</button></div></form>`);
    if (tipo === 'egreso') { const sel = $('[name=categoria]', m), chk = $('[name=fijo]', m), dv = $('[name=devengar_meses]', m); sel.onchange = () => { chk.checked = CATS_FIJAS.includes(sel.value); if (sel.value === 'Equipamiento' && dv.value === '1') dv.value = '12'; }; }
    $('#f', m).onsubmit = async (e) => {
      e.preventDefault(); const fd = Object.fromEntries(new FormData(e.target));
      try { const rr = await api('POST', '/finanzas', { tipo, categoria: fd.categoria, monto: fd.monto, fecha: fd.fecha, concepto: fd.concepto, fijo: !!fd.fijo, devengar_meses: fd.devengar_meses || 1 }); m.close(); if (rr.presupuestado) { toast('Guardado en ' + nombreMes(rr.mes) + ' y copiado al Presupuesto 12 meses'); despues(); } else { toast('Guardado'); despues(); } } catch (er) { fail(er); }
    };
  }
  await cargar();
});

// ---------- Módulo 1: Administrador de usuarios ----------

// ---------- Árbol de permisos (un casillero por permiso, agrupado por módulo) ----------
// sel: Set de claves tildadas. 'otros': usuarios de los que se puede copiar los permisos.
function montarArbol(cont, arbol, sel, estandar, otros) {
  const total = arbol.reduce((a, m) => a + m.items.length, 0);
  function pintar() {
    cont.innerHTML = `<div class="perm-bar"><select id="p-copiar"><option value="">Copiar los permisos de…</option>${otros.map(o => `<option value="${o.id}">${o.rol === 'admin' ? '👑 ' : ''}${esc(o.nombre)} (${o.rol === 'admin' ? 'administrador' : 'profesor'})</option>`).join('')}</select>
        <button type="button" class="sm" id="p-est">Profesor estándar</button><button type="button" class="sm" id="p-todo">Marcar todo</button><button type="button" class="sm" id="p-nada">Quitar todo</button><span class="small muted" id="p-cnt"></span></div>
      <div class="perm-arbol">${arbol.map(m => `<details class="perm-mod" open><summary><input type="checkbox" data-mod="${m.id}" aria-label="Todo ${esc(m.nombre)}"> <b>${esc(m.nombre)}</b> <span class="small muted" data-cnt="${m.id}"></span></summary>
        ${m.items.map(([k, t, ayuda]) => `<label class="perm-it"><input type="checkbox" data-k="${k}" ${sel.has(k) ? 'checked' : ''}> <span>${esc(t)}${ayuda ? `<span class="small muted"> · ${esc(ayuda)}</span>` : ''}</span></label>`).join('')}</details>`).join('')}</div>
      <div class="small muted" style="margin-top:6px">Usuarios y Ajustes son siempre solo del administrador.</div>`;
    refrescar();
    $$('[data-k]', cont).forEach(i => i.onchange = () => { i.checked ? sel.add(i.dataset.k) : sel.delete(i.dataset.k); refrescar(); });
    $$('[data-mod]', cont).forEach(i => { i.onclick = (e) => e.stopPropagation(); i.onchange = () => { const m = arbol.find(x => x.id === i.dataset.mod); m.items.forEach(([k]) => i.checked ? sel.add(k) : sel.delete(k)); $$('[data-k]', cont).forEach(c => { c.checked = sel.has(c.dataset.k); }); refrescar(); }; });
    const poner = (arr) => { sel.clear(); arr.forEach(k => sel.add(k)); pintar(); };
    $('#p-est', cont).onclick = () => poner(estandar);
    $('#p-todo', cont).onclick = () => poner(arbol.flatMap(m => m.items.map(i => i[0])));
    $('#p-nada', cont).onclick = () => poner([]);
    $('#p-copiar', cont).onchange = (e) => { const o = otros.find(x => String(x.id) === e.target.value); if (o) { poner(o.permisos); toast('Se copiaron los permisos de ' + o.nombre + ': ahora podés tildar o destildar lo que quieras'); } };
  }
  function refrescar() {
    arbol.forEach(m => { const n = m.items.filter(([k]) => sel.has(k)).length, c = $('[data-mod="' + m.id + '"]', cont); c.checked = n === m.items.length; c.indeterminate = n > 0 && n < m.items.length; $('[data-cnt="' + m.id + '"]', cont).textContent = n + ' de ' + m.items.length; });
    $('#p-cnt', cont).textContent = sel.size + ' de ' + total + ' permisos';
  }
  pintar();
}
vista('/usuarios', ['admin'], async (main) => {
  const [us, pm] = await Promise.all([api('GET', '/usuarios'), api('GET', '/permisos')]);
  const totalPerm = pm.arbol.reduce((a, m) => a + m.items.length, 0);
  const rolTxt = { admin: 'Administrador', profesor: 'Profesor', cliente: 'Alumno' };
  main.innerHTML = `<div class="page-title"><h1>Usuarios</h1><div class="actions"><button class="primary" id="nuevo">Nuevo profesor o administrador</button></div></div>
    <p class="muted">Los alumnos reciben su acceso desde su ficha en <a href="#/clientes">Clientes</a>. Nadie necesita cuentas externas: todos entran con el usuario y la contraseña de OMEGA.</p>
    <div class="tablewrap"><table><thead><tr><th>Nombre</th><th>Usuario</th><th>Rol</th><th>Estado</th><th></th></tr></thead><tbody>
    ${us.map(u => `<tr style="cursor:default"><td><b>${esc(u.nombre)}</b></td><td>${esc(u.username)}</td><td><span class="pill">${rolTxt[u.rol]}</span>${u.rol === 'profesor' ? `<div class="small muted">${u.permisos.length} de ${totalPerm} permisos</div>` : u.rol === 'admin' ? '<div class="small muted">Acceso total</div>' : ''}</td><td>${u.activo ? '<span class="t-verde">Activo</span>' : '<span class="t-rojo">Desactivado</span>'}</td>
      <td class="right">${u.rol === 'cliente' ? `<a class="btn sm" href="#/clientes/${u.cliente_id}">Ver ficha</a>` : `${u.rol === 'profesor' ? `<button class="primary sm" data-perm="${u.id}">Accesos</button> ` : ''}<button class="sm" data-clave="${u.id}">Cambiar contraseña</button> <button class="sm" data-act="${u.id}" data-v="${u.activo ? 0 : 1}">${u.activo ? 'Desactivar' : 'Activar'}</button> ${u.id !== S.user.id ? `<button class="danger sm" data-del="${u.id}">Eliminar</button>` : ''}`}</td></tr>`).join('')}</tbody></table></div>`;
  const otrosDe = (idExcluir) => us.filter(u => u.rol !== 'cliente' && u.activo && u.id !== idExcluir);
  $('#nuevo', main).onclick = () => {
    const sel = new Set(pm.estandar);
    const m = modal('Nuevo usuario', `<form id="f" class="stack"><div class="fgrid">${campo('Rol', '<select name="rol"><option value="profesor">Profesor</option><option value="admin">Administrador</option></select>')}${campo('Nombre y apellido', '<input name="nombre" required>')}${campo('Usuario', '<input name="username" required minlength="3" autocapitalize="none" autocomplete="off">')}${campo('Contraseña (mín. 6)', '<input name="password" type="text" required minlength="6" autocomplete="off">')}</div>
      <div id="bloque-perm"><h3 style="margin:6px 0">Accesos del profesor</h3><p class="small muted" style="margin-top:0">Arranca con el perfil <b>Profesor estándar</b>: todas las tareas, y en Finanzas solo la caja (saldo inicial, ingresos y egresos). Tildá o destildá lo que quieras, o copiá los permisos de otro usuario.</p><div id="arbol"></div></div>
      <div id="txt-admin" class="small muted hidden">El administrador tiene acceso a todo.</div>
      <div class="row" style="justify-content:flex-end"><button type="button" data-close>Cancelar</button><button class="primary">Crear usuario</button></div></form>`, { wide: true });
    montarArbol($('#arbol', m), pm.arbol, sel, pm.estandar, otrosDe(0));
    $('[name=rol]', m).onchange = (e) => { const p = e.target.value === 'profesor'; $('#bloque-perm', m).classList.toggle('hidden', !p); $('#txt-admin', m).classList.toggle('hidden', p); };
    $('#f', m).onsubmit = async (e) => { e.preventDefault(); const body = Object.fromEntries(new FormData(e.target)); if (body.rol === 'profesor') body.permisos = [...sel]; try { await api('POST', '/usuarios', body); m.close(); toast('Usuario creado'); render(); } catch (er) { fail(er); } };
  };
  $$('[data-perm]', main).forEach(b => b.onclick = () => {
    const u = us.find(x => x.id === Number(b.dataset.perm)), sel = new Set(u.permisos);
    const m = modal('Accesos de ' + u.nombre, `<form id="f" class="stack"><div id="arbol"></div><div class="row" style="justify-content:flex-end"><button type="button" data-close>Cancelar</button><button class="primary">Guardar accesos</button></div></form>`, { wide: true });
    montarArbol($('#arbol', m), pm.arbol, sel, pm.estandar, otrosDe(u.id));
    $('#f', m).onsubmit = async (e) => { e.preventDefault(); try { await api('PUT', '/usuarios/' + u.id, { permisos: [...sel] }); m.close(); toast('Accesos guardados'); render(); } catch (er) { fail(er); } };
  });
  $$('[data-clave]', main).forEach(b => b.onclick = () => {
    const m = modal('Nueva contraseña', `<form id="f" class="stack">${campo('Contraseña nueva (mín. 6)', '<input name="p" required minlength="6" autocomplete="off">')}<div class="row" style="justify-content:flex-end"><button type="button" data-close>Cancelar</button><button class="primary">Guardar</button></div></form>`);
    $('#f', m).onsubmit = async (e) => { e.preventDefault(); try { await api('PUT', '/usuarios/' + b.dataset.clave, { password: new FormData(e.target).get('p') }); m.close(); toast('Contraseña cambiada'); } catch (er) { fail(er); } };
  });
  $$('[data-act]', main).forEach(b => b.onclick = async () => { try { await api('PUT', '/usuarios/' + b.dataset.act, { activo: b.dataset.v === '1' }); render(); } catch (e) { fail(e); } });
  $$('[data-del]', main).forEach(b => b.onclick = async () => { if (!(await confirmar('¿Eliminar este usuario?', 'Eliminar', true))) return; try { await api('DELETE', '/usuarios/' + b.dataset.del); render(); } catch (e) { fail(e); } });
});

// ---------- Cambiar contraseña (todos los roles) ----------
function formClave(cont) {
  cont.innerHTML = `<h3>Cambiar mi contraseña</h3><form id="fc" class="stack">${campo('Contraseña actual', '<input type="password" name="actual" autocomplete="current-password" required>')}${campo('Contraseña nueva (mín. 6)', '<input type="password" name="nueva" autocomplete="new-password" required minlength="6">')}<button class="primary">Cambiar contraseña</button></form>`;
  $('#fc', cont).onsubmit = async (e) => { e.preventDefault(); try { await api('POST', '/yo/clave', Object.fromEntries(new FormData(e.target))); toast('Contraseña cambiada'); e.target.reset(); } catch (er) { fail(er); } };
}
function bloqueInstalar(cont) {
  cont.innerHTML = `<h3>Instalar la app en el celular</h3><p class="muted">Escaneá el QR con el celular y abrí el link. Android: “Instalar aplicación”; iPhone: Compartir → “Agregar a inicio”. Queda como una app más.</p><div id="qr-slot"></div>
    <div class="row" style="margin-top:8px"><button id="qr-grande">Ver QR grande</button>${eventoInstalar ? '<button id="inst" class="sm primary">Instalar en este equipo</button>' : ''}</div>`;
  qrEsquina($('#qr-slot', cont), S.user.rol === 'admin');
  $('#qr-grande', cont).onclick = () => modalQRApp(S.user.rol === 'admin');
  const b = $('#inst', cont); if (b) b.onclick = async () => { eventoInstalar.prompt(); await eventoInstalar.userChoice; eventoInstalar = null; };
}

vista('/ajustes', ['admin'], async (main) => {
  const bk = await api('GET', '/backups');
  main.innerHTML = `<div class="page-title"><h1>Ajustes</h1></div>
    <div class="grid c2">
      <div class="card"><h3>Copias de seguridad</h3>
        <p class="muted">Todos los días a las <b>${bk.hora_programada}:00</b> (hora de Argentina) se hace una copia automática de la base de datos y los videos.</p>
        <div class="small"><div>Carpeta: <b style="word-break:break-all">${esc(bk.carpeta)}</b></div>${bk.ultimo ? `<div style="margin-top:6px">Última copia: <b>${fmtF(bk.ultimo.fecha)} ${String(bk.ultimo.hora).padStart(2, '0')}:${String(bk.ultimo.min).padStart(2, '0')}</b> · ${esc(bk.ultimo.archivo)}${bk.ultimo.nube && bk.ultimo.nube.subido ? ' · subida a OneDrive ✓' : ''}</div>` : '<div class="t-amarillo" style="margin-top:6px">Todavía no se hizo ninguna copia.</div>'}</div>
        <div class="row" style="margin:12px 0"><button class="primary" id="bk-ya">Hacer una copia ahora</button></div>
        ${bk.archivos.length ? `<div class="small muted">Copias guardadas (${bk.archivos.length}):</div>${bk.archivos.slice(0, 8).map(a => `<div class="row between small"><span>${esc(a.archivo)}</span><span class="muted">${(a.bytes / 1048576).toFixed(2)} MB</span></div>`).join('')}` : ''}</div>
      <div class="card" id="pais"></div><div class="card" id="camp"></div><div id="sync"></div><div class="card" id="inst"></div><div class="card" id="clave"></div></div>`;
  bloquePais($('#pais', main)).catch(fail); bloqueCampanas($('#camp', main)).catch(fail); barraSync($('#sync', main)); bloqueInstalar($('#inst', main)); formClave($('#clave', main));
  $('#bk-ya', main).onclick = async (e) => { e.target.disabled = true; try { const r = await api('POST', '/backups/ahora'); if (r.ok) { toast('Copia creada: ' + r.archivo); render(); } else fail(new Error(r.error)); } catch (er) { fail(er); } e.target.disabled = false; };
});

vista('/cuenta', ['profesor'], async (main) => {
  main.innerHTML = `<div class="page-title"><h1>Mi cuenta</h1></div><div class="grid c2"><div class="card"><h3>${esc(S.user.nombre)}</h3><div class="muted">Usuario: ${esc(S.user.username)}</div></div><div class="card" id="clave"></div><div class="card" id="inst"></div></div>`;
  formClave($('#clave', main)); bloqueInstalar($('#inst', main));
});
