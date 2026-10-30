'use strict';
// ---------- Estado de resultados y Presupuesto rolling de 12 meses (solo administrador) ----------
// Parte pura (sin pantalla): se usa también en los tests.
const Forecast = (() => {
  const mesMasF = (mes, n) => { const [y, m] = mes.split('-').map(Number); return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7); };
  const r0 = (n) => Math.round(n);
  function escenarioInicial(base) {
    return { meses: Array.from({ length: 12 }, () => ({ inflacion: 2.5, en_precios: true, en_costos: true, alumnos: null, salto: 0, precio: null })), picos: [], ajustes: {}, base_costos: null, base_ingresos: null };
  }
  const hay = (v) => v !== undefined && v !== null && v !== '';
  // base: /finanzas/forecast.base ; esc: escenario ; devuelve 12 columnas.
  // Ajustes manuales: esc.ajustes[linea][i] fija el nivel de esa línea desde ese mes (y sigue ajustándose por inflación), esc.meses[i].precio fija la cuota promedio.
  function calcular(base, esc) {
    const cols = [];
    let precio = base.ticket || 0, otros = base.otros_ingresos || 0;
    const linea = { ...base.lineas };
    const fijosBase = Object.values(base.lineas).reduce((a, v) => a + v, 0);
    for (let i = 0; i < 12; i++) {
      const m = (esc.meses && esc.meses[i]) || {};
      const infl = (Number(m.inflacion) || 0) / 100;
      const fP = (m.en_precios === false ? 0 : infl), fC = (m.en_costos === false ? 0 : infl);
      const salto = (Number(m.salto) || 0) / 100;
      precio = precio * (1 + fP) * (1 + salto); otros = otros * (1 + fP);
      if (hay(m.precio)) precio = Number(m.precio);
      for (const k of Object.keys(linea)) {
        linea[k] = linea[k] * (1 + fC);
        const ov = esc.ajustes && esc.ajustes[k] && esc.ajustes[k][i];
        if (hay(ov)) linea[k] = Number(ov);
      }
      const alumnos = hay(m.alumnos) ? Number(m.alumnos) : base.alumnos;
      const mes = mesMasF(base.desde, i);
      const nivel = { ...linea };
      const costos = {}, gastos = {}, picosL = {};
      for (const k of base.costos) costos[k] = linea[k] || 0;
      for (const k of base.gastos) gastos[k] = linea[k] || 0;
      let picosTot = 0;
      for (const p of esc.picos || []) {
        if (p.mes !== mes) continue; const v = Number(p.monto) || 0;
        if (p.linea in costos) costos[p.linea] += v; else if (p.linea in gastos) gastos[p.linea] += v; else continue;
        picosL[p.linea] = (picosL[p.linea] || 0) + v; picosTot += v;
      }
      const ingCuotas = alumnos * precio, ingresos = ingCuotas + otros;
      const tCostos = Object.values(costos).reduce((a, b) => a + b, 0), tGastos = Object.values(gastos).reduce((a, b) => a + b, 0);
      const margen = ingresos - tCostos, resultado = margen - tGastos;
      const fijos = tCostos + tGastos;
      const equilibrio = precio > 0 ? Math.ceil(Math.max(0, fijos - otros) / precio) : null;
      const nivelTot = Object.values(nivel).reduce((a, v) => a + v, 0);
      const compensa = base.ticket > 0 && fijosBase > 0 ? (precio / base.ticket) >= (nivelTot / fijosBase) - 1e-9 : true;
      const R = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, r0(v)]));
      cols.push({ mes, inflacion: m.inflacion, alumnos, precio: r0(precio), ingCuotas: r0(ingCuotas), otros: r0(otros), ingresos: r0(ingresos),
        costos: R(costos), gastos: R(gastos), nivel: R(nivel), picos: R(picosL), picosTot: r0(picosTot),
        tCostos: r0(tCostos), tGastos: r0(tGastos), margen: r0(margen), resultado: r0(resultado),
        equilibrio, faltan: equilibrio == null ? null : Math.max(0, equilibrio - alumnos), precioEq: alumnos > 0 ? r0(Math.max(0, fijos - otros) / alumnos) : null,
        varPrecio: base.ticket > 0 ? Math.round(1000 * (precio / base.ticket - 1)) / 10 : null, varCostos: fijosBase > 0 ? Math.round(1000 * (nivelTot / fijosBase - 1)) / 10 : null, compensa });
    }
    return cols;
  }
  return { calcular, escenarioInicial, mesMasF };
})();
if (typeof module !== 'undefined') module.exports = Forecast;
if (typeof window !== 'undefined') window.Forecast = Forecast;


(function () {
  if (typeof vista !== 'function') return;
  const MC = (mes) => { const [y, m] = mes.split('-'); return MESES[Number(m) - 1].slice(0, 3) + ' ' + y.slice(2); };
  const MCL = (mes) => { const [y, m] = mes.split('-'); return MESES[Number(m) - 1] + ' ' + y; };
  const pc = (v) => (v == null ? '' : String(Math.round(v * 10) / 10).replace('.', ',') + '%');
  const num = (v) => { const a = Math.abs(v || 0); const t = a >= 1e7 ? (a / 1e6).toLocaleString('es-AR', { maximumFractionDigits: 1 }) + ' M' : Math.round(a).toLocaleString('es-AR'); return (v < 0 && a >= 0.5 ? '−' : '') + t; };
  const hoyMes = () => hoyAR().slice(0, 7);

  // ---------- Estado de resultados: filas comunes a la pantalla y al Excel ----------
  function filasER(C) {
    const F = [];
    const cat = (id, t, v, p) => F.push({ id, t, cat: true, v, p });
    const det = (id, t, v, p, ent) => F.push({ id, t, det: true, v, p, ent });
    const tot = (t, v, p) => F.push({ t, tot: true, v, p });
    cat('ingresos', 'Ingresos', c => c.ingresos.total, () => 100);
    [...new Set(C.flatMap(c => c.ingresos.items.map(i => i.nombre)))].forEach(n => det('ingresos', n, c => (c.ingresos.items.find(i => i.nombre === n) || { monto: 0 }).monto, c => (c.ingresos.items.find(i => i.nombre === n) || { pct: 0 }).pct));
    det('ingresos', 'Cantidad de alumnos que pagaron', c => c.ingresos.alumnos, null, true);
    det('ingresos', 'Precio promedio por alumno', c => c.ingresos.ticket, null);
    [...new Set(C.flatMap(c => c.ingresos.por_plan.map(p => p.plan)))].forEach(n => {
      det('ingresos', n + ' · alumnos', c => (c.ingresos.por_plan.find(p => p.plan === n) || { alumnos: 0 }).alumnos, null, true);
      det('ingresos', n + ' · precio promedio', c => (c.ingresos.por_plan.find(p => p.plan === n) || { precio_promedio: 0 }).precio_promedio, null);
    });
    cat('costos', 'Costos operativos', c => -c.costos.total, c => c.costos.pct);
    C[0].costos.items.forEach(it => det('costos', it.nombre, c => -c.costos.items.find(i => i.nombre === it.nombre).monto, c => c.costos.items.find(i => i.nombre === it.nombre).pct));
    tot('Margen bruto', c => c.margen_bruto.monto, c => c.margen_bruto.pct);
    cat('gastos', 'Gastos', c => -c.gastos.total, c => c.gastos.pct);
    C[0].gastos.items.forEach(it => det('gastos', it.nombre === 'Equipamiento' ? 'Equipamiento (amortizado)' : it.nombre, c => -c.gastos.items.find(i => i.nombre === it.nombre).monto, c => c.gastos.items.find(i => i.nombre === it.nombre).pct));
    tot('Resultado del negocio', c => c.resultado.monto, c => c.resultado.pct);
    return F;
  }

  vista('/finanzas/resultados', ['admin', 'profesor'], async (main) => {
    let mes = sessionStorage.getItem('omega_er_mes') || hoyMes(); if (mes > hoyMes()) mes = hoyMes();
    let n = Number(sessionStorage.getItem('omega_er_n') || 1);
    const abiertas = new Set(['ingresos']);
    async function cargar() {
      if (mes > hoyMes()) mes = hoyMes();
      sessionStorage.setItem('omega_er_mes', mes); sessionStorage.setItem('omega_er_n', String(n));
      const d = await api('GET', '/finanzas/estado-resultados?mes=' + mes + '&meses=' + n);
      const C = d.columnas, F = filasER(C), s = d.sensibilidad, muchas = C.length > 3;
      const filas = F.filter(f => !f.det || abiertas.has(f.id));
      main.innerHTML = `<div class="page-title"><h1>Finanzas</h1><div class="actions"><button id="xls">Exportar a Excel</button></div></div>${tabsFin('/finanzas/resultados')}
        <div class="row" style="margin-bottom:12px"><button class="sm" id="ant">‹</button><input type="month" id="mes" value="${mes}" max="${hoyMes()}" style="width:auto"><button class="sm" id="sig" ${mes >= hoyMes() ? 'disabled' : ''}>›</button>
          <div class="tabs" style="margin:0 0 0 8px">${[[1, 'Mes actual'], [3, '3 meses'], [6, '6 meses'], [13, 'Actual + 12 anteriores']].map(([k, t]) => `<button data-n="${k}" class="${n === k ? 'on' : ''}">${t}</button>`).join('')}</div></div>
        <p class="small muted">Siempre termina en el mes corriente o anterior (no hay meses futuros: para eso está el Presupuesto 12 meses). Tocá Ingresos, Costos o Gastos para ver de qué están hechos; debajo de cada importe está su peso sobre los ingresos. Importes en pesos.</p>
        <div class="tablewrap"><table class="er-tabla ${muchas ? 'muchas' : ''}" style="min-width:${muchas ? 0 : 190 + C.length * 74}px"><thead><tr><th>Concepto</th>${C.map(c => `<th class="num nosort" style="text-transform:capitalize">${MC(c.mes)}</th>`).join('')}</tr></thead><tbody>
          ${filas.map(f => `<tr class="${f.cat ? 'er-cat' : f.det ? 'er-det' : 'er-tot'}" ${f.cat ? `data-cat="${f.id}"` : ''}><td ${f.det ? 'style="padding-left:18px"' : ''}>${f.cat ? `<b>${abiertas.has(f.id) ? '▾' : '▸'} ${esc(f.t)}</b>` : esc(f.t)}</td>${C.map(c => { const v = f.v(c), p = f.p ? f.p(c) : null; return `<td class="num ${f.tot && v < 0 ? 't-rojo' : ''}">${f.ent ? v : num(v)}${p != null ? `<div class="pcj">${pc(p)}</div>` : ''}</td>`; }).join('')}</tr>`).join('')}
        </tbody></table></div>
        <div class="card" style="margin-top:14px"><h3>Sensibilidad de alta</h3>
          ${s.disponible ? `<p>Con <b>${s.alumnos}</b> alumnos y costos más gastos por <b>${money(s.costos_fijos)}</b>, cada alumno carga con <b>${money(s.fijo_por_alumno)}</b>. Un alumno nuevo (<b>${money(s.ticket)}</b> de cuota) baja ese peso a <b>${money(s.fijo_por_alumno_con_nuevo)}</b>.</p>
            <div class="grid k"><div class="kpi verde"><div class="v">${pc(s.baja_pct)}</div><div class="l">Baja el costo fijo por alumno</div></div><div class="kpi"><div class="v">${pc(s.absorbe_pct)}</div><div class="l">De los costos totales absorbe su cuota</div></div><div class="kpi"><div class="v">${money(s.resultado_extra)}</div><div class="l">Resultado extra por mes</div></div></div>`
            : '<div class="muted">Hace falta tener cuotas cobradas y egresos cargados en el mes para calcularla.</div>'}</div>`;
      const set = (m) => { mes = m > hoyMes() ? hoyMes() : m; cargar().catch(fail); };
      $('#mes', main).onchange = (e) => e.target.value && set(e.target.value);
      $('#ant', main).onclick = () => set(Forecast.mesMasF(mes, -1)); $('#sig', main).onclick = () => set(Forecast.mesMasF(mes, 1));
      $$('[data-n]', main).forEach(b => b.onclick = () => { n = Number(b.dataset.n); cargar().catch(fail); });
      $$('[data-cat]', main).forEach(tr => tr.onclick = () => { const k = tr.dataset.cat; abiertas.has(k) ? abiertas.delete(k) : abiertas.add(k); cargar().catch(fail); });
      $('#xls', main).onclick = () => {
        const a = {}, b = {};
        const hojaM = F.map(f => { const o = { Concepto: (f.det ? '   ' : '') + f.t }; C.forEach(c => { o[MC(c.mes)] = f.v(c); }); return o; });
        const hojaP = F.filter(f => f.p).map(f => { const o = { Concepto: (f.det ? '   ' : '') + f.t }; C.forEach(c => { o[MC(c.mes)] = Math.round(f.p(c) * 10) / 10; }); return o; });
        descargarXlsx('omega-estado-de-resultados-' + mes + '.xlsx', { 'Estado de resultados': hojaM, 'Peso % sobre ingresos': hojaP });
      };
    }
    await cargar();
  });

  // ---------- Presupuesto / Forecast rolling de 12 meses ----------
  vista('/finanzas/presupuesto', ['admin', 'profesor'], async (main) => {
    const r = await api('GET', '/finanzas/forecast');
    let base = r.base;
    const ini = Forecast.escenarioInicial(base);
    let E = Object.assign({}, ini, r.escenario || {});
    if (!Array.isArray(E.meses) || E.meses.length !== 12) E.meses = ini.meses;
    if (!E.picos) E.picos = []; if (!E.ajustes) E.ajustes = {};
    const mc = hoyMes(), mp = Forecast.mesMasF(mc, -1);
    async function recargarBase() {
      try { base = (await api('GET', '/finanzas/forecast?costos=' + (E.base_costos || '') + '&ingresos=' + (E.base_ingresos || ''))).base; pintar(); } catch (e) { fail(e); }
    }
    function pintar() {
      const cols = Forecast.calcular(base, E);
      const fid = (t, k, i) => `data-fid="${t}:${k}:${i}"`;
      const inp = (t, k, i, v, step, ph, aj) => `<input type="number" step="${step}" ${fid(t, k, i)} data-t="${t}" data-k="${esc(k)}" data-i="${i}" value="${v ?? ''}" ${ph !== undefined ? `placeholder="${ph}"` : ''} class="${aj ? 'aj' : ''}">`;
      const fila = (t, f, cls = '') => `<tr class="${cls}"><td>${t}</td>${cols.map((c, i) => `<td class="num">${f(c, i)}</td>`).join('')}</tr>`;
      const linea = (k, g) => `<tr class="er-det"><td><span class="small">${k === 'Equipamiento' ? 'Equipamiento (amortizado)' : esc(k)}</span></td>${cols.map((c, i) => { const aj = E.ajustes[k] && E.ajustes[k][i] !== undefined && E.ajustes[k][i] !== null && E.ajustes[k][i] !== ''; return `<td class="num">${inp('ln', k, i, c.nivel[k], '1', undefined, aj)}${c.picos[k] ? `<div class="pcj t-amarillo" title="Pico puntual del mes">+${num(c.picos[k])}</div>` : ''}</td>`; }).join('')}</tr>`;
      const opcs = (sel) => `<option value="">Promedio de los últimos 3 meses</option>${base.opciones.map(m => `<option value="${m}" ${sel === m ? 'selected' : ''}>${m === mc ? 'Mes corriente · ' : m === mp ? 'Mes anterior · ' : ''}${MCL(m)}</option>`).join('')}`;
      const nAj = Object.values(E.ajustes).reduce((a, o) => a + Object.keys(o).length, 0) + E.meses.filter(m => m.precio !== null && m.precio !== undefined && m.precio !== '').length;
      main.innerHTML = `<div class="page-title"><h1>Finanzas</h1><div class="actions"><button id="xls">Exportar a Excel</button><button class="primary" id="g">Guardar presupuesto</button></div></div>${tabsFin('/finanzas/presupuesto')}
        <div class="card" style="margin-bottom:12px"><h3>1 · Punto de partida</h3>
          <p class="small muted">Copiá los números de un mes real como base y proyectalos: cada mes sale del anterior más la inflación. Después ajustá hacia arriba o abajo lo que quieras (cantidad de alumnos, precio, o cualquier costo).</p>
          <div class="grid c2">
            <div><label class="small muted">Costos y gastos (base)</label><div class="row" style="flex-wrap:nowrap"><select id="sb-c" class="grow">${opcs(E.base_costos)}</select></div>
              <div class="row" style="margin-top:6px"><button class="sm" data-cp="c:${mc}">Copiar mes corriente</button><button class="sm" data-cp="c:${mp}">Copiar mes anterior</button></div>
              <div class="small muted" style="margin-top:4px">${base.fuente_costos ? 'Base: ' + MCL(base.fuente_costos) : 'Base: promedio de ' + base.meses_base_costos.map(MC).join(', ')}.</div></div>
            <div><label class="small muted">Ingresos (alumnos × precio)</label><div class="row" style="flex-wrap:nowrap"><select id="sb-i" class="grow">${opcs(E.base_ingresos)}</select></div>
              <div class="row" style="margin-top:6px"><button class="sm" data-cp="i:${mc}">Copiar mes corriente</button><button class="sm" data-cp="i:${mp}">Copiar mes anterior</button></div>
              <div class="small muted" style="margin-top:4px">${base.fuente_ingresos ? 'Base: ' + MCL(base.fuente_ingresos) : 'Base: promedio de ' + base.meses_base.map(MC).join(', ')} → <b>${base.alumnos}</b> alumnos × <b>${money(base.ticket)}</b>.</div></div></div></div>
        <div class="infobox" style="margin-bottom:10px">Presupuesto móvil de <b>${MC(cols[0].mes)}</b> a <b>${MC(cols[11].mes)}</b>. Los casilleros de alumnos, cuota y cada costo/gasto se pueden pisar: el nuevo valor rige desde ese mes en adelante (y sigue ajustándose por inflación). ${nAj ? `<button class="ghost sm" id="borrar-aj">Borrar los ${nAj} ajustes manuales</button>` : ''}</div>
        <div class="tablewrap hbar"><table class="pres" style="min-width:1250px"><thead><tr><th>Concepto ($)</th>${cols.map(c => `<th class="num nosort" style="text-transform:capitalize">${MC(c.mes)}</th>`).join('')}</tr></thead><tbody>
          <tr><td><b>Inflación base del mes (%)</b></td>${cols.map((c, i) => `<td class="num">${inp('m', 'inflacion', i, E.meses[i].inflacion, '0.1')}</td>`).join('')}</tr>
          <tr><td class="small muted">…aplicarla a precios</td>${cols.map((c, i) => `<td class="num"><input type="checkbox" data-t="chk" data-k="en_precios" data-i="${i}" ${E.meses[i].en_precios === false ? '' : 'checked'}></td>`).join('')}</tr>
          <tr><td class="small muted">…aplicarla a costos y gastos</td>${cols.map((c, i) => `<td class="num"><input type="checkbox" data-t="chk" data-k="en_costos" data-i="${i}" ${E.meses[i].en_costos === false ? '' : 'checked'}></td>`).join('')}</tr>
          <tr><td><b>Alumnos (estacionalidad)</b></td>${cols.map((c, i) => `<td class="num">${inp('m', 'alumnos', i, E.meses[i].alumnos === null || E.meses[i].alumnos === undefined ? '' : E.meses[i].alumnos, '1', base.alumnos)}</td>`).join('')}</tr>
          <tr><td><b>Aumento de precio extra (%)</b></td>${cols.map((c, i) => `<td class="num">${inp('m', 'salto', i, E.meses[i].salto || '', '0.5', 0)}</td>`).join('')}</tr>
          <tr><td><b>Precio por alumno</b></td>${cols.map((c, i) => `<td class="num">${inp('m', 'precio', i, c.precio, '1', undefined, E.meses[i].precio !== null && E.meses[i].precio !== undefined && E.meses[i].precio !== '')}</td>`).join('')}</tr>
          ${fila('<b>Ingresos</b>', c => '<b>' + num(c.ingresos) + '</b>', 'er-cat')}
          ${base.costos.map(k => linea(k)).join('')}
          ${fila('<b>Costos operativos</b>', c => '<b>' + num(-c.tCostos) + '</b>')}
          ${fila('<b>Margen bruto</b>', c => '<b class="' + (c.margen < 0 ? 't-rojo' : '') + '">' + num(c.margen) + '</b>', 'er-tot')}
          ${base.gastos.map(k => linea(k)).join('')}
          ${fila('<b>Gastos</b>', c => '<b>' + num(-c.tGastos) + '</b>')}
          ${fila('<b>Resultado</b>', c => '<b class="' + (c.resultado < 0 ? 't-rojo' : 't-verde') + '">' + num(c.resultado) + '</b>', 'er-tot')}
          ${fila('<b>Punto de equilibrio (alumnos)</b>', c => c.equilibrio ?? '—')}
          ${fila('Alumnos que faltan', c => c.faltan ? '<span class="t-rojo">+' + c.faltan + '</span>' : '<span class="t-verde">✓</span>')}
          ${fila('Precio de equilibrio', c => c.precioEq != null ? num(c.precioEq) : '—')}
          ${fila('Precio vs. base', c => pc(c.varPrecio))}
          ${fila('Costos vs. base', c => pc(c.varCostos))}
          ${fila('¿El precio le gana a la inflación?', c => c.compensa ? '<span class="t-verde">Sí</span>' : '<span class="t-rojo">No</span>')}
        </tbody></table></div>
        <div class="small muted" style="margin-top:6px">“Punto de equilibrio” = alumnos necesarios para cubrir costos y gastos con la cuota de ese mes. Si en un mes de pocos alumnos faltan alumnos aunque el precio le gane a la inflación, hace falta más volumen.</div>
        <div class="card" style="margin-top:14px"><h3>Picos puntuales (aguinaldo, eventos, compras)</h3>
          <p class="small muted">Acá también llegan los egresos que cargás en “Análisis del mes” con fecha futura.</p>
          ${E.picos.length ? E.picos.map((p, i) => `<div class="list-item"><div class="grow"><b>${MC(p.mes)}</b> · ${esc(p.linea)} · ${money(p.monto)}${p.concepto ? ' · ' + esc(p.concepto) : ''}</div><button class="ghost sm" data-xp="${i}">Quitar</button></div>`).join('') : '<div class="muted small">Sin picos cargados.</div>'}
          <div class="row" style="margin-top:8px"><select id="pk-m">${cols.map(c => `<option value="${c.mes}">${MC(c.mes)}</option>`).join('')}</select><select id="pk-l">${[...base.costos, ...base.gastos].map(k => `<option>${esc(k)}</option>`).join('')}</select><input type="number" id="pk-v" placeholder="Monto $" style="width:130px"><input id="pk-c" placeholder="Concepto (opcional)" style="width:180px"><button id="pk-a">Agregar</button><button id="pk-ag">Aguinaldo (50% de salarios en dic. y jun.)</button></div></div>`;
      const refoco = () => setTimeout(() => { const a = document.activeElement; const id = a && a.dataset && a.dataset.fid; pintar(); if (id) { const nn = main.querySelector(`[data-fid="${id}"]`); if (nn) { nn.focus(); if (nn.select) nn.select(); } } }, 0);
      $$('input[data-t]', main).forEach(i => i.onchange = () => {
        const t = i.dataset.t, k = i.dataset.k, ix = Number(i.dataset.i), v = i.value;
        if (t === 'chk') E.meses[ix][k] = i.checked;
        else if (t === 'ln') { const c = cols[ix]; if (v === '') { if (E.ajustes[k]) delete E.ajustes[k][ix]; } else if (Math.round(Number(v)) !== c.nivel[k]) { (E.ajustes[k] = E.ajustes[k] || {})[ix] = Math.max(0, Number(v)); } }
        else if (k === 'alumnos') E.meses[ix][k] = v === '' ? null : Math.max(0, Number(v));
        else if (k === 'precio') { const c = cols[ix]; E.meses[ix][k] = v === '' ? null : (Math.round(Number(v)) !== c.precio ? Math.max(0, Number(v)) : E.meses[ix][k]); }
        else E.meses[ix][k] = Number(v) || 0;
        refoco();
      });
      $$('[data-xp]', main).forEach(b => b.onclick = () => { E.picos.splice(Number(b.dataset.xp), 1); pintar(); });
      $('#pk-a', main).onclick = () => { const v = Number($('#pk-v', main).value); if (!(v > 0)) return toast('Escribí un monto', 'warn'); E.picos.push({ mes: $('#pk-m', main).value, linea: $('#pk-l', main).value, monto: v, concepto: $('#pk-c', main).value.trim() }); pintar(); };
      $('#pk-ag', main).onclick = () => {
        const sal = base.lineas['Salarios'] || 0; if (!sal) return toast('No hay salarios cargados para calcular el aguinaldo', 'warn');
        E.picos = E.picos.filter(p => !p.auto);
        cols.filter(c => c.mes.endsWith('-12') || c.mes.endsWith('-06')).forEach(c => E.picos.push({ mes: c.mes, linea: 'Salarios', monto: Math.round(c.nivel['Salarios'] * 0.5), auto: true, concepto: 'Aguinaldo' }));
        pintar();
      };
      $('#sb-c', main).onchange = (e) => { E.base_costos = e.target.value || null; recargarBase(); };
      $('#sb-i', main).onchange = (e) => { E.base_ingresos = e.target.value || null; recargarBase(); };
      $$('[data-cp]', main).forEach(b => b.onclick = () => { const [q, m] = b.dataset.cp.split(':'); if (q === 'c') E.base_costos = m; else E.base_ingresos = m; recargarBase(); });
      const ba = $('#borrar-aj', main); if (ba) ba.onclick = () => { E.ajustes = {}; E.meses.forEach(m => { m.precio = null; }); pintar(); };
      $('#g', main).onclick = async () => { try { await api('PUT', '/finanzas/forecast', { escenario: E }); toast('Presupuesto guardado'); } catch (e) { fail(e); } };
      $('#xls', main).onclick = () => {
        const fl = (t, f) => { const o = { Concepto: t }; cols.forEach(c => { o[MC(c.mes)] = f(c); }); return o; };
        const filas = [fl('Inflación base del mes (%)', c => c.inflacion), fl('Alumnos', c => c.alumnos), fl('Precio por alumno', c => c.precio), fl('Ingresos', c => c.ingresos),
          ...base.costos.map(k => fl('   ' + k, c => -c.costos[k])), fl('Costos operativos', c => -c.tCostos), fl('Margen bruto', c => c.margen),
          ...base.gastos.map(k => fl('   ' + (k === 'Equipamiento' ? 'Equipamiento (amortizado)' : k), c => -c.gastos[k])), fl('Gastos', c => -c.tGastos), fl('Resultado', c => c.resultado),
          fl('Punto de equilibrio (alumnos)', c => c.equilibrio), fl('Alumnos que faltan', c => c.faltan), fl('Precio de equilibrio', c => c.precioEq), fl('Precio vs. base (%)', c => c.varPrecio), fl('Costos vs. base (%)', c => c.varCostos), fl('El precio le gana a la inflación', c => c.compensa ? 'Sí' : 'No')];
        const hojas = { 'Presupuesto 12 meses': filas };
        if (E.picos.length) hojas['Picos puntuales'] = E.picos.map(p => ({ Mes: MC(p.mes), Línea: p.linea, Monto: p.monto, Concepto: p.concepto || '' }));
        descargarXlsx('omega-presupuesto-12-meses.xlsx', hojas);
      };
    }
    pintar();
  });
})();
