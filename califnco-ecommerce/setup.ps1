$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

function Invoke-NpmCi {
    param([string]$Path, [string]$Label)
    if (-not (Test-Path (Join-Path $Path "package-lock.json"))) {
        throw "Missing package-lock.json for $Label at $Path."
    }
    Write-Host "Installing $Label dependencies..." -ForegroundColor Cyan
    Push-Location $Path
    npm ci
    $result = $LASTEXITCODE
    Pop-Location
    if ($result -ne 0) {
        throw "npm ci failed for $Label (exit code $result)."
    }
}

function Install-FirebaseCli {
    if (Get-Command firebase -ErrorAction SilentlyContinue) {
        Write-Host "Firebase CLI found." -ForegroundColor Green
        return
    }
    Write-Host "Installing Firebase CLI globally for emulator and deploy commands..." -ForegroundColor Cyan
    npm install --global firebase-tools@15.34.1
    if ($LASTEXITCODE -ne 0) {
        throw "Firebase CLI installation failed. Install it manually with: npm install --global firebase-tools@15.34.1"
    }
}

if (-not (Get-Command node -ErrorAction SilentlyContinue) -or -not (Get-Command npm -ErrorAction SilentlyContinue)) {
    throw "Install Node.js 20.19+ (LTS recommended) from https://nodejs.org/ and reopen PowerShell."
}

$nodeVersionText = node -p "process.versions.node"
$nodeVersion = [version]$nodeVersionText
if ($nodeVersion -lt [version]"20.19.0") {
    throw "Node.js 20.19+ is required. Detected $nodeVersionText."
}

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

$javaMajor = 0
if (Get-Command java -ErrorAction SilentlyContinue) {
    $javaVersionOutput = (& java -version 2>&1 | Out-String)
    if ($javaVersionOutput -match 'version "1\.(\d+)') {
        $javaMajor = [int]$Matches[1]
    } elseif ($javaVersionOutput -match 'version "(\d+)') {
        $javaMajor = [int]$Matches[1]
    }
}
foreach ($app in @("mobile-app", "admin-panel")) {
    $envPath = Join-Path $root "$app\.env.local"
    if (-not (Test-Path $envPath)) {
        Copy-Item (Join-Path $root "$app\.env.example") $envPath
        Write-Host "Created $app\.env.local from the example (local emulator mode)." -ForegroundColor Green
    } else {
        Write-Host "Keeping existing $app\.env.local." -ForegroundColor Yellow
    }
}

$mobileUsesEmulators = Select-String -Path (Join-Path $root "mobile-app\.env.local") -Pattern '^\s*VITE_USE_FIREBASE_EMULATORS\s*=\s*true\s*$' -Quiet
$adminUsesEmulators = Select-String -Path (Join-Path $root "admin-panel\.env.local") -Pattern '^\s*VITE_USE_FIREBASE_EMULATORS\s*=\s*true\s*$' -Quiet
if ($mobileUsesEmulators -ne $adminUsesEmulators) {
    throw "Set VITE_USE_FIREBASE_EMULATORS identically in both app .env.local files."
}
if ($mobileUsesEmulators -and $javaMajor -lt 21) {
    throw "The local Firebase Emulator Suite needs Java 21+. Install it with 'winget install --id EclipseAdoptium.Temurin.21.JDK', reopen PowerShell, and run npm run setup again."
}

Invoke-NpmCi -Path $root -Label "repository"
Invoke-NpmCi -Path (Join-Path $root "mobile-app") -Label "mobile app"
Invoke-NpmCi -Path (Join-Path $root "admin-panel") -Label "admin panel"
Invoke-NpmCi -Path (Join-Path $root "functions") -Label "Cloud Functions"
Install-FirebaseCli

Write-Host ""
Write-Host "Setup complete." -ForegroundColor Green
Write-Host "Start both apps and Firebase emulators with: npm run dev" -ForegroundColor White
Write-Host "Then seed a local admin using the steps in README.md and open http://localhost:3000." -ForegroundColor White
Write-Host "For production Firebase, set VITE_USE_FIREBASE_EMULATORS=false in both .env.local files and enter your project values." -ForegroundColor Yellow
