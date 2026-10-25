@echo off
title Califnco Admin Desk (Port 3000)
echo Starting Califnco Operations & Dealer Admin Desk...
cd /d "%~dp0admin-panel"
if not exist "node_modules\.bin\vite.cmd" (
  echo Installing admin panel dependencies...
  call npm ci
  if errorlevel 1 (
    echo Dependency installation failed.
    pause
    exit /b 1
  )
)
npm run dev
if errorlevel 1 (
  echo Admin panel failed to start. Check Firebase setup in admin-panel\.env.local and the message above.
)
pause
