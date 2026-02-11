# Check release folder timestamps
Write-Output "=== Release folder check ==="
$items = @(
    'C:\WorkSpace\estelle2\release\relay\public\index.html',
    'C:\WorkSpace\estelle2\release\pylon\dist\pylon.js',
    'C:\WorkSpace\estelle2\release\core'
)
foreach ($item in $items) {
    if (Test-Path $item) {
        $lastWrite = (Get-Item $item).LastWriteTime
        Write-Output "  $item -> $lastWrite"
    } else {
        Write-Output "  $item -> NOT FOUND"
    }
}

# Check build counter
Write-Output "`n=== Build counter ==="
if (Test-Path 'C:\WorkSpace\estelle2\config\build-counter.json') {
    Get-Content 'C:\WorkSpace\estelle2\config\build-counter.json' -Raw
} else {
    Write-Output "Not found"
}

# Check relay public assets
Write-Output "`n=== Relay assets ==="
Get-ChildItem 'C:\WorkSpace\estelle2\release\relay\public\assets\' -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Output "  $($_.Name) -> $($_.LastWriteTime)"
}

# PM2 list
Write-Output "`n=== PM2 status ==="
pm2 list 2>&1

# Check if any powershell build process is running
Write-Output "`n=== Running builds ==="
$procs = Get-Process powershell -ErrorAction SilentlyContinue
Write-Output "Total PowerShell processes: $($procs.Count)"
