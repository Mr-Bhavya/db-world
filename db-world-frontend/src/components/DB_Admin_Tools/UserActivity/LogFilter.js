import { FilterList, Search } from '@mui/icons-material';
import {
  Box,
  Typography,
  useTheme,
  useMediaQuery,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  TextField,
  InputAdornment,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Chip
} from '@mui/material';
import { useState, useCallback, useEffect, useRef } from 'react';
import { findUserByQuery } from '../../ApiServices';
import { Close } from '@mui/icons-material';

const LogFilters = ({ filters, onFilterChange }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [usernameQuery, setUsernameQuery] = useState('');
  const [localUsernames, setLocalUsernames] = useState([]);
  const [loadingUsernames, setLoadingUsernames] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [usernameDialogOpen, setUsernameDialogOpen] = useState(false);
  const searchTimeoutRef = useRef(null);

  const methodOptions = [
    { value: '', label: 'All Methods' },
    { value: 'GET', label: 'GET' },
    { value: 'POST', label: 'POST' },
    { value: 'PUT', label: 'PUT' },
    { value: 'DELETE', label: 'DELETE' },
    { value: 'PATCH', label: 'PATCH' }
  ];

  const statusOptions = [
    { value: '', label: 'All Statuses' },
    { value: '200', label: '200 OK' },
    { value: '201', label: '201 Created' },
    { value: '204', label: '204 No Content' },
    { value: '400', label: '400 Bad Request' },
    { value: '401', label: '401 Unauthorized' },
    { value: '403', label: '403 Forbidden' },
    { value: '404', label: '404 Not Found' },
    { value: '500', label: '500 Server Error' }
  ];

  // Fetch usernames based on query
  const fetchUsernames = useCallback(async (query) => {
    setLoadingUsernames(true);
    setFetchError(null);
    try {
      const response = await findUserByQuery(query);
      
      // Check if response.data exists and is an array
      let userData = [];
      if (response.data && Array.isArray(response.data)) {
        userData = response.data;
      } else if (response.data?.data && Array.isArray(response.data.data)) {
        // Handle case where users are in response.data.data
        userData = response.data.data;
      } else {
        throw new Error('Invalid response format');
      }
      
      setLocalUsernames(userData.map(user => ({
        label: `${user.fullName || user.username} (${user.email || user.username})`,
        value: user.email || user.username,
        userObject: user
      })));
    } catch (error) {
      console.error('Error fetching usernames:', error);
      setFetchError(error.message || 'Failed to fetch users');
      setLocalUsernames([]);
    } finally {
      setLoadingUsernames(false);
    }
  }, []);

  // Handle username search with debounce
  const handleUsernameSearch = useCallback((query) => {
    setUsernameQuery(query);
    
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    // Set new timeout for API call
    searchTimeoutRef.current = setTimeout(() => {
      fetchUsernames(query);
    }, 500); // 500ms debounce
  }, [fetchUsernames]);

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  const handleUsernameSelect = (username) => {
    onFilterChange('username', username);
    setUsernameDialogOpen(false);
    setUsernameQuery('');
  };

  const handleClearUsername = () => {
    onFilterChange('username', '');
    setUsernameQuery('');
  };

  const openUsernameDialog = () => {
    setUsernameDialogOpen(true);
    if (localUsernames.length === 0) {
      fetchUsernames('');
    }
  };

  return (
    <Box sx={{ mb: 3, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <FilterList sx={{ mr: 1 }} />
        <Typography variant="h6">Filters</Typography>
      </Box>
      
      <Box sx={{ 
        display: 'flex', 
        flexDirection: isMobile ? 'column' : 'row', 
        gap: 2,
        flexWrap: 'wrap'
      }}>
        <FormControl sx={{ minWidth: 120 }} size="small">
          <InputLabel>Method</InputLabel>
          <Select
            value={filters.method || ''}
            label="Method"
            onChange={(e) => onFilterChange('method', e.target.value)}
          >
            {methodOptions.map(option => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl sx={{ minWidth: 120 }} size="small">
          <InputLabel>Status</InputLabel>
          <Select
            value={filters.status || ''}
            label="Status"
            onChange={(e) => onFilterChange('status', e.target.value)}
          >
            {statusOptions.map(option => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl sx={{ minWidth: 180 }} size="small">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip
              label={filters.username || 'Select username...'}
              onClick={openUsernameDialog}
              onDelete={filters.username ? handleClearUsername : undefined}
              deleteIcon={filters.username ? <Close /> : undefined}
              variant="outlined"
              sx={{ 
                minWidth: 180, 
                justifyContent: 'space-between',
                borderRadius: 1,
                height: 40,
                '& .MuiChip-label': {
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }
              }}
            />
          </Box>
        </FormControl>
      </Box>

      {/* Username Search Dialog */}
      <Dialog 
        open={usernameDialogOpen} 
        onClose={() => setUsernameDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6">Search Users</Typography>
            <IconButton onClick={() => setUsernameDialogOpen(false)}>
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            size="medium"
            placeholder="Type to search users..."
            value={usernameQuery}
            onChange={(e) => handleUsernameSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
              endAdornment: loadingUsernames && (
                <InputAdornment position="end">
                  <CircularProgress size={20} />
                </InputAdornment>
              )
            }}
            sx={{ mb: 2 }}
            autoFocus
          />

          <List sx={{ maxHeight: 300, overflow: 'auto' }}>
            {localUsernames.map(user => (
              <ListItem 
                key={user.value} 
                button 
                onClick={() => handleUsernameSelect(user.value)}
                selected={filters.username === user.value}
              >
                <ListItemText 
                  primary={user.label} 
                  secondary={user.value}
                />
              </ListItem>
            ))}
            
            {!loadingUsernames && localUsernames.length === 0 && usernameQuery && (
              <ListItem>
                <ListItemText 
                  primary="No users found" 
                  secondary={`No results for "${usernameQuery}"`}
                />
              </ListItem>
            )}
            
            {!loadingUsernames && localUsernames.length === 0 && !usernameQuery && (
              <ListItem>
                <ListItemText 
                  primary="Start typing to search" 
                  secondary="Enter a username or email to search"
                />
              </ListItem>
            )}
            
            {fetchError && (
              <ListItem>
                <ListItemText 
                  primary="Error loading users" 
                  secondary={fetchError}
                  sx={{ color: 'error.main' }}
                />
              </ListItem>
            )}
          </List>
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default LogFilters;