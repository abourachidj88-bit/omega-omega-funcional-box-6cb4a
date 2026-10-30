# Poner OMEGA online (gratis) — Versión 2

La PC del gimnasio es la base principal. La aplicación web es una copia que se actualiza sola
(cada 2 minutos si la PC está prendida y con internet) o con el botón **Sincronizar con la aplicación Web**.
Si la copia gratuita se reinicia y queda vacía, la PC la vuelve a llenar sola en la próxima sincronización.

## Paso a paso (una sola vez, ~15 minutos)
1. Crear una cuenta gratis en **github.com** y un repositorio **privado** llamado `omega-gimnasio`.
2. Subir el contenido de la carpeta `omega-nube` (viene en el zip) al repositorio (botón *Add file → Upload files*).
3. Crear una cuenta gratis en **render.com** (podés entrar con tu cuenta de GitHub).
4. En Render: *New → Blueprint* → elegir el repositorio. Render lee `render.yaml` y crea el servicio `omega-gimnasio`.
5. Cuando termine, abrir el servicio → **Environment** → copiar el valor de `SYNC_CLAVE`.
6. Copiar la dirección del servicio (ej. `https://omega-gimnasio.onrender.com`).
7. En la PC, abrir el Bloc de notas con `C:\OMEGA\nube.txt` y completar:
   ```
   NUBE_URL=https://omega-gimnasio.onrender.com
   NUBE_CLAVE=(la clave copiada en el paso 5)
   ```
8. Cerrar OMEGA (menú Inicio → *Detener OMEGA*) y abrirlo de nuevo con el icono del escritorio.
9. En **Inicio** tocar **Sincronizar con la aplicación Web**. La primera vez tarda un poco.
10. En Inicio, tocar el QR de la esquina → escribir la dirección de la nube → ese QR y el link son los que se comparten con alumnos y profesores.

## Cosas a saber
- Plan gratuito: la web "se duerme" tras 15 minutos sin uso y tarda ~1 minuto en despertar la primera vez.
- Los videos de ejercicios quedan solo en la PC (la nube gratuita no guarda archivos pesados).
- Los cambios hechos desde la web (por ejemplo asistencias por QR) vuelven a la PC en la siguiente sincronización.
- No compartas la clave `SYNC_CLAVE`.

## Actualizar la aplicación web a la Versión 2
1. En GitHub (repositorio `omega-gimnasio`) entrar a cada carpeta (`src`, `public`, `scripts`) y subir los archivos nuevos con **Add file → Upload files** (reemplazan a los viejos). También reemplazar `package.json`, `server.js`, `Dockerfile` y `render.yaml` si vienen en el paquete.
   Lo más simple: borrar las carpetas `src`, `public` y `scripts` del repositorio y subir las de `OMEGA-nube-para-GitHub` completas. Archivos nuevos de la V2: `src/api-v2.js`, `src/permisos.js`, `src/estado-resultados.js`, `src/telefono.js`, `src/seed-ejercicios-v2.js`, `public/js/telefono.js`, `public/js/v2-comun.js`, `public/js/rutinas.js`, `public/js/forecast.js` (y se elimina `public/js/simulador.js`).
2. Render redespliega solo. Cuando diga **Your service is live**, abrir OMEGA en la PC (instalada con `OMEGA-Setup-Version2.exe`) y tocar **Sincronizar con la aplicación Web**.
3. No hay que volver a cargar la URL ni la clave: el instalador ya las trae en `C:\OMEGA\nube.txt` (si ya existía, se conserva).

## Alta automática de gimnasios nuevos (Versión 4)
Con la Versión 4 el gimnasio nuevo se conecta solo: abre OMEGA, carga su nombre y logo, toca **Sincronizar** y la aplicación web se crea sin que vos hagas nada. Para eso **vos preparás una sola vez** el "servicio de alta":

1. **Plantilla en GitHub:** en el repositorio base `omega-gimnasio` (con la carpeta `OMEGA-nube-para-GitHub` de esta versión subida) tildá *Settings → Template repository*.
2. **Claves:** un token de GitHub con permiso de crear repositorios (scope `repo`) y una clave de API de Render (*Account Settings → API Keys*).
3. **Subir el servicio de alta:** creá un repositorio privado con el contenido de la carpeta `servicio-alta/` y en Render hacé *New → Web Service* (Docker) desde ese repositorio. En *Environment* cargá `GITHUB_TOKEN`, `RENDER_API_KEY`, `ALTA_CLAVE` (inventá una clave larga, de 24 caracteres o más) y, si hace falta, `PLANTILLA` (dueño/repositorio base). Anotá la dirección del servicio (ej. `https://omega-alta.onrender.com`).
4. **Instalador:** se arma con esa dirección y `ALTA_CLAVE` (`ALTA_URL=… ALTA_CLAVE=… bash installer/build.sh`). Sin armar uno nuevo también sirve: en la PC del gimnasio, crear `C:\OMEGA\alta.txt` con dos líneas `ALTA_URL=…` y `ALTA_CLAVE=…` y reiniciar OMEGA.

Seguridad: las claves de GitHub y Render quedan solo en el servicio de alta. El código de alta que viaja en los instaladores únicamente permite pedir la creación de gimnasios nuevos (máximo 5 por hora, configurable con `ALTA_MAX_HORA`, sin duplicar si se reintenta); si alguna vez se filtra, se cambia `ALTA_CLAVE` en Render y se entrega un instalador nuevo. Cada gimnasio crea su servicio en el plan gratuito de Render (se "duerme" si no se usa).

*Nota:* se probó de punta a punta contra GitHub y Render simulados, no contra los reales. Si alguno devuelve un error, la app lo muestra tal cual.

### Alta manual (alternativa)
`GITHUB_TOKEN` y `RENDER_API_KEY` en el entorno y `node herramientas/alta-gimnasio.js --nombre "Gimnasio Sol"` imprime dirección, clave y código de conexión para pegar en **Sincronizar → Ya tengo la dirección y la clave**.
