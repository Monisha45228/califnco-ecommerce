$ErrorActionPreference = 'Stop'

$automationDir = $PSScriptRoot
& (Join-Path $automationDir 'start-whatsapp-waha.ps1')
if ($LASTEXITCODE -ne 0) {
    throw "Could not start WAHA (exit code $LASTEXITCODE)."
}

Push-Location $automationDir
try {
    & python (Join-Path $automationDir 'whatsapp_daily_poster.py')
    if ($LASTEXITCODE -ne 0) {
        throw "WhatsApp daily publishing failed (exit code $LASTEXITCODE). See the task's Last Run Result and Firestore post record."
    }
} finally {
    Pop-Location
}
