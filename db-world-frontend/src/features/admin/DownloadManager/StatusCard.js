import React, { useMemo, useCallback, useState } from 'react';
import {
    Download as DownloadIcon,
    CheckCircle as CheckCircleIcon,
    Error as ErrorIcon,
    PauseCircle as PauseCircleIcon,
    Archive as ArchiveIcon,
    OpenInNew as OpenInNewIcon,
    ContentCopy as CopyIcon,
    Delete as DeleteIcon,
    Pause as PauseIcon,
    Close as CloseIcon,
    AccessTime as ClockIcon,
    Speed as SpeedIcon,
    InsertDriveFile as FileIcon,
    PlayArrow,
    Queue as QueueIcon,
    Link as LinkIcon,
    Cable as MagnetIcon,
    Folder as FolderIcon,
    MoreVert as MoreVertIcon,
    Info as InfoIcon,
    ExpandMore as ExpandMoreIcon,
    ExpandLess as ExpandLessIcon,
    Warning as WarningIcon
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
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
    useTheme,
    Chip,
    Menu,
    MenuItem,
    Stack,
    Divider,
    alpha
} from '@mui/material';
import { toast } from '@shared/components/ui/Toast';
import CommonServices from '@shared/services/CommonServices';
import { cancelledMirrorByGID, deleteMirror, pauseMirror, resumeMirror } from '@shared/services/ApiServices';

const cardVariants = {
    hidden: { opacity: 0, y: 8, scale: 0.98 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, x: -8 },
    hover: { y: -2, boxShadow: 12 }
};

const iconHoverEffect = {
    scale: 1.15,
    transition: { duration: 0.15 }
};

// Compact file size formatter
const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

// Status configuration with updated colors
const STATUS_CONFIG = {
    DOWNLOAD: { color: 'primary', icon: DownloadIcon, bgColor: 'primary.light' },
    PAUSE: { color: 'warning', icon: PauseCircleIcon, bgColor: 'warning.light' },
    RESUME: { color: 'info', icon: PlayArrow, bgColor: 'info.light' },
    SUCCESS: { color: 'success', icon: CheckCircleIcon, bgColor: 'success.light' },
    ERROR: { color: 'error', icon: ErrorIcon, bgColor: 'error.light' },
    FAILED: { color: 'error', icon: ErrorIcon, bgColor: 'error.light' },
    CANCELLED: { color: 'grey', icon: CloseIcon, bgColor: 'grey.200' },
    EXTRACT: { color: 'secondary', icon: ArchiveIcon, bgColor: 'secondary.light' },
    MERGE: { color: 'secondary', icon: ArchiveIcon, bgColor: 'secondary.light' },
    FFMPEG: { color: 'secondary', icon: ArchiveIcon, bgColor: 'secondary.light' },
    COMPLETE: { color: 'success', icon: CheckCircleIcon, bgColor: 'success.light' }
};

// Safe HTML renderer for message content
const MessageRenderer = ({ html }) => {
    const createMarkup = () => {
        if (!html) return { __html: '' };
        // Basic sanitization - remove script tags while preserving other HTML
        const cleanHtml = html
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/on\w+="[^"]*"/gi, '')
            .replace(/on\w+='[^']*'/gi, '')
            .replace(/javascript:/gi, '');
        return { __html: cleanHtml };
    };

    return (
        <Box
            component="div"
            sx={{
                '& div': {
                    marginBottom: '2px',
                    lineHeight: 1.3
                },
                '& div:last-child': {
                    marginBottom: 0
                },
                fontFamily: "'Monaco', 'Menlo', 'Ubuntu Mono', monospace",
                fontSize: '0.75rem',
                overflowWrap: 'break-word',
                wordBreak: 'break-word'
            }}
            dangerouslySetInnerHTML={createMarkup()}
        />
    );
};

// Compact stat display component
const CompactStat = ({ label, value, icon: Icon, color = 'text.secondary' }) => {
    const theme = useTheme();
    return (
        <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 0.75,
            flex: 1,
            minWidth: 0
        }}>
            <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                width: 28,
                height: 28,
                borderRadius: '8px',
                bgcolor: alpha(theme.palette[color]?.main || '#6c757d', 0.1),
                backdropFilter: 'blur(4px)',
                border: `1px solid ${alpha(theme.palette[color]?.main || '#6c757d', 0.1)}`
            }}>
                <Icon sx={{ 
                    fontSize: '0.75rem',
                    color: color
                }} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
                <Typography variant="caption" sx={{ 
                    color: 'text.secondary', 
                    fontSize: '0.65rem',
                    lineHeight: 1,
                    display: 'block',
                    fontWeight: 500,
                    textTransform: 'uppercase',
                    letterSpacing: '0.3px'
                }}>
                    {label}
                </Typography>
                <Typography variant="caption" sx={{ 
                    fontWeight: 600,
                    fontSize: '0.8125rem',
                    lineHeight: 1.2,
                    display: 'block',
                    mt: 0.25
                }}>
                    {value}
                </Typography>
            </Box>
        </Box>
    );
};

// Compact action button
const CompactActionButton = React.memo(({ 
    onClick, 
    loading, 
    icon: Icon, 
    label, 
    color = 'default',
    size = 'small'
}) => {
    const theme = useTheme();
    return (
        <motion.div whileHover={iconHoverEffect}>
            <Tooltip title={label} arrow>
                <IconButton
                    size={size}
                    onClick={onClick}
                    disabled={loading}
                    sx={{ 
                        width: 30,
                        height: 30,
                        color: color,
                        bgcolor: alpha(theme.palette[color]?.main || '#6c757d', 0.1),
                        backdropFilter: 'blur(4px)',
                        border: `1px solid ${alpha(theme.palette[color]?.main || '#6c757d', 0.1)}`,
                        '&:hover': {
                            bgcolor: alpha(theme.palette[color]?.main || '#6c757d', 0.2),
                            borderColor: alpha(theme.palette[color]?.main || '#6c757d', 0.3)
                        },
                        '&:disabled': { opacity: 0.5 }
                    }}
                >
                    {loading ? (
                        <CircularProgress size={14} color="inherit" />
                    ) : (
                        <Icon sx={{ fontSize: size === 'small' ? 14 : 16 }} />
                    )}
                </IconButton>
            </Tooltip>
        </motion.div>
    );
});

const StatusCard = ({ download = {}, onStatusChange }) => {
    const [loadingStates, setLoadingStates] = useState({
        pause: false,
        resume: false,
        cancel: false,
        delete: false
    });
    const [anchorEl, setAnchorEl] = useState(null);
    const [expanded, setExpanded] = useState(false);

    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const isSmallMobile = useMediaQuery('(max-width: 480px)');

    // Extract data
    const status = download?.status || {};
    const downloadStatus = status?.downloadStatus || {};
    const { isQueued = false, isRunning = false, queuePosition = null } = download;

    const {
        fileName = 'Unknown File',
        fileUrl,
        folderName,
        fileSize,
        fileType,
        magnet = false,
        currentState = 'UNKNOWN',
        id: downloadId,
        message
    } = status;

    // Memoized calculations
    const metrics = useMemo(() => {
        const totalFileSize = fileSize || downloadStatus.totalFileSize || 0;
        const fileDownloaded = downloadStatus.fileDownloaded || 0;
        
        const progress = totalFileSize > 0 ? (fileDownloaded / totalFileSize) * 100 : 0;
        const speedData = CommonServices.bytesToReadbleFormat(downloadStatus.speed || 0);
        const speed = `${speedData.value}${speedData.suffix}/s`;
        const eta = CommonServices.formatETA(downloadStatus.eta);

        return {
            progress,
            speed,
            eta,
            downloaded: formatFileSize(fileDownloaded),
            totalSize: formatFileSize(totalFileSize),
            progressFormatted: progress.toFixed(1),
            isCompleted: currentState === 'SUCCESS' || currentState === 'COMPLETE'
        };
    }, [downloadStatus, fileSize, currentState]);

    const statusConfig = STATUS_CONFIG[currentState] || { color: 'default', icon: QueueIcon, bgColor: 'grey.100' };
    const StatusIcon = statusConfig.icon;

    // Action handlers
    const setLoadingState = useCallback((action, isLoading) => {
        setLoadingStates(prev => ({ ...prev, [action]: isLoading }));
    }, []);

    const runAction = useCallback(async (actionType, apiFn, successMsg) => {
        setLoadingState(actionType, true);
        try {
            const res = await apiFn(downloadId);
            toast.success(res?.message || successMsg);
            onStatusChange?.();
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Action failed');
        } finally {
            setLoadingState(actionType, false);
        }
    }, [downloadId, onStatusChange, setLoadingState]);

    const handlePause = () => runAction('pause', pauseMirror, 'Paused');
    const handleResume = () => runAction('resume', resumeMirror, 'Resumed');
    const handleCancel = () => runAction('cancel', cancelledMirrorByGID, 'Cancelled');
    const handleDelete = () => runAction('delete', deleteMirror, 'Deleted');

    const openSourceUrl = () => fileUrl && window.open(fileUrl, "_blank");
    const copyUrlToClipboard = () => {
        if (fileUrl) navigator.clipboard.writeText(fileUrl).then(() => toast.success('URL copied'));
    };

    // Action states
    const showDeleteAction = currentState === 'SUCCESS' || currentState === 'ERROR' || currentState === 'FAILED' || currentState === 'CANCELLED' || currentState === 'COMPLETE';
    const showPauseResumeAction = (currentState === 'DOWNLOAD' || currentState === 'PAUSE') && !isQueued;
    const showCancelAction = (currentState === 'DOWNLOAD' || currentState === 'PAUSE' || currentState === 'RESUME') && !isQueued;
    const isActionLoading = Object.values(loadingStates).some(state => state);

    // Compact filename with smart truncation
    const getDisplayFileName = () => {
        if (!fileName) return 'Unknown File';
        
        const maxLength = isSmallMobile ? 20 : isMobile ? 28 : 36;
        if (fileName.length <= maxLength) return fileName;
        
        const extension = fileName.includes('.') ? fileName.substring(fileName.lastIndexOf('.')) : '';
        const nameWithoutExt = fileName.substring(0, fileName.length - extension.length);
        const truncatedName = nameWithoutExt.substring(0, maxLength - extension.length - 3) + '…';
        return truncatedName + extension;
    };

    const handleMenuOpen = (event) => {
        setAnchorEl(event.currentTarget);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
    };

    // Glass morphism background styles
    const glassStyles = {
        background: 'rgba(255, 255, 255, 0.7)',
        backdropFilter: 'blur(10px) saturate(180%)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
        WebkitBackdropFilter: 'blur(10px) saturate(180%)'
    };

    const darkGlassStyles = {
        background: 'rgba(30, 30, 40, 0.7)',
        backdropFilter: 'blur(10px) saturate(180%)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
        WebkitBackdropFilter: 'blur(10px) saturate(180%)'
    };

    const currentGlassStyle = theme.palette.mode === 'dark' ? darkGlassStyles : glassStyles;

    return (
        <motion.div
            variants={cardVariants}
            initial="hidden"
            animate="animate"
            exit="exit"
            whileHover={!isMobile ? "hover" : {}}
            style={{ 
                marginBottom: isMobile ? 1 : 1.25,
                width: '100%' // Maintain original width
            }}
        >
            <Card sx={{ 
                borderRadius: 2,
                ...currentGlassStyle,
                transition: 'all 0.3s ease',
                opacity: isActionLoading ? 0.8 : 1,
                overflow: 'visible',
                width: '100%', // Maintain original width
                '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: theme.palette.mode === 'dark' 
                        ? '0 12px 40px rgba(0, 0, 0, 0.4)' 
                        : '0 12px 40px rgba(0, 0, 0, 0.15)',
                    borderColor: alpha(theme.palette[statusConfig.color]?.main || '#6c757d', 0.3)
                }
            }}>
                {/* Compact Header */}
                <Box sx={{ 
                    p: isMobile ? 1.5 : 2,
                    pb: 1,
                    borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`
                }}>
                    <Box sx={{ 
                        display: 'flex', 
                        alignItems: 'flex-start', 
                        gap: 1.5,
                        mb: 1.5
                    }}>
                        {/* Status Badge with glass effect */}
                        <motion.div
                            animate={isRunning ? { scale: [1, 1.05, 1] } : {}}
                            transition={{ duration: 2, repeat: Infinity }}
                        >
                            <Box sx={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: 44,
                                height: 44,
                                borderRadius: '12px',
                                bgcolor: alpha(theme.palette[statusConfig.color]?.main || '#6c757d', 0.15),
                                backdropFilter: 'blur(4px)',
                                border: `2px solid ${alpha(theme.palette[statusConfig.color]?.main || '#6c757d', 0.2)}`,
                                boxShadow: `0 4px 12px ${alpha(theme.palette[statusConfig.color]?.main || '#6c757d', 0.1)}`
                            }}>
                                <StatusIcon sx={{ 
                                    fontSize: '1.4rem',
                                    color: theme.palette[statusConfig.color]?.main || '#6c757d'
                                }} />
                            </Box>
                        </motion.div>

                        {/* File info */}
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 0.75 }}>
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Tooltip title={fileName} arrow placement="top">
                                        <Typography
                                            variant="subtitle1"
                                            sx={{
                                                fontWeight: 600,
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                                fontSize: isMobile ? '0.9375rem' : '1rem',
                                                color: 'text.primary',
                                                mb: 0.5
                                            }}
                                        >
                                            {getDisplayFileName()}
                                        </Typography>
                                    </Tooltip>
                                    
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                                        <Chip
                                            label={currentState}
                                            size="small"
                                            color={statusConfig.color}
                                            sx={{ 
                                                fontSize: '0.65rem', 
                                                height: 22,
                                                fontWeight: 600,
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.5px',
                                                backdropFilter: 'blur(4px)'
                                            }}
                                        />
                                        
                                        {isQueued && queuePosition && (
                                            <Chip
                                                label={`Queue #${queuePosition}`}
                                                size="small"
                                                color="info"
                                                sx={{ 
                                                    fontSize: '0.65rem', 
                                                    height: 22,
                                                    fontWeight: 600,
                                                    backdropFilter: 'blur(4px)'
                                                }}
                                            />
                                        )}
                                        
                                        {folderName && (
                                            <Chip
                                                icon={<FolderIcon fontSize="small" />}
                                                label={folderName}
                                                size="small"
                                                variant="outlined"
                                                sx={{ 
                                                    fontSize: '0.65rem',
                                                    height: 22,
                                                    '& .MuiChip-icon': { fontSize: '0.75rem' },
                                                    backdropFilter: 'blur(4px)'
                                                }}
                                            />
                                        )}
                                    </Box>
                                </Box>

                                {/* Action buttons */}
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                                    {!isMobile && (
                                        <>
                                            {fileUrl && !magnet && (
                                                <>
                                                    <CompactActionButton
                                                        onClick={openSourceUrl}
                                                        icon={OpenInNewIcon}
                                                        label="Open URL"
                                                        color="info"
                                                    />
                                                    <CompactActionButton
                                                        onClick={copyUrlToClipboard}
                                                        icon={CopyIcon}
                                                        label="Copy URL"
                                                        color="default"
                                                    />
                                                </>
                                            )}
                                            {showPauseResumeAction && (
                                                <CompactActionButton
                                                    onClick={isRunning || currentState === 'DOWNLOAD' ? handlePause : handleResume}
                                                    loading={loadingStates.pause || loadingStates.resume}
                                                    icon={isRunning || currentState === 'DOWNLOAD' ? PauseIcon : PlayArrow}
                                                    label={isRunning || currentState === 'DOWNLOAD' ? 'Pause' : 'Resume'}
                                                    color="warning"
                                                />
                                            )}
                                            {showCancelAction && (
                                                <CompactActionButton
                                                    onClick={handleCancel}
                                                    loading={loadingStates.cancel}
                                                    icon={CloseIcon}
                                                    label="Cancel"
                                                    color="error"
                                                />
                                            )}
                                            {showDeleteAction && (
                                                <CompactActionButton
                                                    onClick={handleDelete}
                                                    loading={loadingStates.delete}
                                                    icon={DeleteIcon}
                                                    label="Delete"
                                                    color="error"
                                                />
                                            )}
                                        </>
                                    )}
                                    
                                    {/* Mobile menu button */}
                                    {isMobile && (
                                        <>
                                            <CompactActionButton
                                                onClick={handleMenuOpen}
                                                icon={MoreVertIcon}
                                                label="More options"
                                                color="default"
                                            />
                                            <Menu
                                                anchorEl={anchorEl}
                                                open={Boolean(anchorEl)}
                                                onClose={handleMenuClose}
                                                PaperProps={{
                                                    sx: { 
                                                        minWidth: 160,
                                                        mt: 1,
                                                        backdropFilter: 'blur(10px)',
                                                        bgcolor: alpha(theme.palette.background.paper, 0.9)
                                                    }
                                                }}
                                            >
                                                {fileUrl && !magnet && [
                                                    <MenuItem key="open" onClick={() => { openSourceUrl(); handleMenuClose(); }}>
                                                        <OpenInNewIcon fontSize="small" sx={{ mr: 1.5 }} />
                                                        Open URL
                                                    </MenuItem>,
                                                    <MenuItem key="copy" onClick={() => { copyUrlToClipboard(); handleMenuClose(); }}>
                                                        <CopyIcon fontSize="small" sx={{ mr: 1.5 }} />
                                                        Copy URL
                                                    </MenuItem>,
                                                    <Divider key="divider1" />
                                                ]}
                                                {showPauseResumeAction && (
                                                    <MenuItem onClick={() => { (isRunning || currentState === 'DOWNLOAD') ? handlePause() : handleResume(); handleMenuClose(); }}>
                                                        {(isRunning || currentState === 'DOWNLOAD') ? <PauseIcon fontSize="small" sx={{ mr: 1.5 }} /> : <PlayArrow fontSize="small" sx={{ mr: 1.5 }} />}
                                                        {(isRunning || currentState === 'DOWNLOAD') ? 'Pause' : 'Resume'}
                                                    </MenuItem>
                                                )}
                                                {showCancelAction && (
                                                    <MenuItem onClick={() => { handleCancel(); handleMenuClose(); }}>
                                                        <CloseIcon fontSize="small" sx={{ mr: 1.5 }} />
                                                        Cancel
                                                    </MenuItem>
                                                )}
                                                {showDeleteAction && (
                                                    <MenuItem onClick={() => { handleDelete(); handleMenuClose(); }}>
                                                        <DeleteIcon fontSize="small" sx={{ mr: 1.5 }} />
                                                        Delete
                                                    </MenuItem>
                                                )}
                                            </Menu>
                                        </>
                                    )}
                                    
                                    {message && (
                                        <CompactActionButton
                                            onClick={() => setExpanded(!expanded)}
                                            icon={expanded ? ExpandLessIcon : ExpandMoreIcon}
                                            label={expanded ? "Hide details" : "Show details"}
                                            color="default"
                                        />
                                    )}
                                </Box>
                            </Box>

                            {/* Progress bar */}
                            <Box sx={{ mb: 1.5 }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.75 }}>
                                    <Typography variant="caption" sx={{ 
                                        fontWeight: 600,
                                        fontSize: '0.75rem',
                                        color: theme.palette[statusConfig.color]?.main || '#6c757d'
                                    }}>
                                        {metrics.progressFormatted}%
                                    </Typography>
                                    <Typography variant="caption" sx={{ 
                                        fontWeight: 500,
                                        fontSize: '0.75rem',
                                        color: 'text.secondary'
                                    }}>
                                        {metrics.downloaded} / {metrics.totalSize}
                                    </Typography>
                                </Box>
                                <LinearProgress
                                    variant="determinate"
                                    value={metrics.isCompleted ? 100 : metrics.progress}
                                    color={statusConfig.color}
                                    sx={{
                                        height: 8,
                                        borderRadius: 4,
                                        backgroundColor: alpha(theme.palette[statusConfig.color]?.main || '#6c757d', 0.1),
                                        backdropFilter: 'blur(4px)',
                                        '& .MuiLinearProgress-bar': {
                                            borderRadius: 4,
                                            boxShadow: `0 0 8px ${alpha(theme.palette[statusConfig.color]?.main || '#6c757d', 0.3)}`
                                        }
                                    }}
                                />
                            </Box>

                            {/* Stats row */}
                            <Box sx={{ 
                                display: 'grid',
                                gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr 1fr',
                                gap: 1.5,
                                alignItems: 'center',
                                pt: 1,
                                borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}`
                            }}>
                                <CompactStat
                                    label="Speed"
                                    value={metrics.speed}
                                    icon={SpeedIcon}
                                    color={statusConfig.color}
                                />
                                <CompactStat
                                    label="ETA"
                                    value={metrics.eta || '--'}
                                    icon={ClockIcon}
                                    color={statusConfig.color}
                                />
                                {!isMobile && (
                                    <CompactStat
                                        label="Type"
                                        value={magnet ? 'Torrent' : 'Direct'}
                                        icon={magnet ? MagnetIcon : LinkIcon}
                                        color={statusConfig.color}
                                    />
                                )}
                            </Box>
                        </Box>
                    </Box>
                </Box>

                {/* Status message (collapsible) */}
                <AnimatePresence>
                    {expanded && message && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                        >
                            <Box sx={{ 
                                p: isMobile ? 1.5 : 2,
                                pt: 1.5,
                                bgcolor: alpha(currentState === 'ERROR' || currentState === 'FAILED'
                                    ? theme.palette.error.main
                                    : currentState === 'SUCCESS' || currentState === 'COMPLETE'
                                    ? theme.palette.success.main
                                    : theme.palette.info.main, 0.07),
                                backdropFilter: 'blur(8px)',
                                borderTop: `1px solid ${alpha(currentState === 'ERROR' || currentState === 'FAILED'
                                    ? theme.palette.error.main
                                    : currentState === 'SUCCESS' || currentState === 'COMPLETE'
                                    ? theme.palette.success.main
                                    : theme.palette.info.main, 0.2)}`
                            }}>
                                <Box sx={{ 
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: 1
                                }}>
                                    <Box sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        width: 24,
                                        height: 24,
                                        borderRadius: '6px',
                                        bgcolor: alpha(currentState === 'ERROR' || currentState === 'FAILED'
                                            ? theme.palette.error.main
                                            : currentState === 'SUCCESS' || currentState === 'COMPLETE'
                                            ? theme.palette.success.main
                                            : theme.palette.info.main, 0.2),
                                        flexShrink: 0
                                    }}>
                                        <InfoIcon sx={{ 
                                            fontSize: '0.875rem',
                                            color: currentState === 'ERROR' || currentState === 'FAILED'
                                                ? 'error.main'
                                                : currentState === 'SUCCESS' || currentState === 'COMPLETE'
                                                ? 'success.main'
                                                : 'info.main'
                                        }} />
                                    </Box>
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Typography variant="subtitle2" sx={{ 
                                            fontWeight: 600,
                                            mb: 1,
                                            color: currentState === 'ERROR' || currentState === 'FAILED'
                                                ? 'error.main'
                                                : currentState === 'SUCCESS' || currentState === 'COMPLETE'
                                                ? 'success.main'
                                                : 'info.main'
                                        }}>
                                            {currentState === 'ERROR' || currentState === 'FAILED' 
                                                ? 'Error Details' 
                                                : currentState === 'SUCCESS' || currentState === 'COMPLETE'
                                                ? 'Completed Successfully'
                                                : 'Status Information'}
                                        </Typography>
                                        <Box sx={{
                                            maxHeight: isMobile ? '200px' : '300px',
                                            overflowY: 'auto',
                                            pr: 1,
                                            '&::-webkit-scrollbar': {
                                                width: '6px'
                                            },
                                            '&::-webkit-scrollbar-track': {
                                                background: alpha(theme.palette.divider, 0.1),
                                                borderRadius: '3px'
                                            },
                                            '&::-webkit-scrollbar-thumb': {
                                                background: alpha(theme.palette.divider, 0.3),
                                                borderRadius: '3px'
                                            },
                                            '&::-webkit-scrollbar-thumb:hover': {
                                                background: alpha(theme.palette.divider, 0.5)
                                            }
                                        }}>
                                            <MessageRenderer html={message} />
                                        </Box>
                                    </Box>
                                </Box>
                            </Box>
                        </motion.div>
                    )}
                </AnimatePresence>
            </Card>
        </motion.div>
    );
};

export default React.memo(StatusCard);