@echo off
rem FARO web app for start.cmd: runs the Vite dev server and starts it again if it stops.
title FARO Web (http://localhost:5173)
cd /d "%~dp0..\..\frontend"
if not exist node_modules call npm install
:loop
call npm run dev
echo.
echo Web sunucusu durdu. 5 saniye icinde yeniden baslatiliyor... (tamamen durdurmak icin bu pencereyi kapatin)
timeout /t 5 /nobreak >nul
goto loop
