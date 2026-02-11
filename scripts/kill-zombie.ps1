# tinypool 좀비 프로세스 정리
$tinypool = Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object {
    $_.CommandLine -like '*tinypool*'
}
Write-Host "Tinypool workers: $($tinypool.Count)"
foreach ($p in $tinypool) {
    Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
}

# 좀비 vitest 프로세스 정리 (현재 실행 중인 건 없으니 전부 제거)
$vitest = Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object {
    $_.CommandLine -like '*vitest*run*'
}
Write-Host "Zombie vitest: $($vitest.Count)"
foreach ($p in $vitest) {
    Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
}

# 좀비 pnpm test 프로세스 정리
$pnpmTest = Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object {
    ($_.CommandLine -like '*pnpm*' -and $_.CommandLine -like '*test*') -or
    ($_.CommandLine -like '*npx*' -and $_.CommandLine -like '*vitest*')
}
Write-Host "Zombie pnpm test/npx vitest: $($pnpmTest.Count)"
foreach ($p in $pnpmTest) {
    Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
}

Start-Sleep -Seconds 1

# 결과 확인
$remaining = (Get-Process node -ErrorAction SilentlyContinue).Count
Write-Host ""
Write-Host "Done. Remaining node processes: $remaining"
