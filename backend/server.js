const express = require('express');
const cors = require('cors');
const multer = require('multer');
const Tesseract = require('tesseract.js');
const axios = require('axios');
// const sharp = require('sharp'); // Temporarily disabled due to platform issues
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
    console.log('📁 File received:', {
      fieldname: file.fieldname,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size
    });
    
    // Check MIME type
    if (file.mimetype && file.mimetype.startsWith('image/')) {
      cb(null, true);
      return;
    }
    
    // Fallback: check file extension if MIME type is missing or incorrect
    const allowedExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp'];
    const fileExtension = file.originalname ? file.originalname.toLowerCase().split('.').pop() : '';
    
    if (allowedExtensions.includes(`.${fileExtension}`)) {
      console.log('✅ Accepting file based on extension:', fileExtension);
      cb(null, true);
      return;
    }
    
    console.log('❌ Rejecting file:', file.mimetype, fileExtension);
    cb(new Error(`Only image files are allowed! Received: ${file.mimetype || 'unknown mimetype'}, extension: ${fileExtension}`), false);
  }
});

const linguist = require('linguist-js');

// Language detection using GitHub's Linguist (super accurate)
async function detectLanguage(code) {
  try {
    // Use linguist-js for highly accurate detection (same as GitHub)
    const results = await linguist(code, 'code-snippet');
    
    if (results && results.length > 0) {
      const detected = results[0].name;
      
      // Map linguist results to our expected format
      const languageMap = {
        'JavaScript': 'javascript',
        'Python': 'python',
        'Java': 'java',
        'TypeScript': 'typescript',
        'C++': 'cpp',
        'C': 'cpp',
        'C#': 'csharp',
        'PHP': 'php',
        'Ruby': 'ruby',
        'Go': 'go',
        'SQL': 'sql',
        'HTML': 'html',
        'CSS': 'css',
        'Shell': 'bash',
        'Bash': 'bash',
        'PowerShell': 'powershell',
        'Kotlin': 'kotlin',
        'Swift': 'swift',
        'Rust': 'rust',
        'Scala': 'scala',
        'Objective-C': 'objc'
      };

      const mappedLang = languageMap[detected] || detected.toLowerCase();
      console.log(`Language detected by Linguist: ${detected} -> ${mappedLang} (confidence: ${results[0].probability})`);
      return mappedLang;
    }
  } catch (error) {
    console.warn('Linguist failed, using fallback patterns:', error.message);
  }

  // Enhanced fallback patterns for specific problem cases
  console.log('Using enhanced fallback pattern detection...');
  
  // Java-specific patterns (strongest indicators first)
  if (/private\s+static\s+native.*throws|public\s+static\s+void\s+main\s*\(.*String\[\]|import\s+java\.|package\s+[a-zA-Z][a-zA-Z0-9]*(\.[a-zA-Z][a-zA-Z0-9]*)*\s*;/i.test(code)) {
    console.log('Detected Java by JNI/main/package patterns');
    return 'java';
  }
  
  // More Java patterns
  if (/public\s+class\s+\w+|System\.(out|err)\.(print|println)|throws\s+\w*Exception|@Override|@Deprecated/i.test(code)) {
    console.log('Detected Java by class/System/annotation patterns');
    return 'java';
  }
  
  // Python patterns
  if (/def\s+\w+\s*\(|from\s+\w+\s+import|if\s+__name__\s*==\s*['"]__main__|PyAudio|import\s+\w+/i.test(code)) {
    console.log('Detected Python by def/import patterns');
    return 'python';
  }
  
  // SQL patterns (must not have programming language constructs)
  if (/SELECT\s+.*\s+FROM\s+|INSERT\s+INTO\s+|UPDATE\s+.*\s+SET\s+|DELETE\s+FROM\s+|CREATE\s+TABLE\s+/i.test(code) && 
      !/def\s+|class\s+|import\s+|function\s+|public\s+|private\s+/i.test(code)) {
    console.log('Detected SQL by query patterns');
    return 'sql';
  }
  
  // JavaScript patterns
  if (/function\s+\w+\s*\(|const\s+\w+\s*=|let\s+\w+\s*=|console\.log\s*\(|=>\s*{|require\s*\(/i.test(code)) {
    console.log('Detected JavaScript by function/const patterns');
    return 'javascript';
  }
  
  // TypeScript patterns
  if (/interface\s+\w+|type\s+\w+\s*=|:\s*(string|number|boolean)|public\s+\w+\s*:|private\s+\w+\s*:/i.test(code)) {
    console.log('Detected TypeScript by interface/type patterns');
    return 'typescript';
  }
  
  // C/C++ patterns
  if (/#include\s*<.*>|int\s+main\s*\(|std::|cout\s*<<|printf\s*\(|scanf\s*\(/i.test(code)) {
    console.log('Detected C/C++ by include/main patterns');
    return 'cpp';
  }
  
  // C# patterns
  if (/using\s+System|Console\.WriteLine|namespace\s+\w+|public\s+static\s+void\s+Main/i.test(code)) {
    console.log('Detected C# by System/namespace patterns');
    return 'csharp';
  }
  
  // Ruby patterns
  if (/def\s+\w+|puts\s+|elsif\s+|unless\s+|module\s+\w+|attr_accessor|\.each\s*\{/i.test(code)) {
    console.log('Detected Ruby by def/puts patterns');
    return 'ruby';
  }
  
  // Go patterns
  if (/package\s+main|func\s+main\s*\(|fmt\.Print|import\s*\(/i.test(code)) {
    console.log('Detected Go by package/func patterns');
    return 'go';
  }
  
  // PHP patterns
  if (/<\?php|\$\w+\s*=|echo\s+/i.test(code)) {
    console.log('Detected PHP by <?php/$ patterns');
    return 'php';
  }

  console.log('Could not detect language, returning unknown');
  return 'unknown';
}

// Get best LLM model for the detected language
async function getBestModel(language) {
  const modelMapping = {
    python: 'llama3.2:1b',
    javascript: 'llama3.2:1b', 
    typescript: 'llama3.2:1b',
    java: 'llama3.2:1b',
    sql: 'llama3.2:1b',
    csharp: 'llama3.2:1b',
    cpp: 'llama3.2:1b',
    php: 'llama3.2:1b',
    ruby: 'llama3.2:1b',
    go: 'llama3.2:1b',
    unknown: 'llama3.2:1b'
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
      'tinyllama:1.1b',
      'gemma:2b',
      'codegemma:2b',
      'smollm2:latest',
      'qwen2.5-coder:1.5b',
      'llama3.2:1b',
      'phi3:3.8b',
      'llama3.2:3b',
      'qwen2.5-coder:3b',
      'llama3.2:latest',
      'codellama:7b'
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
    // Sharp is disabled due to platform issues, return original buffer
    console.log('Image preprocessing skipped (Sharp disabled)');
    return buffer;
    
  } catch (error) {
    console.error('Image preprocessing error:', error);
    return buffer; // Return original if preprocessing fails
  }
}

// Alternative preprocessing for low-quality images
async function preprocessImageAdvanced(buffer) {
  try {
    // Sharp is disabled due to platform issues, return original buffer
    console.log('Advanced image preprocessing skipped (Sharp disabled)');
    return buffer;
    
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

// Enhanced image extraction with method selection
async function extractCodeFromImage(imageBuffer, extractionMethod = 'tesseract-multi') {
  try {
    console.log(`Using extraction method: ${extractionMethod}`);
    
    switch (extractionMethod) {
      case 'tesseract-standard':
        const standardResult = await extractWithStandardPreprocessing(imageBuffer);
        return standardResult.text;
        
      case 'tesseract-advanced':
        const advancedResult = await extractWithAdvancedPreprocessing(imageBuffer);
        return advancedResult.text;
        
      case 'tesseract-high-contrast':
        const contrastResult = await extractWithHighContrastPreprocessing(imageBuffer);
        return contrastResult.text;
        
      case 'llm-vision':
        return await extractWithLLMVision(imageBuffer);
        
      case 'tesseract-multi':
      default:
        // Original multi-strategy approach
        const results = await Promise.allSettled([
          extractWithStandardPreprocessing(imageBuffer),
          extractWithAdvancedPreprocessing(imageBuffer),
          extractWithHighContrastPreprocessing(imageBuffer)
        ]);
        
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
    }
    
  } catch (error) {
    console.error('Extraction Error:', error);
    throw new Error(`Failed to extract text using ${extractionMethod}: ${error.message}`);
  }
}

// Standard preprocessing OCR
async function extractWithStandardPreprocessing(imageBuffer) {
  const processedImage = await preprocessImage(imageBuffer);
  
  const result = await Promise.race([
    Tesseract.recognize(processedImage, 'eng', {
      logger: m => {
        if (m.status === 'recognizing text' && m.progress < 1) {
          // Only log every 20% progress to reduce spam
          if (m.progress % 0.2 < 0.05) {
            console.log(`Standard OCR: ${Math.round(m.progress * 100)}%`);
          }
        } else {
          console.log('Standard OCR:', m.status);
        }
      },
      tessedit_pageseg_mode: Tesseract.PSM.AUTO,
      tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789{}[]().,;:=+-*/<>?!@#$%^&|\\~`"\' \n\t_',
      tessedit_ocr_engine_mode: Tesseract.OEM.LSTM_ONLY,
      preserve_interword_spaces: 1
    }),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('OCR timeout after 60 seconds')), 60000)
    )
  ]);
  
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

// LLM vision-based extraction using local vision models
async function extractWithLLMVision(imageBuffer) {
  try {
    // Convert image to base64
    const base64Image = imageBuffer.toString('base64');
    
    // Check for available vision models (prioritize faster, smaller models)
    const visionModels = [
      'qwen2-vl:2b',           // Fastest option
      'qwen2.5-coder:1.5b',   // Very fast for code
      'qwen2.5-coder:3b',     // Good balance
      'moondream:latest',      // Lightweight option
      'qwen2-vl:7b', 
      'qwen2.5-coder:7b',
      'llava:7b',
      'qwen2-vl:latest',
      'qwen2.5-coder:latest',
      'llava:latest',
      'bakllava:latest',
      'llava:13b',
      'llama3.2-vision:11b'   // Moved to last (slowest)
    ];
    let selectedModel = null;
    
    try {
      const modelsResponse = await axios.get(`${process.env.OLLAMA_URL || 'http://localhost:11434'}/api/tags`);
      const availableModels = modelsResponse.data.models.map(m => m.name);
      selectedModel = visionModels.find(model => availableModels.includes(model));
    } catch (error) {
      console.warn('Could not fetch available models, trying default vision model');
      selectedModel = 'qwen2-vl:latest';
    }
    
    if (!selectedModel) {
      throw new Error('No vision models available. Please install a vision model like: ollama pull qwen2-vl:latest');
    }
    
    console.log(`Using vision model: ${selectedModel}`);
    
    // Use Qwen vision to extract code with optimized prompt
    const isQwenModel = selectedModel.includes('qwen');
    const extractionPrompt = isQwenModel 
      ? `Extract the programming code from this image. Return ONLY the code text with proper formatting and indentation. Do not include explanations, descriptions, or markdown formatting - just the raw code exactly as it appears in the image.`
      : `Please extract the exact code from this image. Return only the code text, nothing else. Preserve all formatting, indentation, and special characters exactly as shown.`;

    const response = await axios.post(`${process.env.OLLAMA_URL || 'http://localhost:11434'}/api/generate`, {
      model: selectedModel,
      prompt: extractionPrompt,
      images: [base64Image],
      stream: false,
      options: {
        temperature: 0,  // Very low temperature for exact extraction
        top_p: 0.3,     // Increased for faster generation
        top_k: 20,      // Increased for faster generation
        num_predict: 2048,  // Reduced for faster processing
        repeat_penalty: 1.0
      }
    }, {
      timeout: 120000  // 2 minute timeout for optimized processing
    });
    
    let extractedText = response.data.response.trim();
    
    // Post-process Qwen output to clean up common artifacts
    if (isQwenModel) {
      // Remove common Qwen artifacts and formatting
      extractedText = extractedText
        .replace(/^```[\w]*\n?/gm, '') // Remove opening code blocks
        .replace(/\n?```$/gm, '') // Remove closing code blocks
        .replace(/^Here (?:is|are) the (?:code|programming code|extracted code)[:\s]*/i, '') // Remove intro text
        .replace(/^(?:The )?(?:extracted )?code (?:from the image )?is[:\s]*/i, '') // Remove intro text
        .replace(/^This (?:image )?(?:shows|contains|displays)[:\s]*/i, '') // Remove description
        .trim();
    }
    
    if (!extractedText || extractedText.length < 10) {
      throw new Error('Vision model extraction returned insufficient text');
    }
    
    console.log(`${isQwenModel ? 'Qwen' : 'LLM'} Vision extracted ${extractedText.length} characters`);
    return extractedText;
    
  } catch (error) {
    console.error('LLM Vision extraction failed:', error);
    
    if (error.response && error.response.status === 404) {
      throw new Error(`Vision model not found. Please install a vision model: ollama pull qwen2-vl:latest`);
    }
    
    if (error.code === 'ECONNREFUSED') {
      throw new Error('Cannot connect to Ollama service. Please ensure Ollama is running.');
    }
    
    throw new Error(`LLM vision extraction failed: ${error.message}`);
  }
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

// Enhanced code analysis for different programming languages
function analyzeCodeLine(trimmedLine, lineNumber, originalLine, language) {
  const analysis = {
    lineNumber: lineNumber,
    originalCode: originalLine,
    explanation: '',
    suggestions: [],
    severity: 'info',
    category: 'readability'
  };

  // Language-specific analysis
  switch (language.toLowerCase()) {
    case 'java':
      return analyzeJavaLine(trimmedLine, lineNumber, originalLine);
    case 'python':
      return analyzePythonLine(trimmedLine, lineNumber, originalLine);
    case 'javascript':
    case 'js':
      return analyzeJavaScriptLine(trimmedLine, lineNumber, originalLine);
    case 'c':
    case 'cpp':
    case 'c++':
      return analyzeCLine(trimmedLine, lineNumber, originalLine);
    case 'typescript':
    case 'ts':
      return analyzeTypeScriptLine(trimmedLine, lineNumber, originalLine);
    default:
      return analyzeGenericLine(trimmedLine, lineNumber, originalLine, language);
  }
}

function analyzeJavaLine(trimmedLine, lineNumber, originalLine) {
  const analysis = {
    lineNumber: lineNumber,
    originalCode: originalLine,
    explanation: '',
    suggestions: [],
    severity: 'info',
    category: 'readability'
  };

  if (trimmedLine.includes('native') && trimmedLine.includes('throws')) {
    analysis.explanation = "Native method declaration with JNI (Java Native Interface). This declares a method implemented in native code (C/C++) that can throw exceptions. The '@' symbol appears to be a formatting artifact from OCR extraction.";
    analysis.suggestions = [
      "Verify the method signature syntax - remove any OCR artifacts like '@' symbols",
      "Ensure proper JNI library loading with System.loadLibrary()",
      "Add proper exception handling for native method calls",
      "Consider thread safety implications when calling native methods"
    ];
    analysis.category = "native-interface";
    analysis.severity = "warning";
  } else if (trimmedLine.includes('private static')) {
    analysis.explanation = "Private static method declaration. This method belongs to the class and cannot be accessed from outside the class.";
    analysis.suggestions = [
      "Consider if this method should be package-private or protected if needed by other classes",
      "Ensure method name follows camelCase convention",
      "Add proper JavaDoc documentation for static utility methods"
    ];
    analysis.category = "access-modifiers";
  } else if (trimmedLine.includes('public class')) {
    analysis.explanation = "Public class declaration. This class is accessible from any other class.";
    analysis.suggestions = [
      "Ensure class name follows PascalCase convention",
      "Add class-level JavaDoc documentation",
      "Consider if the class should be final if not intended for inheritance"
    ];
    analysis.category = "class-design";
  } else {
    analysis.explanation = `Java code line: ${trimmedLine}`;
    analysis.suggestions = [
      "Follow Java naming conventions (camelCase for methods/variables, PascalCase for classes)",
      "Add appropriate access modifiers",
      "Consider adding JavaDoc comments for public methods"
    ];
  }

  return analysis;
}

function analyzePythonLine(trimmedLine, lineNumber, originalLine) {
  const analysis = {
    lineNumber: lineNumber,
    originalCode: originalLine,
    explanation: '',
    suggestions: [],
    severity: 'info',
    category: 'readability'
  };

  if (trimmedLine.startsWith('def ')) {
    analysis.explanation = "Function definition in Python. Uses 'def' keyword to declare a function.";
    analysis.suggestions = [
      "Add type hints for parameters and return value",
      "Include a docstring to describe the function's purpose",
      "Follow snake_case naming convention for function names"
    ];
    analysis.category = "function-definition";
  } else if (trimmedLine.startsWith('class ')) {
    analysis.explanation = "Class definition in Python. Defines a new class type.";
    analysis.suggestions = [
      "Follow PascalCase naming convention for class names",
      "Add a class docstring",
      "Consider inheritance and composition patterns"
    ];
    analysis.category = "class-design";
  } else if (trimmedLine.startsWith('import ') || trimmedLine.startsWith('from ')) {
    analysis.explanation = "Import statement to bring in external modules or specific functions/classes.";
    analysis.suggestions = [
      "Group imports: standard library, third-party, local imports",
      "Use absolute imports when possible",
      "Consider using 'from module import specific_function' for better clarity"
    ];
    analysis.category = "imports";
  } else {
    analysis.explanation = `Python code line: ${trimmedLine}`;
    analysis.suggestions = [
      "Follow PEP 8 style guidelines",
      "Use meaningful variable names",
      "Keep lines under 79 characters when possible"
    ];
  }

  return analysis;
}

function analyzeJavaScriptLine(trimmedLine, lineNumber, originalLine) {
  const analysis = {
    lineNumber: lineNumber,
    originalCode: originalLine,
    explanation: '',
    suggestions: [],
    severity: 'info',
    category: 'readability'
  };

  if (trimmedLine.includes('function')) {
    analysis.explanation = "Function declaration or expression in JavaScript.";
    analysis.suggestions = [
      "Consider using arrow functions for concise syntax",
      "Add JSDoc comments for function documentation",
      "Use const for function expressions to prevent reassignment"
    ];
    analysis.category = "function-definition";
  } else if (trimmedLine.includes('var ')) {
    analysis.explanation = "Variable declaration using 'var' keyword.";
    analysis.suggestions = [
      "Consider using 'let' or 'const' instead of 'var' for block scoping",
      "Use 'const' for values that won't be reassigned",
      "Use 'let' for variables that will be reassigned"
    ];
    analysis.category = "variable-declaration";
    analysis.severity = "warning";
  } else if (trimmedLine.includes('===') || trimmedLine.includes('!==')) {
    analysis.explanation = "Strict equality/inequality comparison operator.";
    analysis.suggestions = [
      "Good use of strict equality - prevents type coercion issues",
      "Continue using === and !== for reliable comparisons"
    ];
    analysis.category = "comparison";
  } else {
    analysis.explanation = `JavaScript code line: ${trimmedLine}`;
    analysis.suggestions = [
      "Use semicolons consistently",
      "Follow camelCase naming convention",
      "Consider using modern ES6+ features"
    ];
  }

  return analysis;
}

function analyzeCLine(trimmedLine, lineNumber, originalLine) {
  const analysis = {
    lineNumber: lineNumber,
    originalCode: originalLine,
    explanation: '',
    suggestions: [],
    severity: 'info',
    category: 'readability'
  };

  if (trimmedLine.includes('#include')) {
    analysis.explanation = "Preprocessor directive to include header files.";
    analysis.suggestions = [
      "Use angle brackets <> for system headers, quotes \"\" for local headers",
      "Include only necessary headers to reduce compilation time",
      "Consider forward declarations when possible"
    ];
    analysis.category = "preprocessor";
  } else if (trimmedLine.includes('malloc') || trimmedLine.includes('free')) {
    analysis.explanation = "Dynamic memory allocation/deallocation.";
    analysis.suggestions = [
      "Always check malloc return value for NULL",
      "Match every malloc with a corresponding free",
      "Consider using calloc for zero-initialized memory"
    ];
    analysis.category = "memory-management";
    analysis.severity = "warning";
  } else if (trimmedLine.includes('printf') || trimmedLine.includes('scanf')) {
    analysis.explanation = "Standard I/O function for formatted input/output.";
    analysis.suggestions = [
      "Use safer alternatives like snprintf for bounded output",
      "Validate format specifiers match argument types",
      "Consider using fgets instead of scanf for string input"
    ];
    analysis.category = "input-output";
  } else {
    analysis.explanation = `C/C++ code line: ${trimmedLine}`;
    analysis.suggestions = [
      "Follow consistent naming conventions",
      "Add proper error handling",
      "Consider const correctness"
    ];
  }

  return analysis;
}

function analyzeTypeScriptLine(trimmedLine, lineNumber, originalLine) {
  const analysis = {
    lineNumber: lineNumber,
    originalCode: originalLine,
    explanation: '',
    suggestions: [],
    severity: 'info',
    category: 'readability'
  };

  if (trimmedLine.includes('interface')) {
    analysis.explanation = "TypeScript interface definition for type checking.";
    analysis.suggestions = [
      "Use PascalCase for interface names",
      "Consider extending interfaces for code reuse",
      "Add JSDoc comments for interface documentation"
    ];
    analysis.category = "type-definition";
  } else if (trimmedLine.includes(': ') && (trimmedLine.includes('string') || trimmedLine.includes('number') || trimmedLine.includes('boolean'))) {
    analysis.explanation = "Type annotation providing compile-time type checking.";
    analysis.suggestions = [
      "Good use of type annotations for better code safety",
      "Consider using union types when appropriate",
      "Use readonly for immutable properties"
    ];
    analysis.category = "type-annotation";
  } else if (trimmedLine.includes('any')) {
    analysis.explanation = "Using 'any' type which disables type checking.";
    analysis.suggestions = [
      "Avoid 'any' type when possible - use specific types",
      "Consider using 'unknown' for better type safety",
      "Use union types or generics instead of 'any'"
    ];
    analysis.category = "type-safety";
    analysis.severity = "warning";
  } else {
    analysis.explanation = `TypeScript code line: ${trimmedLine}`;
    analysis.suggestions = [
      "Use strict type checking for better code quality",
      "Leverage TypeScript's type inference when possible",
      "Add type annotations for public APIs"
    ];
  }

  return analysis;
}

function analyzeGenericLine(trimmedLine, lineNumber, originalLine, language) {
  const analysis = {
    lineNumber: lineNumber,
    originalCode: originalLine,
    explanation: '',
    suggestions: [],
    severity: 'info',
    category: 'readability'
  };

  // Generic analysis based on common patterns
  if (trimmedLine.includes('//') || trimmedLine.includes('#') || trimmedLine.includes('/*')) {
    analysis.explanation = "Comment line providing code documentation or explanation.";
    analysis.suggestions = [
      "Ensure comments are clear and add value",
      "Update comments when code changes",
      "Consider using more descriptive variable names instead of comments"
    ];
    analysis.category = "documentation";
  } else if (trimmedLine.includes('=')) {
    analysis.explanation = "Assignment or comparison operation.";
    analysis.suggestions = [
      "Use meaningful variable names",
      "Consider const/final for values that don't change",
      "Ensure proper operator precedence"
    ];
    analysis.category = "assignment";
  } else if (trimmedLine.includes('if') || trimmedLine.includes('while') || trimmedLine.includes('for')) {
    analysis.explanation = "Control flow statement for conditional execution or loops.";
    analysis.suggestions = [
      "Keep conditions simple and readable",
      "Consider extracting complex conditions into well-named variables",
      "Ensure proper error handling in loops"
    ];
    analysis.category = "control-flow";
  } else if (trimmedLine.includes('{') || trimmedLine.includes('}')) {
    analysis.explanation = "Code block delimiter defining scope boundaries.";
    analysis.suggestions = [
      "Maintain consistent indentation",
      "Keep blocks focused on a single responsibility",
      "Consider extracting large blocks into separate functions"
    ];
    analysis.category = "structure";
  } else {
    analysis.explanation = `${language} code line containing: ${trimmedLine}`;
    analysis.suggestions = [
      "Follow language-specific naming conventions",
      "Add appropriate documentation",
      "Consider code readability and maintainability"
    ];
  }

  return analysis;
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
      console.log('Using simplified SQL analysis prompt');
      systemPrompt = `You are an expert SQL database developer. Analyze the provided SQL code quickly and provide a structured analysis.

Return a JSON object with this structure:
{
  "language": "sql",
  "overview": "Brief overview of the SQL query",
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
      systemPrompt = `Analyze this ${language} code. Return JSON:
{
  "language": "${language}",
  "overview": "what the code does",
  "lineAnalysis": [{"lineNumber": 1, "originalCode": "line", "explanation": "brief", "suggestions": ["fix"], "severity": "info", "category": "syntax"}],
  "overallSuggestions": ["tips"],
  "securityIssues": ["issues"],
  "performanceIssues": ["issues"]
}
Be very brief.`;
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
      
      // Language-specific analysis for other languages
      return analyzeCodeLine(trimmedLine, index + 1, line, language);
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
app.post('/api/analyze', upload.array('images', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const { 
      prompt = 'Explain this code and provide suggestions for improvement',
      extractionMethod = 'tesseract-standard'
    } = req.body;
    
    // Generate cache key including extraction method
    const cacheKey = `${req.files[0].buffer.toString('base64').slice(0, 50)}_${prompt}_${extractionMethod}`;
    
    // Check cache first
    const cachedResult = cache.get(cacheKey);
    if (cachedResult) {
      return res.json({ ...cachedResult, fromCache: true });
    }

    // Extract code from image using selected method
    console.log(`Extracting code from image using method: ${extractionMethod}...`);
    const rawExtractedCode = await extractCodeFromImage(req.files[0].buffer, extractionMethod);
    
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
      
      return res.status(503).json({ 
        error: 'Ollama service is not available. Please ensure Ollama is installed and running.',
        suggestion: 'Please install Ollama from https://ollama.ai and ensure it is running on localhost:11434',
        ollamaUrl: ollamaUrl
      });
    }
    
    if (!rawExtractedCode || rawExtractedCode.trim().length === 0) {
      return res.status(400).json({ error: 'No code detected in the image' });
    }

    // Detect programming language
    const detectedLanguage = await detectLanguage(rawExtractedCode);
    console.log(`Detected language: ${detectedLanguage}`);

    // Clean and format the extracted code based on detected language
    console.log('Cleaning and formatting extracted code...');
    const cleanedCode = cleanExtractedCode(rawExtractedCode, detectedLanguage);

    // Analyze code with LLM
    console.log('Analyzing code with LLM...');
    const analysis = await Promise.race([
      analyzeCodeWithLLM(cleanedCode, prompt, detectedLanguage),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('LLM analysis timeout after 30 seconds')), 30000)
      )
    ]);

    const result = {
      extractedCode: cleanedCode,
      rawExtractedCode: rawExtractedCode, // Keep original for comparison
      detectedLanguage,
      analysis,
      extractionMethod,
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

// Get available extraction methods
app.get('/api/extraction-methods', (req, res) => {
  try {
    const methods = [
      {
        id: 'tesseract-multi',
        name: 'Tesseract Multi-Strategy (Default)',
        description: 'Uses multiple Tesseract preprocessing approaches and selects the best result',
        type: 'ocr',
        confidence: 'High',
        speed: 'Medium',
        cost: 'Free',
        recommended: true
      },
      {
        id: 'tesseract-standard',
        name: 'Tesseract Standard',
        description: 'Standard Tesseract OCR with basic preprocessing',
        type: 'ocr',
        confidence: 'Medium',
        speed: 'Fast',
        cost: 'Free'
      },
      {
        id: 'tesseract-advanced',
        name: 'Tesseract Advanced',
        description: 'Advanced preprocessing for low-quality images',
        type: 'ocr',
        confidence: 'Medium-High',
        speed: 'Medium',
        cost: 'Free'
      },
      {
        id: 'tesseract-high-contrast',
        name: 'Tesseract High Contrast',
        description: 'High contrast preprocessing for clear/dark images',
        type: 'ocr',
        confidence: 'Medium-High',
        speed: 'Medium',
        cost: 'Free'
      },
      {
        id: 'llm-vision',
        name: 'LLM Vision Model',
        description: 'Use Llama 3.2 Vision or Qwen Vision model for highly accurate code extraction',
        type: 'llm',
        confidence: 'Very High',
        speed: 'Slow',
        cost: 'Compute',
        requiresVisionModel: true
      }
    ];

    res.json({ 
      extractionMethods: methods,
      currentTools: {
        primaryOCR: 'Tesseract.js v5.0.4',
        imagePreprocessing: 'Sharp v0.32.6',
        languageDetection: 'linguist-js v2.9.2',
        visionModel: 'Llama 3.2 Vision (llama3.2-vision:11b) / Qwen Vision',
        analysis: 'Ollama LLM models'
      }
    });
  } catch (error) {
    console.error('Error fetching extraction methods:', error);
    res.status(500).json({ error: 'Failed to fetch extraction methods' });
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
