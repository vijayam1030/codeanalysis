import React, { useState, useEffect } from 'react';
import {
  Container,
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Alert,
  Chip,
} from '@mui/material';
import { SearchOutlined } from '@mui/icons-material';
import ImageUpload from './ImageUpload';
import AnalysisSettings from './AnalysisSettings';
import AnalysisResults from './AnalysisResults';
import BackendStatus from './BackendStatus';
import type { AnalysisResult, ExtractionMethod, AnalysisMethod } from '../types/types';
import { analyzeImage, checkBackendHealth, getExtractionMethods } from '../services/api';

const CodeAnalyzer: React.FC = () => {
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backendHealthy, setBackendHealthy] = useState(false);
  const [extractionMethods, setExtractionMethods] = useState<ExtractionMethod[]>([]);
  const [selectedMethod, setSelectedMethod] = useState('tesseract-standard');
  const [analysisMethods, setAnalysisMethods] = useState<AnalysisMethod[]>([]);
  const [selectedAnalysisMethod, setSelectedAnalysisMethod] = useState('comprehensive');
  const [prompt, setPrompt] = useState('Explain this code and provide suggestions for improvement');

  useEffect(() => {
    checkHealth();
    loadExtractionMethods();
    loadAnalysisMethods();
  }, []);

  const checkHealth = async () => {
    try {
      const healthy = await checkBackendHealth();
      setBackendHealthy(healthy);
    } catch (error) {
      setBackendHealthy(false);
    }
  };

  const loadExtractionMethods = async () => {
    try {
      const methods = await getExtractionMethods();
      setExtractionMethods(methods);
    } catch (error) {
      console.error('Failed to load extraction methods:', error);
      // Fallback methods
      setExtractionMethods([
        { id: 'tesseract-standard', name: 'Tesseract Standard', description: 'Fast OCR processing' },
        { id: 'tesseract-multi', name: 'Tesseract Multi-Strategy', description: 'High accuracy OCR' },
        { id: 'llm-vision', name: 'LLM Vision', description: 'AI-powered analysis' }
      ]);
    }
  };

  const loadAnalysisMethods = async () => {
    // Default analysis methods - could be fetched from backend
    const defaultMethods: AnalysisMethod[] = [
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
    setAnalysisMethods(defaultMethods);
  };

  const handleAnalyze = async (file: File) => {
    if (!backendHealthy) {
      setError('Backend server is not running. Please check the connection.');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setAnalysisResult(null);

    try {
      const result = await analyzeImage(file, prompt, selectedMethod, selectedAnalysisMethod);
      setAnalysisResult(result);
    } catch (error: any) {
      setError(error.message || 'Analysis failed. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      {/* Header */}
      <Card sx={{ 
        mb: 4, 
        background: 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.7) 100%)',
        backdropFilter: 'blur(10px)',
      }}>
        <CardContent sx={{ textAlign: 'center', py: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
            <SearchOutlined sx={{ fontSize: 40, color: 'primary.main', mr: 2 }} />
            <Typography variant="h4" component="h1" sx={{ 
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              fontWeight: 800,
            }}>
              Code Analyzer Pro
            </Typography>
          </Box>
          <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
            Advanced AI-powered code analysis from images
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Chip label="OCR Processing" color="primary" variant="outlined" />
            <Chip label="AI Analysis" color="secondary" variant="outlined" />
            <Chip label="Security Scan" color="success" variant="outlined" />
            <Chip label="Performance Check" color="warning" variant="outlined" />
          </Box>
        </CardContent>
      </Card>

      {/* Backend Status */}
      <Box sx={{ mb: 3 }}>
        <BackendStatus healthy={backendHealthy} onRefresh={checkHealth} />
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Main Content */}
      <Grid container spacing={3}>
        {/* Left Column - Upload and Settings */}
        <Grid item xs={12} lg={5}>
          <Grid container spacing={3}>
            {/* Image Upload */}
            <Grid item xs={12}>
              <ImageUpload 
                onAnalyze={handleAnalyze}
                isAnalyzing={isAnalyzing}
                disabled={!backendHealthy}
              />
            </Grid>

            {/* Analysis Settings */}
            <Grid item xs={12}>
              <AnalysisSettings
                extractionMethods={extractionMethods}
                selectedMethod={selectedMethod}
                onMethodChange={setSelectedMethod}
                analysisMethods={analysisMethods}
                selectedAnalysisMethod={selectedAnalysisMethod}
                onAnalysisMethodChange={setSelectedAnalysisMethod}
                prompt={prompt}
                onPromptChange={setPrompt}
              />
            </Grid>
          </Grid>
        </Grid>

        {/* Right Column - Results */}
        <Grid item xs={12} lg={7}>
          <AnalysisResults 
            result={analysisResult}
            isAnalyzing={isAnalyzing}
          />
        </Grid>
      </Grid>

      {/* Footer */}
      <Box sx={{ mt: 6, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary" sx={{ 
          background: 'rgba(255,255,255,0.8)',
          backdropFilter: 'blur(10px)',
          borderRadius: 2,
          py: 2,
          px: 3,
          display: 'inline-block'
        }}>
          🔍 Code Analyzer Pro - Powered by AI | Built with React & Material-UI
        </Typography>
      </Box>
    </Container>
  );
};

export default CodeAnalyzer;