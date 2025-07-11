const express = require('express');
const cors = require('cors');
const multer = require('multer');
const Tesseract = require('tesseract.js');
const axios = require('axios');
const sharp = require('sharp');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const NodeCache = require('node-cache');
const path = require('path');
const fs = require('fs').promises;
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Cache for storing analysis results (TTL: 1 hour)
const cache = new NodeCache({ stdTTL: 3600 });

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:4200',
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api', limiter);

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// Language detection based on code patterns
function detectLanguage(code) {
  const patterns = {
    python: [/def\s+\w+\s*\(/, /import\s+\w+/, /from\s+\w+\s+import/, /print\s*\(/, /if\s+__name__\s*==\s*['"]__main__['"]/, /class\s+\w+\s*\(.*\):/],
    javascript: [/function\s+\w+\s*\(/, /const\s+\w+\s*=/, /let\s+\w+\s*=/, /var\s+\w+\s*=/, /console\.log\s*\(/, /=>\s*{/, /require\s*\(/],
    typescript: [/interface\s+\w+/, /type\s+\w+\s*=/, /public\s+\w+/, /private\s+\w+/, /implements\s+\w+/, /<.*>/],
    java: [/public\s+class\s+\w+/, /public\s+static\s+void\s+main/, /System\.out\.print/, /import\s+java\./, /public\s+\w+\s+\w+\s*\(/],
    sql: [/SELECT\s+.*\s+FROM/, /INSERT\s+INTO/, /UPDATE\s+.*\s+SET/, /DELETE\s+FROM/, /CREATE\s+TABLE/, /ALTER\s+TABLE/i],
    csharp: [/using\s+System/, /public\s+class\s+\w+/, /Console\.WriteLine/, /public\s+static\s+void\s+Main/, /namespace\s+\w+/],
    cpp: [/#include\s*<.*>/, /int\s+main\s*\(/, /std::/, /cout\s*<</, /cin\s*>>/, /using\s+namespace\s+std/],
    php: [/<\?php/, /echo\s+/, /\$\w+\s*=/, /function\s+\w+\s*\(/, /class\s+\w+/],
    ruby: [/def\s+\w+/, /puts\s+/, /class\s+\w+/, /end\s*$/, /@\w+/, /require\s+/],
    go: [/package\s+main/, /func\s+main\s*\(/, /import\s+/, /fmt\.Print/, /var\s+\w+\s+\w+/]
  };

  const scores = {};
  
  for (const [lang, regexes] of Object.entries(patterns)) {
    scores[lang] = regexes.reduce((score, regex) => {
      return score + (regex.test(code) ? 1 : 0);
    }, 0);
  }

  const detectedLang = Object.keys(scores).reduce((a, b) => scores[a] > scores[b] ? a : b);
  return scores[detectedLang] > 0 ? detectedLang : 'unknown';
}

// Get best LLM model for the detected language
function getBestModel(language) {
  const modelMapping = {
    python: 'codellama:13b',
    javascript: 'deepseek-coder:6.7b',
    typescript: 'deepseek-coder:6.7b',
    java: 'codellama:13b',
    sql: 'sqlcoder:7b',
    csharp: 'codellama:13b',
    cpp: 'codellama:13b',
    php: 'deepseek-coder:6.7b',
    ruby: 'codellama:13b',
    go: 'deepseek-coder:6.7b',
    unknown: 'phi3:3.8b'
  };
  
  return modelMapping[language] || 'phi3:3.8b';
}

// Preprocess image for better OCR results
async function preprocessImage(buffer) {
  try {
    return await sharp(buffer)
      .resize(null, 2000, { withoutEnlargement: true })
      .grayscale()
      .normalize()
      .sharpen()
      .png()
      .toBuffer();
  } catch (error) {
    console.error('Image preprocessing error:', error);
    return buffer; // Return original if preprocessing fails
  }
}

// Extract code from image using OCR
async function extractCodeFromImage(imageBuffer) {
  try {
    const processedImage = await preprocessImage(imageBuffer);
    
    const { data: { text } } = await Tesseract.recognize(processedImage, 'eng', {
      logger: m => console.log('OCR Progress:', m),
      tessedit_pageseg_mode: Tesseract.PSM.AUTO,
      tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789{}[]().,;:=+-*/<>?!@#$%^&|\\~`"\' \n\t_'
    });
    
    // Clean up the extracted text
    const cleanedText = text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join('\n')
      .replace(/\s+/g, ' ')
      .replace(/([{}()[\];,])/g, '$1\n')
      .replace(/\n\s*\n/g, '\n')
      .trim();
    
    return cleanedText;
  } catch (error) {
    console.error('OCR Error:', error);
    throw new Error('Failed to extract text from image');
  }
}

// Analyze code using LLM
async function analyzeCodeWithLLM(code, prompt, language) {
  try {
    const model = getBestModel(language);
    
    const systemPrompt = `You are an expert code reviewer and educator. Analyze the provided ${language} code and provide detailed feedback based on the user's request. 

Return your response as a JSON object with the following structure:
{
  "language": "${language}",
  "overview": "Brief overview of what the code does",
  "lineAnalysis": [
    {
      "lineNumber": 1,
      "originalCode": "original line of code",
      "explanation": "what this line does",
      "suggestions": ["improvement suggestion 1", "improvement suggestion 2"],
      "severity": "info|warning|error",
      "category": "performance|readability|security|best-practice"
    }
  ],
  "overallSuggestions": ["suggestion 1", "suggestion 2"],
  "refactoredCode": "complete refactored version if requested",
  "securityIssues": ["security issue 1", "security issue 2"],
  "performanceIssues": ["performance issue 1", "performance issue 2"]
}

Focus on:
- Code explanation and educational content
- Performance optimizations
- Security vulnerabilities
- Best practices
- Readability improvements
- Error handling
`;

    const userPrompt = `${prompt}\n\nCode to analyze:\n\`\`\`${language}\n${code}\n\`\`\``;

    const response = await axios.post(`${process.env.OLLAMA_URL || 'http://localhost:11434'}/api/generate`, {
      model: model,
      prompt: `${systemPrompt}\n\nUser Request: ${userPrompt}`,
      stream: false,
      options: {
        temperature: 0.3,
        top_p: 0.9,
        top_k: 40
      }
    });

    const responseText = response.data.response;
    
    // Try to parse JSON response
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.warn('Failed to parse LLM JSON response, creating structured response...');
    }

    // Fallback: create structured response from text
    const lines = code.split('\n');
    const lineAnalysis = lines.map((line, index) => ({
      lineNumber: index + 1,
      originalCode: line.trim(),
      explanation: `Line ${index + 1}: ${line.trim()}`,
      suggestions: ["Consider adding comments for clarity"],
      severity: "info",
      category: "readability"
    }));

    return {
      language: language,
      overview: "Code analysis completed",
      lineAnalysis: lineAnalysis,
      overallSuggestions: [responseText],
      refactoredCode: code,
      securityIssues: [],
      performanceIssues: []
    };

  } catch (error) {
    console.error('LLM Analysis Error:', error);
    throw new Error('Failed to analyze code with LLM');
  }
}

// API Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Upload and analyze image
app.post('/api/analyze', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const { prompt = 'Explain this code and provide suggestions for improvement' } = req.body;
    
    // Generate cache key
    const cacheKey = `${req.file.buffer.toString('base64').slice(0, 50)}_${prompt}`;
    
    // Check cache first
    const cachedResult = cache.get(cacheKey);
    if (cachedResult) {
      return res.json({ ...cachedResult, fromCache: true });
    }

    // Extract code from image
    console.log('Extracting code from image...');
    const extractedCode = await extractCodeFromImage(req.file.buffer);
    
    if (!extractedCode || extractedCode.trim().length === 0) {
      return res.status(400).json({ error: 'No code detected in the image' });
    }

    // Detect programming language
    const detectedLanguage = detectLanguage(extractedCode);
    console.log(`Detected language: ${detectedLanguage}`);

    // Analyze code with LLM
    console.log('Analyzing code with LLM...');
    const analysis = await analyzeCodeWithLLM(extractedCode, prompt, detectedLanguage);

    const result = {
      extractedCode,
      detectedLanguage,
      analysis,
      timestamp: new Date().toISOString()
    };

    // Cache the result
    cache.set(cacheKey, result);

    res.json(result);

  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({ 
      error: 'Failed to analyze image', 
      message: error.message 
    });
  }
});

// Get available LLM models
app.get('/api/models', async (req, res) => {
  try {
    const response = await axios.get(`${process.env.OLLAMA_URL || 'http://localhost:11434'}/api/tags`);
    res.json(response.data);
  } catch (error) {
    console.error('Failed to fetch models:', error);
    res.status(500).json({ error: 'Failed to fetch available models' });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
    }
  }
  
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Code Analyzer Backend running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🔍 Analyze endpoint: http://localhost:${PORT}/api/analyze`);
});

module.exports = app;
