@echo off
REM DbWorld - build the backend WAR, SKIPPING tests (faster). Double-click to run.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build\build-dbworld-backend.ps1" -SkipTests %*
