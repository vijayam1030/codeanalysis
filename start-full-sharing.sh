#!/bin/bash

echo "🚀 Starting Code Analyzer with full Cloudflare sharing..."

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check if cloudflared is installed
if ! command_exists cloudflared; then
    echo "❌ cloudflared not found. Please install it first:"
    echo "Windows: winget install --id Cloudflare.cloudflared"
    echo "macOS: brew install cloudflared"
    echo "Linux: Download from https://github.com/cloudflare/cloudflared/releases"
    exit 1
fi

echo "✅ cloudflared found"

# Start backend with tunnel support
echo "🟡 Starting backend with Ollama tunnel..."
cd backend
npm run start-with-tunnel &
BACKEND_PID=$!
cd ..

# Wait for backend to start
sleep 5

# Start frontend with tunnel support
echo "🟡 Starting frontend..."
cd frontend
npm run start-tunnel &
FRONTEND_PID=$!
cd ..

# Wait for frontend to start
sleep 5

# Start frontend tunnel
echo "🟡 Starting frontend Cloudflare tunnel..."
cloudflared tunnel --url http://localhost:4200 > frontend-tunnel.log 2>&1 &
FRONTEND_TUNNEL_PID=$!

# Start backend tunnel
echo "🟡 Starting backend Cloudflare tunnel..."
cloudflared tunnel --url http://localhost:5000 > backend-tunnel.log 2>&1 &
BACKEND_TUNNEL_PID=$!

# Wait for tunnels to establish
sleep 5

echo ""
echo "🎉 Code Analyzer is now fully shared!"
echo ""
echo "📋 Your shareable URLs:"

# Get frontend tunnel URL
FRONTEND_URL=$(grep -o 'https://[^[:space:]]*\.trycloudflare\.com' frontend-tunnel.log | head -1)
if [ -n "$FRONTEND_URL" ]; then
    echo "🌐 Frontend (Share this): $FRONTEND_URL"
else
    echo "⚠️  Frontend tunnel still starting... check frontend-tunnel.log"
fi

# Get backend tunnel URL
BACKEND_URL=$(grep -o 'https://[^[:space:]]*\.trycloudflare\.com' backend-tunnel.log | head -1)
if [ -n "$BACKEND_URL" ]; then
    echo "🔧 Backend API: $BACKEND_URL"
else
    echo "⚠️  Backend tunnel still starting... check backend-tunnel.log"
fi

echo ""
echo "✅ Share the Frontend URL with others!"
echo "📱 The app will work from anywhere in the world"
echo ""
echo "Press Ctrl+C to stop all services"

# Cleanup function
cleanup() {
    echo "🛑 Stopping all services..."
    kill $BACKEND_PID $FRONTEND_PID $FRONTEND_TUNNEL_PID $BACKEND_TUNNEL_PID 2>/dev/null
    exit 0
}

# Set up signal handlers
trap cleanup INT TERM

# Wait for interrupt
wait