# promote-stage.ps1 - Stage → Release 프로모트 스크립트
#
# Stage에서 검증된 빌드를 소스 재빌드 없이 Release로 승격합니다.
# Client 번들은 relay URL이 런타임 결정이므로 재빌드 불필요.
#
# 사용법:
#   .\scripts\promote-stage.ps1
#
# Pylon 세션에서 실행 시 detached로 실행 필요:
#   Start-Process powershell -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File','.\scripts\promote-stage.ps1' -WindowStyle Hidden

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$ConfigPath = Join-Path $RepoRoot "config\environments.json"

# 공통 함수 로드
. (Join-Path $PSScriptRoot "deploy-common.ps1")

# 환경 설정 로드
$EnvConfig = Get-Content $ConfigPath -Raw | ConvertFrom-Json
$ReleaseConfig = $EnvConfig.release

# 경로
$StageDir = Join-Path $RepoRoot "release-stage"
$ReleaseDir = Join-Path $RepoRoot "release"
$ReleaseDataDir = Join-Path $RepoRoot "release-data"

# ============================================================
# Main
# ============================================================

$startTime = Get-Date
Write-Host "=== Estelle v2 Promote: Stage -> Release ===" -ForegroundColor Cyan

try {
    # --- Phase 0: 사전 검증 ---
    Write-Phase "Phase 0" "Checking prerequisites..."

    if (-not (Test-Path $StageDir)) {
        throw "Stage folder not found: $StageDir. Run build-deploy.ps1 -Target stage first."
    }

    # stage 빌드 무결성 확인
    $requiredFiles = @(
        "core\dist",
        "core\package.json",
        "pylon\dist\bin.js",
        "pylon\package.json",
        "relay\dist",
        "relay\package.json",
        "relay\public\index.html"
    )
    foreach ($f in $requiredFiles) {
        if (-not (Test-Path (Join-Path $StageDir $f))) {
            throw "Stage build incomplete: missing $f"
        }
    }
    Write-Ok "Stage build verified"

    # release-data 디렉토리 확인
    if (-not (Test-Path $ReleaseDataDir)) {
        New-Item -ItemType Directory -Path $ReleaseDataDir -Force | Out-Null
        New-Item -ItemType Directory -Path (Join-Path $ReleaseDataDir "data") -Force | Out-Null
        New-Item -ItemType Directory -Path (Join-Path $ReleaseDataDir "uploads") -Force | Out-Null
        Write-Detail "Created release-data/"
    }

    # fly.exe
    $FlyExe = Find-FlyExe
    Write-Ok "Prerequisites OK"

    # --- Phase 1: Release Pylon 중지 ---
    Write-Phase "Phase 1" "Stopping release pylon..."
    $pm2Name = $ReleaseConfig.pylon.pm2Name
    Stop-PylonPM2 -PM2Name $pm2Name

    # --- Phase 2: Stage → Release 복사 ---
    Write-Phase "Phase 2" "Copying stage -> release..."

    # 기존 release 폴더 삭제
    if (Test-Path $ReleaseDir) {
        Write-Detail "Cleaning previous release/..."
        Remove-DirectorySafe -Path $ReleaseDir
    }

    # stage에서 복사 (junction 제외 — core, relay, pylon의 dist/node_modules/package.json)
    New-Item -ItemType Directory -Path "$ReleaseDir\core" -Force | Out-Null
    New-Item -ItemType Directory -Path "$ReleaseDir\pylon" -Force | Out-Null
    New-Item -ItemType Directory -Path "$ReleaseDir\relay" -Force | Out-Null

    # Core
    Write-Detail "Copying core..."
    Copy-Item -Path "$StageDir\core\dist" -Destination "$ReleaseDir\core\dist" -Recurse
    Copy-Item -Path "$StageDir\core\package.json" -Destination "$ReleaseDir\core\package.json"
    if (Test-Path "$StageDir\core\node_modules") {
        Copy-Item -Path "$StageDir\core\node_modules" -Destination "$ReleaseDir\core\node_modules" -Recurse
    }

    # Pylon (junction 제외하고 복사)
    Write-Detail "Copying pylon..."
    Copy-Item -Path "$StageDir\pylon\dist" -Destination "$ReleaseDir\pylon\dist" -Recurse -Force
    Copy-Item -Path "$StageDir\pylon\package.json" -Destination "$ReleaseDir\pylon\package.json" -Force
    if (Test-Path "$StageDir\pylon\node_modules") {
        Copy-Item -Path "$StageDir\pylon\node_modules" -Destination "$ReleaseDir\pylon\node_modules" -Recurse -Force
    }

    # Relay
    Write-Detail "Copying relay..."
    Copy-Item -Path "$StageDir\relay\dist" -Destination "$ReleaseDir\relay\dist" -Recurse
    Copy-Item -Path "$StageDir\relay\package.json" -Destination "$ReleaseDir\relay\package.json"
    if (Test-Path "$StageDir\relay\node_modules") {
        Copy-Item -Path "$StageDir\relay\node_modules" -Destination "$ReleaseDir\relay\node_modules" -Recurse
    }
    Copy-Item -Path "$StageDir\relay\public" -Destination "$ReleaseDir\relay\public" -Recurse

    Write-Ok "Files copied"

    # --- Phase 3: Release 설정 생성 ---
    Write-Phase "Phase 3" "Generating release configs..."

    # Data/Uploads junction -> release-data (공통 함수 사용)
    New-DataJunctions -PylonDir (Join-Path $ReleaseDir "pylon") -DataDir $ReleaseDataDir

    # ecosystem.config.cjs (공통 함수 — ESTELLE_ENV_CONFIG JSON 방식)
    $dataSubDir = Join-Path $ReleaseDataDir "data"
    $ecosystemConfig = New-EcosystemConfig -PylonConfig $ReleaseConfig.pylon -BeaconConfig $ReleaseConfig.beacon -EnvId $ReleaseConfig.envId -DataDir $dataSubDir
    Write-Utf8File -Path (Join-Path $ReleaseDir "pylon\ecosystem.config.cjs") -Content $ecosystemConfig

    # fly.toml & Dockerfile (공통 함수 사용)
    $flyApp = $ReleaseConfig.relay.flyApp
    Write-Utf8File -Path (Join-Path $ReleaseDir "relay\fly.toml") -Content (New-FlyToml -FlyApp $flyApp)
    Write-Utf8File -Path (Join-Path $ReleaseDir "relay\Dockerfile") -Content (New-Dockerfile -EnvId $ReleaseConfig.envId)

    Write-Ok "Release configs generated"

    # --- Phase 4: Fly.io 배포 ---
    Write-Phase "Phase 4" "Deploying Relay to Fly.io ($flyApp)..."
    Deploy-FlyRelay -FlyExe $FlyExe -WorkingDir $ReleaseDir -FlyApp $flyApp
    Write-Ok "Relay deployed: $($ReleaseConfig.relay.url)"

    # --- Phase 5: PM2 시작 ---
    Write-Phase "Phase 5" "Starting release pylon ($pm2Name)..."
    Start-PylonPM2 -PM2Name $pm2Name -PylonDir (Join-Path $ReleaseDir "pylon")

    # Done
    $elapsed = ((Get-Date) - $startTime).TotalSeconds
    Write-Host "`n=== Promote Complete (stage -> release) - ${elapsed}s ===" -ForegroundColor Cyan
    Write-Host @"

  Folder:   release/
  Data:     release-data/
  Relay:    $($ReleaseConfig.relay.url)
  PM2:      $pm2Name

"@ -ForegroundColor Gray

} catch {
    $errorMsg = $_.Exception.Message
    Write-Host "`n[ERROR] $errorMsg" -ForegroundColor Red
    exit 1
}
