import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Constants from '../../Constants';
import { cancelledMirror, deleteMirror, deleteTempFile } from '../../ApiServices';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Download as DownloadIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  PauseCircle as PauseCircleIcon,
  Archive as ArchiveIcon,
  Block as BlockIcon,
  SignalCellularAlt,
  PlayArrow as PlayArrowIcon,
  Schedule as ScheduleIcon,
  Queue as QueueIcon,
  Speed as SpeedIcon,
  Refresh,
  Delete as ClearIcon,
  Add as AddIcon
} from '@mui/icons-material';
import StatusCard from './StatusCard';
import { toast } from '../../Toast';
import axiosInstance from '../../Utils/AxiosInstants';
import { CircularProgress, IconButton, useMediaQuery, useTheme, Button, MenuItem, Select, FormControl, Box, Typography } from '@mui/material';
import Youtube_dl from '../Mirror/youtubedl/Youtube_dl';
import HttpFile from '../Mirror/HttpFile';

// Animation variants with enhanced effects
const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.4,
      ease: [0.25, 0.1, 0.25, 1],
      when: "beforeChildren",
      staggerChildren: 0.1
    }
  },
  exit: {
    opacity: 0,
    x: -50,
    transition: {
      duration: 0.2,
      ease: "easeIn"
    }
  },
  hover: {
    y: -2,
    boxShadow: "0 10px 20px rgba(0,0,0,0.1)",
    transition: { duration: 0.2 }
  }
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2
    }
  }
};

const statItemVariants = {
  hidden: { opacity: 0, x: -10 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.3 }
  }
};

// Stats card component for better reusability
const StatCard = React.memo(({ 
  value, 
  label, 
  icon: Icon, 
  gradient, 
  formatValue = (val) => val,
  isLoading = false,
  isMobile = false
}) => (
  <motion.div
    variants={statItemVariants}
    whileHover={!isMobile ? { scale: 1.02 } : {}}
    style={{
      padding: isMobile ? '1rem' : '1.5rem',
      borderRadius: '12px',
      background: gradient,
      color: 'white',
      boxShadow: `0 4px 15px ${gradient.split('0%, ')[1].split(' ')[0]}20`,
      minHeight: isMobile ? '100px' : '120px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      position: 'relative',
      overflow: 'hidden'
    }}
  >
    {isLoading && (
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(255, 255, 255, 0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(2px)'
        }}
      >
        <CircularProgress 
          size={isMobile ? 20 : 24} 
          style={{ color: 'white' }} 
        />
      </div>
    )}
    
    <div style={{ 
      display: 'flex', 
      alignItems: 'flex-start', 
      justifyContent: 'space-between',
      opacity: isLoading ? 0.7 : 1
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ 
          fontSize: isMobile ? '1.5rem' : '2rem', 
          fontWeight: 'bold', 
          marginBottom: '0.5rem', 
          lineHeight: 1 
        }}>
          {isLoading ? '--' : formatValue(value)}
        </div>
        <div style={{ 
          fontSize: isMobile ? '0.8rem' : '0.9rem', 
          opacity: 0.9 
        }}>
          {label}
        </div>
      </div>
      <Icon style={{ 
        fontSize: isMobile ? '1.5rem' : '2rem', 
        opacity: 0.8, 
        marginLeft: '0.5rem' 
      }} />
    </div>
  </motion.div>
));

// Skeleton loader for stats
const StatCardSkeleton = ({ gradient, isMobile }) => (
  <motion.div
    variants={statItemVariants}
    style={{
      padding: isMobile ? '1rem' : '1.5rem',
      borderRadius: '12px',
      background: gradient,
      color: 'white',
      boxShadow: `0 4px 15px ${gradient.split('0%, ')[1].split(' ')[0]}20`,
      minHeight: isMobile ? '100px' : '120px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      opacity: 0.7
    }}
  >
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
      <div style={{ flex: 1 }}>
        <div style={{ 
          fontSize: isMobile ? '1.5rem' : '2rem', 
          fontWeight: 'bold', 
          marginBottom: '0.5rem', 
          lineHeight: 1,
          background: 'rgba(255,255,255,0.3)',
          borderRadius: '4px',
          width: isMobile ? '60%' : '50%',
          height: isMobile ? '1.5rem' : '2rem'
        }} />
        <div style={{ 
          fontSize: isMobile ? '0.8rem' : '0.9rem', 
          opacity: 0.9,
          background: 'rgba(255,255,255,0.3)',
          borderRadius: '4px',
          width: '40%',
          height: isMobile ? '0.8rem' : '0.9rem'
        }} />
      </div>
      <div style={{ 
        width: isMobile ? '1.5rem' : '2rem',
        height: isMobile ? '1.5rem' : '2rem',
        background: 'rgba(255,255,255,0.3)',
        borderRadius: '4px'
      }} />
    </div>
  </motion.div>
);

// Download Type Selector Component
const DownloadTypeSelector = React.memo(({ 
  selectedDownloader, 
  onDownloaderChange, 
  onClearTemp, 
  clearLoading,
  isMobile 
}) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3 }}
    style={{
      display: 'flex',
      flexDirection: isMobile ? 'column' : 'row',
      gap: isMobile ? '1rem' : '1.5rem',
      alignItems: isMobile ? 'stretch' : 'center',
      marginBottom: '2rem',
      padding: isMobile ? '1rem' : '1.5rem',
      borderRadius: '12px',
      background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
      border: '1px solid rgba(0,0,0,0.08)',
      boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
    }}
  >
    <Box sx={{ 
      display: 'flex', 
      flexDirection: isMobile ? 'column' : 'row', 
      alignItems: isMobile ? 'stretch' : 'center',
      gap: isMobile ? '1rem' : '2rem',
      flex: 1
    }}>
      {/* Add New Download Section */}
      <Box sx={{ 
        display: 'flex', 
        flexDirection: isMobile ? 'column' : 'row', 
        alignItems: isMobile ? 'stretch' : 'center',
        gap: '1rem',
        flex: 1
      }}>
        <AddIcon sx={{ 
          color: '#007bff', 
          fontSize: isMobile ? '1.5rem' : '2rem' 
        }} />
        
        <Box sx={{ flex: 1 }}>
          <Typography 
            variant={isMobile ? "h6" : "h5"} 
            sx={{ 
              fontWeight: 600, 
              color: '#495057',
              marginBottom: '0.5rem'
            }}
          >
            Add New Download
          </Typography>
          <Typography 
            variant="body2" 
            sx={{ 
              color: '#6c757d',
              fontSize: isMobile ? '0.8rem' : '0.875rem'
            }}
          >
            Choose download type and add new downloads to the queue
          </Typography>
        </Box>
      </Box>

      {/* Download Type Selector */}
      <FormControl 
        size={isMobile ? "small" : "medium"}
        sx={{ 
          minWidth: isMobile ? '100%' : 200,
          background: 'white',
          borderRadius: '8px'
        }}
      >
        <Select
          value={selectedDownloader}
          onChange={onDownloaderChange}
          displayEmpty
          sx={{
            borderRadius: '8px',
            '& .MuiSelect-select': {
              padding: isMobile ? '0.5rem' : '0.75rem'
            }
          }}
        >
          <MenuItem value="httpFile">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <DownloadIcon sx={{ fontSize: '1rem' }} />
              HTTP File Download
            </Box>
          </MenuItem>
          <MenuItem value="youtube">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <PlayArrowIcon sx={{ fontSize: '1rem' }} />
              YouTube Download
            </Box>
          </MenuItem>
        </Select>
      </FormControl>
    </Box>

    {/* Clear Temp Button */}
    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
      <Button
        variant="outlined"
        color="error"
        onClick={onClearTemp}
        disabled={clearLoading}
        startIcon={clearLoading ? <CircularProgress size={16} /> : <ClearIcon />}
        sx={{
          borderRadius: '8px',
          padding: isMobile ? '0.5rem 1rem' : '0.75rem 1.5rem',
          minWidth: isMobile ? '100%' : 'auto',
          borderWidth: '2px',
          '&:hover': {
            borderWidth: '2px'
          }
        }}
      >
        {clearLoading ? 'Cleaning...' : 'Clear Temp Files'}
      </Button>
    </motion.div>
  </motion.div>
));

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
  const [showDownloadForm, setShowDownloadForm] = useState(true);
  
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isSmallMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const navigate = useNavigate();
  const location = useLocation();
  const ws = useRef(null);
  const reconnectTimeout = useRef(null);

  // Memoized API call to get queue statistics
  const fetchQueueStats = useCallback(async () => {
    try {
      setLoading(true);
      setApiError(false);
      
      const [queueStatusRes, activeRes, waitingRes] = await Promise.all([
        axiosInstance.get('/api/downloads/queue/status'),
        axiosInstance.get('/api/downloads/active'),
        axiosInstance.get('/api/downloads/waiting')
      ]);

      const [queueStatus, activeDownloads, waitingDownloads] = await Promise.all([
        queueStatusRes.data,
        activeRes.data,
        waitingRes.data
      ]);

      setSummaryStats(prev => ({
        ...prev,
        downloadSpeed: queueStatus.downloadSpeed ? queueStatus.downloadSpeed / 1024 / 1024 : 0,
        uploadSpeed: queueStatus.uploadSpeed ? queueStatus.uploadSpeed / 1024 / 1024 : 0,
        numActive: queueStatus.numActive || 0,
        numWaiting: queueStatus.numWaiting || 0,
        numStopped: queueStatus.numStopped || 0,
        active: activeDownloads.length || 0,
        waiting: waitingDownloads.length || 0
      }));

      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to fetch queue stats:', error);
      setApiError(true);
      toast.error('Failed to load queue statistics');
    } finally {
      setLoading(false);
    }
  }, []);

  // Clear temporary files
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

  // Handle downloader change
  const handleDownloaderChange = useCallback((event) => {
    setSelectedDownloader(event.target.value);
  }, []);

  // Optimized WebSocket connection with better error handling
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

  // Cleanup WebSocket on unmount
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

  // Fetch queue stats on component mount and periodically
  useEffect(() => {
    fetchQueueStats();
    const interval = setInterval(fetchQueueStats, 30000);
    return () => clearInterval(interval);
  }, [fetchQueueStats]);

  // Memoized stats calculations with fallback data
  const { totalDownloads, activeCount, waitingCount, downloadSpeed, uploadSpeed } = useMemo(() => {
    // If API failed, use WebSocket data or show zeros
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

    // Use API data when available
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

  // Format speed for display
  const formatSpeed = (speed) => {
    return speed > 0 ? speed.toFixed(2) : '0';
  };

  // Connection status display with better visual indicators
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

  // Stats configuration for cleaner render
  const statsConfig = [
    {
      value: activeCount,
      label: 'Active',
      icon: PlayArrowIcon,
      gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    },
    {
      value: waitingCount,
      label: 'Waiting',
      icon: ScheduleIcon,
      gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
    },
    {
      value: totalDownloads,
      label: 'Total',
      icon: QueueIcon,
      gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'
    },
    {
      value: { download: downloadSpeed, upload: uploadSpeed },
      label: 'Speed',
      icon: SpeedIcon,
      gradient: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
      formatValue: (value) => (
        <div>
          <div style={{ fontSize: isMobile ? '1rem' : '1.2rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>
            ↓ {formatSpeed(value.download)} MB/s
          </div>
          <div style={{ fontSize: isMobile ? '1rem' : '1.2rem', fontWeight: 'bold' }}>
            ↑ {formatSpeed(value.upload)} MB/s
          </div>
        </div>
      )
    }
  ];

  // Grid layout for mobile responsiveness
  const getGridTemplateColumns = () => {
    if (isSmallMobile) {
      return 'repeat(2, 1fr)'; // 2 columns for very small screens
    } else if (isMobile) {
      return 'repeat(2, 1fr)'; // 2 columns for mobile
    } else {
      return 'repeat(auto-fit, minmax(240px, 1fr))'; // Responsive for desktop
    }
  };

  // Render selected downloader component
  const renderDownloaderComponent = useMemo(() => {
    switch (selectedDownloader) {
      case "youtube":
        return <Youtube_dl onDownloadAdded={fetchQueueStats} />;
      case "httpFile":
      default:
        return <HttpFile onDownloadAdded={fetchQueueStats} />;
    }
  }, [selectedDownloader, fetchQueueStats]);

  return (
    <div
      className="download-container"
      style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: isMobile ? '0 0.5rem' : '0 1rem'
      }}
    >
      {/* Header Section */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          justifyContent: 'space-between',
          alignItems: isMobile ? 'stretch' : 'center',
          gap: isMobile ? '1rem' : '0',
          marginBottom: '1.5rem',
          padding: isMobile ? '1rem' : '1rem 1.5rem',
          borderRadius: '12px',
          background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
          border: '1px solid rgba(0,0,0,0.08)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
        }}
      >
        <div style={{ textAlign: isMobile ? 'center' : 'left' }}>
          <div style={{ 
            fontWeight: 700, 
            color: '#495057', 
            fontSize: isMobile ? '1.25rem' : '1.5rem',
            marginBottom: isMobile ? '0.25rem' : '0.5rem'
          }}>
            Download Manager
          </div>
          {lastUpdated && (
            <small style={{ color: '#6c757d', fontSize: '0.75rem' }}>
              Last updated: {lastUpdated.toLocaleTimeString()}
            </small>
          )}
          {apiError && (
            <small style={{ color: '#dc3545', fontSize: '0.75rem', display: 'block', marginTop: '0.25rem' }}>
              Using fallback data
            </small>
          )}
        </div>
        
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: isMobile ? 'center' : 'flex-end',
          gap: '1rem'
        }}>
          {/* Refresh Button */}
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <IconButton
              onClick={fetchQueueStats}
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
          </motion.div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <SignalCellularAlt 
              sx={{ 
                fontSize: isMobile ? '1rem' : '1.2rem',
                color: getConnectionStatusColor() 
              }} 
            />
            <span
              style={{
                color: getConnectionStatusColor(),
                fontWeight: 600,
                fontSize: isMobile ? '0.8rem' : '0.9rem'
              }}
            >
              {getConnectionStatusText()}
            </span>
          </div>
        </div>
      </motion.div>

      {/* Add New Download Section */}
      <DownloadTypeSelector
        selectedDownloader={selectedDownloader}
        onDownloaderChange={handleDownloaderChange}
        onClearTemp={handleClearTempFiles}
        clearLoading={clearTempLoading}
        isMobile={isMobile}
      />

      {/* Download Form Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        style={{
          marginBottom: '2rem'
        }}
      >
        {renderDownloaderComponent}
      </motion.div>

      {/* Queue Summary Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        style={{
          display: 'grid',
          gridTemplateColumns: getGridTemplateColumns(),
          gap: isMobile ? '1rem' : '1.5rem',
          marginBottom: '2rem'
        }}
      >
        {loading && !apiError ? (
          // Show skeleton loaders when loading
          statsConfig.map((stat, index) => (
            <StatCardSkeleton
              key={stat.label}
              gradient={stat.gradient}
              isMobile={isMobile}
            />
          ))
        ) : (
          // Show actual stats or fallback data
          statsConfig.map((stat, index) => (
            <StatCard
              key={stat.label}
              value={stat.value}
              label={stat.label}
              icon={stat.icon}
              gradient={stat.gradient}
              formatValue={stat.formatValue}
              isLoading={loading && apiError}
              isMobile={isMobile}
            />
          ))
        )}
      </motion.div>

      {/* Downloads List */}
      {(!status || status.length === 0) ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          style={{
            padding: isMobile ? '2rem 1rem' : '3rem 2rem',
            textAlign: 'center',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%)',
            border: '2px dashed #ffc107',
            margin: '2rem 0'
          }}
        >
          <DownloadIcon
            style={{
              fontSize: isMobile ? '2rem' : '3rem',
              color: '#ffc107',
              marginBottom: '1rem'
            }}
          />
          <div style={{ 
            color: '#856404', 
            fontWeight: 600, 
            fontSize: isMobile ? '1rem' : '1.2rem', 
            marginBottom: '0.5rem' 
          }}>
            No active downloads
          </div>
          <small style={{ color: '#b08e32' }}>
            Add a new download using the form above to get started
          </small>
        </motion.div>
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(350px, 1fr))',
            gap: isMobile ? '1rem' : '1.5rem',
            alignItems: 'start'
          }}
        >
          <AnimatePresence>
            {status.map((download) => (
              <StatusCard 
                key={download.id} 
                download={download} 
                onStatusChange={fetchQueueStats}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}

export default React.memo(DownloadManager);