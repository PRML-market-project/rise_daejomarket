@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0run-all.ps1" -KvCacheType q8_0
if errorlevel 1 pause
