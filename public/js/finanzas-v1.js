'use strict';
// ---------- Finanzas: Caja diaria (la pestaña “Análisis del mes” está en finanzas-ajustes.js) ----------
function tabsFin(activa) {
  const t = [['/finanzas', 'Caja diaria', 'fin.caja'], ['/finanzas/mes', 'Análisis del mes', 'fin.analisis'], ['/finanzas/resultados', 'Estado de resultados', 'fin.resultados'], ['/finanzas/presupuesto', 'Presupuesto 12 meses', 'fin.presupuesto']].filter(x => puede(x[2]));
  if (t.length < 2) return '';
  return `<div class="tabs">${t.map(([h, n]) => `<button onclick="ir('#${h}')" class="${h === activa ? 'on' : ''}">${n}</button>`).join('')}</div>`;
}

// ---------- Pestaña 1: Caja diaria (efectivo físico) ----------
vista('/finanzas', ['admin', 'profesor'], async (main) => {
  const adm = puede('fin.analisis|fin.resultados|fin.presupuesto');
  let fecha = sessionStorage.getItem('omega_caja') || hoyAR();
  async function cargar() {
    sessionStorage.setItem('omega_caja', fecha);
    const c = await api('GET', '/caja?fecha=' + fecha);
    const esHoy = fecha === hoyAR();
    const lista = (arr, tipo) => arr.length ? arr.map(m => `<div class="caja-mov"><div class="grow"><b>${esc(m.concepto || m.categoria)}</b>${m.pago_id ? '<div class="small muted">cuota cobrada en efectivo</div>' : ''}</div><b>${money(m.monto)}</b>${m.pago_id || !puede('fin.caja_borrar') ? '' : `<button class="ghost sm" data-del="${m.id}" aria-label="Quitar">✕</button>`}</div>`).join('') : `<div class="small muted" style="padding:8px 0">Sin ${tipo} todavía</div>`;
    main.innerHTML = `<div class="page-title"><h1>${adm ? 'Finanzas' : 'Caja diaria'}</h1></div>${tabsFin('/finanzas')}
      <div class="row" style="margin-bottom:12px"><button class="sm" id="ant">‹</button><input type="date" id="f" value="${fecha}" style="width:auto"><button class="sm" id="sig">›</button><b>${fmtFlargo(fecha)}</b>${esHoy ? '<span class="pill verde">Hoy</span>' : '<button class="sm ghost" id="hoy">Ir a hoy</button>'}</div>
      <div class="caja-grid">
        <div class="caja-bloque"><div class="l">Saldo inicial</div><div class="v">${money(c.saldo_inicial)}</div>${puede('fin.saldo') ? `<button class="sm ghost" id="b-ini">${c.saldo_inicial_manual ? 'Corregir' : 'Fijar con lo que hay en el cajón'}</button>` : ''}</div>
        <div class="caja-bloque verde"><div class="row between"><div class="l">Ingresos</div>${puede('fin.ingresos') ? '<button class="primary sm" id="b-ing" aria-label="Agregar ingreso">＋</button>' : ''}</div><div class="v">${money(c.total_ingresos)}</div>${lista(c.ingresos, 'ingresos')}</div>
        <div class="caja-bloque rojo"><div class="row between"><div class="l">Egresos</div>${puede('fin.egresos') ? '<button class="danger sm" id="b-egr" aria-label="Agregar egreso">＋</button>' : ''}</div><div class="v">${money(c.total_egresos)}</div>${lista(c.egresos, 'egresos')}</div>
        <div class="caja-bloque final"><div class="l">Saldo final</div><div class="v">${money(c.saldo_final)}</div><div class="small muted">Tiene que coincidir con los billetes que hay en el cajón.</div></div></div>
      <p class="small muted" style="margin-top:12px">Acá solo entra el efectivo: las cuotas cobradas con “Efectivo” al renovar un plan se suman solas. Los pagos con Mercado Pago no pasan por la caja.</p>`;
    const set = (f) => { fecha = f; cargar().catch(fail); };
    $('#f', main).onchange = (e) => e.target.value && set(e.target.value);
    $('#ant', main).onclick = () => set(sumaDias(fecha, -1)); $('#sig', main).onclick = () => set(sumaDias(fecha, 1));
    const h = $('#hoy', main); if (h) h.onclick = () => set(hoyAR());
    const bi = $('#b-ing', main); if (bi) bi.onclick = () => movCaja('ingreso');
    const be = $('#b-egr', main); if (be) be.onclick = () => movCaja('egreso');
    const bini = $('#b-ini', main); if (bini) bini.onclick = () => {
      const m = modal('Saldo inicial de la caja', `<form id="f2" class="stack">${campo('Efectivo en el cajón al abrir ($)', `<input name="monto" type="number" step="1" required value="${Math.round(c.saldo_inicial)}" inputmode="numeric">`)}<div class="row" style="justify-content:flex-end"><button type="button" data-close>Cancelar</button><button class="primary">Guardar</button></div></form>`);
      $('#f2', m).onsubmit = async (e) => { e.preventDefault(); try { await api('PUT', '/caja/saldo-inicial', { fecha, monto: new FormData(e.target).get('monto') }); m.close(); cargar(); } catch (er) { fail(er); } };
    };
    $$('[data-del]', main).forEach(b => b.onclick = async () => { if (!(await confirmar('¿Quitar este movimiento de la caja?', 'Quitar', true))) return; try { await api('DELETE', '/caja/movimiento/' + b.dataset.del); cargar(); } catch (e) { fail(e); } });
  }
  function movCaja(tipo) {
    const m = modal(tipo === 'ingreso' ? 'Ingreso en efectivo' : 'Egreso en efectivo', `<form id="f2" class="stack">
      ${campo('Concepto', '<input name="concepto" required autocomplete="off" autofocus placeholder="' + (tipo === 'ingreso' ? 'Ej.: venta de agua' : 'Ej.: artículos de limpieza') + '">')}
      ${campo('Monto ($)', '<input name="monto" type="number" min="1" step="1" required inputmode="numeric">')}
      ${tipo === 'egreso' ? campo('Impacto en el resultado', `<select name="devengar_meses"><option value="1">100% este mes</option>${[2, 3, 4, 6, 9, 12, 18, 24, 36].map(n => `<option value="${n}">Repartido en ${n} meses (amortización)</option>`).join('')}</select>`) : ''}
      ${tipo === 'egreso' ? campo('Categoría', `<select name="categoria">${CATS_EGRESO.map(c => `<option>${c}</option>`).join('')}</select>`) : ''}
      <div class="small muted">Se carga con la fecha ${fmtF(fecha)}.</div>
      <div class="row" style="justify-content:flex-end"><button type="button" data-close>Cancelar</button><button class="primary">Guardar</button></div></form>`);
    $('#f2', m).onsubmit = async (e) => {
      e.preventDefault(); const fd = Object.fromEntries(new FormData(e.target));
      try { await api('POST', '/caja/movimiento', { tipo, concepto: fd.concepto, monto: fd.monto, categoria: fd.categoria, fecha, devengar_meses: fd.devengar_meses || 1 }); m.close(); toast('Guardado'); cargar(); } catch (er) { fail(er); }
    };
  }
  await cargar();
});

// ---------- gráficos del simulador ----------
function graficoLineas(series, { ancho = 560, alto = 220, etiquetasX = [], formato = compacto, ceroLinea = true } = {}) {
  const padL = 46, padB = 24, padT = 10, padR = 10;
  const todos = series.flatMap(s => s.valores.filter(v => v != null));
  let min = Math.min(...todos, ceroLinea ? 0 : Infinity), max = Math.max(...todos, ceroLinea ? 0 : -Infinity);
  if (min === max) { max += 1; min -= 1; }
  const n = Math.max(...series.map(s => s.valores.length));
  const X = (i) => padL + (n === 1 ? 0 : i * (ancho - padL - padR) / (n - 1)), Y = (v) => padT + (max - v) * (alto - padT - padB) / (max - min);
  let g = '';
  for (let k = 0; k <= 4; k++) { const v = min + (max - min) * k / 4; g += `<line x1="${padL}" x2="${ancho - padR}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line)" stroke-width="1"/><text x="${padL - 6}" y="${Y(v) + 3}" text-anchor="end" font-size="10" fill="var(--muted)">${formato(v)}</text>`; }
  if (ceroLinea && min < 0 && max > 0) g += `<line x1="${padL}" x2="${ancho - padR}" y1="${Y(0)}" y2="${Y(0)}" stroke="var(--muted)" stroke-width="1.5" stroke-dasharray="4 3"/>`;
  etiquetasX.forEach((t, i) => { g += `<text x="${X(i)}" y="${alto - 6}" text-anchor="middle" font-size="10" fill="var(--muted)">${esc(t)}</text>`; });
  for (const s of series) {
    const pts = s.valores.map((v, i) => v == null ? null : [X(i), Y(v)]).filter(Boolean);
    g += `<polyline points="${pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ')}" fill="none" stroke="${s.color}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" ${s.punteada ? 'stroke-dasharray="6 4"' : ''}/>`;
    if (!s.sinPuntos) g += pts.map(p => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3.2" fill="${s.color}"/>`).join('');
  }
  return `<svg viewBox="0 0 ${ancho} ${alto}" class="grafico" role="img">${g}</svg><div class="legend">${series.map(s => `<span><i style="background:${s.color}"></i>${esc(s.nombre)}</span>`).join('')}</div>`;
}
