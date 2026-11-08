# OMEGA · Historial de versiones

## Versión 11 · revisión 8
- El QR de los alumnos pasa solo a la dirección de la nube actual: si la PC tenía guardada una dirección vieja de Render, al actualizar se reemplaza (una dirección propia no se toca). Así, instalar en la PC del gimnasio alcanza para que el QR apunte al servidor nuevo.
- Instalador de producción y de pruebas: mismo código, solo cambian la dirección y la clave de la nube que traen.

Cada modificación que se pide genera una **versión nueva** (1, 2, 3…) a partir de la anterior. Las versiones anteriores quedan guardadas intactas en `OMEGA-versiones/Version-N/` (código fuente, instalador y versión de prueba). Los datos del gimnasio (`C:\OMEGA\datos`) se conservan al pasar de una versión a otra; antes de usar una versión nueva por primera vez OMEGA hace una copia de seguridad automática.

## Versión 11 · revisión 7 — 08/11/2026 (en preparación, sin publicar)
- La nube acepta, además de `SYNC_CLAVE`, una o varias claves anteriores (`SYNC_CLAVE_ANTERIOR`, separadas por coma): las PC con instalaciones viejas pueden sincronizar y actualizarse con su clave de siempre. Hay que quitar esa variable cuando ya no queden PC viejas.

## Versión 11 · revisión 6 — 08/11/2026
- Corrección: al correr una versión descargada de la web, la conexión incluida en el instalador (dirección y clave) no se encontraba y se volvía a leer el `nube.txt` viejo, por lo que la nube rechazaba la clave. Ahora se lee de la carpeta del programa instalado.

## Versión 11 · revisión 5 — 08/11/2026
- Dirección de respaldo: el archivo `nube.json` de GitHub (sin claves) dice cuál es la nube vigente. Si la nube que usa la PC deja de existir (se cambió de servidor), la PC lee ese archivo, comprueba que el servidor nuevo conoce la clave de sincronización (prueba firmada) y pasa a usarlo sola, tanto para sincronizar como para buscar actualizaciones. Un puntero falso no desvía a la PC porque el servidor no conoce la clave.
- Para mudar de servidor: crear el servicio nuevo en Render con la MISMA `SYNC_CLAVE` y cambiar la `url` de `nube.json`.

## Versión 11 · revisión 4 — 07/11/2026
- Se elimina el archivo Actualizador: las PC se actualizan solas desde la aplicación web (Render). El botón **Buscar actualización** compara la versión instalada con la última publicada en la web; si hay una nueva la descarga y reinicia OMEGA en un paso, y si ya está al día muestra el cartel "Ya tenés la versión más actualizada".
- Se muestra la versión instalada y de dónde viene (instalador o descargada de la web).
- Solo queda el Instalador Base (PC nueva). Lo que cambia en el programa de escritorio (ventana de Electron / lectura de WhatsApp) sigue necesitando el Instalador Base.

## Versión 11 · revisión 3 — 06/11/2026
- Corrección: la conexión incluida en el instalador tiene prioridad sobre un `nube.txt` viejo (que apuntaba al servicio anterior con otra clave y hacía que la nube rechazara la sincronización).

## Versión 11 · revisión 2 — 06/11/2026
- Instalación sin pasos de conexión: el instalador (base y actualizador) trae la dirección y la clave de la nube de OMEGA, así que al instalar o actualizar la PC se sincroniza sola; solo se configura el gimnasio con la clave de administrador. La clave se inyecta al armar el instalador (variable `OMEGA_SYNC_CLAVE`) y NO está en el código ni en GitHub.

## Versión 11 · revisión 1 — 06/11/2026
- La PC del gimnasio usa sola la nube oficial `https://omega-gimnasio-24lr.onrender.com`: si falta la dirección (y hay clave) o quedó la del servicio viejo (…86418), se reemplaza. La clave NO va en el código: se carga una vez en Sincronizar.

## Versión 11 — 06/11/2026
- **Hark Pro pasa a Ajustes**, con su propia pestaña. El aprendizaje de la planificación viene **activado por defecto** (primer período de 28 días, que el administrador puede cambiar o apagar). La lectura de WhatsApp se activa aparte, con confirmación de consentimiento.
- **Clientes → campo “Alias WhatsApp”** (varios alias separados por coma o punto y coma): Hark Pro lo compara con el nombre del chat para saber de qué alumno es la conversación, aunque WhatsApp no muestre el número.
- **Clientes → Seguimiento → 6 · Comentarios → botón “Importar con Hark Pro”:** arma ahora el resumen (solo lo relacionado con el entrenamiento) de lo capturado de ese alumno y lo deja como comentario con la fecha.
- **App del alumno → botón “Chatear con el gimnasio”** (en Inicio, Entrenamiento y Mi perfil, si el gimnasio cargó su WhatsApp en Ajustes). El mensaje ya sale con el nombre y el código del alumno (OMEGA#id): Hark Pro, al leer el chat en la PC del gimnasio, lo reconoce y guarda el alias con el que figura en WhatsApp.
- **App del alumno → Entrenamiento:** ya no aparece una clase a las 00:00 que no existe (era una asistencia cargada fuera de horario); fuera de horario se muestra la próxima clase disponible, aunque sea de otro día.
- **“Falta registrar pago”** solo aparece en alumnos con un plan con precio: un plan a $0,00 nunca lo muestra.
- **Fechas DD/MM/AAAA:** escribir un dígito en el medio de una fecha cargada ya no mueve el año (31/12/2099 pasaba a 31/12/2209 y daba “Fecha inválida”).

## Versión 10 — 05/11/2026
- **Clientes (importador y formulario):** si la fecha de baja queda vacía se usa la fecha de alta, así que el cliente queda vencido desde el día siguiente a la carga.
- **Recuperar la contraseña con 3 preguntas de seguridad:** nueva pestaña **Ajustes → Seguridad** (3 preguntas de opción múltiple). En el ingreso, “Olvidé mi contraseña” pide las 3 respuestas correctas para cambiar la clave del administrador; 5 intentos fallidos bloquean 30 minutos.
- **Dibujar las 3 posiciones:** copiar la posición inicial a la 2 y/o 3 eligiendo qué copiar (todo, solo el cuerpo o solo el equipamiento); tamaño editable de cada elemento; el equipamiento nuevo aparece en la paleta con su dibujo.
- **Planificación → Equipamiento:** cada equipamiento se muestra con su dibujo editable (mismo editor de formas); al agregar uno se dibuja en el momento. Se quitaron “Estaciones rotativas” y “Capacidad de diseño”: la IA toma los parámetros de la configuración de cada formato.
- **Frecuencia semanal por estímulo** (Formatos e Intervalos): quien define los circuitos indica cuántas veces por semana quiere cada estímulo y la IA lo respeta al armar los circuitos.
- **Hark Pro (en segundo plano, apagado por defecto):** aprende de las planificaciones manuales durante el período que fija el administrador (botón “Activar Hark Pro”) y las usa para desempatar al armar circuitos. Lee conversaciones de WhatsApp Web (con consentimiento), asocia al cliente por teléfono y deja un resumen del tema de entrenamiento con fecha en **Clientes → Seguimiento → 6 · Comentarios**. El seguimiento a vencidos (+7 días) y los mensajes semanales quedan solo como configuración: Hark Pro no envía nada.
- Para leer WhatsApp hay que actualizar también la ventana de escritorio (Instalador Base o Actualizador); el botón “Actualizar” solo cambia el código.

## Versión 9 — 05/11/2026
- **Clientes → Importar Excel con revisión previa:** al subir el archivo se revisa todo antes de cargar nada. Si hay errores aparece un alerta con la **fila y la columna** de cada uno (nombre vacío, plan que no existe, fecha inválida, celular con letras, baja anterior al alta) y no se importa ninguna fila hasta corregir el archivo. Un plan inexistente ahora es error (antes solo avisaba).
- **Formato de fechas DD/MM/AAAA:** la planilla modelo trae las columnas de fecha con ese formato y validación, y la de celular con validación numérica. En la pantalla de alta/edición de alumnos las fechas se **escriben** (las barras se completan solas) o se **eligen en un calendario**.
- **Filas repetidas en el archivo:** se carga una sola vez cada persona y al terminar un cartel indica qué filas estaban repetidas.
- **Planificación → Rutinas Personalizadas → Importar rutinas (Excel):** planilla modelo con una fila por ejercicio (nombre, descripción, patrón, ejercicio, series, repeticiones, peso, descanso y segundos por serie). El **Ejercicio es una lista desplegable que se filtra según el Patrón** elegido (hoja “Ejercicios”, un patrón por columna). Rangos: series y repeticiones 1–99, peso 0–999 (vacío o 0 = peso corporal), descanso y segundos 0–999. Mismo criterio de errores por fila. Si ya tenés una rutina con ese nombre, la nueva se guarda como “Nombre (fecha de creación)”. El diseñador de rutinas admite ahora esos mismos rangos y muestra “Peso corporal” como ayuda en el campo vacío.
- **Biblioteca de ejercicios → Dibujar las 3 posiciones:** editor de figura de palitos (arrastrar articulaciones, brazos y piernas independientes, copiar la posición anterior, apoyar en el piso, partir de una figura base, ver el movimiento). Se dibuja con el **color del patrón de movimiento** (nuevo botón “Colores de patrones” para el administrador) y se puede sumar **equipamiento** tocándolo o arrastrándolo desde la paleta al dibujo (queda en la mano si se suelta cerca). Las posiciones se guardan como imágenes y como datos para volver a editarlas.
- Pendiente para una versión próxima (a pedido): servicios a pagar y pago automático con Hark Pro.

## Versión 8 — 31/10/2026 (revisión 2 — 04/11/2026)
- **Revisión 2 · Altas automáticas:** todo alumno dado de alta, por pantalla o por importación de Excel, recibe automáticamente su usuario y contraseña de la app (ya no es opcional). Al iniciar y después de cada importación, OMEGA crea el usuario de cualquier alumno que no lo tenga. Al terminar una importación, la app sincroniza con la web enseguida e informa cómo salió (o por qué no pudo). Una fila con error ya no deja un alumno a medias.
- **Revisión 1:** la pantalla de Ajustes ya no se cae si falla la lectura de las copias de seguridad (muestra un aviso en su lugar), y los errores internos del servidor ahora indican en qué pantalla y por qué ocurrieron.
- **Botón “← Volver” en todas las pantallas:** vuelve siempre a la pantalla inmediata anterior (por ejemplo, desde “Ver circuito” regresa a Planificación Semanal).
- **Rutinas Personalizadas ahora es Cliente → Rutinas:** cada cliente con todas sus rutinas (puede tener varias). Se puede agregar una rutina a un cliente desde la biblioteca o creando una nueva a su medida, que queda también en la biblioteca.
- **Biblioteca de rutinas:** listado por profesor (quien la creó), con las rutinas y a qué alumnos están asignadas. Uso libre para cualquier profesor y asignable a cualquier alumno; solo el creador (y el administrador) la modifica; “Duplicar como mía” para adaptarla. Dos profesores pueden tener rutinas con el mismo nombre: quedan separadas por profesor.
- **Biblioteca de ejercicios:** el nombre del ejercicio (columna Base) abre su ficha completa (posiciones, progresiones, datos y video); la columna Base y las progresiones se ajustan en 2 renglones y la tabla tiene barra de desplazamiento arriba, para ver más información en una sola pantalla.
- **Inhabilitar en vez de eliminar:** las rutinas no se eliminan, se inhabilitan y pasan a “Inhabilitadas” desde donde se pueden activar de nuevo; los clientes se inhabilitan (botón “Inhabilitar”), ya no hay “Eliminar” en su ficha.
- **Ajustes → Depurar la base (solo administrador):** única forma de eliminar de verdad. Clientes (tildando varios), CRM · Clientes perdidos (los de más de X meses) y Rutinas personalizadas (eligiendo del listado).
- **Finanzas → Planes y descuentos:** los planes (antes en Análisis del mes) y los descuentos (antes en Ajustes) se administran juntos en una pestaña nueva.

## Versión 7 — 30/10/2026
- **Biblioteca:** al menos 50 ejercicios de movilidad y 50 de equilibrio (hoy 56 y 96), con cobertura por patrón de movimiento y ejercicios anaeróbicos/potencia para todos los formatos. Los circuitos ya no muestran avisos por falta de ejercicios.
- **Permisos:** nuevo permiso **Diseño** (el administrador lo tilda por profesor) y los profesores pueden modificar la agenda general y la Agenda Staff.
- **Clientes → Seguimiento:** clases realizadas, clases más asistidas, días y horarios, sensación semanal del alumno (1–10), progreso semanal por profesores (1–10) y comentarios con fecha. **Corregido:** el premio por recomendación ahora se aplica al renovar el plan de quien recomendó.
- **Asistencias:** botones Alumnos activos / Activos en riesgo / Bajas recuperables con listado; se quitó “ineficiencias en la asignación de materiales”; nueva pestaña **Seguimiento** (clases, profesores y horarios con más asistencia; no renovaciones vs mes anterior y vs promedio de 3 meses).
- **CRM → Seguimiento:** visitas que no se inscribieron, con profesor, objetivo, fecha y comentarios; pasar a **Clientes perdidos** y reabrir. Cada profesor ve en su perfil a quién seguir.
- **Rutinas personalizadas:** profesor de seguimiento; en su perfil, sus alumnos con entrenos y rutinas realizadas.
- **Ajustes → Descuentos** (% o $, 1 a 12 meses) y en **Renovar plan**: Plan Full – Descuento – Ingreso neto.
- **Finanzas:** Estado de resultados con Ingresos Plan Full, Descuentos otorgados e Ingreso neto; todos los porcentajes sobre Plan Full; el precio por alumno es el Plan Full.
- **Hipervínculos a los listados:** los indicadores principales (Reporting, Asistencias del día y Seguimiento, CRM, Finanzas) abren el listado que los compone, con enlace a la ficha de cada alumno.
- **Descuentos:** quien deja vencer el plan 7 días o más sin renovar pierde el descuento que le quedaba de varios meses. "Renovar plan" arranca en "Sin descuento" (o en el pendiente del alumno).

## Versión 6 — 30/10/2026
Cambio de estructura del módulo **Planificación**. Pestañas, en este orden: **Agenda semanal · Agenda Staff · Formatos e Intervalos · Planificación Semanal · Rutinas Personalizadas · Biblioteca · Equipamiento**.
- **Agenda semanal (primer paso de la semana):** la agenda de clases ahora es *por semana*, con un calendario de semanas (A = agenda guardada, F = formatos guardados, C = circuitos). Una semana sin agenda propia hereda la de la última semana guardada. Botón **“Copiar agenda semana anterior”**.
- **Agenda Staff:** primero se actualiza la agenda de la semana y después se elige el profesor de cada clase. Botón **“Copiar staff semana anterior”**. Reemplaza al “Fijar todas las semanas”.
- **Formatos e Intervalos por semana:** por formato se define la **cantidad de estaciones**, los rounds, el trabajo/descanso, el cupo y la intensidad, y se eligen 1 o varios estímulos en cada uno de los tres grupos: *patrones de movimiento básicos*, *capacidades físicas integradas* y *sistema energético*. Botones **“Guardar formatos de la semana”** y **“Copiar formatos semana anterior”**. “Nombres y colores” permite agregar, renombrar o quitar formatos.
- **Planificación Semanal (antes “Semanas”):** la IA arma la semana con la agenda y los formatos de *esa* semana. Cada estímulo del formato se trabaja con **frecuencia 2** repartida en los 3 entrenamientos semanales óptimos (todos los días iguales, sin días de mantenimiento); la cantidad de ejercicios de cada circuito es la cantidad de estaciones del formato. Se siguen respetando intensidad, no repetir ejercicios y el equipamiento disponible.
- **Biblioteca reagrupada por estímulos:** *7 patrones de movimiento* (Empujar, Tirar, Sentadilla, Bisagra de cadera, Bisagra de rodilla, Rotación y anti-rotación, Locomoción y transporte), *4 capacidades físicas* (fuerza funcional, estabilidad y core, movilidad y flexibilidad, equilibrio y coordinación) y *2 sistemas energéticos* (aeróbico/resistencia, anaeróbico/potencia). Todos los ejercicios ya cargados se reclasificaron automáticamente (las antiguas “zonas” se reemplazan por patrones) y se sumaron 25 ejercicios de movilidad y equilibrio. Cada ejercicio tiene un patrón y puede sumar varias capacidades y sistemas.
- **Rutinas → Rutinas Personalizadas.** Los ejercicios de las rutinas se eligen por patrón de movimiento.
- **Todo cambio en agenda, staff o formatos actualiza al instante los circuitos y la app del cliente.**
- Para actualizar: subir el código al repositorio del gimnasio y usar “Actualizar ahora”, o instalar `OMEGA-Setup-Version6.exe` (conserva datos).

## Versión 5 — 30/10/2026
- **Rounds por formato (Planificación → Formatos e Intervalos → “Editar Formatos”):** cada formato puede tener 3, 2 o 1 rounds, a elección del administrador o profesor. Con 3 rounds se hacen la base y las 2 progresiones; con **2 rounds la IA usa las 2 progresiones más exigentes de cada ejercicio**; con 1 round, la más exigente. Flex y Z7 vienen con 2 rounds (al actualizar desde la V4 se cargan así una sola vez; el resto queda en 3). Cambian la vista del circuito, el cronómetro, la duración de la clase y la pantalla del alumno.
- **Aplicación de escritorio (Windows 10 o más nuevo, 32 y 64 bits):** OMEGA se abre en su propia ventana, sin depender de Edge o Chrome (motor Electron 38 incluido). El servidor sigue corriendo en segundo plano (copias de las 22:00, celulares, sincronización). En Windows 7/8 se sigue usando el navegador. El menú Inicio trae también “OMEGA (navegador)”.
- **Actualización automática desde la aplicación web:** la PC consulta a la web del gimnasio; si hay una versión más nueva la descarga (verificada), y el administrador la aplica con el botón **“Actualizar ahora”** (en la pantalla de inicio, junto a Sincronizar). OMEGA se reinicia solo y no se toca ningún dato. Si la versión nueva no arranca, vuelve sola a la anterior. Para publicar una versión: subir el código al repositorio de GitHub del gimnasio (Render lo despliega y las PC lo toman).
- **Instalador:** detecta solo si Windows es de 32 o de 64 bits (se puede cambiar), actualiza una V4 instalada conservando datos, copias, usuarios y conexión con la nube.

## Versión 4 — 29/10/2026
- **Alta del gimnasio en el primer inicio:** al abrir OMEGA por primera vez pide el nombre del gimnasio y el logo (el logo también es el ícono de la app) junto con el usuario del administrador.
- **Sincronizar automático:** el botón crea solo, sin pasos manuales, el repositorio en GitHub y el servicio en Render del gimnasio nuevo y completa la dirección, la clave SYNC y la conexión. Muestra el progreso y puede tardar unos minutos.
- **Servicio de alta (`servicio-alta/`):** lo despliega una vez el dueño del sistema; guarda las claves de GitHub y Render. Las PCs de los gimnasios solo traen un código de alta (archivo `alta.txt`) y nunca ven esas claves. Tiene límite de altas por hora y no duplica repositorios si se reintenta.
- Si una instalación no trae el acceso al servicio de alta, queda el modo manual (dirección + clave o código de conexión).
- *Revisión 2:* se quitó la ventana negra "OMEGA servidor": el servidor ahora corre como proceso interno en segundo plano (motor sin consola `omega-oculto.exe`). Registro en `C:\OMEGA\omega.log`; `modo-visible.bat` para diagnóstico.
- *Revisión 1:* la fecha de la "Última sincronización" se mostraba con el día siguiente por la noche (tomaba la fecha en UTC); ahora usa la hora de Argentina.

## Versión 3 — 29/10/2026
**Instalador**
- Se puede elegir 32 o 64 bits (hay un instalador para cada uno; el de 32 bits es el indicado para PCs viejas). El lanzador ahora es el propio programa de OMEGA: sin scripts de Windows que los antivirus suelen marcar.
- Sección "Antivirus y SmartScreen" en la guía: qué se puede hacer sin certificado y cómo firmar el instalador con un certificado de firma de código.

**Inicio del alumno**
- Al entrar por el QR, la app ofrece crear el acceso directo en el celular (Android: botón de instalar; iPhone: pasos guiados).

**Diseño**
- Botón 🎨 Diseño: color o foto de fondo, color y tipo de letra, color de botones. Se sincroniza a todos los usuarios.
- Logo y nombre: al subir el logo se genera el ícono de la app (PC, administrador, profesor y alumno).
- Asistente "Sincronizar" para conectar un gimnasio nuevo con su propia nube; herramienta aparte (`herramientas/alta-gimnasio.js`) que crea el repositorio en GitHub y el servicio en Render.

**Clientes**
- Planilla modelo descargable con lista desplegable de planes (nombre y precio).
- Importar cualquier archivo: solo "Nombre y Apellido" es obligatorio. Genera los accesos web. Reimportar no duplica: actualiza lo existente y suma lo nuevo.

**Asistencias**
- Lector de QR del administrador mejorado (detección nativa + lector de respaldo, tolera brillo, desenfoque y QR chicos).
- QR fijo del gimnasio para imprimir o poner en pantalla: el alumno registra su asistencia (Clase o Rutina), sin duplicar en la misma clase; con 1 h de diferencia cuenta como clase consecutiva.

**Planificación**
- Se quitó el tiempo máximo de trabajo; el tiempo se carga libre en segundos o minutos.
- Flex: una sola clase corrida de 60 min, sin intervalos.
- Casillas "no usa intervalos de trabajo" y "no usa descanso".

**Corrección**
- En una PC nueva el QR del alumno no se generaba hasta sincronizar con la nube (evita claves distintas entre PC y web).

## Versión 2 — 28 y 29/10/2026
**Ajustes**
- País con bandera y prefijo internacional (ej. +54): todos los teléfonos se guardan con prefijo para que el botón de WhatsApp abra siempre el chat correcto. Botón "Estandarizar teléfonos existentes".
- WhatsApp oficial del gimnasio (lo ven los alumnos en su perfil).
- Gestor de campañas de captación (Instagram, Recorrida, Recomendado por, Google/Maps, Volanteo, Otro…) editable por el administrador.

**Clientes**
- Cartel amarillo "Falta registrar pago" cuando la fecha de baja se mueve hacia adelante sin un pago asociado (en el listado, filtro rápido y ficha).
- "Deshacer pago": revierte la fecha de baja y quita el ingreso de la Caja (efectivo) o del reporte (Mercado Pago).
- Botón de WhatsApp en la ficha del alumno.

**App del alumno**
- Foto de perfil desde cámara o galería; sugerencia de instalar la app (acceso directo) al entrar.
- Reservas informativas (sin bloqueos ni penalidades). Si una clase pasa las 20 reservas se avisa "Ineficiencia de Materiales" al profesor y al administrador.
- Contacto rápido por WhatsApp con el gimnasio. Pestaña "Rutina" junto al formato del día.

**CRM**
- Objetivo "Otro" con texto libre, campo Campaña y, si es "Recomendado por", buscador del alumno que recomendó. Al inscribirse la visita, aviso (campana 🔔) para decidir un premio o descuento al referidor. Rendimiento por campaña.

**Planificación y Biblioteca**
- Doble motor: Circuitos y Rutinas de musculación (series, repeticiones, peso, descanso, zona; máximo 180 minutos).
- Agenda de 7:00 a 23:00 con horarios corridos; cupo por estación (no por gimnasio); el profesor toca su clase y va directo a los ejercicios.
- Generador mixto: "Generar con IA" o "Manual".
- Biblioteca: zona Glúteos, intensidad cardiovascular (baja/moderada/alta) para armar clases HIIT, filtros encadenados (tipo de movimiento según zona y equipo), tres botones para subir las fotos de ejercicios nuevos, barra de scroll horizontal visible.

**Finanzas**
- Amortización (devengamiento) de gastos de equipamiento en X meses.
- Estado de resultados vertical (mes actual y 3/6/12 meses) con categorías desplegables y peso sobre ingresos; ingresos con alumnos × precio; sensibilidad de alta.
- Presupuesto móvil de 12 meses: inflación por mes (a precios y/o costos), estacionalidad de alumnos, saltos de precio, picos (aguinaldo), punto de equilibrio por columna.

**Clientes (ajustes del 29/10)**
- "Deshacer pago" devuelve exactamente la fecha de baja que tenía el cliente antes de ese pago (aunque estuviera vencida) y vuelve a mostrar "Falta registrar pago" hasta que haya un pago definitivo.
- Pestaña **Rutinas** en la ficha del cliente.

**Planificación (ajustes del 29/10)**
- **Eliminar semana** borra los circuitos de hoy en adelante (de IA o manuales); los días pasados no se tocan. "Generar semana con IA" reemplaza lo que haya desde hoy en adelante con la intensidad mínima vigente.
- Intensidad mínima del formato: Baja / Moderada / Alta (igual que la biblioteca).
- Rutinas personalizadas por cliente: se asignan por días de la semana (varios días o todos los lunes, martes… hasta el sábado) y se repiten cada semana.

**Finanzas (ajustes del 29/10)**
- Se eliminó la pestaña "Simulador 6 meses".
- Precios de los planes: botón **Deshabilitar / Habilitar**.
- Estado de resultados: nunca muestra meses futuros; mes actual + 12 anteriores en una sola pantalla; **Exportar a Excel**.
- Egresos con fecha futura cargados en Análisis del mes: quedan en su mes y además se copian al Presupuesto 12 meses.
- Presupuesto 12 meses: copiar el mes corriente o anterior como base (costos, gastos e ingresos = alumnos × precio), ajustar inflación, alumnos, precio y cada costo; **Exportar a Excel**.

**Instalador**
- Versión para **Windows de 32 bits** (`OMEGA-Setup-Version2-32bits.exe`). El aviso de error al iniciar ahora muestra el detalle real del registro y no tiene letras raras.

**Permisos por usuario (nuevo)**
- Al crear un profesor, el administrador arma un árbol de permisos por módulo (se tildan de a uno), o copia los de otro usuario. Perfil "Profesor estándar": todas las tareas y, en Finanzas, solo la caja (saldo inicial, ingresos, egresos). Usuarios y Ajustes son solo del administrador.

**Arreglos**
- En los listados, escribir en un filtro y hacer clic en una fila ya no pierde el primer clic.

## Versión 1 — 25/10/2026
- Aplicación web gratuita (Render) como espejo de la PC, con botón "Sincronizar con la aplicación Web" y sincronización automática cada 2 minutos en la WiFi del gimnasio.
- QR de la app en Inicio (arriba a la derecha) con la dirección real; el QR viejo apuntaba a localhost.
- Marca blanca: botón sobre el logo para cargar logo/isologo, nombre del gimnasio y tipografía.
- Usuarios automáticos de alumnos: nombre.apellido y clave 12345678 (alta manual o por Excel).
- Alumnos ven todas las clases de la semana por anticipado (planificación automática 21 días).
- Biblioteca: zona Hombros, 50 ejercicios por zona con progresiones, [+] nuevo, editar, 3 posiciones (inicial/media/final) con ilustraciones esquemáticas y foto propia por posición. Temporizador con sonido.
- Agenda Staff, Equipamiento con altas/cantidades y sugerencias de ejercicios por reglas.
- CRM de visitas con formulario público por QR (10x10 cm), conversión y efectividad por profesor.
- Renovaciones con medio de pago (Efectivo / Mercado Pago); el efectivo entra a la Caja.
- Finanzas en 3 pestañas: Caja diaria, Análisis del mes (precios, percentiles) y Proyección a 6 meses (simulador).

## Versión 0, revisión 1 — 25/10/2026
- Corrección del instalador: el icono del escritorio mostraba el error "El subíndice está fuera del intervalo" (línea 11 del lanzador) y no abría OMEGA.

## Versión 0 — 25/10/2026 (beta, base de todo lo que sigue)
- Módulo 1: usuarios (administrador, profesor, alumno), primer acceso crea al administrador.
- Módulo 2: planificación de clases (3 rounds × 5 ejercicios, estaciones rotativas, 21 días sin repetir, 140 ejercicios, biblioteca de videos, formatos con 3 botones).
- Módulo 3: clientes (Alta/Asistencias, Excel, panel individual).
- Módulo 4: reporting con semáforos y filtros por columna.
- Módulo 5: dashboard de asistencias, carga manual, QR, ineficiencia de materiales, finanzas (admin), copia automática 22:00.
- Instalador de Windows (icono en el escritorio, ingreso Administrador/Profesor como primera pantalla), versión de prueba en el navegador.
