<#
.SYNOPSIS
    Build the signed DB World release APK locally (Windows) and publish it +
    version.json to the backend's release directory, for the in-app updater.

.DESCRIPTION
    Publish-only flow - no CI Android build. The script:
      1. Picks the next versionCode automatically (current published one + 1,
         read from the live /api/app/version endpoint; starts at 2 if none).
      2. Builds the web bundle, runs 'cap sync', and 'gradlew assembleRelease'
         with that versionCode (so the APK and version.json always agree).
      3. Writes version.json and copies both files to the server via scp/ssh.

    Requires: Node + Android SDK + JDK 17 locally (same as a normal APK build),
    android/keystore.properties present, and OpenSSH (ssh/scp) with access to
    the server. The APK is signed with your existing key.

.EXAMPLE
    ./scripts/publish-android.ps1 -VersionName 1.0.1 -Server dbworld_admin@ssh.db-world.in -Changelog "Bug fixes"

.EXAMPLE
    # Force everyone to update before using the app
    ./scripts/publish-android.ps1 -VersionName 1.5.0 -Mandatory -Server dbworld_admin@ssh.db-world.in
#>
param(
    [Parameter(Mandatory = $true)] [string] $VersionName,
    [Parameter(Mandatory = $true)] [string] $Server,        # ssh target, e.g. user@host
    [string] $ReleaseDir       = '/app/db_world/releases',  # MUST match backend app.release-dir
    [string] $VersionEndpoint  = 'https://api.db-world.in/api/app/version',
    [int]    $VersionCode      = 0,                          # 0 = auto (current + 1)
    [switch] $Mandatory,
    [int]    $MinSupportedCode = 0,
    [string] $Changelog        = '',
    [ValidateSet('production','local','default')]
    [string] $BuildMode        = 'production',               # env the APK is built with (publish should stay 'production')
    [switch] $SkipBuild                                      # publish an already-built APK (needs -VersionCode)
)

$ErrorActionPreference = 'Stop'
$frontend = Join-Path $PSScriptRoot '..\db-world-frontend' | Resolve-Path
$apk      = Join-Path $frontend 'android\app\build\outputs\apk\release\app-release.apk'

function Step($m) { Write-Host "`n> $m" -ForegroundColor Cyan }

# 1. Decide the next versionCode ------------------------------------------------
if ($VersionCode -le 0) {
    try {
        $resp = Invoke-RestMethod -Uri $VersionEndpoint -TimeoutSec 15
        $current = [int]($resp.data.versionCode)
        $VersionCode = $current + 1
        Write-Host "Current published versionCode = $current -> new = $VersionCode" -ForegroundColor DarkGray
    } catch {
        $VersionCode = 2   # nothing published yet (installed default build is 1)
        Write-Host "No current release detected -> starting at versionCode = $VersionCode" -ForegroundColor DarkGray
    }
}
Write-Host "Publishing versionCode=$VersionCode versionName=$VersionName mandatory=$($Mandatory.IsPresent)" -ForegroundColor Yellow

# 2. Build the signed APK (skip only if you pass the matching -VersionCode) ------
if (-not $SkipBuild) {
    # production (default) -> ../runtime/.env.production ; local -> .env.local ; default -> no env-cmd
    $buildScript = switch ($BuildMode) { 'local' { 'build:local' } 'default' { 'build' } default { 'build:production' } }
    if ($BuildMode -ne 'production') {
        Write-Host "WARNING: building with '$BuildMode' env - do NOT publish a non-production APK to the prod server." -ForegroundColor Yellow
    }
    Step "Building web bundle ($buildScript)"
    Push-Location $frontend
    try {
        & npm run $buildScript; if ($LASTEXITCODE) { throw "npm run $buildScript failed" }
        & npx cap sync android; if ($LASTEXITCODE) { throw "cap sync failed" }
    } finally { Pop-Location }

    Step "Assembling signed release APK (versionCode=$VersionCode)"
    Push-Location (Join-Path $frontend 'android')
    try {
        & .\gradlew.bat assembleRelease "-PappVersionCode=$VersionCode" "-PappVersionName=$VersionName"
        if ($LASTEXITCODE) { throw "gradlew assembleRelease failed" }
    } finally { Pop-Location }
}

if (-not (Test-Path $apk)) { throw "APK not found at $apk" }

# 3. Write version.json (UTF-8, no BOM - Jackson-friendly) ----------------------
Step "Writing version.json"
$meta = [ordered]@{
    versionCode      = $VersionCode
    versionName      = $VersionName
    mandatory        = $Mandatory.IsPresent
    minSupportedCode = $MinSupportedCode
    changelog        = $Changelog
}
$json   = $meta | ConvertTo-Json -Depth 5
$tmpDir = Join-Path $env:TEMP 'dbworld-release'
New-Item -ItemType Directory -Force -Path $tmpDir | Out-Null
$jsonPath = Join-Path $tmpDir 'version.json'   # real name so scp lands it correctly
[System.IO.File]::WriteAllText($jsonPath, $json, (New-Object System.Text.UTF8Encoding $false))

# 4. Publish via scp/ssh - 2 connections (2 password prompts max; 0 with an SSH
#    key). APK is listed first so version.json only lands after the (large) APK
#    is fully uploaded - clients never see a version pointing at a missing APK.
Step "Uploading to ${Server}:${ReleaseDir}"
& ssh $Server "mkdir -p '$ReleaseDir'";            if ($LASTEXITCODE) { throw "ssh mkdir failed" }
& scp $apk $jsonPath "${Server}:${ReleaseDir}/";   if ($LASTEXITCODE) { throw "scp upload failed" }

Write-Host "`nOK: Published versionCode=$VersionCode ($VersionName) to ${Server}:${ReleaseDir}" -ForegroundColor Green
Write-Host "Devices on an older build will be prompted to update on next launch." -ForegroundColor Green
