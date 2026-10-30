@echo off
title OMEGA servidor (modo visible) - no cerrar
"%~dp0runtime\omega-node.exe" --disable-warning=ExperimentalWarning "%~dp0app\lanzador.js"
