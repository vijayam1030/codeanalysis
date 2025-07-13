import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Box,
  Chip,
  Tooltip,
} from '@mui/material';
import { SettingsOutlined, InfoOutlined } from '@mui/icons-material';
import type { ExtractionMethod } from '../types/types';

interface AnalysisSettingsProps {
  extractionMethods: ExtractionMethod[];
  selectedMethod: string;
  onMethodChange: (method: string) => void;
  prompt: string;
  onPromptChange: (prompt: string) => void;
}

const AnalysisSettings: React.FC<AnalysisSettingsProps> = ({
  extractionMethods,
  selectedMethod,
  onMethodChange,
  prompt,
  onPromptChange,
}) => {
  const selectedMethodInfo = extractionMethods.find(m => m.id === selectedMethod);

  const getSpeedColor = (speed?: string) => {
    switch (speed?.toLowerCase()) {
      case 'fast': return 'success';
      case 'medium': return 'warning';
      case 'slow': return 'error';
      default: return 'default';
    }
  };

  const getConfidenceColor = (confidence?: string) => {
    switch (confidence?.toLowerCase()) {
      case 'very high':
      case 'high': return 'success';
      case 'medium-high':
      case 'medium': return 'warning';
      case 'low': return 'error';
      default: return 'default';
    }
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <SettingsOutlined sx={{ mr: 1, color: 'primary.main' }} />
          Analysis Settings
        </Typography>

        {/* Extraction Method */}
        <FormControl fullWidth sx={{ mb: 3 }}>
          <InputLabel>Extraction Method</InputLabel>
          <Select
            value={selectedMethod}
            label="Extraction Method"
            onChange={(e) => onMethodChange(e.target.value)}
          >
            {extractionMethods.map((method) => (
              <MenuItem key={method.id} value={method.id}>
                <Box>
                  <Typography variant="body1">{method.name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {method.description}
                  </Typography>
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Method Info */}
        {selectedMethodInfo && (
          <Box sx={{ mb: 3, p: 2, backgroundColor: 'grey.50', borderRadius: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <InfoOutlined sx={{ fontSize: 16, mr: 1, color: 'primary.main' }} />
              <Typography variant="subtitle2" color="primary.main">
                Method Details
              </Typography>
            </Box>
            
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {selectedMethodInfo.description}
            </Typography>
            
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {selectedMethodInfo.speed && (
                <Chip 
                  label={`Speed: ${selectedMethodInfo.speed}`} 
                  size="small" 
                  color={getSpeedColor(selectedMethodInfo.speed) as any}
                  variant="outlined"
                />
              )}
              {selectedMethodInfo.confidence && (
                <Chip 
                  label={`Accuracy: ${selectedMethodInfo.confidence}`} 
                  size="small" 
                  color={getConfidenceColor(selectedMethodInfo.confidence) as any}
                  variant="outlined"
                />
              )}
              {selectedMethodInfo.cost && (
                <Chip 
                  label={`Cost: ${selectedMethodInfo.cost}`} 
                  size="small" 
                  color="info"
                  variant="outlined"
                />
              )}
              {selectedMethodInfo.recommended && (
                <Chip 
                  label="Recommended" 
                  size="small" 
                  color="success"
                />
              )}
            </Box>
            
            {selectedMethodInfo.requiresVisionModel && (
              <Box sx={{ mt: 1 }}>
                <Chip 
                  label="Requires Vision Model" 
                  size="small" 
                  color="warning"
                  variant="outlined"
                />
              </Box>
            )}
          </Box>
        )}

        {/* Analysis Prompt */}
        <TextField
          fullWidth
          multiline
          rows={4}
          label="Analysis Prompt"
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          placeholder="Describe what you want the AI to analyze in the code..."
          helperText="Customize the analysis prompt to focus on specific aspects of the code"
        />

        {/* Quick Prompt Templates */}
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Quick Templates:
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Tooltip title="Click to use this prompt">
              <Chip
                label="General Analysis"
                size="small"
                clickable
                onClick={() => onPromptChange('Explain this code and provide suggestions for improvement')}
                variant={prompt === 'Explain this code and provide suggestions for improvement' ? 'filled' : 'outlined'}
              />
            </Tooltip>
            <Tooltip title="Click to use this prompt">
              <Chip
                label="Security Focus"
                size="small"
                clickable
                onClick={() => onPromptChange('Analyze this code for security vulnerabilities and best practices')}
                variant={prompt === 'Analyze this code for security vulnerabilities and best practices' ? 'filled' : 'outlined'}
              />
            </Tooltip>
            <Tooltip title="Click to use this prompt">
              <Chip
                label="Performance"
                size="small"
                clickable
                onClick={() => onPromptChange('Review this code for performance optimization opportunities')}
                variant={prompt === 'Review this code for performance optimization opportunities' ? 'filled' : 'outlined'}
              />
            </Tooltip>
            <Tooltip title="Click to use this prompt">
              <Chip
                label="Code Quality"
                size="small"
                clickable
                onClick={() => onPromptChange('Evaluate code quality, readability, and maintainability')}
                variant={prompt === 'Evaluate code quality, readability, and maintainability' ? 'filled' : 'outlined'}
              />
            </Tooltip>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

export default AnalysisSettings;