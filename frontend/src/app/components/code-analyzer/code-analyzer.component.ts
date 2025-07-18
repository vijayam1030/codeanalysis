import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatExpansionModule } from '@angular/material/expansion';
import { Subscription, interval } from 'rxjs';

import { CodeAnalyzerService, AnalysisResult } from '../../services/code-analyzer.service';


@Component({
  selector: 'app-code-analyzer',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatTabsModule,
    MatChipsModule,
    MatIconModule,
    MatSelectModule,
    MatTooltipModule,
    MatExpansionModule
  ],
  template: `
    <div class="analyzer-container">
      <!-- Upload Section -->
      <mat-card class="upload-card">
        <mat-card-header>
          <mat-card-title>
            <mat-icon>upload</mat-icon>
            Upload Code Image
          </mat-card-title>
          <mat-card-subtitle>
            Upload a screenshot or photo of your code for analysis
          </mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <div 
            class="drop-zone"
            [class.dragover]="isDragOver"
            (dragover)="onDragOver($event)"
            (dragleave)="onDragLeave($event)"
            (drop)="onDrop($event)"
            (click)="fileInput.click()"
          >
            <input 
              #fileInput 
              type="file" 
              accept="image/*" 
              multiple
              (change)="onFileSelect($event)"
              style="display: none"
            >
            <mat-icon class="upload-icon">cloud_upload</mat-icon>
            <p class="upload-text">
              <ng-container *ngIf="selectedFiles.length === 0">
                Drag and drop images here or click to select (multiple files supported)
              </ng-container>
              <ng-container *ngIf="selectedFiles.length === 1">
                <strong>{{ selectedFiles[0].name }}</strong> ({{ formatFileSize(selectedFiles[0].size) }})
              </ng-container>
              <ng-container *ngIf="selectedFiles.length > 1">
                <strong>{{ selectedFiles.length }} files selected</strong>
              </ng-container>
            </p>
            <p class="upload-hint">
              Supported formats: JPG, PNG, GIF, WebP (Max 10MB)
            </p>
          </div>
          
          <!-- Image Preview -->
          <div *ngIf="imagePreview" class="image-preview">
            <img [src]="imagePreview" alt="Selected image" />
          </div>
        </mat-card-content>
      </mat-card>


      <!-- Prompt Section -->
      <mat-card class="prompt-card">
        <mat-card-header>
          <mat-card-title>
            <mat-icon>psychology</mat-icon>
            Analysis Prompt
          </mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <mat-form-field class="full-width">
            <mat-label>What would you like me to analyze?</mat-label>
            <textarea 
              matInput 
              [(ngModel)]="prompt" 
              placeholder="e.g., 'Explain this code and suggest improvements', 'Add comments to this code', 'Refactor this code for better performance'"
              rows="4">
            </textarea>
          </mat-form-field>
          
          <!-- Quick Prompt Templates -->
          <div class="prompt-templates">
            <mat-chip-set>
              <mat-chip 
                *ngFor="let template of promptTemplates" 
                (click)="selectPromptTemplate(template)"
                [class.selected]="prompt === template"
              >
                {{ template }}
              </mat-chip>
            </mat-chip-set>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- Extraction Method Section -->
      <mat-card class="extraction-method-card">
        <mat-card-header>
          <mat-card-title>
            <mat-icon>settings</mat-icon>
            Extraction Method
          </mat-card-title>
          <mat-card-subtitle>
            Choose how to extract code from your image
          </mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <mat-form-field class="full-width">
            <mat-label>Image Processing Method</mat-label>
            <mat-select [(ngModel)]="selectedExtractionMethod">
              <mat-option 
                *ngFor="let method of extractionMethods" 
                [value]="method.id"
                [class.recommended-option]="method.recommended"
              >
                <div class="extraction-option">
                  <div class="method-name">
                    {{ method.name }}
                    <mat-icon *ngIf="method.recommended" class="recommended-icon">star</mat-icon>
                  </div>
                  <div class="method-description">{{ method.description }}</div>
                  <div class="method-model" *ngIf="method.model">
                    <mat-icon>smart_toy</mat-icon>
                    {{ method.model }}
                  </div>
                  <div class="method-stats" *ngIf="method.confidence">
                    <span class="stat">{{ method.confidence }} confidence</span> • 
                    <span class="stat">{{ method.speed }} speed</span> • 
                    <span class="stat">{{ method.cost }}</span>
                  </div>
                </div>
              </mat-option>
            </mat-select>
            <mat-hint>
              <span *ngIf="selectedExtractionMethod === 'llm-vision'" class="vision-hint">
                <mat-icon>info</mat-icon>
                Vision extraction requires a vision model like 'llama3.2-vision:11b' or 'qwen2-vl:latest' to be installed.
              </span>
              <span *ngIf="selectedExtractionMethod !== 'llm-vision'">
                Tesseract OCR methods are free and work offline.
              </span>
            </mat-hint>
          </mat-form-field>
        </mat-card-content>
      </mat-card>

      <!-- Analysis Method Section -->
      <mat-card class="analysis-method-card">
        <mat-card-header>
          <mat-card-title>
            <mat-icon>analytics</mat-icon>
            Analysis Method
          </mat-card-title>
          <mat-card-subtitle>
            Choose the focus of your code analysis
          </mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <mat-form-field class="full-width">
            <mat-label>Analysis Focus</mat-label>
            <mat-select [(ngModel)]="selectedAnalysisMethod">
              <mat-option 
                *ngFor="let method of analysisMethods" 
                [value]="method.id"
                [class.recommended-option]="method.recommended"
              >
                <div class="analysis-option">
                  <div class="method-name">
                    {{ method.name }}
                    <mat-icon *ngIf="method.recommended" class="recommended-icon">star</mat-icon>
                  </div>
                  <div class="method-description">{{ method.description }}</div>
                  <div class="method-model" *ngIf="method.model">
                    <mat-icon>psychology</mat-icon>
                    {{ method.model }}
                  </div>
                  <div class="method-stats" *ngIf="method.speed">
                    <span class="stat">{{ method.speed }} speed</span> • 
                    <span class="stat">{{ method.accuracy }} accuracy</span> • 
                    <span class="stat">{{ method.cost }} cost</span>
                  </div>
                </div>
              </mat-option>
            </mat-select>
            <mat-hint>
              <span *ngIf="selectedAnalysisMethod === 'security-focused'" class="analysis-hint">
                <mat-icon>security</mat-icon>
                Focus on security vulnerabilities and potential threats.
              </span>
              <span *ngIf="selectedAnalysisMethod === 'performance-focused'" class="analysis-hint">
                <mat-icon>speed</mat-icon>
                Focus on performance optimization and efficiency improvements.
              </span>
              <span *ngIf="selectedAnalysisMethod === 'quick-review'" class="analysis-hint">
                <mat-icon>fast_forward</mat-icon>
                Quick overview with basic suggestions for rapid feedback.
              </span>
              <span *ngIf="selectedAnalysisMethod === 'comprehensive'" class="analysis-hint">
                <mat-icon>checklist</mat-icon>
                Comprehensive analysis covering all aspects of code quality.
              </span>
            </mat-hint>
          </mat-form-field>
        </mat-card-content>
      </mat-card>

      <!-- Action Buttons -->
      <div class="action-section">
        <button 
          mat-raised-button 
          color="primary" 
          (click)="analyzeCode()"
          [disabled]="!selectedFile || !prompt || (loading$ | async)"
          class="analyze-button"
        >
          <mat-icon>analytics</mat-icon>
          <span *ngIf="!(loading$ | async)">Analyze Code</span>
          <span *ngIf="loading$ | async">Analyzing...</span>
        </button>
        
        <button 
          mat-button 
          (click)="clearAll()"
          [disabled]="loading$ | async"
        >
          <mat-icon>clear</mat-icon>
          Clear All
        </button>
      </div>

      <!-- Loading Indicator -->
      <div *ngIf="loading$ | async" class="loading-section">
        <mat-spinner diameter="50"></mat-spinner>
        <p>{{ loadingMessage }}</p>
      </div>

      <!-- Results Section -->
      <div *ngIf="analysisResult" class="results-section">
        <mat-card class="results-card">
          <mat-card-header>
            <mat-card-title>
              <mat-icon>code</mat-icon>
              Analysis Results
            </mat-card-title>
            <mat-card-subtitle>
              Language: {{ analysisResult.detectedLanguage | titlecase }}
              <span *ngIf="analysisResult.fromCache" class="cache-indicator">(from cache)</span>
              <span class="line-count-indicator">
                • {{ analysisResult.analysis.lineAnalysis.length || 0 }} of {{ getCodeLineCount() }} lines analyzed
              </span>
            </mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <mat-tab-group>
              <!-- Overview Tab -->
              <mat-tab label="Overview">
                <div class="tab-content">
                  <div class="overview-section">
                    <h3>Code Overview</h3>
                    <p>{{ analysisResult.analysis.overview }}</p>
                  </div>
                  
                  <!-- Overall Suggestions -->
                  <mat-expansion-panel *ngIf="analysisResult.analysis.overallSuggestions.length > 0">
                    <mat-expansion-panel-header>
                      <mat-panel-title>Overall Suggestions</mat-panel-title>
                    </mat-expansion-panel-header>
                    <ul>
                      <li *ngFor="let suggestion of analysisResult.analysis.overallSuggestions">
                        {{ suggestion }}
                      </li>
                    </ul>
                  </mat-expansion-panel>
                  
                  <!-- Security Issues -->
                  <mat-expansion-panel *ngIf="analysisResult.analysis.securityIssues.length > 0" class="security-panel">
                    <mat-expansion-panel-header>
                      <mat-panel-title>
                        <mat-icon color="warn">security</mat-icon>
                        Security Issues
                      </mat-panel-title>
                    </mat-expansion-panel-header>
                    <ul>
                      <li *ngFor="let issue of analysisResult.analysis.securityIssues" class="security-issue">
                        {{ issue }}
                      </li>
                    </ul>
                  </mat-expansion-panel>
                  
                  <!-- Performance Issues -->
                  <mat-expansion-panel *ngIf="analysisResult.analysis.performanceIssues.length > 0" class="performance-panel">
                    <mat-expansion-panel-header>
                      <mat-panel-title>
                        <mat-icon color="accent">speed</mat-icon>
                        Performance Issues
                      </mat-panel-title>
                    </mat-expansion-panel-header>
                    <ul>
                      <li *ngFor="let issue of analysisResult.analysis.performanceIssues" class="performance-issue">
                        {{ issue }}
                      </li>
                    </ul>
                  </mat-expansion-panel>
                </div>
              </mat-tab>
              
              <!-- Code Analysis Tab -->
              <mat-tab label="Line-by-Line Analysis">
                <div class="tab-content">
                  <div class="code-analysis-section">
                    <div class="code-display">
                      <div class="code-header">
                        <span>{{ analysisResult.detectedLanguage }}</span>
                        <button mat-icon-button (click)="copyCodeToClipboard(analysisResult.extractedCode)">
                          <mat-icon>content_copy</mat-icon>
                        </button>
                      </div>
                      <div class="code-content">
                        <div 
                          *ngFor="let line of analysisResult.analysis.lineAnalysis; let i = index" 
                          class="code-line-group"
                        >
                          <div class="code-line">
                            <span class="line-number">{{ line.lineNumber }}</span>
                            <code class="line-content">{{ line.originalCode }}</code>
                          </div>
                          <div class="line-analysis" *ngIf="line.explanation">
                            <div class="explanation">
                              <mat-icon [color]="getSeverityColor(line.severity)">{{ getSeverityIcon(line.severity) }}</mat-icon>
                              <span>{{ line.explanation }}</span>
                            </div>
                            <div *ngIf="line.suggestions.length > 0" class="suggestions">
                              <h4>Suggestions:</h4>
                              <ul>
                                <li *ngFor="let suggestion of line.suggestions">{{ suggestion }}</li>
                              </ul>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </mat-tab>
              
              <!-- Refactored Code Tab -->
              <mat-tab label="Refactored Code" *ngIf="analysisResult.analysis.refactoredCode">
                <div class="tab-content">
                  <div class="refactored-section">
                    <div class="code-display">
                      <div class="code-header">
                        <span>Refactored {{ analysisResult.detectedLanguage }}</span>
                        <button mat-icon-button (click)="copyCodeToClipboard(analysisResult.analysis.refactoredCode!)">
                          <mat-icon>content_copy</mat-icon>
                        </button>
                      </div>
                      <div class="code-content">
                        <pre><code>{{ analysisResult.analysis.refactoredCode }}</code></pre>
                      </div>
                    </div>
                  </div>
                </div>
              </mat-tab>
            </mat-tab-group>
          </mat-card-content>
          <mat-card-actions>
            <button mat-button (click)="downloadAnalysis('json')">
              <mat-icon>download</mat-icon>
              Download JSON
            </button>
            <button mat-button (click)="downloadAnalysis('markdown')">
              <mat-icon>download</mat-icon>
              Download Markdown
            </button>
          </mat-card-actions>
        </mat-card>
      </div>

      <!-- History Section -->
      <div *ngIf="analysisHistory$ | async as history">
        <mat-card *ngIf="history && history.length > 0" class="history-card">
          <mat-card-header>
            <mat-card-title>
              <mat-icon>history</mat-icon>
              Recent Analyses
            </mat-card-title>
            <button mat-icon-button (click)="clearHistory()">
              <mat-icon>clear_all</mat-icon>
            </button>
          </mat-card-header>
          <mat-card-content>
            <div class="history-list">
              <mat-expansion-panel 
                *ngFor="let item of history; let i = index" 
                [expanded]="i === 0"
              >
              <mat-expansion-panel-header>
                <mat-panel-title>
                  {{ item.detectedLanguage | titlecase }} - {{ item.timestamp | date:'short' }}
                </mat-panel-title>
                <mat-panel-description>
                  {{ item.analysis.overview | slice:0:50 }}...
                </mat-panel-description>
              </mat-expansion-panel-header>
              <div class="history-item-content">
                <p><strong>Overview:</strong> {{ item.analysis.overview }}</p>
                <button mat-button (click)="loadFromHistory(item)">
                  <mat-icon>restore</mat-icon>
                  Load Analysis
                </button>
              </div>
              </mat-expansion-panel>
            </div>
          </mat-card-content>
        </mat-card>
      </div>
    </div>
  `,
  styleUrls: ['./code-analyzer.component.scss']
})
export class CodeAnalyzerComponent implements OnInit, OnDestroy {
  selectedFile: File | null = null;
  selectedFiles: File[] = [];
  imagePreview: string | null = null;
  imagePreviews: string[] = [];
  prompt: string = 'Explain this code and provide suggestions for improvement';
  selectedExtractionMethod: string = 'tesseract-standard';
  selectedAnalysisMethod: string = 'comprehensive';
  extractionMethods: any[] = [];
  analysisMethods: any[] = [];
  isDragOver = false;
  analysisResult: AnalysisResult | null = null;
  loadingMessage = 'Extracting code from image...';
  
  promptTemplates = [
    'Explain this code and provide suggestions for improvement',
    'Add detailed comments to this code',
    'Refactor this code for better performance',
    'Identify security vulnerabilities in this code',
    'Suggest best practices for this code',
    'Convert this code to a different language',
    'Optimize this code for readability',
    'Find and fix potential bugs in this code'
  ];

  private subscriptions: Subscription[] = [];

  loading$ = this.codeAnalyzerService.loading$;
  analysisHistory$ = this.codeAnalyzerService.analysisHistory$;

  constructor(
    private codeAnalyzerService: CodeAnalyzerService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    // Check backend health on component initialization
    this.checkBackendHealth();
    // Load extraction methods
    this.loadExtractionMethods();
    // Load analysis methods
    this.loadAnalysisMethods();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  private checkBackendHealth(): void {
    this.codeAnalyzerService.checkHealth().subscribe({
      next: () => {
        console.log('Backend is healthy');
      },
      error: (error: any) => {
        this.snackBar.open('Backend server is not accessible. Please make sure it\'s running.', 'OK', {
          duration: 5000,
          panelClass: ['error-snackbar']
        });
      }
    });
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = false;
    
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.handleMultipleFileSelection(Array.from(files));
    }
  }

  onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.handleMultipleFileSelection(Array.from(input.files));
    }
  }

  private handleMultipleFileSelection(files: File[]): void {
    const validFiles = files.filter(file => {
      if (!file.type.startsWith('image/')) {
        this.snackBar.open(`${file.name} is not a valid image file`, 'OK', {
          duration: 3000,
          panelClass: ['error-snackbar']
        });
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    this.selectedFiles = validFiles;
    this.selectedFile = validFiles[0]; // Keep backward compatibility
    this.generateImagePreviews(validFiles);
  }

  private handleFileSelection(file: File): void {
    this.handleMultipleFileSelection([file]);
  }

  private generateImagePreviews(files: File[]): void {
    this.imagePreviews = [];
    
    files.forEach((file, index) => {
      if (file.size > 10 * 1024 * 1024) {
        this.snackBar.open(`${file.name} is larger than 10MB`, 'OK', {
          duration: 3000,
          panelClass: ['error-snackbar']
        });
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        this.imagePreviews[index] = e.target?.result as string;
        if (index === 0) {
          this.imagePreview = this.imagePreviews[0]; // Keep backward compatibility
        }
      };
      reader.readAsDataURL(file);
    });
  }

  selectPromptTemplate(template: string): void {
    this.prompt = template;
  }

  analyzeCode(): void {
    if (!this.selectedFile || !this.prompt) {
      this.snackBar.open('Please select an image and enter a prompt', 'OK', {
        duration: 3000,
        panelClass: ['error-snackbar']
      });
      return;
    }

    this.loadingMessage = 'Extracting code from image...';
    
    const subscription = this.codeAnalyzerService.analyzeImage(this.selectedFile, this.prompt, this.selectedExtractionMethod, this.selectedAnalysisMethod)
      .subscribe({
        next: (result: AnalysisResult) => {
          this.analysisResult = result;
          this.snackBar.open('Analysis completed successfully!', 'OK', {
            duration: 3000,
            panelClass: ['success-snackbar']
          });
        },
        error: (error: any) => {
          console.error('Analysis error:', error);
          this.snackBar.open(`Analysis failed: ${error.message || 'Unknown error'}`, 'OK', {
            duration: 5000,
            panelClass: ['error-snackbar']
          });
        }
      });

    this.subscriptions.push(subscription);
  }

  clearAll(): void {
    this.selectedFile = null;
    this.imagePreview = null;
    this.analysisResult = null;
    this.prompt = 'Explain this code and provide suggestions for improvement';
    this.selectedExtractionMethod = 'tesseract-multi';
  }

  private loadExtractionMethods(): void {
    this.codeAnalyzerService.getExtractionMethods().subscribe({
      next: (response: any) => {
        this.extractionMethods = response.extractionMethods;
        console.log('Loaded extraction methods:', this.extractionMethods);
      },
      error: (error: any) => {
        console.error('Failed to load extraction methods:', error);
        // Fallback to default methods
        this.extractionMethods = [
          {
            id: 'tesseract-multi',
            name: 'Tesseract Multi-Strategy (Default)',
            description: 'Uses multiple Tesseract preprocessing approaches',
            recommended: true
          }
        ];
      }
    });
  }

  private loadAnalysisMethods(): void {
    // Default analysis methods - could be fetched from backend
    this.analysisMethods = [
      {
        id: 'comprehensive',
        name: 'Comprehensive Analysis',
        description: 'Full code analysis including security, performance, and best practices',
        speed: 'Medium',
        accuracy: 'High',
        cost: 'Medium',
        recommended: true,
        capabilities: ['Security Scan', 'Performance Check', 'Code Quality', 'Best Practices'],
        model: 'Llama3.2:1b / CodeLlama:7b',
        technology: 'Large Language Model'
      },
      {
        id: 'security-focused',
        name: 'Security-Focused',
        description: 'Prioritizes security vulnerabilities and potential threats',
        speed: 'Fast',
        accuracy: 'High',
        cost: 'Low',
        capabilities: ['Security Scan', 'Vulnerability Detection', 'Input Validation'],
        model: 'Llama3.2:1b / Phi3:3.8b',
        technology: 'Large Language Model'
      },
      {
        id: 'performance-focused',
        name: 'Performance-Focused',
        description: 'Focuses on performance optimization and efficiency',
        speed: 'Fast',
        accuracy: 'Medium',
        cost: 'Low',
        capabilities: ['Performance Check', 'Optimization', 'Memory Usage'],
        model: 'Qwen2.5-Coder:1.5b / Llama3.2:1b',
        technology: 'Large Language Model'
      },
      {
        id: 'quick-review',
        name: 'Quick Review',
        description: 'Fast overview with basic suggestions',
        speed: 'Very Fast',
        accuracy: 'Medium',
        cost: 'Very Low',
        capabilities: ['Basic Analysis', 'Syntax Check'],
        model: 'TinyLlama:1.1b / SmolLM2',
        technology: 'Small Language Model'
      }
    ];
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  getSeverityColor(severity: string): string {
    switch (severity) {
      case 'error': return 'warn';
      case 'warning': return 'accent';
      default: return 'primary';
    }
  }

  getSeverityIcon(severity: string): string {
    switch (severity) {
      case 'error': return 'error';
      case 'warning': return 'warning';
      default: return 'info';
    }
  }

  copyCodeToClipboard(code: string): void {
    navigator.clipboard.writeText(code).then(() => {
      this.snackBar.open('Code copied to clipboard!', 'OK', {
        duration: 2000,
        panelClass: ['success-snackbar']
      });
    }).catch(() => {
      this.snackBar.open('Failed to copy code', 'OK', {
        duration: 2000,
        panelClass: ['error-snackbar']
      });
    });
  }

  downloadAnalysis(format: 'json' | 'markdown'): void {
    if (this.analysisResult) {
      this.codeAnalyzerService.downloadAnalysis(this.analysisResult, format);
      this.snackBar.open(`Analysis downloaded as ${format.toUpperCase()}!`, 'OK', {
        duration: 2000,
        panelClass: ['success-snackbar']
      });
    }
  }

  loadFromHistory(item: AnalysisResult): void {
    this.analysisResult = item;
    this.snackBar.open('Analysis loaded from history!', 'OK', {
      duration: 2000,
      panelClass: ['success-snackbar']
    });
  }

  clearHistory(): void {
    this.codeAnalyzerService.clearHistory();
    this.snackBar.open('History cleared!', 'OK', {
      duration: 2000,
      panelClass: ['success-snackbar']
    });
  }

  getCodeLineCount(): number {
    if (!this.analysisResult?.extractedCode) {
      return 0;
    }
    return this.analysisResult.extractedCode.split('\n').length;
  }

}
