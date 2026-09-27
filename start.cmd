@echo off
rem ------------------------------------------------------------------
rem  FARO RESTURENT AND COFFE - start the local development portal
rem  Double-click this file. It opens the API and the web app in two
rem  windows and then opens http://localhost:5173 in your browser.
rem ------------------------------------------------------------------

set "DOTNET=dotnet"
where dotnet >nul 2>nul || set "DOTNET=C:\Program Files\dotnet\dotnet.exe"

if not exist "%~dp0frontend\node_modules" (
  echo Installing frontend packages - first run only...
  pushd "%~dp0frontend" && call npm install && popd
)

start "FARO API (http://localhost:5080)" cmd /k "cd /d "%~dp0backend" && "%DOTNET%" run --project src\FaroRestaurant.Api --launch-profile http"
start "FARO Web (http://localhost:5173)" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo Waiting for the servers to start...
timeout /t 12 /nobreak >nul
start "" http://localhost:5173
