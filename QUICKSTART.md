# Quick Start Guide

## 🚀 Get Started in 5 Minutes

### Prerequisites
- **Node.js** (v18+): [Download here](https://nodejs.org/)
- **Ollama**: [Install from here](https://ollama.ai/)

### 1. Install Ollama Models
```bash
# Essential models (choose based on your needs)
ollama pull codellama:13b    # Best for code analysis (recommended)
ollama pull phi3:3.8b        # Lightweight, fast responses
ollama pull llama3:8b        # Good general purpose model

# Optional additional models
ollama pull codellama:7b     # Smaller version of CodeLlama
ollama pull llama2:7b        # Alternative general purpose model
```

### 2. Start Backend Server
```bash
cd backend
npm install
npm run dev
```
✅ Backend running at: http://localhost:3000

### 3. Start Frontend Server
Open a new terminal:
```bash
cd frontend
npm install
npm start
```
✅ Frontend running at: http://localhost:4200

### 4. Use the Application
1. Open http://localhost:4200 in your browser
2. Upload a code image (drag & drop or click)
3. Enter a prompt (or use templates)
4. Click "Analyze Code"
5. Review the detailed analysis results!

## 🎯 Example Use Cases

### 1. Code Explanation
- Upload a Python function screenshot
- Prompt: "Explain this code step by step"
- Get: Line-by-line explanations

### 2. Code Review
- Upload a JavaScript file photo
- Prompt: "Review this code for improvements"
- Get: Performance and readability suggestions

### 3. Security Analysis
- Upload any code image
- Prompt: "Find security vulnerabilities"
- Get: Security issue identification

### 4. Language Conversion
- Upload code in one language
- Prompt: "Convert this to TypeScript"
- Get: Equivalent code in target language

## 🛠️ Troubleshooting

### Backend Issues
- **Port already in use**: Change PORT in `.env` file
- **Ollama not found**: Make sure Ollama is installed and running
- **Models not found**: Run `ollama pull <model-name>` for each model

### Frontend Issues
- **Build errors**: Run `npm install` in frontend directory
- **CORS errors**: Check backend is running on port 3000
- **UI not loading**: Check console for JavaScript errors

### Common Fixes
```bash
# Clear npm cache
npm cache clean --force

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Check Ollama status
ollama list
```

## 📸 Supported Image Types
- **PNG, JPG, JPEG**: Best quality
- **GIF, WebP**: Good support
- **Max size**: 10MB
- **Tip**: High contrast images work best

## 🎨 Supported Languages
- Python, JavaScript, TypeScript
- Java, C#, C/C++
- SQL, PHP, Ruby, Go
- And many more!

## 💡 Pro Tips
1. **Better OCR**: Use high-resolution images with good contrast
2. **Specific Prompts**: Be detailed about what you want analyzed
3. **Use Templates**: Quick-start with predefined prompt templates
4. **Save Results**: Download analysis as JSON or Markdown
5. **Check History**: Revisit previous analyses from the history panel

## 🔗 Useful Commands

### VS Code Tasks
- `Ctrl+Shift+P` → "Tasks: Run Task"
- Select "Start Full Application"

### Direct Commands
```bash
# Root directory
npm run install-all  # Install all dependencies
npm run start        # Start both servers

# Backend only
cd backend
npm run dev          # Development with auto-reload
npm start            # Production mode

# Frontend only
cd frontend
npm start            # Development server
npm run build        # Production build
```

## 🆘 Need Help?
- Check the main README.md for detailed documentation
- Review console logs for error messages
- Ensure all prerequisites are installed
- Try with a simple test image first

Happy coding! 🎉
