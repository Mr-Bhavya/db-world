import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box, Card, CardContent, Typography, Grid, Paper, Divider,
  Tabs, Tab, TextField, InputAdornment, IconButton,
  FormControl, InputLabel, Select, MenuItem, Chip,
  Fab
} from '@mui/material';
import { Search, FilterList, Refresh, Code, List, KeyboardArrowDown, RefreshRounded } from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LineChart, BarChart, PieChart, Line, Bar, Pie,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell
} from 'recharts';
import { useWebSocket } from '../Utils/useWebSocket';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82ca9d', '#ffc658'];
const WEBSOCKET_BASEURL = process.env.REACT_APP_WEBSOCKET_BASEURL;
const DEFAULT_LOOKBACK_MINUTES = 60; // 1 hour

const LogDashboard = () => {
  const WEBSOCKET_URL =
    // `${WEBSOCKET_BASEURL}/api/utils/application-logs?lookback_minutes=${DEFAULT_LOOKBACK_MINUTES}`
    `ws://localhost:9000/api/utils/application-logs?lookback_minutes=${DEFAULT_LOOKBACK_MINUTES}`;
  const ws = useRef(null);
  const reconnectTimeout = useRef(null);
  const logsEndRef = useRef(null);
  const logsContainerRef = useRef(null);
  const [isLoadingOlderLogs, setIsLoadingOlderLogs] = useState(false);
  const [hasMoreLogs, setHasMoreLogs] = useState(true);
  const [lookbackMinutes, setLookbackMinutes] = useState(DEFAULT_LOOKBACK_MINUTES);

  const [logs, setLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [activeTab, setActiveTab] = useState(0);
  const [viewMode, setViewMode] = useState('formatted');
  const [searchTerm, setSearchTerm] = useState('');
  const [logLevelFilter, setLogLevelFilter] = useState('all');
  const [timeRangeFilter, setTimeRangeFilter] = useState('all');
  const [userEmailFilter, setUserEmailFilter] = useState('all');
  const [userList, setUserList] = useState([]);
  const logKeysSet = useRef(new Set());
  const [isScrolledUp, setIsScrolledUp] = useState(false);

  const handleWebSocketMessage = useCallback(async (msg) => {
    console.log('Raw WebSocket message:', msg); // Debug log
    try {
      // const data = await JSON.parse(msg);
      // console.log('Parsed WebSocket message:', data); // Debug log

      // Handle both direct log arrays and ApiResponse format
      let logsData = msg?.data;
      if (msg && Array.isArray(msg)) {
        logsData = msg.data;
      } else if (!Array.isArray(msg)) {
        logsData = [msg];
      }

      if (msg.type === 'initial_logs' || msg.type === 'older_logs') {
        processIncomingLogs(logsData, msg.type === 'older_logs');
        if (msg.type === 'older_logs' && logsData.length === 0) {
          setHasMoreLogs(false);
        }
      } else {
        processIncomingLogs(logsData, false);
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error, msg);
    }
  }, []);

  const { isConnected, reconnect } = useWebSocket(WEBSOCKET_URL, handleWebSocketMessage);



  const scrollToBottom = () => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleScroll = () => {
    const container = logsContainerRef.current;
    if (!container || isLoadingOlderLogs || !hasMoreLogs) return;

    if (container.scrollTop === 0) {
      loadOlderLogs();
    }

    const isAtBottom = container.scrollHeight - container.scrollTop === container.clientHeight;
    setIsScrolledUp(!isAtBottom);
  };

  // Load older logs (1 hour before current lookback)
  const loadOlderLogs = () => {
    if (!isConnected || isLoadingOlderLogs) return;

    setIsLoadingOlderLogs(true);
    const newLookback = lookbackMinutes + DEFAULT_LOOKBACK_MINUTES;
    setLookbackMinutes(newLookback);

    // Send message to WebSocket to get older logs
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({
        action: 'get_older_logs',
        minutes: newLookback
      }));
    }
  };


  // --- WebSocket connect & auto-reconnect ---
  // const connectWebSocket = useCallback(() => {
  //   const url = `${WEBSOCKET_URL}?lookback_minutes=${DEFAULT_LOOKBACK_MINUTES}`;
  //   ws.current = new WebSocket(url);

  //   ws.current.onopen = () => {
  //     setIsConnected(true);
  //     setIsLoadingOlderLogs(false);
  //   };

  //   ws.current.onmessage = (event) => {
  //     console.log('Raw WebSocket message:', event.data); // Debug log
  //     try {
  //       const data = JSON.parse(event.data);

  //       // Handle both direct log arrays and ApiResponse format
  //       let logsData = data;
  //       if (data.data && Array.isArray(data.data)) {
  //         logsData = data.data;
  //       } else if (!Array.isArray(data)) {
  //         logsData = [data];
  //       }

  //       if (data.type === 'initial_logs' || data.type === 'older_logs') {
  //         processIncomingLogs(logsData, data.type === 'older_logs');
  //         if (data.type === 'older_logs' && logsData.length === 0) {
  //           setHasMoreLogs(false);
  //         }
  //       } else {
  //         processIncomingLogs(logsData, false);
  //       }
  //     } catch (error) {
  //       console.error('Error parsing WebSocket message:', error, event.data);
  //     }
  //   };

  //   ws.current.onerror = (error) => {
  //     console.error('WebSocket error:', error);
  //     ws.current.close();
  //   };

  //   ws.current.onclose = () => {
  //     setIsConnected(false);
  //     if (!reconnectTimeout.current) {
  //       reconnectTimeout.current = setTimeout(() => {
  //         connectWebSocket();
  //         reconnectTimeout.current = null;
  //       }, 5000);
  //     }
  //   };
  // }, [lookbackMinutes]);

  // useEffect(() => {
  //   connectWebSocket();
  //   return () => {
  //     if (ws.current) ws.current.close();
  //     if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
  //   };
  // }, [connectWebSocket]);


  // Process incoming logs (either append to top or bottom)
  const processIncomingLogs = (logEntries, isOlderLogs) => {
    if (!Array.isArray(logEntries)) {
      console.error('Expected array of log entries, got:', logEntries);
      return;
    }

    const processedLogs = logEntries.map(log => parseLogEntry(log));

    // Filter out logs already seen
    const uniqueLogs = processedLogs.filter(log => {
      if (logKeysSet.current.has(log.logKey)) {
        return false;
      }
      logKeysSet.current.add(log.logKey);
      return true;
    });

    if (uniqueLogs.length === 0) return;

    setLogs(prev => {
      const updatedLogs = isOlderLogs
        ? [...uniqueLogs, ...prev]
        : [...prev, ...uniqueLogs];
      return updatedLogs.slice(-2000); // keep only latest 2000 logs
    });


    if (!isOlderLogs) {
      setTimeout(scrollToBottom, 100);
    }

    extractUsers(uniqueLogs);
  };


  // --- Log Parsing ---
  const parseLogEntry = (log) => {
    if (typeof log !== 'string' && typeof log !== 'object') {
      console.warn('Unexpected log format:', log);
      return {
        raw: JSON.stringify(log),
        timestamp: '',
        level: 'UNKNOWN',
        message: 'Invalid log format',
        isError: false,
        isWarning: false,
        logKey: Math.random().toString(36), // fallback
      };
    }

    if (typeof log === 'string') {
      try {
        log = JSON.parse(log);
      } catch {
        return {
          raw: log,
          timestamp: '',
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
      : '';


    const logKey = `${timestamp}-${log.level}-${log.message}-${log.thread}`;

    return {
      raw: JSON.stringify(log, null, 2),
      timestamp,
      level: log.level || 'INFO',
      message: log.message || '',
      thread: log.thread || '',
      loggerName: log.loggerName || '',
      isError: (log.level || '').toUpperCase() === 'ERROR',
      isWarning: (log.level || '').toUpperCase() === 'WARN',
      logKey,
    };
  };


  // Extract users from logs (unchanged)
  const extractUsers = (newLogs) => {
    const users = new Set();
    newLogs.forEach(log => {
      const match = log.raw.match(/User\s([^\s]+)\sis\saccessing/);
      if (match) {
        users.add(match[1]);
      }
    });
    setUserList(prev => [...new Set([...prev, ...users])]);
  };

  // --- Apply filters ---
  // Replace your current filter useEffect with this:
  useEffect(() => {
    let result = [...logs];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(log =>
        log.message.toLowerCase().includes(term) ||
        log.raw.toLowerCase().includes(term)
      );
    }

    if (userEmailFilter && userEmailFilter !== 'all') {
      result = result.filter(log =>
        log.message.includes(userEmailFilter) ||
        log.raw.includes(userEmailFilter)
      );
    }

    if (logLevelFilter !== 'all') {
      result = result.filter(log => log.level === logLevelFilter);
    }

    if (timeRangeFilter !== 'all') {
      const now = new Date();
      const cutoff = new Date(now.getTime() - parseInt(timeRangeFilter) * 60 * 1000);

      result = result.filter(log => {
        if (!log.timestamp) return false;
        try {
          // Parse the formatted timestamp string back to Date
          return new Date(log.timestamp) > cutoff;
        } catch (e) {
          return false;
        }
      });
    }

    setFilteredLogs(result);
  }, [logs, searchTerm, logLevelFilter, timeRangeFilter, userEmailFilter]);

  const getLevelDistribution = () => {
    const levels = ['ERROR', 'WARN', 'INFO', 'DEBUG'];
    return levels.map(level => ({
      name: level,
      value: filteredLogs.filter(log => log.level === level).length,
    }));
  };

  const getUserAccessChart = () => {
    const userCounts = {};
    filteredLogs.forEach(log => {
      // Extract user from message if applicable
      const match = log.message.match(/User\s([^\s]+)\s/);
      if (match) {
        const email = match[1];
        userCounts[email] = (userCounts[email] || 0) + 1;
      }
    });
    return Object.entries(userCounts).map(([email, count]) => ({ email, count }));
  };

  const getLogsOverTime = () => {
    const map = {};
    filteredLogs.forEach(log => {
      const time = log.timestamp.split(', ')[1]?.substring(0, 5) || '00:00';
      map[time] = (map[time] || 0) + 1;
    });
    return Object.entries(map).map(([time, count]) => ({ time, count }));
  };

  // --- UI Components ---
  const renderTabPanel = (index) => {
    if (index === 0) {
      return (
        <Grid container spacing={3} sx={{ mt: 2 }} columns={{ xs: 1, sm: 8, md: 12 }}>
          <Grid item size={{ xs: 2, sm: 4, md: 4 }}>
            <Card elevation={3}>
              <CardContent>
                <Typography variant="h6">Log Level Distribution</Typography>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={getLevelDistribution()} dataKey="value" outerRadius={80} label>
                      {getLevelDistribution().map((entry, idx) => (
                        <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>

          <Grid item size={{ xs: 2, sm: 4, md: 4 }}>
            <Card elevation={3}>
              <CardContent>
                <Typography variant="h6">Logs Over Time</Typography>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={getLogsOverTime()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="count" stroke="#8884d8" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>

          <Grid item size={{ xs: 2, sm: 4, md: 4 }}>
            <Card elevation={3}>
              <CardContent>
                <Typography variant="h6">Top User Access</Typography>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={getUserAccessChart()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="email" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#00C49F" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      );
    } else {
      return (
        <Box sx={{ mt: 2 }}>
          <Paper
            elevation={3}
            sx={{ p: 2, maxHeight: '70vh', overflow: 'auto' }}
            ref={logsContainerRef}
            onScroll={handleScroll}
          >
            {isLoadingOlderLogs && (
              <Box sx={{ textAlign: 'center', py: 2 }}>
                <Typography variant="body2">Loading older logs...</Typography>
              </Box>
            )}

            {!hasMoreLogs && (
              <Box sx={{ textAlign: 'center', py: 2 }}>
                <Typography variant="body2">No more logs available</Typography>
              </Box>
            )}

            <AnimatePresence>
              {filteredLogs.map((log, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  {viewMode === 'raw' ? (
                    <pre style={{
                      margin: '8px 0',
                      padding: '8px',
                      backgroundColor: log.isError ? '#ffebee' : log.isWarning ? '#fff8e1' : '#e8f5e9',
                      borderRadius: 4,
                      whiteSpace: 'pre-wrap'
                    }}>
                      {log.raw}
                    </pre>
                  ) : (
                    <Box sx={{
                      mb: 1,
                      p: 1,
                      borderLeft: `4px solid ${log.isError ? '#f44336' : log.isWarning ? '#ff9800' : '#4caf50'}`,
                      backgroundColor: log.isError ? '#ffebee' : log.isWarning ? '#fff8e1' : '#e8f5e9',
                      borderRadius: '0 4px 4px 0'
                    }}>
                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="caption">{log.timestamp}</Typography>
                        <Chip label={log.level} size="small" sx={{
                          backgroundColor: log.isError ? '#f44336' : log.isWarning ? '#ff9800' : '#4caf50',
                          color: 'white'
                        }} />
                        {log.thread && <Chip label={`Thread: ${log.thread}`} size="small" />}
                      </Box>
                      <Typography variant="body2" sx={{ mt: 1 }}>
                        {log.message}
                      </Typography>
                      {log.loggerName && (
                        <Typography variant="caption" sx={{ display: 'block', mt: 1, color: '#616161' }}>
                          {log.loggerName}
                        </Typography>
                      )}
                    </Box>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
            {filteredLogs.length === 0 && (
              <Typography variant="body1" align="center" sx={{ mt: 5 }}>
                No matching logs
              </Typography>
            )}
            <div ref={logsEndRef} />
          </Paper>
          {isScrolledUp && (
            <Fab
              size="small"
              color="warning"
              onClick={scrollToBottom}
              sx={{
                position: 'fixed',
                bottom: 80,
                right: 24,
                zIndex: 9999,
                backgroundColor: '#1976d2',
                '&:hover': { backgroundColor: '#115293' }
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
    <Box sx={{ p: 2 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h4">Log Analytics Dashboard</Typography>
        <Box display="flex" gap={1}>
          <Chip label={isConnected ? 'Connected' : 'Disconnected'} color={isConnected ? 'success' : 'error'} />
          <IconButton onClick={() => setViewMode(viewMode === 'raw' ? 'formatted' : 'raw')}>
            {viewMode === 'raw' ? <List /> : <Code />}
          </IconButton>
          <IconButton onClick={reconnect}>
            <Refresh />
          </IconButton>
        </Box>
      </Box>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Card elevation={3} sx={{ mb: 2, borderRadius: 3 }}>
          <CardContent>
            <Grid container spacing={2} alignItems="center">
              {/* Search Field */}
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Search logs"
                  variant="outlined"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>

              {/* Log Level Filter */}
              <Grid item xs={6} md={2}>
                <FormControl fullWidth variant="outlined">
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
                    <MenuItem value="TRACE">Trace</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {/* Time Range Filter */}
              <Grid item xs={6} md={2}>
                <FormControl fullWidth variant="outlined">
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
                    <MenuItem value="720">Last 12 hours</MenuItem>
                    <MenuItem value="1440">Last 24 hours</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {/* User Filter */}
              <Grid item xs={12} md={4}>
                <FormControl fullWidth variant="outlined">
                  <InputLabel>User Email</InputLabel>
                  <Select
                    label="User Email"
                    value={userEmailFilter}
                    onChange={(e) => setUserEmailFilter(e.target.value)}
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
      </motion.div>


      <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)} indicatorColor="primary" textColor="primary" sx={{ mb: 2 }}>
        <Tab label="Overview" />
        <Tab label="Log Details" />
      </Tabs>

      {renderTabPanel(activeTab)}

      <Typography variant="body2" color="textSecondary" align="center" sx={{ mt: 5 }}>
        Log data is real-time and continuously updated.
      </Typography>
    </Box>
  );
};

export default LogDashboard;
