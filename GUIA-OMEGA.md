# OMEGA · Sistema de gestión del gimnasio

Aplicación web (se usa desde el navegador y se instala en el celular como app, Android e iPhone) con los 5 módulos:

1. **Usuarios**: administrador (dueño), profesores y alumnos. El primer acceso crea al administrador. Todo el login vive en la base de datos de la app: no hace falta ninguna cuenta externa.
2. **Planificación de clases**: 3 rounds × 5 ejercicios (round 2 y 3 son progresiones), estaciones rotativas según el equipamiento disponible, ejercicios que cambian cada semana y no se repiten antes de 3 semanas, 20 ejercicios por zona del cuerpo (140 en total), reemplazo de ejercicios por zona, biblioteca de videos con botón **Subir video** por ejercicio y lista de reproducción automática por clase. Los 6 formatos (Endurance, Flex, Funcional, Hiitcross, QDX, Z7) tienen **3 botones** para cargar una sola vez el tiempo de trabajo y de descanso.
3. **Clientes**: pestañas Alta y Asistencias, foto, fecha de alta, precio del plan, fecha de baja automática, celular, Instagram, importar/exportar Excel y panel individual.
4. **Reporting**: pantalla de inicio con la lista de alumnos, filtros por columna, miniatura y semáforos (Alta: verde/amarillo/rojo · Asistencia: verde/amarillo/naranja/rojo).
5. **Asistencias**: dashboard por horario, carga manual (admin y profesores), QR que muestra el alumno y escanea el profesor. **El ingreso no tiene límite**: si se supera la capacidad de 20, el dashboard lo marca como *ineficiencia en la asignación de materiales*. Submódulo **financiero** (solo administrador): egresos, ganancia neta y punto de equilibrio. Los profesores ven solo lo que el administrador les habilita (Usuarios → Accesos); el perfil estándar solo incluye la caja en Finanzas.

Copia de seguridad automática **todos los días a las 22:00** (hora de Argentina).

## Versión 6
Planificación semanal por pasos: 1) **Agenda semanal** (qué formato en cada horario, con calendario de semanas y botón para copiar la semana anterior); 2) **Agenda Staff** (profesor de cada clase; copiar staff); 3) **Formatos e Intervalos** (estaciones, rounds, tiempos y estímulos de cada formato, por semana; guardar y copiar); 4) **Planificación Semanal** (la IA arma los circuitos); luego **Rutinas Personalizadas** y **Biblioteca** (agrupada por patrones de movimiento, capacidades físicas y sistema energético). Cualquier cambio impacta de inmediato en la app de los clientes. Detalle en CHANGELOG.md.

## Versión 5
- **Rounds por formato:** en Planificación → Formatos e Intervalos → *Editar Formatos* elegís 3, 2 o 1 rounds por formato. Con menos de 3 rounds se usan las progresiones más exigentes de cada ejercicio. Flex y Z7 vienen con 2.
- **Aplicación de escritorio:** el icono OMEGA abre una ventana propia (no usa el navegador). Requiere Windows 10 o más nuevo; el instalador detecta solo si es de 32 o 64 bits. “OMEGA (navegador)” del menú Inicio abre la versión de siempre.
- **Actualización automática:** cuando la aplicación web tiene una versión más nueva, en la pantalla de inicio aparece **“Hay una versión nueva — Actualizar ahora”**. Se reinicia solo en unos segundos y los datos no se tocan. Si la nueva falla, vuelve a la anterior. Registro: `C:\OMEGA\omega.log`; versiones descargadas: `C:\OMEGA\actualizacion`.
- **Publicar una versión nueva para todos los gimnasios:** subir el código al repositorio de GitHub de cada gimnasio (Render lo despliega solo); sus PC lo descargan.

## Versión 2
Novedades (incluye permisos por usuario, nuevo Estado de resultados y Presupuesto con Excel, rutinas por cliente): ver `CHANGELOG.md`. El instalador es `OMEGA-Setup-Version2.exe` (conserva los datos de la Versión 1; antes de la primera apertura se hace una copia automática). Para la aplicación web hay que volver a subir el código a GitHub (ver `GUIA-NUBE.md`, sección “Actualizar a la Versión 2”).

## Versión 1
Novedades y puesta online: ver `CHANGELOG.md` y `GUIA-NUBE.md`. El instalador es `OMEGA-Setup-Version1.exe` (conserva tus datos de la Versión 0).

## Antivirus y Windows SmartScreen
Un antivirus desconfía de programas nuevos que no están firmados. **Un "certificado" casero no sirve**: Windows solo confía en certificados emitidos por una entidad reconocida. Opciones, de menor a mayor efecto:
1. **Firmar el instalador** con un certificado de firma de código (OV o EV, de venta en entidades certificantes; o el servicio Azure Trusted Signing). Con el certificado en un archivo `.pfx`: `OMEGA_PFX=ruta.pfx OMEGA_PFX_CLAVE=… bash installer/build.sh` (requiere `osslsigncode` en la máquina de armado). Con certificado OV la reputación se gana con el uso; con EV es inmediata.
2. **Informar el falso positivo**: subir el instalador a https://www.microsoft.com/wdsi/filesubmission y al sitio de tu antivirus. El archivo `.sha256` que acompaña al instalador sirve para verificar que no fue alterado.
3. **Excepción local** (PC vieja con antivirus molesto): agregar la carpeta `C:\OMEGA` a las exclusiones del antivirus (en Windows Defender: Seguridad de Windows → Protección contra virus → Administrar la configuración → Exclusiones).
Desde la Versión 4 el servidor corre en segundo plano, sin ventana negra: no se ve nada salvo la ventana de OMEGA. Se apaga con "Detener OMEGA" (menú Inicio). El registro queda en `C:\OMEGA\omega.log`. Si OMEGA no abre, ejecutá `modo-visible.bat` (carpeta de instalación) para ver el servidor en pantalla y el posible error.

## Instalador de 32 o 64 bits
`OMEGA-Setup-Version3.exe` trae los dos motores y, al instalar, pregunta si es de **32 o 64 bits** (propone el que corresponde a la PC). También se entrega `OMEGA-Setup-Version3-32bits.exe`, más chico, para PCs viejas. Si no sabés cuál es tu PC: Configuración → Sistema → Acerca de → "Tipo de sistema".

## Probar sin instalar

El archivo `dist/omega-prueba.html` es la versión de prueba: corre entera en el navegador con datos de ejemplo (es la misma que el link de prueba). Sus datos se guardan solo en ese navegador.

## Instalador de Windows (recomendado)
> **¿Windows de 32 o de 64 bits?** (Windows + Pausa → *Tipo de sistema*). Si dice **64 bits** usá `OMEGA-Setup-Version2.exe`; si dice **32 bits** usá `OMEGA-Setup-Version2-32bits.exe`. Si se instala el equivocado, OMEGA muestra “Esta versión no es compatible con la versión de Windows”. Hace falta Windows 10 o más nuevo.

Ejecutar `OMEGA-Setup-Version0.exe` (pide permiso de administrador una sola vez):
- Instala el programa en `C:\Program Files\OMEGA` (incluye todo lo necesario; no hace falta instalar Node).
- Crea el icono **OMEGA** en el escritorio y en el menú Inicio. Al abrirlo, la primera pantalla es el **ingreso (Administrador o Profesor)**.
- La base de datos y los videos se guardan en `C:\OMEGA\datos`. Las copias de las 22:00 van a la carpeta `omega\backups` de OneDrive si está instalado (si no, a `C:\OMEGA\copias`). Todo se puede cambiar en `C:\OMEGA\config.txt`.
- Opcional (marcado por defecto): el servidor arranca solo al encender Windows, así las copias de las 22:00 y el acceso desde los celulares funcionan sin abrir nada.
- Actualizar a una versión nueva: ejecutar su instalador encima; los datos no se tocan y se hace una copia previa automática.
- Windows puede mostrar el aviso azul "SmartScreen" porque el instalador no tiene firma digital paga: *Más información → Ejecutar de todas formas*.
- Los celulares entran por `http://IP-DE-LA-PC:3000` con la red WiFi del gimnasio configurada como **red privada** en Windows.

## Instalación manual (alternativa, sin instalador)

1. Instalar **Node.js 22.13 o superior** (nodejs.org, versión LTS/Current).
2. Copiar esta carpeta a la PC, por ejemplo `C:\OMEGA\app`. Se puede dejar dentro de OneDrive\omega si se prefiere, pero **la base de datos no debe quedar dentro de una carpeta sincronizada** (OneDrive puede corromper SQLite mientras está en uso). Por eso `INICIAR-OMEGA.bat` guarda los datos en `C:\OMEGA\datos` y deja las copias en `OneDrive\omega\backups`.
3. Doble clic en `INICIAR-OMEGA.bat` y dejar la ventana abierta. Abrir `http://localhost:3000`, crear el administrador (primer acceso) y listo.
4. Desde los celulares (misma WiFi): `http://IP-DE-LA-PC:3000` (la IP se ve con `ipconfig`). En el menú Ajustes aparece el link y un QR para instalar la app. Para que arranque sola con Windows, poner un acceso directo del `.bat` en la carpeta de inicio (`shell:startup`).
5. **Cámara para escanear QR**: los navegadores solo dejan usar la cámara con **https** (o en `localhost`). Opciones: abrir el escáner en la propia PC (`localhost`), publicar la app detrás de un túnel https (Cloudflare Tunnel o Tailscale Funnel), o usar los dos métodos alternativos que ya trae la pantalla: sacar una foto al QR del alumno o pegar el código.

### Copias de seguridad y restauración
- Todos los días a las 22:00 se crea `omega-AAAA-MM-DD_2200.db` (y se copian los videos nuevos) en `BACKUP_DIR`; se conservan las últimas 30. Con `BACKUP_DIR` dentro de `OneDrive\omega`, OneDrive las sube a la nube. También hay un botón **Hacer una copia ahora** en Ajustes.
- La PC tiene que estar prendida a partir de las 22:00 (si se prende después de esa hora, la copia se hace en cuanto arranca OMEGA; si estuvo apagada toda la noche, ese día no hay copia automática).
- Restaurar (con el servidor detenido): `npm run restaurar -- "C:\ruta\omega-2026-10-25_2200.db"`.
- Subida directa por la API de OneDrive (opcional, sin depender de la sincronización): definir `MS_TENANT_ID`, `MS_CLIENT_ID`, `MS_CLIENT_SECRET` y `MS_USUARIO` (aplicación registrada en Microsoft Entra con permiso `Files.ReadWrite.All`).

### Variables de configuración
`PORT` (3000) · `DATA_DIR` · `BACKUP_DIR` · `BACKUP_HORA` (22) · `BACKUP_CONSERVAR` (30) · `MAX_VIDEO_MB` (400) · `OMEGA_SECRET` (clave de firma; si no se define se genera y guarda en la base).

## Contenido de la carpeta
- `server.js`, `src/` — servidor y lógica (Node, SQLite incluido en Node, sin dependencias externas).
- `public/` — la app (pantallas, estilos, instalable como PWA).
- `scripts/restaurar.js`, `INICIAR-OMEGA.bat`.
- `demo/` y `dist/omega-prueba.html` — armado de la versión de prueba (`node demo/build.js`).
- `test/` — pruebas automáticas (`npm test`).

## Seguridad
Contraseñas con scrypt, sesiones firmadas, QR que vence a los 90 segundos, límite de intentos de login, cada rol solo accede a lo suyo (cada profesor accede solo a los permisos que el administrador le dio). Cambiá las contraseñas de ejemplo si usás datos de prueba.
