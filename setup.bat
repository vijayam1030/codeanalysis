@echo off
echo 🚀 Setting up Code Analyzer...

REM Check if Ollama is installed
ollama --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Ollama is not installed. Please install it first:
    echo    Visit: https://ollama.ai/
    exit /b 1
)

echo ✅ Ollama found

REM Pull required models
echo 📥 Pulling LLM models...
ollama pull codellama:13b
ollama pull deepseek-coder:6.7b
ollama pull phi3:3.8b

echo ✅ Models downloaded

REM Install backend dependencies
echo 📦 Installing backend dependencies...
cd backend
npm install

REM Copy environment file
if not exist .env (
    copy .env.example .env
    echo ✅ Environment file created
)

REM Install frontend dependencies
echo 📦 Installing frontend dependencies...
cd ..\frontend
npm install

echo ✅ Setup complete!
echo.
echo 🎯 To start the application:
echo    1. Start backend: cd backend ^&^& npm run dev
echo    2. Start frontend: cd frontend ^&^& npm start
echo    3. Open: http://localhost:4200
