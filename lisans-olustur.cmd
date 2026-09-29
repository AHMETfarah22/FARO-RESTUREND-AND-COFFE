@echo off
rem ------------------------------------------------------------------
rem  FARO RESTURENT AND COFFE - musteriye lisans anahtari olusturur.
rem  Cift tiklayin: musteri adini ve musterinin ekranindaki makine
rem  kodunu girin; anahtar panoya kopyalanir.
rem  Imza anahtari: %USERPROFILE%\.faro-license (yedekleyin!)
rem ------------------------------------------------------------------
chcp 65001 >nul
node "%~dp0tools\license\faro-license.mjs"
pause
