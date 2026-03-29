import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Tooltip,
  MenuItem,
  Select,
  useMediaQuery,
  useTheme,
  alpha,
  Chip,
  Stack,
  Divider
} from '@mui/material';
import {
  Refresh,
  SignalCellularAlt,
  DeleteSweep as ClearIcon,
  Add as AddIcon,
  Remove as RemoveIcon,
  Speed as SpeedIcon,
  PlayArrow as PlayIcon,
  Schedule as ScheduleIcon,
  Queue as QueueIcon,
  CloudDone as CloudDoneIcon,
  Download as DownloadIcon,
  Info as InfoIcon,
  FiberManualRecord as DotIcon
} from '@mui/icons-material';
import DownloadsList from './DownloadsList';
import HttpFile from './Mirror/HttpFile';
import Youtube_dl from './YoutubeDownloader/YoutubeDownloader';
import { toast } from '@shared/components/ui/Toast';
import { deleteTempFile } from '@shared/services/ApiServices';
import Constants from '@shared/constants';
import StatusTestData from './status-test-data';

// Connection status badge component
const ConnectionBadge = ({ status }) => {
  const theme = useTheme();
  const getStatusConfig = () => {
    switch (status) {
      case 'connected': 
        return { 
          color: theme.palette.success.main,
          bgColor: alpha(theme.palette.success.main, 0.1),
          iconColor: theme.palette.success.main,
          text: 'Connected'
        };
      case 'connecting': 
        return { 
          color: theme.palette.warning.main,
          bgColor: alpha(theme.palette.warning.main, 0.1),
          iconColor: theme.palette.warning.main,
          text: 'Connecting...'
        };
      case 'error': 
        return { 
          color: theme.palette.error.main,
          bgColor: alpha(theme.palette.error.main, 0.1),
          iconColor: theme.palette.error.main,
          text: 'Error'
        };
      case 'disconnected': 
        return { 
          color: theme.palette.grey[600],
          bgColor: alpha(theme.palette.grey[600], 0.1),
          iconColor: theme.palette.grey[600],
          text: 'Disconnected'
        };
      default: 
        return { 
          color: theme.palette.grey[600],
          bgColor: alpha(theme.palette.grey[600], 0.1),
          iconColor: theme.palette.grey[600],
          text: status
        };
    }
  };

  const config = getStatusConfig();

  return (
    <Chip
      icon={<SignalCellularAlt sx={{ fontSize: 14, color: config.iconColor }} />}
      label={config.text}
      sx={{
        backgroundColor: config.bgColor,
        color: config.color,
        fontWeight: 500,
        fontSize: '0.75rem',
        height: 28,
        border: `1px solid ${alpha(config.color, 0.2)}`,
        '& .MuiChip-icon': {
          color: config.iconColor,
          marginLeft: 1
        }
      }}
      size="small"
    />
  );
};

// Compact Stat Card
const CompactStat = ({ title, value, icon: Icon, color, loading = false }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  return (
    <Box sx={{
      p: isMobile ? 1.25 : 1.5,
      borderRadius: 2,
      bgcolor: alpha(theme.palette.background.paper, 0.7),
      backdropFilter: 'blur(10px)',
      border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
      minHeight: isMobile ? 80 : 90,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      transition: 'all 0.2s',
      '&:hover': {
        borderColor: alpha(color, 0.3),
        transform: 'translateY(-2px)',
        boxShadow: `0 4px 12px ${alpha(color, 0.1)}`
      }
    }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography 
            variant="caption" 
            sx={{ 
              color: 'text.secondary',
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: '0.3px',
              fontSize: '0.7rem',
              display: 'block',
              mb: 0.5
            }}
          >
            {title}
          </Typography>
          <Typography 
            variant="h6" 
            sx={{ 
              fontWeight: 700, 
              color: 'text.primary',
              fontSize: isMobile ? '1.125rem' : '1.25rem',
              lineHeight: 1.2
            }}
          >
            {loading ? '--' : value}
          </Typography>
        </Box>
        <Icon sx={{ 
          color: color, 
          fontSize: isMobile ? 20 : 24,
          opacity: 0.8,
          flexShrink: 0,
          ml: 1
        }} />
      </Box>
    </Box>
  );
};

function DownloadManager() {
  const [downloads, setDownloads] = useState(StatusTestData);
  const [connectionStatus, setConnectionStatus] = useState('connected');
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [selectedDownloader, setSelectedDownloader] = useState("httpFile");
  const [clearTempLoading, setClearTempLoading] = useState(false);
  const [showDownloadForm, setShowDownloadForm] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isSmallMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const navigate = useNavigate();
  const location = useLocation();
  const ws = useRef(null);
  const reconnectTimeout = useRef(null);

  // Calculate summary statistics from downloads
  const summaryStats = useMemo(() => {
    const stats = {
      total: downloads.length,
      active: 0,
      queued: 0,
      completed: 0,
      speed: 0
    };

    if (downloads.length === 0) return stats;

    downloads.forEach(download => {
      const status = download.status;
      const downloadStatus = status?.downloadStatus || {};
      const currentState = status?.currentState;
      const isQueued = download.isQueued;
      const isRunning = download.isRunning;

      if (currentState === 'DOWNLOAD' && isRunning) {
        stats.active++;
      } else if (isQueued) {
        stats.queued++;
      } else if (currentState === 'SUCCESS' || currentState === 'COMPLETE') {
        stats.completed++;
      }

      if (downloadStatus.speed) {
        stats.speed += downloadStatus.speed / 1024 / 1024;
      }
    });

    return stats;
  }, [downloads]);

  // Handle clear temporary files
  const handleClearTempFiles = useCallback(async () => {
    setClearTempLoading(true);
    try {
      const res = await deleteTempFile();
      if (res.httpStatusCode === 200) {
        toast.success(res.message || 'Temporary files cleared successfully');
      } else if (res.httpStatusCode === 401 || res.httpStatusCode === 403) {
        navigate(Constants.LOGIN_ROUTE, { state: { from: location } });
      } else {
        toast.error(res.message || 'Failed to clear temporary files');
      }
    } catch (error) {
      console.error('Clear temp files error:', error);
      toast.error('Failed to clear temporary files');
    } finally {
      setClearTempLoading(false);
    }
  }, [navigate, location]);

  // Handle downloader type change
  const handleDownloaderChange = useCallback((event) => {
    setSelectedDownloader(event.target.value);
    // When user changes download type, automatically show the form
    if (!showDownloadForm) {
      setShowDownloadForm(true);
    }
  }, [showDownloadForm]);

  // Toggle download form visibility
  const toggleDownloadForm = useCallback(() => {
    setShowDownloadForm(prev => !prev);
  }, []);

  const handleDownloadAdded = useCallback(() => {
    setShowDownloadForm(false);
  }, []);

  // WebSocket connection
  const connectWebSocket = useCallback(() => {
    const WEBSOCKET_URL = import.meta.env.VITE_WEBSOCKET_BASEURL || ''
      ? `${import.meta.env.VITE_WEBSOCKET_BASEURL || ''}/ws/status`
      : 'ws://localhost:9000/ws/status';

    try {
      ws.current = new WebSocket(WEBSOCKET_URL);

      ws.current.onopen = () => {
        setConnectionStatus('connected');
        ws.current.send(JSON.stringify({ type: 'subscribe', channel: 'downloads' }));
      };

      ws.current.onmessage = (event) => {
        try {
          const data = import.meta.env.VITE_WEBSOCKET_BASEURL || '' ? JSON.parse(event.data) : StatusTestData;
          setDownloads(data);
          setLastUpdated(new Date());
          if (isInitialLoad) {
            setIsInitialLoad(false);
            setLoading(false);
          }
        } catch (err) {
          console.error("Error parsing WebSocket message:", err);
        }
      };

      ws.current.onerror = (error) => {
        console.error("WebSocket error:", error);
        setConnectionStatus('error');
      };

      ws.current.onclose = (event) => {
        setConnectionStatus('disconnected');
        if (!reconnectTimeout.current && event.code !== 1000) {
          reconnectTimeout.current = setTimeout(() => {
            reconnectTimeout.current = null;
            connectWebSocket();
          }, 5000);
        }
      };
    } catch (error) {
      console.error("Failed to create WebSocket connection:", error);
      setConnectionStatus('error');
    }
  }, [isInitialLoad]);

  // Effects
  useEffect(() => {
    connectWebSocket();
    return () => {
      if (ws.current) {
        ws.current.close(1000, "Component unmounting");
      }
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }
    };
  }, [connectWebSocket]);

  // Stats data for display
  const statCards = useMemo(() => [
    {
      title: 'Active',
      value: summaryStats.active,
      icon: PlayIcon,
      color: theme.palette.success.main
    },
    {
      title: 'Queued',
      value: summaryStats.queued,
      icon: ScheduleIcon,
      color: theme.palette.warning.main
    },
    {
      title: 'Completed',
      value: summaryStats.completed,
      icon: CloudDoneIcon,
      color: theme.palette.info.main
    },
    {
      title: 'Total',
      value: summaryStats.total,
      icon: QueueIcon,
      color: theme.palette.grey[600]
    },
    {
      title: 'Speed',
      value: `${summaryStats.speed.toFixed(1)} MB/s`,
      icon: SpeedIcon,
      color: theme.palette.primary.main
    }
  ], [summaryStats, theme]);

  // Render selected downloader component
  const renderDownloaderComponent = useMemo(() => {
    switch (selectedDownloader) {
      case "youtube":
        return <Youtube_dl onDownloadAdded={handleDownloadAdded} />;
      case "httpFile":
      default:
        return <HttpFile onDownloadAdded={handleDownloadAdded} />;
    }
  }, [selectedDownloader, handleDownloadAdded]);

  return (
    <Box
      sx={{
        maxWidth: '1400px',
        margin: '0 auto',
        p: isMobile ? 1 : 2,
        minHeight: '100vh'
      }}
    >
      {/* Compact Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        style={{ marginBottom: '1.5rem' }}
      >
        {/* Title and Status Row */}
        <Stack 
          direction={isMobile ? "column" : "row"} 
          spacing={1.5} 
          justifyContent="space-between" 
          alignItems={isMobile ? "flex-start" : "center"}
          mb={2}
        >
          <Box>
            <Typography 
              variant={isMobile ? "h5" : "h4"} 
              fontWeight="700" 
              color="text.primary"
              gutterBottom={false}
            >
              Download Manager
            </Typography>
            
            <Stack 
              direction="row" 
              spacing={1.5} 
              alignItems="center" 
              flexWrap="wrap"
              mt={0.5}
            >
              <ConnectionBadge status={connectionStatus} />
              
              {lastUpdated && (
                <Typography 
                  variant="caption" 
                  color="text.secondary"
                  sx={{ 
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    fontSize: '0.75rem'
                  }}
                >
                  <DotIcon sx={{ fontSize: 8 }} />
                  {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Typography>
              )}
            </Stack>
          </Box>

          {/* Action Buttons */}
          <Stack direction="row" spacing={1} alignItems="center">
            <Tooltip title="Clear Temporary Files">
              <span>
                <Button
                  variant="outlined"
                  color="error"
                  size="small"
                  onClick={handleClearTempFiles}
                  disabled={clearTempLoading}
                  startIcon={clearTempLoading ? <CircularProgress size={14} /> : <ClearIcon />}
                  sx={{
                    borderRadius: 1.5,
                    px: 2,
                    py: 0.75,
                    fontSize: '0.8125rem',
                    minWidth: 'auto'
                  }}
                >
                  {clearTempLoading ? '...' : 'Clear'}
                </Button>
              </span>
            </Tooltip>
          </Stack>
        </Stack>

        {/* Stats Grid */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: isSmallMobile ? 'repeat(3, 1fr)' : 'repeat(5, 1fr)',
            gap: 1,
            mb: 2
          }}
        >
          {statCards.map((stat, index) => (
            <CompactStat key={index} {...stat} loading={loading} />
          ))}
        </Box>

        {/* Control Section - Download Type Selector and Add Button */}
        <Box 
          sx={{
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            alignItems: isMobile ? 'stretch' : 'center',
            justifyContent: 'space-between',
            gap: 2,
            p: 2,
            borderRadius: 2,
            bgcolor: alpha(theme.palette.background.paper, 0.7),
            backdropFilter: 'blur(10px)',
            border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            mb: 2
          }}
        >
          {/* Left Side: Download Type Selector */}
          <Box sx={{ flex: 1 }}>
            <Typography 
              variant="subtitle2" 
              fontWeight="600" 
              color="text.primary"
              gutterBottom
              sx={{ fontSize: '0.875rem' }}
            >
              Select Download Type
            </Typography>
            <Select
              fullWidth={isMobile}
              size="small"
              value={selectedDownloader}
              onChange={handleDownloaderChange}
              sx={{ 
                bgcolor: 'background.paper',
                borderRadius: 1.5,
                '& .MuiSelect-select': {
                  py: 1,
                  fontSize: '0.875rem'
                }
              }}
            >
              <MenuItem value="httpFile" sx={{ fontSize: '0.875rem' }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <DownloadIcon sx={{ fontSize: 18 }} />
                  <Typography variant="body2">HTTP File Download</Typography>
                </Stack>
              </MenuItem>
              <MenuItem value="youtube" sx={{ fontSize: '0.875rem' }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Box sx={{ color: 'error.main', fontSize: 20 }}>YT</Box>
                  <Typography variant="body2">YouTube Downloader</Typography>
                </Stack>
              </MenuItem>
            </Select>
          </Box>

          {/* Divider on mobile */}
          {isMobile && <Divider />}

          {/* Right Side: Add Download Button */}
          <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: isMobile ? 'stretch' : 'center',
            justifyContent: 'center'
          }}>
            <Typography 
              variant="subtitle2" 
              fontWeight="600" 
              color="text.primary"
              gutterBottom
              sx={{ 
                fontSize: '0.875rem',
                display: isMobile ? 'block' : 'none'
              }}
            >
              Add New Download
            </Typography>
            <Button
              variant="contained"
              size={isMobile ? "medium" : "large"}
              startIcon={showDownloadForm ? <RemoveIcon /> : <AddIcon />}
              onClick={toggleDownloadForm}
              sx={{
                borderRadius: 1.5,
                px: isMobile ? 2 : 3,
                py: isMobile ? 1 : 1.5,
                fontSize: isMobile ? '0.875rem' : '0.9375rem',
                bgcolor: 'primary.main',
                '&:hover': {
                  bgcolor: 'primary.dark'
                },
                width: isMobile ? '100%' : 'auto'
              }}
            >
              {showDownloadForm ? 'Hide Form' : `Add ${selectedDownloader === 'httpFile' ? 'HTTP' : 'YouTube'} Download`}
            </Button>
          </Box>
        </Box>

        {/* Help Text */}
        <Typography 
          variant="caption" 
          color="text.secondary"
          sx={{ 
            display: 'block',
            textAlign: 'center',
            fontStyle: 'italic',
            mt: 1
          }}
        >
          {showDownloadForm 
            ? `Fill in the form below to add a new ${selectedDownloader === 'httpFile' ? 'HTTP file' : 'YouTube video'} download` 
            : 'Click "Add Download" to start a new download'}
        </Typography>
      </motion.div>

      {/* Download Form Section */}
      <AnimatePresence>
        {showDownloadForm && (
          <motion.div
            key="download-form"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            style={{ marginBottom: '1.5rem' }}
          >
            <Box
              sx={{
                p: isMobile ? 1.5 : 2,
                borderRadius: 2,
                bgcolor: alpha(theme.palette.background.paper, 0.9),
                backdropFilter: 'blur(10px)',
                border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                boxShadow: '0 4px 20px rgba(0,0,0,0.05)'
              }}
            >
              {/* <Typography 
                variant="subtitle1" 
                fontWeight="600" 
                color="text.primary"
                gutterBottom
                sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 1,
                  fontSize: isMobile ? '0.9375rem' : '1rem',
                  mb: 2
                }}
              >
                {selectedDownloader === 'httpFile' ? (
                  <>
                    <DownloadIcon sx={{ color: 'primary.main', fontSize: 20 }} />
                    Add HTTP File Download
                  </>
                ) : (
                  <>
                    <Box sx={{ color: 'error.main', fontSize: 22 }}>YT</Box>
                    Add YouTube Download
                  </>
                )}
              </Typography> */}
              {renderDownloaderComponent}
            </Box>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Downloads List */}
      <Box>
        {isInitialLoad ? (
          <Box 
            sx={{ 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center', 
              py: 8 
            }}
          >
            <CircularProgress size={32} />
          </Box>
        ) : (
          <DownloadsList
            downloads={downloads}
            loading={loading}
            onStatusChange={() => {
              // Refresh logic here if needed
            }}
          />
        )}
      </Box>

      {/* Footer Status */}
      {downloads.length > 0 && (
        <Box 
          sx={{ 
            mt: 2, 
            pt: 1, 
            borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 1
          }}
        >
          <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <InfoIcon sx={{ fontSize: 12 }} />
            Showing {downloads.length} downloads
          </Typography>
          {connectionStatus === 'connected' && lastUpdated && (
            <Typography variant="caption" color="text.secondary">
              Updated: {lastUpdated.toLocaleTimeString()}
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
}

export default React.memo(DownloadManager);