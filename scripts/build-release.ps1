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
Write-Host "`n[1/7] Building packages..." -ForegroundColor Yellow
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
Write-Host "`n[2/7] Initializing release folder..." -ForegroundColor Yellow

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
Write-Host "`n[3/7] Copying core package..." -ForegroundColor Yellow
$CoreSrc = Join-Path $RepoRoot "packages\core"
$CoreDst = Join-Path $ReleaseDir "core"
Copy-Item -Path "$CoreSrc\dist" -Destination "$CoreDst\dist" -Recurse
Copy-Item -Path "$CoreSrc\package.json" -Destination "$CoreDst\package.json"
if (Test-Path "$CoreSrc\node_modules") {
    Copy-Item -Path "$CoreSrc\node_modules" -Destination "$CoreDst\node_modules" -Recurse
}
Write-Host "Core package copied" -ForegroundColor Green

# 4. Pylon 패키지 복사
Write-Host "`n[4/7] Copying pylon package..." -ForegroundColor Yellow
$PylonSrc = Join-Path $RepoRoot "packages\pylon"
$PylonDst = Join-Path $ReleaseDir "pylon"
Copy-Item -Path "$PylonSrc\dist" -Destination "$PylonDst\dist" -Recurse
Copy-Item -Path "$PylonSrc\package.json" -Destination "$PylonDst\package.json"
if (Test-Path "$PylonSrc\node_modules") {
    Copy-Item -Path "$PylonSrc\node_modules" -Destination "$PylonDst\node_modules" -Recurse
}

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

# 5. Relay 패키지 복사
Write-Host "`n[5/7] Copying relay package..." -ForegroundColor Yellow
$RelaySrc = Join-Path $RepoRoot "packages\relay"
$RelayDst = Join-Path $ReleaseDir "relay"
Copy-Item -Path "$RelaySrc\dist" -Destination "$RelayDst\dist" -Recurse
Copy-Item -Path "$RelaySrc\package.json" -Destination "$RelayDst\package.json"
if (Test-Path "$RelaySrc\node_modules") {
    Copy-Item -Path "$RelaySrc\node_modules" -Destination "$RelayDst\node_modules" -Recurse
}

# Relay Dockerfile
$dockerfile = @'
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
'@
Write-Utf8File -Path "$RelayDst\Dockerfile" -Content $dockerfile

# Relay fly.toml
$flyToml = @'
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

# 6. Client 패키지 (웹 + APK)
Write-Host "`n[6/7] Building client..." -ForegroundColor Yellow
$ClientSrc = Join-Path $RepoRoot "packages\client"
$ClientDst = Join-Path $ReleaseDir "client"
New-Item -ItemType Directory -Path $ClientDst -Force | Out-Null

# 6a. 웹 빌드
Write-Host "  Building web..." -ForegroundColor Gray
Push-Location $ClientSrc
try {
    # Production Relay URL 설정
    $env:EXPO_PUBLIC_RELAY_URL = $ReleaseConfig.client.relayUrl
    pnpm exec expo export --platform web
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Web build failed" -ForegroundColor Red
        exit 1
    }
} finally {
    Pop-Location
}

if (Test-Path "$ClientSrc\dist") {
    Copy-Item -Path "$ClientSrc\dist" -Destination "$ClientDst\web" -Recurse
    Write-Host "  Web build copied" -ForegroundColor Green
}

# Client 웹 서버 설정
$clientEcosystem = @"
module.exports = {
  apps: [
    {
      name: 'estelle-client',
      script: 'serve.cjs',
      cwd: __dirname,
      watch: false,
      autorestart: true,
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
"@
Write-Utf8File -Path "$ClientDst\ecosystem.config.cjs" -Content $clientEcosystem

$webPort = $ReleaseConfig.client.webPort
$serveScript = @"
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = $webPort;
const WEB_DIR = path.join(__dirname, 'web');

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

const server = http.createServer((req, res) => {
  let filePath = path.join(WEB_DIR, req.url === '/' ? 'index.html' : req.url);

  // SPA fallback
  if (!fs.existsSync(filePath) && !path.extname(filePath)) {
    filePath = path.join(WEB_DIR, 'index.html');
  }

  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log('Estelle Client running at http://localhost:' + PORT);
});
"@
Write-Utf8File -Path "$ClientDst\serve.cjs" -Content $serveScript

# 6b. APK 빌드
Write-Host "  Building APK..." -ForegroundColor Gray
& "$PSScriptRoot\build-apk.ps1"
if ($LASTEXITCODE -ne 0) {
    Write-Host "APK build failed" -ForegroundColor Red
    exit 1
}

$ApkSrc = Join-Path $ClientSrc "android\app\build\outputs\apk\release\app-release.apk"
if (Test-Path $ApkSrc) {
    Copy-Item -Path $ApkSrc -Destination "$ClientDst\estelle-v2.apk"
    $apkSize = (Get-Item "$ClientDst\estelle-v2.apk").Length / 1MB
    Write-Host "  APK copied ($([math]::Round($apkSize, 1)) MB)" -ForegroundColor Green
}

Write-Host "Client package copied" -ForegroundColor Green

# 7. PM2 시작 + 헬스체크
Write-Host "`n[7/7] Starting PM2 services..." -ForegroundColor Yellow
$pm2Exists = Get-Command pm2 -ErrorAction SilentlyContinue
if ($pm2Exists) {
    # 기존 프로세스 삭제 후 새로 시작
    try { pm2 delete estelle-pylon 2>&1 | Out-Null } catch { }
    try { pm2 delete estelle-client 2>&1 | Out-Null } catch { }

    # Pylon 시작
    Write-Host "  Starting Pylon..." -ForegroundColor Gray
    $pylonConfig = "$ReleaseDir\pylon\ecosystem.config.cjs"
    $pylonCwd = "$ReleaseDir\pylon"
    & pm2 start $pylonConfig --cwd $pylonCwd

    # Client 시작
    Write-Host "  Starting Client..." -ForegroundColor Gray
    $clientConfig = "$ReleaseDir\client\ecosystem.config.cjs"
    $clientCwd = "$ReleaseDir\client"
    & pm2 start $clientConfig --cwd $clientCwd

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

    # 웹 서버 헬스체크
    Write-Host "  Checking web server..." -ForegroundColor Gray
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:$($ReleaseConfig.client.webPort)" -Method Head -UseBasicParsing -TimeoutSec 5
        if ($response.StatusCode -eq 200) {
            Write-Host "  Web Server: OK (http://localhost:$($ReleaseConfig.client.webPort))" -ForegroundColor Green
        }
    } catch {
        Write-Host "  Web Server: Not responding yet" -ForegroundColor Yellow
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
  +-- client/
      +-- web/           (http://localhost:8080)
      +-- estelle-v2.apk (Android app)

"@ -ForegroundColor Gray
