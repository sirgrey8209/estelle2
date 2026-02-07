# build-deploy.ps1 - Dev → Stage → Release 통합 빌드/배포 스크립트
#
# 사용법:
#   .\scripts\build-deploy.ps1 -Target stage
#   .\scripts\build-deploy.ps1 -Target release
#
# stage 빌드: release pylon에 영향 없이 안전하게 배포
# release 빌드: Pylon 세션에서 실행 시 detached로 실행 필요
#   Start-Process powershell -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File','.\scripts\build-deploy.ps1','-Target','release' -WindowStyle Hidden

param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('stage', 'release')]
    [string]$Target
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$ConfigPath = Join-Path $RepoRoot "config\environments.json"
$CounterPath = Join-Path $RepoRoot "config\build-counter.json"

# 환경 설정 로드
$EnvConfig = Get-Content $ConfigPath -Raw | ConvertFrom-Json
$TargetConfig = $EnvConfig.$Target

# 타겟별 경로
$TargetDirName = if ($Target -eq 'release') { 'release' } else { 'release-stage' }
$TargetDir = Join-Path $RepoRoot $TargetDirName
$DataDirName = if ($Target -eq 'release') { 'release-data' } else { 'stage-data' }
$DataDir = Join-Path $RepoRoot $DataDirName

# ============================================================
# Helper Functions
# ============================================================

function Write-Utf8File {
    param([string]$Path, [string]$Content)
    $utf8NoBom = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($Path, $Content, $utf8NoBom)
}

function Remove-Junction {
    param([string]$Path)
    if (Test-Path $Path) {
        $item = Get-Item $Path -Force
        if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) {
            cmd /c rmdir $Path 2>&1 | Out-Null
            return $true
        }
    }
    return $false
}

function Remove-DirectorySafe {
    param([string]$Path)
    if (-not (Test-Path $Path)) { return }

    # junction을 먼저 찾아서 제거 (하위 포함)
    Get-ChildItem -Path $Path -Recurse -Force -Directory -ErrorAction SilentlyContinue |
        Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint } |
        Sort-Object { $_.FullName.Length } -Descending |
        ForEach-Object {
            cmd /c rmdir $_.FullName 2>&1 | Out-Null
        }

    # 최상위가 junction인 경우
    Remove-Junction -Path $Path | Out-Null

    # 남은 폴더 삭제
    if (Test-Path $Path) {
        Remove-Item -Recurse -Force $Path
    }
}

function Write-Phase {
    param([string]$Phase, [string]$Message)
    Write-Host "`n[$Phase] $Message" -ForegroundColor Yellow
}

function Write-Detail {
    param([string]$Message)
    Write-Host "  $Message" -ForegroundColor Gray
}

function Write-Ok {
    param([string]$Message)
    Write-Host "  $Message" -ForegroundColor Green
}

# ============================================================
# Phase 0: Prerequisites
# ============================================================

function Test-Prerequisites {
    Write-Phase "Phase 0" "Checking prerequisites..."

    # pnpm
    $pnpm = Get-Command pnpm -ErrorAction SilentlyContinue
    if (-not $pnpm) {
        throw "pnpm not found. Install: npm install -g pnpm"
    }
    Write-Detail "pnpm: $(pnpm -v)"

    # pm2
    $pm2 = Get-Command pm2 -ErrorAction SilentlyContinue
    if (-not $pm2) {
        throw "pm2 not found. Install: npm install -g pm2"
    }
    Write-Detail "pm2: $(pm2 -v)"

    # fly.exe
    $script:FlyExe = Join-Path $env:USERPROFILE ".fly\bin\fly.exe"
    if (-not (Test-Path $script:FlyExe)) {
        throw "Fly CLI not found at $script:FlyExe"
    }
    Write-Detail "fly: $script:FlyExe"

    # config
    if (-not (Test-Path $ConfigPath)) {
        throw "Config not found: $ConfigPath"
    }
    Write-Detail "Config: OK"
    Write-Detail "Target: $Target ($($TargetConfig.name))"

    Write-Ok "Prerequisites OK"
}

# ============================================================
# Version Generation
# ============================================================

function Get-BuildVersion {
    Write-Phase "Version" "Generating build version..."

    $today = (Get-Date).ToString("MMdd")

    # build-counter.json 읽기
    if (Test-Path $CounterPath) {
        $counter = Get-Content $CounterPath -Raw | ConvertFrom-Json
    } else {
        $counter = @{ date = ""; counter = 0 }
    }

    # 날짜가 바뀌면 카운터 리셋
    if ($counter.date -eq $today) {
        $buildNum = $counter.counter + 1
    } else {
        $buildNum = 1
    }

    # 카운터 저장
    $newCounter = @{ date = $today; counter = $buildNum } | ConvertTo-Json -Compress
    Write-Utf8File -Path $CounterPath -Content $newCounter

    $version = "v${today}_${buildNum}"
    Write-Detail "Version: ($Target)$version"

    return $version
}

# ============================================================
# Phase 1: TypeScript Build
# ============================================================

function Build-TypeScript {
    param([string]$Version)

    Write-Phase "Phase 1" "Building TypeScript packages..."

    Push-Location $RepoRoot
    try {
        # 환경 변수 설정 후 빌드
        $env:VITE_BUILD_ENV = $Target
        $env:VITE_BUILD_VERSION = $Version
        $env:VITE_BUILD_TIME = (Get-Date).ToUniversalTime().ToString("o")

        pnpm build
        if ($LASTEXITCODE -ne 0) {
            throw "TypeScript build failed (exit code: $LASTEXITCODE)"
        }

        # 환경 변수 정리
        Remove-Item Env:\VITE_BUILD_ENV -ErrorAction SilentlyContinue
        Remove-Item Env:\VITE_BUILD_VERSION -ErrorAction SilentlyContinue
        Remove-Item Env:\VITE_BUILD_TIME -ErrorAction SilentlyContinue

        Write-Ok "TypeScript build completed"
    } finally {
        Pop-Location
    }
}

# ============================================================
# Initialize Data Directory
# ============================================================

function Initialize-DataDir {
    if (Test-Path $DataDir) {
        Write-Detail "$DataDirName/ already exists."
        # data, uploads 하위 폴더 확인
        $dataSubDir = Join-Path $DataDir "data"
        $uploadsSubDir = Join-Path $DataDir "uploads"
        if (-not (Test-Path $dataSubDir)) {
            New-Item -ItemType Directory -Path $dataSubDir -Force | Out-Null
        }
        if (-not (Test-Path $uploadsSubDir)) {
            New-Item -ItemType Directory -Path $uploadsSubDir -Force | Out-Null
        }
        return
    }

    Write-Phase "Init" "Creating $DataDirName/ directory..."

    New-Item -ItemType Directory -Path $DataDir -Force | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $DataDir "data") -Force | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $DataDir "uploads") -Force | Out-Null

    # release 타겟일 때 기존 release-data/ 마이그레이션 시도
    if ($Target -eq 'release') {
        $existingData = Join-Path $RepoRoot "release\pylon\data"
        if ((Test-Path $existingData)) {
            $item = Get-Item $existingData -Force
            if (-not ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
                Write-Detail "Migrating existing release/pylon/data..."
                Copy-Item -Path $existingData -Destination (Join-Path $DataDir "data") -Recurse -Force
            }
        }
    }

    Write-Ok "$DataDirName/ initialized"
}

# ============================================================
# Phase 2: Build Target Folder
# ============================================================

function Build-TargetFolder {
    Write-Phase "Phase 2" "Building target folder: $TargetDirName/..."

    # Clean previous target
    if (Test-Path $TargetDir) {
        Write-Detail "Cleaning previous $TargetDirName/..."
        Remove-DirectorySafe -Path $TargetDir
    }

    # Create structure
    New-Item -ItemType Directory -Path "$TargetDir\core" -Force | Out-Null
    New-Item -ItemType Directory -Path "$TargetDir\pylon" -Force | Out-Null
    New-Item -ItemType Directory -Path "$TargetDir\relay" -Force | Out-Null

    # --- Core ---
    Write-Detail "Copying core package..."
    $CoreSrc = Join-Path $RepoRoot "packages\core"
    $CoreDst = Join-Path $TargetDir "core"
    Copy-Item -Path "$CoreSrc\dist" -Destination "$CoreDst\dist" -Recurse
    Copy-Item -Path "$CoreSrc\package.json" -Destination "$CoreDst\package.json"
    if (Test-Path "$CoreSrc\node_modules") {
        Copy-Item -Path "$CoreSrc\node_modules" -Destination "$CoreDst\node_modules" -Recurse
    }

    # --- Pylon ---
    Write-Detail "Copying pylon package..."
    $PylonSrc = Join-Path $RepoRoot "packages\pylon"
    $PylonDst = Join-Path $TargetDir "pylon"
    Copy-Item -Path (Join-Path $PylonSrc "dist") -Destination (Join-Path $PylonDst "dist") -Recurse -Force
    Copy-Item -Path (Join-Path $PylonSrc "package.json") -Destination (Join-Path $PylonDst "package.json") -Force
    $pylonNodeModules = Join-Path $PylonSrc "node_modules"
    if (Test-Path $pylonNodeModules) {
        Copy-Item -Path $pylonNodeModules -Destination (Join-Path $PylonDst "node_modules") -Recurse -Force
    }

    # workspace:* -> file:../core
    $pylonPkgPath = Join-Path $PylonDst "package.json"
    $pylonPkgContent = Get-Content -Path $pylonPkgPath -Raw
    $pylonPkgContent = $pylonPkgContent -replace '"workspace:\*"', '"file:../core"'
    Write-Utf8File -Path $pylonPkgPath -Content $pylonPkgContent
    Write-Detail "  Fixed workspace:* -> file:../core (pylon)"

    # ecosystem.config.cjs (환경별 pm2Name, relayUrl)
    $pm2Name = $TargetConfig.pylon.pm2Name
    $relayUrl = $TargetConfig.pylon.relayUrl
    $deviceId = $TargetConfig.pylon.deviceId
    $ecosystemConfig = @"
module.exports = {
  apps: [
    {
      name: '$pm2Name',
      script: 'dist/bin.js',
      cwd: __dirname,
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      env: {
        NODE_ENV: 'production',
        RELAY_URL: '$relayUrl',
        DEVICE_ID: '$deviceId'
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      merge_logs: true
    }
  ]
};
"@
    Write-Utf8File -Path (Join-Path $PylonDst "ecosystem.config.cjs") -Content $ecosystemConfig

    # Data/Uploads junction -> data dir
    Write-Detail "Creating data junction -> $DataDirName/data..."
    $dataTarget = Join-Path $DataDir "data"
    $dataLink = Join-Path $PylonDst "data"
    cmd /c mklink /J $dataLink $dataTarget 2>&1 | Out-Null
    if (-not (Test-Path $dataLink)) {
        throw "Failed to create data junction: $dataLink -> $dataTarget"
    }

    Write-Detail "Creating uploads junction -> $DataDirName/uploads..."
    $uploadsTarget = Join-Path $DataDir "uploads"
    $uploadsLink = Join-Path $PylonDst "uploads"
    cmd /c mklink /J $uploadsLink $uploadsTarget 2>&1 | Out-Null
    if (-not (Test-Path $uploadsLink)) {
        throw "Failed to create uploads junction: $uploadsLink -> $uploadsTarget"
    }

    # --- Relay ---
    Write-Detail "Copying relay package..."
    $RelaySrc = Join-Path $RepoRoot "packages\relay"
    $RelayDst = Join-Path $TargetDir "relay"
    Copy-Item -Path "$RelaySrc\dist" -Destination "$RelayDst\dist" -Recurse
    Copy-Item -Path "$RelaySrc\package.json" -Destination "$RelayDst\package.json"
    if (Test-Path "$RelaySrc\node_modules") {
        Copy-Item -Path "$RelaySrc\node_modules" -Destination "$RelayDst\node_modules" -Recurse
    }

    # workspace:* -> file:../core
    $relayPkgPath = Join-Path $RelayDst "package.json"
    $relayPkgContent = Get-Content $relayPkgPath -Raw
    $relayPkgContent = $relayPkgContent -replace '"workspace:\*"', '"file:../core"'
    Write-Utf8File -Path $relayPkgPath -Content $relayPkgContent
    Write-Detail "  Fixed workspace:* -> file:../core (relay)"

    # Client web build -> relay/public
    $ClientPublic = Join-Path $RelaySrc "public"
    if (Test-Path $ClientPublic) {
        Copy-Item -Path $ClientPublic -Destination "$RelayDst\public" -Recurse
        Write-Detail "Client web files copied to relay/public"
    } else {
        Write-Host "  Warning: Client public folder not found" -ForegroundColor Yellow
    }

    # Dockerfile
    $dockerfile = @'
FROM node:20-alpine

WORKDIR /app

# Core
COPY core/package.json ./core/
COPY core/dist ./core/dist

# Relay
COPY relay/package.json ./relay/
COPY relay/dist ./relay/dist
COPY relay/public ./relay/public

# Dependencies
WORKDIR /app/core
RUN npm install --omit=dev

WORKDIR /app/relay
RUN npm install --omit=dev

ENV STATIC_DIR=/app/relay/public
EXPOSE 8080

CMD ["node", "dist/bin.js"]
'@
    Write-Utf8File -Path (Join-Path $RelayDst "Dockerfile") -Content $dockerfile

    # fly.toml (환경별 flyApp)
    $flyApp = $TargetConfig.relay.flyApp
    $flyToml = @"
app = "$flyApp"
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
"@
    Write-Utf8File -Path (Join-Path $RelayDst "fly.toml") -Content $flyToml

    Write-Ok "Target folder built: $TargetDirName/"
}

# ============================================================
# Phase 3: Integrity Check
# ============================================================

function Test-TargetIntegrity {
    Write-Phase "Phase 3" "Verifying target integrity..."

    $requiredFiles = @(
        "core\dist",
        "core\package.json",
        "pylon\dist\bin.js",
        "pylon\package.json",
        "pylon\ecosystem.config.cjs",
        "pylon\data",
        "pylon\uploads",
        "relay\dist",
        "relay\package.json",
        "relay\public\index.html"
    )

    $allOk = $true
    foreach ($f in $requiredFiles) {
        $fullPath = Join-Path $TargetDir $f
        if (-not (Test-Path $fullPath)) {
            Write-Host "  MISSING: $f" -ForegroundColor Red
            $allOk = $false
        }
    }

    # Verify junctions
    $dataLink = Join-Path $TargetDir "pylon\data"
    $uploadsLink = Join-Path $TargetDir "pylon\uploads"

    $dataItem = Get-Item $dataLink -Force
    if (-not ($dataItem.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
        Write-Host "  INVALID: pylon/data is not a junction" -ForegroundColor Red
        $allOk = $false
    } else {
        Write-Detail "pylon/data -> junction OK"
    }

    $uploadsItem = Get-Item $uploadsLink -Force
    if (-not ($uploadsItem.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
        Write-Host "  INVALID: pylon/uploads is not a junction" -ForegroundColor Red
        $allOk = $false
    } else {
        Write-Detail "pylon/uploads -> junction OK"
    }

    if (-not $allOk) {
        throw "Target integrity check failed."
    }

    Write-Ok "Integrity OK"
}

# ============================================================
# Phase 4: Deploy Relay to Fly.io
# ============================================================

function Deploy-Relay {
    Write-Phase "Phase 4" "Deploying Relay to Fly.io ($($TargetConfig.relay.flyApp))..."

    $relayDir = Join-Path $TargetDir "relay"
    $flyToml = Join-Path $relayDir "fly.toml"
    $dockerfile = Join-Path $relayDir "Dockerfile"

    Push-Location $TargetDir
    try {
        # fly.exe는 config 파일의 디렉토리를 빌드 컨텍스트로 사용하므로 상대경로 필요
        $flyOutput = & $script:FlyExe deploy --config "relay/fly.toml" --dockerfile "relay/Dockerfile" 2>&1
        $flyOutput | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
        if ($LASTEXITCODE -ne 0) {
            throw "Fly.io deploy failed (exit code: $LASTEXITCODE)"
        }
        Write-Ok "Relay deployed: $($TargetConfig.relay.url)"
    } finally {
        Pop-Location
    }
}

# ============================================================
# Phase 5: PM2 Restart
# ============================================================

function Restart-Pylon {
    Write-Phase "Phase 5" "Restarting PM2 pylon ($($TargetConfig.pylon.pm2Name))..."

    $pm2Name = $TargetConfig.pylon.pm2Name
    $pylonConfig = Join-Path $TargetDir "pylon\ecosystem.config.cjs"
    $pylonCwd = Join-Path $TargetDir "pylon"

    # 해당 환경의 pylon만 재시작 (다른 환경에 영향 없음)
    try { pm2 delete $pm2Name 2>&1 | Out-Null } catch { }

    Write-Detail "Starting $pm2Name..."
    & pm2 start $pylonConfig --cwd $pylonCwd
    if ($LASTEXITCODE -ne 0) {
        throw "PM2 start failed (exit code: $LASTEXITCODE)"
    }
    try { pm2 save 2>&1 | Out-Null } catch { }

    # Health check: wait for Relay connection (max 15 seconds)
    Write-Detail "Waiting for Relay connection (max 15s)..."
    $connected = $false
    for ($i = 0; $i -lt 5; $i++) {
        Start-Sleep -Seconds 3
        $pylonLog = pm2 logs $pm2Name --lines 30 --nostream 2>&1 | Out-String
        if ($pylonLog -match "Connected to Relay") {
            $connected = $true
            break
        }
        Write-Detail "  Attempt $($i + 1)/5..."
    }

    if ($connected) {
        Write-Ok "$pm2Name connected to Relay"
    } else {
        Write-Host "  Warning: $pm2Name did not confirm Relay connection within 15s" -ForegroundColor Yellow
        Write-Host "  Check: pm2 logs $pm2Name" -ForegroundColor Gray
    }

    pm2 status
}

# ============================================================
# Main Pipeline
# ============================================================

$startTime = Get-Date
Write-Host "=== Estelle v2 Build & Deploy ($Target) ===" -ForegroundColor Cyan

try {
    # Phase 0: Prerequisites
    Test-Prerequisites

    # Initialize data directory
    Initialize-DataDir

    # Version generation
    $version = Get-BuildVersion

    # Phase 1: TypeScript build
    Build-TypeScript -Version $version

    # Phase 2: Build target folder
    Build-TargetFolder

    # Phase 3: Integrity check
    Test-TargetIntegrity

    # Phase 4: Deploy Relay to Fly.io
    Deploy-Relay

    # Phase 5: PM2 restart (해당 환경만)
    Restart-Pylon

    # Done
    $elapsed = ((Get-Date) - $startTime).TotalSeconds
    Write-Host "`n=== Build & Deploy Complete ($Target) - ${elapsed}s ===" -ForegroundColor Cyan
    Write-Host @"

  Version:  ($Target)$version
  Folder:   $TargetDirName/
  Data:     $DataDirName/
  Relay:    $($TargetConfig.relay.url)
  PM2:      $($TargetConfig.pylon.pm2Name)

"@ -ForegroundColor Gray

} catch {
    $errorMsg = $_.Exception.Message
    Write-Host "`n[ERROR] $errorMsg" -ForegroundColor Red

    # Cleanup on failure
    if (Test-Path $TargetDir) {
        Write-Host "  Target folder preserved for debugging: $TargetDirName/" -ForegroundColor Gray
    }

    exit 1
}
