@echo off
set PATH=C:\laragon\bin\nodejs\node-v22;%PATH%
npm.cmd run test > "c:\laragon\www\miggo-recomienda\frontend\tmp_test.out" 2>&1
echo EXIT=%ERRORLEVEL% >> "c:\laragon\www\miggo-recomienda\frontend\tmp_test.out"
