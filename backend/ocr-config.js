// OCR Configuration for different image types and quality levels
const OCR_CONFIG = {
  // High quality images (screenshots, clear photos)
  HIGH_QUALITY: {
    tessedit_pageseg_mode: 'PSM.AUTO',
    tessedit_ocr_engine_mode: 'OEM.LSTM_ONLY',
    tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789{}[]().,;:=+-*/<>?!@#$%^&|\\~`"\' \n\t_',
    preserve_interword_spaces: 1,
    user_defined_dpi: 300
  },
  
  // Medium quality images (phone photos, scanned documents)
  MEDIUM_QUALITY: {
    tessedit_pageseg_mode: 'PSM.SINGLE_BLOCK',
    tessedit_ocr_engine_mode: 'OEM.LSTM_ONLY',
    tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789{}[]().,;:=+-*/<>?!@#$%^&|\\~`"\' \n\t_',
    preserve_interword_spaces: 1,
    user_defined_dpi: 200,
    tessedit_write_images: 1 // Enable debug images
  },
  
  // Low quality images (blurry, low resolution)
  LOW_QUALITY: {
    tessedit_pageseg_mode: 'PSM.SINGLE_COLUMN',
    tessedit_ocr_engine_mode: 'OEM.LSTM_ONLY',
    tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789{}[]().,;:=+-*/<>?!@#$%^&|\\~`"\' \n\t_',
    preserve_interword_spaces: 1,
    user_defined_dpi: 150,
    tessedit_write_images: 1
  },
  
  // Code-specific optimizations
  CODE_OPTIMIZED: {
    tessedit_pageseg_mode: 'PSM.SINGLE_BLOCK',
    tessedit_ocr_engine_mode: 'OEM.LSTM_ONLY',
    tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789{}[]().,;:=+-*/<>?!@#$%^&|\\~`"\' \n\t_',
    preserve_interword_spaces: 1,
    user_defined_dpi: 300,
    // Code-specific Tesseract parameters
    textord_really_old_xheight: 1,
    textord_min_xheight: 10,
    preserve_interword_spaces: 1,
    tessedit_reject_alphas_in_num: 0 // Don't reject letters in numbers (useful for hex)
  }
};

// Image preprocessing configurations
const PREPROCESSING_CONFIG = {
  // Standard preprocessing for most images
  STANDARD: {
    resizeMultiplier: 2,
    maxWidth: 4000,
    maxHeight: 3000,
    sharpen: {
      sigma: 1.5,
      m1: 1.0,
      m2: 0.2,
      x1: 2,
      y2: 10,
      y3: 20
    },
    contrast: {
      multiplier: 1.2,
      offset: -10
    }
  },
  
  // Advanced preprocessing for low-quality images
  ADVANCED: {
    resizeMultiplier: 3,
    maxWidth: 5000,
    maxHeight: 4000,
    sharpen: {
      sigma: 2.0,
      m1: 1.2,
      m2: 0.1,
      x1: 3,
      y2: 15,
      y3: 25
    },
    contrast: {
      multiplier: 1.3,
      offset: -15
    },
    modulate: {
      brightness: 1.1,
      saturation: 0.8,
      hue: 0
    }
  },
  
  // High contrast preprocessing
  HIGH_CONTRAST: {
    resizeMultiplier: 2,
    maxWidth: 3000,
    maxHeight: 2000,
    threshold: 128,
    sharpen: {
      sigma: 1.0
    },
    contrast: {
      multiplier: 1.1,
      offset: 0
    }
  }
};

// Quality assessment thresholds
const QUALITY_THRESHOLDS = {
  HIGH_CONFIDENCE: 85,
  MEDIUM_CONFIDENCE: 70,
  LOW_CONFIDENCE: 50,
  MIN_TEXT_LENGTH: 10,
  MIN_WORD_COUNT: 3
};

// Common OCR mistakes and corrections for code
const CODE_CORRECTIONS = {
  // Common character substitutions
  'rn': 'm',
  'vv': 'w',
  'VV': 'W',
  '0': 'O', // Sometimes O is read as 0
  'l': 'I', // Sometimes I is read as l
  '|': 'I', // Pipe to I
  '1': 'l', // Sometimes l is read as 1
  
  // Common word corrections
  'prmt': 'print',
  'prmtln': 'println',
  'retum': 'return',
  'retum;': 'return;',
  'pubhc': 'public',
  'pnvate': 'private',
  'protectéd': 'protected',
  'strlng': 'String',
  'mteger': 'Integer',
  'booIean': 'boolean',
  'vo1d': 'void',
  'mam': 'main',
  'ciass': 'class',
  'lmport': 'import',
  'functlon': 'function',
  'const': 'const',
  'vanliable': 'variable'
};

module.exports = {
  OCR_CONFIG,
  PREPROCESSING_CONFIG,
  QUALITY_THRESHOLDS,
  CODE_CORRECTIONS
};