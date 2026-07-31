# ==========================================================
# DbWorld Frontend Runner
# Place this file under: db-world\scripts\start-dbworld-frontend.ps1
# Runs npm run dev:local from db-world\db-world-frontend
# ==========================================================

$ScriptsDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BaseDir = Split-Path -Parent $ScriptsDir

$FrontendDir = Join-Path $BaseDir "db-world-frontend"
$PackageJson = Join-Path $FrontendDir "package.json"

$host.UI.RawUI.WindowTitle = "DbWorld Frontend Logs"

function Stop-WithError($Message) {
    Write-Host "[ERROR] $Message" -ForegroundColor Red
    Write-Host ""
    Write-Host "Press any key to close this window..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

Write-Host "==========================================================" -ForegroundColor DarkGray
Write-Host "DbWorld Frontend" -ForegroundColor Cyan
Write-Host "Project root : $BaseDir"
Write-Host "Frontend dir : $FrontendDir"
Write-Host "Command      : npm run dev:local"
Write-Host "==========================================================" -ForegroundColor DarkGray
Write-Host ""

if (!(Test-Path $FrontendDir)) {
    Stop-WithError "Frontend folder not found: $FrontendDir"
}

if (!(Test-Path $PackageJson)) {
    Stop-WithError "package.json not found: $PackageJson"
}

Set-Location $FrontendDir

Write-Host "Starting frontend..." -ForegroundColor Cyan
Write-Host ""

npm run dev:local

$exitCode = $LASTEXITCODE
Write-Host ""
Write-Host "Frontend stopped with exit code: $exitCode" -ForegroundColor Yellow
Write-Host "Press any key to close this window..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
exit $exitCode
