@echo off
"%~dp0runtime\omega-node.exe" "%~dp0app\lanzador.js" --detener
timeout /t 3 >nul
