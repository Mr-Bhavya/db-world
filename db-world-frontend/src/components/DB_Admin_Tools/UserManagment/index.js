import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Box,
    Typography,
    CircularProgress,
    TextField,
    InputAdornment,
    IconButton,
    Tooltip,
    Container,
    useMediaQuery,
    useTheme,
    ToggleButtonGroup,
    ToggleButton,
    Button,
    Fade,
    Chip,
    Stack,
    alpha,
    Menu,
    MenuItem,
    ListItemIcon,
    ListItemText,
    Divider,
    Badge
} from '@mui/material';
import { useLocation, useNavigate } from 'react-router-dom';
import { useConfirm } from 'material-ui-confirm';
import { getAllUsers, deleteUser, updateUserDetailsByAdmin } from '../../ApiServices';
import { handleApiError } from '../../Utils/errorHandler';
import { toast } from '../../Toast';
import UsersTableView from './UsersTableView';
import MobileUserCard from './MobileUserCard';
import { 
    Add, 
    Clear, 
    People, 
    Refresh, 
    Search, 
    TableView, 
    ViewList,
    Apps,
    FilterList,
    Download,
    MoreVert,
    GridView as GridViewIcon,
    ImportExport,
    Sort
} from '@mui/icons-material';
import GridView from '../AdminPage/GridView';
import { AnimatePresence } from 'framer-motion';
import UsersCardView from './UsersCardView';

// Custom debounce implementation
const useDebounce = (callback, delay) => {
  const timeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return useCallback(
    (...args) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    },
    [callback, delay]
  );
};

// Main UserManagement Component
const UserManagement = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'md'));
    const confirm = useConfirm();
    const searchInputRef = useRef(null);

    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState(isMobile ? 'list' : 'table');
    const [searchTerm, setSearchTerm] = useState('');
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);
    const [selectedUser, setSelectedUser] = useState(null);
    const [moreMenuAnchor, setMoreMenuAnchor] = useState(null);

    // Memoized filtered users
    const filteredUsers = useMemo(() => {
        if (!searchTerm.trim()) return users;

        const searchLower = searchTerm.toLowerCase().trim();
        return users.filter(user => {
            const searchable = [
                user.email?.toLowerCase(),
                user.firstName?.toLowerCase(),
                user.lastName?.toLowerCase(),
                user.userRole?.name?.toLowerCase(),
                `${user.firstName} ${user.lastName}`.toLowerCase()
            ].filter(Boolean);

            return searchable.some(text => text.includes(searchLower));
        });
    }, [users, searchTerm]);

    // Fixed debounced search handler
    const debouncedSearch = useDebounce((value) => {
        setSearchTerm(value);
    }, 300);

    // Clear search
    const handleClearSearch = useCallback(() => {
        setSearchTerm('');
        if (searchInputRef.current) {
            searchInputRef.current.value = '';
        }
    }, []);

    // Fetch users
    const fetchAllUsers = useCallback(async (showLoading = true) => {
        try {
            if (showLoading) {
                setLoading(true);
                setRefreshing(true);
            }
            setError(null);

            const usersRes = await getAllUsers();
            if (usersRes?.httpStatusCode === 200) {
                setUsers(usersRes.data || []);
                if (usersRes.data?.length === 0) {
                    toast.info('No users found');
                }
            } else {
                throw new Error(usersRes?.message || 'Failed to fetch users');
            }
        } catch (error) {
            console.error("Error fetching users:", error);
            setError(error.message);
            handleApiError(error, navigate, location);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [navigate, location]);

    // Handle user actions
    const handleDeleteUser = useCallback(async (userId) => {
        const user = users.find(u => u.userId === userId);
        if (!user) return;

        try {
            await confirm({
                title: 'Delete User',
                description: `Are you sure you want to delete ${user.firstName} ${user.lastName}?`,
                confirmationText: 'Delete',
                cancellationText: 'Cancel',
                confirmationButtonProps: { variant: 'contained', color: 'error' },
                cancellationButtonProps: { variant: 'outlined' }
            });

            const deleteRes = await deleteUser(userId);
            if (deleteRes?.httpStatusCode === 200) {
                setUsers(prev => prev.filter(u => u.userId !== userId));
                toast.success('User deleted successfully');
            }
        } catch (error) {
            if (error !== 'cancel') {
                handleApiError(error, navigate, location);
            }
        }
    }, [users, confirm, navigate, location]);

    const handleUpdateUser = useCallback(async (updatedUser) => {
        try {
            const updateRes = await updateUserDetailsByAdmin(updatedUser);
            if (updateRes?.httpStatusCode === 200) {
                setUsers(prev => prev.map(user =>
                    user.userId === updatedUser.userId ? updatedUser : user
                ));
                toast.success('User updated successfully');
                return true;
            }
            return false;
        } catch (error) {
            handleApiError(error, navigate, location);
            throw error;
        }
    }, [navigate, location]);

    // Navigation handlers
    const handleViewModeChange = useCallback((_, newMode) => {
        if (newMode) setViewMode(newMode);
    }, []);

    const handleAddUser = useCallback(() => {
        navigate('/users/add');
    }, [navigate]);

    const handleViewUser = useCallback((user) => {
        setSelectedUser(user);
        // TODO: Open view modal
        //console.log('View user:', user);
    }, []);

    const handleEditUser = useCallback((user) => {
        setSelectedUser(user);
        handleUpdateUser(user);
        //console.log('Edit user:', user);
    }, []);

    const handleExportData = useCallback(() => {
        toast.info('Export feature coming soon!');
        setMoreMenuAnchor(null);
    }, []);

    const handleImportData = useCallback(() => {
        toast.info('Import feature coming soon!');
        setMoreMenuAnchor(null);
    }, []);

    const handleMoreMenuOpen = useCallback((event) => {
        setMoreMenuAnchor(event.currentTarget);
    }, []);

    const handleMoreMenuClose = useCallback(() => {
        setMoreMenuAnchor(null);
    }, []);

    // Initial fetch
    useEffect(() => {
        fetchAllUsers();
    }, [fetchAllUsers]);

    // Calculate stats
    const stats = useMemo(() => ({
        total: users.length,
        active: users.filter(u => u.isActive).length,
        filtered: filteredUsers.length
    }), [users, filteredUsers]);

    // Loading state
    if (loading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
                <CircularProgress size={40} thickness={3} />
            </Box>
        );
    }

    return (
        <Container
            maxWidth="xl"
            disableGutters={isMobile}
            sx={{
                p: { xs: 0.25, sm: 0.5, md: 1 },
                height: '100%',
                minHeight: 0,
            }}
        >
            <Fade in={!loading} timeout={200}>
                <Box sx={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                    {/* Header - Enhanced */}
                    <Box sx={{
                        display: 'flex',
                        flexDirection: isMobile ? 'column' : 'row',
                        gap: 1,
                        alignItems: isMobile ? 'stretch' : 'center',
                        mb: 1,
                        p: { xs: 1, sm: 1.5 },
                        borderRadius: 1.5,
                        bgcolor: alpha(theme.palette.background.paper, 0.97),
                        border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                        boxShadow: theme.shadows[1],
                    }}>
                        {/* Left Section - Title & Stats */}
                        <Box sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1.5,
                            flex: 1,
                            minWidth: 0,
                        }}>
                            <Box sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                                flex: 1,
                                minWidth: 0,
                            }}>
                                <Box sx={{
                                    p: 0.75,
                                    borderRadius: 1,
                                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}>
                                    <People sx={{ 
                                        fontSize: isMobile ? 20 : 24,
                                        color: theme.palette.primary.main 
                                    }} />
                                </Box>
                                
                                <Box sx={{ minWidth: 0 }}>
                                    <Typography
                                        variant={isMobile ? "h6" : "h5"}
                                        fontWeight={700}
                                        noWrap
                                        sx={{
                                            background: `linear-gradient(45deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                                            backgroundClip: 'text',
                                            WebkitBackgroundClip: 'text',
                                            color: 'transparent',
                                        }}
                                    >
                                        User Management
                                    </Typography>
                                    <Typography
                                        variant="caption"
                                        color="text.secondary"
                                        sx={{ display: { xs: 'none', sm: 'block' } }}
                                    >
                                        Manage all system users and their permissions
                                    </Typography>
                                </Box>
                            </Box>

                            {/* Desktop Stats */}
                            {!isMobile && (
                                <Stack direction="row" spacing={1} sx={{ ml: 'auto' }}>
                                    <Chip
                                        label={`Total: ${stats.total}`}
                                        size="small"
                                        variant="outlined"
                                        sx={{ 
                                            height: 28, 
                                            fontSize: '0.75rem',
                                            fontWeight: 500 
                                        }}
                                    />
                                    <Chip
                                        label={`Active: ${stats.active}`}
                                        size="small"
                                        color="success"
                                        variant="outlined"
                                        sx={{ 
                                            height: 28, 
                                            fontSize: '0.75rem',
                                            fontWeight: 500 
                                        }}
                                    />
                                    {stats.filtered !== stats.total && (
                                        <Chip
                                            label={`Filtered: ${stats.filtered}`}
                                            size="small"
                                            color="primary"
                                            sx={{ 
                                                height: 28, 
                                                fontSize: '0.75rem',
                                                fontWeight: 500 
                                            }}
                                        />
                                    )}
                                </Stack>
                            )}
                        </Box>

                        {/* Right Section - Controls */}
                        <Box sx={{
                            display: 'flex',
                            gap: 1,
                            alignItems: 'center',
                            width: isMobile ? '100%' : 'auto',
                            flexWrap: isMobile ? 'wrap' : 'nowrap',
                        }}>
                            {/* Search Bar */}
                            <TextField
                                inputRef={searchInputRef}
                                variant="outlined"
                                size="small"
                                placeholder="Search users..."
                                defaultValue={searchTerm}
                                onChange={(e) => debouncedSearch(e.target.value)}
                                InputProps={{
                                    sx: { 
                                        height: 38,
                                        fontSize: '0.875rem',
                                        borderRadius: 1,
                                    },
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <Search fontSize="small" color="action" />
                                        </InputAdornment>
                                    ),
                                    endAdornment: searchTerm && (
                                        <InputAdornment position="end">
                                            <IconButton
                                                size="small"
                                                onClick={handleClearSearch}
                                                edge="end"
                                                sx={{ 
                                                    p: 0.5,
                                                    mr: -0.5 
                                                }}
                                            >
                                                <Clear fontSize="small" />
                                            </IconButton>
                                        </InputAdornment>
                                    ),
                                }}
                                sx={{
                                    flex: isMobile ? '1 1 100%' : '0 1 300px',
                                    minWidth: isMobile ? '100%' : 200,
                                    '& .MuiOutlinedInput-root': {
                                        borderRadius: 1,
                                    }
                                }}
                            />

                            {/* Action Buttons Group */}
                            <Box sx={{ 
                                display: 'flex', 
                                gap: 0.5,
                                flexShrink: 0,
                                flexWrap: 'nowrap',
                            }}>
                                {/* View Mode Toggle */}
                                <ToggleButtonGroup
                                    value={viewMode}
                                    exclusive
                                    onChange={handleViewModeChange}
                                    size="small"
                                    sx={{
                                        height: 38,
                                        bgcolor: 'transparent',
                                        border: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
                                        borderRadius: 1,
                                        overflow: 'hidden',
                                    }}
                                >
                                    <ToggleButton 
                                        value="table" 
                                        sx={{ 
                                            px: 1.25,
                                            minWidth: 38,
                                            borderRight: `1px solid ${alpha(theme.palette.divider, 0.2)} !important`
                                        }}
                                    >
                                        <Tooltip title="Table View">
                                            <TableView fontSize="small" />
                                        </Tooltip>
                                    </ToggleButton>
                                    <ToggleButton 
                                        value="grid" 
                                        sx={{ 
                                            px: 1.25,
                                            minWidth: 38 
                                        }}
                                    >
                                        <Tooltip title="Grid View">
                                            <GridViewIcon fontSize="small" />
                                        </Tooltip>
                                    </ToggleButton>
                                </ToggleButtonGroup>

                                {/* Refresh Button */}
                                <Tooltip title="Refresh">
                                    <IconButton
                                        size="small"
                                        onClick={() => fetchAllUsers(true)}
                                        disabled={refreshing}
                                        sx={{
                                            height: 38,
                                            width: 38,
                                            bgcolor: alpha(theme.palette.primary.main, 0.05),
                                            borderRadius: 1,
                                            border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
                                            '&:hover': {
                                                bgcolor: alpha(theme.palette.primary.main, 0.1),
                                            }
                                        }}
                                    >
                                        <Refresh
                                            sx={{
                                                fontSize: 20,
                                                color: theme.palette.primary.main,
                                                animation: refreshing ? 'spin 1s linear infinite' : 'none',
                                                '@keyframes spin': {
                                                    '0%': { transform: 'rotate(0deg)' },
                                                    '100%': { transform: 'rotate(360deg)' },
                                                }
                                            }}
                                        />
                                    </IconButton>
                                </Tooltip>

                                {/* Add User Button */}
                                <Button
                                    variant="contained"
                                    size="small"
                                    onClick={handleAddUser}
                                    startIcon={!isMobile && <Add />}
                                    sx={{
                                        height: 38,
                                        minWidth: isMobile ? 'auto' : 100,
                                        px: isMobile ? 1.25 : 2,
                                        borderRadius: 1,
                                        background: `linear-gradient(45deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
                                        '&:hover': {
                                            background: `linear-gradient(45deg, ${theme.palette.primary.dark}, ${theme.palette.primary.main})`,
                                        }
                                    }}
                                >
                                    {isMobile ? <Add /> : 'Add User'}
                                </Button>

                                {/* More Actions Menu */}
                                <Tooltip title="More actions">
                                    <IconButton
                                        size="small"
                                        onClick={handleMoreMenuOpen}
                                        sx={{
                                            height: 38,
                                            width: 38,
                                            borderRadius: 1,
                                            border: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
                                            display: { xs: 'none', sm: 'flex' }
                                        }}
                                    >
                                        <MoreVert fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                            </Box>
                        </Box>
                    </Box>

                    {/* Mobile Stats Bar */}
                    {isMobile && (
                        <Box sx={{
                            display: 'flex',
                            gap: 0.75,
                            mb: 1,
                            px: 1,
                            overflow: 'auto',
                            '&::-webkit-scrollbar': { display: 'none' }
                        }}>
                            <Chip
                                label={`Total: ${stats.total}`}
                                size="small"
                                variant="outlined"
                                sx={{ 
                                    height: 26, 
                                    fontSize: '0.75rem',
                                    fontWeight: 500 
                                }}
                            />
                            <Chip
                                label={`Active: ${stats.active}`}
                                size="small"
                                color="success"
                                variant="outlined"
                                sx={{ 
                                    height: 26, 
                                    fontSize: '0.75rem',
                                    fontWeight: 500 
                                }}
                            />
                            {stats.filtered !== stats.total && (
                                <Chip
                                    label={`Filtered: ${stats.filtered}`}
                                    size="small"
                                    color="primary"
                                    sx={{ 
                                        height: 26, 
                                        fontSize: '0.75rem',
                                        fontWeight: 500 
                                    }}
                                />
                            )}
                        </Box>
                    )}

                    {/* Error State */}
                    {error && (
                        <Box sx={{
                            mb: 1,
                            p: 1.5,
                            bgcolor: alpha(theme.palette.error.main, 0.08),
                            borderLeft: `3px solid ${theme.palette.error.main}`,
                            borderRadius: 1,
                        }}>
                            <Typography variant="body2" color="error" sx={{ fontWeight: 500 }}>
                                Error: {error}
                            </Typography>
                            <Button
                                size="small"
                                onClick={() => fetchAllUsers(true)}
                                sx={{ mt: 0.5, fontSize: '0.75rem' }}
                                startIcon={<Refresh fontSize="small" />}
                            >
                                Retry
                            </Button>
                        </Box>
                    )}

                    {/* Content Area */}
                    <Box sx={{
                        flex: 1,
                        minHeight: 0,
                        borderRadius:isMobile ? "" : 1.5,
                        overflow: 'hidden',
                        border: isMobile ? "" : `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                        bgcolor: isMobile ? "" : theme.palette.background.paper,
                        boxShadow: isMobile ? "" : theme.shadows[1],
                    }}>
                        {/* Empty State */}
                        {!loading && filteredUsers.length === 0 && !error && (
                            <Box
                                display="flex"
                                flexDirection="column"
                                justifyContent="center"
                                alignItems="center"
                                height="100%"
                                textAlign="center"
                                p={4}
                            >
                                <Box sx={{
                                    width: 80,
                                    height: 80,
                                    borderRadius: '50%',
                                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    mb: 2
                                }}>
                                    <People sx={{
                                        fontSize: 40,
                                        color: theme.palette.primary.main,
                                    }} />
                                </Box>
                                <Typography
                                    variant="h6"
                                    color="text.primary"
                                    gutterBottom
                                    sx={{ fontWeight: 600, mb: 0.5 }}
                                >
                                    {searchTerm ? 'No matching users found' : 'No users yet'}
                                </Typography>
                                <Typography 
                                    variant="body2" 
                                    color="text.secondary" 
                                    sx={{ mb: 2, maxWidth: 400 }}
                                >
                                    {searchTerm 
                                        ? 'Try adjusting your search terms or filters' 
                                        : 'Get started by adding your first user to the system'}
                                </Typography>
                                <Box sx={{ display: 'flex', gap: 1 }}>
                                    {searchTerm ? (
                                        <Button
                                            variant="outlined"
                                            size="small"
                                            onClick={handleClearSearch}
                                            startIcon={<Clear />}
                                        >
                                            Clear Search
                                        </Button>
                                    ) : (
                                        <Button
                                            variant="contained"
                                            size="small"
                                            onClick={handleAddUser}
                                            startIcon={<Add />}
                                        >
                                            Add First User
                                        </Button>
                                    )}
                                </Box>
                            </Box>
                        )}

                        {/* Users List/Grid */}
                        {!error && filteredUsers.length > 0 && (
                            <Fade in={true} timeout={200}>
                                <Box sx={{
                                    height: '100%',
                                    overflow: 'auto',
                                    // p: { xs: 0.5, sm: 1.5 }
                                }}>
                                    {viewMode === 'table' ? (
                                        <AnimatePresence>
                                            <UsersTableView
                                                users={filteredUsers}
                                                onView={handleViewUser}
                                                onEdit={handleEditUser}
                                                onDelete={handleDeleteUser}
                                                compact={isMobile}
                                            />
                                        </AnimatePresence>
                                    ) : (
                                        <UsersCardView
                                            users={filteredUsers}
                                            onView={handleViewUser}
                                            onEdit={handleEditUser}
                                            onDelete={handleDeleteUser}
                                        />
                                    )}
                                </Box>
                            </Fade>
                        )}
                    </Box>

                    {/* More Actions Menu */}
                    <Menu
                        anchorEl={moreMenuAnchor}
                        open={Boolean(moreMenuAnchor)}
                        onClose={handleMoreMenuClose}
                        PaperProps={{
                            sx: {
                                mt: 1,
                                borderRadius: 1,
                                minWidth: 200,
                            }
                        }}
                    >
                        <MenuItem onClick={handleExportData}>
                            <ListItemIcon>
                                <Download fontSize="small" />
                            </ListItemIcon>
                            <ListItemText>Export Users</ListItemText>
                        </MenuItem>
                        <MenuItem onClick={handleImportData}>
                            <ListItemIcon>
                                <ImportExport fontSize="small" />
                            </ListItemIcon>
                            <ListItemText>Import Users</ListItemText>
                        </MenuItem>
                        <Divider />
                        <MenuItem onClick={handleMoreMenuClose}>
                            <ListItemIcon>
                                <FilterList fontSize="small" />
                            </ListItemIcon>
                            <ListItemText>Advanced Filters</ListItemText>
                        </MenuItem>
                        <MenuItem onClick={handleMoreMenuClose}>
                            <ListItemIcon>
                                <Sort fontSize="small" />
                            </ListItemIcon>
                            <ListItemText>Sort Options</ListItemText>
                        </MenuItem>
                    </Menu>
                </Box>
            </Fade>
        </Container>
    );
};

export default memo(UserManagement);