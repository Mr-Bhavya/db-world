# ==========================================================
# DbWorld Backend Build
# Compiles + packages db-world-backend into target\db-world.war.
# Pins JDK 25 (the pom targets Java 25) regardless of JAVA_HOME, and finds Maven
# on PATH or via the ~/.m2 wrapper.
#
# Usage:
#   .\build-dbworld-backend.ps1              # clean package (runs tests)
#   .\build-dbworld-backend.ps1 -SkipTests   # faster: skip tests
# ==========================================================
param(
    [switch]$SkipTests
)

. (Join-Path (Split-Path -Parent $PSScriptRoot) "lib\dbworld-common.ps1")

# This script lives in scripts\build\ - repo root is two levels up.
$BaseDir    = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$BackendDir = Join-Path $BaseDir "db-world-backend"

$host.UI.RawUI.WindowTitle = "DbWorld Backend Build"

function Complete-Build($code) {
    Write-Host ""
    Write-Host "Press any key to close this window..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit $code
}

Write-Host "==========================================================" -ForegroundColor DarkGray
Write-Host "DbWorld Backend Build" -ForegroundColor Cyan
Write-Host "Backend dir : $BackendDir"

if (!(Test-Path $BackendDir)) {
    Write-Host "[ERROR] Backend folder not found: $BackendDir" -ForegroundColor Red
    Complete-Build 1
}

$jdk = Resolve-Jdk25Home
if (-not $jdk) {
    Write-Host "[ERROR] No JDK 25 found. The backend targets Java 25 - install JDK 25 or set JAVA_HOME to it." -ForegroundColor Red
    Complete-Build 1
}
$env:JAVA_HOME = $jdk
$env:PATH = (Join-Path $jdk "bin") + ";" + $env:PATH

$mvn = Resolve-Mvn
if (-not $mvn) {
    Write-Host "[ERROR] Maven not found - put 'mvn' on PATH or install the Maven wrapper (~/.m2)." -ForegroundColor Red
    Complete-Build 1
}

Write-Host "JAVA_HOME   : $jdk"
Write-Host "Maven       : $mvn"
Write-Host "Skip tests  : $SkipTests"
Write-Host "==========================================================" -ForegroundColor DarkGray
Write-Host ""

Set-Location $BackendDir

$mvnArgs = @("clean", "package")
if ($SkipTests) { $mvnArgs += "-DskipTests" }

& $mvn @mvnArgs
$code = $LASTEXITCODE

Write-Host ""
if ($code -eq 0) {
    $war = Join-Path $BackendDir "target\db-world.war"
    Write-Host "BUILD SUCCESS -> $war" -ForegroundColor Green
    Write-Host "Run it with: scripts\start-dbworld-backend.ps1" -ForegroundColor DarkGray
} else {
    Write-Host "BUILD FAILED (exit $code)" -ForegroundColor Red
}
Complete-Build $code
