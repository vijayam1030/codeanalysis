#!/bin/bash

# Code Analyzer Setup Script
echo "🚀 Setting up Code Analyzer..."

# Check if Ollama is installed
if ! command -v ollama &> /dev/null; then
    echo "❌ Ollama is not installed. Please install it first:"
    echo "   Visit: https://ollama.ai/"
    exit 1
fi

echo "✅ Ollama found"

# Pull required models
echo "📥 Pulling LLM models..."
ollama pull codellama:13b
ollama pull deepseek-coder:6.7b
ollama pull phi3:3.8b

echo "✅ Models downloaded"

# Install backend dependencies
echo "📦 Installing backend dependencies..."
cd backend
npm install

# Copy environment file
if [ ! -f .env ]; then
    cp .env.example .env
    echo "✅ Environment file created"
fi

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
cd ../frontend
npm install

echo "✅ Setup complete!"
echo ""
echo "🎯 To start the application:"
echo "   1. Start backend: cd backend && npm run dev"
echo "   2. Start frontend: cd frontend && npm start"
echo "   3. Open: http://localhost:4200"
