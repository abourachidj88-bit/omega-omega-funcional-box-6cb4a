#!/usr/bin/env bash
# Genera el instalador de Windows (.exe). Requiere: node, npm, makensis (NSIS).
# Uso: bash installer/build.sh      -> dist/OMEGA-Setup-Version<N>.exe   (trae los motores de 64 y de 32 bits y deja elegir)
#      NODE_ARCH=x64 | x86         -> instalador de una sola arquitectura (más chico, sin pantalla de elección)
# Firma (opcional, evita las alertas de SmartScreen/antivirus cuando el certificado tiene reputación):
#      OMEGA_PFX=/ruta/certificado.pfx OMEGA_PFX_CLAVE=... bash installer/build.sh      (requiere osslsigncode)
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT=$(pwd)
NUM=$(node -p "require('./src/version').numero")
REV=$(node -p "require('./src/version').revision||0")
SUF=""; [ "$REV" != "0" ] && SUF="-r$REV"
NOMBRE=$(node -p "require('./src/version').nombre")
NODE_VER=${NODE_WIN_VERSION:-22.23.4}
EL_VER=${ELECTRON_VERSION:-38.8.6}      # Electron 38: Windows 10 o más nuevo, 32 y 64 bits
EL_CACHE=${ELECTRON_CACHE:-/tmp/electron-cache}
SOLO=${NODE_ARCH:-}       # vacío = los dos | x64 | x86
STAGE=installer/stage
rm -rf "$STAGE" installer/nodos installer/electron; mkdir -p "$STAGE/app" installer/nodos/x64 installer/nodos/x86 installer/electron/x64 installer/electron/x86
cp server.js lanzador.js package.json "$STAGE/app/"
cp -r src public scripts "$STAGE/app/"
rm -f "$STAGE/app/src/demo-data.js"
nodo() { # $1 = x64 | x86  -> installer/nodos/$1/omega-node.exe
  local A=$1 CACHE=/tmp/omega-node-win-$1-$NODE_VER
  if [ ! -f "$CACHE/package/bin/node.exe" ] && [ ! -f "$CACHE/package/node.exe" ]; then
    mkdir -p "$CACHE"; (cd "$CACHE" && npm pack "node-win-$A@$NODE_VER" --silent >/dev/null && tar xzf node-win-$A-*.tgz)
  fi
  cp "$CACHE/package/bin/node.exe" "installer/nodos/$A/omega-node.exe" 2>/dev/null || cp "$CACHE/package/node.exe" "installer/nodos/$A/omega-node.exe"
  # copia sin consola: es la que usan los accesos directos (el servidor corre en segundo plano, sin ventana negra)
  node installer/ocultar-consola.js "installer/nodos/$A/omega-node.exe" "installer/nodos/$A/omega-oculto.exe"
}
electron() { # $1 = x64 | x86 -> installer/electron/$1  (OMEGA.exe + recursos + la app de escritorio)
  local A=$1 EA=x64; [ "$A" = x86 ] && EA=ia32
  local ZIP="$EL_CACHE/electron-v$EL_VER-win32-$EA.zip" D="installer/electron/$A"
  mkdir -p "$EL_CACHE"
  if [ ! -f "$ZIP" ]; then curl -sSL -o "$ZIP" "https://github.com/electron/electron/releases/download/v$EL_VER/electron-v$EL_VER-win32-$EA.zip"; fi
  [ -f "$EL_CACHE/SHA-$EL_VER.txt" ] || curl -sSL -o "$EL_CACHE/SHA-$EL_VER.txt" "https://github.com/electron/electron/releases/download/v$EL_VER/SHASUMS256.txt"
  (cd "$EL_CACHE" && grep "electron-v$EL_VER-win32-$EA.zip\$" "SHA-$EL_VER.txt" | sed 's/\*//' | sha256sum -c - >/dev/null) || { echo "Electron: la suma de verificación no coincide"; exit 1; }
  rm -rf "$D"; mkdir -p "$D"; unzip -q -o "$ZIP" -d "$D"
  mv "$D/electron.exe" "$D/OMEGA.exe"; rm -f "$D/resources/default_app.asar"
  # solo los idiomas necesarios (español e inglés): ahorra ~40 MB
  find "$D/locales" -name '*.pak' ! -name 'es*.pak' ! -name 'en-US.pak' -delete
  mkdir -p "$D/resources/app"; cp electron-app/main.js electron-app/package.json "$D/resources/app/"
}
XDEF=""; SUFARQ=""
case "$SOLO" in
  x64) nodo x64; electron x64; echo vacio > installer/electron/x86/vacio.txt; : > installer/nodos/x86/omega-node.exe; : > installer/nodos/x86/omega-oculto.exe; XDEF="-DSOLO64=1"; SUFARQ="-64bits" ;;
  x86) nodo x86; electron x86; echo vacio > installer/electron/x64/vacio.txt; : > installer/nodos/x64/omega-node.exe; : > installer/nodos/x64/omega-oculto.exe; XDEF="-DSOLO32=1"; SUFARQ="-32bits" ;;
  *)   nodo x64; nodo x86; electron x64; electron x86 ;;
esac
cp installer/omega.ico installer/modo-visible.bat installer/detener-omega.bat installer/restaurar-copia.bat installer/LEEME.txt "$STAGE/"
sed -i 's/$/\r/' "$STAGE/detener-omega.bat" "$STAGE/modo-visible.bat" "$STAGE/restaurar-copia.bat" "$STAGE/LEEME.txt"
SALIDA="$ROOT/dist/OMEGA-Setup-Version$NUM$SUF$SUFARQ.exe"
mkdir -p dist
(cd installer && makensis -V2 $XDEF -DVERSION_NOMBRE="$NOMBRE" -DVERSION_NUM="$NUM.0.0.0" -DNUBE_URL="${NUBE_URL:-}" -DNUBE_CLAVE="${NUBE_CLAVE:-}" -DALTA_URL="${ALTA_URL:-}" -DALTA_CLAVE="${ALTA_CLAVE:-}" -DSALIDA="$SALIDA" omega.nsi)
rm -rf installer/nodos installer/electron
if [ -n "${OMEGA_PFX:-}" ]; then
  if command -v osslsigncode >/dev/null; then
    osslsigncode sign -pkcs12 "$OMEGA_PFX" -pass "${OMEGA_PFX_CLAVE:-}" -n "OMEGA" -t http://timestamp.digicert.com -h sha256 -in "$SALIDA" -out "$SALIDA.firmado" && mv "$SALIDA.firmado" "$SALIDA" && echo "Instalador firmado."
  else echo "AVISO: osslsigncode no está instalado; el instalador queda SIN firmar."; fi
else echo "Instalador sin firma digital (ver GUIA-OMEGA.md: Antivirus y Windows SmartScreen)."; fi
( cd "$(dirname "$SALIDA")" && sha256sum "$(basename "$SALIDA")" > "$(basename "$SALIDA").sha256" )
ls -la "$SALIDA"; cat "$SALIDA.sha256"
