@echo off
echo Checking Caddy status and logs...
echo.

cd /d "C:\Users\jucid\Documents\DITCHFLIX"

echo ========================================
echo Current Caddy Status:
echo ========================================
docker-compose ps caddy
echo.

echo ========================================
echo Recent Caddy Logs:
echo ========================================
docker-compose logs --tail=30 caddy
echo.

pause
