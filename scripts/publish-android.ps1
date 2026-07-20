<#
.SYNOPSIS
    Build (and optionally publish) the signed DB World release APK.

.DESCRIPTION
    Interactive by default: run it with NO arguments and it prompts for everything
    with smart defaults, so you don't have to remember any flags. Any value you DO
    pass as a parameter skips its prompt (handy for automation / CI).

    Two modes, chosen by a prompt (or the -Publish / -BuildOnly switches):
      * PUBLISH (release)  - build, then upload the APK + version.json to the
                             backend release dir so the in-app updater offers it
                             to every device.
      * BUILD ONLY         - build the signed APK locally, no upload. Offers to
                             install it straight onto a connected device via adb.

    versionCode is auto-selected (live /api/app/version + 1) unless you pass one,
    so the APK and version.json always agree.

    Requires: Node + Android SDK + JDK 17 (up to ~21), android/keystore.properties,
    and - for PUBLISH - OpenSSH (ssh/scp) access to the server.

.EXAMPLE
    ./scripts/publish-android.ps1
        Fully interactive - prompts for mode, version, changelog, etc.

.EXAMPLE
    ./scripts/publish-android.ps1 -BuildOnly
        Build a fresh signed APK locally, then optionally adb-install it.

.EXAMPLE
    ./scripts/publish-android.ps1 -Publish -VersionName 1.5.0 -Mandatory -Yes
        Non-interactive publish (no prompts) - good for scripting.
#>
param(
    [string] $VersionName,
    [string] $Server           = 'dbworld_admin@ssh.db-world.in',   # ssh target user@host
    [string] $ReleaseDir       = '/app/db_world/releases',          # MUST match backend app.release-dir
    [string] $VersionEndpoint  = 'https://api.db-world.in/api/app/version',
    [int]    $VersionCode      = 0,                                 # 0 = auto (current + 1)
    [switch] $Mandatory,                                            # force everyone to update
    [int]    $MinSupportedCode = 0,
    [string] $Changelog        = '',
    [ValidateSet('production','local','default')]
    [string] $BuildMode        = 'production',                      # env the web bundle is built with
    [switch] $SkipBuild,                                            # reuse an already-built APK
    [switch] $Publish,                                              # force PUBLISH mode (skip the prompt)
    [switch] $BuildOnly,                                            # force BUILD-ONLY mode (skip the prompt)
    [switch] $Yes                                                   # skip the final confirmation
)

$ErrorActionPreference = 'Stop'

# ─── console styling (ASCII-only so it renders on any PS 5.1 codepage) ────────
function Write-Head($m)  { Write-Host ''; Write-Host "==> $m" -ForegroundColor Cyan }
function Write-Info($m)  { Write-Host "    $m" -ForegroundColor Gray }
function Write-Ok($m)    { Write-Host "[OK]  $m" -ForegroundColor Green }
function Write-Warn2($m) { Write-Host "[!]   $m" -ForegroundColor Yellow }
function Write-Err2($m)  { Write-Host "[X]   $m" -ForegroundColor Red }
function Write-Kv($k, $v, $color = 'White') {
    Write-Host ("    {0,-14}" -f $k) -ForegroundColor DarkGray -NoNewline
    Write-Host $v -ForegroundColor $color
}
function Write-Banner {
    Write-Host ''
    Write-Host '  ==================================================' -ForegroundColor Cyan
    Write-Host '   DB World  -  Android release publisher' -ForegroundColor Cyan
    Write-Host '  ==================================================' -ForegroundColor Cyan
}

# ─── interactive helpers ──────────────────────────────────────────────────────
function Read-Default($label, $default) {
    if ($default) { $prompt = "{0} [{1}]" -f $label, $default } else { $prompt = $label }
    $v = Read-Host $prompt
    if ([string]::IsNullOrWhiteSpace($v)) { return $default }
    return $v.Trim()
}
function Read-YesNo($label, [bool] $defaultYes) {
    if ($defaultYes) { $hint = '[Y/n]' } else { $hint = '[y/N]' }
    while ($true) {
        $v = (Read-Host ("{0} {1}" -f $label, $hint)).Trim().ToLower()
        if ($v -eq '')             { return $defaultYes }
        if (@('y','yes') -contains $v) { return $true }
        if (@('n','no')  -contains $v) { return $false }
        Write-Warn2 'Please answer y or n.'
    }
}
function Suggest-NextVersionName($current) {
    if ($current -match '^(\d+)\.(\d+)\.(\d+)$') { return "{0}.{1}.{2}" -f $Matches[1], $Matches[2], ([int]$Matches[3] + 1) }
    if ($current -match '^(\d+)\.(\d+)$')        { return "{0}.{1}"     -f $Matches[1], ([int]$Matches[2] + 1) }
    return $current
}
function Find-Adb {
    $cmd = Get-Command adb -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    $sdk = Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe'
    if (Test-Path $sdk) { return $sdk }
    return $null
}

# Offer to install the just-built APK on a connected device via adb.
#   * skips silently if adb is missing or no device is attached
#   * interactive  -> prompts (default Yes), unless -Yes was passed (auto-installs)
#   * non-interactive -> only installs when -Yes is passed (so CI never pushes to a device)
# Returns $true if the APK was installed.
function Invoke-DeviceInstall($apkPath, [bool] $interactive, [bool] $autoYes) {
    $adb = Find-Adb
    if (-not $adb) { Write-Info 'adb not found - skipping device install.'; return $false }

    $deviceLines = @((& $adb devices) | Where-Object { $_ -match '\tdevice$' })
    if ($deviceLines.Count -eq 0) { Write-Info 'No adb device connected - skipping install.'; return $false }

    $serials = ($deviceLines | ForEach-Object { ($_ -split '\s+')[0] }) -join ', '
    Write-Info "Connected device(s): $serials"

    if (-not $interactive) {
        if (-not $autoYes) { Write-Info 'Non-interactive - skipping device install (pass -Yes to force).'; return $false }
    } elseif (-not $autoYes) {
        if (-not (Read-YesNo 'Install this APK on the connected device now (adb install -r)?' $true)) { return $false }
    }

    Write-Head 'Installing on connected device (adb install -r)'
    & $adb install -r $apkPath
    if ($LASTEXITCODE) {
        Write-Warn2 'adb install failed - likely a signature mismatch. Uninstall the app first (wipes its data), then retry.'
        return $false
    }
    Write-Ok 'Installed on the connected device.'
    return $true
}

$interactive = [Environment]::UserInteractive

# ─── paths ─────────────────────────────────────────────────────────────────────
$frontend   = Join-Path $PSScriptRoot '..\db-world-frontend' | Resolve-Path
$androidDir = Join-Path $frontend 'android'
$gradlew    = Join-Path $androidDir 'gradlew.bat'
$keystore   = Join-Path $androidDir 'keystore.properties'
$apk        = Join-Path $androidDir 'app\build\outputs\apk\release\app-release.apk'

$totalSw = [System.Diagnostics.Stopwatch]::StartNew()

try {
    Write-Banner

    # ─── 1. Mode: publish vs build-only ──────────────────────────────────────
    if ($Publish -and $BuildOnly) { throw 'Pass only one of -Publish / -BuildOnly.' }
    if     ($Publish)     { $doPublish = $true }
    elseif ($BuildOnly)   { $doPublish = $false }
    elseif ($interactive) { $doPublish = Read-YesNo 'Publish/release to the server after building (upload the APK)?' $false }
    else                  { $doPublish = $true }   # non-interactive default: behave like the classic publish script

    # ─── 2. Prerequisites (fail early, before a long build) ───────────────────
    Write-Head 'Checking prerequisites'
    if (-not $SkipBuild) {
        if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { throw 'npm not found on PATH (Node.js is required for the build).' }
        Write-Ok 'Node / npm found'
        if (-not (Test-Path $gradlew)) { throw "gradlew.bat not found at $gradlew" }
        Write-Ok 'Gradle wrapper found'
        # JDK sanity: the Android build wants 17 (works up to ~21); newer JDKs often break AGP.
        try {
            $jline = (& java -version 2>&1 | Select-Object -First 1)
            if ("$jline" -match '"(\d+)') {
                $maj = [int]$Matches[1]
                if ($maj -ge 23) { Write-Warn2 "Active JDK is $maj - the Android build needs 17 (up to ~21). Set JAVA_HOME to a 17/21 JDK if the build fails." }
                else             { Write-Ok "JDK $maj detected" }
            }
        } catch { Write-Warn2 "Couldn't detect the active JDK (continuing)." }
    }
    if (Test-Path $keystore) { Write-Ok 'Release keystore present (APK will be release-signed)' }
    else                     { Write-Warn2 'android/keystore.properties missing - APK will fall back to DEBUG signing (won''t match an installed release build).' }
    if ($doPublish) {
        if (-not (Get-Command ssh -ErrorAction SilentlyContinue)) { throw 'ssh not found - OpenSSH is required to publish.' }
        if (-not (Get-Command scp -ErrorAction SilentlyContinue)) { throw 'scp not found - OpenSSH is required to publish.' }
        Write-Ok 'ssh / scp found'
    }

    # ─── 3. Resolve version (auto versionCode + suggested versionName) ────────
    Write-Head 'Resolving version'
    $currentCode = 0; $currentName = ''
    try {
        $resp = Invoke-RestMethod -Uri $VersionEndpoint -TimeoutSec 15
        $currentCode = [int]$resp.data.versionCode
        $currentName = [string]$resp.data.versionName
        Write-Info "Currently published: v$currentName (versionCode $currentCode)"
    } catch {
        Write-Warn2 "Couldn't read $VersionEndpoint - assuming nothing is published yet."
    }
    if ($VersionCode -le 0) {
        if ($currentCode -gt 0) { $VersionCode = $currentCode + 1 } else { $VersionCode = 2 }
    }
    if (-not $VersionName) {
        $suggested = Suggest-NextVersionName $currentName
        if ($interactive) { $VersionName = Read-Default 'Version name (e.g. 1.2.3)' $suggested }
        elseif ($suggested) { $VersionName = $suggested }
        else { throw 'VersionName is required (pass -VersionName x.y.z).' }
    }
    if ($VersionName -notmatch '^\d+(\.\d+){1,3}$') { Write-Warn2 "Version name '$VersionName' doesn't look like x.y.z - continuing anyway." }

    # ─── 4. Publish-only details (prompt when interactive & not passed) ───────
    $isMandatory = $Mandatory.IsPresent
    if ($doPublish -and $interactive) {
        if (-not $PSBoundParameters.ContainsKey('Server'))    { $Server    = Read-Default 'Server (ssh target user@host)' $Server }
        if (-not $Mandatory.IsPresent)                        { $isMandatory = Read-YesNo 'Force a MANDATORY update (block older versions from running)?' $false }
        if (-not $PSBoundParameters.ContainsKey('Changelog')) { $Changelog = Read-Default 'Changelog (optional, shown in the update prompt)' '' }
    }

    # ─── 5. Summary + confirm ─────────────────────────────────────────────────
    Write-Head 'Summary'
    if ($doPublish) { Write-Kv 'Mode' 'PUBLISH -> upload to server' 'Yellow' }
    else            { Write-Kv 'Mode' 'BUILD ONLY (no upload)' 'Cyan' }
    Write-Kv 'Version'     "$VersionName (code $VersionCode)"
    Write-Kv 'Build env'   $BuildMode
    Write-Kv 'Skip build'  $SkipBuild.IsPresent
    if ($doPublish) {
        Write-Kv 'Server'      $Server
        Write-Kv 'Release dir' $ReleaseDir
        Write-Kv 'Mandatory'   $isMandatory ($(if ($isMandatory) { 'Red' } else { 'White' }))
        Write-Kv 'Min code'    $MinSupportedCode
        if ($Changelog) { Write-Kv 'Changelog' $Changelog }
    }

    if ($doPublish -and $BuildMode -ne 'production') {
        Write-Warn2 "Build env is '$BuildMode' - publishing a non-production APK to the prod server is discouraged."
        if ($interactive -and -not $Yes -and -not (Read-YesNo "Really publish a '$BuildMode' build?" $false)) { throw 'Aborted (non-production publish).' }
    }
    if (-not $Yes -and $interactive) {
        if (-not (Read-YesNo 'Proceed?' $true)) { Write-Warn2 'Aborted by user.'; exit 0 }
    }

    # ─── 6. Build the signed APK ──────────────────────────────────────────────
    if (-not $SkipBuild) {
        $buildScript = switch ($BuildMode) { 'local' { 'build:local' } 'default' { 'build' } default { 'build:production' } }
        $buildSw = [System.Diagnostics.Stopwatch]::StartNew()

        Write-Head "Building web bundle (npm run $buildScript)"
        Push-Location $frontend
        try {
            & npm run $buildScript;      if ($LASTEXITCODE) { throw "npm run $buildScript failed" }
            & npx cap sync android;      if ($LASTEXITCODE) { throw 'cap sync failed' }
        } finally { Pop-Location }
        Write-Ok 'Web bundle + cap sync done'

        Write-Head "Assembling signed release APK (versionCode=$VersionCode)"
        Push-Location $androidDir
        try {
            & .\gradlew.bat assembleRelease "-PappVersionCode=$VersionCode" "-PappVersionName=$VersionName"
            if ($LASTEXITCODE) { throw 'gradlew assembleRelease failed' }
        } finally { Pop-Location }

        $buildSw.Stop()
        Write-Ok ("APK assembled in {0:mm\:ss}" -f $buildSw.Elapsed)
    } else {
        Write-Head 'Skipping build (-SkipBuild) - using the existing APK'
    }

    if (-not (Test-Path $apk)) { throw "APK not found at $apk" }
    $apkItem = Get-Item $apk
    Write-Kv 'APK'   $apk
    Write-Kv 'Size'  ("{0:N1} MB" -f ($apkItem.Length / 1MB))
    Write-Kv 'Built' $apkItem.LastWriteTime

    # ─── 7. PUBLISH: version.json + upload ────────────────────────────────────
    if ($doPublish) {
        Write-Head 'Writing version.json'
        $meta = [ordered]@{
            versionCode      = $VersionCode
            versionName      = $VersionName
            mandatory        = $isMandatory
            minSupportedCode = $MinSupportedCode
            changelog        = $Changelog
        }
        $json     = $meta | ConvertTo-Json -Depth 5
        $tmpDir   = Join-Path $env:TEMP 'dbworld-release'
        New-Item -ItemType Directory -Force -Path $tmpDir | Out-Null
        $jsonPath = Join-Path $tmpDir 'version.json'
        [System.IO.File]::WriteAllText($jsonPath, $json, (New-Object System.Text.UTF8Encoding $false))
        Write-Ok 'version.json written (UTF-8, no BOM)'

        # APK first, then version.json - so clients never see a version pointing at
        # a not-yet-uploaded APK. 0 prompts with an SSH key; 2 password prompts max.
        Write-Head "Uploading to ${Server}:${ReleaseDir}"
        & ssh $Server "mkdir -p '$ReleaseDir'";          if ($LASTEXITCODE) { throw 'ssh mkdir failed' }
        & scp $apk $jsonPath "${Server}:${ReleaseDir}/"; if ($LASTEXITCODE) { throw 'scp upload failed' }
        Write-Ok "Published v$VersionName (code $VersionCode) to ${Server}:${ReleaseDir}"
        Write-Info 'Devices on an older build will be prompted to update on next launch.'
    }

    # ─── 8. Offer to install the freshly-built APK on a connected device ──────
    #     Runs in BOTH modes so you can smoke-test the exact build you just made.
    $installed = Invoke-DeviceInstall $apk $interactive $Yes.IsPresent

    # ─── 9. Done ───────────────────────────────────────────────────────────────
    $totalSw.Stop()
    Write-Host ''
    if ($doPublish) { Write-Ok "Publish complete - v$VersionName (code $VersionCode)" }
    else            { Write-Ok "Build complete - v$VersionName (code $VersionCode)" }
    if (-not $installed) { Write-Info "Install on a connected device with:  adb install -r `"$apk`"" }
    Write-Info ("Total time: {0:mm\:ss}" -f $totalSw.Elapsed)
}
catch {
    Write-Host ''
    Write-Err2 $_.Exception.Message
    exit 1
}
