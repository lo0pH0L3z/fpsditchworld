# Test HTTPS connection to fps.ditchworld.com
Write-Host "Testing HTTPS access to fps.ditchworld.com..." -ForegroundColor Cyan
Write-Host ""

try {
    # Test just the domain (should be port 443)
    Write-Host "1. Testing https://fps.ditchworld.com ..." -ForegroundColor Yellow
    $response1 = Invoke-WebRequest -Uri "https://fps.ditchworld.com" -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
    Write-Host "   ✅ SUCCESS! Status: $($response1.StatusCode)" -ForegroundColor Green
    Write-Host "   Content Length: $($response1.Content.Length) bytes" -ForegroundColor Green
} catch {
    Write-Host "   ❌ FAILED: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   Exception Type: $($_.Exception.GetType().FullName)" -ForegroundColor DarkGray
}

Write-Host ""

try {
    # Test with port 3000
    Write-Host "2. Testing https://fps.ditchworld.com:3000 ..." -ForegroundColor Yellow
    $response2 = Invoke-WebRequest -Uri "https://fps.ditchworld.com:3000" -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
    Write-Host "   ✅ SUCCESS! Status: $($response2.StatusCode)" -ForegroundColor Green
    Write-Host "   Content Length: $($response2.Content.Length) bytes" -ForegroundColor Green
} catch {
    Write-Host "   ❌ FAILED: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "Testing HTTP (port 80) redirect..." -ForegroundColor Yellow
try {
    $response3 = Invoke-WebRequest -Uri "http://fps.ditchworld.com" -UseBasicParsing -MaximumRedirection 0 -ErrorAction Stop
    Write-Host "   Response: $($response3.StatusCode)" -ForegroundColor Yellow
} catch {
    if ($_.Exception.Response.StatusCode -eq 'MovedPermanently' -or $_.Exception.Response.StatusCode -eq 'Found') {
        Write-Host "   ✅ Redirects to HTTPS (this is correct)" -ForegroundColor Green
    } else {
        Write-Host "   ❌ FAILED: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Read-Host "Press Enter to exit"
