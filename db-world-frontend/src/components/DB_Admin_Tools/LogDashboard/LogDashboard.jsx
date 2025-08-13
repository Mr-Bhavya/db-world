import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Box, Card, CardContent, Typography, Grid, Paper,
  Tabs, Tab, TextField, InputAdornment, IconButton,
  FormControl, InputLabel, Select, MenuItem, Chip,
  Fab, CircularProgress
} from '@mui/material';
import { Search, Refresh, Code, List, KeyboardArrowDown } from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LineChart, BarChart, PieChart, Line, Bar, Pie,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell
} from 'recharts';
import { useWebSocket } from '../../Utils/useWebSocket';
import ChartsWrapper from './ChartsWrapper';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82ca9d', '#ffc658'];
const DEFAULT_LOOKBACK_MINUTES = 60;

const LogDashboard = () => {
  const WEBSOCKET_URL = process.env.REACT_APP_WEBSOCKET_BASEURL
    ? `${process.env.REACT_APP_WEBSOCKET_BASEURL}/ws/application-logs?lookback_minutes=${DEFAULT_LOOKBACK_MINUTES}`
    : 'ws://localhost:9000/ws/application-logs?lookback_minutes=60';

  const logsEndRef = useRef(null);
  const logsContainerRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [logs, setLogs] = useState([]);
  const [activeTab, setActiveTab] = useState(0);
  const [viewMode, setViewMode] = useState('formatted');
  const [searchTerm, setSearchTerm] = useState('');
  const [logLevelFilter, setLogLevelFilter] = useState('all');
  const [timeRangeFilter, setTimeRangeFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('all');
  const [userList, setUserList] = useState([]);
  const [isScrolledUp, setIsScrolledUp] = useState(false);
  const logKeysSet = useRef(new Set());

  const handleWebSocketMessage = useCallback((msg) => {
    try {
      const data = typeof msg === 'string' ? JSON.parse(msg.data) : msg.data;
      let logsData = Array.isArray(data) ? data : [data];

      // Skip status messages and empty logs
      logsData = logsData.filter(log =>
        log && log.message && !log.message.includes('Logs retrieved')
      );

      if (logsData.length > 0) {
        processIncomingLogs(logsData);
      }
    } catch (error) {
      console.error('Error processing WebSocket message:', error, msg);
    }
  }, []);

  const { isConnected, reconnect } = useWebSocket(WEBSOCKET_URL, handleWebSocketMessage);

  const scrollToBottom = () => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleScroll = useCallback(() => {
    const container = logsContainerRef.current;
    if (!container) return;

    const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 10;
    setIsScrolledUp(!isAtBottom);
  }, []);

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
      return updatedLogs.slice(-2000); // Keep last 2000 logs
    });

    // Update user filter options
    const newUsers = new Set();
    uniqueLogs.forEach(log => {
      if (log.user) newUsers.add(log.user);
    });
    setUserList(prev => [...new Set([...prev, ...newUsers])]);

    setIsLoading(false);
    setTimeout(scrollToBottom, 100);
  }, [parseLogEntry]);

  const filteredLogs = useMemo(() => {
    let result = [...logs];

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

  const chartData = useMemo(() => {
    const levelDistribution = ['ERROR', 'WARN', 'INFO', 'DEBUG'].map(level => ({
      name: level,
      value: filteredLogs.filter(log => log.level === level).length,
    }));

    const logsOverTime = {};
    filteredLogs.forEach(log => {
      const time = log.timestamp.split(', ')[1]?.substring(0, 5) || '00:00';
      logsOverTime[time] = (logsOverTime[time] || 0) + 1;
    });

    const requestStats = { methods: {}, statusCodes: {}, uris: {} };
    filteredLogs.forEach(log => {
      if (log.method) requestStats.methods[log.method] = (requestStats.methods[log.method] || 0) + 1;
      if (log.status) requestStats.statusCodes[log.status] = (requestStats.statusCodes[log.status] || 0) + 1;
      if (log.uri) requestStats.uris[log.uri] = (requestStats.uris[log.uri] || 0) + 1;
    });

    return {
      levelDistribution,
      logsOverTime: Object.entries(logsOverTime).map(([time, count]) => ({ time, count })),
      requestStats
    };
  }, [filteredLogs]);


  // Helper functions for time formatting
  const formatTimeForChart = (timestamp) => {
    const date = new Date(timestamp);
    return `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  const formatTimeForTooltip = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  const renderTabPanel = (index) => {
    if (index === 0) {
      return <ChartsWrapper chartData={chartData} />
    } else {
      return (
        <Box sx={{ mt: 2 }}>
          <Paper
            elevation={3}
            sx={{
              p: 2,
              height: { xs: '60vh', md: '70vh' },
              overflow: 'auto',
              display: 'flex',
              flexDirection: 'column'
            }}
            ref={logsContainerRef}
            onScroll={handleScroll}
          >
            {isLoading ? (
              <Box sx={{
                flex: 1,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center'
              }}>
                <CircularProgress />
              </Box>
            ) : filteredLogs.length === 0 ? (
              <Typography variant="body1" align="center" sx={{ mt: 5 }}>
                No matching logs found
              </Typography>
            ) : (
              <AnimatePresence>
                {filteredLogs.map((log) => (
                  <motion.div
                    key={log.logKey}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    exit={{ opacity: 0 }}
                  >
                    {viewMode === 'raw' ? (
                      <pre style={{
                        margin: '8px 0',
                        padding: '8px',
                        backgroundColor: log.isError ? '#ffebee' : log.isWarning ? '#fff8e1' : '#e8f5e9',
                        borderRadius: 4,
                        whiteSpace: 'pre-wrap',
                        fontSize: '0.8rem'
                      }}>
                        {log.raw}
                      </pre>
                    ) : (
                      <Box sx={{
                        mb: 1,
                        p: 1.5,
                        borderLeft: `4px solid ${log.isError ? '#f44336' : log.isWarning ? '#ff9800' : '#4caf50'}`,
                        backgroundColor: log.isError ? '#ffebee' : log.isWarning ? '#fff8e1' : '#e8f5e9',
                        borderRadius: '0 4px 4px 0'
                      }}>
                        <Box display="flex" justifyContent="space-between" alignItems="center">
                          <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>
                            {log.timestamp}
                          </Typography>
                          <Chip
                            label={log.level}
                            size="small"
                            sx={{
                              backgroundColor: log.isError ? '#f44336' : log.isWarning ? '#ff9800' : '#4caf50',
                              color: 'white',
                              fontSize: '0.7rem'
                            }}
                          />
                        </Box>

                        <Typography variant="body2" sx={{ mt: 1, fontWeight: 'bold', fontSize: '0.9rem' }}>
                          [{log.loggerName || 'Unknown Logger'}] {log.message} {log?.query ? `(${log.query})` : ''}
                        </Typography>

                        <Box display="flex" flexWrap="wrap" gap={1} sx={{ mt: 1 }}>
                          {log.user && (
                            <Chip
                              label={`User: ${log.user}`}
                              size="small"
                              variant="outlined"
                              color="primary"
                              sx={{ fontSize: '0.7rem' }}
                            />
                          )}
                          {log.method && (
                            <Chip
                              label={`Method: ${log.method}`}
                              size="small"
                              variant="outlined"
                              sx={{ fontSize: '0.7rem' }}
                            />
                          )}
                          {log.uri && (
                            <Chip
                              label={`URI: ${log.uri}`}
                              size="small"
                              variant="outlined"
                              sx={{ fontSize: '0.7rem' }}
                            />
                          )}
                          {log.status && (
                            <Chip
                              label={`Status: ${log.status}`}
                              size="small"
                              variant="outlined"
                              color={
                                log.status >= 200 && log.status < 300 ? 'success' :
                                  log.status >= 400 && log.status < 500 ? 'warning' :
                                    log.status >= 500 ? 'error' : 'default'
                              }
                              sx={{
                                fontSize: '0.7rem',
                                borderColor:
                                  log.status >= 200 && log.status < 300 ? 'success.main' :
                                    log.status >= 400 && log.status < 500 ? 'warning.main' :
                                      log.status >= 500 ? 'error.main' : 'default',
                                color:
                                  log.status >= 200 && log.status < 300 ? 'success.main' :
                                    log.status >= 400 && log.status < 500 ? 'warning.main' :
                                      log.status >= 500 ? 'error.main' : 'default',
                              }}
                            />
                          )}

                        </Box>
                      </Box>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
            <div ref={logsEndRef} />
          </Paper>

          {isScrolledUp && (
            <Fab
              size="small"
              color="primary"
              onClick={scrollToBottom}
              sx={{
                position: 'fixed',
                bottom: 80,
                right: 24,
                zIndex: 9999,
              }}
            >
              <KeyboardArrowDown />
            </Fab>
          )}
        </Box>
      );
    }
  };

  return (
    <Box sx={{
      p: { xs: 1, sm: 2 },
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5" sx={{ fontSize: { xs: '1.2rem', sm: '1.5rem' } }}>
          Log Analytics Dashboard
        </Typography>
        <Box display="flex" gap={1}>
          <Chip
            label={isConnected ? 'Connected' : 'Disconnected'}
            color={isConnected ? 'success' : 'error'}
            size="small"
          />
          <IconButton
            onClick={() => setViewMode(viewMode === 'raw' ? 'formatted' : 'raw')}
            size="small"
          >
            {viewMode === 'raw' ? <List fontSize="small" /> : <Code fontSize="small" />}
          </IconButton>
          <IconButton onClick={reconnect} size="small">
            <Refresh fontSize="small" />
          </IconButton>
        </Box>
      </Box>

      <Card elevation={3} sx={{ mb: 2, borderRadius: 2 }}>
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
              />
            </Grid>

            <Grid item xs={6} sm={3} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Log Level</InputLabel>
                <Select
                  label="Log Level"
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
                  <MenuItem value="all">All</MenuItem>
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
                  {userList.map((user, idx) => (
                    <MenuItem key={idx} value={user}>{user}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Tabs
        value={activeTab}
        onChange={(e, newValue) => setActiveTab(newValue)}
        indicatorColor="primary"
        textColor="primary"
        variant="scrollable"
        scrollButtons="auto"
        sx={{ mb: 2 }}
      >
        <Tab label="Overview" />
        <Tab label="Log Details" />
      </Tabs>

      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {renderTabPanel(activeTab)}
      </Box>

      <Typography
        variant="body2"
        color="textSecondary"
        align="center"
        sx={{
          mt: 2,
          fontSize: '0.75rem'
        }}
      >
        {isConnected ? 'Receiving real-time logs' : 'Connection lost, attempting to reconnect...'}
      </Typography>
    </Box>
  );
};

export default LogDashboard;