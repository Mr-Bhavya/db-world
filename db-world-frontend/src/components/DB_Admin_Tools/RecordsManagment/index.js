import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Box, Button, Container, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControlLabel, IconButton, InputAdornment, Paper, TextField, Tooltip,
  Typography, ToggleButton, ToggleButtonGroup, useMediaQuery, useTheme,
  CircularProgress
} from '@mui/material';
import {
  Add as AddIcon, Refresh as RefreshIcon, ViewList as ViewListIcon,
  GridView as GridViewIcon, Search as SearchIcon
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { useInfiniteScroll } from './useInfiniteScroll';
import {
  changeShowOnTopRecord, deleteDbCinemaRecord, getRecords, UpdateDbCinemaRecord
} from '../../ApiServices';
import Constants from '../../Constants';
import CleanMediaFileInfoButton from './CleanMediaFileInfoButton';
import AddRecordModal from './AddRecordModal';
import { handleApiError } from '../../Utils/errorHandler';
import RecordsCardView from './RecordsCardView';
import RecordsTableView from './RecordsTableView';
import { confirm } from 'material-ui-confirm';

const MotionButton = motion(Button);
const PAGE_SIZE = 20;

const RecordManagement = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const navigate = useNavigate();
  const location = useLocation();

  // State
  const [allRecords, setAllRecords] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState('table');
  const [recordDialogOpen, setRecordDialogOpen] = useState(false);
  const [refreshingRecords, setRefreshingRecords] = useState({});
  const [loadingStates, setLoadingStates] = useState({});


  // Filter records based on search query
  const filteredRecords = useMemo(() => {
    if (!searchQuery) return allRecords;
    const query = searchQuery.toLowerCase();
    return allRecords.filter(record =>
      record.id.toString().includes(query) ||
      record.name.toLowerCase().includes(query) ||
      (record.tmdb && record.tmdb.toString().includes(query))
    )
  }, [searchQuery, allRecords]);

  // Infinite scroll for card view
  const { data: paginatedRecords, loadingMore, loaderRef } = useInfiniteScroll(
    filteredRecords, PAGE_SIZE
  );

  const fetchRecords = async () => {
    let isMounted = true;
    setLoading(true);
    try {
      const res = await getRecords();
      if (isMounted && res.httpStatusCode === 200) {
        setAllRecords(res.data);
      } else if (isMounted && res.httpStatusCode === 401) {
        navigate(Constants.LOGIN_ROUTE, { state: { from: location } });
      }
    } catch (error) {
      if (isMounted) Constants.showToast.error('Failed to fetch records');
    } finally {
      if (isMounted) setLoading(false);
    }
  };

  useEffect(() => { fetchRecords(); }, [navigate, location]);

  const handleApiResponse = (res, successMessage) => {
    if (!res) {
      Constants.showToast.error('No response from server');
      return;
    }

    if (res.httpStatusCode >= 200 && res.httpStatusCode < 300) {
      Constants.showToast.success(res.message || successMessage);
      fetchRecords();
    } else if (res.httpStatusCode === 401) {
      Constants.showToast.error(res.message + Constants.RE_LOGIN);
      navigate(Constants.LOGIN_ROUTE, { state: { from: location } });
    } else {
      Constants.showToast.error(res.message || 'Operation failed');
    }
  };

  const toggleShowOnTop = async (recordId, currentValue) => {
    try {
      setLoadingStates(prev => ({ ...prev, [recordId]: true }));
      const res = await changeShowOnTopRecord(recordId, !currentValue);
      handleApiResponse(res, 'Show on top updated for record - ' + recordId);
      setAllRecords(prev => prev.map(record =>
        record.id === recordId ? { ...record, showOnTop: !currentValue } : record
      ));
    } catch (error) {
      handleApiError(error, navigate, location);
    } finally {
      setLoadingStates(prev => ({ ...prev, [recordId]: false }));
    }
  };

  const handleRefreshTmdb = async (recordId) => {
    setRefreshingRecords(prev => ({ ...prev, [recordId]: true }));
    try {
      const record = allRecords.find(r => r.id === recordId);
      const res = await UpdateDbCinemaRecord(recordId, {
        type: record.type,
        name: record.name,
        tmdbId: record.tmdb,
        showOnTop: record.showOnTop
      });
      handleApiResponse(res, 'TMDB data refreshed for record - ' + recordId);
    } catch (error) {
      Constants.showToast.error('Failed to refresh TMDB data for record - ' + recordId);
    } finally {
      setRefreshingRecords(prev => ({ ...prev, [recordId]: false }));
    }
  };

  const handleDelete = useCallback(async (record) => {
    try {
      const result = await confirm({
        title: 'Confirm Delete',
        description: 'Are you sure you want to delete record with name "' + record?.name + '"?',
        confirmationText: 'Delete',
        cancellationText: 'Cancel',
        confirmationButtonProps: { color: 'error' },
      });

      // If confirm resolves (i.e. not cancelled), result will be truthy
      if (!result.confirmed) return;

      const deleteRes = await deleteDbCinemaRecord(record.id);
      if (deleteRes?.httpStatusCode === 200) {
        handleApiResponse(deleteRes, 'Record ' + record.id + ' deleted successfully');
      }
    } catch (error) {
      handleApiError(error, navigate, location);
    }
  }, [confirm]);

  return (
    <Container maxWidth="xl" sx={{ px: isMobile ? 1 : 2, py: 2 }}>
      <Box sx={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        justifyContent: 'space-between',
        alignItems: isMobile ? 'stretch' : 'center',
        gap: 2,
        mb: 3
      }}>
        <TextField
          fullWidth={isMobile}
          sx={{ flexGrow: 1, maxWidth: isMobile ? '100%' : '400px' }}
          placeholder="Search by ID, Name, or TMDB ID"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }}
        />

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(_, newMode) => newMode && setViewMode(newMode)}
            size="small"
          >
            <ToggleButton value="table" aria-label="table view">
              <Tooltip title="Table view"><ViewListIcon fontSize="small" /></Tooltip>
            </ToggleButton>
            <ToggleButton value="grid" aria-label="grid view">
              <Tooltip title="Grid view"><GridViewIcon fontSize="small" /></Tooltip>
            </ToggleButton>
          </ToggleButtonGroup>
          <MotionButton
            variant="contained"
            size={isMobile ? 'small' : 'medium'}
            startIcon={<AddIcon fontSize={isMobile ? 'small' : 'medium'} />}
            onClick={() => setRecordDialogOpen(true)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {isMobile ? 'Add' : 'Add Record'}
          </MotionButton>
          <CleanMediaFileInfoButton />
        </Box>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress />
        </Box>
      ) : viewMode === 'table' ? (
        <RecordsTableView
          records={filteredRecords}
          isMobile={isMobile}
          onToggleShowOnTop={toggleShowOnTop}
          onRefreshTmdb={handleRefreshTmdb}
          onDelete={handleDelete}
          loadingStates={loadingStates}
          refreshingRecords={refreshingRecords}
          loading={loading}
        />
      ) : (
        <>
          {filteredRecords.length === 0 ? (
            <Box sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '200px',
              textAlign: 'center'
            }}>
              <Typography variant="body1" color="textSecondary">
                No records found
              </Typography>
              {searchQuery && (
                <Button variant="text" size="small" onClick={() => setSearchQuery('')} sx={{ mt: 1 }}>
                  Clear search
                </Button>
              )}
            </Box>
          ) : (
            <RecordsCardView
              records={paginatedRecords}
              loadingMore={loadingMore}
              loaderRef={loaderRef}
              onToggleShowOnTop={toggleShowOnTop}
              onRefreshTmdb={handleRefreshTmdb}
              onDelete={handleDelete}
              loadingStates={loadingStates}
              refreshingRecords={refreshingRecords}
            />
          )}
        </>
      )}

      <AddRecordModal
        recordDialogOpen={recordDialogOpen}
        recordDialogClose={() => setRecordDialogOpen(false)}
        fetchRecords={fetchRecords}
      />
      {Constants.TOAST_CONTAINER}
    </Container>
  );
};

export default RecordManagement;