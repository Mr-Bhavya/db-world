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
    useTheme
} from '@mui/material';
import {
    Sync as SyncIcon,
    CheckCircle as CheckCircleIcon,
    Error as ErrorIcon,
    Close as CloseIcon,
    PlayArrow as PlayArrowIcon,
    AllInclusive as AllInclusiveIcon,
    Cancel
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import axiosInstance from '../../Utils/AxiosInstants';

const MotionButton = motion(Button);
const MotionChip = motion(Chip);

const TMDBUpdateStatusModal = ({ open, onClose }) => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [updateLimit, setUpdateLimit] = useState(50);
    const [customLimit, setCustomLimit] = useState('');
    const [useCustomLimit, setUseCustomLimit] = useState(false);
    const [cancelling, setCancelling] = useState(false);


    const fetchStatus = async () => {
        try {
            setLoading(true);
            const response = await axiosInstance.get('/api/admin/cinema/records/status');

            if (response?.data?.data) {
                //   response.data.data['totalCounts'] = updateLimit; // Set totalCounts if available
                setStatus(response.data.data);
            }

            setError(null);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to fetch status');
        } finally {
            setLoading(false);
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
            // Continue polling to get the final cancelled status
            //   startPolling();
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
        }, 6000);

        return () => clearInterval(interval);
    };

    useEffect(() => {
        if (open) fetchStatus();
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
        }
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="md"
            fullWidth
            fullScreen={isMobile}
            sx={{
                '& .MuiDialog-paper': {
                    borderRadius: isMobile ? 0 : 2,
                    maxHeight: '90vh'
                }
            }}
        >
            <DialogTitle sx={{
                p: isMobile ? 1.5 : 2,
                borderBottom: '1px solid',
                borderColor: 'divider',
                backgroundColor: 'background.paper'
            }}>
                <Box display="flex" flexDirection={isMobile ? 'column' : 'row'}
                    justifyContent="space-between" alignItems="center" gap={1}>
                    <Typography variant="h6" fontWeight="bold">TMDB Records Update</Typography>
                    <Box display="flex" gap={1} width={isMobile ? '100%' : 'auto'}>
                        <MotionButton
                            variant="contained"
                            color="primary"
                            size={isMobile ? 'small' : 'medium'}
                            startIcon={<SyncIcon />}
                            onClick={() => triggerUpdate(updateLimit)}
                            disabled={status?.running}
                            loading={loading && status?.running}
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                            fullWidth={isMobile}
                        >
                            {isMobile ? `Update ${updateLimit}` : `Update ${updateLimit} Records`}
                        </MotionButton>
                        <MotionButton
                            variant="outlined"
                            color="secondary"
                            size={isMobile ? 'small' : 'medium'}
                            startIcon={<AllInclusiveIcon />}
                            onClick={() => triggerUpdate()}
                            disabled={status?.running}
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                            fullWidth={isMobile}
                        >
                            {isMobile ? 'All' : 'Update All'}
                        </MotionButton>
                        {status?.running && (
                            <MotionButton
                                variant="outlined"
                                color="error"
                                size={isMobile ? 'small' : 'medium'}
                                startIcon={<Cancel />}
                                onClick={cancelUpdate}
                                disabled={!status?.running || cancelling}
                                whileHover={{ scale: 1.03 }}
                                whileTap={{ scale: 0.97 }}
                                fullWidth={isMobile}
                            >
                                {isMobile ? 'Cancel' : 'Cancel Update'}
                            </MotionButton>
                        )}
                    </Box>
                </Box>
            </DialogTitle>

            <DialogContent dividers sx={{ p: isMobile ? 1.5 : 2 }}>
                {error && (
                    <Alert
                        severity="error"
                        sx={{ mb: 2, width: '100%' }}
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
                        {error}
                    </Alert>
                )}

                {cancelling && (
                    <Alert severity="info" sx={{ mb: 2 }}>
                        Cancellation in progress... Please wait
                    </Alert>
                )}

                <Box mb={2}>
                    <Typography variant="subtitle1" gutterBottom>Update Limit</Typography>
                    <Grid container spacing={1} alignItems="center">
                        <Grid item xs={12} sm={useCustomLimit ? 8 : 12}>
                            <Box display="flex" gap={1} flexWrap="wrap">
                                {[50, 100, 200].map(num => (
                                    <MotionChip
                                        key={num}
                                        label={num}
                                        size="small"
                                        clickable
                                        color={updateLimit === num ? 'primary' : 'default'}
                                        onClick={() => {
                                            setUpdateLimit(num);
                                            setUseCustomLimit(false);
                                        }}
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                    />
                                ))}
                                <MotionChip
                                    label="Custom"
                                    size="small"
                                    clickable
                                    color={useCustomLimit ? 'primary' : 'default'}
                                    onClick={() => setUseCustomLimit(true)}
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                />
                            </Box>
                        </Grid>

                        {useCustomLimit && (
                            <Grid item xs={12} sm={4}>
                                <Box display="flex" gap={1} alignItems="center">
                                    <TextField
                                        size="small"
                                        type="number"
                                        fullWidth
                                        value={customLimit}
                                        onChange={handleCustomLimitChange}
                                        placeholder="Enter number"
                                        inputProps={{ min: 1, max: 1000 }}
                                    />
                                    <Button
                                        size="small"
                                        variant="contained"
                                        onClick={handleCustomLimitSubmit}
                                        disabled={!customLimit}
                                    >
                                        Set
                                    </Button>
                                </Box>
                            </Grid>
                        )}
                    </Grid>
                </Box>

                {status?.running && (
                    <Box mb={3} width="100%">
                        <LinearProgress
                            variant="determinate"
                            value={getProgressValue()}
                            sx={{
                                height: 8,
                                borderRadius: 4,
                                mb: 1,
                                '& .MuiLinearProgress-bar': {
                                    borderRadius: 4,
                                    background: 'linear-gradient(90deg, #1976d2 0%, #4caf50 100%)'
                                }
                            }}
                        />
                        <Box display="flex" justifyContent="space-between" width="100%">
                            <Typography variant="body2" color="text.secondary">
                                Progress: {getProgressValue()}%
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {status.processedCount} of {status.totalCounts} records
                            </Typography>
                        </Box>
                    </Box>
                )}

                {status && (
                    <Box width="100%">
                        <Divider sx={{ my: 2 }}>
                            <Typography variant="subtitle1">Status</Typography>
                        </Divider>

                        <Grid container spacing={2}>
                            <Grid item xs={12} sm={6}>
                                <List dense>
                                    <ListItem>
                                        <ListItemIcon sx={{ minWidth: 36 }}>
                                            {status.running ? (
                                                <Tooltip title="In Progress">
                                                    <SyncIcon
                                                        color="warning"
                                                        sx={{ animation: 'spin 2s linear infinite' }}
                                                    />
                                                </Tooltip>
                                            ) : (
                                                <Tooltip title="Idle">
                                                    <CheckCircleIcon color="success" />
                                                </Tooltip>
                                            )}
                                        </ListItemIcon>
                                        <ListItemText
                                            primary="Status"
                                            secondary={status.running ? 'In Progress' : 'Idle'}
                                        />
                                    </ListItem>

                                    <ListItem>
                                        <ListItemIcon sx={{ minWidth: 36 }}>
                                            <PlayArrowIcon color="info" />
                                        </ListItemIcon>
                                        <ListItemText
                                            primary="Started"
                                            secondary={status.startTime || 'N/A'}
                                        />
                                    </ListItem>

                                    <ListItem>
                                        <ListItemIcon sx={{ minWidth: 36 }}>
                                            <CheckCircleIcon color="info" />
                                        </ListItemIcon>
                                        <ListItemText
                                            primary="Finished"
                                            secondary={status.endTime || 'N/A'}
                                        />
                                    </ListItem>
                                </List>
                            </Grid>

                            <Grid item xs={12} sm={6}>
                                <List dense>
                                    <ListItem>
                                        <ListItemText
                                            primary="Processed"
                                            secondary={status.processedCount}
                                        />
                                    </ListItem>

                                    <ListItem>
                                        <ListItemText
                                            primary="Success"
                                            secondary={
                                                <Typography component="span" color="success.main">
                                                    {status.successCount}
                                                </Typography>
                                            }
                                        />
                                    </ListItem>

                                    <ListItem>
                                        <ListItemText
                                            primary="Failed"
                                            secondary={
                                                <Typography component="span" color="error.main">
                                                    {status.failedCount}
                                                </Typography>
                                            }
                                        />
                                    </ListItem>
                                </List>
                            </Grid>
                        </Grid>

                        {status.failedCount > 0 && (
                            <>
                                <Divider sx={{ my: 2 }}>
                                    <Typography variant="subtitle1">Failed Records</Typography>
                                </Divider>

                                <List dense>
                                    {Object.entries(status.failedRecords || {}).map(([id, errorMsg]) => (
                                        <ListItem
                                            key={id}
                                            component={motion.div}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            transition={{ duration: 0.3 }}
                                        >
                                            <ListItemIcon sx={{ minWidth: 36 }}>
                                                <ErrorIcon color="error" />
                                            </ListItemIcon>
                                            <ListItemText
                                                primary={`ID: ${id}`}
                                                secondary={errorMsg}
                                                secondaryTypographyProps={{
                                                    color: 'error.main',
                                                    sx: { wordBreak: 'break-word' }
                                                }}
                                            />
                                        </ListItem>
                                    ))}
                                </List>
                            </>
                        )}
                    </Box>
                )}
            </DialogContent>

            <DialogActions sx={{ p: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
                <Button
                    variant="outlined"
                    onClick={onClose}
                >
                    Close
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default TMDBUpdateStatusModal;