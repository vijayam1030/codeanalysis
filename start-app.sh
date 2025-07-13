#!/bin/bash

echo "==========================================="
echo "   Code Analyzer - One-Click Startup"
echo "==========================================="
echo

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if Node.js is installed
echo -e "${BLUE}[1/4] Checking Node.js installation...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed or not in PATH${NC}"
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi
echo -e "${GREEN}✅ Node.js found: $(node --version)${NC}"

# Check if npm is available
echo -e "${BLUE}[2/4] Checking npm...${NC}"
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm is not available${NC}"
    exit 1
fi
echo -e "${GREEN}✅ npm found: $(npm --version)${NC}"

# Install dependencies if needed
echo -e "${BLUE}[3/4] Installing dependencies...${NC}"
if [ ! -d "backend/node_modules" ]; then
    echo "Installing backend dependencies..."
    cd backend && npm install && cd ..
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Failed to install backend dependencies${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✅ Backend dependencies already installed${NC}"
fi

if [ ! -d "frontend/node_modules" ]; then
    echo "Installing frontend dependencies..."
    cd frontend && npm install && cd ..
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Failed to install frontend dependencies${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✅ Frontend dependencies already installed${NC}"
fi

# Start the application
echo -e "${BLUE}[4/4] Starting Code Analyzer...${NC}"
echo
echo -e "${GREEN}🚀 Starting backend server on http://localhost:5000${NC}"
echo -e "${GREEN}🚀 Starting frontend app on http://localhost:4200${NC}"
echo
echo -e "${YELLOW}⚠️  Keep this terminal open while using the application${NC}"
echo -e "${YELLOW}⚠️  Press Ctrl+C to stop the application${NC}"
echo

# Function to cleanup on exit
cleanup() {
    echo
    echo -e "${YELLOW}Stopping Code Analyzer...${NC}"
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit 0
}

# Set trap for cleanup on script exit
trap cleanup SIGINT SIGTERM

# Start backend in background
cd backend
npm start &
BACKEND_PID=$!
cd ..

# Wait a bit for backend to start
sleep 3

# Start frontend in background
cd frontend
npm start &
FRONTEND_PID=$!
cd ..

# Wait for frontend to start then open browser
sleep 10

# Try to open browser (works on most systems)
if command -v xdg-open &> /dev/null; then
    xdg-open http://localhost:4200 &>/dev/null
elif command -v open &> /dev/null; then
    open http://localhost:4200 &>/dev/null
elif command -v start &> /dev/null; then
    start http://localhost:4200 &>/dev/null
fi

echo -e "${GREEN}✅ Application started successfully!${NC}"
echo
echo -e "${BLUE}Backend API: http://localhost:5000${NC}"
echo -e "${BLUE}Frontend UI: http://localhost:4200${NC}"
echo
echo "Press Ctrl+C to stop the application..."

# Wait for user to stop the application
wait