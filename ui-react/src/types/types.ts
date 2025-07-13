export interface LineAnalysis {
  lineNumber: number;
  originalCode: string;
  explanation: string;
  suggestions: string[];
  severity: 'info' | 'warning' | 'error';
  category: 'performance' | 'readability' | 'security' | 'best-practice' | 'syntax';
}

export interface CodeAnalysis {
  language: string;
  overview: string;
  lineAnalysis: LineAnalysis[];
  overallSuggestions: string[];
  securityIssues: string[];
  performanceIssues: string[];
  codeQuality?: {
    readabilityScore: number;
    maintainabilityScore: number;
    performanceScore: number;
    securityScore: number;
  };
}

export interface AnalysisResult {
  extractedCode: string;
  rawExtractedCode?: string;
  detectedLanguage: string;
  analysis: CodeAnalysis;
  extractionMethod: string;
  timestamp: string;
  fromCache?: boolean;
}

export interface ExtractionMethod {
  id: string;
  name: string;
  description: string;
  type?: string;
  confidence?: string;
  speed?: string;
  cost?: string;
  recommended?: boolean;
  requiresVisionModel?: boolean;
  model?: string;
  technology?: string;
}

export interface AnalysisMethod {
  id: string;
  name: string;
  description: string;
  speed?: string;
  accuracy?: string;
  cost?: string;
  recommended?: boolean;
  capabilities?: string[];
  model?: string;
  technology?: string;
}