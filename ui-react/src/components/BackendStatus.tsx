import React from 'react';
import {
  Alert,
  Button,
  Box,
  Chip,
  CircularProgress,
} from '@mui/material';
import { RefreshOutlined, CheckCircleOutlined, ErrorOutlined } from '@mui/icons-material';

interface BackendStatusProps {
  healthy: boolean;
  onRefresh: () => void;
}

const BackendStatus: React.FC<BackendStatusProps> = ({ healthy, onRefresh }) => {
  const [refreshing, setRefreshing] = React.useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await onRefresh();
    setTimeout(() => setRefreshing(false), 1000); // Show spinner for at least 1 second
  };

  if (healthy) {
    return (
      <Alert 
        severity="success" 
        sx={{ 
          backgroundColor: 'rgba(76, 175, 80, 0.1)',
          borderLeft: '4px solid #4caf50',
        }}
        action={
          <Button
            color="inherit"
            size="small"
            onClick={handleRefresh}
            disabled={refreshing}
            startIcon={
              refreshing ? (
                <CircularProgress size={16} color="inherit" />
              ) : (
                <RefreshOutlined />
              )
            }
          >
            {refreshing ? 'Checking...' : 'Refresh'}
          </Button>
        }
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CheckCircleOutlined sx={{ color: 'success.main' }} />
          <span>Backend server is connected and ready</span>
          <Chip 
            label="Online" 
            size="small" 
            color="success" 
            sx={{ ml: 1 }}
          />
        </Box>
      </Alert>
    );
  }

  return (
    <Alert 
      severity="error"
      sx={{ 
        backgroundColor: 'rgba(244, 67, 54, 0.1)',
        borderLeft: '4px solid #f44336',
      }}
      action={
        <Button
          color="inherit"
          size="small"
          onClick={handleRefresh}
          disabled={refreshing}
          startIcon={
            refreshing ? (
              <CircularProgress size={16} color="inherit" />
            ) : (
              <RefreshOutlined />
            )
          }
        >
          {refreshing ? 'Checking...' : 'Retry'}
        </Button>
      }
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <ErrorOutlined sx={{ color: 'error.main' }} />
        <span>Backend server is not responding</span>
        <Chip 
          label="Offline" 
          size="small" 
          color="error" 
          sx={{ ml: 1 }}
        />
      </Box>
    </Alert>
  );
};

export default BackendStatus;