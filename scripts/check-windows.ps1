[CmdletBinding()]
param([switch] $Full)
$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
. (Join-Path $PSScriptRoot 'use-local-runtime.ps1')
$failures = 0
foreach ($relative in @('.runtime\python\python.exe', '.runtime\node\node.exe',
    '.runtime\java\bin\java.exe', '.runtime\dotnet\dotnet.exe', '.runtime\mysql\bin\mysqld.exe',
    'data\models\whisper-tiny\model.safetensors', 'deployment\database.sql',
    'ai-server\models\gemma-4-12b-it-UD-Q6_K_XL.gguf', 'ai-server\.llama-cpp\llama-server.exe',
    'ai-server\qwen-tts-server\runtime\tts-server.exe',
    'ai-server\qwen-tts-server\models\qwen-talker-0.6b-base-Q8_0.gguf',
    'ai-server\qwen-tts-server\models\qwen-tokenizer-12hz-Q8_0.gguf',
    'ai-server\qwen-tts-server\voices\friendly-female-reference.wav',
    'ai-server\qwen-tts-server\voices\friendly-female-reference.txt',
    'ai-server\argos-translate-server\data\packages')) {
    if (Test-Path -LiteralPath (Join-Path $root $relative)) { Write-Host "[OK] $relative" }
    else { Write-Host "[MISSING] $relative" -ForegroundColor Red; $failures++ }
}
if ($Full) {
    & (Join-Path $root '.runtime\python\python.exe') -X utf8 (Join-Path $PSScriptRoot 'portable.py') verify
    if ($LASTEXITCODE -ne 0) { $failures++ }
}
foreach ($folder in @('ai-server', 'ai-server\argos-translate-server')) {
    $python = Join-Path $root "$folder\.venv\Scripts\python.exe"
    if (Test-Path -LiteralPath $python) {
        & $python -X utf8 -c "import torch; print('Speech/translation torch:', torch.__version__, 'CUDA:', torch.version.cuda)"
        if ($LASTEXITCODE -ne 0) { $failures++ }
    } else { Write-Host "[SETUP REQUIRED] $folder virtual environment" }
}
try {
    & nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv,noheader
    if ($LASTEXITCODE -ne 0) { throw 'nvidia-smi failed' }
} catch { Write-Warning 'Install the current NVIDIA Windows 11 driver before starting Gemma/TTS.'; $failures++ }
foreach ($port in @(8080, 8000, 8010, 8020, 17832, 17834)) {
    $path = if ($port -eq 8080) { '/api/kiosk-experience' } else { '/health' }
    try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$port$path" -TimeoutSec 2
        Write-Host "[RUNNING] port $port - HTTP $($response.StatusCode)"
    } catch { Write-Host "[STOPPED] port $port" }
}
Write-Host 'Windows Settings > Time & language > Language & region > Korean > Language options > Handwriting.'
Write-Host 'After start.cmd, verify handwriting recognizers: http://127.0.0.1:17832/recognizers'
if ($failures) { throw "$failures checks failed. See the messages above." }
Write-Host 'File/tool checks passed.' -ForegroundColor Green
