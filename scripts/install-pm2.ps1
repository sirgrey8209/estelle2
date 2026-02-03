# Estelle v2 PM2 Setup Script
# Run as Administrator for startup registration

param(
    [switch]$StartupOnly  # Only register startup, skip PM2 install
)

$ErrorActionPreference = "Stop"
$EstelleRoot = Split-Path -Parent $PSScriptRoot

Write-Host "=== Estelle v2 PM2 Setup ===" -ForegroundColor Cyan

# 0. Build Pylon
Write-Host "`n[0/4] Building Pylon..." -ForegroundColor Yellow
Push-Location $EstelleRoot
try {
    pnpm --filter @estelle/pylon build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to build Pylon" -ForegroundColor Red
        exit 1
    }
    Write-Host "Pylon built" -ForegroundColor Green
} finally {
    Pop-Location
}

# 1. Check/Install PM2
if (-not $StartupOnly) {
    Write-Host "`n[1/4] Checking PM2..." -ForegroundColor Yellow
    $pm2Version = npm list -g pm2 2>$null | Select-String "pm2@"
    if (-not $pm2Version) {
        Write-Host "Installing PM2 globally..." -ForegroundColor Gray
        npm install -g pm2
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Failed to install PM2" -ForegroundColor Red
            exit 1
        }
    }
    Write-Host "PM2 installed: $(pm2 -v)" -ForegroundColor Green
}

# 2. Install pm2-windows-startup
Write-Host "`n[2/4] Checking pm2-windows-startup..." -ForegroundColor Yellow
$pm2Startup = npm list -g pm2-windows-startup 2>$null | Select-String "pm2-windows-startup@"
if (-not $pm2Startup) {
    Write-Host "Installing pm2-windows-startup..." -ForegroundColor Gray
    npm install -g pm2-windows-startup
}
Write-Host "pm2-windows-startup ready" -ForegroundColor Green

# 3. Start Pylon with PM2
Write-Host "`n[3/4] Starting Estelle Pylon v2..." -ForegroundColor Yellow
Push-Location $EstelleRoot
try {
    pm2 delete estelle-pylon-v2 2>$null
    pm2 start ecosystem.config.js
    pm2 save
    Write-Host "Pylon started and saved" -ForegroundColor Green
} finally {
    Pop-Location
}

# 4. Register startup (requires admin)
Write-Host "`n[4/4] Registering Windows startup..." -ForegroundColor Yellow
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if ($isAdmin) {
    pm2-startup install
    Write-Host "Startup registered" -ForegroundColor Green
} else {
    Write-Host "Skipped (run as Administrator to register startup)" -ForegroundColor Yellow
    Write-Host "Manual command: pm2-startup install" -ForegroundColor Gray
}

# Done
Write-Host "`n=== Setup Complete ===" -ForegroundColor Cyan
Write-Host @"

PM2 Commands:
  pm2 status                 # Check status
  pm2 logs estelle-pylon-v2  # View logs
  pm2 restart estelle-pylon-v2
  pm2 stop estelle-pylon-v2

"@ -ForegroundColor Gray
