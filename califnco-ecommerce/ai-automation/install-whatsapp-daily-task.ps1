param(
    [ValidatePattern('^\d{2}:\d{2}$')]
    [string]$Time = '09:00'
)

$ErrorActionPreference = 'Stop'
$runner = Join-Path $PSScriptRoot 'run-whatsapp-daily.ps1'
if (-not (Test-Path $runner)) {
    throw "Daily runner not found: $runner"
}

$timeParts = $Time.Split(':')
if ([int]$timeParts[0] -gt 23 -or [int]$timeParts[1] -gt 59) {
    throw 'Time must use a valid 24-hour HH:mm value.'
}
$at = (Get-Date).Date.AddHours([int]$timeParts[0]).AddMinutes([int]$timeParts[1])

$powershell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$action = New-ScheduledTaskAction -Execute $powershell -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$runner`""
$trigger = New-ScheduledTaskTrigger -Daily -At $at
$userId = if ($env:USERDOMAIN) { "$env:USERDOMAIN\$env:USERNAME" } else { $env:USERNAME }
$principal = New-ScheduledTaskPrincipal -UserId $userId -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 20)

Register-ScheduledTask `
    -TaskName 'Califnco WhatsApp Daily Status' `
    -Action $action `
    -Trigger $trigger `
    -Principal $principal `
    -Settings $settings `
    -Description 'Publishes the daily Firestore product to WhatsApp Status using the local WAHA Docker session.' `
    -Force | Out-Null

Write-Output "Installed the daily WhatsApp Status task for $Time local time. Windows must be running and this user must be signed in."
