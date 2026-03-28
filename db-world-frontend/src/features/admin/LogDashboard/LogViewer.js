import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Box, Paper, Typography, Chip, CircularProgress, Fab,
  useTheme, useMediaQuery
} from '@mui/material';
import { KeyboardArrowDown } from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';

const LogViewer = React.memo(({ logs, isLoading, viewMode, onViewModeChange }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const logsEndRef = useRef(null);
  const logsContainerRef = useRef(null);
  const [isScrolledUp, setIsScrolledUp] = useState(false);

  // Optimized scroll handler
  const handleScroll = useCallback(() => {
    const container = logsContainerRef.current;
    if (!container) return;

    const scrollThreshold = 100; // pixels from bottom
    const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + scrollThreshold;
    setIsScrolledUp(!isAtBottom);
  }, []);

  // Auto-scroll with debounce
  const scrollToBottom = useCallback(() => {
    if (!isScrolledUp && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ 
        behavior: 'smooth',
        block: 'nearest'
      });
    }
  }, [isScrolledUp]);

  // Scroll to bottom when new logs arrive
  useEffect(() => {
    scrollToBottom();
  }, [logs, scrollToBottom]);

  const getLevelColor = (level, isError, isWarning) => {
    if (isError) return theme.palette.error.main;
    if (isWarning) return theme.palette.warning.main;
    
    const colors = {
      INFO: theme.palette.info.main,
      DEBUG: theme.palette.primary.main,
    };
    return colors[level] || theme.palette.text.secondary;
  };

  const LogItem = React.memo(({ log }) => (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      exit={{ opacity: 0 }}
    >
      {viewMode === 'raw' ? (
        <Box
          component="pre"
          sx={{
            m: 0.5,
            p: 1,
            backgroundColor: log.isError 
              ? theme.palette.error.light 
              : log.isWarning 
                ? theme.palette.warning.light 
                : theme.palette.info.light,
            borderRadius: 1,
            whiteSpace: 'pre-wrap',
            fontSize: '0.75rem',
            fontFamily: 'Monaco, Consolas, monospace',
            overflowX: 'auto',
          }}
        >
          {log.raw}
        </Box>
      ) : (
        <Box
          sx={{
            mb: 1,
            p: 1.5,
            borderLeft: `4px solid ${getLevelColor(log.level, log.isError, log.isWarning)}`,
            backgroundColor: log.isError 
              ? theme.palette.error.light + '20' 
              : log.isWarning 
                ? theme.palette.warning.light + '20' 
                : theme.palette.info.light + '20',
            borderRadius: '0 8px 8px 0',
            '&:hover': {
              backgroundColor: log.isError 
                ? theme.palette.error.light + '30' 
                : log.isWarning 
                  ? theme.palette.warning.light + '30' 
                  : theme.palette.info.light + '30',
            }
          }}
        >
          {/* Header */}
          <Box display="flex" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={1}>
            <Typography 
              variant="caption" 
              sx={{ 
                fontSize: '0.7rem',
                color: theme.palette.text.secondary,
                fontWeight: 500
              }}
            >
              {log.timestamp}
            </Typography>
            <Chip
              label={log.level}
              size="small"
              sx={{
                backgroundColor: getLevelColor(log.level, log.isError, log.isWarning),
                color: 'white',
                fontSize: '0.65rem',
                fontWeight: 600,
                height: 20
              }}
            />
          </Box>

          {/* Message */}
          <Typography 
            variant="body2" 
            sx={{ 
              mt: 1, 
              fontWeight: log.isError ? 600 : 400,
              fontSize: '0.8rem',
              lineHeight: 1.4,
              color: theme.palette.text.primary
            }}
          >
            [{log.loggerName || 'Unknown Logger'}] {log.message}
            {log?.query && (
              <Box 
                component="span" 
                sx={{ 
                  fontFamily: 'monospace',
                  backgroundColor: theme.palette.grey[100],
                  px: 0.5,
                  borderRadius: 0.5,
                  ml: 0.5
                }}
              >
                {log.query}
              </Box>
            )}
          </Typography>

          {/* Metadata Chips */}
          {(log.user || log.method || log.uri || log.status) && (
            <Box display="flex" flexWrap="wrap" gap={0.5} sx={{ mt: 1 }}>
              {log.user && (
                <Chip
                  label={`👤 ${log.user}`}
                  size="small"
                  variant="outlined"
                  sx={{ fontSize: '0.6rem', height: 20 }}
                />
              )}
              {log.method && (
                <Chip
                  label={`${log.method}`}
                  size="small"
                  variant="outlined"
                  sx={{ fontSize: '0.6rem', height: 20 }}
                />
              )}
              {log.uri && (
                <Chip
                  label={`🌐 ${log.uri}`}
                  size="small"
                  variant="outlined"
                  sx={{ 
                    fontSize: '0.6rem', 
                    height: 20,
                    maxWidth: isMobile ? 120 : 200
                  }}
                  title={log.uri}
                />
              )}
              {log.status && (
                <Chip
                  label={`${log.status}`}
                  size="small"
                  variant="outlined"
                  color={
                    log.status >= 200 && log.status < 300 ? 'success' :
                    log.status >= 400 && log.status < 500 ? 'warning' :
                    log.status >= 500 ? 'error' : 'default'
                  }
                  sx={{ fontSize: '0.6rem', height: 20, fontWeight: 600 }}
                />
              )}
            </Box>
          )}
        </Box>
      )}
    </motion.div>
  ));

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Paper
        elevation={1}
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderRadius: 2
        }}
      >
        {/* Logs Container */}
        <Box
          ref={logsContainerRef}
          onScroll={handleScroll}
          sx={{
            flex: 1,
            overflow: 'auto',
            p: 1,
            '&::-webkit-scrollbar': {
              width: 8,
            },
            '&::-webkit-scrollbar-track': {
              background: theme.palette.grey[100],
            },
            '&::-webkit-scrollbar-thumb': {
              background: theme.palette.grey[400],
              borderRadius: 4,
            },
          }}
        >
          {isLoading ? (
            <Box sx={{
              flex: 1,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              height: '100%'
            }}>
              <CircularProgress size={32} />
            </Box>
          ) : logs.length === 0 ? (
            <Box sx={{
              flex: 1,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              height: '100%',
              flexDirection: 'column',
              gap: 2
            }}>
              <Typography variant="body1" color="textSecondary">
                No logs found
              </Typography>
              <Typography variant="body2" color="textSecondary" align="center">
                Try adjusting your filters or check the connection
              </Typography>
            </Box>
          ) : (
            <AnimatePresence initial={false}>
              {logs.map((log) => (
                <LogItem key={log.logKey} log={log} />
              ))}
            </AnimatePresence>
          )}
          <div ref={logsEndRef} />
        </Box>

        {/* Scroll to bottom FAB */}
        <AnimatePresence>
          {isScrolledUp && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2 }}
            >
              <Fab
                size="small"
                color="primary"
                onClick={() => {
                  scrollToBottom();
                  setIsScrolledUp(false);
                }}
                sx={{
                  position: 'absolute',
                  bottom: 16,
                  right: 16,
                  zIndex: 1000,
                }}
              >
                <KeyboardArrowDown />
              </Fab>
            </motion.div>
          )}
        </AnimatePresence>
      </Paper>
    </Box>
  );
});

export default LogViewer;