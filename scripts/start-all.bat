@echo off
REM DbWorld - launch backend + frontend, each in its own window. Double-click to run.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0run\start-dbworld-all.ps1" %*
pause
