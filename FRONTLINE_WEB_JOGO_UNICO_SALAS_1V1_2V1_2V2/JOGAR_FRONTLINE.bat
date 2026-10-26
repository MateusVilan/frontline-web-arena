@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
title FRONTLINE.WEB - Jogar
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\PREPARAR_E_INICIAR.ps1" -Modo Local
endlocal
