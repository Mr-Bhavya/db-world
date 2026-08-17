# ==========================================================
# DbWorld Backend Runner
# Place this file under: db-world\scripts\start-dbworld-backend.ps1
# Loads db-world\runtime\backend.env
# Runs db-world\db-world-backend\target\db-world.war
# Active Spring profile: local
# ==========================================================

$ActiveProfile = "local"

$ScriptsDir = Split-Path -Parent $MyInvocation.MyCommand.Path
# This script lives in scripts\run\ - repo root is two levels up.
$BaseDir = Split-Path -Parent (Split-Path -Parent $ScriptsDir)

# Shared helpers (JDK-25 resolver etc.). Optional - fall back gracefully if absent.
$CommonFile = Join-Path (Split-Path -Parent $ScriptsDir) "lib\dbworld-common.ps1"
if (Test-Path $CommonFile) { . $CommonFile }

$BackendDir = Join-Path $BaseDir "db-world-backend"
$RuntimeDir = Join-Path $BaseDir "runtime"
$EnvFile = Join-Path $RuntimeDir "backend.env"
$WarFile = Join-Path $BackendDir "target\db-world.war"

$host.UI.RawUI.WindowTitle = "DbWorld Backend Logs"

function Stop-WithError($Message) {
    Write-Host "[ERROR] $Message" -ForegroundColor Red
    Write-Host ""
    Write-Host "Press any key to close this window..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

Write-Host "==========================================================" -ForegroundColor DarkGray
Write-Host "DbWorld Backend" -ForegroundColor Cyan
Write-Host "Project root   : $BaseDir"
Write-Host "Backend dir    : $BackendDir"
Write-Host "Env file       : $EnvFile"
Write-Host "WAR file       : $WarFile"
Write-Host "Active profile : $ActiveProfile"
Write-Host "==========================================================" -ForegroundColor DarkGray
Write-Host ""

if (!(Test-Path $BackendDir)) {
    Stop-WithError "Backend folder not found: $BackendDir"
}

if (!(Test-Path $EnvFile)) {
    Stop-WithError "Env file not found: $EnvFile"
}

if (!(Test-Path $WarFile)) {
    Stop-WithError "WAR file not found: $WarFile. Build backend first using: mvn clean package"
}

Write-Host "Loading environment variables from backend.env..." -ForegroundColor Yellow

Get-Content $EnvFile | ForEach-Object {
    $line = $_.Trim()

    if (!$line) { return }
    if ($line.StartsWith("#")) { return }
    if ($line.StartsWith("//")) { return }

    if ($line.StartsWith("export ")) {
        $line = $line.Substring(7).Trim()
    }

    if ($line.Contains("=")) {
        $parts = $line.Split("=", 2)
        $key = $parts[0].Trim()
        $value = $parts[1]

        if ($value.StartsWith('"') -and $value.EndsWith('"')) {
            $value = $value.Substring(1, $value.Length - 2)
        }
        elseif ($value.StartsWith("'") -and $value.EndsWith("'")) {
            $value = $value.Substring(1, $value.Length - 2)
        }

        if ($key) {
            [Environment]::SetEnvironmentVariable($key, $value, "Process")
        }
    }
}

$env:SPRING_PROFILES_ACTIVE = $ActiveProfile

Write-Host "Environment loaded successfully." -ForegroundColor Green
Write-Host "Starting backend WAR..." -ForegroundColor Cyan
Write-Host ""

Set-Location $BackendDir

# The WAR is built for Java 25, but JAVA_HOME here may be JDK 21 and PATH's default `java` isn't
# guaranteed to be 25. Pin a real JDK 25 so `java -jar` never hits UnsupportedClassVersionError.
$javaExe = "java"
if (Get-Command Resolve-Jdk25Home -ErrorAction SilentlyContinue) {
    $jdk = Resolve-Jdk25Home
    if ($jdk) {
        $javaExe = Join-Path $jdk "bin\java.exe"
        Write-Host "Using JDK: $jdk" -ForegroundColor DarkGray
    } else {
        Write-Host "[WARN] JDK 25 not found - falling back to 'java' on PATH." -ForegroundColor Yellow
    }
}

& $javaExe "-Dspring.profiles.active=$ActiveProfile" -jar $WarFile

$exitCode = $LASTEXITCODE
Write-Host ""
Write-Host "Backend stopped with exit code: $exitCode" -ForegroundColor Yellow
Write-Host "Press any key to close this window..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
exit $exitCode
