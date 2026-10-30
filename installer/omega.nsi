Unicode true
!ifndef VERSION_NOMBRE
  !define VERSION_NOMBRE "Versión 3"
!endif
!ifndef VERSION_NUM
  !define VERSION_NUM "3.0.0.0"
!endif
!ifndef NUBE_URL
  !define NUBE_URL ""
!endif
!ifndef ALTA_URL
  !define ALTA_URL ""
!endif
!ifndef ALTA_CLAVE
  !define ALTA_CLAVE ""
!endif
!ifndef NUBE_CLAVE
  !define NUBE_CLAVE ""
!endif
!ifndef SALIDA
  !define SALIDA "OMEGA-Setup-Version3.exe"
!endif
; Por defecto el instalador trae los dos motores (Windows de 64 y de 32 bits) y deja elegir. -DSOLO64 / -DSOLO32 arman uno solo.
!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "x64.nsh"
!include "nsDialogs.nsh"

Name "OMEGA - ${VERSION_NOMBRE}"
OutFile "${SALIDA}"
InstallDir "$PROGRAMFILES\OMEGA"
InstallDirRegKey HKLM "Software\OMEGA" "Carpeta"
RequestExecutionLevel admin
SetCompressor /SOLID lzma
VIProductVersion "${VERSION_NUM}"
VIAddVersionKey "ProductName" "OMEGA - Gestión de gimnasio"
VIAddVersionKey "CompanyName" "Gimnasio OMEGA"
VIAddVersionKey "LegalCopyright" "© Gimnasio OMEGA"
VIAddVersionKey "FileDescription" "Instalador de OMEGA - ${VERSION_NOMBRE}"
VIAddVersionKey "FileVersion" "${VERSION_NUM}"
VIAddVersionKey "ProductVersion" "${VERSION_NUM}"
VIAddVersionKey "OriginalFilename" "${SALIDA}"
VIAddVersionKey "InternalName" "OMEGA-Setup"

!define MUI_ICON "omega.ico"
!define MUI_UNICON "omega.ico"
!define MUI_ABORTWARNING
!define MUI_WELCOMEPAGE_TITLE "Instalar OMEGA"
!define MUI_WELCOMEPAGE_TEXT "Este asistente instala OMEGA (${VERSION_NOMBRE}), el sistema de gestión del gimnasio.$\r$\n$\r$\nSe crea un icono en el escritorio. La base de datos se guarda en C:\OMEGA\datos y no se borra al actualizar ni al desinstalar."
!define MUI_FINISHPAGE_RUN ""
!define MUI_FINISHPAGE_RUN_FUNCTION LanzarOmega
!define MUI_FINISHPAGE_RUN_TEXT "Abrir OMEGA ahora"

Var ArqSel
Var ArqR64
Var ArqR32
Var EsNueva

!insertmacro MUI_PAGE_WELCOME
!ifndef SOLO64
!ifndef SOLO32
  Page custom PaginaArq PaginaArqSalir
!endif
!endif
!insertmacro MUI_PAGE_COMPONENTS
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "Spanish"

; ---------- elección de 32 o 64 bits ----------
Function .onInit
  StrCpy $ArqSel "32"
  ${If} ${RunningX64}
    StrCpy $ArqSel "64"
  ${EndIf}
  !ifdef SOLO64
    StrCpy $ArqSel "64"
  !endif
  !ifdef SOLO32
    StrCpy $ArqSel "32"
  !endif
  ReadRegStr $0 HKLM "Software\OMEGA" "Carpeta"
  ${If} $0 == ""
    StrCpy $EsNueva "1"
    ${If} $ArqSel == "64"
      StrCpy $INSTDIR "$PROGRAMFILES64\OMEGA"
    ${Else}
      StrCpy $INSTDIR "$PROGRAMFILES\OMEGA"
    ${EndIf}
  ${Else}
    StrCpy $EsNueva "0"
  ${EndIf}
FunctionEnd

Function PaginaArq
  !insertmacro MUI_HEADER_TEXT "Versión de Windows" "Elegí si esta PC usa Windows de 64 o de 32 bits."
  nsDialogs::Create 1018
  Pop $0
  ${NSD_CreateLabel} 0 0 100% 36u "OMEGA incluye su propio motor para las dos versiones. Ya se marcó la que corresponde a esta PC; solo cambiala si sabés que es otra (Configuración > Sistema > Acerca de > Tipo de sistema)."
  Pop $0
  ${NSD_CreateRadioButton} 10 44u 100% 12u "Windows de 64 bits (recomendado para PC modernas)"
  Pop $ArqR64
  ${NSD_CreateRadioButton} 10 60u 100% 12u "Windows de 32 bits (PC antiguas)"
  Pop $ArqR32
  ${If} $ArqSel == "64"
    ${NSD_Check} $ArqR64
  ${Else}
    ${NSD_Check} $ArqR32
  ${EndIf}
  ${IfNot} ${RunningX64}
    EnableWindow $ArqR64 0
    ${NSD_CreateLabel} 0 82u 100% 24u "Esta PC es de 32 bits: la opción de 64 bits no se puede usar acá."
    Pop $0
  ${EndIf}
  nsDialogs::Show
FunctionEnd

Function PaginaArqSalir
  ${NSD_GetState} $ArqR64 $0
  ${If} $0 == ${BST_CHECKED}
    StrCpy $ArqSel "64"
  ${Else}
    StrCpy $ArqSel "32"
  ${EndIf}
  ${If} $ArqSel == "64"
  ${AndIfNot} ${RunningX64}
    MessageBox MB_OK|MB_ICONEXCLAMATION "Esta PC es de 32 bits. Elegí la opción de 32 bits."
    Abort
  ${EndIf}
  ${If} $EsNueva == "1"
    ${If} $ArqSel == "64"
      StrCpy $INSTDIR "$PROGRAMFILES64\OMEGA"
    ${Else}
      StrCpy $INSTDIR "$PROGRAMFILES\OMEGA"
    ${EndIf}
  ${EndIf}
FunctionEnd

Function LanzarOmega
  Exec '"$INSTDIR\runtime\omega-node.exe" --disable-warning=ExperimentalWarning "$INSTDIR\app\lanzador.js"'
FunctionEnd

Section "OMEGA (obligatorio)" SecBase
  SectionIn RO
  SetShellVarContext all
  ; Si ya hay un OMEGA andando se lo apaga de forma ordenada (sin forzar procesos)
  ${If} ${FileExists} "$INSTDIR\app\lanzador.js"
    nsExec::Exec '"$INSTDIR\runtime\omega-node.exe" "$INSTDIR\app\lanzador.js" --detener'
  ${ElseIf} ${FileExists} "$INSTDIR\omega-launcher.vbs"
    ; instalación de una versión anterior (sin apagado ordenado)
    nsExec::Exec 'taskkill /IM omega-node.exe /F'
  ${EndIf}
  Sleep 1500
  SetOutPath "$INSTDIR"
  RMDir /r "$INSTDIR\app"
  File /r "stage\*.*"
  Delete "$INSTDIR\omega-launcher.vbs"
  CreateDirectory "$INSTDIR\runtime"
  ${If} $ArqSel == "64"
    File "/oname=$INSTDIR\runtime\omega-node.exe" "nodos\x64\omega-node.exe"
  ${Else}
    File "/oname=$INSTDIR\runtime\omega-node.exe" "nodos\x86\omega-node.exe"
  ${EndIf}

  ; Carpetas de datos (se conservan siempre)
  CreateDirectory "C:\OMEGA"
  CreateDirectory "C:\OMEGA\datos"
  CreateDirectory "C:\OMEGA\copias"
  nsExec::Exec 'icacls "C:\OMEGA" /grant *S-1-5-32-545:(OI)(CI)M /T /C /Q'
  ; ícono de los accesos directos: queda en C:\OMEGA para que OMEGA pueda cambiarlo cuando el gimnasio sube su logo
  ${IfNot} ${FileExists} "C:\OMEGA\omega.ico"
    CopyFiles /SILENT "$INSTDIR\omega.ico" "C:\OMEGA\omega.ico"
  ${EndIf}

  ; Configuración (solo si no existe, para no pisar cambios del usuario)
  ${IfNot} ${FileExists} "C:\OMEGA\config.txt"
    StrCpy $1 "C:\OMEGA\copias"
    ReadEnvStr $0 "OneDriveCommercial"
    ${If} $0 == ""
      ReadEnvStr $0 "OneDrive"
    ${EndIf}
    ${If} $0 != ""
      StrCpy $1 "$0\omega\backups"
      CreateDirectory "$0\omega"
      CreateDirectory "$0\omega\backups"
    ${EndIf}
    FileOpen $2 "C:\OMEGA\config.txt" w
    FileWrite $2 "# Configuración de OMEGA (editar y reiniciar OMEGA para aplicar)$\r$\n"
    FileWrite $2 "PORT=3000$\r$\n"
    FileWrite $2 "DATA_DIR=C:\OMEGA\datos$\r$\n"
    FileWrite $2 "BACKUP_DIR=$1$\r$\n"
    FileClose $2
  ${EndIf}
  ; Acceso al servicio de alta automática (crea la aplicación web del gimnasio nuevo desde el botón Sincronizar)
  !if "${ALTA_URL}" != ""
    FileOpen $2 "C:\OMEGA\alta.txt" w
    FileWrite $2 "# Acceso al servicio de alta de OMEGA (no editar).$\r$\n"
    FileWrite $2 "ALTA_URL=${ALTA_URL}$\r$\n"
    FileWrite $2 "ALTA_CLAVE=${ALTA_CLAVE}$\r$\n"
    FileClose $2
  !endif
  ; Conexión con la aplicación web (si el instalador la trae completa se escribe; si no, solo se crea la plantilla vacía)
  !if "${NUBE_URL}" != ""
    FileOpen $2 "C:\OMEGA\nube.txt" w
    FileWrite $2 "# Conexión con la aplicación web (ya configurada por el instalador).$\r$\n"
    FileWrite $2 "NUBE_URL=${NUBE_URL}$\r$\n"
    FileWrite $2 "NUBE_CLAVE=${NUBE_CLAVE}$\r$\n"
    FileClose $2
  !else
  ${IfNot} ${FileExists} "C:\OMEGA\nube.txt"
    FileOpen $2 "C:\OMEGA\nube.txt" w
    FileWrite $2 "# Conexión con la aplicación web (nube). Se completa desde OMEGA con el botón Sincronizar.$\r$\n"
    FileWrite $2 "NUBE_URL=$\r$\n"
    FileWrite $2 "NUBE_CLAVE=$\r$\n"
    FileClose $2
  ${EndIf}
  !endif

  ; Accesos directos (el motor de OMEGA ejecuta el lanzador; la ventana queda minimizada)
  Delete "$DESKTOP\OMEGA.lnk"
  CreateShortcut "$DESKTOP\OMEGA.lnk" "$INSTDIR\runtime\omega-node.exe" '--disable-warning=ExperimentalWarning "$INSTDIR\app\lanzador.js"' "C:\OMEGA\omega.ico" 0 SW_SHOWMINIMIZED "" "Abrir OMEGA"
  CreateDirectory "$SMPROGRAMS\OMEGA"
  Delete "$SMPROGRAMS\OMEGA\OMEGA.lnk"
  CreateShortcut "$SMPROGRAMS\OMEGA\OMEGA.lnk" "$INSTDIR\runtime\omega-node.exe" '--disable-warning=ExperimentalWarning "$INSTDIR\app\lanzador.js"' "C:\OMEGA\omega.ico" 0 SW_SHOWMINIMIZED "" "Abrir OMEGA"
  CreateShortcut "$SMPROGRAMS\OMEGA\Detener OMEGA.lnk" "$INSTDIR\runtime\omega-node.exe" '--disable-warning=ExperimentalWarning "$INSTDIR\app\lanzador.js" --detener' "C:\OMEGA\omega.ico" 0 SW_SHOWMINIMIZED
  CreateShortcut "$SMPROGRAMS\OMEGA\Leeme.lnk" "$INSTDIR\LEEME.txt"
  CreateShortcut "$SMPROGRAMS\OMEGA\Carpeta de datos.lnk" "C:\OMEGA"
  CreateShortcut "$SMPROGRAMS\OMEGA\Desinstalar OMEGA.lnk" "$INSTDIR\desinstalar.exe"

  WriteUninstaller "$INSTDIR\desinstalar.exe"
  WriteRegStr HKLM "Software\OMEGA" "Carpeta" "$INSTDIR"
  WriteRegStr HKLM "Software\OMEGA" "Version" "${VERSION_NOMBRE}"
  WriteRegStr HKLM "Software\OMEGA" "Arquitectura" "$ArqSel"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\OMEGA" "DisplayName" "OMEGA - ${VERSION_NOMBRE}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\OMEGA" "DisplayVersion" "${VERSION_NOMBRE}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\OMEGA" "Publisher" "Gimnasio OMEGA"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\OMEGA" "DisplayIcon" "$INSTDIR\omega.ico"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\OMEGA" "UninstallString" '"$INSTDIR\desinstalar.exe"'
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\OMEGA" "NoModify" 1
SectionEnd

Section "Iniciar el servidor al encender Windows" SecAuto
  SetShellVarContext all
  CreateShortcut "$SMSTARTUP\OMEGA servidor.lnk" "$INSTDIR\runtime\omega-node.exe" '--disable-warning=ExperimentalWarning "$INSTDIR\app\lanzador.js" --silencioso' "C:\OMEGA\omega.ico" 0 SW_SHOWMINIMIZED
SectionEnd

Section /o "Permitir el acceso desde los celulares del gimnasio (firewall)" SecFw
  nsExec::Exec 'netsh advfirewall firewall delete rule name="OMEGA"'
  nsExec::Exec 'netsh advfirewall firewall add rule name="OMEGA" dir=in action=allow program="$INSTDIR\runtime\omega-node.exe" enable=yes profile=private,domain'
SectionEnd

LangString DESC_Base ${LANG_SPANISH} "Programa, icono del escritorio y carpetas de datos."
LangString DESC_Auto ${LANG_SPANISH} "Recomendado para la PC del gimnasio: el servidor queda andando (copias de las 22:00 y acceso desde los celulares) sin abrir el icono."
LangString DESC_Fw ${LANG_SPANISH} "Opcional. Si no la marcás, Windows te va a preguntar la primera vez si permitís el acceso de los celulares: respondé Permitir."
!insertmacro MUI_FUNCTION_DESCRIPTION_BEGIN
  !insertmacro MUI_DESCRIPTION_TEXT ${SecBase} $(DESC_Base)
  !insertmacro MUI_DESCRIPTION_TEXT ${SecAuto} $(DESC_Auto)
  !insertmacro MUI_DESCRIPTION_TEXT ${SecFw} $(DESC_Fw)
!insertmacro MUI_FUNCTION_DESCRIPTION_END

Section "Uninstall"
  SetShellVarContext all
  ${If} ${FileExists} "$INSTDIR\app\lanzador.js"
    nsExec::Exec '"$INSTDIR\runtime\omega-node.exe" "$INSTDIR\app\lanzador.js" --detener'
    Sleep 1500
  ${EndIf}
  nsExec::Exec 'netsh advfirewall firewall delete rule name="OMEGA"'
  Delete "$DESKTOP\OMEGA.lnk"
  Delete "$SMSTARTUP\OMEGA servidor.lnk"
  RMDir /r "$SMPROGRAMS\OMEGA"
  RMDir /r "$INSTDIR"
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\OMEGA"
  DeleteRegKey HKLM "Software\OMEGA"
  MessageBox MB_OK|MB_ICONINFORMATION "OMEGA se desinstaló.$\r$\n$\r$\nTus datos y copias de seguridad NO se borraron: siguen en C:\OMEGA (y en la carpeta de copias configurada). Si volvés a instalar OMEGA, se recuperan solos."
SectionEnd
