// import React, { useEffect, useState, useCallback, useMemo } from 'react';
// import {
//   Grid,
//   Card,
//   CardContent,
//   Typography,
//   LinearProgress,
//   Box,
//   Chip,
//   Container,
//   Alert,
//   CircularProgress,
//   IconButton,
//   Tooltip,
//   Paper,
//   Avatar,
//   List,
//   ListItem,
//   ListItemIcon,
//   ListItemText,
//   Table,
//   TableBody,
//   TableCell,
//   TableContainer,
//   TableHead,
//   TableRow,
//   alpha,
//   useTheme,
//   Divider,
//   Stack
// } from '@mui/material';
// import {
//   Memory,
//   Storage,
//   Computer,
//   Speed,
//   Dashboard,
//   Refresh,
//   NetworkCheck,
//   Security,
//   Timeline,
//   Thermostat,
//   Devices,
//   CheckCircle as CheckCircleIcon,
//   Warning as WarningIcon,
//   Error as ErrorIcon,
//   NetworkWifi,
//   AccountTree,
//   BatteryFull,
//   ComputerTwoTone,
//   DriveEta,
// } from '@mui/icons-material';
// import { motion, AnimatePresence } from 'framer-motion';
// import {
//   LineChart,
//   Line,
//   XAxis,
//   YAxis,
//   CartesianGrid,
//   Tooltip as RechartsTooltip,
//   Legend,
//   ResponsiveContainer,
//   AreaChart,
//   Area
// } from 'recharts';
// import { Doughnut } from 'react-chartjs-2';
// import { Chart as ChartJS, ArcElement, Tooltip as ChartTooltip, Legend as ChartLegend } from 'chart.js';
// import CommonServices from '../CommonServices';
// import { systemInfo } from '../ApiServices';
// import { toast } from '../Toast';

// ChartJS.register(ArcElement, ChartTooltip, ChartLegend);

// const SystemInfo = () => {
//   const theme = useTheme();
//   const [systemData, setSystemData] = useState({});
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState(null);
//   const [lastUpdate, setLastUpdate] = useState(null);
//   const [refreshInterval] = useState(10000); // 10 seconds
//   const [autoRefresh, setAutoRefresh] = useState(true);
//   const [historicalData, setHistoricalData] = useState([]);
//   const [dataStructure, setDataStructure] = useState('windows'); // 'windows' or 'linux'

//   // Color scheme
//   const colors = {
//     primary: '#1976d2',
//     success: '#00b894',
//     warning: '#ffaa00',
//     error: '#ff4444',
//     info: '#0984e3',
//     purple: '#6c5ce7',
//     pink: '#fd79a8',
//     cyan: '#00cec9',
//     orange: '#e17055'
//   };

//   // Safe data access with better error handling
//   const safeGet = useCallback((obj, path, defaultValue = null) => {
//     if (!obj || typeof obj !== 'object') return defaultValue;

//     const keys = path.split('.');
//     let result = obj;

//     for (const key of keys) {
//       if (result && typeof result === 'object' && key in result) {
//         result = result[key];
//       } else {
//         return defaultValue;
//       }
//     }

//     return result !== undefined ? result : defaultValue;
//   }, []);

//   // Format bytes with proper units
//   const formatBytes = useCallback((bytes) => {
//     if (bytes === undefined || bytes === null) return { value: 0, suffix: 'B', formatted: '0 B' };

//     try {
//       const bytesNum = typeof bytes === 'number' ? bytes : parseFloat(bytes);
//       if (isNaN(bytesNum)) return { value: 0, suffix: 'B', formatted: '0 B' };

//       const result = CommonServices.bytesToReadbleFormat(bytesNum);
//       return {
//         value: result?.value || 0,
//         suffix: result?.suffix || 'B',
//         formatted: `${(result?.value || 0).toFixed(1)} ${result?.suffix || 'B'}`
//       };
//     } catch (error) {
//       return { value: 0, suffix: 'B', formatted: '0 B' };
//     }
//   }, []);

//   // Calculate percentage safely
//   const calculatePercentage = useCallback((used, total) => {
//     if (used === undefined || total === undefined) return 0;

//     const usedNum = typeof used === 'number' ? used : parseFloat(used);
//     const totalNum = typeof total === 'number' ? total : parseFloat(total);

//     if (isNaN(usedNum) || isNaN(totalNum) || totalNum === 0) return 0;

//     return (usedNum / totalNum) * 100;
//   }, []);

//   // Get color based on percentage
//   const getPercentageColor = useCallback((percentage) => {
//     if (percentage > 90) return colors.error;
//     if (percentage > 75) return colors.warning;
//     if (percentage > 50) return colors.info;
//     return colors.success;
//   }, [colors]);

//   // Get health status
//   const getHealthStatus = useCallback((score) => {
//     if (score >= 90) return { status: 'Excellent', color: colors.success, icon: <CheckCircleIcon /> };
//     if (score >= 75) return { status: 'Good', color: colors.info, icon: <CheckCircleIcon /> };
//     if (score >= 50) return { status: 'Fair', color: colors.warning, icon: <WarningIcon /> };
//     return { status: 'Poor', color: colors.error, icon: <ErrorIcon /> };
//   }, [colors]);

//   // Format uptime from Windows data
//   const formatUptime = useCallback((uptimeStr) => {
//     if (!uptimeStr) return 'Unknown';

//     try {
//       // Try to parse different formats
//       if (uptimeStr.includes(':')) {
//         // Format: "00:04:42"
//         const [hours, minutes, seconds] = uptimeStr.split(':').map(Number);
//         return `${hours}h ${minutes}m ${seconds}s`;
//       }

//       // Check if it's an object (from Windows PS output)
//       if (typeof uptimeStr === 'object') {
//         const uptime = uptimeStr;
//         if (uptime.Days !== undefined) {
//           return `${uptime.Days}d ${uptime.Hours}h ${uptime.Minutes}m`;
//         }
//       }

//       return uptimeStr.toString();
//     } catch (error) {
//       return 'Unknown';
//     }
//   }, []);

//   // Fetch system info
//   const fetchSystemInfo = useCallback(async () => {
//     try {
//       setLoading(true);
//       const infoRes = await systemInfo();

//       if (infoRes?.httpStatusCode === 200 && infoRes.data) {
//         const data = infoRes.data;
//         //console.log('System Data:', data);

//         // Detect data structure
//         if (data.cpu && data.cpu.name && data.cpu.cores) {
//           setDataStructure('windows');
//         } else if (data.cpu && (data.cpu.usage || data.cpu.cores)) {
//           setDataStructure('linux');
//         }

//         setSystemData(data);
//         setError(null);
//         setLastUpdate(new Date());

//         // Add to historical data
//         const now = new Date();
//         const cpuLoad = getCpuLoad(data);
//         const memoryPercentage = getMemoryPercentage(data);

//         setHistoricalData(prev => {
//           const newPoint = {
//             timestamp: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
//             time: now.getTime(),
//             cpu: cpuLoad,
//             memory: memoryPercentage,
//             disk: getDiskPercentage(data)
//           };

//           const newData = [...prev, newPoint];
//           // Keep last 20 entries, remove oldest if needed
//           return newData.slice(-20);
//         });

//       } else {
//         throw new Error(infoRes?.message || 'Failed to fetch system information');
//       }
//     } catch (err) {
//       console.error('Error fetching system info:', err);
//       setError(err.message);
//       toast.error(err.message);
//     } finally {
//       setLoading(false);
//     }
//   }, []);

//   // Helper functions to extract data
//   const getCpuLoad = useCallback((data) => {
//     if (dataStructure === 'windows') {
//       // Windows - check various possible locations
//       return safeGet(data, 'cpu.Load',
//         safeGet(data, 'cpu.usage',
//           safeGet(data, 'cpu.usagePercentage', 0)));
//     } else {
//       // Linux/Raspberry Pi
//       return safeGet(data, 'cpu.usage.percentage',
//         safeGet(data, 'cpu.load', 0));
//     }
//   }, [dataStructure, safeGet]);

//   const getMemoryPercentage = useCallback((data) => {
//     if (dataStructure === 'windows') {
//       const memory = safeGet(data, 'memory', {});
//       const total = memory.total || 1;
//       const used = memory.used || (memory.total - memory.free) || 0;
//       return calculatePercentage(used, total);
//     } else {
//       const memory = safeGet(data, 'memory', {});
//       const total = memory.total || 1;
//       const used = memory.used || 0;
//       return calculatePercentage(used, total);
//     }
//   }, [dataStructure, safeGet, calculatePercentage]);

//   const getDiskPercentage = useCallback((data) => {
//     const disks = safeGet(data, 'disks', []);
//     if (!disks.length) return 0;

//     const total = disks.reduce((sum, disk) => sum + (parseFloat(disk.total) || 0), 0);
//     const used = disks.reduce((sum, disk) => sum + (parseFloat(disk.used) || 0), 0);

//     return calculatePercentage(used, total);
//   }, [safeGet, calculatePercentage]);

//   // Auto refresh effect
//   useEffect(() => {
//     fetchSystemInfo();

//     if (autoRefresh) {
//       const interval = setInterval(fetchSystemInfo, refreshInterval);
//       return () => clearInterval(interval);
//     }
//   }, [fetchSystemInfo, autoRefresh, refreshInterval]);

//   // Memoized data
//   const cpuInfo = useMemo(() => safeGet(systemData, 'cpu', {}), [systemData, safeGet]);
//   const memoryInfo = useMemo(() => safeGet(systemData, 'memory', {}), [systemData, safeGet]);
//   const diskInfo = useMemo(() => safeGet(systemData, 'disks', []), [systemData, safeGet]);
//   const networkInfo = useMemo(() => safeGet(systemData, 'network', {}), [systemData, safeGet]);
//   const osInfo = useMemo(() => safeGet(systemData, 'os', {}), [systemData, safeGet]);
//   const jvmInfo = useMemo(() => safeGet(systemData, 'jvm', {}), [systemData, safeGet]);
//   const commonInfo = useMemo(() => safeGet(systemData, 'common', {}), [systemData, safeGet]);
//   const healthScore = useMemo(() => safeGet(systemData, 'healthScore', 100), [systemData, safeGet]);
//   const timestamp = useMemo(() => safeGet(systemData, 'timestamp', ''), [systemData, safeGet]);

//   // CPU calculations
//   const cpuLoad = useMemo(() => getCpuLoad(systemData), [systemData, getCpuLoad]);
//   const cpuCores = useMemo(() => safeGet(cpuInfo, 'cores', 4), [cpuInfo, safeGet]);
//   const cpuFrequency = useMemo(() => safeGet(cpuInfo, 'maxClock', 0), [cpuInfo, safeGet]);
//   const cpuName = useMemo(() => safeGet(cpuInfo, 'name', 'Unknown Processor'), [cpuInfo, safeGet]);

//   // Memory calculations
//   const memoryUsed = useMemo(() => {
//     if (dataStructure === 'windows') {
//       return memoryInfo.used || (memoryInfo.total - memoryInfo.free) || 0;
//     }
//     return memoryInfo.used || 0;
//   }, [memoryInfo, dataStructure]);

//   const memoryTotal = useMemo(() => memoryInfo.total || 1, [memoryInfo]);
//   const memoryFree = useMemo(() => memoryInfo.free || 0, [memoryInfo]);
//   const memoryPercentage = useMemo(() =>
//     calculatePercentage(memoryUsed, memoryTotal),
//     [memoryUsed, memoryTotal, calculatePercentage]
//   );

//   // OS Info
//   const osName = useMemo(() => osInfo.name || 'Unknown OS', [osInfo]);
//   const osVersion = useMemo(() => osInfo.version || '', [osInfo]);
//   const osArch = useMemo(() => osInfo.arch || '', [osInfo]);
//   const uptime = useMemo(() => safeGet(systemData, 'uptime', ''), [systemData, safeGet]);

//   // JVM Info
//   const jvmName = useMemo(() => safeGet(jvmInfo, 'name', ''), [jvmInfo, safeGet]);
//   const jvmVersion = useMemo(() => safeGet(jvmInfo, 'version', ''), [jvmInfo, safeGet]);
//   const jvmVendor = useMemo(() => safeGet(jvmInfo, 'vendor', ''), [jvmInfo, safeGet]);

//   // Create doughnut chart data
//   const createDoughnutData = useCallback((used, total, label) => {
//     const usedBytes = formatBytes(used);
//     const totalBytes = formatBytes(total);
//     const percentage = calculatePercentage(used, total);
//     const free = total - used;
//     const freeBytes = formatBytes(free);

//     return {
//       labels: ['Used', 'Free'],
//       datasets: [{
//         label: label,
//         data: [usedBytes.value, freeBytes.value],
//         backgroundColor: [
//           getPercentageColor(percentage),
//           alpha(theme.palette.text.secondary, 0.1)
//         ],
//         borderColor: ['transparent', 'transparent'],
//         borderWidth: 0,
//         hoverOffset: 15,
//         borderRadius: 10,
//         spacing: 2
//       }]
//     };
//   }, [formatBytes, calculatePercentage, getPercentageColor, theme, alpha]);

//   // Chart options
//   const doughnutOptions = {
//     responsive: true,
//     maintainAspectRatio: false,
//     plugins: {
//       legend: {
//         position: 'bottom',
//         labels: {
//           usePointStyle: true,
//           padding: 20,
//           font: {
//             size: 11
//           },
//           color: theme.palette.text.primary
//         }
//       },
//       tooltip: {
//         callbacks: {
//           label: function (context) {
//             const label = context.label || '';
//             const value = context.parsed || 0;
//             const total = context.dataset.data.reduce((a, b) => a + b, 0);
//             const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
//             return `${label}: ${value.toFixed(1)} (${percentage}%)`;
//           }
//         },
//         backgroundColor: theme.palette.background.paper,
//         titleColor: theme.palette.text.primary,
//         bodyColor: theme.palette.text.secondary,
//         borderColor: alpha(theme.palette.divider, 0.5),
//         borderWidth: 1
//       }
//     },
//     cutout: '75%'
//   };

//   // Historical chart data
//   const historicalChartData = useMemo(() =>
//     historicalData.map(point => ({
//       name: point.timestamp,
//       cpu: point.cpu || 0,
//       memory: point.memory || 0,
//       disk: point.disk || 0
//     })),
//     [historicalData]
//   );

//   if (loading && !lastUpdate) {
//     return (
//       <Container maxWidth="xl" sx={{ py: 8 }}>
//         <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" minHeight="60vh">
//           <motion.div
//             animate={{ rotate: 360 }}
//             transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
//           >
//             <CircularProgress size={80} thickness={4} sx={{ color: colors.primary }} />
//           </motion.div>
//           <motion.div
//             initial={{ opacity: 0 }}
//             animate={{ opacity: 1 }}
//             transition={{ delay: 0.5 }}
//           >
//             <Typography variant="h6" color="text.secondary" sx={{ mt: 3 }}>
//               Initializing System Dashboard...
//             </Typography>
//           </motion.div>
//         </Box>
//       </Container>
//     );
//   }

//   return (
//     <Container maxWidth="xl" sx={{ py: 3 }}>
//       {/* Header */}
//       <motion.div
//         initial={{ opacity: 0, y: -16 }}
//         animate={{ opacity: 1, y: 0 }}
//         transition={{ duration: 0.45, ease: 'easeOut' }}
//       >
//         <Stack spacing={2}>
//           {/* Row 1: Status + Controls */}
//           <Stack
//             direction="row"
//             alignItems="center"
//             justifyContent="space-between"
//             flexWrap="wrap"
//             gap={2}
//           >
//             <Typography variant="caption" color="text.secondary">
//               • Last updated:{' '}
//               {lastUpdate ? lastUpdate.toLocaleTimeString() : 'Never'}
//             </Typography>

//             <Stack direction="row" alignItems="center" gap={1.5}>
//               <Tooltip title={`Auto Refresh ${autoRefresh ? 'ON' : 'OFF'}`}>
//                 <Chip
//                   label={
//                     autoRefresh
//                       ? `Auto (${refreshInterval / 1000}s)`
//                       : 'Manual'
//                   }
//                   onClick={() => setAutoRefresh(prev => !prev)}
//                   color={autoRefresh ? 'primary' : 'default'}
//                   variant={autoRefresh ? 'filled' : 'outlined'}
//                   icon={autoRefresh ? <CheckCircleIcon /> : <Refresh />}
//                   sx={{
//                     cursor: 'pointer',
//                     userSelect: 'none',
//                     fontWeight: 500,
//                   }}
//                 />
//               </Tooltip>

//               <Tooltip title="Refresh Now">
//                 <motion.div whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}>
//                   <IconButton
//                     onClick={fetchSystemInfo}
//                     disabled={loading}
//                     size="small"
//                     sx={{
//                       background: `linear-gradient(45deg, ${colors.warning}, ${colors.info})`,
//                       color: '#fff',
//                       boxShadow: 2,
//                       '&:hover': {
//                         background: `linear-gradient(45deg, ${colors.info}, ${colors.warning})`,
//                       },
//                     }}
//                   >
//                     <Refresh fontSize="small" />
//                   </IconButton>
//                 </motion.div>
//               </Tooltip>
//             </Stack>
//           </Stack>

//           {/* Row 2: OS Info */}
//           <Stack
//             direction="row"
//             alignItems="center"
//             flexWrap="wrap"
//             gap={1.2}
//           >
//             <Chip
//               label={osName}
//               size="small"
//               color="primary"
//               variant="outlined"
//               icon={<Computer fontSize="small" />}
//             />
//             {osVersion && (
//               <Chip label={`v${osVersion}`} size="small" />
//             )}
//             {osArch && (
//               <Chip label={osArch} size="small" />
//             )}
//           </Stack>
//         </Stack>
//       </motion.div>

//       {/* Health Score Banner */}
//       {healthScore !== 100 && (
//         <motion.div
//           initial={{ opacity: 0, scale: 0.9 }}
//           animate={{ opacity: 1, scale: 1 }}
//           transition={{ delay: 0.1 }}
//         >
//           <Card sx={{ mb: 3, background: `linear-gradient(135deg, ${getHealthStatus(healthScore).color}, ${alpha(getHealthStatus(healthScore).color, 0.7)})` }}>
//             <CardContent sx={{ p: 2 }}>
//               <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
//                 <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
//                   {getHealthStatus(healthScore).icon}
//                   <Typography variant="h6" sx={{ color: 'white' }}>
//                     System Health: {getHealthStatus(healthScore).status}
//                   </Typography>
//                 </Box>
//                 <Typography variant="h4" sx={{ color: 'white', fontWeight: 'bold' }}>
//                   {healthScore}/100
//                 </Typography>
//               </Box>
//             </CardContent>
//           </Card>
//         </motion.div>
//       )}

//       {/* System Overview Cards */}
//       <Grid container spacing={3}>
//         {/* CPU Card */}
//         <Grid item xs={12} md={6} lg={4}>
//           <motion.div
//             initial={{ opacity: 0, y: 20 }}
//             animate={{ opacity: 1, y: 0 }}
//             transition={{ delay: 0.1 }}
//           >
//             <Card sx={{ height: '100%', borderRadius: 3 }}>
//               <CardContent sx={{ p: 3 }}>
//                 <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
//                   <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
//                     <Avatar sx={{
//                       background: `linear-gradient(135deg, ${colors.primary}, ${colors.info})`,
//                       color: 'white'
//                     }}>
//                       <ComputerTwoTone />
//                     </Avatar>
//                     <Box>
//                       <Typography variant="h6" fontWeight="bold">CPU</Typography>
//                       <Tooltip title={cpuName}>
//                         <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 150, display: 'block' }}>
//                           {cpuName.length > 30 ? cpuName.substring(0, 30) + '...' : cpuName}
//                         </Typography>
//                       </Tooltip>
//                     </Box>
//                   </Box>
//                   <Chip
//                     label={`${cpuLoad.toFixed(1)}%`}
//                     color={cpuLoad > 80 ? "error" : cpuLoad > 60 ? "warning" : "success"}
//                     size="small"
//                   />
//                 </Box>

//                 <Box sx={{ textAlign: 'center', mb: 3 }}>
//                   <Typography variant="h2" component="div" sx={{
//                     color: getPercentageColor(cpuLoad),
//                     fontWeight: 'bold',
//                     mb: 1
//                   }}>
//                     {cpuLoad.toFixed(1)}%
//                   </Typography>
//                   <Typography variant="body2" color="text.secondary">
//                     Current Load
//                   </Typography>
//                 </Box>

//                 <Box sx={{ mb: 3 }}>
//                   <LinearProgress
//                     variant="determinate"
//                     value={cpuLoad}
//                     sx={{
//                       height: 12,
//                       borderRadius: 6,
//                       backgroundColor: alpha(theme.palette.text.secondary, 0.1),
//                       '& .MuiLinearProgress-bar': {
//                         background: `linear-gradient(90deg, ${getPercentageColor(cpuLoad)}, ${alpha(getPercentageColor(cpuLoad), 0.7)})`,
//                         borderRadius: 6
//                       }
//                     }}
//                   />
//                 </Box>

//                 <Grid container spacing={2}>
//                   <Grid item xs={6}>
//                     <Paper sx={{ p: 2, textAlign: 'center', borderRadius: 2 }}>
//                       <Typography variant="caption" color="text.secondary">Cores</Typography>
//                       <Typography variant="h6" fontWeight="bold">
//                         {cpuCores}
//                       </Typography>
//                     </Paper>
//                   </Grid>
//                   <Grid item xs={6}>
//                     <Paper sx={{ p: 2, textAlign: 'center', borderRadius: 2 }}>
//                       <Typography variant="caption" color="text.secondary">Clock</Typography>
//                       <Typography variant="h6" fontWeight="bold">
//                         {cpuFrequency} MHz
//                       </Typography>
//                     </Paper>
//                   </Grid>
//                 </Grid>
//               </CardContent>
//             </Card>
//           </motion.div>
//         </Grid>

//         {/* Memory Card */}
//         <Grid item xs={12} md={6} lg={4}>
//           <motion.div
//             initial={{ opacity: 0, y: 20 }}
//             animate={{ opacity: 1, y: 0 }}
//             transition={{ delay: 0.2 }}
//           >
//             <Card sx={{ height: '100%', borderRadius: 3 }}>
//               <CardContent sx={{ p: 3 }}>
//                 <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
//                   <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
//                     <Avatar sx={{
//                       background: `linear-gradient(135deg, ${colors.success}, ${colors.cyan})`,
//                       color: 'white'
//                     }}>
//                       <Memory />
//                     </Avatar>
//                     <Box>
//                       <Typography variant="h6" fontWeight="bold">Memory</Typography>
//                       <Typography variant="caption" color="text.secondary">
//                         RAM Usage
//                       </Typography>
//                     </Box>
//                   </Box>
//                   <Chip
//                     label={`${memoryPercentage.toFixed(1)}%`}
//                     color={memoryPercentage > 90 ? "error" : memoryPercentage > 75 ? "warning" : "success"}
//                     size="small"
//                   />
//                 </Box>

//                 <Box sx={{ height: 200, mb: 3 }}>
//                   <Doughnut
//                     data={createDoughnutData(memoryUsed, memoryTotal, "Memory")}
//                     options={doughnutOptions}
//                   />
//                 </Box>

//                 <Grid container spacing={1}>
//                   <Grid item xs={4}>
//                     <Paper sx={{ p: 1.5, textAlign: 'center', borderRadius: 2 }}>
//                       <Typography variant="caption" color="text.secondary">Total</Typography>
//                       <Typography variant="body2" fontWeight="bold">
//                         {formatBytes(memoryTotal).formatted}
//                       </Typography>
//                     </Paper>
//                   </Grid>
//                   <Grid item xs={4}>
//                     <Paper sx={{ p: 1.5, textAlign: 'center', borderRadius: 2 }}>
//                       <Typography variant="caption" color="text.secondary">Used</Typography>
//                       <Typography variant="body2" fontWeight="bold" color={getPercentageColor(memoryPercentage)}>
//                         {formatBytes(memoryUsed).formatted}
//                       </Typography>
//                     </Paper>
//                   </Grid>
//                   <Grid item xs={4}>
//                     <Paper sx={{ p: 1.5, textAlign: 'center', borderRadius: 2 }}>
//                       <Typography variant="caption" color="text.secondary">Free</Typography>
//                       <Typography variant="body2" fontWeight="bold">
//                         {formatBytes(memoryFree).formatted}
//                       </Typography>
//                     </Paper>
//                   </Grid>
//                 </Grid>
//               </CardContent>
//             </Card>
//           </motion.div>
//         </Grid>

//         {/* System Info Card */}
//         <Grid item xs={12} md={6} lg={4}>
//           <motion.div
//             initial={{ opacity: 0, y: 20 }}
//             animate={{ opacity: 1, y: 0 }}
//             transition={{ delay: 0.3 }}
//           >
//             <Card sx={{ height: '100%', borderRadius: 3 }}>
//               <CardContent sx={{ p: 3 }}>
//                 <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
//                   <Computer sx={{ color: colors.primary, fontSize: 40 }} />
//                   <Box>
//                     <Typography variant="h6" fontWeight="bold">System Information</Typography>
//                     <Typography variant="caption" color="text.secondary">
//                       {osName}
//                     </Typography>
//                   </Box>
//                 </Box>

//                 <List dense>
//                   <ListItem sx={{ px: 0 }}>
//                     <ListItemIcon>
//                       <Computer fontSize="small" />
//                     </ListItemIcon>
//                     <ListItemText
//                       primary="OS"
//                       secondary={osName}
//                     />
//                   </ListItem>
//                   <ListItem sx={{ px: 0 }}>
//                     <ListItemIcon>
//                       <Speed fontSize="small" />
//                     </ListItemIcon>
//                     <ListItemText
//                       primary="Version"
//                       secondary={`${osVersion} (${osArch})`}
//                     />
//                   </ListItem>
//                   <ListItem sx={{ px: 0 }}>
//                     <ListItemIcon>
//                       <BatteryFull fontSize="small" />
//                     </ListItemIcon>
//                     <ListItemText
//                       primary="Uptime"
//                       secondary={formatUptime(uptime)}
//                     />
//                   </ListItem>
//                   <Divider sx={{ my: 1 }} />
//                   <ListItem sx={{ px: 0 }}>
//                     <ListItemIcon>
//                       <Devices fontSize="small" />
//                     </ListItemIcon>
//                     <ListItemText
//                       primary="JVM"
//                       secondary={`${jvmName} ${jvmVersion}`}
//                     />
//                   </ListItem>
//                   <ListItem sx={{ px: 0 }}>
//                     <ListItemIcon>
//                       <AccountTree fontSize="small" />
//                     </ListItemIcon>
//                     <ListItemText
//                       primary="Vendor"
//                       secondary={jvmVendor}
//                     />
//                   </ListItem>
//                 </List>
//               </CardContent>
//             </Card>
//           </motion.div>
//         </Grid>

//         {/* Disk Information */}
//         {diskInfo && diskInfo.length > 0 && (
//           <Grid item xs={12}>
//             <motion.div
//               initial={{ opacity: 0, y: 20 }}
//               animate={{ opacity: 1, y: 0 }}
//               transition={{ delay: 0.4 }}
//             >
//               <Card sx={{ borderRadius: 3 }}>
//                 <CardContent sx={{ p: 3 }}>
//                   <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
//                     <DriveEta sx={{ color: colors.warning, fontSize: 32 }} />
//                     <Typography variant="h6" fontWeight="bold">Storage Drives</Typography>
//                     <Chip
//                       label={`${diskInfo.length} drives`}
//                       size="small"
//                       variant="outlined"
//                     />
//                   </Box>

//                   <Grid container spacing={3}>
//                     {diskInfo.map((disk, index) => {
//                       const diskUsed = parseFloat(disk.used) || parseFloat(disk.Used) || 0;
//                       const diskTotal = parseFloat(disk.total) || parseFloat(disk.Total) || 1;
//                       const diskFree = parseFloat(disk.free) || parseFloat(disk.Free) || (diskTotal - diskUsed);
//                       const diskPercentage = calculatePercentage(diskUsed, diskTotal);

//                       return (
//                         <Grid item xs={12} md={6} lg={4} key={index}>
//                           <Card variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
//                             <CardContent sx={{ flex: 1 }}>
//                               <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
//                                 <Typography variant="h6" component="h3" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
//                                   <Storage fontSize="small" />
//                                   {disk.name || disk.Name || `Drive ${index + 1}`}
//                                 </Typography>
//                                 <Chip
//                                   label={`${diskPercentage.toFixed(1)}%`}
//                                   size="small"
//                                   color={
//                                     diskPercentage > 90 ? "error" :
//                                       diskPercentage > 75 ? "warning" : "success"
//                                   }
//                                 />
//                               </Box>

//                               <Box sx={{ height: 120, mb: 2 }}>
//                                 <Doughnut
//                                   data={createDoughnutData(diskUsed, diskTotal, disk.name || `Drive ${index + 1}`)}
//                                   options={doughnutOptions}
//                                 />
//                               </Box>

//                               <Box sx={{ mb: 2 }}>
//                                 <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
//                                   <Typography variant="caption" color="text.secondary">Usage</Typography>
//                                   <Typography variant="caption" fontWeight="bold" color={getPercentageColor(diskPercentage)}>
//                                     {diskPercentage.toFixed(1)}%
//                                   </Typography>
//                                 </Box>
//                                 <LinearProgress
//                                   variant="determinate"
//                                   value={diskPercentage}
//                                   sx={{
//                                     height: 6,
//                                     borderRadius: 3,
//                                     backgroundColor: alpha(theme.palette.text.secondary, 0.1),
//                                     '& .MuiLinearProgress-bar': {
//                                       background: `linear-gradient(90deg, ${getPercentageColor(diskPercentage)}, ${alpha(getPercentageColor(diskPercentage), 0.7)})`,
//                                       borderRadius: 3
//                                     }
//                                   }}
//                                 />
//                               </Box>

//                               <Grid container spacing={1}>
//                                 <Grid item xs={6}>
//                                   <Paper sx={{ p: 1, textAlign: 'center', borderRadius: 2 }}>
//                                     <Typography variant="caption" color="text.secondary">Used</Typography>
//                                     <Typography variant="body2" fontWeight="bold">
//                                       {formatBytes(diskUsed).formatted}
//                                     </Typography>
//                                   </Paper>
//                                 </Grid>
//                                 <Grid item xs={6}>
//                                   <Paper sx={{ p: 1, textAlign: 'center', borderRadius: 2 }}>
//                                     <Typography variant="caption" color="text.secondary">Free</Typography>
//                                     <Typography variant="body2" fontWeight="bold">
//                                       {formatBytes(diskFree).formatted}
//                                     </Typography>
//                                   </Paper>
//                                 </Grid>
//                                 <Grid item xs={12}>
//                                   <Paper sx={{ p: 1, textAlign: 'center', borderRadius: 2, mt: 1 }}>
//                                     <Typography variant="caption" color="text.secondary">Total</Typography>
//                                     <Typography variant="body2" fontWeight="bold">
//                                       {formatBytes(diskTotal).formatted}
//                                     </Typography>
//                                   </Paper>
//                                 </Grid>
//                               </Grid>
//                             </CardContent>
//                           </Card>
//                         </Grid>
//                       );
//                     })}
//                   </Grid>
//                 </CardContent>
//               </Card>
//             </motion.div>
//           </Grid>
//         )}

//         {/* Performance Trends */}
//         {historicalChartData.length > 0 && (
//           <Grid item xs={12}>
//             <motion.div
//               initial={{ opacity: 0, y: 20 }}
//               animate={{ opacity: 1, y: 0 }}
//               transition={{ delay: 0.5 }}
//             >
//               <Card sx={{ borderRadius: 3 }}>
//                 <CardContent sx={{ p: 3 }}>
//                   <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
//                     <Timeline sx={{ color: colors.primary }} />
//                     <Typography variant="h6" fontWeight="bold">Performance Trends</Typography>
//                   </Box>

//                   <Box sx={{ height: 300 }}>
//                     <ResponsiveContainer width="100%" height="100%">
//                       <AreaChart data={historicalChartData}>
//                         <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.text.secondary, 0.1)} />
//                         <XAxis
//                           dataKey="name"
//                           stroke={theme.palette.text.secondary}
//                           tick={{ fontSize: 12 }}
//                         />
//                         <YAxis
//                           stroke={theme.palette.text.secondary}
//                           tick={{ fontSize: 12 }}
//                           domain={[0, 100]}
//                         />
//                         <RechartsTooltip
//                           contentStyle={{
//                             borderRadius: 8,
//                             border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
//                             background: theme.palette.background.paper,
//                             color: theme.palette.text.primary
//                           }}
//                           formatter={(value) => [`${value.toFixed(1)}%`, '']}
//                         />
//                         <Legend />
//                         <Area
//                           type="monotone"
//                           dataKey="cpu"
//                           name="CPU %"
//                           stroke={colors.primary}
//                           fill={alpha(colors.primary, 0.1)}
//                           strokeWidth={2}
//                           dot={{ stroke: colors.primary, strokeWidth: 2, r: 3 }}
//                           activeDot={{ r: 6 }}
//                         />
//                         <Area
//                           type="monotone"
//                           dataKey="memory"
//                           name="Memory %"
//                           stroke={colors.success}
//                           fill={alpha(colors.success, 0.1)}
//                           strokeWidth={2}
//                           dot={{ stroke: colors.success, strokeWidth: 2, r: 3 }}
//                           activeDot={{ r: 6 }}
//                         />
//                       </AreaChart>
//                     </ResponsiveContainer>
//                   </Box>
//                 </CardContent>
//               </Card>
//             </motion.div>
//           </Grid>
//         )}

//         {/* Network Interfaces */}
//         {networkInfo && networkInfo.interfaces && networkInfo.interfaces.length > 0 && (
//           <Grid item xs={12}>
//             <motion.div
//               initial={{ opacity: 0, y: 20 }}
//               animate={{ opacity: 1, y: 0 }}
//               transition={{ delay: 0.6 }}
//             >
//               <Card sx={{ borderRadius: 3 }}>
//                 <CardContent sx={{ p: 3 }}>
//                   <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
//                     <NetworkWifi sx={{ color: colors.info }} />
//                     <Typography variant="h6" fontWeight="bold">Network Interfaces</Typography>
//                     <Chip
//                       label={`${networkInfo.interfaces.length} interfaces`}
//                       size="small"
//                       variant="outlined"
//                     />
//                   </Box>

//                   <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 400 }}>
//                     <Table stickyHeader size="small">
//                       <TableHead>
//                         <TableRow>
//                           <TableCell>Interface</TableCell>
//                           <TableCell>Display Name</TableCell>
//                           <TableCell>MAC Address</TableCell>
//                           <TableCell>IP Addresses</TableCell>
//                         </TableRow>
//                       </TableHead>
//                       <TableBody>
//                         {networkInfo.interfaces
//                           .filter(iface => iface.addresses && iface.addresses.length > 0)
//                           .map((iface, index) => (
//                             <TableRow key={index} hover>
//                               <TableCell>
//                                 <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
//                                   <NetworkWifi fontSize="small" />
//                                   <Typography variant="body2">{iface.name}</Typography>
//                                 </Box>
//                               </TableCell>
//                               <TableCell>
//                                 <Typography variant="body2" sx={{ maxWidth: 200 }} noWrap>
//                                   {iface.displayName}
//                                 </Typography>
//                               </TableCell>
//                               <TableCell>
//                                 {iface.mac ? (
//                                   <Chip
//                                     label={iface.mac}
//                                     size="small"
//                                     variant="outlined"
//                                   />
//                                 ) : (
//                                   <Typography variant="caption" color="text.secondary">
//                                     N/A
//                                   </Typography>
//                                 )}
//                               </TableCell>
//                               <TableCell>
//                                 <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
//                                   {iface.addresses.map((addr, addrIndex) => (
//                                     <Chip
//                                       key={addrIndex}
//                                       label={addr}
//                                       size="small"
//                                       variant="filled"
//                                       color={addr.startsWith('192.168') ? 'primary' : 'default'}
//                                       sx={{
//                                         fontSize: '0.7rem',
//                                         height: 20,
//                                         '& .MuiChip-label': { px: 1 }
//                                       }}
//                                     />
//                                   ))}
//                                 </Box>
//                               </TableCell>
//                             </TableRow>
//                           ))}
//                       </TableBody>
//                     </Table>
//                   </TableContainer>

//                   {networkInfo.interfaces.filter(iface => iface.addresses && iface.addresses.length > 0).length === 0 && (
//                     <Box sx={{ textAlign: 'center', py: 4 }}>
//                       <NetworkWifi sx={{ fontSize: 48, color: theme.palette.text.disabled, mb: 2 }} />
//                       <Typography color="text.secondary">
//                         No active network interfaces with IP addresses found
//                       </Typography>
//                     </Box>
//                   )}
//                 </CardContent>
//               </Card>
//             </motion.div>
//           </Grid>
//         )}
//       </Grid>

//       {/* Error State */}
//       {error && (
//         <motion.div
//           initial={{ opacity: 0, y: 20 }}
//           animate={{ opacity: 1, y: 0 }}
//         >
//           <Alert
//             severity="error"
//             sx={{ mb: 3, mt: 3 }}
//             action={
//               <Box sx={{ display: 'flex', gap: 1 }}>
//                 <Chip
//                   label="Retry"
//                   onClick={fetchSystemInfo}
//                   variant="outlined"
//                   size="small"
//                 />
//                 <Chip
//                   label="Disable Auto"
//                   onClick={() => setAutoRefresh(false)}
//                   variant="outlined"
//                   size="small"
//                 />
//               </Box>
//             }
//           >
//             <Typography variant="body1" fontWeight="bold">System Monitoring Error</Typography>
//             <Typography variant="body2">{error}</Typography>
//           </Alert>
//         </motion.div>
//       )}
//     </Container>
//   );
// };

// export default SystemInfo;