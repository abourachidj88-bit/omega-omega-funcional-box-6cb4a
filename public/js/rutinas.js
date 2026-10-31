'use strict';
// ---------- Rutinas de musculación (series, repeticiones, peso, descanso, zona) ----------
const MAX_RUTINA = 180;
const durRutina = (items) => Math.round(items.reduce((a, i) => a + (Number(i.series) || 0) * ((Number(i.seg_serie) || 0) + (Number(i.descanso_seg) || 0)), 0) / 60);

const DIAS_RUT = [[1, 'Lunes'], [2, 'Martes'], [3, 'Miércoles'], [4, 'Jueves'], [5, 'Viernes'], [6, 'Sábado']];

// Asignar una rutina a uno o varios clientes, repetida los días de la semana que se elijan
async function asignarRutina(r, despues, clientePreset) {
  const [clientes, profes] = await Promise.all([api('GET', '/clientes'), api('GET', '/profesores')]);
  const elegidos = new Map(clientePreset ? [[clientePreset.id, clientePreset.nombre]] : []);
  const m = modal('Asignar “' + r.nombre + '”', `<form id="f" class="stack">
    <div id="blq-cli">${campo('Cliente que la va a realizar', `<input id="q" placeholder="Buscar cliente por nombre…" autocomplete="off"><div id="res" class="small"></div>`)}<div id="chips" class="row" style="margin-top:6px"></div></div>
    <div class="field"><label>Días de la semana (se repite todas las semanas)</label>
      <div class="row">${DIAS_RUT.map(([n, t]) => `<label class="btn sm" style="margin:0"><input type="checkbox" data-d="${n}"> ${t}</label>`).join('')}</div>
      <div class="row" style="margin-top:6px"><button type="button" class="ghost sm" id="d-todos">Todos los días</button><button type="button" class="ghost sm" id="d-ninguno">Ninguno</button></div>
      <div class="small muted" style="margin-top:4px">Marcá uno o varios: por ejemplo todos los lunes y todos los jueves.</div></div>
    ${campo('Profesor de seguimiento (opcional)', `<select id="prof-seg"><option value="">Sin profesor asignado</option>${profes.map(p => `<option value="${p.id}" ${S.user.id === p.id ? 'selected' : ''}>${esc(p.nombre)}</option>`).join('')}</select>`)}
    <div class="row" style="justify-content:flex-end"><button type="button" data-close>Cancelar</button><button class="primary">Asignar</button></div></form>`);
  const chips = () => { $('#chips', m).innerHTML = [...elegidos].map(([id, n]) => `<span class="pill">${esc(n)} <button type="button" class="ghost sm" data-x="${id}" style="padding:0 6px">✕</button></span>`).join('') || '<span class="muted small">Todavía no elegiste ningún cliente.</span>'; $$('[data-x]', m).forEach(b => b.onclick = () => { elegidos.delete(Number(b.dataset.x)); chips(); }); };
  chips();
  if (clientePreset) $('#blq-cli', m).querySelector('.field').hidden = true;
  $('#q', m).oninput = (e) => {
    const q = norm(e.target.value), box = $('#res', m); if (q.length < 2) { box.innerHTML = ''; return; }
    const r2 = clientes.filter(c => norm(c.nombre).includes(q)).slice(0, 8);
    box.innerHTML = r2.length ? r2.map(c => `<button type="button" class="sm" data-c="${c.id}" style="margin:2px">${esc(c.nombre)}</button>`).join('') : '<span class="muted">Sin resultados</span>';
    $$('[data-c]', box).forEach(b => b.onclick = () => { elegidos.set(Number(b.dataset.c), b.textContent); chips(); });
  };
  $('#d-todos', m).onclick = () => $$('[data-d]', m).forEach(c => c.checked = true);
  $('#d-ninguno', m).onclick = () => $$('[data-d]', m).forEach(c => c.checked = false);
  $('#f', m).onsubmit = async (e) => {
    e.preventDefault();
    const dias = $$('[data-d]', m).filter(c => c.checked).map(c => Number(c.dataset.d));
    if (!elegidos.size) return toast('Elegí al menos un cliente', 'warn');
    if (!dias.length) return toast('Marcá al menos un día de la semana', 'warn');
    try { await api('POST', '/rutinas/asignar', { rutina_id: r.id, cliente_ids: [...elegidos.keys()], dias, profesor_id: $('#prof-seg', m).value ? Number($('#prof-seg', m).value) : null }); m.close(); toast('Rutina asignada'); despues(); } catch (er) { fail(er); }
  };
}

// Elegir una rutina de la biblioteca (agrupada por profesor) y asignarla al cliente
async function elegirRutinaPara(cliente, despues) {
  const grupos = await api('GET', '/rutinas/biblioteca');
  const m = modal('Rutina para ' + cliente.nombre, `<div class="row" style="margin-bottom:8px"><input id="q" placeholder="Buscar rutina o profesor…" autocomplete="off" style="flex:1">${puede('plan.rutinas_editar') ? '<button class="primary sm" id="nr">＋ Crear rutina nueva para este cliente</button>' : ''}</div><div id="lst"></div>`, { wide: true });
  const pintar = () => {
    const q = norm($('#q', m).value);
    $('#lst', m).innerHTML = grupos.map(g => {
      const rs = g.rutinas.filter(r => !q || norm(r.nombre).includes(q) || norm(g.profesor).includes(q));
      return rs.length ? `<h4 style="margin:10px 0 4px">${esc(g.profesor)}${g.propio ? ' <span class="pill verde">Mías</span>' : ''}</h4>${rs.map(r => `<div class="list-item" data-r="${r.id}" style="cursor:pointer"><div class="grow"><b>${esc(r.nombre)}</b><div class="small muted">${r.ejercicios} ejercicios · ≈ ${r.duracion_min} min · ${r.asignados.length} ${r.asignados.length === 1 ? 'alumno' : 'alumnos'}</div></div><span class="pill">Elegir ›</span></div>`).join('')}` : '';
    }).join('') || '<div class="empty">No hay rutinas en la biblioteca todavía.</div>';
    $$('[data-r]', m).forEach(el => el.onclick = () => { const r = grupos.flatMap(g => g.rutinas).find(x => x.id === Number(el.dataset.r)); m.close(); asignarRutina(r, despues, cliente).catch(fail); });
  };
  $('#q', m).oninput = pintar; pintar();
  const nr = $('#nr', m); if (nr) nr.onclick = () => { m.close(); formRutina(null, { cliente, despues }); };
}
// Elegir un cliente (buscador) y seguir con la rutina
async function elegirClienteParaRutina(despues) {
  const clientes = await api('GET', '/clientes');
  const m = modal('¿A qué cliente?', `<input id="q" placeholder="Buscar cliente por nombre…" autocomplete="off"><div id="res" style="margin-top:8px"></div>`);
  $('#q', m).oninput = (e) => {
    const q = norm(e.target.value), box = $('#res', m); if (q.length < 2) { box.innerHTML = '<span class="muted small">Escribí al menos 2 letras.</span>'; return; }
    const r2 = clientes.filter(c => norm(c.nombre).includes(q)).slice(0, 12);
    box.innerHTML = r2.length ? r2.map(c => `<div class="list-item" data-c="${c.id}" style="cursor:pointer"><div class="grow"><b>${esc(c.nombre)}</b></div><span class="pill">Elegir ›</span></div>`).join('') : '<span class="muted">Sin resultados</span>';
    $$('[data-c]', box).forEach(el => el.onclick = () => { const c = r2.find(x => x.id === Number(el.dataset.c)); m.close(); elegirRutinaPara({ id: c.id, nombre: c.nombre }, despues).catch(fail); });
  };
}

vista('/planificacion/rutinas', ['admin', 'profesor'], async (main) => {
  const edita = puede('plan.rutinas_editar');
  let modo = 'cliente'; try { modo = sessionStorage.getItem('omega_rut_modo') || 'cliente'; } catch (_) {}
  let q = '', qraw = '';
  const [porCli, grupos, inhab] = await Promise.all([api('GET', '/rutinas/por-cliente'), api('GET', '/rutinas/biblioteca'), api('GET', '/rutinas-inhabilitadas')]);
  const verRutina = async (id) => { try { const r = await api('GET', '/rutinas/' + id); modal(r.nombre, rutinaHtml(r)); } catch (e) { fail(e); } };
  function pintar() {
    try { sessionStorage.setItem('omega_rut_modo', modo); } catch (_) {}
    const total = grupos.reduce((a, g) => a + g.rutinas.length, 0);
    let cuerpo;
    if (modo === 'cliente') {
      const lista = porCli.filter(c => !q || norm(c.cliente).includes(q) || c.rutinas.some(r => norm(r.rutina).includes(q)));
      cuerpo = `<p class="muted">Cada cliente con <b>todas</b> las rutinas que tiene asignadas (puede tener varias). Para darle una rutina a un alumno nuevo podés usar una ya creada en la <b>Biblioteca</b> o crear una a su medida: se guarda también en la biblioteca.</p>
        ${lista.length ? lista.map(c => `<div class="card" style="margin-bottom:10px"><div class="row between"><h3 style="margin:0"><a href="#/clientes/${c.cliente_id}">${esc(c.cliente)}</a> <span class="pill">${c.rutinas.length} ${c.rutinas.length === 1 ? 'rutina' : 'rutinas'}</span></h3>${edita ? `<button class="sm" data-mas="${c.cliente_id}" data-n="${esc(c.cliente)}">＋ Agregar rutina</button>` : ''}</div>
          ${c.rutinas.map(a => `<div class="list-item"><div class="grow"><b>${esc(a.rutina)}</b><div class="small muted">${esc(a.dias_txt)} · ≈ ${a.duracion_min} min</div><div class="small">${a.profesor ? 'Seguimiento: <b>' + esc(a.profesor) + '</b>' : '<span class="muted">Sin profesor de seguimiento</span>'}</div></div><button class="sm" data-v="${a.rutina_id}">Ver</button>${edita ? `<button class="danger sm" data-q="${a.id}" title="Quitar esta rutina al cliente">Quitar</button>` : ''}</div>`).join('')}</div>`).join('') : '<div class="card"><div class="empty">' + (q ? 'Sin resultados.' : 'Todavía no hay clientes con rutinas asignadas.') + '</div></div>'}`;
    } else {
      const gs = grupos.map(g => ({ ...g, rutinas: g.rutinas.filter(r => !q || norm(r.nombre).includes(q) || norm(g.profesor).includes(q) || r.asignados.some(a => norm(a.cliente).includes(q))) })).filter(g => g.rutinas.length);
      cuerpo = `<p class="muted">Todas las rutinas creadas, por profesor, y a quién se la asignaron. <b>Cualquier profesor puede usarlas y asignarlas a cualquier alumno</b>; solo quien la creó puede modificarla (para adaptarla, usá <b>Duplicar</b>). Dos profesores pueden tener rutinas con el mismo nombre: quedan separadas por profesor.</p>
        ${gs.length ? gs.map(g => `<div class="card" style="margin-bottom:10px"><h3 style="margin:0 0 6px">Profesor: ${esc(g.profesor)} ${g.propio ? '<span class="pill verde">Mías</span>' : ''} <span class="pill">${g.rutinas.length}</span></h3>
          ${g.rutinas.map(r => `<div class="list-item" style="align-items:flex-start"><div class="grow"><b>${esc(r.nombre)}</b><div class="small muted">${r.ejercicios} ejercicios · ≈ ${r.duracion_min} min${r.descripcion ? ' · ' + esc(r.descripcion) : ''}</div>
            <div class="small">${r.asignados.length ? 'Asignada a: ' + r.asignados.map(a => `<a href="#/clientes/${a.cliente_id}">${esc(a.cliente)}</a> <span class="muted">(${esc(a.dias_txt)})</span>`).join(' · ') : '<span class="muted">Sin alumnos asignados</span>'}</div></div>
            <div class="row" style="flex-wrap:wrap;justify-content:flex-end"><button class="sm" data-v="${r.id}">Ver</button>${edita ? `<button class="sm" data-as="${r.id}">Asignar a un cliente</button><button class="sm" data-dup="${r.id}">Duplicar como mía</button>` : ''}${r.editable && edita ? `<button class="sm" data-ed="${r.id}">Editar</button><button class="sm" data-el="${r.id}" data-n="${r.asignados.length}" title="No se elimina: pasa a Inhabilitadas y se puede activar de nuevo">Inhabilitar</button>` : ''}</div></div>`).join('')}</div>`).join('') : '<div class="card"><div class="empty">' + (q ? 'Sin resultados.' : 'Todavía no hay rutinas. Creá la primera.') + '</div></div>'}
        <div class="card" style="margin-bottom:10px"><h3 style="margin:0 0 6px">Inhabilitadas <span class="pill">${inhab.length}</span></h3><p class="small muted">Las rutinas no se eliminan: al inhabilitarlas dejan de verse y de usarse, pero se conservan (con sus alumnos asignados) y las podés activar de nuevo.</p>
          ${inhab.filter(r => !q || norm(r.nombre).includes(q) || norm(r.profesor).includes(q)).map(r => `<div class="list-item"><div class="grow"><b>${esc(r.nombre)}</b> <span class="pill">inhabilitada</span><div class="small muted">Profesor: ${esc(r.profesor)} · ${r.ejercicios} ejercicios · ${r.alumnos} ${r.alumnos === 1 ? 'alumno la tenía' : 'alumnos la tenían'}</div></div>${edita && r.editable ? `<button class="primary sm" data-hab="${r.id}">Activar</button>` : ''}</div>`).join('') || '<div class="empty small">No hay rutinas inhabilitadas.</div>'}</div>`;
    }
    main.innerHTML = `<div class="page-title"><h1>Rutinas Personalizadas</h1><div class="actions">${edita ? '<button id="asig-cli">＋ Asignar rutina a un cliente</button><button class="primary" id="nueva">＋ Nueva rutina</button>' : ''}</div></div>${tabsPlan('/planificacion/rutinas')}
      <div class="row" style="margin-bottom:12px;gap:8px;flex-wrap:wrap"><button class="sm ${modo === 'cliente' ? 'primary' : ''}" id="m-cli">Por cliente (${porCli.length})</button><button class="sm ${modo === 'biblioteca' ? 'primary' : ''}" id="m-bib">Biblioteca de rutinas (${total})</button>
        <input id="q" value="${esc(qraw)}" placeholder="${modo === 'cliente' ? 'Buscar cliente o rutina…' : 'Buscar rutina, profesor o alumno…'}" style="max-width:320px"></div>${cuerpo}`;
    $('#m-cli', main).onclick = () => { modo = 'cliente'; q = qraw = ''; pintar(); };
    $('#m-bib', main).onclick = () => { modo = 'biblioteca'; q = qraw = ''; pintar(); };
    const qi = $('#q', main); qi.oninput = () => { qraw = qi.value; q = norm(qraw); const pos = qi.selectionStart; pintar(); const n = $('#q', main); n.focus(); n.setSelectionRange(pos, pos); };
    const bnr = $('#nueva', main); if (bnr) bnr.onclick = () => formRutina(null);
    const bac = $('#asig-cli', main); if (bac) bac.onclick = () => elegirClienteParaRutina(render).catch(fail);
    $$('[data-mas]', main).forEach(b => b.onclick = () => elegirRutinaPara({ id: Number(b.dataset.mas), nombre: b.dataset.n }, render).catch(fail));
    $$('[data-v]', main).forEach(b => b.onclick = () => verRutina(b.dataset.v));
    $$('[data-ed]', main).forEach(b => b.onclick = async () => { try { formRutina(await api('GET', '/rutinas/' + b.dataset.ed)); } catch (e) { fail(e); } });
    $$('[data-el]', main).forEach(b => b.onclick = async () => { const n = Number(b.dataset.n); if (!(await confirmar('¿Inhabilitar esta rutina?' + (n ? ' Deja de verse para ' + n + (n === 1 ? ' cliente' : ' clientes') + ' hasta que la actives de nuevo.' : ' La podés activar de nuevo cuando quieras.'), 'Inhabilitar'))) return; try { await api('POST', '/rutinas/' + b.dataset.el + '/inhabilitar', {}); toast('Rutina inhabilitada'); render(); } catch (e) { fail(e); } });
    $$('[data-hab]', main).forEach(b => b.onclick = async () => { try { await api('POST', '/rutinas/' + b.dataset.hab + '/habilitar', {}); toast('Rutina activada'); render(); } catch (e) { fail(e); } });
    $$('[data-q]', main).forEach(b => b.onclick = async () => { try { await api('DELETE', '/rutinas/asignaciones/' + b.dataset.q); render(); } catch (e) { fail(e); } });
    $$('[data-as]', main).forEach(b => b.onclick = () => asignarRutina(grupos.flatMap(g => g.rutinas).find(x => x.id === Number(b.dataset.as)), render).catch(fail));
    $$('[data-dup]', main).forEach(b => b.onclick = async () => { try { await api('POST', '/rutinas/' + b.dataset.dup + '/duplicar', {}); toast('Duplicada: ahora es tuya y la podés editar'); modo = 'biblioteca'; render(); } catch (e) { fail(e); } });
  }
  pintar();
});

async function formRutina(r, ctx) {
  const ejercicios = await api('GET', '/ejercicios');
  const items = r ? r.items.map(i => ({ ...i })) : [{ ejercicio_id: null, zona: ZONAS_UI[0], series: 3, repeticiones: '10', peso: '', descanso_seg: 60, seg_serie: 40 }];
  const m = modal(r ? 'Editar rutina' : 'Nueva rutina', `<form id="f" class="stack"><div class="fgrid">${campo('Nombre de la rutina *', `<input name="nombre" required value="${esc(r ? r.nombre : '')}" placeholder="Ej.: Tren superior A">`)}${campo('Descripción (opcional)', `<input name="descripcion" value="${esc(r ? r.descripcion : '')}">`)}</div>
    <div id="items"></div><div class="row"><button type="button" id="add">＋ Agregar ejercicio</button><span id="dur" class="pill"></span></div>
    <div class="row" style="justify-content:flex-end"><button type="button" data-close>Cancelar</button><button class="primary">Guardar rutina</button></div></form>`, { wide: true });
  function pintar() {
    $('#items', m).innerHTML = `<div class="tablewrap hbar"><table style="min-width:760px"><thead><tr><th>Patrón de movimiento</th><th>Ejercicio</th><th class="num">Series</th><th>Repeticiones</th><th>Peso</th><th class="num">Descanso (s)</th><th class="num">Seg. por serie</th><th></th></tr></thead><tbody>
      ${items.map((it, i) => `<tr style="cursor:default"><td><select data-i="${i}" data-k="zona">${ZONAS_UI.map(z => `<option ${z === it.zona ? 'selected' : ''}>${z}</option>`).join('')}</select></td>
        <td><select data-i="${i}" data-k="ejercicio_id"><option value="">Elegí…</option>${ejercicios.filter(e => e.zona === it.zona).map(e => `<option value="${e.id}" ${e.id === it.ejercicio_id ? 'selected' : ''}>${esc(e.nombre)}</option>`).join('')}</select></td>
        <td><input type="number" min="1" max="20" data-i="${i}" data-k="series" value="${it.series}" style="width:64px"></td><td><input data-i="${i}" data-k="repeticiones" value="${esc(String(it.repeticiones))}" style="width:90px" placeholder="8-12"></td>
        <td><input data-i="${i}" data-k="peso" value="${esc(it.peso || '')}" style="width:90px" placeholder="20 kg"></td><td><input type="number" min="0" max="600" data-i="${i}" data-k="descanso_seg" value="${it.descanso_seg}" style="width:80px"></td>
        <td><input type="number" min="10" max="300" data-i="${i}" data-k="seg_serie" value="${it.seg_serie}" style="width:80px"></td><td><button type="button" class="danger sm" data-x="${i}">✕</button></td></tr>`).join('')}</tbody></table></div>`;
    $$('[data-k]', m).forEach(inp => inp.onchange = inp.oninput = () => {
      const it = items[Number(inp.dataset.i)], k = inp.dataset.k;
      it[k] = k === 'ejercicio_id' ? (inp.value ? Number(inp.value) : null) : inp.value;
      if (k === 'zona') { it.ejercicio_id = null; pintar(); } else dur();
    });
    $$('[data-x]', m).forEach(b => b.onclick = () => { items.splice(Number(b.dataset.x), 1); pintar(); });
    dur();
  }
  function dur() { const d = durRutina(items); const el = $('#dur', m); el.textContent = 'Duración ≈ ' + d + ' min (máx. ' + MAX_RUTINA + ')'; el.className = 'pill ' + (d > MAX_RUTINA ? 'rojo' : 'verde'); }
  $('#add', m).onclick = () => { const u = items[items.length - 1]; items.push({ ejercicio_id: null, zona: u ? u.zona : ZONAS_UI[0], series: 3, repeticiones: '10', peso: '', descanso_seg: 60, seg_serie: 40 }); pintar(); };
  pintar();
  $('#f', m).onsubmit = async (e) => {
    e.preventDefault(); const fd = Object.fromEntries(new FormData(e.target));
    if (items.some(i => !i.ejercicio_id)) return toast('Elegí el ejercicio de cada fila', 'warn');
    if (durRutina(items) > MAX_RUTINA) return toast('La rutina supera los ' + MAX_RUTINA + ' minutos', 'warn');
    try { const g = r ? await api('PUT', '/rutinas/' + r.id, { ...fd, items }) : await api('POST', '/rutinas', { ...fd, items }); m.close(); toast('Rutina guardada' + (!r ? ' y agregada a la biblioteca' : '')); if (ctx && ctx.cliente && !r) asignarRutina({ id: g.id, nombre: fd.nombre }, ctx.despues || render, ctx.cliente).catch(fail); else { try { sessionStorage.setItem('omega_rut_modo', 'biblioteca'); } catch (_) {} render(); } } catch (er) { fail(er); }
  };
}
