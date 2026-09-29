@echo off
rem ------------------------------------------------------------------
rem  FARO RESTURENT AND COFFE - musteri kurulum paketini olusturur.
rem  Cift tiklayin. Sonuc: release\FARO-Restaurant (ve .zip dosyasi).
rem  Ayrintilar: tools\release\build-release.ps1
rem ------------------------------------------------------------------
chcp 65001 >nul
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\release\build-release.ps1"
pause
