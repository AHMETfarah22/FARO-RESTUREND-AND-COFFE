@echo off
rem ------------------------------------------------------------------
rem  FARO RESTURENT AND COFFE - sistemi baslatir.
rem  Cift tiklayin. Acilan pencereyi kapatmayin (kucultebilirsiniz):
rem  pencere kapaninca sistem durur.
rem ------------------------------------------------------------------
chcp 65001 >nul
title FARO RESTURENT AND COFFE
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0app\baslat.ps1"
