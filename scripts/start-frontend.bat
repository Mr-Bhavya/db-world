@echo off
REM DbWorld - run the frontend dev server (npm run dev:local). Double-click to run.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0run\start-dbworld-frontend.ps1" %*
