@echo off
rem ------------------------------------------------------------------
rem  FARO RESTURENT AND COFFE - start the local portal
rem  Double-click this file. It opens the API and the web app in two
rem  (minimized) windows and then opens http://localhost:5173.
rem  Both restart by themselves if they stop. To start FARO together
rem  with Windows, run otomatik-baslat.cmd once.
rem ------------------------------------------------------------------

rem Already running (e.g. started with Windows)? Then only open the browser.
netstat -ano | findstr /r /c:":5080 .*LISTENING" >nul || start "FARO API" /min "%~dp0tools\dev\run-api.cmd"
netstat -ano | findstr /r /c:":5173 .*LISTENING" >nul || start "FARO Web" /min "%~dp0tools\dev\run-web.cmd"

echo Waiting for the servers to start...
for /l %%i in (1,1,60) do (
  netstat -ano | findstr /r /c:":5173 .*LISTENING" >nul && goto open
  timeout /t 1 /nobreak >nul
)
:open
start "" http://localhost:5173
