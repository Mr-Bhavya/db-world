import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  IconButton,
  Tooltip,
  MenuItem,
  Select,
  useMediaQuery,
  useTheme
} from '@mui/material';
import {
  Refresh,
  SignalCellularAlt,
  DeleteSweep as ClearIcon,
  Add as AddIcon,
  Remove as RemoveIcon
} from '@mui/icons-material';
import DownloadsList from './DownloadsList';
import DownloadTypeSelector from './DownloadTypeSelector';
import { toast } from '../../Toast';
import { deleteTempFile } from '../../ApiServices';
import Constants from '../../Constants';

function DownloadManager() {
  const [status, setStatus] = useState([]);
  const [summaryStats, setSummaryStats] = useState({
    active: 0,
    waiting: 0,
    stopped: 0,
    downloadSpeed: 0,
    uploadSpeed: 0,
    numActive: 0,
    numWaiting: 0,
    numStopped: 0
  });
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [apiError, setApiError] = useState(false);
  const [selectedDownloader, setSelectedDownloader] = useState("httpFile");
  const [clearTempLoading, setClearTempLoading] = useState(false);
  const [showDownloadForm, setShowDownloadForm] = useState(false);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isSmallMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const navigate = useNavigate();
  const location = useLocation();
  const ws = useRef(null);
  const reconnectTimeout = useRef(null);

  // === Fetch Queue Stats ===
  const fetchQueueStats = useCallback(async () => {
    // try {
    //   setLoading(true);
    //   setApiError(false);

    //   const [queueStatusRes, activeRes, waitingRes] = await Promise.all([
    //     axiosInstance.get('/api/downloads/queue/status'),
    //     axiosInstance.get('/api/downloads/active'),
    //     axiosInstance.get('/api/downloads/waiting')
    //   ]);

    //   const [queueStatus, activeDownloads, waitingDownloads] = await Promise.all([
    //     queueStatusRes.data,
    //     activeRes.data,
    //     waitingRes.data
    //   ]);

    //   setSummaryStats(prev => ({
    //     ...prev,
    //     downloadSpeed: queueStatus.downloadSpeed ? queueStatus.downloadSpeed / 1024 / 1024 : 0,
    //     uploadSpeed: queueStatus.uploadSpeed ? queueStatus.uploadSpeed / 1024 / 1024 : 0,
    //     numActive: queueStatus.numActive || 0,
    //     numWaiting: queueStatus.numWaiting || 0,
    //     numStopped: queueStatus.numStopped || 0,
    //     active: activeDownloads.length || 0,
    //     waiting: waitingDownloads.length || 0
    //   }));

    //   setLastUpdated(new Date());
    // } catch (error) {
    //   console.error('Failed to fetch queue stats:', error);
    //   setApiError(true);
    //   toast.error('Failed to load queue statistics');
    // } finally {
    //   setLoading(false);
    // }
  }, []);

  // === Clear Temporary Files ===
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

  // === Downloader Handlers ===
  const handleDownloaderChange = useCallback((event) => {
    setSelectedDownloader(event.target.value);
  }, []);

  const toggleDownloadForm = useCallback(() => {
    setShowDownloadForm(prev => !prev);
  }, []);

  const handleDownloadAdded = useCallback(() => {
    setShowDownloadForm(false);
    // fetchQueueStats();
  }, [fetchQueueStats]);

  // === WebSocket connection ===
  const connectWebSocket = useCallback(() => {
    const WEBSOCKET_URL = process.env.REACT_APP_WEBSOCKET_BASEURL
      ? `${process.env.REACT_APP_WEBSOCKET_BASEURL}/ws/status`
      : 'ws://localhost:9000/ws/status';

    try {
      ws.current = new WebSocket(WEBSOCKET_URL);

      ws.current.onopen = () => {
        setConnectionStatus('connected');
        ws.current.send('');
      };

      ws.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setStatus(prevStatus => {
            return data.map(newItem => {
              const existingItem = prevStatus.find(item => item.id === newItem.id);
              return existingItem ? { ...existingItem, ...newItem } : newItem;
            });
          });
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
  }, []);

  // === Effects ===
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

//   useEffect(() => {
//     fetchQueueStats();
//     const interval = setInterval(fetchQueueStats, 30000);
//     return () => clearInterval(interval);
//   }, [fetchQueueStats]);

  // === Computed Stats ===
  const statsData = useMemo(() => {
    if (apiError && status.length > 0) {
      const active = status.filter(d => d.status === 'active').length;
      const waiting = status.filter(d => d.status === 'waiting' || d.status === 'paused').length;
      const total = status.length;
      const dlSpeed = status.reduce((sum, d) => sum + (d.downloadSpeed || 0) / 1024 / 1024, 0);
      const upSpeed = status.reduce((sum, d) => sum + (d.uploadSpeed || 0) / 1024 / 1024, 0);

      return {
        totalDownloads: total,
        activeCount: active,
        waitingCount: waiting,
        downloadSpeed: dlSpeed,
        uploadSpeed: upSpeed
      };
    }

    const total = (summaryStats.numActive || 0) + (summaryStats.numWaiting || 0) + (summaryStats.numStopped || 0) || status.length;
    const active = summaryStats.numActive || summaryStats.active || 0;
    const waiting = summaryStats.numWaiting || summaryStats.waiting || 0;
    const dlSpeed = summaryStats.downloadSpeed > 0 ? summaryStats.downloadSpeed : (summaryStats.downloadSpeed || 0);
    const upSpeed = summaryStats.uploadSpeed > 0 ? summaryStats.uploadSpeed : (summaryStats.uploadSpeed || 0);

    return {
      totalDownloads: total,
      activeCount: active,
      waitingCount: waiting,
      downloadSpeed: dlSpeed,
      uploadSpeed: upSpeed
    };
  }, [summaryStats, status.length, apiError, status]);

  // Connection status color
  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return '#28a745';
      case 'connecting': return '#ffc107';
      case 'error': return '#dc3545';
      case 'disconnected': return '#6c757d';
      default: return '#6c757d';
    }
  };

  return (
    <Box
      sx={{
        maxWidth: '1200px',
        margin: '0 auto',
        p: isMobile ? 1 : 2,
      }}
    >
      {/* ===== Combined Header ===== */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        style={{
          marginBottom: '2rem',
          borderRadius: '12px',
          background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
          border: '1px solid rgba(0,0,0,0.08)',
          boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
          padding: isMobile ? '1.5rem' : '2rem',
        }}
      >
        {/* Main Title Row */}
        <Box
          display="flex"
          flexDirection={isMobile ? "column" : "row"}
          justifyContent="space-between"
          alignItems={isMobile ? "flex-start" : "center"}
          gap={2}
          mb={3}
        >
          {/* Left Side - Title and Info */}
          <Box>
            <Typography 
              variant="h4" 
              fontWeight="700" 
              color="#2c3e50"
              gutterBottom
            >
              Download Manager
            </Typography>
            
            <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
              {/* Connection Status */}
              <Box display="flex" alignItems="center" gap={1}>
                <SignalCellularAlt 
                  sx={{ 
                    fontSize: '1.2rem',
                    color: getConnectionStatusColor() 
                  }} 
                />
                <Typography
                  variant="body1"
                  fontWeight="600"
                  sx={{
                    color: getConnectionStatusColor(),
                  }}
                >
                  {connectionStatus.charAt(0).toUpperCase() + connectionStatus.slice(1)}
                </Typography>
              </Box>

              {/* Last Updated */}
              {lastUpdated && (
                <Typography 
                  variant="body2" 
                  color="text.secondary"
                  sx={{ 
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5
                  }}
                >
                  Last updated: {lastUpdated.toLocaleTimeString()}
                </Typography>
              )}

              {/* API Error */}
              {apiError && (
                <Typography 
                  variant="caption" 
                  color="error"
                  sx={{ 
                    background: 'rgba(220,53,69,0.1)',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '4px'
                  }}
                >
                  Using fallback data
                </Typography>
              )}
            </Box>
          </Box>

          {/* Right Side - Action Buttons */}
          <Box display="flex" alignItems="center" gap={1}>
            {/* <Tooltip title="Refresh Stats">
              <span>
                <IconButton 
                  onClick={fetchQueueStats} 
                  disabled={loading}
                  sx={{
                    background: 'rgba(0,123,255,0.1)',
                    '&:hover': { background: 'rgba(0,123,255,0.2)' }
                  }}
                >
                  {loading ? <CircularProgress size={24} /> : <Refresh />}
                </IconButton>
              </span>
            </Tooltip> */}

            <Tooltip title="Clear Temporary Files">
              <span>
                <IconButton 
                  onClick={handleClearTempFiles} 
                  disabled={clearTempLoading}
                  sx={{
                    background: 'rgba(220,53,69,0.1)',
                    '&:hover': { background: 'rgba(220,53,69,0.2)' }
                  }}
                >
                  {clearTempLoading ? <CircularProgress size={24} /> : <ClearIcon />}
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        </Box>

        {/* Description and Controls Row */}
        <Box
          display="flex"
          flexDirection={isMobile ? "column" : "row"}
          justifyContent="space-between"
          alignItems={isMobile ? "flex-start" : "center"}
          gap={2}
        >
          {/* Left Side - Description */}
          <Box flex={1}>
            <Typography 
              variant="body1" 
              color="text.secondary"
              sx={{ lineHeight: 1.6 }}
            >
              Add new downloads to the queue and manage existing ones. Monitor progress, speed, and status in real-time.
            </Typography>
          </Box>

          {/* Right Side - Controls */}
          <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
            {/* Download Type Selector */}
            <Box display="flex" alignItems="center" gap={1}>
              <Typography variant="body2" fontWeight="500" color="text.primary">
                Type:
              </Typography>
              <Select
                size="small"
                value={selectedDownloader}
                onChange={handleDownloaderChange}
                sx={{ 
                  minWidth: 150,
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
              size={isMobile ? "medium" : "large"}
              startIcon={showDownloadForm ? <RemoveIcon /> : <AddIcon />}
              onClick={toggleDownloadForm}
              sx={{
                background: showDownloadForm ? 
                  'linear-gradient(135deg, #6c757d 0%, #5a6268 100%)' : 
                  'linear-gradient(135deg, #007bff 0%, #0056b3 100%)',
                '&:hover': {
                  background: showDownloadForm ? 
                    'linear-gradient(135deg, #5a6268 0%, #495057 100%)' : 
                    'linear-gradient(135deg, #0056b3 0%, #004085 100%)'
                },
                px: 3,
                py: 1
              }}
            >
              {showDownloadForm ? 'Hide' : 'Add'}
            </Button>
          </Box>
        </Box>
      </motion.div>

      {/* Download Form Section */}
      <DownloadTypeSelector
        selectedDownloader={selectedDownloader}
        onDownloadAdded={handleDownloadAdded}
        showDownloadForm={showDownloadForm}
        isMobile={isMobile}
      />

      {/* Downloads List */}
      <DownloadsList
        status={status}
        mirrorStatuses={status}
        loading={loading}
        isMobile={isMobile}
        onStatusChange={fetchQueueStats}
      />
    </Box>
  );
}

export default React.memo(DownloadManager);