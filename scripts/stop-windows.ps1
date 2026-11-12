# Stops everything start.cmd / run-all.ps1 (npm run dev, dev:local, dev:server, dev:admin) started.
# Also cleans up services left behind when the start window was closed with X instead of Ctrl+C.
# Only processes that belong to this project are stopped; other programs on the same ports are left alone.
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..')).TrimEnd('\')
$rootKey = $root.ToLowerInvariant()

# translation, Gemma, TTS, backend, AI, handwriting, kiosk frontend, standalone admin
$ports = @(17834, 8010, 8020, 8080, 8000, 17832, 5173, 3000)
$dbPort = $null
$portableDbPath = Join-Path $root 'deployment\portable-db.json'
if (Test-Path -LiteralPath $portableDbPath) {
    $dbPort = [int] (Get-Content -LiteralPath $portableDbPath -Raw -Encoding UTF8 | ConvertFrom-Json).port
    $ports += $dbPort
}

function Get-ProcessTable {
    $table = @{}
    foreach ($process in Get-CimInstance Win32_Process) { $table[[int] $process.ProcessId] = $process }
    return $table
}

function Get-Listeners {
    @(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $ports -contains $_.LocalPort })
}

function Test-LaunchHost($process) {
    $name = $process.Name.ToLowerInvariant()
    return ($name -eq 'powershell.exe' -or $name -eq 'pwsh.exe') -and [string] $process.CommandLine -match '-File\s+"?[^"]*run-(all|server)\.ps1'
}

function Test-ProjectPath([string] $path) {
    return $path -and $path.ToLowerInvariant().Replace('/', '\').StartsWith($rootKey + '\')
}

function Test-InProject($process) {
    foreach ($text in @($process.ExecutablePath, $process.CommandLine)) {
        if ($text -and $text.ToLowerInvariant().Replace('/', '\').Contains($rootKey)) { return $true }
    }
    return $false
}

function Test-ProjectProcess($process) {
    if (Test-InProject $process) { return $true }
    $parent = $table[[int] $process.ParentProcessId]
    # A venv python.exe is a launcher: the listening interpreter lives outside the project, its parent inside.
    if ($parent -and (Test-ProjectPath $parent.ExecutablePath)) { return $true }
    # Otherwise only trust services that run-all.ps1 started through its hidden wrappers.
    $current = $process
    for ($depth = 0; $depth -lt 8; $depth++) {
        $parent = $table[[int] $current.ParentProcessId]
        if (-not $parent -or $protected.ContainsKey([int] $parent.ProcessId)) { return $false }
        if (Test-LaunchHost $parent) { return $true }
        if (-not (Test-ServiceWrapper $parent)) { return $false }
        $current = $parent
    }
    return $false
}

# Processes run-all.ps1 / npm / gradle / dotnet put between the start window and the actual service.
function Test-ServiceWrapper($process) {
    $name = $process.Name.ToLowerInvariant()
    $commandLine = [string] $process.CommandLine
    if ($name -eq 'powershell.exe' -or $name -eq 'pwsh.exe') { return $commandLine -match '-NoProfile -ExecutionPolicy Bypass -Command ' }
    if ($name -eq 'cmd.exe') { return $commandLine -match '\s/[cC]\s' -and $commandLine -notmatch '(start|end)\.cmd' }
    return @('node.exe', 'java.exe', 'javaw.exe', 'dotnet.exe') -contains $name
}

# Walks up to the start window (or the hidden wrapper) so one tree kill removes the whole service.
function Get-TopProcess($process) {
    $top = $process
    while ($true) {
        $parent = $table[[int] $top.ParentProcessId]
        if (-not $parent -or $protected.ContainsKey([int] $parent.ProcessId)) { return $top }
        if (Test-LaunchHost $parent) {
            $window = $table[[int] $parent.ParentProcessId]
            if ($window -and $window.Name -eq 'cmd.exe' -and [string] $window.CommandLine -match 'start\.cmd' -and -not $protected.ContainsKey([int] $window.ProcessId)) {
                return $window
            }
            return $parent
        }
        if (-not (Test-ServiceWrapper $parent)) { return $top }
        $top = $parent
    }
}

$table = Get-ProcessTable
# Never stop this script or the window/terminal that launched it.
$protected = @{}
$current = $PID
while ($current -and $table.ContainsKey($current) -and -not $protected.ContainsKey($current)) {
    $protected[$current] = $true
    $current = [int] $table[$current].ParentProcessId
}

# Shut the portable MySQL down cleanly before anything is force-stopped.
if ($dbPort -and (Get-NetTCPConnection -State Listen -LocalPort $dbPort -ErrorAction SilentlyContinue)) {
    $python = Join-Path $root '.runtime\python\python.exe'
    if (Test-Path -LiteralPath $python) {
        Write-Host "Stopping MySQL (port $dbPort)..."
        & $python -X utf8 (Join-Path $root 'scripts\portable.py') stop-db
        $deadline = (Get-Date).AddSeconds(15)
        while ((Get-Date) -lt $deadline -and (Get-NetTCPConnection -State Listen -LocalPort $dbPort -ErrorAction SilentlyContinue)) {
            Start-Sleep -Milliseconds 500
        }
        $table = Get-ProcessTable
    }
}

# Plain hashtable plus an order list: an [ordered] dictionary treats integer keys as positions.
$targets = @{}
$targetOrder = New-Object System.Collections.Generic.List[int]
function Add-Target($process, [string] $label) {
    $id = [int] $process.ProcessId
    if ($protected.ContainsKey($id)) { return }
    if ($targets.ContainsKey($id)) { $targets[$id] = "$($targets[$id]), $label" } else { $targets[$id] = "$($process.Name) ($label)"; $targetOrder.Add($id) }
}

# Start windows whose script path points at this project (start.cmd, run-all.ps1 with a full path).
foreach ($process in $table.Values) {
    if ((Test-LaunchHost $process) -and (Test-InProject $process)) { Add-Target (Get-TopProcess $process) 'start window' }
}

foreach ($listener in Get-Listeners) {
    $process = $table[[int] $listener.OwningProcess]
    if (-not $process -or $protected.ContainsKey([int] $process.ProcessId)) { continue }
    if (-not (Test-ProjectProcess $process)) {
        Write-Warning "Port $($listener.LocalPort) is used by $($process.Name) (PID $($process.ProcessId)) outside this project. Leaving it running."
        continue
    }
    Add-Target (Get-TopProcess $process) "port $($listener.LocalPort)"
}

# Cloudflare quick tunnels opened by npm run dev:server.
foreach ($process in $table.Values) {
    if ($process.Name -eq 'cloudflared.exe' -and [string] $process.CommandLine -match 'tunnel\s+--url\s+http://localhost:(8080|8000)\b') {
        Add-Target (Get-TopProcess $process) 'Cloudflare tunnel'
    }
}

if ($targets.Count -eq 0) {
    Write-Host 'No running kiosk services found.'
    exit 0
}

foreach ($id in $targetOrder) {
    Write-Host "Stopping $($targets[$id]) [PID $id]..."
    $previousPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        $output = & taskkill.exe /PID $id /T /F 2>&1
        # 128: the process already exited together with an earlier tree.
        if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne 128) { Write-Warning "Could not stop PID ${id}: $output" }
    } finally {
        $ErrorActionPreference = $previousPreference
    }
}

$deadline = (Get-Date).AddSeconds(10)
do {
    $table = Get-ProcessTable
    $remaining = @(Get-Listeners | Where-Object { $process = $table[[int] $_.OwningProcess]; $process -and (Test-ProjectProcess $process) })
    if ($remaining.Count -eq 0) { break }
    Start-Sleep -Milliseconds 500
} while ((Get-Date) -lt $deadline)

if ($remaining.Count -gt 0) {
    foreach ($listener in $remaining) { Write-Warning "Port $($listener.LocalPort) is still in use (PID $($listener.OwningProcess))." }
    exit 1
}
Write-Host 'All kiosk services stopped.'
