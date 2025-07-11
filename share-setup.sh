#!/bin/bash

echo "🚀 Setting up Code Analyzer for sharing..."

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

# Start backend
echo "🟡 Starting backend server..."
cd backend
npm start &
BACKEND_PID=$!

# Wait for backend to start
sleep 3

# Start frontend with tunnel-friendly settings
echo "🟡 Starting frontend with tunnel support..."
cd ../frontend
npm run start-tunnel &
FRONTEND_PID=$!

# Wait for frontend to start
sleep 5

echo "🟡 Starting Cloudflare tunnels..."

# Start Ollama tunnel (needed for remote backend access)
echo "🟡 Starting Ollama tunnel..."
cloudflared tunnel --url http://localhost:11434 > ollama-tunnel.log 2>&1 &
OLLAMA_TUNNEL_PID=$!

# Wait for Ollama tunnel to establish
sleep 2

# Get Ollama tunnel URL and update backend env
OLLAMA_TUNNEL_URL=$(grep -o 'https://[^[:space:]]*\.trycloudflare\.com' ollama-tunnel.log | head -1)
if [ -n "$OLLAMA_TUNNEL_URL" ]; then
    echo "📡 Ollama tunnel established: $OLLAMA_TUNNEL_URL"
    # Update the .env file to use the tunnel URL
    cd backend
    sed -i "s|OLLAMA_URL=http://localhost:11434|OLLAMA_URL=$OLLAMA_TUNNEL_URL|g" .env
    cd ..
else
    echo "⚠️  Warning: Could not get Ollama tunnel URL. Backend may fail remotely."
fi

# Start backend tunnel
cloudflared tunnel --url http://localhost:5000 > backend-tunnel.log 2>&1 &
BACKEND_TUNNEL_PID=$!

# Start frontend tunnel
cloudflared tunnel --url http://localhost:4200 > frontend-tunnel.log 2>&1 &
FRONTEND_TUNNEL_PID=$!

# Wait a moment for tunnels to establish
sleep 3

echo ""
echo "🎉 Code Analyzer is now shared!"
echo ""
echo "📋 Your shareable links:"
echo "Ollama tunnel URL:"
echo "$OLLAMA_TUNNEL_URL"
echo ""
echo "Backend tunnel URL:"
grep -o 'https://[^[:space:]]*\.trycloudflare\.com' backend-tunnel.log | head -1
echo ""
echo "Frontend tunnel URL:"
grep -o 'https://[^[:space:]]*\.trycloudflare\.com' frontend-tunnel.log | head -1
echo ""
echo "✅ Share the Frontend URL with others!"
echo "✅ Ollama is now accessible remotely through the tunnel"
echo "✅ Backend will automatically use the Ollama tunnel for LLM processing"
echo ""
echo "Press Ctrl+C to stop all services"

# Cleanup function
cleanup() {
    echo "🛑 Stopping all services..."
    kill $BACKEND_PID $FRONTEND_PID $OLLAMA_TUNNEL_PID $BACKEND_TUNNEL_PID $FRONTEND_TUNNEL_PID 2>/dev/null
    
    # Restore original .env file
    cd backend
    sed -i "s|OLLAMA_URL=https://.*\.trycloudflare\.com|OLLAMA_URL=http://localhost:11434|g" .env
    cd ..
    
    exit 0
}

# Set up signal handlers
trap cleanup INT TERM

# Wait for interrupt
wait