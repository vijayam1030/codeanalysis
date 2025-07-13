import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';

export interface CodeAnalysis {
  language: string;
  overview: string;
  lineAnalysis: LineAnalysis[];
  overallSuggestions: string[];
  cleanedCode?: string;
  refactoredCode?: string;
  securityIssues: string[];
  performanceIssues: string[];
  codeQuality?: {
    readabilityScore: number;
    maintainabilityScore: number;
    performanceScore: number;
    securityScore: number;
  };
}

export interface LineAnalysis {
  lineNumber: number;
  originalCode: string;
  explanation: string;
  suggestions: string[];
  severity: 'info' | 'warning' | 'error';
  category: 'performance' | 'readability' | 'security' | 'best-practice' | 'syntax';
}

export interface AnalysisResult {
  extractedCode: string;
  rawExtractedCode?: string;
  detectedLanguage: string;
  analysis: CodeAnalysis;
  timestamp: string;
  fromCache?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class CodeAnalyzerService {
  private readonly baseUrl = 'http://localhost:5000/api';
  private loadingSubject = new BehaviorSubject<boolean>(false);
  private analysisHistorySubject = new BehaviorSubject<AnalysisResult[]>([]);
  
  loading$ = this.loadingSubject.asObservable();
  analysisHistory$ = this.analysisHistorySubject.asObservable();

  constructor(private http: HttpClient) {
    this.loadAnalysisHistory();
  }

  analyzeImage(imageFile: File, prompt: string, extractionMethod: string = 'tesseract-standard', analysisMethod: string = 'comprehensive'): Observable<AnalysisResult> {
    const formData = new FormData();
    formData.append('images', imageFile);
    formData.append('prompt', prompt);
    formData.append('extractionMethod', extractionMethod);
    formData.append('analysisMethod', analysisMethod);

    this.loadingSubject.next(true);

    return new Observable<AnalysisResult>((observer: any) => {
      this.http.post<AnalysisResult>(`${this.baseUrl}/analyze`, formData)
        .subscribe({
          next: (result: AnalysisResult) => {
            this.loadingSubject.next(false);
            this.addToHistory(result);
            observer.next(result);
            observer.complete();
          },
          error: (error: any) => {
            this.loadingSubject.next(false);
            observer.error(error);
          }
        });
    });
  }

  getAvailableModels(): Observable<any> {
    return this.http.get(`${this.baseUrl}/models`);
  }

  checkHealth(): Observable<any> {
    return this.http.get(`${this.baseUrl}/health`);
  }


  getExtractionMethods(): Observable<any> {
    return this.http.get(`${this.baseUrl}/extraction-methods`);
  }

  private addToHistory(result: AnalysisResult): void {
    const currentHistory = this.analysisHistorySubject.value;
    const updatedHistory = [result, ...currentHistory].slice(0, 10); // Keep last 10 analyses
    this.analysisHistorySubject.next(updatedHistory);
    this.saveAnalysisHistory(updatedHistory);
  }

  private saveAnalysisHistory(history: AnalysisResult[]): void {
    try {
      localStorage.setItem('codeAnalysisHistory', JSON.stringify(history));
    } catch (error) {
      console.warn('Failed to save analysis history to localStorage:', error);
    }
  }

  private loadAnalysisHistory(): void {
    try {
      const saved = localStorage.getItem('codeAnalysisHistory');
      if (saved) {
        const history = JSON.parse(saved);
        this.analysisHistorySubject.next(history);
      }
    } catch (error) {
      console.warn('Failed to load analysis history from localStorage:', error);
    }
  }

  clearHistory(): void {
    this.analysisHistorySubject.next([]);
    localStorage.removeItem('codeAnalysisHistory');
  }

  downloadAnalysis(result: AnalysisResult, format: 'json' | 'markdown' = 'json'): void {
    let content: string;
    let filename: string;
    let mimeType: string;

    if (format === 'markdown') {
      content = this.formatAsMarkdown(result);
      filename = `code-analysis-${new Date().toISOString().slice(0, 10)}.md`;
      mimeType = 'text/markdown';
    } else {
      content = JSON.stringify(result, null, 2);
      filename = `code-analysis-${new Date().toISOString().slice(0, 10)}.json`;
      mimeType = 'application/json';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  private formatAsMarkdown(result: AnalysisResult): string {
    const { analysis, extractedCode, detectedLanguage, timestamp } = result;
    
    let markdown = `# Code Analysis Report\n\n`;
    markdown += `**Date:** ${new Date(timestamp).toLocaleString()}\n`;
    markdown += `**Language:** ${detectedLanguage}\n\n`;
    
    markdown += `## Overview\n${analysis.overview}\n\n`;
    
    markdown += `## Original Code\n\`\`\`${detectedLanguage}\n${extractedCode}\n\`\`\`\n\n`;
    
    markdown += `## Line-by-Line Analysis\n\n`;
    analysis.lineAnalysis.forEach(line => {
      markdown += `### Line ${line.lineNumber}\n`;
      markdown += `**Code:** \`${line.originalCode}\`\n\n`;
      markdown += `**Explanation:** ${line.explanation}\n\n`;
      if (line.suggestions.length > 0) {
        markdown += `**Suggestions:**\n`;
        line.suggestions.forEach(suggestion => {
          markdown += `- ${suggestion}\n`;
        });
        markdown += `\n`;
      }
    });
    
    if (analysis.overallSuggestions.length > 0) {
      markdown += `## Overall Suggestions\n\n`;
      analysis.overallSuggestions.forEach(suggestion => {
        markdown += `- ${suggestion}\n`;
      });
      markdown += `\n`;
    }
    
    if (analysis.securityIssues.length > 0) {
      markdown += `## Security Issues\n\n`;
      analysis.securityIssues.forEach(issue => {
        markdown += `- ⚠️ ${issue}\n`;
      });
      markdown += `\n`;
    }
    
    if (analysis.performanceIssues.length > 0) {
      markdown += `## Performance Issues\n\n`;
      analysis.performanceIssues.forEach(issue => {
        markdown += `- 🚀 ${issue}\n`;
      });
      markdown += `\n`;
    }
    
    if (analysis.refactoredCode) {
      markdown += `## Refactored Code\n\`\`\`${detectedLanguage}\n${analysis.refactoredCode}\n\`\`\`\n\n`;
    }
    
    return markdown;
  }
}
