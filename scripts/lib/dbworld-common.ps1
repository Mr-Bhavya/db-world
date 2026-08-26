# ==========================================================
# Shared helpers for DbWorld dev / build scripts.
# Dot-source it:  . (Join-Path $PSScriptRoot "dbworld-common.ps1")
# ==========================================================

# The backend targets Java 25 (pom <java.version>25</java.version>). JAVA_HOME on this box often
# points at JDK 21, which makes Maven fail to compile for release 25. Resolve a REAL JDK 25 home so
# build/dev scripts always use the right JDK regardless of JAVA_HOME / PATH.
function Resolve-Jdk25Home {
    $candidates = New-Object System.Collections.Generic.List[string]
    if ($env:JAVA_HOME) { $candidates.Add($env:JAVA_HOME) }
    $candidates.Add("C:\Program Files\Java\jdk-25.0.3")
    foreach ($root in @(
        "C:\Program Files\Java",
        "C:\Program Files\Eclipse Adoptium",
        "C:\Program Files\Microsoft",
        "C:\Program Files\Zulu"
    )) {
        Get-ChildItem -Path $root -Directory -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -match 'jdk[-_ ]?25' } |
            ForEach-Object { $candidates.Add($_.FullName) }
    }

    foreach ($c in $candidates) {
        if (-not $c) { continue }
        $javaExe = Join-Path $c "bin\java.exe"
        if (Test-Path $javaExe) {
            try {
                $out = & $javaExe -version 2>&1 | Out-String
                if ($out -match 'version "25') { return $c }
            } catch { }
        }
    }
    return $null
}

# Resolve a Maven launcher: prefer `mvn` on PATH, else the Maven-wrapper-installed mvn.cmd under ~/.m2.
function Resolve-Mvn {
    $cmd = Get-Command mvn -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    $dists = Join-Path $env:USERPROFILE ".m2\wrapper\dists"
    if (Test-Path $dists) {
        $found = Get-ChildItem -Path $dists -Recurse -Filter "mvn.cmd" -ErrorAction SilentlyContinue |
            Select-Object -First 1
        if ($found) { return $found.FullName }
    }
    return $null
}

# Load KEY=VALUE lines from a .env file into the current process environment.
# Ignores blanks, '#' / '//' comments, an optional leading 'export ', and strips surrounding quotes.
function Import-DotEnv([string]$Path) {
    if (-not (Test-Path $Path)) { return $false }
    Get-Content $Path | ForEach-Object {
        $line = $_.Trim()
        if (-not $line) { return }
        if ($line.StartsWith("#") -or $line.StartsWith("//")) { return }
        if ($line.StartsWith("export ")) { $line = $line.Substring(7).Trim() }
        if ($line.Contains("=")) {
            $parts = $line.Split("=", 2)
            $key = $parts[0].Trim()
            $value = $parts[1]
            if ($value.StartsWith('"') -and $value.EndsWith('"')) { $value = $value.Substring(1, $value.Length - 2) }
            elseif ($value.StartsWith("'") -and $value.EndsWith("'")) { $value = $value.Substring(1, $value.Length - 2) }
            if ($key) { [Environment]::SetEnvironmentVariable($key, $value, "Process") }
        }
    }
    return $true
}
