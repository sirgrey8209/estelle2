# build-apk.ps1 - Android APK 빌드 스크립트
#
# 사용법: .\scripts\build-apk.ps1
# 결과: packages/client/android/app/build/outputs/apk/release/app-release.apk

param(
    [switch]$SkipBundle  # JS 번들 생성 스킵 (이미 있을 때)
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$ClientDir = Join-Path $RepoRoot "packages\client"
$AndroidDir = Join-Path $ClientDir "android"
$ApkOutput = Join-Path $AndroidDir "app\build\outputs\apk\release\app-release.apk"

Write-Host "=== Estelle APK Build ===" -ForegroundColor Cyan

# 0. 의존성 확인
Write-Host "`n[0/3] Checking dependencies..." -ForegroundColor Yellow
Push-Location $ClientDir
try {
    # @react-native-community/cli 확인
    $hasCli = pnpm list @react-native-community/cli 2>$null | Select-String "@react-native-community/cli"
    if (-not $hasCli) {
        Write-Host "Installing @react-native-community/cli..." -ForegroundColor Gray
        pnpm add -D @react-native-community/cli @react-native/metro-config
    }

    # react-native-vector-icons 확인
    $hasIcons = pnpm list react-native-vector-icons 2>$null | Select-String "react-native-vector-icons"
    if (-not $hasIcons) {
        Write-Host "Installing react-native-vector-icons..." -ForegroundColor Gray
        pnpm add react-native-vector-icons
    }
    Write-Host "Dependencies ready" -ForegroundColor Green
} finally {
    Pop-Location
}

# 1. JS 번들 생성
if (-not $SkipBundle) {
    Write-Host "`n[1/3] Creating JS bundle..." -ForegroundColor Yellow
    Push-Location $ClientDir
    try {
        # assets 폴더 생성
        $assetsDir = Join-Path $AndroidDir "app\src\main\assets"
        if (-not (Test-Path $assetsDir)) {
            New-Item -ItemType Directory -Path $assetsDir -Force | Out-Null
        }

        pnpm exec react-native bundle `
            --platform android `
            --dev false `
            --entry-file node_modules/expo-router/entry.js `
            --bundle-output "$assetsDir\index.android.bundle" `
            --assets-dest "$AndroidDir\app\src\main\res"

        if ($LASTEXITCODE -ne 0) {
            Write-Host "Bundle creation failed" -ForegroundColor Red
            exit 1
        }
        Write-Host "JS bundle created" -ForegroundColor Green
    } finally {
        Pop-Location
    }
} else {
    Write-Host "`n[1/3] Skipping bundle (--SkipBundle)" -ForegroundColor Gray
}

# 2. Gradle 빌드
Write-Host "`n[2/3] Building APK with Gradle..." -ForegroundColor Yellow
$gradlew = Join-Path $AndroidDir "gradlew.bat"

# 환경변수 설정
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"

& $gradlew -p $AndroidDir assembleRelease
if ($LASTEXITCODE -ne 0) {
    Write-Host "Gradle build failed" -ForegroundColor Red
    exit 1
}
Write-Host "APK built successfully" -ForegroundColor Green

# 3. 결과 확인
Write-Host "`n[3/3] Verifying output..." -ForegroundColor Yellow
if (Test-Path $ApkOutput) {
    $apkSize = (Get-Item $ApkOutput).Length / 1MB
    Write-Host "APK created: $ApkOutput" -ForegroundColor Green
    Write-Host "Size: $([math]::Round($apkSize, 1)) MB" -ForegroundColor Gray
} else {
    Write-Host "APK not found at expected location" -ForegroundColor Red
    exit 1
}

Write-Host "`n=== APK Build Complete ===" -ForegroundColor Cyan
