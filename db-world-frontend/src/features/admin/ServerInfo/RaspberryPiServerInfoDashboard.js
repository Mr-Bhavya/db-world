// src/components/ServerInfo/RaspberryPiServerInfoDashboard.js
import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Chip,
  LinearProgress,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  Tooltip,
  Alert,
  Stack,
  Avatar,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Fade,
  Zoom,
  Grow,
  Slide,
  alpha,
  useTheme,
  useMediaQuery,
  Badge,
  Skeleton,
  Switch,
  FormControlLabel,
  Collapse,
  CardActions,
  CardHeader
} from '@mui/material';
import { styled, keyframes } from '@mui/material/styles';
import {
  Memory as MemoryIcon,
  Storage as StorageIcon,
  Speed as SpeedIcon,
  DeveloperBoard as DeveloperBoardIcon,
  NetworkCheck as NetworkIcon,
  Thermostat as TemperatureIcon,
  Event as EventIcon,
  Settings as SettingsIcon,
  Computer as ComputerIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  CheckCircle as CheckCircleIcon,
  Refresh as RefreshIcon,
  ExpandMore as ExpandMoreIcon,
  Security as SecurityIcon,
  BatteryChargingFull as BatteryIcon,
  DisplaySettings as DisplayIcon,
  Usb as UsbIcon,
  Print as PrintIcon,
  Headset as AudioIcon,
  Dashboard as DashboardIcon,
  Storage as DiskIcon,
  Lan as LanIcon,
  Dns as DnsIcon,
  Wifi as WifiIcon,
  ViewList as ViewListIcon,
  Timeline as TimelineIcon,
  DonutLarge as DonutIcon,
  MoreVert as MoreVertIcon,
  FilterList as FilterIcon,
  Search as SearchIcon,
  Fullscreen as FullscreenIcon,
  FullscreenExit as FullscreenExitIcon,
  DarkMode as DarkModeIcon,
  LightMode as LightModeIcon,
  Home as HomeIcon,
  CameraAlt as CameraIcon,
  SettingsInputComponent as GpioIcon,
  Cable as CableIcon,
  FlashOn as FlashOnIcon,
  SdStorage as SdCardIcon,
  Bluetooth as BluetoothIcon,
  Power as PowerIcon,
  Update as UpdateIcon,
  DataUsage as DataUsageIcon,
  TrendingUp as TrendingUpIcon,
  DeviceHub as DeviceHubIcon,
  Satellite as SatelliteIcon,
  Router as RouterIcon,
  Storage as StorageIcon2,
  Devices as DevicesIcon,
  BarChart as BarChartIcon,
  PieChart as PieChartIcon,
  ViewModule as ViewModuleIcon,
  ViewStream as ViewStreamIcon,
  ViewColumn as ViewColumnIcon,
  GridView as GridViewIcon,
  TableChart as TableChartIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon,
  ArrowForward as ArrowForwardIcon,
  ArrowBack as ArrowBackIcon,
  Menu as MenuIcon,
  Close as CloseIcon,
  Download as DownloadIcon,
  Share as ShareIcon,
  CloudDownload as CloudDownloadIcon,
  CloudUpload as CloudUploadIcon,
  Speed as SpeedIcon2,
  GpsFixed as GpsFixedIcon,
  PlayArrow as PlayArrowIcon,
  Pause as PauseIcon,
  Stop as StopIcon,
  RestartAlt as RestartIcon
} from '@mui/icons-material';

// Custom Animations
const floatAnimation = keyframes`
  0% { transform: translateY(0px); }
  50% { transform: translateY(-5px); }
  100% { transform: translateY(0px); }
`;

const pulseAnimation = keyframes`
  0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4); }
  70% { transform: scale(1.05); box-shadow: 0 0 0 10px rgba(59, 130, 246, 0); }
  100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
`;

const gradientAnimation = keyframes`
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
`;

const shimmerAnimation = keyframes`
  0% { background-position: -1000px 0; }
  100% { background-position: 1000px 0; }
`;

// Styled Components
const FloatingCard = styled(Card)(({ theme, delay = 0 }) => ({
  height: '100%',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  position: 'relative',
  overflow: 'hidden',
  borderRadius: '12px',
  animation: `${floatAnimation} 3s ease-in-out ${delay}s infinite`,
  '&:before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '4px',
    background: 'linear-gradient(90deg, #FF6B6B, #4ECDC4, #45B7D1)',
    transform: 'scaleX(0)',
    transformOrigin: 'left',
    transition: 'transform 0.3s ease',
  },
  '&:hover': {
    transform: 'translateY(-8px) scale(1.02)',
    boxShadow: theme.shadows[10],
    '&:before': {
      transform: 'scaleX(1)',
    },
  },
}));

const PulseAvatar = styled(Avatar)(({ theme, color = '#4ECDC4' }) => ({
  animation: `${pulseAnimation} 2s infinite`,
  backgroundColor: color,
}));

const GradientTypography = styled(Typography)(({ theme }) => ({
  background: 'linear-gradient(45deg, #FF6B6B, #4ECDC4, #45B7D1)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
  backgroundSize: '200% 200%',
  animation: `${gradientAnimation} 3s ease infinite`,
}));

const AnimatedProgressBar = styled(LinearProgress)(({ theme, value, severity = 'info' }) => {
  const colors = {
    info: '#45B7D1',
    success: '#4ECDC4',
    warning: '#FFD166',
    error: '#FF6B6B',
    critical: '#EF476F'
  };
  
  return {
    height: 8,
    borderRadius: 4,
    backgroundColor: alpha(colors[severity], 0.1),
    '& .MuiLinearProgress-bar': {
      borderRadius: 4,
      background: `linear-gradient(90deg, ${colors[severity]}, ${alpha(colors[severity], 0.8)})`,
      backgroundSize: '200% 100%',
      animation: `${shimmerAnimation} 2s infinite linear`,
    },
  };
});

const StatusBadge = styled(Box)(({ status, theme }) => {
  const statusColors = {
    healthy: '#4ECDC4',
    warning: '#FFD166',
    critical: '#EF476F',
    unknown: '#6C757D',
    active: '#4ECDC4',
    inactive: '#6C757D',
    enabled: '#4ECDC4',
    disabled: '#EF476F',
    detected: '#4ECDC4',
    not_detected: '#6C757D'
  };
  
  return {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '4px 12px',
    borderRadius: '20px',
    backgroundColor: alpha(statusColors[status] || statusColors.unknown, 0.1),
    border: `1px solid ${alpha(statusColors[status] || statusColors.unknown, 0.3)}`,
    color: statusColors[status] || statusColors.unknown,
    fontWeight: 600,
    fontSize: '0.75rem',
    '&:before': {
      content: '""',
      width: 8,
      height: 8,
      borderRadius: '50%',
      backgroundColor: statusColors[status] || statusColors.unknown,
      marginRight: 6,
      animation: status === 'critical' ? `${pulseAnimation} 1s infinite` : 'none',
    },
  };
});

const PiModelCard = styled(Card)(({ theme, model }) => {
  const modelColors = {
    'Pi 5': '#FF6B6B',
    'Pi 4': '#45B7D1',
    'Pi 3': '#4ECDC4',
    'Pi 2': '#FFD166',
    'Pi Zero': '#6C757D',
    'Pi 1': '#95A5A6'
  };
  
  return {
    background: `linear-gradient(135deg, ${alpha(modelColors[model] || '#45B7D1', 0.1)} 0%, ${alpha(modelColors[model] || '#45B7D1', 0.05)} 100%)`,
    border: `1px solid ${alpha(modelColors[model] || '#45B7D1', 0.2)}`,
    borderRadius: '16px',
    position: 'relative',
    overflow: 'hidden',
    '&:before': {
      content: '""',
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: '4px',
      background: `linear-gradient(90deg, ${modelColors[model] || '#45B7D1'}, ${alpha(modelColors[model] || '#45B7D1', 0.5)})`,
    },
  };
});

// Main Dashboard Component
const RaspberryPiServerInfoDashboard = ({ serverInfo, refreshData }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'md'));
  
  const [activeTab, setActiveTab] = useState(0);
  const [expandedPanels, setExpandedPanels] = useState({});
  const [viewMode, setViewMode] = useState(isMobile ? 'grid' : 'detailed');
  const [darkMode, setDarkMode] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [selectedGpioPin, setSelectedGpioPin] = useState(null);
  const [showTemperatureChart, setShowTemperatureChart] = useState(false);

  // Handle panel expansion
  const handlePanelChange = (panel) => (event, isExpanded) => {
    setExpandedPanels({ ...expandedPanels, [panel]: isExpanded });
  };

  // Calculate health score and status
  const calculateHealthScore = () => {
    const health = serverInfo?.healthStatus;
    if (!health) return { score: 100, level: 'HEALTHY', color: '#4ECDC4' };
    
    const score = health.score || 100;
    const level = health.level || 'HEALTHY';
    
    const colors = {
      EXCELLENT: '#4ECDC4',
      GOOD: '#4ECDC4',
      FAIR: '#FFD166',
      POOR: '#FF6B6B',
      CRITICAL: '#EF476F'
    };
    
    return { score, level, color: colors[level.toUpperCase()] || '#4ECDC4' };
  };

  const healthInfo = calculateHealthScore();

  // Format date
  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleString();
  };

  // Format bytes
  const formatBytes = (bytes, decimals = 2) => {
    if (bytes === 0 || bytes === null) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  // Get severity color
  const getSeverity = (value) => {
    if (value >= 90) return 'critical';
    if (value >= 80) return 'error';
    if (value >= 70) return 'warning';
    if (value >= 50) return 'info';
    return 'success';
  };

  // Handle tab change
  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  // Toggle auto refresh
  useEffect(() => {
    let interval;
    if (autoRefresh) {
      interval = setInterval(() => {
        refreshData();
      }, 30000); // Refresh every 30 seconds
    }
    return () => clearInterval(interval);
  }, [autoRefresh, refreshData]);

  // If serverInfo is null
  if (!serverInfo) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  // Extract data
  const data = serverInfo;
  const rpiInfo = data.raspberryPiInfo || {};
  const gpioInfo = data.gpioInfo || {};
  const cameraInfo = data.cameraInfo || {};
  const hatInfo = data.hatInfo || {};
  const overclockInfo = data.overclockInfo || {};
  const displayInfo = data.displayInfo || {};

  // Get Pi model
  const getPiModel = () => {
    const model = rpiInfo.model || '';
    if (model.includes('Pi 5')) return 'Pi 5';
    if (model.includes('Pi 4')) return 'Pi 4';
    if (model.includes('Pi 3')) return 'Pi 3';
    if (model.includes('Pi 2')) return 'Pi 2';
    if (model.includes('Pi Zero')) return 'Pi Zero';
    if (model.includes('Pi 1') || model.includes('Model A') || model.includes('Model B')) return 'Pi 1';
    return 'Unknown Pi';
  };

  const piModel = getPiModel();

  return (
    <Box sx={{ 
      minHeight: '100vh',
      background: darkMode 
        ? 'linear-gradient(135deg, #0a1929 0%, #1a237e 100%)'
        : 'linear-gradient(135deg, #f0f7ff 0%, #e3f2fd 100%)',
      transition: 'all 0.3s ease',
      p: { xs: 1, sm: 2, md: 3 },
    }}>
      {/* Header */}
      <Slide direction="down" in={true} mountOnEnter unmountOnExit>
        <Paper elevation={0} sx={{ 
          borderRadius: '16px',
          mb: 2,
          background: darkMode 
            ? 'linear-gradient(90deg, #1a237e 0%, #311b92 100%)'
            : 'linear-gradient(90deg, #45B7D1 0%, #4ECDC4 100%)',
          color: 'white',
          p: { xs: 2, sm: 3 },
          overflow: 'hidden',
          position: 'relative',
        }}>
          <Box sx={{ 
            display: 'flex', 
            flexDirection: { xs: 'column', sm: 'row' },
            justifyContent: 'space-between', 
            alignItems: { xs: 'flex-start', sm: 'center' },
            gap: 2,
          }}>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 800, mb: 0.5, fontSize: { xs: '1.5rem', sm: '2rem' } }}>
                <DeveloperBoardIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                {piModel} Dashboard
              </Typography>
              <Typography variant="subtitle1" sx={{ opacity: 0.9, fontSize: { xs: '0.875rem', sm: '1rem' } }}>
                {data.serverInfo?.hostname || 'raspberrypi'} • 
                {data.serverInfo?.osName || 'Raspberry Pi OS'} • 
                Serial: {rpiInfo.serial?.substring(0, 8) || 'Unknown'}
              </Typography>
            </Box>
            
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Tooltip title="Toggle Dark Mode">
                <IconButton onClick={() => setDarkMode(!darkMode)} sx={{ color: 'white' }}>
                  {darkMode ? <LightModeIcon /> : <DarkModeIcon />}
                </IconButton>
              </Tooltip>
              <Tooltip title="Auto Refresh">
                <FormControlLabel
                  control={
                    <Switch
                      checked={autoRefresh}
                      onChange={(e) => setAutoRefresh(e.target.checked)}
                      size="small"
                      sx={{ color: 'white' }}
                    />
                  }
                  label={
                    <Typography variant="caption" sx={{ color: 'white' }}>
                      Auto
                    </Typography>
                  }
                  sx={{ m: 0 }}
                />
              </Tooltip>
              <Tooltip title="Refresh Data">
                <IconButton onClick={refreshData} sx={{ color: 'white' }}>
                  <RefreshIcon />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        </Paper>
      </Slide>

      {/* Health Status */}
      <Fade in={true} timeout={500}>
        <Paper sx={{ 
          p: 2, 
          mb: 3, 
          borderRadius: '16px',
          background: darkMode 
            ? `linear-gradient(90deg, ${alpha(healthInfo.color, 0.1)} 0%, ${alpha(healthInfo.color, 0.05)} 100%)`
            : `linear-gradient(90deg, ${alpha(healthInfo.color, 0.2)} 0%, ${alpha(healthInfo.color, 0.1)} 100%)`,
          border: `1px solid ${alpha(healthInfo.color, 0.3)}`,
        }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <PulseAvatar color={healthInfo.color} sx={{ 
                  width: { xs: 60, sm: 80 },
                  height: { xs: 60, sm: 80 },
                  fontSize: { xs: '1.5rem', sm: '2rem' },
                  fontWeight: 'bold'
                }}>
                  {healthInfo.score}
                </PulseAvatar>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    System Health
                  </Typography>
                  <StatusBadge status={healthInfo.level.toLowerCase()} sx={{ mt: 1 }}>
                    {healthInfo.level}
                  </StatusBadge>
                </Box>
              </Box>
            </Grid>
            
            <Grid item xs={12} md={8}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <Typography variant="body2" sx={{ fontWeight: 600, minWidth: 100 }}>
                  Performance:
                </Typography>
                <AnimatedProgressBar 
                  variant="determinate" 
                  value={healthInfo.score} 
                  severity={getSeverity(100 - healthInfo.score)}
                  sx={{ flex: 1 }}
                />
              </Box>
              
              {data.healthStatus?.warnings?.length > 0 && (
                <Alert 
                  severity="warning"
                  icon={<WarningIcon />}
                  sx={{ 
                    mt: 1,
                    borderRadius: '12px',
                  }}
                >
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    System Warnings ({data.healthStatus.warnings.length})
                  </Typography>
                  {data.healthStatus.warnings.slice(0, 2).map((warning, idx) => (
                    <Typography key={idx} variant="body2" sx={{ fontSize: '0.875rem' }}>
                      • {warning}
                    </Typography>
                  ))}
                </Alert>
              )}
            </Grid>
          </Grid>
        </Paper>
      </Fade>

      {/* Quick Stats Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {/* CPU Card */}
        <Grid item xs={6} sm={4} md={2.4}>
          <Zoom in={true} timeout={300}>
            <FloatingCard delay={0}>
              <CardContent sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <PulseAvatar sx={{ bgcolor: '#45B7D1', mr: 1, width: 40, height: 40 }}>
                    <SpeedIcon />
                  </PulseAvatar>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      CPU
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                      {data.cpu?.name?.split(' ').slice(0, 3).join(' ') || 'ARM Processor'}
                    </Typography>
                  </Box>
                </Box>
                <AnimatedProgressBar 
                  variant="determinate" 
                  value={data.cpu?.loadPercentage || 0}
                  severity={getSeverity(data.cpu?.loadPercentage || 0)}
                  sx={{ mb: 1 }}
                />
                <Typography variant="h6" sx={{ fontWeight: 700, textAlign: 'center' }}>
                  {data.cpu?.loadPercentage?.toFixed(1) || '0'}%
                </Typography>
              </CardContent>
            </FloatingCard>
          </Zoom>
        </Grid>

        {/* Memory Card */}
        <Grid item xs={6} sm={4} md={2.4}>
          <Zoom in={true} timeout={400}>
            <FloatingCard delay={0.1}>
              <CardContent sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <PulseAvatar sx={{ bgcolor: '#4ECDC4', mr: 1, width: 40, height: 40 }}>
                    <MemoryIcon />
                  </PulseAvatar>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      Memory
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                      {data.memory?.usedFormatted?.split(' ')[0] || '0'}/{data.memory?.totalFormatted?.split(' ')[0] || '0'} GB
                    </Typography>
                  </Box>
                </Box>
                <AnimatedProgressBar 
                  variant="determinate" 
                  value={parseFloat(data.memory?.usedPercent || 0)}
                  severity={getSeverity(parseFloat(data.memory?.usedPercent || 0))}
                  sx={{ mb: 1 }}
                />
                <Typography variant="h6" sx={{ fontWeight: 700, textAlign: 'center' }}>
                  {parseFloat(data.memory?.usedPercent || 0).toFixed(1)}%
                </Typography>
              </CardContent>
            </FloatingCard>
          </Zoom>
        </Grid>

        {/* Storage Card */}
        <Grid item xs={6} sm={4} md={2.4}>
          <Zoom in={true} timeout={500}>
            <FloatingCard delay={0.2}>
              <CardContent sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <PulseAvatar sx={{ bgcolor: '#FFD166', mr: 1, width: 40, height: 40 }}>
                    <SdCardIcon />
                  </PulseAvatar>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      Storage
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                      {data.disk?.driveCount || 0} Drives
                    </Typography>
                  </Box>
                </Box>
                <AnimatedProgressBar 
                  variant="determinate" 
                  value={(data.disk?.drives || []).reduce((sum, drive) => sum + (parseFloat(drive.usedPercent) || 0), 0) / (data.disk?.drives?.length || 1)}
                  severity={getSeverity((data.disk?.drives || []).reduce((sum, drive) => sum + (parseFloat(drive.usedPercent) || 0), 0) / (data.disk?.drives?.length || 1))}
                  sx={{ mb: 1 }}
                />
                <Typography variant="h6" sx={{ fontWeight: 700, textAlign: 'center' }}>
                  {data.disk?.totalSpaceFormatted?.split(' ')[0] || '0'} GB
                </Typography>
              </CardContent>
            </FloatingCard>
          </Zoom>
        </Grid>

        {/* Temperature Card */}
        <Grid item xs={6} sm={4} md={2.4}>
          <Zoom in={true} timeout={600}>
            <FloatingCard delay={0.3}>
              <CardContent sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <PulseAvatar sx={{ bgcolor: '#FF6B6B', mr: 1, width: 40, height: 40 }}>
                    <TemperatureIcon />
                  </PulseAvatar>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      Temp
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                      CPU/GPU
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ height: 8, mb: 1 }} />
                <Typography variant="h6" sx={{ fontWeight: 700, textAlign: 'center' }}>
                  {data.temperature?.averageTemperatureC?.toFixed(1) || '0'}°C
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', display: 'block' }}>
                  {data.temperature?.highestSensor || 'CPU'}: {data.temperature?.highestTemperatureC?.toFixed(1) || '0'}°C
                </Typography>
              </CardContent>
            </FloatingCard>
          </Zoom>
        </Grid>

        {/* Network Card */}
        <Grid item xs={6} sm={4} md={2.4}>
          <Zoom in={true} timeout={700}>
            <FloatingCard delay={0.4}>
              <CardContent sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <PulseAvatar sx={{ bgcolor: '#9561e2', mr: 1, width: 40, height: 40 }}>
                    <NetworkIcon />
                  </PulseAvatar>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      Network
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                      {data.network?.adapterCount || 0} Adapters
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ height: 8, mb: 1 }} />
                <Typography variant="h6" sx={{ fontWeight: 700, textAlign: 'center' }}>
                  {data.network?.adapters?.filter(a => a.status === 'Up').length || 0}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', display: 'block' }}>
                  Active
                </Typography>
              </CardContent>
            </FloatingCard>
          </Zoom>
        </Grid>
      </Grid>

      {/* Pi Model Information Card */}
      <Grow in={true} timeout={800}>
        <PiModelCard model={piModel} sx={{ mb: 3 }}>
          <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                  <Avatar sx={{ 
                    bgcolor: 'white', 
                    width: 60, 
                    height: 60,
                    boxShadow: 2
                  }}>
                    <DeveloperBoardIcon sx={{ fontSize: 40, color: '#FF6B6B' }} />
                  </Avatar>
                  <Box>
                    <Typography variant="h5" sx={{ fontWeight: 800 }}>
                      {rpiInfo.model || 'Raspberry Pi'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {rpiInfo.soc || 'Broadcom SoC'} • {rpiInfo.processor || 'ARM Processor'}
                    </Typography>
                  </Box>
                </Box>
                
                <Grid container spacing={1}>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">
                      Serial
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {rpiInfo.serial || 'Unknown'}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">
                      Revision
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {rpiInfo.revision || 'Unknown'}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">
                      Memory
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {rpiInfo.memoryMB ? `${rpiInfo.memoryMB} MB` : data.memory?.totalFormatted || 'Unknown'}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">
                      Firmware
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      v{rpiInfo.firmwareVersion?.split(' ')[0] || 'Unknown'}
                    </Typography>
                  </Grid>
                </Grid>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {cameraInfo.cameraDetected && (
                    <Chip
                      icon={<CameraIcon />}
                      label="Camera"
                      color="primary"
                      variant="outlined"
                      size="small"
                    />
                  )}
                  {checkHasWifi(data) && (
                    <Chip
                      icon={<WifiIcon />}
                      label="WiFi"
                      color="primary"
                      variant="outlined"
                      size="small"
                    />
                  )}
                  {checkHasBluetooth(data) && (
                    <Chip
                      icon={<BluetoothIcon />}
                      label="Bluetooth"
                      color="primary"
                      variant="outlined"
                      size="small"
                    />
                  )}
                  {hatInfo.hatPresent && (
                    <Chip
                      icon={<DeviceHubIcon />}
                      label="HAT"
                      color="primary"
                      variant="outlined"
                      size="small"
                    />
                  )}
                  {overclockInfo.overVoltage && (
                    <Chip
                      icon={<FlashOnIcon />}
                      label="Overclocked"
                      color="warning"
                      variant="outlined"
                      size="small"
                    />
                  )}
                  {displayInfo.displayConnected && (
                    <Chip
                      icon={<DisplayIcon />}
                      label="Display"
                      color="primary"
                      variant="outlined"
                      size="small"
                    />
                  )}
                </Box>
                
                {overclockInfo.overVoltage && (
                  <Alert severity="info" sx={{ mt: 2, borderRadius: '12px' }}>
                    <Typography variant="body2">
                      Overclocked: {overclockInfo.armFrequency || '?'}MHz CPU
                    </Typography>
                  </Alert>
                )}
              </Grid>
            </Grid>
          </CardContent>
        </PiModelCard>
      </Grow>

      {/* Main Content Tabs */}
      <Paper sx={{ 
        borderRadius: '16px', 
        overflow: 'hidden', 
        mb: 3,
        background: darkMode ? '#1e293b' : 'white',
      }}>
        <Tabs 
          value={activeTab} 
          onChange={handleTabChange}
          variant={isMobile ? "scrollable" : "standard"}
          scrollButtons="auto"
          sx={{ 
            borderBottom: 1, 
            borderColor: 'divider',
            background: darkMode ? '#1e293b' : '#f8fafc',
            '& .MuiTab-root': {
              minHeight: 48,
              fontSize: { xs: '0.75rem', sm: '0.875rem' },
            },
          }}
        >
          <Tab label="Overview" icon={<DashboardIcon />} />
          <Tab label="GPIO" icon={<GpioIcon />} />
          <Tab label="Hardware" icon={<DevicesIcon />} />
          <Tab label="Performance" icon={<TimelineIcon />} />
          <Tab label="Storage" icon={<StorageIcon2 />} />
          <Tab label="Network" icon={<RouterIcon />} />
          <Tab label="System" icon={<SettingsIcon />} />
        </Tabs>

        {/* Overview Tab */}
        {activeTab === 0 && (
          <Box sx={{ p: { xs: 1, sm: 2, md: 3 } }}>
            <Grid container spacing={2}>
              {/* Camera Status */}
              <Grid item xs={12} md={6}>
                <FloatingCard>
                  <CardHeader
                    avatar={
                      <Avatar sx={{ bgcolor: cameraInfo.cameraDetected ? '#4ECDC4' : '#6C757D' }}>
                        <CameraIcon />
                      </Avatar>
                    }
                    title="Camera Status"
                    subheader={cameraInfo.cameraDetected ? "Connected" : "Not Detected"}
                  />
                  <CardContent>
                    {cameraInfo.cameraDetected ? (
                      <List dense>
                        <ListItem>
                          <ListItemText 
                            primary="Model"
                            secondary={cameraInfo.cameraModel || "Unknown"}
                          />
                        </ListItem>
                        <ListItem>
                          <ListItemText 
                            primary="Resolution"
                            secondary={cameraInfo.cameraResolution || "Unknown"}
                          />
                        </ListItem>
                        <ListItem>
                          <ListItemText 
                            primary="Driver"
                            secondary={cameraInfo.cameraDriver || "Unknown"}
                          />
                        </ListItem>
                      </List>
                    ) : (
                      <Alert severity="info">
                        Camera not detected. Enable in raspi-config.
                      </Alert>
                    )}
                  </CardContent>
                </FloatingCard>
              </Grid>

              {/* Display Status */}
              <Grid item xs={12} md={6}>
                <FloatingCard>
                  <CardHeader
                    avatar={
                      <Avatar sx={{ bgcolor: displayInfo.displayConnected ? '#4ECDC4' : '#6C757D' }}>
                        <DisplayIcon />
                      </Avatar>
                    }
                    title="Display Status"
                    subheader={displayInfo.displayConnected ? "Connected" : "Not Connected"}
                  />
                  <CardContent>
                    {displayInfo.displayConnected ? (
                      <List dense>
                        <ListItem>
                          <ListItemText 
                            primary="Type"
                            secondary={displayInfo.displayType || "HDMI"}
                          />
                        </ListItem>
                        <ListItem>
                          <ListItemText 
                            primary="Resolution"
                            secondary={displayInfo.displayResolution || "Unknown"}
                          />
                        </ListItem>
                        <ListItem>
                          <ListItemText 
                            primary="Mode"
                            secondary={displayInfo.displayHdmiMode || "Auto"}
                          />
                        </ListItem>
                      </List>
                    ) : (
                      <Alert severity="info">
                        No display connected.
                      </Alert>
                    )}
                  </CardContent>
                </FloatingCard>
              </Grid>

              {/* Temperature Details */}
              <Grid item xs={12}>
                <FloatingCard>
                  <CardHeader
                    avatar={
                      <Avatar sx={{ bgcolor: '#FF6B6B' }}>
                        <TemperatureIcon />
                      </Avatar>
                    }
                    title="Temperature Monitoring"
                    action={
                      <IconButton onClick={() => setShowTemperatureChart(!showTemperatureChart)}>
                        {showTemperatureChart ? <BarChartIcon /> : <PieChartIcon />}
                      </IconButton>
                    }
                  />
                  <CardContent>
                    <Grid container spacing={2}>
                      {(data.temperature?.sensors || []).map((sensor, idx) => (
                        <Grid item xs={12} sm={6} md={3} key={idx}>
                          <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                            <Typography variant="caption" color="text.secondary">
                              {sensor.name}
                            </Typography>
                            <Typography variant="h4" sx={{ fontWeight: 700, my: 1 }}>
                              {sensor.temperatureC?.toFixed(1) || '0'}°C
                            </Typography>
                            <StatusBadge status={sensor.status?.toLowerCase() || 'unknown'}>
                              {sensor.status || 'Unknown'}
                            </StatusBadge>
                          </Paper>
                        </Grid>
                      ))}
                    </Grid>
                  </CardContent>
                </FloatingCard>
              </Grid>
            </Grid>
          </Box>
        )}

        {/* GPIO Tab */}
        {activeTab === 1 && (
          <Box sx={{ p: { xs: 1, sm: 2, md: 3 } }}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <FloatingCard>
                  <CardHeader
                    avatar={
                      <Avatar sx={{ bgcolor: gpioInfo.gpioAccessible ? '#4ECDC4' : '#6C757D' }}>
                        <GpioIcon />
                      </Avatar>
                    }
                    title="GPIO Status"
                    subheader={`${gpioInfo.gpioLibrary || 'Unknown'} Library`}
                  />
                  <CardContent>
                    {gpioInfo.gpioAccessible ? (
                      <Box>
                        <Grid container spacing={1}>
                          {(gpioInfo.pins || []).slice(0, 40).map((pin, idx) => (
                            <Grid item xs={4} sm={3} md={2} key={idx}>
                              <Tooltip title={`GPIO ${pin.pin}: ${pin.mode} = ${pin.value}`}>
                                <Paper
                                  variant="outlined"
                                  sx={{
                                    p: 1,
                                    textAlign: 'center',
                                    cursor: 'pointer',
                                    bgcolor: pin.value === '1' ? '#4ECDC4' : 'transparent',
                                    color: pin.value === '1' ? 'white' : 'inherit',
                                    transition: 'all 0.2s',
                                    '&:hover': {
                                      transform: 'scale(1.05)',
                                    },
                                  }}
                                  onClick={() => setSelectedGpioPin(pin)}
                                >
                                  <Typography variant="caption" sx={{ display: 'block' }}>
                                    {pin.name}
                                  </Typography>
                                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                    {pin.value}
                                  </Typography>
                                  <Typography variant="caption" sx={{ display: 'block' }}>
                                    {pin.mode}
                                  </Typography>
                                </Paper>
                              </Tooltip>
                            </Grid>
                          ))}
                        </Grid>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
                          Showing {Math.min(gpioInfo.pins?.length || 0, 40)} of {gpioInfo.pins?.length || 0} pins
                        </Typography>
                      </Box>
                    ) : (
                      <Alert severity="warning">
                        GPIO access requires root privileges. Run with sudo or add user to gpio group.
                      </Alert>
                    )}
                  </CardContent>
                </FloatingCard>
              </Grid>
            </Grid>
          </Box>
        )}

        {/* Hardware Tab */}
        {activeTab === 2 && (
          <Box sx={{ p: { xs: 1, sm: 2, md: 3 } }}>
            <Grid container spacing={2}>
              {/* HAT Information */}
              {hatInfo.hatPresent && (
                <Grid item xs={12} md={6}>
                  <FloatingCard>
                    <CardHeader
                      avatar={
                        <Avatar sx={{ bgcolor: '#9561e2' }}>
                          <DeviceHubIcon />
                        </Avatar>
                      }
                      title="HAT Information"
                      subheader="Hardware Attached on Top"
                    />
                    <CardContent>
                      <List dense>
                        <ListItem>
                          <ListItemText 
                            primary="Vendor"
                            secondary={hatInfo.hatVendor || "Unknown"}
                          />
                        </ListItem>
                        <ListItem>
                          <ListItemText 
                            primary="Product"
                            secondary={hatInfo.hatProduct || "Unknown"}
                          />
                        </ListItem>
                        <ListItem>
                          <ListItemText 
                            primary="Version"
                            secondary={hatInfo.hatVersion || "Unknown"}
                          />
                        </ListItem>
                        <ListItem>
                          <ListItemText 
                            primary="UUID"
                            secondary={hatInfo.hatUuid || "Unknown"}
                          />
                        </ListItem>
                      </List>
                    </CardContent>
                  </FloatingCard>
                </Grid>
              )}

              {/* Overclocking Information */}
              <Grid item xs={12} md={6}>
                <FloatingCard>
                  <CardHeader
                    avatar={
                      <Avatar sx={{ bgcolor: overclockInfo.overVoltage ? '#FFD166' : '#6C757D' }}>
                        <FlashOnIcon />
                      </Avatar>
                    }
                    title="Overclocking"
                    subheader={overclockInfo.overVoltage ? "Enabled" : "Disabled"}
                  />
                  <CardContent>
                    <List dense>
                      <ListItem>
                        <ListItemText 
                          primary="CPU Frequency"
                          secondary={overclockInfo.armFrequency ? `${overclockInfo.armFrequency} MHz` : "Default"}
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemText 
                          primary="GPU Frequency"
                          secondary={overclockInfo.gpuFrequency ? `${overclockInfo.gpuFrequency} MHz` : "Default"}
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemText 
                          primary="SDRAM Frequency"
                          secondary={overclockInfo.sdramFrequency ? `${overclockInfo.sdramFrequency} MHz` : "Default"}
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemText 
                          primary="Voltage"
                          secondary={overclockInfo.overVoltage ? `+${overclockInfo.overVoltageMin || 0}` : "Default"}
                        />
                      </ListItem>
                    </List>
                  </CardContent>
                </FloatingCard>
              </Grid>

              {/* Audio Devices */}
              <Grid item xs={12}>
                <FloatingCard>
                  <CardHeader
                    avatar={
                      <Avatar sx={{ bgcolor: '#45B7D1' }}>
                        <AudioIcon />
                      </Avatar>
                    }
                    title="Audio Devices"
                  />
                  <CardContent>
                    <Grid container spacing={2}>
                      {((data.hardwareDetails?.audioDevices) || []).map((audio, idx) => (
                        <Grid item xs={12} sm={6} md={4} key={idx}>
                          <Paper variant="outlined" sx={{ p: 2 }}>
                            <Typography variant="subtitle2" gutterBottom>
                              {audio.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {audio.manufacturer} • {audio.status}
                            </Typography>
                          </Paper>
                        </Grid>
                      ))}
                    </Grid>
                  </CardContent>
                </FloatingCard>
              </Grid>
            </Grid>
          </Box>
        )}

        {/* Performance Tab */}
        {activeTab === 3 && (
          <Box sx={{ p: { xs: 1, sm: 2, md: 3 } }}>
            <Grid container spacing={2}>
              {/* CPU Cores */}
              <Grid item xs={12}>
                <FloatingCard>
                  <CardHeader
                    avatar={
                      <Avatar sx={{ bgcolor: '#45B7D1' }}>
                        <SpeedIcon />
                      </Avatar>
                    }
                    title="CPU Core Utilization"
                  />
                  <CardContent>
                    <Grid container spacing={1}>
                      {(data.cpu?.cores || []).map((core, idx) => (
                        <Grid item xs={6} sm={4} md={3} lg={2} key={idx}>
                          <Paper variant="outlined" sx={{ p: 1, textAlign: 'center' }}>
                            <Typography variant="caption" color="text.secondary">
                              Core {core.coreId}
                            </Typography>
                            <Typography variant="h6" sx={{ fontWeight: 700, my: 0.5 }}>
                              {core.load}%
                            </Typography>
                            <AnimatedProgressBar 
                              variant="determinate" 
                              value={core.load} 
                              severity={getSeverity(core.load)}
                              sx={{ height: 6 }}
                            />
                          </Paper>
                        </Grid>
                      ))}
                    </Grid>
                  </CardContent>
                </FloatingCard>
              </Grid>

              {/* Performance Metrics */}
              <Grid item xs={12} md={6}>
                <FloatingCard>
                  <CardHeader
                    avatar={
                      <Avatar sx={{ bgcolor: '#4ECDC4' }}>
                        <TimelineIcon />
                      </Avatar>
                    }
                    title="Load Averages"
                  />
                  <CardContent>
                    <Grid container spacing={2}>
                      <Grid item xs={4}>
                        <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                          <Typography variant="caption" color="text.secondary">
                            1 min
                          </Typography>
                          <Typography variant="h4" sx={{ fontWeight: 700 }}>
                            {data.performance?.cpuLoad1Min?.toFixed(2) || '0'}
                          </Typography>
                        </Paper>
                      </Grid>
                      <Grid item xs={4}>
                        <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                          <Typography variant="caption" color="text.secondary">
                            5 min
                          </Typography>
                          <Typography variant="h4" sx={{ fontWeight: 700 }}>
                            {data.performance?.cpuLoad5Min?.toFixed(2) || '0'}
                          </Typography>
                        </Paper>
                      </Grid>
                      <Grid item xs={4}>
                        <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                          <Typography variant="caption" color="text.secondary">
                            15 min
                          </Typography>
                          <Typography variant="h4" sx={{ fontWeight: 700 }}>
                            {data.performance?.cpuLoad15Min?.toFixed(2) || '0'}
                          </Typography>
                        </Paper>
                      </Grid>
                    </Grid>
                  </CardContent>
                </FloatingCard>
              </Grid>

              {/* Process Information */}
              <Grid item xs={12} md={6}>
                <FloatingCard>
                  <CardHeader
                    avatar={
                      <Avatar sx={{ bgcolor: '#FF6B6B' }}>
                        <ViewListIcon />
                      </Avatar>
                    }
                    title="System Processes"
                    subheader={`${data.performance?.processCount || 0} processes, ${data.performance?.threadCount || 0} threads`}
                  />
                  <CardContent>
                    <TableContainer sx={{ maxHeight: 200 }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Process</TableCell>
                            <TableCell align="right">CPU</TableCell>
                            <TableCell align="right">Memory</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {(data.processes || []).slice(0, 5).map((process, idx) => (
                            <TableRow key={idx} hover>
                              <TableCell>
                                <Typography variant="body2" noWrap>
                                  {process.name}
                                </Typography>
                              </TableCell>
                              <TableCell align="right">
                                <Chip 
                                  label={`${process.cpuUsage?.toFixed(1)}%`}
                                  size="small"
                                  sx={{ 
                                    bgcolor: alpha('#45B7D1', 0.1),
                                    color: '#45B7D1',
                                  }}
                                />
                              </TableCell>
                              <TableCell align="right">
                                <Typography variant="body2">
                                  {process.memoryFormatted}
                                </Typography>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </FloatingCard>
              </Grid>
            </Grid>
          </Box>
        )}

        {/* Storage Tab */}
        {activeTab === 4 && (
          <Box sx={{ p: { xs: 1, sm: 2, md: 3 } }}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <FloatingCard>
                  <CardHeader
                    avatar={
                      <Avatar sx={{ bgcolor: '#FFD166' }}>
                        <SdCardIcon />
                      </Avatar>
                    }
                    title="Storage Drives"
                    subheader={`${data.disk?.driveCount || 0} drives, ${data.disk?.totalSpaceFormatted || '0 GB'} total`}
                  />
                  <CardContent>
                    <Grid container spacing={2}>
                      {(data.disk?.drives || []).map((drive, idx) => (
                        <Grid item xs={12} key={idx}>
                          <Paper variant="outlined" sx={{ p: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                              <SdCardIcon sx={{ mr: 1, color: '#FFD166' }} />
                              <Box sx={{ flex: 1 }}>
                                <Typography variant="subtitle2">
                                  {drive.device} - {drive.volumeName || drive.mountPoint}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {drive.type} • {drive.fileSystem}
                                </Typography>
                              </Box>
                              <Chip 
                                label={`${drive.usedPercent}%`}
                                color={parseFloat(drive.usedPercent) > 90 ? 'error' : parseFloat(drive.usedPercent) > 80 ? 'warning' : 'success'}
                                size="small"
                              />
                            </Box>
                            <AnimatedProgressBar 
                              variant="determinate" 
                              value={parseFloat(drive.usedPercent) || 0}
                              severity={getSeverity(parseFloat(drive.usedPercent) || 0)}
                              sx={{ mb: 1 }}
                            />
                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                              <Typography variant="caption" color="text.secondary">
                                Used: {drive.usedFormatted}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                Free: {drive.freeFormatted}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                Total: {drive.totalFormatted}
                              </Typography>
                            </Box>
                          </Paper>
                        </Grid>
                      ))}
                    </Grid>
                  </CardContent>
                </FloatingCard>
              </Grid>
            </Grid>
          </Box>
        )}

        {/* Network Tab */}
        {activeTab === 5 && (
          <Box sx={{ p: { xs: 1, sm: 2, md: 3 } }}>
            <Grid container spacing={2}>
              {/* Network Adapters */}
              <Grid item xs={12}>
                <FloatingCard>
                  <CardHeader
                    avatar={
                      <Avatar sx={{ bgcolor: '#9561e2' }}>
                        <RouterIcon />
                      </Avatar>
                    }
                    title="Network Adapters"
                    subheader={`${data.network?.adapterCount || 0} adapters`}
                  />
                  <CardContent>
                    <Grid container spacing={2}>
                      {(data.network?.adapters || []).map((adapter, idx) => (
                        <Grid item xs={12} key={idx}>
                          <Accordion>
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                              <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                                <WifiIcon sx={{ mr: 2 }} />
                                <Box sx={{ flex: 1 }}>
                                  <Typography variant="subtitle2">
                                    {adapter.name}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    {adapter.description}
                                  </Typography>
                                </Box>
                                <StatusBadge status={adapter.status?.toLowerCase() || 'unknown'}>
                                  {adapter.status}
                                </StatusBadge>
                              </Box>
                            </AccordionSummary>
                            <AccordionDetails>
                              <Grid container spacing={2}>
                                <Grid item xs={12} md={6}>
                                  <List dense>
                                    <ListItem>
                                      <ListItemText 
                                        primary="MAC Address"
                                        secondary={adapter.macAddress}
                                      />
                                    </ListItem>
                                    <ListItem>
                                      <ListItemText 
                                        primary="IP Address"
                                        secondary={adapter.ipAddress}
                                      />
                                    </ListItem>
                                  </List>
                                </Grid>
                                <Grid item xs={12} md={6}>
                                  <Typography variant="subtitle2" gutterBottom>
                                    All IP Addresses
                                  </Typography>
                                  <Stack direction="row" spacing={0.5} flexWrap="wrap">
                                    {adapter.ipAddresses?.map((ip, ipIdx) => (
                                      <Chip 
                                        key={ipIdx}
                                        label={ip}
                                        size="small"
                                        variant="outlined"
                                        sx={{ mb: 0.5 }}
                                      />
                                    ))}
                                  </Stack>
                                </Grid>
                              </Grid>
                            </AccordionDetails>
                          </Accordion>
                        </Grid>
                      ))}
                    </Grid>
                  </CardContent>
                </FloatingCard>
              </Grid>
            </Grid>
          </Box>
        )}

        {/* System Tab */}
        {activeTab === 6 && (
          <Box sx={{ p: { xs: 1, sm: 2, md: 3 } }}>
            <Grid container spacing={2}>
              {/* System Information */}
              <Grid item xs={12} md={6}>
                <FloatingCard>
                  <CardHeader
                    avatar={
                      <Avatar sx={{ bgcolor: '#45B7D1' }}>
                        <ComputerIcon />
                      </Avatar>
                    }
                    title="System Information"
                  />
                  <CardContent>
                    <List dense>
                      <ListItem>
                        <ListItemText 
                          primary="OS"
                          secondary={data.serverInfo?.osName || 'Raspberry Pi OS'}
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemText 
                          primary="Kernel"
                          secondary={data.serverInfo?.kernelVersion || 'Unknown'}
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemText 
                          primary="Hostname"
                          secondary={data.serverInfo?.hostname || 'raspberrypi'}
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemText 
                          primary="Uptime"
                          secondary={data.serverInfo?.uptime || data.performance?.uptime || 'Unknown'}
                        />
                      </ListItem>
                    </List>
                  </CardContent>
                </FloatingCard>
              </Grid>

              {/* BIOS Information */}
              <Grid item xs={12} md={6}>
                <FloatingCard>
                  <CardHeader
                    avatar={
                      <Avatar sx={{ bgcolor: '#4ECDC4' }}>
                        <DeveloperBoardIcon />
                      </Avatar>
                    }
                    title="BIOS/Firmware"
                  />
                  <CardContent>
                    <List dense>
                      <ListItem>
                        <ListItemText 
                          primary="Vendor"
                          secondary={data.biosInfo?.vendor || 'Broadcom'}
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemText 
                          primary="Version"
                          secondary={data.biosInfo?.version || 'Unknown'}
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemText 
                          primary="Release Date"
                          secondary={formatDate(data.biosInfo?.releaseDate)}
                        />
                      </ListItem>
                    </List>
                  </CardContent>
                </FloatingCard>
              </Grid>

              {/* Installed Packages */}
              <Grid item xs={12}>
                <FloatingCard>
                  <CardHeader
                    avatar={
                      <Avatar sx={{ bgcolor: '#FF6B6B' }}>
                        <CloudDownloadIcon />
                      </Avatar>
                    }
                    title="Installed Packages"
                    subheader={`${data.installedPackages?.length || 0} packages`}
                  />
                  <CardContent>
                    <TableContainer sx={{ maxHeight: 300 }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Package</TableCell>
                            <TableCell>Version</TableCell>
                            <TableCell>Size</TableCell>
                            <TableCell>Architecture</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {(data.installedPackages || []).slice(0, 10).map((pkg, idx) => (
                            <TableRow key={idx} hover>
                              <TableCell>
                                <Typography variant="body2">
                                  {pkg.name}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2">
                                  {pkg.version}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2">
                                  {formatBytes(pkg.size || 0)}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2">
                                  {pkg.architecture}
                                </Typography>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </FloatingCard>
              </Grid>
            </Grid>
          </Box>
        )}
      </Paper>

      {/* GPIO Pin Details Dialog */}
      <Dialog
        open={!!selectedGpioPin}
        onClose={() => setSelectedGpioPin(null)}
        maxWidth="sm"
        fullWidth
      >
        {selectedGpioPin && (
          <>
            <DialogTitle>
              GPIO Pin Details
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                {selectedGpioPin.name}
              </Typography>
            </DialogTitle>
            <DialogContent>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Pin Number
                  </Typography>
                  <Typography variant="h6">
                    {selectedGpioPin.pin}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Mode
                  </Typography>
                  <Chip 
                    label={selectedGpioPin.mode}
                    color={selectedGpioPin.mode === 'IN' ? 'primary' : 'secondary'}
                  />
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Value
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 700 }}>
                    {selectedGpioPin.value}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Function
                  </Typography>
                  <Typography variant="body1">
                    {selectedGpioPin.function || 'GPIO'}
                  </Typography>
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setSelectedGpioPin(null)}>Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Footer */}
      <Paper sx={{ 
        p: 2, 
        borderRadius: '16px', 
        textAlign: 'center',
        background: darkMode ? '#1e293b' : 'white',
      }}>
        <Typography variant="caption" color="text.secondary">
          Last Updated: {new Date().toLocaleTimeString()} • 
          Raspberry Pi Dashboard v1.0 • 
          Data refreshed {autoRefresh ? 'automatically' : 'manually'}
        </Typography>
      </Paper>

      {/* Global Styles */}
      <style jsx global>{`
        @keyframes float {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-5px); }
          100% { transform: translateY(0px); }
        }
        
        @keyframes pulse {
          0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4); }
          70% { transform: scale(1.05); box-shadow: 0 0 0 10px rgba(59, 130, 246, 0); }
          100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
        }
        
        @keyframes gradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        
        @keyframes shimmer {
          0% { background-position: -1000px 0; }
          100% { background-position: 1000px 0; }
        }
        
        ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        
        ::-webkit-scrollbar-track {
          background: ${darkMode ? '#1e293b' : '#f1f1f1'};
          border-radius: 4px;
        }
        
        ::-webkit-scrollbar-thumb {
          background: ${darkMode ? '#4b5563' : '#c1c1c1'};
          border-radius: 4px;
        }
        
        ::-webkit-scrollbar-thumb:hover {
          background: ${darkMode ? '#6b7280' : '#a1a1a1'};
        }
        
        .MuiCard-root {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .MuiCard-root:hover {
          transform: translateY(-4px);
        }
      `}</style>
    </Box>
  );
};

// Helper functions
const checkHasWifi = (data) => {
  return data.network?.adapters?.some(adapter => 
    adapter.name.toLowerCase().includes('wlan') || 
    adapter.name.toLowerCase().includes('wireless')
  ) || false;
};

const checkHasBluetooth = (data) => {
  // Check for Bluetooth in network adapters or hardware
  return data.network?.adapters?.some(adapter => 
    adapter.name.toLowerCase().includes('bluetooth')
  ) || false;
};

export default RaspberryPiServerInfoDashboard;