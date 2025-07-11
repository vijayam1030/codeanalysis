@echo off
echo 🚀 Starting Code Analyzer with full Cloudflare sharing...

:: Check if cloudflared is installed
where cloudflared >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ cloudflared not found. Please install it first:
    echo Windows: winget install --id Cloudflare.cloudflared
    pause
    exit /b 1
)

echo ✅ cloudflared found

:: Start backend with tunnel support
echo 🟡 Starting backend with Ollama tunnel...
start "Backend" cmd /k "cd backend && npm run start-with-tunnel"

:: Wait for backend to start
timeout /t 5 /nobreak >nul

:: Start frontend 
echo 🟡 Starting frontend...
start "Frontend" cmd /k "cd frontend && npm run start-tunnel"

:: Wait for frontend to start
timeout /t 5 /nobreak >nul

:: Start frontend tunnel
echo 🟡 Starting frontend Cloudflare tunnel...
start "Frontend Tunnel" cmd /k "cloudflared tunnel --url http://localhost:4200"

:: Start backend tunnel  
echo 🟡 Starting backend Cloudflare tunnel...
start "Backend Tunnel" cmd /k "cloudflared tunnel --url http://localhost:5000"

echo.
echo ✅ All services and tunnels started!
echo.
echo 📋 Check the tunnel terminal windows for your shareable URLs
echo 🌐 Look for URLs like: https://xxx-yyy-zzz.trycloudflare.com
echo.
echo Frontend tunnel = Your shareable app URL
echo Backend tunnel = API URL (for reference)
echo.
echo 🛑 Close all terminal windows to stop services
pause