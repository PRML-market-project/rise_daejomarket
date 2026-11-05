[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$target = Join-Path $root 'transfer-ready'
$python = Join-Path $root 'ai-server\.venv\Scripts\python.exe'
& $python -X utf8 (Join-Path $PSScriptRoot 'portable.py') manifest
if ($LASTEXITCODE -ne 0) { throw 'Cannot create transfer integrity manifest.' }
# Copy only application folders; never copy repository metadata, virtualenvs,
# live MySQL files, local credentials for the generated portable instance, or caches.
foreach ($folder in @('frontend', 'admin-frontend', 'backend', 'ai-server',
                      'handwriting-server', 'scripts', '.runtime', 'data', 'deployment')) {
    $source = Join-Path $root $folder
    $destination = Join-Path $target $folder
    $excluded = @((Join-Path $root 'data\mysql'), (Join-Path $root '.runtime\gradle-cache'),
        (Join-Path $root '.runtime\nuget-packages'), (Join-Path $root '.runtime\pip-cache'),
        (Join-Path $root '.runtime\npm-cache'), (Join-Path $root '.runtime\dotnet-home'),
        (Join-Path $root '.runtime\smoke-venv'))
    if ($folder -ne '.runtime') {
        $excluded += @('node_modules', '.venv', '.gradle', '.next', '__pycache__', 'build', 'dist')
    }
    & robocopy.exe $source $destination /E /COPY:DAT /DCOPY:DAT /R:1 /W:1 /NFL /NDL /NJH /NJS /NP `
        /XD $excluded `
        /XF *.log *.jsonl *.pyc *.tsbuildinfo dump.rdb 'ubuntu@*' portable-db.json mysql.ini *.pending.sql validation-target.txt 'validate-*.ps1' database-restored.json
    if ($LASTEXITCODE -ge 8) { throw "Transfer copy failed: $folder (robocopy $LASTEXITCODE)" }
}
foreach ($file in @('README.md', 'package.json', 'run-all.ps1', 'run-server.ps1',
                    'setup.cmd', 'start.cmd', 'check.cmd', '.gitignore')) {
    Copy-Item -LiteralPath (Join-Path $root $file) -Destination (Join-Path $target $file) -Force
}
Write-Host "Transfer package ready: $target" -ForegroundColor Green
Write-Host 'Copy this folder to C:\daejo on the new PC, then double-click setup.cmd.'
