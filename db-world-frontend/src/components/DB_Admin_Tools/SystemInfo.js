import React, { useEffect, useState } from 'react';
import CommonServices from '../CommonServices';
import { systemInfo } from '../ApiServices';
import { Doughnut } from 'react-chartjs-2';
import { Chart, ArcElement, Tooltip, Legend } from 'chart.js';
import { 
  Grid, 
  Card, 
  CardContent, 
  Typography, 
  LinearProgress, 
  Box, 
  Chip,
  Table,
  TableBody,
  TableCell,
  TableRow,
  Container,
  Alert,
  CircularProgress
} from '@mui/material';
import { 
  Memory, 
  Storage, 
  Computer, 
  Architecture, 
  Speed,
  Dashboard
} from '@mui/icons-material';
import { toast } from '../Toast';

Chart.register(ArcElement, Tooltip, Legend);

const SystemInfo = () => {
  const [systemData, setSystemData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Safe percentage calculation function
  const calculatePercentage = (used, total) => {
    if (!used || !total || total === 0) return 0;
    
    const usedNum = typeof used === 'number' ? used : Number(used);
    const totalNum = typeof total === 'number' ? total : Number(total);
    
    if (isNaN(usedNum) || isNaN(totalNum) || totalNum === 0) return 0;
    
    return (usedNum / totalNum) * 100;
  };

  const createChartData = (label, data) => {
    if (!data || !data.usedSpace || !data.totalSpace) {
      return {
        labels: ['Used', 'Available'],
        datasets: [{
          label: label,
          data: [0, 100],
          backgroundColor: ['#dfe6e9', '#dfe6e9'],
          borderColor: ['#fff', '#fff'],
          borderWidth: 2,
          hoverOffset: 8,
          borderRadius: 4
        }]
      };
    }

    const usedPercentage = calculatePercentage(data.usedSpace, data.totalSpace);
    const usedValue = CommonServices.bytesToReadbleFormat(data.usedSpace)?.value || 0;
    const freeValue = CommonServices.bytesToReadbleFormat(data.freeSpace)?.value || 0;

    return {
      labels: ['Used', 'Available'],
      datasets: [{
        label: label,
        data: [usedValue, freeValue],
        backgroundColor: [
          usedPercentage > 90 ? '#ff4444' : 
          usedPercentage > 75 ? '#ffaa00' : '#00b894',
          '#dfe6e9'
        ],
        borderColor: ['#fff', '#fff'],
        borderWidth: 2,
        hoverOffset: 8,
        borderRadius: 4
      }]
    };
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          usePointStyle: true,
          padding: 15
        }
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            const value = context.parsed;
            const label = context.label;
            const total = context.dataset.data.reduce((a, b) => a + b, 0);
            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
            return `${label}: ${value} (${percentage}%)`;
          }
        }
      }
    },
    cutout: '65%'
  };

  const getCpuLoadColor = (load) => {
    const loadNum = typeof load === 'number' ? load : Number(load) || 0;
    if (loadNum > 80) return '#ff4444';
    if (loadNum > 60) return '#ffaa00';
    return '#00b894';
  };

  const getUsageColor = (used, total) => {
    const percentage = calculatePercentage(used, total);
    if (percentage > 90) return '#ff4444';
    if (percentage > 75) return '#ffaa00';
    return '#00b894';
  };

  const formatBytes = (bytes) => {
    if (!bytes && bytes !== 0) return { value: 0, suffix: 'B' };
    
    try {
      const result = CommonServices.bytesToReadbleFormat(bytes);
      return {
        value: result?.value || 0,
        suffix: result?.suffix || 'B'
      };
    } catch (error) {
      return { value: 0, suffix: 'B' };
    }
  };

  const safeCpuLoad = (cpuData) => {
    if (!cpuData || !cpuData.cpuLoad) return 0;
    const load = typeof cpuData.cpuLoad === 'number' ? cpuData.cpuLoad : Number(cpuData.cpuLoad);
    return isNaN(load) ? 0 : load * 100;
  };

  async function getSystemInfo() {
    try {
      setLoading(true);
      setError(null);
      const infoRes = await systemInfo();
      
      if (infoRes?.httpStatusCode === 200) {
        setSystemData(infoRes.data || {});
      } else {
        const errorMessage = infoRes?.message || 'Failed to fetch system information';
        setError(errorMessage);
        toast.error(errorMessage);
      }
    } catch (err) {
      const errorMessage = err?.message || 'Failed to fetch system information';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    getSystemInfo();
  }, []);

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" minHeight="50vh">
          <CircularProgress size={60} thickness={4} sx={{ mb: 3, color: '#1976d2' }} />
          <Typography variant="h6" color="text.secondary">
            Loading System Information...
          </Typography>
        </Box>
      </Container>
    );
  }

  if (error || !systemData) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert 
          severity="error" 
          sx={{ mb: 3 }}
          action={
            <Chip 
              label="Retry" 
              onClick={getSystemInfo} 
              variant="outlined"
              size="small"
            />
          }
        >
          {error || 'No system data available'}
        </Alert>
      </Container>
    );
  }

  const { ram, rom, cpu, name, arch } = systemData;

  // Safe data checks
  const safeRam = ram || {};
  const safeRom = Array.isArray(rom) ? rom : [];
  const safeCpu = cpu || {};
  const safeName = name || 'Unknown System';
  const safeArch = arch || 'Unknown Architecture';

  const cpuLoadValue = safeCpuLoad(safeCpu);

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom sx={{ 
          fontWeight: 'bold',
          background: 'linear-gradient(45deg, #1976d2, #00b894)',
          backgroundClip: 'text',
          WebkitBackgroundClip: 'text',
          color: 'transparent'
        }}>
          System Dashboard
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          Real-time system resource monitoring and analysis
        </Typography>
      </Box>

      <Grid container spacing={3}>
        
        {/* System Overview Card */}
        <Grid item xs={12} md={6} lg={4}>
          <Card sx={{ 
            height: '100%',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white'
          }}>
            <CardContent sx={{ p: 3 }}>
              <Box display="flex" alignItems="center" mb={2}>
                <Dashboard sx={{ mr: 2, fontSize: 32 }} />
                <Typography variant="h5" component="h2">
                  System Overview
                </Typography>
              </Box>
              
              <Table size="small">
                <TableBody>
                  <TableRow>
                    <TableCell sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.2)' }}>
                      <Box display="flex" alignItems="center">
                        <Computer sx={{ mr: 1, fontSize: 20 }} />
                        Operating System
                      </Box>
                    </TableCell>
                    <TableCell sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.2)' }}>
                      <Chip label={safeName} size="small" sx={{ background: 'rgba(255,255,255,0.2)' }} />
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.2)' }}>
                      <Box display="flex" alignItems="center">
                        <Architecture sx={{ mr: 1, fontSize: 20 }} />
                        Architecture
                      </Box>
                    </TableCell>
                    <TableCell sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.2)' }}>
                      <Chip label={safeArch} size="small" sx={{ background: 'rgba(255,255,255,0.2)' }} />
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.2)' }}>
                      <Box display="flex" alignItems="center">
                        <Speed sx={{ mr: 1, fontSize: 20 }} />
                        Processors
                      </Box>
                    </TableCell>
                    <TableCell sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.2)' }}>
                      <Chip 
                        label={safeCpu.availableProcessors || 'Unknown'} 
                        size="small" 
                        sx={{ background: 'rgba(255,255,255,0.2)' }} 
                      />
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Grid>

        {/* CPU Usage Card */}
        <Grid item xs={12} md={6} lg={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              <Box display="flex" alignItems="center" mb={3}>
                <Speed sx={{ mr: 2, color: 'primary.main', fontSize: 32 }} />
                <Typography variant="h5" component="h2">
                  CPU Usage
                </Typography>
              </Box>
              
              <Box textAlign="center" mb={3}>
                <Typography variant="h2" component="div" sx={{ 
                  color: getCpuLoadColor(cpuLoadValue),
                  fontWeight: 'bold',
                  mb: 1
                }}>
                  {cpuLoadValue.toFixed(1)}%
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Current Load
                </Typography>
              </Box>

              <LinearProgress 
                variant="determinate" 
                value={cpuLoadValue} 
                sx={{ 
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: '#f0f0f0',
                  '& .MuiLinearProgress-bar': {
                    backgroundColor: getCpuLoadColor(cpuLoadValue),
                    borderRadius: 4
                  }
                }}
              />
              
              <Box display="flex" justifyContent="space-between" mt={1}>
                <Typography variant="caption" color="text.secondary">
                  0%
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  100%
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* RAM Usage Card */}
        <Grid item xs={12} md={6} lg={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              <Box display="flex" alignItems="center" mb={2}>
                <Memory sx={{ mr: 2, color: 'primary.main', fontSize: 32 }} />
                <Typography variant="h5" component="h2">
                  Memory Usage
                </Typography>
              </Box>
              
              <Box sx={{ height: 200, mb: 2 }}>
                <Doughnut data={createChartData("RAM", safeRam)} options={chartOptions} />
              </Box>
              
              <Table size="small">
                <TableBody>
                  <TableRow>
                    <TableCell>Total</TableCell>
                    <TableCell align="right">
                      {formatBytes(safeRam.totalSpace).value} {formatBytes(safeRam.totalSpace).suffix}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Used</TableCell>
                    <TableCell align="right" sx={{ 
                      color: getUsageColor(safeRam.usedSpace, safeRam.totalSpace),
                      fontWeight: 'bold'
                    }}>
                      {formatBytes(safeRam.usedSpace).value} {formatBytes(safeRam.usedSpace).suffix}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Available</TableCell>
                    <TableCell align="right">
                      {formatBytes(safeRam.freeSpace).value} {formatBytes(safeRam.freeSpace).suffix}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Grid>

        {/* Storage Drives */}
        <Grid item xs={12}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Box display="flex" alignItems="center" mb={3}>
                <Storage sx={{ mr: 2, color: 'primary.main', fontSize: 32 }} />
                <Typography variant="h5" component="h2">
                  Storage Drives
                </Typography>
              </Box>
              
              {safeRom.length === 0 ? (
                <Alert severity="info">
                  No storage drives information available.
                </Alert>
              ) : (
                <Grid container spacing={3}>
                  {safeRom.map((drive, index) => {
                    const usedPercentage = calculatePercentage(drive.usedSpace, drive.totalSpace);
                    const percentageNumber = typeof usedPercentage === 'number' ? usedPercentage : 0;
                    
                    return (
                      <Grid item xs={12} md={6} lg={4} key={drive.name || index}>
                        <Card variant="outlined" sx={{ height: '100%' }}>
                          <CardContent>
                            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                              <Typography variant="h6" component="h3">
                                Drive {drive.name || 'Unknown'}
                              </Typography>
                              <Chip 
                                label={`${percentageNumber.toFixed(1)}%`}
                                size="small"
                                color={
                                  percentageNumber > 90 ? 'error' : 
                                  percentageNumber > 75 ? 'warning' : 'success'
                                }
                              />
                            </Box>
                            
                            <Box sx={{ height: 120, mb: 2 }}>
                              <Doughnut 
                                data={createChartData(`Drive ${drive.name}`, drive)} 
                                options={chartOptions} 
                              />
                            </Box>
                            
                            <Table size="small">
                              <TableBody>
                                <TableRow>
                                  <TableCell>Total</TableCell>
                                  <TableCell align="right">
                                    {formatBytes(drive.totalSpace).value} {formatBytes(drive.totalSpace).suffix}
                                  </TableCell>
                                </TableRow>
                                <TableRow>
                                  <TableCell>Used</TableCell>
                                  <TableCell align="right" sx={{ 
                                    color: getUsageColor(drive.usedSpace, drive.totalSpace),
                                    fontWeight: 'bold'
                                  }}>
                                    {formatBytes(drive.usedSpace).value} {formatBytes(drive.usedSpace).suffix}
                                  </TableCell>
                                </TableRow>
                                <TableRow>
                                  <TableCell>Free</TableCell>
                                  <TableCell align="right">
                                    {formatBytes(drive.freeSpace).value} {formatBytes(drive.freeSpace).suffix}
                                  </TableCell>
                                </TableRow>
                              </TableBody>
                            </Table>
                            
                            <LinearProgress 
                              variant="determinate" 
                              value={percentageNumber}
                              sx={{ 
                                mt: 2,
                                height: 6,
                                borderRadius: 3,
                                backgroundColor: '#f0f0f0',
                                '& .MuiLinearProgress-bar': {
                                  backgroundColor: getUsageColor(drive.usedSpace, drive.totalSpace),
                                  borderRadius: 3
                                }
                              }}
                            />
                          </CardContent>
                        </Card>
                      </Grid>
                    );
                  })}
                </Grid>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );
};

export default SystemInfo;