'use strict';
// Versión 10: preguntas de seguridad para recuperar la contraseña del administrador (Ajustes → Seguridad).
// El administrador elige 3 preguntas de este catálogo y marca su respuesta entre las opciones; para restablecer la clave hay que
// acertar las 3. Las respuestas se guardan con hash (scrypt + sal), nunca en texto. Tras 5 fallos seguidos se bloquea 30 minutos.
const crypto = require('node:crypto');

const CATALOGO = [
  { id: 'mascota', texto: '¿Cómo se llama (o se llamó) tu primera mascota?', opciones: ['Luna', 'Max', 'Toby', 'Coco', 'Rocky', 'Mora', 'Simba', 'Nunca tuve mascota'] },
  { id: 'madre', texto: '¿En qué ciudad nació tu madre?', opciones: ['Buenos Aires', 'Córdoba', 'Rosario', 'Mendoza', 'La Plata', 'Mar del Plata', 'Tucumán', 'Otra ciudad'] },
  { id: 'comida', texto: '¿Cuál es tu comida favorita?', opciones: ['Asado', 'Pizza', 'Milanesas', 'Pastas', 'Empanadas', 'Sushi', 'Hamburguesa', 'Ensalada'] },
  { id: 'equipo', texto: '¿De qué equipo de fútbol sos hincha?', opciones: ['Boca', 'River', 'Racing', 'Independiente', 'San Lorenzo', 'Vélez', 'Huracán', 'Otro / ninguno'] },
  { id: 'vehiculo', texto: '¿De qué marca fue tu primer auto o vehículo?', opciones: ['Fiat', 'Ford', 'Chevrolet', 'Renault', 'Volkswagen', 'Peugeot', 'Toyota', 'Moto / no tuve'] },
  { id: 'mes', texto: '¿En qué mes naciste?', opciones: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'] },
  { id: 'color', texto: '¿Cuál es tu color favorito?', opciones: ['Azul', 'Rojo', 'Verde', 'Negro', 'Naranja', 'Violeta', 'Amarillo', 'Blanco'] },
  { id: 'materia', texto: '¿Qué materia te gustaba más en el colegio?', opciones: ['Matemática', 'Lengua', 'Historia', 'Geografía', 'Educación física', 'Inglés', 'Biología', 'Arte'] },
  { id: 'deporte', texto: '¿Cuál es tu deporte favorito?', opciones: ['Fútbol', 'Básquet', 'Tenis', 'Rugby', 'Natación', 'Running', 'Ciclismo', 'Vóley'] },
  { id: 'numero', texto: '¿Cuál es tu número de la suerte?', opciones: ['3', '5', '7', '8', '9', '10', '11', '13'] },
];
const POR_ID = new Map(CATALOGO.map(q => [q.id, q]));
const MAX_FALLOS = 5, BLOQUEO_MIN = 30;

const norm = (s) => String(s || '').normalize('NFC').trim();
function hashResp(id, resp) {
  const salt = crypto.randomBytes(16);
  return 'r1$' + salt.toString('hex') + '$' + crypto.scryptSync(id + ':' + norm(resp), salt, 32).toString('hex');
}
function verifResp(id, resp, guardado) {
  try {
    const [v, s, h] = String(guardado).split('$');
    if (v !== 'r1') return false;
    const x = crypto.scryptSync(id + ':' + norm(resp), Buffer.from(s, 'hex'), 32);
    return crypto.timingSafeEqual(x, Buffer.from(h, 'hex'));
  } catch (_) { return false; }
}
function mezclar(a) { const r = a.slice(); for (let i = r.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [r[i], r[j]] = [r[j], r[i]]; } return r; }

// Valida y arma lo que se guarda: [{ id, hash }]
function armar(preguntas) {
  if (!Array.isArray(preguntas) || preguntas.length !== 3) return { error: 'Elegí exactamente 3 preguntas' };
  const ids = new Set(); const out = [];
  for (const p of preguntas) {
    const q = POR_ID.get(p && p.id);
    if (!q) return { error: 'Pregunta inválida' };
    if (ids.has(q.id)) return { error: 'No repitas la misma pregunta' };
    ids.add(q.id);
    const r = q.opciones.find(o => o === norm(p.respuesta));
    if (!r) return { error: 'Elegí una respuesta para: ' + q.texto };
    out.push({ id: q.id, hash: hashResp(q.id, r) });
  }
  return { guardar: out };
}
function publicas(guardadas) { // preguntas con las opciones mezcladas (sin respuestas)
  return guardadas.map(g => { const q = POR_ID.get(g.id); return q ? { id: q.id, texto: q.texto, opciones: mezclar(q.opciones) } : null; }).filter(Boolean);
}
function comprobar(guardadas, respuestas) { // acertar las 3, sin cortar antes (tiempo parejo)
  if (!Array.isArray(respuestas) || guardadas.length !== 3) return false;
  let ok = true;
  for (const g of guardadas) {
    const r = respuestas.find(x => x && x.id === g.id);
    if (!r || !verifResp(g.id, r.respuesta, g.hash)) ok = false;
  }
  return ok;
}
module.exports = { CATALOGO, MAX_FALLOS, BLOQUEO_MIN, armar, publicas, comprobar };
