@echo off
cd /d "%~dp0"
node server.js
if errorlevel 1 (
    echo.
    echo Could not start Midline. Ensure Node.js is installed and on PATH.
    pause
)
