'use strict';
// ---------- Ilustraciones de ejercicios: figura de palitos (vista lateral) en 3 posiciones ----------
// Cada ejercicio tiene un "tipo de movimiento" (patrón). De cada patrón se dibujan la posición inicial, la media y la final.
// Los ángulos son absolutos en pantalla: 0 = derecha, 90 = abajo, -90 = arriba, 180 = izquierda. La figura mira a la derecha.
// Una cadena 't+30' es un ángulo relativo al tronco. El apoyo en el piso se calcula solo (el punto más bajo toca el suelo).
(function () {
  const LG = { tr: 38, ua: 22, fa: 20, th: 26, sh: 26, ft: 9, hd: 7.5, nk: 5 };
  const rad = (d) => d * Math.PI / 180;
  const dir = (d) => [Math.cos(rad(d)), Math.sin(rad(d))];
  const add = (p, d, len) => [p[0] + d[0] * len, p[1] + d[1] * len];

  const ST = { t: -90, a: [90, 90], l: [90, 90] };
  const P = (o) => Object.assign({}, ST, o);

  // Cada patrón: 3 poses. Campos: t tronco, a [brazo, antebrazo], a2 brazo trasero, l [muslo, pierna], b pierna trasera,
  // air = altura en el aire, box = apoyo elevado ('pie' | 'manos'), esc = elementos del escenario, foco = zona que trabaja.
  const PAT = {
    sentadilla: { foco: 'piernas', p: [P({ a: [0, 0] }), P({ t: -68, a: [0, 0], l: [40, 100] }), P({ t: -58, a: [0, 0], l: [3, 112] })] },
    zancada: { foco: 'piernas', p: [
      P({ l: [80, 92], b: [100, 96] }),
      P({ l: [55, 92], b: [112, 135] }),
      P({ l: [8, 90], b: [100, 168], f2: 60 })] },
    bisagra: { foco: 'piernas', p: [P({}), P({ t: -52, l: [82, 98] }), P({ t: -14, l: [76, 100], a: [90, 92] })] },
    puente: { foco: 'piernas', p: [
      P({ t: 180, a: [4, 4], l: [-62, 100] }),
      P({ t: 172, a: [4, 4], l: [-45, 100] }),
      P({ t: 150, a: [6, 6], l: [-22, 100] })] },
    subida: { foco: 'piernas', esc: 'cajon', p: [
      P({ l: [80, 92], b: [95, 95] }),
      P({ l: [-10, 95], b: [98, 100], sobre: 1 }),
      P({ l: [60, 100], b: [-30, 60], sobre: 1, air: 20 })] },
    salto: { foco: 'piernas', p: [
      P({ t: -62, a: [60, 60], l: [40, 100] }),
      P({ t: -92, a: [-45, -60], l: [90, 96], air: 22 }),
      P({ t: -62, a: [30, 30], l: [38, 100] })] },
    saltar: { foco: 'full', esc: 'soga', p: [
      P({ a: [75, 20] }),
      P({ a: [75, 20], l: [90, 96], air: 8 }),
      P({ a: [75, 20], l: [86, 100] })] },
    talones: { foco: 'piernas', p: [
      P({ t: -84, a: [60, -30], a2: [130, 40], l: [90, 150], b: [90, 90] }),
      P({ t: -84, a: [130, 40], a2: [60, -30], l: [90, 90], b: [90, 160] }),
      P({ t: -84, a: [60, -30], a2: [130, 40], l: [90, 168], b: [90, 90] })] },
    sprint: { foco: 'full', p: [
      P({ t: -78, a: [35, -45], a2: [140, 100], l: [-5, 85], b: [125, 170] }),
      P({ t: -78, a: [140, 100], a2: [35, -45], l: [105, 135], b: [60, 100], air: 4 }),
      P({ t: -78, a: [140, 100], a2: [35, -45], l: [125, 170], b: [-5, 85] })] },
    lateral: { foco: 'piernas', flecha: true, p: [
      P({ t: -70, a: [35, 35], l: [50, 100] }),
      P({ t: -64, a: [30, 30], l: [30, 95], b: [125, 115] }),
      P({ t: -62, a: [30, 30], l: [20, 100], b: [150, 150] })] },
    escalador: { foco: 'core', p: [
      P({ t: -28, a: [90, 90], l: [152, 152] }),
      P({ t: -28, a: [90, 90], l: [152, 152], b: [32, 125] }),
      P({ t: -28, a: [90, 90], l: [152, 152], b: [-8, 100] })] },
    burpee: { foco: 'full', p: [
      P({}),
      P({ t: -28, a: [90, 90], l: [152, 152] }),
      P({ t: -96, a: [-70, -75], l: [90, 92], air: 20 })] },
    swing: { foco: 'full', p: [
      P({ t: -38, a: [105, 100], l: [72, 100] }),
      P({ t: -78, a: [40, 30], l: [86, 95] }),
      P({ t: -92, a: [-8, -8], l: [90, 92] })] },
    slam: { foco: 'full', p: [
      P({ a: [-90, -90] }),
      P({ t: -80, a: [-25, -25], l: [78, 98] }),
      P({ t: -45, a: [55, 55], l: [45, 100] })] },
    plancha: { foco: 'core', esc: 'mat', p: [
      P({ t: -8, a: [90, 0], l: [90, 180], f2: 0 }),
      P({ t: -14, a: [90, 0], l: [166, 166] }),
      P({ t: -14, a: [90, 0], l: [166, 166], b: [150, 150] })] },
    plancha_lat: { foco: 'core', esc: 'mat', p: [
      P({ t: -14, a: [90, 0], a2: [-90, -90], l: [150, 180] }),
      P({ t: -14, a: [90, 0], a2: [-90, -90], l: [166, 166] }),
      P({ t: -14, a: [90, 0], a2: [-50, -20], l: [166, 166], b: [150, 150] })] },
    abdominal: { foco: 'core', esc: 'mat', p: [
      P({ t: 180, a: ['t-70', 't+30'], l: [-62, 100] }),
      P({ t: 200, a: ['t-70', 't+30'], l: [-62, 100] }),
      P({ t: 235, a: ['t-80', 't+30'], l: [-62, 100] })] },
    elev_piernas: { foco: 'core', esc: 'mat', p: [
      P({ t: 180, a: [4, 4], l: [-4, -4] }),
      P({ t: 180, a: [4, 4], l: [-45, -45] }),
      P({ t: 180, a: [4, 4], l: [-88, -88] })] },
    bicho: { foco: 'core', esc: 'mat', p: [
      P({ t: 180, a: [-90, -90], l: [-90, 0] }),
      P({ t: 180, a: [-90, -90], a2: [180, 180], l: [-90, 0], b: [-10, -10] }),
      P({ t: 180, a: [-90, -90], a2: [180, 180], l: [-90, 0], b: [-5, -5] })] },
    bird: { foco: 'core', esc: 'mat', p: [
      P({ t: -25, a: [90, 90], l: [90, 180] }),
      P({ t: -20, a: [-5, -5], a2: [90, 90], l: [90, 180] }),
      P({ t: -12, a: [-5, -5], a2: [90, 90], l: [90, 180], b: [175, 175] })] },
    rueda: { foco: 'core', esc: 'mat', p: [
      P({ t: -85, a: [90, 90], l: [90, 180] }),
      P({ t: -45, a: [20, 20], l: [90, 180] }),
      P({ t: -10, a: [-5, -5], l: [90, 180] })] },
    ruso: { foco: 'core', esc: 'mat', p: [
      P({ t: -112, a: [40, 40], l: [-30, 20] }),
      P({ t: -112, a: [0, 0], l: [-30, 20] }),
      P({ t: -112, a: [150, 150], l: [-30, 20] })] },
    remo_inc: { foco: 'espalda', p: [
      P({ t: -35, a: [92, 92], l: [78, 100] }),
      P({ t: -35, a: [125, 95], l: [78, 100] }),
      P({ t: -35, a: [165, 100], l: [78, 100] })] },
    tiron: { foco: 'espalda', arriba: true, p: [
      P({ a: [-76, -72] }),
      P({ a: [20, -115] }),
      P({ a: [90, -92] })] },
    dominada: { foco: 'espalda', esc: 'barra', p: [
      P({ a: [-90, -90], l: [90, 98], air: 40 }),
      P({ t: -95, a: [-35, -105], l: [90, 100], air: 40 }),
      P({ t: -98, a: [88, -92], l: [90, 104], air: 40 })] },
    remo_inv: { foco: 'espalda', esc: 'barra', p: [
      P({ t: 200, a: [-90, -90], l: [20, 20], b: [20, 20] }),
      P({ t: 197, a: [-40, -110], l: [17, 17], b: [17, 17] }),
      P({ t: 192, a: [60, -100], l: [12, 12], b: [12, 12] })] },
    pajaro: { foco: 'espalda', p: [
      P({ t: -35, a: [90, 90], l: [80, 100] }),
      P({ t: -35, a: [68, 72], l: [80, 100] }),
      P({ t: -35, a: [34, 38], l: [80, 100] })] },
    superman: { foco: 'espalda', esc: 'mat', p: [
      P({ t: 0, a: [0, 0], l: [180, 180] }),
      P({ t: -5, a: [-10, -10], l: [190, 190] }),
      P({ t: -12, a: [-25, -25], l: [205, 205] })] },
    pullover: { foco: 'espalda', esc: 'mat', p: [
      P({ t: 180, a: [-90, -90], l: [-62, 100] }),
      P({ t: 180, a: [-140, -140], l: [-62, 100] }),
      P({ t: 180, a: [175, 175], l: [-62, 100] })] },
    remo_menton: { foco: 'espalda', p: [
      P({ a: [92, 92] }),
      P({ a: [60, 140] }),
      P({ a: [-20, 120] })] },
    flexion: { foco: 'pecho', esc: 'mat', p: [
      P({ t: -28, a: [90, 90], l: [152, 152] }),
      P({ t: -17, a: [150, 52], l: [163, 163] }),
      P({ t: -7, a: [172, 25], l: [173, 173] })] },
    press_piso: { foco: 'pecho', esc: 'mat', p: [
      P({ t: 180, a: [-90, -90], l: [-62, 100] }),
      P({ t: 180, a: [-75, -100], l: [-62, 100] }),
      P({ t: 180, a: [88, -95], l: [-62, 100] })].reverse() },
    apertura: { foco: 'pecho', esc: 'mat', p: [
      P({ t: 180, a: [170, 170], l: [-62, 100] }),
      P({ t: 180, a: [-140, -130], l: [-62, 100] }),
      P({ t: 180, a: [-90, -90], l: [-62, 100] })] },
    empuje: { foco: 'pecho', banda: true, p: [
      P({ a: [110, -30] }),
      P({ a: [60, -10] }),
      P({ a: [0, 0] })] },
    fondos: { foco: 'brazos', esc: 'banco', p: [
      P({ t: -92, a: [112, 100], l: [5, 8] }),
      P({ t: -92, a: [150, 70], l: [5, 8] }),
      P({ t: -92, a: [168, 55], l: [5, 8] })] },
    curl: { foco: 'brazos', p: [
      P({ a: [92, 92] }),
      P({ a: [92, 5] }),
      P({ a: [92, -78] })] },
    ext_tri: { foco: 'brazos', p: [
      P({ a: [-84, 172] }),
      P({ a: [-84, -140] }),
      P({ a: [-90, -92] })] },
    patada_tri: { foco: 'brazos', p: [
      P({ t: -35, a: [165, 90], l: [78, 100] }),
      P({ t: -35, a: [165, 130], l: [78, 100] }),
      P({ t: -35, a: [165, 172], l: [78, 100] })] },
    pica: { foco: 'hombros', esc: 'mat', p: [
      P({ t: 52, a: [90, 90], l: [128, 128] }),
      P({ t: 60, a: [118, 60], l: [124, 124] }),
      P({ t: 68, a: [140, 38], l: [120, 120] })] },
    press_vert: { foco: 'hombros', p: [
      P({ a: [102, -66] }),
      P({ a: [-50, -72] }),
      P({ a: [-78, -80] })] },
    elev_lat: { foco: 'hombros', p: [
      P({ a: [92, 92], a2: [92, 92] }),
      P({ a: [50, 50], a2: [50, 50] }),
      P({ a: [4, 4], a2: [4, 4] })] },
    elev_front: { foco: 'hombros', p: [
      P({ a: [92, 92] }),
      P({ a: [45, 45] }),
      P({ a: [-8, -8] })] },
  };

  const COL = { fig: 'var(--txt, #eee)', back: 'var(--muted, #98a2b3)', foco: 'var(--brand, #ff6b35)', suelo: 'var(--line, #2b3240)', prop: 'var(--azul, #4da3ff)' };
  const ZONA_FOCO = { piernas: ['l'], espalda: ['a', 't'], pecho: ['a', 't'], brazos: ['a'], hombros: ['a'], core: ['t'], full: ['l', 'a', 't'] };

  function resolver(v, t) { return typeof v === 'string' ? t + Number(v.slice(1)) : v; }

  function cinematica(pose) {
    const t = pose.t, hip = [0, 0];
    const sh = add(hip, dir(t), LG.tr);
    const cuello = add(sh, dir(pose.ht != null ? pose.ht : t), LG.nk);
    const cab = add(cuello, dir(pose.ht != null ? pose.ht : t), LG.hd);
    const arm = (a) => {
      const u = resolver(a[0], t), f = resolver(a[1], t);
      const el = add(sh, dir(u), LG.ua), mu = add(el, dir(f), LG.fa), mano = add(mu, dir(f), 3);
      return { el, mu, mano, u, f };
    };
    const leg = (l, f2) => {
      const ro = add(hip, dir(l[0]), LG.th), to = add(ro, dir(l[1]), LG.sh);
      const pie = f2 != null ? f2 : l[1] - 90;
      const dedo = add(to, dir(pie), LG.ft);
      return { ro, to, dedo };
    };
    const A1 = arm(pose.a), A2 = arm(pose.a2 || pose.a);
    const L1 = leg(pose.l, pose.f2), L2 = leg(pose.b || pose.l, pose.b ? null : pose.f2);
    return { hip, sh, cuello, cab, A1, A2, L1, L2, t };
  }

  function puntos(k) {
    return [k.hip, k.sh, [k.cab[0], k.cab[1] + LG.hd], [k.cab[0], k.cab[1] - LG.hd], k.A1.el, k.A1.mu, k.A2.el, k.A2.mu, k.L1.ro, k.L1.to, k.L1.dedo, k.L2.ro, k.L2.to, k.L2.dedo];
  }

  const f1 = (n) => Math.round(n * 10) / 10;

  // ----- glifos del equipamiento
  function glifoMano(eq, pos, ang) {
    const [x, y] = pos;
    const c = COL.prop;
    switch (eq) {
      case 'mancuerna': return `<g stroke="${c}" stroke-width="3.2" stroke-linecap="round"><path d="M${f1(x - 5)} ${f1(y)}H${f1(x + 5)}"/><path d="M${f1(x - 5)} ${f1(y - 5)}V${f1(y + 5)}M${f1(x + 5)} ${f1(y - 5)}V${f1(y + 5)}" stroke-width="3.6"/></g>`;
      case 'pesa_rusa': return `<g fill="${c}" stroke="${c}"><circle cx="${f1(x)}" cy="${f1(y + 6)}" r="6.2"/><path d="M${f1(x - 4)} ${f1(y + 2)}Q${f1(x)} ${f1(y - 7)} ${f1(x + 4)} ${f1(y + 2)}" fill="none" stroke-width="2.4"/></g>`;
      case 'barra_discos': return `<g stroke="${c}" stroke-linecap="round"><path d="M${f1(x - 22)} ${f1(y)}H${f1(x + 22)}" stroke-width="2.4"/><path d="M${f1(x - 19)} ${f1(y - 8)}V${f1(y + 8)}M${f1(x + 19)} ${f1(y - 8)}V${f1(y + 8)}" stroke-width="4"/></g>`;
      case 'pelota': return `<circle cx="${f1(x + 2)}" cy="${f1(y)}" r="7.5" fill="${c}" fill-opacity=".35" stroke="${c}" stroke-width="2"/>`;
      case 'bolso': return `<rect x="${f1(x - 8)}" y="${f1(y - 3)}" width="16" height="10" rx="4" fill="${c}" fill-opacity=".35" stroke="${c}" stroke-width="2"/>`;
      case 'rueda_abdominal': return `<g stroke="${c}" stroke-width="2.4" fill="${c}" fill-opacity=".25"><circle cx="${f1(x)}" cy="${f1(y + 3)}" r="8"/></g>`;
      default: return '';
    }
  }

  const CONOS = (G) => [30, 50, 150, 170].map(x => `<path d="M${x - 4} ${G}L${x} ${G - 10}L${x + 4} ${G}Z" fill="var(--naranja, #ff8a3d)"/>`).join('');

  function tag(txt) { return `<text x="6" y="12" font-size="8.5" fill="${COL.back}" font-family="system-ui,sans-serif">${txt}</text>`; }
  const KNOWN = new Set(['mancuerna', 'pesa_rusa', 'barra_discos', 'pelota', 'bolso', 'rueda_abdominal', 'colchoneta', 'barra_dominadas', 'banda_rtx', 'conos', 'ninguno', '']);

  // ----- dibujo de una pose
  function svg(patron, idx, equipo, nombreEquipo) {
    const def = PAT[patron] || PAT.sentadilla;
    const pose = def.p[Math.max(0, Math.min(2, idx))];
    const k = cinematica(pose);
    const pts = puntos(k);
    const maxY = Math.max(...pts.map(p => p[1])), minY = Math.min(...pts.map(p => p[1])), minX = Math.min(...pts.map(p => p[0])), maxX = Math.max(...pts.map(p => p[0]));
    const esMat = def.esc === 'mat' || equipo === 'colchoneta';
    const G = esMat ? 142 : 146;
    const air0 = pose.air || 0;
    // escala para que la figura (con su salto o colgada) entre siempre en el cuadro
    const sc = Math.min(1.32, (G - 12 - air0) / Math.max(1, maxY - minY), 172 / Math.max(1, maxX - minX));
    const air = air0 * (sc / 1.32 > 0.7 ? 1 : 0.8);
    const dx = 100 - sc * (minX + maxX) / 2 + (def.esc === 'banco' ? 6 : 0);
    const dy = G - sc * maxY - air;
    const T = (p) => [p[0] * sc + dx, p[1] * sc + dy];
    const hip = T(k.hip), sh = T(k.sh), cab = T(k.cab);
    const q = (a) => ({ el: T(a.el), mu: T(a.mu), mano: T(a.mano) });
    const q1 = q(k.A1), q2 = q(k.A2);
    const l1 = { ro: T(k.L1.ro), to: T(k.L1.to), dedo: T(k.L1.dedo) }, l2 = { ro: T(k.L2.ro), to: T(k.L2.to), dedo: T(k.L2.dedo) };
    const foco = ZONA_FOCO[def.foco] || [];
    const cF = (g) => (foco.includes(g) ? COL.foco : COL.fig);
    const ln = (pts2, color, w = 4.2) => `<polyline points="${pts2.map(p => f1(p[0]) + ',' + f1(p[1])).join(' ')}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
    let s = '';
    // suelo y escenario
    s += `<line x1="8" y1="${G}" x2="192" y2="${G}" stroke="${COL.suelo}" stroke-width="2"/>`;
    if (esMat) s += `<rect x="14" y="${G}" width="172" height="4" rx="2" fill="${COL.prop}" fill-opacity=".35"/>`;
    if (equipo === 'conos') s += CONOS(G);
    if (def.esc === 'cajon') {
      if (pose.sobre) {
        const topY = l1.to[1] + 1;
        s += `<rect x="${f1(l1.to[0] - 14)}" y="${f1(topY)}" width="34" height="${f1(Math.max(4, G - topY))}" rx="3" fill="${COL.prop}" fill-opacity=".3" stroke="${COL.prop}" stroke-width="1.5"/>`;
      } else s += `<rect x="${f1(Math.max(l1.dedo[0], l2.dedo[0]) + 12)}" y="${G - 26}" width="34" height="26" rx="3" fill="${COL.prop}" fill-opacity=".3" stroke="${COL.prop}" stroke-width="1.5"/>`;
    }
    if (def.esc === 'banco') {
      const topY = q1.mu[1] + 2;
      s += `<rect x="${f1(q1.mu[0] - 14)}" y="${f1(topY)}" width="20" height="${f1(Math.max(4, G - topY))}" rx="3" fill="${COL.prop}" fill-opacity=".3" stroke="${COL.prop}" stroke-width="1.5"/>`;
    }
    if (def.esc === 'barra' || equipo === 'barra_dominadas') {
      const by = q1.mano[1] - 1, bx = q1.mano[0];
      s += `<g stroke="${COL.prop}" stroke-linecap="round"><path d="M${f1(bx - 34)} ${f1(by)}H${f1(bx + 34)}" stroke-width="3.4"/><path d="M${f1(bx - 34)} ${f1(by)}V${G}M${f1(bx + 34)} ${f1(by)}V${G}" stroke-width="2" stroke-opacity=".55"/></g>`;
    }
    if (def.esc === 'soga') {
      const h = q1.mano; s += `<path d="M${f1(h[0])} ${f1(h[1])}Q${f1(h[0] + 36)} ${f1(h[1] - 10 - (air ? 28 : 0))} ${f1(h[0] - 4)} ${G - 2}" fill="none" stroke="${COL.prop}" stroke-width="1.8" stroke-dasharray="3 2"/>`;
    }
    if (air) s += `<ellipse cx="${f1((l1.dedo[0] + l2.dedo[0]) / 2)}" cy="${G + 1}" rx="14" ry="2" fill="${COL.suelo}"/>`;
    if (def.flecha) s += `<path d="M44 150H156M148 146l8 4-8 4M52 146l-8 4 8 4" fill="none" stroke="${COL.back}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`;
    if (def.banda || equipo === 'banda_rtx') {
      const ax = def.arriba ? q1.mano[0] : 10, ay = def.arriba ? 10 : q1.mano[1] + 10;
      s += `<path d="M${ax} ${ay}L${f1(q1.mano[0])} ${f1(q1.mano[1])}" stroke="var(--naranja,#ff8a3d)" stroke-width="2.4" stroke-dasharray="${def.banda || def.arriba ? '5 3' : '0'}"/><circle cx="${ax}" cy="${ay}" r="3" fill="var(--naranja,#ff8a3d)"/>`;
    } else if (equipo && !KNOWN.has(equipo) && /trx|suspens|cinta/i.test(equipo + ' ' + (nombreEquipo || ''))) {
      s += `<g stroke="var(--naranja,#ff8a3d)" stroke-width="2"><path d="M${f1(q1.mano[0])} 8V${f1(q1.mano[1])}"/><path d="M${f1(q2.mano[0] + 3)} 8V${f1(q2.mano[1])}"/><path d="M${f1(q1.mano[0] - 8)} 8H${f1(q2.mano[0] + 11)}" stroke-width="3"/></g>`;
    }
    // miembros traseros (más tenues)
    s += ln([hip, l2.ro, l2.to, l2.dedo], COL.back, 3.6);
    s += ln([sh, q2.el, q2.mu], COL.back, 3.6);
    // tronco y cabeza
    s += ln([hip, sh], cF('t'), 5);
    s += `<circle cx="${f1(cab[0])}" cy="${f1(cab[1])}" r="${LG.hd}" fill="var(--bg, #0e1013)" stroke="${COL.fig}" stroke-width="2.6"/>`;
    // miembros delanteros
    s += ln([hip, l1.ro, l1.to, l1.dedo], cF('l'), 4.4);
    s += ln([sh, q1.el, q1.mu], cF('a'), 4.4);
    for (const p of [l1.ro, q1.el]) s += `<circle cx="${f1(p[0])}" cy="${f1(p[1])}" r="2.2" fill="var(--bg, #0e1013)" stroke="${COL.fig}" stroke-width="1.4"/>`;
    // equipamiento en las manos
    if (def.esc !== 'barra' && patron !== 'plancha' && !/^(plancha|escalador|bird|flexion|pica|superman)/.test(patron)) s += glifoMano(equipo, q1.mano, k.A1.f);
    else if (/^(flexion|pica)/.test(patron) && equipo === 'mancuerna') s += glifoMano(equipo, [q1.mano[0], q1.mano[1] - 3]);
    if (equipo && !KNOWN.has(equipo) && nombreEquipo) s += tag(String(nombreEquipo).slice(0, 26));
    return `<svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${patron}, posición ${idx + 1}" preserveAspectRatio="xMidYMid meet">${s}</svg>`;
  }

  const NOMBRES = ['Posición inicial', 'Posición media', 'Posición final'];
  // HTML con las 3 posiciones. fotos = [img1, img2, img3] (data URL) para reemplazar el dibujo.
  function tira(patron, equipo, fotos, nombreEquipo) {
    const f = fotos || [];
    return `<div class="posiciones">${[0, 1, 2].map(i => `<figure class="pos"><div class="pos-img">${f[i] ? `<img src="${f[i].replace(/"/g, '')}" alt="${NOMBRES[i]}">` : svg(patron, i, equipo, nombreEquipo)}</div><figcaption><span class="nro">${i + 1}</span> ${NOMBRES[i]}${f[i] ? '' : ' <span class="sub">ilustración</span>'}</figcaption></figure>`).join('')}</div>`;
  }

  const api = { svg, tira, PATRONES: Object.keys(PAT), NOMBRES };
  if (typeof window !== 'undefined') window.Ilustra = api;
  if (typeof module !== 'undefined') module.exports = api;
})();
