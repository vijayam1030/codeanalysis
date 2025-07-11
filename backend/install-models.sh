#!/bin/bash

echo "Installing recommended Ollama models for Code Analyzer..."
echo

echo "Checking if Ollama is installed..."
if ! command -v ollama &> /dev/null; then
    echo "ERROR: Ollama is not installed or not in PATH."
    echo "Please install Ollama from https://ollama.ai"
    echo "Then restart your terminal and run this script again."
    exit 1
fi

echo "Ollama is installed. Pulling recommended models..."
echo

echo "[1/3] Pulling llama3.2:latest - General purpose model..."
if ollama pull llama3.2:latest; then
    echo "Successfully pulled llama3.2:latest"
else
    echo "Warning: Failed to pull llama3.2:latest"
fi

echo
echo "[2/3] Pulling codellama:7b - Code-specific model..."
if ollama pull codellama:7b; then
    echo "Successfully pulled codellama:7b"
else
    echo "Warning: Failed to pull codellama:7b"
fi

echo
echo "[3/3] Pulling llama3.2:3b - Lightweight model..."
if ollama pull llama3.2:3b; then
    echo "Successfully pulled llama3.2:3b"
else
    echo "Warning: Failed to pull llama3.2:3b"
fi

echo
echo "Checking installed models..."
ollama list

echo
echo "Model installation complete!"
echo "You can now start the backend server with: npm run dev"
