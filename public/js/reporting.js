'use strict';
// ---------- Módulo 4: Reporting y control (inicio de administrador y profesores) ----------
// El mismo listado con filtros por columna se usa en “Clientes” (módulo 3).

function textoAlta(c) {
  if (c.semaforo_alta === 'verde') return 'Activo';
  return 'Baja ' + (c.meses_baja >= 1 ? c.meses_baja + (c.meses_baja === 1 ? ' mes' : ' meses') : c.dias_baja + ' d');
}
function textoAsist(c) {
  const n = c.semanas_sin_entrenar || 0;
  if (c.semaforo_asistencia === 'verde') return 'Esta semana';
  if (c.semaforo_asistencia === 'amarillo') return '1 semana sin venir';
  if (c.semaforo_asistencia === 'naranja') return n + ' semanas sin venir';
  return n > 3 ? n + ' semanas sin venir' : 'Más de 3 semanas';
}
function fmtUltima(u) {
  if (!u) return '—';
  return fmtF(u.slice(0, 10)) + ' ' + u.slice(11, 16);
}

// Devuelve { el, destroy } con el listado dentro de `cont`
function listadoClientes(cont, clientes, esAdmin, opciones = {}) {
  const F = { nombre: '', alta: '', baja: '', ultima: '', sa: '', ss: '', precio: '', riesgo: false };
  let ord = { k: 'nombre', d: 1 };
  const cols = [
    ['foto', 'Foto', true], ['nombre', 'Nombre y apellido'], ['alta', 'Fecha de alta'], ['baja', 'Fecha de baja'],
    ['ultima', 'Última clase'], ['sa', 'Alta'], ['ss', 'Asistencia'],
  ];
  if (esAdmin) cols.push(['precio', 'Plan', false, true]);
  const val = {
    nombre: c => norm(c.nombre), alta: c => c.fecha_alta, baja: c => c.fecha_baja, ultima: c => c.ultima_clase || '',
    sa: c => ['verde', 'amarillo', 'rojo'].indexOf(c.semaforo_alta), ss: c => ['verde', 'amarillo', 'naranja', 'rojo'].indexOf(c.semaforo_asistencia),
    precio: c => c.precio_plan || 0,
  };
  cont.innerHTML = `
    ${opciones.rapidos === false ? '' : `<div class="quick" id="quick">
      <button data-q="" class="on">Todos</button><button data-q="activos">Activos</button><button data-q="riesgo">Activos en riesgo</button>
      <button data-q="recuperables">Bajas recuperables</button><button data-q="largas">Bajas +3 meses</button><button data-q="faltapago">Falta registrar pago</button></div>`}
    <div class="tablewrap"><table><thead>
      <tr>${cols.map(([k, t, ns, num]) => `<th data-k="${k}" class="${ns ? 'nosort' : ''} ${num ? 'num' : ''}">${t}<span class="o"></span></th>`).join('')}</tr>
      <tr class="filters">
        <th></th>
        <th><input data-f="nombre" placeholder="Buscar…"></th>
        <th><input data-f="alta" placeholder="dd/mm/aaaa"></th>
        <th><input data-f="baja" placeholder="dd/mm/aaaa"></th>
        <th><input data-f="ultima" placeholder="dd/mm/aaaa"></th>
        <th><select data-f="sa"><option value="">Todos</option><option value="verde">Verde · activo</option><option value="amarillo">Amarillo · baja 1-3 m</option><option value="rojo">Rojo · +3 meses</option></select></th>
        <th><select data-f="ss"><option value="">Todos</option><option value="verde">Verde</option><option value="amarillo">Amarillo</option><option value="naranja">Naranja</option><option value="rojo">Rojo</option></select></th>
        ${esAdmin ? '<th><input data-f="precio" placeholder="$" class="num"></th>' : ''}
      </tr></thead><tbody id="tb"></tbody></table></div>
    <div class="small muted" id="cuenta" style="margin-top:8px"></div>`;
  const tb = $('#tb', cont);
  const hoyIso = hoyAR();
  function filtrados() {
    return clientes.filter(c => {
      if (F.nombre && !norm(c.nombre).includes(norm(F.nombre))) return false;
      if (F.alta && !(fmtF(c.fecha_alta).includes(F.alta) || c.fecha_alta.includes(F.alta))) return false;
      if (F.baja && !(fmtF(c.fecha_baja).includes(F.baja) || (c.fecha_baja || '').includes(F.baja))) return false;
      if (F.ultima && !(fmtUltima(c.ultima_clase).includes(F.ultima) || (c.ultima_clase || '').includes(F.ultima))) return false;
      if (F.sa && c.semaforo_alta !== F.sa) return false;
      if (F.ss && c.semaforo_asistencia !== F.ss) return false;
      if (F.precio && !String(c.precio_plan || 0).includes(F.precio.replace(/\D/g, ''))) return false;
      if (F.riesgo && !(c.semaforo_alta === 'verde' && (c.semaforo_asistencia === 'naranja' || c.semaforo_asistencia === 'rojo'))) return false;
      if (F.faltapago && !c.falta_pago) return false;
      return true;
    }).sort((a, b) => { const x = val[ord.k](a), y = val[ord.k](b); return (x < y ? -1 : x > y ? 1 : 0) * ord.d; });
  }
  function pintar() {
    const lista = filtrados();
    tb.innerHTML = lista.length ? lista.map(c => `<tr data-id="${c.id}">
      <td>${avatar(c)}</td>
      <td class="t-${esc(c.semaforo_alta)}"><b>${esc(c.nombre)}</b>${c.falta_pago ? ' <span class="pill amarillo" title="La baja se movió sin pago asociado">Falta registrar pago</span>' : ''}</td>
      <td>${fmtF(c.fecha_alta)}</td>
      <td class="${c.semaforo_alta === 'verde' ? 'muted' : 't-' + esc(c.semaforo_alta)}">${fmtF(c.fecha_baja)}</td>
      <td>${fmtUltima(c.ultima_clase)}</td>
      <td>${dot(c.semaforo_alta)} ${esc(textoAlta(c))}</td>
      <td>${dot(c.semaforo_asistencia)} ${esc(textoAsist(c))}</td>
      ${esAdmin ? `<td class="num">${money(c.precio_plan)}</td>` : ''}</tr>`).join('')
      : `<tr><td colspan="${cols.length}" class="empty">No hay alumnos con esos filtros.</td></tr>`;
    $('#cuenta', cont).textContent = lista.length + ' de ' + clientes.length + ' alumnos';
    $$('th[data-k]', cont).forEach(th => { const o = $('.o', th); o.textContent = th.dataset.k === ord.k ? (ord.d > 0 ? ' ▲' : ' ▼') : ''; });
    out.filtrados = lista;
  }
  const out = { filtrados: [], pintar };
  tb.onclick = (e) => { const tr = e.target.closest('tr[data-id]'); if (tr) ir('#/clientes/' + tr.dataset.id); };
  $$('th[data-k]', cont).forEach(th => th.onclick = () => {
    const k = th.dataset.k; if (k === 'foto') return;
    ord = { k, d: ord.k === k ? -ord.d : 1 }; pintar();
  });
  $$('[data-f]', cont).forEach(i => i.oninput = i.onchange = () => { if (F[i.dataset.f] === i.value && !F.riesgo && !F.faltapago) return; F[i.dataset.f] = i.value; F.riesgo = false; F.faltapago = false; marcarRapido(null); pintar(); });
  function marcarRapido(q) { $$('#quick button', cont).forEach(b => b.classList.toggle('on', q !== null && b.dataset.q === q)); }
  $$('#quick button', cont).forEach(b => b.onclick = () => {
    const q = b.dataset.q;
    Object.assign(F, { sa: '', ss: '', riesgo: false, faltapago: false });
    if (q === 'activos') F.sa = 'verde'; else if (q === 'recuperables') F.sa = 'amarillo'; else if (q === 'largas') F.sa = 'rojo'; else if (q === 'riesgo') F.riesgo = true; else if (q === 'faltapago') F.faltapago = true;
    $('[data-f=sa]', cont).value = F.sa; $('[data-f=ss]', cont).value = '';
    marcarRapido(q); pintar();
  });
  pintar();
  return out;
}

vista('/', ['admin', 'profesor'], async (main) => {
  const esAdmin = S.user.rol === 'admin';
  const clientes = await api('GET', '/clientes');
  const activos = clientes.filter(c => c.semaforo_alta === 'verde');
  const riesgo = activos.filter(c => c.semaforo_asistencia === 'naranja' || c.semaforo_asistencia === 'rojo').length;
  const rec = clientes.filter(c => c.semaforo_alta === 'amarillo').length;
  const largas = clientes.filter(c => c.semaforo_alta === 'rojo').length;
  main.innerHTML = `
    <div class="row between" style="align-items:flex-start;margin-bottom:14px;gap:12px">
      <div><h1 style="margin:0 0 10px">Reporting y control</h1><div class="row"><a class="btn primary" href="#/asistencias/cargar">Cargar asistencias</a>${esAdmin ? '<a class="btn" href="#/clientes/nuevo">Nuevo alumno</a>' : ''}</div></div>
      <div id="qr-app" class="qr-esquina-wrap"></div></div>
    <div id="sync-bar" style="margin-bottom:14px"></div>
    <div class="grid k" style="margin-bottom:14px">
      <div class="kpi verde"><div class="v">${activos.length}</div><div class="l">Alumnos activos</div></div>
      <div class="kpi naranja"><div class="v">${riesgo}</div><div class="l">Activos en riesgo de abandono</div></div>
      <div class="kpi amarillo"><div class="v">${rec}</div><div class="l">Bajas recuperables (hasta 3 meses)</div></div>
      <div class="kpi rojo"><div class="v">${largas}</div><div class="l">Bajas de más de 3 meses</div></div>
    </div>
    <div class="legend"><span><i style="background:var(--verde)"></i>Alta: activo · Asistencia: entrenó esta semana</span><span><i style="background:var(--amarillo)"></i>Alta: baja de hasta 3 meses · Asistencia: 1 semana sin venir</span><span><i style="background:var(--naranja)"></i>Asistencia: 2 a 3 semanas sin venir</span><span><i style="background:var(--rojo)"></i>Alta: baja de más de 3 meses · Asistencia: más de 3 semanas</span></div>
    <div id="lst"></div>`;
  listadoClientes($('#lst', main), clientes, esAdmin);
  qrEsquina($('#qr-app', main), esAdmin);
  if (esAdmin) barraSync($('#sync-bar', main));
});
