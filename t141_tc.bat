@echo off
set PATH=C:\laragon\bin\nodejs\node-v22;%PATH%
node.exe node_modules/vue-tsc/bin/vue-tsc.js --noEmit > t141_tc.txt 2>&1
echo done >> t141_tc.txt
