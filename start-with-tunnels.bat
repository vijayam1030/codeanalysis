@echo off
echo 🚀 Starting Code Analyzer with tunnel support...

:: Check if cloudflared is installed
where cloudflared >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ cloudflared not found. Please install it first:
    echo Windows: winget install --id Cloudflare.cloudflared
    pause
    exit /b 1
)

echo ✅ cloudflared found

:: Start services with tunnel support
echo 🟡 Starting backend with Ollama tunnel...
start "Backend" cmd /k "cd backend && npm run start-with-tunnel"

:: Wait a moment for backend to start
timeout /t 3 /nobreak >nul

echo 🟡 Starting frontend with tunnel support...
start "Frontend" cmd /k "cd frontend && npm run start-tunnel"

echo ✅ Services starting with tunnel support!
echo 📋 Check the individual terminal windows for tunnel URLs
echo 🛑 Close the terminal windows to stop services
pause