@echo off
setlocal
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0stop_midline.ps1"
if errorlevel 1 (
    echo.
    echo Could not stop Midline cleanly.
    pause
)
endlocal
