import React, { useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Divider,
  List,
  useTheme,
  useMediaQuery
} from '@mui/material';
import {
  Download as DownloadIcon,
  PlayArrow as StreamIcon,
  Person as PersonIcon,
  NetworkCheck as BandwidthIcon
} from '@mui/icons-material';
import { useWebSocket } from '../../Utils/useWebSocket';
import { StatCard } from './StatCard';
import { DownloadItem } from './DownloadItem';
import { UserActivity } from './UserActivity';
import { ConnectionStatus } from './ConnectionStatus';

const DownloadTracker = () => {

    const WEBSOCKET_URL = process.env.REACT_APP_WEBSOCKET_BASEURL
    ? `${process.env.REACT_APP_WEBSOCKET_BASEURL}/ws/download-tracker`
    : 'ws://localhost:9000/ws/download-tracker';
    
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [data, setData] = useState(null);
  
  const handleWebSocketMessage = useCallback((message) => {
    setData(message);
  }, []);

  const { isConnected, reconnect } = useWebSocket(WEBSOCKET_URL, handleWebSocketMessage);

  // Process data for display
  const activeDownloads = data?.activeDownloads || [];
  const userHistories = data?.userHistories || {};
  const statistics = data?.statistics || {};

  // Format bytes for display
  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Prepare user activities data
  const prepareUserActivities = () => {
    const activities = [];
    
    // Convert userHistories object into an array of activities
    Object.entries(userHistories).forEach(([user, historyItems]) => {
      historyItems.forEach((item) => {
        activities.push({
          ...item,
          user,
          value: item.fileName,
          time: item.time,
          event: item.event
        });
      });
    });

    // Sort by time (newest first)
    return activities.sort((a, b) => new Date(b.time) - new Date(a.time));
  };

  // Group activities by user for the UserActivity component
  const groupActivitiesByUser = () => {
    const grouped = {};
    const allActivities = prepareUserActivities();
    
    allActivities.forEach((activity) => {
      if (!grouped[activity.user]) {
        grouped[activity.user] = [];
      }
      grouped[activity.user].push(activity);
    });

    return grouped;
  };

  // Get recent activity count (last 24 hours)
  const getRecentActivityCount = () => {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));
    
    return prepareUserActivities().filter(item => {
      return new Date(item.time) > oneDayAgo;
    }).length;
  };

  return (
    <Box sx={{ p: isMobile ? 1 : 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Download & Stream Analytics</Typography>
        <ConnectionStatus isConnected={isConnected} onReconnect={reconnect} />
      </Box>

      {!data ? (
        <Box display="flex" justifyContent="center" py={10}>
          <Typography>Loading data...</Typography>
        </Box>
      ) : (
        <>
          {/* Summary Cards */}
          <Grid container spacing={3} mb={3}>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard 
                title="Active Downloads" 
                value={statistics.downloadCount || 0}
                icon={<DownloadIcon />}
                color="primary.main"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard 
                title="Active Streams" 
                value={statistics.streamCount || 0}
                icon={<StreamIcon />}
                color="success.main"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard 
                title="Active Users" 
                value={statistics.activeUsers || 0}
                icon={<PersonIcon />}
                color="secondary.main"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard 
                title="Bandwidth Usage" 
                value={statistics.totalBandwidth || '0 B'}
                icon={<BandwidthIcon />}
                color="info.main"
                secondary={`Avg: ${statistics.avgSpeed || '0 B/s'}`}
              />
            </Grid>
          </Grid>

          {/* Main Content */}
          <Grid container spacing={3}>
            {/* Active Downloads */}
            <Grid item xs={12} md={8}>
              <Paper sx={{ p: 2 }}>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Typography variant="h6">
                    Active Transfers ({activeDownloads.length})
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Max Speed: {statistics.maxSpeed || '0 B/s'}
                  </Typography>
                </Box>
                <Divider sx={{ my: 2 }} />
                {activeDownloads.length > 0 ? (
                  <List>
                    {activeDownloads.map((download) => (
                      <DownloadItem 
                        key={download.downloadId} 
                        download={download} 
                      />
                    ))}
                  </List>
                ) : (
                  <Typography color="text.secondary">No active transfers</Typography>
                )}
              </Paper>

              {/* Statistics */}
              <Paper sx={{ p: 2, mt: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Transfer Statistics
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle1">Activity</Typography>
                    <Typography variant="body2">
                      Recent Activity (24h): {getRecentActivityCount()}
                    </Typography>
                    <Typography variant="body2">
                      Total Downloads: {statistics.downloadCount || 0}
                    </Typography>
                    <Typography variant="body2">
                      Total Streams: {statistics.streamCount || 0}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle1">Performance</Typography>
                    <Typography variant="body2">
                      Max Speed: {statistics.maxSpeed || '0 B/s'}
                    </Typography>
                    <Typography variant="body2">
                      Avg Speed: {statistics.avgSpeed || '0 B/s'}
                    </Typography>
                    <Typography variant="body2">
                      Total Bandwidth: {statistics.totalBandwidth || '0 B'}
                    </Typography>
                  </Grid>
                </Grid>
              </Paper>
            </Grid>

            {/* User Activity */}
            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 2, height: '100%' }}>
                <Typography variant="h6" gutterBottom>Recent User Activities</Typography>
                <Divider sx={{ mb: 2 }} />
                <List sx={{ maxHeight: 800, overflow: 'auto' }}>
                  {Object.entries(groupActivitiesByUser()).map(([user, activities]) => (
                    <UserActivity 
                      key={user} 
                      user={user} 
                      activities={activities.slice(0, 5)} // Show only 5 most recent per user
                      theme={theme} 
                    />
                  ))}
                </List>
              </Paper>
            </Grid>
          </Grid>
        </>
      )}
    </Box>
  );
};

export default DownloadTracker;