@echo off
setlocal

REM ==========================================================
REM DbWorld launcher
REM Place this file under: db-world\scripts\start-dbworld-all.bat
REM It starts backend and frontend through PowerShell scripts.
REM ==========================================================

set "SCRIPTS_DIR=%~dp0"
set "PS_SCRIPT=%SCRIPTS_DIR%start-dbworld-all.ps1"

if not exist "%PS_SCRIPT%" (
    echo [ERROR] PowerShell script not found: "%PS_SCRIPT%"
    pause
    exit /b 1
)

powershell.exe -NoExit -ExecutionPolicy Bypass -File "%PS_SCRIPT%"
exit /b %ERRORLEVEL%
