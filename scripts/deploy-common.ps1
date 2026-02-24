# deploy-common.ps1 - 배포 스크립트 공통 함수
#
# 사용법:
#   . .\scripts\deploy-common.ps1

# ============================================================
# Logging Helpers
# ============================================================

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
# File System Helpers
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

# ============================================================
# Path Helpers
# ============================================================

function Expand-TildePath {
    param([string]$Path)
    if ($Path -and $Path.StartsWith("~/")) {
        return Join-Path $env:USERPROFILE $Path.Substring(2)
    } elseif ($Path -eq "~") {
        return $env:USERPROFILE
    }
    return $Path
}

function ConvertTo-JsString {
    param([string]$Path)
    # JavaScript 문자열에서 백슬래시 이스케이프 (\ → \\)
    return $Path -replace '\\', '\\'
}

# ============================================================
# Config Generators
# ============================================================

function New-EcosystemConfig {
    param(
        [Parameter(Mandatory)]
        [object]$PylonConfig,
        [int]$EnvId = 0,
        [string]$DataDir = ""
    )

    $pm2Name = $PylonConfig.pm2Name

    # configDir: ~ 경로 확장
    $configDir = Expand-TildePath $PylonConfig.configDir

    # credentialsBackupDir: ~ 경로 확장
    $credentialsBackupDir = Expand-TildePath $PylonConfig.credentialsBackupDir

    # dataDir: 절대 경로로 변환 (상대 경로인 경우 현재 디렉토리 기준)
    $dataDirResolved = if ($DataDir) {
        if ([System.IO.Path]::IsPathRooted($DataDir)) { $DataDir }
        else { Join-Path (Get-Location) $DataDir }
    } else { "" }

    # ESTELLE_ENV_CONFIG JSON 구성
    $envConfigObj = @{
        envId = $EnvId
        pylon = @{
            deviceId = $PylonConfig.deviceId
            relayUrl = $PylonConfig.relayUrl
            configDir = $configDir
            credentialsBackupDir = $credentialsBackupDir
            dataDir = $dataDirResolved
            mcpPort = $PylonConfig.mcpPort
            defaultWorkingDir = $PylonConfig.defaultWorkingDir
        }
    }

    # JSON 문자열 생성
    # ConvertTo-Json은 이미 백슬래시를 \\ 로 이스케이프함
    # NOTE: 파이프라인 대신 직접 호출 방식 사용 (버퍼링 이슈 방지)
    $envConfigJson = ConvertTo-Json -InputObject $envConfigObj -Depth 10 -Compress

    # JavaScript 문자열 안에 넣기 위해 이스케이프
    # 순서 중요: 백슬래시 먼저, 따옴표 나중에
    # 1. \\ → \\\\ (JS 문자열에서 \\ 유지를 위해)
    # 2. " → \" (JS 문자열 종료 방지)
    # NOTE: PowerShell -replace 체이닝 이슈로 별도 라인 처리
    $envConfigJsonEscaped = $envConfigJson.Replace('\', '\\').Replace('"', '\"')

    # 문자열 연결 방식 (큰따옴표 사용으로 변수 확장)
    $content = "module.exports = {`n"
    $content += "  apps: [`n"
    $content += "    {`n"
    $content += "      name: `"$pm2Name`",`n"
    $content += "      script: `"dist/bin.js`",`n"
    $content += "      cwd: __dirname,`n"
    $content += "      watch: false,`n"
    $content += "      autorestart: true,`n"
    $content += "      max_restarts: 10,`n"
    $content += "      restart_delay: 5000,`n"
    $content += "      env: {`n"
    $content += "        NODE_ENV: `"production`",`n"
    $content += "        ESTELLE_ENV_CONFIG: `"$($envConfigJsonEscaped)`"`n"
    $content += "      },`n"
    $content += "      log_date_format: `"YYYY-MM-DD HH:mm:ss`",`n"
    $content += "      error_file: `"./logs/pm2-error.log`",`n"
    $content += "      out_file: `"./logs/pm2-out.log`",`n"
    $content += "      merge_logs: true`n"
    $content += "    }`n"
    $content += "  ]`n"
    $content += "};"

    return $content
}

function New-Dockerfile {
    param(
        [Parameter(Mandatory)]
        [int]$EnvId
    )

    return @"
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
ENV ENV_ID=$EnvId
EXPOSE 8080

CMD ["node", "dist/bin.js"]
"@
}

function New-FlyToml {
    param(
        [Parameter(Mandatory)]
        [string]$FlyApp
    )

    return @"
app = "$FlyApp"
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
}

# ============================================================
# Fly.io Deploy
# ============================================================

function Deploy-FlyRelay {
    param(
        [Parameter(Mandatory)]
        [string]$FlyExe,
        [Parameter(Mandatory)]
        [string]$WorkingDir,
        [Parameter(Mandatory)]
        [string]$FlyApp
    )

    Write-Detail "Build context: $WorkingDir"
    Write-Detail "Running: fly deploy --config relay/fly.toml --dockerfile relay/Dockerfile --remote-only"

    $flyArgs = "deploy --config relay/fly.toml --dockerfile relay/Dockerfile --remote-only"
    $outLog = Join-Path $WorkingDir "fly-out.log"
    $errLog = Join-Path $WorkingDir "fly-err.log"

    $flyProc = Start-Process -FilePath $FlyExe -ArgumentList $flyArgs -WorkingDirectory $WorkingDir -NoNewWindow -Wait -PassThru -RedirectStandardOutput $outLog -RedirectStandardError $errLog

    # 출력 표시
    if (Test-Path $outLog) {
        Get-Content $outLog | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
    }

    if ($flyProc.ExitCode -ne 0) {
        if (Test-Path $errLog) {
            Get-Content $errLog | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
        }
        throw "Fly.io deploy failed for $FlyApp (exit code: $($flyProc.ExitCode))"
    }

    # 임시 로그 정리
    Remove-Item $outLog, $errLog -ErrorAction SilentlyContinue
}

# ============================================================
# PM2 Helpers
# ============================================================

function Stop-PylonPM2 {
    param(
        [Parameter(Mandatory)]
        [string]$PM2Name
    )

    try { pm2 delete $PM2Name 2>&1 | Out-Null } catch { }
    Write-Ok "PM2 $PM2Name stopped"
}

function Start-PylonPM2 {
    param(
        [Parameter(Mandatory)]
        [string]$PM2Name,
        [Parameter(Mandatory)]
        [string]$PylonDir
    )

    $pylonConfig = Join-Path $PylonDir "ecosystem.config.cjs"

    Write-Detail "Starting $PM2Name..."
    & pm2 start $pylonConfig --cwd $PylonDir
    if ($LASTEXITCODE -ne 0) {
        throw "PM2 start failed (exit code: $LASTEXITCODE)"
    }
    try { pm2 save 2>&1 | Out-Null } catch { }

    # PM2에 주입된 ESTELLE_ENV_CONFIG 출력
    Write-Detail "PM2 env for $PM2Name`:"
    $envOutput = node -e "const cp=require('child_process');const j=JSON.parse(cp.execSync('pm2 jlist',{encoding:'utf8'}));const p=j.find(x=>x.name==='$PM2Name');if(p){const e=p.pm2_env?.env||{};if(e.ESTELLE_ENV_CONFIG){try{const c=JSON.parse(e.ESTELLE_ENV_CONFIG);console.log('envId='+c.envId);console.log('relayUrl='+c.pylon?.relayUrl);console.log('configDir='+c.pylon?.configDir);console.log('dataDir='+c.pylon?.dataDir);console.log('mcpPort='+c.pylon?.mcpPort);}catch(e){console.log('ESTELLE_ENV_CONFIG: (parse error)');}}else{console.log('ESTELLE_ENV_CONFIG: (not set)');}}" 2>$null
    if ($envOutput) {
        $envOutput -split "`n" | ForEach-Object { Write-Detail "  $_" }
    }

    # Health check: wait for Relay connection (max 15 seconds)
    Write-Detail "Waiting for Relay connection (max 15s)..."
    $connected = $false
    for ($i = 0; $i -lt 5; $i++) {
        Start-Sleep -Seconds 3
        $pylonLog = pm2 logs $PM2Name --lines 30 --nostream 2>&1 | Out-String
        if ($pylonLog -match "Connected to Relay") {
            $connected = $true
            break
        }
        Write-Detail "  Attempt $($i + 1)/5..."
    }

    if ($connected) {
        Write-Ok "$PM2Name connected to Relay"
    } else {
        Write-Host "  Warning: $PM2Name did not confirm Relay connection within 15s" -ForegroundColor Yellow
        Write-Host "  Check: pm2 logs $PM2Name" -ForegroundColor Gray
    }

    pm2 status
}

# ============================================================
# Junction Helpers
# ============================================================

function New-DataJunctions {
    param(
        [Parameter(Mandatory)]
        [string]$PylonDir,
        [Parameter(Mandatory)]
        [string]$DataDir
    )

    Write-Detail "Creating data junction -> $DataDir\data..."
    $dataTarget = Join-Path $DataDir "data"
    $dataLink = Join-Path $PylonDir "data"
    cmd /c mklink /J $dataLink $dataTarget 2>&1 | Out-Null
    if (-not (Test-Path $dataLink)) {
        throw "Failed to create data junction: $dataLink -> $dataTarget"
    }

    Write-Detail "Creating uploads junction -> $DataDir\uploads..."
    $uploadsTarget = Join-Path $DataDir "uploads"
    $uploadsLink = Join-Path $PylonDir "uploads"
    cmd /c mklink /J $uploadsLink $uploadsTarget 2>&1 | Out-Null
    if (-not (Test-Path $uploadsLink)) {
        throw "Failed to create uploads junction: $uploadsLink -> $uploadsTarget"
    }
}

function Test-DataJunctions {
    param(
        [Parameter(Mandatory)]
        [string]$PylonDir
    )

    $allOk = $true

    $dataLink = Join-Path $PylonDir "data"
    $dataItem = Get-Item $dataLink -Force
    if (-not ($dataItem.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
        Write-Host "  INVALID: pylon/data is not a junction" -ForegroundColor Red
        $allOk = $false
    } else {
        Write-Detail "pylon/data -> junction OK"
    }

    $uploadsLink = Join-Path $PylonDir "uploads"
    $uploadsItem = Get-Item $uploadsLink -Force
    if (-not ($uploadsItem.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
        Write-Host "  INVALID: pylon/uploads is not a junction" -ForegroundColor Red
        $allOk = $false
    } else {
        Write-Detail "pylon/uploads -> junction OK"
    }

    return $allOk
}

# ============================================================
# Fly CLI Finder
# ============================================================

function Find-FlyExe {
    $flyExe = Join-Path $env:USERPROFILE ".fly\bin\fly.exe"
    if (-not (Test-Path $flyExe)) {
        throw "Fly CLI not found at $flyExe"
    }
    Write-Detail "fly: $flyExe"
    return $flyExe
}
