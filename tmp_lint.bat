@echo off
set PATH=C:\laragon\bin\nodejs\node-v22;%PATH%
npm.cmd exec eslint -- -c .eslintrc.cjs --fix src/pages/quotes/received.vue src/components/quotes/AwaitingQuoteCard.vue src/stores/quotes.ts src/services/quotes.ts > "c:\laragon\www\miggo-recomienda\frontend\tmp_lint.out" 2>&1
echo EXIT=%ERRORLEVEL% >> "c:\laragon\www\miggo-recomienda\frontend\tmp_lint.out"
