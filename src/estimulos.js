'use strict';
// Versión 6: clasificación de la biblioteca y de los formatos por tipo de estímulo.
//   1) Patrones de movimiento básicos (se guardan en ejercicios.zona, que ahora es el patrón)
//   2) Capacidades físicas integradas (ejercicios.capacidad: lista separada por comas)
//   3) Sistema energético (ejercicios.energia: lista separada por comas)
const PATRONES = [
  { clave: 'empujar', nombre: 'Empujar (Push)', ejemplo: 'Flexiones de brazos, press de hombros o pecho' },
  { clave: 'tirar', nombre: 'Tirar / Traccionar (Pull)', ejemplo: 'Dominadas, remos con bandas o mancuernas' },
  { clave: 'sentadilla', nombre: 'Agacharse / Sentadilla (Squat)', ejemplo: 'Sentadillas libres, goblet squats' },
  { clave: 'bisagra_cadera', nombre: 'Bisagra de cadera / Carga (Hinge)', ejemplo: 'Peso muerto, kettlebell swings' },
  { clave: 'bisagra_rodilla', nombre: 'Bisagra de rodilla', ejemplo: 'Estocadas hacia adelante, atrás o laterales' },
  { clave: 'rotacion', nombre: 'Rotación y anti-rotación', ejemplo: 'Giros con balón medicinal o Pallof press (estabilidad frente a la torsión)' },
  { clave: 'locomocion', nombre: 'Locomoción y transporte', ejemplo: "Paseo del granjero (farmer's walk), saltos o progresiones de trote" },
];
const CAPACIDADES = [
  { clave: 'fuerza', nombre: 'Fuerza funcional', ejemplo: 'Peso corporal, cargas libres o poleas para generar tensión mecánica en cadenas musculares completas' },
  { clave: 'core', nombre: 'Estabilidad y Core', ejemplo: 'Activación constante de la musculatura profunda del abdomen y la espalda baja para mantener la postura' },
  { clave: 'movilidad', nombre: 'Movilidad y flexibilidad', ejemplo: 'Amplitud de movimiento en tobillos, caderas, hombros y columna mediante gestos dinámicos' },
  { clave: 'equilibrio', nombre: 'Equilibrio y coordinación', ejemplo: 'Apoyos unipodales, cambios de ritmo o implementos inestables adaptados a cada persona' },
];
const ENERGIAS = [
  { clave: 'aerobico', nombre: 'Aeróbico / Resistencia', ejemplo: 'Bloques continuos o con descansos cortos que elevan la frecuencia cardíaca' },
  { clave: 'anaerobico', nombre: 'Anaeróbico / Potencia', ejemplo: 'Esfuerzos cortos, explosivos y de alta intensidad (swings, slams, saltos)' },
];
const ZONAS = PATRONES.map(p => p.nombre);                       // agrupamiento principal de la biblioteca
const claveDeZona = (z) => (PATRONES.find(p => p.nombre === z) || {}).clave || null;
const zonaDeClave = (c) => (PATRONES.find(p => p.clave === c) || {}).nombre || null;
const ILUSTRACION = { empujar: 'flexion', tirar: 'remo_inc', sentadilla: 'sentadilla', bisagra_cadera: 'bisagra', bisagra_rodilla: 'zancada', rotacion: 'plancha', locomocion: 'sprint' };   // ilustración por defecto
const CLAVES = { patrones: PATRONES.map(p => p.clave), capacidades: CAPACIDADES.map(c => c.clave), energias: ENERGIAS.map(e => e.clave) };

// Lista guardada como texto "a,b" <-> arreglo (solo claves válidas)
function lista(v, validas) {
  let a = Array.isArray(v) ? v : typeof v === 'string' ? (v.trim().startsWith('[') ? safeJson(v) : v.split(',')) : [];
  a = a.map(x => String(x).trim()).filter(x => validas.includes(x));
  return [...new Set(a)];
}
function safeJson(s) { try { const j = JSON.parse(s); return Array.isArray(j) ? j : []; } catch (_) { return []; } }
const aTexto = (arr) => arr.join(',');

// ---------- migración de la biblioteca anterior (zonas del cuerpo) a los nuevos agrupamientos
const POR_ILUSTRACION = {
  flexion: 'empujar', press_piso: 'empujar', empuje: 'empujar', apertura: 'empujar', press_vert: 'empujar', elev_front: 'empujar', elev_lat: 'empujar', pica: 'empujar', ext_tri: 'empujar', fondos: 'empujar', patada_tri: 'empujar',
  curl: 'tirar', dominada: 'tirar', remo_inc: 'tirar', remo_inv: 'tirar', remo_menton: 'tirar', pajaro: 'tirar', pullover: 'tirar', tiron: 'tirar',
  sentadilla: 'sentadilla',
  bisagra: 'bisagra_cadera', puente: 'bisagra_cadera', superman: 'bisagra_cadera', swing: 'bisagra_cadera',
  zancada: 'bisagra_rodilla', subida: 'bisagra_rodilla',
  abdominal: 'rotacion', bicho: 'rotacion', bird: 'rotacion', elev_piernas: 'rotacion', plancha: 'rotacion', plancha_lat: 'rotacion', rueda: 'rotacion', ruso: 'rotacion',
  sprint: 'locomocion', saltar: 'locomocion', salto: 'locomocion', burpee: 'locomocion', escalador: 'locomocion', talones: 'locomocion', slam: 'locomocion',
};
const POR_ZONA_VIEJA = { 'Pecho': 'empujar', 'Hombros': 'empujar', 'Tríceps': 'empujar', 'Espalda': 'tirar', 'Bíceps': 'tirar', 'Piernas': 'sentadilla', 'Glúteos': 'bisagra_cadera', 'Core': 'rotacion', 'Resistencia aeróbica': 'locomocion' };
const REGLAS_NOMBRE = [
  [/zancada|estocada|desplante|b[uú]lgara|step[- ]?up|subida|paso lateral|cossack/i, 'bisagra_rodilla'],
  [/pallof|giro|rotaci[oó]n|le[ñn]ador|woodchop|ruso|antirrotaci/i, 'rotacion'],
  [/granjero|farmer|transporte|acarreo|trote|sprint|soga|salto|burpee|skipping|jumping/i, 'locomocion'],
  [/peso muerto|swing|hip thrust|puente|buenos d[ií]as|bisagra/i, 'bisagra_cadera'],
  [/sentadilla|goblet|squat/i, 'sentadilla'],
];
const EXPLOSIVOS = new Set(['swing', 'slam', 'salto', 'burpee', 'sprint']);
const AEROBICOS = new Set(['sprint', 'saltar', 'escalador', 'talones']);
const CORE = new Set(['abdominal', 'bicho', 'bird', 'elev_piernas', 'plancha', 'plancha_lat', 'rueda', 'ruso', 'superman', 'escalador']);
const EQUILIBRIO = new Set(['bird', 'bicho', 'zancada', 'subida', 'saltar', 'talones']);

function clasificar(zonaVieja, ilustracion, nombre, intensidad) {
  let pat = null;
  for (const [re, p] of REGLAS_NOMBRE) if (re.test(nombre || '')) { pat = p; break; }
  if (!pat && ilustracion === 'lateral') pat = zonaVieja === 'Glúteos' ? 'bisagra_rodilla' : 'locomocion';
  if (!pat) pat = POR_ILUSTRACION[ilustracion] || POR_ZONA_VIEJA[zonaVieja] || 'sentadilla';
  const cap = new Set();
  if (CORE.has(ilustracion) || pat === 'rotacion') cap.add('core');
  if (EQUILIBRIO.has(ilustracion) || /unipodal|una pierna|a una pierna|equilibrio|inestable|bosu|b[uú]lgara/i.test(nombre || '')) cap.add('equilibrio');
  if (/movilidad|estir|flexibilidad|apertura de cadera/i.test(nombre || '')) cap.add('movilidad');
  if (pat !== 'rotacion' && !CORE.has(ilustracion)) cap.add('fuerza');
  if (!cap.size) cap.add('fuerza');
  const en = new Set();
  if (intensidad === 'alta') en.add('anaerobico'); else en.add('aerobico');
  if (EXPLOSIVOS.has(ilustracion)) en.add('anaerobico');
  if (AEROBICOS.has(ilustracion)) en.add('aerobico');
  return { zona: zonaDeClave(pat), clave: pat, capacidad: aTexto([...cap]), energia: aTexto([...en]) };
}

// Ejercicios nuevos de movilidad y de equilibrio/coordinación (la biblioteca anterior casi no los tenía)
// [patrón, nombre, progresión 1, progresión 2, ilustración, capacidades, energía]
const NUEVOS = [
  ['rotacion', 'Gato-camello en cuadrupedia', 'Gato-camello con rotación torácica', 'Gato-camello con brazo y pierna opuestos extendidos', 'bird', 'movilidad,core', 'aerobico'],
  ['rotacion', 'Rotación torácica en cuadrupedia', 'Rotación torácica con codo al techo', 'Rotación torácica con pausa de 3 segundos', 'bird', 'movilidad', 'aerobico'],
  ['rotacion', 'Giros de columna sentado', 'Giros de columna con brazos cruzados', 'Giros de columna con bastón', 'ruso', 'movilidad', 'aerobico'],
  ['empujar', 'Círculos de hombro', 'Círculos de hombro con brazos extendidos', 'Círculos de hombro amplios con pausa', 'elev_lat', 'movilidad', 'aerobico'],
  ['empujar', 'Apertura de pecho en pared', 'Apertura de pecho con rotación de tronco', 'Apertura de pecho con brazo elevado', 'apertura', 'movilidad', 'aerobico'],
  ['tirar', 'Dislocaciones de hombro con banda', 'Dislocaciones con agarre más cerrado', 'Dislocaciones lentas con pausa atrás', 'pajaro', 'movilidad', 'aerobico'],
  ['sentadilla', 'Sentadilla profunda con apoyo', 'Sentadilla profunda con pausa de 5 segundos', 'Sentadilla profunda con codos empujando rodillas', 'sentadilla', 'movilidad', 'aerobico'],
  ['sentadilla', 'Movilidad de tobillo en pared', 'Movilidad de tobillo con rodilla al frente y pausa', 'Movilidad de tobillo con rebote suave', 'talones', 'movilidad', 'aerobico'],
  ['sentadilla', 'Balanceo de cadera en cuadrupedia (rock back)', 'Rock back con pausa atrás', 'Rock back con una pierna extendida', 'sentadilla', 'movilidad', 'aerobico'],
  ['bisagra_cadera', 'Movilidad de cadera 90/90', '90/90 con cambio de lado fluido', '90/90 con elevación de la pierna delantera', 'puente', 'movilidad', 'aerobico'],
  ['bisagra_cadera', 'Peso muerto rumano sin carga', 'Peso muerto rumano con pausa abajo', 'Peso muerto rumano con brazos arriba', 'bisagra', 'movilidad,fuerza', 'aerobico'],
  ['bisagra_cadera', 'Patada controlada de isquios', 'Patada controlada con manos a la punta del pie', 'Patada controlada caminando', 'elev_piernas', 'movilidad', 'aerobico'],
  ['bisagra_rodilla', 'Estocada con rotación (el mejor estiramiento del mundo)', 'Estocada con rotación y codo al piso', 'Estocada con rotación y elevación de cadera', 'zancada', 'movilidad,equilibrio', 'aerobico'],
  ['bisagra_rodilla', 'Rotación de cadera en cuadrupedia', 'Rotación de cadera con pausa arriba', 'Rotación de cadera con círculo completo', 'lateral', 'movilidad', 'aerobico'],
  ['locomocion', 'Caminata de gusano (inchworm)', 'Inchworm con flexión', 'Inchworm con toque de hombro', 'plancha', 'movilidad,core', 'aerobico'],
  ['bisagra_rodilla', 'Equilibrio sobre un pie', 'Equilibrio sobre un pie con ojos cerrados', 'Equilibrio sobre un pie con giros de cabeza', 'zancada', 'equilibrio', 'aerobico'],
  ['bisagra_cadera', 'Peso muerto a una pierna', 'Peso muerto a una pierna con mancuerna', 'Peso muerto a una pierna con pausa y mancuerna', 'bisagra', 'equilibrio,fuerza', 'aerobico'],
  ['sentadilla', 'Sentadilla unipodal asistida', 'Sentadilla unipodal con apoyo suave', 'Sentadilla unipodal sin apoyo', 'sentadilla', 'equilibrio,fuerza', 'aerobico'],
  ['locomocion', 'Caminata en línea talón-punta', 'Caminata en línea hacia atrás', 'Caminata en línea con giros', 'zancada', 'equilibrio', 'aerobico'],
  ['locomocion', 'Escalera de coordinación: pasos rápidos', 'Escalera con pasos laterales', 'Escalera con cambios de ritmo', 'saltar', 'equilibrio', 'aerobico,anaerobico'],
  ['locomocion', 'Patinador con equilibrio', 'Patinador con pausa de equilibrio', 'Patinador con salto y recepción a un pie', 'lateral', 'equilibrio,fuerza', 'aerobico,anaerobico'],
  ['locomocion', 'Saltos laterales sobre una línea', 'Saltos laterales a un pie', 'Saltos laterales con giro', 'salto', 'equilibrio', 'anaerobico'],
  ['rotacion', 'Elevación de rodilla en equilibrio', 'Elevación de rodilla con brazos opuestos', 'Elevación de rodilla con pausa y giro', 'bird', 'equilibrio,core', 'aerobico'],
  ['rotacion', 'Plancha con toque de hombro alternado', 'Plancha con toque de hombro y pausa', 'Plancha con toque de hombro y pies juntos', 'plancha', 'core,equilibrio', 'aerobico'],
  ['bisagra_rodilla', 'Estocada con toque de suelo', 'Estocada con toque de suelo y salto corto', 'Estocada con toque de suelo a un pie', 'zancada', 'equilibrio,fuerza', 'aerobico'],
];

// Valores iniciales de los formatos (el administrador los cambia en Formatos e Intervalos)
function defaultsFormato(nombre) {
  const por = {
    endurance: ['fuerza,core', 'aerobico'], flex: ['movilidad,equilibrio,core', 'aerobico'], funcional: ['fuerza,core,equilibrio', 'aerobico,anaerobico'],
    hiitcross: ['fuerza,core', 'anaerobico,aerobico'], qdx: ['fuerza,core', 'anaerobico,aerobico'], z7: ['fuerza,core,equilibrio', 'aerobico,anaerobico'],
  };
  const [cap, en] = por[String(nombre || '').toLowerCase()] || ['fuerza,core', 'aerobico,anaerobico'];
  return { patrones: CLAVES.patrones.join(','), capacidades: cap, energias: en };
}

module.exports = { ILUSTRACION, defaultsFormato, PATRONES, CAPACIDADES, ENERGIAS, ZONAS, CLAVES, claveDeZona, zonaDeClave, lista, aTexto, clasificar, NUEVOS };
