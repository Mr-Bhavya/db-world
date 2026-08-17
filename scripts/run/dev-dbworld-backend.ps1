# ==========================================================
# DbWorld Backend - DEV (live reload)
# Runs the backend via `mvn spring-boot:run` with Spring Boot DevTools:
# a recompile of the classes triggers an automatic FAST restart, and the
# LiveReload server refreshes the browser.
#
# HOW TO GET AUTO-RECOMPILE ON SAVE (pick one):
#   * IntelliJ (smoothest): Settings > Build, Execution, Deployment > Compiler >
#     tick "Build project automatically"; then Settings > Advanced Settings >
#     tick "Allow auto-make to start even if developed application is currently
#     running". Now editing + saving a .java file auto-recompiles and DevTools
#     restarts the app in ~1-2s.
#   * No IDE: leave this window running and, in ANOTHER terminal after changes, run
#         .\build-dbworld-backend.ps1 -SkipTests      (or: mvn -o compile)
#     DevTools restarts as soon as target\classes updates.
#
# Loads runtime\backend.env, profile = local. Pins JDK 25.
# ==========================================================

. (Join-Path (Split-Path -Parent $PSScriptRoot) "lib\dbworld-common.ps1")

# This script lives in scripts\run\ — repo root is two levels up.
$ActiveProfile = "local"
$BaseDir    = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$BackendDir = Join-Path $BaseDir "db-world-backend"
$EnvFile    = Join-Path $BaseDir "runtime\backend.env"

$host.UI.RawUI.WindowTitle = "DbWorld Backend (DEV - live reload)"

Write-Host "==========================================================" -ForegroundColor DarkGray
Write-Host "DbWorld Backend - DEV (live reload)" -ForegroundColor Cyan
Write-Host "Backend dir    : $BackendDir"
Write-Host "Env file       : $EnvFile"
Write-Host "Active profile : $ActiveProfile"

if (!(Test-Path $BackendDir)) {
    Write-Host "[ERROR] Backend folder not found: $BackendDir" -ForegroundColor Red
    exit 1
}

$jdk = Resolve-Jdk25Home
if (-not $jdk) {
    Write-Host "[ERROR] No JDK 25 found. Install JDK 25 or set JAVA_HOME to it." -ForegroundColor Red
    exit 1
}
$env:JAVA_HOME = $jdk
$env:PATH = (Join-Path $jdk "bin") + ";" + $env:PATH

$mvn = Resolve-Mvn
if (-not $mvn) {
    Write-Host "[ERROR] Maven not found - put 'mvn' on PATH or install the Maven wrapper (~/.m2)." -ForegroundColor Red
    exit 1
}

if (Import-DotEnv $EnvFile) {
    Write-Host "Loaded environment from backend.env" -ForegroundColor Green
} else {
    Write-Host "[WARN] $EnvFile not found - starting without it." -ForegroundColor Yellow
}

$env:SPRING_PROFILES_ACTIVE = $ActiveProfile

Write-Host "JAVA_HOME      : $jdk"
Write-Host "Maven          : $mvn"
Write-Host "==========================================================" -ForegroundColor DarkGray
Write-Host "Starting spring-boot:run ... edit + recompile to hot-restart. Ctrl+C to stop." -ForegroundColor Cyan
Write-Host ""

Set-Location $BackendDir
& $mvn spring-boot:run "-Dspring-boot.run.profiles=$ActiveProfile"
exit $LASTEXITCODE
