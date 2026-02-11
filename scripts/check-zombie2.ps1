# vitest 프로세스들의 부모 체인 추적
$vitests = Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object {
    $_.CommandLine -like '*vitest*run*'
}

Write-Host "=== Vitest 'run' processes: $($vitests.Count) ==="
Write-Host ""

foreach ($v in $vitests | Sort-Object CreationDate) {
    $cmd = $v.CommandLine
    if ($cmd.Length -gt 80) { $cmd = $cmd.Substring(0,80) + "..." }

    Write-Host "PID $($v.ProcessId) | Parent $($v.ParentProcessId) | Created: $($v.CreationDate)"
    Write-Host "  CMD: $cmd"

    # 부모 체인 추적 (3단계)
    $pid = $v.ParentProcessId
    for ($i = 0; $i -lt 3; $i++) {
        $parent = Get-CimInstance Win32_Process -Filter "ProcessId=$pid" -ErrorAction SilentlyContinue
        if (-not $parent) {
            Write-Host "  Parent[$i]: PID $pid - DEAD"
            break
        }
        $pcmd = $parent.CommandLine
        if ($pcmd -and $pcmd.Length -gt 80) { $pcmd = $pcmd.Substring(0,80) + "..." }
        Write-Host "  Parent[$i]: PID $pid ($($parent.Name)) - $pcmd"
        $pid = $parent.ParentProcessId
    }
    Write-Host ""
}
