import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import axiosInstance from '../../Utils/AxiosInstants';
import { findUserByQuery } from '../../ApiServices';
import LogFilters from './LogFilter';
import LogItem from './LogItem';
import SearchBar from './SearchBar';

// Main Component
const UserActivityLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingUsernames, setLoadingUsernames] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [usernames, setUsernames] = useState([]);
  const [filters, setFilters] = useState({
    method: '',
    status: '',
    username: ''
  });
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [totalItems, setTotalItems] = useState(0);
  const pageSize = 10;
  const observer = useRef();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Fetch usernames for dropdown
  const fetchUsernames = useCallback(async (query = '') => {
    setLoadingUsernames(true);
    try {
      const response = await findUserByQuery(query);
      
      // Adjust this based on your API response structure
      const userData = response.data.content || response.data.data || response.data || [];
      
      setUsernames(userData.map(user => ({
        label: `${user.fullName || user.username} (${user.email || user.username})`,
        value: user.email || user.username,
        userObject: user
      })));
    } catch (error) {
      console.error('Error fetching usernames:', error);
      setUsernames([]);
    } finally {
      setLoadingUsernames(false);
    }
  }, []);

  const fetchLogs = useCallback(async (params, isLoadMore = false, currentFilters = filters) => {
    if (isLoadMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    
    setError(null);
    try {
      // Build query params
      const queryParams = {
        ...params,
        page: params.page || 0,
        size: params.size || pageSize,
        sort: 'timestamp,desc'
      };
      
      // Add filters to query params
      if (currentFilters.method) queryParams.method = currentFilters.method;
      if (currentFilters.status) queryParams.status = currentFilters.status;
      if (currentFilters.username) queryParams.username = currentFilters.username;
      
      const response = await axiosInstance.get('/api/admin/activity-logs', {
        params: queryParams
      });
      
      if (isLoadMore) {
        setLogs(prevLogs => [...prevLogs, ...(response.data.content || [])]);
      } else {
        setLogs(response.data.content || []);
        setPage(params.page || 0);
      }
      
      setTotalItems(response.data.totalElements || 0);
      setHasMore(!response.data.last);
    } catch (error) {
      console.error('Error fetching logs:', error);
      setError('Failed to fetch logs. Please try again.');
      if (!isLoadMore) {
        setLogs([]);
        setTotalItems(0);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [pageSize]);

  useEffect(() => {
    fetchLogs({ page: 0, size: pageSize });
    fetchUsernames();
  }, []);

  const lastLogElementRef = useCallback(node => {
    if (loadingMore) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        setPage(prevPage => {
          const nextPage = prevPage + 1;
          // Pass current filters to fetchLogs
          fetchLogs({ page: nextPage, size: pageSize }, true, filters);
          return nextPage;
        });
      }
    });
    if (node) observer.current.observe(node);
  }, [loadingMore, hasMore, fetchLogs, pageSize, filters]);

  const handleSearch = useCallback(() => {
    fetchLogs({ search: searchTerm, page: 0, size: pageSize }, false, filters);
  }, [searchTerm, fetchLogs, filters]);

  const handleClearSearch = useCallback(() => {
    setSearchTerm('');
    fetchLogs({ page: 0, size: pageSize }, false, filters);
  }, [fetchLogs, filters]);

  const handleSearchChange = useCallback((e) => {
    setSearchTerm(e.target.value);
  }, []);

  const handleFilterChange = useCallback((filterType, value) => {
    setFilters(prev => {
      const newFilters = { ...prev, [filterType]: value };
      // Fetch logs immediately with new filters
      fetchLogs({ search: searchTerm, page: 0, size: pageSize }, false, newFilters);
      return newFilters;
    });
  }, [searchTerm, fetchLogs, pageSize]);

  return (
    <Box sx={{ p: isMobile ? 1 : 3 }}>
      <Typography variant="h4" component="h1" gutterBottom sx={{ mb: 3 }}>
        User Activity Logs
      </Typography>
      
      <LogFilters 
        filters={filters} 
        onFilterChange={handleFilterChange} 
        usernames={usernames}
        loadingUsernames={loadingUsernames}
      />
      
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <SearchBar 
          searchTerm={searchTerm}
          onSearchChange={handleSearchChange}
          onSearch={handleSearch}
          onClear={handleClearSearch}
          loading={loading}
        />
        
        <Typography variant="body2" color="textSecondary">
          {totalItems} total logs
        </Typography>
      </Box>
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <AnimatePresence>
          {logs.map((log, index) => (
            <LogItem 
              key={log.id} 
              log={log} 
              isLast={index === logs.length - 1}
              ref={index === logs.length - 1 ? lastLogElementRef : null}
            />
          ))}
        </AnimatePresence>
      </Box>
      
      {(loading || loadingMore) && (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
          <CircularProgress />
        </Box>
      )}
      
      {!hasMore && logs.length > 0 && (
        <Box sx={{ textAlign: 'center', my: 3 }}>
          <Typography variant="body2" color="textSecondary">
            No more logs to load
          </Typography>
        </Box>
      )}
      
      {!loading && logs.length === 0 && (
        <Box sx={{ textAlign: 'center', my: 4 }}>
          <Typography variant="h6" color="textSecondary">
            No logs found
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default UserActivityLogs;