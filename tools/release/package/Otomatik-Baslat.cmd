@echo off
rem ------------------------------------------------------------------
rem  FARO RESTURENT AND COFFE - bilgisayar acilinca otomatik baslatma
rem  Cift tiklayin: FARO-Baslat.cmd'yi Windows baslangicina ekler
rem  veya kaldirir.
rem ------------------------------------------------------------------
chcp 65001 >nul
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0app\otomatik-baslat.ps1" -Target "%~dp0FARO-Baslat.cmd"
pause
