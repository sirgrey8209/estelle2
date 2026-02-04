# release-github.ps1 - GitHub Release 생성 및 업로드 스크립트
#
# 사용법: .\scripts\release-github.ps1 -Version "v2.0.0"
# 결과: GitHub Release 생성 및 APK 업로드

param(
    [Parameter(Mandatory=$true)]
    [string]$Version,       # 버전 태그 (예: v2.0.0)
    [string]$Title,         # 릴리즈 제목 (기본: Estelle $Version)
    [switch]$Draft,         # 드래프트로 생성
    [switch]$Prerelease     # 프리릴리즈로 표시
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$ReleaseDir = Join-Path $RepoRoot "release"
$ApkPath = Join-Path $ReleaseDir "client\estelle-v2.apk"

if (-not $Title) {
    $Title = "Estelle $Version"
}

Write-Host "=== GitHub Release ===" -ForegroundColor Cyan
Write-Host "Version: $Version" -ForegroundColor Gray
Write-Host "Title: $Title" -ForegroundColor Gray

# 1. gh CLI 확인
Write-Host "`n[1/4] Checking gh CLI..." -ForegroundColor Yellow
$ghVersion = gh --version 2>$null | Select-Object -First 1
if (-not $ghVersion) {
    Write-Host "GitHub CLI not found. Install: https://cli.github.com/" -ForegroundColor Red
    exit 1
}
Write-Host "gh CLI ready: $ghVersion" -ForegroundColor Green

# 2. 인증 확인
Write-Host "`n[2/4] Checking authentication..." -ForegroundColor Yellow
$authStatus = gh auth status 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Not authenticated. Run: gh auth login" -ForegroundColor Red
    exit 1
}
Write-Host "Authenticated" -ForegroundColor Green

# 3. APK 확인
Write-Host "`n[3/4] Checking APK..." -ForegroundColor Yellow
if (-not (Test-Path $ApkPath)) {
    Write-Host "APK not found: $ApkPath" -ForegroundColor Red
    Write-Host "Run build-release.ps1 first" -ForegroundColor Yellow
    exit 1
}
$apkSize = (Get-Item $ApkPath).Length / 1MB
Write-Host "APK found: $([math]::Round($apkSize, 1)) MB" -ForegroundColor Green

# 4. 릴리즈 생성 및 업로드
Write-Host "`n[4/4] Creating release..." -ForegroundColor Yellow
Push-Location $RepoRoot
try {
    $ghArgs = @(
        "release", "create", $Version,
        $ApkPath,
        "--title", $Title,
        "--notes", "## Downloads`n`n- **Android APK**: estelle-v2.apk`n`n## Changes`n`n- See commit history for details"
    )

    if ($Draft) {
        $ghArgs += "--draft"
    }
    if ($Prerelease) {
        $ghArgs += "--prerelease"
    }

    & gh @ghArgs

    if ($LASTEXITCODE -eq 0) {
        Write-Host "`nRelease created successfully!" -ForegroundColor Green
        gh release view $Version --web
    } else {
        Write-Host "Release creation failed" -ForegroundColor Red
        exit 1
    }
} finally {
    Pop-Location
}
