#!/usr/bin/env bash
# Genera el ACTUALIZADOR de Windows: dist/OMEGA-Actualizador-Version<N>.exe  (requiere node y makensis; no trae motor: usa el ya instalado)
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT=$(pwd)
NUM=$(node -p "require('./src/version').numero"); REV=$(node -p "require('./src/version').revision||0")
SUF=""; [ "$REV" != "0" ] && SUF="-r$REV"
NOMBRE=$(node -p "require('./src/version').nombre")
S=installer/stage
rm -rf "$S" installer/stage-electron; mkdir -p "$S/app" installer/stage-electron
cp server.js lanzador.js package.json "$S/app/"; cp -r src public scripts "$S/app/"; rm -f "$S/app/src/demo-data.js"
cp electron-app/main.js electron-app/preload.js electron-app/preload-wa.js electron-app/package.json installer/stage-electron/
SALIDA="$ROOT/dist/OMEGA-Actualizador-Version$NUM$SUF.exe"; mkdir -p dist
(cd installer && makensis -V2 -DVERSION_NOMBRE="$NOMBRE" -DVERSION_NUM="$NUM.0.0.0" -DSALIDA="$SALIDA" actualizador.nsi)
rm -rf "$S" installer/stage-electron
( cd dist && sha256sum "$(basename "$SALIDA")" > "$(basename "$SALIDA").sha256" ); ls -la "$SALIDA"; cat "$SALIDA.sha256"
