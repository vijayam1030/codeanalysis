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
    sql: [
      /SELECT\s+.*\s+FROM/i, 
      /INSERT\s+INTO/i, 
      /UPDATE\s+.*\s+SET/i, 
      /DELETE\s+FROM/i, 
      /CREATE\s+TABLE/i, 
      /ALTER\s+TABLE/i,
      /WHERE\s+/i,
      /JOIN\s+/i,
      /LEFT\s+JOIN/i,
      /RIGHT\s+JOIN/i,
      /INNER\s+JOIN/i,
      /OUTER\s+JOIN/i,
      /GROUP\s+BY/i,
      /ORDER\s+BY/i,
      /HAVING\s+/i,
      /UNION\s+/i,
      /DISTINCT\s+/i,
      /COUNT\s*\(/i,
      /MAX\s*\(/i,
      /MIN\s*\(/i,
      /SUM\s*\(/i,
      /AVG\s*\(/i,
      /IS\s+NULL/i,
      /IS\s+NOT\s+NULL/i,
      /IN\s*\(/i,
      /EXISTS\s*\(/i,
      /LIKE\s+/i,
      /BETWEEN\s+/i,
      /\(\+\)/, // Oracle outer join syntax
      /@@/,     // SQL Server variables
      /DECLARE\s+/i,
      /BEGIN\s+/i,
      /END\s*;/i,
      /EXEC\s+/i,
      /PROCEDURE\s+/i,
      /FUNCTION\s+/i,
      /TRIGGER\s+/i,
      /INDEX\s+/i,
      /PRIMARY\s+KEY/i,
      /FOREIGN\s+KEY/i,
      /REFERENCES\s+/i,
      /CONSTRAINT\s+/i,
      /NOT\s+NULL/i,
      /DEFAULT\s+/i,
      /AUTO_INCREMENT/i,
      /IDENTITY\s*\(/i,
      /VARCHAR\s*\(/i,
      /CHAR\s*\(/i,
      /INT\s*\(/i,
      /DECIMAL\s*\(/i,
      /DATETIME/i,
      /TIMESTAMP/i,
      /COMMIT\s*;/i,
      /ROLLBACK\s*;/i,
      /TRANSACTION/i
    ],
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
async function getBestModel(language) {
  const modelMapping = {
    python: 'codellama:7b',
    javascript: 'codellama:7b', 
    typescript: 'codellama:7b',
    java: 'codellama:7b',
    sql: 'codellama:7b',
    csharp: 'codellama:7b',
    cpp: 'codellama:7b',
    php: 'codellama:7b',
    ruby: 'codellama:7b',
    go: 'codellama:7b',
    unknown: 'llama3.2:latest'
  };
  
  const preferredModel = modelMapping[language] || 'llama3.2:latest';
  
  // Check if the preferred model is available
  try {
    const response = await axios.get(`${process.env.OLLAMA_URL || 'http://localhost:11434'}/api/tags`);
    const availableModels = response.data.models || [];
    const modelNames = availableModels.map(model => model.name);
    
    if (modelNames.includes(preferredModel)) {
      return preferredModel;
    }
    
    // Fallback hierarchy - more realistic models
    const fallbackModels = [
      'codellama:7b',
      'codellama:latest',
      'llama3.2:latest',
      'llama3.2:3b',
      'llama3.2:1b',
      'llama3.1:latest',
      'llama3.1:8b',
      'llama3:latest',
      'llama3:8b',
      'phi3:latest',
      'phi3:3.8b',
      'llama2:latest',
      'llama2:7b'
    ];
    
    for (const fallback of fallbackModels) {
      if (modelNames.includes(fallback)) {
        console.log(`Using fallback model: ${fallback} (preferred: ${preferredModel})`);
        return fallback;
      }
    }
    
    // If no fallback models are available, use the first available model
    if (modelNames.length > 0) {
      console.log(`Using first available model: ${modelNames[0]} (preferred: ${preferredModel})`);
      return modelNames[0];
    }
    
  } catch (error) {
    console.warn('Could not check available models, using default:', error.message);
  }
  
  return preferredModel; // Return preferred even if we can't check availability
}

// Enhanced image preprocessing for better OCR results
async function preprocessImage(buffer) {
  try {
    const image = sharp(buffer);
    const metadata = await image.metadata();
    
    // Calculate optimal dimensions (OCR works best with DPI 300-400)
    const targetHeight = Math.min(metadata.height * 2, 3000); // Scale up for better OCR
    const targetWidth = Math.min(metadata.width * 2, 4000);
    
    // Advanced preprocessing pipeline
    const processedImage = await image
      // Resize for optimal OCR (larger is often better)
      .resize(targetWidth, targetHeight, {
        kernel: sharp.kernel.lanczos3, // High-quality interpolation
        withoutEnlargement: false // Allow enlargement for small images
      })
      // Convert to grayscale for better OCR
      .grayscale()
      // Enhance contrast adaptively
      .normalize()
      // Apply unsharp mask for better edge definition
      .sharpen({
        sigma: 1.5, // Stronger sharpening
        m1: 1.0,    // Mask factor
        m2: 0.2,    // Mask offset
        x1: 2,      // Flat area threshold
        y2: 10,     // Slope area threshold
        y3: 20      // Limit threshold
      })
      // Enhance contrast further
      .linear(1.2, -10) // Slightly increase contrast and reduce brightness
      // Convert to high-quality PNG
      .png({ 
        compressionLevel: 0, // No compression for best quality
        quality: 100 
      })
      .toBuffer();
    
    console.log(`Image preprocessed: ${metadata.width}x${metadata.height} -> ${targetWidth}x${targetHeight}`);
    return processedImage;
    
  } catch (error) {
    console.error('Image preprocessing error:', error);
    return buffer; // Return original if preprocessing fails
  }
}

// Alternative preprocessing for low-quality images
async function preprocessImageAdvanced(buffer) {
  try {
    const image = sharp(buffer);
    const metadata = await image.metadata();
    
    // For very small or low-quality images, use different approach
    if (metadata.width < 800 || metadata.height < 600) {
      return await image
        .resize(metadata.width * 3, metadata.height * 3, {
          kernel: sharp.kernel.cubic
        })
        .modulate({
          brightness: 1.1,
          saturation: 0.8,
          hue: 0
        })
        .grayscale()
        .sharpen({ sigma: 2 })
        .threshold(128, { grayscale: false }) // Binary threshold
        .png({ compressionLevel: 0 })
        .toBuffer();
    }
    
    // For better quality images, use standard preprocessing
    return await preprocessImage(buffer);
    
  } catch (error) {
    console.error('Advanced preprocessing error:', error);
    return buffer;
  }
}

// Clean and format extracted code
function cleanExtractedCode(rawText, language) {
  let cleanedCode = rawText;

  // Remove common OCR artifacts
  cleanedCode = cleanedCode
    .replace(/[""]/g, '"')  // Smart quotes to regular quotes
    .replace(/['']/g, "'")  // Smart apostrophes to regular apostrophes
    .replace(/…/g, '...')   // Ellipsis to three dots
    .replace(/—/g, '-')     // Em dash to hyphen
    .replace(/–/g, '-')     // En dash to hyphen
    .replace(/\u00A0/g, ' ') // Non-breaking space to regular space
    .replace(/\u2028/g, '\n') // Line separator to newline
    .replace(/\u2029/g, '\n') // Paragraph separator to newline
    .replace(/\s+$/gm, '')   // Remove trailing spaces
    .replace(/^\s+/gm, '')   // Remove leading spaces (but preserve indentation logic below)
    .replace(/\r\n/g, '\n')  // Normalize line endings
    .replace(/\r/g, '\n');   // Normalize line endings

  // Language-specific cleaning
  switch (language) {
    case 'python':
      cleanedCode = cleanPythonCode(cleanedCode);
      break;
    case 'javascript':
    case 'typescript':
      cleanedCode = cleanJavaScriptCode(cleanedCode);
      break;
    case 'java':
    case 'csharp':
      cleanedCode = cleanJavaLikeCode(cleanedCode);
      break;
    case 'sql':
      cleanedCode = cleanSQLCode(cleanedCode);
      break;
    default:
      cleanedCode = cleanGenericCode(cleanedCode);
  }

  return cleanedCode;
}

// Python-specific code cleaning
function cleanPythonCode(code) {
  return code
    .replace(/;\s*$/gm, '')  // Remove unnecessary semicolons
    .replace(/\s*:\s*/g, ':') // Fix spacing around colons
    .replace(/\s*=\s*/g, ' = ') // Fix spacing around assignment
    .replace(/\s*\(\s*/g, '(') // Fix spacing around parentheses
    .replace(/\s*\)\s*/g, ')') 
    .replace(/\s*\[\s*/g, '[') // Fix spacing around brackets
    .replace(/\s*\]\s*/g, ']')
    .replace(/def\s+(\w+)\s*\(/g, 'def $1(') // Fix function definitions
    .replace(/class\s+(\w+)\s*\(/g, 'class $1(') // Fix class definitions
    .replace(/import\s+(\w+)/g, 'import $1') // Fix imports
    .replace(/from\s+(\w+)\s+import/g, 'from $1 import');
}

// JavaScript/TypeScript code cleaning
function cleanJavaScriptCode(code) {
  return code
    .replace(/\s*{\s*/g, ' {\n') // Fix brace spacing
    .replace(/\s*}\s*/g, '\n}')
    .replace(/\s*;\s*/g, ';\n') // Fix semicolon spacing
    .replace(/function\s+(\w+)\s*\(/g, 'function $1(') // Fix function declarations
    .replace(/const\s+(\w+)\s*=/g, 'const $1 =') // Fix const declarations
    .replace(/let\s+(\w+)\s*=/g, 'let $1 =') // Fix let declarations
    .replace(/var\s+(\w+)\s*=/g, 'var $1 =') // Fix var declarations
    .replace(/if\s*\(/g, 'if (') // Fix if statements
    .replace(/for\s*\(/g, 'for (') // Fix for loops
    .replace(/while\s*\(/g, 'while ('); // Fix while loops
}

// Java/C#-like code cleaning
function cleanJavaLikeCode(code) {
  return code
    .replace(/public\s+class\s+(\w+)/g, 'public class $1') // Fix class declarations
    .replace(/private\s+(\w+)\s+(\w+)/g, 'private $1 $2') // Fix field declarations
    .replace(/public\s+(\w+)\s+(\w+)\s*\(/g, 'public $1 $2(') // Fix method declarations
    .replace(/\s*{\s*/g, ' {\n') // Fix brace spacing
    .replace(/\s*}\s*/g, '\n}')
    .replace(/\s*;\s*/g, ';\n') // Fix semicolon spacing
    .replace(/if\s*\(/g, 'if (') // Fix if statements
    .replace(/for\s*\(/g, 'for (') // Fix for loops
    .replace(/while\s*\(/g, 'while ('); // Fix while loops
}

// SQL code cleaning
function cleanSQLCode(code) {
  // Don't convert everything to uppercase - preserve table/column names
  let cleanedCode = code;
  
  // Fix common OCR mistakes in SQL
  cleanedCode = cleanedCode
    // Fix common OCR character substitutions
    .replace(/\bSELECT\b/gi, 'SELECT')
    .replace(/\bFR0M\b/gi, 'FROM')
    .replace(/\bFROM\b/gi, 'FROM')
    .replace(/\bWHERE\b/gi, 'WHERE')
    .replace(/\bJOIN\b/gi, 'JOIN')
    .replace(/\bLEFT\s+JOIN\b/gi, 'LEFT JOIN')
    .replace(/\bRIGHT\s+JOIN\b/gi, 'RIGHT JOIN')
    .replace(/\bINNER\s+JOIN\b/gi, 'INNER JOIN')
    .replace(/\bOUTER\s+JOIN\b/gi, 'OUTER JOIN')
    .replace(/\bFULL\s+JOIN\b/gi, 'FULL JOIN')
    .replace(/\bGROUP\s+BY\b/gi, 'GROUP BY')
    .replace(/\bORDER\s+BY\b/gi, 'ORDER BY')
    .replace(/\bHAVING\b/gi, 'HAVING')
    .replace(/\bUNION\b/gi, 'UNION')
    .replace(/\bDISTINCT\b/gi, 'DISTINCT')
    .replace(/\bCOUNT\b/gi, 'COUNT')
    .replace(/\bMAX\b/gi, 'MAX')
    .replace(/\bMIN\b/gi, 'MIN')
    .replace(/\bSUM\b/gi, 'SUM')
    .replace(/\bAVG\b/gi, 'AVG')
    .replace(/\bIS\s+NULL\b/gi, 'IS NULL')
    .replace(/\bIS\s+NOT\s+NULL\b/gi, 'IS NOT NULL')
    .replace(/\bNOT\s+NULL\b/gi, 'NOT NULL')
    .replace(/\bIN\s*\(/gi, 'IN (')
    .replace(/\bNOT\s+IN\s*\(/gi, 'NOT IN (')
    .replace(/\bEXISTS\s*\(/gi, 'EXISTS (')
    .replace(/\bNOT\s+EXISTS\s*\(/gi, 'NOT EXISTS (')
    .replace(/\bLIKE\b/gi, 'LIKE')
    .replace(/\bBETWEEN\b/gi, 'BETWEEN')
    .replace(/\bAND\b/gi, 'AND')
    .replace(/\bOR\b/gi, 'OR')
    .replace(/\bNOT\b/gi, 'NOT')
    .replace(/\bINSERT\s+INTO\b/gi, 'INSERT INTO')
    .replace(/\bUPDATE\b/gi, 'UPDATE')
    .replace(/\bSET\b/gi, 'SET')
    .replace(/\bDELETE\s+FROM\b/gi, 'DELETE FROM')
    .replace(/\bCREATE\s+TABLE\b/gi, 'CREATE TABLE')
    .replace(/\bALTER\s+TABLE\b/gi, 'ALTER TABLE')
    .replace(/\bDROP\s+TABLE\b/gi, 'DROP TABLE')
    .replace(/\bPRIMARY\s+KEY\b/gi, 'PRIMARY KEY')
    .replace(/\bFOREIGN\s+KEY\b/gi, 'FOREIGN KEY')
    .replace(/\bREFERENCES\b/gi, 'REFERENCES')
    .replace(/\bCONSTRAINT\b/gi, 'CONSTRAINT')
    .replace(/\bDEFAULT\b/gi, 'DEFAULT')
    .replace(/\bAUTO_INCREMENT\b/gi, 'AUTO_INCREMENT')
    .replace(/\bVARCHAR\b/gi, 'VARCHAR')
    .replace(/\bCHAR\b/gi, 'CHAR')
    .replace(/\bINT\b/gi, 'INT')
    .replace(/\bINTEGER\b/gi, 'INTEGER')
    .replace(/\bDECIMAL\b/gi, 'DECIMAL')
    .replace(/\bFLOAT\b/gi, 'FLOAT')
    .replace(/\bDOUBLE\b/gi, 'DOUBLE')
    .replace(/\bDATETIME\b/gi, 'DATETIME')
    .replace(/\bTIMESTAMP\b/gi, 'TIMESTAMP')
    .replace(/\bDATE\b/gi, 'DATE')
    .replace(/\bTIME\b/gi, 'TIME')
    .replace(/\bTEXT\b/gi, 'TEXT')
    .replace(/\bBLOB\b/gi, 'BLOB')
    .replace(/\bBOOLEAN\b/gi, 'BOOLEAN')
    .replace(/\bCOMMIT\b/gi, 'COMMIT')
    .replace(/\bROLLBACK\b/gi, 'ROLLBACK')
    .replace(/\bTRANSACTION\b/gi, 'TRANSACTION')
    .replace(/\bBEGIN\b/gi, 'BEGIN')
    .replace(/\bEND\b/gi, 'END')
    .replace(/\bDECLARE\b/gi, 'DECLARE')
    .replace(/\bEXEC\b/gi, 'EXEC')
    .replace(/\bEXECUTE\b/gi, 'EXECUTE')
    .replace(/\bPROCEDURE\b/gi, 'PROCEDURE')
    .replace(/\bFUNCTION\b/gi, 'FUNCTION')
    .replace(/\bTRIGGER\b/gi, 'TRIGGER')
    .replace(/\bINDEX\b/gi, 'INDEX')
    .replace(/\bVIEW\b/gi, 'VIEW')
    
    // Fix Oracle-specific syntax
    .replace(/\(\s*\+\s*\)/g, '(+)') // Oracle outer join syntax
    .replace(/\bCONNECT\s+BY\b/gi, 'CONNECT BY')
    .replace(/\bSTART\s+WITH\b/gi, 'START WITH')
    .replace(/\bPRIOR\b/gi, 'PRIOR')
    .replace(/\bLEVEL\b/gi, 'LEVEL')
    .replace(/\bROWNUM\b/gi, 'ROWNUM')
    .replace(/\bDUAL\b/gi, 'DUAL')
    .replace(/\bSYSDATE\b/gi, 'SYSDATE')
    .replace(/\bNVL\b/gi, 'NVL')
    .replace(/\bNVL2\b/gi, 'NVL2')
    .replace(/\bCOALESCE\b/gi, 'COALESCE')
    .replace(/\bDECODE\b/gi, 'DECODE')
    .replace(/\bCASE\b/gi, 'CASE')
    .replace(/\bWHEN\b/gi, 'WHEN')
    .replace(/\bTHEN\b/gi, 'THEN')
    .replace(/\bELSE\b/gi, 'ELSE')
    
    // Fix SQL Server specific syntax
    .replace(/@@/g, '@@') // Keep SQL Server variables
    .replace(/\bIDENTITY\b/gi, 'IDENTITY')
    .replace(/\bSET\s+IDENTITY_INSERT\b/gi, 'SET IDENTITY_INSERT')
    .replace(/\bTOP\b/gi, 'TOP')
    .replace(/\bGETDATE\b/gi, 'GETDATE')
    .replace(/\bISNULL\b/gi, 'ISNULL')
    .replace(/\bLEN\b/gi, 'LEN')
    .replace(/\bSUBSTRING\b/gi, 'SUBSTRING')
    .replace(/\bCHARINDEX\b/gi, 'CHARINDEX')
    .replace(/\bPATINDEX\b/gi, 'PATINDEX')
    .replace(/\bREPLACE\b/gi, 'REPLACE')
    .replace(/\bLTRIM\b/gi, 'LTRIM')
    .replace(/\bRTRIM\b/gi, 'RTRIM')
    .replace(/\bTRIM\b/gi, 'TRIM')
    .replace(/\bUPPER\b/gi, 'UPPER')
    .replace(/\bLOWER\b/gi, 'LOWER')
    
    // Fix MySQL specific syntax
    .replace(/\bLIMIT\b/gi, 'LIMIT')
    .replace(/\bOFFSET\b/gi, 'OFFSET')
    .replace(/\bCONCAT\b/gi, 'CONCAT')
    .replace(/\bIFNULL\b/gi, 'IFNULL')
    .replace(/\bCURDATE\b/gi, 'CURDATE')
    .replace(/\bCURTIME\b/gi, 'CURTIME')
    .replace(/\bNOW\b/gi, 'NOW')
    .replace(/\bDATE_ADD\b/gi, 'DATE_ADD')
    .replace(/\bDATE_SUB\b/gi, 'DATE_SUB')
    .replace(/\bDATE_FORMAT\b/gi, 'DATE_FORMAT')
    .replace(/\bSTR_TO_DATE\b/gi, 'STR_TO_DATE')
    .replace(/\bYEAR\b/gi, 'YEAR')
    .replace(/\bMONTH\b/gi, 'MONTH')
    .replace(/\bDAY\b/gi, 'DAY')
    .replace(/\bHOUR\b/gi, 'HOUR')
    .replace(/\bMINUTE\b/gi, 'MINUTE')
    .replace(/\bSECOND\b/gi, 'SECOND')
    
    // Fix PostgreSQL specific syntax
    .replace(/\bLIMIT\b/gi, 'LIMIT')
    .replace(/\bOFFSET\b/gi, 'OFFSET')
    .replace(/\bSERIAL\b/gi, 'SERIAL')
    .replace(/\bBIGSERIAL\b/gi, 'BIGSERIAL')
    .replace(/\bTEXT\b/gi, 'TEXT')
    .replace(/\bJSONB\b/gi, 'JSONB')
    .replace(/\bJSON\b/gi, 'JSON')
    .replace(/\bARRAY\b/gi, 'ARRAY')
    .replace(/\bUUID\b/gi, 'UUID')
    .replace(/\bGEN_RANDOM_UUID\b/gi, 'GEN_RANDOM_UUID')
    .replace(/\bEXTRACT\b/gi, 'EXTRACT')
    .replace(/\bINTERVAL\b/gi, 'INTERVAL')
    .replace(/\bAGE\b/gi, 'AGE')
    .replace(/\bCURRENT_DATE\b/gi, 'CURRENT_DATE')
    .replace(/\bCURRENT_TIME\b/gi, 'CURRENT_TIME')
    .replace(/\bCURRENT_TIMESTAMP\b/gi, 'CURRENT_TIMESTAMP')
    .replace(/\bLOCALTIME\b/gi, 'LOCALTIME')
    .replace(/\bLOCALTIMESTAMP\b/gi, 'LOCALTIMESTAMP')
    
    // Fix spacing and formatting
    .replace(/\s*=\s*/g, ' = ')
    .replace(/\s*<\s*/g, ' < ')
    .replace(/\s*>\s*/g, ' > ')
    .replace(/\s*<=\s*/g, ' <= ')
    .replace(/\s*>=\s*/g, ' >= ')
    .replace(/\s*<>\s*/g, ' <> ')
    .replace(/\s*!=\s*/g, ' != ')
    .replace(/\s*\+\s*/g, ' + ')
    .replace(/\s*-\s*/g, ' - ')
    .replace(/\s*\*\s*/g, ' * ')
    .replace(/\s*\/\s*/g, ' / ')
    .replace(/\s*%\s*/g, ' % ')
    .replace(/\s*\(\s*/g, ' (')
    .replace(/\s*\)\s*/g, ') ')
    .replace(/\s*,\s*/g, ', ')
    .replace(/\s*;\s*/g, '; ')
    .replace(/\s*\.\s*/g, '.')
    
    // Fix line breaks and indentation
    .replace(/\s*\n\s*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\s+/gm, '')
    .replace(/\s+$/gm, '');
    
  return cleanedCode;
}

// Generic code cleaning
function cleanGenericCode(code) {
  return code
    .replace(/\s*{\s*/g, ' {\n') // Fix brace spacing
    .replace(/\s*}\s*/g, '\n}')
    .replace(/\s*;\s*/g, ';\n') // Fix semicolon spacing
    .replace(/\s*=\s*/g, ' = ') // Fix assignment spacing
    .replace(/\s*\+\s*/g, ' + ') // Fix operator spacing
    .replace(/\s*-\s*/g, ' - ')
    .replace(/\s*\*\s*/g, ' * ')
    .replace(/\s*\/\s*/g, ' / ');
}

// Enhanced OCR extraction with multiple strategies for better accuracy
async function extractCodeFromImage(imageBuffer) {
  try {
    // Try multiple preprocessing approaches for best results
    const results = await Promise.allSettled([
      extractWithStandardPreprocessing(imageBuffer),
      extractWithAdvancedPreprocessing(imageBuffer),
      extractWithHighContrastPreprocessing(imageBuffer)
    ]);
    
    // Find the best result based on confidence and text quality
    const successfulResults = results
      .filter(result => result.status === 'fulfilled' && result.value.text.length > 0)
      .map(result => result.value)
      .sort((a, b) => b.confidence - a.confidence);
    
    if (successfulResults.length === 0) {
      throw new Error('All OCR attempts failed');
    }
    
    const bestResult = successfulResults[0];
    console.log(`Best OCR result: ${bestResult.confidence}% confidence, ${bestResult.text.length} characters`);
    
    return bestResult.text;
    
  } catch (error) {
    console.error('OCR Error:', error);
    throw new Error('Failed to extract text from image');
  }
}

// Standard preprocessing OCR
async function extractWithStandardPreprocessing(imageBuffer) {
  const processedImage = await preprocessImage(imageBuffer);
  
  const result = await Tesseract.recognize(processedImage, 'eng', {
    logger: m => console.log('Standard OCR:', m.status),
    tessedit_pageseg_mode: Tesseract.PSM.AUTO,
    tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789{}[]().,;:=+-*/<>?!@#$%^&|\\~`"\' \n\t_',
    tessedit_ocr_engine_mode: Tesseract.OEM.LSTM_ONLY, // Use LSTM for better accuracy
    preserve_interword_spaces: 1 // Preserve spacing
  });
  
  return {
    text: cleanupExtractedText(result.data.text),
    confidence: result.data.confidence || 0
  };
}

// Advanced preprocessing OCR for low-quality images
async function extractWithAdvancedPreprocessing(imageBuffer) {
  const processedImage = await preprocessImageAdvanced(imageBuffer);
  
  const result = await Tesseract.recognize(processedImage, 'eng', {
    logger: m => console.log('Advanced OCR:', m.status),
    tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK, // Single block for code
    tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789{}[]().,;:=+-*/<>?!@#$%^&|\\~`"\' \n\t_',
    tessedit_ocr_engine_mode: Tesseract.OEM.LSTM_ONLY,
    preserve_interword_spaces: 1
  });
  
  return {
    text: cleanupExtractedText(result.data.text),
    confidence: result.data.confidence || 0
  };
}

// High contrast preprocessing for very clear/dark images
async function extractWithHighContrastPreprocessing(imageBuffer) {
  const processedImage = await sharp(imageBuffer)
    .resize(null, 2000, { withoutEnlargement: false })
    .grayscale()
    .normalize()
    .threshold(128) // Binary threshold for high contrast
    .sharpen({ sigma: 1 })
    .png({ compressionLevel: 0 })
    .toBuffer();
  
  const result = await Tesseract.recognize(processedImage, 'eng', {
    logger: m => console.log('High Contrast OCR:', m.status),
    tessedit_pageseg_mode: Tesseract.PSM.SINGLE_COLUMN, // Single column for code
    tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789{}[]().,;:=+-*/<>?!@#$%^&|\\~`"\' \n\t_',
    tessedit_ocr_engine_mode: Tesseract.OEM.LSTM_ONLY,
    preserve_interword_spaces: 1
  });
  
  return {
    text: cleanupExtractedText(result.data.text),
    confidence: result.data.confidence || 0
  };
}

// Enhanced text cleanup for better code extraction
function cleanupExtractedText(rawText) {
  // Basic cleanup
  let cleanedText = rawText
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n')
    .trim();
  
  // Remove common OCR artifacts specific to code
  cleanedText = cleanedText
    .replace(/[""]/g, '"')        // Smart quotes
    .replace(/['']/g, "'")        // Smart apostrophes
    .replace(/…/g, '...')         // Ellipsis
    .replace(/—/g, '-')           // Em dash
    .replace(/–/g, '-')           // En dash
    .replace(/\u00A0/g, ' ')      // Non-breaking space
    .replace(/\u2028/g, '\n')     // Line separator
    .replace(/\u2029/g, '\n')     // Paragraph separator
    .replace(/\s+$/gm, '')        // Remove trailing spaces
    .replace(/\r\n/g, '\n')       // Normalize line endings
    .replace(/\r/g, '\n');
  
  return cleanedText;
}

// Enhanced SQL line analysis function
function analyzeSQLLine(trimmedLine, lineNumber, originalLine) {
  const upperLine = trimmedLine.toUpperCase();
  
  // SQL Keywords and their explanations
  const sqlAnalysis = {
    explanation: '',
    suggestions: [],
    severity: 'info',
    category: 'syntax'
  };
  
  // Detailed SQL analysis based on content
  if (upperLine.includes('SELECT')) {
    if (upperLine.includes('XMLELEMENT')) {
      sqlAnalysis.explanation = "SQL/XML function XMLELEMENT creates an XML element with the specified tag name. This is Oracle's SQL/XML functionality for generating XML content from relational data. The function takes an element name as the first parameter and content as subsequent parameters to create structured XML output. XMLELEMENT is part of Oracle's XMLType functionality and allows you to construct XML documents within SQL queries. The syntax is XMLELEMENT(element_name, content1, content2, ...) where element_name becomes the XML tag and content parameters become the tag's content or attributes.";
      sqlAnalysis.suggestions = [
        "Complete the XMLELEMENT function with proper closing syntax and content parameters",
        "Consider using XMLSerializer for complex XML generation and formatting",
        "Ensure proper XML namespace handling if working with namespaced XML",
        "Add proper XML content parameters after the element name - they can be column values or other XML functions",
        "Consider performance implications of XML generation in large result sets",
        "Use XMLAgg if you need to aggregate multiple XML elements",
        "Validate XML output format matches expected schema requirements"
      ];
      sqlAnalysis.category = "xml-functions";
    } else if (upperLine.includes('DISTINCT')) {
      sqlAnalysis.explanation = "SELECT DISTINCT clause removes duplicate rows from the result set. This operation can be expensive on large datasets as it requires sorting or hashing to identify duplicates.";
      sqlAnalysis.suggestions = [
        "Consider if DISTINCT is actually needed - sometimes proper JOINs eliminate duplicates",
        "Add indexes on the columns being selected for better performance",
        "Review if GROUP BY might be more appropriate for aggregation"
      ];
      sqlAnalysis.category = "performance";
    } else if (upperLine.includes('*')) {
      sqlAnalysis.explanation = "SELECT * retrieves all columns from the table(s). While convenient, this can impact performance and may return unnecessary data.";
      sqlAnalysis.suggestions = [
        "Specify only the columns you need instead of using SELECT *",
        "Consider the network overhead of transferring unused columns",
        "Be aware that SELECT * can break applications if table structure changes"
      ];
      sqlAnalysis.category = "best-practice";
      sqlAnalysis.severity = "warning";
    } else {
      sqlAnalysis.explanation = "SELECT clause specifies which columns to retrieve from the database. This is the foundation of data retrieval in SQL.";
      sqlAnalysis.suggestions = [
        "Use meaningful column aliases for better readability",
        "Consider the order of columns for optimal performance",
        "Ensure all selected columns are necessary for the query purpose"
      ];
    }
  } else if (upperLine.includes('FROM')) {
    if (upperLine.includes(',')) {
      sqlAnalysis.explanation = "Old-style comma-separated table join syntax (also called 'implicit join' or 'theta join'). This creates a Cartesian product between all listed tables, meaning every row from the first table is combined with every row from the second table, and so on. Without proper WHERE clause filtering, this can result in an enormous number of rows (table1_rows × table2_rows × ...). This syntax is deprecated and dangerous because it's easy to forget join conditions, leading to performance issues or incorrect results. The join conditions must be specified in the WHERE clause, making the query logic less clear than explicit JOIN syntax.";
      sqlAnalysis.suggestions = [
        "Replace comma joins with explicit JOIN syntax for better readability and safety",
        "Use INNER JOIN, LEFT JOIN, RIGHT JOIN, etc. to make join intentions explicitly clear",
        "Ensure proper WHERE conditions exist to avoid Cartesian products that can crash your database",
        "Modern JOIN syntax separates join conditions from filtering conditions, improving query clarity",
        "Explicit JOINs are easier to debug and maintain than comma-separated table lists",
        "Consider that explicit JOINs often provide better query optimization by the database engine",
        "Always verify join conditions exist for each table relationship to prevent accidental Cartesian products"
      ];
      sqlAnalysis.category = "joins";
      sqlAnalysis.severity = "warning";
    } else {
      sqlAnalysis.explanation = "FROM clause specifies the source table(s) for the query. This establishes the base dataset for the SELECT operation.";
      sqlAnalysis.suggestions = [
        "Use table aliases for better readability in complex queries",
        "Consider if indexes exist on the table for optimal performance",
        "Ensure table names are fully qualified in multi-database environments"
      ];
    }
  } else if (upperLine.includes('WHERE')) {
    if (upperLine.includes('(+)')) {
      sqlAnalysis.explanation = "Oracle-specific outer join syntax using (+) operator. This creates an outer join where the table with (+) includes NULLs when no matching records exist. The (+) symbol indicates which table should include NULL values for non-matching rows. For example, 'WHERE A.id (+) = B.id' creates a RIGHT OUTER JOIN, while 'WHERE A.id = B.id (+)' creates a LEFT OUTER JOIN. This syntax predates the ANSI JOIN syntax and is Oracle proprietary, making it non-portable to other database systems. The (+) operator can only be used on one side of the comparison and has limitations compared to modern JOIN syntax.";
      sqlAnalysis.suggestions = [
        "Replace Oracle-specific (+) syntax with standard LEFT JOIN or RIGHT JOIN for better portability",
        "Use explicit JOIN syntax: 'FROM table1 LEFT JOIN table2 ON table1.id = table2.id' instead of WHERE clause joins",
        "Consider performance implications of outer joins on large datasets - they can be slower than inner joins",
        "Modern JOIN syntax provides better query optimization opportunities",
        "ANSI JOIN syntax is more readable and self-documenting than (+) syntax",
        "Ensure proper indexing on join columns for optimal performance"
      ];
      sqlAnalysis.category = "joins";
      sqlAnalysis.severity = "warning";
    } else if (upperLine.includes('LIKE')) {
      sqlAnalysis.explanation = "LIKE operator performs pattern matching with wildcards. Can be performance-intensive, especially with leading wildcards.";
      sqlAnalysis.suggestions = [
        "Avoid leading wildcards (LIKE '%pattern') as they prevent index usage",
        "Consider full-text search for complex pattern matching",
        "Use = operator instead of LIKE when exact matches are needed"
      ];
      sqlAnalysis.category = "performance";
    } else if (upperLine.includes('IN')) {
      sqlAnalysis.explanation = "IN operator checks if a value matches any value in a list or subquery. Can be optimized with proper indexing.";
      sqlAnalysis.suggestions = [
        "Consider using EXISTS instead of IN for subqueries for better performance",
        "Ensure indexes exist on the columns being compared",
        "Be aware of NULL handling - IN doesn't match NULL values"
      ];
      sqlAnalysis.category = "performance";
    } else {
      sqlAnalysis.explanation = "WHERE clause filters rows based on specified conditions. This is crucial for query performance and result accuracy.";
      sqlAnalysis.suggestions = [
        "Ensure indexes exist on columns used in WHERE conditions",
        "Place most selective conditions first for better performance",
        "Consider the data distribution when writing conditions"
      ];
    }
  } else if (upperLine.includes('JOIN')) {
    if (upperLine.includes('LEFT')) {
      sqlAnalysis.explanation = "LEFT JOIN returns all rows from the left table and matching rows from the right table. Non-matching rows from the right table appear as NULL.";
      sqlAnalysis.suggestions = [
        "Ensure proper indexes exist on join columns",
        "Consider if INNER JOIN would be more appropriate",
        "Be aware of potential performance impact with large datasets"
      ];
      sqlAnalysis.category = "joins";
    } else if (upperLine.includes('INNER')) {
      sqlAnalysis.explanation = "INNER JOIN returns only rows that have matching values in both tables. This is the most common and usually most efficient join type.";
      sqlAnalysis.suggestions = [
        "Ensure indexes exist on join columns for optimal performance",
        "Consider join order for better query optimization",
        "Verify that the join condition is correct to avoid unexpected results"
      ];
      sqlAnalysis.category = "joins";
    } else {
      sqlAnalysis.explanation = "JOIN operation combines rows from two or more tables based on a related column between them.";
      sqlAnalysis.suggestions = [
        "Always specify the join type (INNER, LEFT, RIGHT, FULL) for clarity",
        "Ensure proper indexes exist on join columns",
        "Consider the cardinality of the join for performance optimization"
      ];
      sqlAnalysis.category = "joins";
    }
  } else if (upperLine.includes('ORDER BY')) {
    sqlAnalysis.explanation = "ORDER BY clause sorts the result set by one or more columns. This operation can be expensive on large datasets.";
    sqlAnalysis.suggestions = [
      "Consider if sorting is necessary - it adds processing overhead",
      "Use indexes on ORDER BY columns for better performance",
      "Limit the result set with LIMIT/TOP before sorting when possible"
    ];
    sqlAnalysis.category = "performance";
  } else if (upperLine.includes('GROUP BY')) {
    sqlAnalysis.explanation = "GROUP BY clause groups rows that have the same values in specified columns. Used with aggregate functions like COUNT, SUM, AVG.";
    sqlAnalysis.suggestions = [
      "Ensure all non-aggregate columns in SELECT are included in GROUP BY",
      "Consider composite indexes on GROUP BY columns",
      "Use HAVING clause for filtering groups, not WHERE"
    ];
    sqlAnalysis.category = "aggregation";
  } else if (upperLine.includes('HAVING')) {
    sqlAnalysis.explanation = "HAVING clause filters groups after GROUP BY is applied. It's used with aggregate functions to filter grouped results.";
    sqlAnalysis.suggestions = [
      "Use WHERE instead of HAVING for filtering individual rows",
      "Place conditions that don't require grouping in WHERE for better performance",
      "Consider the performance impact of complex HAVING conditions"
    ];
    sqlAnalysis.category = "aggregation";
  } else if (upperLine.includes('UNION')) {
    sqlAnalysis.explanation = "UNION combines the result sets of two or more SELECT statements and removes duplicates. UNION ALL keeps duplicates and is faster.";
    sqlAnalysis.suggestions = [
      "Use UNION ALL if duplicates are not a concern for better performance",
      "Ensure all SELECT statements have the same number and type of columns",
      "Consider if a single query with OR conditions might be more efficient"
    ];
    sqlAnalysis.category = "set-operations";
  } else if (upperLine.includes('CASE')) {
    sqlAnalysis.explanation = "CASE statement provides conditional logic in SQL. It evaluates conditions and returns different values based on the results.";
    sqlAnalysis.suggestions = [
      "Consider using COALESCE or NULLIF for simple NULL handling",
      "Ensure all CASE branches return compatible data types",
      "Be aware that complex CASE statements can impact performance"
    ];
    sqlAnalysis.category = "conditional";
  } else if (upperLine.includes('SUBQUERY') || upperLine.includes('EXISTS')) {
    sqlAnalysis.explanation = "Subqueries or EXISTS clauses perform nested queries. EXISTS is generally more efficient than IN for subqueries.";
    sqlAnalysis.suggestions = [
      "Consider using JOINs instead of subqueries for better performance",
      "Use EXISTS instead of IN for subqueries when checking for existence",
      "Be aware of correlated vs non-correlated subqueries and their performance implications"
    ];
    sqlAnalysis.category = "subqueries";
  } else if (upperLine.includes('CREATE')) {
    sqlAnalysis.explanation = "CREATE statement is used to create database objects like tables, indexes, views, or procedures.";
    sqlAnalysis.suggestions = [
      "Ensure proper data types and constraints are specified",
      "Consider adding appropriate indexes for query performance",
      "Use meaningful names that follow your database naming conventions"
    ];
    sqlAnalysis.category = "ddl";
  } else if (upperLine.includes('INSERT')) {
    sqlAnalysis.explanation = "INSERT statement adds new rows to a table. Performance can be optimized with bulk inserts and proper indexing.";
    sqlAnalysis.suggestions = [
      "Use bulk INSERT operations for better performance when adding multiple rows",
      "Consider disabling indexes during large bulk inserts",
      "Ensure proper error handling for constraint violations"
    ];
    sqlAnalysis.category = "dml";
  } else if (upperLine.includes('UPDATE')) {
    sqlAnalysis.explanation = "UPDATE statement modifies existing rows in a table. Always use WHERE clause to avoid updating all rows.";
    sqlAnalysis.suggestions = [
      "Always include a WHERE clause to avoid updating all rows",
      "Consider using JOINs in UPDATE statements for complex conditions",
      "Be aware of locking implications in multi-user environments"
    ];
    sqlAnalysis.category = "dml";
    sqlAnalysis.severity = "warning";
  } else if (upperLine.includes('DELETE')) {
    sqlAnalysis.explanation = "DELETE statement removes rows from a table. Always use WHERE clause to avoid deleting all rows.";
    sqlAnalysis.suggestions = [
      "Always include a WHERE clause to avoid deleting all rows",
      "Consider using TRUNCATE for removing all rows (faster but less safe)",
      "Be aware of foreign key constraints that might prevent deletion"
    ];
    sqlAnalysis.category = "dml";
    sqlAnalysis.severity = "warning";
  } else {
    // Generic SQL analysis with detailed breakdown
    let detailedExplanation = `SQL statement: ${trimmedLine}. `;
    let detailedSuggestions = [];
    
    // Analyze specific SQL elements in the line
    if (upperLine.includes('AND') || upperLine.includes('OR')) {
      detailedExplanation += "This line contains logical operators (AND/OR) that combine multiple conditions. AND requires all conditions to be true, while OR requires at least one condition to be true. The order of evaluation follows standard precedence rules where AND has higher precedence than OR.";
      detailedSuggestions.push("Use parentheses to make logical operator precedence explicit");
      detailedSuggestions.push("Consider the selectivity of each condition for optimal performance");
    }
    
    if (upperLine.includes('NULL')) {
      detailedExplanation += "This line involves NULL handling. NULL represents missing or unknown data in SQL and requires special handling with IS NULL or IS NOT NULL operators.";
      detailedSuggestions.push("Use IS NULL or IS NOT NULL instead of = NULL or != NULL");
      detailedSuggestions.push("Consider how NULL values affect your query results and joins");
    }
    
    if (upperLine.includes('=') && !upperLine.includes('IS')) {
      detailedExplanation += "This line contains an equality comparison operator. SQL uses = for equality testing between values.";
      detailedSuggestions.push("Ensure both sides of the comparison are of compatible data types");
      detailedSuggestions.push("Consider indexing on columns used in equality comparisons");
    }
    
    if (upperLine.includes('(') && upperLine.includes(')')) {
      detailedExplanation += "This line contains parentheses which are used for grouping expressions, function calls, or subqueries.";
      detailedSuggestions.push("Ensure proper parentheses matching and nesting");
      detailedSuggestions.push("Use parentheses to make operator precedence explicit");
    }
    
    // Add column/table references if found
    const columnPattern = /[A-Z_][A-Z0-9_]*\.[A-Z_][A-Z0-9_]*/gi;
    const columnRefs = trimmedLine.match(columnPattern);
    if (columnRefs) {
      detailedExplanation += ` The line references column(s): ${columnRefs.join(', ')}, which use table.column notation for clarity.`;
      detailedSuggestions.push("Table aliases improve readability and reduce ambiguity");
      detailedSuggestions.push("Consider if indexes exist on referenced columns for performance");
    }
    
    // If no specific analysis, provide general SQL guidance
    if (detailedSuggestions.length === 0) {
      detailedExplanation += "This line contains SQL code that performs database operations. Each SQL statement should be properly formatted and optimized for performance.";
      detailedSuggestions = [
        "Ensure proper SQL syntax and formatting for readability",
        "Consider performance implications of the operation on large datasets",
        "Add appropriate error handling if this is part of a larger procedure",
        "Use consistent naming conventions for tables and columns",
        "Consider if this line could benefit from indexing optimization"
      ];
    }
    
    sqlAnalysis.explanation = detailedExplanation;
    sqlAnalysis.suggestions = detailedSuggestions;
  }
  
  return {
    lineNumber: lineNumber,
    originalCode: originalLine,
    explanation: sqlAnalysis.explanation,
    suggestions: sqlAnalysis.suggestions,
    severity: sqlAnalysis.severity,
    category: sqlAnalysis.category
  };
}

// SQL Analysis Helper Functions
function detectSQLQueryType(code) {
  const upperCode = code.toUpperCase();
  if (upperCode.includes('SELECT')) return 'SELECT';
  if (upperCode.includes('INSERT')) return 'INSERT';
  if (upperCode.includes('UPDATE')) return 'UPDATE';
  if (upperCode.includes('DELETE')) return 'DELETE';
  if (upperCode.includes('CREATE')) return 'CREATE';
  if (upperCode.includes('ALTER')) return 'ALTER';
  if (upperCode.includes('DROP')) return 'DROP';
  return 'Unknown';
}

function extractTableNames(code) {
  const tables = [];
  const upperCode = code.toUpperCase();
  
  // Extract FROM clause tables
  const fromMatch = upperCode.match(/FROM\s+([A-Z_][A-Z0-9_]*)/gi);
  if (fromMatch) {
    fromMatch.forEach(match => {
      const table = match.replace(/FROM\s+/i, '').trim();
      if (table && !tables.includes(table)) {
        tables.push(table);
      }
    });
  }
  
  // Extract comma-separated tables
  const commaMatch = code.match(/FROM\s+([A-Z_][A-Z0-9_]*(?:\s*,\s*[A-Z_][A-Z0-9_]*)*)/gi);
  if (commaMatch) {
    commaMatch.forEach(match => {
      const tableList = match.replace(/FROM\s+/i, '').split(',');
      tableList.forEach(table => {
        const cleanTable = table.trim();
        if (cleanTable && !tables.includes(cleanTable)) {
          tables.push(cleanTable);
        }
      });
    });
  }
  
  return tables;
}

function extractJoinTypes(code) {
  const joins = [];
  const upperCode = code.toUpperCase();
  
  const joinTypes = ['INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'FULL JOIN', 'CROSS JOIN', 'LEFT OUTER JOIN', 'RIGHT OUTER JOIN'];
  
  joinTypes.forEach(joinType => {
    if (upperCode.includes(joinType)) {
      joins.push(joinType);
    }
  });
  
  // Check for Oracle outer join syntax
  if (code.includes('(+)')) {
    joins.push('Oracle Outer Join (+)');
  }
  
  return joins;
}

function extractSQLFunctions(code) {
  const functions = [];
  const upperCode = code.toUpperCase();
  
  const commonFunctions = [
    'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'DISTINCT',
    'XMLELEMENT', 'XMLROOT', 'XMLAGG', 'XMLFOREST',
    'COALESCE', 'NULLIF', 'CASE', 'DECODE', 'NVL', 'NVL2',
    'SUBSTRING', 'CHARINDEX', 'LEN', 'TRIM', 'LTRIM', 'RTRIM',
    'UPPER', 'LOWER', 'CONCAT', 'REPLACE',
    'GETDATE', 'SYSDATE', 'NOW', 'CURRENT_DATE', 'CURRENT_TIME',
    'DATE_FORMAT', 'DATE_ADD', 'DATE_SUB', 'EXTRACT'
  ];
  
  commonFunctions.forEach(func => {
    if (upperCode.includes(func)) {
      functions.push(func);
    }
  });
  
  return functions;
}

function generateIndexRecommendations(code) {
  const recommendations = [];
  const upperCode = code.toUpperCase();
  
  // Check for WHERE clause columns
  const whereMatch = upperCode.match(/WHERE\s+([A-Z_][A-Z0-9_]*)/gi);
  if (whereMatch) {
    whereMatch.forEach(match => {
      const column = match.replace(/WHERE\s+/i, '').trim();
      recommendations.push(`Consider index on ${column} for WHERE clause performance`);
    });
  }
  
  // Check for JOIN conditions
  const joinMatch = upperCode.match(/ON\s+([A-Z_][A-Z0-9_]*)/gi);
  if (joinMatch) {
    joinMatch.forEach(match => {
      const column = match.replace(/ON\s+/i, '').trim();
      recommendations.push(`Consider index on ${column} for JOIN performance`);
    });
  }
  
  // Check for ORDER BY
  if (upperCode.includes('ORDER BY')) {
    recommendations.push('Consider composite index for ORDER BY columns');
  }
  
  // Check for GROUP BY
  if (upperCode.includes('GROUP BY')) {
    recommendations.push('Consider composite index for GROUP BY columns');
  }
  
  return recommendations.length > 0 ? recommendations : ['No specific index recommendations based on current analysis'];
}

function assessQueryComplexity(code) {
  const upperCode = code.toUpperCase();
  let complexity = 0;
  
  // Add complexity points
  if (upperCode.includes('JOIN')) complexity += 2;
  if (upperCode.includes('SUBQUERY') || upperCode.includes('EXISTS')) complexity += 3;
  if (upperCode.includes('UNION')) complexity += 2;
  if (upperCode.includes('GROUP BY')) complexity += 1;
  if (upperCode.includes('ORDER BY')) complexity += 1;
  if (upperCode.includes('HAVING')) complexity += 2;
  if (upperCode.includes('CASE')) complexity += 1;
  if (upperCode.includes('XMLELEMENT')) complexity += 2;
  
  // Count number of tables
  const tableCount = (upperCode.match(/FROM\s+/g) || []).length;
  complexity += tableCount;
  
  if (complexity <= 3) return 'Simple';
  if (complexity <= 7) return 'Medium';
  return 'Complex';
}

function detectDatabaseDialect(code) {
  const upperCode = code.toUpperCase();
  
  // Oracle-specific features
  if (code.includes('(+)') || upperCode.includes('DUAL') || upperCode.includes('SYSDATE') || upperCode.includes('NVL')) {
    return 'Oracle';
  }
  
  // SQL Server-specific features
  if (code.includes('@@') || upperCode.includes('GETDATE') || upperCode.includes('ISNULL') || upperCode.includes('TOP')) {
    return 'SQL Server';
  }
  
  // MySQL-specific features
  if (upperCode.includes('LIMIT') || upperCode.includes('NOW()') || upperCode.includes('DATE_FORMAT')) {
    return 'MySQL';
  }
  
  // PostgreSQL-specific features
  if (upperCode.includes('SERIAL') || upperCode.includes('JSONB') || upperCode.includes('GENERATE_SERIES')) {
    return 'PostgreSQL';
  }
  
  return 'Generic SQL';
}

// Analyze code using LLM
async function analyzeCodeWithLLM(code, prompt, language) {
  try {
    const model = await getBestModel(language);
    console.log(`Using LLM model: ${model} for language: ${language}`);
    
    // Create language-specific system prompt
    let systemPrompt;
    if (language === 'sql') {
      console.log('Using specialized SQL analysis prompt');
      systemPrompt = `You are an expert SQL database developer, performance tuner, and security analyst with deep knowledge of Oracle, SQL Server, MySQL, and PostgreSQL. 

MANDATORY REQUIREMENTS:
1. ANALYZE EVERY SINGLE LINE of SQL code with detailed technical explanations
2. ALWAYS provide detailed explanations AND multiple specific suggestions for each line
3. User requests are ADDITIONAL to the mandatory line-by-line analysis
4. NEVER use generic phrases like "Consider adding comments for clarity"
5. ALWAYS provide specific, technical SQL explanations

CRITICAL REQUIREMENT: You MUST analyze EVERY SINGLE LINE of SQL code. Do not skip any lines. Even blank lines or simple statements need detailed analysis.

IMPORTANT: Always return a valid JSON object with the exact structure below. Do not include any text outside the JSON.

{
  "language": "sql",
  "overview": "Brief overview of what the SQL query does, its purpose, and database operations",
  "lineAnalysis": [
    {
      "lineNumber": 1,
      "originalCode": "exact original line of SQL code (including if it's blank or whitespace)",
      "explanation": "detailed explanation of what this SQL line does, including specific SQL concepts, functions, and operations",
      "suggestions": ["specific SQL improvement suggestion 1", "specific performance optimization suggestion 2"],
      "severity": "info|warning|error",
      "category": "performance|readability|security|best-practice|syntax|structure|joins|indexing|normalization"
    }
  ],
  "overallSuggestions": [
    "Query optimization recommendations",
    "Index suggestions for better performance", 
    "SQL best practices and conventions",
    "Database design improvements"
  ],
  "cleanedCode": "properly formatted SQL with correct indentation, capitalized keywords, and proper spacing",
  "refactoredCode": "optimized SQL query with better performance, proper joins, and improved readability",
  "securityIssues": [
    "SQL injection vulnerabilities",
    "Access control issues",
    "Data exposure risks"
  ],
  "performanceIssues": [
    "Inefficient JOIN operations", 
    "Missing index opportunities",
    "Suboptimal WHERE clause conditions",
    "N+1 query problems",
    "Cartesian product risks"
  ],
  "sqlSpecificAnalysis": {
    "queryType": "SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP",
    "tablesUsed": ["table1", "table2"],
    "joinTypes": ["INNER JOIN", "LEFT JOIN", "RIGHT JOIN", "FULL JOIN"],
    "functions": ["COUNT", "MAX", "MIN", "SUM", "AVG"],
    "indexRecommendations": ["CREATE INDEX idx_name ON table(column)", "Consider composite index on (col1, col2)"],
    "queryComplexity": "Simple|Medium|Complex",
    "estimatedRows": "Small (<1K)|Medium (1K-100K)|Large (100K+)",
    "databaseDialect": "MySQL|PostgreSQL|Oracle|SQL Server|Generic"
  },
  "codeQuality": {
    "readabilityScore": 8,
    "maintainabilityScore": 7,
    "performanceScore": 6,
    "securityScore": 9
  }
}

SQL ANALYSIS REQUIREMENTS:
1. **EVERY LINE**: Analyze each line individually, including keywords, table names, column names, conditions, functions
2. **SQL-Specific Comments**: Explain JOIN types, WHERE conditions, GROUP BY logic, ORDER BY implications
3. **Query Performance**: Identify potential performance bottlenecks, missing indexes, inefficient operations
4. **Security Analysis**: Check for SQL injection risks, privilege escalation, data exposure
5. **Database Best Practices**: Proper normalization, naming conventions, query optimization
6. **JOIN Analysis**: Explain different JOIN types and their implications
7. **Function Usage**: Analyze aggregate functions, window functions, string functions
8. **Index Recommendations**: Suggest specific indexes for better performance
9. **Query Optimization**: Provide optimized alternatives for better performance

SPECIFIC SQL ELEMENTS TO ANALYZE:
- SELECT clause: columns, aliases, functions, calculations
- FROM clause: tables, views, subqueries
- WHERE clause: conditions, operators, logic
- JOIN operations: types, conditions, performance implications
- GROUP BY: grouping logic, having conditions
- ORDER BY: sorting implications, performance impact
- Subqueries: efficiency, alternatives
- Functions: usage, performance, alternatives
- Data types: appropriateness, storage implications
- Constraints: primary keys, foreign keys, check constraints

Provide both a cleaned version (proper SQL formatting) and refactored version (with performance improvements).

EXAMPLE OF DETAILED SQL LINE ANALYSIS:
For a line like: "WHERE PH.PH_ADR_ID (+) = ADR.ADR_ID"
Your explanation should be: "Oracle-specific outer join syntax using (+) operator. This creates a LEFT OUTER JOIN where all records from ADR (ADDRESSES) table are included, even if there's no matching record in PH (PHONES) table. The (+) on the left side means 'include nulls from the left table when no match exists'."

For a line like: "SELECT XMLELEMENT("TOPMOSTSUBFARS","
Your explanation should be: "SQL/XML function XMLELEMENT creates an XML element with the tag name 'TOPMOSTSUBFARS'. This is part of Oracle's SQL/XML functionality for generating XML content from relational data. The function takes an element name and content to create structured XML output."

NEVER give generic responses like 'Consider adding comments for clarity'. Always provide specific, technical SQL explanations.`;
    } else {
      systemPrompt = `You are an expert code reviewer, educator, and code formatter. Analyze the provided ${language} code and provide comprehensive feedback based on the user's request.

CRITICAL REQUIREMENT: You MUST analyze EVERY SINGLE LINE of code. Do not skip any lines. Even blank lines or simple statements need analysis.

IMPORTANT: Always return a valid JSON object with the exact structure below. Do not include any text outside the JSON.

{
  "language": "${language}",
  "overview": "Brief overview of what the code does and its purpose",
  "lineAnalysis": [
    {
      "lineNumber": 1,
      "originalCode": "exact original line of code (including if it's blank or whitespace)",
      "explanation": "clear explanation of what this line does (for blank lines, explain their purpose in code structure)",
      "suggestions": ["specific improvement suggestion 1", "specific improvement suggestion 2"],
      "severity": "info|warning|error",
      "category": "performance|readability|security|best-practice|syntax|structure"
    }
  ],
  "overallSuggestions": [
    "Overall code structure improvements",
    "Best practices recommendations", 
    "Performance optimization suggestions"
  ],
  "cleanedCode": "properly formatted and cleaned version of the original code with correct indentation and spacing",
  "refactoredCode": "improved version with better practices, error handling, and optimizations",
  "securityIssues": [
    "Specific security vulnerability 1",
    "Specific security vulnerability 2"
  ],
  "performanceIssues": [
    "Specific performance bottleneck 1", 
    "Specific performance optimization opportunity 2"
  ],
  "codeQuality": {
    "readabilityScore": 8,
    "maintainabilityScore": 7,
    "performanceScore": 6,
    "securityScore": 9
  }
}

ANALYSIS REQUIREMENTS:
1. **EVERY LINE**: Analyze each line individually, including imports, declarations, blank lines, comments
2. **Line-by-Line Comments**: Provide detailed explanation for what each line accomplishes
3. **Code Formatting**: Proper indentation, spacing, and structure
4. **Best Practices**: Language-specific conventions and patterns
5. **Performance**: Optimization opportunities and bottlenecks
6. **Security**: Vulnerabilities and secure coding practices
5. **Readability**: Clear variable names, comments, and structure
6. **Error Handling**: Proper exception handling and edge cases
7. **Maintainability**: Code organization and modularity

Provide both a cleaned version (proper formatting) and refactored version (with improvements).`;
    }

    // Create enhanced user prompt for SQL
    let userPrompt;
    if (language === 'sql') {
      userPrompt = `MANDATORY REQUIREMENT: Provide detailed, technical SQL analysis for EVERY SINGLE LINE regardless of user request.

USER REQUEST: ${prompt}

CRITICAL INSTRUCTIONS FOR SQL ANALYSIS:
- ALWAYS provide detailed explanations and suggestions for every line
- User requests are ADDITIONAL to the mandatory line-by-line analysis
- For each line, explain:
  * What SQL feature/function is being used
  * How it works technically  
  * Performance implications
  * Potential optimizations
  * Security considerations
  * Database-specific features

DO NOT use generic phrases like "Consider adding comments for clarity". Instead, provide specific SQL technical details.

REMEMBER: You must analyze EVERY SINGLE LINE of the SQL code below. Count the lines and ensure your lineAnalysis array has an entry for each line number from 1 to the total number of lines.

SQL Code to analyze (${code.split('\n').length} lines total):
\`\`\`sql
${code}
\`\`\`

EXAMPLES OF REQUIRED DETAILED ANALYSIS:

For "SELECT XMLELEMENT(\"TOPMOSTSUBFARS\",":
- Explanation: "SQL/XML function XMLELEMENT creates an XML element with the tag name 'TOPMOSTSUBFARS'. This is Oracle's SQL/XML functionality for generating XML content from relational data. The function takes an element name as the first parameter and content as subsequent parameters to create structured XML output."
- Suggestions: ["Complete the XMLELEMENT function with proper closing syntax and content parameters", "Consider using XMLSerializer for complex XML generation", "Ensure proper XML namespace handling if needed", "Add proper XML content parameters after the element name"]

For "WHERE PH.PH_ADR_ID (+) = ADR.ADR_ID":
- Explanation: "Oracle-specific outer join syntax using (+) operator. This creates a LEFT OUTER JOIN where all records from ADR (ADDRESSES) table are included, even if there's no matching record in PH (PHONES) table. The (+) on the left side means 'include nulls from the left table when no match exists'."
- Suggestions: ["Replace Oracle-specific (+) syntax with standard LEFT JOIN for better portability", "Use explicit JOIN syntax: 'FROM ADDRESSES ADR LEFT JOIN PHONES PH ON PH.PH_ADR_ID = ADR.ADR_ID'", "Consider adding indexes on PH_ADR_ID and ADR_ID for better performance"]

For "FROM PHONES PH, ADDRESSES ADR":
- Explanation: "Old-style comma-separated table join syntax creating a Cartesian product between PHONES and ADDRESSES tables. This syntax is deprecated and can be dangerous as it creates all possible combinations of rows from both tables unless properly filtered in the WHERE clause."
- Suggestions: ["Replace comma joins with explicit JOIN syntax for better readability", "Use INNER JOIN or LEFT JOIN to make join intentions clear", "This syntax can create performance issues with large datasets", "Consider table aliases are good practice (PH, ADR)"]

MANDATORY: Every line must have detailed technical explanations and specific suggestions, not generic advice.`;
    } else {
      userPrompt = `${prompt}

REMEMBER: You must analyze EVERY SINGLE LINE of the code below. Count the lines and ensure your lineAnalysis array has an entry for each line number from 1 to the total number of lines.

Code to analyze (${code.split('\n').length} lines total):
\`\`\`${language}
${code}
\`\`\``;
    }

    console.log(`Sending ${language} analysis request to ${model}`);
    if (language === 'sql') {
      console.log('SQL-specific analysis enabled');
      console.log('Sample SQL code being analyzed:', code.substring(0, 100) + '...');
    }
    
    const response = await axios.post(`${process.env.OLLAMA_URL || 'http://localhost:11434'}/api/generate`, {
      model: model,
      prompt: `${systemPrompt}\n\nUser Request: ${userPrompt}`,
      stream: false,
      options: {
        temperature: 0.1,  // Lower temperature for more consistent analysis
        top_p: 0.8,
        top_k: 20,
        num_predict: 4096  // Increased for longer responses
      }
    });

    const responseText = response.data.response;
    console.log('LLM Response received, length:', responseText.length);
    
    // Try to parse JSON response
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsedResponse = JSON.parse(jsonMatch[0]);
        
        // Validate that all lines are analyzed
        const totalLines = code.split('\n').length;
        const analyzedLines = parsedResponse.lineAnalysis?.length || 0;
        
        console.log(`Line analysis validation: ${analyzedLines}/${totalLines} lines analyzed`);
        
        if (analyzedLines < totalLines) {
          console.warn(`Warning: Only ${analyzedLines} of ${totalLines} lines were analyzed by LLM`);
        }
        
        return parsedResponse;
      }
    } catch (parseError) {
      console.warn('Failed to parse LLM JSON response, creating structured response...');
    }

    // Fallback: create structured response from text
    console.log('Creating fallback response structure...');
    const lines = code.split('\n'); // Keep ALL lines including empty ones
    const lineAnalysis = lines.map((line, index) => {
      const trimmedLine = line.trim();
      
      if (trimmedLine === '') {
        return {
          lineNumber: index + 1,
          originalCode: line,
          explanation: "Empty line - provides visual separation and code structure",
          suggestions: ["Empty lines help with code readability"],
          severity: "info",
          category: "structure"
        };
      }
      
      // Enhanced SQL-specific analysis for fallback
      if (language === 'sql') {
        return analyzeSQLLine(trimmedLine, index + 1, line);
      }
      
      // Generic analysis for other languages
      return {
        lineNumber: index + 1,
        originalCode: line,
        explanation: `This line contains: ${trimmedLine}`,
        suggestions: ["Consider adding comments for clarity"],
        severity: "info",
        category: "readability"
      };
    });

    // Create language-specific fallback response
    const fallbackResponse = {
      language: language,
      overview: `This ${language} code has been analyzed. ${responseText.slice(0, 200)}...`,
      lineAnalysis: lineAnalysis,
      cleanedCode: code,
      refactoredCode: code,
      codeQuality: {
        readabilityScore: 7,
        maintainabilityScore: 7,
        performanceScore: 7,
        securityScore: 8
      }
    };

    // Add SQL-specific details
    if (language === 'sql') {
      fallbackResponse.overallSuggestions = [
        "Consider using explicit JOIN syntax instead of comma-separated tables",
        "Add appropriate indexes on frequently queried columns",
        "Review query performance and consider optimization",
        "Ensure proper error handling and transaction management",
        "Use parameterized queries to prevent SQL injection"
      ];
      fallbackResponse.securityIssues = [
        "Review for potential SQL injection vulnerabilities",
        "Ensure proper input validation and sanitization",
        "Consider using stored procedures for complex operations"
      ];
      fallbackResponse.performanceIssues = [
        "Review index usage and consider adding missing indexes",
        "Optimize JOIN operations and avoid Cartesian products",
        "Consider query execution plan optimization"
      ];
      fallbackResponse.sqlSpecificAnalysis = {
        queryType: detectSQLQueryType(code),
        tablesUsed: extractTableNames(code),
        joinTypes: extractJoinTypes(code),
        functions: extractSQLFunctions(code),
        indexRecommendations: generateIndexRecommendations(code),
        queryComplexity: assessQueryComplexity(code),
        estimatedRows: "Unknown - depends on data volume",
        databaseDialect: detectDatabaseDialect(code)
      };
    } else {
      fallbackResponse.overallSuggestions = [
        "Consider adding comments to improve code readability",
        "Review variable naming conventions",
        "Add error handling where appropriate"
      ];
      fallbackResponse.securityIssues = [];
      fallbackResponse.performanceIssues = [];
    }

    return fallbackResponse;

  } catch (error) {
    console.error('LLM Analysis Error:', error);
    
    // Check if it's a model not found error
    if (error.response && error.response.status === 404) {
      const model = await getBestModel(language);
      const errorMessage = error.response.data?.error || 'Model not found';
      if (errorMessage.includes('not found')) {
        throw new Error(`LLM model '${model}' not found. Please install it using: ollama pull ${model}`);
      }
    }
    
    // Check if it's a connection error
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      throw new Error('Cannot connect to Ollama service. Please ensure Ollama is installed and running on http://localhost:11434');
    }
    
    throw new Error(`Failed to analyze code with LLM: ${error.message}`);
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
    const rawExtractedCode = await extractCodeFromImage(req.file.buffer);
    
    if (!rawExtractedCode || rawExtractedCode.trim().length === 0) {
      return res.status(400).json({ 
        error: 'No code could be extracted from the image. Please ensure the image contains clear, readable code.' 
      });
    }

    // Check if Ollama is available and has models
    try {
      const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
      console.log(`Connecting to Ollama at: ${ollamaUrl}`);
      const response = await axios.get(`${ollamaUrl}/api/tags`);
      const availableModels = response.data.models || [];
      
      if (availableModels.length === 0) {
        return res.status(503).json({ 
          error: 'No LLM models are available. Please install Ollama and pull at least one model (e.g., "ollama pull llama3.2:latest").',
          suggestion: 'Run: ollama pull llama3.2:latest'
        });
      }
      
      console.log(`Available models: ${availableModels.map(m => m.name).join(', ')}`);
    } catch (error) {
      console.error('Failed to check Ollama availability:', error.message);
      console.error('Attempted URL:', ollamaUrl);
      
      const isRemote = ollamaUrl.includes('trycloudflare.com') || ollamaUrl.includes('https://');
      
      return res.status(503).json({ 
        error: 'Ollama service is not available. Please ensure Ollama is installed and running.',
        suggestion: isRemote 
          ? 'For remote deployment, ensure Ollama tunnel is running and accessible at: ' + ollamaUrl
          : 'Please install Ollama from https://ollama.ai and ensure it is running on localhost:11434',
        ollamaUrl: ollamaUrl
      });
    }
    
    if (!rawExtractedCode || rawExtractedCode.trim().length === 0) {
      return res.status(400).json({ error: 'No code detected in the image' });
    }

    // Detect programming language
    const detectedLanguage = detectLanguage(rawExtractedCode);
    console.log(`Detected language: ${detectedLanguage}`);

    // Clean and format the extracted code based on detected language
    console.log('Cleaning and formatting extracted code...');
    const cleanedCode = cleanExtractedCode(rawExtractedCode, detectedLanguage);

    // Analyze code with LLM
    console.log('Analyzing code with LLM...');
    const analysis = await analyzeCodeWithLLM(cleanedCode, prompt, detectedLanguage);

    const result = {
      extractedCode: cleanedCode,
      rawExtractedCode: rawExtractedCode, // Keep original for comparison
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
    const models = response.data.models || [];
    
    // Check for recommended models
    const modelNames = models.map(model => model.name);
    const recommendedModels = [
      'codellama:7b',
      'llama3.2:latest',
      'llama3.2:3b',
      'llama3.1:8b',
      'llama3:8b',
      'phi3:3.8b'
    ];
    
    const availableRecommended = recommendedModels.filter(model => modelNames.includes(model));
    const missingRecommended = recommendedModels.filter(model => !modelNames.includes(model));
    
    res.json({
      available: models,
      recommended: {
        available: availableRecommended,
        missing: missingRecommended
      },
      setup: {
        installCommands: missingRecommended.map(model => `ollama pull ${model}`),
        totalModels: models.length
      }
    });
  } catch (error) {
    console.error('Failed to fetch models:', error);
    res.status(500).json({ 
      error: 'Failed to fetch available models',
      message: error.message,
      setup: {
        checkOllama: 'Make sure Ollama is running: ollama serve',
        installModels: [
          'ollama pull codellama:13b',
          'ollama pull phi3:3.8b',
          'ollama pull llama3:8b'
        ]
      }
    });
  }
});

// Import tunnel reader
const { getTunnelStatus } = require('./tunnel-reader');

// Tunnel status endpoint
app.get('/api/tunnel-status', async (req, res) => {
  try {
    const tunnelInfo = await getTunnelStatus();
    res.json(tunnelInfo);
  } catch (error) {
    console.error('Error getting tunnel status:', error);
    
    // Fallback to basic status
    const fallbackInfo = {
      ollamaUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
      isRemote: (process.env.OLLAMA_URL || '').includes('trycloudflare.com'),
      backendPort: PORT,
      frontendPort: 4200,
      tunnels: {
        ollama: process.env.OLLAMA_URL && process.env.OLLAMA_URL.includes('trycloudflare.com') 
          ? process.env.OLLAMA_URL 
          : null,
        backend: null,
        frontend: null
      },
      shareableUrls: {
        backend: `http://localhost:${PORT}`,
        frontend: 'http://localhost:4200'
      },
      lastUpdated: new Date().toISOString(),
      error: 'Could not read tunnel logs'
    };
    
    res.json(fallbackInfo);
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
