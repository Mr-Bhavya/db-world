import React, { useEffect, useState, useCallback, useMemo } from 'react';
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
} from '@mui/material';
import { Search, Refresh, TableView, ViewList, GridView } from '@mui/icons-material';
import {
    Add as AddIcon, Refresh as RefreshIcon, ViewList as ViewListIcon,
    GridView as GridViewIcon, Search as SearchIcon
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { getAllUsers, deleteUser, updateUserDetailsByAdmin } from '../../ApiServices';
import { useLocation, useNavigate } from 'react-router-dom';
import UsersTableView from './UsersTableView';
import UsersCardView from './UsersCardView';
import { handleApiError } from '../../Utils/errorHandler';
import { useConfirm } from 'material-ui-confirm';
import Constants from '../../Constants';
import { toast } from '../../Toast';

const UserManagement = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const theme = useTheme();
    const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));
    const confirm = useConfirm();

    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState('table');
    const [searchTerm, setSearchTerm] = useState('');
    const [refreshing, setRefreshing] = useState(false);

    // Memoized filtered users to prevent unnecessary recalculations
    const filteredUsers = useMemo(() =>
        users.filter(user => {
            const searchLower = searchTerm.toLowerCase();
            return (
                `${user.firstName} ${user.lastName}`.toLowerCase().includes(searchLower) ||
                user.email.toLowerCase().includes(searchLower) ||
                user.userRole?.name.toLowerCase().includes(searchLower)
            );
        }),
        [users, searchTerm]
    );

    // Fetch users with useCallback to prevent unnecessary recreations
    const fetchAllUsers = useCallback(async () => {
        try {
            setRefreshing(true);
            const usersRes = await getAllUsers();
            if (usersRes?.httpStatusCode === 200) {
                setUsers(usersRes.data);
            }
        } catch (error) {
            console.error("Error fetching users:", error);
            handleApiError(error, navigate, location);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [navigate, location]);

    // Handle user deletion
    const handleDeleteUser = useCallback(async (user) => {
        try {
            const result = await confirm({
                title: 'Confirm Delete',
                description: 'Are you sure you want to delete this user?',
                confirmationText: 'Delete',
                cancellationText: 'Cancel',
                confirmationButtonProps: { color: 'error' },
            });

            // If confirm resolves (i.e. not cancelled), result will be truthy
            if (!result.confirmed) return;

            const deleteRes = await deleteUser(user.userId);
            if (deleteRes?.httpStatusCode === 200) {
                setUsers(prevUsers => prevUsers.filter(prevUser => prevUser.userId !== user.userId));
                toast.success('User deleted successfully');
            }
        } catch (error) {
            handleApiError(error, navigate, location);
        }
    }, [confirm]);


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
            }
        } catch (error) {
            handleApiError(error, navigate, location);
        }
    }, [navigate, location]);

    // Initial data fetch
    useEffect(() => {
        fetchAllUsers();
    }, [fetchAllUsers]);

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                when: "beforeChildren",
                staggerChildren: 0.1,
            },
        },
    };

    if (loading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
                <CircularProgress size={60} />
            </Box>
        );
    }

    return (
        <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
            <motion.div
                initial="hidden"
                animate="visible"
                variants={containerVariants}
            >
                {/* Header Section */}
                <Box
                    display="flex"
                    flexDirection={{ xs: 'column', sm: 'row' }}
                    justifyContent="space-between"
                    alignItems={{ xs: 'flex-start', sm: 'center' }}
                    gap={2}
                    mb={3}
                >
                    <Typography variant="h4" component="h1">
                        User Management
                    </Typography>

                    {/* Controls */}
                    <Box display="flex" alignItems="center" gap={1}>
                        <TextField
                            variant="outlined"
                            size="small"
                            placeholder="Search users..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <Search />
                                    </InputAdornment>
                                ),
                            }}
                            sx={{ width: isSmallScreen ? '100%' : 300 }}
                        />

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

                        <Tooltip title="Refresh data">
                            <IconButton onClick={fetchAllUsers} disabled={refreshing}>
                                <Refresh className={refreshing ? 'spin' : ''} />
                            </IconButton>
                        </Tooltip>

                    </Box>
                </Box>

                {/* Content Section */}
                <AnimatePresence mode="wait">
                    <motion.div
                        key={viewMode}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.3 }}
                    >
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
                    </motion.div>
                </AnimatePresence>
            </motion.div>
            
        </Container>
    );
};

export default React.memo(UserManagement);