# PowerShell script to update Caddy configuration and restart service
# Run this RIGHT-CLICK → "Run with PowerShell" or from an existing PowerShell window

# DON'T CLOSE ON ERROR
$ErrorActionPreference = "Continue"

try {
    Write-Host "🔧 FPS Game - Caddy Reverse Proxy Fix" -ForegroundColor Cyan
    Write-Host "=====================================" -ForegroundColor Cyan
    Write-Host ""

    $caddyfileSrc = "C:\Users\jucid\Desktop\ps5-fps-range\Caddyfile.new"
    $caddyfileDest = "C:\Users\jucid\Documents\DITCHFLIX\caddy\Caddyfile"
    $dockerComposePath = "C:\Users\jucid\Documents\DITCHFLIX"

    # Check if source file exists
    if (-not (Test-Path $caddyfileSrc)) {
        Write-Host "❌ Error: Caddyfile.new not found!" -ForegroundColor Red
        Write-Host "   Expected at: $caddyfileSrc" -ForegroundColor Yellow
        Write-Host ""
        Read-Host "Press Enter to exit"
        exit 1
    }

    # Check if destination file exists
    if (-not (Test-Path $caddyfileDest)) {
        Write-Host "❌ Error: Destination Caddyfile not found!" -ForegroundColor Red
        Write-Host "   Expected at: $caddyfileDest" -ForegroundColor Yellow
        Write-Host ""
        Read-Host "Press Enter to exit"
        exit 1
    }

    # Show what we'll do
    Write-Host "📋 Plan:" -ForegroundColor Yellow
    Write-Host "   1. Backup existing Caddyfile" -ForegroundColor White
    Write-Host "   2. Show you the new config to add" -ForegroundColor White
    Write-Host "   3. You manually edit the file" -ForegroundColor White
    Write-Host "   4. Restart Caddy via Docker" -ForegroundColor White
    Write-Host ""

    # Backup existing Caddyfile
    Write-Host "📦 Creating backup..." -ForegroundColor Yellow
    $backupPath = "$caddyfileDest.backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    Copy-Item $caddyfileDest $backupPath
    Write-Host "✅ Backup created: $backupPath" -ForegroundColor Green
    Write-Host ""

    # Show the new configuration
    Write-Host "📝 NEW CONFIGURATION TO ADD:" -ForegroundColor Cyan
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
    Get-Content $caddyfileSrc | Write-Host -ForegroundColor White
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
    Write-Host ""

    Write-Host "📂 Opening Caddyfile in Notepad for you..." -ForegroundColor Yellow
    Start-Process notepad.exe $caddyfileDest
    Write-Host ""

    Write-Host "⚠️  INSTRUCTIONS:" -ForegroundColor Yellow
    Write-Host "   1. Find the 'fps.ditchworld.com' section" -ForegroundColor White
    Write-Host "   2. Replace it with the config shown above" -ForegroundColor White
    Write-Host "   3. Save and close Notepad" -ForegroundColor White
    Write-Host ""

    Read-Host "Press Enter AFTER you've saved the Caddyfile"

    # Restart Docker Compose
    Write-Host ""
    Write-Host "🔄 Restarting Caddy container..." -ForegroundColor Yellow
    
    if (-not (Test-Path $dockerComposePath)) {
        Write-Host "❌ Docker compose path not found: $dockerComposePath" -ForegroundColor Red
        Write-Host ""
        Read-Host "Press Enter to exit"
        exit 1
    }

    Set-Location $dockerComposePath
    
    # Check if docker-compose exists
    $dockerCmd = Get-Command docker-compose -ErrorAction SilentlyContinue
    if (-not $dockerCmd) {
        Write-Host "❌ docker-compose command not found!" -ForegroundColor Red
        Write-Host "   Please manually run: docker-compose restart caddy" -ForegroundColor Yellow
        Write-Host "   From directory: $dockerComposePath" -ForegroundColor Yellow
        Write-Host ""
        Read-Host "Press Enter to exit"
        exit 1
    }

    & docker-compose restart caddy
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Caddy restarted successfully!" -ForegroundColor Green
    }
    else {
        Write-Host "⚠️  Caddy restart may have had issues (exit code: $LASTEXITCODE)" -ForegroundColor Yellow
    }

    # Test instructions
    Write-Host ""
    Write-Host "✅ Deployment complete!" -ForegroundColor Green
    Write-Host ""
    Write-Host "🧪 TESTING INSTRUCTIONS:" -ForegroundColor Cyan
    Write-Host "   1. Open: https://fps.ditchworld.com (no :3000!)" -ForegroundColor White
    Write-Host "   2. Open a second tab: https://fps.ditchworld.com" -ForegroundColor White
    Write-Host "   3. Both should show 'ONLINE (2)' in the HUD" -ForegroundColor White
    Write-Host "   4. Move in one tab - should see player in the other" -ForegroundColor White
    Write-Host ""

}
catch {
    Write-Host ""
    Write-Host "❌ ERROR OCCURRED:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
    Write-Host "Stack trace:" -ForegroundColor DarkGray
    Write-Host $_.ScriptStackTrace -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "Press Enter to close..." -ForegroundColor Gray
Read-Host
