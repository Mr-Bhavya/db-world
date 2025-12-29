import React, { useEffect, useState, useCallback, useMemo, memo, useRef } from 'react';
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
    debounce
} from '@mui/material';
import {
    Search,
    Refresh,
    ViewList,
    GridView,
    Add,
    People,
    Clear
} from '@mui/icons-material';
import { getAllUsers, deleteUser, updateUserDetailsByAdmin } from '../../ApiServices';
import { useLocation, useNavigate } from 'react-router-dom';
import UsersTableView from './UsersTableView';
import UsersCardView from './UsersCardView';
import { handleApiError } from '../../Utils/errorHandler';
import { useConfirm } from 'material-ui-confirm';
import { toast } from '../../Toast';

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
    const [viewMode, setViewMode] = useState('table');
    const [searchTerm, setSearchTerm] = useState('');
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);

    // Memoized filtered users with optimized search
    const filteredUsers = useMemo(() => {
        if (!searchTerm.trim()) return users;

        const searchLower = searchTerm.toLowerCase().trim();
        return users.filter(user => {
            const email = user.email?.toLowerCase() || '';
            const firstName = user.firstName?.toLowerCase() || '';
            const lastName = user.lastName?.toLowerCase() || '';
            const roleName = user.userRole?.name?.toLowerCase() || '';
            
            return (
                email.includes(searchLower) ||
                firstName.includes(searchLower) ||
                lastName.includes(searchLower) ||
                `${firstName} ${lastName}`.includes(searchLower) ||
                roleName.includes(searchLower)
            );
        });
    }, [users, searchTerm]);

    // Debounced search handler
    const handleSearchChange = useCallback(
        debounce((value) => {
            setSearchTerm(value);
        }, 300),
        []
    );

    // Clear search handler - fixed
    const handleClearSearch = useCallback(() => {
        setSearchTerm('');
        if (searchInputRef.current) {
            searchInputRef.current.value = '';
        }
    }, []);

    // Fetch users with error handling
    const fetchAllUsers = useCallback(async (showLoading = true) => {
        try {
            if (showLoading) setRefreshing(true);
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

    // Handle user deletion
    const handleDeleteUser = useCallback(async (user) => {
        try {
            await confirm({
                title: 'Delete User',
                description: `Are you sure you want to delete ${user.firstName} ${user.lastName}?`,
                confirmationText: 'Delete',
                cancellationText: 'Cancel',
                confirmationButtonProps: { 
                    variant: 'contained',
                    color: 'error'
                },
                cancellationButtonProps: {
                    variant: 'outlined'
                }
            });

            const deleteRes = await deleteUser(user.userId);
            if (deleteRes?.httpStatusCode === 200) {
                setUsers(prevUsers => 
                    prevUsers.filter(prevUser => prevUser.userId !== user.userId)
                );
                toast.success('User deleted successfully');
            }
        } catch (error) {
            if (error !== 'cancel') {
                handleApiError(error, navigate, location);
            }
        }
    }, [confirm, navigate, location]);

    // Handle user updates
    const handleUpdateUser = useCallback(async (updatedUser) => {
        try {
            const updateRes = await updateUserDetailsByAdmin(updatedUser);
            if (updateRes?.httpStatusCode === 200) {
                setUsers(prevUsers =>
                    prevUsers.map(user =>
                        user.userId === updatedUser.userId ? updatedUser : user
                    )
                );
                toast.success('User updated successfully');
                return true;
            }
            return false;
        } catch (error) {
            handleApiError(error, navigate, location);
            throw error;
        }
    }, [navigate, location]);

    // Initial data fetch
    useEffect(() => {
        fetchAllUsers();
    }, [fetchAllUsers]);

    // Handle view mode change
    const handleViewModeChange = useCallback((_, newMode) => {
        if (newMode) setViewMode(newMode);
    }, []);

    // Handle add user
    const handleAddUser = useCallback(() => {
        navigate('/users/add');
    }, [navigate]);

    // Calculate stats
    const stats = useMemo(() => {
        const totalUsers = users.length;
        const activeUsers = users.filter(u => u.isActive).length;
        const adminUsers = users.filter(u => u.userRole?.name === 'Admin').length;
        
        return { totalUsers, activeUsers, adminUsers };
    }, [users]);

    if (loading) {
        return (
            <Box 
                display="flex" 
                justifyContent="center" 
                alignItems="center" 
                minHeight="60vh"
            >
                <CircularProgress size={60} />
            </Box>
        );
    }

    return (
        <Container 
            maxWidth="xl" 
            sx={{ 
                py: isMobile ? 2 : 4,
                px: isMobile ? 1 : 2
            }}
        >
            <Fade in={!loading} timeout={500}>
                <Box>
                    {/* Header Section - Mobile optimized */}
                    <Box
                        sx={{
                            mb: isMobile ? 2 : 3,
                        }}
                    >
                        <Stack 
                            direction={isMobile ? 'column' : 'row'} 
                            spacing={2}
                            justifyContent="space-between"
                            alignItems={isMobile ? 'stretch' : 'center'}
                        >
                            <Box sx={{ mb: isMobile ? 1 : 0 }}>
                                <Typography 
                                    variant={isMobile ? "h5" : "h4"} 
                                    fontWeight={600}
                                    gutterBottom
                                >
                                    User Management
                                </Typography>
                                <Typography 
                                    variant="body2" 
                                    color="text.secondary"
                                    sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                                >
                                    <People fontSize="small" />
                                    {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''} found
                                </Typography>
                            </Box>

                            {/* Add User Button - Inline on mobile */}
                            <Button
                                variant="contained"
                                startIcon={<Add />}
                                onClick={handleAddUser}
                                size={isMobile ? "small" : "medium"}
                                fullWidth={isMobile}
                                sx={{
                                    mb: isMobile ? 1.5 : 0
                                }}
                            >
                                {isMobile ? 'Add' : 'Add User'}
                            </Button>
                        </Stack>
                    </Box>

                    {/* Controls Section - Optimized for mobile */}
                    <Box
                        sx={{
                            display: 'flex',
                            flexDirection: isMobile ? 'column' : 'row',
                            gap: 1.5,
                            alignItems: 'center',
                            mb: 3,
                            p: isMobile ? 1.5 : 2,
                            borderRadius: 2,
                            bgcolor: 'background.paper',
                            border: `1px solid ${theme.palette.divider}`,
                        }}
                    >
                        {/* Search - Full width on mobile */}
                        <TextField
                            inputRef={searchInputRef}
                            variant="outlined"
                            size="small"
                            placeholder="Search by name, email, or role..."
                            defaultValue={searchTerm}
                            onChange={(e) => {
                                const value = e.target.value;
                                handleSearchChange(value);
                                setSearchTerm(value); // Keep local state in sync
                            }}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <Search color="action" />
                                    </InputAdornment>
                                ),
                                endAdornment: searchTerm && (
                                    <InputAdornment position="end">
                                        <IconButton
                                            size="small"
                                            onClick={handleClearSearch}
                                            edge="end"
                                            sx={{ p: 0.5 }}
                                        >
                                            <Clear fontSize="small" />
                                        </IconButton>
                                    </InputAdornment>
                                ),
                            }}
                            sx={{
                                flex: 1,
                                minWidth: isMobile ? '100%' : 300,
                                '& .MuiOutlinedInput-root': {
                                    borderRadius: 1.5,
                                }
                            }}
                        />

                        {/* Action Buttons Row - Single row on mobile */}
                        <Box
                            sx={{
                                display: 'flex',
                                flexDirection: 'row',
                                gap: 1,
                                width: isMobile ? '100%' : 'auto',
                                justifyContent: isMobile ? 'space-between' : 'flex-start',
                            }}
                        >
                            {/* View Mode Toggle */}
                            <ToggleButtonGroup
                                value={viewMode}
                                exclusive
                                onChange={handleViewModeChange}
                                size="small"
                                sx={{
                                    bgcolor: 'background.default',
                                    borderRadius: 1.5,
                                    height: 'fit-content',
                                }}
                            >
                                <ToggleButton 
                                    value="table" 
                                    aria-label="table view"
                                    sx={{ 
                                        px: isMobile ? 1.5 : 2,
                                        borderRadius: 1.5,
                                        minWidth: isMobile ? 56 : 'auto',
                                    }}
                                >
                                    <Tooltip title="Table view">
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: isMobile ? 0.5 : 1 }}>
                                            <ViewList fontSize="small" />
                                            {!isMobile && (
                                                <Typography variant="caption">
                                                    Table
                                                </Typography>
                                            )}
                                        </Box>
                                    </Tooltip>
                                </ToggleButton>
                                <ToggleButton 
                                    value="grid" 
                                    aria-label="grid view"
                                    sx={{ 
                                        px: isMobile ? 1.5 : 2,
                                        borderRadius: 1.5,
                                        minWidth: isMobile ? 56 : 'auto',
                                    }}
                                >
                                    <Tooltip title="Grid view">
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: isMobile ? 0.5 : 1 }}>
                                            <GridView fontSize="small" />
                                            {!isMobile && (
                                                <Typography variant="caption">
                                                    Grid
                                                </Typography>
                                            )}
                                        </Box>
                                    </Tooltip>
                                </ToggleButton>
                            </ToggleButtonGroup>

                            {/* Refresh Button */}
                            <Tooltip title="Refresh data">
                                <IconButton
                                    onClick={() => fetchAllUsers(true)}
                                    disabled={refreshing}
                                    sx={{
                                        bgcolor: 'background.default',
                                        borderRadius: 1.5,
                                        p: 1,
                                        minWidth: isMobile ? 40 : 'auto',
                                        height: isMobile ? 40 : 'auto',
                                    }}
                                >
                                    <Refresh
                                        sx={{
                                            animation: refreshing ? 'spin 1s linear infinite' : 'none',
                                            '@keyframes spin': {
                                                '0%': { transform: 'rotate(0deg)' },
                                                '100%': { transform: 'rotate(360deg)' },
                                            }
                                        }}
                                    />
                                </IconButton>
                            </Tooltip>
                        </Box>
                    </Box>

                    {/* Stats Section - Only on larger screens */}
                    {!isMobile && (
                        <Box sx={{ mb: 3 }}>
                            <Stack direction="row" spacing={2}>
                                <Chip
                                    label={`Total: ${stats.totalUsers}`}
                                    color="default"
                                    variant="outlined"
                                    size="small"
                                />
                                <Chip
                                    label={`Active: ${stats.activeUsers}`}
                                    color="success"
                                    variant="outlined"
                                    size="small"
                                />
                                <Chip
                                    label={`Admins: ${stats.adminUsers}`}
                                    color="primary"
                                    variant="outlined"
                                    size="small"
                                />
                            </Stack>
                        </Box>
                    )}

                    {/* Error State */}
                    {error && (
                        <Box sx={{ mb: 3, p: 2, bgcolor: 'error.light', borderRadius: 2 }}>
                            <Typography color="error" variant="body2">
                                Error: {error}
                            </Typography>
                            <Button 
                                size="small" 
                                onClick={() => fetchAllUsers(true)}
                                sx={{ mt: 1 }}
                            >
                                Retry
                            </Button>
                        </Box>
                    )}

                    {/* Empty State */}
                    {!loading && filteredUsers.length === 0 && !error && (
                        <Box
                            display="flex"
                            flexDirection="column"
                            justifyContent="center"
                            alignItems="center"
                            minHeight="300px"
                            textAlign="center"
                            p={4}
                        >
                            <People sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
                            <Typography variant="h6" color="text.secondary" gutterBottom>
                                No users found
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                {searchTerm ? 'Try adjusting your search terms' : 'Add your first user to get started'}
                            </Typography>
                            {searchTerm && (
                                <Button
                                    variant="outlined"
                                    onClick={handleClearSearch}
                                    sx={{ mt: 2 }}
                                >
                                    Clear Search
                                </Button>
                            )}
                        </Box>
                    )}

                    {/* Content Section */}
                    {!error && filteredUsers.length > 0 && (
                        <Fade in={!error && filteredUsers.length > 0} timeout={300}>
                            <Box>
                                {viewMode === 'table' ? (
                                    <UsersTableView
                                        users={filteredUsers}
                                        onDelete={handleDeleteUser}
                                        onUpdate={handleUpdateUser}
                                    />
                                ) : (
                                    <UsersCardView
                                        users={filteredUsers}
                                        onDelete={handleDeleteUser}
                                        onUpdate={handleUpdateUser}
                                    />
                                )}
                            </Box>
                        </Fade>
                    )}
                </Box>
            </Fade>
        </Container>
    );
};

export default memo(UserManagement);