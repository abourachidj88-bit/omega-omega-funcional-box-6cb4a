'use strict';
// ---------- Hark Pro (solo administrador), pestaña de Ajustes. Versión 11: el aprendizaje de la planificación viene activado; la lectura de WhatsApp se activa a mano. Hark Pro NO envía mensajes a nadie. ----------

async function bloqueHark(main) {
  const d = await api('GET', '/hark');
  const p = d.plan, w = d.wa, sg = d.seg;
  const escritorio = !!(window.omegaEscritorio && window.omegaEscritorio.abrirWhatsApp);
  const ESTADO = { apagado: ['Apagado', 'pill'], aprendiendo: ['Aprendiendo', 'pill primary'], aplicando: ['Planificando como el profesor', 'pill primary'], sin_datos: ['Período terminado: faltan datos', 'pill'] };
  main.innerHTML = '';
  const [et, ec] = ESTADO[p.estado] || ESTADO.apagado;
  const pct = (v) => (v == null ? '—' : v + ' %');
  const e = w.estilo || { mensajes: 0 };
  main.innerHTML = `    <div class="infobox" style="margin-bottom:14px">Hark Pro trabaja de fondo, <b>aprendiendo</b> cómo planifican y cómo hablan los profesores para, más adelante, hacerlo solo. En esta versión <b>no envía mensajes a ningún cliente</b>. Todo lo que aprende queda en la PC del gimnasio y no se sincroniza con la nube.</div>
    <div class="grid c2">
      <div class="card"><div class="row between"><h3 style="margin:0">1 · Aprender a planificar <span class="small muted">(activado por defecto)</span></h3><span class="${ec}">${et}</span></div>
        <p class="muted">Durante el período que elijas, Hark Pro observa qué ejercicios <b>cambian a mano</b> los profesores en los circuitos (cuáles eligen y cuáles sacan). Cuando el período termina, la IA arma los circuitos favoreciendo esas elecciones, siempre respetando el equipamiento, las estaciones y las frecuencias. Los profesores pueden seguir corrigiendo.</p>
        ${p.activo ? `<div class="small" style="margin:6px 0">Período: <b>${fmtF(p.desde)}</b> al <b>${fmtF(p.hasta)}</b> · cambios observados: <b>${p.observaciones}</b> (mínimo ${p.minimo} para empezar a aplicarlos)</div>` : ''}
        ${p.estado === 'sin_datos' ? `<div class="warnbox small" style="margin:6px 0">El período terminó pero hay pocos cambios observados. Hark Pro sigue anotando; podés extender el período.</div>` : ''}
        <div class="row" style="gap:8px;flex-wrap:wrap;margin:10px 0"><button class="primary" id="hp-act">${p.activo ? 'Cambiar el período' : 'Activar Hark Pro'}</button>${p.activo ? '<button id="hp-off">Apagar Hark Pro</button>' : ''}${p.observaciones ? '<button class="ghost" id="hp-borrar">Borrar lo aprendido</button>' : ''}</div>
        ${p.profesores.length ? `<div class="small muted">Cambios por profesor</div>${p.profesores.map(x => `<div class="row between small"><span>${esc(x.nombre)}</span><b>${x.cambios}</b></div>`).join('')}` : ''}
        ${p.preferidos.length ? `<div class="small muted" style="margin-top:8px">Ejercicios que más eligen</div>${p.preferidos.map(x => `<div class="row between small"><span>${esc(x.nombre)} <span class="muted">· ${esc(x.patron)}</span></span><b>${x.veces}</b></div>`).join('')}` : ''}
        ${p.evitados.length ? `<div class="small muted" style="margin-top:8px">Ejercicios que más sacan</div>${p.evitados.map(x => `<div class="row between small"><span>${esc(x.nombre)} <span class="muted">· ${esc(x.patron)}</span></span><b>${x.veces}</b></div>`).join('')}` : ''}
      </div>
      <div class="card"><div class="row between"><h3 style="margin:0">2 · Leer WhatsApp</h3><span class="${w.activo ? 'pill primary' : 'pill'}">${w.activo ? 'Leyendo' : 'Apagado'}</span></div>
        <p class="muted">Lee (solo lectura) las conversaciones de <b>WhatsApp Web</b> de esta PC, reconoce al alumno por el <b>Alias WhatsApp</b> que cargues en su ficha (o por su número), resume lo que habla del entrenamiento y lo guarda en <b>Clientes → Seguimiento → Comentarios</b> con la fecha. También aprende cómo escribe el gimnasio (tono, expresiones, emojis).</p>
        ${w.activo ? `<div class="small" style="margin:6px 0">Mensajes guardados: <b>${w.mensajes}</b> · pendientes de resumir: <b>${w.pendientes}</b>${w.sin_cliente ? ` (<b>${w.sin_cliente}</b> de números que no son de ningún alumno)` : ''} · resúmenes hechos: <b>${w.resumidos}</b></div>
          <div class="row" style="gap:8px;flex-wrap:wrap;margin:10px 0">${escritorio ? '<button class="primary" id="wa-abrir">Abrir WhatsApp Web</button>' : '<span class="small muted">Para leer WhatsApp hace falta la versión de escritorio de OMEGA (ícono OMEGA del escritorio) ya actualizada a la Versión 10 con el Actualizador o el Instalador Base.</span>'}<button id="wa-res">Resumir ahora</button><button id="wa-off">Apagar</button><button class="ghost" id="wa-borrar">Borrar lo capturado</button></div>`
        : `<label class="row small" style="gap:8px;align-items:flex-start;margin:8px 0"><input type="checkbox" id="wa-ok" style="margin-top:3px"> <span>Confirmo que los alumnos están informados de que sus conversaciones con el gimnasio pueden ser leídas y resumidas para su seguimiento, y que el uso de esa información es responsabilidad del gimnasio.</span></label>
          <div class="row" style="margin:10px 0"><button class="primary" id="wa-on">Activar lectura de WhatsApp</button></div>`}
        <div class="small muted">Se guarda solo en esta PC. Los mensajes ya resumidos se borran solos a los 120 días.</div>
      </div>
    </div>
    <div class="card" style="margin-top:14px"><h3>Cómo escribe el gimnasio (lo que Hark Pro aprendió)</h3>
      ${e.mensajes ? `<div class="grid c3">
        <div class="kpi"><div class="l">Mensajes analizados</div><div class="v">${e.mensajes}</div></div>
        <div class="kpi"><div class="l">Largo medio</div><div class="v">${e.palabras_por_mensaje} palabras</div></div>
        <div class="kpi"><div class="l">Usa emojis</div><div class="v">${pct(e.con_emoji)}</div></div>
        <div class="kpi"><div class="l">Usa exclamaciones</div><div class="v">${pct(e.con_exclamacion)}</div></div>
        <div class="kpi"><div class="l">Se ríe (jaja)</div><div class="v">${pct(e.con_risas)}</div></div>
        <div class="kpi"><div class="l">Habla de “vos”</div><div class="v">${pct(e.voseo)}</div></div></div>
        <div class="small" style="margin-top:8px">${e.emojis.length ? 'Emojis frecuentes: ' + e.emojis.map(x => `${esc(x.x)} (${x.n})`).join(' ') + '<br>' : ''}${e.aperturas.length ? 'Cómo empieza: ' + e.aperturas.map(x => esc(x.x)).join(', ') + '<br>' : ''}${e.cierres.length ? 'Cómo cierra: ' + e.cierres.map(x => esc(x.x)).join(', ') + '<br>' : ''}${e.muletillas.length ? 'Expresiones: ' + e.muletillas.map(x => esc(x.x)).join(', ') + '<br>' : ''}${e.palabras.length ? 'Palabras que más usa: ' + e.palabras.map(x => esc(x.x)).join(', ') : ''}</div>
        ${e.muestras.length ? `<div class="small muted" style="margin-top:8px">Ejemplos de mensajes</div>${e.muestras.slice(0, 6).map(x => `<div class="small">“${esc(x)}”</div>`).join('')}` : ''}`
      : '<div class="empty">Todavía no leyó mensajes enviados desde el gimnasio. Cuando active la lectura de WhatsApp y haya conversaciones, acá aparece su estilo.</div>'}</div>
    <div class="card" style="margin-top:14px"><h3>3 · Seguimiento a alumnos con el plan vencido <span class="pill">en preparación</span></h3>
      <p class="muted">Dejá definido a quiénes y cada cuánto va a escribirles Hark Pro cuando lo pongas en productivo. <b>Hoy no envía nada</b>: solo guarda esta configuración y te muestra a quiénes les escribiría.</p>
      <form id="f-seg" class="row" style="gap:10px;flex-wrap:wrap;align-items:flex-end">
        ${campo('Plan vencido hace (días) o más', `<input type="number" name="dias_vencido" min="1" max="365" value="${sg.dias_vencido}" style="width:90px">`)}
        ${campo('Un mensaje cada (días)', `<input type="number" name="cada_dias" min="1" max="60" value="${sg.cada_dias}" style="width:90px">`)}
        <div class="field grow" style="min-width:240px"><label>Idea del mensaje semanal (Hark Pro lo escribe con el estilo aprendido)</label><textarea name="mensaje" rows="2" maxlength="600" placeholder="Ej.: Contarles que los extrañamos y que pueden volver con una clase de prueba.">${esc(sg.mensaje || '')}</textarea></div>
        <button class="primary">Guardar</button></form>
      <div class="small muted" style="margin-top:10px">Alumnos que hoy entrarían en el seguimiento: <b>${sg.candidatos.length}</b></div>
      ${sg.candidatos.length ? `<div class="tablewrap" style="max-height:260px;overflow:auto"><table><thead><tr><th>Alumno</th><th class="num">Días vencido</th></tr></thead><tbody>${sg.candidatos.slice(0, 50).map(x => `<tr style="cursor:default"><td>${esc(x.nombre)}</td><td class="num">${x.dias}</td></tr>`).join('')}</tbody></table></div>` : ''}
    </div>`;
  const rec = () => bloqueHark(main).catch(fail);
  $('#hp-act', main).onclick = () => {
    const m = modal(p.activo ? 'Cambiar el período de aprendizaje' : 'Activar Hark Pro', `<p class="muted">Durante este período Hark Pro observa cómo planifican los profesores. Al terminar, empieza a aplicar lo aprendido.</p>
      <form id="f" class="stack"><div class="fgrid">${campo('Desde', campoFecha('desde', p.desde || hoyAR(), { label: 'Desde' }))}${campo('Hasta', campoFecha('hasta', p.hasta || sumaDias(hoyAR(), 28), { label: 'Hasta' }))}</div>
      <div class="row" style="justify-content:flex-end"><button type="button" data-close>Cancelar</button><button class="primary">${p.activo ? 'Guardar período' : 'Activar Hark Pro'}</button></div></form>`);
    enlazarFechas(m);
    $('#f', m).onsubmit = async (ev) => { ev.preventDefault(); const f = Object.fromEntries(new FormData(ev.target)); try { await api('PUT', '/hark/plan', { activo: true, desde: f.desde, hasta: f.hasta }); m.close(); toast('Hark Pro activado'); rec(); } catch (er) { fail(er); } };
  };
  const off = $('#hp-off', main); if (off) off.onclick = async () => { if (await confirmar('Hark Pro deja de observar y de aplicar lo aprendido. Lo aprendido se conserva.', 'Apagar')) { try { await api('PUT', '/hark/plan', { activo: false }); rec(); } catch (er) { fail(er); } } };
  const bb = $('#hp-borrar', main); if (bb) bb.onclick = async () => { if (await confirmar('Se borra todo lo que Hark Pro aprendió de la planificación.', 'Borrar', true)) { try { await api('DELETE', '/hark/plan/datos'); rec(); } catch (er) { fail(er); } } };
  const on = $('#wa-on', main); if (on) on.onclick = async () => { try { await api('PUT', '/hark/wa', { activo: true, consentimiento: $('#wa-ok', main).checked }); toast('Lectura de WhatsApp activada'); rec(); } catch (er) { fail(er); } };
  const wo = $('#wa-off', main); if (wo) wo.onclick = async () => { try { await api('PUT', '/hark/wa', { activo: false }); rec(); } catch (er) { fail(er); } };
  const wr = $('#wa-res', main); if (wr) wr.onclick = async () => { try { const r = await api('POST', '/hark/wa/resumir'); toast(r.creados + ' resúmenes agregados a Seguimiento'); rec(); } catch (er) { fail(er); } };
  const wb = $('#wa-borrar', main); if (wb) wb.onclick = async () => { if (await confirmar('Se borran los mensajes capturados que todavía no se resumieron o ya se resumieron. Los comentarios ya creados en Seguimiento no se tocan.', 'Borrar', true)) { try { await api('DELETE', '/hark/wa/datos'); rec(); } catch (er) { fail(er); } } };
  const ab = $('#wa-abrir', main); if (ab) ab.onclick = () => window.omegaEscritorio.abrirWhatsApp();
  $('#f-seg', main).onsubmit = async (ev) => { ev.preventDefault(); try { await api('PUT', '/hark/seg', Object.fromEntries(new FormData(ev.target))); toast('Configuración guardada'); rec(); } catch (er) { fail(er); } };
}

// Compatibilidad: el link viejo a la pestaña de Planificación lleva a Ajustes
vista('/planificacion/hark', ['admin'], async () => { ir('#/ajustes'); });
