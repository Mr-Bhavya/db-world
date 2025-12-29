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

// Styled components with better performance
const StyledCard = styled(Card, {
    shouldForwardProp: (prop) => !['hovered'].includes(prop)
})(({ theme, hovered }) => ({
    background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.9)} 0%, ${alpha(theme.palette.background.paper, 0.7)} 100%)`,
    borderRadius: theme.spacing(2),
    border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
    boxShadow: hovered 
        ? `0 8px 24px ${alpha(theme.palette.common.black, 0.08)}`
        : `0 2px 8px ${alpha(theme.palette.common.black, 0.04)}`,
    '&:hover': {
        transform: 'translateY(-2px)',
        boxShadow: `0 8px 24px ${alpha(theme.palette.common.black, 0.08)}`,
        borderColor: alpha(theme.palette.primary.main, 0.2),
    },
    [theme.breakpoints.down('sm')]: {
        borderRadius: theme.spacing(1),
        margin: theme.spacing(0.5),
    }
}));

const UserAvatar = styled(Avatar)(({ theme }) => ({
    background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
    boxShadow: `0 3px 8px ${alpha(theme.palette.primary.main, 0.2)}`,
}));

const InfoItem = styled(Box)(({ theme }) => ({
    display: 'flex',
    alignItems: 'center',
    padding: theme.spacing(0.75),
    borderRadius: theme.spacing(0.75),
    marginBottom: theme.spacing(0.75),
    background: alpha(theme.palette.background.default, 0.5),
    '&:hover': {
        background: alpha(theme.palette.primary.light, 0.08),
    },
}));

const LoginHistoryItem = styled(Box)(({ theme }) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing(0.75),
    marginBottom: theme.spacing(0.5),
    background: alpha(theme.palette.background.default, 0.3),
    borderRadius: theme.spacing(0.75),
    borderLeft: `2px solid ${theme.palette.success.main}`,
}));

const ActionButton = styled(IconButton)(({ theme }) => ({
    background: alpha(theme.palette.background.paper, 0.8),
    border: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
    '&:hover': {
        background: alpha(theme.palette.primary.main, 0.1),
    },
}));

// Device type detection utility
const getDeviceIcon = (userAgent) => {
    if (!userAgent) return <LaptopIcon fontSize="small" />;
    
    const ua = userAgent.toLowerCase();
    if (/mobile|android|iphone|ipad|ipod/.test(ua)) {
        return /tablet|ipad/.test(ua) 
            ? <TabletIcon fontSize="small" />
            : <SmartphoneIcon fontSize="small" />;
    }
    return <DesktopIcon fontSize="small" />;
};

const getDeviceName = (userAgent) => {
    if (!userAgent) return 'Unknown Device';
    
    const ua = userAgent.toLowerCase();
    if (/mobile|android/.test(ua)) return 'Mobile';
    if (/iphone/.test(ua)) return 'iPhone';
    if (/ipad/.test(ua)) return 'iPad';
    if (/tablet/.test(ua)) return 'Tablet';
    if (/windows/.test(ua)) return 'Windows';
    if (/mac/.test(ua)) return 'Mac';
    if (/linux/.test(ua)) return 'Linux';
    
    return 'Desktop';
};

// Memoized UserCard component
const UserCard = memo(({ 
    user, 
    index, 
    isExpanded, 
    onToggleExpand, 
    onEdit, 
    onDelete,
    showPassword,
    toggleShowPassword,
    formatDate,
    formatDateTime,
    isMobile 
}) => {
    const [hovered, setHovered] = useState(false);
    const [localShowPassword, setLocalShowPassword] = useState(false);
    const theme = useTheme();

    const hasLoginData = useMemo(() => 
        Array.isArray(user.loginData) && user.loginData.length > 0, 
        [user.loginData]
    );

    const getUserInitials = useCallback(() => {
        return `${user.firstName?.charAt(0) || ''}${user.lastName?.charAt(0) || ''}`.toUpperCase();
    }, [user.firstName, user.lastName]);

    const handleMouseEnter = useCallback(() => setHovered(true), []);
    const handleMouseLeave = useCallback(() => setHovered(false), []);

    const handleTogglePassword = useCallback((e) => {
        e.stopPropagation();
        setLocalShowPassword(prev => !prev);
    }, []);

    return (
        <Box
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            sx={{ height: '100%' }}
        >
            <StyledCard hovered={hovered}>
                <CardHeader
                    avatar={
                        <UserAvatar
                            sx={{
                                width: isMobile ? 40 : 48,
                                height: isMobile ? 40 : 48,
                                fontSize: isMobile ? '0.875rem' : '1rem',
                            }}
                        >
                            {getUserInitials()}
                        </UserAvatar>
                    }
                    action={
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                            <Tooltip title="Edit user">
                                <ActionButton
                                    size="small"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onEdit(user);
                                    }}
                                >
                                    <EditIcon sx={{ fontSize: isMobile ? '1rem' : '1.125rem' }} />
                                </ActionButton>
                            </Tooltip>
                            <Tooltip title="Delete user">
                                <ActionButton
                                    size="small"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDelete(user);
                                    }}
                                    sx={{ color: theme.palette.error.main }}
                                >
                                    <DeleteIcon sx={{ fontSize: isMobile ? '1rem' : '1.125rem' }} />
                                </ActionButton>
                            </Tooltip>
                        </Box>
                    }
                    title={
                        <Typography
                            variant="body1"
                            sx={{
                                fontWeight: 600,
                                fontSize: isMobile ? '0.875rem' : '0.95rem',
                                lineHeight: 1.2,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            {user.firstName} {user.lastName}
                        </Typography>
                    }
                    subheader={
                        <Typography
                            variant="caption"
                            sx={{
                                fontSize: isMobile ? '0.75rem' : '0.8125rem',
                                color: 'text.secondary',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 0.5,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            <EmailIcon sx={{ fontSize: isMobile ? '0.75rem' : '0.875rem' }} />
                            {user.email}
                        </Typography>
                    }
                    sx={{
                        p: isMobile ? 1.5 : 2,
                        '& .MuiCardHeader-content': {
                            overflow: 'hidden',
                        },
                    }}
                />

                <CardContent sx={{ 
                    flex: 1, 
                    p: isMobile ? 1.5 : 2, 
                    pt: 0,
                    display: 'flex',
                    flexDirection: 'column'
                }}>
                    <Grid container spacing={isMobile ? 0.75 : 1}>
                        <Grid item xs={12} sm={6}>
                            <InfoItem>
                                <PersonIcon sx={{ 
                                    mr: 1, 
                                    color: theme.palette.primary.main,
                                    fontSize: isMobile ? '0.875rem' : '1rem'
                                }} />
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Typography variant="caption" color="text.secondary">
                                        Full Name
                                    </Typography>
                                    <Typography 
                                        variant="body2" 
                                        sx={{ 
                                            fontSize: isMobile ? '0.8125rem' : '0.875rem',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis'
                                        }}
                                    >
                                        {user.firstName} {user.lastName}
                                    </Typography>
                                </Box>
                            </InfoItem>

                            <InfoItem>
                                <PhoneIcon sx={{ 
                                    mr: 1, 
                                    color: theme.palette.info.main,
                                    fontSize: isMobile ? '0.875rem' : '1rem'
                                }} />
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Typography variant="caption" color="text.secondary">
                                        Contact
                                    </Typography>
                                    <Typography 
                                        variant="body2" 
                                        sx={{ 
                                            fontSize: isMobile ? '0.8125rem' : '0.875rem',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis'
                                        }}
                                    >
                                        {user.mobileNo || 'Not provided'}
                                    </Typography>
                                </Box>
                            </InfoItem>

                            <InfoItem>
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Typography variant="caption" color="text.secondary">
                                        Password
                                    </Typography>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        <Typography
                                            variant="body2"
                                            sx={{
                                                fontFamily: 'monospace',
                                                fontSize: isMobile ? '0.8125rem' : '0.875rem',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                flex: 1,
                                            }}
                                        >
                                            {localShowPassword ? user.password : '••••••••'}
                                        </Typography>
                                        <IconButton
                                            size="small"
                                            onClick={handleTogglePassword}
                                            sx={{ color: 'text.secondary' }}
                                        >
                                            {localShowPassword ? 
                                                <VisibilityOff fontSize="small" /> : 
                                                <Visibility fontSize="small" />
                                            }
                                        </IconButton>
                                    </Box>
                                </Box>
                            </InfoItem>
                        </Grid>

                        <Grid item xs={12} sm={6}>
                            <InfoItem>
                                <CalendarIcon sx={{ 
                                    mr: 1, 
                                    color: theme.palette.success.main,
                                    fontSize: isMobile ? '0.875rem' : '1rem'
                                }} />
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Typography variant="caption" color="text.secondary">
                                        Date of Birth
                                    </Typography>
                                    <Typography 
                                        variant="body2" 
                                        sx={{ 
                                            fontSize: isMobile ? '0.8125rem' : '0.875rem',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis'
                                        }}
                                    >
                                        {formatDate(user.dob)}
                                    </Typography>
                                </Box>
                            </InfoItem>

                            <InfoItem>
                                <LoginIcon sx={{ 
                                    mr: 1, 
                                    color: theme.palette.secondary.main,
                                    fontSize: isMobile ? '0.875rem' : '1rem'
                                }} />
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Typography variant="caption" color="text.secondary">
                                        Total Logins
                                    </Typography>
                                    <Typography 
                                        variant="body2" 
                                        sx={{ 
                                            fontSize: isMobile ? '0.8125rem' : '0.875rem',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis'
                                        }}
                                    >
                                        {user?.noOfLogin || 0}
                                    </Typography>
                                </Box>
                            </InfoItem>

                            <InfoItem>
                                <RoleIcon sx={{ 
                                    mr: 1, 
                                    color: theme.palette.error.main,
                                    fontSize: isMobile ? '0.875rem' : '1rem'
                                }} />
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Typography variant="caption" color="text.secondary">
                                        User ID
                                    </Typography>
                                    <Typography 
                                        variant="body2" 
                                        sx={{ 
                                            fontFamily: 'monospace',
                                            fontSize: isMobile ? '0.8125rem' : '0.875rem',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis'
                                        }}
                                    >
                                        {user.userId}
                                    </Typography>
                                </Box>
                            </InfoItem>
                        </Grid>
                    </Grid>

                    {/* Collapsible Login History */}
                    <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                        {hasLoginData && (
                            <Box sx={{ mt: isMobile ? 1 : 1.5 }}>
                                <Typography
                                    variant="subtitle2"
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        mb: 1,
                                        color: theme.palette.text.secondary,
                                        fontSize: isMobile ? '0.8125rem' : '0.875rem'
                                    }}
                                >
                                    <LoginIcon sx={{ mr: 0.75, fontSize: isMobile ? 14 : 16 }} />
                                    Recent Login Activity
                                </Typography>
                                <Box sx={{ maxHeight: 120, overflow: 'auto' }}>
                                    {user.loginData.slice(0, 3).map((data, idx) => (
                                        <LoginHistoryItem key={idx}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                {getDeviceIcon(data.userAgent)}
                                                <Box>
                                                    <Typography variant="caption" sx={{ display: 'block' }}>
                                                        {getDeviceName(data.userAgent)}
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary">
                                                        {formatDateTime(data.lastLoginDate)}
                                                    </Typography>
                                                </Box>
                                            </Box>
                                            <Chip
                                                label="Success"
                                                size="small"
                                                color="success"
                                                variant="outlined"
                                                sx={{ fontSize: '0.7rem', height: 20 }}
                                            />
                                        </LoginHistoryItem>
                                    ))}
                                </Box>
                            </Box>
                        )}
                    </Collapse>

                    {/* Card Footer */}
                    <Box sx={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        mt: 'auto',
                        pt: isMobile ? 1 : 1.5,
                        borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}`
                    }}>
                        <Typography variant="caption" color="text.secondary">
                            Joined {formatDate(user.createdAt || user.registrationDate)}
                        </Typography>
                        {hasLoginData && (
                            <Button
                                variant="outlined"
                                size="small"
                                endIcon={isExpanded ? <KeyboardArrowUp /> : <KeyboardArrowDown />}
                                onClick={() => onToggleExpand(user.userId)}
                                sx={{
                                    borderRadius: 1,
                                    textTransform: 'none',
                                    fontSize: isMobile ? '0.75rem' : '0.8125rem',
                                    minWidth: 'auto'
                                }}
                            >
                                {isExpanded ? 'Less' : 'Logins'}
                            </Button>
                        )}
                    </Box>
                </CardContent>
            </StyledCard>
        </Box>
    );
});

UserCard.displayName = 'UserCard';

const UsersCardView = ({ users = [], onUpdate, onDelete }) => {
    const theme = useTheme();
    const [expandedUser, setExpandedUser] = useState(null);
    const [selectedUser, setSelectedUser] = useState(null);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [loading, setLoading] = useState(true);

    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'md'));

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

    const handleEdit = useCallback((user) => {
        setSelectedUser(user);
        setEditModalOpen(true);
    }, []);

    const handleDelete = useCallback((user) => {
        onDelete(user);
    }, [onDelete]);

    const handleSave = useCallback(async (updatedUser) => {
        try {
            await onUpdate(updatedUser);
            setEditModalOpen(false);
        } catch (error) {
            console.error("Update error:", error);
        }
    }, [onUpdate]);

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
                <UserCard
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
            maxWidth="xl"
            sx={{
                py: isMobile ? 2 : 3,
                px: isMobile ? 1 : 2
            }}
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
                            <Grid
                                container
                                spacing={isMobile ? 1 : 2}
                                sx={{
                                    '& > .MuiGrid-item': {
                                        display: 'flex'
                                    }
                                }}
                            >
                                {userCards}
                            </Grid>
                        </Fade>
                    )}
                </>
            )}

            {/* Edit User Modal */}
            <UserEditModal
                user={selectedUser}
                open={editModalOpen}
                onClose={() => {
                    setEditModalOpen(false);
                    setSelectedUser(null);
                }}
                onSave={handleSave}
            />
        </Container>
    );
};

export default memo(UsersCardView);