'use strict';
// Versión 2: zona Glúteos (50 ejercicios), intensidad cardiovascular, países y campañas de captación.
// Formato: ejercicio base | progresión 1 | progresión 2 | equipo | tipo de movimiento
const L = (t) => t.trim().split('\n').map(l => l.trim()).filter(Boolean).map(l => l.split('|').map(s => s.trim()));

const GLUTEOS = L(`
  Puente de glúteos | Puente de glúteos con pausa de 2 s arriba | Puente de glúteos con una pierna | colchoneta | puente
  Hip thrust con mochila | Hip thrust con mancuerna | Hip thrust con una pierna y mancuerna | mancuerna | puente
  Hip thrust con barra | Hip thrust con barra y pausa | Hip thrust con barra y banda en rodillas | barra_discos | puente
  Puente con banda en rodillas | Puente con banda y pausa arriba | Puente con banda y una pierna | banda_rtx | puente
  Puente con pelota entre rodillas | Puente con pelota y pausa | Puente con pelota y elevación de talones | pelota | puente
  Puente con pies elevados | Puente con pies elevados y pausa | Puente con pies elevados y una pierna | colchoneta | puente
  Patada de glúteo en cuadrupedia | Patada con rodilla flexionada y pausa | Patada con banda en el pie | colchoneta | bird
  Patada de glúteo con banda | Patada con banda y pausa de 2 s | Patada con banda y tobillera de peso | banda_rtx | bird
  Bomba de agua (fire hydrant) | Bomba de agua con banda | Bomba de agua con pausa y banda | colchoneta | bird
  Elevación lateral de pierna acostada | Elevación lateral con banda | Elevación lateral con banda y pausa | colchoneta | bird
  Almeja (clamshell) con banda | Almeja con banda y pausa | Almeja con banda y elevación de caderas | banda_rtx | bird
  Peso muerto rumano con mancuernas | Peso muerto rumano con pausa abajo | Peso muerto rumano a una pierna | mancuerna | bisagra
  Peso muerto rumano con barra | Peso muerto rumano con barra y pausa | Peso muerto rumano con barra y tempo lento | barra_discos | bisagra
  Peso muerto sumo con pesa rusa | Peso muerto sumo con pausa | Peso muerto sumo con pesa rusa y paso lateral | pesa_rusa | bisagra
  Buenos días con banda | Buenos días con banda y pausa | Buenos días con banda y mancuerna | banda_rtx | bisagra
  Buenos días con bolso | Buenos días con bolso y pausa | Buenos días con bolso al pecho | bolso | bisagra
  Peso muerto a una pierna sin peso | Peso muerto a una pierna con mancuerna | Peso muerto a una pierna con pausa | ninguno | bisagra
  Swing con pesa rusa | Swing con pausa arriba | Swing a una mano con cambio de mano | pesa_rusa | swing
  Swing con mancuerna | Swing con mancuerna y pausa | Swing con mancuerna a una mano | mancuerna | swing
  Swing con bolso entre las piernas | Swing con bolso y pausa | Swing con bolso y salto final | bolso | swing
  Sentadilla sumo | Sentadilla sumo con pausa abajo | Sentadilla sumo con salto | ninguno | sentadilla
  Sentadilla sumo con mancuerna | Sentadilla sumo con mancuerna y pausa | Sentadilla sumo con mancuerna y elevación de talones | mancuerna | sentadilla
  Sentadilla con banda en rodillas | Sentadilla con banda y pausa | Sentadilla con banda y salto | banda_rtx | sentadilla
  Sentadilla goblet con pesa rusa | Sentadilla goblet con pausa | Sentadilla goblet con pesa rusa y tempo lento | pesa_rusa | sentadilla
  Sentadilla profunda con pelota en la pared | Sentadilla profunda con pelota y pausa | Sentadilla profunda con pelota y mancuerna | pelota | sentadilla
  Sentadilla con bolso al pecho | Sentadilla con bolso y pausa | Sentadilla con bolso sobre los hombros | bolso | sentadilla
  Zancada reversa | Zancada reversa con mancuernas | Zancada reversa con mancuernas y rodilla arriba | mancuerna | zancada
  Zancada reversa sin peso | Zancada reversa con pausa | Zancada reversa con salto cambiando piernas | ninguno | zancada
  Zancada lateral | Zancada lateral con mancuerna | Zancada lateral con mancuerna y pausa | mancuerna | zancada
  Zancada caminando | Zancada caminando con mancuernas | Zancada caminando con bolso al pecho | bolso | zancada
  Sentadilla búlgara | Sentadilla búlgara con mancuernas | Sentadilla búlgara con pausa abajo | mancuerna | zancada
  Zancada curtsy (cruzada) | Zancada curtsy con mancuerna | Zancada curtsy con banda en rodillas | ninguno | zancada
  Step up al banco con impulso de glúteo | Step up con mancuernas | Step up con mancuernas y rodilla arriba | mancuerna | subida
  Step up lateral | Step up lateral con mancuerna | Step up lateral con banda en rodillas | ninguno | subida
  Step up con bolso | Step up con bolso y pausa | Step up con bolso y salto suave | bolso | subida
  Caminata lateral con banda | Caminata lateral con banda y sentadilla | Caminata lateral con banda baja y pausa | banda_rtx | lateral
  Caminata de monstruo con banda | Caminata de monstruo con banda y sentadilla | Caminata de monstruo con banda baja | banda_rtx | lateral
  Desplazamiento lateral en sentadilla | Desplazamiento lateral con conos | Desplazamiento lateral con banda y conos | conos | lateral
  Pasos laterales rápidos entre conos | Pasos laterales con toque de cono y sentadilla | Pasos laterales con salto al cono | conos | lateral
  Sentadilla con salto | Sentadilla con salto y pausa | Sentadilla con salto amplio hacia adelante | ninguno | salto
  Salto lateral de patinador | Salto lateral de patinador con pausa | Salto lateral de patinador con toque de piso | ninguno | salto
  Elevación de talones con glúteo contraído | Elevación de talones a una pierna | Elevación de talones a una pierna con mancuerna | mancuerna | talones
  Patada hacia atrás de pie con banda | Patada atrás con banda y pausa | Patada atrás con banda y tobillera de peso | banda_rtx | bird
  Abducción de pie con banda | Abducción de pie con banda y pausa | Abducción de pie con banda y media sentadilla | banda_rtx | lateral
  Hiperextensión de cadera en el piso | Hiperextensión con pausa arriba | Hiperextensión con banda en los pies | colchoneta | superman
  Puente de glúteos en una pierna con banda | Puente en una pierna con banda y pausa | Puente en una pierna con banda y mancuerna | banda_rtx | puente
  Sentadilla con pausa y tempo lento | Sentadilla con tempo 4-1-1 y pausa | Sentadilla con tempo lento y mancuerna | ninguno | sentadilla
  Peso muerto con mancuernas y pausa | Peso muerto con mancuernas y tempo lento | Peso muerto con mancuernas y salto suave | mancuerna | bisagra
  Burpee con puente | Burpee con puente y pausa | Burpee con puente y salto | colchoneta | burpee
  Escalador con empuje de glúteo | Escalador con rodilla al codo | Escalador con rodilla al codo y pausa | colchoneta | escalador
  Hip thrust con pelota y banda | Hip thrust con pelota, banda y pausa | Hip thrust con pelota, banda y una pierna | pelota | puente
`);

// Intensidad cardiovascular (baja / moderada / alta) según el tipo de movimiento. Sirve para armar clases HIIT.
const INTENSIDAD_PATRON = {
  sprint: 'alta', saltar: 'alta', salto: 'alta', burpee: 'alta', escalador: 'alta', slam: 'alta', swing: 'alta', lateral: 'alta',
  sentadilla: 'moderada', zancada: 'moderada', subida: 'moderada', puente: 'moderada', bisagra: 'moderada',
  flexion: 'moderada', pica: 'moderada', plancha: 'moderada', fondos: 'moderada', dominada: 'moderada', remo_inv: 'moderada',
};
function intensidadDe(zona, patron, nombre) {
  const n = String(nombre || '').toLowerCase();
  if (/burpee|sprint|salto|saltos|thruster|slam|swing|carrera|escalador/.test(n)) return 'alta';
  if (zona === 'Resistencia aeróbica') return INTENSIDAD_PATRON[patron] === 'moderada' ? 'moderada' : 'alta';
  if (/caminata|bomba de agua|almeja|elevaci[oó]n lateral de pierna|dead bug|bird/.test(n)) return 'baja';
  return INTENSIDAD_PATRON[patron] || 'baja';
}

const PAISES = [
  ['AR', 'Argentina', '54', '🇦🇷'], ['UY', 'Uruguay', '598', '🇺🇾'], ['CL', 'Chile', '56', '🇨🇱'], ['PY', 'Paraguay', '595', '🇵🇾'],
  ['BO', 'Bolivia', '591', '🇧🇴'], ['BR', 'Brasil', '55', '🇧🇷'], ['PE', 'Perú', '51', '🇵🇪'], ['CO', 'Colombia', '57', '🇨🇴'],
  ['EC', 'Ecuador', '593', '🇪🇨'], ['VE', 'Venezuela', '58', '🇻🇪'], ['MX', 'México', '52', '🇲🇽'], ['CR', 'Costa Rica', '506', '🇨🇷'],
  ['PA', 'Panamá', '507', '🇵🇦'], ['GT', 'Guatemala', '502', '🇬🇹'], ['DO', 'República Dominicana', '1', '🇩🇴'], ['US', 'Estados Unidos', '1', '🇺🇸'],
  ['ES', 'España', '34', '🇪🇸'], ['IT', 'Italia', '39', '🇮🇹'], ['FR', 'Francia', '33', '🇫🇷'], ['DE', 'Alemania', '49', '🇩🇪'], ['GB', 'Reino Unido', '44', '🇬🇧'], ['PT', 'Portugal', '351', '🇵🇹'],
];
const CAMPANAS_BASE = [['Instagram', 'normal'], ['Recorrida', 'normal'], ['Recomendado por', 'recomendado'], ['Google / Maps', 'normal'], ['Volanteo', 'normal'], ['Otro', 'normal']];

GLUTEOS.length = Math.min(GLUTEOS.length, 50);

module.exports = { GLUTEOS, intensidadDe, PAISES, CAMPANAS_BASE };
