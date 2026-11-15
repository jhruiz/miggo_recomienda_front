@echo off
set PATH=C:\laragon\bin\nodejs\node-v22;%PATH%
npm.cmd run build > "c:\laragon\www\miggo-recomienda\frontend\tmp_build.out" 2>&1
echo EXIT=%ERRORLEVEL% >> "c:\laragon\www\miggo-recomienda\frontend\tmp_build.out"
