# tinypool 프로세스들의 부모가 살아있는지 확인
$tinypool = Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object {
    $_.CommandLine -like '*tinypool*'
}

Write-Host "=== Tinypool processes: $($tinypool.Count) ==="
Write-Host ""

# 부모 PID별로 그룹핑
$byParent = $tinypool | Group-Object ParentProcessId | Sort-Object Count -Descending

foreach ($group in $byParent) {
    $parentPid = $group.Name
    $parentAlive = Get-Process -Id $parentPid -ErrorAction SilentlyContinue
    $status = if ($parentAlive) { "ALIVE ($($parentAlive.ProcessName))" } else { "DEAD (orphan)" }
    $created = ($group.Group | Select-Object -First 1).CreationDate
    Write-Host "Parent PID $parentPid [$status] - $($group.Count) workers - Created: $created"
}

Write-Host ""
Write-Host "=== Non-tinypool vitest/pnpm test processes ==="
$others = Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object {
    $_.CommandLine -like '*vitest*' -or ($_.CommandLine -like '*pnpm*' -and $_.CommandLine -like '*test*')
}
foreach ($p in $others) {
    $parentAlive = Get-Process -Id $p.ParentProcessId -ErrorAction SilentlyContinue
    $status = if ($parentAlive) { "parent alive" } else { "ORPHAN" }
    $cmd = $p.CommandLine
    if ($cmd.Length -gt 100) { $cmd = $cmd.Substring(0,100) + "..." }
    Write-Host "  PID $($p.ProcessId) [$status] Created: $($p.CreationDate) - $cmd"
}
