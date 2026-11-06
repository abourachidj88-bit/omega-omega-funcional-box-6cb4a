Unicode true
!ifndef VERSION_NOMBRE
  !define VERSION_NOMBRE "Versión 9"
!endif
!ifndef VERSION_NUM
  !define VERSION_NUM "9.0.0.0"
!endif
!ifndef SALIDA
  !define SALIDA "OMEGA-Actualizador.exe"
!endif
!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "x64.nsh"

Name "OMEGA - Actualizador ${VERSION_NOMBRE}"
OutFile "${SALIDA}"
InstallDir ""
RequestExecutionLevel admin
SetCompressor /SOLID lzma
ShowInstDetails show
VIProductVersion "${VERSION_NUM}"
VIAddVersionKey "ProductName" "OMEGA - Gestión de gimnasio"
VIAddVersionKey "CompanyName" "Gimnasio OMEGA"
VIAddVersionKey "FileDescription" "Actualizador de OMEGA a ${VERSION_NOMBRE}"
VIAddVersionKey "FileVersion" "${VERSION_NUM}"
VIAddVersionKey "ProductVersion" "${VERSION_NUM}"
!define MUI_ICON "omega.ico"
!define MUI_ABORTWARNING
!define MUI_WELCOMEPAGE_TITLE "Actualizar OMEGA"
!define MUI_WELCOMEPAGE_TEXT "Este asistente actualiza el OMEGA que ya está instalado en esta PC a la ${VERSION_NOMBRE}.$\r$\n$\r$\nDetecta solo la versión instalada y trae todo lo que falte. Antes de cambiar nada guarda una copia de tus datos (C:\OMEGA\respaldo-actualizacion), y si la versión nueva no arranca vuelve sola a la anterior.$\r$\n$\r$\nNo hace falta cerrar OMEGA: el actualizador lo apaga y lo vuelve a iniciar."
!define MUI_FINISHPAGE_TITLE "Actualización terminada"
!define MUI_FINISHPAGE_RUN ""
!define MUI_FINISHPAGE_RUN_FUNCTION LanzarOmega
!define MUI_FINISHPAGE_RUN_TEXT "Abrir OMEGA ahora"
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_LANGUAGE "Spanish"

Var Carpeta
Var Codigo

Function LanzarOmega
  ${If} ${FileExists} "$Carpeta\escritorio\OMEGA.exe"
    Exec '"$Carpeta\escritorio\OMEGA.exe"'
  ${ElseIf} ${FileExists} "$Carpeta\runtime\omega-oculto.exe"
    Exec '"$Carpeta\runtime\omega-oculto.exe" --disable-warning=ExperimentalWarning "$Carpeta\app\lanzador.js"'
  ${EndIf}
FunctionEnd

Section "Actualizar"
  ; 1) ¿dónde está instalado OMEGA?
  SetRegView 64
  ReadRegStr $Carpeta HKLM "Software\OMEGA" "Carpeta"
  ${If} $Carpeta == ""
    SetRegView 32
    ReadRegStr $Carpeta HKLM "Software\OMEGA" "Carpeta"
  ${EndIf}
  ${If} $Carpeta == ""
  ${AndIf} ${FileExists} "$PROGRAMFILES64\OMEGA\app\lanzador.js"
    StrCpy $Carpeta "$PROGRAMFILES64\OMEGA"
  ${EndIf}
  ${If} $Carpeta == ""
  ${AndIf} ${FileExists} "$PROGRAMFILES\OMEGA\app\lanzador.js"
    StrCpy $Carpeta "$PROGRAMFILES\OMEGA"
  ${EndIf}
  ${If} $Carpeta == ""
  ${OrIfNot} ${FileExists} "$Carpeta\runtime\omega-node.exe"
    DetailPrint "No se encontró OMEGA instalado en esta PC (o es una versión muy antigua)."
    MessageBox MB_OK|MB_ICONSTOP "No encontré OMEGA instalado en esta PC.$\r$\n$\r$\nUsá el INSTALADOR BASE (OMEGA-Instalador-Base) para instalarlo desde cero."
    Abort
  ${EndIf}
  DetailPrint "OMEGA instalado en: $Carpeta"

  ; 2) se descomprime el paquete y se ejecuta la lógica con el motor de OMEGA
  InitPluginsDir
  SetOutPath "$PLUGINSDIR\pkg"
  File "actualizador.js"
  SetOutPath "$PLUGINSDIR\pkg\app"
  File /r "stage\app\*.*"
  SetOutPath "$PLUGINSDIR\pkg\electron-app"
  File /r "stage-electron\*.*"
  SetOutPath "$PLUGINSDIR"
  DetailPrint "Comprobando la versión instalada y actualizando (puede tardar un minuto)..."
  nsExec::ExecToLog '"$Carpeta\runtime\omega-node.exe" "$PLUGINSDIR\pkg\actualizador.js" --instdir "$Carpeta" --home "C:\OMEGA" --payload "$PLUGINSDIR\pkg"'
  Pop $Codigo

  ${If} $Codigo == "0"
    WriteRegStr HKLM "Software\OMEGA" "Version" "${VERSION_NOMBRE}"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\OMEGA" "DisplayName" "OMEGA - ${VERSION_NOMBRE}"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\OMEGA" "DisplayVersion" "${VERSION_NOMBRE}"
    DetailPrint "Listo: OMEGA quedó en ${VERSION_NOMBRE}."
  ${ElseIf} $Codigo == "2"
    DetailPrint "OMEGA ya estaba actualizado: no se cambió nada."
    MessageBox MB_OK|MB_ICONINFORMATION "Esta PC ya tiene ${VERSION_NOMBRE} o una más nueva.$\r$\nNo se cambió nada."
  ${ElseIf} $Codigo == "4"
    MessageBox MB_OK|MB_ICONSTOP "El motor de OMEGA instalado en esta PC es muy antiguo para esta versión.$\r$\n$\r$\nUsá el INSTALADOR BASE: conserva todos tus datos."
    Abort
  ${ElseIf} $Codigo == "5"
    MessageBox MB_OK|MB_ICONEXCLAMATION "La versión nueva no arrancó en esta PC, así que OMEGA volvió solo a la versión anterior.$\r$\nTus datos están intactos.$\r$\n$\r$\nEnviá el archivo C:\OMEGA\actualizador.log para revisarlo."
    Abort
  ${Else}
    MessageBox MB_OK|MB_ICONSTOP "No se pudo actualizar (código $Codigo). No se perdió ningún dato.$\r$\n$\r$\nCerrá OMEGA, revisá C:\OMEGA\actualizador.log y volvé a intentar."
    Abort
  ${EndIf}
SectionEnd
