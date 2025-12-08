@echo off
echo ========================================
echo Quick Deploy - Fixed Caddyfile
echo ========================================
echo.

echo Copying updated Caddyfile to DITCHFLIX...
copy /Y "C:\Users\jucid\Desktop\ps5-fps-range\Caddyfile" "C:\Users\jucid\Documents\DITCHFLIX\caddy\Caddyfile"

if %ERRORLEVEL% EQU 0 (
    echo SUCCESS: Caddyfile copied!
    echo.
    echo Restarting Caddy...
    cd /d "C:\Users\jucid\Documents\DITCHFLIX"
    docker-compose restart caddy
    
    if %ERRORLEVEL% EQU 0 (
        echo.
        echo ========================================
        echo DONE! Try accessing:
        echo   https://fps.ditchworld.com
        echo ========================================
        echo.
    )
) else (
    echo ERROR: Failed to copy file
)

pause
