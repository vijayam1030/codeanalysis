@echo off
echo Installing recommended Ollama models for Code Analyzer...
echo.

echo Checking if Ollama is installed...
ollama --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Ollama is not installed or not in PATH.
    echo Please install Ollama from https://ollama.ai
    echo Then restart your terminal and run this script again.
    pause
    exit /b 1
)

echo Ollama is installed. Pulling recommended models...
echo.

echo [1/3] Pulling llama3.2:latest - General purpose model...
ollama pull llama3.2:latest
if %errorlevel% neq 0 (
    echo Warning: Failed to pull llama3.2:latest
) else (
    echo Successfully pulled llama3.2:latest
)

echo.
echo [2/3] Pulling codellama:7b - Code-specific model...
ollama pull codellama:7b
if %errorlevel% neq 0 (
    echo Warning: Failed to pull codellama:7b
) else (
    echo Successfully pulled codellama:7b
)

echo.
echo [3/3] Pulling llama3.2:3b - Lightweight model...
ollama pull llama3.2:3b
if %errorlevel% neq 0 (
    echo Warning: Failed to pull llama3.2:3b
) else (
    echo Successfully pulled llama3.2:3b
)

echo.
echo Checking installed models...
ollama list

echo.
echo Model installation complete!
echo You can now start the backend server with: npm run dev
pause
