@echo off
rem FARO API for start.cmd: runs the API and starts it again if it stops (crash, database restart ...).
title FARO API (http://localhost:5080)
set "DOTNET=dotnet"
where dotnet >nul 2>nul || set "DOTNET=C:\Program Files\dotnet\dotnet.exe"
cd /d "%~dp0..\..\backend"
:loop
"%DOTNET%" run --project src\FaroRestaurant.Api --launch-profile http
echo.
echo API durdu. 5 saniye icinde yeniden baslatiliyor... (tamamen durdurmak icin bu pencereyi kapatin)
timeout /t 5 /nobreak >nul
goto loop
