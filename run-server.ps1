$ErrorActionPreference = 'Stop'
& (Join-Path $PSScriptRoot 'run-all.ps1') -ExposeTunnels
