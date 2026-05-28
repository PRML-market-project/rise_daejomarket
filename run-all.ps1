$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path

$services = @(
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

foreach ($service in $services) {
    $workdir = Join-Path $root $service.Path

    if (-not (Test-Path -LiteralPath $workdir)) {
        throw "Missing service directory: $workdir"
    }

    $title = "rise-daejomarket - $($service.Name)"
    $command = @"
`$Host.UI.RawUI.WindowTitle = "$title"
Write-Host "Starting $($service.Name)"
Write-Host "Working directory: $workdir"
Write-Host "URL: $($service.Url)"
Write-Host ""
$($service.Command)
"@

    Start-Process powershell.exe `
        -WorkingDirectory $workdir `
        -ArgumentList @("-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $command)

    Start-Sleep -Milliseconds 500
}

Write-Host "Started $($services.Count) services."
Write-Host "backend:        http://localhost:8080"
Write-Host "ai-server:      http://localhost:8000"
Write-Host "frontend:       http://localhost:5173"
Write-Host "admin-frontend: http://localhost:3000"
