'use strict';
// Versión 14: equipamiento inteligente. Wikipedia y Gemini se simulan con un servidor local (no se gasta cupo ni se necesita internet).
const { spawn } = require('node:child_process');
const http = require('node:http');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const assert = require('node:assert/strict');
let ok = 0; const paso = (n) => { ok++; console.log('  ✓ ' + n); };
const PATRONES = ['empujar', 'tirar', 'sentadilla', 'bisagra_cadera', 'bisagra_rodilla', 'rotacion', 'locomocion'], CAPS = ['fuerza', 'core', 'movilidad', 'equilibrio'], ENS = ['aerobico', 'anaerobico'];
const ejercicios = (pref, sinCap) => PATRONES.flatMap((p, i) => [0, 1, 2, 3, 4].map(n => ({ patron: p, nombre: `${pref} ${p} ${n}`, prog2: 'más difícil', prog3: 'la más difícil', capacidades: [CAPS[(i + n) % 4]].filter(c => c !== sinCap), energias: [ENS[n % 2]], intensidad: 'moderada' })));
const DIB = { agarre: 1, formas: [{ t: 'r', x: 20, y: 15, w: 20, h: 10, c: '#4da3ff', g: 2.5, f: 1 }, { t: 'l', x1: 10, y1: 30, x2: 50, y2: 30, c: '#ff8a3d', g: 2 }, { t: 'o', x: 30, y: 20, rx: 5, ry: 5, c: '#ff0000', g: 2 }] };
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

// ---- servidor simulado
const visto = { modelos: [], imagenes: 0, completar: 0, wikiUA: [], pedidos: [] };
let modoGemini = 'normal';
const mock = http.createServer((req, res) => {
  let cuerpo = ''; req.on('data', d => cuerpo += d); req.on('end', () => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/w/api.php') {
      visto.wikiUA.push(req.headers['user-agent'] || ''); const q = u.searchParams.get('gsrsearch') || '';
      if (/zzzz/.test(q)) { res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify({ batchcomplete: '' })); }
      res.setHeader('content-type', 'application/json');
      return res.end(JSON.stringify({ query: { pages: { 1: { index: 1, title: 'Battle rope', extract: 'Una battle rope es una soga gruesa y pesada usada en entrenamiento funcional.', thumbnail: { source: 'http://127.0.0.1:' + mock.address().port + '/img.png' } } } } }));
    }
    if (u.pathname === '/img.png') { res.setHeader('content-type', 'image/png'); return res.end(PNG); }
    const m = /models\/([^:]+):generateContent/.exec(u.pathname);
    if (m) {
      visto.modelos.push(m[1]);
      if (req.headers['x-goog-api-key'] !== 'clave-de-prueba') { res.statusCode = 400; return res.end('API key not valid'); }
      if (modoGemini === 'cupo' && m[1] === 'gemini-3.5-flash') { res.statusCode = 429; return res.end('{}'); }
      const j = JSON.parse(cuerpo), partes = j.contents[0].parts, texto = partes.map(p => p.text || '').join('');
      if (partes.some(p => p.inline_data)) visto.imagenes++;
      let out;
      if (/"entendido"/.test(texto)) {
        if (/asdfgh/.test(texto)) out = { entendido: false, ambiguo: false, candidatos: [] };
        else if (/cuerda/i.test(texto.split('\n')[0])) out = { entendido: true, ambiguo: true, candidatos: [{ nombre: 'Soga de saltar', descripcion: 'Para saltar', pagina: null }, { nombre: 'Soga de batalla', descripcion: 'Gruesa y pesada', pagina: 'Battle rope' }, { nombre: 'Cuerda de trepar', descripcion: 'Para trepar', pagina: null }] };
        else out = { entendido: true, ambiguo: false, candidatos: [{ nombre: 'Soga de batalla', descripcion: 'Soga gruesa y pesada', pagina: 'Battle rope' }] };
      } else if (/Faltan estímulos/.test(texto)) { visto.completar++; out = { ejercicios: ejercicios('Extra', null) }; }
      else if (modoGemini === 'faltan') out = { descripcion: 'Soga gruesa', peso: { tiene: true, kg: '9 kg' }, dibujo: DIB, ejercicios: ejercicios('Base', 'movilidad') };
      else if (modoGemini === 'basura') { return res.end(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'esto no es json' }] } }] })); }
      else out = { descripcion: 'Soga gruesa y pesada para trabajo cardiovascular y de fuerza.', peso: { tiene: true, kg: '9 kg' }, dibujo: DIB, ejercicios: [...ejercicios('Soga', null), { patron: 'inventado', nombre: 'x', prog2: 'y', prog3: 'z' }] };
      res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify({ candidates: [{ content: { parts: [{ text: '```json\n' + JSON.stringify(out) + '\n```' }] } }] }));
    }
    res.statusCode = 404; res.end();
  });
});

function levantar(env) {
  const P = 7800 + Math.floor(Math.random() * 400), D = fs.mkdtempSync(path.join(os.tmpdir(), 'omega-v14-')), BASE = 'http://127.0.0.1:' + P;
  const srv = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', path.join(__dirname, '..', 'server.js')], { env: { ...process.env, PORT: P, DATA_DIR: D, HOST: '127.0.0.1', ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; srv.stdout.on('data', d => log += d); srv.stderr.on('data', d => log += d);
  const api = async (metodo, ruta, cuerpo, token) => { const r = await fetch(BASE + ruta, { method: metodo, headers: { ...(cuerpo !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined }); const t = await r.text(); let j; try { j = JSON.parse(t); } catch (_) { j = t; } return { status: r.status, data: j }; };
  const listo = async () => { for (let i = 0; i < 80; i++) { try { await fetch(BASE + '/api/estado'); const r = await api('POST', '/api/setup', { username: 'dueno', password: 'Omega#2026', nombre: 'Dueño' }); return r.data.token; } catch (_) { await new Promise(r => setTimeout(r, 100)); } } throw new Error('no arrancó\n' + log); };
  return { api, listo, matar: () => srv.kill(), log: () => log };
}
async function esperarEstado(app, adm, clave, estados, ms = 15000) {
  const t0 = Date.now(); let j;
  while (Date.now() - t0 < ms) { const r = await app.api('GET', '/api/equipamiento-ia/pendientes', undefined, adm); j = r.data.find(x => x.clave === clave); if (j && estados.includes(j.estado)) return j; await new Promise(r => setTimeout(r, 150)); }
  throw new Error('no llegó a ' + estados + ' (último: ' + JSON.stringify(j) + ')');
}

(async () => {
  await new Promise(r => mock.listen(0, '127.0.0.1', r));
  const U = 'http://127.0.0.1:' + mock.address().port;
  const base = { OMEGA_WIKI_BASE: U, OMEGA_GEMINI_BASE: U, OMEGA_GEMINI_CLAVE: 'clave-de-prueba' };
  const app = levantar(base); const apps = [app];
  try {
    const adm = await app.listo();
    let r = await app.api('GET', '/api/estado'); assert.match(r.data.version, /Versión 14/); paso('la app informa Versión 14');

    // ---- 1) nombre claro: busca, interpreta con la foto y arma la propuesta
    r = await app.api('POST', '/api/equipamiento', { nombre: 'Sogas de batalla', cantidad: 2 }, adm); assert.equal(r.status, 200, JSON.stringify(r.data)); assert.equal(r.data.ia, 'buscando'); assert.equal(r.data.sugerencias, 0);
    const clave = r.data.clave;
    r = await app.api('POST', '/api/equipamiento', { nombre: 'Aros', cantidad: 1 }, adm); // otro equipo en paralelo no interfiere
    await esperarEstado(app, adm, clave, ['listo']); paso('el alta del equipamiento dispara la búsqueda en segundo plano y termina sola');
    assert.ok(visto.wikiUA.every(u => /OMEGA/.test(u))); assert.ok(visto.imagenes >= 1); paso('consultó Wikipedia (con identificación del programa) y le pasó la foto a la IA');
    r = await app.api('GET', '/api/sugerencias', undefined, adm); const sug = r.data.filter(s => s.equipo_clave === clave);
    assert.equal(sug.length, 35, 'ejercicios propuestos: ' + sug.length); assert.ok(sug.every(s => s.ia === 1)); paso('propone 35 ejercicios: se descartó el que traía un patrón inventado');
    for (const p of PATRONES) assert.ok(sug.filter(s => s.zona === require('../src/estimulos').zonaDeClave(p)).length >= 5, p);
    for (const c of CAPS) assert.ok(sug.filter(s => s.capacidad.split(',').includes(c)).length >= 5, c);
    for (const e of ENS) assert.ok(sug.filter(s => s.energia.split(',').includes(e)).length >= 5, e); paso('al menos 5 ejercicios en cada uno de los 13 estímulos (7 patrones, 4 capacidades, 2 sistemas energéticos)');
    r = await app.api('GET', '/api/equipamiento', undefined, adm); const eq = r.data.find(e => e.clave === clave);
    assert.ok(eq.dibujo_ia && JSON.parse(eq.dibujo_ia).formas.length === 3 && eq.dibujo === null); assert.match(eq.ia_nota, /Peso típico: 9 kg/); paso('deja un dibujo propuesto (sin pisar el actual) y una nota con lo que encontró');
    const uno = sug[0]; r = await app.api('POST', `/api/sugerencias/${uno.id}/aceptar`, {}, adm); assert.equal(r.status, 200);
    r = await app.api('GET', '/api/ejercicios', undefined, adm); const ej = r.data.find(e => e.nombre === uno.nombre); assert.ok(ej && ej.equipo === clave && ej.origen === 'sugerido' && ej.capacidad === uno.capacidad && ej.energia === uno.energia); paso('al aceptar un ejercicio entra a la biblioteca con su estímulo, equipo y origen "IA"');
    r = await app.api('GET', '/api/depurar/ejercicios', undefined, adm); assert.equal(r.data.find(e => e.id === ej.id).fuente, 'ia'); paso('y aparece en la pestaña «Importados por IA» del depurador');
    r = await app.api('POST', '/api/sugerencias/descartar-todas', { equipo: clave }, adm); assert.equal(r.data.descartadas, 34);
    r = await app.api('GET', '/api/sugerencias', undefined, adm); assert.equal(r.data.filter(s => s.equipo_clave === clave).length, 0); paso('se pueden descartar todas las sugerencias que quedaron');
    r = await app.api('POST', `/api/equipamiento/${clave}/ia/dibujo`, { accion: 'usar' }, adm); assert.equal(r.status, 200);
    r = await app.api('GET', '/api/equipamiento', undefined, adm); const eq2 = r.data.find(e => e.clave === clave); assert.ok(eq2.dibujo && !eq2.dibujo_ia); paso('«Usar este dibujo» lo guarda como dibujo del equipamiento');
    r = await app.api('POST', `/api/equipamiento/${clave}/ia/dibujo`, { accion: 'usar' }, adm); assert.equal(r.status, 400); paso('sin dibujo propuesto no hay nada que usar');

    // ---- 2) nombre ambiguo
    r = await app.api('POST', '/api/equipamiento', { nombre: 'Cuerda', cantidad: 3 }, adm); const kc = r.data.clave;
    const j = await esperarEstado(app, adm, kc, ['elegir']); assert.equal(j.candidatos.length, 3);
    assert.equal((await app.api('GET', '/api/sugerencias', undefined, adm)).data.filter(s => s.equipo_clave === kc).length, 0); paso('si el nombre es ambiguo, se detiene y ofrece 3 opciones sin proponer nada todavía');
    r = await app.api('POST', `/api/equipamiento/${kc}/ia/elegir`, { indice: 7 }, adm); assert.equal(r.status, 400); paso('una opción inexistente se rechaza');
    r = await app.api('POST', `/api/equipamiento/${kc}/ia/elegir`, { indice: 1 }, adm); assert.equal(r.status, 200);
    await esperarEstado(app, adm, kc, ['listo']); assert.ok((await app.api('GET', '/api/sugerencias', undefined, adm)).data.filter(s => s.equipo_clave === kc).length >= 30); paso('al elegir una opción, la IA arma la propuesta');
    r = await app.api('POST', '/api/equipamiento', { nombre: 'Cuerdas largas', cantidad: 1 }, adm); const kd = r.data.clave;
    await esperarEstado(app, adm, kd, ['elegir']); r = await app.api('POST', `/api/equipamiento/${kd}/ia/elegir`, { indice: null }, adm); assert.equal(r.data.estado, 'omitido');
    await new Promise(r => setTimeout(r, 400)); assert.equal((await app.api('GET', '/api/sugerencias', undefined, adm)).data.filter(s => s.equipo_clave === kd).length, 0);
    r = await app.api('GET', '/api/equipamiento', undefined, adm); assert.equal(r.data.find(e => e.clave === kd).dibujo_ia, null); paso('«dejarlo como lo describí»: queda así, sin dibujo ni ejercicios propuestos');

    // ---- 3) casos límite
    r = await app.api('POST', '/api/equipamiento', { nombre: 'asdfgh', cantidad: 1 }, adm); const kn = r.data.clave;
    const jn = await esperarEstado(app, adm, kn, ['no_entendido']); assert.match(jn.mensaje, /No pude reconocer/); paso('algo que no es equipamiento queda como se escribió, con un aviso');
    modoGemini = 'faltan'; const antesC = visto.completar;
    r = await app.api('POST', '/api/equipamiento', { nombre: 'Soga gruesa', cantidad: 1 }, adm); const kf = r.data.clave; await esperarEstado(app, adm, kf, ['listo']);
    assert.equal(visto.completar, antesC + 1); const sf = (await app.api('GET', '/api/sugerencias', undefined, adm)).data.filter(s => s.equipo_clave === kf);
    assert.ok(sf.filter(s => s.capacidad.split(',').includes('movilidad')).length >= 5); paso('si a la primera falta cubrir un estímulo, la IA completa lo que falta en un segundo pedido');
    modoGemini = 'cupo'; visto.modelos.length = 0;
    r = await app.api('POST', '/api/equipamiento', { nombre: 'Soga fina', cantidad: 1 }, adm); await esperarEstado(app, adm, r.data.clave, ['listo']);
    assert.ok(visto.modelos.includes('gemini-3.5-flash') && visto.modelos.includes('gemini-3.1-flash-lite')); paso('si un modelo no tiene cupo, prueba con el siguiente');
    modoGemini = 'basura'; r = await app.api('POST', '/api/equipamiento', { nombre: 'Soga rara', cantidad: 1 }, adm);
    const je = await esperarEstado(app, adm, r.data.clave, ['error']); assert.ok(je.mensaje); paso('si la IA contesta cualquier cosa, no se rompe: avisa y no genera nada');
    modoGemini = 'normal';
    r = await app.api('GET', '/api/equipamiento-ia/pendientes'); assert.equal(r.status, 401); paso('sin iniciar sesión no se puede consultar');
    r = await app.api('GET', '/api/estado'); assert.ok(!JSON.stringify(r.data).includes('clave-de-prueba')); r = await app.api('GET', '/api/equipamiento', undefined, adm); assert.ok(!JSON.stringify(r.data).includes('clave-de-prueba')); paso('la clave de la IA nunca sale por la API');

    // ---- 4) sin internet y sin clave: no genera nada
    const sinNet = levantar({ ...base, OMEGA_WIKI_BASE: 'http://127.0.0.1:1', OMEGA_GEMINI_BASE: 'http://127.0.0.1:1' }); apps.push(sinNet); const a2 = await sinNet.listo();
    r = await sinNet.api('POST', '/api/equipamiento', { nombre: 'Sogas de batalla', cantidad: 2 }, a2); assert.equal(r.data.ia, 'buscando');
    const js = await esperarEstado(sinNet, a2, r.data.clave, ['sin_internet']); assert.match(js.mensaje, /Sin conexión/);
    assert.equal((await sinNet.api('GET', '/api/sugerencias', undefined, a2)).data.length, 0); paso('sin conexión: avisa y no genera nada');
    const sinClave = levantar({ ...base, OMEGA_GEMINI_CLAVE: '' }); apps.push(sinClave); const a3 = await sinClave.listo();
    r = await sinClave.api('POST', '/api/equipamiento', { nombre: 'Sogas de batalla', cantidad: 2 }, a3); assert.equal(r.status, 200); assert.equal(r.data.ia, 'sin_clave');
    assert.equal((await sinClave.api('GET', '/api/sugerencias', undefined, a3)).data.length, 0); paso('sin clave de IA en la instalación: el alta funciona igual y no genera nada');
    // el instalador nunca incluye la clave en un paquete de actualización
    assert.ok(/ia-embebida/.test(fs.readFileSync(path.join(__dirname, '..', 'src', 'actualizar.js'), 'utf8').split('\n').find(l => l.startsWith('const EXCLUIDO')))); paso('la clave no viaja en los paquetes de actualización');
  } catch (e) { console.error('✗', e.stack || e.message, '\n', apps.map(a => a.log().slice(-600)).join('\n')); process.exitCode = 1; }
  finally { apps.forEach(a => a.matar()); mock.close(); }
  console.log(process.exitCode ? 'FALLÓ' : ok + ' pruebas OK');
})();
