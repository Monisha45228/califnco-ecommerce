$ErrorActionPreference = 'Stop'

$envFile = Join-Path $PSScriptRoot '.env'
$composeFile = Join-Path $PSScriptRoot 'docker-compose.yml'
if (-not (Test-Path $envFile)) {
    throw "Missing $envFile. Copy .env.example to .env and configure WAHA_API_KEY and WAHA_DASHBOARD_PASSWORD."
}
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw 'Docker is not installed or not on PATH. Install Docker Desktop, start it, and retry.'
}

& docker compose --env-file $envFile -f $composeFile up -d
if ($LASTEXITCODE -ne 0) {
    throw "Docker Compose failed to start WAHA (exit code $LASTEXITCODE)."
}

Write-Output 'WAHA is running at http://127.0.0.1:3008/dashboard. Link the secondary WhatsApp number in the WAHA dashboard.'
