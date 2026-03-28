import React from 'react';
import { motion } from 'framer-motion';
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  IconButton,
  Tooltip,
  MenuItem,
  Select
} from '@mui/material';
import {
  Refresh,
  SignalCellularAlt,
  DeleteSweep as ClearIcon,
  Add as AddIcon,
  Remove as RemoveIcon
} from '@mui/icons-material';

const DownloadManagerHeader = ({
  loading,
  connectionStatus,
  lastUpdated,
  apiError,
  onRefresh,
  isMobile,
  selectedDownloader,
  onDownloaderChange,
  showDownloadForm,
  onToggleDownloadForm,
  clearTempLoading,
  onClearTemp
}) => {
  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return '#28a745';
      case 'connecting': return '#ffc107';
      case 'error': return '#dc3545';
      case 'disconnected': return '#6c757d';
      default: return '#6c757d';
    }
  };

  const getConnectionStatusText = () => {
    return connectionStatus.charAt(0).toUpperCase() + connectionStatus.slice(1);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{
        marginBottom: '1.5rem',
        borderRadius: '12px',
        background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
        border: '1px solid rgba(0,0,0,0.08)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        padding: isMobile ? '1rem' : '1.5rem'
      }}
    >
      {/* Top Row - Title and Actions */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          justifyContent: 'space-between',
          alignItems: isMobile ? 'stretch' : 'center',
          gap: isMobile ? '1rem' : '0',
          marginBottom: '1rem'
        }}
      >
        {/* Left Side - Title and Status */}
        <Box sx={{ 
          display: 'flex', 
          flexDirection: isMobile ? 'column' : 'row', 
          alignItems: isMobile ? 'flex-start' : 'center',
          gap: '1rem'
        }}>
          <Typography 
            variant={isMobile ? "h6" : "h5"} 
            sx={{ 
              fontWeight: 700, 
              color: '#495057'
            }}
          >
            Download Manager
          </Typography>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <SignalCellularAlt 
              sx={{ 
                fontSize: '1rem',
                color: getConnectionStatusColor() 
              }} 
            />
            <Typography
              variant="body2"
              sx={{
                color: getConnectionStatusColor(),
                fontWeight: 600
              }}
            >
              {getConnectionStatusText()}
            </Typography>
          </Box>

          {lastUpdated && (
            <Typography 
              variant="caption" 
              sx={{ 
                color: '#6c757d'
              }}
            >
              Last updated: {lastUpdated.toLocaleTimeString()}
            </Typography>
          )}
        </Box>

        {/* Right Side - Action Buttons */}
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '0.5rem'
        }}>
          <Tooltip title="Refresh Stats">
            <span>
              <IconButton
                onClick={onRefresh}
                disabled={loading}
                size="small"
                sx={{
                  color: loading ? '#6c757d' : '#007bff',
                  background: loading ? 'rgba(0,123,255,0.1)' : 'rgba(0,123,255,0.08)',
                  '&:hover': {
                    background: 'rgba(0,123,255,0.15)'
                  }
                }}
              >
                {loading ? <CircularProgress size={20} /> : <Refresh />}
              </IconButton>
            </span>
          </Tooltip>

          <Tooltip title="Clear Temporary Files">
            <span>
              <IconButton
                onClick={onClearTemp}
                disabled={clearTempLoading}
                size="small"
                sx={{
                  color: clearTempLoading ? '#6c757d' : '#dc3545',
                  background: clearTempLoading ? 'rgba(220,53,69,0.1)' : 'rgba(220,53,69,0.08)',
                  '&:hover': {
                    background: 'rgba(220,53,69,0.15)'
                  }
                }}
              >
                {clearTempLoading ? <CircularProgress size={20} /> : <ClearIcon />}
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      </Box>

      {/* Bottom Row - Downloader Selection and Add Button */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          justifyContent: 'space-between',
          alignItems: isMobile ? 'stretch' : 'center',
          gap: isMobile ? '1rem' : '0'
        }}
      >
        {/* Downloader Selection */}
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '0.5rem'
        }}>
          <Typography 
            variant="body2" 
            sx={{ 
              fontWeight: 500,
              color: '#495057',
              minWidth: isMobile ? 'auto' : '120px'
            }}
          >
            Download Type:
          </Typography>
          <Select
            size="small"
            value={selectedDownloader}
            onChange={onDownloaderChange}
            sx={{ 
              minWidth: isMobile ? '100%' : 150,
              background: 'white'
            }}
          >
            <MenuItem value="httpFile">HTTP File</MenuItem>
            <MenuItem value="youtube">YouTube DL</MenuItem>
          </Select>
        </Box>

        {/* Add Download Button */}
        <Button
          variant="contained"
          startIcon={showDownloadForm ? <RemoveIcon /> : <AddIcon />}
          onClick={onToggleDownloadForm}
          sx={{
            borderRadius: '8px',
            padding: '0.5rem 1.5rem',
            minWidth: isMobile ? '100%' : 'auto',
            background: showDownloadForm ? 
              'linear-gradient(135deg, #6c757d 0%, #5a6268 100%)' : 
              'linear-gradient(135deg, #007bff 0%, #0056b3 100%)',
            '&:hover': {
              background: showDownloadForm ? 
                'linear-gradient(135deg, #5a6268 0%, #495057 100%)' : 
                'linear-gradient(135deg, #0056b3 0%, #004085 100%)'
            }
          }}
        >
          {showDownloadForm ? 'Hide Form' : 'Add Download'}
        </Button>
      </Box>

      {/* API Error Message */}
      {apiError && (
        <Typography 
          variant="caption" 
          sx={{ 
            color: '#dc3545', 
            display: 'block', 
            marginTop: '0.5rem'
          }}
        >
          Using fallback data - Some features may be limited
        </Typography>
      )}
    </motion.div>
  );
};

export default React.memo(DownloadManagerHeader);