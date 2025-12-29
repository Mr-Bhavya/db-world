import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Box,
  Chip,
  Container,
  Alert,
  CircularProgress,
  IconButton,
  Tooltip,
  Paper,
  Avatar,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Tab,
  alpha,
  useTheme
} from '@mui/material';
import {
  Memory,
  Storage,
  Computer,
  Speed,
  Dashboard,
  Refresh,
  NetworkCheck,
  Security,
  Timeline,
  Thermostat,
  Devices,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  ArrowUpward,
  ArrowDownward,
  NetworkWifi,
  AccountTree,
  Download,
  Upload,
  BatteryFull
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LineChart, 
  Line, 
  BarChart as RechartsBarChart, 
  Bar, 
  PieChart as RechartsPieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  Legend, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { Doughnut } from 'react-chartjs-2';
import { Chart, ArcElement, Tooltip as ChartTooltip, Legend as ChartLegend } from 'chart.js';
import CommonServices from '../CommonServices';
import { systemInfo } from '../ApiServices';
import { toast } from '../Toast';

Chart.register(ArcElement, ChartTooltip, ChartLegend);

const SystemInfo = () => {
  const theme = useTheme();
  const [systemData, setSystemData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [refreshInterval] = useState(5000);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [historicalData, setHistoricalData] = useState([]);

  // Color scheme
  const colors = {
    primary: '#1976d2',
    success: '#00b894',
    warning: '#ffaa00',
    error: '#ff4444',
    info: '#0984e3',
    purple: '#6c5ce7',
    pink: '#fd79a8',
    cyan: '#00cec9',
    orange: '#e17055'
  };

  // Safe data access
  const safeGet = useCallback((obj, path, defaultValue = null) => {
    if (!obj) return defaultValue;
    const keys = path.split('.');
    let result = obj;
    for (const key of keys) {
      if (result && typeof result === 'object' && key in result) {
        result = result[key];
      } else {
        return defaultValue;
      }
    }
    return result;
  }, []);

  // Format bytes with proper units
  const formatBytes = useCallback((bytes) => {
    if (!bytes && bytes !== 0) return { value: 0, suffix: 'B', formatted: '0 B' };
    
    try {
      const result = CommonServices.bytesToReadbleFormat(bytes);
      return {
        value: result?.value || 0,
        suffix: result?.suffix || 'B',
        formatted: `${(result?.value || 0).toFixed(2)} ${result?.suffix || 'B'}`
      };
    } catch (error) {
      return { value: 0, suffix: 'B', formatted: '0 B' };
    }
  }, []);

  // Calculate percentage
  const calculatePercentage = useCallback((used, total) => {
    if (!used || !total || total === 0) return 0;
    
    const usedNum = typeof used === 'number' ? used : Number(used);
    const totalNum = typeof total === 'number' ? total : Number(total);
    
    if (isNaN(usedNum) || isNaN(totalNum) || totalNum === 0) return 0;
    
    return (usedNum / totalNum) * 100;
  }, []);

  // Get color based on percentage
  const getPercentageColor = useCallback((percentage) => {
    if (percentage > 90) return colors.error;
    if (percentage > 75) return colors.warning;
    if (percentage > 50) return colors.info;
    return colors.success;
  }, [colors]);

  // Get health status
  const getHealthStatus = useCallback((score) => {
    if (score >= 90) return { status: 'Excellent', color: colors.success, icon: <CheckCircleIcon /> };
    if (score >= 75) return { status: 'Good', color: colors.info, icon: <CheckCircleIcon /> };
    if (score >= 50) return { status: 'Fair', color: colors.warning, icon: <WarningIcon /> };
    return { status: 'Poor', color: colors.error, icon: <ErrorIcon /> };
  }, [colors]);

  // Fetch system info
  const fetchSystemInfo = useCallback(async () => {
    try {
      setLoading(true);
      const infoRes = await systemInfo();
      console.log('System Info Response:', infoRes);
      if (infoRes?.httpStatusCode === 200) {
        const data = infoRes.data || {};
        console.log('System Data Received:', data);
        setSystemData(data);
        setError(null);
        setLastUpdate(new Date());
        
        // Calculate CPU load from Windows data
        const cpuLoadValue = safeGet(data, 'cpu.Load', 0);
        const memoryUsed = safeGet(data, 'memory.Used', 0);
        const memoryTotal = safeGet(data, 'memory.Total', 1);
        const memoryPercentage = calculatePercentage(memoryUsed, memoryTotal);
        
        // Add to historical data
        setHistoricalData(prev => {
          const newData = [...prev, {
            timestamp: new Date().toLocaleTimeString(),
            cpu: cpuLoadValue,
            memory: memoryPercentage,
            disk: 0 // You can calculate disk usage if available
          }];
          return newData.slice(-20); // Keep last 20 entries
        });
        
      } else {
        throw new Error(infoRes?.message || 'Failed to fetch system information');
      }
    } catch (err) {
      console.error('Error fetching system info:', err);
      setError(err.message);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [safeGet, calculatePercentage]);

  // Auto refresh effect
  useEffect(() => {
    fetchSystemInfo();
    
    // if (autoRefresh) {
    //   const interval = setInterval(fetchSystemInfo, refreshInterval);
    //   return () => clearInterval(interval);
    // }
  }, [
    // fetchSystemInfo, autoRefresh, refreshInterval
  ]);

  // Memoized calculations for Windows data structure
  const cpuInfo = useMemo(() => safeGet(systemData, 'cpu', {}), [systemData, safeGet]);
  const memoryInfo = useMemo(() => safeGet(systemData, 'memory', {}), [systemData, safeGet]);
  const diskInfo = useMemo(() => safeGet(systemData, 'disks', []), [systemData, safeGet]);
  const networkInfo = useMemo(() => safeGet(systemData, 'network', {}), [systemData, safeGet]);
  const processes = useMemo(() => safeGet(systemData, 'processes', []), [systemData, safeGet]);
  const computerInfo = useMemo(() => safeGet(systemData, 'computer', {}), [systemData, safeGet]);

  // CPU calculations for Windows
  const cpuLoad = useMemo(() => {
    // Windows provides Load directly
    const load = safeGet(cpuInfo, 'Load', 0);
    return typeof load === 'number' ? load : parseFloat(load) || 0;
  }, [cpuInfo, safeGet]);

  const cpuCores = useMemo(() => safeGet(cpuInfo, 'Cores', 1), [cpuInfo, safeGet]);
  const cpuFrequency = useMemo(() => safeGet(cpuInfo, 'CurrentClock', 0), [cpuInfo, safeGet]);
  const cpuName = useMemo(() => safeGet(cpuInfo, 'Name', 'Unknown Processor'), [cpuInfo, safeGet]);

  // Memory calculations for Windows
  const memoryUsed = useMemo(() => {
    const used = safeGet(memoryInfo, 'Used', 0);
    return typeof used === 'number' ? used : parseFloat(used) || 0;
  }, [memoryInfo, safeGet]);

  const memoryTotal = useMemo(() => {
    const total = safeGet(memoryInfo, 'Total', 1);
    return typeof total === 'number' ? total : parseFloat(total) || 1;
  }, [memoryInfo, safeGet]);

  const memoryPercentage = useMemo(() => 
    calculatePercentage(memoryUsed, memoryTotal), 
    [memoryUsed, memoryTotal, calculatePercentage]
  );

  // Disk calculations for Windows
  const diskPercentage = useMemo(() => {
    if (!diskInfo || diskInfo.length === 0) return 0;
    
    const total = diskInfo.reduce((sum, disk) => sum + (parseFloat(disk.Total) || 0), 0);
    const used = diskInfo.reduce((sum, disk) => sum + (parseFloat(disk.Used) || 0), 0);
    
    return calculatePercentage(used, total);
  }, [diskInfo, calculatePercentage]);

  // OS Info
  const osName = useMemo(() => safeGet(computerInfo, 'OS', 'Unknown OS'), [computerInfo, safeGet]);
  const osVersion = useMemo(() => safeGet(computerInfo, 'Version', ''), [computerInfo, safeGet]);
  const uptimeInfo = useMemo(() => safeGet(computerInfo, 'Uptime', {}), [computerInfo, safeGet]);

  // Format uptime
  const formatUptime = useCallback((uptime) => {
    if (!uptime) return 'Unknown';
    
    if (uptime.TotalDays !== undefined) {
      const days = Math.floor(uptime.TotalDays);
      const hours = Math.floor(uptime.TotalHours % 24);
      const minutes = Math.floor(uptime.TotalMinutes % 60);
      return `${days}d ${hours}h ${minutes}m`;
    }
    
    return 'Unknown';
  }, []);

  // Create doughnut chart data
  const createDoughnutData = useCallback((used, total, label) => {
    const usedBytes = formatBytes(used);
    const totalBytes = formatBytes(total);
    const percentage = calculatePercentage(used, total);
    
    return {
      labels: ['Used', 'Free'],
      datasets: [{
        label: label,
        data: [usedBytes.value, totalBytes.value - usedBytes.value],
        backgroundColor: [
          getPercentageColor(percentage),
          alpha(theme.palette.text.secondary, 0.1)
        ],
        borderColor: ['transparent', 'transparent'],
        borderWidth: 0,
        hoverOffset: 15,
        borderRadius: 10,
        spacing: 2
      }]
    };
  }, [formatBytes, calculatePercentage, getPercentageColor, theme, alpha]);

  // Chart options
  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          usePointStyle: true,
          padding: 20,
          font: {
            size: 11
          }
        }
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            const label = context.label;
            const value = context.parsed;
            const total = context.dataset.data.reduce((a, b) => a + b, 0);
            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
            return `${label}: ${value.toFixed(2)} (${percentage}%)`;
          }
        }
      }
    },
    cutout: '75%'
  };

  // Historical chart data
  const historicalChartData = useMemo(() => 
    historicalData.map((point, index) => ({
      name: point.timestamp,
      cpu: point.cpu,
      memory: point.memory
    })),
    [historicalData]
  );

  if (loading && !lastUpdate) {
    return (
      <Container maxWidth="xl" sx={{ py: 8 }}>
        <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" minHeight="60vh">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          >
            <CircularProgress size={80} thickness={4} sx={{ color: colors.primary }} />
          </motion.div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <Typography variant="h6" color="text.secondary" sx={{ mt: 3 }}>
              Initializing System Dashboard...
            </Typography>
          </motion.div>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="h4" component="h1" gutterBottom sx={{ 
              fontWeight: 'bold',
              background: `linear-gradient(45deg, ${colors.primary}, ${colors.purple})`,
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              color: 'transparent',
              display: 'flex',
              alignItems: 'center',
              gap: 2
            }}>
              <motion.div
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Dashboard sx={{ fontSize: 40 }} />
              </motion.div>
              System Dashboard
            </Typography>
            <Typography variant="subtitle1" color="text.secondary">
              {osName} {osVersion} • Last updated: {lastUpdate ? lastUpdate.toLocaleTimeString() : 'Never'}
            </Typography>
          </Box>
          
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            <Tooltip title="Auto Refresh">
              <Chip
                label={autoRefresh ? `Auto (${refreshInterval/1000}s)` : 'Manual'}
                onClick={() => setAutoRefresh(!autoRefresh)}
                color={autoRefresh ? "primary" : "default"}
                variant={autoRefresh ? "filled" : "outlined"}
                icon={autoRefresh ? <CheckCircleIcon /> : <Refresh />}
                sx={{ cursor: 'pointer' }}
              />
            </Tooltip>
            
            <Tooltip title="Refresh Now">
              <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                <IconButton 
                  onClick={fetchSystemInfo}
                  sx={{ 
                    background: `linear-gradient(45deg, ${colors.primary}, ${colors.info})`,
                    color: 'white',
                    '&:hover': {
                      background: `linear-gradient(45deg, ${colors.info}, ${colors.primary})`,
                    }
                  }}
                >
                  <Refresh />
                </IconButton>
              </motion.div>
            </Tooltip>
          </Box>
        </Box>
      </motion.div>

      {/* System Overview Cards */}
      <Grid container spacing={3}>
        {/* CPU Card */}
        <Grid item xs={12} md={6} lg={4}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card sx={{ height: '100%', borderRadius: 3 }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Avatar sx={{ 
                      background: `linear-gradient(135deg, ${colors.primary}, ${colors.info})`,
                      color: 'white'
                    }}>
                      <Speed />
                    </Avatar>
                    <Box>
                      <Typography variant="h6" fontWeight="bold">CPU</Typography>
                      <Typography variant="caption" color="text.secondary" noWrap>
                        {cpuName}
                      </Typography>
                    </Box>
                  </Box>
                  <Chip 
                    label={`${cpuLoad.toFixed(1)}%`}
                    color={cpuLoad > 80 ? "error" : cpuLoad > 60 ? "warning" : "success"}
                    size="small"
                  />
                </Box>
                
                <Box sx={{ textAlign: 'center', mb: 3 }}>
                  <Typography variant="h2" component="div" sx={{ 
                    color: getPercentageColor(cpuLoad),
                    fontWeight: 'bold',
                    mb: 1
                  }}>
                    {cpuLoad.toFixed(1)}%
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Current Load
                  </Typography>
                </Box>

                <Box sx={{ mb: 3 }}>
                  <LinearProgress 
                    variant="determinate" 
                    value={cpuLoad}
                    sx={{ 
                      height: 12,
                      borderRadius: 6,
                      backgroundColor: alpha(theme.palette.text.secondary, 0.1),
                      '& .MuiLinearProgress-bar': {
                        background: `linear-gradient(90deg, ${getPercentageColor(cpuLoad)}, ${alpha(getPercentageColor(cpuLoad), 0.7)})`,
                        borderRadius: 6
                      }
                    }}
                  />
                </Box>
                
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Paper sx={{ p: 2, textAlign: 'center', borderRadius: 2 }}>
                      <Typography variant="caption" color="text.secondary">Cores</Typography>
                      <Typography variant="h6" fontWeight="bold">
                        {cpuCores}
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={6}>
                    <Paper sx={{ p: 2, textAlign: 'center', borderRadius: 2 }}>
                      <Typography variant="caption" color="text.secondary">Frequency</Typography>
                      <Typography variant="h6" fontWeight="bold">
                        {cpuFrequency} MHz
                      </Typography>
                    </Paper>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </motion.div>
        </Grid>

        {/* Memory Card */}
        <Grid item xs={12} md={6} lg={4}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card sx={{ height: '100%', borderRadius: 3 }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Avatar sx={{ 
                      background: `linear-gradient(135deg, ${colors.success}, ${colors.cyan})`,
                      color: 'white'
                    }}>
                      <Memory />
                    </Avatar>
                    <Box>
                      <Typography variant="h6" fontWeight="bold">Memory</Typography>
                      <Typography variant="caption" color="text.secondary">
                        RAM Usage
                      </Typography>
                    </Box>
                  </Box>
                  <Chip 
                    label={`${memoryPercentage.toFixed(1)}%`}
                    color={memoryPercentage > 90 ? "error" : memoryPercentage > 75 ? "warning" : "success"}
                    size="small"
                  />
                </Box>
                
                <Box sx={{ height: 200, mb: 3 }}>
                  <Doughnut 
                    data={createDoughnutData(memoryUsed, memoryTotal, "Memory")}
                    options={doughnutOptions}
                  />
                </Box>
                
                <Grid container spacing={1}>
                  <Grid item xs={4}>
                    <Paper sx={{ p: 1.5, textAlign: 'center', borderRadius: 2 }}>
                      <Typography variant="caption" color="text.secondary">Total</Typography>
                      <Typography variant="body2" fontWeight="bold">
                        {formatBytes(memoryTotal).formatted}
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={4}>
                    <Paper sx={{ p: 1.5, textAlign: 'center', borderRadius: 2 }}>
                      <Typography variant="caption" color="text.secondary">Used</Typography>
                      <Typography variant="body2" fontWeight="bold" color={getPercentageColor(memoryPercentage)}>
                        {formatBytes(memoryUsed).formatted}
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={4}>
                    <Paper sx={{ p: 1.5, textAlign: 'center', borderRadius: 2 }}>
                      <Typography variant="caption" color="text.secondary">Free</Typography>
                      <Typography variant="body2" fontWeight="bold">
                        {formatBytes(memoryTotal - memoryUsed).formatted}
                      </Typography>
                    </Paper>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </motion.div>
        </Grid>

        {/* System Info Card */}
        <Grid item xs={12} md={6} lg={4}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card sx={{ height: '100%', borderRadius: 3 }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                  <Computer sx={{ color: colors.primary, fontSize: 40 }} />
                  <Box>
                    <Typography variant="h6" fontWeight="bold">System Information</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {osName}
                    </Typography>
                  </Box>
                </Box>
                
                <List dense>
                  <ListItem sx={{ px: 0 }}>
                    <ListItemIcon>
                      <Computer fontSize="small" />
                    </ListItemIcon>
                    <ListItemText 
                      primary="Operating System"
                      secondary={osName}
                    />
                  </ListItem>
                  <ListItem sx={{ px: 0 }}>
                    <ListItemIcon>
                      <Speed fontSize="small" />
                    </ListItemIcon>
                    <ListItemText 
                      primary="Version"
                      secondary={osVersion}
                    />
                  </ListItem>
                  <ListItem sx={{ px: 0 }}>
                    <ListItemIcon>
                      <BatteryFull fontSize="small" />
                    </ListItemIcon>
                    <ListItemText 
                      primary="Uptime"
                      secondary={formatUptime(uptimeInfo)}
                    />
                  </ListItem>
                  {computerInfo.Build && (
                    <ListItem sx={{ px: 0 }}>
                      <ListItemIcon>
                        <Devices fontSize="small" />
                      </ListItemIcon>
                      <ListItemText 
                        primary="Build"
                        secondary={computerInfo.Build}
                      />
                    </ListItem>
                  )}
                </List>
              </CardContent>
            </Card>
          </motion.div>
        </Grid>

        {/* Disk Information */}
        {diskInfo && diskInfo.length > 0 && (
          <Grid item xs={12}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Card sx={{ borderRadius: 3 }}>
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                    <Storage sx={{ color: colors.warning, fontSize: 32 }} />
                    <Typography variant="h6" fontWeight="bold">Storage Drives</Typography>
                  </Box>
                  
                  <Grid container spacing={3}>
                    {diskInfo.map((disk, index) => {
                      const diskUsed = parseFloat(disk.Used) || 0;
                      const diskTotal = parseFloat(disk.Total) || 1;
                      const diskPercentage = calculatePercentage(diskUsed, diskTotal);
                      
                      return (
                        <Grid item xs={12} md={6} lg={4} key={index}>
                          <Card variant="outlined" sx={{ height: '100%' }}>
                            <CardContent>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                <Typography variant="h6" component="h3">
                                  {disk.Name || `Drive ${index + 1}`}
                                </Typography>
                                <Chip 
                                  label={`${diskPercentage.toFixed(1)}%`}
                                  size="small"
                                  color={
                                    diskPercentage > 90 ? "error" : 
                                    diskPercentage > 75 ? "warning" : "success"
                                  }
                                />
                              </Box>
                              
                              <Box sx={{ height: 120, mb: 2 }}>
                                <Doughnut 
                                  data={createDoughnutData(diskUsed, diskTotal, disk.Name || `Drive ${index + 1}`)}
                                  options={doughnutOptions}
                                />
                              </Box>
                              
                              <Box sx={{ mb: 2 }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                  <Typography variant="caption" color="text.secondary">Total</Typography>
                                  <Typography variant="caption" fontWeight="bold">
                                    {formatBytes(diskTotal).formatted}
                                  </Typography>
                                </Box>
                                <LinearProgress 
                                  variant="determinate" 
                                  value={diskPercentage}
                                  sx={{ 
                                    height: 6,
                                    borderRadius: 3,
                                    backgroundColor: alpha(theme.palette.text.secondary, 0.1),
                                    '& .MuiLinearProgress-bar': {
                                      background: `linear-gradient(90deg, ${getPercentageColor(diskPercentage)}, ${alpha(getPercentageColor(diskPercentage), 0.7)})`,
                                      borderRadius: 3
                                    }
                                  }}
                                />
                              </Box>
                              
                              <Grid container spacing={1}>
                                <Grid item xs={6}>
                                  <Paper sx={{ p: 1, textAlign: 'center', borderRadius: 2 }}>
                                    <Typography variant="caption" color="text.secondary">Used</Typography>
                                    <Typography variant="body2" fontWeight="bold">
                                      {formatBytes(diskUsed).formatted}
                                    </Typography>
                                  </Paper>
                                </Grid>
                                <Grid item xs={6}>
                                  <Paper sx={{ p: 1, textAlign: 'center', borderRadius: 2 }}>
                                    <Typography variant="caption" color="text.secondary">Free</Typography>
                                    <Typography variant="body2" fontWeight="bold">
                                      {formatBytes(parseFloat(disk.Free) || (diskTotal - diskUsed)).formatted}
                                    </Typography>
                                  </Paper>
                                </Grid>
                              </Grid>
                              
                              {disk.Label && (
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                                  Label: {disk.Label}
                                </Typography>
                              )}
                              {disk.FileSystem && (
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                  Filesystem: {disk.FileSystem}
                                </Typography>
                              )}
                            </CardContent>
                          </Card>
                        </Grid>
                      );
                    })}
                  </Grid>
                </CardContent>
              </Card>
            </motion.div>
          </Grid>
        )}

        {/* Performance Trends */}
        {historicalChartData.length > 0 && (
          <Grid item xs={12}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <Card sx={{ borderRadius: 3 }}>
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                    <Timeline sx={{ color: colors.primary }} />
                    <Typography variant="h6" fontWeight="bold">Performance Trends</Typography>
                  </Box>
                  
                  <Box sx={{ height: 300 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={historicalChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.text.secondary, 0.1)} />
                        <XAxis 
                          dataKey="name" 
                          stroke={theme.palette.text.secondary}
                          tick={{ fontSize: 12 }}
                        />
                        <YAxis 
                          stroke={theme.palette.text.secondary}
                          tick={{ fontSize: 12 }}
                          domain={[0, 100]}
                        />
                        <RechartsTooltip 
                          contentStyle={{ 
                            borderRadius: 8,
                            border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
                            background: theme.palette.background.paper
                          }}
                        />
                        <Legend />
                        <Area 
                          type="monotone" 
                          dataKey="cpu" 
                          name="CPU %" 
                          stroke={colors.primary} 
                          fill={alpha(colors.primary, 0.1)}
                          strokeWidth={2}
                          dot={{ stroke: colors.primary, strokeWidth: 2, r: 3 }}
                          activeDot={{ r: 6 }}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="memory" 
                          name="Memory %" 
                          stroke={colors.success} 
                          fill={alpha(colors.success, 0.1)}
                          strokeWidth={2}
                          dot={{ stroke: colors.success, strokeWidth: 2, r: 3 }}
                          activeDot={{ r: 6 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </Box>
                </CardContent>
              </Card>
            </motion.div>
          </Grid>
        )}

        {/* Top Processes */}
        {processes && processes.length > 0 && (
          <Grid item xs={12} md={6}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              <Card sx={{ borderRadius: 3 }}>
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                    <AccountTree sx={{ color: colors.purple }} />
                    <Typography variant="h6" fontWeight="bold">Top Processes</Typography>
                  </Box>
                  
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Process Name</TableCell>
                          <TableCell align="right">PID</TableCell>
                          <TableCell align="right">Memory (MB)</TableCell>
                          <TableCell align="right">Threads</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {processes.slice(0, 10).map((proc, index) => (
                          <TableRow key={index} hover>
                            <TableCell>
                              <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                                {proc.name || 'Unknown'}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2">{proc.pid || 'N/A'}</Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Chip 
                                label={`${proc.memory || 0} MB`}
                                size="small"
                                sx={{ 
                                  backgroundColor: alpha(colors.info, 0.1),
                                  color: colors.info
                                }}
                              />
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2">{proc.threads || 'N/A'}</Typography>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            </motion.div>
          </Grid>
        )}

        {/* Network Interfaces */}
        {networkInfo && networkInfo.interfaces && networkInfo.interfaces.length > 0 && (
          <Grid item xs={12} md={6}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
            >
              <Card sx={{ borderRadius: 3 }}>
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                    <NetworkWifi sx={{ color: colors.info }} />
                    <Typography variant="h6" fontWeight="bold">Network Interfaces</Typography>
                  </Box>
                  
                  <Grid container spacing={2}>
                    {networkInfo.interfaces
                      .filter(iface => iface.mac) // Only show interfaces with MAC addresses
                      .slice(0, 4)
                      .map((iface, index) => (
                        <Grid item xs={12} sm={6} key={index}>
                          <Paper sx={{ p: 2, borderRadius: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                              <Avatar sx={{ 
                                width: 40, 
                                height: 40,
                                background: `linear-gradient(135deg, ${colors.info}, ${colors.cyan})`
                              }}>
                                <NetworkWifi />
                              </Avatar>
                              <Box sx={{ flex: 1 }}>
                                <Typography variant="subtitle2" fontWeight="bold" noWrap>
                                  {iface.displayName || iface.name}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  MTU: {iface.mtu || 1500}
                                </Typography>
                              </Box>
                            </Box>
                            
                            {iface.mac && (
                              <Chip 
                                label={iface.mac}
                                size="small"
                                sx={{ mt: 1 }}
                              />
                            )}
                          </Paper>
                        </Grid>
                      ))}
                  </Grid>
                </CardContent>
              </Card>
            </motion.div>
          </Grid>
        )}
      </Grid>

      {/* Error State */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Alert 
            severity="error" 
            sx={{ mb: 3, mt: 3 }}
            action={
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Chip 
                  label="Retry" 
                  onClick={fetchSystemInfo} 
                  variant="outlined"
                  size="small"
                />
                <Chip 
                  label="Disable Auto" 
                  onClick={() => setAutoRefresh(false)}
                  variant="outlined"
                  size="small"
                />
              </Box>
            }
          >
            <Typography variant="body1" fontWeight="bold">System Monitoring Error</Typography>
            <Typography variant="body2">{error}</Typography>
          </Alert>
        </motion.div>
      )}
    </Container>
  );
};

export default SystemInfo;