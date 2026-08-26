@echo off
REM DbWorld - switch the checkout between LOCAL and PROD config from db-world-config.
REM Double-click to run: the script prompts for the environment when none is given.
REM Or from a shell: switch-env.bat LOCAL   /   switch-env.bat PROD
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0env\switch-env.ps1" %*
pause
