#!/bin/bash

echo "🚀 Starting Code Analyzer with tunnel support..."

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
sleep 3

# Start frontend with tunnel support
echo "🟡 Starting frontend with tunnel support..."
cd frontend
npm run start-tunnel &
FRONTEND_PID=$!
cd ..

echo ""
echo "✅ Services started with tunnel support!"
echo "📋 Backend will automatically set up Ollama tunnel for remote access"
echo "🌐 Frontend will be accessible through tunnels"
echo ""
echo "Press Ctrl+C to stop all services"

# Cleanup function
cleanup() {
    echo "🛑 Stopping all services..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit 0
}

# Set up signal handlers
trap cleanup INT TERM

# Wait for interrupt
wait