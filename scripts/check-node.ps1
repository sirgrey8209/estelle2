$procs = Get-CimInstance Win32_Process -Filter "Name='node.exe'"
$grouped = $procs | ForEach-Object {
    $cmd = $_.CommandLine
    if (-not $cmd) { $cmd = "(no commandline)" }
    # 짧게 요약
    if ($cmd.Length -gt 120) { $cmd = $cmd.Substring(0, 120) + "..." }
    $cmd
} | Group-Object | Sort-Object Count -Descending | Select-Object Count, Name

$grouped | Format-Table -AutoSize -Wrap
Write-Host "Total: $($procs.Count) node processes"
