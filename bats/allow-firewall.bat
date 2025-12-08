@echo off
echo ========================================
echo   Allowing PS5 FPS Server Through Firewall
echo ========================================
echo.
echo This will add a firewall rule to allow
echo incoming connections on port 3000.
echo.
echo You must run this as Administrator!
echo.
pause

netsh advancedfirewall firewall add rule name=PS5-FPS-Server dir=in action=allow protocol=TCP localport=3000

if %errorlevel% == 0 (
    echo.
    echo SUCCESS: Firewall rule added!
    echo.
    echo Port 3000 is now open for connections.
    echo Your housemate should be able to connect now.
    echo.
) else (
    echo.
    echo FAILED: Could not add firewall rule.
    echo.
    echo Try opening Windows Defender Firewall manually:
    echo   1. Press Win + R
    echo   2. Type: wf.msc
    echo   3. Click "Inbound Rules" on left
    echo   4. Click "New Rule..." on right
    echo   5. Select "Port" - Next
    echo   6. Type: 3000 - Next - Next - Next
    echo   7. Name: PS5 FPS Server - Finish
    echo.
)

echo ========================================
pause
