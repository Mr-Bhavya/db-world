@echo off
REM DbWorld - build the backend WAR (pins JDK 25, runs tests). Double-click to run.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build\build-dbworld-backend.ps1" %*
