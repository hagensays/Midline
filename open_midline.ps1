param(
    [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$url = "http://127.0.0.1:5173"
$healthUrl = "$url/api/health"
$pidFile = Join-Path $root ".midline.pid"
$serverScript = Join-Path $root "server.js"

function Test-MidlineReady {
    param([string]$HealthUrl)

    try {
        $response = Invoke-RestMethod -Uri $HealthUrl -Method Get -TimeoutSec 1
        return ($response.ok -eq $true -and $response.app -eq "Midline")
    } catch {
        return $false
    }
}

try {
    $ready = Test-MidlineReady -HealthUrl $healthUrl
    $process = $null

    if (-not $ready) {
        $process = Start-Process -FilePath "node" -ArgumentList @($serverScript) -WorkingDirectory $root -WindowStyle Hidden -PassThru
        Set-Content -Path $pidFile -Value $process.Id -Encoding ascii

        for ($i = 0; $i -lt 50; $i++) {
            Start-Sleep -Milliseconds 150

            if (Test-MidlineReady -HealthUrl $healthUrl) {
                $ready = $true
                break
            }

            if ($process.HasExited) {
                break
            }
        }
    }

    if (-not $ready -and $process -and $process.HasExited) {
        Remove-Item -Path $pidFile -ErrorAction SilentlyContinue
        throw "Server failed to start. Port 5173 may already be used by another app."
    }

    if (-not $NoBrowser) {
        Start-Process $url
    }
} catch {
    Write-Error $_
    exit 1
}
