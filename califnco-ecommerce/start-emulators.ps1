$ErrorActionPreference = "Stop"

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
    $previousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    $javaVersionOutput = (& java -version 2>&1 | Out-String)
    $ErrorActionPreference = $previousErrorActionPreference
    if ($javaVersionOutput -match 'version "1\.(\d+)') {
        $javaMajor = [int]$Matches[1]
    } elseif ($javaVersionOutput -match 'version "(\d+)') {
        $javaMajor = [int]$Matches[1]
    }
}
if ($javaMajor -lt 21) {
    Write-Error "Firebase Emulator Suite needs Java 21+. Install a JDK 21 or run npm run setup to install the portable JDK."
    exit 1
}
if (-not (Get-Command firebase -ErrorAction SilentlyContinue)) {
    Write-Error "Firebase CLI is missing. Run npm run setup or install it with: npm install --global firebase-tools@15.34.1"
    exit 1
}

firebase emulators:start --project demo-califnco --only auth,firestore,functions --import=./emulator-data --export-on-exit=./emulator-data
exit $LASTEXITCODE
