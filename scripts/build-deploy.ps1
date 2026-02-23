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

# 공통 함수 로드
. (Join-Path $PSScriptRoot "deploy-common.ps1")

# 환경 설정 로드
$EnvConfig = Get-Content $ConfigPath -Raw | ConvertFrom-Json
$TargetConfig = $EnvConfig.$Target

# 타겟별 경로
$TargetDirName = if ($Target -eq 'release') { 'release' } else { 'release-stage' }
$TargetDir = Join-Path $RepoRoot $TargetDirName
$DataDirName = if ($Target -eq 'release') { 'release-data' } else { 'stage-data' }
$DataDir = Join-Path $RepoRoot $DataDirName

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
    $script:FlyExe = Find-FlyExe

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

    # build-counter.json 읽기 (에러 핸들링 포함)
    $counter = $null
    if (Test-Path $CounterPath) {
        try {
            $raw = Get-Content $CounterPath -Raw -ErrorAction Stop
            if ($raw -and $raw.Trim()) {
                $counter = $raw | ConvertFrom-Json
            }
        } catch {
            Write-Detail "Warning: build-counter.json corrupted, resetting."
        }
    }
    if (-not $counter) {
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
        pnpm build
        if ($LASTEXITCODE -ne 0) {
            throw "TypeScript build failed (exit code: $LASTEXITCODE)"
        }

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
    param([string]$Version)

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

    # ecosystem.config.cjs (공통 함수 사용) - DataDir은 junction target의 data 하위 폴더
    $dataSubDir = Join-Path $DataDir "data"
    $ecosystemConfig = New-EcosystemConfig -PylonConfig $TargetConfig.pylon -EnvId $TargetConfig.envId -DataDir $dataSubDir
    Write-Utf8File -Path (Join-Path $PylonDst "ecosystem.config.cjs") -Content $ecosystemConfig

    # Data/Uploads junction
    New-DataJunctions -PylonDir $PylonDst -DataDir $DataDir

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

    # Dockerfile & fly.toml (공통 함수 사용)
    Write-Utf8File -Path (Join-Path $RelayDst "Dockerfile") -Content (New-Dockerfile -EnvId $TargetConfig.envId)
    Write-Utf8File -Path (Join-Path $RelayDst "fly.toml") -Content (New-FlyToml -FlyApp $TargetConfig.relay.flyApp)

    # version.json (런타임 버전 정보)
    $versionJson = ConvertTo-Json -InputObject @{
        env = $Target
        version = $Version
        buildTime = (Get-Date).ToUniversalTime().ToString("o")
    } -Compress
    Write-Utf8File -Path (Join-Path $RelayDst "public\version.json") -Content $versionJson
    Write-Detail "Generated version.json: ($Target)$Version"

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
        "relay\public\index.html",
        "relay\public\version.json"
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
    $junctionOk = Test-DataJunctions -PylonDir (Join-Path $TargetDir "pylon")
    if (-not $junctionOk) { $allOk = $false }

    if (-not $allOk) {
        throw "Target integrity check failed."
    }

    Write-Ok "Integrity OK"
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

    # PM2 중지 (Phase 2에서 타겟 폴더를 삭제하므로 먼저 중지해야 함)
    $pm2Name = $TargetConfig.pylon.pm2Name
    Write-Detail "Stopping PM2 $pm2Name before target folder cleanup..."
    Stop-PylonPM2 -PM2Name $pm2Name

    # Phase 2: Build target folder
    Build-TargetFolder -Version $version

    # Phase 3: Integrity check
    Test-TargetIntegrity

    # Phase 4: Deploy Relay to Fly.io
    Write-Phase "Phase 4" "Deploying Relay to Fly.io ($($TargetConfig.relay.flyApp))..."
    Deploy-FlyRelay -FlyExe $script:FlyExe -WorkingDir $TargetDir -FlyApp $TargetConfig.relay.flyApp
    Write-Ok "Relay deployed: $($TargetConfig.relay.url)"

    # Phase 5: PM2 restart (해당 환경만)
    Write-Phase "Phase 5" "Restarting PM2 pylon ($pm2Name)..."
    Start-PylonPM2 -PM2Name $pm2Name -PylonDir (Join-Path $TargetDir "pylon")

    # Done
    $elapsed = ((Get-Date) - $startTime).TotalSeconds
    Write-Host "`n=== Build & Deploy Complete ($Target) - ${elapsed}s ===" -ForegroundColor Cyan
    Write-Host @"

  Version:  ($Target)$version
  Folder:   $TargetDirName/
  Data:     $DataDirName/
  Relay:    $($TargetConfig.relay.url)
  PM2:      $pm2Name

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
