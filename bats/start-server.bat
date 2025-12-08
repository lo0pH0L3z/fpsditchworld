@echo off
setlocal enabledelayedexpansion

REM Ensure we run from the project root (script lives in bats\)
pushd "%~dp0.."

echo ========================================
echo   PS5 FPS Range - Multiplayer Server
echo ========================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js is not installed!
    echo.
    echo Please install Node.js from: https://nodejs.org/
    echo After installation, restart this script.
    echo.
    pause
    exit /b 1
)

echo Node.js version:
node --version
echo.

REM Check if npm is installed
where npm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: npm is not installed!
    echo Please reinstall Node.js from: https://nodejs.org/
    pause
    exit /b 1
)

REM Check if node_modules exists
if not exist "node_modules" (
    echo Installing dependencies...
    echo.
    npm install
    echo.
    if %ERRORLEVEL% NEQ 0 (
        echo.
        echo ERROR: Failed to install dependencies!
        pause
        exit /b 1
    )
    echo Dependencies installed successfully!
    echo.
)

echo Starting multiplayer server...
echo.
echo Server will start on: http://localhost:3000
echo.
echo Open your browser to: http://localhost:3000
echo To test multiplayer, open multiple browser tabs.
echo.
echo Press Ctrl+C to stop the server.
echo ========================================
echo.

npm start

popd
endlocal
