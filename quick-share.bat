@echo off
echo 🚀 Quick Share - Creating frontend tunnel...

:: Check if cloudflared is installed
where cloudflared >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ cloudflared not found. Install: winget install --id Cloudflare.cloudflared
    pause
    exit /b 1
)

echo 📡 Creating Cloudflare tunnel for localhost:4200...
echo.
echo ⏳ Starting tunnel (this may take 10-15 seconds)...
echo.

cloudflared tunnel --url http://localhost:4200

pause