@echo off
REM DbWorld - run the backend in DEV mode with live reload (spring-boot:run). Double-click to run.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0run\dev-dbworld-backend.ps1" %*
pause
