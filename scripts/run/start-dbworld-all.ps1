# ==========================================================
# Start DbWorld Backend + Frontend without IntelliJ
# Place this file under: db-world\scripts\start-dbworld-all.ps1
# ==========================================================

$ScriptsDir = Split-Path -Parent $MyInvocation.MyCommand.Path
# This script lives in scripts\run\ — repo root is two levels up.
$BaseDir = Split-Path -Parent (Split-Path -Parent $ScriptsDir)

# Backend + frontend runners live alongside this script (scripts\run\).
$BackendScript = Join-Path $ScriptsDir "start-dbworld-backend.ps1"
$FrontendScript = Join-Path $ScriptsDir "start-dbworld-frontend.ps1"

if (!(Test-Path $BackendScript)) {
    Write-Host "[ERROR] Backend script not found: $BackendScript" -ForegroundColor Red
    exit 1
}

if (!(Test-Path $FrontendScript)) {
    Write-Host "[ERROR] Frontend script not found: $FrontendScript" -ForegroundColor Red
    exit 1
}

Write-Host "==========================================================" -ForegroundColor DarkGray
Write-Host "Starting DbWorld Application" -ForegroundColor Cyan
Write-Host "Project root : $BaseDir"
Write-Host "Scripts dir  : $ScriptsDir"
Write-Host "==========================================================" -ForegroundColor DarkGray
Write-Host ""
Write-Host "Backend logs will open in a separate PowerShell window." -ForegroundColor Yellow
Write-Host "Frontend logs will open in a separate PowerShell window." -ForegroundColor Yellow
Write-Host "Use Ctrl+C in each service window to stop that service." -ForegroundColor Yellow
Write-Host ""

Start-Process powershell.exe -ArgumentList @(
    "-NoExit",
    "-ExecutionPolicy", "Bypass",
    "-File", "`"$BackendScript`""
) -WorkingDirectory $BaseDir

Start-Process powershell.exe -ArgumentList @(
    "-NoExit",
    "-ExecutionPolicy", "Bypass",
    "-File", "`"$FrontendScript`""
) -WorkingDirectory $BaseDir

Write-Host "Started backend and frontend windows." -ForegroundColor Green
