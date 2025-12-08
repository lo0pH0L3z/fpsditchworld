@echo off
setlocal enabledelayedexpansion
echo ========================================
echo   PS5 FPS Range - Connection Info
echo ========================================
echo.

REM Get WiFi adapter IP (prioritize this)
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /C:"Wireless LAN adapter Wi-Fi" /A:2 ^| findstr "IPv4"') do (
    set IP=%%a
    goto :foundwifi
)

:foundwifi
REM Trim spaces
for /f "tokens=* delims= " %%a in ("%IP%") do set IP=%%a

REM Check if we got a valid IP (not 169.254.x.x)
echo %IP% | findstr /b "169.254" >nul
if errorlevel 1 (
    goto :display
) else (
    goto :nowifi
)

:nowifi
REM Try Ethernet instead
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /C:"Ethernet adapter Ethernet" /A:2 ^| findstr "IPv4"') do (
    set IP=%%a
    goto :foundeth
)

:foundeth
for /f "tokens=* delims= " %%a in ("%IP%") do set IP=%%a

:display
echo ✅ NETWORK: Connected
echo 🌐 YOUR IP: %IP%
echo.
echo ┌─────────────────────────────────────────┐
echo │  CONNECTION URLS                        │
echo ├─────────────────────────────────────────┤
echo │                                         │
echo │  On THIS computer:                      │
echo │    http://localhost:3000                │
echo │                                         │
echo │  On OTHER computers (same WiFi):        │
echo │    http://%IP%:3000                     │
echo │                                         │
echo └─────────────────────────────────────────┘
echo.
echo 📋 SHARE THIS WITH YOUR HOUSEMATE:
echo.
echo    http://%IP%:3000
echo.
echo ========================================
echo.
echo ⚠️  If connection fails, check:
echo    1. Windows Firewall (run as Admin):
echo       netsh advancedfirewall firewall add rule name="PS5 FPS" dir=in action=allow protocol=TCP localport=3000
echo.
echo    2. Make sure housemate is on SAME WiFi
echo.
echo    3. Server is running (start-server.bat)
echo.
echo ========================================
echo.
pause
