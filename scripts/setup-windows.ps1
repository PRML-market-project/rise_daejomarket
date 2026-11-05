[CmdletBinding()]
param([switch] $SkipBuild, [switch] $SkipVerify)
$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
Set-Location -LiteralPath $root
if ($root -match '[^\x00-\x7F]') {
    throw 'Copy transfer-ready to a short English path such as C:\daejo, then run setup.cmd there. MySQL requires an ASCII path.'
}
. (Join-Path $PSScriptRoot 'use-local-runtime.ps1')
$python = Join-Path $root '.runtime\python\python.exe'
$helper = Join-Path $PSScriptRoot 'portable.py'
function Invoke-Checked {
    param([string] $Program, [string[]] $Arguments)
    & $Program @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Failed: $Program (exit $LASTEXITCODE)" }
}
foreach ($relative in @('.runtime\python\python.exe', '.runtime\node\npm.cmd',
    '.runtime\java\bin\java.exe', '.runtime\dotnet\dotnet.exe',
    '.runtime\mysql\bin\mysqld.exe', 'deployment\database.sql',
    'deployment\database-counts.json', 'deployment\manifest.json',
    'data\models\whisper-tiny\model.safetensors', 'backend\src\main\resources\application.yml')) {
    if (-not (Test-Path -LiteralPath (Join-Path $root $relative))) {
        throw "Missing transfer file: $relative. Copy the complete transfer-ready folder."
    }
}
Write-Host 'Preparing Windows x64 installation. Internet is required for dependency downloads.'
if (-not $SkipVerify) { Invoke-Checked $python @('-X', 'utf8', $helper, 'verify') }

# MySQL/llama.cpp need Microsoft's native runtime on a fresh Windows installation.
$vcLibrary = "$env:WINDIR\System32\msvcp140.dll"
$needsNativeRuntime = -not (Test-Path -LiteralPath $vcLibrary)
if (-not $needsNativeRuntime) {
    $vcVersion = (Get-Item -LiteralPath $vcLibrary).VersionInfo
    $needsNativeRuntime = ($vcVersion.FileMajorPart -lt 14 -or
        ($vcVersion.FileMajorPart -eq 14 -and $vcVersion.FileMinorPart -lt 44))
}
if ($needsNativeRuntime) {
    $installer = Join-Path $root '.runtime\vc_redist.x64.exe'
    if (-not (Test-Path -LiteralPath $installer)) {
        Invoke-WebRequest -UseBasicParsing 'https://aka.ms/vs/17/release/vc_redist.x64.exe' -OutFile $installer
    }
    $signature = Get-AuthenticodeSignature -LiteralPath $installer
    if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch 'Microsoft') {
        throw 'The Visual C++ runtime installer signature could not be verified.'
    }
    $installed = Start-Process -FilePath $installer -ArgumentList '/install', '/quiet', '/norestart' -Verb RunAs -Wait -PassThru
    if ($installed.ExitCode -notin @(0, 1638, 3010)) { throw 'Visual C++ runtime installation failed.' }
}

foreach ($folder in @('ai-server', 'ai-server\argos-translate-server')) {
    $venv = [IO.Path]::GetFullPath((Join-Path $root "$folder\.venv"))
    if (-not $venv.StartsWith($root + '\', [StringComparison]::OrdinalIgnoreCase)) {
        throw "Virtual environment outside workspace: $venv"
    }
    # Recreate scripts/config for this machine without deleting any project files.
    Invoke-Checked $python @('-m', 'venv', $venv)
    $venvPython = Join-Path $venv 'Scripts\python.exe'
    Invoke-Checked $venvPython @('-m', 'pip', 'install', '--upgrade', 'pip')
    # Whisper and Argos stay on CPU; GPU memory is reserved for Gemma and TTS.
    $cpuPackages = @('torch==2.7.0')
    if ($folder -eq 'ai-server') { $cpuPackages += 'torchaudio==2.7.0' }
    Invoke-Checked $venvPython (@('-m', 'pip', 'install') + $cpuPackages + @('--index-url', 'https://download.pytorch.org/whl/cpu'))
    $lockName = if ($folder -eq 'ai-server') { 'requirements-ai.lock.txt' } else { 'requirements-argos.lock.txt' }
    $requirements = Join-Path $root "deployment\$lockName"
    if (-not (Test-Path -LiteralPath $requirements)) { $requirements = Join-Path $root "$folder\requirements.txt" }
    Invoke-Checked $venvPython @('-m', 'pip', 'install', '-r', $requirements)
}
foreach ($folder in @('frontend', 'admin-frontend')) {
    Invoke-Checked 'npm.cmd' @('--prefix', (Join-Path $root $folder), 'ci')
}
# Do not carry tunnel addresses to the new local installation.
$frontendEnv = Join-Path $root 'frontend\.env.local'
[IO.File]::WriteAllText($frontendEnv, "VITE_API_URL=http://localhost:8080`nVITE_GPT_API_URL=http://localhost:8000`nVITE_ADMIN_URL=`n")
[IO.File]::WriteAllText((Join-Path $root 'admin-frontend\.env.local'), "NEXT_PUBLIC_API_URL=http://localhost:8080`n")

Invoke-Checked $python @('-X', 'utf8', $helper, 'configure-db')
. (Join-Path $PSScriptRoot 'use-local-runtime.ps1')
$db = Get-Content -LiteralPath (Join-Path $root 'deployment\portable-db.json') -Raw | ConvertFrom-Json
function Test-DbPort {
    $client = New-Object Net.Sockets.TcpClient
    try { $task = $client.ConnectAsync('127.0.0.1', [int] $db.port); return ($task.Wait(500) -and $client.Connected) }
    catch { return $false }
    finally { $client.Dispose() }
}
$dbProcess = $null
try {
    if (-not (Test-DbPort)) {
        $ini = Join-Path $root 'deployment\mysql.ini'
        $dbProcess = Start-Process -FilePath (Join-Path $root '.runtime\mysql\bin\mysqld.exe') `
            -ArgumentList @("--defaults-file=`"$ini`"", '--console') -WorkingDirectory $root `
            -WindowStyle Hidden -PassThru `
            -RedirectStandardOutput (Join-Path $root 'deployment\mysql-setup.log') `
            -RedirectStandardError (Join-Path $root 'deployment\mysql-setup.error.log')
        $deadline = (Get-Date).AddSeconds(90)
        while (-not (Test-DbPort)) {
            if ($dbProcess.HasExited -or (Get-Date) -gt $deadline) {
                throw 'Portable MySQL failed to start. See deployment/mysql-setup.error.log.'
            }
            Start-Sleep -Milliseconds 500
        }
    }
    Invoke-Checked $python @('-X', 'utf8', $helper, 'restore-db')
    if (-not $SkipBuild) {
        Push-Location (Join-Path $root 'backend')
        try { Invoke-Checked '.\gradlew.bat' @('--no-daemon', 'classes') } finally { Pop-Location }
        Push-Location (Join-Path $root 'handwriting-server')
        try { Invoke-Checked 'dotnet' @('build', '--configuration', 'Release') } finally { Pop-Location }
    }
} finally {
    if ($dbProcess -and -not $dbProcess.HasExited) {
        & $python -X utf8 $helper stop-db
        if (-not $dbProcess.WaitForExit(15000)) { Stop-Process -Id $dbProcess.Id -Force }
    }
}
Invoke-Checked (Join-Path $root 'ai-server\.venv\Scripts\python.exe') @('-X', 'utf8', '-m', 'unittest', 'discover', '-s', 'ai-server/tests')
Invoke-Checked (Join-Path $root 'ai-server\argos-translate-server\.venv\Scripts\python.exe') @('-X', 'utf8', (Join-Path $root 'ai-server\argos-translate-server\offline_smoke.py'))
Write-Host ''
Write-Host 'Setup complete. Double-click start.cmd, then open http://localhost:5173.' -ForegroundColor Green
Write-Host 'Install/update the NVIDIA driver and Windows Korean handwriting support if check.cmd reports them missing.'
