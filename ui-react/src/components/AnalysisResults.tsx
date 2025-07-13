import React, { useState } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Alert,
  Grid,
  Paper,
  Divider,
  IconButton,
  Tooltip,
  CircularProgress,
  LinearProgress,
} from '@mui/material';
import {
  ExpandMoreOutlined,
  AssessmentOutlined,
  CodeOutlined,
  SecurityOutlined,
  SpeedOutlined,
  BugReportOutlined,
  InfoOutlined,
  WarningOutlined,
  ErrorOutlined,
  ContentCopyOutlined,
  TimerOutlined,
  LanguageOutlined,
} from '@mui/icons-material';
import { AnalysisResult } from '../types';

interface AnalysisResultsProps {
  result: AnalysisResult | null;
  isAnalyzing: boolean;
}

const AnalysisResults: React.FC<AnalysisResultsProps> = ({ result, isAnalyzing }) => {
  const [copiedCode, setCopiedCode] = useState(false);

  const handleCopyCode = async () => {
    if (result?.extractedCode) {
      try {
        await navigator.clipboard.writeText(result.extractedCode);
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
      } catch (error) {
        console.error('Failed to copy code:', error);
      }
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'error': return <ErrorOutlined color="error" />;
      case 'warning': return <WarningOutlined color="warning" />;
      case 'info': return <InfoOutlined color="info" />;
      default: return <InfoOutlined color="info" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'error': return 'error';
      case 'warning': return 'warning';
      case 'info': return 'info';
      default: return 'default';
    }
  };

  if (isAnalyzing) {
    return (
      <Card>
        <CardContent sx={{ textAlign: 'center', py: 6 }}>
          <CircularProgress size={60} sx={{ mb: 3 }} />
          <Typography variant="h6" gutterBottom>
            Analyzing Your Code...
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            This may take a moment. We're processing the image and analyzing the code.
          </Typography>
          <LinearProgress sx={{ mt: 2 }} />
        </CardContent>
      </Card>
    );
  }

  if (!result) {
    return (
      <Card>
        <CardContent sx={{ textAlign: 'center', py: 6 }}>
          <AssessmentOutlined sx={{ fontSize: 80, color: 'grey.300', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No Analysis Yet
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Upload an image containing code and click "Analyze Code" to see detailed results here.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  const analysis = result.analysis;
  const lineAnalysis = analysis?.lineAnalysis || [];
  const securityIssues = analysis?.securityIssues || [];
  const performanceIssues = analysis?.performanceIssues || [];
  const overallSuggestions = analysis?.overallSuggestions || [];

  return (
    <Box>
      {/* Overview Card */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
            <AssessmentOutlined sx={{ mr: 1, color: 'primary.main' }} />
            Analysis Overview
          </Typography>

          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={6} sm={3}>
              <Paper sx={{ p: 2, textAlign: 'center', backgroundColor: 'primary.50' }}>
                <LanguageOutlined sx={{ color: 'primary.main', mb: 1 }} />
                <Typography variant="h6" color="primary.main">
                  {result.detectedLanguage}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Language
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Paper sx={{ p: 2, textAlign: 'center', backgroundColor: 'secondary.50' }}>
                <CodeOutlined sx={{ color: 'secondary.main', mb: 1 }} />
                <Typography variant="h6" color="secondary.main">
                  {result.extractedCode.split('\n').length}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Lines
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Paper sx={{ p: 2, textAlign: 'center', backgroundColor: 'error.50' }}>
                <SecurityOutlined sx={{ color: 'error.main', mb: 1 }} />
                <Typography variant="h6" color="error.main">
                  {securityIssues.length}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Security Issues
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Paper sx={{ p: 2, textAlign: 'center', backgroundColor: 'warning.50' }}>
                <SpeedOutlined sx={{ color: 'warning.main', mb: 1 }} />
                <Typography variant="h6" color="warning.main">
                  {performanceIssues.length}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Performance Issues
                </Typography>
              </Paper>
            </Grid>
          </Grid>

          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
            <Chip 
              label={`Method: ${result.extractionMethod}`} 
              color="primary" 
              variant="outlined" 
              size="small" 
            />
            <Chip 
              icon={<TimerOutlined />}
              label={new Date(result.timestamp).toLocaleTimeString()} 
              color="secondary" 
              variant="outlined" 
              size="small" 
            />
            {result.fromCache && (
              <Chip 
                label="From Cache" 
                color="success" 
                variant="outlined" 
                size="small" 
              />
            )}
          </Box>

          {analysis?.overview && (
            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="body2">
                {analysis.overview}
              </Typography>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Extracted Code */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center' }}>
              <CodeOutlined sx={{ mr: 1, color: 'primary.main' }} />
              Extracted Code
            </Typography>
            <Tooltip title={copiedCode ? 'Copied!' : 'Copy to clipboard'}>
              <IconButton onClick={handleCopyCode} size="small">
                <ContentCopyOutlined color={copiedCode ? 'success' : 'action'} />
              </IconButton>
            </Tooltip>
          </Box>
          <Paper 
            sx={{ 
              p: 2, 
              backgroundColor: '#1e1e1e', 
              color: '#d4d4d4',
              fontFamily: 'monospace',
              fontSize: '0.875rem',
              overflow: 'auto',
              maxHeight: 400,
            }}
          >
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
              {result.extractedCode}
            </pre>
          </Paper>
        </CardContent>
      </Card>

      {/* Line-by-Line Analysis */}
      {lineAnalysis.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
              <BugReportOutlined sx={{ mr: 1, color: 'primary.main' }} />
              Line-by-Line Analysis
            </Typography>
            
            {lineAnalysis.slice(0, 10).map((line, index) => (
              <Accordion key={index} sx={{ mb: 1 }}>
                <AccordionSummary expandIcon={<ExpandMoreOutlined />}>
                  <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                    <Chip 
                      label={`Line ${line.lineNumber}`} 
                      size="small" 
                      color="primary" 
                      sx={{ mr: 2, minWidth: 70 }}
                    />
                    {getSeverityIcon(line.severity)}
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        ml: 1, 
                        fontFamily: 'monospace',
                        color: 'text.secondary',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {line.originalCode}
                    </Typography>
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <Box>
                    <Paper sx={{ p: 2, mb: 2, backgroundColor: 'grey.50' }}>
                      <Typography variant="subtitle2" gutterBottom>
                        Code:
                      </Typography>
                      <Typography 
                        variant="body2" 
                        sx={{ fontFamily: 'monospace', backgroundColor: '#1e1e1e', color: '#d4d4d4', p: 1, borderRadius: 1 }}
                      >
                        {line.originalCode}
                      </Typography>
                    </Paper>
                    
                    <Typography variant="subtitle2" gutterBottom>
                      Explanation:
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 2 }}>
                      {line.explanation}
                    </Typography>
                    
                    {line.suggestions.length > 0 && (
                      <>
                        <Typography variant="subtitle2" gutterBottom>
                          Suggestions:
                        </Typography>
                        <Box sx={{ mb: 2 }}>
                          {line.suggestions.map((suggestion, idx) => (
                            <Alert key={idx} severity="info" sx={{ mb: 1 }}>
                              {suggestion}
                            </Alert>
                          ))}
                        </Box>
                      </>
                    )}
                    
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Chip 
                        label={`Severity: ${line.severity}`} 
                        color={getSeverityColor(line.severity) as any}
                        size="small" 
                      />
                      <Chip 
                        label={`Category: ${line.category}`} 
                        variant="outlined" 
                        size="small" 
                      />
                    </Box>
                  </Box>
                </AccordionDetails>
              </Accordion>
            ))}
            
            {lineAnalysis.length > 10 && (
              <Alert severity="info" sx={{ mt: 2 }}>
                Showing first 10 lines. Total lines analyzed: {lineAnalysis.length}
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Security Issues */}
      {securityIssues.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
              <SecurityOutlined sx={{ mr: 1, color: 'error.main' }} />
              Security Issues
            </Typography>
            {securityIssues.map((issue, index) => (
              <Alert key={index} severity="error" sx={{ mb: 1 }}>
                {issue}
              </Alert>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Performance Issues */}
      {performanceIssues.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
              <SpeedOutlined sx={{ mr: 1, color: 'warning.main' }} />
              Performance Issues
            </Typography>
            {performanceIssues.map((issue, index) => (
              <Alert key={index} severity="warning" sx={{ mb: 1 }}>
                {issue}
              </Alert>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Overall Suggestions */}
      {overallSuggestions.length > 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
              <InfoOutlined sx={{ mr: 1, color: 'info.main' }} />
              Overall Suggestions
            </Typography>
            {overallSuggestions.map((suggestion, index) => (
              <Alert key={index} severity="info" sx={{ mb: 1 }}>
                {suggestion}
              </Alert>
            ))}
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default AnalysisResults;