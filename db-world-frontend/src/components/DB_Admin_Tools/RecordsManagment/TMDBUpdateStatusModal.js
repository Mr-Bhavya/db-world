import React, { useState, useEffect } from 'react';
import {
    Box,
    Button,
    Divider,
    LinearProgress,
    Alert,
    Typography,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    Chip,
    IconButton,
    Tooltip,
    TextField,
    Grid,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    useMediaQuery,
    useTheme,
    Card,
    CardContent,
    Paper,
    alpha
} from '@mui/material';
import {
    Sync as SyncIcon,
    CheckCircle as CheckCircleIcon,
    Error as ErrorIcon,
    Close as CloseIcon,
    PlayArrow as PlayArrowIcon,
    AllInclusive as AllInclusiveIcon,
    Cancel,
    Settings as SettingsIcon,
    Refresh as RefreshIcon,
    Info as InfoIcon
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import axiosInstance from '../../Utils/AxiosInstants';

// Enhanced motion components
const MotionButton = motion(Button);
const MotionChip = motion(Chip);
const MotionCard = motion(Card);
const MotionPaper = motion(Paper);

// Custom styled components
const GradientProgress = ({ value, ...props }) => {
    const theme = useTheme();
    return (
        <LinearProgress
            variant="determinate"
            value={value}
            sx={{
                height: 10,
                borderRadius: 5,
                backgroundColor: alpha(theme.palette.primary.main, 0.1),
                '& .MuiLinearProgress-bar': {
                    borderRadius: 5,
                    background: `linear-gradient(90deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                },
                ...props.sx
            }}
            {...props}
        />
    );
};

const StatusChip = ({ status, label }) => {
    const theme = useTheme();
    
    const getStatusConfig = () => {
        switch (status) {
            case 'running': 
                return { 
                    color: 'warning', 
                    icon: <SyncIcon sx={{ animation: 'spin 1s linear infinite' }} /> 
                };
            case 'completed': 
                return { 
                    color: 'success', 
                    icon: <CheckCircleIcon /> 
                };
            case 'error': 
                return { 
                    color: 'error', 
                    icon: <ErrorIcon /> 
                };
            default: 
                return { 
                    color: 'default', 
                    icon: <InfoIcon /> 
                };
        }
    };

    const config = getStatusConfig();

    return (
        <Chip
            icon={config.icon}
            label={label}
            color={config.color}
            variant="filled"
            sx={{
                fontWeight: 'bold',
            }}
        />
    );
};

const TMDBUpdateStatusModal = ({ open, onClose }) => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const isTablet = useMediaQuery(theme.breakpoints.down('md'));
    
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [updateLimit, setUpdateLimit] = useState(50);
    const [customLimit, setCustomLimit] = useState('');
    const [useCustomLimit, setUseCustomLimit] = useState(false);
    const [cancelling, setCancelling] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const fetchStatus = async (showRefresh = false) => {
        try {
            if (showRefresh) setRefreshing(true);
            else setLoading(true);
            
            const response = await axiosInstance.get('/api/admin/cinema/records/status');
            
            if (response?.data?.data) {
                setStatus(response.data.data);
            }
            setError(null);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to fetch status');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const triggerUpdate = async (limit = null) => {
        try {
            setLoading(true);
            const params = limit ? { limit } : { all: true };
            await axiosInstance.put('/api/admin/cinema/records', null, { params });
            startPolling();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to start update');
            setLoading(false);
        }
    };

    const cancelUpdate = async () => {
        try {
            setCancelling(true);
            await axiosInstance.post('/api/admin/cinema/records/cancel-update');
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to cancel update');
            setCancelling(false);
        }
    };

    const startPolling = () => {
        const interval = setInterval(async () => {
            try {
                const response = await axiosInstance.get('/api/admin/cinema/records/status');
                setStatus(response.data.data);

                if (!response.data.data.running) {
                    clearInterval(interval);
                    setLoading(false);
                    setCancelling(false);
                }
            } catch (err) {
                clearInterval(interval);
                setError('Failed to poll status');
                setLoading(false);
                setCancelling(false);
            }
        }, 3000);

        return () => clearInterval(interval);
    };

    useEffect(() => {
        if (open) {
            fetchStatus();
        }
    }, [open]);

    const getProgressValue = () => {
        if (!status || !status.running) return 0;
        if (!status.totalCounts || status.totalCounts === 0) return 0;
        return Math.floor((status.processedCount / status.totalCounts) * 100);
    };

    const handleCustomLimitChange = (e) => {
        const value = e.target.value;
        if (value === '' || (Number(value) > 0 && Number(value) <= 1000)) {
            setCustomLimit(value);
        }
    };

    const handleCustomLimitSubmit = () => {
        if (customLimit && Number(customLimit) > 0) {
            setUpdateLimit(Number(customLimit));
            setUseCustomLimit(false);
            setCustomLimit('');
        }
    };

    const statsCards = [
        {
            label: 'Processed',
            value: status?.processedCount || 0,
            color: theme.palette.info.main
        },
        {
            label: 'Success',
            value: status?.successCount || 0,
            color: theme.palette.success.main
        },
        {
            label: 'Failed',
            value: status?.failedCount || 0,
            color: theme.palette.error.main
        }
    ];

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="lg"
            fullWidth
            fullScreen={isMobile}
            sx={{
                '& .MuiDialog-paper': {
                    borderRadius: isMobile ? 0 : 3,
                    background: `linear-gradient(135deg, ${theme.palette.background.paper} 0%, ${alpha(theme.palette.background.default, 0.95)} 100%)`,
                    border: '1px solid',
                    borderColor: alpha(theme.palette.primary.main, 0.1),
                    boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
                    maxHeight: '95vh',
                    overflow: 'hidden'
                }
            }}
        >
            <DialogTitle sx={{
                p: isMobile ? 2 : 3,
                borderBottom: '1px solid',
                borderColor: 'divider',
                background: `linear-gradient(90deg, ${alpha(theme.palette.primary.main, 0.05)} 0%, transparent 100%)`,
                position: 'relative',
                overflow: 'hidden'
            }}>
                <Box 
                    sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: '2px',
                        background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`
                    }}
                />
                
                <Box display="flex" flexDirection={isMobile ? 'column' : 'row'}
                    justifyContent="space-between" alignItems="center" gap={2}>
                    <Box display="flex" alignItems="center" gap={2}>
                        <SettingsIcon color="primary" sx={{ fontSize: 32 }} />
                        <Box>
                            <Typography variant="h5" fontWeight="bold" gutterBottom>
                                TMDB Records Update
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Manage and monitor your cinema records synchronization
                            </Typography>
                        </Box>
                    </Box>
                    
                    <Box display="flex" gap={1} width={isMobile ? '100%' : 'auto'} flexWrap="wrap">
                        <Tooltip title="Refresh Status">
                            <IconButton
                                onClick={() => fetchStatus(true)}
                                disabled={refreshing}
                                sx={{
                                    border: '1px solid',
                                    borderColor: 'divider'
                                }}
                            >
                                <RefreshIcon 
                                    sx={{ 
                                        transition: 'transform 0.3s',
                                        transform: refreshing ? 'rotate(360deg)' : 'none'
                                    }} 
                                />
                            </IconButton>
                        </Tooltip>
                        
                        <MotionButton
                            variant="contained"
                            color="primary"
                            size={isMobile ? 'small' : 'medium'}
                            startIcon={<SyncIcon />}
                            onClick={() => triggerUpdate(updateLimit)}
                            disabled={status?.running}
                            whileHover={{ scale: 1.02, y: -1 }}
                            whileTap={{ scale: 0.98 }}
                            sx={{
                                background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                                fontWeight: 'bold',
                                minWidth: isMobile ? 'auto' : 140
                            }}
                        >
                            {isMobile ? `${updateLimit}` : `Update ${updateLimit}`}
                        </MotionButton>
                        
                        <MotionButton
                            variant="outlined"
                            color="secondary"
                            size={isMobile ? 'small' : 'medium'}
                            startIcon={<AllInclusiveIcon />}
                            onClick={() => triggerUpdate()}
                            disabled={status?.running}
                            whileHover={{ scale: 1.02, y: -1 }}
                            whileTap={{ scale: 0.98 }}
                            sx={{
                                borderWidth: 2,
                                fontWeight: 'bold',
                                minWidth: isMobile ? 'auto' : 120
                            }}
                        >
                            {isMobile ? 'All' : 'All Records'}
                        </MotionButton>
                        
                        <AnimatePresence>
                            {status?.running && (
                                <MotionButton
                                    variant="outlined"
                                    color="error"
                                    size={isMobile ? 'small' : 'medium'}
                                    startIcon={<Cancel />}
                                    onClick={cancelUpdate}
                                    disabled={!status?.running || cancelling}
                                    whileHover={{ scale: 1.02, y: -1 }}
                                    whileTap={{ scale: 0.98 }}
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.8 }}
                                    sx={{
                                        borderWidth: 2,
                                        fontWeight: 'bold',
                                        minWidth: isMobile ? 'auto' : 130
                                    }}
                                >
                                    {isMobile ? 'Cancel' : 'Cancel'}
                                </MotionButton>
                            )}
                        </AnimatePresence>
                    </Box>
                </Box>
            </DialogTitle>

            <DialogContent dividers sx={{ 
                p: isMobile ? 2 : 3,
            }}>
                <AnimatePresence>
                    {error && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                        >
                            <Alert
                                severity="error"
                                sx={{ 
                                    mb: 3, 
                                    borderRadius: 2,
                                    border: '1px solid',
                                    borderColor: 'error.main'
                                }}
                                action={
                                    <IconButton
                                        size="small"
                                        color="inherit"
                                        onClick={() => setError(null)}
                                    >
                                        <CloseIcon fontSize="small" />
                                    </IconButton>
                                }
                            >
                                <Typography variant="body2" fontWeight="medium">
                                    {error}
                                </Typography>
                            </Alert>
                        </motion.div>
                    )}

                    {cancelling && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                        >
                            <Alert 
                                severity="info" 
                                sx={{ 
                                    mb: 3,
                                    borderRadius: 2
                                }}
                            >
                                Cancellation in progress... Please wait
                            </Alert>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Update Limit Section */}
                <MotionCard
                    sx={{ 
                        mb: 3, 
                        p: 2,
                        background: alpha(theme.palette.background.paper, 0.8),
                    }}
                    whileHover={{ y: -2 }}
                    transition={{ duration: 0.2 }}
                >
                    <Typography variant="h6" gutterBottom fontWeight="bold">
                        Update Settings
                    </Typography>
                    <Grid container spacing={2} alignItems="center">
                        <Grid item xs={12} md={useCustomLimit ? 8 : 12}>
                            <Box display="flex" gap={1} flexWrap="wrap">
                                {[50, 100, 200, 500].map(num => (
                                    <MotionChip
                                        key={num}
                                        label={num}
                                        size="medium"
                                        clickable
                                        variant={updateLimit === num ? 'filled' : 'outlined'}
                                        color={updateLimit === num ? 'primary' : 'default'}
                                        onClick={() => {
                                            setUpdateLimit(num);
                                            setUseCustomLimit(false);
                                        }}
                                        whileHover={{ scale: 1.05, y: -1 }}
                                        whileTap={{ scale: 0.95 }}
                                        sx={{
                                            fontWeight: 'bold',
                                            borderWidth: 2
                                        }}
                                    />
                                ))}
                                <MotionChip
                                    label="Custom"
                                    size="medium"
                                    clickable
                                    variant={useCustomLimit ? 'filled' : 'outlined'}
                                    color={useCustomLimit ? 'primary' : 'default'}
                                    onClick={() => setUseCustomLimit(true)}
                                    whileHover={{ scale: 1.05, y: -1 }}
                                    whileTap={{ scale: 0.95 }}
                                    sx={{
                                        fontWeight: 'bold',
                                        borderWidth: 2
                                    }}
                                />
                            </Box>
                        </Grid>

                        <AnimatePresence>
                            {useCustomLimit && (
                                <Grid item xs={12} md={4}>
                                    <motion.div
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 20 }}
                                    >
                                        <Box display="flex" gap={1} alignItems="center">
                                            <TextField
                                                size="small"
                                                type="number"
                                                fullWidth
                                                value={customLimit}
                                                onChange={handleCustomLimitChange}
                                                placeholder="Enter limit"
                                                inputProps={{ 
                                                    min: 1, 
                                                    max: 1000,
                                                    style: { textAlign: 'center' }
                                                }}
                                                sx={{
                                                    '& .MuiOutlinedInput-root': {
                                                        borderRadius: 2,
                                                        fontWeight: 'bold'
                                                    }
                                                }}
                                            />
                                            <MotionButton
                                                size="small"
                                                variant="contained"
                                                onClick={handleCustomLimitSubmit}
                                                disabled={!customLimit}
                                                whileHover={{ scale: 1.05 }}
                                                whileTap={{ scale: 0.95 }}
                                                sx={{
                                                    minWidth: 60,
                                                    fontWeight: 'bold'
                                                }}
                                            >
                                                Set
                                            </MotionButton>
                                        </Box>
                                    </motion.div>
                                </Grid>
                            )}
                        </AnimatePresence>
                    </Grid>
                </MotionCard>

                {/* Progress Section */}
                <AnimatePresence>
                    {status?.running && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                        >
                            <MotionPaper
                                sx={{ 
                                    p: 3, 
                                    mb: 3,
                                    background: alpha(theme.palette.primary.main, 0.05),
                                    border: '1px solid',
                                    borderColor: alpha(theme.palette.primary.main, 0.1),
                                    borderRadius: 3
                                }}
                                whileHover={{ y: -2 }}
                            >
                                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                                    <Typography variant="h6" fontWeight="bold">
                                        Update Progress
                                    </Typography>
                                    <StatusChip status="running" label="In Progress" />
                                </Box>
                                
                                <GradientProgress value={getProgressValue()} />
                                
                                <Box display="flex" justifyContent="space-between" alignItems="center" mt={1}>
                                    <Typography variant="body2" color="text.secondary" fontWeight="medium">
                                        {status.processedCount} of {status.totalCounts} records
                                    </Typography>
                                    <Typography 
                                        variant="h6" 
                                        fontWeight="bold"
                                        color="primary.main"
                                    >
                                        {getProgressValue()}%
                                    </Typography>
                                </Box>
                            </MotionPaper>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Status Overview */}
                {status && (
                    <MotionCard
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        <CardContent sx={{ p: 3 }}>
                            <Typography variant="h6" gutterBottom fontWeight="bold">
                                Status Overview
                            </Typography>
                            
                            {/* Stats Cards */}
                            <Grid container spacing={2} sx={{ mb: 3 }}>
                                {statsCards.map((stat, index) => (
                                    <Grid item xs={12} sm={4} key={stat.label}>
                                        <MotionPaper
                                            sx={{
                                                p: 2,
                                                textAlign: 'center',
                                                background: alpha(theme.palette.background.paper, 0.8),
                                                border: '1px solid',
                                                borderColor: alpha(theme.palette.primary.main, 0.1),
                                                borderRadius: 2
                                            }}
                                            whileHover={{ 
                                                scale: 1.05,
                                                y: -2,
                                                transition: { duration: 0.2 }
                                            }}
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ duration: 0.5, delay: index * 0.1 }}
                                        >
                                            <Typography 
                                                variant="h4" 
                                                fontWeight="bold"
                                                sx={{ color: stat.color }}
                                            >
                                                {stat.value}
                                            </Typography>
                                            <Typography 
                                                variant="body2" 
                                                color="text.secondary"
                                                fontWeight="medium"
                                            >
                                                {stat.label}
                                            </Typography>
                                        </MotionPaper>
                                    </Grid>
                                ))}
                            </Grid>

                            {/* Detailed Status */}
                            <Grid container spacing={3}>
                                <Grid item xs={12} md={6}>
                                    <List dense>
                                        <ListItem sx={{ px: 0 }}>
                                            <ListItemIcon sx={{ minWidth: 40 }}>
                                                {status.running ? (
                                                    <Tooltip title="In Progress">
                                                        <SyncIcon
                                                            color="warning"
                                                            sx={{ 
                                                                fontSize: 28,
                                                                animation: 'spin 1.5s linear infinite'
                                                            }}
                                                        />
                                                    </Tooltip>
                                                ) : (
                                                    <Tooltip title="Idle">
                                                        <CheckCircleIcon 
                                                            color="success" 
                                                            sx={{ fontSize: 28 }}
                                                        />
                                                    </Tooltip>
                                                )}
                                            </ListItemIcon>
                                            <ListItemText
                                                primary={
                                                    <Typography variant="body1" fontWeight="medium">
                                                        Status
                                                    </Typography>
                                                }
                                                secondary={
                                                    <Typography variant="body2" color="text.secondary">
                                                        {status.running ? 'Update in Progress' : 'Ready for Update'}
                                                    </Typography>
                                                }
                                            />
                                        </ListItem>

                                        <ListItem sx={{ px: 0 }}>
                                            <ListItemIcon sx={{ minWidth: 40 }}>
                                                <PlayArrowIcon color="info" sx={{ fontSize: 28 }} />
                                            </ListItemIcon>
                                            <ListItemText
                                                primary={
                                                    <Typography variant="body1" fontWeight="medium">
                                                        Started
                                                    </Typography>
                                                }
                                                secondary={
                                                    <Typography variant="body2" color="text.secondary">
                                                        {status.startTime || 'Not started'}
                                                    </Typography>
                                                }
                                            />
                                        </ListItem>

                                        <ListItem sx={{ px: 0 }}>
                                            <ListItemIcon sx={{ minWidth: 40 }}>
                                                <CheckCircleIcon color="info" sx={{ fontSize: 28 }} />
                                            </ListItemIcon>
                                            <ListItemText
                                                primary={
                                                    <Typography variant="body1" fontWeight="medium">
                                                        Finished
                                                    </Typography>
                                                }
                                                secondary={
                                                    <Typography variant="body2" color="text.secondary">
                                                        {status.endTime || 'Not finished'}
                                                    </Typography>
                                                }
                                            />
                                        </ListItem>
                                    </List>
                                </Grid>

                                <Grid item xs={12} md={6}>
                                    <Paper
                                        sx={{
                                            p: 2,
                                            height: '100%',
                                            background: alpha(theme.palette.background.default, 0.5),
                                            border: '1px solid',
                                            borderColor: alpha(theme.palette.primary.main, 0.1),
                                            borderRadius: 2
                                        }}
                                    >
                                        <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                                            Performance
                                        </Typography>
                                        <Box sx={{ mt: 1 }}>
                                            <Typography variant="body2" color="text.secondary">
                                                Last Updated: {new Date().toLocaleTimeString()}
                                            </Typography>
                                            {status.running && (
                                                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                                    Estimated completion based on current rate
                                                </Typography>
                                            )}
                                        </Box>
                                    </Paper>
                                </Grid>
                            </Grid>

                            {/* Failed Records */}
                            <AnimatePresence>
                                {status.failedCount > 0 && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                    >
                                        <Divider sx={{ my: 3 }} />
                                        
                                        <Typography variant="h6" gutterBottom fontWeight="bold" color="error">
                                            Failed Records ({status.failedCount})
                                        </Typography>

                                        <Paper
                                            sx={{
                                                maxHeight: 200,
                                                overflow: 'auto',
                                                background: alpha(theme.palette.error.main, 0.05),
                                                border: '1px solid',
                                                borderColor: alpha(theme.palette.error.main, 0.2),
                                                borderRadius: 2
                                            }}
                                        >
                                            <List dense>
                                                {Object.entries(status.failedRecords || {}).map(([id, errorMsg], index) => (
                                                    <ListItem
                                                        key={id}
                                                        component={motion.div}
                                                        initial={{ opacity: 0, x: -20 }}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        transition={{ duration: 0.3, delay: index * 0.1 }}
                                                        sx={{
                                                            borderBottom: '1px solid',
                                                            borderColor: alpha(theme.palette.error.main, 0.1),
                                                            '&:last-child': { borderBottom: 'none' }
                                                        }}
                                                    >
                                                        <ListItemIcon sx={{ minWidth: 40 }}>
                                                            <ErrorIcon color="error" />
                                                        </ListItemIcon>
                                                        <ListItemText
                                                            primary={
                                                                <Typography variant="body2" fontWeight="medium">
                                                                    Record ID: {id}
                                                                </Typography>
                                                            }
                                                            secondary={
                                                                <Typography 
                                                                    variant="body2" 
                                                                    color="error.main"
                                                                    sx={{ 
                                                                        wordBreak: 'break-word',
                                                                        fontSize: '0.75rem'
                                                                    }}
                                                                >
                                                                    {errorMsg}
                                                                </Typography>
                                                            }
                                                        />
                                                    </ListItem>
                                                ))}
                                            </List>
                                        </Paper>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </CardContent>
                    </MotionCard>
                )}
            </DialogContent>

            <DialogActions sx={{ 
                p: 2, 
                borderTop: '1px solid',
                borderColor: 'divider',
                background: alpha(theme.palette.background.paper, 0.8)
            }}>
                <MotionButton
                    variant="outlined"
                    onClick={onClose}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    sx={{
                        borderWidth: 2,
                        fontWeight: 'bold',
                        px: 3
                    }}
                >
                    Close
                </MotionButton>
            </DialogActions>
        </Dialog>
    );
};

export default TMDBUpdateStatusModal;