@echo off
title OmanExplorer Server
color 0A
echo.
echo  ============================================
echo   OmanExplorer API - Starting...
echo  ============================================
echo.

cd /d "%~dp0"

:: Check if node is installed
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] Node.js not found. Please install it.
    pause
    exit /b 1
)

:: Check if .env exists
if not exist ".env" (
    echo  [ERROR] .env file not found!
    echo  Please copy .env.example to .env and fill in the values.
    pause
    exit /b 1
)

:: Check if node_modules exists
if not exist "node_modules" (
    echo  [INFO] Installing dependencies...
    npm install
)

echo  [OK] Starting server on http://localhost:3000
echo  [OK] Press Ctrl+C to stop
echo.

node src/app.js

pause
