@echo off
echo ===================================
echo  Code Analyzer Setup & Test
echo ===================================
echo.

echo [1/4] Checking Ollama installation...
ollama --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Ollama not found. Please install from https://ollama.ai
    pause
    exit /b 1
)
echo ✓ Ollama is installed

echo.
echo [2/4] Installing/checking models...
echo Pulling llama3.2:latest...
ollama pull llama3.2:latest
echo Pulling codellama:7b...  
ollama pull codellama:7b

echo.
echo [3/4] Installing backend dependencies...
cd backend
call npm install
if %errorlevel% neq 0 (
    echo ERROR: Failed to install backend dependencies
    pause
    exit /b 1
)

echo.
echo [4/4] Installing frontend dependencies...
cd ..\frontend
call npm install
if %errorlevel% neq 0 (
    echo ERROR: Failed to install frontend dependencies
    pause
    exit /b 1
)

echo.
echo ===================================
echo  Setup Complete!
echo ===================================
echo.
echo To start the application:
echo.
echo 1. Backend:  cd backend  ^&^& npm run dev
echo 2. Frontend: cd frontend ^&^& npm start  
echo 3. Open: http://localhost:4200
echo.
echo The app now analyzes EVERY line of code!
echo Upload an image and see line-by-line analysis.
echo.
pause
