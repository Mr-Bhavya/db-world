// src/components/ServerInfo/ServerInfo.js
import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  CircularProgress,
  LinearProgress,
  Alert,
  Button,
  Typography,
  Paper
} from '@mui/material';
import { styled } from '@mui/material/styles';
import axiosInstance from '../../Utils/AxiosInstants';

// OS-specific components
import WindowsServerInfoDashboard from './WindowsServerInfoDashboard';
import RaspberryPiServerInfoDashboard from './RaspberryPiServerInfoDashboard';
import { getMockRaspberryPiData } from './raspberryPiMock';
// import LinuxDashboard from './LinuxDashboard';
// import RaspberryPiDashboard from './RaspberryPiDashboard';
// import UnsupportedOSDashboard from './UnsupportedOSDashboard';

const Main = styled('main')(({ theme }) => ({
  flexGrow: 1,
  padding: theme.spacing(3),
  background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
  minHeight: '100vh',
  paddingInline: '0 !important',
}));

const ServerInfo = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [serverData, setServerData] = useState(null);
  const [error, setError] = useState(null);
  const [osComponent, setOsComponent] = useState(null);
  const [stats, setStats] = useState({
    cpu: 0,
    memory: 0,
    disk: 0,
    network: 0
  });

  const fetchServerInfo = async () => {
    try {
      setRefreshing(true);
      // const data = await getMockRaspberryPiData();
      const response = await axiosInstance.get('/api/server/info');
      const data = response.data;
      // //console.log('Server Data:', data); // Debug log
      setServerData(data);
      setError(null);

      // Update stats
      updateStats(data);

      // Determine OS and set appropriate component
      determineOSComponent(data);

    } catch (err) {
      setError(`Failed to fetch server information: ${err.message}`);
      // console.error('Error fetching server info:', err);
      // Set default unsupported OS component
      setOsComponent(
        <UnsupportedOSDashboard 
          serverInfo={serverData} 
          refreshData={fetchServerInfo} 
        />
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const updateStats = (data) => {
    // Calculate memory usage percentage
    let memoryUsedPercent = 0;
    if (data.memory?.usedPercent) {
      memoryUsedPercent = parseFloat(data.memory.usedPercent);
    } else if (data.memory?.usedBytes && data.memory?.totalBytes) {
      memoryUsedPercent = (data.memory.usedBytes / data.memory.totalBytes) * 100;
    }

    // Calculate overall disk usage
    let diskUsage = 0;
    if (data.disk?.drives && data.disk.drives.length > 0) {
      const totalUsage = data.disk.drives.reduce((sum, drive) =>
        sum + parseFloat(drive.usedPercent || 0), 0
      );
      diskUsage = totalUsage / data.disk.drives.length;
    }

    // Get CPU usage
    let cpuUsage = 0;
    if (data.cpu?.loadPercentage !== undefined) {
      cpuUsage = parseFloat(data.cpu.loadPercentage);
    } else if (data.performance?.cpuLoad1Min) {
      cpuUsage = parseFloat(data.performance.cpuLoad1Min);
    }

    // Network load placeholder
    const networkLoad = data.network?.adapters?.filter(a => a.status === 'Up').length > 0 ? 50 : 0;

    setStats({
      cpu: cpuUsage,
      memory: memoryUsedPercent,
      disk: diskUsage,
      network: networkLoad
    });
  };

  const determineOSComponent = (data) => {
    // Debug: Log OS detection
    // //console.log('OS Detection:', {
    //   windows: data.windows,
    //   linux: data.linux,
    //   raspberryPi: data.raspberryPi,
    //   mac: data.mac,
    //   collectorType: data.collectorType,
    //   serverInfo: data.serverInfo
    // });

    // Check OS flags first
    if (data.windows === true) {
      //console.log('Detected Windows OS');
      setOsComponent(
        <WindowsServerInfoDashboard 
          data={data} 
          onRefresh={fetchServerInfo} 
          isLoading={refreshing}
        />
      );
    } else if (data.raspberryPi === true && data.linux === true) {
      //console.log('Detected Raspberry Pi Server with Linux Os');
      setOsComponent(
        <RaspberryPiServerInfoDashboard 
          serverInfo={data} 
          refreshData={fetchServerInfo} 
        />
      );
    } else if (data.linux === true && data.raspberryPi !== true) {
      //console.log('Detected Linux OS');
      setOsComponent(
        <LinuxDashboard 
          serverInfo={data} 
          refreshData={fetchServerInfo} 
        />
      );
    } else if (data.mac === true) {
      //console.log('Detected macOS');
      setOsComponent(
        <UnsupportedOSDashboard 
          serverInfo={data} 
          refreshData={fetchServerInfo} 
        />
      );
    } 
    // Check collector type as fallback
    else if (data.collectorType?.includes('Windows')) {
      //console.log('Detected Windows via collector type');
      setOsComponent(
        <WindowsServerInfoDashboard 
          data={data} 
          onRefresh={fetchServerInfo} 
          isLoading={refreshing}
        />
      );
    } 
    // Check OS name from serverInfo
    else if (data.serverInfo?.osName?.toLowerCase().includes('windows')) {
      //console.log('Detected Windows via OS name');
      setOsComponent(
        <WindowsServerInfoDashboard 
          data={data} 
          onRefresh={fetchServerInfo} 
          isLoading={refreshing}
        />
      );
    } 
    // Default to unsupported
    else {
      //console.log('OS not detected, defaulting to unsupported');
      setOsComponent(
        <UnsupportedOSDashboard 
          serverInfo={data} 
          refreshData={fetchServerInfo} 
        />
      );
    }
  };

  const getLoadingContent = () => (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        gap: 3,
      }}
    >
      <CircularProgress size={80} />
      <Typography variant="h5" color="text.secondary">
        Connecting to server...
      </Typography>
      <LinearProgress sx={{ width: '60%', maxWidth: 400 }} />
      <Typography variant="caption" color="text.secondary">
        Fetching system information from {window.location.hostname}
      </Typography>
    </Box>
  );

  useEffect(() => {
    fetchServerInfo();
  }, []);

  return (
    <Main>
      <Container sx={{P:0}} >
        {/* Error Alert */}
        {error && (
          <Alert
            severity="error"
            sx={{ mb: 3 }}
            action={
              <Button 
                color="inherit" 
                size="small" 
                onClick={fetchServerInfo}
                disabled={refreshing}
              >
                {refreshing ? 'Retrying...' : 'Retry'}
              </Button>
            }
          >
            {error}
          </Alert>
        )}

        {/* Loading State */}
        {loading && getLoadingContent()}

        {/* Refreshing Overlay */}
        {refreshing && !loading && (
          <Box
            sx={{
              position: 'fixed',
              top: 0,
              right: 0,
              zIndex: 9999,
              m: 2,
            }}
          >
            <Paper
              elevation={3}
              sx={{
                p: 1.5,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                borderRadius: 2,
              }}
            >
              <CircularProgress size={24} />
              <Typography variant="caption">
                Refreshing data...
              </Typography>
            </Paper>
          </Box>
        )}

        {/* Stats Info (Optional - can be removed if not needed) */}
        {!loading && serverData && (
          <Paper
            elevation={0}
            sx={{
              p: 1,
              mb: 2,
              background: 'transparent',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 1,
            }}
          >
            <Typography variant="caption" color="text.secondary">
              Last updated: {new Date().toLocaleTimeString()}
            </Typography>
            <Button
              size="small"
              variant="outlined"
              startIcon={loading && <CircularProgress size={16} />}
              onClick={fetchServerInfo}
              disabled={refreshing}
            >
              Refresh
            </Button>
          </Paper>
        )}

        {/* Render OS-specific component */}
        {!loading && osComponent}

        {/* Stats Display (Optional - can be removed) */}
        {!loading && serverData && (
          <Box sx={{ mt: 3, textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">
              CPU: {stats.cpu.toFixed(1)}% • 
              Memory: {stats.memory.toFixed(1)}% • 
              Disk: {stats.disk.toFixed(1)}%
            </Typography>
          </Box>
        )}
      </Container>
    </Main>
  );
};

// Linux Dashboard Component (Placeholder)
const LinuxDashboard = ({ serverInfo, refreshData }) => (
  <Box>
    <Paper sx={{ p: 3, borderRadius: 2 }}>
      <Typography variant="h4" gutterBottom>
        Linux System Dashboard
      </Typography>
      <Typography color="text.secondary" paragraph>
        Linux system information will be displayed here.
      </Typography>
      <Alert severity="info">
        Linux dashboard is under development. Windows dashboard is currently the primary focus.
      </Alert>
    </Paper>
  </Box>
);

// Raspberry Pi Dashboard Component (Placeholder)
const RaspberryPiDashboard = ({ serverInfo, refreshData }) => (
  <Box>
    <Paper sx={{ p: 3, borderRadius: 2 }}>
      <Typography variant="h4" gutterBottom>
        Raspberry Pi Dashboard
      </Typography>
      <Typography color="text.secondary" paragraph>
        Raspberry Pi system information will be displayed here.
      </Typography>
      <Alert severity="info">
        Raspberry Pi dashboard is under development.
      </Alert>
    </Paper>
  </Box>
);

// Unsupported OS Dashboard Component
const UnsupportedOSDashboard = ({ serverInfo, refreshData }) => (
  <Box>
    <Paper sx={{ p: 3, borderRadius: 2 }}>
      <Typography variant="h4" gutterBottom>
        Unsupported Operating System
      </Typography>
      <Typography color="text.secondary" paragraph>
        The operating system detected is not currently supported by this dashboard.
      </Typography>
      <Alert severity="warning" sx={{ mb: 2 }}>
        Please check that the server is running Windows, Linux, or Raspberry Pi OS.
      </Alert>
      {serverInfo && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Detected Information:
          </Typography>
          <pre style={{ 
            backgroundColor: '#f5f5f5', 
            padding: '10px', 
            borderRadius: '4px',
            fontSize: '12px',
            overflow: 'auto'
          }}>
            {JSON.stringify(serverInfo, null, 2)}
          </pre>
        </Box>
      )}
    </Paper>
  </Box>
);

export default ServerInfo;