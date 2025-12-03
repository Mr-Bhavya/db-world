import React, { useState } from 'react';
import { 
    Button, 
    Dialog, 
    DialogActions, 
    DialogContent, 
    DialogTitle, 
    Typography, 
    CircularProgress,
    Box,
    IconButton,
    Tooltip,
    useTheme,
    useMediaQuery,
    Chip,
    Alert,
    Avatar
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    CleaningServices as CleanIcon,
    Warning as WarningIcon,
    CheckCircle as SuccessIcon,
    Error as ErrorIcon,
    Close as CloseIcon
} from '@mui/icons-material';
import { cleanMediaFileInfo } from '../../ApiServices';
import Constants from '../../Constants';
import { useLocation, useNavigate } from 'react-router-dom';

const MotionButton = motion(Button);
const MotionIconButton = motion(IconButton);

export default function CleanMediaFileInfoButton({ compact = false }) {
    const [open, setOpen] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const [resultMessage, setResultMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [resultData, setResultData] = useState(null);
    
    const navigate = useNavigate();
    const location = useLocation();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    const handleClickOpen = () => {
        setResultMessage('');
        setResultData(null);
        setOpen(true);
    };

    const handleClose = () => {
        if (!loading) {
            setOpen(false);
            setConfirming(false);
            setResultMessage('');
            setResultData(null);
        }
    };

    const handleConfirm = async () => {
        setLoading(true);
        setConfirming(false);
        setResultMessage('');
        setResultData(null);
        
        try {
            const response = await cleanMediaFileInfo();
            
            if (response.httpStatusCode === 200) {
                setResultData({
                    deletedFilesCount: response.data?.deletedFilesCount || 0,
                    totalCount: response.data?.totalCount || 0,
                    success: true
                });
                setResultMessage(`Successfully cleaned up ${response.data?.deletedFilesCount || 0} invalid media file records.`);
            } else if (response.httpStatusCode === 401 || response.httpStatusCode === 403) {
                setResultData({ success: false, error: 'unauthorized' });
                setResultMessage('Unauthorized access. Please log in again.');
                setTimeout(() => {
                    navigate(Constants.LOGIN_ROUTE, { state: { from: location } });
                }, 2000);
            } else {
                setResultData({ success: false, error: 'api_error' });
                setResultMessage(`Failed to clean media file info: ${response.message || response.errorMessage || 'Unknown error'}`);
            }

        } catch (err) {
            setResultData({ success: false, error: 'network_error' });
            setResultMessage('Network error: Failed to clean media file info.');
        } finally {
            setLoading(false);
            setConfirming(true);
        }
    };

    // Compact icon button version
    if (compact) {
        return (
            <>
                <Tooltip title="Clean Media Files">
                    <MotionIconButton
                        size="small"
                        onClick={handleClickOpen}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        sx={{
                            border: `1px solid ${theme.palette.divider}`,
                            borderRadius: 2,
                            backgroundColor: theme.palette.background.paper,
                            color: theme.palette.error.main,
                            '&:hover': {
                                backgroundColor: theme.palette.error.main,
                                color: 'white',
                            }
                        }}
                    >
                        <CleanIcon fontSize="small" />
                    </MotionIconButton>
                </Tooltip>

                <CleanDialog 
                    open={open}
                    loading={loading}
                    confirming={confirming}
                    resultMessage={resultMessage}
                    resultData={resultData}
                    onClose={handleClose}
                    onConfirm={handleConfirm}
                    isMobile={isMobile}
                    theme={theme}
                />
            </>
        );
    }

    // Full button version
    return (
        <>
            <MotionButton
                variant="outlined"
                color="error"
                startIcon={<CleanIcon />}
                onClick={handleClickOpen}
                whileHover={{ scale: 1.02, y: -1 }}
                whileTap={{ scale: 0.98 }}
                sx={{
                    fontWeight: 600,
                    borderRadius: 2,
                    borderWidth: 2,
                    '&:hover': {
                        borderWidth: 2,
                        backgroundColor: theme.palette.error.main,
                        color: 'white',
                    }
                }}
            >
                Clean Media
            </MotionButton>

            <CleanDialog 
                open={open}
                loading={loading}
                confirming={confirming}
                resultMessage={resultMessage}
                resultData={resultData}
                onClose={handleClose}
                onConfirm={handleConfirm}
                isMobile={isMobile}
                theme={theme}
            />
        </>
    );
}

// Separate Dialog Component for better organization
const CleanDialog = ({ 
    open, 
    loading, 
    confirming, 
    resultMessage, 
    resultData, 
    onClose, 
    onConfirm,
    isMobile,
    theme 
}) => {
    const getStatusIcon = () => {
        if (loading) return <CircularProgress size={32} />;
        if (confirming) {
            if (resultData?.success) {
                return <SuccessIcon sx={{ fontSize: 48, color: theme.palette.success.main }} />;
            } else {
                return <ErrorIcon sx={{ fontSize: 48, color: theme.palette.error.main }} />;
            }
        }
        return <WarningIcon sx={{ fontSize: 48, color: theme.palette.warning.main }} />;
    };

    const getStatusColor = () => {
        if (loading) return 'info';
        if (confirming) {
            return resultData?.success ? 'success' : 'error';
        }
        return 'warning';
    };

    const getDialogTitle = () => {
        if (loading) return 'Cleaning Media Files';
        if (confirming) {
            return resultData?.success ? 'Cleanup Complete' : 'Cleanup Failed';
        }
        return 'Confirm Cleanup';
    };

    return (
        <Dialog 
            open={open} 
            onClose={onClose} 
            maxWidth="sm" 
            fullWidth
            fullScreen={isMobile}
            PaperProps={{
                sx: {
                    borderRadius: isMobile ? 0 : 3,
                    background: `linear-gradient(135deg, ${theme.palette.background.paper} 0%, ${theme.palette.background.default} 100%)`,
                }
            }}
        >
            <DialogTitle sx={{ 
                borderBottom: `1px solid ${theme.palette.divider}`,
                pb: 2,
                position: 'relative'
            }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Avatar sx={{ 
                        bgcolor: `${theme.palette[getStatusColor()].main}20`,
                        color: theme.palette[getStatusColor()].main,
                        width: 48,
                        height: 48
                    }}>
                        {getStatusIcon()}
                    </Avatar>
                    <Box>
                        <Typography variant="h6" fontWeight="bold">
                            {getDialogTitle()}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Media File Cleanup
                        </Typography>
                    </Box>
                </Box>
                
                {!loading && (
                    <IconButton
                        onClick={onClose}
                        sx={{
                            position: 'absolute',
                            right: 16,
                            top: 16,
                        }}
                    >
                        <CloseIcon />
                    </IconButton>
                )}
            </DialogTitle>

            <DialogContent sx={{ py: 3 }}>
                <AnimatePresence mode="wait">
                    {loading ? (
                        <motion.div
                            key="loading"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                        >
                            <Box sx={{ textAlign: 'center', py: 2 }}>
                                <CircularProgress size={40} thickness={4} />
                                <Typography variant="body1" sx={{ mt: 2, fontWeight: 500 }}>
                                    Cleaning up media files...
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                    Removing invalid and missing file records
                                </Typography>
                            </Box>
                        </motion.div>
                    ) : confirming ? (
                        <motion.div
                            key="result"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                        >
                            <Alert 
                                severity={resultData?.success ? 'success' : 'error'}
                                sx={{ mb: 2 }}
                                icon={false}
                            >
                                <Typography variant="body1" fontWeight="500">
                                    {resultMessage}
                                </Typography>
                            </Alert>
                            
                            {resultData?.success && resultData.deletedFilesCount !== undefined && (
                                <Box sx={{ textAlign: 'center', mt: 2 }}>
                                    <Chip
                                        label={`${resultData.deletedFilesCount} files cleaned`}
                                        color="success"
                                        variant="outlined"
                                        sx={{ fontWeight: 600 }}
                                    />
                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                                        Out of {resultData.totalCount} total records scanned
                                    </Typography>
                                </Box>
                            )}
                        </motion.div>
                    ) : (
                        <motion.div
                            key="confirmation"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                        >
                            <Box sx={{ textAlign: 'center', py: 1 }}>
                                <WarningIcon 
                                    sx={{ 
                                        fontSize: 64, 
                                        color: theme.palette.warning.main,
                                        mb: 2 
                                    }} 
                                />
                                <Typography variant="h6" gutterBottom fontWeight="600">
                                    Clean Media Files?
                                </Typography>
                                <Typography variant="body1" color="text.secondary" paragraph>
                                    This action will permanently delete invalid or missing media file records from the database.
                                </Typography>
                                
                                <Alert severity="warning" sx={{ textAlign: 'left' }}>
                                    <Typography variant="body2" fontWeight="500">
                                        This action cannot be undone. Please make sure you have backups if needed.
                                    </Typography>
                                </Alert>
                            </Box>
                        </motion.div>
                    )}
                </AnimatePresence>
            </DialogContent>

            <DialogActions sx={{ 
                p: 3, 
                gap: 1,
                borderTop: `1px solid ${theme.palette.divider}` 
            }}>
                {!loading && !confirming && (
                    <>
                        <Button 
                            onClick={onClose}
                            variant="outlined"
                            sx={{ 
                                minWidth: 100,
                                borderRadius: 2
                            }}
                        >
                            Cancel
                        </Button>
                        <Button 
                            variant="contained" 
                            color="error"
                            onClick={onConfirm}
                            startIcon={<CleanIcon />}
                            sx={{ 
                                minWidth: 120,
                                borderRadius: 2,
                                fontWeight: 600
                            }}
                        >
                            Clean Now
                        </Button>
                    </>
                )}
                {!loading && confirming && (
                    <Button 
                        onClick={onClose}
                        variant="contained"
                        sx={{ 
                            minWidth: 100,
                            borderRadius: 2,
                            fontWeight: 600
                        }}
                    >
                        Done
                    </Button>
                )}
            </DialogActions>
        </Dialog>
    );
};