$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$pidFile = Join-Path $root ".midline.pid"
$url = "http://127.0.0.1:5173"
$healthUrl = "$url/api/health"
$stopped = $false

function Test-MidlineReady {
    param([string]$HealthUrl)

    try {
        $response = Invoke-RestMethod -Uri $HealthUrl -Method Get -TimeoutSec 1
        return ($response.ok -eq $true -and $response.app -eq "Midline")
    } catch {
        return $false
    }
}

if (Test-Path $pidFile) {
    $pidText = (Get-Content $pidFile -ErrorAction SilentlyContinue | Select-Object -First 1)
    if ($pidText -and $pidText.Trim() -match "^\d+$") {
        $processId = [int]$pidText
        $proc = Get-Process -Id $processId -ErrorAction SilentlyContinue
        if ($proc -and $proc.ProcessName -ieq "node") {
            Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
            $stopped = $true
        }
    }

    Remove-Item -Path $pidFile -Force -ErrorAction SilentlyContinue
}

if (-not $stopped -and (Test-MidlineReady -HealthUrl $healthUrl)) {
    $netstatLines = netstat -ano -p tcp | Select-String -Pattern ":5173\s+.*LISTENING\s+\d+$"
    foreach ($line in $netstatLines) {
        $parts = $line.ToString().Trim() -split "\s+"
        if ($parts.Length -gt 0 -and $parts[-1] -match "^\d+$") {
            Stop-Process -Id ([int]$parts[-1]) -Force -ErrorAction SilentlyContinue
            $stopped = $true
        }
    }
}

if ($stopped) {
    Write-Host "Midline server stopped."
} else {
    Write-Host "No Midline server process found."
}
