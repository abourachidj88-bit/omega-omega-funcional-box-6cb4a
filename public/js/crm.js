'use strict';
// ---------- Módulo CRM: visitas y clientes potenciales ----------
function mesMasCRM(mes, n) { const [y, m] = mes.split('-').map(Number); return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7); }
const OBJETIVOS = ['Bajar de peso', 'Ganar músculo', 'Tonificar', 'Mejorar mi condición física', 'Salud y bienestar', 'Rendimiento deportivo', 'Otro'];

vista('/crm', ['admin', 'profesor'], async (main) => {
  const adm = S.user.rol === 'admin';
  let mes = sessionStorage.getItem('omega_crm_mes') || hoyAR().slice(0, 7);
  async function cargar() {
    sessionStorage.setItem('omega_crm_mes', mes);
    const d = await api('GET', '/leads?mes=' + mes);
    const k = d.kpis, maxV = Math.max(1, ...d.por_profesor.map(p => p.visitas));
    main.innerHTML = `
      <div class="row between" style="align-items:flex-start;margin-bottom:14px;gap:12px">
        <div><h1 style="margin:0 0 4px">CRM · Visitas</h1><div class="muted">Seguimiento de las personas que pasan por el gimnasio hasta que se inscriben.</div>
          <div class="row" style="margin-top:12px">${puede('crm.gestionar') ? '<button class="primary" id="nueva">＋ Nueva visita</button>' : ''}<button class="ghost" id="b-xls">Exportar</button></div></div>
        <div id="qr-v" class="qr-esquina-wrap"></div></div>
      <div class="row" style="margin-bottom:12px"><button class="sm" id="ant">‹</button><input type="month" id="mes" value="${mes}" style="width:auto"><button class="sm" id="sig">›</button><b style="text-transform:capitalize">${nombreMes(mes)}</b></div>
      <div class="grid k" style="margin-bottom:14px">
        <div class="kpi"><div class="v">${k.visitantes}</div><div class="l">Visitantes del mes</div></div>
        <div class="kpi verde"><div class="v">${k.convertidos}</div><div class="l">Se inscribieron (pagaron abono)</div></div>
        <div class="kpi ${k.tasa_conversion >= 30 ? 'verde' : k.tasa_conversion >= 15 ? 'amarillo' : 'rojo'}"><div class="v">${k.tasa_conversion}%</div><div class="l">Tasa de conversión</div></div>
        <div class="kpi"><div class="v" style="font-size:1.2rem">${k.por_origen.manual} <span class="small muted">carga manual</span><br>${k.por_origen.qr} <span class="small muted">por QR</span></div><div class="l">Cómo llegaron los datos</div></div></div>
      <div class="card" style="margin-bottom:14px"><h3>Efectividad de cierre por profesor</h3>
        ${d.por_profesor.length ? `<div class="tablewrap"><table><thead><tr><th>Profesor</th><th class="num">Visitas atendidas</th><th class="num">Inscriptos</th><th class="num">Efectividad</th><th style="width:30%"></th></tr></thead><tbody>
        ${d.por_profesor.map(p => `<tr style="cursor:default"><td><b>${esc(p.profesor)}</b></td><td class="num">${p.visitas}</td><td class="num">${p.convertidos}</td><td class="num"><b class="${p.tasa >= 30 ? 't-verde' : p.tasa >= 15 ? 't-amarillo' : 't-rojo'}">${p.tasa}%</b></td><td><div class="meter"><i style="width:${Math.round(100 * p.visitas / maxV)}%;opacity:.45"></i></div><div class="meter" style="margin-top:3px"><i style="width:${Math.round(100 * p.convertidos / maxV)}%;background:var(--verde)"></i></div></td></tr>`).join('')}</tbody></table></div>
        <div class="small muted" style="margin-top:6px">Se considera inscripto a quien quedó vinculado a un alumno con al menos un pago registrado.</div>` : '<div class="empty">Todavía no hay visitas este mes.</div>'}</div>
      ${d.por_campana && d.por_campana.length ? `<div class="card" style="margin-bottom:14px"><h3>Rendimiento por campaña</h3><div class="tablewrap"><table><thead><tr><th>Campaña</th><th class="num">Visitas</th><th class="num">Inscriptos</th><th class="num">Conversión</th></tr></thead><tbody>${d.por_campana.map(p => `<tr style="cursor:default"><td><b>${esc(p.campana || p.nombre || 'Sin campaña')}</b></td><td class="num">${p.visitas}</td><td class="num">${p.convertidos}</td><td class="num"><b class="${p.tasa >= 30 ? 't-verde' : p.tasa >= 15 ? 't-amarillo' : 't-rojo'}">${p.tasa}%</b></td></tr>`).join('')}</tbody></table></div></div>` : ''}
      <div class="card"><h3>Visitas de ${nombreMes(mes)}</h3>
        ${d.leads.length ? `<div class="tablewrap"><table><thead><tr><th>Fecha</th><th>Nombre</th><th>Teléfono</th><th>Campaña</th><th>Objetivo</th><th>Atendió</th><th>Estado</th><th></th></tr></thead><tbody>
        ${d.leads.map(l => `<tr style="cursor:default"><td>${fmtF(l.fecha)}</td><td><b>${esc(l.nombre)}</b>${l.origen === 'qr' ? ' <span class="pill">QR</span>' : ''}</td><td>${esc(l.telefono || '')}</td><td>${esc(l.campana || '—')}${l.referido ? `<div class="small muted">por ${esc(l.referido)}</div>` : ''}</td><td>${esc(l.objetivo || '')}</td><td>${esc(l.profesor || '—')}</td>
          <td>${l.pago ? '<span class="pill verde">Inscripto</span>' : l.estado === 'descartado' ? '<span class="pill">Descartado</span>' : l.cliente_id ? '<span class="pill amarillo">Alumno sin pago</span>' : '<span class="pill naranja">En seguimiento</span>'}</td>
          <td class="right" style="white-space:nowrap">${l.telefono ? botonWA(l.telefono, 'WhatsApp', 'sm') + ' ' : ''}${puede('crm.gestionar') ? `<button class="sm" data-ed="${l.id}">Editar</button>` : ''}${puede('crm.gestionar') && puede('cli.editar') && !l.cliente_id ? ` <button class="sm primary" data-al="${l.id}">Pasar a alumno</button>` : ''}${puede('crm.eliminar') ? ` <button class="danger sm" data-del="${l.id}">✕</button>` : ''}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">No hay visitas cargadas en este mes. Cargalas con “Nueva visita” o compartí el QR para que las completen ellos.</div>'}</div>`;
    const set = (m) => { mes = m; cargar().catch(fail); };
    $('#mes', main).onchange = (e) => e.target.value && set(e.target.value);
    $('#ant', main).onclick = () => set(mesMasCRM(mes, -1)); $('#sig', main).onclick = () => set(mesMasCRM(mes, 1));
    const bn = $('#nueva', main); if (bn) bn.onclick = () => formLead(null, d.profesores, cargar, d.campanas);
    $$('[data-ed]', main).forEach(b => b.onclick = () => formLead(d.leads.find(x => x.id === Number(b.dataset.ed)), d.profesores, cargar));
    $$('[data-del]', main).forEach(b => b.onclick = async () => { if (!(await confirmar('¿Eliminar esta visita?', 'Eliminar', true))) return; try { await api('DELETE', '/leads/' + b.dataset.del); cargar(); } catch (e) { fail(e); } });
    $$('[data-al]', main).forEach(b => b.onclick = () => { const l = d.leads.find(x => x.id === Number(b.dataset.al)); try { sessionStorage.setItem('omega_prelead', JSON.stringify({ nombre: l.nombre, celular: l.telefono || '', instagram: (l.redes || '').replace(/^@/, '') })); } catch (_) {} ir('#/clientes/nuevo'); });
    $('#b-xls', main).onclick = () => { if (!d.leads.length) return toast('No hay visitas para exportar', 'warn'); descargarXlsx('omega-visitas-' + mes + '.xlsx', { Visitas: d.leads.map(l => ({ Fecha: l.fecha, Nombre: l.nombre, Teléfono: l.telefono || '', Redes: l.redes || '', Objetivo: l.objetivo || '', Atendió: l.profesor || '', Origen: l.origen === 'qr' ? 'QR' : 'Manual', Inscripto: l.pago ? 'Sí' : 'No' })), Efectividad: d.por_profesor.map(p => ({ Profesor: p.profesor, Visitas: p.visitas, Inscriptos: p.convertidos, 'Efectividad %': p.tasa })) }); };
    qrVisitas($('#qr-v', main));
  }
  await cargar();
});

async function formLead(l, profes, despues) {
  let campanas = []; try { campanas = await api('GET', '/campanas'); } catch (_) {}
  const base = OBJETIVOS.filter(o => o !== 'Otro');
  const obj = l ? (l.objetivo || '') : '';
  const esOtro = obj && !base.includes(obj);
  const otroTxt = esOtro ? obj.replace(/^Otro:\s*/, '') : '';
  const m = modal(l ? 'Editar visita' : 'Nueva visita', `<form id="f" class="stack"><div class="fgrid">
    ${campo('Nombre y apellido *', `<input name="nombre" required value="${esc(l ? l.nombre : '')}" autocomplete="off">`)}
    ${campo('Teléfono', `<input name="telefono" inputmode="tel" value="${esc(l ? l.telefono || '' : '')}" placeholder="Se guarda con el prefijo +${esc(prefijoPais())}">`)}
    ${campo('Redes sociales', `<input name="redes" placeholder="@usuario" value="${esc(l ? l.redes || '' : '')}" autocapitalize="none">`)}
    ${campo('Objetivo a conseguir', `<select id="obj-sel"><option value="">—</option>${base.map(o => `<option ${obj === o ? 'selected' : ''}>${o}</option>`).join('')}<option value="Otro" ${esOtro ? 'selected' : ''}>Otro…</option></select>`)}
    <div id="obj-otro-w" ${esOtro ? '' : 'hidden'}>${campo('¿Cuál es su objetivo?', `<input id="obj-otro" maxlength="120" value="${esc(otroTxt)}" placeholder="Escribilo con tus palabras">`)}</div>
    ${campo('Campaña (¿cómo nos conoció?)', `<select name="campana_id"><option value="">—</option>${campanas.map(c => `<option value="${c.id}" data-tipo="${c.tipo}" ${l && l.campana_id === c.id ? 'selected' : ''}>${esc(c.nombre)}</option>`).join('')}</select>`)}
    <div id="ref-w" hidden style="grid-column:1/-1">${campo('Alumno que lo recomendó', `<input id="ref-q" placeholder="Buscar alumno por nombre…" autocomplete="off" value="${esc(l && l.referido ? l.referido : '')}"><input type="hidden" name="referido_id" value="${l && l.referido_id ? l.referido_id : ''}"><div id="ref-res" class="small"></div>`)}</div>
    ${campo('Profesor que lo atendió', `<select name="profesor_id"><option value="">—</option>${profes.map(p => `<option value="${p.id}" ${(l ? l.profesor_id : (S.user.rol === 'profesor' ? S.user.id : null)) === p.id ? 'selected' : ''}>${esc(p.nombre)}</option>`).join('')}</select>`)}
    ${campo('Fecha de la visita', `<input type="date" name="fecha" value="${esc(l ? l.fecha : hoyAR())}">`)}</div>
    ${campo('Nota (opcional)', `<input name="nota" value="${esc(l ? l.nota || '' : '')}">`)}
    ${l ? campo('Estado', `<select name="estado"><option value="visita" ${l.estado === 'visita' ? 'selected' : ''}>En seguimiento</option><option value="descartado" ${l.estado === 'descartado' ? 'selected' : ''}>Descartado (no se inscribe)</option></select>`) : ''}
    <div class="row" style="justify-content:flex-end"><button type="button" data-close>Cancelar</button><button class="primary">Guardar</button></div></form>`);
  const f = $('#f', m);
  $('#obj-sel', m).onchange = (e) => { $('#obj-otro-w', m).hidden = e.target.value !== 'Otro'; };
  const selCamp = f.elements.campana_id;
  const verRef = () => { const o = selCamp.selectedOptions[0]; $('#ref-w', m).hidden = !(o && o.dataset.tipo === 'recomendado'); if ($('#ref-w', m).hidden) f.elements.referido_id.value = ''; };
  selCamp.onchange = verRef; verRef();
  let clientes = null;
  $('#ref-q', m).oninput = async (e) => {
    f.elements.referido_id.value = '';
    const q = norm(e.target.value); const box = $('#ref-res', m);
    if (q.length < 2) { box.innerHTML = ''; return; }
    if (!clientes) { try { clientes = await api('GET', '/clientes'); } catch (er) { return fail(er); } }
    const r = clientes.filter(c => norm(c.nombre).includes(q)).slice(0, 6);
    box.innerHTML = r.length ? r.map(c => `<button type="button" class="sm" data-rc="${c.id}" style="margin:2px">${esc(c.nombre)}</button>`).join('') : '<span class="muted">Sin resultados</span>';
    $$('[data-rc]', box).forEach(b => b.onclick = () => { f.elements.referido_id.value = b.dataset.rc; $('#ref-q', m).value = b.textContent; box.innerHTML = '<span class="t-verde">✓ Seleccionado</span>'; });
  };
  f.onsubmit = async (e) => {
    e.preventDefault(); const fd = Object.fromEntries(new FormData(f));
    const sel = $('#obj-sel', m).value;
    fd.objetivo = sel === 'Otro' ? ('Otro: ' + ($('#obj-otro', m).value.trim() || 'sin detallar')) : sel;
    if (!fd.referido_id) delete fd.referido_id;
    try { if (l) await api('PUT', '/leads/' + l.id, fd); else await api('POST', '/leads', fd); m.close(); toast('Visita guardada'); despues(); } catch (er) { fail(er); }
  };
}

// QR de 10 x 10 cm (esquina superior derecha) que abre el formulario público
async function qrVisitas(cont) {
  const u = await urlApp();
  const link = u.url ? u.url + '#/visita' : null;
  cont.innerHTML = `<div class="qr-esquina" style="cursor:default">${link ? `<span class="qrbox" style="padding:6px;border-radius:10px;box-shadow:none"><span style="display:block;width:88px">${qrSvg(link)}</span></span>` : ''}
    <span class="small"><b>QR de visitas</b><br><span class="muted">Formulario para que se anoten solos</span><br><button class="sm primary" id="qv-b" style="margin-top:4px">Ver 10×10 cm / imprimir</button></span></div>`;
  $('#qv-b', cont).onclick = () => {
    if (!link) return toast('Primero cargá la dirección de la app web (Inicio → QR de la app)', 'warn');
    const m = modal('QR de visitas · 10 × 10 cm', `<div class="hoja-qr" id="hoja"><div class="qr10">${qrSvg(link)}</div><div class="hoja-txt"><div class="hoja-marca">${logoHtml(false)}</div><b>¿Venís a conocernos?</b><br>Escaneá y dejanos tus datos</div></div>
      <p class="small muted center" style="margin-top:10px">El código mide exactamente 10 × 10 cm al imprimir. También podés dejar esta pantalla abierta en una tablet en la recepción.</p>
      <div class="row" style="justify-content:center"><button id="imp" class="primary">Imprimir</button><button id="cp">Copiar link</button><button data-close>Cerrar</button></div>`, { wide: true });
    $('#cp', m).onclick = () => copiarTexto(link);
    $('#imp', m).onclick = () => { document.body.classList.add('imprimiendo'); try { window.print(); } catch (_) {} setTimeout(() => document.body.classList.remove('imprimiendo'), 800); };
  };
}
