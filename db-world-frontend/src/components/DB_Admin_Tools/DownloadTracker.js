import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  LinearProgress,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  IconButton,
  useTheme,
  useMediaQuery,
  Chip
} from '@mui/material';
import {
  Download as DownloadIcon,
  CloudDownload as CloudDownloadIcon,
  Movie as MovieIcon,
  Tv as TvIcon,
  Person as PersonIcon,
  DataUsage as DataUsageIcon,
  Refresh as RefreshIcon,
  SignalCellularAlt as SignalIcon,
  Storage as StorageIcon,
  Search as SearchIcon,
  PlayArrow as StreamIcon
} from '@mui/icons-material';
import { motion } from 'framer-motion';

const WEBSOCKET_BASEURL = process.env.REACT_APP_WEBSOCKET_BASEURL;
// const WEBSOCKET_URL = 'ws://localhost:9000/api/utils/download-tracker';
const WEBSOCKET_URL = `${WEBSOCKET_BASEURL}/api/utils/download-tracker`;

const useWebSocket = (url, onMessage) => {
  const [ws, setWs] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const reconnectTimeoutRef = useRef(null);
  
  const connect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    const socket = new WebSocket(url);
    
    socket.onopen = () => {
      setIsConnected(true);
      setWs(socket);
    };
    
    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage(data);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
    
    socket.onclose = () => {
      setIsConnected(false);
      setWs(null);
      reconnectTimeoutRef.current = setTimeout(() => connect(), 5000);
    };
    
    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    return socket;
  }, [url, onMessage]);

  useEffect(() => {
    const socket = connect();
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (socket) socket.close();
    };
  }, [connect]);

  const reconnect = useCallback(() => {
    if (ws) ws.close();
    else connect();
  }, [ws, connect]);

  return { isConnected, reconnect };
};

const DownloadItem = ({ download }) => {
  const getFileTypeIcon = (fileName) => {
    if (fileName?.includes('/movies/')) return <MovieIcon />;
    if (fileName?.includes('/series/')) return <TvIcon />;
    return <StorageIcon />;
  };

  const getEventIcon = (type) => {
    switch (type) {
      case 'DOWNLOAD': return <DownloadIcon color="primary" />;
      case 'STREAM': return <StreamIcon color="success" />;
      default: return <StorageIcon />;
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent sx={{pb:2}}>
          <Box display="flex" alignItems="center">
            <Avatar sx={{ mr: 2, bgcolor: 'primary.main' }}>
              {getFileTypeIcon(download.fileName)}
            </Avatar>
            <Box>
              <Typography>
                {download.fileName?.split('/').pop() || 'Unknown file'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {download.userId}
              </Typography>
              <Box mt={1}>
                <Chip 
                  icon={getEventIcon(download.type)} 
                  label={download.type} 
                  size="small" 
                  variant="outlined"
                  sx={{ mr: 1 }}
                />
                <Chip 
                  label={`Last seen: ${new Date(download.lastSeen).toLocaleString()}`}
                  size="small" 
                  variant="outlined"
                  // sx={{ ml: 1 }}
                />
              </Box>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </motion.div>
  );
};

const UserActivity = ({ user, activities }) => {
  const [expanded, setExpanded] = useState(false);
  const theme = useTheme();

  const getEventIcon = (event) => {
    switch (event?.toLowerCase()) {
      case 'download': return <DownloadIcon fontSize="small" color="primary" />;
      case 'stream': return <StreamIcon fontSize="small" color="success" />;
      default: return <StorageIcon fontSize="small" />;
    }
  };

  return (
    <React.Fragment key={user}>
      <ListItem button onClick={() => setExpanded(!expanded)}>
        <ListItemAvatar>
          <Avatar>
            <PersonIcon />
          </Avatar>
        </ListItemAvatar>
        <ListItemText 
          primary={user} 
          secondary={`${activities.length} activities`} 
        />
      </ListItem>
      {expanded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
        >
          <List dense sx={{ pl: 0 }}>
            {activities.map((activity, i) => (
              <ListItem key={i}>
                <ListItemAvatar>
                  <Avatar sx={{ 
                    bgcolor: theme.palette.background.paper,
                    width: 24, 
                    height: 24,
                  }}>
                    {getEventIcon(activity.event)}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={
                    activity.event?.toLowerCase() === 'download' 
                      ? `Downloaded: ${activity.value?.split('/').pop() || activity.value}` 
                      : `Streamed: ${activity.value}`
                  }
                  secondary={activity.time}
                />
              </ListItem>
            ))}
          </List>
        </motion.div>
      )}
    </React.Fragment>
  );
};

const DownloadTracker = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [data, setData] = useState(null);
  
  const handleWebSocketMessage = useCallback((message) => {
    setData(message.data || message);
  }, []);

  const { isConnected, reconnect } = useWebSocket(WEBSOCKET_URL, handleWebSocketMessage);

  // Process data for display
  const activeDownloads = data?.activeDownloads || [];
  const recentActivities = data?.recentActivities || [];
  const statistics = data?.statistics || {};
  const userEngagement = data?.userEngagement || {};
  const trends = data?.trends || {};

  // Group activities by user
  const userActivities = recentActivities.reduce((acc, activity) => {
    if (!activity.user) return acc;
    if (!acc[activity.user]) acc[activity.user] = [];
    acc[activity.user].push(activity);
    return acc;
  }, {});

  return (
    <Box sx={{ p: isMobile ? 1 : 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Download & Stream Analytics</Typography>
        <Box display="flex" alignItems="center">
          <Box display="flex" alignItems="center" sx={{ 
            color: isConnected ? theme.palette.success.main : theme.palette.error.main, 
            mr: 2 
          }}>
            <SignalIcon fontSize="small" sx={{ mr: 1 }} />
            <Typography>{isConnected ? 'Connected' : 'Disconnected'}</Typography>
          </Box>
          <IconButton onClick={reconnect}>
            <RefreshIcon />
          </IconButton>
        </Box>
      </Box>

      {!data ? (
        <Box display="flex" justifyContent="center" py={10}>
          <Typography>Loading data...</Typography>
        </Box>
      ) : (
        <>
          {/* Summary Cards */}
          <Grid container spacing={3} mb={3}>
            {[
              { 
                title: 'Active Downloads', 
                value: statistics.downloadCount || 0,
                icon: <DownloadIcon />,
                color: 'primary.main'
              },
              { 
                title: 'Active Streams', 
                value: statistics.streamCount || 0,
                icon: <StreamIcon />,
                color: 'success.main'
              },
              { 
                title: 'Active Users', 
                value: statistics.activeUsers || 0,
                icon: <PersonIcon />,
                color: 'secondary.main'
              },
              { 
                title: 'Daily Downloads', 
                value: trends.dailyDownloads || 0,
                icon: <CloudDownloadIcon />,
                color: 'info.main'
              }
            ].map((item, i) => (
              <Grid item xs={12} sm={6} md={3} key={i}>
                <Card>
                  <CardContent>
                    <Box display="flex" alignItems="center">
                      <Avatar sx={{ bgcolor: item.color, mr: 2 }}>
                        {item.icon}
                      </Avatar>
                      <Box>
                        <Typography variant="h5">{item.value}</Typography>
                        <Typography variant="body2">{item.title}</Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          {/* Main Content */}
          <Grid container spacing={3}>
            {/* Active Downloads */}
            <Grid item xs={12} md={8}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Active Downloads ({activeDownloads.length})
                </Typography>
                <Divider sx={{ mb: 2 }} />
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
                  <Typography color="text.secondary">No active downloads</Typography>
                )}
              </Paper>

              {/* Statistics */}
              <Paper sx={{ p: 2, mt: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Statistics
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle1">User Engagement</Typography>
                    <Typography variant="body2">Daily Activity: {userEngagement.dailyActivity}</Typography>
                    <Typography variant="body2">Daily Active Users: {userEngagement.dailyActiveUsers}</Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle1">Trends</Typography>
                    <Typography variant="body2">Daily Downloads: {trends.dailyDownloads}</Typography>
                    <Typography variant="body2">Daily Streams: {trends.dailyStreams}</Typography>
                  </Grid>
                </Grid>
              </Paper>
            </Grid>

            {/* User Activity */}
            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 2, height: '100%' }}>
                <Typography variant="h6" gutterBottom>Recent Activities</Typography>
                <Divider sx={{ mb: 2 }} />
                <List sx={{ maxHeight: 800, overflow: 'auto' }}>
                  {Object.entries(userActivities).map(([user, activities]) => (
                    <UserActivity key={user} user={user} activities={activities} />
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