<#
.SYNOPSIS
    Reports drift between the config repo's env files and what the app actually reads.

.DESCRIPTION
    The config lives in three places that nothing keeps in step:

      backend  application*.yml        ${VAR} placeholders          <- the source of truth
      runtime  dbworld.{local,prod}.env  OS env vars feeding those placeholders
      frontend .env.{local,production}   Vite build-time VITE_* vars

    Nothing validates them against each other, so a variable can be renamed in the yml and
    left stale in the env files for months. That already happened twice: TMDB_BEARER_TOKEN
    was renamed to TMDB_ACCESS_TOKEN and never propagated to prod - and because the yml
    reads it with no default, a clean deploy would have failed at startup rather than
    degrading. Local dev separately defined VITE_WS_URL while the code read
    VITE_WEBSOCKET_BASEURL, so websockets were simply dead there.

    This reports three classes of problem:

      MISSING   the app reads it with no default, no env file provides it -> startup fails
      DEGRADED  the app reads it with a default, no env file provides it  -> feature off
      DEAD      an env file defines it and nothing reads it               -> noise

    Values are never read - only key names - so this is safe to run and safe to log.

.PARAMETER ConfigRoot
    The db-world-config checkout. Defaults to a sibling of this repo.

.EXAMPLE
    .\scripts\env\check-env.ps1
#>
[CmdletBinding()]
param(
    [string]$ConfigRoot
)

$ErrorActionPreference = 'Stop'

# scripts/env/ -> repo root is two levels up.
$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
if (-not $ConfigRoot) {
    $ConfigRoot = Join-Path (Split-Path -Parent $RepoRoot) 'db-world-config'
}
if (-not (Test-Path $ConfigRoot)) {
    Write-Error "Config repo not found at $ConfigRoot. Pass -ConfigRoot explicitly."
}

function Get-KeyNames([string]$Path, [string]$Pattern = '^[A-Za-z0-9_]+=') {
    if (-not (Test-Path $Path)) { return @() }
    Select-String -Path $Path -Pattern $Pattern |
        ForEach-Object { ($_.Line -split '=')[0].Trim() } |
        Sort-Object -Unique
}

$exit = 0

# ── Backend ───────────────────────────────────────────────────────────────────
# A placeholder written ${VAR} is required; ${VAR:something} falls back and is optional.
$resources = Join-Path $RepoRoot 'db-world-backend\src\main\resources'
$required = [System.Collections.Generic.HashSet[string]]::new()
$optional = [System.Collections.Generic.HashSet[string]]::new()

Get-ChildItem -Path $resources -Filter 'application*.yml' -ErrorAction SilentlyContinue | ForEach-Object {
    foreach ($line in Get-Content $_.FullName) {
        if ($line -match '^\s*#') { continue }   # commented-out sample URLs are not config
        foreach ($m in [regex]::Matches($line, '\$\{([A-Z0-9_]+)(:[^}]*)?\}')) {
            if ($m.Groups[2].Success) { [void]$optional.Add($m.Groups[1].Value) }
            else                      { [void]$required.Add($m.Groups[1].Value) }
        }
    }
}

# Not every variable reaches Spring through a yml placeholder. FcmPushSender, for one, reads
# FCM_SERVICE_ACCOUNT_FILE straight from System.getenv via a constant, so scanning only the
# yml reports it as dead and invites someone to delete a variable that gates push entirely.
# Any SCREAMING_SNAKE literal in the Java sources is therefore treated as a possible env read.
$javaLiterals = [System.Collections.Generic.HashSet[string]]::new()
$javaRoot = Join-Path $RepoRoot 'db-world-backend\src\main\java'
if (Test-Path $javaRoot) {
    Get-ChildItem -Path $javaRoot -Recurse -Filter *.java |
        Select-String -Pattern '"([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)"' -AllMatches |
        ForEach-Object { $_.Matches } |
        ForEach-Object { [void]$javaLiterals.Add($_.Groups[1].Value) }
}


<#
    Flags a value containing whitespace that is not quoted.

    `dbworldctl` does `source "$ENV_FILE"`, so these files are shell script as well as
    key-value pairs. A line like

        MAIL_FROM_NAME=DB World

    is read by a shell as the assignment `MAIL_FROM_NAME=DB` followed by a command named
    `World` — which fails with "World: command not found" and exit 127, taking down every
    dbworldctl subcommand before it does any work. systemd's EnvironmentFile is happy with
    the unquoted form, so this passes locally and only breaks on deploy.

    Only whitespace is checked. Quoting everything would be noisy, and the other shell
    metacharacters have not caused a problem in practice — a space is the one that gets
    typed by accident.
#>
function Get-UnquotedWhitespaceValues([string]$Path) {
    if (-not (Test-Path $Path)) { return @() }
    $lineNo = 0
    Get-Content $Path | ForEach-Object {
        $lineNo++
        if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
            # Copy both captures out NOW. Every subsequent -match overwrites $matches, so
            # reading $matches[1] after the quote tests below yields null and the report
            # names no key at all.
            $key = $matches[1]
            $value = $matches[2]
            $isQuoted = $value -match '^".*"$' -or $value -match "^'.*'$"
            if ($value -match '\s' -and -not $isQuoted) {
                [pscustomobject]@{ Line = $lineNo; Key = $key }
            }
        }
    }
}

foreach ($envName in @('local', 'prod')) {
    $file = Join-Path $ConfigRoot "runtime\dbworld.$envName.env"
    $have = Get-KeyNames $file '^[A-Z0-9_]+='
    Write-Host "`n== runtime/dbworld.$envName.env ($($have.Count) keys)" -ForegroundColor Cyan

    $missing = $required | Where-Object { $_ -notin $have } | Sort-Object
    if ($missing) {
        $exit = 1
        Write-Host "  MISSING (no default - the backend will FAIL to start):" -ForegroundColor Red
        $missing | ForEach-Object { Write-Host "    $_" -ForegroundColor Red }
    }

    $degraded = $optional | Where-Object { $_ -notin $have } | Sort-Object
    if ($degraded) {
        Write-Host "  DEGRADED (has a default - feature silently off):" -ForegroundColor Yellow
        $degraded | ForEach-Object { Write-Host "    $_" -ForegroundColor Yellow }
    }

    # APP_PROFILE is consumed by dbworldctl on the Pi, not by Spring, so it is legitimately
    # absent from the yml and must not be reported as dead.
    $known = @('APP_PROFILE')
    $dead = $have | Where-Object {
        $_ -notin $required -and $_ -notin $optional -and $_ -notin $known -and -not $javaLiterals.Contains($_)
    } | Sort-Object
    if ($dead) {
        Write-Host "  DEAD (nothing reads these):" -ForegroundColor DarkGray
        $dead | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray }
    }
    # Checked before the "clean" verdict: this one takes the whole deploy down, so it must
    # never be reported as a footnote under an otherwise-green file.
    $unsafe = Get-UnquotedWhitespaceValues $file
    if ($unsafe) {
        $exit = 1
        Write-Host "  NOT SHELL-SAFE (dbworldctl sources this file — it will exit 127):" -ForegroundColor Red
        $unsafe | ForEach-Object {
            Write-Host "    line $($_.Line): $($_.Key) has an unquoted value containing whitespace" -ForegroundColor Red
        }
        Write-Host '    fix: wrap the value in double quotes — systemd strips them, a shell needs them' -ForegroundColor Red
    }

    if (-not $missing -and -not $degraded -and -not $dead -and -not $unsafe) {
        Write-Host "  clean" -ForegroundColor Green
    }
}

# ── Frontend ──────────────────────────────────────────────────────────────────
# Vite inlines these at build time, so an unset one becomes `undefined` in the bundle
# rather than failing anywhere a developer would notice.
$src = Join-Path $RepoRoot 'db-world-frontend\src'
$used = Get-ChildItem -Path $src -Recurse -Include *.js, *.jsx -ErrorAction SilentlyContinue |
    Select-String -Pattern 'import\.meta\.env\.(VITE_[A-Z0-9_]+)' -AllMatches |
    ForEach-Object { $_.Matches } | ForEach-Object { $_.Groups[1].Value } |
    Sort-Object -Unique

# Ads are deliberately absent locally: a dev build should not fetch AdSense.
$localExempt = $used | Where-Object { $_ -like 'VITE_AD_SLOT_*' }

foreach ($pair in @(@('local', '.env.local'), @('production', '.env.production'))) {
    $file = Join-Path $ConfigRoot "frontend\$($pair[1])"
    $have = Get-KeyNames $file
    Write-Host "`n== frontend/$($pair[1]) ($($have.Count) keys)" -ForegroundColor Cyan

    $exempt = if ($pair[0] -eq 'local') { $localExempt } else { @() }
    $missing = $used | Where-Object { $_ -notin $have -and $_ -notin $exempt } | Sort-Object
    if ($missing) {
        $exit = 1
        Write-Host "  MISSING (read by the app, undefined in the bundle):" -ForegroundColor Red
        $missing | ForEach-Object { Write-Host "    $_" -ForegroundColor Red }
    }

    $dead = $have | Where-Object { $_ -notin $used } | Sort-Object
    if ($dead) {
        Write-Host "  DEAD (nothing reads these):" -ForegroundColor DarkGray
        $dead | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray }
    }
    if (-not $missing -and -not $dead) { Write-Host "  clean" -ForegroundColor Green }
}

Write-Host ""
if ($exit -ne 0) {
    # Deliberately does not name one category: MISSING and NOT SHELL-SAFE both set this,
    # and pointing at "MISSING above" when the fault was a quoting error sends the reader
    # looking for something that is not there.
    Write-Host "Problems found - see the red lines above." -ForegroundColor Red
} else {
    Write-Host "No problems found." -ForegroundColor Green
}
exit $exit
