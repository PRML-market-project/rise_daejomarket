$ErrorActionPreference = "Stop"
$env:PYTHONIOENCODING = "utf-8"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$logDir = Join-Path $root ".local-service-logs"
$runStamp = Get-Date -Format "yyyyMMdd-HHmmss"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$autoStopSeconds = if ($env:DEV_LOCAL_AUTO_STOP_SECONDS) {
    [int] $env:DEV_LOCAL_AUTO_STOP_SECONDS
} else {
    0
}

function Start-HiddenService {
    param(
        [string] $Name,
        [string] $WorkingDirectory,
        [string] $Command,
        [string] $LogPath,
        [string] $ErrorLogPath
    )

    return Start-Process powershell.exe `
        -WorkingDirectory $WorkingDirectory `
        -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", $Command) `
        -RedirectStandardOutput $LogPath `
        -RedirectStandardError $ErrorLogPath `
        -WindowStyle Hidden `
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
        [System.Diagnostics.Process] $Process,
        [string] $LogPath,
        [string] $ErrorLogPath,
        [int] $TimeoutSeconds = 180
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        if (Test-ServiceReady -Url $Url) {
            Write-Host "$Name is ready: $Url"
            return
        }
        if ($Process.HasExited) {
            break
        }
        Start-Sleep -Milliseconds 500
    }

    if (Test-Path -LiteralPath $LogPath) {
        Get-Content -LiteralPath $LogPath -Tail 25 | ForEach-Object { Write-Host $_ }
    }
    if (Test-Path -LiteralPath $ErrorLogPath) {
        Get-Content -LiteralPath $ErrorLogPath -Tail 25 | ForEach-Object { Write-Host $_ }
    }
    throw "$Name did not become ready. Check $LogPath and $ErrorLogPath."
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
        Name = "argos-translator"
        Path = "ai-server\argos-translate-server"
        Command = "& .\.venv\Scripts\python.exe -X utf8 .\server.py"
        Url = "http://localhost:17834"
        ReadyUrl = "http://127.0.0.1:17834/health"
    },
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
        ReadyUrl = "http://127.0.0.1:8080/api/kiosk-experience"
    },
    @{
        Name = "ai-server"
        Path = "ai-server"
        Command = "& .\.venv\Scripts\python.exe .\code\app.py"
        Url = "http://localhost:8000"
        ReadyUrl = "http://127.0.0.1:8000/health"
    },
    @{
        Name = "handwriting-server"
        Path = "handwriting-server"
        Command = "dotnet run --configuration Release"
        Url = "http://localhost:17832"
        ReadyUrl = "http://127.0.0.1:17832/health"
    },
    @{
        Name = "frontend"
        Path = "frontend\ml-test-main"
        Command = "npm.cmd run dev"
        Url = "http://localhost:5173"
        ReadyUrl = "http://localhost:5173"
    },
    @{
        Name = "admin-frontend"
        Path = "admin-frontend"
        Command = "npm.cmd run dev -- --port 3000"
        Url = "http://localhost:3000"
        ReadyUrl = "http://127.0.0.1:3000/login"
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
            Write-Host "$($service.Name) is already running: $($service.ReadyUrl) (reusing it)"
            continue
        }

        $logPath = Join-Path $logDir "$runStamp-$($service.Name).log"
        $errorLogPath = Join-Path $logDir "$runStamp-$($service.Name).error.log"
        Write-Host "Starting $($service.Name) in the background (log: $logPath)"
        $process = Start-HiddenService `
            -Name $service.Name `
            -WorkingDirectory $workdir `
            -Command $service.Command `
            -LogPath $logPath `
            -ErrorLogPath $errorLogPath

        $startedServices += [pscustomobject]@{
            Name = $service.Name
            Process = $process
        }

        if ($service.ReadyUrl) {
            Wait-ServiceReady `
                -Name $service.Name `
                -Url $service.ReadyUrl `
                -Process $process `
                -LogPath $logPath `
                -ErrorLogPath $errorLogPath
        }

        Start-Sleep -Milliseconds 500
    }

    Write-Host ""
    Write-Host "All local services are running."
    Write-Host "translation:    http://localhost:17834"
    Write-Host "local-llm:      http://localhost:8010"
    Write-Host "backend:        http://localhost:8080"
    Write-Host "ai-server:      http://localhost:8000"
    Write-Host "qwen-tts:       http://localhost:8020"
    Write-Host "handwriting:    http://localhost:17832"
    Write-Host "frontend:       http://localhost:5173"
    Write-Host "admin-frontend: http://localhost:3000"
    Write-Host "admin (shared frontend URL): http://localhost:5173/dashboard"
    Write-Host "Service logs:   $logDir"
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
