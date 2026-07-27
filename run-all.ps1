$ErrorActionPreference = "Stop"
$env:PYTHONIOENCODING = "utf-8"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$autoStopSeconds = if ($env:DEV_LOCAL_AUTO_STOP_SECONDS) {
    [int] $env:DEV_LOCAL_AUTO_STOP_SECONDS
} else {
    0
}

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

    return Start-Process powershell.exe `
        -WorkingDirectory $WorkingDirectory `
        -ArgumentList @("-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $windowCommand) `
        -PassThru
}

function Test-ServiceReady {
    param([string] $Url)

    try {
        Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2 | Out-Null
        return $true
    } catch {
        return $false
    }
}

function Wait-ServiceReady {
    param(
        [string] $Name,
        [string] $Url,
        [int] $TimeoutSeconds = 180
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        if (Test-ServiceReady -Url $Url) {
            Write-Host "$Name is ready: $Url"
            return
        }
        Start-Sleep -Milliseconds 500
    }

    throw "$Name did not become ready within $TimeoutSeconds seconds. Check its service window."
}

function Stop-ServiceTree {
    param(
        [string] $Name,
        [System.Diagnostics.Process] $Process
    )

    if (-not $Process -or $Process.HasExited) {
        return
    }

    Write-Host "Stopping $Name (PID $($Process.Id))..."
    & taskkill.exe /PID $Process.Id /T /F *> $null
}

$services = @(
    @{
        Name = "local-llm"
        Path = "ai-server"
        Command = "& .\.llama-cpp\llama-server.exe -m .\gemma-4-26B_q4_0-it.gguf --host 127.0.0.1 --port 8010 -ngl all -c 8192 -b 256 -ub 256 -t 12 --reasoning off --jinja --no-webui"
        Url = "http://localhost:8010"
        ReadyUrl = "http://127.0.0.1:8010/health"
    },
    @{
        Name = "qwen-tts"
        Path = "ai-server\qwen-tts-server"
        Command = "& .\qwentts.cpp\build\Release\tts-server.exe --model .\models\qwen-talker-0.6b-base-Q8_0.gguf --codec .\models\qwen-tokenizer-12hz-Q8_0.gguf --alias qwen3-tts-0.6b-base-q8 --host 127.0.0.1 --port 8020 --lang korean --no-fa --clamp-fp16"
        Url = "http://localhost:8020"
        ReadyUrl = "http://127.0.0.1:8020/health"
    },
    @{
        Name = "backend"
        Path = "backend"
        Command = "& .\gradlew.bat bootRun"
        Url = "http://localhost:8080"
    },
    @{
        Name = "ai-server"
        Path = "ai-server"
        Command = "& .\.venv\Scripts\python.exe .\code\app.py"
        Url = "http://localhost:8000"
        ReadyUrl = "http://127.0.0.1:8000/health"
    },
    @{
        Name = "frontend"
        Path = "frontend\ml-test-main"
        Command = "npm.cmd run dev"
        Url = "http://localhost:5173"
    },
    @{
        Name = "admin-frontend"
        Path = "admin-frontend"
        Command = "npm.cmd run dev"
        Url = "http://localhost:3000"
    }
)

$startedServices = @()

try {
    foreach ($service in $services) {
        $workdir = Join-Path $root $service.Path

        if (-not (Test-Path -LiteralPath $workdir)) {
            throw "Missing service directory: $workdir"
        }

        if ($service.ReadyUrl -and (Test-ServiceReady -Url $service.ReadyUrl)) {
            throw "$($service.Name) is already running at $($service.ReadyUrl). Stop it before starting dev:local."
        }

        $process = Start-NamedWindow `
            -Name $service.Name `
            -WorkingDirectory $workdir `
            -Command $service.Command

        $startedServices += [pscustomobject]@{
            Name = $service.Name
            Process = $process
        }

        if ($service.ReadyUrl) {
            Wait-ServiceReady `
                -Name $service.Name `
                -Url $service.ReadyUrl
        }

        Start-Sleep -Milliseconds 500
    }

    Write-Host ""
    Write-Host "All local services are running."
    Write-Host "local-llm:      http://localhost:8010"
    Write-Host "backend:        http://localhost:8080"
    Write-Host "ai-server:      http://localhost:8000"
    Write-Host "qwen-tts:       http://localhost:8020"
    Write-Host "frontend:       http://localhost:5173"
    Write-Host "admin-frontend: http://localhost:3000"
    Write-Host ""
    Write-Host "Press Ctrl+C to stop every service started by dev:local."

    $autoStopAt = if ($autoStopSeconds -gt 0) {
        Write-Host "Automatic test shutdown in $autoStopSeconds seconds."
        (Get-Date).AddSeconds($autoStopSeconds)
    } else {
        $null
    }

    while ($true) {
        Start-Sleep -Seconds 1
        if ($autoStopAt -and (Get-Date) -ge $autoStopAt) {
            break
        }
    }
} finally {
    Write-Host ""
    Write-Host "Stopping local services..."

    for ($i = $startedServices.Count - 1; $i -ge 0; $i--) {
        Stop-ServiceTree `
            -Name $startedServices[$i].Name `
            -Process $startedServices[$i].Process
    }

    Write-Host "All local services stopped."
}
