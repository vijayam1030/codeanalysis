# Code Analyzer Project

This is a full-stack web application that extracts code from images using OCR and provides intelligent analysis using local LLM models.

## Project Structure

- `backend/` - Node.js Express server with OCR and LLM integration
- `frontend/` - Angular application with Material Design UI
- `.github/` - GitHub configuration and Copilot instructions

## Quick Start

1. Install Ollama and pull models:
   ```bash
   ollama pull codellama:13b
   ollama pull deepseek-coder:6.7b
   ollama pull phi3:3.8b
   ```

2. Start the backend:
   ```bash
   cd backend
   npm install
   npm run dev
   ```

3. Start the frontend:
   ```bash
   cd frontend
   npm install
   npm start
   ```

4. Open http://localhost:4200 in your browser

## Features

- Image upload with drag-and-drop
- OCR text extraction from code images
- Automatic programming language detection
- LLM-powered code analysis and suggestions
- Line-by-line code explanation
- Security and performance analysis
- Code refactoring suggestions
- Export results as JSON or Markdown
- Analysis history and caching

## Technology Stack

**Frontend:** Angular 18, Angular Material, TypeScript, SCSS
**Backend:** Node.js, Express, Tesseract.js, Sharp
**AI/ML:** Ollama, CodeLlama, DeepSeek Coder, Phi3

For detailed setup and usage instructions, see the main README.md file.
