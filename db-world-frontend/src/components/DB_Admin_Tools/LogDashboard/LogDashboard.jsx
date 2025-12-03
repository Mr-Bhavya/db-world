import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Box, Card, CardContent, Typography, Grid, Paper,
  Tabs, Tab, TextField, InputAdornment, IconButton,
  FormControl, InputLabel, Select, MenuItem, Chip,
  Fab, CircularProgress, useTheme, useMediaQuery
} from '@mui/material';
import { Search, Refresh, Code, List, KeyboardArrowDown } from '@mui/icons-material';
import { useWebSocket } from '../../Utils/useWebSocket';
import ChartsWrapper from './ChartsWrapper';
import LogViewer from './LogViewer';

const DEFAULT_LOOKBACK_MINUTES = 60;

const LogDashboard = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));

  const WEBSOCKET_URL = process.env.REACT_APP_WEBSOCKET_BASEURL
    ? `${process.env.REACT_APP_WEBSOCKET_BASEURL}/ws/application-logs?lookback_minutes=${DEFAULT_LOOKBACK_MINUTES}`
    : 'ws://localhost:9000/ws/application-logs?lookback_minutes=60';

  const [isLoading, setIsLoading] = useState(true);
  const [logs, setLogs] = useState([]);
  const [activeTab, setActiveTab] = useState(0);
  const [viewMode, setViewMode] = useState('formatted');
  const [searchTerm, setSearchTerm] = useState('');
  const [logLevelFilter, setLogLevelFilter] = useState('all');
  const [timeRangeFilter, setTimeRangeFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('all');
  const [userList, setUserList] = useState([]);

  const logKeysSet = useRef(new Set());

  // Optimized WebSocket message handler
  const handleWebSocketMessage = useCallback((msg) => {
    try {
      const raw = msg.data;
      const parsed = JSON.parse(raw);

      // Backend always wraps logs inside "data"
      let logsData = parsed.data;

      // If data is not array → nothing to process
      if (!Array.isArray(logsData) || logsData.length === 0) return;

      // Parse logs
      processIncomingLogs(logsData);

    } catch (error) {
      console.error("❌ Error processing WebSocket message:", error, msg);
    }
  }, []);

  const { isConnected, reconnect } = useWebSocket(WEBSOCKET_URL, handleWebSocketMessage);

  // Optimized log parser with memoization
  const parseLogEntry = useCallback((log) => {
    if (typeof log === 'string') {
      try {
        log = JSON.parse(log);
      } catch {
        return {
          raw: log,
          timestamp: new Date().toLocaleString(),
          level: 'UNKNOWN',
          message: log,
          isError: false,
          isWarning: false,
          logKey: Math.random().toString(36),
        };
      }
    }

    const timestamp = log.instant
      ? new Date(log.instant.epochSecond * 1000 + Math.floor(log.instant.nanoOfSecond / 1e6)).toLocaleString()
      : new Date().toLocaleString();

    const logKey = `${timestamp}-${log.level}-${log.message}-${log.thread}`;

    return {
      raw: JSON.stringify(log, null, 2),
      timestamp,
      level: log.level || 'INFO',
      message: log.message || '',
      thread: log.thread || '',
      loggerName: log.loggerName || '',
      user: log.user !== 'null' ? log.user : null,
      method: log.method !== 'null' ? log.method : null,
      uri: log.uri !== 'null' ? log.uri : null,
      status: log.status !== 'null' ? log.status : null,
      duration: log.duration !== 'null' ? log.duration : null,
      isError: (log.level || '').toUpperCase() === 'ERROR',
      isWarning: (log.level || '').toUpperCase() === 'WARN',
      logKey,
    };
  }, []);

  // Debounced log processing
  const processIncomingLogs = useCallback((logEntries) => {
    if (!Array.isArray(logEntries)) return;

    const processedLogs = logEntries.map(parseLogEntry);
    const uniqueLogs = processedLogs.filter(log => {
      if (logKeysSet.current.has(log.logKey)) return false;
      logKeysSet.current.add(log.logKey);
      return true;
    });

    if (uniqueLogs.length === 0) return;

    setLogs(prev => {
      const updatedLogs = [...prev, ...uniqueLogs];
      // Keep only last 1000 logs for performance
      return updatedLogs.slice(-1000);
    });

    // Update user list
    const newUsers = new Set();
    uniqueLogs.forEach(log => {
      if (log.user) newUsers.add(log.user);
    });

    setUserList(prev => {
      const combined = new Set([...prev, ...newUsers]);
      return Array.from(combined).slice(0, 50); // Limit to 50 users
    });

    setIsLoading(false);
  }, [parseLogEntry]);

  // Optimized filtered logs with proper dependencies
  const filteredLogs = useMemo(() => {
    let result = logs;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(log =>
        log.message.toLowerCase().includes(term) ||
        log.raw.toLowerCase().includes(term)
      );
    }

    if (logLevelFilter !== 'all') {
      result = result.filter(log => log.level === logLevelFilter);
    }

    if (timeRangeFilter !== 'all') {
      const now = new Date();
      const cutoff = new Date(now.getTime() - parseInt(timeRangeFilter) * 60 * 1000);
      result = result.filter(log => {
        try {
          return new Date(log.timestamp) > cutoff;
        } catch (e) {
          return false;
        }
      });
    }

    if (userFilter !== 'all') {
      result = result.filter(log => log.user === userFilter);
    }

    return result;
  }, [logs, searchTerm, logLevelFilter, timeRangeFilter, userFilter]);

  // Optimized chart data computation
  const chartData = useMemo(() => {
    const levelDistribution = ['ERROR', 'WARN', 'INFO', 'DEBUG'].map(level => ({
      name: level,
      value: filteredLogs.filter(log => log.level === level).length,
    }));

    // Aggregate logs by 5-minute intervals for better performance
    const logsOverTime = {};
    filteredLogs.forEach(log => {
      const date = new Date(log.timestamp);
      const minutes = date.getMinutes();
      const roundedMinutes = Math.floor(minutes / 5) * 5;
      const timeKey = `${date.getHours()}:${roundedMinutes.toString().padStart(2, '0')}`;
      logsOverTime[timeKey] = (logsOverTime[timeKey] || 0) + 1;
    });

    const requestStats = { methods: {}, statusCodes: {}, uris: {} };
    filteredLogs.forEach(log => {
      if (log.method) requestStats.methods[log.method] = (requestStats.methods[log.method] || 0) + 1;
      if (log.status) requestStats.statusCodes[log.status] = (requestStats.statusCodes[log.status] || 0) + 1;
      if (log.uri) requestStats.uris[log.uri] = (requestStats.uris[log.uri] || 0) + 1;
    });

    return {
      levelDistribution,
      logsOverTime: Object.entries(logsOverTime)
        .sort(([timeA], [timeB]) => timeA.localeCompare(timeB))
        .map(([time, count]) => ({ time, count })),
      requestStats
    };
  }, [filteredLogs]);

  const renderTabPanel = (index) => {
    if (index === 0) {
      return <ChartsWrapper chartData={chartData} />;
    } else {
      return (
        <LogViewer
          logs={filteredLogs}
          isLoading={isLoading}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />
      );
    }
  };

  return (
    <Box sx={{
      p: { xs: 1, sm: 2 },
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      backgroundColor: theme.palette.background.default,
    }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography
          variant="h5"
          sx={{
            fontSize: { xs: '1.2rem', sm: '1.5rem' },
            fontWeight: 600,
            color: theme.palette.text.primary
          }}
        >
          Log Analytics Dashboard
        </Typography>
        <Box display="flex" gap={1} alignItems="center">
          <Chip
            label={isConnected ? 'Connected' : 'Disconnected'}
            color={isConnected ? 'success' : 'error'}
            size="small"
            variant="outlined"
          />
          <IconButton
            onClick={() => setViewMode(viewMode === 'raw' ? 'formatted' : 'raw')}
            size="small"
            title={viewMode === 'raw' ? 'Switch to formatted view' : 'Switch to raw view'}
          >
            {viewMode === 'raw' ? <List fontSize="small" /> : <Code fontSize="small" />}
          </IconButton>
          <IconButton onClick={reconnect} size="small" title="Reconnect">
            <Refresh fontSize="small" />
          </IconButton>
        </Box>
      </Box>

      {/* Filters Card */}
      <Card elevation={1} sx={{ mb: 2, borderRadius: 2 }}>
        <CardContent sx={{ p: { xs: 1, sm: 2 } }}>
          <Grid container spacing={1}>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                label="Search logs"
                variant="outlined"
                size="small"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search fontSize="small" />
                    </InputAdornment>
                  ),
                }}
                placeholder="Search message or content..."
              />
            </Grid>

            <Grid item xs={6} sm={3} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Level</InputLabel>
                <Select
                  label="Level"
                  value={logLevelFilter}
                  onChange={(e) => setLogLevelFilter(e.target.value)}
                >
                  <MenuItem value="all">All</MenuItem>
                  <MenuItem value="ERROR">Error</MenuItem>
                  <MenuItem value="WARN">Warning</MenuItem>
                  <MenuItem value="INFO">Info</MenuItem>
                  <MenuItem value="DEBUG">Debug</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={6} sm={3} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Time Range</InputLabel>
                <Select
                  label="Time Range"
                  value={timeRangeFilter}
                  onChange={(e) => setTimeRangeFilter(e.target.value)}
                >
                  <MenuItem value="all">All Time</MenuItem>
                  <MenuItem value="15">Last 15 min</MenuItem>
                  <MenuItem value="60">Last 1 hour</MenuItem>
                  <MenuItem value="180">Last 3 hours</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6} md={5}>
              <FormControl fullWidth size="small">
                <InputLabel>User</InputLabel>
                <Select
                  label="User"
                  value={userFilter}
                  onChange={(e) => setUserFilter(e.target.value)}
                >
                  <MenuItem value="all">All Users</MenuItem>
                  {userList.slice(0, 20).map((user, idx) => (
                    <MenuItem key={idx} value={user}>
                      {user}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onChange={(e, newValue) => setActiveTab(newValue)}
        indicatorColor="primary"
        textColor="primary"
        variant={isMobile ? "scrollable" : "standard"}
        scrollButtons={isMobile ? "auto" : false}
        sx={{ mb: 2 }}
      >
        <Tab label="Overview" />
        <Tab label="Log Details" />
      </Tabs>

      {/* Content Area */}
      <Box sx={{
        flex: 1,
        overflow: 'hidden',
        minHeight: 0 // Important for flexbox scrolling
      }}>
        {renderTabPanel(activeTab)}
      </Box>

      {/* Status Footer */}
      <Typography
        variant="caption"
        color="textSecondary"
        align="center"
        sx={{
          mt: 1,
          display: 'block'
        }}
      >
        {isConnected
          ? `Showing ${filteredLogs.length} logs • Real-time updates active`
          : 'Connection lost • Attempting to reconnect...'}
      </Typography>
    </Box>
  );
};

export default React.memo(LogDashboard);