# Called by the local admin API. end.cmd and the admin button share stop-windows.ps1.
# A short-lived parent detaches this worker so the stop script can stop the backend's
# entire launch tree instead of treating it as the shutdown script's protected ancestry.
[CmdletBinding()]
param(
    [switch] $Worker,
    [int] $LaunchProcessId = 0
)

$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$stopScript = Join-Path $PSScriptRoot 'stop-windows.ps1'
if (-not (Test-Path -LiteralPath $stopScript -PathType Leaf)) { throw 'Shutdown script not found.' }

if (-not $Worker) {
    $logDir = Join-Path $root '.local-service-logs'
    New-Item -ItemType Directory -Force -Path $logDir | Out-Null
    $powershell = Join-Path $PSHOME 'powershell.exe'
    Start-Process -FilePath $powershell -WindowStyle Hidden -WorkingDirectory $root `
        -ArgumentList @('-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', "`"$PSCommandPath`"", '-Worker', '-LaunchProcessId', $PID) `
        -RedirectStandardOutput (Join-Path $logDir 'admin-shutdown.log') `
        -RedirectStandardError (Join-Path $logDir 'admin-shutdown.error.log') | Out-Null
    exit 0
}

if ($LaunchProcessId -le 0) { throw 'Shutdown launcher process is required.' }
$deadline = (Get-Date).AddSeconds(10)
while (Get-Process -Id $LaunchProcessId -ErrorAction SilentlyContinue) {
    if ((Get-Date) -ge $deadline) { throw 'Shutdown launcher did not exit.' }
    Start-Sleep -Milliseconds 100
}
# Allow the HTTP 202 response and the stopping screen to reach the browser first.
Start-Sleep -Seconds 2
& $stopScript
exit $LASTEXITCODE
