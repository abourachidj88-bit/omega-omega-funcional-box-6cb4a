'use strict';
// ---------- Rutinas de musculación (series, repeticiones, peso, descanso, zona) ----------
const MAX_RUTINA = 180;
const durRutina = (items) => Math.round(items.reduce((a, i) => a + (Number(i.series) || 0) * ((Number(i.seg_serie) || 0) + (Number(i.descanso_seg) || 0)), 0) / 60);

const DIAS_RUT = [[1, 'Lunes'], [2, 'Martes'], [3, 'Miércoles'], [4, 'Jueves'], [5, 'Viernes'], [6, 'Sábado']];

// Asignar una rutina a uno o varios clientes, repetida los días de la semana que se elijan
async function asignarRutina(r, despues, clientePreset) {
  const clientes = await api('GET', '/clientes');
  const elegidos = new Map(clientePreset ? [[clientePreset.id, clientePreset.nombre]] : []);
  const m = modal('Asignar “' + r.nombre + '”', `<form id="f" class="stack">
    <div id="blq-cli">${campo('Cliente que la va a realizar', `<input id="q" placeholder="Buscar cliente por nombre…" autocomplete="off"><div id="res" class="small"></div>`)}<div id="chips" class="row" style="margin-top:6px"></div></div>
    <div class="field"><label>Días de la semana (se repite todas las semanas)</label>
      <div class="row">${DIAS_RUT.map(([n, t]) => `<label class="btn sm" style="margin:0"><input type="checkbox" data-d="${n}"> ${t}</label>`).join('')}</div>
      <div class="row" style="margin-top:6px"><button type="button" class="ghost sm" id="d-todos">Todos los días</button><button type="button" class="ghost sm" id="d-ninguno">Ninguno</button></div>
      <div class="small muted" style="margin-top:4px">Marcá uno o varios: por ejemplo todos los lunes y todos los jueves.</div></div>
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
    try { await api('POST', '/rutinas/asignar', { rutina_id: r.id, cliente_ids: [...elegidos.keys()], dias }); m.close(); toast('Rutina asignada'); despues(); } catch (er) { fail(er); }
  };
}

vista('/planificacion/rutinas', ['admin', 'profesor'], async (main) => {
  const [lista, asig] = await Promise.all([api('GET', '/rutinas'), api('GET', '/rutinas/asignaciones')]);
  main.innerHTML = `<div class="page-title"><h1>Rutinas</h1><div class="actions">${puede('plan.rutinas_editar') ? '<button class="primary" id="nueva">＋ Nueva rutina</button>' : ''}</div></div>${tabsPlan('/planificacion/rutinas')}
    <p class="muted">Las rutinas son <b>personalizadas</b>: armalas con series, repeticiones, peso y descanso (máximo <b>${MAX_RUTINA} minutos</b>) y asignalas a un cliente en los días de la semana que corresponda. El cliente la ve en su app y vos la ves en su ficha de Clientes.</p>
    <div class="grid c2">
      <div class="card"><h3>Mis rutinas (${lista.length})</h3>${lista.length ? lista.map(r => `<div class="list-item"><div class="grow"><b>${esc(r.nombre)}</b><div class="small muted">${r.ejercicios} ejercicios · ≈ ${r.duracion_min} min${r.descripcion ? ' · ' + esc(r.descripcion) : ''}</div></div>
        ${puede('plan.rutinas_editar') ? `<button class="sm" data-as="${r.id}">Asignar a un cliente</button><button class="sm" data-ed="${r.id}">Editar</button><button class="danger sm" data-el="${r.id}">✕</button>` : ''}</div>`).join('') : '<div class="empty">Todavía no hay rutinas. Creá la primera.</div>'}</div>
      <div class="card"><h3>Rutinas asignadas (${asig.length})</h3>${asig.length ? asig.map(a => `<div class="list-item"><div class="grow"><a href="#/clientes/${a.cliente_id}"><b>${esc(a.cliente)}</b></a><div class="small muted">${esc(a.rutina)} · ${esc(a.dias_txt)}</div></div>${puede('plan.rutinas_editar') ? `<button class="ghost sm" data-q="${a.id}">Quitar</button>` : ''}</div>`).join('') : '<div class="muted small">Nada asignado todavía.</div>'}</div></div>`;
  const bnr = $('#nueva', main); if (bnr) bnr.onclick = () => formRutina(null);
  $$('[data-ed]', main).forEach(b => b.onclick = async () => { try { formRutina(await api('GET', '/rutinas/' + b.dataset.ed)); } catch (e) { fail(e); } });
  $$('[data-el]', main).forEach(b => b.onclick = async () => { if (!(await confirmar('¿Eliminar esta rutina? También se saca de los clientes que la tienen asignada.', 'Eliminar', true))) return; try { await api('DELETE', '/rutinas/' + b.dataset.el); render(); } catch (e) { fail(e); } });
  $$('[data-q]', main).forEach(b => b.onclick = async () => { try { await api('DELETE', '/rutinas/asignaciones/' + b.dataset.q); render(); } catch (e) { fail(e); } });
  $$('[data-as]', main).forEach(b => b.onclick = () => asignarRutina(lista.find(x => x.id === Number(b.dataset.as)), render).catch(fail));
});

async function formRutina(r) {
  const ejercicios = await api('GET', '/ejercicios');
  const items = r ? r.items.map(i => ({ ...i })) : [{ ejercicio_id: null, zona: ZONAS_UI[0], series: 3, repeticiones: '10', peso: '', descanso_seg: 60, seg_serie: 40 }];
  const m = modal(r ? 'Editar rutina' : 'Nueva rutina', `<form id="f" class="stack"><div class="fgrid">${campo('Nombre de la rutina *', `<input name="nombre" required value="${esc(r ? r.nombre : '')}" placeholder="Ej.: Tren superior A">`)}${campo('Descripción (opcional)', `<input name="descripcion" value="${esc(r ? r.descripcion : '')}">`)}</div>
    <div id="items"></div><div class="row"><button type="button" id="add">＋ Agregar ejercicio</button><span id="dur" class="pill"></span></div>
    <div class="row" style="justify-content:flex-end"><button type="button" data-close>Cancelar</button><button class="primary">Guardar rutina</button></div></form>`, { wide: true });
  function pintar() {
    $('#items', m).innerHTML = `<div class="tablewrap hbar"><table style="min-width:760px"><thead><tr><th>Zona</th><th>Ejercicio</th><th class="num">Series</th><th>Repeticiones</th><th>Peso</th><th class="num">Descanso (s)</th><th class="num">Seg. por serie</th><th></th></tr></thead><tbody>
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
    try { r ? await api('PUT', '/rutinas/' + r.id, { ...fd, items }) : await api('POST', '/rutinas', { ...fd, items }); m.close(); toast('Rutina guardada'); render(); } catch (er) { fail(er); }
  };
}
