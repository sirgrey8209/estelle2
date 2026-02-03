# build-release.ps1 - 릴리즈 패키지 빌드 스크립트
#
# 사용법: .\scripts\build-release.ps1
# 결과: release/ 폴더에 배포 가능한 패키지 생성

param(
    [switch]$SkipBuild  # 빌드 스킵 (dist가 이미 있을 때)
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$ReleaseDir = Join-Path $RepoRoot "release"

Write-Host "=== Estelle v2 Release Build ===" -ForegroundColor Cyan

# 0. 빌드
if (-not $SkipBuild) {
    Write-Host "`n[0/4] Building packages..." -ForegroundColor Yellow
    Push-Location $RepoRoot
    try {
        pnpm build
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Build failed" -ForegroundColor Red
            exit 1
        }
        Write-Host "Build completed" -ForegroundColor Green
    } finally {
        Pop-Location
    }
} else {
    Write-Host "`n[0/4] Skipping build (--SkipBuild)" -ForegroundColor Gray
}

# 1. release 폴더 초기화
Write-Host "`n[1/4] Initializing release folder..." -ForegroundColor Yellow
if (Test-Path $ReleaseDir) {
    Remove-Item -Recurse -Force $ReleaseDir
}
New-Item -ItemType Directory -Path "$ReleaseDir\core" -Force | Out-Null
New-Item -ItemType Directory -Path "$ReleaseDir\pylon" -Force | Out-Null
New-Item -ItemType Directory -Path "$ReleaseDir\relay" -Force | Out-Null
Write-Host "Release folder initialized" -ForegroundColor Green

# 2. Core 패키지 복사
Write-Host "`n[2/4] Copying core package..." -ForegroundColor Yellow
$CoreSrc = Join-Path $RepoRoot "packages\core"
$CoreDst = Join-Path $ReleaseDir "core"
Copy-Item -Path "$CoreSrc\dist" -Destination "$CoreDst\dist" -Recurse
Copy-Item -Path "$CoreSrc\package.json" -Destination "$CoreDst\package.json"
Write-Host "Core package copied" -ForegroundColor Green

# 3. Pylon 패키지 복사
Write-Host "`n[3/4] Copying pylon package..." -ForegroundColor Yellow
$PylonSrc = Join-Path $RepoRoot "packages\pylon"
$PylonDst = Join-Path $ReleaseDir "pylon"
Copy-Item -Path "$PylonSrc\dist" -Destination "$PylonDst\dist" -Recurse
Copy-Item -Path "$PylonSrc\package.json" -Destination "$PylonDst\package.json"

# Pylon 배포 설정
@"
module.exports = {
  apps: [
    {
      name: 'estelle-pylon',
      script: 'dist/bin.js',
      cwd: __dirname,
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      env: {
        NODE_ENV: 'production'
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      merge_logs: true
    }
  ]
};
"@ | Out-File -FilePath "$PylonDst\ecosystem.config.js" -Encoding UTF8

# Pylon 설치 스크립트
@'
# install.ps1 - Pylon PM2 설치 스크립트
# 관리자 권한으로 실행하면 시작프로그램 등록까지 수행

$ErrorActionPreference = "Stop"
$PylonDir = $PSScriptRoot

Write-Host "=== Estelle Pylon Setup ===" -ForegroundColor Cyan

# 1. 의존성 설치
Write-Host "`n[1/4] Installing dependencies..." -ForegroundColor Yellow
Push-Location $PylonDir
npm install --omit=dev
Pop-Location

# 2. PM2 확인/설치
Write-Host "`n[2/4] Checking PM2..." -ForegroundColor Yellow
$pm2 = npm list -g pm2 2>$null | Select-String "pm2@"
if (-not $pm2) {
    Write-Host "Installing PM2..." -ForegroundColor Gray
    npm install -g pm2 pm2-windows-startup
}
Write-Host "PM2 ready: $(pm2 -v)" -ForegroundColor Green

# 3. PM2로 시작
Write-Host "`n[3/4] Starting Pylon..." -ForegroundColor Yellow
Push-Location $PylonDir
pm2 delete estelle-pylon 2>$null
pm2 start ecosystem.config.js
pm2 save
Pop-Location
Write-Host "Pylon started" -ForegroundColor Green

# 4. 시작프로그램 등록 (관리자 권한 필요)
Write-Host "`n[4/4] Registering startup..." -ForegroundColor Yellow
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if ($isAdmin) {
    pm2-startup install
    Write-Host "Startup registered" -ForegroundColor Green
} else {
    Write-Host "Skipped (run as Administrator)" -ForegroundColor Yellow
}

Write-Host "`n=== Setup Complete ===" -ForegroundColor Cyan
Write-Host "Commands: pm2 status | pm2 logs estelle-pylon | pm2 restart estelle-pylon" -ForegroundColor Gray
'@ | Out-File -FilePath "$PylonDst\install.ps1" -Encoding UTF8

Write-Host "Pylon package copied" -ForegroundColor Green

# 4. Relay 패키지 복사
Write-Host "`n[4/4] Copying relay package..." -ForegroundColor Yellow
$RelaySrc = Join-Path $RepoRoot "packages\relay"
$RelayDst = Join-Path $ReleaseDir "relay"
Copy-Item -Path "$RelaySrc\dist" -Destination "$RelayDst\dist" -Recurse
Copy-Item -Path "$RelaySrc\package.json" -Destination "$RelayDst\package.json"

# Relay Dockerfile
@'
FROM node:20-alpine

WORKDIR /app

# Core 패키지 복사
COPY core/package.json ./core/
COPY core/dist ./core/dist

# Relay 패키지 복사
COPY relay/package.json ./relay/
COPY relay/dist ./relay/dist

# 의존성 설치
WORKDIR /app/core
RUN npm install --omit=dev

WORKDIR /app/relay
RUN npm install --omit=dev

EXPOSE 8080

CMD ["node", "dist/bin.js"]
'@ | Out-File -FilePath "$RelayDst\Dockerfile" -Encoding UTF8

# Relay fly.toml
@'
app = "estelle-relay-v2"
primary_region = "nrt"

[build]
  dockerfile = "Dockerfile"

[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 0

[[services]]
  protocol = "tcp"
  internal_port = 8080

  [[services.ports]]
    port = 443
    handlers = ["tls", "http"]

  [[services.ports]]
    port = 80
    handlers = ["http"]
'@ | Out-File -FilePath "$RelayDst\fly.toml" -Encoding UTF8

# Relay 배포 스크립트
@'
# deploy.ps1 - Relay Fly.io 배포 스크립트
# 사용법: .\deploy.ps1

$ErrorActionPreference = "Stop"
$RelayDir = $PSScriptRoot
$ReleaseDir = Split-Path -Parent $RelayDir

Write-Host "=== Estelle Relay Deploy ===" -ForegroundColor Cyan

# fly.exe 경로
$FlyExe = Join-Path $env:USERPROFILE ".fly\bin\fly.exe"
if (-not (Test-Path $FlyExe)) {
    Write-Host "Fly CLI not found. Install: https://fly.io/docs/hands-on/install-flyctl/" -ForegroundColor Red
    exit 1
}

# release 폴더에서 배포 (core + relay 필요)
Push-Location $ReleaseDir
try {
    Write-Host "Deploying from $ReleaseDir..." -ForegroundColor Yellow
    & $FlyExe deploy --config "$RelayDir\fly.toml" --dockerfile "$RelayDir\Dockerfile"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Deploy successful!" -ForegroundColor Green
    } else {
        Write-Host "Deploy failed" -ForegroundColor Red
        exit 1
    }
} finally {
    Pop-Location
}
'@ | Out-File -FilePath "$RelayDst\deploy.ps1" -Encoding UTF8

Write-Host "Relay package copied" -ForegroundColor Green

# 완료
Write-Host "`n=== Release Build Complete ===" -ForegroundColor Cyan
Write-Host @"

Release packages created in: $ReleaseDir

  release/
  ├── core/      (shared library)
  ├── pylon/     (run: .\install.ps1)
  └── relay/     (run: .\deploy.ps1)

"@ -ForegroundColor Gray
