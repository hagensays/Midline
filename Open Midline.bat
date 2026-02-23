@echo off
setlocal
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0open_midline.ps1"
if errorlevel 1 (
    echo.
    echo Failed to launch Midline.
    pause
)
endlocal
