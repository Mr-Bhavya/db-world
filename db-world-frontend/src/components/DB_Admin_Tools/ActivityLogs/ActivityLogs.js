import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  useTheme,
  useMediaQuery
} from '@mui/material';
import { styled } from '@mui/material/styles';
import ActivityFilters from './ActivityFilters';
import ActivityLogsList from './ActivityLogsList';
import { fetchActivityLogs } from './activityLogsService';

// Styled components with advanced CSS
const PageContainer = styled(Box)(({ theme }) => ({
  minHeight: '100vh',
//   background: 'linear-gradient(135deg, #008080 0%, #287e79ff 100%)',
//   padding: theme.spacing(3),
  [theme.breakpoints.down('sm')]: {
    // padding: theme.spacing(1),
  },
}));

const ContentPaper = styled(Paper)(({ theme }) => ({
  borderRadius: 20,
  backdropFilter: 'blur(10px)',
  background: 'rgba(255, 255, 255, 0.95)',
  boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
  border: '1px solid rgba(255, 255, 255, 0.18)',
  overflow: 'hidden',
  animation: 'slideUp 0.6s ease-out',
  '@keyframes slideUp': {
    '0%': {
      opacity: 0,
      transform: 'translateY(30px)',
    },
    '100%': {
      opacity: 1,
      transform: 'translateY(0)',
    },
  },
}));

const HeaderSection = styled(Box)(({ theme }) => ({
  padding: theme.spacing(4),
  background: 'linear-gradient(45deg, #29a18dff, #287e79ff)',
  color: 'white',
  position: 'relative',
  overflow: 'hidden',
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'url("data:image/svg+xml,<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 1000 100\" fill=\"%23ffffff\" opacity=\"0.1\"><polygon points=\"0,100 1000,0 1000,100\"/></svg>")',
    backgroundSize: 'cover',
  },
}));

const ActivityLogs = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  
  const [filters, setFilters] = useState({
    method: '',
    status: '',
    username: '',
  });

  const pageSize = 10;
  const filtersRef = useRef(filters);
  const isInitialMount = useRef(true);

  // Update ref when filters change
  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  // Fetch logs function - stable reference
  const fetchLogs = useCallback(async (pageNum = 0, append = false) => {
    if ((pageNum === 0 ? loading : loadingMore)) return;
    
    const loadingState = pageNum === 0 ? setLoading : setLoadingMore;
    loadingState(true);
    setError('');

    try {
      const currentFilters = filtersRef.current;
      const queryParams = {
        page: pageNum,
        size: pageSize,
        sort: 'timestamp,desc',
      };

      // Add filters only if they have values
      if (currentFilters.method) queryParams.method = currentFilters.method;
      if (currentFilters.status) queryParams.status = currentFilters.status;
      if (currentFilters.username) queryParams.username = currentFilters.username;

      const response = await fetchActivityLogs(queryParams);
      const data = response.data;

      if (append) {
        setLogs(prev => [...prev, ...data.content]);
      } else {
        setLogs(data.content);
      }

      setTotalElements(data.totalElements);
      setHasMore(!data.last);
      setPage(pageNum);
    } catch (err) {
      setError('Failed to fetch activity logs');
      console.error('Error fetching logs:', err);
    } finally {
      loadingState(false);
    }
  }, [loading, loadingMore, pageSize]);

  // Initial load
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      fetchLogs(0, false);
    }
  }, [fetchLogs]);

  // Filter changes - reset and fetch
  useEffect(() => {
    if (!isInitialMount.current) {
      setPage(0);
      setHasMore(true);
      setLogs([]);
      fetchLogs(0, false);
    }
  }, [filters]);

  const handleLoadMore = useCallback(() => {
    if (hasMore && !loading && !loadingMore) {
      fetchLogs(page + 1, true);
    }
  }, [hasMore, loading, loadingMore, page]);

  const handleFilterChange = useCallback((newFilters) => {
    setFilters(newFilters);
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters({
      method: '',
      status: '',
      username: '',
    });
  }, []);

  // Memoized statistics
  const stats = useMemo(() => {
    const totalRequests = totalElements;
    const successRate = logs.length > 0 
      ? ((logs.filter(log => log.status >= 200 && log.status < 300).length / logs.length) * 100).toFixed(1)
      : 0;
    const avgDuration = logs.length > 0 
      ? (logs.reduce((sum, log) => sum + log.duration, 0) / logs.length).toFixed(0)
      : 0;

    return { totalRequests, successRate, avgDuration };
  }, [logs, totalElements]);

  return (
    <PageContainer>
      <Container maxWidth="xl">
        {/* <ContentPaper style={{border: "none", background: "none"}}> */}
          <Box p={isMobile ? 0 : 2}>
            {error && (
              <Alert 
                severity="error" 
                sx={{ 
                  mb: 3,
                  borderRadius: 2,
                  animation: 'shake 0.5s ease-in-out',
                  '@keyframes shake': {
                    '0%, 100%': { transform: 'translateX(0)' },
                    '25%': { transform: 'translateX(-5px)' },
                    '75%': { transform: 'translateX(5px)' },
                  }
                }}
              >
                {error}
              </Alert>
            )}

            <ActivityFilters
              filters={filters}
              onFilterChange={handleFilterChange}
              onClearFilters={handleClearFilters}
            />

            {/* Statistics Cards */}
            <Box 
              display="grid" 
              gridTemplateColumns={isMobile ? '1fr' : 'repeat(3, 1fr)'} 
              gap={3} 
              mb={4}
            >
              <StatCard
                title="Total Requests"
                value={stats.totalRequests.toLocaleString()}
                color="#2196f3"
                icon="📊"
              />
              <StatCard
                title="Success Rate"
                value={`${stats.successRate}%`}
                color="#4caf50"
                icon="✅"
              />
              <StatCard
                title="Avg Duration"
                value={`${stats.avgDuration}ms`}
                color="#ff9800"
                icon="⚡"
              />
            </Box>

            <ActivityLogsList
              logs={logs}
              loading={loading}
              loadingMore={loadingMore}
              hasMore={hasMore}
              onLoadMore={handleLoadMore}
            />
          </Box>
        {/* </ContentPaper> */}
      </Container>
    </PageContainer>
  );
};

// Stat Card Component
const StatCard = ({ title, value, color, icon }) => {
  return (
    <Paper
      sx={{
        p: 3,
        textAlign: 'center',
        background: `linear-gradient(45deg, ${color}20, ${color}40)`,
        border: `1px solid ${color}30`,
        borderRadius: 3,
        transition: 'all 0.3s ease',
        cursor: 'pointer',
        '&:hover': {
          transform: 'translateY(-5px)',
          boxShadow: `0 8px 25px ${color}40`,
        },
      }}
    >
      <Typography variant="h4" gutterBottom>
        {icon}
      </Typography>
      <Typography 
        variant="h4" 
        component="div" 
        fontWeight="bold"
        color={color}
        gutterBottom
      >
        {value}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {title}
      </Typography>
    </Paper>
  );
};

export default ActivityLogs;