import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Button,
  CircularProgress,
  Chip,
  IconButton,
  Alert,
} from '@mui/material';
import {
  CloudUploadOutlined,
  ImageOutlined,
  DeleteOutlined,
  PlayArrowOutlined,
} from '@mui/icons-material';

interface ImageUploadProps {
  onAnalyze: (file: File) => void;
  isAnalyzing: boolean;
  disabled?: boolean;
}

const ImageUpload: React.FC<ImageUploadProps> = ({ onAnalyze, isAnalyzing, disabled }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      setSelectedFile(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.bmp']
    },
    multiple: false,
    disabled: disabled || isAnalyzing,
  });

  const handleAnalyze = () => {
    if (selectedFile) {
      onAnalyze(selectedFile);
    }
  };

  const handleRemove = () => {
    setSelectedFile(null);
    setPreview(null);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <ImageOutlined sx={{ mr: 1, color: 'primary.main' }} />
          Upload Image
        </Typography>

        {!selectedFile ? (
          <Box
            {...getRootProps()}
            sx={{
              border: 2,
              borderStyle: 'dashed',
              borderColor: isDragActive ? 'primary.main' : 'grey.300',
              borderRadius: 2,
              p: 4,
              textAlign: 'center',
              cursor: disabled ? 'not-allowed' : 'pointer',
              backgroundColor: isDragActive ? 'primary.50' : 'grey.50',
              transition: 'all 0.3s ease',
              opacity: disabled ? 0.5 : 1,
              '&:hover': {
                borderColor: disabled ? 'grey.300' : 'primary.main',
                backgroundColor: disabled ? 'grey.50' : 'primary.50',
              },
            }}
          >
            <input {...getInputProps()} />
            <CloudUploadOutlined 
              sx={{ 
                fontSize: 48, 
                color: isDragActive ? 'primary.main' : 'grey.400',
                mb: 2 
              }} 
            />
            <Typography variant="h6" color="text.primary" gutterBottom>
              {isDragActive ? 'Drop the image here' : 'Drag & drop an image here'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              or click to select a file
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Chip label="PNG" size="small" variant="outlined" />
              <Chip label="JPG" size="small" variant="outlined" />
              <Chip label="GIF" size="small" variant="outlined" />
              <Chip label="BMP" size="small" variant="outlined" />
            </Box>
            {disabled && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                Backend server is not connected
              </Alert>
            )}
          </Box>
        ) : (
          <Box>
            {/* Preview */}
            <Box sx={{ position: 'relative', mb: 3 }}>
              <img
                src={preview!}
                alt="Preview"
                style={{
                  width: '100%',
                  maxHeight: 300,
                  objectFit: 'contain',
                  borderRadius: 8,
                  border: '1px solid #e0e0e0',
                }}
              />
              <IconButton
                onClick={handleRemove}
                sx={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  backgroundColor: 'rgba(255,255,255,0.9)',
                  '&:hover': {
                    backgroundColor: 'rgba(255,255,255,1)',
                  },
                }}
                size="small"
              >
                <DeleteOutlined color="error" />
              </IconButton>
            </Box>

            {/* File Info */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" color="text.primary" gutterBottom>
                {selectedFile.name}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Chip 
                  label={formatFileSize(selectedFile.size)} 
                  size="small" 
                  color="primary" 
                  variant="outlined" 
                />
                <Chip 
                  label={selectedFile.type} 
                  size="small" 
                  color="secondary" 
                  variant="outlined" 
                />
              </Box>
            </Box>

            {/* Analyze Button */}
            <Button
              variant="contained"
              size="large"
              fullWidth
              onClick={handleAnalyze}
              disabled={isAnalyzing || disabled}
              startIcon={
                isAnalyzing ? (
                  <CircularProgress size={20} color="inherit" />
                ) : (
                  <PlayArrowOutlined />
                )
              }
              sx={{
                py: 1.5,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #5a6fd8 0%, #6a4290 100%)',
                },
              }}
            >
              {isAnalyzing ? 'Analyzing...' : 'Analyze Code'}
            </Button>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default ImageUpload;