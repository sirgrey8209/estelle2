# deploy-relay.ps1 - Relay fly deploy (v2)
#
# 사용법: .\scripts\deploy-relay.ps1
# 결과: JSON { success, message }

param(
    [string]$RepoDir = (Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path))
)

$ErrorActionPreference = "Continue"
$FlyExe = Join-Path $env:USERPROFILE ".fly\bin\fly.exe"
$RelayDir = Join-Path $RepoDir "packages\relay"

try {
    Push-Location $RelayDir

    # fly deploy 실행
    $process = Start-Process -FilePath $FlyExe -ArgumentList "deploy" -Wait -PassThru -NoNewWindow

    if ($process.ExitCode -eq 0) {
        @{
            success = $true
            message = "Relay v2 deployed"
        } | ConvertTo-Json
    } else {
        @{
            success = $false
            message = "Fly deploy failed with exit code $($process.ExitCode)"
        } | ConvertTo-Json
        exit 1
    }

} catch {
    @{
        success = $false
        message = $_.Exception.Message
    } | ConvertTo-Json
    exit 1
} finally {
    Pop-Location
}
