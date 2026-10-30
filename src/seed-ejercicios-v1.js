'use strict';
// Biblioteca ampliada (Versión 1): hasta 50 ejercicios por zona, con sus progresiones.
// Formato de cada línea:  ejercicio base | progresión 1 | progresión 2 | equipo | tipo de movimiento (para las ilustraciones)
// Equipos: ninguno, colchoneta, pesa_rusa, mancuerna, rueda_abdominal, banda_rtx, pelota, bolso, barra_dominadas, barra_discos, conos
const L = (t) => t.trim().split('\n').map(l => l.trim()).filter(Boolean).map(l => l.split('|').map(s => s.trim()));

const NUEVOS = {
  'Resistencia aeróbica': L(`
    Saltos de tijera con palmada | Saltos de tijera con palmada y toque de pies | Saltos de tijera con palmada y sentadilla | ninguno | saltar
    Carrera de velocidad en el lugar | Carrera de velocidad con brazos al máximo | Carrera de velocidad con cambios de ritmo cada 5 s | ninguno | sprint
    Burpee con flexión | Burpee con flexión y salto | Burpee con flexión, salto y palmada | colchoneta | burpee
    Swing con pesa rusa a la altura del pecho | Swing con pesa rusa a la altura de los ojos | Swing a una mano con cambio de mano | pesa_rusa | swing
    Slam ball alternado | Slam ball con burpee | Slam ball con salto y lanzamiento | pelota | slam
    Saltos laterales sobre una línea | Saltos laterales con una pierna | Saltos laterales con una pierna y toque de piso | ninguno | lateral
    Carrera en zigzag entre conos | Carrera en zigzag con cambio de dirección rápido | Carrera en zigzag de espaldas | conos | lateral
    Shadow boxing | Shadow boxing con desplazamiento | Shadow boxing con sentadilla entre golpes | ninguno | sprint
    Escalador cruzado rápido | Escalador cruzado con pies deslizando | Escalador cruzado con salto | colchoneta | escalador
    Sentadilla con salto y palmada | Sentadilla con salto, palmada y giro | Sentadilla con salto al pecho | ninguno | salto
    Sprint de 5 m ida y vuelta con conos | Sprint de 10 m ida y vuelta con conos | Sprint de 10 m con toque al piso | conos | sprint
    Salto al cajón imaginario | Salto largo hacia adelante | Salto largo con caída en una pierna | ninguno | salto
    Thruster con mancuernas livianas | Thruster con mancuernas y desplazamiento | Thruster con mancuernas y salto | mancuerna | sentadilla
    Swing con bolso | Swing con bolso y pausa arriba | Swing con bolso y paso lateral | bolso | swing
    Cuerda de batalla imaginaria con banda | Banda con ondas alternadas rápidas | Banda con ondas dobles y sentadilla | banda_rtx | saltar
    Carrera con rodillas altas y brazos arriba | Rodillas altas con brazos en cruz | Rodillas altas con salto cada 4 pasos | ninguno | sprint
    Gateo de oso rápido | Gateo de oso lateral | Gateo de oso con toque de rodilla | colchoneta | plancha
    Saltos de rana | Saltos de rana con avance largo | Saltos de rana con flexión intercalada | ninguno | salto
    Patada de sprint (butt kicks) con desplazamiento | Butt kicks con salto | Butt kicks en zigzag | ninguno | sprint
    Press y carrera con pelota | Press de pelota y carrera corta | Press de pelota sobre la cabeza y sprint | pelota | sprint
    Saltos en X | Saltos en X con giro | Saltos en X con sentadilla | ninguno | saltar
    Paso lateral con banda y toque | Paso lateral con banda y sentadilla | Paso lateral con banda y salto | banda_rtx | lateral
    Salto de tijera con mancuernas livianas | Tijera con mancuernas y press | Tijera con mancuernas y sentadilla | mancuerna | saltar
    Burpee con salto al cono | Burpee con salto lateral sobre el cono | Burpee con salto doble sobre conos | conos | burpee
    Arrastre de bolso en carrera | Arrastre de bolso con zancada | Arrastre de bolso con sprint final | bolso | sprint
    Skipper con salto lateral | Skipper con salto lateral y rotación | Skipper con salto lateral y toque de piso | ninguno | lateral
    Remo con salto (rower) | Rower con pausa y salto | Rower con doble salto | ninguno | salto
    Medio burpee con salto de rodillas | Burpee con apertura de piernas | Burpee con rodillas al pecho | colchoneta | burpee
    Lanzamiento de pelota al piso y sprint | Lanzamiento al piso, recepción y sprint | Lanzamiento, burpee y sprint | pelota | slam
    Jumping jacks con banda en rodillas | Jumping jacks con banda y sentadilla | Jumping jacks con banda y salto en cruz | banda_rtx | saltar
  `),
  'Piernas': L(`
    Sentadilla sumo libre | Sentadilla sumo con pausa | Sentadilla sumo con salto | ninguno | sentadilla
    Sentadilla con mancuernas a los lados | Sentadilla con mancuernas y pausa | Sentadilla con mancuernas y salto | mancuerna | sentadilla
    Sentadilla frontal con pelota | Sentadilla frontal con pelota y pausa | Sentadilla frontal con pelota y press arriba | pelota | sentadilla
    Sentadilla con barra en la espalda | Sentadilla con barra y pausa abajo | Sentadilla con barra, pausa y salto suave | barra_discos | sentadilla
    Zancada reversa libre | Zancada reversa con rodilla alta | Zancada reversa con salto | ninguno | zancada
    Zancada reversa con pesa rusa | Zancada reversa con pesa rusa y pausa | Zancada reversa con pesa rusa y rodilla alta | pesa_rusa | zancada
    Zancada frontal con bolso | Zancada frontal con bolso y pausa | Zancada frontal con bolso y salto | bolso | zancada
    Zancada estática con mancuernas | Zancada estática lenta con mancuernas | Zancada estática con salto | mancuerna | zancada
    Sentadilla a una pierna asistida | Sentadilla a una pierna con banda | Sentadilla a una pierna (pistol) | banda_rtx | sentadilla
    Peso muerto con mancuernas | Peso muerto con mancuernas y pausa | Peso muerto con mancuernas y remo | mancuerna | bisagra
    Peso muerto con pesa rusa | Peso muerto con pesa rusa y pausa | Peso muerto con pesa rusa a una mano | pesa_rusa | bisagra
    Peso muerto con bolso | Peso muerto con bolso y pausa | Peso muerto con bolso y salto | bolso | bisagra
    Peso muerto con pelota | Peso muerto con pelota y pausa | Peso muerto con pelota y elevación | pelota | bisagra
    Peso muerto rumano con barra | Peso muerto rumano con barra y pausa | Peso muerto rumano con barra a una pierna | barra_discos | bisagra
    Buenos días con banda | Buenos días con banda y pausa | Buenos días con banda y sentadilla | banda_rtx | bisagra
    Puente de glúteos con banda | Puente de glúteos con banda y pausa | Puente de glúteos con banda a una pierna | banda_rtx | puente
    Puente de glúteos con mancuerna | Puente con mancuerna y pausa | Puente con mancuerna a una pierna | mancuerna | puente
    Puente de glúteos con pelota entre rodillas | Puente con pelota y pausa | Puente con pelota y pies elevados | pelota | puente
    Patada de glúteo en cuadrupedia | Patada de glúteo con pausa | Patada de glúteo con banda | colchoneta | puente
    Step up lateral | Step up lateral con mancuernas | Step up lateral con salto | mancuerna | subida
    Step up con pesa rusa | Step up con pesa rusa y rodilla alta | Step up con pesa rusa y salto | pesa_rusa | subida
    Sentadilla lateral (cossack) | Cossack con pesa rusa | Cossack con salto lateral | pesa_rusa | zancada
    Caminata lateral con banda | Caminata lateral con banda en sentadilla | Caminata lateral con banda y salto | banda_rtx | lateral
    Sentadilla con pausa y rebote | Sentadilla con pausa de 5 s | Sentadilla con pausa y salto máximo | ninguno | sentadilla
    Salto al cajón imaginario con aterrizaje suave | Salto con aterrizaje a una pierna | Salto con aterrizaje y giro | ninguno | salto
    Elevación de talones con pausa | Elevación de talones con pausa y pelota entre tobillos | Elevación de talones en una pierna con pausa | pelota | talones
    Elevación de talones con barra | Elevación con barra y pausa | Elevación con barra a una pierna | barra_discos | talones
    Sentadilla hacia la pared con bolso | Sentadilla con bolso y pausa isométrica | Sentadilla con bolso y elevación de talones | bolso | sentadilla
    Zancada caminando con bolso | Zancada caminando con bolso al pecho | Zancada caminando con bolso sobre la cabeza | bolso | zancada
    Sentadilla goblet con mancuerna | Goblet con mancuerna y pausa | Goblet con mancuerna y salto | mancuerna | sentadilla
  `),
  'Core': L(`
    Plancha sobre antebrazos | Plancha con elevación alterna de pie | Plancha con elevación alterna de pie y brazo | colchoneta | plancha
    Plancha alta con toque de rodilla | Plancha alta con rodilla al codo | Plancha alta con rodilla al codo contrario | colchoneta | plancha
    Plancha con desplazamiento lateral | Plancha con desplazamiento lateral y toque | Plancha con desplazamiento lateral con bolso | colchoneta | plancha
    Plancha con pelota bajo los antebrazos | Plancha con pelota y círculos | Plancha con pelota, círculos y pies juntos | pelota | plancha
    Plancha lateral con rodilla apoyada | Plancha lateral con pierna elevada | Plancha lateral con pierna elevada y brazo arriba | colchoneta | plancha_lat
    Crunch inverso | Crunch inverso con pausa | Crunch inverso con piernas extendidas | colchoneta | elev_piernas
    Crunch con pelota entre rodillas | Crunch con pelota y pausa | Crunch con pelota y toque de pies | pelota | abdominal
    Crunch oblicuo | Crunch oblicuo con pausa | Crunch oblicuo con codo a rodilla | colchoneta | abdominal
    Abdominal con banda | Abdominal con banda y pausa | Abdominal con banda y rotación | banda_rtx | abdominal
    Elevación de rodillas colgado de la barra | Elevación de rodillas con pausa | Elevación de piernas rectas a la barra | barra_dominadas | elev_piernas
    Elevación de piernas alternada | Elevación de piernas alternada con pausa | Elevación de piernas con pelota | colchoneta | elev_piernas
    Dead bug con pelota | Dead bug con pelota y pausa | Dead bug con pelota y banda | pelota | bicho
    Bird dog con peso | Bird dog con mancuerna liviana | Bird dog con mancuerna y pausa | mancuerna | bird
    Rueda abdominal con tope en la pared | Rueda abdominal desde las rodillas con pausa | Rueda abdominal desde las rodillas completa | rueda_abdominal | rueda
    Russian twist con mancuerna | Russian twist con mancuerna y pies elevados | Russian twist con mancuerna y pausa lateral | mancuerna | ruso
    Russian twist con pesa rusa | Russian twist con pesa rusa y pies elevados | Russian twist con pesa rusa y pausa | pesa_rusa | ruso
    Russian twist con bolso | Russian twist con bolso y pies elevados | Russian twist con bolso y pausa lateral | bolso | ruso
    Tocar el cono en V-sit | V-sit con toque de cono alterno | V-sit con toque de cono y pausa | conos | ruso
    Plancha con remo de mancuerna | Plancha con remo y pies juntos | Plancha con remo y flexión | mancuerna | plancha
    Plancha con arrastre de pesa rusa | Plancha con arrastre de pesa rusa más pesada | Plancha con arrastre y toque de hombro | pesa_rusa | plancha
    Leñador de pie con pelota | Leñador con pelota y sentadilla | Leñador con pelota y salto | pelota | ruso
    Pallof press con banda de pie | Pallof press con banda y pausa | Pallof press con banda y rotación | banda_rtx | ruso
    Anti-rotación con banda en rodillas | Anti-rotación con banda y pausa | Anti-rotación con banda a una rodilla | banda_rtx | ruso
    Hollow hold con brazos arriba | Hollow hold con brazos arriba y balanceo | Hollow hold con mancuerna liviana | colchoneta | abdominal
    Puente sobre antebrazos con elevación de pierna | Puente con elevación y pausa | Puente con elevación y rotación | colchoneta | plancha
    Mountain climber lento con control | Mountain climber lento con pausa | Mountain climber con pies en deslizadores improvisados | colchoneta | escalador
    Caminata de oso con bolso | Caminata de oso con bolso y pausa | Caminata de oso con bolso en espalda | bolso | plancha
    Abdominales en V con pelota | V-up con pelota y pausa | V-up con pelota y paso | pelota | abdominal
    Rotación de tronco acostado con pelota | Rotación con pelota y pies elevados | Rotación con pelota y pausa | pelota | ruso
    Elevación de cadera en plancha invertida | Plancha invertida con pierna elevada | Plancha invertida con pierna elevada y pausa | colchoneta | puente
    Sit-up con mancuerna | Sit-up con mancuerna y rotación | Sit-up con mancuerna y press | mancuerna | abdominal
  `),
  'Espalda': L(`
    Remo con mancuernas a dos manos | Remo con mancuernas y pausa | Remo con mancuernas y retracción de escápulas | mancuerna | remo_inc
    Remo apoyado con mancuerna | Remo apoyado con pausa | Remo apoyado con rotación | mancuerna | remo_inc
    Remo con barra supino | Remo con barra supino y pausa | Remo con barra supino y salto de cadera | barra_discos | remo_inc
    Remo Yates con barra | Remo Yates con pausa | Remo Yates con ritmo lento | barra_discos | remo_inc
    Remo de pie con banda | Remo de pie con banda y pausa | Remo de pie con banda a una mano | banda_rtx | tiron
    Remo con banda desde sentado | Remo sentado con banda y pausa | Remo sentado con banda, pausa y rotación | banda_rtx | tiron
    Jalón con banda de rodillas | Jalón con banda de rodillas y pausa | Jalón con banda a una mano | banda_rtx | tiron
    Dominada negativa | Dominada negativa lenta | Dominada negativa con pausa | barra_dominadas | dominada
    Dominada con agarre neutro asistida | Dominada neutra con menos ayuda | Dominada con agarre neutro | barra_dominadas | dominada
    Colgado activo de la barra | Colgado activo con elevación de rodillas | Colgado activo con pausa a un brazo | barra_dominadas | dominada
    Remo invertido con rodillas flexionadas | Remo invertido con piernas extendidas | Remo invertido con pausa | barra_dominadas | remo_inv
    Remo invertido con agarre supino | Remo invertido supino y pausa | Remo invertido supino con pies elevados | barra_dominadas | remo_inv
    Pájaro con mancuernas | Pájaro con pausa | Pájaro alternado | mancuerna | pajaro
    Pájaro con banda | Pájaro con banda y pausa | Pájaro con banda y rotación | banda_rtx | pajaro
    Elevación en T boca abajo | T boca abajo con pausa | T boca abajo con mancuernas livianas | colchoneta | superman
    Superman con elevación alterna | Superman alterno con pausa | Superman alterno con banda | colchoneta | superman
    Natación en el piso | Natación con pausa | Natación con mancuernas livianas | colchoneta | superman
    Remo con pesa rusa a dos manos | Remo con pesa rusa y pausa | Remo con pesa rusa y salto de cadera | pesa_rusa | remo_inc
    Remo en plancha con pesa rusa | Remo en plancha con pausa | Remo en plancha con flexión | pesa_rusa | plancha
    Remo con bolso a una mano | Remo con bolso a una mano y pausa | Remo con bolso a una mano y rotación | bolso | remo_inc
    Peso muerto con remo | Peso muerto con remo y pausa | Peso muerto con remo a una pierna | mancuerna | bisagra
    Remo con pelota entre las manos | Remo con pelota y pausa | Remo con pelota y rotación | pelota | remo_inc
    Pullover con banda | Pullover con banda y pausa | Pullover con banda a una mano | banda_rtx | pullover
    Pullover con pesa rusa | Pullover con pesa rusa y pausa | Pullover con pesa rusa y puente | pesa_rusa | pullover
    Encogimientos de hombros con mancuernas | Encogimientos con pausa | Encogimientos con pausa y elevación de talones | mancuerna | remo_menton
    Hiperextensión con mancuerna | Hiperextensión con mancuerna y pausa | Hiperextensión con mancuerna y brazos en Y | mancuerna | superman
    Remo con barra y pausa en el pecho | Remo con barra, pausa y 3 s de bajada | Remo con barra a un solo lado | barra_discos | remo_inc
    Retracción de escápulas en el piso | Retracción con pausa de 5 s | Retracción con banda | banda_rtx | superman
    Remo en cuadrupedia con mancuerna | Remo en cuadrupedia con pausa | Remo en cuadrupedia con rotación | mancuerna | remo_inc
    Buenos días con pelota | Buenos días con pelota y pausa | Buenos días con pelota y sentadilla | pelota | bisagra
    Remo inclinado con bolso | Remo inclinado con bolso y pausa | Remo inclinado con bolso y remo final | bolso | remo_inc
  `),
  'Pecho': L(`
    Flexiones con manos separadas | Flexiones anchas con pausa | Flexiones anchas con pausa y palmada | colchoneta | flexion
    Flexiones con pies elevados | Flexiones con pies elevados y pausa | Flexiones con pies elevados y un pie levantado | colchoneta | flexion
    Flexiones con una mano sobre pelota | Flexiones con una mano sobre pelota y pausa | Flexiones con una mano sobre pelota y rotación | pelota | flexion
    Flexiones con banda en la espalda | Flexiones con banda y pausa | Flexiones con banda y toque de hombro | banda_rtx | flexion
    Flexiones con bolso en la espalda | Flexiones con bolso y pausa | Flexiones con bolso y toque de hombro | bolso | flexion
    Flexiones con manos en mancuernas | Flexiones con mancuernas y pausa | Flexiones con mancuernas y remo | mancuerna | flexion
    Flexiones con salto de manos | Flexiones con despegue de manos y pausa | Flexiones con palmada | colchoneta | flexion
    Flexiones escalonadas | Flexiones escalonadas y pausa | Flexiones escalonadas con cambio de mano | pelota | flexion
    Flexiones con pausa a mitad de recorrido | Flexiones con pausa a mitad y abajo | Flexiones con tres pausas | colchoneta | flexion
    Press de piso con mancuernas y puente | Press de piso con puente y pausa | Press de piso con puente a una pierna | mancuerna | press_piso
    Press de piso con una mancuerna | Press de piso con una mancuerna y pausa | Press de piso con una mancuerna y rotación | mancuerna | press_piso
    Press de piso con pelota entre las manos | Press de piso con pelota y pausa | Press de piso con pelota y lanzamiento | pelota | press_piso
    Press de piso con pelota (agarre cerrado) | Press de piso con pelota y pausa lenta | Press con pelota y rebote | pelota | press_piso
    Press de piso con barra agarre ancho | Press de piso con barra ancho y pausa | Press de piso con barra ancho, pausa y lentitud | barra_discos | press_piso
    Aperturas con mancuernas y puente | Aperturas con puente y pausa | Aperturas con puente a una pierna | mancuerna | apertura
    Aperturas con banda en el piso | Aperturas con banda y pausa | Aperturas con banda a una mano | banda_rtx | apertura
    Aperturas con pesas rusas | Aperturas con pesas rusas y pausa | Aperturas con pesas rusas alternadas | pesa_rusa | apertura
    Press con banda de pie, alternado | Press con banda alternado y pausa | Press con banda alternado y paso | banda_rtx | empuje
    Press de pecho con banda desde las rodillas | Press con banda desde rodillas y pausa | Press con banda desde rodillas y rotación | banda_rtx | empuje
    Empuje de bolso desde el pecho | Empuje de bolso y pausa | Empuje de bolso con paso | bolso | empuje
    Lanzamiento de pelota desde el pecho | Lanzamiento de pelota con paso | Lanzamiento de pelota con sentadilla | pelota | empuje
    Flexiones con toque de rodilla | Flexiones con toque de rodilla y pausa | Flexiones con toque de rodilla al codo | colchoneta | flexion
    Flexiones tipo Spiderman | Flexiones Spiderman y pausa | Flexiones Spiderman con pausa abajo | colchoneta | flexion
    Flexiones con rotación y elevación de pierna | Flexiones con rotación y pierna elevada | Flexiones con rotación, pierna elevada y pausa | colchoneta | flexion
    Pullover con barra | Pullover con barra y pausa | Pullover con barra y puente | barra_discos | pullover
    Press inclinado con mancuernas (apoyado en pelota) | Press inclinado con pausa | Press inclinado alternado | mancuerna | press_piso
    Flexión con apoyo en una pierna | Flexión a una pierna y pausa | Flexión a una pierna y rotación | colchoneta | flexion
    Cruces de pecho con bolsos | Cruces con bolsos y pausa | Cruces con bolsos y paso | bolso | apertura
    Press unilateral con pesa rusa | Press unilateral con pesa rusa y pausa | Press unilateral con pesa rusa y puente | pesa_rusa | press_piso
    Flexiones en pared con pausa | Flexiones en pared a una mano | Flexiones en pared con salto | pelota | flexion
  `),
  'Bíceps': L(`
    Curl alternado con mancuernas | Curl alternado y pausa a 90° | Curl alternado con rotación y pausa | mancuerna | curl
    Curl de martillo alternado | Curl martillo alternado y pausa | Curl martillo alternado en sentadilla | mancuerna | curl
    Curl con mancuernas y elevación de talones | Curl con elevación y pausa | Curl con elevación a una pierna | mancuerna | curl
    Curl sentado en la pelota | Curl sentado con pausa | Curl sentado alternado lento | mancuerna | curl
    Curl con barra agarre estrecho | Curl estrecho y pausa | Curl estrecho con tempo lento | barra_discos | curl
    Curl con barra y bajada lenta | Curl con barra y bajada de 4 s | Curl con barra, bajada lenta y pausa | barra_discos | curl
    Curl con banda de pie | Curl con banda de pie y pausa | Curl con banda a una mano y pausa | banda_rtx | curl
    Curl de martillo con banda | Curl martillo con banda y pausa | Curl martillo con banda a una mano | banda_rtx | curl
    Curl con banda pisada en sentadilla | Curl con banda y sentadilla | Curl con banda, sentadilla y pausa | banda_rtx | curl
    Curl con pesa rusa a una mano | Curl con pesa rusa a una mano y pausa | Curl con pesa rusa a una mano y rotación | pesa_rusa | curl
    Curl con dos pesas rusas | Curl con dos pesas rusas y pausa | Curl con dos pesas rusas en zancada | pesa_rusa | curl
    Curl de bolso al pecho | Curl de bolso y pausa | Curl de bolso con elevación de talones | bolso | curl
    Curl con bolso agarrado de las asas | Curl con bolso y pausa a 90° | Curl con bolso a una mano | bolso | curl
    Curl con pelota entre las manos | Curl con pelota y pausa | Curl con pelota en sentadilla | pelota | curl
    Dominada supina negativa | Dominada supina negativa lenta | Dominada supina negativa con pausa | barra_dominadas | dominada
    Colgado supino con flexión de codos | Colgado supino con pausa arriba | Colgado supino con pausa y descenso lento | barra_dominadas | dominada
    Curl con mancuernas y press | Curl y press con pausa | Curl y press alternado | mancuerna | curl
    Curl concentrado con banda | Curl concentrado con banda y pausa | Curl concentrado con banda isométrico | banda_rtx | curl
    Curl en predicador sobre pelota | Curl predicador sobre pelota y pausa | Curl predicador sobre pelota alternado | mancuerna | curl
    Curl araña (inclinado hacia adelante) | Curl araña con pausa | Curl araña alternado | mancuerna | curl
    Curl cruzado con banda | Curl cruzado con banda y pausa | Curl cruzado con banda alternado | banda_rtx | curl
    Curl con mancuernas en bisagra | Curl en bisagra y pausa | Curl en bisagra alternado | mancuerna | curl
    Curl inverso con barra | Curl inverso con barra y pausa | Curl inverso con barra y bajada lenta | barra_discos | curl
    Curl inverso con mancuernas | Curl inverso con mancuernas y pausa | Curl inverso con mancuernas alternado | mancuerna | curl
    Curl con pesa rusa invertida (bottoms-up) | Curl invertido con pausa | Curl invertido a una mano | pesa_rusa | curl
    Curl isométrico en puerta | Curl isométrico a 90° con banda | Curl isométrico alternado con banda | banda_rtx | curl
    Curl de martillo con pelota | Curl martillo con pelota y pausa | Curl martillo con pelota alternado | pelota | curl
    Curl en sentadilla isométrica | Curl en sentadilla isométrica y pausa | Curl en sentadilla isométrica alternado | mancuerna | curl
    Remo supino con mancuernas | Remo supino con pausa | Remo supino y curl | mancuerna | remo_inc
    Curl con bolso sobre un hombro | Curl con bolso sobre el hombro y pausa | Curl con bolso sobre el hombro alternado | bolso | curl
  `),
  'Tríceps': L(`
    Fondos en banco improvisado (pelota) | Fondos con una pierna extendida | Fondos con una pierna extendida y pausa | pelota | fondos
    Fondos en el piso con pausa | Fondos en el piso con pausa y pies lejos | Fondos en el piso con una pierna elevada | colchoneta | fondos
    Extensión de tríceps acostado con mancuernas | Extensión acostado con pausa | Extensión acostado alternada | mancuerna | ext_tri
    Extensión de tríceps con barra acostado | Extensión con barra y pausa | Extensión con barra y bajada lenta | barra_discos | ext_tri
    Press cerrado con mancuernas en el piso | Press cerrado con pausa | Press cerrado alternado | mancuerna | press_piso
    Press cerrado con pelota | Press cerrado con pelota y pausa | Press cerrado con pelota y bajada lenta | pelota | press_piso
    Press cerrado con banda | Press cerrado con banda y pausa | Press cerrado con banda a una mano | banda_rtx | empuje
    Extensión sobre la cabeza con banda | Extensión sobre la cabeza con banda y pausa | Extensión sobre la cabeza con banda a una mano | banda_rtx | ext_tri
    Extensión sobre la cabeza con bolso | Extensión con bolso y pausa | Extensión con bolso a una mano | bolso | ext_tri
    Extensión con dos manos sobre la cabeza (mancuerna) | Extensión con dos manos y pausa | Extensión con dos manos en sentadilla | mancuerna | ext_tri
    Patada de tríceps con pesa rusa | Patada con pesa rusa y pausa | Patada con pesa rusa alternada | pesa_rusa | patada_tri
    Patada de tríceps con bolso | Patada con bolso y pausa | Patada con bolso alternada | bolso | patada_tri
    Patada de tríceps en bisagra con ambas manos | Patada doble con pausa | Patada doble con pausa y bajada lenta | mancuerna | patada_tri
    Flexiones cerradas con manos en pelota | Flexiones cerradas con pelota y pausa | Flexiones cerradas con pelota y toque de hombro | pelota | flexion
    Flexiones con manos juntas y codos pegados | Flexiones codos pegados y pausa | Flexiones codos pegados con una mano más adelante | colchoneta | flexion
    Flexión pica con pausa | Flexión pica con pies elevados y pausa | Flexión pica con pies elevados y bajada lenta | colchoneta | pica
    Press de tríceps con barra invertido | Press invertido y pausa | Press invertido con tempo lento | barra_discos | press_piso
    Press con banda sobre la cabeza | Press con banda sobre la cabeza y pausa | Press con banda sobre la cabeza a una mano | banda_rtx | ext_tri
    Extensión de tríceps con pesa rusa acostado | Extensión con pesa rusa acostado y pausa | Extensión con pesa rusa acostado a una mano | pesa_rusa | ext_tri
    Fondos entre dos pelotas | Fondos entre dos pelotas y pausa | Fondos entre dos pelotas con pierna elevada | pelota | fondos
    Fondos con bolso sobre las piernas | Fondos con bolso y pausa | Fondos con bolso y pierna elevada | bolso | fondos
    Extensión unilateral con banda | Extensión unilateral y pausa | Extensión unilateral con rotación | banda_rtx | ext_tri
    Press landmine a una mano (tríceps) | Press landmine y pausa | Press landmine con tempo lento | barra_discos | empuje
    Flexión diamante con pies elevados | Flexión diamante con pies elevados y pausa | Flexión diamante con pies elevados y un pie levantado | colchoneta | flexion
    Extensión de codos en el piso con banda | Extensión en el piso con banda y pausa | Extensión en el piso con banda a una mano | banda_rtx | press_piso
    Press neutro con mancuernas y puente | Press neutro con puente y pausa | Press neutro con puente a una pierna | mancuerna | press_piso
    Press francés con bolso | Press francés con bolso y pausa | Press francés con bolso y bajada lenta | bolso | ext_tri
    Press francés con pesa rusa | Press francés con pesa rusa y pausa | Press francés con pesa rusa a una mano | pesa_rusa | ext_tri
    Flexión con una mano atrás de la espalda | Flexión con una mano atrás y pausa | Flexión con una mano atrás y tempo lento | colchoneta | flexion
    Extensión de tríceps con pelota en la pared | Extensión con pelota y pausa | Extensión con pelota a una mano | pelota | ext_tri
    Fondos con pies en mancuernas | Fondos con pies en mancuernas y pausa | Fondos con pies en mancuernas y una pierna elevada | mancuerna | fondos
  `),
  'Hombros': L(`
    Press militar con mancuernas | Press militar con pausa arriba | Press militar alternado | mancuerna | press_vert
    Press militar con pesa rusa | Press militar con pesa rusa y pausa | Press militar con pesa rusa a una mano | pesa_rusa | press_vert
    Press militar con barra | Press militar con barra y pausa | Press militar con barra a ritmo lento | barra_discos | press_vert
    Press militar con bolso | Press militar con bolso y pausa | Press militar con bolso a una mano | bolso | press_vert
    Press militar con pelota | Press militar con pelota y pausa | Press militar con pelota y sentadilla | pelota | press_vert
    Press militar con banda de pie | Press militar con banda y pausa | Press militar con banda a una mano | banda_rtx | press_vert
    Press militar sentado en la pelota | Press sentado en pelota y pausa | Press sentado en pelota alternado | mancuerna | press_vert
    Press Arnold | Press Arnold con pausa | Press Arnold alternado | mancuerna | press_vert
    Push press con mancuernas | Push press con pausa abajo | Push press con salto | mancuerna | press_vert
    Push press con barra | Push press con barra y pausa | Push press con barra y salto suave | barra_discos | press_vert
    Push press con pesa rusa | Push press con pesa rusa y pausa | Push press con pesa rusa a una mano | pesa_rusa | press_vert
    Push press con bolso | Push press con bolso y pausa | Push press con bolso y sentadilla | bolso | press_vert
    Thruster con pesa rusa | Thruster con pesa rusa y pausa | Thruster con pesa rusa y salto | pesa_rusa | press_vert
    Press en zancada con mancuernas | Press en zancada con pausa | Press en zancada alternada | mancuerna | press_vert
    Press de rodillas (media caballero) con mancuerna | Press de media caballero con pausa | Press de media caballero con rotación | mancuerna | press_vert
    Press landmine de pie | Press landmine a una mano | Press landmine con sentadilla | barra_discos | press_vert
    Press landmine de rodillas | Press landmine de rodillas y pausa | Press landmine de rodillas a una mano | barra_discos | press_vert
    Elevaciones laterales con mancuernas | Elevaciones laterales con pausa arriba | Elevaciones laterales alternadas lentas | mancuerna | elev_lat
    Elevaciones laterales con banda | Elevaciones laterales con banda y pausa | Elevaciones laterales con banda a una mano | banda_rtx | elev_lat
    Elevaciones laterales con bolsos | Elevaciones laterales con bolsos y pausa | Elevaciones laterales con bolsos y sentadilla | bolso | elev_lat
    Elevaciones laterales con pelota | Elevaciones laterales con pelota y pausa | Elevaciones laterales con pelota y elevación de talones | pelota | elev_lat
    Elevaciones laterales inclinadas | Elevaciones laterales inclinadas y pausa | Elevaciones laterales inclinadas alternadas | mancuerna | elev_lat
    Elevación lateral parcial 21 | Elevación lateral 21 con pausa | Elevación lateral 21 alternada | mancuerna | elev_lat
    Elevaciones frontales con mancuernas | Elevaciones frontales con pausa | Elevaciones frontales alternadas lentas | mancuerna | elev_front
    Elevaciones frontales con banda | Elevaciones frontales con banda y pausa | Elevaciones frontales con banda a una mano | banda_rtx | elev_front
    Elevaciones frontales con pelota | Elevaciones frontales con pelota y pausa | Elevaciones frontales con pelota y sentadilla | pelota | elev_front
    Elevación frontal con disco/barra | Elevación frontal con barra y pausa | Elevación frontal con barra a ritmo lento | barra_discos | elev_front
    Elevación frontal con pesa rusa | Elevación frontal con pesa rusa y pausa | Elevación frontal con pesa rusa alternada | pesa_rusa | elev_front
    Elevación frontal con bolso | Elevación frontal con bolso y pausa | Elevación frontal con bolso y sentadilla | bolso | elev_front
    Elevación en Y con banda | Elevación en Y con banda y pausa | Elevación en Y con banda a una mano | banda_rtx | elev_front
    Elevación en Y boca abajo | Elevación en Y con pausa | Elevación en Y con mancuernas livianas | colchoneta | superman
    Remo al mentón con mancuernas | Remo al mentón con pausa | Remo al mentón con pausa y bajada lenta | mancuerna | remo_menton
    Remo al mentón con barra | Remo al mentón con barra y pausa | Remo al mentón con barra y tempo lento | barra_discos | remo_menton
    Remo al mentón con banda | Remo al mentón con banda y pausa | Remo al mentón con banda a una mano | banda_rtx | remo_menton
    Remo al mentón con pesa rusa | Remo al mentón con pesa rusa y pausa | Remo al mentón con pesa rusa a una mano | pesa_rusa | remo_menton
    Pájaro de hombro posterior con mancuernas | Pájaro posterior con pausa | Pájaro posterior alternado | mancuerna | pajaro
    Pájaro posterior con banda | Pájaro posterior con banda y pausa | Pájaro posterior con banda a una mano | banda_rtx | pajaro
    Face pull con banda alta | Face pull con banda alta y pausa | Face pull con banda alta y rotación | banda_rtx | tiron
    Rotación externa con banda | Rotación externa con banda y pausa | Rotación externa con banda a una rodilla | banda_rtx | tiron
    Flexión pica | Flexión pica con pausa | Flexión pica con pies elevados | colchoneta | pica
    Flexión pica con manos en mancuernas | Flexión pica con mancuernas y pausa | Flexión pica con mancuernas y pies elevados | mancuerna | pica
    Parada de manos contra la pared (hold) | Parada de manos con pausa y flexión parcial | Parada de manos con flexiones | colchoneta | pica
    Press unilateral con mancuerna y rotación | Press unilateral con rotación y pausa | Press unilateral con rotación en zancada | mancuerna | press_vert
    Press de hombros con pesa rusa invertida | Press invertido con pausa | Press invertido a una mano | pesa_rusa | press_vert
    Círculos de brazos con mancuernas livianas | Círculos con mancuernas y pausa | Círculos con mancuernas y sentadilla | mancuerna | elev_lat
    Carga de pelota sobre la cabeza (caminata) | Caminata con pelota sobre la cabeza y pausa | Caminata con pelota sobre la cabeza en zancada | pelota | press_vert
    Caminata con bolso sobre la cabeza | Caminata con bolso en un brazo | Caminata con bolso en un brazo en zancada | bolso | press_vert
    Elevación lateral con pesa rusa | Elevación lateral con pesa rusa y pausa | Elevación lateral con pesa rusa alternada | pesa_rusa | elev_lat
    Elevación lateral con barra (landmine) | Elevación lateral landmine y pausa | Elevación lateral landmine a una mano | barra_discos | elev_lat
    Encogimiento y press (hombro completo) | Encogimiento y press con pausa | Encogimiento, press y descenso lento | mancuerna | press_vert
    Flexión con toque de hombro en pica | Pica con toque de hombro y pausa | Pica con toque de hombro y pies elevados | colchoneta | pica
  `),
};

// Tipo de movimiento de los 140 ejercicios originales (para las ilustraciones). Se aplica la primera regla que coincida.
const REGLAS_PATRON = [
  [/burpee/, 'burpee'], [/mountain/, 'escalador'], [/jumping|tijeras de salto/, 'saltar'],
  [/swing/, 'swing'], [/slam/, 'slam'], [/thruster/, 'sentadilla'], [/bear crawl/, 'plancha'],
  [/patinador|desplazamiento lateral|pasos laterales/, 'lateral'],
  [/sentadilla con salto/, 'salto'],
  [/trote|rodillas altas|skipping|sprint|carrera|talones al gl|soga|saltos de esqu/, 'sprint'],
  [/elevaci[oó]n de talones/, 'talones'],
  [/hip thrust|puente/, 'puente'], [/step up|subida/, 'subida'],
  [/zancada|b[uú]lgara/, 'zancada'], [/peso muerto|buenos d/, 'bisagra'],
  [/plancha lateral/, 'plancha_lat'], [/bird dog/, 'bird'], [/plancha|get-up/, 'plancha'],
  [/dead bug/, 'bicho'], [/rueda/, 'rueda'], [/russian|le[ñn]ador|pallof/, 'ruso'],
  [/elevaci[oó]n de piernas|tijera abdominal|limpiaparabrisas/, 'elev_piernas'],
  [/crunch|sit-up|toque de talones|bicicleta|v-ups|hollow/, 'abdominal'],
  [/remo invertido/, 'remo_inv'], [/dominada/, 'dominada'],
  [/superman|hiperext|y-t-w/, 'superman'], [/pull apart|face pull|jal[oó]n/, 'tiron'],
  [/pullover/, 'pullover'], [/remo/, 'remo_inc'],
  [/apertura/, 'apertura'], [/cruces|press de pecho con banda|empuje/, 'empuje'],
  [/pica|pike/, 'pica'], [/flexi/, 'flexion'], [/fondos/, 'fondos'], [/patada/, 'patada_tri'],
  [/extensi[oó]n|press franc/, 'ext_tri'], [/curl/, 'curl'], [/press/, 'press_piso'],
  [/sentadilla/, 'sentadilla'],
];
const PATRON_ZONA = { 'Resistencia aeróbica': 'sprint', 'Piernas': 'sentadilla', 'Core': 'abdominal', 'Espalda': 'remo_inc', 'Pecho': 'flexion', 'Bíceps': 'curl', 'Tríceps': 'ext_tri', 'Hombros': 'press_vert', 'Glúteos': 'puente' };
function patronDe(zona, nombre) {
  const n = String(nombre || '').toLowerCase();
  for (const [rx, p] of REGLAS_PATRON) if (rx.test(n)) return p;
  return PATRON_ZONA[zona] || 'sentadilla';
}

// Meta: exactamente 50 ejercicios por zona
const META = 50;
const { E: ORIGINALES } = require('./seed-ejercicios');
for (const z of Object.keys(NUEVOS)) NUEVOS[z] = NUEVOS[z].slice(0, META - (ORIGINALES[z] || []).length);

module.exports = { NUEVOS, patronDe, PATRON_ZONA, META };
