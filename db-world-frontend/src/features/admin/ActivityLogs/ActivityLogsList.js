import React, { useCallback, useMemo, useState } from 'react';
import {
  Box,
  List,
  ListItem,
  Typography,
  Chip,
  CircularProgress,
  Alert,
  useTheme,
  useMediaQuery,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Tab,
  Tabs,
  Paper,
  Stack,
  TextField
} from '@mui/material';
import {
  Visibility as VisibilityIcon,
  Code as CodeIcon,
  Schedule as ScheduleIcon,
  Person as PersonIcon,
  Computer as ComputerIcon,
  Close as CloseIcon,
  ContentCopy as CopyIcon,
  Download as DownloadIcon
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { useInView } from 'react-intersection-observer';

// Styled components
const LogsContainer = styled(Box)(({ theme }) => ({
  position: 'relative',
  minHeight: 400,
}));

const LogItem = styled(ListItem)(({ theme }) => ({
  padding: theme.spacing(3),
  marginBottom: theme.spacing(2),
  background: 'white',
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: 16,
  transition: 'all 0.3s ease',
  cursor: 'pointer',
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: '0 8px 25px 0 rgba(0,0,0,0.1)',
    borderColor: theme.palette.primary.light,
  },
  '&.highlight': {
    background: 'linear-gradient(45deg, #e3f2fd, #f3e5f5)',
    borderColor: theme.palette.primary.main,
  },
}));

const DetailDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiDialog-paper': {
    borderRadius: 16,
    background: 'linear-gradient(145deg, #f8fbff, #ffffff)',
    maxHeight: '90vh',
  },
}));

const CodeBlock = styled(Paper)(({ theme }) => ({
  background: '#1e1e1e',
  color: '#d4d4d4',
  borderRadius: 8,
  padding: theme.spacing(2),
  fontFamily: 'Monaco, Consolas, "Courier New", monospace',
  fontSize: '0.875rem',
  overflow: 'auto',
  maxHeight: '400px',
  marginTop: theme.spacing(2),
  '& pre': {
    margin: 0,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
  },
}));

const JsonKey = styled('span')(({ theme }) => ({
  color: '#9cdcfe',
}));

const JsonString = styled('span')(({ theme }) => ({
  color: '#ce9178',
}));

const JsonNumber = styled('span')(({ theme }) => ({
  color: '#b5cea8',
}));

const JsonBoolean = styled('span')(({ theme }) => ({
  color: '#569cd6',
}));

const JsonNull = styled('span')(({ theme }) => ({
  color: '#569cd6',
}));

const TabPanel = ({ children, value, index, ...other }) => (
  <div
    role="tabpanel"
    hidden={value !== index}
    id={`log-detail-tabpanel-${index}`}
    aria-labelledby={`log-detail-tab-${index}`}
    {...other}
  >
    {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
  </div>
);

// MethodChip, StatusChip, DurationChip components remain the same...
const MethodChip = styled(Chip)(({ method, theme }) => {
  const colors = {
    GET: { bg: '#e8f5e8', color: '#2e7d32' },
    POST: { bg: '#e3f2fd', color: '#1565c0' },
    PUT: { bg: '#fff3e0', color: '#ef6c00' },
    DELETE: { bg: '#ffebee', color: '#c62828' },
    PATCH: { bg: '#f3e5f5', color: '#7b1fa2' },
  };

  const colorSet = colors[method] || { bg: '#f5f5f5', color: '#616161' };

  return {
    backgroundColor: colorSet.bg,
    color: colorSet.color,
    fontWeight: 'bold',
    minWidth: 70,
    borderRadius: 8,
  };
});

const StatusChip = styled(Chip)(({ status, theme }) => {
  let color = '#616161';
  let bgColor = '#f5f5f5';

  if (status >= 200 && status < 300) {
    color = '#2e7d32';
    bgColor = '#e8f5e8';
  } else if (status >= 400 && status < 500) {
    color = '#ef6c00';
    bgColor = '#fff3e0';
  } else if (status >= 500) {
    color = '#c62828';
    bgColor = '#ffebee';
  }

  return {
    backgroundColor: bgColor,
    color: color,
    fontWeight: 'bold',
    borderRadius: 8,
  };
});

const DurationChip = styled(Chip)(({ duration, theme }) => {
  let color = '#616161';
  let bgColor = '#f5f5f5';

  if (duration > 1000) {
    color = '#c62828';
    bgColor = '#ffebee';
  } else if (duration > 500) {
    color = '#ef6c00';
    bgColor = '#fff3e0';
  } else {
    color = '#2e7d32';
    bgColor = '#e8f5e8';
  }

  return {
    backgroundColor: bgColor,
    color: color,
    borderRadius: 8,
  };
});

// Custom JSON formatter component
const JsonFormatter = ({ data }) => {
  const formatJson = (obj, indent = 0) => {
    if (obj === null) {
      return <JsonNull>null</JsonNull>;
    }
    
    if (typeof obj === 'boolean') {
      return <JsonBoolean>{obj.toString()}</JsonBoolean>;
    }
    
    if (typeof obj === 'number') {
      return <JsonNumber>{obj}</JsonNumber>;
    }
    
    if (typeof obj === 'string') {
      // Try to parse as JSON if it looks like JSON
      if (obj.trim().startsWith('{') || obj.trim().startsWith('[')) {
        try {
          const parsed = JSON.parse(obj);
          return formatJson(parsed, indent);
        } catch {
          // If it's not valid JSON, treat as regular string
          return <JsonString>"{obj}"</JsonString>;
        }
      }
      return <JsonString>"{obj}"</JsonString>;
    }
    
    if (Array.isArray(obj)) {
      if (obj.length === 0) {
        return <span>[]</span>;
      }
      return (
        <div>
          <span>[</span>
          <div style={{ marginLeft: (indent + 1) * 20 }}>
            {obj.map((item, index) => (
              <div key={index}>
                {formatJson(item, indent + 1)}
                {index < obj.length - 1 ? ',' : ''}
              </div>
            ))}
          </div>
          <span>]</span>
        </div>
      );
    }
    
    if (typeof obj === 'object') {
      const keys = Object.keys(obj);
      if (keys.length === 0) {
        return <span>{"{}"}</span>;
      }
      return (
        <div>
          <span>{"{"}</span>
          <div style={{ marginLeft: (indent + 1) * 20 }}>
            {keys.map((key, index) => (
              <div key={key}>
                <JsonKey>"{key}"</JsonKey>: {formatJson(obj[key], indent + 1)}
                {index < keys.length - 1 ? ',' : ''}
              </div>
            ))}
          </div>
          <span>{"}"}</span>
        </div>
      );
    }
    
    return <span>{String(obj)}</span>;
  };

  return (
    <CodeBlock>
      <pre>{formatJson(data)}</pre>
    </CodeBlock>
  );
};

const ActivityLogsList = ({ logs, loading, loadingMore, hasMore, onLoadMore }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);
  const [tabValue, setTabValue] = useState(0);

  const { ref: loadMoreRef, inView } = useInView({
    threshold: 0,
    rootMargin: '100px',
  });

  const formatTimestamp = useCallback((timestamp) => {
    return new Date(timestamp).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }, []);

  const formatDuration = useCallback((duration) => {
    return `${duration}ms`;
  }, []);

  const getStatusText = useCallback((status) => {
    const statusMap = {
      200: 'OK',
      201: 'Created',
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      500: 'Internal Server Error',
    };
    return statusMap[status] || 'Unknown';
  }, []);

  const handleViewDetails = useCallback((log) => {
    setSelectedLog(log);
    setTabValue(0);
    setDetailDialogOpen(true);
  }, []);

  const handleViewRawData = useCallback((log) => {
    setSelectedLog(log);
    setTabValue(1);
    setDetailDialogOpen(true);
  }, []);

  const handleCloseDialog = useCallback(() => {
    setDetailDialogOpen(false);
    setSelectedLog(null);
  }, []);

  const handleTabChange = useCallback((event, newValue) => {
    setTabValue(newValue);
  }, []);

  const copyToClipboard = useCallback((text) => {
    navigator.clipboard.writeText(text).then(() => {
      // You can add a toast notification here
      //console.log('Copied to clipboard');
    });
  }, []);

  const downloadLog = useCallback((log) => {
    const dataStr = JSON.stringify(log, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `log-${log.id}-${new Date().getTime()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  const formatRequestBody = useCallback((requestBody) => {
    if (!requestBody) return null;
    
    try {
      // Try to parse as JSON
      const parsed = JSON.parse(requestBody);
      return <JsonFormatter data={parsed} />;
    } catch {
      // If not JSON, display as plain text
      return (
        <Paper sx={{ p: 2, mt: 1, background: '#f5f5f5' }}>
          <Typography variant="body2" fontFamily="monospace">
            {requestBody}
          </Typography>
        </Paper>
      );
    }
  }, []);

  // Auto load more when scrolled to bottom
  React.useEffect(() => {
    if (inView && hasMore && !loadingMore && !loading) {
      onLoadMore();
    }
  }, [inView, hasMore, loadingMore, loading, onLoadMore]);

  const memoizedLogs = useMemo(() => logs, [logs]);

  if (loading && memoizedLogs.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
        <CircularProgress size={60} />
      </Box>
    );
  }

  if (memoizedLogs.length === 0 && !loading) {
    return (
      <Alert 
        severity="info" 
        sx={{ 
          borderRadius: 3,
          background: 'linear-gradient(45deg, #e3f2fd, #f3e5f5)',
        }}
      >
        No activity logs found. Try adjusting your filters.
      </Alert>
    );
  }

  return (
    <>
      <LogsContainer>
        <List disablePadding>
          {memoizedLogs.map((log, index) => (
            <LogItem 
              key={`${log.id}-${index}`}
              className={index % 5 === 0 ? 'highlight' : ''}
            >
              <Box width="100%">
                {/* Header Section */}
                <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                  <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
                    <MethodChip 
                      label={log.method} 
                      method={log.method}
                      size={isMobile ? "small" : "medium"}
                    />
                    <StatusChip 
                      label={`${log.status} - ${getStatusText(log.status)}`}
                      status={log.status}
                      size={isMobile ? "small" : "medium"}
                    />
                    <DurationChip 
                      label={formatDuration(log.duration)}
                      duration={log.duration}
                      size={isMobile ? "small" : "medium"}
                    />
                  </Box>
                  <Box display="flex" gap={1}>
                    <Tooltip title="View Details">
                      <IconButton 
                        size="small" 
                        color="primary"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewDetails(log);
                        }}
                      >
                        <VisibilityIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="View Raw Data">
                      <IconButton 
                        size="small" 
                        color="secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewRawData(log);
                        }}
                      >
                        <CodeIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>

                {/* URI and Query */}
                <Typography 
                  variant="h6" 
                  component="div" 
                  fontWeight="600"
                  sx={{ 
                    wordBreak: 'break-all',
                    mb: 1
                  }}
                >
                  {log.uri}
                  {log.query && (
                    <Typography 
                      component="span" 
                      variant="body2" 
                      color="text.secondary"
                      sx={{ ml: 1 }}
                    >
                      {log.query}
                    </Typography>
                  )}
                </Typography>

                {/* User and Metadata */}
                <Box display="flex" alignItems="center" gap={3} flexWrap="wrap" mt={2}>
                  <Box display="flex" alignItems="center" gap={0.5}>
                    <PersonIcon fontSize="small" color="action" />
                    <Typography variant="body2" color="text.secondary">
                      {log.username}
                    </Typography>
                  </Box>
                  
                  <Box display="flex" alignItems="center" gap={0.5}>
                    <ScheduleIcon fontSize="small" color="action" />
                    <Typography variant="body2" color="text.secondary">
                      {formatTimestamp(log.timestamp)}
                    </Typography>
                  </Box>
                  
                  <Box display="flex" alignItems="center" gap={0.5}>
                    <ComputerIcon fontSize="small" color="action" />
                    <Typography variant="body2" color="text.secondary">
                      {log.ip}
                    </Typography>
                  </Box>
                </Box>

                {/* User Agent */}
                {!isMobile && (
                  <Typography 
                    variant="caption" 
                    color="text.secondary"
                    sx={{ 
                      display: 'block',
                      mt: 1,
                      fontStyle: 'italic'
                    }}
                  >
                    {log.userAgent}
                  </Typography>
                )}
              </Box>
            </LogItem>
          ))}
        </List>

        {/* Load More Trigger */}
        {hasMore && (
          <Box ref={loadMoreRef} display="flex" justifyContent="center" py={4}>
            {loadingMore ? (
              <CircularProgress size={40} />
            ) : (
              <Typography variant="body2" color="text.secondary">
                Scroll down to load more...
              </Typography>
            )}
          </Box>
        )}

        {/* End of List Message */}
        {!hasMore && memoizedLogs.length > 0 && (
          <Alert 
            severity="success" 
            sx={{ 
              borderRadius: 3,
              textAlign: 'center',
              background: 'linear-gradient(45deg, #e8f5e8, #f1f8e9)',
            }}
          >
            🎉 You've reached the end of the activity logs!
          </Alert>
        )}
      </LogsContainer>

      {/* Detail Dialog */}
      <DetailDialog
        open={detailDialogOpen}
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h5" component="div">
              Log Details
            </Typography>
            <IconButton onClick={handleCloseDialog}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent dividers>
          {selectedLog && (
            <Box>
              <Tabs value={tabValue} onChange={handleTabChange} sx={{ mb: 2 }}>
                <Tab label="Details" />
                <Tab label="Raw Data" />
              </Tabs>

              <TabPanel value={tabValue} index={0}>
                <Stack spacing={3}>
                  {/* Basic Information */}
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="h6" gutterBottom>
                      Basic Information
                    </Typography>
                    <Stack spacing={1}>
                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">ID:</Typography>
                        <Typography variant="body2">{selectedLog.id}</Typography>
                      </Box>
                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">Method:</Typography>
                        <MethodChip label={selectedLog.method} method={selectedLog.method} size="small" />
                      </Box>
                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">Status:</Typography>
                        <StatusChip label={selectedLog.status} status={selectedLog.status} size="small" />
                      </Box>
                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">Duration:</Typography>
                        <DurationChip label={formatDuration(selectedLog.duration)} duration={selectedLog.duration} size="small" />
                      </Box>
                    </Stack>
                  </Paper>

                  {/* Request Information */}
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="h6" gutterBottom>
                      Request Information
                    </Typography>
                    <Stack spacing={1}>
                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">URI:</Typography>
                        <Typography variant="body2" sx={{ maxWidth: '70%', textAlign: 'right' }}>
                          {selectedLog.uri}
                        </Typography>
                      </Box>
                      {selectedLog.query && (
                        <Box display="flex" justifyContent="space-between">
                          <Typography variant="body2" color="text.secondary">Query:</Typography>
                          <Typography variant="body2" sx={{ maxWidth: '70%', textAlign: 'right' }}>
                            {selectedLog.query}
                          </Typography>
                        </Box>
                      )}
                      {selectedLog.requestBody && (
                        <Box>
                          <Typography variant="body2" color="text.secondary" gutterBottom>
                            Request Body:
                          </Typography>
                          {formatRequestBody(selectedLog.requestBody)}
                        </Box>
                      )}
                    </Stack>
                  </Paper>

                  {/* User Information */}
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="h6" gutterBottom>
                      User Information
                    </Typography>
                    <Stack spacing={1}>
                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">Username:</Typography>
                        <Typography variant="body2">{selectedLog.username}</Typography>
                      </Box>
                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">User ID:</Typography>
                        <Typography variant="body2">{selectedLog.userId}</Typography>
                      </Box>
                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">IP Address:</Typography>
                        <Typography variant="body2">{selectedLog.ip}</Typography>
                      </Box>
                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">Timestamp:</Typography>
                        <Typography variant="body2">{formatTimestamp(selectedLog.timestamp)}</Typography>
                      </Box>
                    </Stack>
                  </Paper>

                  {/* User Agent */}
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="h6" gutterBottom>
                      User Agent
                    </Typography>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                      {selectedLog.userAgent}
                    </Typography>
                  </Paper>
                </Stack>
              </TabPanel>

              <TabPanel value={tabValue} index={1}>
                <Box>
                  <Box display="flex" justifyContent="flex-end" gap={1} mb={2}>
                    <Button
                      startIcon={<CopyIcon />}
                      onClick={() => copyToClipboard(JSON.stringify(selectedLog, null, 2))}
                      variant="outlined"
                      size="small"
                    >
                      Copy
                    </Button>
                    <Button
                      startIcon={<DownloadIcon />}
                      onClick={() => downloadLog(selectedLog)}
                      variant="contained"
                      size="small"
                    >
                      Download
                    </Button>
                  </Box>
                  <JsonFormatter data={selectedLog} />
                </Box>
              </TabPanel>
            </Box>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={handleCloseDialog}>Close</Button>
        </DialogActions>
      </DetailDialog>
    </>
  );
};

export default ActivityLogsList;