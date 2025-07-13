import axios from 'axios';
import type { AnalysisResult, ExtractionMethod } from '../types/types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 300000, // 5 minutes
});

export const checkBackendHealth = async (): Promise<boolean> => {
  try {
    const response = await api.get('/health');
    return response.status === 200;
  } catch (error) {
    return false;
  }
};

export const getExtractionMethods = async (): Promise<ExtractionMethod[]> => {
  try {
    const response = await api.get('/extraction-methods');
    return response.data.extractionMethods || [];
  } catch (error) {
    throw new Error('Failed to fetch extraction methods');
  }
};

export const analyzeImage = async (
  file: File,
  prompt: string,
  extractionMethod: string,
  analysisMethod?: string
): Promise<AnalysisResult> => {
  try {
    const formData = new FormData();
    formData.append('images', file);
    formData.append('prompt', prompt);
    formData.append('extractionMethod', extractionMethod);
    if (analysisMethod) {
      formData.append('analysisMethod', analysisMethod);
    }

    const response = await api.post('/analyze', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data;
  } catch (error: any) {
    if (error.response?.data?.error) {
      throw new Error(error.response.data.error);
    } else if (error.code === 'ECONNABORTED') {
      throw new Error('Analysis timed out. Please try with a smaller image or different method.');
    } else if (error.code === 'ECONNREFUSED') {
      throw new Error('Cannot connect to backend server. Please ensure it\'s running.');
    } else {
      throw new Error(error.message || 'Analysis failed');
    }
  }
};