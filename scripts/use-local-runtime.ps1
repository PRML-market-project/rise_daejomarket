$workspaceRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$localRuntime = Join-Path $workspaceRoot '.runtime'
foreach ($entry in @('node', 'java\bin', 'dotnet', 'python', 'mysql\bin')) {
    $localPath = Join-Path $localRuntime $entry
    if (Test-Path -LiteralPath $localPath) { $env:PATH = $localPath + ';' + $env:PATH }
}
if (Test-Path -LiteralPath (Join-Path $localRuntime 'java\bin\java.exe')) {
    $env:JAVA_HOME = Join-Path $localRuntime 'java'
}
if (Test-Path -LiteralPath (Join-Path $localRuntime 'dotnet\dotnet.exe')) {
    $env:DOTNET_ROOT = Join-Path $localRuntime 'dotnet'
}
$env:GRADLE_USER_HOME = Join-Path $localRuntime 'gradle-cache'
$env:NUGET_PACKAGES = Join-Path $localRuntime 'nuget-packages'
$env:DOTNET_CLI_HOME = Join-Path $localRuntime 'dotnet-home'
$env:DOTNET_CLI_TELEMETRY_OPTOUT = '1'
$env:PYTHONUTF8 = '1'
$env:PYTHONIOENCODING = 'utf-8'
$env:PIP_CACHE_DIR = Join-Path $localRuntime 'pip-cache'
$env:npm_config_cache = Join-Path $localRuntime 'npm-cache'
$uploadDirectory = (Join-Path $workspaceRoot 'data\uploads').Replace('\', '/') + '/'
$env:SPRING_APPLICATION_JSON = (@{
    file = @{ 'upload-dir' = $uploadDirectory; 'resource-url' = '/images/**' }
} | ConvertTo-Json -Compress -Depth 3)
$portableDbPath = Join-Path $workspaceRoot 'deployment\portable-db.json'
if (Test-Path -LiteralPath $portableDbPath) {
    $portableDb = Get-Content -LiteralPath $portableDbPath -Raw -Encoding UTF8 | ConvertFrom-Json
    $env:SPRING_DATASOURCE_URL = "jdbc:mysql://127.0.0.1:$($portableDb.port)/prml_market_db?serverTimezone=Asia/Seoul&characterEncoding=UTF-8"
    $env:SPRING_DATASOURCE_USERNAME = $portableDb.user
    $env:SPRING_DATASOURCE_PASSWORD = $portableDb.password
}
