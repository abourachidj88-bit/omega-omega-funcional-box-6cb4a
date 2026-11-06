'use strict';
// ---------- Versión 9: diseñador de posiciones de ejercicios (figura de palitos) ----------
// Se arrastran las articulaciones (puntos blancos) para armar cada una de las 3 posiciones y se suma el equipamiento arrastrándolo al dibujo.
// La figura se dibuja con el color del patrón de movimiento. Al guardar, cada posición queda como imagen y como datos editables.

const ETQ_EQUIPO = { mancuerna: 'Mancuerna', pesa_rusa: 'Pesa rusa', barra_discos: 'Barra con discos', pelota: 'Pelota', bolso: 'Bolso', rueda_abdominal: 'Rueda abdominal', colchoneta: 'Colchoneta', cajon: 'Cajón', banco: 'Banco', barra_dominadas: 'Barra de dominadas', conos: 'Conos', soga: 'Soga', banda_rtx: 'Banda / TRX' };
let _COLORES_PAT = null;
async function coloresPatrones(forzar) { if (!_COLORES_PAT || forzar) _COLORES_PAT = await api('GET', '/patrones/colores'); return _COLORES_PAT; }
const colorDeZona = (zona) => { const c = (_COLORES_PAT || []).find(x => x.nombre === zona); return c ? c.color : '#ff6b35'; };
const clonar = (o) => JSON.parse(JSON.stringify(o));

// Administrador: elegir el color de cada patrón de movimiento
async function editarColoresPatrones(despues) {
  const cols = await coloresPatrones(true);
  const m = modal('Colores de los patrones de movimiento', `<p class="small muted">Con este color se dibujan las figuras de los ejercicios nuevos de cada patrón.</p>
    <div class="stack">${cols.map(c => `<div class="row" style="align-items:center;gap:10px"><input type="color" data-c="${c.clave}" value="${esc(c.color)}" style="width:52px;padding:3px;flex:0 0 52px"><span>${esc(c.nombre)}</span></div>`).join('')}</div>
    <div class="row" style="justify-content:flex-end;margin-top:12px"><button data-close>Cancelar</button><button class="primary" id="g">Guardar</button></div>`);
  $('#g', m).onclick = async () => {
    try { _COLORES_PAT = await api('PUT', '/patrones/colores', { colores: $$('[data-c]', m).map(i => ({ clave: i.dataset.c, color: i.value })) }); m.close(); toast('Colores guardados'); if (despues) despues(); } catch (e) { fail(e); }
  };
}

// Abre el diseñador. Devuelve (promesa) { poses, imgs } al guardar, o null si se cancela.
// Parámetros: poses (las ya dibujadas o null), patronBase (ilustración automática de partida), zona (nombre del patrón de movimiento), eq (equipamiento del gimnasio)
function disenarPosiciones({ poses, patronBase, zona, eq }) {
  return new Promise(async (resolve) => {
    try { await coloresPatrones(); } catch (_) {}
    Ilustra.setDibujos(eq || []);
    const CLAVES_EQ = [...new Set([...Ilustra.EQUIPOS_DIB, ...(eq || []).map(e => e.clave).filter(c => c && c !== 'ninguno')])];
    const color = colorDeZona(zona);
    let est = poses && poses.length === 3 ? clonar(poses) : Ilustra.plantilla(patronBase || 'sentadilla');
    let cur = 0, sel = null, anim = null, terminado = false;
    const etiqueta = (k) => { const x = (eq || []).find(e => e.clave === k); return (x && x.nombre) || ETQ_EQUIPO[k] || k; };
    const m = modal('Dibujar las 3 posiciones', `
      <p class="small muted" style="margin:0 0 8px">Arrastrá los <b>puntos blancos</b> para mover cuerpo y articulaciones. Sumá equipamiento tocándolo o arrastrándolo al dibujo. Color del patrón: <span class="pill" style="background:${esc(color)};color:#000">${esc(zona || 'Patrón')}</span></p>
      <div class="row" style="gap:6px;flex-wrap:wrap;margin-bottom:8px" id="tabs"></div>
      <div class="grid2" style="gap:12px;align-items:start">
        <div><div id="lienzo" class="lienzo-pose" style="touch-action:none;user-select:none"></div>
          <div class="row" style="gap:6px;flex-wrap:wrap;margin-top:8px">
            <label class="small row" style="gap:4px;margin:0"><input type="checkbox" id="ind-b"> Brazos independientes</label>
            <label class="small row" style="gap:4px;margin:0"><input type="checkbox" id="ind-p"> Piernas independientes</label>
            <button type="button" class="sm" id="suelo" title="Baja o sube el cuerpo hasta apoyar en el piso">Apoyar en el piso</button>
            
            <button type="button" class="sm" id="play">▶ Ver movimiento</button></div></div>
        <div><div class="field"><label>Partir de una figura base</label><div class="row" style="gap:6px"><select id="base" style="flex:1;min-width:0">${Ilustra.PATRONES.map(p => `<option value="${p}" ${p === (patronBase || 'sentadilla') ? 'selected' : ''}>${esc((typeof PATRON_NOMBRE !== 'undefined' && PATRON_NOMBRE[p]) || p)}</option>`).join('')}</select><button type="button" class="sm" id="aplicar-base" title="Reemplaza las 3 posiciones por esa figura">Usar</button></div></div>
          <div class="field"><label>Equipamiento (tocá o arrastrá al dibujo)</label><div class="row" id="paleta" style="gap:6px;flex-wrap:wrap"></div></div>
          <div class="field"><label>Copiar una posición a otra</label>
            <div class="row" style="gap:6px;flex-wrap:wrap;align-items:center"><span class="small">Copiar la</span><select id="cp-de" style="width:auto"><option value="0">1 · Inicial</option><option value="1">2 · Media</option><option value="2">3 · Final</option></select><span class="small">a</span><select id="cp-a" style="width:auto"><option value="r">las demás</option><option value="0">la 1 · Inicial</option><option value="1">la 2 · Media</option><option value="2">la 3 · Final</option><option value="12">la 2 y la 3</option></select></div>
            <div class="row" style="gap:6px;flex-wrap:wrap;align-items:center;margin-top:4px"><span class="small">Qué copiar</span><select id="cp-que" style="width:auto"><option value="todo">Todo (cuerpo y equipamiento)</option><option value="cuerpo">Solo el cuerpo</option><option value="eq">Solo el equipamiento</option></select><button type="button" class="sm primary" id="cp-ok">Copiar</button></div></div>
          <div class="field"><label>En esta posición</label><div id="puestos" class="small"></div></div>
          <div class="small muted">Si el equipamiento se suelta cerca de una mano, la acompaña cuando movés el brazo. Con la barra de cada elemento lo agrandás o achicás (40 % a 300 %).</div></div></div>
      <div class="field" style="margin-top:8px"><label>Secuencia</label><div class="row" id="mini" style="gap:8px"></div></div>
      <div class="row" style="justify-content:flex-end;margin-top:10px"><button type="button" data-close>Cancelar</button><button type="button" class="primary" id="ok">Guardar posiciones</button></div>`, { wide: true, onClose: () => { clearInterval(anim); if (!terminado) resolve(null); } });

    const lienzo = $('#lienzo', m);
    const nombrePos = ['1 · Inicial', '2 · Media', '3 · Final'];
    const pintarTabs = () => { $('#tabs', m).innerHTML = nombrePos.map((n, i) => `<button type="button" class="sm ${i === cur ? 'primary' : ''}" data-p="${i}">${n}</button>`).join(''); $$('[data-p]', m).forEach(b => b.onclick = () => { cur = Number(b.dataset.p); sel = null; clearInterval(anim); todo(); }); };
    const pintarLienzo = () => { lienzo.innerHTML = Ilustra.pose2svg(est[cur], { color, handles: true, sel }); };
    const pintarMini = () => { $('#mini', m).innerHTML = est.map((p, i) => `<div style="width:92px;text-align:center;cursor:pointer;border:1px solid ${i === cur ? 'var(--brand,#ff6b35)' : 'var(--line,#2b3240)'};border-radius:8px;padding:2px" data-mi="${i}">${Ilustra.pose2svg(p, { color })}<div class="small muted">${nombrePos[i]}</div></div>`).join(''); $$('[data-mi]', m).forEach(d => d.onclick = () => { cur = Number(d.dataset.mi); sel = null; todo(); }); };
    const pintarPuestos = () => {
      const eqs = est[cur].eq || [];
      $('#puestos', m).innerHTML = eqs.length ? eqs.map((it, i) => `<div class="row" style="gap:6px;align-items:center;margin-bottom:3px"><span class="${i === sel ? 'pill primary' : 'pill'}" data-sel="${i}" style="cursor:pointer">${esc(etiqueta(it.k))}${it.m ? ' · en la mano' : ''}</span><input type="range" min="40" max="300" step="5" value="${Math.round((it.s || 1) * 100)}" data-esc="${i}" title="Tamaño" style="width:90px;flex:0 0 90px"><span class="small muted" style="min-width:38px" data-escv="${i}">${Math.round((it.s || 1) * 100)}%</span><button type="button" class="ghost sm" data-del="${i}" title="Quitar">✕</button></div>`).join('') : '<span class="muted">Sin equipamiento.</span>';
      $$('[data-sel]', m).forEach(b => b.onclick = () => { sel = Number(b.dataset.sel); pintarLienzo(); pintarPuestos(); });
      $$('[data-esc]', m).forEach(r => {
        const i = Number(r.dataset.esc);
        r.oninput = () => { est[cur].eq[i].s = Number(r.value) / 100; const v = $('[data-escv="' + i + '"]', m); if (v) v.textContent = r.value + '%'; sel = i; pintarLienzo(); };
        r.onchange = () => { pintarMini(); };
      });
      $$('[data-del]', m).forEach(b => b.onclick = () => { est[cur].eq.splice(Number(b.dataset.del), 1); sel = null; todo(); });
    };
    const pintarChecks = () => { $('#ind-b', m).checked = !!est[cur].a2; $('#ind-p', m).checked = !!est[cur].b; };
    const todo = () => { pintarTabs(); pintarLienzo(); pintarMini(); pintarPuestos(); pintarChecks(); };

    // paleta de equipamiento
    $('#paleta', m).innerHTML = CLAVES_EQ.map(k => `<button type="button" class="sm" draggable="true" data-eq="${k}" title="${esc(etiqueta(k))}" style="display:flex;flex-direction:column;align-items:center;padding:4px 6px;gap:0">${Ilustra.dibujoGlifo(k)}<span class="small" style="font-size:.7rem">${esc(etiqueta(k))}</span></button>`).join('');
    const agregar = (k, x, y) => {
      const p = est[cur]; p.eq = p.eq || [];
      if (p.eq.length >= 8) return toast('Máximo 8 elementos por posición', 'warn');
      const it = { k, x: x ?? 100, y: y ?? 80, m: 0, s: 1 };
      if (x === undefined) { // al tocar: las cosas de mano van a la mano, las de escenario a un lugar razonable
        if (Ilustra.enMano(k)) it.m = 1;
        else if (k === 'barra_dominadas') { it.m = 1; }
        else { it.x = k === 'cajon' ? 150 : 100; it.y = k === 'soga' ? 110 : Ilustra.SUELO; }
      } else adherir(it);
      p.eq.push(it); sel = p.eq.length - 1; todo();
    };
    const manos = () => { const k = Ilustra.cinematica(est[cur]), T = (q) => [q[0] * Ilustra.SC + (est[cur].hx ?? 100), q[1] * Ilustra.SC + (est[cur].hy ?? 78)]; return [T(k.A1.mano), T(k.A2.mano)]; };
    function adherir(it) {
      if (!Ilustra.enMano(it.k) && it.k !== 'barra_dominadas') return;
      const [m1, m2] = manos();
      const d1 = Math.hypot(it.x - m1[0], it.y - m1[1]), d2 = Math.hypot(it.x - m2[0], it.y - m2[1]);
      if (Math.min(d1, d2) < 14) it.m = d1 <= d2 ? 1 : 2;
    }
    $$('[data-eq]', m).forEach(b => {
      b.onclick = () => agregar(b.dataset.eq);
      b.ondragstart = (ev) => { ev.dataTransfer.setData('text/plain', b.dataset.eq); ev.dataTransfer.effectAllowed = 'copy'; };
    });
    const aSvg = (ev) => { const s = $('svg', lienzo), r = s.getBoundingClientRect(); const esc2 = Math.min(r.width / 200, r.height / 160); const ox = r.left + (r.width - 200 * esc2) / 2, oy = r.top + (r.height - 160 * esc2) / 2; return [(ev.clientX - ox) / esc2, (ev.clientY - oy) / esc2]; };
    lienzo.addEventListener('dragover', (ev) => { ev.preventDefault(); });
    lienzo.addEventListener('drop', (ev) => { ev.preventDefault(); const k = ev.dataTransfer.getData('text/plain'); if (!CLAVES_EQ.includes(k)) return; const [x, y] = aSvg(ev); agregar(k, Math.round(x), Math.round(y)); });

    // arrastre de articulaciones y de equipamiento
    let arr = null;
    const ang = (de, a) => Math.round(Math.atan2(a[1] - de[1], a[0] - de[0]) * 180 / Math.PI);
    lienzo.addEventListener('pointerdown', (ev) => {
      const h = ev.target.closest('[data-h]'), it = ev.target.closest('[data-it]');
      if (!h && !it) { if (sel !== null) { sel = null; pintarLienzo(); pintarPuestos(); } return; }
      clearInterval(anim);
      arr = h ? { tipo: 'h', n: h.dataset.h } : { tipo: 'it', i: Number(it.dataset.it) };
      if (it && !h) { sel = arr.i; pintarPuestos(); }
      lienzo.setPointerCapture(ev.pointerId); ev.preventDefault();
    });
    lienzo.addEventListener('pointermove', (ev) => {
      if (!arr) return;
      const P = aSvg(ev), p = est[cur], SC = Ilustra.SC, hip = [p.hx ?? 100, p.hy ?? 78];
      const k = Ilustra.cinematica(p), T = (q) => [q[0] * SC + hip[0], q[1] * SC + hip[1]];
      if (arr.tipo === 'it') { const x = p.eq[arr.i]; x.x = Math.round(Math.max(0, Math.min(200, P[0]))); x.y = Math.round(Math.max(0, Math.min(160, P[1]))); x.m = 0; }
      else switch (arr.n) {
        case 'hip': p.hx = Math.round(Math.max(10, Math.min(190, P[0])) * 10) / 10; p.hy = Math.round(Math.max(10, Math.min(152, P[1])) * 10) / 10; break;
        case 'sh': p.t = ang(hip, P); break;
        case 'el1': p.a[0] = ang(T(k.sh), P); break;
        case 'mu1': p.a[1] = ang(T(k.A1.el), P); break;
        case 'el2': p.a2[0] = ang(T(k.sh), P); break;
        case 'mu2': p.a2[1] = ang(T(k.A2.el), P); break;
        case 'kn1': p.l[0] = ang(hip, P); break;
        case 'an1': p.l[1] = ang(T(k.L1.ro), P); break;
        case 'kn2': p.b[0] = ang(hip, P); break;
        case 'an2': p.b[1] = ang(T(k.L2.ro), P); break;
      }
      pintarLienzo();
    });
    const soltar = (ev) => {
      if (!arr) return;
      if (arr.tipo === 'it') adherir(est[cur].eq[arr.i]);
      arr = null; try { lienzo.releasePointerCapture(ev.pointerId); } catch (_) {}
      pintarLienzo(); pintarMini(); pintarPuestos();
    };
    lienzo.addEventListener('pointerup', soltar); lienzo.addEventListener('pointercancel', soltar);

    $('#ind-b', m).onchange = (e) => { const p = est[cur]; p.a2 = e.target.checked ? clonar(p.a) : null; todo(); };
    $('#ind-p', m).onchange = (e) => { const p = est[cur]; p.b = e.target.checked ? clonar(p.l) : null; todo(); };
    $('#suelo', m).onclick = () => { Ilustra.apoyarSuelo(est[cur]); todo(); };
    $('#cp-de', m).value = '0';
    $('#cp-ok', m).onclick = () => {
      const de = Number($('#cp-de', m).value), a = $('#cp-a', m).value, que = $('#cp-que', m).value;
      const dest = a === 'r' ? [0, 1, 2].filter(i => i !== de) : a === '12' ? [1, 2] : [Number(a)];
      const dst = dest.filter(i => i !== de);
      if (!dst.length) return toast('Elegí una posición de destino distinta de la de origen', 'warn');
      const src = est[de];
      for (const i of dst) {
        if (que === 'todo') est[i] = clonar(src);
        else if (que === 'cuerpo') { const eqs = est[i].eq; est[i] = clonar(src); est[i].eq = eqs || []; }
        else est[i].eq = clonar(src.eq || []);
      }
      sel = null; todo(); toast('Posición ' + (de + 1) + ' copiada a la ' + dst.map(i => i + 1).join(' y a la ') + ' · ' + (que === 'todo' ? 'todo' : que === 'cuerpo' ? 'solo el cuerpo' : 'solo el equipamiento'));
    };
    $('#aplicar-base', m).onclick = async () => {
      if (!(await confirmar('Se reemplazan las 3 posiciones por la figura base elegida. ¿Seguir?', 'Reemplazar'))) return;
      est = Ilustra.plantilla($('#base', m).value); sel = null; todo();
    };
    $('#play', m).onclick = () => {
      clearInterval(anim); const sec = [0, 1, 2, 1, 0, 1, 2, 1, 0]; let n = 0;
      anim = setInterval(() => { if (n >= sec.length) { clearInterval(anim); cur = 0; todo(); return; } cur = sec[n++]; lienzo.innerHTML = Ilustra.pose2svg(est[cur], { color }); $$('[data-p]', m).forEach(b => b.classList.toggle('primary', Number(b.dataset.p) === cur)); }, 450);
    };
    $('#ok', m).onclick = () => {
      clearInterval(anim);
      terminado = true;
      const limpias = est.map(p => ({ t: p.t, a: p.a, a2: p.a2 || null, l: p.l, b: p.b || null, hx: p.hx, hy: p.hy, ...(p.ht != null ? { ht: p.ht } : {}), eq: (p.eq || []).map(x => ({ k: x.k, x: x.x, y: x.y, m: x.m || 0, s: x.s || 1 })) }));
      const imgs = limpias.map(p => Ilustra.aDataUrl(Ilustra.pose2svg(p, { color })));
      resolve({ poses: { v: 1, poses: limpias }, imgs });
      m.close();
    };
    todo();
  });
}
