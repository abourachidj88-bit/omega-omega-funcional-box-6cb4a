'use strict';
// Hark Pro (Versión 10). Dos motores que corren de fondo y empiezan APAGADOS:
//   1) Aprendizaje de la planificación: durante el período que fija el administrador observa cómo los profesores cambian a mano los ejercicios
//      de los circuitos y aprende sus preferencias. Pasado el período, la IA planifica favoreciendo esas elecciones.
//   2) WhatsApp: lee (solo lectura) las conversaciones de WhatsApp Web de la PC, las asocia con el cliente por su número, resume lo relacionado con
//      el entrenamiento y lo deja en Clientes → Seguimiento → Comentarios. También aprende el estilo con que escribe el gimnasio.
// Hark Pro NO envía mensajes a nadie en esta versión. Lo capturado queda solo en la PC del gimnasio (no se sincroniza con la nube).
const crypto = require('node:crypto');
const { all, get, run, tx, getConfig, setConfig } = require('./db');
const { nowAR, addDays, diffDays } = require('./util');
const telefono = require('./telefono');

const MIN_OBSERVACIONES = 10;
const IDLE_MIN = 30;                       // la conversación se resume cuando lleva 30 minutos sin mensajes nuevos
const RETENCION_DIAS = 120;                // los mensajes crudos ya resumidos se borran pasado este tiempo

const leer = (k, def) => { try { const j = JSON.parse(getConfig(k) || 'null'); return j && typeof j === 'object' ? { ...def, ...j } : { ...def }; } catch (_) { return { ...def }; } };
const guardar = (k, v) => setConfig(k, JSON.stringify(v));

// ---------------------------------------------------------------- 1) aprendizaje de la planificación
const PLAN_DEF = { activo: false, desde: null, hasta: null };
const PERIODO_DEF_DIAS = 28;
function estadoPlan() {
  // Versión 11: el aprendizaje de la planificación viene ACTIVADO por defecto (la primera vez arranca hoy y dura 28 días; el administrador puede cambiarlo o apagarlo)
  const hoy = nowAR().fecha;
  if (!getConfig('hark_plan')) guardar('hark_plan', { activo: true, desde: hoy, hasta: addDays(hoy, PERIODO_DEF_DIAS) });
  const c = leer('hark_plan', PLAN_DEF);
  const n = get('SELECT COUNT(*) AS n FROM hark_cambios').n;
  let estado = 'apagado';
  if (c.activo) estado = hoy <= (c.hasta || '9999-12-31') ? 'aprendiendo' : (n >= MIN_OBSERVACIONES ? 'aplicando' : 'sin_datos');
  return { ...c, estado, observaciones: n, minimo: MIN_OBSERVACIONES, grabando: estado === 'aprendiendo' || estado === 'sin_datos' };
}
function configurarPlan({ activo, desde, hasta }) {
  const hoy = nowAR().fecha;
  if (!activo) { guardar('hark_plan', { activo: false, desde: null, hasta: null }); _cache = null; return estadoPlan(); }
  const d = /^\d{4}-\d{2}-\d{2}$/.test(String(desde || '')) ? desde : hoy;
  const h = /^\d{4}-\d{2}-\d{2}$/.test(String(hasta || '')) ? hasta : addDays(d, 28);
  if (h < d) { const e = new Error('La fecha final del período no puede ser anterior a la inicial'); e.status = 400; throw e; }
  if (diffDays(h, d) > 365) { const e = new Error('El período de aprendizaje no puede superar un año'); e.status = 400; throw e; }
  guardar('hark_plan', { activo: true, desde: d, hasta: h }); _cache = null;
  return estadoPlan();
}
function registrarCambio({ usuario_id, profesor_id, formato_id, fecha_clase, patron, antes_id, despues_id }) {
  try {
    if (!estadoPlan().grabando) return false;
    if (get('SELECT COUNT(*) AS n FROM hark_cambios').n >= 20000) run('DELETE FROM hark_cambios WHERE id IN (SELECT id FROM hark_cambios ORDER BY id LIMIT 2000)');
    run('INSERT INTO hark_cambios (creado, usuario_id, profesor_id, formato_id, fecha_clase, patron, antes_id, despues_id) VALUES (?,?,?,?,?,?,?,?)',
      new Date().toISOString(), usuario_id || null, profesor_id || null, formato_id || null, fecha_clase || null, patron || null, antes_id || null, despues_id || null);
    _cache = null; return true;
  } catch (_) { return false; }
}
let _cache = null;
// Preferencias aprendidas: ejercicio -> puntaje (+1 cada vez que lo eligió a mano, -1 cada vez que lo sacó). Las del profesor de la clase pesan el doble.
function bonus(profesorId) {
  const est = estadoPlan();
  if (est.estado !== 'aplicando') return () => 0;
  const hoy = nowAR().fecha;
  if (!_cache || _cache.dia !== hoy) {
    const m = new Map();
    for (const r of all('SELECT profesor_id, usuario_id, antes_id, despues_id FROM hark_cambios')) {
      const dueño = r.profesor_id || r.usuario_id || 0;
      const add = (id, v) => { if (!id) return; const k = id + ':' + dueño; m.set(k, (m.get(k) || 0) + v); const g = id + ':*'; m.set(g, (m.get(g) || 0) + v); };
      add(r.despues_id, 1); add(r.antes_id, -1);
    }
    _cache = { dia: hoy, m };
  }
  return (ejId) => {
    const g = _cache.m.get(ejId + ':*') || 0, p = profesorId ? (_cache.m.get(ejId + ':' + profesorId) || 0) : 0;
    return Math.max(-3, Math.min(3, Math.round((g * 0.5 + p) * 10) / 10));
  };
}
function resumenPlan() {
  const est = estadoPlan();
  const filas = all('SELECT profesor_id, usuario_id, antes_id, despues_id FROM hark_cambios');
  const nombres = new Map(all("SELECT id, COALESCE(nombre, username) AS n FROM usuarios").map(u => [u.id, u.n]));
  const ej = new Map(all('SELECT id, nombre, zona FROM ejercicios').map(e => [e.id, e]));
  const pref = new Map(), evit = new Map(), porProf = new Map();
  for (const r of filas) {
    if (r.despues_id) pref.set(r.despues_id, (pref.get(r.despues_id) || 0) + 1);
    if (r.antes_id) evit.set(r.antes_id, (evit.get(r.antes_id) || 0) + 1);
    const p = r.profesor_id || r.usuario_id; if (p) porProf.set(p, (porProf.get(p) || 0) + 1);
  }
  const top = (m) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([id, n]) => ({ id, nombre: (ej.get(id) || {}).nombre || '(borrado)', patron: (ej.get(id) || {}).zona || '', veces: n }));
  return { ...est, profesores: [...porProf.entries()].map(([id, n]) => ({ id, nombre: nombres.get(id) || 'Profesor', cambios: n })).sort((a, b) => b.cambios - a.cambios), preferidos: top(pref), evitados: top(evit) };
}
function borrarPlan() { run('DELETE FROM hark_cambios'); _cache = null; }

// ---------------------------------------------------------------- 2) WhatsApp
const WA_DEF = { activo: false, consentimiento_en: null, consentimiento_por: null };
const tokenCaptura = () => { let t = getConfig('hark_token'); if (!t) { t = crypto.randomBytes(24).toString('hex'); setConfig('hark_token', t); } return t; };
function escribirTokenArchivo() { // el programa de escritorio lo lee de C:\OMEGA para poder enviar lo capturado al servidor local
  const home = process.env.OMEGA_HOME; if (!home) return;
  try { require('node:fs').writeFileSync(require('node:path').join(home, 'hark-token.txt'), tokenCaptura(), { mode: 0o600 }); } catch (_) {}
}
function configurarWA({ activo, consentimiento }, usuario) {
  const c = leer('hark_wa', WA_DEF);
  if (activo) {
    if (!consentimiento) { const e = new Error('Para activar la lectura de WhatsApp tenés que confirmar que los alumnos están informados y que el uso de sus conversaciones es responsabilidad del gimnasio'); e.status = 400; throw e; }
    c.activo = true; c.consentimiento_en = new Date().toISOString(); c.consentimiento_por = usuario || null; escribirTokenArchivo();
  } else c.activo = false;
  guardar('hark_wa', c); return c;
}
const soloDigitos = (s) => String(s || '').replace(/\D+/g, '');
const cola10 = (s) => soloDigitos(s).slice(-10);
const sinAcentos = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
// alias de WhatsApp: se pueden cargar varios separados por coma, punto y coma o salto de línea
const aliasDe = (c) => String(c.alias_wa || '').split(/[,;\n]+/).map(sinAcentos).filter(a => a.length >= 2);
function buscarCliente(tel, nombre) {
  const n0 = sinAcentos(nombre);
  if (n0.length >= 2) {
    const m = all("SELECT id, alias_wa FROM clientes WHERE alias_wa IS NOT NULL AND alias_wa <> ''").filter(c => aliasDe(c).includes(n0));
    if (m.length === 1) return m[0].id;
  }
  const t = cola10(tel);
  if (t.length >= 8) {
    for (const c of all("SELECT id, celular FROM clientes WHERE celular IS NOT NULL AND celular <> ''")) if (cola10(c.celular) === t) return c.id;
  }
  const n = sinAcentos(nombre);
  if (n.length >= 5) { const m = all('SELECT id, nombre FROM clientes').filter(c => sinAcentos(c.nombre) === n); if (m.length === 1) return m[0].id; }
  return null;
}
// El alumno que escribe desde el botón "Chatear con el gimnasio" de la app manda su código (OMEGA#id): se asocia ese chat con su ficha
// y el nombre con el que figura en WhatsApp se guarda como alias (así las próximas conversaciones se reconocen solas).
function vincularPorCodigo(lista) {
  for (const m of lista.slice(0, 500)) {
    if (m.dir === 'out') continue;
    const k = /OMEGA\s*#\s*(\d{1,9})/i.exec(String(m.texto || '')); if (!k) continue;
    const cli = get('SELECT id, alias_wa FROM clientes WHERE id = ?', Number(k[1])); if (!cli) continue;
    const tel = soloDigitos(m.tel).slice(0, 18), nom = String(m.nombre || '').slice(0, 80);
    run('UPDATE hark_wa_msgs SET cliente_id = ? WHERE telefono = ? AND nombre_chat = ? AND cliente_id IS NULL', cli.id, tel, nom);
    if (nom.length >= 2 && !aliasDe(cli).includes(sinAcentos(nom))) run('UPDATE clientes SET alias_wa = ? WHERE id = ?', (cli.alias_wa ? cli.alias_wa + ', ' : '') + nom, cli.id);
  }
}
function guardarMensajes(lista) {
  let nuevos = 0;
  const pref = getConfig('prefijo', '54');
  tx(() => {
    for (const m of lista.slice(0, 500)) {
      const texto = String(m.texto || '').replace(/\s+/g, ' ').trim().slice(0, 2000);
      const uid = String(m.uid || '').slice(0, 120), tel = soloDigitos(m.tel).slice(0, 18);
      const nom = String(m.nombre || '').trim();
      if (!texto || !uid || (tel.length < 8 && nom.length < 2)) continue;       // sin número se puede reconocer al alumno por el alias de WhatsApp
      const dir = m.dir === 'out' ? 'out' : 'in';
      const fecha = /^\d{4}-\d{2}-\d{2}$/.test(String(m.fecha || '')) ? m.fecha : nowAR().fecha, hora = /^\d{1,2}:\d{2}$/.test(String(m.hora || '')) ? m.hora : '';
      const ya = get('SELECT id FROM hark_wa_msgs WHERE uid = ?', uid); if (ya) continue;
      run('INSERT INTO hark_wa_msgs (uid, telefono, nombre_chat, dir, fecha, hora, texto, cliente_id, resumido, creado) VALUES (?,?,?,?,?,?,?,?,0,?)',
        uid, tel, String(m.nombre || '').slice(0, 80), dir, fecha, hora, texto, buscarCliente(telefono.normalizar(tel, pref) || tel, m.nombre), new Date().toISOString());
      nuevos++;
    }
  });
  if (nuevos) { _estilo = null; vincularPorCodigo(lista); }
  return nuevos;
}

// ---- resumen de lo relacionado con el entrenamiento
const TEMAS = [
  ['Lesión o molestia', /(dolor|duele|molest|lesi[oó]n|lumbar|rodilla|hombro|cuello|espalda|tobillo|codo|mu[ñn]eca|contractura|desgarr|esguince|operaci[oó]n|operad|kinesi|m[eé]dic)/i],
  ['Asistencia y horarios', /(horario|turno|clase|reserv|cambio de|no voy|no puedo ir|no llego|falt[eéo]|ausen|llego tarde|feriado|vacaciones|viaj)/i],
  ['Rutina y ejercicios', /(rutina|ejercicio|series|repeticion|sentadilla|press|dominada|abdominal|cardio|fuerza|movilidad|entren|pesas|kilos)/i],
  ['Objetivos y progreso', /(objetivo|bajar de peso|subir de peso|masa muscular|marat[oó]n|resistencia|progres|mejor[eé]|me siento|energ[ií]a|cansad|agotad|motiva|meta)/i],
  ['Salud y descanso', /(enferm|gripe|fiebre|covid|dormi|sue[ñn]o|embaraz|lactan|alimentaci|dieta|nutri)/i],
];
const corto = (s, n = 150) => { s = String(s).trim(); return s.length > n ? s.slice(0, n - 1).trim() + '…' : s; };
const fdma = (iso) => iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4);
function resumir(msgs) { // devuelve el texto del resumen, o null si la conversación no habla de entrenamiento
  const temas = new Set(), alumno = [], gym = [];
  for (const m of msgs) {
    const t = TEMAS.filter(([, re]) => re.test(m.texto));
    if (!t.length) continue;
    t.forEach(([n]) => temas.add(n));
    (m.dir === 'in' ? alumno : gym).push({ m, k: t.length });
  }
  if (!temas.size) return null;
  const mejores = (l, n) => l.sort((a, b) => b.k - a.k || b.m.texto.length - a.m.texto.length).slice(0, n).sort((a, b) => (a.m.fecha + a.m.hora).localeCompare(b.m.fecha + b.m.hora)).map(x => '«' + corto(x.m.texto) + '»');
  const f0 = msgs[0].fecha, f1 = msgs[msgs.length - 1].fecha;
  let s = `Resumen de WhatsApp (${f0 === f1 ? fdma(f0) : fdma(f0) + ' al ' + fdma(f1)}, ${msgs.length} mensajes). Temas: ${[...temas].join(', ')}.`;
  if (alumno.length) s += ' El alumno comentó: ' + mejores(alumno, 3).join(' · ') + '.';
  if (gym.length) s += ' Se le respondió: ' + mejores(gym, 2).join(' · ') + '.';
  return s.slice(0, 1500);
}
// guarda el resumen de una conversación (grupo de mensajes del mismo chat) como comentario del alumno
function resumirGrupo(msgs, cli, hoy) {
  const txt = resumir(msgs);
  tx(() => {
    if (txt) run("INSERT INTO comentarios (tipo, ref_id, fecha, texto, autor_id, autor, creado) VALUES ('cliente', ?, ?, ?, NULL, 'Hark Pro', ?)", cli, hoy, txt, new Date().toISOString());
    for (const m of msgs) run('UPDATE hark_wa_msgs SET resumido = ?, cliente_id = ? WHERE id = ?', txt ? 1 : 2, cli, m.id);
  });
  return !!txt;
}
function procesarResumenes({ forzar = false } = {}) {
  const hoy = nowAR().fecha;
  let creados = 0, descartados = 0;
  const limite = new Date(Date.now() - IDLE_MIN * 60000).toISOString();
  const chats = all('SELECT telefono, nombre_chat, MAX(creado) AS ult FROM hark_wa_msgs WHERE resumido = 0 GROUP BY telefono, nombre_chat');
  for (const t of chats) {
    if (!forzar && t.ult > limite) continue;
    const msgs = all('SELECT * FROM hark_wa_msgs WHERE telefono = ? AND nombre_chat = ? AND resumido = 0 ORDER BY fecha, hora, id', t.telefono, t.nombre_chat);
    const cli = msgs.map(m => m.cliente_id).find(Boolean) || buscarCliente(t.telefono, t.nombre_chat);
    if (!cli) continue;                       // todavía no se sabe de qué alumno es: queda pendiente (se resuelve cargando su alias de WhatsApp)
    if (resumirGrupo(msgs, cli, hoy)) creados++; else descartados++;
  }
  run("DELETE FROM hark_wa_msgs WHERE resumido > 0 AND creado < ?", new Date(Date.now() - RETENCION_DIAS * 86400000).toISOString());
  return { creados, descartados };
}
// botón "Importar con Hark Pro" de la ficha del alumno: resume ahora lo capturado de ese alumno (por alias, teléfono o nombre)
function importarCliente(id) {
  const hoy = nowAR().fecha;
  const pend = all('SELECT * FROM hark_wa_msgs WHERE resumido = 0 ORDER BY fecha, hora, id').filter(m => m.cliente_id === id || (!m.cliente_id && buscarCliente(m.telefono, m.nombre_chat) === id));
  const grupos = new Map();
  for (const m of pend) { const k = m.telefono + '|' + m.nombre_chat; if (!grupos.has(k)) grupos.set(k, []); grupos.get(k).push(m); }
  let creados = 0, sinTema = 0;
  for (const g of grupos.values()) { if (resumirGrupo(g, id, hoy)) creados++; else sinTema++; }
  const total = get('SELECT COUNT(*) AS n FROM hark_wa_msgs WHERE cliente_id = ?', id).n;
  return { creados, sin_tema: sinTema, mensajes: pend.length, guardados: total, activo: !!leer('hark_wa', WA_DEF).activo };
}

// ---- estilo con el que escribe el gimnasio (solo mensajes enviados desde la PC)
let _estilo = null;
const PARADAS = new Set('de la que el en y a los se del las un por con no una su para es al lo como más pero sus le ya o este sí porque esta entre cuando muy sin sobre también me hasta hay donde quien desde todo nos durante todos uno les ni contra otros ese eso ante ellos e esto mí antes algunos qué unos yo otro otras otra él tanto esa estos mucho quienes nada muchos cual poco ella estar estas algunas algo nosotros mi mis tú te ti tu tus ellas nosotras vosotros vosotras os mío mía míos mías tuyo tuya tuyos tuyas suyo suya suyos suyas nuestro nuestra nuestros nuestras vuestro vuestra vuestros vuestras esos esas estoy estás está estamos estáis están'.split(' '));
function estilo() {
  if (_estilo) return _estilo;
  const out = all("SELECT texto FROM hark_wa_msgs WHERE dir = 'out' ORDER BY id DESC LIMIT 3000").map(r => r.texto);
  const n = out.length;
  if (!n) return (_estilo = { mensajes: 0 });
  const emojis = new Map(), primeras = new Map(), ultimas = new Map(), palabras = new Map(), muletillas = new Map();
  let palTot = 0, conEmoji = 0, excl = 0, preg = 0, risas = 0, voseo = 0, mayus = 0;
  const MULET = ['dale', 'genial', 'bárbaro', 'barbaro', 'buenísimo', 'buenisimo', 'crack', 'capo', 'excelente', 'hermoso', 'perfecto', 'de una', 'tranqui', 'listo', 'joya', 'fenómeno', 'fenomeno', 'abrazo', 'saludos', 'un beso', 'nos vemos', 'gracias'];
  for (const t of out) {
    const ws = t.split(/\s+/).filter(Boolean); palTot += ws.length;
    const em = t.match(/\p{Extended_Pictographic}/gu) || []; if (em.length) conEmoji++; em.forEach(e => emojis.set(e, (emojis.get(e) || 0) + 1));
    if (/!/.test(t)) excl++; if (/\?/.test(t)) preg++; if (/\b(ja){2,}|\b(je){2,}|jiji/i.test(t)) risas++; if (/\b(vos|ten[eé]s|pod[eé]s|quer[eé]s|ven[ií]|mand[aá]|avis[aá]|dale)\b/i.test(t)) voseo++;
    if (/^[A-ZÁÉÍÓÚÑ]/.test(t)) mayus++;
    const w0 = (ws[0] || '').toLowerCase().replace(/[^\p{L}]/gu, ''), wn = (ws[ws.length - 1] || '').toLowerCase().replace(/[^\p{L}]/gu, '');
    if (w0.length > 1) primeras.set(w0, (primeras.get(w0) || 0) + 1); if (wn.length > 1) ultimas.set(wn, (ultimas.get(wn) || 0) + 1);
    const low = t.toLowerCase();
    for (const mu of MULET) if (low.includes(mu)) muletillas.set(mu, (muletillas.get(mu) || 0) + 1);
    for (const w of ws) { const x = w.toLowerCase().replace(/[^\p{L}]/gu, ''); if (x.length > 3 && !PARADAS.has(x)) palabras.set(x, (palabras.get(x) || 0) + 1); }
  }
  const top = (m, k, min = 2) => [...m.entries()].filter(([, v]) => v >= min).sort((a, b) => b[1] - a[1]).slice(0, k).map(([x, v]) => ({ x, n: v }));
  const pct = (v) => Math.round(v * 100 / n);
  const muestras = out.filter(t => t.length >= 12 && t.length <= 120 && !/\d{6,}|@|https?:/i.test(t)).slice(0, 12);
  return (_estilo = { mensajes: n, palabras_por_mensaje: Math.round(palTot / n * 10) / 10, con_emoji: pct(conEmoji), con_exclamacion: pct(excl), con_pregunta: pct(preg), con_risas: pct(risas), voseo: pct(voseo), empieza_mayuscula: pct(mayus),
    emojis: top(emojis, 6, 1), aperturas: top(primeras, 6), cierres: top(ultimas, 6), muletillas: top(muletillas, 8, 1), palabras: top(palabras, 12, 3), muestras });
}
function estadoWA() {
  const c = leer('hark_wa', WA_DEF);
  const q = (w) => get('SELECT COUNT(*) AS n FROM hark_wa_msgs' + (w ? ' WHERE ' + w : '')).n;
  return { ...c, mensajes: q(), pendientes: q('resumido = 0'), sin_cliente: q('resumido = 0 AND cliente_id IS NULL'), resumidos: q('resumido = 1'), estilo: estilo() };
}
function borrarWA() { run('DELETE FROM hark_wa_msgs'); _estilo = null; }

// ---- seguimiento a vencidos (solo configuración y vista previa; en esta versión Hark Pro no envía nada)
const SEG_DEF = { dias_vencido: 7, cada_dias: 7, mensaje: '' };
function estadoSeg() {
  const c = leer('hark_seg', SEG_DEF);
  const hoy = nowAR().fecha; const { bajaEfectiva } = require('./semaforos');
  const lista = all("SELECT id, nombre, celular, fecha_alta, fecha_baja FROM clientes").map(x => ({ id: x.id, nombre: x.nombre, celular: x.celular, dias: diffDays(hoy, bajaEfectiva(x)) }))
    .filter(x => x.dias >= c.dias_vencido && x.celular).sort((a, b) => a.dias - b.dias).slice(0, 200);
  return { ...c, candidatos: lista, envia: false };
}
function configurarSeg(b) {
  const n = (v, a, z, d) => { const x = parseInt(v, 10); return Number.isFinite(x) ? Math.max(a, Math.min(z, x)) : d; };
  const c = leer('hark_seg', SEG_DEF);
  guardar('hark_seg', { dias_vencido: n(b.dias_vencido, 1, 365, c.dias_vencido), cada_dias: n(b.cada_dias, 1, 60, c.cada_dias), mensaje: String(b.mensaje ?? c.mensaje).slice(0, 600) });
  return estadoSeg();
}

module.exports = { importarCliente, estadoPlan, configurarPlan, registrarCambio, bonus, resumenPlan, borrarPlan, tokenCaptura, escribirTokenArchivo, configurarWA, estadoWA, guardarMensajes, procesarResumenes, resumir, borrarWA, estadoSeg, configurarSeg, estilo, leerWA: () => leer('hark_wa', WA_DEF), buscarCliente };
