@echo off
REM DbWorld - run the built backend WAR (target\db-world.war). Double-click to run.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0run\start-dbworld-backend.ps1" %*
