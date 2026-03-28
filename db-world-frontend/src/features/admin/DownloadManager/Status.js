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
  Add as AddIcon,
  Link as LinkIcon,
  Magnet as MagnetIcon,
  PictureAsPdf as PdfIcon,
  VideoFile as VideoIcon
} from '@mui/icons-material';
import StatusCard from './StatusCard';
import { toast } from '../../Toast';
import axiosInstance from '../../Utils/AxiosInstants';
import { CircularProgress, IconButton, useMediaQuery, useTheme, Button, MenuItem, Select, FormControl, Box, Typography, Chip } from '@mui/material';
import Youtube_dl from '../Mirror/youtubedl/Youtube_dl';
import HttpFile from '../Mirror/HttpFile';
import StatusTestData from './status-test-data';

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

// File type icon mapper
const getFileTypeIcon = (fileType, isMagnet = false) => {
  if (isMagnet) return MagnetIcon;
  if (fileType?.includes('video')) return VideoIcon;
  if (fileType?.includes('pdf')) return PdfIcon;
  return DownloadIcon;
};

// Download status mapper
const getStatusColor = (status, currentState) => {
  switch (status || currentState) {
    case 'DOWNLOAD':
    case 'active':
      return 'success';
    case 'PAUSE':
    case 'paused':
      return 'warning';
    case 'SUCCESS':
    case 'completed':
      return 'primary';
    case 'ERROR':
    case 'error':
      return 'error';
    case 'QUEUED':
    case 'queued':
      return 'info';
    default:
      return 'default';
  }
};

// Stats card component
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
              <LinkIcon sx={{ fontSize: '1rem' }} />
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
  const [downloads, setDownloads] = useState([]);
  const [summaryStats, setSummaryStats] = useState({
    active: 0,
    waiting: 0,
    stopped: 0,
    downloadSpeed: 0,
    uploadSpeed: 0,
    numActive: 0,
    numWaiting: 0,
    numStopped: 0,
    totalSpeed: 0
  });
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [apiError, setApiError] = useState(false);
  const [selectedDownloader, setSelectedDownloader] = useState("httpFile");
  const [clearTempLoading, setClearTempLoading] = useState(false);
  
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isSmallMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const navigate = useNavigate();
  const location = useLocation();
  const ws = useRef(null);
  const reconnectTimeout = useRef(null);

  // Process downloads data to calculate stats
  const processDownloadsData = useCallback((downloadsData) => {
    if (!downloadsData || downloadsData.length === 0) {
      return {
        total: 0,
        active: 0,
        queued: 0,
        paused: 0,
        completed: 0,
        totalSpeed: 0,
        totalDownloaded: 0,
        totalSize: 0
      };
    }

    let active = 0;
    let queued = 0;
    let paused = 0;
    let completed = 0;
    let totalSpeed = 0;
    let totalDownloaded = 0;
    let totalSize = 0;

    downloadsData.forEach(item => {
      const statusData = item.status || {};
      const downloadStatus = statusData.downloadStatus || {};
      const currentState = statusData.currentState;
      
      // Count by state
      if (currentState === 'DOWNLOAD' && item.isRunning) {
        active++;
      } else if (item.isQueued) {
        queued++;
      } else if (currentState === 'PAUSE') {
        paused++;
      } else if (currentState === 'SUCCESS') {
        completed++;
      }

      // Calculate speeds and sizes
      if (downloadStatus.speed) {
        totalSpeed += downloadStatus.speed;
      }
      if (downloadStatus.fileDownloaded) {
        totalDownloaded += downloadStatus.fileDownloaded;
      }
      if (statusData.fileSize) {
        totalSize += statusData.fileSize;
      }
    });

    return {
      total: downloadsData.length,
      active,
      queued,
      paused,
      completed,
      totalSpeed: totalSpeed / 1024 / 1024, // Convert to MB/s
      totalDownloaded,
      totalSize,
      progress: totalSize > 0 ? (totalDownloaded / totalSize) * 100 : 0
    };
  }, []);

  // Memoized API call to get queue statistics
  const fetchQueueStats = useCallback(async () => {
    try {
      setLoading(true);
      setApiError(false);
      
      const response = await axiosInstance.get('/api/downloads/status');
      const data = response.data || [];

      // Calculate stats from the data
      const stats = processDownloadsData(data);
      
      setSummaryStats(prev => ({
        ...prev,
        downloadSpeed: stats.totalSpeed,
        uploadSpeed: 0, // Assuming no upload in this context
        numActive: stats.active,
        numWaiting: stats.queued + stats.paused,
        numStopped: stats.completed,
        active: stats.active,
        waiting: stats.queued + stats.paused,
        totalSpeed: stats.totalSpeed,
        progress: stats.progress
      }));

      setDownloads(data);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to fetch queue stats:', error);
      setApiError(true);
      toast.error('Failed to load download statistics');
    } finally {
      setLoading(false);
    }
  }, [processDownloadsData]);

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
        ws.current.send(JSON.stringify({ type: 'subscribe', channel: 'downloads' }));
      };

      ws.current.onmessage = (event) => {
        try {
          let data = JSON.parse(event.data);

          data = StatusTestData; // <-- For testing purposes only, remove in production
          
          console.log('WebSocket message received:', data);

          // Handle different message types
          if (data.type === 'status_update') {
            setDownloads(prevDownloads => {
              // Update existing download or add new one
              return data.downloads.map(newItem => {
                const existingItem = prevDownloads.find(item => 
                  item.status && item.status.id === newItem.status?.id
                );
                return existingItem ? { ...existingItem, ...newItem } : newItem;
              });
            });
          } else if (Array.isArray(data)) {
            // Direct array of downloads (legacy support)
            setDownloads(data);
          }
          
          // Recalculate stats when we get new data
          const stats = processDownloadsData(
            Array.isArray(data) ? data : (data.downloads || [])
          );
          
          setSummaryStats(prev => ({
            ...prev,
            downloadSpeed: stats.totalSpeed,
            numActive: stats.active,
            numWaiting: stats.queued + stats.paused,
            numStopped: stats.completed
          }));
          
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
  }, [processDownloadsData]);

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

  // Memoized stats calculations
  const {
    totalDownloads,
    activeCount,
    waitingCount,
    downloadSpeed,
    progress
  } = useMemo(() => {
    const stats = processDownloadsData(downloads);
    
    // Use WebSocket data if available, otherwise use API data
    if (downloads.length > 0) {
      return {
        totalDownloads: stats.total,
        activeCount: stats.active,
        waitingCount: stats.queued + stats.paused,
        downloadSpeed: stats.totalSpeed,
        progress: stats.progress,
        completedCount: stats.completed
      };
    }

    // Fallback to API data
    return {
      totalDownloads: (summaryStats.numActive || 0) + 
                     (summaryStats.numWaiting || 0) + 
                     (summaryStats.numStopped || 0),
      activeCount: summaryStats.numActive || 0,
      waitingCount: summaryStats.numWaiting || 0,
      downloadSpeed: summaryStats.downloadSpeed || 0,
      progress: summaryStats.progress || 0,
      completedCount: summaryStats.numStopped || 0
    };
  }, [summaryStats, downloads, processDownloadsData]);

  // Format speed for display
  const formatSpeed = (speed) => {
    return speed > 0 ? speed.toFixed(2) : '0';
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  // Connection status display
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

  // Group downloads by status for better organization
  const groupedDownloads = useMemo(() => {
    const groups = {
      active: [],
      queued: [],
      paused: [],
      completed: [],
      error: []
    };

    downloads.forEach(item => {
      const statusData = item.status || {};
      const currentState = statusData.currentState;
      
      if (currentState === 'DOWNLOAD' && item.isRunning) {
        groups.active.push(item);
      } else if (item.isQueued) {
        groups.queued.push(item);
      } else if (currentState === 'PAUSE') {
        groups.paused.push(item);
      } else if (currentState === 'SUCCESS') {
        groups.completed.push(item);
      } else if (currentState === 'ERROR') {
        groups.error.push(item);
      }
    });

    return groups;
  }, [downloads]);

  // Stats configuration
  const statsConfig = [
    {
      value: activeCount,
      label: 'Active',
      icon: PlayArrowIcon,
      gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    },
    {
      value: waitingCount,
      label: 'In Queue',
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
      value: { speed: downloadSpeed, progress },
      label: 'Speed & Progress',
      icon: SpeedIcon,
      gradient: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
      formatValue: (value) => (
        <div>
          <div style={{ fontSize: isMobile ? '1rem' : '1.2rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>
            ↓ {formatSpeed(value.speed)} MB/s
          </div>
          <div style={{ fontSize: isMobile ? '0.8rem' : '0.9rem', fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>
            {value.progress.toFixed(1)}% Overall
          </div>
        </div>
      )
    }
  ];

  // Grid layout for mobile responsiveness
  const getGridTemplateColumns = () => {
    if (isSmallMobile) {
      return 'repeat(2, 1fr)';
    } else if (isMobile) {
      return 'repeat(2, 1fr)';
    } else {
      return 'repeat(auto-fit, minmax(240px, 1fr))';
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

  // Download item renderer
  const renderDownloadItem = (download) => {
    const statusData = download.status || {};
    const downloadStatus = statusData.downloadStatus || {};
    const isMagnet = statusData.magnet === true;
    const FileIcon = getFileTypeIcon(statusData.fileType, isMagnet);
    const statusColor = getStatusColor(downloadStatus.status, statusData.currentState);

    return (
      <motion.div
        key={statusData.id}
        variants={cardVariants}
        whileHover="hover"
        style={{
          padding: isMobile ? '0.75rem' : '1rem',
          borderRadius: '8px',
          background: 'white',
          border: '1px solid rgba(0,0,0,0.08)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          marginBottom: isMobile ? '0.5rem' : '0.75rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
          <div style={{ 
            padding: '0.5rem', 
            background: 'rgba(0,123,255,0.1)', 
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <FileIcon style={{ color: '#007bff', fontSize: isMobile ? '1.25rem' : '1.5rem' }} />
          </div>
          
          <div style={{ flex: 1 }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'flex-start',
              marginBottom: '0.25rem'
            }}>
              <div style={{ fontWeight: 600, fontSize: isMobile ? '0.9rem' : '1rem', color: '#495057' }}>
                {statusData.fileName || 'Download'}
              </div>
              <Chip 
                label={statusData.currentState || 'UNKNOWN'}
                color={statusColor}
                size="small"
                sx={{ fontSize: '0.7rem', height: '1.25rem' }}
              />
            </div>
            
            <div style={{ fontSize: isMobile ? '0.7rem' : '0.8rem', color: '#6c757d', marginBottom: '0.5rem' }}>
              {statusData.folderName || 'No folder'}
              {download.isQueued && statusData.queuePosition && (
                <span style={{ marginLeft: '0.5rem', color: '#ff9800' }}>
                  Position: #{statusData.queuePosition}
                </span>
              )}
            </div>
            
            {/* Progress bar */}
            {downloadStatus.totalFileSize && (
              <div style={{ marginBottom: '0.5rem' }}>
                <div style={{ 
                  background: '#e9ecef', 
                  borderRadius: '4px', 
                  height: '4px',
                  overflow: 'hidden'
                }}>
                  <div style={{ 
                    background: statusColor === 'success' ? '#28a745' : 
                               statusColor === 'warning' ? '#ffc107' : 
                               statusColor === 'error' ? '#dc3545' : '#007bff',
                    height: '100%',
                    width: downloadStatus.totalFileSize > 0 ? 
                          `${(downloadStatus.fileDownloaded || 0) / downloadStatus.totalFileSize * 100}%` : '0%'
                  }} />
                </div>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  fontSize: '0.7rem',
                  color: '#6c757d',
                  marginTop: '0.25rem'
                }}>
                  <span>
                    {formatFileSize(downloadStatus.fileDownloaded || 0)} / {formatFileSize(downloadStatus.totalFileSize)}
                  </span>
                  <span>
                    {downloadStatus.eta ? `${downloadStatus.eta}s remaining` : ''}
                  </span>
                </div>
              </div>
            )}
            
            {/* Speed and other info */}
            <div style={{ 
              display: 'flex', 
              gap: '1rem', 
              fontSize: '0.7rem',
              color: '#6c757d'
            }}>
              {downloadStatus.speed && (
                <span>Speed: {formatSpeed(downloadStatus.speed / 1024 / 1024)} MB/s</span>
              )}
              {statusData.fileSize && (
                <span>Size: {formatFileSize(statusData.fileSize)}</span>
              )}
              {isMagnet && (
                <span style={{ color: '#d32f2f' }}>
                  <MagnetIcon style={{ fontSize: '0.7rem', verticalAlign: 'middle', marginRight: '0.25rem' }} />
                  Torrent
                </span>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

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

      {/* Downloads List - Grouped by Status */}
      {downloads.length === 0 ? (
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
            display: 'flex',
            flexDirection: 'column',
            gap: isMobile ? '1.5rem' : '2rem'
          }}
        >
          {/* Active Downloads Section */}
          {groupedDownloads.active.length > 0 && (
            <div>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.5rem',
                marginBottom: '1rem'
              }}>
                <PlayArrowIcon style={{ color: '#28a745', fontSize: '1.25rem' }} />
                <h3 style={{ 
                  margin: 0, 
                  fontSize: isMobile ? '1rem' : '1.125rem', 
                  fontWeight: 600, 
                  color: '#495057' 
                }}>
                  Active Downloads ({groupedDownloads.active.length})
                </h3>
              </div>
              <AnimatePresence>
                {groupedDownloads.active.map(download => renderDownloadItem(download))}
              </AnimatePresence>
            </div>
          )}

          {/* Queued Downloads Section */}
          {groupedDownloads.queued.length > 0 && (
            <div>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.5rem',
                marginBottom: '1rem'
              }}>
                <ScheduleIcon style={{ color: '#ffc107', fontSize: '1.25rem' }} />
                <h3 style={{ 
                  margin: 0, 
                  fontSize: isMobile ? '1rem' : '1.125rem', 
                  fontWeight: 600, 
                  color: '#495057' 
                }}>
                  Queued Downloads ({groupedDownloads.queued.length})
                </h3>
              </div>
              <AnimatePresence>
                {groupedDownloads.queued.map(download => renderDownloadItem(download))}
              </AnimatePresence>
            </div>
          )}

          {/* Paused Downloads Section */}
          {groupedDownloads.paused.length > 0 && (
            <div>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.5rem',
                marginBottom: '1rem'
              }}>
                <PauseCircleIcon style={{ color: '#6c757d', fontSize: '1.25rem' }} />
                <h3 style={{ 
                  margin: 0, 
                  fontSize: isMobile ? '1rem' : '1.125rem', 
                  fontWeight: 600, 
                  color: '#495057' 
                }}>
                  Paused Downloads ({groupedDownloads.paused.length})
                </h3>
              </div>
              <AnimatePresence>
                {groupedDownloads.paused.map(download => renderDownloadItem(download))}
              </AnimatePresence>
            </div>
          )}

          {/* Completed Downloads Section */}
          {groupedDownloads.completed.length > 0 && (
            <div>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.5rem',
                marginBottom: '1rem'
              }}>
                <CheckCircleIcon style={{ color: '#007bff', fontSize: '1.25rem' }} />
                <h3 style={{ 
                  margin: 0, 
                  fontSize: isMobile ? '1rem' : '1.125rem', 
                  fontWeight: 600, 
                  color: '#495057' 
                }}>
                  Completed Downloads ({groupedDownloads.completed.length})
                </h3>
              </div>
              <AnimatePresence>
                {groupedDownloads.completed.map(download => renderDownloadItem(download))}
              </AnimatePresence>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}

export default React.memo(DownloadManager);