'use strict';
// ---------- Módulo 2: Planificación de clases (Versión 6) ----------
// Los patrones de movimiento reemplazan a las antiguas "zonas": son el agrupamiento principal de la biblioteca.
const ZONAS_UI = ['Empujar (Push)', 'Tirar / Traccionar (Pull)', 'Agacharse / Sentadilla (Squat)', 'Bisagra de cadera / Carga (Hinge)', 'Bisagra de rodilla', 'Rotación y anti-rotación', 'Locomoción y transporte'];
const ILUSTRA_DE_PATRON = { empujar: 'flexion', tirar: 'remo_inc', sentadilla: 'sentadilla', bisagra_cadera: 'bisagra', bisagra_rodilla: 'zancada', rotacion: 'plancha', locomocion: 'sprint' };
const ZONA_PATRON = {}; // etiqueta del patrón -> ilustración por defecto
ZONAS_UI.forEach((z, i) => { ZONA_PATRON[z] = Object.values(ILUSTRA_DE_PATRON)[i]; });
const PATRON_NOMBRE = { sentadilla: 'Sentadilla', zancada: 'Zancada / desplante', bisagra: 'Bisagra de cadera (peso muerto)', puente: 'Puente de glúteos', subida: 'Subida al cajón', salto: 'Salto', saltar: 'Saltar la soga', talones: 'Talones al glúteo', sprint: 'Carrera', lateral: 'Desplazamiento lateral', escalador: 'Escalador', burpee: 'Burpee', swing: 'Swing', slam: 'Golpe de pelota (slam)', plancha: 'Plancha', plancha_lat: 'Plancha lateral', abdominal: 'Abdominal', elev_piernas: 'Elevación de piernas', bicho: 'Bicho muerto', bird: 'Perro de caza', rueda: 'Rueda abdominal', ruso: 'Giro ruso', remo_inc: 'Remo inclinado', tiron: 'Tirón vertical', dominada: 'Dominada', remo_inv: 'Remo invertido', pajaro: 'Pájaro (vuelos posteriores)', superman: 'Superman', pullover: 'Pullover', remo_menton: 'Remo al mentón', flexion: 'Flexión de brazos', press_piso: 'Press de pecho', apertura: 'Apertura de pecho', empuje: 'Empuje horizontal', fondos: 'Fondos', curl: 'Curl de bíceps', ext_tri: 'Extensión de tríceps', patada_tri: 'Patada de tríceps', pica: 'Pica (hombros)', press_vert: 'Press vertical', elev_lat: 'Elevación lateral', elev_front: 'Elevación frontal' };
let _EST = null;
async function estimulos() { if (!_EST) _EST = await api('GET', '/estimulos'); return _EST; }
const GRUPOS_EST = [['patrones', 'Estímulos de patrones de movimiento básicos'], ['capacidades', 'Estímulos de capacidades físicas integradas'], ['energias', 'Estímulos del sistema energético']];
// Foto del ejercicio: se reduce para que pese poco y cargue al instante en el celular
function fotoEjercicio(file, maxLado = 560) {
  return new Promise((res, rej) => {
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, maxLado / Math.max(img.width, img.height)); const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg', 0.72));
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('No se pudo leer la imagen')); };
    img.src = url;
  });
}
// Muestra las 3 posiciones (inicial, media y final) de un ejercicio
async function verPosiciones(e, eq) {
  let full = e;
  if (e.id && (e.foto1 || e.foto2 || e.foto3 || e.fotos)) { try { full = await api('GET', '/ejercicios/' + e.id); } catch (_) {} }
  const nom = eq ? eqNombre(eq, full.equipo) : '';
  const m = modal(full.nombre, `<p class="small muted">${esc(full.zona || '')}${nom && full.equipo !== 'ninguno' ? ' · ' + esc(nom) : ''}</p>${Ilustra.tira(full.patron || 'sentadilla', full.equipo, [full.img1, full.img2, full.img3], nom)}
    ${full.prog2 ? `<div class="small" style="margin-top:8px"><b>Progresión 1:</b> ${esc(full.prog2)}<br><b>Progresión 2:</b> ${esc(full.prog3)}</div>` : ''}
    <div class="row" style="justify-content:flex-end;margin-top:10px"><button data-close>Cerrar</button></div>`, { wide: true });
  return m;
}

function tabsPlan(activa) {
  const t = [['/planificacion', 'Agenda semanal', 'plan.semana'], ['/planificacion/staff', 'Agenda Staff', 'plan.staff'], ['/planificacion/formatos', 'Formatos e Intervalos', 'plan.semana'], ['/planificacion/semana', 'Planificación Semanal', 'plan.semana'], ['/planificacion/rutinas', 'Rutinas Personalizadas', 'plan.rutinas'], ['/planificacion/biblioteca', 'Biblioteca', 'plan.biblioteca'], ['/planificacion/equipos', 'Equipamiento', 'plan.config']].filter(x => puede(x[2]));
  return `<div class="tabs">${t.map(([h, n]) => `<button onclick="ir('#${h}')" class="${h === activa ? 'on' : ''}">${n}</button>`).join('')}</div>`;
}
// Semana elegida: es la misma en todas las pestañas del módulo
const semanaSel = () => sessionStorage.getItem('omega_semana') || lunesDe(hoyAR());
const semanaSet = (v) => sessionStorage.setItem('omega_semana', v);
const ORIGEN_TXT = { propia: 'guardada para esta semana', heredada: 'heredada de la última semana guardada', general: 'configuración general (todavía no se guardó ninguna semana)' };
// Navegador de semanas + calendario de semanas (A = agenda guardada, F = formatos guardados, C = circuitos planificados)
async function barraSemana(desde) {
  const lista = await api('GET', '/semanas?desde=' + sumaDias(desde, -14) + '&n=9');
  return `<div class="row" style="margin-bottom:6px"><button class="sm" id="ant">‹ Semana anterior</button><b>${fmtF(desde)} al ${fmtF(sumaDias(desde, 6))}</b><button class="sm" id="sig">Semana siguiente ›</button><button class="sm ghost" id="esta">Esta semana</button></div>
    <div class="tabs" style="margin-bottom:4px;overflow-x:auto;flex-wrap:nowrap">${lista.map(s => `<button data-sem="${s.semana}" class="${s.semana === desde ? 'on' : ''}" title="Agenda ${s.agenda} · Formatos ${s.formatos} · ${s.circuitos} circuitos">${fmtF(s.semana)}${s.actual ? ' •' : ''} <span class="small muted">${s.agenda === 'propia' ? 'A' : ''}${s.formatos === 'propia' ? 'F' : ''}${s.circuitos ? 'C' : ''}</span></button>`).join('')}</div>
    <div class="small muted" style="margin-bottom:10px">Calendario de semanas · A = agenda guardada · F = formatos guardados · C = circuitos planificados · • semana actual</div>`;
}
function ligarBarra(main, desde, ir_) {
  const set = (f) => { semanaSet(f); ir_(f); };
  $('#ant', main).onclick = () => set(sumaDias(desde, -7));
  $('#sig', main).onclick = () => set(sumaDias(desde, 7));
  $('#esta', main).onclick = () => set(lunesDe(hoyAR()));
  $$('[data-sem]', main).forEach(b => b.onclick = () => set(b.dataset.sem));
}
// Un formato está listo si define su trabajo (o marca que no usa intervalos) y su descanso (o marca que no lo usa).
const sinTrab = (f) => !!f.sin_trabajo, sinDesc = (f) => !!f.sin_trabajo || !!f.sin_descanso;
const trabListo = (f) => sinTrab(f) || f.trabajo_seg != null;
const descListo = (f) => sinDesc(f) || f.descanso_seg != null;
const formatoListo = (f) => trabListo(f) && descListo(f);
const durTxt = (n) => { n = Number(n) || 0; return n >= 60 ? Math.floor(n / 60) + ' min' + (n % 60 ? ' ' + (n % 60) + ' s' : '') : n + ' s'; };
const trabTxt = (f) => sinTrab(f) ? 'Sin intervalos' : (f.trabajo_seg != null ? durTxt(f.trabajo_seg) : null);
const descTxt = (f) => sinDesc(f) ? 'Sin descanso' : (f.descanso_seg != null ? durTxt(f.descanso_seg) : null);
const duracionFormato = (f) => !formatoListo(f) ? null : sinTrab(f) ? (f.duracion_min || 60) : Math.round(5 * (f.rondas || 3) * ((f.trabajo_seg || 0) + (sinDesc(f) ? 0 : f.descanso_seg)) / 60 * 10) / 10;
const eqNombre = (eq, clave) => (eq.find(e => e.clave === clave) || {}).nombre || clave;

// ---------- Planificación Semanal (la IA arma los circuitos con la agenda y los formatos de la semana) ----------
vista('/planificacion/semana', ['admin', 'profesor'], async (main) => {
  const adm = S.user.rol === 'admin';
  let desde = semanaSel();
  async function cargar() {
    semanaSet(desde);
    const [dias, formatos, md, barra] = await Promise.all([api('GET', '/planificacion?desde=' + desde + '&dias=7'), api('GET', '/formatos-semana?semana=' + desde), api('GET', '/planificacion/modo'), barraSemana(desde)]);
    const manual = md.modo === 'manual';
    const pendientes = formatos.formatos.filter(f => !formatoListo(f));
    const hayCircuitos = dias.some(d => d.fecha >= hoyAR() && d.clases.some(c => c.circuito));
    main.innerHTML = `
      <div class="page-title"><h1>Planificación Semanal</h1>
        <div class="actions">${puede('plan.generar') ? `<button id="gen" class="primary" ${pendientes.length ? 'disabled' : ''}>${manual ? 'Armar semana en blanco' : 'Generar semana con IA'}</button>${hayCircuitos ? '<button id="reh" class="danger">Eliminar semana</button>' : ''}` : ''}</div></div>
      ${tabsPlan('/planificacion/semana')}
      ${puede('plan.generar') ? `<div class="row" style="margin-bottom:10px"><span class="small muted">Cómo se arma la semana:</span><div class="tabs" style="margin:0"><button data-modo="ia" class="${manual ? '' : 'on'}">✨ Generar con IA</button><button data-modo="manual" class="${manual ? 'on' : ''}">✋ Manual</button></div></div>` : ''}
      ${manual ? '<div class="infobox" style="margin-bottom:10px">Modo manual: se crean los circuitos vacíos y elegís vos cada ejercicio (y su progresión) entrando a la clase → “Elegir”.</div>' : ''}
      ${pendientes.length ? `<div class="warnbox" style="margin-bottom:12px">Antes de planificar hay que cargar los intervalos de trabajo y descanso de: <b>${pendientes.map(f => esc(f.nombre)).join(', ')}</b>. ${adm ? '<a href="#/planificacion/formatos">Configurar ahora →</a>' : 'Pedile al administrador que los cargue.'}</div>` : ''}
      ${barra}<div class="infobox" style="margin-bottom:12px">La IA planifica la semana con la <a href="#/planificacion">agenda</a> y los <a href="#/planificacion/formatos">formatos e intervalos</a> de esta semana: cada estímulo (patrones de movimiento, capacidades físicas y sistema energético) se trabaja con frecuencia 2, para un óptimo de 3 entrenamientos por semana, y cada formato respeta sus estaciones y parámetros. Los alumnos que entrenan seguido o más de 3 veces por semana quedan acompañados por el staff.</div>
      ${dias.map(d => {
        const grupos = new Map();
        for (const c of d.clases) { const k = c.formato ? c.formato.id : 0; if (!grupos.has(k)) grupos.set(k, { formato: c.formato, circuito: c.circuito, horas: [] }); grupos.get(k).horas.push(c.hora); }
        return `<div class="card dia"><div class="row between"><h3 style="margin:0">${fmtFlargo(d.fecha)}${d.fecha === hoyAR() ? ' <span class="pill verde">Hoy</span>' : ''}</h3><span class="small muted">${d.clases.length} clases</span></div>
          ${d.clases.length ? [...grupos.values()].map(g => `<div class="clase-row" ${g.circuito ? `onclick="ir('#/planificacion/circuito/${g.circuito.id}')"` : ''}>
            <div class="grow"><div class="row">${chipFormato(g.formato)}<span class="small muted">${g.horas.map(h => hh(h)).join(' · ')}</span></div>
            ${g.circuito ? `<div class="small" style="margin-top:6px">${g.circuito.rondas[0].ejercicios.filter(e => !e.vacio).map(e => esc(e.nombre)).join(' · ') || '<span class="t-amarillo">Sin ejercicios: entrá para elegirlos</span>'}</div>${g.circuito.advertencias.length ? `<div class="small t-amarillo" style="margin-top:4px">⚠ ${esc(g.circuito.advertencias[0])}</div>` : ''}` : '<div class="small muted" style="margin-top:6px">Sin circuito generado</div>'}</div>
            ${g.circuito ? '<span class="pill">Ver circuito ›</span>' : ''}</div>`).join('') : '<div class="muted small" style="margin-top:8px">Sin clases este día.</div>'}</div>`;
      }).join('')}`;
    ligarBarra(main, desde, (f) => { desde = f; cargar().catch(fail); });
    $$('[data-modo]', main).forEach(b => b.onclick = async () => { try { await api('PUT', '/planificacion/modo', { modo: b.dataset.modo }); cargar(); } catch (e) { fail(e); } });
    const bgen = $('#gen', main); if (bgen) bgen.onclick = async (e) => {
      const hoy = hoyAR(), fin = sumaDias(desde, 6);
      const futuros = dias.some(d => d.fecha >= hoy && d.clases.some(c => c.circuito));
      if (futuros && !(await confirmar('Ya hay ejercicios cargados desde hoy en adelante. Se borran y se generan de nuevo' + (manual ? ' en blanco' : ' con IA (con la intensidad mínima actual)') + '. Los días que ya pasaron se conservan.', 'Borrar y generar', true))) return;
      const btn = e.target; btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Generando…';
      try {
        const r = await api('POST', '/planificacion/generar', { desde, dias: 7, modo: manual ? 'manual' : 'ia', rehacer: true, conservar_pasado: true });
        toast(r.creados + (manual ? ' circuitos en blanco' : ' circuitos generados con IA') + (fin < hoy ? ' · la semana ya pasó: solo se completaron los faltantes' : ''));
        await cargar();
      } catch (er) { fail(er); cargar().catch(() => {}); }
    };
    const reh = $('#reh', main);
    if (reh) reh.onclick = async () => {
      const hoy = hoyAR(), fin = sumaDias(desde, 6);
      if (fin < hoy) return toast('Esa semana ya pasó: no se modifica lo que ya se dio.', 'warn');
      const ini = desde > hoy ? desde : hoy, ndias = Math.round((Date.parse(fin) - Date.parse(ini)) / 86400000) + 1;
      const txt = ini === desde ? 'Se eliminan todos los ejercicios de esta semana' : 'Se eliminan los ejercicios desde hoy (' + fmtFlargo(ini) + ') hasta el ' + fmtFlargo(fin) + '. Los días que ya pasaron no se tocan';
      if (!(await confirmar(txt + ', tanto los generados con IA como los armados a mano. Después podés generarlos de nuevo con IA o armarlos en blanco.', 'Eliminar', true))) return;
      try { const r = await api('POST', '/planificacion/eliminar', { desde: ini, dias: ndias }); toast(r.eliminados + ' circuitos eliminados desde ' + fmtF(ini)); cargar(); } catch (er) { fail(er); }
    };
  }
  await cargar();
});

// ---------- Formatos e Intervalos: configuración de cada formato PARA LA SEMANA ----------
vista('/planificacion/formatos', ['admin', 'profesor'], async (main) => {
  const adm = puede('plan.config');
  let filas = [];
  async function cargar() {
    const desde = semanaSel();
    const [fs, est, barra] = await Promise.all([api('GET', '/formatos-semana?semana=' + desde), estimulos(), barraSemana(desde)]);
    filas = fs.formatos.map(f => ({ ...f }));
    pintar(desde, fs, est, barra);
  }
  const unidad = (f, k) => f['_u' + k] || ((f[k] || 0) >= 60 && (f[k] % 60 === 0) ? 'min' : 'seg');
  const valor = (f, k) => f[k] == null ? '' : (unidad(f, k) === 'min' ? f[k] / 60 : f[k]);
  function tiempo(f, i, k, off, etiqueta) {
    if (off) return `<span class="muted small">${etiqueta}: —</span>`;
    return `<span class="small muted">${etiqueta}</span><input type="number" min="0" step="any" data-t="${i}" data-k="${k}" value="${valor(f, k)}" placeholder="tiempo" style="width:84px" ${adm ? '' : 'disabled'}><select data-u="${i}" data-k="${k}" style="width:70px" ${adm ? '' : 'disabled'}><option value="seg" ${unidad(f, k) === 'seg' ? 'selected' : ''}>seg</option><option value="min" ${unidad(f, k) === 'min' ? 'selected' : ''}>min</option></select>`;
  }
  function pintar(desde, fs, est, barra) {
    const sinT = (f) => !!f.sin_trabajo;
    main.innerHTML = `<div class="page-title"><h1>Formatos e Intervalos</h1><div class="actions">${adm ? '<button id="nombres" class="ghost">Nombres y colores</button><button id="copiar">Copiar formatos semana anterior</button><button class="primary" id="ok">Guardar formatos de la semana</button>' : ''}</div></div>${tabsPlan('/planificacion/formatos')}
      ${barra}
      <div class="${fs.origen === 'propia' ? 'okbox' : 'infobox'}" style="margin-bottom:10px">Formatos ${ORIGEN_TXT[fs.origen]}${fs.origen === 'heredada' ? ' (' + fmtF(fs.desde) + ')' : ''}. Los formatos pueden cambiar de una semana a otra: guardalos para ${fmtF(desde)} al ${fmtF(sumaDias(desde, 6))}. Al guardar se rehacen los circuitos de la semana que falta dar y se actualiza la app de los clientes.</div>
      ${fs.sin_configurar && fs.sin_configurar.length ? `<div class="warnbox" style="margin-bottom:10px">Falta cargar el trabajo y el descanso de: <b>${fs.sin_configurar.map(x => esc(x.nombre || x)).join(', ')}</b>.</div>` : ''}
      ${filas.map((f, i) => `<div class="card" style="margin-bottom:12px"><div class="row between" style="flex-wrap:wrap;gap:8px"><div class="row">${chipFormato(f)}</div>
        <div class="row" style="flex-wrap:wrap;gap:8px">
          <span class="small muted">Estaciones</span><input type="number" min="1" max="12" data-e="${i}" value="${f.estaciones}" style="width:68px" ${adm ? '' : 'disabled'}>
          <span class="small muted">Rounds</span><select data-r="${i}" style="width:70px" ${adm ? '' : 'disabled'}>${[3, 2, 1].map(n => `<option value="${n}" ${(f.rondas || 3) === n ? 'selected' : ''}>${n}</option>`).join('')}</select>
          <span class="small muted">Personas por estación</span><input type="number" min="1" max="30" data-cu="${i}" value="${f.cupo_estacion ?? ''}" placeholder="auto" style="width:72px" ${adm ? '' : 'disabled'}>
          <span class="small muted">Intensidad mín.</span><select data-im="${i}" style="width:110px" ${adm ? '' : 'disabled'}>${['baja', 'moderada', 'alta'].map(x => `<option value="${x}" ${(f.intensidad_min || 'baja') === x ? 'selected' : ''}>${{ baja: 'Baja', moderada: 'Moderada', alta: 'Alta' }[x]}</option>`).join('')}</select></div></div>
        <div class="row" style="flex-wrap:wrap;gap:8px;margin:10px 0">
          <label class="row small" style="gap:6px;margin:0"><input type="checkbox" data-st="${i}" ${sinT(f) ? 'checked' : ''} ${adm ? '' : 'disabled'}> Sin intervalos (clase corrida)</label>
          ${sinT(f) ? `<span class="small muted">Duración</span><input type="number" min="1" max="600" data-dm="${i}" value="${f.duracion_min ?? 60}" style="width:76px" ${adm ? '' : 'disabled'}><span class="small muted">min</span>` : `${tiempo(f, i, 'trabajo_seg', false, 'Trabajo')}<label class="row small" style="gap:6px;margin:0 0 0 8px"><input type="checkbox" data-sd="${i}" ${f.sin_descanso ? 'checked' : ''} ${adm ? '' : 'disabled'}> Sin descanso</label>${tiempo(f, i, 'descanso_seg', !!f.sin_descanso, 'Descanso')}`}</div>
        <div class="grid c3">${GRUPOS_EST.map(([g, titulo]) => `<div><div class="small" style="margin-bottom:4px"><b>${titulo}</b></div>${est[g].map(o => `<label class="row small" style="gap:6px;margin:0 0 3px;align-items:flex-start" title="${esc(o.ejemplo || '')}"><input type="checkbox" data-g="${g}" data-i="${i}" value="${o.clave}" ${(f[g] || []).includes(o.clave) ? 'checked' : ''} ${adm ? '' : 'disabled'}> <span>${esc(o.nombre)}</span></label>`).join('')}</div>`).join('')}</div>
      </div>`).join('')}
      <p class="small muted">Elegí 1 o varios estímulos en cada uno de los tres grupos. La IA arma los circuitos de cada clase con las estaciones y los estímulos de su formato.</p>`;
    ligarBarra(main, desde, () => cargar().catch(fail));
    if (!adm) return;
    const toSeg = (f, k, v) => v === '' || v == null ? null : Math.round(Number(v) * (unidad(f, k) === 'min' ? 60 : 1));
    $$('input[data-t]', main).forEach(inp => inp.oninput = () => { const f = filas[Number(inp.dataset.t)]; f[inp.dataset.k] = toSeg(f, inp.dataset.k, inp.value); });
    $$('select[data-u]', main).forEach(sel => sel.onchange = () => { const f = filas[Number(sel.dataset.u)], k = sel.dataset.k, inp = $(`input[data-t="${sel.dataset.u}"][data-k="${k}"]`, main); f['_u' + k] = sel.value; f[k] = toSeg(f, k, inp.value); });
    $$('input[data-e]', main).forEach(inp => inp.oninput = () => { filas[Number(inp.dataset.e)].estaciones = inp.value === '' ? null : Number(inp.value); });
    $$('select[data-r]', main).forEach(s => s.onchange = () => { filas[Number(s.dataset.r)].rondas = Number(s.value); });
    $$('input[data-cu]', main).forEach(inp => inp.oninput = () => { filas[Number(inp.dataset.cu)].cupo_estacion = inp.value === '' ? null : Number(inp.value); });
    $$('select[data-im]', main).forEach(s => s.onchange = () => { filas[Number(s.dataset.im)].intensidad_min = s.value; });
    $$('input[data-dm]', main).forEach(inp => inp.oninput = () => { filas[Number(inp.dataset.dm)].duracion_min = inp.value === '' ? null : Number(inp.value); });
    $$('input[data-st]', main).forEach(ch => ch.onchange = () => { const f = filas[Number(ch.dataset.st)]; f.sin_trabajo = ch.checked ? 1 : 0; if (ch.checked) f.sin_descanso = 1; pintar(desde, fs, est, barra); });
    $$('input[data-sd]', main).forEach(ch => ch.onchange = () => { const f = filas[Number(ch.dataset.sd)]; f.sin_descanso = ch.checked ? 1 : 0; pintar(desde, fs, est, barra); });
    $$('input[data-g]', main).forEach(ch => ch.onchange = () => { const f = filas[Number(ch.dataset.i)], g = ch.dataset.g; const s = new Set(f[g] || []); if (ch.checked) s.add(ch.value); else s.delete(ch.value); f[g] = [...s]; });
    $('#nombres', main).onclick = () => editarFormatos(filas, 'nombre', () => cargar().catch(fail));
    $('#ok', main).onclick = async () => {
      for (const f of filas) {
        if (!f.estaciones || f.estaciones < 1) return toast('Indicá las estaciones de ' + f.nombre, 'warn');
        if (!f.sin_trabajo && f.trabajo_seg == null) return toast('Completá el tiempo de trabajo de ' + f.nombre, 'warn');
        if (!f.sin_trabajo && !f.sin_descanso && f.descanso_seg == null) return toast('Completá el descanso de ' + f.nombre + ' (o tildá “Sin descanso”)', 'warn');
        for (const [g, titulo] of GRUPOS_EST) if (!(f[g] || []).length) return toast(f.nombre + ': elegí al menos uno en «' + titulo + '»', 'warn');
      }
      const body = filas.map(f => ({ id: f.id, estaciones: f.estaciones, rondas: f.rondas || 3, cupo_estacion: f.cupo_estacion ?? null, intensidad_min: f.intensidad_min || 'baja', sin_trabajo: f.sin_trabajo ? 1 : 0, sin_descanso: f.sin_descanso || f.sin_trabajo ? 1 : 0, trabajo_seg: f.trabajo_seg ?? null, descanso_seg: f.descanso_seg ?? null, duracion_min: f.sin_trabajo ? (f.duracion_min || 60) : (f.duracion_min ?? null), patrones: f.patrones, capacidades: f.capacidades, energias: f.energias }));
      try { await api('PUT', '/formatos-semana', { semana: desde, formatos: body }); toast('Formatos guardados para la semana · circuitos y app de clientes actualizados'); cargar(); } catch (e) { fail(e); }
    };
    $('#copiar', main).onclick = async () => {
      if (fs.origen === 'propia' && !(await confirmar('Esta semana ya tiene formatos guardados. Se reemplazan por los de la semana anterior.', 'Copiar', true))) return;
      try { await api('POST', '/formatos-semana/copiar', { semana: desde }); toast('Formatos e intervalos copiados de la semana anterior'); cargar(); } catch (e) { fail(e); }
    };
  }
  await cargar();
});

function editarFormatos(fm, modo, despues) {
  const titulo = { nombre: 'Formatos de entrenamiento', trabajo_seg: 'Intervalos de trabajo', descanso_seg: 'Intervalos de descanso' }[modo];
  const colores = ['#ff6b35', '#3ecf8e', '#4da3ff', '#ffc233', '#c084fc', '#ff4d6d', '#2dd4bf', '#f472b6'];
  const filas = fm.map(f => ({ ...f }));
  const m = modal(titulo, '<div id="lista"></div><div id="acc"></div>', { wide: modo === 'nombre' });
  const pintar = () => {
    if (modo === 'nombre') {
      $('#lista', m).innerHTML = '<p class="small muted" style="margin-bottom:10px">Elegí cuántos <b>rounds</b> tiene cada formato. Cada ejercicio tiene 3 niveles (base y 2 progresiones): con 3 rounds se hacen los tres; con 2 rounds se usan las 2 progresiones más exigentes; con 1 round, la más exigente.</p>' + (filas.length ? '' : '<p class="muted">Todavía no hay formatos. Agregá el primero.</p>') + filas.map((f, i) => `<div class="row" style="margin-bottom:8px;flex-wrap:nowrap">
        <input type="color" data-i="${i}" data-k="color" value="${esc(f.color || colores[i % colores.length])}" style="width:48px;padding:3px;flex:0 0 48px"><input data-i="${i}" data-k="nombre" value="${esc(f.nombre)}" placeholder="Nombre del formato" class="grow"><select data-i="${i}" data-rd title="Cantidad de rounds del formato" style="width:176px;flex:0 0 176px">${[3, 2, 1].map(n => `<option value="${n}" ${(f.rondas || 3) === n ? 'selected' : ''}>${n} round${n > 1 ? 's' : ''}${n === 3 ? ' · base y 2 progres.' : n === 2 ? ' · 2 más exigentes' : ' · la más exigente'}</option>`).join('')}</select><button class="danger sm" data-q="${i}">Quitar</button></div>`).join('') + '<button id="add" class="ghost">+ Agregar formato</button>';
      $('#acc', m).innerHTML = '<div class="row sticky-act" style="justify-content:flex-end"><button data-close>Cancelar</button><button class="primary" id="ok">Guardar</button></div>';
      $$('input[data-k]', m).forEach(inp => inp.oninput = () => { filas[Number(inp.dataset.i)][inp.dataset.k] = inp.value; });
      $$('select[data-rd]', m).forEach(sel => sel.onchange = () => { filas[Number(sel.dataset.i)].rondas = Number(sel.value); });
      $$('[data-q]', m).forEach(b => b.onclick = async () => {
        const f = filas[Number(b.dataset.q)];
        if (f.id && !(await confirmar('¿Quitar el formato ' + f.nombre + '? Se saca de la agenda semanal.', 'Quitar', true))) return;
        if (f.id) { try { await api('DELETE', '/formatos/' + f.id); } catch (e) { return fail(e); } }
        filas.splice(Number(b.dataset.q), 1); pintar();
      });
      $('#add', m).onclick = () => { filas.push({ nombre: '', color: colores[filas.length % colores.length], rondas: 3 }); pintar(); };
    } else {
      const esT = modo === 'trabajo_seg', fl = esT ? 'sin_trabajo' : 'sin_descanso';
      // Tiempo libre: se escribe el número y se elige segundos o minutos (sin tope máximo)
      const unidad = (f) => f['_u' + modo] || ((f[modo] || 0) >= 60 && (f[modo] % 60 === 0) ? 'min' : 'seg');
      const valor = (f) => f[modo] == null ? '' : (unidad(f) === 'min' ? f[modo] / 60 : f[modo]);
      $('#lista', m).innerHTML = `<p class="muted">Escribí el tiempo de ${esT ? 'trabajo' : 'descanso'} de cada formato, en segundos o en minutos (sin límite). Si el formato no usa ${esT ? 'intervalos de trabajo' : 'descanso'}, tildá la casilla.${esT ? ' Un formato sin intervalos de trabajo es una clase corrida: indicá cuántos minutos dura (ej. Flex: 60).' : ''}</p>` + filas.map((f, i) => {
        const bloqueado = !esT && !!f.sin_trabajo; // si no usa trabajo, tampoco hay descanso
        const off = !!f[fl] || bloqueado;
        return `<div class="row" style="margin-bottom:10px;flex-wrap:wrap;gap:8px">${chipFormato(f)}<span class="grow"></span>
          <label class="row small" style="gap:6px;margin:0"><input type="checkbox" data-n="${i}" ${off ? 'checked' : ''} ${bloqueado ? 'disabled' : ''}> ${esT ? 'No usa intervalos de trabajo' : 'No usa descanso'}</label>
          ${off ? (esT && f.sin_trabajo ? `<input type="number" min="1" max="600" step="1" data-dm="${i}" value="${f.duracion_min ?? 60}" style="width:90px"><span class="muted small">min de clase</span>` : '<span class="muted small" style="width:200px;text-align:right">—</span>')
                : `<input type="number" min="0" step="any" data-i="${i}" value="${valor(f)}" placeholder="tiempo" style="width:100px"><select data-u="${i}" style="width:84px"><option value="seg" ${unidad(f) === 'seg' ? 'selected' : ''}>seg</option><option value="min" ${unidad(f) === 'min' ? 'selected' : ''}>min</option></select>`}</div>`;
      }).join('');
      $('#acc', m).innerHTML = '<div class="row" style="justify-content:flex-end;margin-top:8px"><button data-close>Cancelar</button><button class="primary" id="ok">Guardar</button></div>';
      const toSeg = (f, v) => v === '' || v == null ? null : Math.round(Number(v) * (unidad(f) === 'min' ? 60 : 1));
      $$('input[data-i]', m).forEach(inp => inp.oninput = () => { const f = filas[Number(inp.dataset.i)]; f[modo] = toSeg(f, inp.value); });
      $$('select[data-u]', m).forEach(sel => sel.onchange = () => { const f = filas[Number(sel.dataset.u)]; const inp = $(`input[data-i="${sel.dataset.u}"]`, m); f['_u' + modo] = sel.value; f[modo] = toSeg(f, inp.value); });
      $$('input[data-dm]', m).forEach(inp => inp.oninput = () => { filas[Number(inp.dataset.dm)].duracion_min = inp.value === '' ? null : Number(inp.value); });
      $$('input[data-n]', m).forEach(ch => ch.onchange = () => { const f = filas[Number(ch.dataset.n)]; f[fl] = ch.checked ? 1 : 0; if (esT && !ch.checked) f.sin_descanso = f.sin_descanso || 0; pintar(); });
    }
    $('#ok', m).onclick = async () => {
      try {
        let body;
        if (modo === 'nombre') {
          if (filas.some(f => !String(f.nombre || '').trim())) return toast('Completá el nombre de todos los formatos', 'warn');
          body = filas.map(f => ({ id: f.id, nombre: f.nombre, color: f.color, rondas: f.rondas || 3 }));
        } else {
          const fl = modo === 'trabajo_seg' ? 'sin_trabajo' : 'sin_descanso';
          if (filas.some(f => !f[fl] && !(modo === 'descanso_seg' && f.sin_trabajo) && (f[modo] == null || f[modo] === ''))) return toast('Completá el tiempo de todos los formatos, o tildá “no usa”', 'warn');
          body = filas.map(f => modo === 'trabajo_seg'
            ? { id: f.id, sin_trabajo: f.sin_trabajo ? 1 : 0, trabajo_seg: f.sin_trabajo ? (f.trabajo_seg ?? null) : f.trabajo_seg, duracion_min: f.sin_trabajo ? (f.duracion_min || 60) : (f.duracion_min ?? null) }
            : { id: f.id, sin_descanso: f.sin_descanso ? 1 : 0, descanso_seg: f.sin_descanso || f.sin_trabajo ? (f.descanso_seg ?? null) : f.descanso_seg });
        }
        await api('PUT', '/formatos', { formatos: body });
        m.close(); toast('Guardado'); despues();
      } catch (e) { fail(e); }
    };
  };
  pintar();
}

// ---------- Agenda semanal: qué formato se da en cada horario (es el primer paso de la planificación de la semana) ----------
vista('/planificacion', ['admin', 'profesor'], async (main) => {
  const adm = puede('plan.config');
  async function cargar() {
    const desde = semanaSel();
    const [ag, fm, barra] = await Promise.all([api('GET', '/agenda-semanal?semana=' + desde), api('GET', '/formatos'), barraSemana(desde)]);
    const horas = Array.from({ length: 17 }, (_, i) => 7 + i); // 7:00 a 23:00 (se pueden dejar baches libres)
    const cel = new Map(ag.celdas.map(a => [a.dia + '-' + a.hora, a.formato_id]));
    const opts = (sel) => '<option value="">—</option>' + fm.map(f => `<option value="${f.id}" ${sel === f.id ? 'selected' : ''}>${esc(f.nombre)}</option>`).join('');
    main.innerHTML = `<div class="page-title"><h1>Agenda semanal</h1><div class="actions">${adm ? '<button id="copiar">Copiar agenda semana anterior</button><button class="primary" id="ok">Guardar agenda de la semana</button>' : ''}</div></div>${tabsPlan('/planificacion')}
      ${barra}
      <div class="${ag.origen === 'propia' ? 'okbox' : 'infobox'}" style="margin-bottom:10px">Agenda ${ORIGEN_TXT[ag.origen]}${ag.origen === 'heredada' ? ' (' + fmtF(ag.desde) + ')' : ''}. ${adm ? 'Es el primer paso de la planificación: cada cambio que guardes actualiza la semana, el Staff y la app de los clientes.' : 'Solo el administrador puede modificarla.'}</div>
      <div class="tablewrap" style="padding:10px"><div class="agenda"><div></div>${DIAS_CORTO.slice(1).map((d, i) => `<div class="h">${d} ${sumaDias(desde, i).slice(8)}</div>`).join('')}
        ${horas.map(h => `<div class="h">${hh(h)}</div>${[1, 2, 3, 4, 5, 6, 7].map(d => `<select data-d="${d}" data-h="${h}" ${adm ? '' : 'disabled'}>${opts(cel.get(d + '-' + h) ?? null)}</select>`).join('')}`).join('')}</div></div>
      <p class="small muted" style="margin-top:10px">Siguiente paso: <a href="#/planificacion/staff">Agenda Staff</a> (elegir el profesor de cada clase) → <a href="#/planificacion/formatos">Formatos e Intervalos</a> → <a href="#/planificacion/semana">Planificación Semanal</a>.</p>`;
    ligarBarra(main, desde, () => cargar().catch(fail));
    if (!adm) return;
    $('#ok', main).onclick = async () => {
      const celdas = $$('select[data-d]', main).filter(s => s.value).map(s => ({ dia: Number(s.dataset.d), hora: Number(s.dataset.h), formato_id: Number(s.value) }));
      try { await api('PUT', '/agenda-semanal', { semana: desde, celdas }); toast('Agenda guardada · ya impacta en el Staff y en la app de los clientes'); cargar(); } catch (e) { fail(e); }
    };
    $('#copiar', main).onclick = async () => {
      if (ag.origen === 'propia' && !(await confirmar('Esta semana ya tiene una agenda guardada. Se reemplaza por la de la semana anterior.', 'Copiar', true))) return;
      try { const r = await api('POST', '/agenda-semanal/copiar', { semana: desde }); toast(r.clases + ' clases copiadas de la semana anterior'); cargar(); } catch (e) { fail(e); }
    };
  }
  await cargar();
});

// ---------- Equipamiento y capacidad ----------
vista('/planificacion/equipos', ['admin', 'profesor'], async (main) => {
  const [eq, cfg, sug] = await Promise.all([api('GET', '/equipamiento'), api('GET', '/config-clase'), api('GET', '/sugerencias')]);
  main.innerHTML = `<div class="page-title"><h1>Equipamiento</h1><div class="actions"><button id="nuevo">＋ Nuevo equipamiento</button><button class="primary" id="ok">Guardar cantidades</button></div></div>${tabsPlan('/planificacion/equipos')}
    <p class="muted">La IA arma cada circuito para que el equipamiento nunca supere el stock: con ${cfg.capacidad} personas en ${cfg.estaciones} estaciones rotativas hay <b>${cfg.porEstacion} personas por estación</b>. Actualizá las cantidades reales (por ejemplo de 5 a 10 barras) o dá de alta equipamiento nuevo.</p>
    ${sug.length ? `<div class="card" style="border-color:var(--brand);margin-bottom:14px"><div class="row between"><h3 style="margin:0">💡 La IA sugiere ${sug.length} ejercicios nuevos</h3><button class="primary sm" id="s-todas">Agregar todos a la biblioteca</button></div>
      <p class="small muted">Se armaron a partir del equipamiento nuevo. Revisalos: los que aceptes entran a la biblioteca con su progresión y se usan en las próximas planificaciones.</p>
      ${sug.map(x => `<div class="list-item"><div class="grow"><b>${esc(x.nombre)}</b> <span class="pill">${esc(x.zona)}</span><div class="small muted">${esc(x.prog2)} → ${esc(x.prog3)}</div><div class="small">Equipo: ${esc(x.equipo_nombre || x.equipo_clave)}</div></div><button class="sm" data-ver="${x.id}">Ver</button><button class="primary sm" data-ac="${x.id}">Agregar</button><button class="ghost sm" data-de="${x.id}">Descartar</button></div>`).join('')}</div>` : ''}
    <div class="grid c2"><div class="card"><h3>Stock</h3>${eq.filter(e => e.clave !== 'ninguno').map(e => `<div class="row" style="margin-bottom:8px;flex-wrap:nowrap"><span class="grow">${esc(e.nombre)}</span><input type="number" min="0" data-c="${e.clave}" value="${e.cantidad}" style="width:96px"></div>`).join('')}</div>
    <div class="card"><h3>Clase</h3>${campo('Capacidad de diseño (personas)', `<input type="number" id="cap" min="5" max="60" value="${cfg.capacidad}">`)}${campo('Estaciones rotativas', `<input type="number" id="est" min="3" max="10" value="${cfg.estaciones}">`)}
    <div class="small muted">El ingreso de personas nunca se limita: si una clase supera la capacidad, se muestra en el dashboard como ineficiencia de materiales.</div></div></div>`;
  $('#ok', main).onclick = async () => {
    try { await api('PUT', '/equipamiento', { equipamiento: $$('[data-c]', main).map(i => ({ clave: i.dataset.c, cantidad: i.value })), capacidad_clase: $('#cap', main).value, estaciones: $('#est', main).value }); toast('Guardado. Rehacé la semana para aplicarlo.'); render(); } catch (e) { fail(e); }
  };
  $('#nuevo', main).onclick = () => {
    const m = modal('Nuevo equipamiento', `<form id="f" class="stack"><div class="fgrid">${campo('Nombre', '<input name="nombre" required placeholder="Ej.: Cintas TRX" autocomplete="off">')}${campo('Cantidad', '<input name="cantidad" type="number" min="0" value="1" required>')}</div>
      <div class="infobox">Al guardarlo, la IA te propone ejercicios nuevos que usen este equipamiento para sumarlos a la biblioteca y a las próximas planificaciones.</div>
      <div class="row" style="justify-content:flex-end"><button type="button" data-close>Cancelar</button><button class="primary">Agregar</button></div></form>`);
    $('#f', m).onsubmit = async (e) => { e.preventDefault(); try { const r = await api('POST', '/equipamiento', Object.fromEntries(new FormData(e.target))); m.close(); toast('Equipamiento agregado · ' + r.sugerencias + ' ejercicios sugeridos'); render(); } catch (er) { fail(er); } };
  };
  const por = (id) => sug.find(x => x.id === Number(id));
  $$('[data-ac]', main).forEach(b => b.onclick = async () => { try { await api('POST', '/sugerencias/' + b.dataset.ac + '/aceptar', {}); toast('Agregado a la biblioteca'); render(); } catch (e) { fail(e); } });
  $$('[data-de]', main).forEach(b => b.onclick = async () => { try { await api('DELETE', '/sugerencias/' + b.dataset.de); render(); } catch (e) { fail(e); } });
  $$('[data-ver]', main).forEach(b => b.onclick = () => { const x = por(b.dataset.ver); verPosiciones({ ...x, equipo: x.equipo_clave }, eq); });
  const t = $('#s-todas', main); if (t) t.onclick = async () => { try { const r = await api('POST', '/sugerencias/aceptar-todas', {}); toast(r.aceptadas + ' ejercicios agregados'); render(); } catch (e) { fail(e); } };
});

// ---------- Agenda Staff: qué profesor tiene cada clase de la semana (después de actualizar la agenda semanal) ----------
vista('/planificacion/staff', ['admin', 'profesor'], async (main) => {
  const adm = puede('plan.staff_editar');
  async function cargar() {
    const desde = semanaSel();
    const [ag, mis, as, barra] = await Promise.all([api('GET', '/staff/agenda?desde=' + desde), adm ? Promise.resolve(null) : api('GET', '/staff/mis-turnos'), api('GET', '/agenda-semanal?semana=' + desde), barraSemana(desde)]);
    const horas = [...new Set(ag.dias.flatMap(d => d.clases.map(c => c.hora)))].sort((a, b) => a - b);
    const opts = (sel) => '<option value="">Sin asignar</option>' + ag.profesores.map(p => `<option value="${p.id}" ${sel === p.id ? 'selected' : ''}>${esc(p.nombre)}</option>`).join('');
    const yo = S.user.id;
    main.innerHTML = `<div class="page-title"><h1>Agenda Staff</h1><div class="actions">${adm ? '<button id="copiar">Copiar staff semana anterior</button>' : ''}</div></div>${tabsPlan('/planificacion/staff')}
      ${mis ? `<div class="card" style="margin-bottom:14px"><h3>Mis turnos</h3>${mis.turnos.length ? mis.turnos.slice(0, 10).map(t => `<div class="list-item" ${t.circuito_id ? `style="cursor:pointer" onclick="ir('#/planificacion/circuito/${t.circuito_id}')"` : ''}><b>${fmtFlargo(t.fecha)}</b><span>${hh(t.hora)}</span>${chipFormato({ nombre: t.formato, color: t.color })}</div>`).join('') : '<div class="muted">Todavía no tenés turnos asignados en las próximas dos semanas.</div>'}</div>` : ''}
      ${barra}
      ${as.origen !== 'propia' ? `<div class="warnbox" style="margin-bottom:10px">Primero actualizá la <a href="#/planificacion">Agenda semanal</a> de esta semana (hoy usa la agenda ${ORIGEN_TXT[as.origen]}). Después elegí el profesor de cada clase.</div>` : ''}
      <p class="small muted">${adm ? 'Elegí qué profesor da cada clase de esta semana, o copiá el staff de la semana anterior. Cada cambio se refleja en la app de los clientes.' : 'Tus clases aparecen resaltadas.'}</p>
      <div class="tablewrap"><table class="staff"><thead><tr><th>Horario</th>${ag.dias.map(d => `<th class="nosort">${DIAS_CORTO[d.dia]} ${d.fecha.slice(8)}${d.fecha === hoyAR() ? ' •' : ''}</th>`).join('')}</tr></thead><tbody>
      ${horas.map(h => `<tr style="cursor:default"><td><b>${hh(h)}</b></td>${ag.dias.map(d => { const c = d.clases.find(x => x.hora === h); if (!c) return '<td class="muted">—</td>'; const mio = c.profesor && c.profesor.id === yo;
        return `<td class="${mio ? 'mio' : ''}"><div>${chipFormato(c.formato)}</div>${adm ? `<select data-f="${d.fecha}" data-h="${h}" style="margin-top:4px">${opts(c.profesor ? c.profesor.id : null)}</select>` : `<div class="small" style="margin-top:4px">${c.profesor ? esc(c.profesor.nombre) : '<span class="muted">Sin asignar</span>'}</div>`}</td>`; }).join('')}</tr>`).join('') || `<tr><td colspan="8" class="empty">No hay clases en la agenda de esta semana.</td></tr>`}</tbody></table></div>`;
    ligarBarra(main, desde, () => cargar().catch(fail));
    $$('select[data-f]', main).forEach(sel => sel.onchange = async () => {
      try { await api('PUT', '/staff/sesion', { fecha: sel.dataset.f, hora: Number(sel.dataset.h), profesor_id: sel.value ? Number(sel.value) : null }); toast('Guardado'); cargar(); } catch (e) { fail(e); }
    });
    const bc = $('#copiar', main); if (bc) bc.onclick = async () => {
      try { const r = await api('POST', '/staff/copiar', { semana: desde }); toast(r.asignados + ' clases con el profesor de la semana anterior'); cargar(); } catch (e) { fail(e); }
    };
  }
  await cargar();
});

// ---------- Biblioteca de ejercicios agrupada por estímulo (patrones, capacidades físicas, sistema energético) ----------
vista('/planificacion/biblioteca', ['admin', 'profesor'], async (main) => {
  const adm = puede('plan.biblioteca_editar');
  const [lista, eq, est] = await Promise.all([api('GET', '/ejercicios'), api('GET', '/equipamiento'), estimulos()]);
  let grupo = sessionStorage.getItem('omega_bgrupo') || 'patrones', clave = sessionStorage.getItem('omega_bclave') || '', buscar = '';
  const cl = (e, k) => String(e[k] || '').split(',').filter(Boolean);
  const subitems = (g) => est[g].map(o => ({ ...o, n: lista.filter(e => (g === 'patrones' ? e.zona === o.nombre : cl(e, g === 'capacidades' ? 'capacidad' : 'energia').includes(o.clave))).length }));
  const nombreDe = (g, k) => (est[g].find(o => o.clave === k) || {}).nombre || k;
  function pintar() {
    if (!est[grupo].some(o => o.clave === clave)) clave = est[grupo][0].clave;
    sessionStorage.setItem('omega_bgrupo', grupo); sessionStorage.setItem('omega_bclave', clave);
    const sel = est[grupo].find(o => o.clave === clave);
    const z = lista.filter(e => (grupo === 'patrones' ? e.zona === sel.nombre : cl(e, grupo === 'capacidades' ? 'capacidad' : 'energia').includes(clave)) && (!buscar || norm(e.nombre + ' ' + e.prog2 + ' ' + e.prog3).includes(norm(buscar))));
    main.innerHTML = `<div class="page-title"><h1>Biblioteca de ejercicios</h1><div class="actions">${adm ? '<button class="primary" id="nuevo">＋ Nuevo ejercicio</button>' : ''}</div></div>${tabsPlan('/planificacion/biblioteca')}
      <p class="muted">Todos los ejercicios están agrupados por estímulo. Cada ejercicio pertenece a un patrón de movimiento y puede sumar varias capacidades físicas y sistemas energéticos. Tiene dos progresiones, tres imágenes (inicial, media y final) y puede llevar un video.</p>
      <div class="tabs">${GRUPOS_EST.map(([g, t]) => `<button data-g="${g}" class="${g === grupo ? 'on' : ''}">${t.replace('Estímulos de ', '').replace('Estímulos del ', '')}</button>`).join('')}</div>
      <div class="tabs">${subitems(grupo).map(o => `<button data-z="${o.clave}" class="${o.clave === clave ? 'on' : ''}">${esc(o.nombre)} <span class="pill">${o.n}</span></button>`).join('')}</div>
      ${sel.ejemplo ? `<div class="infobox" style="margin-bottom:10px"><b>${esc(sel.nombre)}:</b> ${esc(sel.ejemplo)}</div>` : ''}
      <div class="row" style="margin-bottom:10px"><input id="q" type="search" placeholder="Buscar en ${esc(sel.nombre)}…" value="${esc(buscar)}" style="max-width:320px"><span class="small muted">${z.length} ejercicios</span></div>
      <div class="tablewrap hbar" tabindex="0"><table style="min-width:980px"><thead><tr><th>Base</th><th>Progresión 1</th><th>Progresión 2</th><th>Patrón</th><th>Capacidades · energía</th><th>Equipo</th><th>Intensidad</th><th>Posiciones</th><th>Video</th><th></th></tr></thead><tbody>
      ${z.map(e => `<tr style="cursor:default"><td><b>${esc(e.nombre)}</b>${e.origen === 'propio' ? ' <span class="pill">propio</span>' : e.origen === 'sugerido' ? ' <span class="pill">IA</span>' : ''}</td><td>${esc(e.prog2)}</td><td>${esc(e.prog3)}</td><td class="small">${esc(e.zona)}</td>
        <td class="small">${cl(e, 'capacidad').map(k => esc(nombreDe('capacidades', k))).join(', ') || '—'}<br><span class="muted">${cl(e, 'energia').map(k => esc(nombreDe('energias', k))).join(', ') || '—'}</span></td>
        <td>${esc(eqNombre(eq, e.equipo))}</td><td>${e.intensidad ? `<span class="pill ${e.intensidad === 'alta' ? 'rojo' : e.intensidad === 'moderada' ? 'amarillo' : ''}">${{ baja: 'Baja', moderada: 'Moderada', alta: 'Alta' }[e.intensidad]}</span>` : '—'}</td>
        <td><button class="sm" data-pos="${e.id}">▣ Ver 3 posiciones</button></td>
        <td>${e.video ? `<button class="sm" data-ver="${e.id}">▶ Ver</button>` : '<span class="vid-no">Sin video</span>'}</td>
        <td class="right" style="white-space:nowrap">${adm ? `<label class="btn sm" style="margin:0">${e.video ? 'Cambiar video' : 'Subir video'}<input type="file" accept="video/*" class="hidden" data-vid="${e.id}"></label>` : ''}
        ${adm ? `<button class="sm" data-ed="${e.id}">✏️ Editar</button> <button class="danger sm" data-el="${e.id}">✕</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="10" class="empty">No hay ejercicios con ese filtro.</td></tr>'}</tbody></table></div>`;
    $$('[data-g]', main).forEach(b => b.onclick = () => { grupo = b.dataset.g; clave = ''; buscar = ''; pintar(); });
    $$('[data-z]', main).forEach(b => b.onclick = () => { clave = b.dataset.z; buscar = ''; pintar(); });
    const q = $('#q', main); q.oninput = debounce(() => { buscar = q.value; pintar(); const n = $('#q', main); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 250);
    const bnuevo = $('#nuevo', main); if (bnuevo) bnuevo.onclick = () => formEjercicio(null, eq, grupo === 'patrones' ? sel.nombre : ZONAS_UI[0], recargar);
    $$('[data-ed]', main).forEach(b => b.onclick = () => formEjercicio(lista.find(e => e.id === Number(b.dataset.ed)), eq, null, recargar));
    $$('[data-pos]', main).forEach(b => b.onclick = () => verPosiciones(lista.find(e => e.id === Number(b.dataset.pos)), eq));
    $$('[data-ver]', main).forEach(b => b.onclick = () => verVideo(lista.find(e => e.id === Number(b.dataset.ver)), recargar));
    $$('[data-vid]', main).forEach(i => i.onchange = () => subirConProgreso(Number(i.dataset.vid), i.files[0], recargar));
    $$('[data-el]', main).forEach(b => b.onclick = async () => {
      const e = lista.find(x => x.id === Number(b.dataset.el));
      if (!(await confirmar('¿Quitar “' + e.nombre + '” de la biblioteca? Los circuitos ya armados lo conservan.', 'Quitar', true))) return;
      try { await api('DELETE', '/ejercicios/' + e.id); toast('Ejercicio quitado'); recargar(); } catch (er) { fail(er); }
    });
  }
  async function recargar() { const n = await api('GET', '/ejercicios'); lista.splice(0, lista.length, ...n); pintar(); }
  pintar();
});

async function subirConProgreso(id, file, despues) {
  if (!file) return;
  if (file.size > 400 * 1024 * 1024) return toast('El video supera los 400 MB', 'warn');
  const m = modal('Subiendo video', `<p>${esc(file.name)} (${(file.size / 1048576).toFixed(1)} MB)</p><div class="meter"><i id="bar" style="width:0%"></i></div><p class="small muted" id="pct">0%</p>`);
  try {
    await subirVideo(id, file, p => { $('#bar', m).style.width = p + '%'; $('#pct', m).textContent = p + '%'; });
    m.close(); toast('Video guardado'); if (despues) despues();
  } catch (e) { m.close(); fail(e); }
}
function verVideo(e, despues) {
  const m = modal(e.nombre, `<video src="${esc(urlVideo(e.video))}" controls playsinline autoplay style="width:100%;border-radius:12px;background:#000;max-height:60vh"></video>
    <div class="row" style="margin-top:10px;justify-content:space-between"><button class="danger sm" id="qv">Quitar video</button><button data-close>Cerrar</button></div>`);
  $('#qv', m).onclick = async () => { if (!(await confirmar('¿Quitar el video de este ejercicio?', 'Quitar', true))) return; try { await api('DELETE', '/ejercicios/' + e.id + '/video'); m.close(); toast('Video quitado'); if (despues) despues(); } catch (er) { fail(er); } };
}
async function formEjercicio(e0, eq, zona, despues) {
  let e = e0; await estimulos();
  if (e0 && (e0.foto1 || e0.foto2 || e0.foto3)) { try { e = await api('GET', '/ejercicios/' + e0.id); } catch (_) {} }
  const fotos = [e ? e.img1 || null : null, e ? e.img2 || null : null, e ? e.img3 || null : null];
  const tocadas = [false, false, false];
  const m = modal(e ? 'Editar ejercicio' : 'Nuevo ejercicio', `<form id="f" class="stack">
    <div class="fgrid">${campo('Patrón de movimiento', `<select name="zona">${ZONAS_UI.map(z => `<option ${z === (e ? e.zona : zona) ? 'selected' : ''}>${z}</option>`).join('')}</select>`)}
    ${campo('Equipamiento que usa', `<select name="equipo">${eq.map(x => `<option value="${x.clave}" ${x.clave === (e ? e.equipo : 'ninguno') ? 'selected' : ''}>${esc(x.nombre)}</option>`).join('')}</select>`)}</div>
    ${campo('Ejercicio (round 1)', `<input name="nombre" required value="${esc(e ? e.nombre : '')}">`)}
    <div class="fgrid">${campo('Progresión del round 2', `<input name="prog2" required value="${esc(e ? e.prog2 : '')}" placeholder="Misma idea, más difícil">`)}
    ${campo('Progresión del round 3', `<input name="prog3" required value="${esc(e ? e.prog3 : '')}" placeholder="Todavía más difícil">`)}</div>
    <div class="fgrid">${campo('Tipo de movimiento (se filtra según zona y equipo)', `<select name="patron"></select>`)}
    ${campo('Intensidad cardiovascular', `<select name="intensidad">${['baja', 'moderada', 'alta'].map(x => `<option value="${x}" ${x === ((e && e.intensidad) || 'baja') ? 'selected' : ''}>${{ baja: 'Baja', moderada: 'Moderada', alta: 'Alta (sube las pulsaciones)' }[x]}</option>`).join('')}</select>`)}</div>
    <div class="grid c2"><div><div class="small"><b>Capacidades físicas integradas</b></div>${_EST.capacidades.map(o => `<label class="row small" style="gap:6px;margin:0 0 3px" title="${esc(o.ejemplo || '')}"><input type="checkbox" name="cap" value="${o.clave}" ${String(e ? e.capacidad : 'fuerza').split(',').includes(o.clave) ? 'checked' : ''}> ${esc(o.nombre)}</label>`).join('')}</div><div><div class="small"><b>Sistema energético</b></div>${_EST.energias.map(o => `<label class="row small" style="gap:6px;margin:0 0 3px" title="${esc(o.ejemplo || '')}"><input type="checkbox" name="ene" value="${o.clave}" ${String(e ? e.energia : 'aerobico').split(',').includes(o.clave) ? 'checked' : ''}> ${esc(o.nombre)}</label>`).join('')}</div></div>
    <div><label class="small muted">${e ? 'Imágenes: se mantienen las actuales. Podés reemplazarlas por tus propias fotos.' : 'Subí tres fotos ya editadas desde el celular: posición inicial, media y final.'}</label><div id="pos"></div></div>
    <div class="row" style="justify-content:flex-end"><button type="button" data-close>Cancelar</button><button class="primary">${e ? 'Guardar' : 'Agregar ejercicio'}</button></div></form>`, { wide: true });
  const f = $('#f', m);
  // Filtros encadenados: los tipos de movimiento válidos salen de lo que ya existe en la biblioteca para esa zona y ese equipo
  let todos = []; try { todos = await api('GET', '/ejercicios'); } catch (_) {}
  function patronesValidos() {
    const z = f.zona.value, q = f.equipo.value;
    const deZona = new Set(todos.filter(x => x.zona === z && x.patron).map(x => x.patron));
    const deZonaEq = new Set(todos.filter(x => x.zona === z && x.equipo === q && x.patron).map(x => x.patron));
    let set = deZonaEq.size ? deZonaEq : deZona;
    if (e && e.patron) set = new Set([...set, e.patron]);
    return set.size ? Ilustra.PATRONES.filter(p => set.has(p)) : Ilustra.PATRONES;
  }
  function llenarPatrones(preferido) {
    const v = patronesValidos(); const actual = preferido || f.patron.value;
    f.patron.innerHTML = v.map(p => `<option value="${p}">${esc(PATRON_NOMBRE[p] || p)}</option>`).join('');
    f.patron.value = v.includes(actual) ? actual : (v.includes(ZONA_PATRON[f.zona.value]) ? ZONA_PATRON[f.zona.value] : v[0]);
  }
  function pintarPos() {
    const nm = eq.find(x => x.clave === f.equipo.value);
    if (!e) {
      $('#pos', m).innerHTML = `<div class="posiciones">${[0, 1, 2].map(i => `<figure class="pos"><div class="pos-img">${fotos[i] ? `<img src="${esc(fotos[i])}" alt="">` : '<div class="muted small" style="padding:24px 6px;text-align:center">Sin foto</div>'}</div>
        <figcaption><span class="nro">${i + 1}</span> ${['Posición inicial', 'Posición media', 'Posición final'][i]}</figcaption><div class="row" style="justify-content:center"><label class="btn sm ${fotos[i] ? '' : 'primary'}" style="margin:0">${fotos[i] ? 'Cambiar' : 'Subir foto'}<input type="file" accept="image/*" class="hidden" data-f="${i}"></label></div></figure>`).join('')}</div>`;
    } else {
      $('#pos', m).innerHTML = `<div class="posiciones">${[0, 1, 2].map(i => `<figure class="pos"><div class="pos-img">${fotos[i] ? `<img src="${esc(fotos[i])}" alt="">` : Ilustra.svg(f.patron.value, i, f.equipo.value, nm ? nm.nombre : '')}</div>
        <figcaption><span class="nro">${i + 1}</span> ${Ilustra.NOMBRES[i]}</figcaption><div class="row" style="justify-content:center;gap:6px"><label class="btn sm" style="margin:0">${fotos[i] ? 'Cambiar foto' : 'Subir foto'}<input type="file" accept="image/*" class="hidden" data-f="${i}"></label>${fotos[i] ? `<button type="button" class="ghost sm" data-q="${i}">Usar dibujo</button>` : ''}</div></figure>`).join('')}</div>`;
    }
    $$('[data-f]', m).forEach(inp => inp.onchange = async () => { const fl = inp.files[0]; if (!fl) return; try { fotos[Number(inp.dataset.f)] = await fotoEjercicio(fl); tocadas[Number(inp.dataset.f)] = true; pintarPos(); } catch (er) { fail(er); } });
    $$('[data-q]', m).forEach(b => b.onclick = () => { fotos[Number(b.dataset.q)] = null; tocadas[Number(b.dataset.q)] = true; pintarPos(); });
  }
  f.equipo.onchange = () => { llenarPatrones(); pintarPos(); };
  f.patron.onchange = pintarPos;
  f.zona.onchange = () => { llenarPatrones(ZONA_PATRON[f.zona.value]); pintarPos(); };
  llenarPatrones(e && e.patron ? e.patron : ZONA_PATRON[f.zona.value]);
  pintarPos();
  f.onsubmit = async (ev) => {
    ev.preventDefault(); const fd = Object.fromEntries(new FormData(f));
    const body = { nombre: fd.nombre, prog2: fd.prog2, prog3: fd.prog3, equipo: fd.equipo, patron: fd.patron, intensidad: fd.intensidad };
    body.zona = f.zona.value; body.capacidades = $$('input[name=cap]:checked', f).map(x => x.value); body.energias = $$('input[name=ene]:checked', f).map(x => x.value);
    if (!body.capacidades.length || !body.energias.length) return toast('Elegí al menos una capacidad física y un sistema energético', 'warn');
    ['img1', 'img2', 'img3'].forEach((k, i) => { if (!e || tocadas[i]) body[k] = fotos[i] || null; });
    try { if (e) await api('PUT', '/ejercicios/' + e.id, body); else await api('POST', '/ejercicios', body); m.close(); toast('Guardado'); despues(); } catch (er) { fail(er); }
  };
}

// ---------- Circuito de una clase ----------
vista('/planificacion/circuito/:id', ['admin', 'profesor'], async (main, { id }) => {
  const [c, eq] = await Promise.all([api('GET', '/planificacion/circuito/' + id), api('GET', '/equipamiento')]);
  const clases = (await api('GET', '/clase?fecha=' + c.fecha)).clases.filter(x => x.formato && x.formato.id === c.formato_id);
  main.innerHTML = vistaCircuito(c, eq, clases, puede('plan.generar'));
  enlazarCircuito(main, c, eq, true);
});

function vistaCircuito(c, eq, clases, editable) {
  const stock = new Map(eq.map(e => [e.clave, e]));
  const slots = c.rondas[0].ejercicios.map((_, i) => i);
  return `
    <div class="page-title"><a class="btn ghost sm" href="#/planificacion">← Semana</a><h1>${fmtFlargo(c.fecha)}</h1>${chipFormato({ nombre: c.formato, color: c.color })}
      <div class="actions"><button id="b-play" class="primary">Cronómetro de la clase</button><button id="b-list">Lista de videos</button></div></div>
    <div class="row small muted" style="margin-bottom:10px"><span>Horarios: <b>${clases.map(x => hh(x.hora)).join(' · ') || '—'}</b></span><span>·</span><span>${c.sin_trabajo ? 'Clase corrida, sin intervalos' : 'Trabajo ' + seg(c.trabajo_seg) + (c.sin_descanso ? ' · sin descanso' : ' / descanso ' + seg(c.descanso_seg))}</span><span>·</span><span>Duración ≈ ${c.duracion_min} min</span><span>·</span><span>${c.estaciones} estaciones · ${c.personas_por_estacion} personas por estación</span></div>
    ${c.advertencias.map(a => `<div class="warnbox" style="margin-bottom:8px">⚠ ${esc(a)}</div>`).join('')}
    <div class="tablewrap hbar" tabindex="0"><table style="min-width:820px"><thead><tr><th>Estación</th><th>Zona</th>${c.rondas.map(r => `<th>Round ${r.ronda} · ${r.nivel_n === 1 ? 'base' : r.nivel_n === 2 ? 'progresión 1' : 'progresión 2'}</th>`).join('')}<th>Equipo</th><th>Video</th>${editable ? '<th></th>' : ''}</tr></thead><tbody>
    ${slots.map(i => { const e1 = c.rondas[0].ejercicios[i], es = c.rondas.map(r => r.ejercicios[i]); if (e1.vacio) return `<tr style="cursor:default"><td><b>${i + 1}</b></td><td>${esc(e1.zona || '—')}</td><td colspan="${(editable ? 3 : 2) + c.rondas.length}"><span class="t-amarillo">Sin ejercicio</span>${editable ? ` <button class="sm primary" data-rep="${i}">Elegir ejercicio</button>` : ''}</td></tr>`; return `<tr style="cursor:default"><td><b>${i + 1}</b></td><td>${esc(e1.zona)}</td><td><button class="linklike" data-pos="${i}" title="Ver las posiciones del ejercicio"><b>${esc(e1.nombre)}</b> ▣</button></td>${es.slice(1).map(x => `<td>${esc(x.nombre)}</td>`).join('')}<td>${esc(eqNombre(eq, e1.equipo))}</td>
      <td>${e1.video ? `<button class="sm" data-ver="${i}">▶ Ver</button>` : `<label class="btn sm vid-no" style="margin:0">Subir<input type="file" accept="video/*" class="hidden" data-vid="${e1.ejercicio_id}"></label>`}</td>
      ${editable ? `<td class="right"><button class="sm" data-rep="${i}">Reemplazar</button></td>` : ''}</tr>`; }).join('')}</tbody></table></div>
    <div class="grid c2" style="margin-top:14px">
      <div class="card"><h3>Equipamiento necesario</h3>${c.equipos.length ? c.equipos.map(e => { const s = stock.get(e.clave); const ok = !s || e.necesita <= s.cantidad; return `<div class="row between" style="margin-bottom:6px"><span>${esc(s ? s.nombre : e.clave)}</span><span class="pill ${ok ? 'verde' : 'rojo'}">${e.necesita} de ${s ? s.cantidad : '—'} ${ok ? '✓' : '✗'}</span></div>`; }).join('') : '<span class="muted">Solo peso corporal.</span>'}
        <div class="small muted" style="margin-top:6px">Con ${c.personas_por_estacion} personas por estación, el stock alcanza para toda la clase.</div></div>
      <div class="card"><h3>Rotación de grupos</h3><div class="small muted" style="margin-bottom:6px">Cada grupo pasa por todas las estaciones. Cada turno dura trabajo + descanso.</div>
        <div class="tablewrap"><table><thead><tr><th>Turno</th>${c.rotacion[0].map((_, g) => `<th class="nosort">Grupo ${g + 1}</th>`).join('')}</tr></thead><tbody>${c.rotacion.map((r, t) => `<tr style="cursor:default"><td>${t + 1}</td>${r.map(s => `<td>Estación ${s + 1}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div></div>`;
}

function enlazarCircuito(main, c, eq, editable) {
  $$('[data-ver]', main).forEach(b => b.onclick = () => { const e = c.rondas[0].ejercicios[Number(b.dataset.ver)]; verVideo({ id: e.ejercicio_id, nombre: e.nombre, video: e.video }, () => render()); });
  $$('[data-vid]', main).forEach(i => i.onchange = () => subirConProgreso(Number(i.dataset.vid), i.files[0], () => render()));
  $$('[data-rep]', main).forEach(b => b.onclick = () => reemplazar(c, Number(b.dataset.rep), eq));
  $$('[data-pos]', main).forEach(b => b.onclick = () => { const i = Number(b.dataset.pos), e1 = c.rondas[0].ejercicios[i]; verPosiciones({ id: e1.ejercicio_id, nombre: e1.variantes[0], zona: e1.zona, equipo: e1.equipo, patron: e1.patron, fotos: e1.fotos, foto1: e1.fotos, prog2: e1.variantes[1], prog3: e1.variantes[2] }, eq); });
  $('#b-list', main).onclick = () => listaVideos(c);
  $('#b-play', main).onclick = () => cronometro(c);
}

async function reemplazar(c, slot, eq) {
  let zona = c.rondas[0].ejercicios[slot].zona || ZONAS_UI[0];
  const m = modal((c.rondas[0].ejercicios[slot].vacio ? 'Elegir ejercicio ' : 'Reemplazar ejercicio ') + (slot + 1), '<div id="cont"></div>', { wide: true });
  async function pintar() {
    $('#cont', m).innerHTML = '<div class="empty"><span class="spinner"></span></div>';
    try {
      const s = await api('GET', '/planificacion/circuito/' + c.id + '/sugerencias?slot=' + slot + '&zona=' + encodeURIComponent(zona));
      $('#cont', m).innerHTML = `<div class="field"><label>Patrón de movimiento a trabajar</label><select id="zona">${ZONAS_UI.map(z => `<option ${z === zona ? 'selected' : ''}>${z}</option>`).join('')}</select></div>
        <p class="small muted">Alternativas ordenadas: primero las que alcanzan con el equipamiento y hace más tiempo no se usan.</p>
        ${s.length ? s.map(e => `<div class="list-item" data-e="${e.id}" style="cursor:pointer"><div class="grow"><b>${esc(e.nombre)}</b><div class="small muted">${esc(e.prog2)} → ${esc(e.prog3)}</div><div class="small" style="margin-top:3px">${esc(eqNombre(eq, e.equipo))}${e.tiene_video ? ' · <span class="vid-ok">con video</span>' : ''}${e.dias_desde_uso == null ? ' · sin usos recientes' : ' · usado hace ' + e.dias_desde_uso + ' días'}</div></div>${e.alcanza_equipo ? '<span class="pill verde">alcanza</span>' : '<span class="pill rojo">no alcanza el equipo</span>'}</div>`).join('') : '<div class="empty">No hay otros ejercicios en esta zona.</div>'}`;
      $('#zona', m).onchange = (ev) => { zona = ev.target.value; pintar(); };
      $$('[data-e]', m).forEach(el => el.onclick = async () => { try { await api('PUT', '/planificacion/circuito/' + c.id + '/slot', { slot, ejercicio_id: Number(el.dataset.e) }); m.close(); toast('Ejercicio reemplazado'); render(); } catch (er) { fail(er); } });
    } catch (e) { $('#cont', m).innerHTML = ''; fail(e); }
  }
  pintar();
}

// ----- Lista de reproducción en video del circuito (ronda por ronda)
function listaVideos(c) {
  const items = [];
  for (const r of c.rondas) for (const e of r.ejercicios) items.push({ titulo: 'Round ' + r.ronda + ' · Estación ' + (e.slot + 1) + ' · ' + e.nombre, video: e.video, nivel: e.nivel });
  let cur = items.findIndex(i => i.video); if (cur < 0) cur = 0;
  const m = modal('Videos de la clase', `<div id="pl-v"></div><div id="pl-l" style="margin-top:10px"></div>`, { wide: true });
  const n = items.filter(i => i.video).length;
  function pintar() {
    const it = items[cur];
    $('#pl-v', m).innerHTML = `<div class="player"><div class="nombre" style="font-size:1.15rem">${esc(it.titulo)}</div>${it.video ? `<video id="vv" src="${esc(urlVideo(it.video))}" controls playsinline autoplay></video>` : '<div class="sinvideo">Este ejercicio todavía no tiene video</div>'}
      <div class="row" style="justify-content:center"><button id="pv">‹ Anterior</button><button id="nv" class="primary">Siguiente ›</button></div><div class="small muted" style="margin-top:6px">${n} de ${items.length} ejercicios con video. Al terminar un video pasa solo al siguiente.</div></div>`;
    $('#pl-l', m).innerHTML = items.map((x, i) => `<div class="pl-item ${i === cur ? 'on' : ''}" data-i="${i}"><span class="${x.video ? 'vid-ok' : 'vid-no'}">${x.video ? '▶' : '—'}</span><span class="grow">${esc(x.titulo)}</span><span class="small muted">${esc(x.nivel)}</span></div>`).join('');
    $$('[data-i]', m).forEach(el => el.onclick = () => { cur = Number(el.dataset.i); pintar(); });
    $('#pv', m).onclick = () => { cur = (cur - 1 + items.length) % items.length; pintar(); };
    $('#nv', m).onclick = () => { cur = (cur + 1) % items.length; pintar(); };
    const v = $('#vv', m); if (v) v.onended = () => { let k = cur + 1; while (k < items.length && !items[k].video) k++; if (k < items.length) { cur = k; pintar(); } };
  }
  pintar();
}

// ----- Cronómetro de la clase: trabajo / descanso, round por round, con la rotación de grupos
function cronometroLibre(c) {
  // Formato sin intervalos (ej. Flex): una sola cuenta regresiva con la duración de la clase
  const total = (c.duracion_min || 60) * 60; let resta = total, corriendo = false, ultimo = 0;
  const m = modal('Cronómetro · ' + c.formato, '<div class="player" id="pl"></div>', { wide: true, onClose: () => clearInterval(iv) });
  function pintar() {
    const h = Math.floor(resta / 3600), m1 = Math.floor((resta % 3600) / 60), s1 = resta % 60;
    $('#pl', m).innerHTML = `<div class="small muted">Clase corrida de ${c.duracion_min || 60} min</div><div class="fase trabajo">Clase</div>
      <div class="crono">${h ? h + ':' + String(m1).padStart(2, '0') : m1}:${String(s1).padStart(2, '0')}</div>
      <div class="row" style="justify-content:center;margin:10px 0"><button class="primary big" id="pp">${corriendo ? 'Pausar' : (resta === total ? 'Empezar' : 'Seguir')}</button><button id="rs" class="ghost">Reiniciar</button></div>`;
    $('#pp', m).onclick = () => { corriendo = !corriendo; ultimo = Date.now(); pintar(); };
    $('#rs', m).onclick = () => { resta = total; corriendo = false; pintar(); };
  }
  const iv = setInterval(() => {
    if (!corriendo) return;
    const d = Math.floor((Date.now() - ultimo) / 1000);
    if (d >= 1) { ultimo += d * 1000; resta = Math.max(0, resta - d); if (resta === 0) corriendo = false; pintar(); }
  }, 250);
  addTimer(iv); pintar();
}
function cronometro(c) {
  if (c.sin_trabajo) return cronometroLibre(c);
  const E = c.estaciones; const T = c.trabajo_seg, D = c.sin_descanso ? 0 : c.descanso_seg;
  const etapas = []; for (let r = 0; r < c.rondas.length; r++) for (let t = 0; t < E; t++) etapas.push({ r, t });
  let i = 0, fase = 'trabajo', resta = T, corriendo = false, ultimo = 0, fin = false;
  const m = modal('Cronómetro · ' + c.formato, '<div class="player" id="pl"></div>', { wide: true, onClose: () => { clearInterval(iv); try { if (wl) wl.release(); } catch (_) {} } });
  let ctxAudio = null, silencio = false;
  // Audio: pitido largo al empezar el intervalo de trabajo y 3 pitidos cortos en los últimos 3 segundos de cada intervalo
  function beep(f = 880, d = 0.18, vol = 0.35) {
    if (silencio) return;
    try {
      ctxAudio = ctxAudio || new (window.AudioContext || window.webkitAudioContext)();
      if (ctxAudio.state === 'suspended') ctxAudio.resume();
      const o = ctxAudio.createOscillator(), g = ctxAudio.createGain(), t0 = ctxAudio.currentTime;
      o.type = 'square'; o.frequency.value = f; g.gain.setValueAtTime(vol, t0); g.gain.setTargetAtTime(0.0001, t0 + d * 0.85, 0.02);
      o.connect(g); g.connect(ctxAudio.destination); o.start(t0); o.stop(t0 + d + 0.1);
    } catch (_) {}
  }
  const pitidoLargo = () => beep(880, 1.0), pitidoCorto = () => beep(1320, 0.14);
  let wl = null; try { if (navigator.wakeLock) navigator.wakeLock.request('screen').then(w => { wl = w; }, () => {}); } catch (_) {}
  function pintar() {
    if (fin) { $('#pl', m).innerHTML = '<div class="nombre">¡Clase terminada! 💪</div><p class="muted">Completaron ' + (c.rondas.length === 1 ? 'el round' : 'los ' + c.rondas.length + ' rounds') + '.</p><button class="primary" id="rs">Empezar de nuevo</button>'; $('#rs', m).onclick = () => { i = 0; fase = 'trabajo'; resta = T; fin = false; corriendo = false; pintar(); }; return; }
    const et = etapas[i]; const m1 = Math.floor(resta / 60), s1 = resta % 60;
    const rot = c.rotacion[et.t];
    $('#pl', m).innerHTML = `<div class="small muted">Round ${et.r + 1} de ${c.rondas.length} · turno ${et.t + 1} de ${E}</div>
      <div class="fase ${fase}">${fase === 'trabajo' ? 'Trabajo' : 'Descanso'}</div><div class="crono">${m1}:${String(s1).padStart(2, '0')}</div>
      <div class="row" style="justify-content:center;margin:10px 0"><button class="primary big" id="pp">${corriendo ? 'Pausar' : (i === 0 && fase === 'trabajo' && resta === T ? 'Empezar' : 'Seguir')}</button><button id="sk">Saltar ›</button><button id="mu" class="ghost">${silencio ? '🔇 Sin sonido' : '🔊 Con sonido'}</button></div>
      <div class="tablewrap" style="text-align:left"><table><thead><tr><th>Grupo</th><th>Estación</th><th>Ejercicio</th></tr></thead><tbody>${rot.map((s, g) => `<tr style="cursor:default"><td>${g + 1}</td><td>${s + 1}</td><td><b>${esc(c.rondas[et.r].ejercicios[s].nombre)}</b></td></tr>`).join('')}</tbody></table></div>`;
    $('#pp', m).onclick = () => { const arranca = !corriendo && i === 0 && fase === 'trabajo' && resta === T; corriendo = !corriendo; ultimo = Date.now(); if (corriendo && arranca) pitidoLargo(); else if (corriendo) pitidoCorto(); pintar(); };
    $('#mu', m).onclick = () => { silencio = !silencio; pintar(); };
    $('#sk', m).onclick = () => { siguiente(); pintar(); };
  }
  function siguiente() {
    if (fase === 'trabajo') { fase = 'descanso'; resta = D; if (D <= 0) { siguiente(); } }
    else { i++; if (i >= etapas.length) { fin = true; corriendo = false; beep(990, 0.9); return; } fase = 'trabajo'; resta = T; pitidoLargo(); }
  }
  const iv = setInterval(() => {
    if (!corriendo || fin) return;
    const ahora = Date.now(); const d = Math.floor((ahora - ultimo) / 1000);
    if (d >= 1) { ultimo += d * 1000; resta -= d; if (resta <= 3 && resta > 0) pitidoCorto(); if (resta <= 0) siguiente(); pintar(); }
  }, 200);
  addTimer(iv);
  pintar();
}

