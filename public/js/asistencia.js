'use strict';
// ---------- Módulo 5: Dashboard general, carga de asistencias y escáner QR ----------

function tabsAsist(activa) {
  const t = [['/asistencias', 'Dashboard'], ['/asistencias/cargar', 'Cargar asistencias'], ['/asistencias/qr', 'Escanear QR'], ['/asistencias/qr-gimnasio', 'QR del gimnasio']];
  return `<div class="tabs">${t.map(([h, n]) => `<button onclick="ir('#${h}')" class="${h === activa ? 'on' : ''}">${n}</button>`).join('')}</div>`;
}

vista('/asistencias', ['admin', 'profesor'], async (main) => {
  let fecha = hoyAR(), primera = true;
  async function cargar() {
    let d = await api('GET', '/dashboard?fecha=' + fecha);
    // si hoy no hay clases (p. ej. domingo), se muestra el último día con clases
    if (primera && !d.porHora.length) { for (let i = 1; i <= 7 && !d.porHora.length; i++) { const f = sumaDias(hoyAR(), -i); const x = await api('GET', '/dashboard?fecha=' + f); if (x.porHora.length) { d = x; fecha = f; } } }
    primera = false;
    const dias = d.semana.map(s => ({ x: s.fecha.slice(8, 10) + '/' + s.fecha.slice(5, 7), v: s.total, color: s.fecha === fecha ? 'var(--brand2)' : '' }));
    const ineficHoras = Object.entries(d.ineficiencias_por_horario).sort((a, b) => b[1] - a[1]);
    main.innerHTML = `
      <div class="page-title"><h1>Asistencias</h1><div class="actions"><a class="btn primary" href="#/asistencias/cargar">Cargar asistencias</a><a class="btn" href="#/asistencias/qr">Escanear QR</a></div></div>
      ${tabsAsist('/asistencias')}
      <div class="row" style="margin-bottom:12px">
        <button class="sm" id="ant">‹</button><input type="date" id="fecha" value="${fecha}" style="width:auto"><button class="sm" id="sig">›</button>
        <button class="sm ghost" id="hoy">Hoy</button><span class="muted">${fmtFlargo(fecha)}</span></div>
      <div class="grid k" style="margin-bottom:14px">
        <div class="kpi"><div class="v">${d.kpis.asistencias_dia}</div><div class="l">Asistencias del día</div></div>
        <div class="kpi verde"><div class="v">${d.kpis.activos}</div><div class="l">Alumnos activos</div></div>
        <div class="kpi naranja"><div class="v">${d.kpis.activos_en_riesgo}</div><div class="l">Activos en riesgo</div></div>
        <div class="kpi amarillo"><div class="v">${d.kpis.bajas_recuperables}</div><div class="l">Bajas recuperables</div></div>
      </div>
      ${d.porHora.filter(h => h.exceso_reservas > 0).map(h => `<div class="aviso-mat"><b>⚠ Ineficiencia de Materiales · ${hh(h.hora)}:</b> hay ${h.reservas} reservas y el límite de materiales es ${h.limite_reservas}. Conviene adaptar el circuito o duplicar estaciones (nadie queda sin lugar: las reservas son informativas).</div>`).join('')}
      <div class="card"><h3>Asistentes por horario</h3>
        <div class="small muted">Capacidad de diseño del circuito y el equipamiento: ${d.capacidad} personas. Las clases que la superan se marcan en rojo.</div>
        ${d.porHora.length ? barras(d.porHora.map(h => ({ x: hh(h.hora).slice(0, 2) + ' h', v: h.total, exc: h.exceso > 0, label: h.exceso > 0 ? h.total + ' (+' + h.exceso + ')' : (h.total || '') })), { min: d.capacidad }) : '<div class="empty">No hay clases en este día.</div>'}
      </div>
      <div class="card"><h3>Detalle por clase</h3>
        ${d.porHora.length ? `<div class="tablewrap"><table><thead><tr><th>Horario</th><th>Formato</th><th class="num">Reservas</th><th class="num">Asistentes</th><th class="num">QR</th><th class="num">Manual</th><th class="num">Sobre ${d.capacidad}</th></tr></thead><tbody>
        ${d.porHora.map(h => `<tr style="cursor:default"><td><b>${hh(h.hora)}</b></td><td>${chipFormato(h.formato ? { nombre: h.formato, color: h.color } : null)}</td><td class="num ${h.exceso_reservas ? 't-rojo' : ''}">${h.reservas ?? 0}${h.exceso_reservas ? ' ⚠' : ''}</td><td class="num"><b>${h.total}</b></td><td class="num">${h.qr}</td><td class="num">${h.manual}</td><td class="num ${h.exceso ? 't-rojo' : 'muted'}">${h.exceso ? '+' + h.exceso : '—'}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">Sin clases.</div>'}</div>
      <div class="card"><h3>Ineficiencias en la asignación de materiales <span class="muted small">(últimos 30 días)</span></h3>
        <p class="small muted">Cuando una clase supera las ${d.capacidad} personas el ingreso se registra igual (no hay límite). Acá se muestra como una ineficiencia: el circuito y el equipamiento están pensados para ${d.capacidad}.</p>
        ${d.ineficiencias.length ? `${ineficHoras.length ? `<div class="infobox" style="margin-bottom:10px">Horarios que más se desbordan: ${ineficHoras.slice(0, 4).map(([h, n]) => '<b>' + hh(h) + '</b> (' + n + (n === 1 ? ' vez' : ' veces') + ')').join(' · ')}</div>` : ''}
        <div class="tablewrap"><table><thead><tr><th>Fecha</th><th>Horario</th><th>Formato</th><th class="num">Asistentes</th><th class="num">Exceso</th><th>Equipamiento que quedó corto</th></tr></thead><tbody>
        ${d.ineficiencias.map(i => `<tr style="cursor:default"><td>${fmtF(i.fecha)}</td><td>${hh(i.hora)}</td><td>${esc(i.formato || '—')}</td><td class="num">${i.asistentes}</td><td class="num t-rojo">+${i.exceso}</td><td>${i.faltantes.length ? i.faltantes.map(f => esc(f.nombre) + ': faltan ' + f.faltan + ' (hay ' + f.stock + ', se necesitan ' + f.demanda + ')').join('<br>') : '<span class="muted">El equipamiento alcanzó</span>'}</td></tr>`).join('')}</tbody></table></div>`
        : '<div class="okbox">Ninguna clase superó la capacidad en los últimos 30 días.</div>'}</div>
      <div class="card"><h3>Asistencias de los últimos 14 días</h3>${barras(dias)}</div>`;
    const set = (f) => { fecha = f; cargar().catch(fail); };
    $('#fecha', main).onchange = (e) => e.target.value && set(e.target.value);
    $('#ant', main).onclick = () => set(sumaDias(fecha, -1));
    $('#sig', main).onclick = () => set(sumaDias(fecha, 1));
    $('#hoy', main).onclick = () => set(hoyAR());
  }
  await cargar();
});

// ----- Cargar asistencias (manual): se identifica la clase por el horario
vista('/asistencias/cargar', ['admin', 'profesor'], async (main) => {
  const [clientes, formatos] = await Promise.all([api('GET', '/clientes'), api('GET', '/formatos')]);
  const fmap = new Map(formatos.map(f => [f.id, f]));
  const sel = new Map();
  const pre = sessionStorage.getItem('omega_pre'); sessionStorage.removeItem('omega_pre');
  if (pre) { const c = clientes.find(x => String(x.id) === pre); if (c) sel.set(c.id, c); }
  let fecha = hoyAR(), hora = '', agenda = [];
  main.innerHTML = `
    <div class="page-title"><h1>Cargar asistencias</h1></div>${tabsAsist('/asistencias/cargar')}
    <div class="grid c2">
      <div class="card"><h3>1 · Clase</h3>
        <div class="fgrid">${campo('Fecha', '<input type="date" id="fecha" value="' + fecha + '">')}${campo('Horario', '<select id="hora"></select>')}</div>
        <div id="clase-info" class="small muted"></div>
        <h3 style="margin-top:16px">2 · Alumnos</h3>
        <input id="q" placeholder="Buscar alumno por nombre…" autocomplete="off">
        <div id="res" class="search-res"></div></div>
      <div class="card"><h3>Para registrar <span id="n-sel" class="pill"></span></h3>
        <div id="sel"></div>
        <div class="row" style="margin-top:12px"><button class="primary big grow" id="reg">Registrar asistencia</button></div>
        <h3 style="margin-top:20px">Ya registrados en esta clase <span id="n-reg" class="pill"></span></h3><div id="reg-lista"></div></div></div>`;

  async function cargarAgenda() {
    agenda = (await api('GET', '/agenda')).filter(a => a.dia === dowDe(fecha) && a.formato_id);
    const auto = fecha === hoyAR() ? '<option value="">Automático (según la hora actual)</option>' : '';
    $('#hora', main).innerHTML = auto + agenda.map(a => `<option value="${a.hora}">${hh(a.hora)} · ${esc(fmap.get(a.formato_id)?.nombre || '')}</option>`).join('');
    if (!auto && agenda.length) hora = String(agenda[0].hora); else if (!auto) hora = '';
    $('#hora', main).value = hora;
    info();
  }
  function info() {
    $('#clase-info', main).textContent = hora === '' && fecha === hoyAR() ? 'El sistema detecta la clase por el horario (se admite entrar hasta 15 minutos antes).' : '';
    listaRegistrados();
  }
  async function listaRegistrados() {
    const h = hora === '' ? null : hora;
    if (h === null && fecha === hoyAR()) {
      // clase automática: buscar la del horario actual
      const a = ahoraAR(); const horas = agenda.map(x => x.hora); let c = a.hora; if (a.min >= 45 && horas.includes(c + 1)) c++;
      if (!horas.includes(c)) { $('#reg-lista', main).innerHTML = '<div class="muted small">No hay clase en este horario.</div>'; $('#n-reg', main).textContent = ''; return; }
      return pintarReg(await api('GET', '/asistencias?fecha=' + fecha + '&hora=' + c));
    }
    if (h === null) { $('#reg-lista', main).innerHTML = ''; return; }
    pintarReg(await api('GET', '/asistencias?fecha=' + fecha + '&hora=' + h));
  }
  function pintarReg(rows) {
    $('#n-reg', main).textContent = rows.length + (rows.length === 1 ? ' persona' : ' personas');
    $('#reg-lista', main).innerHTML = rows.length ? rows.map(r => `<div class="list-item ok">${avatar(r)}<div class="grow"><b>${esc(r.nombre)}</b><div class="small muted">${r.origen === 'qr' ? 'QR' : 'Manual'}</div></div>${puede('asist.borrar') ? `<button class="danger sm" data-del="${r.id}">Quitar</button>` : ''}</div>`).join('') : '<div class="muted small">Todavía no hay asistentes.</div>';
    $$('[data-del]', main).forEach(b => b.onclick = async () => { try { await api('DELETE', '/asistencias/' + b.dataset.del); listaRegistrados(); } catch (e) { fail(e); } });
  }
  function pintarSel() {
    $('#n-sel', main).textContent = sel.size;
    $('#sel', main).innerHTML = sel.size ? [...sel.values()].map(c => `<div class="list-item">${avatar(c)}<div class="grow"><b>${esc(c.nombre)}</b></div><button class="ghost sm" data-quitar="${c.id}">✕</button></div>`).join('') : '<div class="muted small">Buscá y tocá a los alumnos que entrenaron.</div>';
    $$('[data-quitar]', main).forEach(b => b.onclick = () => { sel.delete(Number(b.dataset.quitar)); pintarSel(); pintarRes(); });
  }
  function pintarRes() {
    const q = norm($('#q', main).value);
    const lista = clientes.filter(c => !q || norm(c.nombre).includes(q)).slice(0, 40);
    $('#res', main).innerHTML = lista.map(c => `<div class="list-item" data-add="${c.id}" style="cursor:pointer">${avatar(c)}<div class="grow"><b class="t-${esc(c.semaforo_alta)}">${esc(c.nombre)}</b><div class="small muted">${dot(c.semaforo_asistencia)} ${esc(textoAsist(c))}</div></div>${sel.has(c.id) ? '<span class="pill verde">✓ agregado</span>' : '<button class="sm">Agregar</button>'}</div>`).join('') || '<div class="empty">Sin resultados.</div>';
    $$('[data-add]', main).forEach(el => el.onclick = () => { const c = clientes.find(x => x.id === Number(el.dataset.add)); if (sel.has(c.id)) sel.delete(c.id); else sel.set(c.id, c); pintarSel(); pintarRes(); });
  }
  $('#q', main).oninput = debounce(pintarRes, 100);
  $('#fecha', main).onchange = async (e) => { fecha = e.target.value || hoyAR(); hora = ''; await cargarAgenda(); };
  $('#hora', main).onchange = (e) => { hora = e.target.value; info(); };
  $('#reg', main).onclick = async (e) => {
    if (!sel.size) return toast('Elegí al menos un alumno', 'warn');
    e.target.disabled = true;
    try {
      const r = await api('POST', '/asistencias', { cliente_ids: [...sel.keys()], fecha, hora: hora === '' ? undefined : hora });
      const nuevos = r.resultados.filter(x => !x.duplicada).length, dup = r.resultados.length - nuevos;
      toast(nuevos + ' registrada' + (nuevos === 1 ? '' : 's') + ' en la clase de las ' + hh(r.hora) + (dup ? ' · ' + dup + ' ya estaba' + (dup === 1 ? '' : 'n') : ''));
      sel.clear(); pintarSel(); pintarRes();
      hora = hora === '' ? '' : hora; listaRegistrados();
    } catch (er) { fail(er); }
    e.target.disabled = false;
  };
  await cargarAgenda(); pintarSel(); pintarRes();
});

// ----- Escáner de QR (el alumno muestra su QR en la app y el profesor lo escanea)
vista('/asistencias/qr', ['admin', 'profesor'], async (main) => {
  const formatos = await api('GET', '/formatos'); const fmap = new Map(formatos.map(f => [f.id, f]));
  const agenda = (await api('GET', '/agenda')).filter(a => a.dia === dowDe(hoyAR()) && a.formato_id);
  main.innerHTML = `
    <div class="page-title"><h1>Escanear QR</h1></div>${tabsAsist('/asistencias/qr')}
    <div class="grid c2">
      <div class="card">
        <div class="field"><label>Clase</label><select id="hora"><option value="">Automática (según la hora actual)</option>${agenda.map(a => `<option value="${a.hora}">${hh(a.hora)} · ${esc(fmap.get(a.formato_id)?.nombre || '')}</option>`).join('')}</select></div>
        <div class="scan" id="scan"><video id="vid" playsinline muted></video><div class="guia"></div></div>
        <div id="cam-msg" class="small muted" style="margin-top:8px"></div>
        <div class="row" style="margin-top:10px"><button id="b-cam" class="primary">Activar cámara</button><button id="b-luz" class="ghost" hidden>Luz</button><select id="cam-sel" hidden style="max-width:220px"></select>
          <label class="btn" style="margin:0">Sacar foto del QR<input type="file" id="foto" accept="image/*" capture="environment" class="hidden"></label></div>
        <div class="field" style="margin-top:14px"><label>¿No lee? Pegá el código del alumno</label><div class="row"><input id="cod" placeholder="OMEGA|…" class="grow" autocomplete="off"><button id="b-cod">Registrar</button></div></div>
      </div>
      <div class="card"><div id="resultado"><div class="empty">El resultado del escaneo aparece acá.</div></div><h3 style="margin-top:18px">Escaneados en esta sesión</h3><div id="log"></div></div></div>`;
  const vid = $('#vid', main); const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d', { willReadFrequently: true });
  let ultimo = '', ultimoT = 0, activo = false; const log = [];
  async function registrar(codigo) {
    codigo = String(codigo || '').trim(); if (!codigo) return;
    if (codigo === ultimo && Date.now() - ultimoT < 6000) return; ultimo = codigo; ultimoT = Date.now();
    const hora = $('#hora', main).value;
    try {
      const r = await api('POST', '/asistencias/qr', { codigo, hora: hora === '' ? undefined : hora });
      const cls = r.duplicada ? 'warn' : (r.alerta_plan ? 'warn' : '');
      $('#resultado', main).innerHTML = `<div class="scan-res ${cls}">${r.foto ? `<img class="avatar lg" src="${esc(r.foto)}" alt="">` : `<span class="avatar lg">${esc(iniciales(r.cliente))}</span>`}
        <h2 style="margin:10px 0 2px">${esc(r.cliente)}</h2>
        <div>${r.duplicada ? 'Ya estaba registrado en esta clase' : '✓ Asistencia registrada'} · clase de las <b>${hh(r.hora)}</b></div>
        ${r.alerta_plan ? `<div class="warnbox" style="margin-top:10px">${esc(r.alerta_plan)}</div>` : ''}</div>`;
      log.unshift({ n: r.cliente, h: hh(r.hora), dup: r.duplicada }); pintarLog();
      if (navigator.vibrate) navigator.vibrate(r.duplicada ? 80 : 40);
    } catch (e) {
      $('#resultado', main).innerHTML = `<div class="scan-res bad"><h2 style="margin:0 0 6px">No se pudo registrar</h2><div>${esc(e.message)}</div></div>`;
    }
  }
  function pintarLog() { $('#log', main).innerHTML = log.slice(0, 12).map(l => `<div class="list-item ${l.dup ? '' : 'ok'}"><div class="grow"><b>${esc(l.n)}</b></div><span class="small muted">${l.h}${l.dup ? ' · repetido' : ''}</span></div>`).join('') || '<div class="muted small">Todavía no escaneaste a nadie.</div>'; }
  pintarLog();
  let lector = null;
  const msg = $('#cam-msg', main);
  async function arrancar(deviceId) {
    if (lector) { lector.detener(); lector = null; }
    try {
      lector = await LectorQR.iniciar(vid, registrar, { deviceId });
      activo = true; $('#b-cam', main).textContent = 'Cámara activa'; $('#b-cam', main).disabled = true;
      msg.innerHTML = 'Apuntá al QR del alumno, a unos 15–30 cm, con el brillo del celular al máximo.' + (lector.nativo ? '' : ' <span class="muted">(lectura compatible)</span>');
      const cams = await lector.camaras();
      const sel = $('#cam-sel', main);
      if (cams.length > 1) { sel.hidden = false; sel.innerHTML = cams.map((c, i) => `<option value="${esc(c.deviceId)}">${esc(c.label || 'Cámara ' + (i + 1))}</option>`).join(''); const act = cams.find(c => c.label === lector.etiqueta); if (act) sel.value = act.deviceId; }
      $('#b-luz', main).hidden = !lector.hayLinterna();
    } catch (e) {
      msg.innerHTML = e.name === 'SinCamara'
        ? '<span class="t-amarillo">La cámara en vivo necesita una conexión segura (https) o abrir la app desde el acceso directo del gimnasio. Mientras tanto usá “Sacar foto del QR” o pegá el código.</span>'
        : '<span class="t-rojo">No se pudo usar la cámara (' + esc(e.name || e.message) + '). Revisá que no la use otro programa y que el navegador tenga permiso. Podés usar “Sacar foto del QR” o pegar el código.</span>';
    }
  }
  $('#b-cam', main).onclick = () => arrancar();
  $('#cam-sel', main).onchange = (e) => arrancar(e.target.value);
  let luz = false; $('#b-luz', main).onclick = async () => { if (lector) { luz = !luz; if (!(await lector.linterna(luz))) luz = false; $('#b-luz', main).textContent = luz ? 'Apagar luz' : 'Luz'; } };
  addTimer(() => { if (lector) lector.detener(); }, 'fn');
  $('#foto', main).onchange = (e) => {
    const f = e.target.files[0]; if (!f) return;
    const img = new Image(); const url = URL.createObjectURL(f);
    img.onload = async () => { const t = await LectorQR.deImagen(img); URL.revokeObjectURL(url); if (t) registrar(t); else toast('No se encontró un QR en la foto. Probá de nuevo más cerca y sin reflejos.', 'warn'); };
    img.src = url; e.target.value = '';
  };
  $('#b-cod', main).onclick = () => { registrar($('#cod', main).value); $('#cod', main).value = ''; };
  $('#cod', main).onkeydown = (e) => { if (e.key === 'Enter') $('#b-cod', main).click(); };
});


// ----- QR fijo del gimnasio: se imprime o se arma un banner; el alumno lo escanea con su celular y registra su propia asistencia
async function datosQRFijo() {
  const [t, u] = await Promise.all([api('GET', '/asistencias/qr-fijo'), urlApp()]);
  const url = u.url ? u.url + '#/asistir/' + t.token : null;
  return { url, u, token: t.token };
}
function afichaHtml(url) {
  const nombre = esc(S.marca.nombre || 'OMEGA');
  return `<!doctype html><html><head><meta charset="utf-8"><title>QR de asistencia</title><style>
    @page { size: A4; margin: 0 } *{box-sizing:border-box} body{margin:0;font-family:system-ui,"Segoe UI",Arial,sans-serif;color:#111;text-align:center}
    .top{background:#ff6b35;color:#fff;padding:36px 20px} .top h1{margin:0;font-size:46px;letter-spacing:.04em;text-transform:uppercase}
    .top img{max-height:90px;max-width:70%;margin-bottom:8px}
    h2{font-size:40px;margin:36px 20px 6px} p{font-size:22px;margin:4px 40px;color:#333}
    .qr{width:520px;margin:26px auto;padding:22px;border:6px solid #111;border-radius:28px} .qr svg{width:100%;height:auto;display:block}
    ol{display:inline-block;text-align:left;font-size:22px;margin:10px 0;padding-left:28px} li{margin:6px 0}</style></head><body>
    <div class="top">${S.marca.logo ? `<img src="${esc(S.marca.logo)}" alt=""><br>` : ''}<h1>${nombre}</h1></div>
    <h2>Registrá tu asistencia</h2><p>Escaneá este código con la cámara de tu celular</p>
    <div class="qr">${qrSvg(url)}</div>
    <ol><li>Escaneá el código.</li><li>Ingresá con tu usuario.</li><li>Elegí <b>Clase</b> o <b>Rutina</b>.</li></ol></body></html>`;
}
vista('/asistencias/qr-gimnasio', ['admin', 'profesor'], async (main) => {
  const adm = S.user.rol === 'admin';
  let d;
  try { d = await datosQRFijo(); } catch (e) { main.innerHTML = `<div class="page-title"><h1>QR del gimnasio</h1></div>${tabsAsist('/asistencias/qr-gimnasio')}<div class="warnbox">${esc(e.message)}</div>`; return; }
  main.innerHTML = `<div class="page-title"><h1>QR del gimnasio</h1></div>${tabsAsist('/asistencias/qr-gimnasio')}
    <div class="grid c2"><div class="card center">
      ${d.url ? `<div class="qrbox"><div style="width:min(70vw,300px)">${qrSvg(d.url)}</div></div><div class="small muted" style="margin-top:10px;word-break:break-all">${esc(d.url)}</div>
      <div class="row" style="justify-content:center;margin-top:12px"><button class="primary" id="b-imp">Imprimir cartel</button><button id="b-png">Descargar banner (imagen)</button></div>` : ''}
      ${avisoUrl(d.u)}</div>
    <div class="card"><h3>Cómo funciona</h3>
      <p class="muted">Este código es <b>fijo</b>: imprimilo o armá un banner y dejalo siempre a la vista en el gimnasio. No vence.</p>
      <ol class="muted" style="padding-left:20px;line-height:1.7"><li>El alumno lo escanea con la cámara de su celular y entra con su usuario.</li><li>Elige <b>Clase</b>: se registra en la clase del horario en que escaneó. O elige <b>Rutina</b>: pasa directo a sus rutinas.</li><li>Si escanea dos veces dentro de la misma clase no se duplica. Si escanea con una hora de diferencia, cuenta como dos clases seguidas.</li></ol>
      <div class="infobox small">La dirección del QR sale de la dirección de la app web. Si la cambiás en “Instalar la app en el celular”, volvé a imprimir el cartel.</div>
      ${adm ? '<div class="row" style="margin-top:12px"><button class="danger sm" id="b-nuevo">Renovar el código (el cartel impreso deja de servir)</button></div>' : ''}</div></div>`;
  const imp = $('#b-imp', main);
  if (imp) imp.onclick = () => {
    const f = document.createElement('iframe'); f.style.cssText = 'position:fixed;width:0;height:0;border:0;right:0;bottom:0'; document.body.appendChild(f);
    f.srcdoc = afichaHtml(d.url); f.onload = () => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (_) { toast('No se pudo abrir la impresión. Descargá el banner y imprimilo.', 'warn'); } setTimeout(() => f.remove(), 60000); };
  };
  const png = $('#b-png', main);
  if (png) png.onclick = async () => {
    try {
      const W = 1240, H = 1754, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
      g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); g.fillStyle = '#ff6b35'; g.fillRect(0, 0, W, 260);
      g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = '900 96px system-ui, Arial'; g.fillText((S.marca.nombre || 'OMEGA').toUpperCase(), W / 2, 165);
      g.fillStyle = '#111'; g.font = '800 84px system-ui, Arial'; g.fillText('Registrá tu asistencia', W / 2, 420);
      g.fillStyle = '#333'; g.font = '46px system-ui, Arial'; g.fillText('Escaneá este código con la cámara de tu celular', W / 2, 490);
      const svg = new Blob([qrSvg(d.url).replace('<svg', '<svg width="700" height="700"')], { type: 'image/svg+xml' }); const u = URL.createObjectURL(svg);
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = u; });
      g.lineWidth = 12; g.strokeStyle = '#111'; g.beginPath(); g.roundRect(W / 2 - 400, 560, 800, 800, 40); g.stroke(); g.fillStyle = '#fff'; g.fillRect(W / 2 - 370, 590, 740, 740); g.drawImage(img, W / 2 - 350, 610, 700, 700); URL.revokeObjectURL(u);
      g.fillStyle = '#111'; g.textAlign = 'left'; g.font = '48px system-ui, Arial'; ['1. Escaneá el código.', '2. Ingresá con tu usuario.', '3. Elegí Clase o Rutina.'].forEach((t, k) => g.fillText(t, W / 2 - 330, 1480 + k * 78));
      c.toBlob(b => descargarArchivo('qr-asistencia-gimnasio.png', b), 'image/png');
    } catch (e) { fail(e); }
  };
  const nu = $('#b-nuevo', main);
  if (nu) nu.onclick = async () => { if (!(await confirmar('El cartel impreso con el código actual dejará de funcionar y vas a tener que imprimir uno nuevo. ¿Renovar?', 'Renovar', true))) return; try { await api('POST', '/asistencias/qr-fijo/nuevo'); toast('Código renovado'); render(); } catch (e) { fail(e); } };
});
