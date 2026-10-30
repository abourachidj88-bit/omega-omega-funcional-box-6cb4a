# OMEGA · Historial de versiones

Cada modificación que se pide genera una **versión nueva** (1, 2, 3…) a partir de la anterior. Las versiones anteriores quedan guardadas intactas en `OMEGA-versiones/Version-N/` (código fuente, instalador y versión de prueba). Los datos del gimnasio (`C:\OMEGA\datos`) se conservan al pasar de una versión a otra; antes de usar una versión nueva por primera vez OMEGA hace una copia de seguridad automática.

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
