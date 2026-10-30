@echo off
chcp 65001 >nul
REM Restaura una copia de seguridad. Uso: arrastrar el archivo omega-AAAA-MM-DD_2200.db sobre este archivo.
set DATA_DIR=C:\OMEGA\datos
set BACKUP_DIR=C:\OMEGA\copias
if exist C:\OMEGA\config.txt for /f "usebackq tokens=1,* delims==" %%a in ("C:\OMEGA\config.txt") do if /i "%%a"=="DATA_DIR" set DATA_DIR=%%b
if exist C:\OMEGA\config.txt for /f "usebackq tokens=1,* delims==" %%a in ("C:\OMEGA\config.txt") do if /i "%%a"=="BACKUP_DIR" set BACKUP_DIR=%%b
if "%~1"=="" (
  echo Arrastrá el archivo de copia ^(omega-....db^) sobre este programa.
  echo Copias disponibles en %BACKUP_DIR%:
  dir /b /o-n "%BACKUP_DIR%\omega-*.db" 2>nul
  pause & exit /b 1
)
"%~dp0runtime\omega-node.exe" "%~dp0app\lanzador.js" --detener
"%~dp0runtime\omega-node.exe" --disable-warning=ExperimentalWarning "%~dp0app\scripts\restaurar.js" "%~1"
pause
