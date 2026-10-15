[CmdletBinding()]
param(
    [switch] $Apply,
    [switch] $IncludeUnusedModels,
    [int] $KeepLogDays = 2
)

$ErrorActionPreference = 'Stop'
$workspace = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$workspacePrefix = $workspace.TrimEnd('\') + '\'
$targets = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)

function Add-CleanupTarget([string] $RelativePath) {
    $absolute = [IO.Path]::GetFullPath((Join-Path $workspace $RelativePath))
    if (-not $absolute.StartsWith($workspacePrefix, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Cleanup target is outside the workspace: $RelativePath"
    }
    if (-not (Test-Path -LiteralPath $absolute)) { return }
    $cursor = Get-Item -LiteralPath $absolute -Force
    while ($cursor -and $cursor.FullName -ne $workspace) {
        if ($cursor.Attributes -band [IO.FileAttributes]::ReparsePoint) {
            throw "Cleanup will not follow links: $RelativePath"
        }
        $cursor = if ($cursor.PSIsContainer) { $cursor.Parent } else { $cursor.Directory }
    }
    if ((Get-Item -LiteralPath $absolute -Force).PSIsContainer) {
        $links = Get-ChildItem -LiteralPath $absolute -Recurse -Force -Attributes ReparsePoint
        if ($links) { throw "Cleanup directory contains links: $RelativePath" }
    }
    [void] $targets.Add($absolute)
}

# Regenerable output only; native model runtimes under build/ remain intact.
foreach ($relative in @(
    'frontend/ml-test-main/dist',
    'frontend/ml-test-main/.vite',
    'admin-frontend/.next/cache',
    'backend/build/libs',
    'output_custom_voice_ko.wav'
)) { Add-CleanupTarget $relative }

foreach ($relative in @('artifacts', 'artifacts/tts-analysis')) {
    $folder = Join-Path $workspace $relative
    if (Test-Path -LiteralPath $folder) {
        Get-ChildItem -LiteralPath $folder -File -Force |
            Where-Object { $_.Extension -in @('.wav', '.png', '.jpg', '.jpeg', '.gif') } |
            ForEach-Object { Add-CleanupTarget $_.FullName.Substring($workspacePrefix.Length) }
    }
}

# Installed Argos models are used at runtime; only their downloaded installers expire.
$argosData = Join-Path $workspace 'ai-server/argos-translate-server/data'
if ((Test-Path -LiteralPath (Join-Path $argosData 'packages/ko_en/model/model.bin')) -and
    (Test-Path -LiteralPath (Join-Path $argosData 'packages/translate-en_vi-1_9/model/model.bin'))) {
    $downloads = Join-Path $argosData 'cache/argos-translate/downloads'
    if (Test-Path -LiteralPath $downloads) {
        Get-ChildItem -LiteralPath $downloads -File -Filter '*.argosmodel' |
            ForEach-Object { Add-CleanupTarget $_.FullName.Substring($workspacePrefix.Length) }
    }
}

if ($IncludeUnusedModels) {
    $launcher = Get-Content -LiteralPath (Join-Path $workspace 'run-all.ps1') -Raw
    foreach ($name in @(
        'qwen3-tts-12hz-0.6b-customvoice-q8_0.gguf',
        'qwen-talker-0.6b-base-Q4_K_M.gguf',
        'qwen-tokenizer-12hz-Q4_K_M.gguf'
    )) {
        if ($launcher.Contains($name)) { throw "Model is now used by the launcher: $name" }
        Add-CleanupTarget "ai-server/qwen-tts-server/models/$name"
    }
}

$cutoff = (Get-Date).AddDays(-[Math]::Max(1, $KeepLogDays))
foreach ($relative in @('.', 'ai-server', 'ai-server/code', 'ai-server/qwen-tts-server',
    '.local-service-logs', '.cloudflared-logs', 'artifacts', 'artifacts/tts-analysis')) {
    $folder = Join-Path $workspace $relative
    if (Test-Path -LiteralPath $folder) {
        Get-ChildItem -LiteralPath $folder -File -Filter '*.log' -Force |
            Where-Object { $_.LastWriteTime -lt $cutoff } |
            ForEach-Object { Add-CleanupTarget $_.FullName.Substring($workspacePrefix.Length) }
    }
}

foreach ($relative in @('__pycache__', 'ai-server/code/__pycache__',
    'ai-server/argos-translate-server/__pycache__', 'ai-server/qwen-tts-server/__pycache__')) {
    Add-CleanupTarget $relative
}

$reclaimed = 0L
$deleted = 0
$skipped = 0
foreach ($absolute in ($targets | Sort-Object)) {
    $relative = $absolute.Substring($workspacePrefix.Length)
    $item = Get-Item -LiteralPath $absolute -Force
    $bytes = if ($item.PSIsContainer) {
        (Get-ChildItem -LiteralPath $absolute -Recurse -File -Force |
            Measure-Object -Property Length -Sum).Sum
    } else { $item.Length }
    if (-not $Apply) {
        Write-Output ("{0,9:N2} MiB  {1}" -f ($bytes / 1MB), $relative)
        $reclaimed += $bytes
        continue
    }
    try {
        # All resolved paths and their ancestors were checked before deletion.
        Remove-Item -LiteralPath $absolute -Recurse -Force -ErrorAction Stop
        $reclaimed += $bytes
        $deleted++
    } catch {
        $skipped++
        Write-Warning "Skipped locked or unavailable target: $relative"
    }
}
Write-Output ("{0}: {1:N2} MiB; targets={2}; deleted={3}; skipped={4}" -f
    $(if ($Apply) { 'Removed' } else { 'Dry run' }), ($reclaimed / 1MB), $targets.Count, $deleted, $skipped)
