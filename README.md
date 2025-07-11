# Code Analyzer - Extract & Analyze Code from Images

A full-stack web application that extracts code from images using OCR and provides intelligent analysis using local LLM models. Perfect for analyzing code screenshots, photos of whiteboards, or any image containing code.

## 🚀 Features

### Core Functionality
- **Image Upload**: Drag-and-drop or click to upload code images (JPG, PNG, GIF, WebP)
- **OCR Extraction**: Advanced text extraction using Tesseract.js with image preprocessing
- **Language Detection**: Automatic detection of programming languages (Python, JavaScript, Java, SQL, etc.)
- **LLM Analysis**: Intelligent code analysis using local Ollama models
- **Line-by-Line Feedback**: Detailed explanation and suggestions for each line of code

### Analysis Features
- **Code Explanation**: Understanding what each line of code does
- **Performance Suggestions**: Optimization recommendations
- **Security Analysis**: Identification of potential security vulnerabilities  
- **Best Practices**: Recommendations for improved code quality
- **Code Refactoring**: Complete rewritten versions with improvements
- **Syntax Highlighting**: Beautiful code display with proper formatting

### User Experience
- **Modern Angular UI**: Responsive Material Design interface
- **Real-time Analysis**: Progress indicators and status updates
- **Download Results**: Export analysis as JSON or Markdown
- **Analysis History**: Save and revisit previous analyses
- **Caching**: Faster response times for repeated analyses
- **Mobile Friendly**: Works on desktop, tablet, and mobile devices

## 🛠️ Technology Stack

### Frontend
- **Angular 18**: Modern TypeScript framework
- **Angular Material**: Beautiful UI components
- **RxJS**: Reactive programming for data flow
- **SCSS**: Advanced styling with variables and mixins

### Backend
- **Node.js**: JavaScript runtime
- **Express**: Web framework
- **Tesseract.js**: OCR text extraction
- **Sharp**: Image preprocessing
- **Axios**: HTTP client for LLM communication

### AI/ML
- **Ollama**: Local LLM runtime
- **CodeLlama 7B**: Code-specific language model (primary)
- **Llama 3.2**: General-purpose model with code capabilities
- **Phi3**: Lightweight alternative model

## 📋 Prerequisites

Before installing, ensure you have:
- **Node.js** (v18 or higher)
- **npm** (v9 or higher)
- **Ollama** installed and running

### Installing Ollama

1. **Download Ollama** from [https://ollama.ai](https://ollama.ai)
2. **Install** following the platform-specific instructions
3. **Verify installation**: Open terminal and run `ollama --version`

## 🚀 Quick Start

### 1. Install Ollama Models

The application requires at least one LLM model. Run the installation script:

**Windows:**
```bash
cd backend
install-models.bat
```

**Linux/Mac:**
```bash
cd backend
./install-models.sh
```

**Manual Installation:**
```bash
# Primary model (best for code analysis)
ollama pull codellama:7b

# General purpose model (fallback)
ollama pull llama3.2:latest

# Lightweight model (for slower systems)
ollama pull llama3.2:3b
```

### 2. Clone and Setup Project

```bash
# Clone the repository
git clone <repository-url>
cd code-analyzer

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies  
cd ../frontend
npm install
```

### 3. Configure Environment

Create environment files:

**Backend (.env):**
```bash
cd backend
cp .env.example .env
```

Edit the `.env` file if needed:
```env
PORT=3000
OLLAMA_URL=http://localhost:11434
FRONTEND_URL=http://localhost:4200
```

### 4. Start the Application

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend  
npm start
```

### 5. Access the Application

Open your browser and navigate to:
- **Frontend**: http://localhost:4200
- **Backend API**: http://localhost:3000
- **Health Check**: http://localhost:3000/api/health

## 🎯 Usage

### 1. Install Ollama and Models
```bash
# Install Ollama (visit https://ollama.ai for OS-specific instructions)
curl -fsSL https://ollama.ai/install.sh | sh

# Pull recommended models (start with these)
ollama pull codellama:13b    # Primary code analysis model
ollama pull phi3:3.8b        # Fast, lightweight model
ollama pull llama3:8b        # Good general purpose alternative
```

### 2. Clone and Setup Backend
```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Start the backend server
npm run dev
```

### 3. Setup Frontend
```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start the Angular development server
npm start
```

### 4. Access the Application
- Frontend: http://localhost:4200
- Backend API: http://localhost:3000
- Backend Health Check: http://localhost:3000/api/health

## 🔧 Configuration

### Environment Variables (.env)
```env
PORT=3000
FRONTEND_URL=http://localhost:4200
OLLAMA_URL=http://localhost:11434
```

### Supported Programming Languages
- Python
- JavaScript/TypeScript
- Java
- SQL
- C#
- C/C++
- PHP
- Ruby
- Go
- And more...

## 📱 Usage

1. **Upload Image**: Drag and drop or click to select a code image
2. **Enter Prompt**: Choose from templates or write custom analysis requests
3. **Analyze**: Click "Analyze Code" to process the image
4. **Review Results**: Explore line-by-line analysis, suggestions, and refactored code
5. **Download**: Export results as JSON or Markdown
6. **History**: Access previous analyses from the history panel

### Example Prompts
- "Explain this code and provide suggestions for improvement"
- "Add detailed comments to this code"
- "Refactor this code for better performance"
- "Identify security vulnerabilities in this code"
- "Convert this code to a different language"

## � Troubleshooting

### Common Issues

#### "No LLM models are available"
- **Solution**: Install Ollama models using the installation script
- **Command**: `cd backend && install-models.bat` (Windows) or `./install-models.sh` (Linux/Mac)

#### "Ollama service is not available"
- **Check**: Is Ollama running? Open terminal and run `ollama list`
- **Solution**: Start Ollama service or reinstall from https://ollama.ai

#### "Model 'codellama:7b' not found"
- **Solution**: Pull the specific model: `ollama pull codellama:7b`
- **Alternative**: The app will automatically use any available model

#### "Cannot connect to Ollama"
- **Check**: Ollama URL in `.env` file (default: http://localhost:11434)
- **Solution**: Ensure Ollama is running on the correct port

#### "OCR extraction failed"
- **Check**: Image quality - ensure text is clear and readable
- **Solution**: Use higher resolution images or improve lighting

#### "Frontend not loading"
- **Check**: Are both backend and frontend servers running?
- **Solution**: Run `npm run dev` in backend and `npm start` in frontend

#### "CORS errors"
- **Check**: Frontend URL in backend `.env` file
- **Solution**: Ensure `FRONTEND_URL=http://localhost:4200` in backend `.env`

### Performance Tips

- **Use smaller models** (llama3.2:3b) for faster analysis on slower machines
- **Enable caching** - repeated analyses of the same image are much faster
- **Optimize images** - clear, high-contrast images work best for OCR
- **Use specific prompts** - detailed requests get better analysis results

### Logs and Debugging

- **Backend logs**: Check terminal running `npm run dev`
- **Frontend logs**: Open browser developer tools (F12)
- **Ollama logs**: Run `ollama logs` to see model activity

## �🚀 API Endpoints

### POST /api/analyze
Upload and analyze code image
- **Body**: FormData with `image` file and `prompt` text
- **Response**: Analysis results with extracted code and LLM feedback

### GET /api/health
Check backend server health
- **Response**: Server status and timestamp

### GET /api/models
List available Ollama models
- **Response**: Available LLM models

## 🔍 Architecture

### Image Processing Pipeline
1. **Upload**: Secure file validation and size checking
2. **Preprocessing**: Image enhancement using Sharp (grayscale, normalize, sharpen)
3. **OCR**: Text extraction using Tesseract.js with optimized settings
4. **Cleanup**: Text formatting and noise reduction

### Language Detection
- Pattern matching for language-specific syntax
- Scoring system for accurate detection
- Fallback to generic analysis for unknown languages

### LLM Integration
- Model selection based on detected language
- Structured prompts for consistent output
- JSON response parsing with fallback handling
- Caching for improved performance

## 🛡️ Security Features

- **File Validation**: Strict image type and size checking
- **Rate Limiting**: Protection against API abuse
- **CORS Configuration**: Secure cross-origin requests
- **Input Sanitization**: Clean and validate all inputs
- **Error Handling**: Secure error messages without sensitive data

## 🎨 UI/UX Features

- **Material Design**: Consistent and modern interface
- **Responsive Layout**: Works on all screen sizes
- **Dark Code Theme**: Easy-to-read code display
- **Progress Indicators**: Clear feedback during processing
- **Error Handling**: User-friendly error messages
- **Accessibility**: ARIA labels and keyboard navigation

## 🔧 Development

### Backend Development
```bash
cd backend
npm run dev  # Starts with nodemon for auto-reload
npm test     # Run tests
```

### Frontend Development
```bash
cd frontend
npm start    # Starts Angular dev server
npm run build # Build for production
npm test     # Run unit tests
```

### Code Quality
- TypeScript strict mode enabled
- ESLint and Prettier configured
- Comprehensive error handling
- Modular and maintainable code structure

## 🚀 Deployment

### Docker Support (Coming Soon)
- Multi-stage builds for optimal image size
- Production-ready configurations
- Health checks and monitoring

### Production Considerations
- Environment-specific configurations
- SSL/TLS certificates
- Process managers (PM2)
- Monitoring and logging
- Database integration for persistent storage

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- [Tesseract.js](https://tesseract.projectnaptha.com/) - OCR functionality
- [Ollama](https://ollama.ai/) - Local LLM runtime
- [Angular](https://angular.io/) - Frontend framework
- [Angular Material](https://material.angular.io/) - UI components
- [Sharp](https://sharp.pixelplumbing.com/) - Image processing

## 📧 Support

For support, feature requests, or bug reports, please open an issue on GitHub or contact the development team.

---

Made with ❤️ for developers who want to analyze code from any image!
