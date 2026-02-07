# sync-data.ps1 - 환경 간 데이터 동기화
#
# 사용법:
#   .\scripts\sync-data.ps1                           # release → dev (기본)
#   .\scripts\sync-data.ps1 -From release -To stage   # release → stage
#   .\scripts\sync-data.ps1 -From stage -To dev       # stage → dev
#   .\scripts\sync-data.ps1 -Force                    # 확인 없이 실행

param(
    [ValidateSet('release', 'stage', 'dev')]
    [string]$From = 'release',

    [ValidateSet('release', 'stage', 'dev')]
    [string]$To = 'dev',

    [switch]$Force
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot

# 환경별 데이터 경로 매핑
$DataPaths = @{
    'release' = Join-Path $RepoRoot "release-data\data"
    'stage'   = Join-Path $RepoRoot "stage-data\data"
    'dev'     = Join-Path $RepoRoot "packages\pylon\data"
}

# 검증
if ($From -eq $To) {
    Write-Host "From과 To가 동일해요: $From" -ForegroundColor Red
    exit 1
}

$SourceDir = $DataPaths[$From]
$DestDir = $DataPaths[$To]

# Source 존재 확인
if (-not (Test-Path $SourceDir)) {
    Write-Host "$From 데이터를 찾을 수 없어요." -ForegroundColor Red
    Write-Host "  경로: $SourceDir" -ForegroundColor Gray
    exit 1
}

Write-Host "=== Sync Data: $From -> $To ===" -ForegroundColor Cyan
Write-Host "From: $SourceDir" -ForegroundColor Gray
Write-Host "To:   $DestDir" -ForegroundColor Gray

# 파일 목록 표시
Write-Host "`nSource data files:" -ForegroundColor Yellow
Get-ChildItem -Path $SourceDir -Recurse -File -ErrorAction SilentlyContinue | ForEach-Object {
    $relativePath = $_.FullName.Substring($SourceDir.Length + 1)
    $size = "{0:N1} KB" -f ($_.Length / 1KB)
    Write-Host "  $relativePath ($size)" -ForegroundColor Gray
}

# 확인
if (-not $Force) {
    Write-Host "`nThis will overwrite $To data. Continue? (y/N): " -ForegroundColor Yellow -NoNewline
    $confirm = Read-Host
    if ($confirm -ne 'y' -and $confirm -ne 'Y') {
        Write-Host "Cancelled." -ForegroundColor Gray
        exit 0
    }
}

# 대상 데이터 백업
if (Test-Path $DestDir) {
    $backupDir = "$DestDir.backup"
    if (Test-Path $backupDir) {
        Remove-Item -Recurse -Force $backupDir
    }
    Write-Host "`nBacking up $To data..." -ForegroundColor Yellow
    Copy-Item -Path $DestDir -Destination $backupDir -Recurse
    Write-Host "  Backup: $backupDir" -ForegroundColor Gray

    Remove-Item -Recurse -Force $DestDir
}

# 복사
Write-Host "`nCopying $From data to $To..." -ForegroundColor Yellow

# 대상 상위 디렉토리가 없으면 생성
$destParent = Split-Path -Parent $DestDir
if (-not (Test-Path $destParent)) {
    New-Item -ItemType Directory -Path $destParent -Force | Out-Null
}

Copy-Item -Path $SourceDir -Destination $DestDir -Recurse

Write-Host "`n=== Sync Complete ===" -ForegroundColor Cyan
Write-Host "$To data updated from $From" -ForegroundColor Green
Write-Host "Backup: $DestDir.backup" -ForegroundColor Gray
