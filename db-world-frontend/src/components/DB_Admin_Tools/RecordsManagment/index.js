import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  Box, Button, Container, IconButton, InputAdornment, Paper, TextField, Tooltip,
  Typography, ToggleButton, ToggleButtonGroup, useMediaQuery, useTheme,
  CircularProgress, Chip, Avatar, Pagination, Menu, MenuItem, Divider,
  Dialog, DialogTitle, DialogContent, DialogActions, DialogContentText,
  alpha
} from '@mui/material';
import {
  Add as AddIcon, Refresh as RefreshIcon, ViewList as ViewListIcon,
  GridView as GridViewIcon, Search as SearchIcon, Update, FilterList,
  Sort, ViewModule, TableRows, Warning
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  changeShowOnTopRecord, deleteDbCinemaRecord, getRecords, UpdateDbCinemaRecord
} from '../../ApiServices';
import Constants from '../../Constants';
import CleanMediaFileInfoButton from './CleanMediaFileInfoButton';
import AddRecordModal from './AddRecordModal';
import { handleApiError } from '../../Utils/errorHandler';
import RecordsCardView from './RecordsCardView';
import RecordsTableView from './RecordsTableView';
import { toast } from '../../Toast';
import TMDBUpdateStatusModal from './TMDBUpdateStatusModal';
import DeleteConfirmationDialog from './DeleteConfirmationDialog';
import RecordMediaFilesModal from './RecordMediaFilesModal';

const MotionPaper = motion(Paper);
const MotionButton = motion(Button);

const PAGE_SIZE_OPTIONS = [12, 24, 48, 96];
const DEFAULT_PAGE_SIZE = 24;

// View mode constants
const VIEW_MODES = {
  PAGINATION: 'pagination',
  INFINITE_SCROLL: 'infinite'
};

const RecordManagement = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const location = useLocation();
  const loaderRef = useRef(null);
  const observerRef = useRef(null);

  // State
  const [allRecords, setAllRecords] = useState([]);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalRecords: 0,
    hasNext: false,
    hasPrev: false
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [viewMode, setViewMode] = useState('table');
  const [cardViewMode, setCardViewMode] = useState(VIEW_MODES.PAGINATION);
  const [recordDialogOpen, setRecordDialogOpen] = useState(false);
  const [refreshingRecords, setRefreshingRecords] = useState({});
  const [loadingStates, setLoadingStates] = useState({});
  const [tmdbUpdateDialogOpen, setTmdbUpdateDialogOpen] = useState(false);
  const [filterMenuAnchor, setFilterMenuAnchor] = useState(null);
  const [sortBy, setSortBy] = useState('id');
  const [sortOrder, setSortOrder] = useState('desc');
  const [typeFilter, setTypeFilter] = useState('all');
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const [paginationModel, setPaginationModel] = useState({
    page: 0,
    pageSize: DEFAULT_PAGE_SIZE,
  });

  const [sortModel, setSortModel] = useState([]);
  const [filterModel, setFilterModel] = useState({ items: [] });

  // Delete confirmation modal state
  const [deleteDialog, setDeleteDialog] = useState({
    open: false,
    record: null,
    loading: false
  });

  const [fileDialog, setFileDialog] = useState({
    open: false, record: null, files: [], type: null
  });

  const handleFileDialogOpen = useCallback((record, files) => {
    setFileDialog({
      open: true,
      record: record,
      files: files,
      type: record.type
    });
  }, []);

  const handlePaginationModelChange = (newModel) => {
    setPaginationModel(newModel);
    setPageSize(newModel.pageSize);
    fetchRecords(newModel.page + 1, newModel.pageSize, searchQuery, typeFilter);
  };

  const handleSortModelChange = (newModel) => {
    setSortModel(newModel);
    if (newModel.length > 0) {
      const sort = newModel[0];
      setSortBy(sort.field);
      setSortOrder(sort.sort);
    }
  };

  // Fetch records with pagination
  const fetchRecords = useCallback(async (page = 1, size = pageSize, search = '', type = 'all', loadMore = false) => {
    let isMounted = true;

    if (loadMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    try {
      const params = {
        page: page - 1,
        size: size,
        search: search || undefined,
        type: type !== 'all' ? type : undefined,
        sortBy: sortBy,
        sortOrder: sortOrder
      };

      Object.keys(params).forEach(key => params[key] === undefined && delete params[key]);

      //console.log('Fetching records with params:', params, 'loadMore:', loadMore);
      const res = await getRecords(params);

      if (isMounted) {
        if (res.httpStatusCode === 200) {
          //console.log('API Response:', res.data);

          if (loadMore) {
            // Append new records for infinite scroll
            setAllRecords(prev => [...prev, ...(res.data.records || [])]);
          } else {
            // Replace records for normal load
            setAllRecords(res.data.records || []);
          }

          setPagination({
            currentPage: res.data.currentPage || page,
            totalPages: res.data.totalPages || 1,
            totalRecords: res.data.totalRecords || 0,
            hasNext: res.data.hasNext || false,
            hasPrev: res.data.hasPrev || false
          });

          //console.log('Updated pagination:', {
          //   currentPage: res.data.currentPage || page,
          //   totalPages: res.data.totalPages || 1,
          //   totalRecords: res.data.totalRecords || 0,
          //   hasNext: res.data.hasNext || false,
          //   hasMoreRecords: res.data.hasNext && (res.data.records || []).length > 0
          // });

        } else if (res.httpStatusCode === 401) {
          navigate(Constants.LOGIN_ROUTE, { state: { from: location } });
        } else {
          toast.error(res.message || 'Failed to fetch records');
        }
      }
    } catch (error) {
      if (isMounted) {
        toast.error('Failed to fetch records');
        console.error('Fetch records error:', error);
      }
    } finally {
      if (isMounted) {
        if (loadMore) {
          setLoadingMore(false);
        } else {
          setLoading(false);
        }
      }
    }
  }, [navigate, location, sortBy, sortOrder, pageSize]);

  // Handle infinite scroll - FIXED VERSION
  useEffect(() => {
    // Cleanup previous observer
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    if (viewMode === 'grid' &&
      cardViewMode === VIEW_MODES.INFINITE_SCROLL &&
      loaderRef.current &&
      !loadingMore &&
      !loading &&
      pagination.hasNext &&
      allRecords.length < pagination.totalRecords) {

      //console.log('Setting up intersection observer...', {
      //   hasNext: pagination.hasNext,
      //   loadingMore,
      //   loading,
      //   currentRecords: allRecords.length,
      //   totalRecords: pagination.totalRecords
      // });

      const observer = new IntersectionObserver(
        (entries) => {
          const [entry] = entries;
          //console.log('Intersection observer triggered:', entry.isIntersecting);

          if (entry.isIntersecting &&
            !loadingMore &&
            !loading &&
            pagination.hasNext &&
            allRecords.length < pagination.totalRecords) {

            //console.log('Loading more records...', {
            //   nextPage: pagination.currentPage + 1,
            //   currentPage: pagination.currentPage,
            //   hasNext: pagination.hasNext
            // });

            fetchRecords(pagination.currentPage + 1, pageSize, searchQuery, typeFilter, true);
          }
        },
        {
          root: null, // viewport
          rootMargin: '100px', // load 100px before reaching the bottom
          threshold: 0.1
        }
      );

      observer.observe(loaderRef.current);
      observerRef.current = observer;
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [
    viewMode,
    cardViewMode,
    loadingMore,
    loading,
    pagination.hasNext,
    pagination.currentPage,
    pagination.totalRecords,
    allRecords.length,
    fetchRecords,
    pageSize,
    searchQuery,
    typeFilter
  ]);

  // Reset records when switching to infinite scroll mode
  useEffect(() => {
    if (viewMode === 'grid' && cardViewMode === VIEW_MODES.INFINITE_SCROLL && allRecords.length > 0) {
      //console.log('Switching to infinite scroll mode, resetting to first page');
      fetchRecords(1, pageSize, searchQuery, typeFilter);
    }
  }, [cardViewMode, viewMode]);

  // Delete record handlers
  const handleDelete = useCallback((record) => {
    //console.log("Parent - handleDelete called with record:", record?.name);
    setDeleteDialog({
      open: true,
      record,
      loading: false
    });
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    //console.log("Parent - handleConfirmDelete called");
    if (!deleteDialog.record) return;

    setDeleteDialog(prev => ({ ...prev, loading: true }));

    try {
      const deleteRes = await deleteDbCinemaRecord(deleteDialog.record.id);
      if (deleteRes?.httpStatusCode === 200) {
        toast.success('Record deleted successfully');
        setDeleteDialog({ open: false, record: null, loading: false });

        // Refresh data based on current view mode
        if (viewMode === 'grid' && cardViewMode === VIEW_MODES.INFINITE_SCROLL) {
          fetchRecords(1, pageSize, searchQuery, typeFilter);
        } else {
          fetchRecords(pagination.currentPage, pageSize, searchQuery, typeFilter);
        }
      } else {
        throw new Error(deleteRes?.message || 'Delete failed');
      }
    } catch (error) {
      console.error("Parent - Delete error:", error);
      toast.error('Failed to delete record');
      setDeleteDialog(prev => ({ ...prev, loading: false }));
    }
  }, [
    deleteDialog.record,
    fetchRecords,
    pagination.currentPage,
    pageSize,
    searchQuery,
    typeFilter,
    viewMode,
    cardViewMode
  ]);

  const handleCloseDelete = useCallback(() => {
    //console.log("Parent - handleCloseDelete called");
    if (!deleteDialog.loading) {
      setDeleteDialog({ open: false, record: null, loading: false });
    }
  }, [deleteDialog.loading]);

  // Initial load and when dependencies change
  useEffect(() => {
    //console.log('Initial fetch or dependency change:', { searchQuery, typeFilter, pageSize });
    fetchRecords(1, pageSize, searchQuery, typeFilter);
  }, [fetchRecords, searchQuery, typeFilter, pageSize]);

  // Handle API responses
  const handleApiResponse = useCallback((res, successMessage, shouldRefetch = true) => {
    if (!res) {
      toast.error('No response from server');
      return;
    }

    if (res.httpStatusCode >= 200 && res.httpStatusCode < 300) {
      toast.success(res.message || successMessage);
      if (shouldRefetch) {
        if (viewMode === 'grid' && cardViewMode === VIEW_MODES.INFINITE_SCROLL) {
          fetchRecords(1, pageSize, searchQuery, typeFilter);
        } else {
          fetchRecords(pagination.currentPage, pageSize, searchQuery, typeFilter);
        }
      }
    } else if (res.httpStatusCode === 401) {
      toast.error(res.message + Constants.RE_LOGIN);
      navigate(Constants.LOGIN_ROUTE, { state: { from: location } });
    } else {
      toast.error(res.message || 'Operation failed');
    }
  }, [
    fetchRecords,
    pagination.currentPage,
    pageSize,
    searchQuery,
    typeFilter,
    navigate,
    location,
    viewMode,
    cardViewMode
  ]);

  // Handle page change for card view pagination
  const handlePageChange = useCallback((event, page) => {
    //console.log('Page change to:', page);
    setPagination(prev => ({ ...prev, currentPage: page }));
    fetchRecords(page, pageSize, searchQuery, typeFilter);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [fetchRecords, pageSize, searchQuery, typeFilter]);

  // Toggle show on top
  const toggleShowOnTop = useCallback(async (recordId, currentValue) => {
    try {
      setLoadingStates(prev => ({ ...prev, [recordId]: true }));
      let record = allRecords.find(r => r.id === recordId);
      const res = await changeShowOnTopRecord(recordId, {name: record.name, type: record.type, tmdbId: record.tmdb, showOnTop: !currentValue});
      handleApiResponse(res, 'Show on top updated', false);

      // Optimistically update UI
      setAllRecords(prev => prev.map(record =>
        record.id === recordId ? { ...record, show_on_top: !currentValue } : record
      ));
    } catch (error) {
      handleApiError(error, navigate, location);
    } finally {
      setLoadingStates(prev => ({ ...prev, [recordId]: false }));
    }
  }, [handleApiResponse, navigate, location]);

  // Refresh TMDB data
  const handleRefreshTmdb = useCallback(async (recordId) => {
    setRefreshingRecords(prev => ({ ...prev, [recordId]: true }));
    try {
      const record = allRecords.find(r => r.id === recordId);
      const res = await UpdateDbCinemaRecord(recordId, {
        type: record.type,
        name: record.name,
        tmdbId: record.tmdb,
        showOnTop: record.show_on_top
      });
      handleApiResponse(res, 'TMDB data refreshed', false);
    } catch (error) {
      toast.error('Failed to refresh TMDB data');
    } finally {
      setRefreshingRecords(prev => ({ ...prev, [recordId]: false }));
    }
  }, [allRecords, handleApiResponse]);

  // Handle sort change
  const handleSortChange = useCallback((newSortBy) => {
    if (sortBy === newSortBy) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newSortBy);
      setSortOrder('asc');
    }
    // Reset to first page when sorting changes
    setPagination(prev => ({ ...prev, currentPage: 1 }));
  }, [sortBy, sortOrder]);

  // Handle filter change
  const handleTypeFilterChange = useCallback((type) => {
    setTypeFilter(type);
    setPagination(prev => ({ ...prev, currentPage: 1 }));
  }, []);

  // Handle search
  const handleSearchChange = useCallback((value) => {
    setSearchQuery(value);
    setPagination(prev => ({ ...prev, currentPage: 1 }));
  }, []);

  // Menu handlers
  const handleFilterMenuOpen = (event) => setFilterMenuAnchor(event.currentTarget);
  const handleFilterMenuClose = () => setFilterMenuAnchor(null);

  // Handle card view mode change
  const handleCardViewModeChange = useCallback((newMode) => {
    //console.log('Changing card view mode to:', newMode);
    setCardViewMode(newMode);
    // Reset to first page when changing view modes
    setPagination(prev => ({ ...prev, currentPage: 1 }));
  }, []);

  // Stats card component
  // Updated StatsCard component with compact mode
  const StatsCard = ({ icon, label, value, color, compact = false }) => (
    <MotionPaper
      sx={{
        p: compact ? 1.5 : 2,
        display: 'flex',
        alignItems: 'center',
        gap: compact ? 1 : 2,
        background: `linear-gradient(135deg, ${theme.palette.background.paper} 0%, ${alpha(color, 0.08)} 100%)`,
        border: `1px solid ${alpha(color, 0.2)}`,
        borderRadius: 2,
        minWidth: compact ? 80 : 120,
        flex: compact ? 1 : 'none',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: `0 4px 12px ${alpha(color, 0.15)}`,
        }
      }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <Avatar
        sx={{
          bgcolor: alpha(color, 0.1),
          width: compact ? 32 : 40,
          height: compact ? 32 : 40,
          color: color,
          fontSize: compact ? '0.875rem' : '1rem'
        }}
      >
        {icon}
      </Avatar>
      <Box sx={{ minWidth: 0 }}>
        <Typography
          variant={compact ? "h6" : "h4"}
          fontWeight="bold"
          color={color}
          sx={{ lineHeight: 1.2 }}
        >
          {value}
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{
            fontSize: compact ? '0.7rem' : '0.75rem',
            fontWeight: 500
          }}
        >
          {label}
        </Typography>
      </Box>
    </MotionPaper>
  );

  // Calculate stats from pagination data
  const stats = useMemo(() => ({
    total: pagination.totalRecords,
    movies: allRecords.filter(r => r.type === 'movie').length,
    series: allRecords.filter(r => r.type === 'series').length,
  }), [allRecords, pagination.totalRecords]);

  // Debug info
  // //console.log('Current state:', {
  //   viewMode,
  //   cardViewMode,
  //   loading,
  //   loadingMore,
  //   pagination,
  //   recordsCount: allRecords.length,
  //   hasMoreRecords: pagination.hasNext && allRecords.length < pagination.totalRecords
  // });

  return (
    <Container maxWidth="xl" sx={{ px: isMobile ? 1 : 2, py: 2 }}>
      {/* Header Section */}
      <MotionPaper
        sx={{
          p: { xs: 2, sm: 3 },
          mb: 3,
          background: `linear-gradient(135deg, ${theme.palette.background.paper} 0%, ${alpha(theme.palette.primary.main, 0.03)} 100%)`,
          border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
          borderRadius: 3,
          backdropFilter: 'blur(10px)',
        }}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {/* Main Header Row */}
        <Box sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          mb: 3,
          gap: 2,
          flexDirection: { xs: 'column', sm: 'row' }
        }}>
          {/* Title Section */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
              <Box sx={{
                width: 4,
                height: 32,
                background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                borderRadius: 2,
              }} />
              <Box>
                <Typography variant="h4" fontWeight="bold" gutterBottom sx={{
                  fontSize: { xs: '1.5rem', sm: '1.75rem', md: '2rem' },
                  background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  color: 'transparent',
                }}>
                  Media Library
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}>
                  Manage your movies and TV shows
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* Primary Actions - Most Frequent (Now: TMDB Update, Refresh, Clean) */}
          <Box sx={{
            display: 'flex',
            gap: 1,
            flexWrap: 'wrap',
            justifyContent: { xs: 'flex-start', sm: 'flex-end' },
            width: { xs: '100%', sm: 'auto' }
          }}>
            {/* Clean Media Files - Frequent */}
            <CleanMediaFileInfoButton />
            
            {/* Add Record Button */}
            <MotionButton
              variant="outlined"
              size={isMobile ? 'small' : 'medium'}
              startIcon={<AddIcon />}
              onClick={() => setRecordDialogOpen(true)}
              whileHover={{ scale: 1.02, y: -1 }}
              whileTap={{ scale: 0.98 }}
              sx={{
                border: `2px solid ${theme.palette.primary.main}`,
                borderRadius: 2,
                fontWeight: 600,
                color: theme.palette.primary.main,
                '&:hover': {
                  backgroundColor: theme.palette.primary.main,
                  color: 'white',
                  borderWidth: 2,
                },
                minWidth: { xs: 'calc(50% - 4px)', sm: 'auto' }
              }}
            >
              {isMobile ? 'Add' : 'Add Record'}
            </MotionButton>
            {/* TMDB Update - Most Frequent */}
            <MotionButton
              variant="contained"
              size={isMobile ? 'small' : 'medium'}
              startIcon={<Update />}
              onClick={() => setTmdbUpdateDialogOpen(true)}
              whileHover={{ scale: 1.02, y: -1 }}
              whileTap={{ scale: 0.98 }}
              sx={{
                background: `linear-gradient(135deg, ${theme.palette.info.main} 0%, ${theme.palette.info.dark} 100%)`,
                borderRadius: 2,
                fontWeight: 600,
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                minWidth: { xs: 'calc(50% - 4px)', sm: 'auto' }
              }}
            >
              {isMobile ? 'TMDB' : 'TMDB Update'}
            </MotionButton>

            {/* Refresh - Frequent */}
            <Tooltip title="Refresh Data">
              <MotionButton
                variant="contained"
                size={isMobile ? 'small' : 'medium'}
                startIcon={<RefreshIcon />}
                onClick={() => fetchRecords(pagination.currentPage, pageSize, searchQuery, typeFilter)}
                disabled={loading}
                whileHover={{ scale: 1.02, y: -1 }}
                whileTap={{ scale: 0.98 }}
                sx={{
                  background: `linear-gradient(135deg, ${theme.palette.success.main} 0%, ${theme.palette.success.dark} 100%)`,
                  borderRadius: 2,
                  fontWeight: 600,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  minWidth: { xs: 'calc(50% - 4px)', sm: 'auto' }
                }}
              >
                {isMobile ? 'Refresh' : 'Refresh'}
              </MotionButton>
            </Tooltip>

            
          </Box>
        </Box>

        {/* Stats Overview - Compact */}
        <Box sx={{
          display: 'flex',
          gap: { xs: 1, sm: 2 },
          mb: 3,
          flexWrap: 'wrap',
          justifyContent: { xs: 'center', sm: 'flex-start' }
        }}>
          <StatsCard
            icon={<ViewModule />}
            label="Total"
            value={stats.total}
            color={theme.palette.primary.main}
            compact
          />
          <StatsCard
            icon={<TableRows />}
            label="Movies"
            value={stats.movies}
            color={theme.palette.info.main}
            compact
          />
          <StatsCard
            icon={<TableRows />}
            label="TV Shows"
            value={stats.series}
            color={theme.palette.success.main}
            compact
          />
        </Box>

        {/* Secondary Controls - Less Frequent (Now: Add Record, Search, View, Filter) */}
        <Box sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          gap: 2,
          alignItems: { xs: 'stretch', sm: 'center' },
          justifyContent: 'space-between'
        }}>
          {/* Search and Add Record Controls */}
          <Box sx={{
            display: 'flex',
            gap: 1,
            flexWrap: 'wrap',
            justifyContent: { xs: 'center', sm: 'flex-start' },
            flex: 1
          }}>
            {/* Search */}
            <TextField
              size="small"
              placeholder="Search records..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              sx={{
                minWidth: { xs: '100%', sm: 200, md: 280 },
                flex: 1,
                maxWidth: { sm: 300, md: 350 },
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  backgroundColor: alpha(theme.palette.background.paper, 0.8),
                }
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" color="primary" />
                  </InputAdornment>
                ),
              }}
            />
          </Box>

          {/* View and Filter Controls */}
          <Box sx={{
            display: 'flex',
            gap: 1,
            flexWrap: 'wrap',
            justifyContent: { xs: 'center', sm: 'flex-end' }
          }}>
            {/* View Toggle */}
            <Paper
              elevation={0}
              sx={{
                border: `1px solid ${theme.palette.divider}`,
                borderRadius: 2,
                overflow: 'hidden',
                display: 'inline-flex'
              }}
            >
              <ToggleButtonGroup
                value={viewMode}
                exclusive
                onChange={(_, newMode) => newMode && setViewMode(newMode)}
                size="small"
                sx={{
                  '& .MuiToggleButton-root': {
                    border: 'none',
                    padding: '6px 12px',
                    '&.Mui-selected': {
                      background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                      color: 'white',
                    }
                  }
                }}
              >
                <ToggleButton value="table">
                  <Tooltip title="Table view">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <ViewListIcon fontSize="small" />
                      <Typography variant="button" sx={{ fontSize: '0.75rem', display: { xs: 'none', sm: 'block' } }}>
                        Table
                      </Typography>
                    </Box>
                  </Tooltip>
                </ToggleButton>
                <ToggleButton value="grid">
                  <Tooltip title="Grid view">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <GridViewIcon fontSize="small" />
                      <Typography variant="button" sx={{ fontSize: '0.75rem', display: { xs: 'none', sm: 'block' } }}>
                        Grid
                      </Typography>
                    </Box>
                  </Tooltip>
                </ToggleButton>
              </ToggleButtonGroup>
            </Paper>

            {/* Filter Button */}
            <Tooltip title="Filter & Sort">
              <IconButton
                size="small"
                onClick={handleFilterMenuOpen}
                sx={{
                  border: `1px solid ${theme.palette.divider}`,
                  borderRadius: 2,
                  backgroundColor: alpha(theme.palette.background.paper, 0.8),
                  '&:hover': {
                    backgroundColor: theme.palette.primary.main,
                    color: 'white',
                  }
                }}
              >
                <FilterList fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Filter Menu */}
        <Menu
          anchorEl={filterMenuAnchor}
          open={Boolean(filterMenuAnchor)}
          onClose={handleFilterMenuClose}
          slotProps={{
            paper: {
              sx: {
                borderRadius: 2,
                boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                minWidth: 200,
              }
            }
          }}
        >
          <MenuItem disabled>
            <Typography variant="subtitle2" fontWeight="600" color="text.primary">
              Sort By
            </Typography>
          </MenuItem>
          {['name', 'id', 'date', 'files'].map((sortType) => (
            <MenuItem
              key={sortType}
              onClick={() => handleSortChange(sortType)}
              selected={sortBy === sortType}
              sx={{
                borderRadius: 1,
                mx: 1,
                my: 0.5,
                '&.Mui-selected': {
                  backgroundColor: `${theme.palette.primary.main}15`,
                  '&:hover': {
                    backgroundColor: `${theme.palette.primary.main}25`,
                  }
                }
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                <Sort
                  sx={{
                    transform: sortBy === sortType && sortOrder === 'desc' ? 'rotate(180deg)' : 'none',
                    fontSize: 16,
                    color: sortBy === sortType ? theme.palette.primary.main : 'inherit'
                  }}
                />
                <Typography variant="body2" sx={{ flex: 1 }}>
                  {sortType.charAt(0).toUpperCase() + sortType.slice(1)}
                </Typography>
                {sortBy === sortType && (
                  <Chip
                    label={sortOrder}
                    size="small"
                    sx={{
                      height: 20,
                      fontSize: '0.625rem',
                      backgroundColor: theme.palette.primary.main,
                      color: 'white'
                    }}
                  />
                )}
              </Box>
            </MenuItem>
          ))}
          <Divider />
          <MenuItem disabled>
            <Typography variant="subtitle2" fontWeight="600" color="text.primary">
              Filter By Type
            </Typography>
          </MenuItem>
          {['all', 'movie', 'series'].map((type) => (
            <MenuItem
              key={type}
              onClick={() => {
                handleTypeFilterChange(type);
                handleFilterMenuClose();
              }}
              selected={typeFilter === type}
              sx={{
                borderRadius: 1,
                mx: 1,
                my: 0.5,
                '&.Mui-selected': {
                  backgroundColor: `${theme.palette.primary.main}15`,
                  '&:hover': {
                    backgroundColor: `${theme.palette.primary.main}25`,
                  }
                }
              }}
            >
              <Typography variant="body2">
                {type === 'all' ? 'All Types' : type.charAt(0).toUpperCase() + type.slice(1)}
              </Typography>
            </MenuItem>
          ))}
        </Menu>
      </MotionPaper>

      {/* Content Section */}
      <AnimatePresence mode="wait">
        {loading ? (
          <MotionPaper
            key="loading"
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              height: 400,
              borderRadius: 3
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Box textAlign="center">
              <CircularProgress size={40} />
              <Typography variant="body1" sx={{ mt: 2 }}>
                Loading records...
              </Typography>
            </Box>
          </MotionPaper>
        ) : (
          <Box key="content">
            {/* Records Count and Active Filters */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Showing {allRecords.length} of {pagination.totalRecords} records
                {searchQuery && ` for "${searchQuery}"`}
                {typeFilter !== 'all' && ` • ${typeFilter}`}
                {viewMode === 'grid' && cardViewMode === VIEW_MODES.PAGINATION && ` • Page ${pagination.currentPage} of ${pagination.totalPages}`}
                {viewMode === 'table' && ` • Page ${pagination.currentPage} of ${pagination.totalPages}`}
                {` • Page size: ${pageSize}`}
                {viewMode === 'grid' && cardViewMode === VIEW_MODES.INFINITE_SCROLL && ` • Infinite Scroll`}
                {viewMode === 'grid' && cardViewMode === VIEW_MODES.INFINITE_SCROLL && pagination.hasNext && ` • More records available`}
              </Typography>

              {(searchQuery || typeFilter !== 'all') && (
                <Button
                  size="small"
                  onClick={() => {
                    handleSearchChange('');
                    handleTypeFilterChange('all');
                  }}
                >
                  Clear Filters
                </Button>
              )}
            </Box>

            {/* Records View */}
            {viewMode === 'table' ? (
              <RecordsTableView
                records={allRecords}
                isMobile={isMobile}
                onToggleShowOnTop={toggleShowOnTop}
                onRefreshTmdb={handleRefreshTmdb}
                onDelete={handleDelete}
                onFileDialogOpen={handleFileDialogOpen}
                loadingStates={loadingStates}
                refreshingRecords={refreshingRecords}
                loading={loading}
                // Pagination
                paginationModel={paginationModel}
                onPaginationModelChange={handlePaginationModelChange}
                totalRecords={pagination.totalRecords}
                pageSizeOptions={PAGE_SIZE_OPTIONS}
                // Sorting
                sortModel={sortModel}
                onSortModelChange={handleSortModelChange}
                // Filtering
                filterModel={filterModel}
                onFilterModelChange={setFilterModel}
              />
            ) : (
              <RecordsCardView
                records={allRecords}
                onToggleShowOnTop={toggleShowOnTop}
                onRefreshTmdb={handleRefreshTmdb}
                onDelete={handleDelete}
                loadingStates={loadingStates}
                refreshingRecords={refreshingRecords}
                loadingMore={loadingMore}
                loaderRef={loaderRef}
                // Pagination props
                paginationModel={paginationModel}
                onPaginationModelChange={handlePaginationModelChange}
                totalRecords={pagination.totalRecords}
                pageSizeOptions={PAGE_SIZE_OPTIONS}
                // View mode control
                viewMode={cardViewMode}
                onViewModeChange={handleCardViewModeChange}
              />
            )}
          </Box>
        )}
      </AnimatePresence>

      <DeleteConfirmationDialog
        open={deleteDialog.open}
        loading={deleteDialog.loading}
        record={deleteDialog.record}
        onClose={handleCloseDelete}
        onConfirm={handleConfirmDelete}
      />

      {/* Other Modals */}
      <TMDBUpdateStatusModal
        open={tmdbUpdateDialogOpen}
        onClose={() => setTmdbUpdateDialogOpen(false)}
      />

      <AddRecordModal
        recordDialogOpen={recordDialogOpen}
        recordDialogClose={() => setRecordDialogOpen(false)}
        fetchRecords={() => {
          if (viewMode === 'grid' && cardViewMode === VIEW_MODES.INFINITE_SCROLL) {
            fetchRecords(1, pageSize, searchQuery, typeFilter);
          } else {
            fetchRecords(pagination.currentPage, pageSize, searchQuery, typeFilter);
          }
        }}
      />

      <RecordMediaFilesModal
        fileDialog={fileDialog}
        setFileDialog={setFileDialog}
      />

    </Container>
  );
};

export default RecordManagement;