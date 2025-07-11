{
  // Project metadata
  "name": "code-analyzer-backend",                    // Package name for npm
  "version": "1.0.0",                                // Current version following semantic versioning
  "description": "Backend server for code analysis from images using OCR and LLM", // Project description
  "main": "server.js",                               // Entry point file for the application
  
  // NPM scripts for development and deployment
  "scripts": {
    "start": "node server.js",                       // Production start command
    "dev": "nodemon server.js",                      // Development with auto-restart
    "test": "jest"                                   // Run test suite
  },
  
  // Keywords for npm search and discoverability
  "keywords": ["ocr", "llm", "code-analysis", "express", "nodejs"],
  
  "author": "",                                      // Package author (empty for now)
  "license": "MIT",                                  // Open source MIT license
  
  // Production dependencies
  "dependencies": {
    "express": "^4.18.2",                           // Web framework for Node.js - handles HTTP requests/responses
    "cors": "^2.8.5",                               // Cross-Origin Resource Sharing middleware - allows frontend to connect
    "multer": "^1.4.5-lts.1",                       // Middleware for handling multipart/form-data - used for file uploads
    "tesseract.js": "^5.0.4",                       // OCR library - extracts text from images
    "axios": "^1.6.0",                              // HTTP client - communicates with Ollama LLM service
    "sharp": "^0.32.6",                             // Image processing library - preprocesses images for better OCR
    "helmet": "^7.1.0",                             // Security middleware - sets various HTTP headers for protection
    "express-rate-limit": "^7.1.5",                 // Rate limiting middleware - prevents API abuse
    "dotenv": "^16.3.1",                            // Environment variables loader - loads configuration from .env files
    "prismjs": "^1.29.0",                           // Syntax highlighting library - formats code output
    "node-cache": "^5.1.2"                          // In-memory caching - stores analysis results for faster responses
  },
  
  // Development-only dependencies
  "devDependencies": {
    "nodemon": "^3.0.1",                            // Development server with auto-restart on file changes
    "jest": "^29.7.0"                               // Testing framework for unit and integration tests
  }
}
