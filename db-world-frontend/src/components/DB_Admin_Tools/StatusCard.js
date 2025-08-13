import React, { useMemo, useCallback } from 'react';
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
    PlayArrow
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
    Typography
} from '@mui/material';
import { useSnackbar } from 'notistack';
import axios from 'axios';
import CommonServices from '../CommonServices';
import axiosInstance from '../Utils/AxiosInstants';
import Constants from '../Constants';
import { toast } from '../Toast';
import { cancelledMirrorByGID, deleteMirror, pauseMirror, resumeMirror } from '../ApiServices';

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

const StatusCard = ({ download = {}, onStatusChange }) => {

    // Memoize calculated values
    const { progress, speed, downloaded, totalSize, eta } = useMemo(() => {
        const progressValue = download?.downloadStatus?.totalFileSize > 0
            ? (download?.downloadStatus?.fileDownloaded / download?.downloadStatus?.totalFileSize) * 100
            : 0;

        const speedData = CommonServices.bytesToReadbleFormat(download?.downloadStatus?.speed || 0);
        const speedValue = `${speedData.value}${speedData.suffix}/s`;

        const downloadedData = CommonServices.bytesToReadbleFormat(download?.downloadStatus?.fileDownloaded || 0);
        const downloadedValue = `${downloadedData.value} ${downloadedData.suffix}`;

        const totalSizeData = CommonServices.bytesToReadbleFormat(download?.downloadStatus?.totalFileSize || 0);
        const totalSizeValue = `${totalSizeData.value} ${totalSizeData.suffix}`;

        const etaValue = CommonServices.formatETA(download?.downloadStatus?.eta);

        return {
            progress: progressValue,
            speed: speedValue,
            downloaded: downloadedValue,
            totalSize: totalSizeValue,
            eta: etaValue
        };
    }, [download]);

    const { Icon, color, animate, spin } = useMemo(() => {
        if (download?.failed) return {
            Icon: ErrorIcon,
            color: "#dc3545"
        };
        if (download?.cancelled) return {
            Icon: BlockIcon,
            color: "#6c757d"
        };
        if (download?.pause) return {
            Icon: PauseCircleIcon,
            color: "#ffc107"
        };
        if (download?.currentStatus?.toLowerCase().includes("extract")) return {
            Icon: ArchiveIcon,
            color: "#17a2b8",
            spin: true
        };
        if (download?.completed) return {
            Icon: CheckCircleIcon,
            color: "#28a745"
        };
        return {
            Icon: DownloadIcon,
            color: "#007bff",
            animate: true
        };
    }, [download]);

    const progressVariant = useMemo(() => {
        if (download?.failed) return 'error';
        if (download?.cancelled) return 'secondary';
        if (download?.pause) return 'warning';
        if (download?.completed) return 'success';
        return 'primary';
    }, [download]);

    // Memoize action handlers
    const handlePause = useCallback(async (gid) => {
        try {
            await pauseMirror(gid);
            toast.success('Download paused', { variant: 'success' });
            onStatusChange?.();
        } catch (error) {
            toast.error('Failed to pause download', { variant: 'error' });
        }
    }, [onStatusChange]);

    const handleResume = useCallback(async (gid) => {
        try {
            await resumeMirror(gid);
            toast.success('Download resumed', { variant: 'success' });
            onStatusChange?.();
        } catch (error) {
            toast.error('Failed to resume download', { variant: 'error' });
        }
    }, [onStatusChange]);

    const handleCancel = useCallback(async (gid) => {
        try {
            await cancelledMirrorByGID(gid);
            toast.success('Download cancelled', { variant: 'success' });
            onStatusChange?.();
        } catch (error) {
            toast.error('Failed to cancel download', { variant: 'error' });
        }
    }, [onStatusChange]);

    const handleDelete = useCallback(async (statusId) => {
        try {
            await deleteMirror(statusId);
            toast.success('Download deleted', { variant: 'success' });
            onStatusChange?.();
        } catch (error) {
            toast.error('Failed to delete download', { variant: 'error' });
        }
    }, [onStatusChange]);

    const openSourceUrl = useCallback((url) => {
        if (url) {
            window.open(url, "_blank");
        } else {
            toast.error('Source URL not available', { variant: 'error' });
        }
    }, []);

    const copyUrlToClipboard = useCallback((url) => {
        navigator.clipboard.writeText(url)
            .then(() => toast.success('URL copied to clipboard', { variant: 'success' }))
            .catch(() => toast.error('Failed to copy URL', { variant: 'error' }));
    }, []);

    if (!download || !download.gid) {
        return (
            <Card style={{ padding: '1rem', textAlign: 'center' }}>
                <Typography>No download data available</Typography>
            </Card>
        );
    }

    return (
        <motion.div
            key={download.gid}
            variants={cardVariants}
            initial="hidden"
            animate="animate"
            exit="exit"
            whileHover="hover"
            layout
            style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr)',
                gap: '1rem'
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
                    backdropFilter: 'blur(5px)'
                }}
            >
                <CardHeader
                    sx={{
                        background: 'linear-gradient(to right, #f8f9fa, #e9ecef)',
                        borderBottom: '1px solid rgba(0,0,0,0.05)',
                        padding: '1rem',
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
                            }}
                        >
                            {/* File Name with Tooltip */}
                            <Tooltip title={download.fileName}>
                                <Typography
                                    variant="h6"
                                    sx={{
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        fontWeight: 500,
                                        fontSize: '1.1rem',
                                        color: '#333',
                                        flex: 1,
                                        minWidth: 0,
                                        maxWidth: '80%',
                                        direction: 'ltr',
                                        textAlign: 'left',
                                    }}
                                >
                                     {download?.fileName?.substring(0, 20) + (download?.fileName?.length > 20 ? '...' : '')}
                                </Typography>
                            </Tooltip>

                            {/* File URL Actions */}
                            {download.fileUrl && (
                                <Box sx={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
                                    <motion.div whileHover={iconHoverEffect}>
                                        <IconButton
                                            size="small"
                                            onClick={() => openSourceUrl(download.fileUrl)}
                                            aria-label="Open source URL"
                                            sx={{ p: 0.5, color: '#17a2b8' }}
                                        >
                                            <OpenInNewIcon sx={{ fontSize: 14 }} />
                                        </IconButton>
                                    </motion.div>

                                    <motion.div whileHover={iconHoverEffect}>
                                        <IconButton
                                            size="small"
                                            onClick={() => copyUrlToClipboard(download.fileUrl)}
                                            aria-label="Copy URL to clipboard"
                                            sx={{ p: 0.5, color: '#6c757d' }}
                                        >
                                            <CopyIcon sx={{ fontSize: 14 }} />
                                        </IconButton>
                                    </motion.div>
                                </Box>
                            )}

                            {/* Status & Actions */}
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                                {/* Status Icon Animation */}
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

                                {/* Completed or Failed: Show delete */}
                                {(download.completed || download.failed) && (
                                    <motion.div whileHover={iconHoverEffect}>
                                        <IconButton
                                            size="small"
                                            onClick={() => handleDelete(download.id)}
                                            aria-label="Delete download"
                                            sx={{ p: 0.5, color: '#dc3545' }}
                                        >
                                            <DeleteIcon sx={{ fontSize: 14 }} />
                                        </IconButton>
                                    </motion.div>
                                )}

                                {/* In Progress: Show pause/resume/cancel */}
                                {!download.completed && !download.failed && !download.cancelled && (
                                    <>
                                        <motion.div whileHover={iconHoverEffect}>
                                            <IconButton
                                                size="small"
                                                onClick={() =>
                                                    download.pause ? handleResume(download.gid) : handlePause(download.gid)
                                                }
                                                aria-label={download.pause ? 'Resume download' : 'Pause download'}
                                                sx={{ p: 0.5, color: '#ffc107' }}
                                            >
                                                {download.pause ? (
                                                    <PlayArrow sx={{ fontSize: 14 }} />
                                                ) : (
                                                    <PauseIcon sx={{ fontSize: 14 }} />
                                                )}
                                            </IconButton>
                                        </motion.div>

                                        <motion.div whileHover={iconHoverEffect}>
                                            <IconButton
                                                size="small"
                                                onClick={() => handleCancel(download.gid)}
                                                aria-label="Cancel download"
                                                sx={{ p: 0.5, color: '#dc3545' }}
                                            >
                                                <CloseIcon sx={{ fontSize: 14 }} />
                                            </IconButton>
                                        </motion.div>
                                    </>
                                )}
                            </Box>
                        </Box>

                    }
                />

                <CardContent sx={{ padding: '1.5rem' }}>
                    <motion.div
                        initial={{ scaleX: 0.8, opacity: 0.8 }}
                        animate={{ scaleX: 1, opacity: 1 }}
                        transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
                    >
                        <Box sx={{ mb: '1.5rem' }}>
                            <LinearProgress
                                variant="determinate"
                                value={progress}
                                color={progressVariant}
                                sx={{
                                    height: '15px',
                                    borderRadius: '4px',
                                    overflow: 'hidden',
                                    '& .MuiLinearProgress-bar': {
                                        animation: !download.completed && !download.failed && !download.cancelled && !download.pause
                                            ? 'pulse 1.5s ease-in-out infinite'
                                            : 'none'
                                    }
                                }}
                            />
                            <Typography variant="caption" sx={{ display: 'block', textAlign: 'right', mt: 0.5 }}>
                                {progress.toFixed(1)}%
                            </Typography>
                        </Box>
                    </motion.div>

                    <Box
                        sx={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                            gap: '1rem'
                        }}
                    >
                        {[
                            { label: 'Downloaded', value: downloaded, Icon: DownloadIcon },
                            { label: 'Total Size', value: totalSize, Icon: FileIcon },
                            { label: 'Speed', value: speed, Icon: SpeedIcon },
                            { label: 'ETA', value: eta, Icon: ClockIcon }
                        ].map((stat, index) => (
                            <motion.div
                                key={index}
                                variants={statItemVariants}
                                whileHover={{ scale: 1.03 }}
                                sx={{
                                    padding: '0.5rem',
                                    borderRadius: '6px',
                                    background: 'rgba(0,0,0,0.02)'
                                }}
                            >
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem', mb: '0.25rem' }}>
                                    <motion.div whileHover={iconHoverEffect}>
                                        <stat.Icon sx={{ fontSize: '0.875rem', color: '#6c757d' }} />
                                    </motion.div>
                                    <Typography variant="caption" sx={{ color: '#6c757d', fontWeight: 500 }}>
                                        {stat.label}
                                    </Typography>
                                </Box>
                                <Typography variant="body2" sx={{ fontWeight: 500, color: '#343a40' }}>
                                    {stat.value}
                                </Typography>
                            </motion.div>
                        ))}
                    </Box>

                    {(download.message) && (
                        <motion.div
                            initial={{ opacity: 0, height: 0, marginTop: 0 }}
                            animate={{
                                opacity: 1,
                                height: 'auto',
                                marginTop: '1rem'
                            }}
                            transition={{ duration: 0.3 }}
                            sx={{
                                borderRadius: '6px',
                                padding: '0.75rem 1rem',
                                background: download.failed ? 'rgba(220,53,69,0.1)' : 'rgba(13,110,253,0.1)',
                                borderLeft: `3px solid ${download.failed ? '#dc3545' : '#0d6efd'}`
                            }}
                        >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                {download.failed ? (
                                    <motion.div whileHover={iconHoverEffect}>
                                        <ErrorIcon sx={{ color: '#dc3545', fontSize: '1rem' }} />
                                    </motion.div>
                                ) : (
                                    <motion.div whileHover={iconHoverEffect}>
                                        <ArchiveIcon sx={{ color: '#0d6efd', fontSize: '1rem' }} />
                                    </motion.div>
                                )}
                                <Typography component="strong" sx={{
                                    color: download.failed ? '#dc3545' : '#0d6efd',
                                    fontWeight: 'bold'
                                }}>
                                    {download.failed ? 'Error' : 'Logs'}
                                </Typography>
                            </Box>
                            <Box
                                component="pre"
                                sx={{
                                    maxHeight: '300px',
                                    overflowY: 'auto',
                                    background: '#111',
                                    padding: '10px',
                                    borderRadius: '6px',
                                    marginTop: '0.5rem',
                                    fontSize: '0.875rem',
                                    whiteSpace: 'pre-wrap',
                                    color: '#f8f9fa'
                                }}
                                dangerouslySetInnerHTML={{ __html: download.message || "<em>No logs yet...</em>" }}
                            />
                        </motion.div>
                    )}
                </CardContent>
            </Card>
            
        </motion.div>
    );
};

export default React.memo(StatusCard);