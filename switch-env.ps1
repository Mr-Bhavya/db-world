param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("LOCAL","PROD")]
    [string]$env
)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$secrets = Join-Path $root "..\db-world-secrets\$env"

Write-Host ""
Write-Host "Switching environment to $env ..." -ForegroundColor Cyan

# ---------------- BACKEND ----------------
$runtime = Join-Path $root "runtime"

if(Test-Path $runtime){
    cmd /c rmdir $runtime
}

cmd /c mklink /D $runtime "$secrets\backend" | Out-Null
Write-Host "Backend linked -> $env" -ForegroundColor Green

# ---------------- FRONTEND ----------------
$frontendLocal = Join-Path $root "db-world-frontend\.env.local"
$frontendProd  = Join-Path $root "db-world-frontend\.env.production"

if(Test-Path $frontendLocal){ cmd /c del $frontendLocal }
if(Test-Path $frontendProd){ cmd /c del $frontendProd }

if($env -eq "LOCAL"){
    cmd /c mklink $frontendLocal "$secrets\frontend\.env.local" | Out-Null
    Write-Host "Frontend LOCAL linked" -ForegroundColor Green
}
else{
    cmd /c mklink $frontendProd "$secrets\frontend\.env.production" | Out-Null
    Write-Host "Frontend PROD linked" -ForegroundColor Green
}

Write-Host ""
Write-Host "Environment switched to $env successfully!" -ForegroundColor Yellow
