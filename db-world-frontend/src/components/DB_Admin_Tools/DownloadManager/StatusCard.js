import React, { useMemo, useCallback, useState } from 'react';
import {
    Download as DownloadIcon,
    CheckCircle as CheckCircleIcon,
    Error as ErrorIcon,
    PauseCircle as PauseCircleIcon,
    Archive as ArchiveIcon,
    Block as BlockIcon,
    OpenInNew as OpenInNewIcon,
    ContentCopy as CopyIcon,
    Delete as DeleteIcon,
    Pause as PauseIcon,
    Close as CloseIcon,
    AccessTime as ClockIcon,
    Speed as SpeedIcon,
    InsertDriveFile as FileIcon,
    PlayArrow,
    Refresh as RefreshIcon
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import {
    Card,
    CardHeader,
    CardContent,
    IconButton,
    Tooltip,
    LinearProgress,
    Box,
    Typography,
    CircularProgress,
    useMediaQuery,
    useTheme
} from '@mui/material';
import { toast } from '../../Toast';
import CommonServices from '../../CommonServices';
import { cancelledMirrorByGID, deleteMirror, pauseMirror, resumeMirror } from '../../ApiServices';

const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, x: -20 },
    hover: { scale: 1.02 }
};

const statItemVariants = {
    hidden: { opacity: 0 },
    animate: { opacity: 1 }
};

const iconHoverEffect = {
    scale: 1.2,
    transition: { duration: 0.2 }
};

// Memoized stat item component to prevent unnecessary re-renders
const StatItem = React.memo(({ label, value, icon: Icon, isMobile }) => (
    <motion.div
        variants={statItemVariants}
        whileHover={{ scale: isMobile ? 1 : 1.03 }}
        style={{
            padding: isMobile ? '0.375rem' : '0.5rem',
            borderRadius: '6px',
            background: 'rgba(0,0,0,0.02)',
            minHeight: isMobile ? 'auto' : '50px'
        }}
    >
        <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.5rem', 
            mb: isMobile ? '0.125rem' : '0.25rem' 
        }}>
            <motion.div whileHover={iconHoverEffect}>
                <Icon sx={{ 
                    fontSize: isMobile ? '0.75rem' : '0.875rem', 
                    color: '#6c757d' 
                }} />
            </motion.div>
            <Typography 
                variant="caption" 
                sx={{ 
                    color: '#6c757d', 
                    fontWeight: 500,
                    fontSize: isMobile ? '0.7rem' : '0.75rem'
                }}
            >
                {label}
            </Typography>
        </Box>
        <Typography 
            variant="body2" 
            sx={{ 
                fontWeight: 500, 
                color: '#343a40',
                fontSize: isMobile ? '0.8rem' : '0.875rem',
                wordBreak: 'break-word'
            }}
        >
            {value}
        </Typography>
    </motion.div>
));

// Memoized action button component
const ActionButton = React.memo(({ 
    onClick, 
    loading, 
    disabled, 
    icon: Icon, 
    label, 
    color, 
    loadingIcon: LoadingIcon = CircularProgress,
    size = 'small'
}) => (
    <motion.div whileHover={iconHoverEffect}>
        <Tooltip title={label}>
            <IconButton
                size={size}
                onClick={onClick}
                aria-label={label}
                sx={{ 
                    p: size === 'small' ? 0.5 : 0.75, 
                    color,
                    '&:disabled': { opacity: 0.5 }
                }}
                disabled={disabled || loading}
            >
                {loading ? (
                    <LoadingIcon size={size === 'small' ? 14 : 16} />
                ) : (
                    <Icon sx={{ fontSize: size === 'small' ? 14 : 16 }} />
                )}
            </IconButton>
        </Tooltip>
    </motion.div>
));

// Status icon component with animations
const StatusIcon = React.memo(({ mirrorStatus }) => {
    const { Icon, color, animate, spin } = useMemo(() => {
        const status = mirrorStatus?.currentStatus?.toLowerCase();
        const isFailed = mirrorStatus?.failed;
        const isCancelled = mirrorStatus?.cancelled;
        const isPaused = mirrorStatus?.pause;
        const isCompleted = mirrorStatus?.completed;

        if (isFailed) return {
            Icon: ErrorIcon,
            color: "#dc3545"
        };
        if (isCancelled) return {
            Icon: BlockIcon,
            color: "#6c757d"
        };
        if (isPaused) return {
            Icon: PauseCircleIcon,
            color: "#ffc107"
        };
        if (status?.includes("extract")) return {
            Icon: ArchiveIcon,
            color: "#17a2b8",
            spin: true
        };
        if (isCompleted) return {
            Icon: CheckCircleIcon,
            color: "#28a745"
        };
        return {
            Icon: DownloadIcon,
            color: "#007bff",
            animate: true
        };
    }, [mirrorStatus]);

    return (
        <motion.div
            animate={
                animate
                    ? { y: [0, 8, 0], opacity: [0.7, 1, 0.7] }
                    : spin
                        ? { rotate: 360 }
                        : false
            }
            transition={
                animate
                    ? { duration: 1.2, repeat: Infinity, ease: 'easeInOut' }
                    : spin
                        ? { duration: 2, repeat: Infinity, ease: 'linear' }
                        : undefined
            }
            whileHover={iconHoverEffect}
        >
            <Icon sx={{ color, fontSize: '1.25rem' }} />
        </motion.div>
    );
});

const StatusCard = ({ mirrorStatus = {}, onStatusChange }) => {
    const [loadingStates, setLoadingStates] = useState({
        pause: false,
        resume: false,
        cancel: false,
        delete: false
    });

    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const isTablet = useMediaQuery(theme.breakpoints.down('md'));

    // Memoize all calculated values based on MirrorStatus structure
    const { progress, speed, downloaded, totalSize, eta, progressVariant } = useMemo(() => {
        const downloadProgress = mirrorStatus?.downloadStatus || {};
        const totalFileSize = downloadProgress.totalFileSize || 0;
        const fileDownloaded = downloadProgress.fileDownloaded || 0;
        
        const progressValue = totalFileSize > 0
            ? (fileDownloaded / totalFileSize) * 100
            : 0;

        const speedData = CommonServices.bytesToReadbleFormat(downloadProgress.speed || 0);
        const speedValue = `${speedData.value}${speedData.suffix}/s`;

        const downloadedData = CommonServices.bytesToReadbleFormat(fileDownloaded);
        const downloadedValue = `${downloadedData.value} ${downloadedData.suffix}`;

        const totalSizeData = CommonServices.bytesToReadbleFormat(totalFileSize);
        const totalSizeValue = `${totalSizeData.value} ${totalSizeData.suffix}`;

        const etaValue = CommonServices.formatETA(downloadProgress.eta);

        const variant = mirrorStatus?.failed ? 'error' :
            mirrorStatus?.cancelled ? 'secondary' :
            mirrorStatus?.pause ? 'warning' :
            mirrorStatus?.completed ? 'success' : 'primary';

        return {
            progress: progressValue,
            speed: speedValue,
            downloaded: downloadedValue,
            totalSize: totalSizeValue,
            eta: etaValue,
            progressVariant: variant
        };
    }, [mirrorStatus]);

    // Update loading state helper
    const setLoadingState = useCallback((action, isLoading) => {
        setLoadingStates(prev => ({
            ...prev,
            [action]: isLoading
        }));
    }, []);

    // Memoized action handlers with loading states
    const handlePause = useCallback(async (gid) => {
        setLoadingState('pause', true);
        try {
            const res = await pauseMirror(gid);
            const msg = res?.message || 'Download paused successfully';
            toast.success(msg);
            onStatusChange?.();
        } catch (error) {
            console.error('Pause error:', error);
            const msg = error?.response?.data?.message || 'Failed to pause download. Please try again.';
            toast.error(msg);
        } finally {
            setLoadingState('pause', false);
        }
    }, [onStatusChange, setLoadingState]);

    const handleResume = useCallback(async (gid) => {
        setLoadingState('resume', true);
        try {
            const res = await resumeMirror(gid);
            const msg = res?.message || 'Download resumed successfully';
            toast.success(msg);
            onStatusChange?.();
        } catch (error) {
            console.error('Resume error:', error);
            const msg = error?.response?.data?.message || 'Failed to resume download. Please try again.';
            toast.error(msg);
        } finally {
            setLoadingState('resume', false);
        }
    }, [onStatusChange, setLoadingState]);

    const handleCancel = useCallback(async (gid) => {
        setLoadingState('cancel', true);
        try {
            const res = await cancelledMirrorByGID(gid);
            const msg = res?.message || 'Download cancelled successfully';
            toast.success(msg);
            onStatusChange?.();
        } catch (error) {
            console.error('Cancel error:', error);
            const msg = error?.response?.data?.message || 'Failed to cancel download. Please try again.';
            toast.error(msg);
        } finally {
            setLoadingState('cancel', false);
        }
    }, [onStatusChange, setLoadingState]);

    const handleDelete = useCallback(async (id) => {
        setLoadingState('delete', true);
        try {
            const res = await deleteMirror(id);
            const msg = res?.message || 'Download deleted successfully';
            toast.success(msg);
            onStatusChange?.();
        } catch (error) {
            console.error('Delete error:', error);
            const msg = error?.response?.data?.message || 'Failed to delete download. Please try again.';
            toast.error(msg);
        } finally {
            setLoadingState('delete', false);
        }
    }, [onStatusChange, setLoadingState]);

    const openSourceUrl = useCallback((url) => {
        if (url) {
            window.open(url, "_blank");
        } else {
            toast.error('Source URL not available');
        }
    }, []);

    const copyUrlToClipboard = useCallback((url) => {
        navigator.clipboard.writeText(url)
            .then(() => toast.success('URL copied to clipboard'))
            .catch(() => toast.error('Failed to copy URL'));
    }, []);

    // Check if any action is loading for this card
    const isActionLoading = useMemo(() => {
        return Object.values(loadingStates).some(state => state);
    }, [loadingStates]);

    // Check if specific action is loading
    const isActionLoadingFor = useCallback((action) => {
        return loadingStates[action];
    }, [loadingStates]);

    // Stats configuration for grid
    const statsConfig = useMemo(() => [
        { label: 'Downloaded', value: downloaded, Icon: DownloadIcon },
        { label: 'Total Size', value: totalSize, Icon: FileIcon },
        { label: 'Speed', value: speed, Icon: SpeedIcon },
        { label: 'ETA', value: eta, Icon: ClockIcon }
    ], [downloaded, totalSize, speed, eta]);

    // Grid layout for responsive design
    const getGridTemplateColumns = () => {
        if (isMobile) {
            return 'repeat(2, 1fr)';
        } else if (isTablet) {
            return 'repeat(2, 1fr)';
        }
        return 'repeat(auto-fit, minmax(150px, 1fr))';
    };

    // Truncate filename based on screen size
    const getTruncatedFileName = useCallback((fileName) => {
        if (!fileName) return '';
        
        const maxLength = isMobile ? 15 : isTablet ? 25 : 20;
        return fileName.length > maxLength 
            ? fileName.substring(0, maxLength) + '...' 
            : fileName;
    }, [isMobile, isTablet]);

    // Get display properties from mirrorStatus
    const fileName = mirrorStatus.fileName || mirrorStatus.name || 'Unknown File';
    const fileUrl = mirrorStatus.fileUrl || mirrorStatus.url || mirrorStatus.sourceUrl;
    const gid = mirrorStatus.gid;
    const id = mirrorStatus.id;
    const isCompleted = mirrorStatus.completed;
    const isFailed = mirrorStatus.failed;
    const isCancelled = mirrorStatus.cancelled;
    const isPaused = mirrorStatus.pause;
    const logs = mirrorStatus.message || mirrorStatus.logs;

    return (
        <motion.div
            key={mirrorStatus.id || mirrorStatus.gid}
            variants={cardVariants}
            initial="hidden"
            animate="animate"
            exit="exit"
            whileHover={isMobile ? {} : "hover"}
            layout
            style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr)',
                gap: isMobile ? '0.75rem' : '1rem'
            }}
        >
            <Card
                sx={{
                    border: 'none',
                    borderRadius: '12px',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
                    transition: 'all 0.3s ease',
                    overflow: 'hidden',
                    background: 'linear-gradient(to bottom right, rgba(255,255,255,0.9), rgba(245,245,245,0.9))',
                    backdropFilter: 'blur(5px)',
                    opacity: isActionLoading ? 0.7 : 1,
                    pointerEvents: isActionLoading ? 'none' : 'auto'
                }}
            >
                <CardHeader
  sx={{
    background: 'linear-gradient(to right, #f8f9fa, #e9ecef)',
    borderBottom: '1px solid rgba(0,0,0,0.05)',
    padding: isMobile ? '0.75rem' : '1rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem'
  }}
  title={
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        minWidth: 0,
        flex: 1,
        gap: '0.5rem',
        flexWrap: isMobile ? 'wrap' : 'nowrap'
      }}
    >
      {/* Status Icon */}
      <StatusIcon mirrorStatus={mirrorStatus} />

      {/* File Name with Tooltip */}
      <Tooltip title={fileName}>
        <Typography
          variant="h6"
          sx={{
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            fontWeight: 500,
            fontSize: isMobile ? '1rem' : '1.1rem',
            color: '#333',
            flexGrow: 1,
            flexShrink: 1,
            minWidth: 0,
            maxWidth: {
              xs: 'calc(100vw - 160px)', // mobile: dynamic width minus action buttons
              sm: 'calc(100vw - 240px)',
              md: 'calc(100vw - 350px)',
              lg: 'calc(100vw - 450px)'
            },
            direction: 'ltr',
            textAlign: 'left'
          }}
        >
          {getTruncatedFileName(fileName)}
        </Typography>
      </Tooltip>

      {/* File URL Actions */}
      {fileUrl && (
        <Box
          sx={{
            display: 'flex',
            gap: '0.25rem',
            flexShrink: 0
          }}
        >
          <ActionButton
            onClick={() => openSourceUrl(fileUrl)}
            loading={false}
            disabled={isActionLoading}
            icon={OpenInNewIcon}
            label="Open source URL"
            color="#17a2b8"
          />
          <ActionButton
            onClick={() => copyUrlToClipboard(fileUrl)}
            loading={false}
            disabled={isActionLoading}
            icon={CopyIcon}
            label="Copy URL to clipboard"
            color="#6c757d"
          />
        </Box>
      )}

      {/* Download Control Actions */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: isMobile ? '0.25rem' : '0.5rem',
          flexShrink: 0
        }}
      >
        {(isCompleted || isFailed) && (
          <ActionButton
            onClick={() => handleDelete(id)}
            loading={isActionLoadingFor('delete')}
            disabled={isActionLoading}
            icon={DeleteIcon}
            label="Delete download"
            color="#dc3545"
          />
        )}
        {!isCompleted && !isFailed && !isCancelled && (
          <>
            <ActionButton
              onClick={() => (isPaused ? handleResume(gid) : handlePause(gid))}
              loading={isActionLoadingFor('pause') || isActionLoadingFor('resume')}
              disabled={isActionLoading}
              icon={isPaused ? PlayArrow : PauseIcon}
              label={isPaused ? 'Resume download' : 'Pause download'}
              color="#ffc107"
            />
            <ActionButton
              onClick={() => handleCancel(gid)}
              loading={isActionLoadingFor('cancel')}
              disabled={isActionLoading}
              icon={CloseIcon}
              label="Cancel download"
              color="#dc3545"
            />
          </>
        )}
      </Box>
    </Box>
  }
/>


                <CardContent sx={{ 
                    padding: isMobile ? '1rem' : '1.5rem',
                    '&:last-child': { paddingBottom: isMobile ? '1rem' : '1.5rem' }
                }}>
                    <motion.div
                        initial={{ scaleX: 0.8, opacity: 0.8 }}
                        animate={{ scaleX: 1, opacity: 1 }}
                        transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
                    >
                        <Box sx={{ mb: isMobile ? '1rem' : '1.5rem' }}>
                            <LinearProgress
                                variant="determinate"
                                value={progress}
                                color={progressVariant}
                                sx={{
                                    height: isMobile ? '12px' : '15px',
                                    borderRadius: '4px',
                                    overflow: 'hidden',
                                    '& .MuiLinearProgress-bar': {
                                        animation: !isCompleted && !isFailed && !isCancelled && !isPaused
                                            ? 'pulse 1.5s ease-in-out infinite'
                                            : 'none'
                                    }
                                }}
                            />
                            <Typography 
                                variant="caption" 
                                sx={{ 
                                    display: 'block', 
                                    textAlign: 'right', 
                                    mt: 0.5,
                                    fontSize: isMobile ? '0.7rem' : '0.75rem'
                                }}
                            >
                                {progress.toFixed(1)}%
                            </Typography>
                        </Box>
                    </motion.div>

                    <Box
                        sx={{
                            display: 'grid',
                            gridTemplateColumns: getGridTemplateColumns(),
                            gap: isMobile ? '0.75rem' : '1rem'
                        }}
                    >
                        {statsConfig.map((stat, index) => (
                            <StatItem
                                key={stat.label}
                                label={stat.label}
                                value={stat.value}
                                icon={stat.Icon}
                                isMobile={isMobile}
                            />
                        ))}
                    </Box>

                    {logs && (
                        <motion.div
                            initial={{ opacity: 0, height: 0, marginTop: 0 }}
                            animate={{
                                opacity: 1,
                                height: 'auto',
                                marginTop: isMobile ? '0.75rem' : '1rem'
                            }}
                            transition={{ duration: 0.3 }}
                            style={{
                                borderRadius: '6px',
                                padding: isMobile ? '0.5rem 0.75rem' : '0.75rem 1rem',
                                background: isFailed ? 'rgba(220,53,69,0.1)' : 'rgba(13,110,253,0.1)',
                                borderLeft: `3px solid ${isFailed ? '#dc3545' : '#0d6efd'}`
                            }}
                        >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                {isFailed ? (
                                    <motion.div whileHover={iconHoverEffect}>
                                        <ErrorIcon sx={{ 
                                            color: '#dc3545', 
                                            fontSize: isMobile ? '0.875rem' : '1rem' 
                                        }} />
                                    </motion.div>
                                ) : (
                                    <motion.div whileHover={iconHoverEffect}>
                                        <ArchiveIcon sx={{ 
                                            color: '#0d6efd', 
                                            fontSize: isMobile ? '0.875rem' : '1rem' 
                                        }} />
                                    </motion.div>
                                )}
                                <Typography 
                                    component="strong" 
                                    sx={{
                                        color: isFailed ? '#dc3545' : '#0d6efd',
                                        fontWeight: 'bold',
                                        fontSize: isMobile ? '0.8rem' : '0.875rem'
                                    }}
                                >
                                    {isFailed ? 'Error' : 'Logs'}
                                </Typography>
                            </Box>
                            <Box
                                component="pre"
                                sx={{
                                    maxHeight: '300px',
                                    overflowY: 'auto',
                                    background: '#111',
                                    padding: isMobile ? '8px' : '10px',
                                    borderRadius: '6px',
                                    marginTop: '0.5rem',
                                    fontSize: isMobile ? '0.75rem' : '0.875rem',
                                    whiteSpace: 'pre-wrap',
                                    color: '#f8f9fa',
                                    fontFamily: 'monospace'
                                }}
                                dangerouslySetInnerHTML={{ 
                                    __html: logs || "<em>No logs yet...</em>" 
                                }}
                            />
                        </motion.div>
                    )}
                </CardContent>
            </Card>
        </motion.div>
    );
};

export default React.memo(StatusCard);