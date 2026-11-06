'use strict';
// ---------- Versión 10: editor de dibujo de un equipamiento ----------
// Se dibuja con formas simples (rectángulo, círculo, línea, arco y lápiz) en un cuadro de 60 x 40. Ese dibujo es el que aparece en
// la paleta de "Dibujar las 3 posiciones" y se puede achicar o agrandar en cada posición.

const COLORES_EQ = ['#4da3ff', '#ff8a3d', '#e5e7eb', '#8a93a3', '#3ecf8e', '#ffc233', '#f472b6', '#c084fc'];

function editarDibujoEquipo({ nombre, dibujo }) {
  return new Promise((resolve) => {
    let d = { agarre: 0, formas: [] };
    try { const x = typeof dibujo === 'string' ? JSON.parse(dibujo) : dibujo; if (x && Array.isArray(x.formas)) d = { agarre: x.agarre ? 1 : 0, formas: JSON.parse(JSON.stringify(x.formas)) }; } catch (_) {}
    let herr = 'r', color = COLORES_EQ[0], grosor = 2.5, relleno = false, sel = null, prev = null, arr = null, terminado = false;
    const pila = [];
    const guardarPila = () => { pila.push(JSON.stringify(d.formas)); if (pila.length > 40) pila.shift(); };
    const HERR = [['sel', '☝ Mover'], ['r', '▭ Rectángulo'], ['o', '◯ Círculo'], ['a', '◠ Arco'], ['l', '／ Línea'], ['p', '✎ Lápiz']];
    const m = modal('Dibujo de: ' + (nombre || 'equipamiento'), `
      <p class="small muted" style="margin:0 0 8px">Armalo con formas simples. Después lo vas a ver en la paleta de <b>Dibujar las 3 posiciones</b>, donde se puede arrastrar y cambiar de tamaño.</p>
      <div class="row" id="herr" style="gap:6px;flex-wrap:wrap;margin-bottom:8px"></div>
      <div class="grid2" style="gap:12px;align-items:start">
        <div><div id="lienzo-eq" style="touch-action:none;user-select:none;background:var(--bg2,#14181f);border:1px solid var(--line,#2b3240);border-radius:10px;padding:6px"></div></div>
        <div class="stack">
          <div class="field"><label>Color</label><div class="row" id="cols" style="gap:6px;flex-wrap:wrap"></div></div>
          <div class="field"><label>Grosor del trazo</label><select id="gro"><option value="1.5">Fino</option><option value="2.5" selected>Medio</option><option value="4">Grueso</option></select></div>
          <label class="small row" style="gap:6px;margin:0"><input type="checkbox" id="rel"> Relleno suave</label>
          <label class="small row" style="gap:6px;margin:0"><input type="checkbox" id="agarre" ${d.agarre ? 'checked' : ''}> Se agarra con la mano (acompaña a la mano)</label>
          <div class="row" style="gap:6px;flex-wrap:wrap"><button type="button" class="sm" id="und">↶ Deshacer</button><button type="button" class="sm" id="dup">Duplicar</button><button type="button" class="sm" id="del">Borrar seleccionado</button><button type="button" class="sm ghost" id="clr">Borrar todo</button></div>
          <div class="field"><label>Así se verá</label><div id="vista-eq"></div></div>
        </div></div>
      <div class="err" id="eq-err"></div>
      <div class="row" style="justify-content:flex-end;margin-top:10px"><button type="button" data-close>Cancelar</button><button type="button" class="primary" id="ok">Guardar dibujo</button></div>`, { wide: true, onClose: () => { if (!terminado) resolve(null); } });

    const lienzo = $('#lienzo-eq', m);
    const f1 = (n) => Math.round(n * 10) / 10;
    function caja(f) {
      switch (f.t) {
        case 'r': return [f.x, f.y, f.x + f.w, f.y + f.h];
        case 'o': return [f.x - f.rx, f.y - f.ry, f.x + f.rx, f.y + f.ry];
        case 'a': return [f.x - f.rx, f.y - f.ry, f.x + f.rx, f.y];
        case 'l': return [Math.min(f.x1, f.x2), Math.min(f.y1, f.y2), Math.max(f.x1, f.x2), Math.max(f.y1, f.y2)];
        default: { const xs = f.pts.map(q => q[0]), ys = f.pts.map(q => q[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; }
      }
    }
    function mover(f, dx, dy) {
      if (f.t === 'l') { f.x1 += dx; f.x2 += dx; f.y1 += dy; f.y2 += dy; }
      else if (f.t === 'p') f.pts = f.pts.map(q => [q[0] + dx, q[1] + dy]);
      else { f.x += dx; f.y += dy; }
    }
    function pintar() {
      let s = '<svg viewBox="0 0 60 40" width="100%" style="display:block;max-width:480px"><g stroke="var(--line,#2b3240)" stroke-width=".15">';
      for (let x = 5; x < 60; x += 5) s += `<path d="M${x} 0V40"/>`;
      for (let y = 5; y < 40; y += 5) s += `<path d="M0 ${y}H60"/>`;
      s += '</g><path d="M30 0V40M0 20H60" stroke="var(--line,#2b3240)" stroke-width=".3" stroke-dasharray="1 1"/>';
      d.formas.forEach((f, i) => {
        const [a, b, c, e] = caja(f);
        s += `<g data-i="${i}" style="cursor:${herr === 'sel' ? 'move' : 'crosshair'}">${Ilustra.formasSvg({ formas: [f] })}<rect x="${f1(a - 1)}" y="${f1(b - 1)}" width="${f1(c - a + 2)}" height="${f1(e - b + 2)}" fill="transparent"/></g>`;
        if (i === sel) s += `<rect x="${f1(a - 1)}" y="${f1(b - 1)}" width="${f1(c - a + 2)}" height="${f1(e - b + 2)}" fill="none" stroke="#ff8a3d" stroke-width=".4" stroke-dasharray="1.2 .8" pointer-events="none"/>`;
      });
      if (prev) s += `<g opacity=".8" pointer-events="none">${Ilustra.formasSvg({ formas: [prev] })}</g>`;
      lienzo.innerHTML = s + '</svg>';
      $('#vista-eq', m).innerHTML = d.formas.length ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 40" width="120" height="80" style="background:var(--bg2,#14181f);border-radius:8px">${Ilustra.glifoCustom({ formas: d.formas }, 30, 20)}</svg>` : '<span class="small muted">Todavía no dibujaste nada.</span>';
    }
    function pintarBarra() {
      $('#herr', m).innerHTML = HERR.map(([k, t]) => `<button type="button" class="sm ${herr === k ? 'primary' : ''}" data-h="${k}">${t}</button>`).join('');
      $$('[data-h]', m).forEach(b => b.onclick = () => { herr = b.dataset.h; prev = null; pintarBarra(); pintar(); });
      $('#cols', m).innerHTML = COLORES_EQ.map(c => `<button type="button" data-c="${c}" title="${c}" style="width:26px;height:26px;padding:0;border-radius:50%;background:${c};border:2px solid ${c === color ? '#fff' : 'transparent'}"></button>`).join('');
      $$('[data-c]', m).forEach(b => b.onclick = () => { color = b.dataset.c; if (sel !== null && d.formas[sel]) { guardarPila(); d.formas[sel].c = color; } pintarBarra(); pintar(); });
    }
    const aSvg = (ev) => { const s = $('svg', lienzo), r = s.getBoundingClientRect(); return [Math.max(0, Math.min(60, Math.round((ev.clientX - r.left) / r.width * 60 * 2) / 2)), Math.max(0, Math.min(40, Math.round((ev.clientY - r.top) / r.height * 40 * 2) / 2))]; };
    const construir = (a, b) => {
      const base = { c: color, g: grosor, f: relleno ? 1 : 0 };
      const x0 = Math.min(a[0], b[0]), y0 = Math.min(a[1], b[1]), w = Math.abs(a[0] - b[0]), h = Math.abs(a[1] - b[1]);
      switch (herr) {
        case 'r': return w >= 1 && h >= 1 ? { t: 'r', x: x0, y: y0, w, h, ...base } : null;
        case 'o': return w >= 1 && h >= 1 ? { t: 'o', x: f1(x0 + w / 2), y: f1(y0 + h / 2), rx: f1(w / 2), ry: f1(h / 2), ...base } : null;
        case 'a': return w >= 1 && h >= 1 ? { t: 'a', x: f1(x0 + w / 2), y: y0 + h, rx: f1(w / 2), ry: h, ...base } : null;
        case 'l': return w + h >= 1 ? { t: 'l', x1: a[0], y1: a[1], x2: b[0], y2: b[1], c: color, g: grosor } : null;
        default: return null;
      }
    };
    lienzo.addEventListener('pointerdown', (ev) => {
      const P = aSvg(ev), g = ev.target.closest('[data-i]');
      if (herr === 'sel') {
        sel = g ? Number(g.dataset.i) : null;
        if (sel !== null) { guardarPila(); arr = { tipo: 'mover', ult: P }; const f = d.formas[sel]; color = f.c; grosor = f.g || 2.5; $('#gro', m).value = String(grosor); $('#rel', m).checked = !!f.f; pintarBarra(); }
        pintar(); if (arr) lienzo.setPointerCapture(ev.pointerId); ev.preventDefault(); return;
      }
      if (d.formas.length >= 40) { toast('Máximo 40 formas por dibujo', 'warn'); return; }
      arr = herr === 'p' ? { tipo: 'p', pts: [P] } : { tipo: 'f', ini: P };
      lienzo.setPointerCapture(ev.pointerId); ev.preventDefault();
    });
    lienzo.addEventListener('pointermove', (ev) => {
      if (!arr) return;
      const P = aSvg(ev);
      if (arr.tipo === 'mover') { const dx = P[0] - arr.ult[0], dy = P[1] - arr.ult[1]; if (dx || dy) { mover(d.formas[sel], dx, dy); arr.ult = P; pintar(); } }
      else if (arr.tipo === 'p') { const u = arr.pts[arr.pts.length - 1]; if (Math.hypot(P[0] - u[0], P[1] - u[1]) >= 0.8) { arr.pts.push(P); prev = { t: 'p', pts: arr.pts.slice(), c: color, g: grosor }; pintar(); } }
      else { prev = construir(arr.ini, P); pintar(); }
    });
    const soltar = (ev) => {
      if (!arr) return;
      try { lienzo.releasePointerCapture(ev.pointerId); } catch (_) {}
      if (arr.tipo === 'p' && arr.pts.length >= 2) { guardarPila(); let pts = arr.pts; while (pts.length > 80) pts = pts.filter((_, i) => i % 2 === 0 || i === pts.length - 1); d.formas.push({ t: 'p', pts, c: color, g: grosor }); sel = d.formas.length - 1; }
      else if (arr.tipo === 'f' && prev) { guardarPila(); d.formas.push(prev); sel = d.formas.length - 1; }
      prev = null; arr = null; pintar();
    };
    lienzo.addEventListener('pointerup', soltar); lienzo.addEventListener('pointercancel', soltar);
    $('#gro', m).onchange = (e) => { grosor = Number(e.target.value); if (sel !== null && d.formas[sel]) { guardarPila(); d.formas[sel].g = grosor; pintar(); } };
    $('#rel', m).onchange = (e) => { relleno = e.target.checked; if (sel !== null && d.formas[sel] && d.formas[sel].t !== 'l' && d.formas[sel].t !== 'p') { guardarPila(); d.formas[sel].f = relleno ? 1 : 0; pintar(); } };
    $('#und', m).onclick = () => { if (!pila.length) return; d.formas = JSON.parse(pila.pop()); sel = null; pintar(); };
    $('#del', m).onclick = () => { if (sel === null) return toast('Elegí una forma con “Mover”', 'warn'); guardarPila(); d.formas.splice(sel, 1); sel = null; pintar(); };
    $('#dup', m).onclick = () => { if (sel === null) return toast('Elegí una forma con “Mover”', 'warn'); guardarPila(); const f = JSON.parse(JSON.stringify(d.formas[sel])); mover(f, 2, 2); d.formas.push(f); sel = d.formas.length - 1; pintar(); };
    $('#clr', m).onclick = async () => { if (!d.formas.length) return; if (!(await confirmar('Se borra todo el dibujo. ¿Seguir?', 'Borrar todo'))) return; guardarPila(); d.formas = []; sel = null; pintar(); };
    $('#ok', m).onclick = () => {
      if (!d.formas.length) { $('#eq-err', m).textContent = 'Dibujá al menos una forma.'; return; }
      terminado = true; resolve({ v: 1, agarre: $('#agarre', m).checked ? 1 : 0, formas: d.formas }); m.close();
    };
    pintarBarra(); pintar();
  });
}
