import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
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
  Breadcrumbs,
  Link,
  Fade,
  Zoom,
  Grow,
  Slide,
  alpha,
  useTheme
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
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon,
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
  BarChart as BarChartIcon,
  DonutLarge as DonutIcon,
  MoreVert as MoreVertIcon,
  Download as DownloadIcon,
  Share as ShareIcon,
  FilterList as FilterIcon,
  Search as SearchIcon,
  Fullscreen as FullscreenIcon,
  FullscreenExit as FullscreenExitIcon,
  DarkMode as DarkModeIcon,
  LightMode as LightModeIcon,
  Home as HomeIcon
} from '@mui/icons-material';

// Custom animations
const floatAnimation = keyframes`
  0% { transform: translateY(0px); }
  50% { transform: translateY(-10px); }
  100% { transform: translateY(0px); }
`;

const pulseAnimation = keyframes`
  0% { transform: scale(1); }
  50% { transform: scale(1.05); }
  100% { transform: scale(1); }
`;

const glowAnimation = keyframes`
  0%, 100% { box-shadow: 0 0 5px rgba(59, 130, 246, 0.5); }
  50% { box-shadow: 0 0 20px rgba(59, 130, 246, 0.8); }
`;

// Styled Components
const FloatingCard = styled(Card)(({ theme }) => ({
  height: '100%',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  position: 'relative',
  overflow: 'hidden',
  '&:before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '4px',
    background: 'linear-gradient(90deg, #3B82F6, #8B5CF6, #EC4899)',
    transform: 'scaleX(0)',
    transformOrigin: 'left',
    transition: 'transform 0.3s ease',
  },
  '&:hover': {
    transform: 'translateY(-8px)',
    boxShadow: theme.shadows[8],
    '&:before': {
      transform: 'scaleX(1)',
    },
  },
  animation: `${floatAnimation} 6s ease-in-out infinite`,
}));

const PulseAvatar = styled(Avatar)(({ theme }) => ({
  animation: `${pulseAnimation} 2s ease-in-out infinite`,
}));

const GlowingBadge = styled(Box)(({ theme, color = '#3B82F6' }) => ({
  position: 'relative',
  '&:after': {
    content: '""',
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderRadius: '50%',
    background: color,
    opacity: 0.3,
    animation: `${pulseAnimation} 2s ease-in-out infinite`,
    zIndex: -1,
  },
}));

const GradientTypography = styled(Typography)(({ theme }) => ({
  background: 'linear-gradient(45deg, #3B82F6, #8B5CF6)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
}));

const AnimatedProgressBar = styled(LinearProgress)(({ theme, value, severity = 'info' }) => {
  const colors = {
    info: '#3B82F6',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    critical: '#7F1D1D'
  };
  
  return {
    height: 12,
    borderRadius: 6,
    backgroundColor: alpha(colors[severity], 0.1),
    '& .MuiLinearProgress-bar': {
      borderRadius: 6,
      backgroundColor: colors[severity],
      backgroundImage: `linear-gradient(45deg, 
        ${alpha(colors[severity], 0.8)} 25%, 
        ${colors[severity]} 25%, 
        ${colors[severity]} 50%, 
        ${alpha(colors[severity], 0.8)} 50%, 
        ${alpha(colors[severity], 0.8)} 75%, 
        ${colors[severity]} 75%, 
        ${colors[severity]})`,
      backgroundSize: '20px 20px',
      animation: 'progressAnimation 1s linear infinite',
    },
  };
});

const StatusIndicator = styled(Box)(({ status, theme }) => {
  const statusColors = {
    healthy: '#10B981',
    warning: '#F59E0B',
    critical: '#EF4444',
    unknown: '#6B7280'
  };
  
  return {
    width: 12,
    height: 12,
    borderRadius: '50%',
    backgroundColor: statusColors[status] || statusColors.unknown,
    display: 'inline-block',
    marginRight: 8,
    boxShadow: `0 0 8px ${statusColors[status] || statusColors.unknown}`,
    animation: `${status === 'critical' ? pulseAnimation : 'none'} 1s ease-in-out infinite`,
  };
});

// Main Dashboard Component
const WindowsServerInfoDashboard = ({ data, onRefresh }) => {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState(0);
  const [expandedPanels, setExpandedPanels] = useState({});
  const [fullscreen, setFullscreen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'

  // Handle panel expansion
  const handlePanelChange = (panel) => (event, isExpanded) => {
    setExpandedPanels({ ...expandedPanels, [panel]: isExpanded });
  };

  // Calculate health score and status
  const calculateHealthScore = () => {
    const health = data?.healthStatus;
    if (!health) return { score: 100, level: 'HEALTHY', color: '#10B981' };
    
    const score = health.score || 100;
    const level = health.level || 'HEALTHY';
    
    const colors = {
      HEALTHY: '#10B981',
      GOOD: '#10B981',
      FAIR: '#F59E0B',
      POOR: '#EF4444',
      CRITICAL: '#7F1D1D'
    };
    
    return { score, level, color: colors[level.toUpperCase()] || '#10B981' };
  };

  const healthInfo = calculateHealthScore();

  // Format date from Unix timestamp
  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    if (typeof timestamp === 'string' && timestamp.includes('/Date(')) {
      const match = timestamp.match(/\/Date\((\d+)\)\//);
      if (match) {
        return new Date(parseInt(match[1])).toLocaleString();
      }
    }
    return new Date(timestamp).toLocaleString();
  };

  // Format bytes to human readable
  const formatBytes = (bytes, decimals = 2) => {
    if (bytes === 0 || bytes === null) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  // Get severity color for progress bars
  const getSeverity = (value) => {
    if (value >= 90) return 'critical';
    if (value >= 80) return 'error';
    if (value >= 70) return 'warning';
    if (value >= 50) return 'info';
    return 'success';
  };

  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
    setFullscreen(!fullscreen);
  };

  // Handle tab change
  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  // Main dashboard render
  if (!data) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress size={60} />
      </Box>
    );
  }

  return (
    <Box sx={{ 
      minHeight: '100vh',
      background: darkMode 
        ? 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)'
        : 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
      transition: 'all 0.3s ease',
    }}>
      {/* Header */}
      <Paper elevation={0} sx={{ 
        borderRadius: 0,
        background: darkMode 
          ? 'linear-gradient(90deg, #1e293b 0%, #334155 100%)'
          : 'linear-gradient(90deg, #3B82F6 0%, #8B5CF6 100%)',
        color: 'white',
        py: 2,
        px: 3,
      }}>
        <Container maxWidth="xl">
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
                <ComputerIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                {data.serverInfo?.osName || 'Windows System Dashboard'}
              </Typography>
              <Typography variant="subtitle1" sx={{ opacity: 0.9 }}>
                {data.serverInfo?.hostname || 'Unknown Host'} • {data.serverInfo?.osVersion || 'Unknown Version'}
              </Typography>
            </Box>
            
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Tooltip title="Toggle Dark Mode">
                <IconButton onClick={() => setDarkMode(!darkMode)} sx={{ color: 'white' }}>
                  {darkMode ? <LightModeIcon /> : <DarkModeIcon />}
                </IconButton>
              </Tooltip>
              <Tooltip title={fullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}>
                <IconButton onClick={toggleFullscreen} sx={{ color: 'white' }}>
                  {fullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
                </IconButton>
              </Tooltip>
              {/* <Tooltip title="Refresh Data">
                <IconButton onClick={onRefresh} disabled={isLoading} sx={{ color: 'white' }}>
                  <RefreshIcon className={isLoading ? 'spin' : ''} />
                </IconButton>
              </Tooltip> */}
            </Box>
          </Box>
        </Container>
      </Paper>

      {/* Health Status Bar */}
      <Container maxWidth="xl" sx={{ mt: 3 }}>
        <Slide direction="down" in={true} mountOnEnter unmountOnExit>
          <Paper sx={{ 
            p: 1, 
            mb: 3, 
            borderRadius: 2,
            background: darkMode 
              ? `linear-gradient(90deg, ${alpha(healthInfo.color, 0.1)} 0%, ${alpha(healthInfo.color, 0.05)} 100%)`
              : `linear-gradient(90deg, ${alpha(healthInfo.color, 0.2)} 0%, ${alpha(healthInfo.color, 0.1)} 100%)`,
            border: `1px solid ${alpha(healthInfo.color, 0.3)}`,
          }}>
            <Grid container spacing={3} alignItems="center">
              <Grid item xs={12} md={4}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <GlowingBadge color={healthInfo.color}>
                    <PulseAvatar sx={{ 
                      bgcolor: healthInfo.color,
                      width: 80,
                      height: 80,
                      fontSize: '2rem',
                      fontWeight: 'bold'
                    }}>
                      {healthInfo.score}
                    </PulseAvatar>
                  </GlowingBadge>
                  <Box>
                    <Typography variant="h5" sx={{ fontWeight: 600 }}>
                      System Health
                    </Typography>
                    <Chip 
                      label={healthInfo.level}
                      sx={{
                        bgcolor: healthInfo.color,
                        color: 'white',
                        fontWeight: 600,
                        mt: 1,
                      }}
                    />
                  </Box>
                </Box>
              </Grid>
              
              <Grid item xs={12} md={8}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, minWidth: 120 }}>
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
                    sx={{ 
                      mt: 2,
                      animation: `${pulseAnimation} 2s ease-in-out infinite`,
                    }}
                  >
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      System Warnings ({data.healthStatus.warnings.length})
                    </Typography>
                    {data.healthStatus.warnings.slice(0, 2).map((warning, idx) => (
                      <Typography key={idx} variant="body2">
                        • {warning}
                      </Typography>
                    ))}
                    {data.healthStatus.warnings.length > 2 && (
                      <Typography variant="caption" sx={{ display: 'block', mt: 1 }}>
                        +{data.healthStatus.warnings.length - 2} more warnings
                      </Typography>
                    )}
                  </Alert>
                )}
              </Grid>
            </Grid>
          </Paper>
        </Slide>

        {/* Quick Stats Cards */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          {/* CPU Card */}
          <Grid item xs={12} sm={6} md={3}>
            <FloatingCard>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <PulseAvatar sx={{ bgcolor: '#3B82F6', mr: 2 }}>
                    <SpeedIcon />
                  </PulseAvatar>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="h6">CPU</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      {data.cpu?.name || 'Intel(R) Core(TM) i5-8265U'}
                    </Typography>
                  </Box>
                </Box>
                <AnimatedProgressBar 
                  variant="determinate" 
                  value={data.cpu?.loadPercentage || 0}
                  severity={getSeverity(data.cpu?.loadPercentage || 0)}
                />
                <Grid container spacing={1} sx={{ mt: 2 }}>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">
                      Cores
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {data.cpu?.noOfCores || 4}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">
                      Threads
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {data.cpu?.threads || 8}
                    </Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </FloatingCard>
          </Grid>

          {/* Memory Card */}
          <Grid item xs={12} sm={6} md={3}>
            <FloatingCard>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <PulseAvatar sx={{ bgcolor: '#10B981', mr: 2 }}>
                    <MemoryIcon />
                  </PulseAvatar>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="h6">Memory</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      {data.memory?.usedFormatted || '0 GB'} / {data.memory?.totalFormatted || '0 GB'}
                    </Typography>
                  </Box>
                </Box>
                <AnimatedProgressBar 
                  variant="determinate" 
                  value={parseFloat(data.memory?.usedPercent || 0)}
                  severity={getSeverity(parseFloat(data.memory?.usedPercent || 0))}
                />
                <Grid container spacing={1} sx={{ mt: 2 }}>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">
                      Used
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {data.memory?.usedFormatted || '0 GB'}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">
                      Free
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {data.memory?.freeFormatted || '0 GB'}
                    </Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </FloatingCard>
          </Grid>

          {/* Storage Card */}
          <Grid item xs={12} sm={6} md={3}>
            <FloatingCard>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <PulseAvatar sx={{ bgcolor: '#F59E0B', mr: 2 }}>
                    <StorageIcon />
                  </PulseAvatar>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="h6">Storage</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      {data.disk?.driveCount || 0} Drives
                    </Typography>
                  </Box>
                </Box>
                <AnimatedProgressBar 
                  variant="determinate" 
                  value={(data.disk?.drives || []).reduce((sum, drive) => sum + (parseFloat(drive.usedPercent) || 0), 0) / (data.disk?.drives?.length || 1)}
                  severity={getSeverity((data.disk?.drives || []).reduce((sum, drive) => sum + (parseFloat(drive.usedPercent) || 0), 0) / (data.disk?.drives?.length || 1))}
                />
                <Grid container spacing={1} sx={{ mt: 2 }}>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">
                      Total
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {data.disk?.totalSpaceFormatted || '0 GB'}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">
                      Free
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {data.disk?.freeSpaceFormatted || '0 GB'}
                    </Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </FloatingCard>
          </Grid>

          {/* Network Card */}
          <Grid item xs={12} sm={6} md={3}>
            <FloatingCard>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <PulseAvatar sx={{ bgcolor: '#8B5CF6', mr: 2 }}>
                    <NetworkIcon />
                  </PulseAvatar>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="h6">Network</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      {data.network?.adapterCount || 0} Adapters
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ mt: 3, textAlign: 'center' }}>
                  <Typography variant="h4" sx={{ fontWeight: 700 }}>
                    {data.network?.adapters?.filter(a => a.status === 'Up').length || 0}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Active Connections
                  </Typography>
                </Box>
                <Box sx={{ mt: 2 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    IP: {data.network?.ipAddresses?.[0] || 'N/A'}
                  </Typography>
                </Box>
              </CardContent>
            </FloatingCard>
          </Grid>
        </Grid>

        {/* Main Content Tabs */}
        <Paper sx={{ borderRadius: 2, overflow: 'hidden', mb: 3 }}>
          <Tabs 
            value={activeTab} 
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ 
              borderBottom: 1, 
              borderColor: 'divider',
              background: darkMode ? '#1e293b' : '#f8fafc',
            }}
          >
            <Tab label="System Overview" icon={<DashboardIcon />} />
            <Tab label="Hardware Details" icon={<DeveloperBoardIcon />} />
            <Tab label="Performance" icon={<TimelineIcon />} />
            <Tab label="Security" icon={<SecurityIcon />} />
            <Tab label="Event Logs" icon={<EventIcon />} />
            <Tab label="Processes" icon={<ViewListIcon />} />
          </Tabs>

          {/* System Overview Tab */}
          {activeTab === 0 && (
            <Box sx={{ p: 1 }}>
              <Grid container spacing={3}>
                {/* System Information */}
                <Grid item xs={12} md={6}>
                  <Card sx={{ height: '100%' }}>
                    <CardContent>
                      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                        <ComputerIcon sx={{ mr: 1 }} />
                        System Information
                      </Typography>
                      <Divider sx={{ mb: 2 }} />
                      <List dense disablePadding>
                        <ListItem>
                          <ListItemText 
                            primary="OS Name"
                            secondary={data.serverInfo?.osName || 'N/A'}
                            secondaryTypographyProps={{ sx: { fontWeight: 500 } }}
                          />
                        </ListItem>
                        <ListItem>
                          <ListItemText 
                            primary="Version"
                            secondary={data.serverInfo?.osVersion || 'N/A'}
                          />
                        </ListItem>
                        <ListItem>
                          <ListItemText 
                            primary="Architecture"
                            secondary={data.serverInfo?.osArchitecture || 'N/A'}
                          />
                        </ListItem>
                        <ListItem>
                          <ListItemText 
                            primary="Hostname"
                            secondary={data.serverInfo?.hostname || 'N/A'}
                          />
                        </ListItem>
                        <ListItem>
                          <ListItemText 
                            primary="Manufacturer"
                            secondary={data.serverInfo?.manufacturer || 'N/A'}
                          />
                        </ListItem>
                        <ListItem>
                          <ListItemText 
                            primary="Serial Number"
                            secondary={data.serverInfo?.serialNumber || 'N/A'}
                          />
                        </ListItem>
                        <ListItem>
                          <ListItemText 
                            primary="Boot Time"
                            secondary={formatDate(data.serverInfo?.bootTime)}
                          />
                        </ListItem>
                        <ListItem>
                          <ListItemText 
                            primary="Uptime"
                            secondary={data.performance?.uptime || 'N/A'}
                          />
                        </ListItem>
                      </List>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Windows Information */}
                <Grid item xs={12} md={6}>
                  <Card sx={{ height: '100%' }}>
                    <CardContent>
                      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                        <InfoIcon sx={{ mr: 1 }} />
                        Windows Details
                      </Typography>
                      <Divider sx={{ mb: 2 }} />
                      <List dense disablePadding>
                        <ListItem>
                          <ListItemText 
                            primary="Edition"
                            secondary={data.windowsInfo?.edition || 'N/A'}
                            secondaryTypographyProps={{ sx: { fontWeight: 500 } }}
                          />
                        </ListItem>
                        <ListItem>
                          <ListItemText 
                            primary="Build Number"
                            secondary={data.windowsInfo?.buildNumber || 'N/A'}
                          />
                        </ListItem>
                        <ListItem>
                          <ListItemText 
                            primary="Registered Owner"
                            secondary={data.windowsInfo?.registeredOwner || 'N/A'}
                          />
                        </ListItem>
                        <ListItem>
                          <ListItemText 
                            primary="Product ID"
                            secondary={data.windowsInfo?.productId || 'N/A'}
                          />
                        </ListItem>
                        <ListItem>
                          <ListItemText 
                            primary="Time Zone"
                            secondary={data.windowsInfo?.timeZone || 'N/A'}
                          />
                        </ListItem>
                        <ListItem>
                          <ListItemText 
                            primary="Locale"
                            secondary={data.windowsInfo?.locale || 'N/A'}
                          />
                        </ListItem>
                        <ListItem>
                          <ListItemText 
                            primary="System Directory"
                            secondary={data.windowsInfo?.systemDirectory || 'N/A'}
                          />
                        </ListItem>
                      </List>
                    </CardContent>
                  </Card>
                </Grid>

                {/* BIOS Information */}
                <Grid item xs={12} md={6}>
                  <Card sx={{ height: '100%' }}>
                    <CardContent>
                      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                        <DeveloperBoardIcon sx={{ mr: 1 }} />
                        BIOS Information
                      </Typography>
                      <Divider sx={{ mb: 2 }} />
                      <List dense disablePadding>
                        <ListItem>
                          <ListItemText 
                            primary="Vendor"
                            secondary={data.biosInfo?.vendor || 'N/A'}
                            secondaryTypographyProps={{ sx: { fontWeight: 500 } }}
                          />
                        </ListItem>
                        <ListItem>
                          <ListItemText 
                            primary="Version"
                            secondary={data.biosInfo?.version || 'N/A'}
                          />
                        </ListItem>
                        <ListItem>
                          <ListItemText 
                            primary="Release Date"
                            secondary={formatDate(data.biosInfo?.releaseDate)}
                          />
                        </ListItem>
                        <ListItem>
                          <ListItemText 
                            primary="Firmware Revision"
                            secondary={data.biosInfo?.firmwareRevision || 'N/A'}
                          />
                        </ListItem>
                      </List>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Motherboard Information */}
                <Grid item xs={12} md={6}>
                  <Card sx={{ height: '100%' }}>
                    <CardContent>
                      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                        <DeveloperBoardIcon sx={{ mr: 1 }} />
                        Motherboard
                      </Typography>
                      <Divider sx={{ mb: 2 }} />
                      <List dense disablePadding>
                        <ListItem>
                          <ListItemText 
                            primary="Manufacturer"
                            secondary={data.hardwareDetails?.motherboard?.manufacturer || 'N/A'}
                            secondaryTypographyProps={{ sx: { fontWeight: 500 } }}
                          />
                        </ListItem>
                        <ListItem>
                          <ListItemText 
                            primary="Product"
                            secondary={data.hardwareDetails?.motherboard?.product || 'N/A'}
                          />
                        </ListItem>
                        <ListItem>
                          <ListItemText 
                            primary="Serial Number"
                            secondary={data.hardwareDetails?.motherboard?.serial || 'N/A'}
                          />
                        </ListItem>
                        <ListItem>
                          <ListItemText 
                            primary="Version"
                            secondary={data.hardwareDetails?.motherboard?.version || 'N/A'}
                          />
                        </ListItem>
                      </List>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Box>
          )}

          {/* Hardware Details Tab */}
          {activeTab === 1 && (
            <Box sx={{ p: 1 }}>
              <Grid container spacing={3}>
                {/* GPU Information */}
                {data.gpu?.gpus?.length > 0 && (
                  <Grid item xs={12}>
                    <Card>
                      <CardContent>
                        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                          <DisplayIcon sx={{ mr: 1 }} />
                          Graphics Cards ({data.gpu.count})
                        </Typography>
                        <Divider sx={{ mb: 2 }} />
                        <Grid container spacing={2}>
                          {data.gpu.gpus.map((gpu, index) => (
                            <Grid item xs={12} md={6} key={index}>
                              <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
                                <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
                                  {gpu.name}
                                </Typography>
                                <List dense disablePadding>
                                  <ListItem sx={{ px: 0 }}>
                                    <ListItemText 
                                      primary="Vendor"
                                      secondary={gpu.vendor}
                                    />
                                  </ListItem>
                                  <ListItem sx={{ px: 0 }}>
                                    <ListItemText 
                                      primary="Memory"
                                      secondary={gpu.memoryFormatted}
                                    />
                                  </ListItem>
                                  <ListItem sx={{ px: 0 }}>
                                    <ListItemText 
                                      primary="Driver Version"
                                      secondary={gpu.driverVersion}
                                    />
                                  </ListItem>
                                  <ListItem sx={{ px: 0 }}>
                                    <ListItemText 
                                      primary="Resolution"
                                      secondary={gpu.resolution !== "0x0" ? gpu.resolution : "Not Connected"}
                                    />
                                  </ListItem>
                                </List>
                              </Paper>
                            </Grid>
                          ))}
                        </Grid>
                      </CardContent>
                    </Card>
                  </Grid>
                )}

                {/* CPU Cores Details */}
                <Grid item xs={12} md={6}>
                  <Card sx={{ height: '100%' }}>
                    <CardContent>
                      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                        <SpeedIcon sx={{ mr: 1 }} />
                        CPU Cores Utilization
                      </Typography>
                      <Divider sx={{ mb: 2 }} />
                      <Grid container spacing={1}>
                        {(data.cpu?.cores || []).map((core, index) => (
                          <Grid item xs={6} sm={4} md={3} key={index}>
                            <Paper variant="outlined" sx={{ p: 1, textAlign: 'center' }}>
                              <Typography variant="caption" color="text.secondary">
                                Core {core.coreId}
                              </Typography>
                              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                {core.load}%
                              </Typography>
                              <AnimatedProgressBar 
                                variant="determinate" 
                                value={core.load} 
                                severity={getSeverity(core.load)}
                                sx={{ mt: 0.5 }}
                              />
                            </Paper>
                          </Grid>
                        ))}
                      </Grid>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Storage Drives */}
                <Grid item xs={12} md={6}>
                  <Card sx={{ height: '100%' }}>
                    <CardContent>
                      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                        <DiskIcon sx={{ mr: 1 }} />
                        Storage Drives
                      </Typography>
                      <Divider sx={{ mb: 2 }} />
                      <List dense disablePadding>
                        {data.disk?.drives?.map((drive, index) => (
                          <ListItem key={index} sx={{ px: 0, mb: 1 }}>
                            <ListItemIcon>
                              <StorageIcon color="primary" />
                            </ListItemIcon>
                            <ListItemText 
                              primary={`${drive.device} (${drive.volumeName})`}
                              secondary={
                                <Box>
                                  <Typography variant="caption" color="text.secondary">
                                    {drive.type} • {drive.fileSystem}
                                  </Typography>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                                    <Typography variant="caption" sx={{ minWidth: 40 }}>
                                      {drive.usedPercent}%
                                    </Typography>
                                    <AnimatedProgressBar 
                                      variant="determinate" 
                                      value={parseFloat(drive.usedPercent) || 0}
                                      severity={getSeverity(parseFloat(drive.usedPercent) || 0)}
                                      sx={{ flex: 1 }}
                                    />
                                  </Box>
                                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                                    {drive.usedFormatted} used of {drive.totalFormatted}
                                  </Typography>
                                </Box>
                              }
                            />
                          </ListItem>
                        ))}
                      </List>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Audio Devices */}
                {data.hardwareDetails?.audioDevices?.length > 0 && (
                  <Grid item xs={12} md={6}>
                    <Card sx={{ height: '100%' }}>
                      <CardContent>
                        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                          <AudioIcon sx={{ mr: 1 }} />
                          Audio Devices
                        </Typography>
                        <Divider sx={{ mb: 2 }} />
                        <List dense disablePadding>
                          {data.hardwareDetails.audioDevices.map((audio, index) => (
                            <ListItem key={index} sx={{ px: 0 }}>
                              <ListItemText 
                                primary={audio.name}
                                secondary={
                                  <Box>
                                    <Typography variant="caption" color="text.secondary">
                                      {audio.manufacturer} • {audio.status}
                                    </Typography>
                                  </Box>
                                }
                              />
                            </ListItem>
                          ))}
                        </List>
                      </CardContent>
                    </Card>
                  </Grid>
                )}

                {/* Printers */}
                {data.hardwareDetails?.printers?.length > 0 && (
                  <Grid item xs={12} md={6}>
                    <Card sx={{ height: '100%' }}>
                      <CardContent>
                        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                          <PrintIcon sx={{ mr: 1 }} />
                          Printers ({data.hardwareDetails.printers.length})
                        </Typography>
                        <Divider sx={{ mb: 2 }} />
                        <List dense disablePadding>
                          {data.hardwareDetails.printers.map((printer, index) => (
                            <ListItem key={index} sx={{ px: 0 }}>
                              <ListItemText 
                                primary={printer.name}
                                secondary={
                                  <Box>
                                    <Typography variant="caption" color="text.secondary">
                                      {printer.driver} • {printer.status}
                                      {printer.isDefault && (
                                        <Chip 
                                          label="Default"
                                          size="small"
                                          sx={{ ml: 1, height: 18 }}
                                        />
                                      )}
                                    </Typography>
                                  </Box>
                                }
                              />
                            </ListItem>
                          ))}
                        </List>
                      </CardContent>
                    </Card>
                  </Grid>
                )}
              </Grid>
            </Box>
          )}

          {/* Performance Tab */}
          {activeTab === 2 && (
            <Box sx={{ p: 1 }}>
              <Grid container spacing={3}>
                {/* Performance Metrics */}
                <Grid item xs={12}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                        <TimelineIcon sx={{ mr: 1 }} />
                        Performance Metrics
                      </Typography>
                      <Divider sx={{ mb: 2 }} />
                      <Grid container spacing={3}>
                        <Grid item xs={12} md={4}>
                          <Paper variant="outlined" sx={{ p: 1, textAlign: 'center' }}>
                            <Typography variant="caption" color="text.secondary">
                              CPU Load (1/5/15 min)
                            </Typography>
                            <Typography variant="h4" sx={{ fontWeight: 700, mt: 1 }}>
                              {data.performance?.cpuLoad1Min?.toFixed(2) || '0'}%
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {data.performance?.cpuLoad5Min?.toFixed(2) || '0'}% / {data.performance?.cpuLoad15Min?.toFixed(2) || '0'}%
                            </Typography>
                          </Paper>
                        </Grid>
                        
                        <Grid item xs={12} md={4}>
                          <Paper variant="outlined" sx={{ p: 1, textAlign: 'center' }}>
                            <Typography variant="caption" color="text.secondary">
                              Memory Load
                            </Typography>
                            <Typography variant="h4" sx={{ fontWeight: 700, mt: 1 }}>
                              {data.performance?.memoryLoadPercent?.toFixed(2) || '0'}%
                            </Typography>
                            <AnimatedProgressBar 
                              variant="determinate" 
                              value={data.performance?.memoryLoadPercent || 0}
                              severity={getSeverity(data.performance?.memoryLoadPercent || 0)}
                              sx={{ mt: 2 }}
                            />
                          </Paper>
                        </Grid>
                        
                        <Grid item xs={12} md={4}>
                          <Paper variant="outlined" sx={{ p: 1, textAlign: 'center' }}>
                            <Typography variant="caption" color="text.secondary">
                              Disk I/O Load
                            </Typography>
                            <Typography variant="h4" sx={{ fontWeight: 700, mt: 1 }}>
                              {data.performance?.diskIOLoad?.toFixed(2) || '0'}%
                            </Typography>
                            <Box sx={{ mt: 2 }}>
                              <Typography variant="caption" color="text.secondary">
                                Reads: {data.performance?.diskReads || 0} • Writes: {data.performance?.diskWrites || 0}
                              </Typography>
                            </Box>
                          </Paper>
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Network Performance */}
                <Grid item xs={12} md={6}>
                  <Card sx={{ height: '100%' }}>
                    <CardContent>
                      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                        <NetworkIcon sx={{ mr: 1 }} />
                        Network Performance
                      </Typography>
                      <Divider sx={{ mb: 2 }} />
                      <List dense disablePadding>
                        <ListItem>
                          <ListItemText 
                            primary="Network Adapters"
                            secondary={data.network?.adapterCount || 0}
                          />
                        </ListItem>
                        <ListItem>
                          <ListItemText 
                            primary="Bytes Received"
                            secondary={formatBytes(data.network?.bytesReceived || 0)}
                          />
                        </ListItem>
                        <ListItem>
                          <ListItemText 
                            primary="Bytes Sent"
                            secondary={formatBytes(data.network?.bytesSent || 0)}
                          />
                        </ListItem>
                        <ListItem>
                          <ListItemText 
                            primary="DNS Servers"
                            secondary={
                              <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }}>
                                {data.network?.dnsServers?.map((dns, idx) => (
                                  <Chip 
                                    key={idx}
                                    label={dns}
                                    size="small"
                                    variant="outlined"
                                  />
                                ))}
                              </Stack>
                            }
                          />
                        </ListItem>
                      </List>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Process Information */}
                <Grid item xs={12} md={6}>
                  <Card sx={{ height: '100%' }}>
                    <CardContent>
                      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                        <ViewListIcon sx={{ mr: 1 }} />
                        System Processes
                      </Typography>
                      <Divider sx={{ mb: 2 }} />
                      <List dense disablePadding>
                        <ListItem>
                          <ListItemText 
                            primary="Total Processes"
                            secondary={data.performance?.processCount || 0}
                          />
                        </ListItem>
                        <ListItem>
                          <ListItemText 
                            primary="Total Threads"
                            secondary={data.performance?.threadCount || 0}
                          />
                        </ListItem>
                        <ListItem>
                          <ListItemText 
                            primary="Uptime"
                            secondary={data.performance?.uptime || 'N/A'}
                          />
                        </ListItem>
                        <ListItem>
                          <ListItemText 
                            primary="Context Switches"
                            secondary={data.performance?.contextSwitches?.toLocaleString() || 'N/A'}
                          />
                        </ListItem>
                      </List>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Box>
          )}

          {/* Security Tab */}
          {activeTab === 3 && (
            <Box sx={{ p: 1 }}>
              <Grid container spacing={3}>
                {/* Security Status */}
                <Grid item xs={12} md={6}>
                  <Card sx={{ height: '100%' }}>
                    <CardContent>
                      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                        <SecurityIcon sx={{ mr: 1 }} />
                        Security Status
                      </Typography>
                      <Divider sx={{ mb: 2 }} />
                      <List dense disablePadding>
                        <ListItem>
                          <ListItemIcon>
                            {data.security?.windowsDefenderEnabled ? (
                              <CheckCircleIcon color="success" />
                            ) : (
                              <ErrorIcon color="error" />
                            )}
                          </ListItemIcon>
                          <ListItemText 
                            primary="Windows Defender"
                            secondary={data.security?.windowsDefenderEnabled ? "Enabled" : "Disabled"}
                          />
                        </ListItem>
                        <ListItem>
                          <ListItemIcon>
                            {data.security?.firewallEnabled ? (
                              <CheckCircleIcon color="success" />
                            ) : (
                              <ErrorIcon color="error" />
                            )}
                          </ListItemIcon>
                          <ListItemText 
                            primary="Firewall"
                            secondary={data.security?.firewallEnabled ? "Enabled" : "Disabled"}
                          />
                        </ListItem>
                        <ListItem>
                          <ListItemIcon>
                            {data.security?.uacEnabled ? (
                              <CheckCircleIcon color="success" />
                            ) : (
                              <WarningIcon color="warning" />
                            )}
                          </ListItemIcon>
                          <ListItemText 
                            primary="User Account Control"
                            secondary={data.security?.uacEnabled ? "Enabled" : "Disabled"}
                          />
                        </ListItem>
                        <ListItem>
                          <ListItemIcon>
                            {data.security?.bitLockerEnabled ? (
                              <CheckCircleIcon color="success" />
                            ) : (
                              <ErrorIcon color="error" />
                            )}
                          </ListItemIcon>
                          <ListItemText 
                            primary="BitLocker"
                            secondary={data.security?.bitLockerEnabled ? "Enabled" : "Disabled"}
                          />
                        </ListItem>
                        <ListItem>
                          <ListItemIcon>
                            {data.security?.smartScreenEnabled ? (
                              <CheckCircleIcon color="success" />
                            ) : (
                              <ErrorIcon color="error" />
                            )}
                          </ListItemIcon>
                          <ListItemText 
                            primary="SmartScreen"
                            secondary={data.security?.smartScreenEnabled ? "Enabled" : "Disabled"}
                          />
                        </ListItem>
                      </List>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Antivirus Products */}
                {data.security?.antivirusProducts?.length > 0 && (
                  <Grid item xs={12} md={6}>
                    <Card sx={{ height: '100%' }}>
                      <CardContent>
                        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                          <SecurityIcon sx={{ mr: 1 }} />
                          Antivirus Products
                        </Typography>
                        <Divider sx={{ mb: 2 }} />
                        <List dense disablePadding>
                          {data.security.antivirusProducts.map((av, index) => (
                            <ListItem key={index}>
                              <ListItemIcon>
                                {av.enabled ? (
                                  <CheckCircleIcon color="success" />
                                ) : (
                                  <ErrorIcon color="error" />
                                )}
                              </ListItemIcon>
                              <ListItemText 
                                primary={av.name || "Unknown"}
                                secondary={
                                  <Box>
                                    <Typography variant="caption" color="text.secondary">
                                      Status: {av.enabled ? "Enabled" : "Disabled"}
                                    </Typography>
                                    {av.version && (
                                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                        Version: {av.version}
                                      </Typography>
                                    )}
                                  </Box>
                                }
                              />
                            </ListItem>
                          ))}
                        </List>
                      </CardContent>
                    </Card>
                  </Grid>
                )}

                {/* Windows Features */}
                <Grid item xs={12}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                        <SettingsIcon sx={{ mr: 1 }} />
                        Windows Features
                      </Typography>
                      <Divider sx={{ mb: 2 }} />
                      <Grid container spacing={2}>
                        <Grid item xs={12} md={4}>
                          <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                            <Typography variant="caption" color="text.secondary">
                              .NET Framework
                            </Typography>
                            <Box sx={{ mt: 1 }}>
                              {data.windowsFeatures?.netFrameworkEnabled ? (
                                <CheckCircleIcon color="success" fontSize="large" />
                              ) : (
                                <ErrorIcon color="error" fontSize="large" />
                              )}
                            </Box>
                            <Typography variant="body2" sx={{ mt: 1 }}>
                              {data.windowsFeatures?.netFrameworkEnabled ? "Enabled" : "Disabled"}
                            </Typography>
                          </Paper>
                        </Grid>
                        
                        <Grid item xs={12} md={4}>
                          <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                            <Typography variant="caption" color="text.secondary">
                              WSL (Windows Subsystem for Linux)
                            </Typography>
                            <Box sx={{ mt: 1 }}>
                              {data.windowsFeatures?.wslEnabled ? (
                                <CheckCircleIcon color="success" fontSize="large" />
                              ) : (
                                <ErrorIcon color="error" fontSize="large" />
                              )}
                            </Box>
                            <Typography variant="body2" sx={{ mt: 1 }}>
                              {data.windowsFeatures?.wslEnabled ? "Enabled" : "Disabled"}
                            </Typography>
                          </Paper>
                        </Grid>
                        
                        <Grid item xs={12} md={4}>
                          <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                            <Typography variant="caption" color="text.secondary">
                              Hyper-V
                            </Typography>
                            <Box sx={{ mt: 1 }}>
                              {data.windowsFeatures?.hyperVEnabled ? (
                                <CheckCircleIcon color="success" fontSize="large" />
                              ) : (
                                <ErrorIcon color="error" fontSize="large" />
                              )}
                            </Box>
                            <Typography variant="body2" sx={{ mt: 1 }}>
                              {data.windowsFeatures?.hyperVEnabled ? "Enabled" : "Disabled"}
                            </Typography>
                          </Paper>
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Box>
          )}

          {/* Event Logs Tab */}
          {activeTab === 4 && (
            <Box sx={{ p: 1 }}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center' }}>
                      <EventIcon sx={{ mr: 1 }} />
                      Event Logs ({data.eventLog?.length || 0} events)
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <IconButton size="small">
                        <FilterIcon />
                      </IconButton>
                      <IconButton size="small">
                        <SearchIcon />
                      </IconButton>
                    </Box>
                  </Box>
                  <Divider sx={{ mb: 2 }} />
                  <TableContainer sx={{ maxHeight: 500 }}>
                    <Table stickyHeader size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell width="160px">Time</TableCell>
                          <TableCell width="80px">Level</TableCell>
                          <TableCell>Source</TableCell>
                          <TableCell>Message</TableCell>
                          <TableCell width="100px">Computer</TableCell>
                          <TableCell width="80px">Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {(data.eventLog || []).map((event, index) => (
                          <TableRow key={index} hover>
                            <TableCell>
                              <Typography variant="caption">
                                {formatDate(event.time)}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Chip 
                                label={event.level}
                                size="small"
                                sx={{
                                  backgroundColor: 
                                    event.level === '1' ? '#EF444415' : 
                                    event.level === '2' ? '#F59E0B15' : '#3B82F615',
                                  color: 
                                    event.level === '1' ? '#EF4444' : 
                                    event.level === '2' ? '#F59E0B' : '#3B82F6',
                                  border: `1px solid ${
                                    event.level === '1' ? '#EF444430' : 
                                    event.level === '2' ? '#F59E0B30' : '#3B82F630'
                                  }`,
                                }}
                              />
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2">
                                {event.source}
                              </Typography>
                              {event.eventId && (
                                <Typography variant="caption" color="text.secondary">
                                  ID: {event.eventId}
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell>
                              <Tooltip title={event.message} arrow>
                                <Typography 
                                  variant="body2" 
                                  sx={{ 
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    display: '-webkit-box',
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical',
                                    cursor: 'pointer',
                                  }}
                                  onClick={() => setSelectedEvent(event)}
                                >
                                  {event.message}
                                </Typography>
                              </Tooltip>
                            </TableCell>
                            <TableCell>
                              <Typography variant="caption">
                                {event.computer}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <IconButton 
                                size="small"
                                onClick={() => setSelectedEvent(event)}
                              >
                                <InfoIcon fontSize="small" />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            </Box>
          )}

          {/* Processes Tab */}
          {activeTab === 5 && (
            <Box sx={{ p: 1 }}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center' }}>
                      <ViewListIcon sx={{ mr: 1 }} />
                      Running Processes ({data.processes?.length || 0})
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      <Typography variant="caption" color="text.secondary">
                        View:
                      </Typography>
                      <IconButton 
                        size="small" 
                        onClick={() => setViewMode('grid')}
                        color={viewMode === 'grid' ? 'primary' : 'default'}
                      >
                        <DashboardIcon fontSize="small" />
                      </IconButton>
                      <IconButton 
                        size="small" 
                        onClick={() => setViewMode('list')}
                        color={viewMode === 'list' ? 'primary' : 'default'}
                      >
                        <ViewListIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>
                  <Divider sx={{ mb: 2 }} />
                  
                  {viewMode === 'grid' ? (
                    <Grid container spacing={2}>
                      {(data.processes || []).slice(0, 12).map((process, index) => (
                        <Grid item xs={12} sm={6} md={4} lg={3} key={index}>
                          <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
                            <Typography variant="subtitle2" gutterBottom noWrap>
                              {process.name}
                            </Typography>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                              <Typography variant="caption" color="text.secondary">
                                PID: {process.pid}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                CPU: {process.cpuUsage?.toFixed(1)}%
                              </Typography>
                            </Box>
                            <AnimatedProgressBar 
                              variant="determinate" 
                              value={process.cpuUsage || 0}
                              severity={getSeverity(process.cpuUsage || 0)}
                              sx={{ mb: 1 }}
                            />
                            <Typography variant="caption" color="text.secondary">
                              Memory: {process.memoryFormatted}
                            </Typography>
                            <Box sx={{ mt: 1 }}>
                              <Chip 
                                label={process.state}
                                size="small"
                                sx={{
                                  backgroundColor: 
                                    process.state === 'Running' ? '#10B98115' : 
                                    process.state === 'Stopped' ? '#EF444415' : '#6B728015',
                                  color: 
                                    process.state === 'Running' ? '#10B981' : 
                                    process.state === 'Stopped' ? '#EF4444' : '#6B7280',
                                  fontSize: '0.65rem',
                                }}
                              />
                            </Box>
                          </Paper>
                        </Grid>
                      ))}
                    </Grid>
                  ) : (
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Process Name</TableCell>
                            <TableCell align="right">PID</TableCell>
                            <TableCell align="right">CPU %</TableCell>
                            <TableCell align="right">Memory</TableCell>
                            <TableCell align="right">State</TableCell>
                            <TableCell align="right">User</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {(data.processes || []).slice(0, 20).map((process, index) => (
                            <TableRow key={index} hover>
                              <TableCell>
                                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                  {process.name}
                                </Typography>
                              </TableCell>
                              <TableCell align="right">
                                <Chip 
                                  label={process.pid} 
                                  size="small" 
                                  variant="outlined"
                                />
                              </TableCell>
                              <TableCell align="right">
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1 }}>
                                  <Typography variant="body2">
                                    {process.cpuUsage?.toFixed(1)}%
                                  </Typography>
                                  <AnimatedProgressBar 
                                    variant="determinate" 
                                    value={process.cpuUsage || 0}
                                    severity={getSeverity(process.cpuUsage || 0)}
                                    sx={{ width: 60 }}
                                  />
                                </Box>
                              </TableCell>
                              <TableCell align="right">
                                <Typography variant="body2">
                                  {process.memoryFormatted}
                                </Typography>
                              </TableCell>
                              <TableCell align="right">
                                <Chip 
                                  label={process.state}
                                  size="small"
                                  sx={{
                                    backgroundColor: 
                                      process.state === 'Running' ? '#10B98115' : 
                                      process.state === 'Stopped' ? '#EF444415' : '#6B728015',
                                    color: 
                                      process.state === 'Running' ? '#10B981' : 
                                      process.state === 'Stopped' ? '#EF4444' : '#6B7280',
                                  }}
                                />
                              </TableCell>
                              <TableCell align="right">
                                <Typography variant="caption">
                                  {process.user}
                                </Typography>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                  
                  <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
                    <Button variant="outlined" size="small">
                      Load More Processes
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Box>
          )}
        </Paper>

        {/* Footer */}
        <Paper sx={{ p: 1, borderRadius: 2, textAlign: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            Last Updated: {formatDate(data.healthStatus?.timestamp)} • 
            Data Collection: {data.collectionDuration || '0'}ms • 
            Platform: {data.windows ? 'Windows' : data.linux ? 'Linux' : data.mac ? 'macOS' : 'Unknown'}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            System Dashboard v1.0 • All metrics are real-time
          </Typography>
        </Paper>
      </Container>

      {/* Event Detail Dialog */}
      <Dialog
        open={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
        maxWidth="md"
        fullWidth
      >
        {selectedEvent && (
          <>
            <DialogTitle>
              Event Details
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                {formatDate(selectedEvent.time)}
              </Typography>
            </DialogTitle>
            <DialogContent>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Source
                  </Typography>
                  <Typography variant="body1">
                    {selectedEvent.source}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Event ID
                  </Typography>
                  <Typography variant="body1">
                    {selectedEvent.eventId}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Level
                  </Typography>
                  <Chip 
                    label={selectedEvent.level}
                    size="small"
                    sx={{
                      backgroundColor: 
                        selectedEvent.level === '1' ? '#EF444415' : 
                        selectedEvent.level === '2' ? '#F59E0B15' : '#3B82F615',
                      color: 
                        selectedEvent.level === '1' ? '#EF4444' : 
                        selectedEvent.level === '2' ? '#F59E0B' : '#3B82F6',
                    }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Computer
                  </Typography>
                  <Typography variant="body1">
                    {selectedEvent.computer}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Message
                  </Typography>
                  <Paper variant="outlined" sx={{ p: 2, mt: 1, maxHeight: 300, overflow: 'auto' }}>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                      {selectedEvent.message}
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setSelectedEvent(null)}>Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Global Styles */}
      <style jsx global>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        @keyframes progressAnimation {
          0% { background-position: 20px 0; }
          100% { background-position: 0 0; }
        }
        
        .spin {
          animation: spin 1s linear infinite;
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
      `}</style>
    </Box>
  );
};

export default WindowsServerInfoDashboard;