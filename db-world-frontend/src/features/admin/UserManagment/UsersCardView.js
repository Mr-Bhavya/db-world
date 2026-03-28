import React, { useState, useCallback, useMemo, memo, useEffect } from 'react';
import {
    Box,
    Button,
    Card,
    CardContent,
    CardHeader,
    CircularProgress,
    Container,
    Grid,
    IconButton,
    Typography,
    Chip,
    Avatar,
    Tooltip,
    alpha,
    useTheme,
    useMediaQuery,
    Fade,
    Collapse
} from '@mui/material';
import {
    Edit as EditIcon,
    Delete as DeleteIcon,
    Person as PersonIcon,
    Email as EmailIcon,
    Phone as PhoneIcon,
    CalendarToday as CalendarIcon,
    Transgender as GenderIcon,
    Login as LoginIcon,
    AdminPanelSettings as RoleIcon,
    KeyboardArrowDown,
    KeyboardArrowUp,
    Lock as LockIcon,
    VisibilityOff,
    Visibility,
    LaptopMac as LaptopIcon,
    Smartphone as SmartphoneIcon,
    TabletMac as TabletIcon,
    DesktopMac as DesktopIcon
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import UserEditModal from './UserEditModal';
import MobileUserCard from './MobileUserCard';
import UserViewModal from './UserViewModal';


const UsersCardView = ({ users = [], onView, onEdit, onDelete }) => {
    const theme = useTheme();
    const [expandedUser, setExpandedUser] = useState(null);
    const [selectedUser, setSelectedUser] = useState(null);
    const [viewModalOpen, setViewModalOpen] = useState(false);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [loading, setLoading] = useState(true);

    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'md'));

    const handleView = useCallback((user) => {
        setSelectedUser(user);
        setViewModalOpen(true);
    }, []);

    const handleEdit = useCallback((user) => {
        setSelectedUser(user);
        setEditModalOpen(true);
    }, []);

    // Format date for display - memoized
    const formatDate = useCallback((dateString) => {
        if (!dateString) return 'Not provided';
        try {
            const date = new Date(dateString);
            return isNaN(date.getTime()) ? dateString :
                date.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                });
        } catch {
            return dateString;
        }
    }, []);

    const formatDateTime = useCallback((dateString) => {
        if (!dateString) return '';
        try {
            const date = new Date(dateString);
            return isNaN(date.getTime()) ? dateString :
                date.toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
        } catch {
            return dateString;
        }
    }, []);

    // Memoized handlers
    const handleToggleExpand = useCallback((userId) => {
        setExpandedUser(prev => prev === userId ? null : userId);
    }, []);

    const handleDelete = useCallback((user) => {
        onDelete(user);
    }, [onDelete]);

    const handleSave = useCallback(async (updatedUser) => {
        try {
            await onEdit(updatedUser);
            setEditModalOpen(false);
        } catch (error) {
            console.error("Update error:", error);
        }
    }, [onEdit]);

    // Calculate grid columns - memoized
    const gridColumns = useMemo(() => {
        if (isMobile) return 1;
        if (isTablet) return 2;
        return 3;
    }, [isMobile, isTablet]);

    // Memoized user list
    const userCards = useMemo(() =>
        users.map((user, index) => (
            <Grid
                item
                xs={12}
                sm={gridColumns >= 2 ? 6 : 12}
                md={gridColumns >= 3 ? 4 : 6}
                key={user.userId}
                sx={{ display: 'flex' }}
            >
                <MobileUserCard
                    user={user}
                    index={index}
                    isExpanded={expandedUser === user.userId}
                    onToggleExpand={handleToggleExpand}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    formatDate={formatDate}
                    formatDateTime={formatDateTime}
                    isMobile={isMobile}
                />
            </Grid>
        )),
        [users, expandedUser, gridColumns, handleToggleExpand, handleEdit, handleDelete, formatDate, formatDateTime, isMobile]
    );

    useEffect(() => {
        const timer = setTimeout(() => {
            setLoading(false);
        }, 300);
        return () => clearTimeout(timer);
    }, []);

    return (
        <Container
            maxWidth="xl" sx={{p:0, m:0}}
        >
            {loading ? (
                <Box
                    display="flex"
                    justifyContent="center"
                    alignItems="center"
                    minHeight="300px"
                >
                    <CircularProgress />
                </Box>
            ) : (
                <>
                    {users.length === 0 ? (
                        <Box
                            display="flex"
                            justifyContent="center"
                            alignItems="center"
                            minHeight="200px"
                        >
                            <Typography color="text.secondary">
                                No users found
                            </Typography>
                        </Box>
                    ) : (
                        <Fade in={!loading} timeout={500}>
                            <Box
                                sx={{
                                    display: 'grid',
                                    gridTemplateColumns: isTablet ? 'repeat(auto-fill, minmax(280px, 1fr))' : 'repeat(auto-fill, minmax(320px, 1fr))',
                                    gap: 1.5,
                                    p:0, m:0
                                }}
                            >
                                {users.map((user) => (
                                    <MobileUserCard
                                        key={user.userId}
                                        user={user}
                                        onView={handleView}
                                        onEdit={handleEdit}
                                        onDelete={onDelete}
                                    />
                                ))}
                            </Box>
                        </Fade>
                    )}
                </>
            )}

            {/* View User Modal */}
            <UserViewModal
                user={selectedUser}
                open={viewModalOpen}
                onClose={() => setViewModalOpen(false)}
            />

            {/* Edit User Modal */}
            <UserEditModal
                user={selectedUser}
                open={editModalOpen}
                onClose={() => setEditModalOpen(false)}
                onSave={handleSave}
            />
        </Container>
    );
};

export default memo(UsersCardView);