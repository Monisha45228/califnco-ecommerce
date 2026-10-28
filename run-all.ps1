# Califnco Water Technologies - All Services Launcher
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "      Califnco Water Technologies - Project Suite" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Starting Califnco Mobile App and Admin Panel..." -ForegroundColor Yellow

$mobilePath = Join-Path $PSScriptRoot "mobile-app"
$adminPath = Join-Path $PSScriptRoot "admin-panel"
$functionsPath = Join-Path $PSScriptRoot "functions"

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Error "Node.js and npm are required. Install the current Node.js LTS release, then run this script again."
    exit 1
}

if (-not (Get-Command firebase -ErrorAction SilentlyContinue)) {
    Write-Host "Installing Firebase CLI for emulator and deployment commands..." -ForegroundColor Yellow
    npm install --global firebase-tools@15.34.1
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Firebase CLI installation failed. Install it manually with: npm install --global firebase-tools@15.34.1"
        exit $LASTEXITCODE
    }
}

foreach ($appPath in @($PSScriptRoot, $mobilePath, $adminPath)) {
    if (-not (Test-Path (Join-Path $appPath "node_modules\.bin\vite.cmd"))) {
        $marker = if ($appPath -eq $PSScriptRoot) { "node_modules\.bin\firebase.cmd" } else { "node_modules\.bin\vite.cmd" }
        if (Test-Path (Join-Path $appPath $marker)) { continue }
        Write-Host "Installing dependencies in $appPath..." -ForegroundColor Yellow
        Push-Location $appPath
        npm ci
        $installExitCode = $LASTEXITCODE
        Pop-Location
        if ($installExitCode -ne 0) {
            Write-Error "Dependency installation failed in $appPath (exit code $installExitCode)."
            exit $installExitCode
        }
    }
}

$mobileEnv = Join-Path $mobilePath ".env.local"
$adminEnv = Join-Path $adminPath ".env.local"
$emulatorMode = $false
if ((Test-Path $mobileEnv) -and (Test-Path $adminEnv)) {
    $mobileUsesEmulators = Select-String -Path $mobileEnv -Pattern '^\s*VITE_USE_FIREBASE_EMULATORS\s*=\s*true\s*$' -Quiet
    $adminUsesEmulators = Select-String -Path $adminEnv -Pattern '^\s*VITE_USE_FIREBASE_EMULATORS\s*=\s*true\s*$' -Quiet
    if ($mobileUsesEmulators -ne $adminUsesEmulators) {
        Write-Error "Mobile and admin must use the same Firebase backend. Set VITE_USE_FIREBASE_EMULATORS identically in both .env.local files."
        exit 1
    }
    $emulatorMode = $mobileUsesEmulators

    $occupiedPorts = @()
    foreach ($port in @(3000, 3001)) {
        $listener = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($listener) {
            $occupiedPorts += "$port (PID $($listener.OwningProcess))"
        }
    }
    if ($occupiedPorts.Count -gt 0) {
        Write-Error "Califnco app ports are already in use: $($occupiedPorts -join ', '). Stop the other app instance, then run npm run dev again."
        exit 1
    }
}

if ($emulatorMode) {
    $portableJdkRoot = Join-Path $env:LOCALAPPDATA "Califnco\jdk-21"
    if (Test-Path $portableJdkRoot) {
        $portableJava = Get-ChildItem $portableJdkRoot -Filter java.exe -Recurse |
            Where-Object { $_.Directory.Name -eq "bin" } |
            Select-Object -First 1
        if ($portableJava) {
            $env:JAVA_HOME = $portableJava.Directory.Parent.FullName
            $env:PATH = "$env:JAVA_HOME\bin;$env:PATH"
        }
    }
    $javaCommand = Get-Command java -ErrorAction SilentlyContinue
    $javaMajor = 0
    if ($javaCommand) {
        $javaVersionOutput = (& java -version 2>&1 | Out-String)
        if ($javaVersionOutput -match 'version "1\.(\d+)') {
            $javaMajor = [int]$Matches[1]
        } elseif ($javaVersionOutput -match 'version "(\d+)') {
            $javaMajor = [int]$Matches[1]
        }
    }
    if ($javaMajor -lt 21) {
        Write-Error "Firebase Emulator Suite needs Java 21+. Detected Java $javaMajor. Install a JDK 21 (e.g. winget install --id EclipseAdoptium.Temurin.21.JDK) and reopen PowerShell."
        exit 1
    }
    if (-not (Test-Path (Join-Path $functionsPath "node_modules\firebase-admin"))) {
        Write-Host "Installing Cloud Functions dependencies..." -ForegroundColor Yellow
        Push-Location $functionsPath
        npm ci
        $installExitCode = $LASTEXITCODE
        Pop-Location
        if ($installExitCode -ne 0) {
            Write-Error "Cloud Functions dependency installation failed (exit code $installExitCode)."
            exit $installExitCode
        }
    }
    Start-Process -FilePath "powershell.exe" -WorkingDirectory $PSScriptRoot -ArgumentList @(
        "-NoExit", "-Command", "Write-Host '--- Califnco Firebase Emulator Suite ---' -ForegroundColor Magenta; npm run dev:emulators"
    )
    Write-Host "Firebase Emulator Suite is starting (first start may download emulator binaries)." -ForegroundColor Magenta

    $emulatorPorts = @(9099, 8080, 5001)
    $pendingPorts = @($emulatorPorts)
    $deadline = (Get-Date).AddSeconds(120)
    while ($pendingPorts.Count -gt 0 -and (Get-Date) -lt $deadline) {
        $pendingPorts = @($emulatorPorts | Where-Object {
            $client = [System.Net.Sockets.TcpClient]::new()
            try {
                $connection = $client.ConnectAsync("127.0.0.1", $_)
                $connection.Wait(300) -and $client.Connected
            } catch {
                $false
            } finally {
                $client.Dispose()
            }
        })
        if ($pendingPorts.Count -gt 0) {
            Start-Sleep -Seconds 1
        }
    }
    if ($pendingPorts.Count -gt 0) {
        Write-Error "Firebase emulators did not become ready on ports $($pendingPorts -join ', ') within 120 seconds. Check the emulator window, Java 21+, and firewall settings. The apps were not started."
        exit 1
    }
    Write-Host "Firebase Auth, Firestore, and Functions emulators are ready." -ForegroundColor Green
}

Start-Process -FilePath "powershell.exe" -WorkingDirectory $mobilePath -ArgumentList @(
    "-NoExit", "-Command", "Write-Host '--- Califnco Mobile App (Port 3001) ---' -ForegroundColor Green; npm run dev -- --host 127.0.0.1 --strictPort"
)

Start-Process -FilePath "powershell.exe" -WorkingDirectory $adminPath -ArgumentList @(
    "-NoExit", "-Command", "Write-Host '--- Califnco Admin Panel (Port 3000) ---' -ForegroundColor Cyan; npm run dev -- --host 127.0.0.1 --strictPort"
)

Write-Host "Both applications are launching in separate windows:" -ForegroundColor Green
Write-Host "  -> Mobile App:   http://localhost:3001" -ForegroundColor Yellow
Write-Host "  -> Admin Panel:  http://localhost:3000" -ForegroundColor Yellow
Write-Host ""
Write-Host "To test AI Instagram Daily Automation, run:" -ForegroundColor Cyan
Write-Host "  cd ai-automation; python instagram_daily_poster.py" -ForegroundColor White
Write-Host "==========================================================" -ForegroundColor Cyan
