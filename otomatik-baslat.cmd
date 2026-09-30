@echo off
rem ------------------------------------------------------------------
rem  FARO RESTURENT AND COFFE - bilgisayar acilinca otomatik baslatma
rem  Cift tiklayin: start.cmd'yi Windows baslangicina ekler veya kaldirir.
rem ------------------------------------------------------------------
chcp 65001 >nul
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\release\package\otomatik-baslat.ps1" -Target "%~dp0start.cmd"
pause
