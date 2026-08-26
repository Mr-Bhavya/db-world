<#
.SYNOPSIS
    Point the local checkout at the LOCAL or PROD configuration from db-world-config.

.DESCRIPTION
    Replaces the old switch-env.ps1, which symlinked into a sibling "db-world-secrets"
    folder that no longer exists. Configuration now lives in the db-world-config repo,
    which is laid out flat with the environment in each filename rather than in
    LOCAL/ and PROD/ subfolders:

        backend/application-local.yml     backend/application-prod.yml
        frontend/.env.local               frontend/.env.production
        runtime/dbworld.local.env         runtime/dbworld.prod.env

    Copies rather than symlinks, matching db-world-config's own setup-windows.ps1:
    no elevation or Developer Mode required, and what is on disk is unambiguous. The
    trade-off is that editing a source file needs another switch to take effect.

    Three things move:

      1. backend/application-<env>.yml -> db-world-backend/src/main/resources/
      2. frontend/.env.<suffix>        -> runtime/            (read by env-cmd in the
                                                               dev:local / dev:production
                                                               npm scripts)
                                       -> db-world-frontend/  (Vite auto-loads this for a
                                                               plain `npm run dev`)
      3. runtime/dbworld.<env>.env     -> User-scope environment variables, so IntelliJ
                                         and any new shell pick them up

    Nothing is written until every source file has been verified present, so a missing
    file cannot leave the checkout half-switched between environments.

    ASCII only, deliberately. Windows PowerShell 5.1 reads a BOM-less .ps1 as CP1252,
    where the bytes of a UTF-8 em-dash decode to a quote character and break the parse.

.PARAMETER Environment
    LOCAL or PROD. Prompts when omitted, so the .bat launcher can be double-clicked.

.PARAMETER ConfigRepo
    Path to the db-world-config checkout. Defaults to a sibling of this repo.

.PARAMETER Force
    Skip the confirmation prompt when switching to PROD.

.EXAMPLE
    .\scripts\env\switch-env.ps1 LOCAL

.EXAMPLE
    .\scripts\env\switch-env.ps1 -Environment PROD -Force
#>
[CmdletBinding(SupportsShouldProcess)]
param(
    # Not named $env: that reads like the $env: provider and confuses everyone.
    [Parameter(Mandatory = $true, Position = 0)]
    [ValidateSet('LOCAL', 'PROD')]
    [Alias('env')]
    [string]$Environment,

    [string]$ConfigRepo,

    [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Step { param($m) Write-Host "`n==> $m" -ForegroundColor Cyan }
function Write-OK   { param($m) Write-Host "  [OK]   $m" -ForegroundColor Green }
function Write-Info { param($m) Write-Host "  [INFO] $m" -ForegroundColor Gray }
function Write-Warn { param($m) Write-Host "  [WARN] $m" -ForegroundColor Yellow }
function Write-Err  { param($m) Write-Host "  [ERROR] $m" -ForegroundColor Red }

# scripts/env/ -> repo root is two levels up.
$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)

if (-not $ConfigRepo) {
    $ConfigRepo = Join-Path (Split-Path -Parent $RepoRoot) 'db-world-config'
}

if (-not (Test-Path -LiteralPath $ConfigRepo)) {
    Write-Err "db-world-config not found at: $ConfigRepo"
    Write-Err "Clone it beside this repo, or pass -ConfigRepo <path>."
    exit 1
}

# Environment-specific naming. The backend profile and the frontend env file use
# different suffixes for the same environment, which is exactly the sort of detail
# worth keeping in one table instead of scattered through the script.
if ($Environment -eq 'LOCAL') {
    $BackendProfile = 'local'
    $FrontendSuffix = 'local'
    $RuntimeEnvName = 'dbworld.local.env'
} else {
    $BackendProfile = 'prod'
    $FrontendSuffix = 'production'
    $RuntimeEnvName = 'dbworld.prod.env'
}

Write-Host ''
Write-Host "Switching db-world to $Environment" -ForegroundColor Cyan
Write-Info "repo:   $RepoRoot"
Write-Info "config: $ConfigRepo"

# Switching to PROD writes production credentials into this machine's persistent
# user environment. Worth an explicit confirmation rather than a silent success.
if ($Environment -eq 'PROD' -and -not $Force) {
    Write-Host ''
    Write-Warn 'PROD sets production credentials as persistent User environment variables'
    Write-Warn 'on this machine, and points the backend profile at production.'

    # A non-interactive host (CI, scheduled task, -NonInteractive) cannot answer. Fail
    # closed with an actionable message rather than an unhandled Read-Host exception.
    $answer = $null
    try {
        $answer = Read-Host 'Type PROD to continue'
    } catch {
        Write-Host ''
        Write-Err 'Cannot prompt for confirmation in a non-interactive session.'
        Write-Err 'Re-run with -Force if switching to PROD is genuinely intended.'
        exit 1
    }

    if ($answer -ne 'PROD') {
        Write-Host ''
        Write-Info 'Aborted. Nothing was changed.'
        exit 1
    }
}

# ---------------------------------------------------------------------------
# Resolve everything first. A missing source part-way through would otherwise
# leave the checkout mixing two environments, which is worse than not switching.
# ---------------------------------------------------------------------------
Write-Step 'Checking sources'

$backendSrc  = Join-Path $ConfigRepo "backend\application-$BackendProfile.yml"
$frontendSrc = Join-Path $ConfigRepo "frontend\.env.$FrontendSuffix"
$runtimeSrc  = Join-Path $ConfigRepo "runtime\$RuntimeEnvName"

$backendDst   = Join-Path $RepoRoot "db-world-backend\src\main\resources\application-$BackendProfile.yml"
$runtimeDst   = Join-Path $RepoRoot "runtime\.env.$FrontendSuffix"
$frontendDst  = Join-Path $RepoRoot "db-world-frontend\.env.$FrontendSuffix"

$missing = @()
foreach ($pair in @(
        @{ Path = $backendSrc;  What = "backend\application-$BackendProfile.yml" },
        @{ Path = $frontendSrc; What = "frontend\.env.$FrontendSuffix" },
        @{ Path = $runtimeSrc;  What = "runtime\$RuntimeEnvName" })) {
    if (Test-Path -LiteralPath $pair.Path) {
        Write-OK "found $($pair.What)"
    } else {
        $missing += $pair.What
        Write-Err "missing $($pair.What)"
    }
}

if ($missing.Count -gt 0) {
    Write-Host ''
    Write-Err "$($missing.Count) source file(s) missing from $ConfigRepo - nothing was changed."
    Write-Err 'Pull db-world-config, or check that it is on the expected branch.'
    exit 1
}

# Destination directories must exist; creating them would hide a wrong repo layout.
foreach ($dir in @((Split-Path -Parent $backendDst), (Split-Path -Parent $runtimeDst), (Split-Path -Parent $frontendDst))) {
    if (-not (Test-Path -LiteralPath $dir)) {
        Write-Err "destination directory not found: $dir"
        exit 1
    }
}

# ---------------------------------------------------------------------------
# 1. Backend Spring profile
# ---------------------------------------------------------------------------
Write-Step "Backend profile ($BackendProfile)"
if ($PSCmdlet.ShouldProcess($backendDst, 'copy backend profile')) {
    Copy-Item -LiteralPath $backendSrc -Destination $backendDst -Force
    Write-OK "application-$BackendProfile.yml -> db-world-backend\src\main\resources"
}

# ---------------------------------------------------------------------------
# 2. Frontend env, to both places that read it
# ---------------------------------------------------------------------------
Write-Step "Frontend env (.env.$FrontendSuffix)"
if ($PSCmdlet.ShouldProcess($runtimeDst, 'copy frontend env for env-cmd')) {
    Copy-Item -LiteralPath $frontendSrc -Destination $runtimeDst -Force
    Write-OK "runtime\.env.$FrontendSuffix          (npm run dev:$FrontendSuffix, via env-cmd)"
}
if ($PSCmdlet.ShouldProcess($frontendDst, 'copy frontend env for Vite')) {
    Copy-Item -LiteralPath $frontendSrc -Destination $frontendDst -Force
    Write-OK "db-world-frontend\.env.$FrontendSuffix  (npm run dev, Vite auto-load)"
}

# ---------------------------------------------------------------------------
# 3. User-scope environment variables
# ---------------------------------------------------------------------------
Write-Step "Environment variables from $RuntimeEnvName"

$applied = 0
$empty = @()
foreach ($line in Get-Content -LiteralPath $runtimeSrc) {
    if ($line -match '^\s*$' -or $line -match '^\s*#') { continue }
    if ($line -notmatch '^([^=]+)=(.*)$') { continue }

    $name  = $Matches[1].Trim()
    $value = $Matches[2].Trim()

    if ($PSCmdlet.ShouldProcess("User env var $name", 'set')) {
        [Environment]::SetEnvironmentVariable($name, $value, 'User')
        # Also set for this process so anything launched from here sees it immediately.
        [Environment]::SetEnvironmentVariable($name, $value, 'Process')
        $applied++
    }

    # Names only. Values are credentials and must not reach the console or a
    # transcript log.
    if ($value -eq '') { $empty += $name }
}

Write-OK "$applied variable(s) set at User scope"
if ($empty.Count -gt 0) {
    Write-Warn "$($empty.Count) variable(s) are empty in $RuntimeEnvName and need filling in:"
    Write-Warn ($empty -join ', ')
}

# ---------------------------------------------------------------------------
Write-Host ''
Write-Host "Switched to $Environment." -ForegroundColor Yellow
Write-Info 'Restart IntelliJ to pick up the User-scope variables (already live in this shell).'
if ($Environment -eq 'LOCAL') {
    Write-Info 'Backend: mvn spring-boot:run -Dspring-boot.run.profiles=local'
    Write-Info 'Frontend: npm run dev:local'
} else {
    Write-Info 'Backend profile is now prod. Frontend: npm run dev:production'
}
Write-Host ''
