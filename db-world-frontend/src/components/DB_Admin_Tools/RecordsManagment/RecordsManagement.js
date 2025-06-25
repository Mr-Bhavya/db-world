import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardActions,
  Checkbox,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grid,
  IconButton,
  InputAdornment,
  Paper,
  Switch,
  TextField,
  Tooltip,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';
import AddIcon from '@mui/icons-material/Add';
import ViewListIcon from '@mui/icons-material/ViewList';
import GridViewIcon from '@mui/icons-material/GridView';
import SearchIcon from '@mui/icons-material/Search';
import { motion, useReducedMotion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import { DataGrid } from '@mui/x-data-grid';
import { useInfiniteScroll } from './useInfiniteScroll';
import {
  AddDbCinemaRecord,
  changeShowOnTopRecord,
  deleteDbCinemaRecord,
  deleteMediaFileInfoById,
  getRecords,
  searchTmdbByQuery,
  UpdateDbCinemaRecord
} from '../../ApiServices';
import Constants from '../../Constants';
import { Api, ChevronRight, Close, ExpandLess, ExpandMore, Folder, MoreVert } from '@mui/icons-material';
import CommonServices from '../../CommonServices';
import CleanMediaFileInfoButton from './CleanMediaFileInfoButton';
// import AddRecordModal from './AddRecordModaldal';
import RecordMediaFilesModal from './RecordMediaFilesModal';
import AddRecordModal from './AddRecordModal';

const MotionCard = motion(Card);
const MotionButton = motion(Button);
const PAGE_SIZE = 20;

const RecordManagement = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const navigate = useNavigate();
  const location = useLocation();

  // State
  const [allRecords, setAllRecords] = useState([]);
  const [filteredRecords, setFilteredRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState('table');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState(null);
  const [recordDialogOpen, setRecordDialogOpen] = useState(false);
  const [refreshingRecords, setRefreshingRecords] = useState({});
  const [searchQuery, setSearchQuery] = useState('');

  // Infinite scroll for card view
  const { data: paginatedRecords, loadingMore, loaderRef } = useInfiniteScroll(
    filteredRecords,
    PAGE_SIZE
  );

  const [fileDialog, setFileDialog] = useState({
    open: false,
    record: null,
    files: [],
    type: null
  });

  const setFileDialogData = (data) => {
    setFileDialog(data);
  }

  // Fetch records on mount and when search changes
  useEffect(() => {
    fetchRecords();
  }, []);

  useEffect(() => {
    const filtered = allRecords.filter(record =>
      record.id.toString().includes(searchQuery) ||
      record.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (record.tmdb && record.tmdb.toString().includes(searchQuery))
    );
    setFilteredRecords(filtered);
  }, [searchQuery, allRecords]);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const res = await getRecords();
      if (res.httpStatusCode === 200) {
        setAllRecords(res.data);
        setFilteredRecords(res.data);
      } else {
        Constants.showToast.error(res.message);
        if (res.httpStatusCode === 401) {
          navigate(Constants.LOGIN_ROUTE, { state: { from: location } });
        }
      }
    } catch (error) {
      Constants.showToast.error('Failed to fetch records');
    } finally {
      setLoading(false);
    }
  };

  // Responsive columns for DataGrid
  const columns = useMemo(() => [
    { field: 'id', headerName: 'ID', flex: isMobile ? 0 : 1, minWidth: 80 },
    { field: 'type', headerName: 'Type', flex: isMobile ? 0 : 1, minWidth: 80 },
    { field: 'name', headerName: 'Name', flex: 2, minWidth: 150 },
    {
      field: 'tmdb',
      headerName: 'TMDB',
      flex: isMobile ? 0 : 1,
      minWidth: 80,
      renderCell: (params) => params.value || '-'
    },
    {
      field: 'stream_file_list',
      headerName: 'Files',
      flex: isMobile ? 1 : 1.5,
      minWidth: 120,
      renderCell: (params) => {
        const files = params.value || [];
        if (files.length === 0) return '-';

        const totalSize = files.reduce((sum, file) => sum + (file.fileSize || 0), 0);
        const formatSize = (bytes) => {
          if (bytes === 0) return '0 Bytes';
          const k = 1024;
          const sizes = ['Bytes', 'KB', 'MB', 'GB'];
          const i = Math.floor(Math.log(bytes) / Math.log(k));
          return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        };

        return (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
              width: '100%'
            }}
            onClick={(e) => {
              e.stopPropagation();
              setFileDialog({
                open: true,
                record: params.row,
                files: params.row.stream_file_list || [],
                type: params.row.type
              });
            }}
          >
            <Folder fontSize="small" color="action" sx={{ mr: 1 }} />
            <Box sx={{ flexGrow: 0, alignItems: 'start', display: 'flex', flexDirection: 'column', mt: 0.5 }}>
              <Typography variant="body2">
                {files.length} file{files.length !== 1 ? 's' : ''}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {formatSize(totalSize)}
              </Typography>
            </Box>
            <ChevronRight fontSize="small" color="action" />
          </Box>
        );
      }
    },
    ...(isMobile ? [] : [
      {
        field: 'creationDate',
        headerName: 'Created',
        flex: 1.5,
        renderCell: (params) => new Date(params.value).toLocaleDateString()
      },
      {
        field: 'lastModifiedDate',
        headerName: 'Modified',
        flex: 1.5,
        renderCell: (params) => new Date(params.value).toLocaleDateString()
      }
    ]),
    {
      field: 'showOnTop',
      headerName: 'Top',
      width: 80,
      renderCell: (params) => (
        <Tooltip title={params.value ? 'Showing on top' : 'Not showing on top'}>
          <Switch
            size="small"
            checked={params.value}
            onChange={() => toggleShowOnTop(params.row.id, params.value)}
            color="primary"
          />
        </Tooltip>
      )
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: isMobile ? 120 : 150,
      renderCell: (params) => (
        <Box sx={{ display: 'flex' }}>
          <Tooltip title="Refresh TMDB">
            <IconButton
              size="small"
              onClick={() => handleRefreshTmdb(params.row.id)}
              disabled={refreshingRecords[params.row.id]}
              sx={{ p: isMobile ? 0.5 : 1 }}
            >
              {refreshingRecords[params.row.id] ? (
                <CircularProgress size={isMobile ? 16 : 24} />
              ) : (
                <RefreshIcon fontSize={isMobile ? 'small' : 'medium'} color="action" />
              )}
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton
              size="small"
              onClick={() => openDeleteDialog(params.row)}
              sx={{ p: isMobile ? 0.5 : 1 }}
            >
              <DeleteIcon fontSize={isMobile ? 'small' : 'medium'} color="error" />
            </IconButton>
          </Tooltip>
        </Box>
      )
    }
  ], [isMobile, refreshingRecords]);


  // Delete Dialog Handlers
  const openDeleteDialog = (record) => {
    setRecordToDelete(record);
    setDeleteDialogOpen(true);
  };

  const closeDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setRecordToDelete(null);
  };


  const handleApiResponse = (res, successMessage, isAdd = false) => {
    if (res.httpStatusCode === (isAdd ? 201 : 200)) {
      Constants.showToast.success(successMessage);
      if (successMessage !== 'TMDB data refreshed') {
        fetchRecords();
      }
    } else if (res.httpStatusCode === 401) {
      Constants.showToast.error(res.message + Constants.RE_LOGIN);
      navigate(Constants.LOGIN_ROUTE, { state: { from: location } });
    } else {
      Constants.showToast.error(res.message || 'Operation failed');
    }
  };

  // Record Actions
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
      handleApiResponse(res, 'TMDB data refreshed');
    } catch (error) {
      Constants.showToast.error('Failed to refresh TMDB data');
    } finally {
      setRefreshingRecords(prev => ({ ...prev, [recordId]: false }));
    }
  };

  const handleDelete = async () => {
    if (!recordToDelete) return;

    try {
      const res = await deleteDbCinemaRecord(recordToDelete.id);
      handleApiResponse(res, 'Record deleted successfully');
    } catch (error) {
      Constants.showToast.error('Failed to delete record');
    } finally {
      closeDeleteDialog();
    }
  };

  const toggleShowOnTop = async (recordId, currentValue) => {
    try {
      const res = await changeShowOnTopRecord(recordId, !currentValue);
      handleApiResponse(res, 'Show on top updated');
    } catch (error) {
      Constants.showToast.error('Failed to update show on top');
    }
  };

  const RecordCard = ({ record }) => (
    <Grid item xs={4} sm={4} md={4} sx={{ mb: 2 }}>
      <MotionCard sx={{ border: '1px solid black', borderRadius: '10px' }} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Typography variant="h6" component="div" noWrap>
            {record.name}
          </Typography>
          <Typography color="text.secondary" gutterBottom>
            {record.type} • ID: {record.id}
          </Typography>
          <Typography variant="body2" noWrap>
            TMDB: {record.tmdb || 'Not linked'}
          </Typography>
          <Typography variant="caption" display="block">
            Created: {new Date(record.creationDate).toLocaleDateString()}
          </Typography>
          <Typography variant="caption" display="block">
            Modified: {new Date(record.lastModifiedDate).toLocaleDateString()}
          </Typography>
        </CardContent>
        <CardActions sx={{ justifyContent: 'space-between' }}>
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={record.showOnTop}
                onChange={() => toggleShowOnTop(record.id, record.showOnTop)}
                color="primary"
              />
            }
            label="Top"
            labelPlacement="start"
          />
          <Box>
            <Tooltip title="Refresh TMDB">
              <IconButton
                size="small"
                onClick={() => handleRefreshTmdb(record.id)}
                disabled={refreshingRecords[record.id]}
              >
                {refreshingRecords[record.id] ? (
                  <CircularProgress size={16} />
                ) : (
                  <RefreshIcon fontSize="small" color="action" />
                )}
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete">
              <IconButton size="small" onClick={() => openDeleteDialog(record)}>
                <DeleteIcon fontSize="small" color="error" />
              </IconButton>
            </Tooltip>
          </Box>
        </CardActions>
      </MotionCard>
    </Grid>
  );

  // Render Record Card
  const renderRecordCards = () => (
    <Grid container spacing={1} sx={{ mb: 2, justifyContent: 'space-between', display: 'flex' }}>
      {paginatedRecords.map(record => (
        <RecordCard key={record.id} record={record} />
      ))}

      {loadingMore && (
        <Grid item xs={12} sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
          <CircularProgress size={24} />
        </Grid>
      )}

      <Grid item xs={12}>
        <div ref={loaderRef} style={{ height: 1 }} />
      </Grid>

    </Grid>
  );

  return (
    <Container maxWidth="xl" sx={{ px: 0, m: 0, py: 2 }}>
      {/* Header with Search and Add */}

      <Box sx={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        justifyContent: 'space-between',
        alignItems: isMobile ? 'stretch' : 'center',
        gap: isMobile ? 2 : 0,
        mb: 3,
        p: 0
      }}>
        <TextField
          fullWidth={isMobile}
          sx={{
            flexGrow: 1,
            maxWidth: isMobile ? '100%' : '400px',
            order: isMobile ? 2 : 1
          }}
          placeholder="Search by ID, Name, or TMDB ID"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(_, newMode) => newMode && setViewMode(newMode)}
            size="small"
          >
            <ToggleButton value="table" aria-label="table view">
              <Tooltip title="Table view">
                <ViewListIcon fontSize="small" />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="grid" aria-label="grid view">
              <Tooltip title="Grid view">
                <GridViewIcon fontSize="small" />
              </Tooltip>
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

      {/* Content */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress />
        </Box>
      ) : viewMode === 'table' ? (
        <Paper sx={{ height: '70vh', width: '100%', overflowX: 'auto' }}>
          <DataGrid
            rows={filteredRecords}
            columns={columns}
            pageSize={10}
            rowsPerPageOptions={[10, 25, 50]}
            disableSelectionOnClick
            loading={loading}
            density={isMobile ? 'compact' : 'standard'}
            components={{
              NoRowsOverlay: () => (
                <Box sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  p: 2
                }}>
                  <Typography variant="body1" color="textSecondary">
                    No records found
                  </Typography>
                  {searchQuery && (
                    <Button
                      variant="text"
                      size="small"
                      onClick={() => setSearchQuery('')}
                      sx={{ mt: 1 }}
                    >
                      Clear search
                    </Button>
                  )}
                </Box>
              )
            }}
          />
        </Paper>
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
                <Button
                  variant="text"
                  size="small"
                  onClick={() => setSearchQuery('')}
                  sx={{ mt: 1 }}
                >
                  Clear search
                </Button>
              )}
            </Box>
          ) : (
            // <Box sx={{ height: '100vh', overflow: 'auto' }}>
            renderRecordCards()
            // </Box>
          )}
        </>
      )}

      <AddRecordModal recordDialogOpen={recordDialogOpen} recordDialogClose={() => setRecordDialogOpen(false)} fetchRecords={fetchRecords} />

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onClose={closeDeleteDialog}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          {recordToDelete && (
            <Typography>
              Are you sure you want to delete <strong>{recordToDelete.name}</strong>?
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDeleteDialog}>Cancel</Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
      <RecordMediaFilesModal fileDialog={fileDialog} setFileDialogData={setFileDialogData} />
      {Constants.TOAST_CONTAINER}
    </Container>
  );
};

export default RecordManagement;