import React, {
  useEffect, useMemo, useReducer, useRef, useState, useCallback
} from 'react';
import {
  Box, Paper, Typography, IconButton, Chip,
  TextField, Switch, FormControlLabel,
  Alert, Snackbar, Avatar, Drawer,
  useMediaQuery, useTheme,
  FormControl, InputLabel, Select, MenuItem,
  Divider, Tooltip,
  Button, CircularProgress, RadioGroup, Radio
} from '@mui/material';
import {
  ClearAll, FilterList,
  ErrorOutline, Info, Warning, BugReport,
  PlayArrow, Pause, Search,
  ExpandLess, ExpandMore, SignalCellularAlt,
  Timeline, Refresh, Download, Http,
  Terminal
} from '@mui/icons-material';
import { getLogs } from '@shared/services/ApiServices';

// ------------------------------------------------------------
//  CONFIG
// ------------------------------------------------------------
const REACT_APP_BASEURL = import.meta.env.VITE_API_BASE_URL || '';
const MAX_LOGS = 10000;
const FLUSH_INTERVAL = 200;
const UI_RENDER_CAP = 3000;
const SCROLL_THRESHOLD = 50;

// Base scroll style for the container
const scrollSx = {
  flex: 1,
  overflow: 'auto',
  height: '100%',
  '&::-webkit-scrollbar': { width: '8px', height: '8px' },
  '&::-webkit-scrollbar-track': { background: '#f1f1f1' },
  '&::-webkit-scrollbar-thumb': { background: '#888', borderRadius: '4px' },
  '&::-webkit-scrollbar-thumb:hover': { background: '#555' }
};

const paperBaseSx = {
  p: 1.5,
  transition: 'all 0.2s ease',
  '&:hover': { bgcolor: '#f5f5f5' }
};

const chipBaseSx = {
  fontWeight: 600,
  fontSize: '0.7rem',
  height: 24,
  '& .MuiChip-icon': { ml: 0, mr: 0 }
};

const collapsedTextSx = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  wordBreak: 'break-word'
};

// Style for JSON expanded view
const expandedPreStyle = {
  margin: 0,
  fontSize: 11,
  color: '#d4d4d4',
  fontFamily: 'monospace',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word'
};

// Style for RAW log viewer - like notepad
const rawLogContainerStyle = {
  fontFamily: 'Consolas, Monaco, "Courier New", monospace',
  fontSize: 12,
  lineHeight: 1.5,
  whiteSpace: 'pre',
  overflow: 'auto',
  backgroundColor: '#1e1e1e',
  color: '#d4d4d4',
  padding: '12px',
  borderRadius: '4px',
  margin: 0,
  minWidth: 'min-content',
};

const CONSOLE_COLORS = {
  timestamp: '#6A9955',
  thread: '#9CDCFE',
  logger: '#4EC9B0',
  error: '#F44747',
  warn: '#FFB74D',
  info: '#4FC3F7',
  debug: '#C586C0',
  request: '#81C784',
  default: '#D4D4D4',
  stack: '#CE9178'
};

const detectLevelFromLine = (line) => {
  if (!line) return 'INFO';
  if (line.includes(' ERROR ')) return 'ERROR';
  if (line.includes(' WARN ')) return 'WARN';
  if (line.includes(' DEBUG ')) return 'DEBUG';
  if (line.includes(' REQUEST ')) return 'REQUEST';
  return 'INFO';
};

const LEVELS = [
  { id: 'ERROR', label: 'Error', color: '#f44336', bgColor: '#ffebee', icon: <ErrorOutline fontSize="small" /> },
  { id: 'WARN', label: 'Warning', color: '#ff9800', bgColor: '#fff3e0', icon: <Warning fontSize="small" /> },
  { id: 'INFO', label: 'Info', color: '#2196f3', bgColor: '#e3f2fd', icon: <Info fontSize="small" /> },
  { id: 'DEBUG', label: 'Debug', color: '#9c27b0', bgColor: '#f3e5f5', icon: <BugReport fontSize="small" /> },
  { id: 'REQUEST', label: 'Request', color: '#4caf50', bgColor: '#e8f5e9', icon: <Http fontSize="small" /> }
];

// RAW log row component
const RawLogRow = React.memo(function RawLogRow({ log }) {

  const rawContent = log.raw?.line || log.message || '';

  const levelDetails = getLevelColor(log.level);
  const levelStyle = levelDetails?.color ? { color: levelDetails.color } : {};

  const formattedTime = log.timestamp
    ? new Date(log.timestamp).toLocaleTimeString()
    : '';

  return (
    <Box
      sx={{
        fontFamily: 'Consolas, Monaco, "Courier New", monospace',
        fontSize: 12,
        lineHeight: 1.5,
        px: 2,
        py: 0.5,
        backgroundColor: '#1e1e1e',
        borderBottom: '1px solid #2a2a2a',
        display: 'flex',
        gap: 1,
        alignItems: 'flex-start',
        transition: 'background 0.15s ease',
        '&:hover': {
          backgroundColor: '#252526'
        }
      }}
    >

      {/* Message */}
      <Box
        sx={{
          color: levelStyle.color,
          whiteSpace: 'pre',
          wordBreak: 'break-word',
          flex: 1
        }}
      >
        {rawContent}
      </Box>
    </Box>
  );

}, (prev, next) =>
  prev.log.id === next.log.id &&
  prev.log.timestamp === next.log.timestamp &&
  prev.log.message === next.log.message &&
  prev.log.level === next.log.level
);

// Helper function to get level colors
const getLevelColor = (level) => {
  const colors = {
    ERROR: { color: '#f44336', bgColor: '#ffebee' },
    WARN: { color: '#ff9800', bgColor: '#fff3e0' },
    INFO: { color: '#2196f3', bgColor: '#e3f2fd' },
    DEBUG: { color: '#9c27b0', bgColor: '#f3e5f5' },
    REQUEST: { color: '#4caf50', bgColor: '#e8f5e9' }
  };
  return colors[level] || colors.INFO;
};

const nanoid = () => Math.random().toString(36).slice(2, 9) + Date.now();

const levelMap = Object.fromEntries(LEVELS.map(l => [l.id, l]));

const TIME_WINDOWS = [
  { id: '5m', label: 'Last 5 min', ms: 5 * 60 * 1000 },
  { id: '15m', label: 'Last 15 min', ms: 15 * 60 * 1000 },
  { id: '30m', label: 'Last 30 min', ms: 30 * 60 * 1000 },
  { id: '1h', label: 'Last 1 hour', ms: 60 * 60 * 1000 },
  { id: '3h', label: 'Last 3 hours', ms: 3 * 60 * 60 * 1000 },
  { id: '6h', label: 'Last 6 hours', ms: 6 * 60 * 60 * 1000 },
  { id: '12h', label: 'Last 12 hours', ms: 12 * 60 * 60 * 1000 },
  { id: '24h', label: 'Last 24 hours', ms: 24 * 60 * 60 * 1000 },
  { id: 'all', label: 'All time', ms: null }
];

const SOURCES = [
  { id: 'app', label: 'Application' },
  { id: 'nginx', label: 'Nginx' },
  { id: 'aria2c', label: 'Aria2' }
];

const FORMATS = [
  { id: 'JSON', label: 'JSON (structured)' },
  { id: 'RAW', label: 'RAW (plain text)' }
];

// ------------------------------------------------------------
//  REDUCER
// ------------------------------------------------------------
const initialState = {
  logs: [],
  stats: { total: 0, errors: 0, warnings: 0, infos: 0, debugs: 0, requests: 0 }
};

function reducer(state, action) {
  switch (action.type) {
    case 'BATCH_ADD': {
      // Filter out duplicates based on timestamp and message
      const existingIds = new Set(state.logs.map(log => `${log.timestamp}-${log.message}`));
      const uniqueNewLogs = action.logs.filter(log => 
        !existingIds.has(`${log.timestamp}-${log.message}`)
      );
      
      if (uniqueNewLogs.length === 0) return state;
      
      const newLogs = [...state.logs, ...uniqueNewLogs];
      const trimmedLogs = newLogs.length > MAX_LOGS ? newLogs.slice(-MAX_LOGS) : newLogs;

      const stats = { ...state.stats, total: state.stats.total + uniqueNewLogs.length };
      uniqueNewLogs.forEach(log => {
        const level = log.level?.toUpperCase() || 'INFO';
        if (level === 'REQUEST') {
          stats.requests = (stats.requests || 0) + 1;
        } else {
          const key = level.toLowerCase() + 's';
          stats[key] = (stats[key] || 0) + 1;
        }
      });
      return { logs: trimmedLogs, stats };
    }
    case 'CLEAR':
      return initialState;
    case 'SET_LOGS': {
      const logs = action.logs;
      const trimmedLogs = logs.length > MAX_LOGS ? logs.slice(-MAX_LOGS) : logs;
      const stats = { total: trimmedLogs.length, errors: 0, warnings: 0, infos: 0, debugs: 0, requests: 0 };
      trimmedLogs.forEach(log => {
        const level = log.level?.toUpperCase() || 'INFO';
        if (level === 'REQUEST') {
          stats.requests++;
        } else {
          const key = level.toLowerCase() + 's';
          stats[key]++;
        }
      });
      return { logs: trimmedLogs, stats };
    }
    default:
      return state;
  }
}

// ------------------------------------------------------------
//  LOG ROW (for JSON format)
// ------------------------------------------------------------
const LogRow = React.memo(function LogRow({ log, isExpanded, onToggle }) {
  const level = levelMap[log.level] ?? levelMap.INFO;
  const formattedTime = React.useMemo(
    () => log.timestamp ? new Date(log.timestamp).toLocaleString() : 'No timestamp',
    [log.timestamp]
  );
  
  const prettyJson = React.useMemo(
    () => (isExpanded ? JSON.stringify(log.raw, null, 2) : null),
    [isExpanded, log.raw]
  );
  
  const handleToggle = React.useCallback(
    () => onToggle(log.id),
    [onToggle, log.id]
  );

  const duration = log.raw?.duration;
  const method = log.raw?.method;
  const uri = log.raw?.uri;
  const status = log.raw?.status;
  const user = log.raw?.user;

  return (
    <Box py={0.75} px={1.5}>
      <Paper
        elevation={0}
        sx={{
          ...paperBaseSx,
          borderLeft: `4px solid ${level.color}`,
          bgcolor: isExpanded ? '#fafafa' : 'white'
        }}
      >
        <Box display="flex" gap={1.5} alignItems="flex-start">
          <Chip
            icon={level.icon}
            label={log.level}
            size="small"
            sx={{
              ...chipBaseSx,
              bgcolor: level.bgColor,
              color: level.color,
              '& .MuiChip-icon': { color: level.color, mr: 0 }
            }}
          />

          <Box flex={1} minWidth={0}>
            <Typography
              variant="body2"
              fontWeight={600}
              sx={isExpanded ? { wordBreak: 'break-word' } : collapsedTextSx}
            >
              {log.message || 'No message'}
            </Typography>

            <Box display="flex" gap={1} alignItems="center" mt={0.5} flexWrap="wrap">
              <Typography variant="caption" color="text.secondary">
                {formattedTime}
              </Typography>

              {log.raw?.logger && (
                <Chip
                  label={log.raw.logger.split('.').pop()}
                  size="small"
                  variant="outlined"
                  sx={{ height: 20, fontSize: '0.65rem' }}
                />
              )}

              {user && user !== 'Anonymous' && (
                <Chip
                  label={user}
                  size="small"
                  variant="outlined"
                  sx={{ height: 20, fontSize: '0.65rem' }}
                />
              )}

              {method && (
                <Chip
                  label={method}
                  size="small"
                  sx={{ 
                    height: 20, 
                    fontSize: '0.65rem',
                    bgcolor: '#e3f2fd',
                    color: '#1976d2'
                  }}
                />
              )}

              {status && (
                <Chip
                  label={status}
                  size="small"
                  sx={{ 
                    height: 20, 
                    fontSize: '0.65rem',
                    bgcolor: status >= 400 ? '#ffebee' : '#e8f5e9',
                    color: status >= 400 ? '#d32f2f' : '#2e7d32'
                  }}
                />
              )}

              {duration && (
                <Chip
                  label={`${duration}ms`}
                  size="small"
                  sx={{ height: 20, fontSize: '0.65rem' }}
                />
              )}
            </Box>

            {isExpanded && (
              <Box mt={1.5} p={1.5} bgcolor="#1e1e1e" borderRadius={1} sx={{ overflow: 'auto' }}>
                <pre style={expandedPreStyle}>
                  {prettyJson}
                </pre>
              </Box>
            )}
          </Box>

          <IconButton
            size="small"
            onClick={handleToggle}
            sx={{ flexShrink: 0, bgcolor: isExpanded ? 'action.selected' : 'transparent' }}
          >
            {isExpanded ? <ExpandLess /> : <ExpandMore />}
          </IconButton>
        </Box>
      </Paper>
    </Box>
  );
},
(prev, next) =>
  prev.isExpanded === next.isExpanded &&
  prev.log.id === next.log.id &&
  prev.log.timestamp === next.log.timestamp &&
  prev.log.message === next.log.message &&
  prev.log.level === next.log.level
);

// ------------------------------------------------------------
//  MAIN COMPONENT
// ------------------------------------------------------------
export default function LogDashboard() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // ----- State -----
  const [state, dispatch] = useReducer(reducer, initialState);
  const { logs, stats } = state;

  const [search, setSearch] = useState('');
  const [selectedLevel, setSelectedLevel] = useState('INFO');
  const [source, setSource] = useState('app');
  const [logFormat, setLogFormat] = useState('JSON');
  const [paused, setPaused] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [expanded, setExpanded] = useState({});
  const [notification, setNotification] = useState(null);
  const [showFilters, setShowFilters] = useState(!isMobile);
  const [timeWindowId, setTimeWindowId] = useState('24h');
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [isHistoryLoaded, setIsHistoryLoaded] = useState(false);

  // ----- Refs -----
  const eventSourceRef = useRef(null);
  const bufferRef = useRef([]);
  const logsContainerRef = useRef(null);
  const abortControllerRef = useRef(null);
  const isScrollingRef = useRef(false);
  const isMountedRef = useRef(true);
  const lastTimestampRef = useRef(0);
  const pendingConfigRef = useRef({ source, level: selectedLevel, format: logFormat });

  // Update pending config when filters change
  useEffect(() => {
    pendingConfigRef.current = { source, level: selectedLevel, format: logFormat };
  }, [source, selectedLevel, logFormat]);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      closeSSE();
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // ----- FILTERS -----
  const cutoff = useMemo(() => {
    const window = TIME_WINDOWS.find(w => w.id === timeWindowId);
    return window?.ms ? Date.now() - window.ms : null;
  }, [timeWindowId]);

  const levelSet = useMemo(
    () => new Set([selectedLevel]),
    [selectedLevel]
  );

  // --- Scroll position monitoring ---
  const handleScroll = useCallback(() => {
    if (!logsContainerRef.current || isScrollingRef.current) return;
    
    isScrollingRef.current = true;
    requestAnimationFrame(() => {
      if (!logsContainerRef.current) {
        isScrollingRef.current = false;
        return;
      }
      
      const { scrollTop, scrollHeight, clientHeight } = logsContainerRef.current;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      const atBottom = distanceFromBottom <= SCROLL_THRESHOLD;
      
      if (atBottom !== isAtBottom && isMountedRef.current) {
        setIsAtBottom(atBottom);
      }
      isScrollingRef.current = false;
    });
  }, [isAtBottom]);

  // Add scroll listener
  useEffect(() => {
    const container = logsContainerRef.current;
    if (!container) return;

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  // --- Filtered logs - optimized with pre-sorted assumption ---
  const filteredLogs = useMemo(() => {
    const term = search.toLowerCase().trim();
    const out = [];

    // Logs are already sorted by timestamp from the reducer
    for (let i = 0; i < logs.length; i++) {
      const log = logs[i];
      if (!levelSet.has(log.level)) continue;
      
      // Apply time filter if cutoff exists
      if (cutoff) {
        const logTime = log.normalizedTime || log.ts;
        if (logTime < cutoff) continue;
      }
      
      // Apply search filter
      if (term) {
        const searchable = log._search || 
                          log.message?.toLowerCase() || '';
        if (!searchable.includes(term)) continue;
      }
      
      out.push(log);
    }

    return out;
  }, [logs, levelSet, search, cutoff]);

  const visibleLogs = useMemo(() => {
    if (filteredLogs.length <= UI_RENDER_CAP) return filteredLogs;
    return filteredLogs.slice(-UI_RENDER_CAP);
  }, [filteredLogs]);

  // ----- AUTO SCROLL -----
  useEffect(() => {
    if (autoScroll && !paused && isAtBottom && logsContainerRef.current && visibleLogs.length > 0) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [visibleLogs.length, autoScroll, paused, isAtBottom]);

  // ----- FLUSH BUFFER -----
  useEffect(() => {
    const interval = setInterval(() => {
      if (bufferRef.current.length > 0 && isMountedRef.current) {
        dispatch({ type: 'BATCH_ADD', logs: bufferRef.current });
        bufferRef.current = [];
      }
    }, FLUSH_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  // ----- Helper: parse log entry with normalized timestamp -----
  const parseLogEntry = useCallback((entry, levelFromPath) => {

    // Handle RAW format (string)
    if (typeof entry === 'string') {
      const now = Date.now();
      return {
        id: nanoid(),
        level: levelFromPath,
        message: entry,
        timestamp: new Date().toISOString(),
        ts: now,
        normalizedTime: now,
        raw: { line: entry },
        _search: entry.toLowerCase()
      };
    }
    
    // Handle JSON format (object)
    const timestamp = entry.timestamp;
    const ts = timestamp ? new Date(timestamp).getTime() : Date.now();
    
    // Determine level
    let level = entry.level || levelFromPath;
    if (entry.method || entry.uri || entry.requestId) {
      level = 'REQUEST';
    }
    
    // Build message
    let message = entry.message || '';
    if (!message && entry.method && entry.uri) {
      message = `${entry.method} ${entry.uri}`;
      if (entry.status) message += ` ${entry.status}`;
      if (entry.duration) message += ` (${entry.duration}ms)`;
    }
    
    // Create searchable text
    const searchable = [
      message,
      entry.user,
      entry.method,
      entry.uri,
      entry.status,
      entry.logger,
      entry.thread
    ].filter(Boolean).join(' ').toLowerCase();

    return {
      id: nanoid(),
      level,
      message,
      timestamp,
      ts,
      normalizedTime: ts,
      raw: entry,
      _search: searchable
    };
  }, []);

  // ----- FETCH HISTORY (ALWAYS FIRST) -----
  const fetchHistory = useCallback(async () => {
    if (!selectedLevel || !isMountedRef.current) return;

    // Close SSE first
    closeSSE();
    
    setLoadingHistory(true);
    setConnectionStatus('connecting');
    setIsHistoryLoaded(false);

    // Cancel any ongoing fetch
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      const window = TIME_WINDOWS.find(w => w.id === timeWindowId);
      const params = { format: logFormat };
      
      if (window?.ms) {
        params.minutes = Math.floor(window.ms / 60000);
      } else {
        params.lines = 500;
      }

      const url = `${REACT_APP_BASEURL}/api/logs/${source}/${selectedLevel}`;
      const response = await getLogs(url, params, abortControllerRef.current.signal);
      
      if (!isMountedRef.current) return;
      
      // Handle response structure
      const data = response?.data || [];
      const parsedLogs = data.filter(item => item!=null).map(item => parseLogEntry(item, selectedLevel));
      
      // Update last timestamp for deduplication
      if (parsedLogs.length > 0) {
        lastTimestampRef.current = Math.max(...parsedLogs.map(l => l.normalizedTime));
      }
      
      dispatch({ type: 'SET_LOGS', logs: parsedLogs });
      setConnectionStatus('connected');
      setIsHistoryLoaded(true);
      
      setNotification({ 
        type: 'success', 
        message: `Loaded ${parsedLogs.length} logs` 
      });
      
      setExpanded({});
    } catch (err) {
      if (!err.code?.includes('abort') && isMountedRef.current) {
        console.error('Failed to fetch logs:', err);
        setConnectionStatus('error');
        setNotification({ 
          type: 'error', 
          message: 'Failed to load logs' 
        });
      }
    } finally {
      if (isMountedRef.current) {
        setLoadingHistory(false);
      }
      abortControllerRef.current = null;
    }
  }, [selectedLevel, source, logFormat, timeWindowId, parseLogEntry]);

  // ----- SSE Management (ONLY AFTER HISTORY) -----
  const openSSE = useCallback(() => {
    if (paused || !selectedLevel || !isHistoryLoaded || !isMountedRef.current) return;

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    setConnectionStatus('connecting');

    const url = `${REACT_APP_BASEURL}/api/logs/${source}/${selectedLevel}/follow?format=${logFormat}`;
    const es = new EventSource(url, { withCredentials: true });

    es.onopen = () => {
      if (isMountedRef.current) {
        // console.log(`SSE connected for ${selectedLevel}`);
        setConnectionStatus('connected');
      }
    };

    es.addEventListener('log', (event) => {
      if (paused || !isMountedRef.current || !isHistoryLoaded) return;
      
      try {
        let logEntry;
        if (logFormat === 'RAW') {
          logEntry = parseLogEntry(event.data, selectedLevel);
        } else {
          const data = JSON.parse(event.data);
          logEntry = parseLogEntry(data, selectedLevel);
        }
        
        // Deduplicate based on timestamp
        if (logEntry.normalizedTime > lastTimestampRef.current) {
          bufferRef.current.push(logEntry);
          lastTimestampRef.current = logEntry.normalizedTime;
        }
      } catch (err) {
        console.error('Error processing SSE log:', err);
      }
    });

    es.onerror = (err) => {
      if (isMountedRef.current) {
        console.error(`SSE error for ${selectedLevel}:`, err);
        setConnectionStatus('error');
      }
    };

    eventSourceRef.current = es;
  }, [selectedLevel, source, logFormat, paused, isHistoryLoaded, parseLogEntry]);

  const closeSSE = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (isMountedRef.current) {
      setConnectionStatus('disconnected');
    }
  }, []);

  // Effect to fetch history when filters change
  useEffect(() => {
    const currentConfig = pendingConfigRef.current;
    if (
      currentConfig.source !== source ||
      currentConfig.level !== selectedLevel ||
      currentConfig.format !== logFormat
    ) {
      return; // Skip if config is still pending
    }

    fetchHistory();
  }, [source, selectedLevel, logFormat, timeWindowId, fetchHistory]);

  // Effect to open SSE AFTER history is loaded
  useEffect(() => {
    if (!isHistoryLoaded || paused) {
      closeSSE();
      return;
    }

    openSSE();

    return () => {
      closeSSE();
    };
  }, [isHistoryLoaded, paused, source, selectedLevel, logFormat, openSSE, closeSSE]);

  // ----- HANDLERS -----
  const handleToggleExpand = useCallback((id) => 
    setExpanded(prev => ({ ...prev, [id]: !prev[id] })), []);

  const handleClearLogs = useCallback(() => {
    dispatch({ type: 'CLEAR' });
    lastTimestampRef.current = 0;
    setNotification({ type: 'info', message: 'All logs cleared' });
    setExpanded({});
  }, []);

  const handleLevelChange = useCallback((event) => {
    setSelectedLevel(event.target.value);
    setIsHistoryLoaded(false); // Reset history loaded state
  }, []);

  const handleSourceChange = useCallback((e) => {
    setSource(e.target.value);
    setIsHistoryLoaded(false);
  }, []);

  const handleFormatChange = useCallback((e) => {
    setLogFormat(e.target.value);
    setIsHistoryLoaded(false);
  }, []);

  const handleTimeWindowChange = useCallback((e) => {
    setTimeWindowId(e.target.value);
    setIsHistoryLoaded(false);
  }, []);

  const handleManualReconnect = useCallback(() => {
    closeSSE();
    fetchHistory();
  }, [closeSSE, fetchHistory]);

  const handleRequestHistory = useCallback(() => {
    fetchHistory();
  }, [fetchHistory]);

  // ----- MEMOIZED UI BLOCKS -----
  const filtersPanel = useMemo(() => (
    <Box height="100%" display="flex" flexDirection="column">
      <Box p={2} flex={1}>
        <Typography variant="subtitle2" fontWeight={700} mb={2}>Filters</Typography>

        <FormControl fullWidth size="small" sx={{ mb: 2 }}>
          <InputLabel>Source</InputLabel>
          <Select
            value={source}
            label="Source"
            onChange={handleSourceChange}
          >
            {SOURCES.map(s => <MenuItem key={s.id} value={s.id}>{s.label}</MenuItem>)}
          </Select>
        </FormControl>

        <FormControl fullWidth size="small" sx={{ mb: 2 }}>
          <InputLabel>Format</InputLabel>
          <Select
            value={logFormat}
            label="Format"
            onChange={handleFormatChange}
          >
            {FORMATS.map(f => <MenuItem key={f.id} value={f.id}>{f.label}</MenuItem>)}
          </Select>
        </FormControl>

        <TextField
          fullWidth
          size="small"
          placeholder="Search logs..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{ startAdornment: <Search sx={{ mr: 1, color: 'action.active', fontSize: 20 }} /> }}
          sx={{ mb: 3 }}
        />

        <Box mb={3}>
          <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" mb={1}>
            Time Window
          </Typography>
          <Select
            fullWidth
            size="small"
            value={timeWindowId}
            onChange={handleTimeWindowChange}
          >
            {TIME_WINDOWS.map(w => <MenuItem key={w.id} value={w.id}>{w.label}</MenuItem>)}
          </Select>
          <Button
            size="small"
            variant="outlined"
            onClick={handleRequestHistory}
            disabled={loadingHistory || connectionStatus === 'connecting'}
            startIcon={loadingHistory ? <CircularProgress size={16} /> : <Refresh />}
            fullWidth
            sx={{ mt: 1 }}
          >
            {loadingHistory ? 'Loading...' : 'Load History'}
          </Button>
        </Box>

        <Box mb={3}>
          <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" mb={1}>
            Log Level (select one)
          </Typography>
          <RadioGroup
            value={selectedLevel}
            onChange={handleLevelChange}
          >
            {LEVELS.map(level => (
              <FormControlLabel
                key={level.id}
                value={level.id}
                control={<Radio size="small" />}
                label={
                  <Box display="flex" alignItems="center" gap={1}>
                    <Box sx={{ color: level.color }}>{level.icon}</Box>
                    <Typography variant="body2">{level.label}</Typography>
                  </Box>
                }
                sx={{
                  mb: 0.5,
                  p: 0.5,
                  borderRadius: 1,
                  bgcolor: selectedLevel === level.id ? level.bgColor : 'transparent',
                  '&:hover': { bgcolor: level.bgColor }
                }}
              />
            ))}
          </RadioGroup>
        </Box>

        <Box mb={2}>
          <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" mb={1}>Display</Typography>
          <FormControlLabel
            control={<Switch checked={autoScroll} onChange={(e) => setAutoScroll(e.target.checked)} size="small" />}
            label={<Typography variant="body2">Auto-scroll (when at bottom)</Typography>}
            sx={{ mb: 0.5 }}
          />
          <FormControlLabel
            control={<Switch checked={paused} onChange={(e) => setPaused(e.target.checked)} size="small" />}
            label={<Typography variant="body2">Pause updates</Typography>}
          />
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
            {isAtBottom ? '📍 At bottom' : '⬆️ Scrolled up'}
          </Typography>
        </Box>

        <Divider sx={{ my: 2 }} />

        <Box>
          <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" mb={1}>Connection</Typography>
          <Box display="flex" alignItems="center" gap={1} mb={1}>
            <Box sx={{
              width: 8, height: 8, borderRadius: '50%',
              bgcolor: connectionStatus === 'connected' ? '#4caf50' :
                connectionStatus === 'connecting' ? '#ff9800' : '#f44336'
            }} />
            <Typography variant="caption">
              {connectionStatus === 'connected' ? 'Connected' :
                connectionStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}
            </Typography>
          </Box>
          {connectionStatus !== 'connected' && (
            <Button
              size="small"
              variant="outlined"
              startIcon={<Refresh />}
              onClick={handleManualReconnect}
              fullWidth
              sx={{ mt: 1 }}
            >
              Reconnect
            </Button>
          )}
          <Typography variant="caption" color="text.secondary" display="block" mt={2}>
            Logs: {logs.length} total
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block">
            Filtered: {filteredLogs.length}
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block">
            Requests: {stats.requests || 0}
          </Typography>
        </Box>
      </Box>
    </Box>
  ), [
    source, logFormat, search, timeWindowId, loadingHistory, connectionStatus,
    selectedLevel, autoScroll, paused, isAtBottom, logs.length, filteredLogs.length,
    stats.requests, handleRequestHistory, handleLevelChange, handleManualReconnect,
    handleSourceChange, handleFormatChange, handleTimeWindowChange
  ]);

  // Stats bar
  const statsBar = useMemo(() => (
    <Box display="flex" gap={2} mt={1.5} flexWrap="wrap">
      {LEVELS.map(level => (
        <Box key={level.id} display="flex" alignItems="center" gap={0.5}>
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: level.color }} />
          <Typography variant="caption">
            {level.label}: {stats[level.id.toLowerCase() + 's'] || 0}
          </Typography>
        </Box>
      ))}
    </Box>
  ), [stats]);

  // Logs list
  const logsList = useMemo(() => {
    if (visibleLogs.length > 0) {
      return (
        <Box 
          ref={logsContainerRef} 
          sx={{
            ...scrollSx,
            borderRight: `1px solid ${logFormat === 'RAW' ? '#333' : '#ddd'}`,
            bgcolor: logFormat === 'RAW' ? '#1e1e1e' : 'white',
          }}
        >
          {visibleLogs.map((log) => {
            if (logFormat === 'RAW') {
              return <RawLogRow key={log.id} log={log} />;
            } else {
              return (
                <LogRow
                  key={log.id}
                  log={log}
                  isExpanded={expanded[log.id] === true}
                  onToggle={handleToggleExpand}
                />
              );
            }
          })}
          {filteredLogs.length > UI_RENDER_CAP && (
            <Box textAlign="center" py={1} sx={{ bgcolor: logFormat === 'RAW' ? '#1e1e1e' : 'white' }}>
              <Typography variant="caption" sx={{ color: logFormat === 'RAW' ? '#888' : 'text.secondary' }}>
                Showing last {UI_RENDER_CAP.toLocaleString()} of {filteredLogs.length.toLocaleString()} logs
              </Typography>
            </Box>
          )}
        </Box>
      );
    }

    return (
      <Box 
        ref={logsContainerRef}
        display="flex" 
        alignItems="center" 
        justifyContent="center" 
        height="100%"
        sx={{ bgcolor: logFormat === 'RAW' ? '#1e1e1e' : 'white' }}
      >
        <Box textAlign="center">
          {logFormat === 'RAW' ? (
            <Terminal sx={{ fontSize: 48, color: '#888', mb: 2 }} />
          ) : (
            <Timeline sx={{ fontSize: 48, color: 'action.disabled', mb: 2 }} />
          )}
          <Typography 
            color={logFormat === 'RAW' ? '#888' : 'text.secondary'} 
            variant="h6" 
            gutterBottom
          >
            {logs.length === 0 ? 'No logs received yet' : 'No logs match your filters'}
          </Typography>
          {logs.length === 0 && connectionStatus === 'connected' && (
            <Button variant="contained" size="small" onClick={handleRequestHistory} sx={{ mt: 2 }}>
              Load History
            </Button>
          )}
          {connectionStatus !== 'connected' && (
            <Button variant="outlined" size="small" onClick={handleManualReconnect} startIcon={<Refresh />} sx={{ mt: 2 }}>
              Connect to Server
            </Button>
          )}
          {connectionStatus === 'connecting' && (
            <Box display="flex" alignItems="center" justifyContent="center" gap={1} mt={2}>
              <CircularProgress size={20} />
              <Typography variant="body2" color={logFormat === 'RAW' ? '#888' : 'text.secondary'}>
                Connecting to server...
              </Typography>
            </Box>
          )}
        </Box>
      </Box>
    );
  }, [
    visibleLogs, expanded, handleToggleExpand, filteredLogs.length,
    logs.length, connectionStatus, handleRequestHistory, handleManualReconnect,
    logFormat
  ]);

  // Render
  return (
    <Box height="100vh" display="flex" flexDirection="column" bgcolor="#fafafa">
      {/* Header */}
      <Paper
        elevation={0}
        sx={{
          p: isMobile ? 1.5 : 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
          borderRadius: 0,
          bgcolor: 'white'
        }}
      >
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={1.5}>
            <Avatar
              sx={{
                bgcolor: connectionStatus === 'connected' ? '#4caf50' : '#f44336',
                width: isMobile ? 36 : 40,
                height: isMobile ? 36 : 40
              }}
            >
              {logFormat === 'RAW' ? <Terminal /> : <SignalCellularAlt />}
            </Avatar>
            <Box>
              <Typography variant={isMobile ? "subtitle1" : "h6"} fontWeight={700}>
                Log Analytics {logFormat === 'RAW' ? '(RAW)' : ''}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {connectionStatus === 'connected' ? 'Live' : 'Offline'} • Level: {selectedLevel} • {filteredLogs.length} logs
                {!isHistoryLoaded && ' (loading history...)'}
              </Typography>
            </Box>
          </Box>
          <Box display="flex" gap={0.5}>
            <Tooltip title={paused ? "Resume" : "Pause"}>
              <IconButton
                size={isMobile ? "small" : "medium"}
                onClick={() => setPaused(!paused)}
                sx={{
                  bgcolor: paused ? 'primary.main' : 'transparent',
                  color: paused ? 'white' : 'inherit',
                  '&:hover': { bgcolor: paused ? 'primary.dark' : 'action.hover' }
                }}
              >
                {paused ? <PlayArrow /> : <Pause />}
              </IconButton>
            </Tooltip>
            <Tooltip title="Clear logs">
              <IconButton size={isMobile ? "small" : "medium"} onClick={handleClearLogs}>
                <ClearAll />
              </IconButton>
            </Tooltip>
            <Tooltip title="Export logs">
              <IconButton size={isMobile ? "small" : "medium"}>
                <Download />
              </IconButton>
            </Tooltip>
            {isMobile && (
              <Tooltip title="Filters">
                <IconButton
                  size="small"
                  onClick={() => setShowFilters(true)}
                  sx={{
                    bgcolor: showFilters ? 'primary.main' : 'transparent',
                    color: showFilters ? 'white' : 'inherit'
                  }}
                >
                  <FilterList />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </Box>
        {statsBar}
      </Paper>

      {/* Main content */}
      <Box display="flex" flex={1} overflow="hidden">
        {/* Desktop filters */}
        <Box
          width={280}
          flexShrink={0}
          borderRight="1px solid"
          borderColor="divider"
          bgcolor="white"
          overflow="auto"
          sx={{ display: !isMobile && showFilters ? 'block' : 'none' }}
        >
          {filtersPanel}
        </Box>

        {/* Log list */}
        <Box flex={1} display="flex" flexDirection="column" overflow="hidden" borderRadius={1}>
          {logsList}
        </Box>
      </Box>

      {/* Mobile filter drawer */}
      <Drawer
        anchor="right"
        open={isMobile && showFilters}
        onClose={() => setShowFilters(false)}
        PaperProps={{ sx: { width: '85%', maxWidth: 320 } }}
      >
        <Box display="flex" justifyContent="flex-end" p={1}>
          <IconButton onClick={() => setShowFilters(false)} size="small">
            <ClearAll />
          </IconButton>
        </Box>
        {filtersPanel}
      </Drawer>

      {/* Notifications */}
      <Snackbar
        open={!!notification}
        autoHideDuration={notification?.autoHideDuration || 4000}
        onClose={() => setNotification(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          severity={notification?.type || 'info'}
          onClose={() => setNotification(null)}
          sx={{ borderRadius: 2 }}
        >
          {notification?.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}