@echo off
REM Simple batch script to guide Caddy update
REM Double-click this file to run

echo ========================================
echo FPS Game - Caddy Fix (Simple Version)
echo ========================================
echo.

REM Check if files exist
if not exist "Caddyfile.new" (
    echo ERROR: Caddyfile.new not found!
    echo Make sure you run this from: C:\Users\jucid\Desktop\ps5-fps-range
    pause
    exit /b 1
)

echo Step 1: Opening Notepad with BOTH files...
echo.
echo LEFT WINDOW  = Your current Caddyfile
echo RIGHT WINDOW = New config to copy
echo.

start notepad.exe "C:\Users\jucid\Documents\DITCHFLIX\caddy\Caddyfile"
timeout /t 2 >nul
start notepad.exe "Caddyfile.new"

echo.
echo INSTRUCTIONS:
echo   1. Copy the content from the RIGHT window (Caddyfile.new)
echo   2. Find "fps.ditchworld.com" section in LEFT window
echo   3. Replace that section with the new content
echo   4. Save the LEFT window (Ctrl+S)
echo   5. Close both Notepad windows
echo.

pause

echo.
echo Step 2: Restarting Docker Caddy...
echo.

cd /d "C:\Users\jucid\Documents\DITCHFLIX"
docker-compose restart caddy

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo SUCCESS! Caddy has been restarted
    echo ========================================
    echo.
    echo TEST IT NOW:
    echo   1. Open: https://fps.ditchworld.com
    echo   2. Open second tab: https://fps.ditchworld.com
    echo   3. Both should show "ONLINE (2)"
    echo.
) else (
    echo.
    echo ERROR: Docker restart failed!
    echo Try manually: cd C:\Users\jucid\Documents\DITCHFLIX
    echo Then run: docker-compose restart caddy
    echo.
)

pause
