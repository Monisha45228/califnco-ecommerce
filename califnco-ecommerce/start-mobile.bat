@echo off
title Califnco Mobile App (Port 3001)
echo Starting Califnco Cross-Platform Mobile App...
cd /d "%~dp0mobile-app"
if not exist "node_modules\.bin\vite.cmd" (
  echo Installing mobile app dependencies...
  call npm ci
  if errorlevel 1 (
    echo Dependency installation failed.
    pause
    exit /b 1
  )
)
npm run dev
if errorlevel 1 (
  echo Mobile app failed to start. Check Firebase setup in mobile-app\.env.local and the message above.
)
pause
