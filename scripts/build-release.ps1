# build-release.ps1 - 릴리즈 패키지 빌드 스크립트
#
# 사용법: .\scripts\build-release.ps1
# 결과: release/ 폴더에 배포 가능한 패키지 생성 + PM2 서비스 시작 + 헬스체크

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$ReleaseDir = Join-Path $RepoRoot "release"
$ConfigPath = Join-Path $RepoRoot "config\environments.json"

# 환경 설정 로드
$EnvConfig = Get-Content $ConfigPath -Raw | ConvertFrom-Json
$ReleaseConfig = $EnvConfig.release

# UTF8 without BOM 헬퍼 함수
function Write-Utf8File {
    param([string]$Path, [string]$Content)
    $utf8NoBom = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($Path, $Content, $utf8NoBom)
}

Write-Host "=== Estelle v2 Release Build ===" -ForegroundColor Cyan

# 1. TypeScript 빌드
Write-Host "`n[1/6] Building packages..." -ForegroundColor Yellow
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

# 2. release 폴더 초기화
Write-Host "`n[2/6] Initializing release folder..." -ForegroundColor Yellow

# PM2 프로세스 종료 (release 폴더 사용 중일 수 있음)
$pm2Exists = Get-Command pm2 -ErrorAction SilentlyContinue
if ($pm2Exists) {
    Write-Host "  Stopping PM2 processes..." -ForegroundColor Gray
    try { pm2 stop all 2>&1 | Out-Null } catch { }
}

if (Test-Path $ReleaseDir) {
    Remove-Item -Recurse -Force $ReleaseDir
}
New-Item -ItemType Directory -Path "$ReleaseDir\core" -Force | Out-Null
New-Item -ItemType Directory -Path "$ReleaseDir\pylon" -Force | Out-Null
New-Item -ItemType Directory -Path "$ReleaseDir\relay" -Force | Out-Null
Write-Host "Release folder initialized" -ForegroundColor Green

# 3. Core 패키지 복사
Write-Host "`n[3/6] Copying core package..." -ForegroundColor Yellow
$CoreSrc = Join-Path $RepoRoot "packages\core"
$CoreDst = Join-Path $ReleaseDir "core"
Copy-Item -Path "$CoreSrc\dist" -Destination "$CoreDst\dist" -Recurse
Copy-Item -Path "$CoreSrc\package.json" -Destination "$CoreDst\package.json"
if (Test-Path "$CoreSrc\node_modules") {
    Copy-Item -Path "$CoreSrc\node_modules" -Destination "$CoreDst\node_modules" -Recurse
}
Write-Host "Core package copied" -ForegroundColor Green

# 4. Pylon 패키지 복사
Write-Host "`n[4/6] Copying pylon package..." -ForegroundColor Yellow
$PylonSrc = Join-Path $RepoRoot "packages\pylon"
$PylonDst = Join-Path $ReleaseDir "pylon"
Copy-Item -Path "$PylonSrc\dist" -Destination "$PylonDst\dist" -Recurse
Copy-Item -Path "$PylonSrc\package.json" -Destination "$PylonDst\package.json"
if (Test-Path "$PylonSrc\node_modules") {
    Copy-Item -Path "$PylonSrc\node_modules" -Destination "$PylonDst\node_modules" -Recurse
}

# workspace:* -> file:../core 변환
$pylonPkgPath = "$PylonDst\package.json"
$pylonPkgContent = Get-Content $pylonPkgPath -Raw
$pylonPkgContent = $pylonPkgContent -replace '"workspace:\*"', '"file:../core"'
Write-Utf8File -Path $pylonPkgPath -Content $pylonPkgContent
Write-Host "  Fixed workspace:* -> file:../core" -ForegroundColor Gray

# Pylon 배포 설정
$ecosystemConfig = @"
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
        NODE_ENV: 'production',
        RELAY_URL: '$($ReleaseConfig.pylon.relayUrl)',
        DEVICE_ID: '$($ReleaseConfig.pylon.deviceId)'
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      merge_logs: true
    }
  ]
};
"@
Write-Utf8File -Path "$PylonDst\ecosystem.config.cjs" -Content $ecosystemConfig

# Pylon 설치 스크립트
$installScript = @'
# install.ps1 - Pylon PM2 설치 스크립트
# 관리자 권한으로 실행하면 시작프로그램 등록까지 수행

$ErrorActionPreference = "Stop"
$PylonDir = $PSScriptRoot

Write-Host "=== Estelle Pylon Setup ===" -ForegroundColor Cyan

# 1. PM2 확인/설치
Write-Host "`n[1/3] Checking PM2..." -ForegroundColor Yellow
$pm2 = npm list -g pm2 2>$null | Select-String "pm2@"
if (-not $pm2) {
    Write-Host "Installing PM2..." -ForegroundColor Gray
    npm install -g pm2 pm2-windows-startup
}
Write-Host "PM2 ready: $(pm2 -v)" -ForegroundColor Green

# 2. PM2로 시작
Write-Host "`n[2/3] Starting Pylon..." -ForegroundColor Yellow
Push-Location $PylonDir
pm2 delete estelle-pylon 2>$null
pm2 start ecosystem.config.cjs
pm2 save
Pop-Location
Write-Host "Pylon started" -ForegroundColor Green

# 3. 시작프로그램 등록 (관리자 권한 필요)
Write-Host "`n[3/3] Registering startup..." -ForegroundColor Yellow
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if ($isAdmin) {
    pm2-startup install
    Write-Host "Startup registered" -ForegroundColor Green
} else {
    Write-Host "Skipped (run as Administrator)" -ForegroundColor Yellow
}

Write-Host "`n=== Setup Complete ===" -ForegroundColor Cyan
Write-Host "Commands: pm2 status | pm2 logs estelle-pylon | pm2 restart estelle-pylon" -ForegroundColor Gray
'@
Write-Utf8File -Path "$PylonDst\install.ps1" -Content $installScript

Write-Host "Pylon package copied" -ForegroundColor Green

# 5. Relay 패키지 복사 (+ 웹 클라이언트)
Write-Host "`n[5/6] Copying relay package with client..." -ForegroundColor Yellow
$RelaySrc = Join-Path $RepoRoot "packages\relay"
$RelayDst = Join-Path $ReleaseDir "relay"
Copy-Item -Path "$RelaySrc\dist" -Destination "$RelayDst\dist" -Recurse
Copy-Item -Path "$RelaySrc\package.json" -Destination "$RelayDst\package.json"
if (Test-Path "$RelaySrc\node_modules") {
    Copy-Item -Path "$RelaySrc\node_modules" -Destination "$RelayDst\node_modules" -Recurse
}

# workspace:* -> file:../core 변환 (npm 배포용)
$relayPkgPath = "$RelayDst\package.json"
$relayPkgContent = Get-Content $relayPkgPath -Raw
$relayPkgContent = $relayPkgContent -replace '"workspace:\*"', '"file:../core"'
Write-Utf8File -Path $relayPkgPath -Content $relayPkgContent
Write-Host "  Fixed workspace:* -> file:../core" -ForegroundColor Gray

# 클라이언트 웹 빌드 결과 복사 (Vite → relay/public)
$ClientPublic = Join-Path $RelaySrc "public"
if (Test-Path $ClientPublic) {
    Copy-Item -Path $ClientPublic -Destination "$RelayDst\public" -Recurse
    Write-Host "  Client web files copied" -ForegroundColor Green
} else {
    Write-Host "  Warning: Client public folder not found (run pnpm build first)" -ForegroundColor Yellow
}

# Relay Dockerfile (정적 파일 포함)
$dockerfile = @'
FROM node:20-alpine

WORKDIR /app

# Core 패키지 복사
COPY core/package.json ./core/
COPY core/dist ./core/dist

# Relay 패키지 복사
COPY relay/package.json ./relay/
COPY relay/dist ./relay/dist
COPY relay/public ./relay/public

# 의존성 설치
WORKDIR /app/core
RUN npm install --omit=dev

WORKDIR /app/relay
RUN npm install --omit=dev

ENV STATIC_DIR=/app/relay/public
EXPOSE 8080

CMD ["node", "dist/bin.js"]
'@
Write-Utf8File -Path "$RelayDst\Dockerfile" -Content $dockerfile

# Relay fly.toml
$flyToml = @'
app = "estelle-relay-v2"
primary_region = "nrt"

[build]
  dockerfile = "Dockerfile"

[env]
  STATIC_DIR = "/app/relay/public"

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
'@
Write-Utf8File -Path "$RelayDst\fly.toml" -Content $flyToml

# Relay 배포 스크립트
$deployScript = @'
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
        Write-Host "Web: https://estelle-relay-v2.fly.dev/" -ForegroundColor Cyan
    } else {
        Write-Host "Deploy failed" -ForegroundColor Red
        exit 1
    }
} finally {
    Pop-Location
}
'@
Write-Utf8File -Path "$RelayDst\deploy.ps1" -Content $deployScript

Write-Host "Relay package copied" -ForegroundColor Green

# 6. PM2 시작 + 헬스체크
Write-Host "`n[6/6] Starting PM2 services..." -ForegroundColor Yellow
$pm2Exists = Get-Command pm2 -ErrorAction SilentlyContinue
if ($pm2Exists) {
    # 기존 프로세스 삭제 후 새로 시작
    try { pm2 delete estelle-pylon 2>&1 | Out-Null } catch { }

    # Pylon 시작
    Write-Host "  Starting Pylon..." -ForegroundColor Gray
    $pylonConfig = "$ReleaseDir\pylon\ecosystem.config.cjs"
    $pylonCwd = "$ReleaseDir\pylon"
    & pm2 start $pylonConfig --cwd $pylonCwd

    try { pm2 save 2>&1 | Out-Null } catch { }
    Write-Host "PM2 services started" -ForegroundColor Green

    # 헬스체크 대기
    Write-Host "`n  Waiting for services to start..." -ForegroundColor Gray
    Start-Sleep -Seconds 3

    # Pylon 로그에서 Relay 연결 확인
    Write-Host "  Checking Pylon connection..." -ForegroundColor Gray
    $pylonLog = pm2 logs estelle-pylon --lines 20 --nostream 2>&1 | Out-String
    if ($pylonLog -match "Connected to Relay") {
        Write-Host "  Pylon: Connected to Relay" -ForegroundColor Green
    } else {
        Write-Host "  Pylon: Waiting for Relay connection..." -ForegroundColor Yellow
    }

    pm2 status
} else {
    Write-Host "PM2 not installed, skipping auto-start" -ForegroundColor Yellow
}

# 완료
Write-Host "`n=== Release Build Complete ===" -ForegroundColor Cyan
Write-Host @"

Release packages created in: $ReleaseDir

  release/
  +-- core/      (shared library)
  +-- pylon/     (run: .\install.ps1)
  +-- relay/     (run: .\deploy.ps1)
      +-- public/  (웹 클라이언트, Relay에서 서빙)

"@ -ForegroundColor Gray
