$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$cloudflared = Get-Command cloudflared -ErrorAction SilentlyContinue
$tunnelLogDir = Join-Path $root ".cloudflared-logs"

function Start-NamedWindow {
    param(
        [string] $Name,
        [string] $WorkingDirectory,
        [string] $Command
    )

    $title = "rise-daejomarket - $Name"
    $windowCommand = @"
`$Host.UI.RawUI.WindowTitle = "$title"
Write-Host "Starting $Name"
Write-Host "Working directory: $WorkingDirectory"
Write-Host ""
$Command
"@

    Start-Process powershell.exe `
        -WorkingDirectory $WorkingDirectory `
        -ArgumentList @("-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $windowCommand)
}

function Start-CloudflareTunnel {
    param(
        [string] $Name,
        [string] $Url,
        [string] $LogPath
    )

    if (-not $cloudflared) {
        Write-Warning "cloudflared is not installed or not on PATH. $Name tunnel was not started."
        return
    }

    $cloudflaredPath = $cloudflared.Source
    $command = @"
& "$cloudflaredPath" tunnel --url "$Url" *>&1 | Tee-Object -FilePath "$LogPath"
"@

    Start-Process powershell.exe `
        -WindowStyle Hidden `
        -WorkingDirectory $root `
        -ArgumentList @("-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $command) `
        | Out-Null

    Write-Host "Cloudflare tunnel starting for ${Name}: $Url"
    Write-Host "Tunnel log: $LogPath"
}

function Start-ServiceWindow {
    param(
        [string] $Name,
        [string] $Path,
        [string] $Command
    )

    $workdir = Join-Path $root $Path

    if (-not (Test-Path -LiteralPath $workdir)) {
        throw "Missing service directory: $workdir"
    }

    Start-NamedWindow `
        -Name $Name `
        -WorkingDirectory $workdir `
        -Command $Command
}

function Wait-CloudflareUrl {
    param(
        [string] $LogPath,
        [int] $TimeoutSeconds = 45
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)

    while ((Get-Date) -lt $deadline) {
        if (Test-Path -LiteralPath $LogPath) {
            $content = Get-Content -LiteralPath $LogPath -Raw -ErrorAction SilentlyContinue
            $match = [regex]::Match($content, "https://[a-zA-Z0-9-]+\.trycloudflare\.com")

            if ($match.Success) {
                return $match.Value
            }
        }

        Start-Sleep -Milliseconds 500
    }

    return $null
}

New-Item -ItemType Directory -Force -Path $tunnelLogDir | Out-Null

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backendLog = Join-Path $tunnelLogDir "backend-$timestamp.log"
$aiServerLog = Join-Path $tunnelLogDir "ai-server-$timestamp.log"

$translationReady = $false
try {
    Invoke-WebRequest -Uri "http://127.0.0.1:17834/health" -UseBasicParsing -TimeoutSec 2 | Out-Null
    $translationReady = $true
} catch {}

if (-not $translationReady) {
    $translationRoot = Join-Path $root "ai-server\argos-translate-server"
    $translationPython = Join-Path $translationRoot ".venv\Scripts\python.exe"
    if (-not (Test-Path -LiteralPath $translationPython)) {
        throw "Argos translator is not installed. See ai-server/argos-translate-server/README.md."
    }
    Start-Process -FilePath $translationPython `
        -ArgumentList @("-X", "utf8", "server.py") `
        -WorkingDirectory $translationRoot `
        -WindowStyle Hidden `
        -RedirectStandardOutput (Join-Path $tunnelLogDir "argos-$timestamp.log") `
        -RedirectStandardError (Join-Path $tunnelLogDir "argos-$timestamp.error.log") | Out-Null

    $translationDeadline = (Get-Date).AddSeconds(180)
    while ((Get-Date) -lt $translationDeadline) {
        try {
            Invoke-WebRequest -Uri "http://127.0.0.1:17834/health" -UseBasicParsing -TimeoutSec 2 | Out-Null
            $translationReady = $true
            break
        } catch { Start-Sleep -Milliseconds 500 }
    }
    if (-not $translationReady) {
        throw "Argos translator did not become ready. Check $tunnelLogDir/argos-$timestamp.error.log."
    }
}

Start-ServiceWindow `
    -Name "backend" `
    -Path "backend" `
    -Command "& .\gradlew.bat bootRun"

Start-Sleep -Milliseconds 500

Start-ServiceWindow `
    -Name "ai-server" `
    -Path "ai-server" `
    -Command "& .\.venv\Scripts\python.exe .\code\app.py"

Start-Sleep -Milliseconds 500

Start-ServiceWindow `
    -Name "handwriting-server" `
    -Path "handwriting-server" `
    -Command "dotnet run --configuration Release"

Start-Sleep -Milliseconds 500

Start-ServiceWindow `
    -Name "frontend" `
    -Path "frontend\ml-test-main" `
    -Command "npm.cmd run dev"

Start-Sleep -Milliseconds 500

Start-ServiceWindow `
    -Name "admin-frontend" `
    -Path "admin-frontend" `
    -Command "npm.cmd run dev"

if ($cloudflared) {
    Start-CloudflareTunnel -Name "backend" -Url "http://localhost:8080" -LogPath $backendLog
    Start-CloudflareTunnel -Name "ai-server" -Url "http://localhost:8000" -LogPath $aiServerLog
}

Write-Host "Started server mode with 5 windows."
Write-Host "translation:    http://localhost:17834 (background)"
Write-Host "backend:        http://localhost:8080"
Write-Host "ai-server:      http://localhost:8000"
Write-Host "handwriting:    http://localhost:17832"
Write-Host "frontend:       http://localhost:5173"
Write-Host "admin-frontend: http://localhost:3000"

if ($cloudflared) {
    Write-Host ""
    Write-Host "Waiting for Cloudflare tunnel URLs..."

    $backendUrl = Wait-CloudflareUrl -LogPath $backendLog
    $aiServerUrl = Wait-CloudflareUrl -LogPath $aiServerLog

    Write-Host ""
    Write-Host "Cloudflare URLs for Vercel env"
    Write-Host "--------------------------------"

    if ($backendUrl) {
        Write-Host "backend: $backendUrl"
        Write-Host "VITE_API_URL=$backendUrl"
    } else {
        Write-Warning "Could not detect backend tunnel URL. Check $backendLog"
    }

    if ($aiServerUrl) {
        Write-Host "ai-server: $aiServerUrl"
        Write-Host "VITE_GPT_API_URL=$aiServerUrl"
    } else {
        Write-Warning "Could not detect ai-server tunnel URL. Check $aiServerLog"
    }
}
