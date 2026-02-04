# sync-data.ps1 - Release 데이터를 Dev로 동기화
#
# 사용법: .\scripts\sync-data.ps1
# Release의 대화/워크스페이스 데이터를 Dev 환경으로 복사

param(
    [switch]$Force  # 확인 없이 덮어쓰기
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot

$ReleasePylonData = Join-Path $RepoRoot "release\pylon\data"
$DevPylonData = Join-Path $RepoRoot "packages\pylon\data"

Write-Host "=== Sync Release Data to Dev ===" -ForegroundColor Cyan

# Release 데이터 확인
if (-not (Test-Path $ReleasePylonData)) {
    Write-Host "Release data not found: $ReleasePylonData" -ForegroundColor Red
    exit 1
}

# 파일 목록 표시
Write-Host "`nRelease data files:" -ForegroundColor Yellow
Get-ChildItem -Path $ReleasePylonData -Recurse -File | ForEach-Object {
    $relativePath = $_.FullName.Substring($ReleasePylonData.Length + 1)
    $size = "{0:N1} KB" -f ($_.Length / 1KB)
    Write-Host "  $relativePath ($size)" -ForegroundColor Gray
}

# 확인
if (-not $Force) {
    Write-Host "`nThis will overwrite Dev data. Continue? (y/N): " -ForegroundColor Yellow -NoNewline
    $confirm = Read-Host
    if ($confirm -ne 'y' -and $confirm -ne 'Y') {
        Write-Host "Cancelled." -ForegroundColor Gray
        exit 0
    }
}

# Dev 데이터 백업
if (Test-Path $DevPylonData) {
    $backupDir = "$DevPylonData.backup"
    if (Test-Path $backupDir) {
        Remove-Item -Recurse -Force $backupDir
    }
    Write-Host "`nBacking up Dev data..." -ForegroundColor Yellow
    Copy-Item -Path $DevPylonData -Destination $backupDir -Recurse
    Write-Host "  Backup: $backupDir" -ForegroundColor Gray

    Remove-Item -Recurse -Force $DevPylonData
}

# 복사
Write-Host "`nCopying Release data to Dev..." -ForegroundColor Yellow
Copy-Item -Path $ReleasePylonData -Destination $DevPylonData -Recurse

Write-Host "`n=== Sync Complete ===" -ForegroundColor Cyan
Write-Host "Dev data updated from Release" -ForegroundColor Green
Write-Host "Backup available at: $DevPylonData.backup" -ForegroundColor Gray
