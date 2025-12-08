@echo off
echo ========================================
echo   Fixing Network Profile (Public -> Private)
echo ========================================
echo.
echo Your network is currently set to "Public".
echo This blocks incoming connections (like your game server).
echo.
echo We need to change it to "Private".
echo.
echo ⚠️  You must run this as Administrator!
echo.
pause

powershell -Command "Set-NetConnectionProfile -InterfaceAlias 'Wi-Fi' -NetworkCategory Private"

if %errorlevel% == 0 (
    echo.
    echo ✅ SUCCESS: Network profile set to Private!
    echo.
    echo Your housemate should be able to connect now.
    echo.
) else (
    echo.
    echo ❌ FAILED: Could not change profile.
    echo.
    echo Make sure you:
    echo   1. Right-click this file
    echo   2. Select "Run as administrator"
    echo.
)

echo ========================================
pause
