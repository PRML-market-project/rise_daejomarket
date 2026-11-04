[CmdletBinding()]
param([switch] $Apply, [int] $KeepLogDays = 2)

$ErrorActionPreference = 'Stop'
$workspace = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$prefix = $workspace.TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
$targets = @('frontend/dist', 'frontend/node_modules/.vite', 'frontend/node_modules/.tmp', 'admin-frontend/.next/cache', 'ai-server/code/__pycache__', 'ai-server/tests/__pycache__', 'ai-server/argos-translate-server/__pycache__')
$cutoff = (Get-Date).AddDays([Math]::Max(1, $KeepLogDays) * -1)
foreach ($folder in @('.local-service-logs', 'ai-server')) {
    $path = Join-Path $workspace $folder
    if (Test-Path -LiteralPath $path) {
        $targets += Get-ChildItem -LiteralPath $path -File -Filter '*.log' | Where-Object { $_.LastWriteTime -lt $cutoff } | ForEach-Object { $_.FullName.Substring($prefix.Length) }
    }
}
foreach ($relative in $targets) {
    $path = [IO.Path]::GetFullPath((Join-Path $workspace $relative))
    if (-not $path.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) { throw "Outside workspace: $relative" }
    if (-not (Test-Path -LiteralPath $path)) { continue }
    $item = Get-Item -LiteralPath $path -Force
    $cursor = $item
    while ($cursor -and $cursor.FullName -ne $workspace) {
        if ($cursor.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Refusing linked target: $relative" }
        $cursor = if ($cursor.PSIsContainer) { $cursor.Parent } else { $cursor.Directory }
    }
    if ($item.PSIsContainer -and (Get-ChildItem -LiteralPath $path -Recurse -Force -Attributes ReparsePoint)) { throw "Refusing directory containing links: $relative" }
    if ($Apply) {
        try { Remove-Item -LiteralPath $path -Recurse -Force; Write-Output "Removed $relative" }
        catch { Write-Warning "Skipped locked target: $relative" }
    } else { Write-Output "Cleanup candidate: $relative" }
}
