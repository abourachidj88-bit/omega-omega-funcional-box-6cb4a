@echo off
chcp 65001 >nul
title OMEGA - servidor del gimnasio
REM ---- Configuración (editá estas líneas si hace falta) ----
REM Datos de la app (base de datos y videos): carpeta LOCAL, fuera de OneDrive, para que SQLite no se dañe.
set DATA_DIR=C:\OMEGA\datos
REM Copias automáticas (todos los días 22:00): carpeta "omega" de OneDrive, que se sincroniza sola a la nube.
set BACKUP_DIR=%USERPROFILE%\OneDrive\omega\backups
set PORT=3000
cd /d "%~dp0"
echo Iniciando OMEGA... (dejá esta ventana abierta)
echo Abrí http://localhost:%PORT% en esta PC, o http://IP-DE-ESTA-PC:%PORT% desde el celular (misma red WiFi).
node --disable-warning=ExperimentalWarning server.js
pause
