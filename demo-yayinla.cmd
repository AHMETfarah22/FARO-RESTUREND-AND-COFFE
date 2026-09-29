@echo off
rem ------------------------------------------------------------------
rem  FARO RESTURENT AND COFFE - canli demoyu GitHub'da yayinlar.
rem  Cift tiklayin: demo derlenir ve herkese acik "faro-demo"
rem  deposuna gonderilir (kaynak kod gizli depoda kalir).
rem  Link: https://ahmetfarah22.github.io/faro-demo/
rem ------------------------------------------------------------------
chcp 65001 >nul
node "%~dp0tools\demo\publish-demo.mjs" %*
pause
