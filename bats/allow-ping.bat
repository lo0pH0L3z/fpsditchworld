@echo off
echo ========================================
echo   Allowing Ping (ICMP) Through Firewall
echo ========================================
echo.
echo Windows blocks "Ping" requests by default.
echo We need to allow them to test if your router is blocking connections.
echo.
echo ⚠️  You must run this as Administrator!
echo.
pause

netsh advfirewall firewall add rule name="Allow ICMPv4-In" protocol=icmpv4:8,any dir=in action=allow

if %errorlevel% == 0 (
    echo.
    echo ✅ SUCCESS: Ping allowed!
    echo.
    echo Now ask your housemate to run:
    echo    ping 192.168.4.50
    echo.
) else (
    echo.
    echo ❌ FAILED: Could not add rule.
    echo.
    echo Make sure you:
    echo   1. Right-click this file
    echo   2. Select "Run as administrator"
    echo.
)

echo ========================================
pause
