import React, { useEffect, useRef, useState } from 'react';
import {
    Box,
    Grid,
    Card,
    CardContent,
    CardActions,
    Typography,
    Checkbox,
    IconButton,
    Tooltip,
    Chip,
    CircularProgress,
    Dialog,
    DialogTitle,
    DialogContent,
    Divider,
    alpha
} from '@mui/material';
import {
    VideoFile as VideoIcon,
    PlayArrow as PlayIcon,
    Speed as SpeedIcon,
    AudioFile,
    CopyAll as CopyIcon,
    Download as DownloadIcon,
    Delete as DeleteIcon,
    OpenInFull as OpenIcon,
    Close as CloseIcon
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';

const CARD_HEIGHT = 280;

const MediaGridView = ({
    files,
    selectedFiles,
    isMobile,
    theme,
    extractVideoInfo,
    extractFileNameInfo,
    handleFileSelect,
    handleCopyPath,
    handleDownloadFile,
    renderFileDetails,
    setDialogOpen,
    setSelectedFiles
}) => {
    /* =========================
       INFINITE SCROLL
       ========================= */

    const BATCH_SIZE = isMobile ? 8 : 12;
    const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
    const loaderRef = useRef(null);

    useEffect(() => {
        setVisibleCount(BATCH_SIZE);
    }, [files, isMobile]);

    useEffect(() => {
        if (!loaderRef.current) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setVisibleCount(v =>
                        Math.min(v + BATCH_SIZE, files.length)
                    );
                }
            },
            { rootMargin: '200px' }
        );

        observer.observe(loaderRef.current);
        return () => observer.disconnect();
    }, [files.length, isMobile]);

    const visibleFiles = files.slice(0, visibleCount);

    /* =========================
       DETAILS MODAL
       ========================= */

    const [detailsFile, setDetailsFile] = useState(null);

    const closeDetails = () => setDetailsFile(null);

    const handleDeleteClick = (fileId) => {
        setDialogOpen('delete');
        setSelectedFiles([fileId]);
    };

    /* =========================
       RENDER
       ========================= */

    return (
        <>
            {/* ================= GRID ================= */}
            <Box sx={{ flex: 1, overflowY: 'auto', px: isMobile ? 1 : 2, pb: 2 }}>
                <Grid container spacing={isMobile ? 1 : 2}>
                    {visibleFiles.map(file => {
                        const videoInfo = extractVideoInfo(file);
                        const nameInfo = extractFileNameInfo(file.fileName);

                        const isSelected = selectedFiles.includes(file.id);
                        const isHDR = Boolean(videoInfo.hdr);
                        const isDolbyVision =
                            videoInfo.hdr?.toLowerCase().includes('dolby') ||
                            videoInfo.hdr?.toLowerCase().includes('dv');

                        return (
                            <Grid item xs={12} sm={6} md={4} lg={3} key={file.id}>
                                <motion.div
                                    initial={{ opacity: 0, y: 16 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.25 }}
                                    whileHover={{ y: -4 }}
                                >
                                    <Card
                                        sx={{
                                            height: CARD_HEIGHT,
                                            display: 'flex',
                                            flexDirection: 'column',
                                            borderRadius: 2.5,
                                            border: isSelected
                                                ? `2px solid ${theme.palette.primary.main}`
                                                : `1px solid ${theme.palette.divider}`,
                                            boxShadow: isSelected ? 4 : 1,
                                            transition: 'all 0.25s',
                                            '&:hover': { boxShadow: 6 }
                                        }}
                                    >
                                        {/* ===== CONTENT ===== */}
                                        <CardContent sx={{ p: 2, flexGrow: 1 }}>
                                            <Box sx={{ display: 'flex', gap: 1 }}>
                                                <VideoIcon color="primary" fontSize="small" />

                                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                                    <Typography
                                                        variant="subtitle2"
                                                        noWrap
                                                        fontWeight={600}
                                                    >
                                                        {nameInfo.title}
                                                    </Typography>
                                                    <Typography
                                                        variant="caption"
                                                        color="text.secondary"
                                                        noWrap
                                                    >
                                                        {nameInfo.episode && `${nameInfo.episode} • `}
                                                        {nameInfo.quality}
                                                    </Typography>
                                                </Box>

                                                <Checkbox
                                                    size="small"
                                                    checked={isSelected}
                                                    onChange={(e) =>
                                                        handleFileSelect(file.id, e.target.checked)
                                                    }
                                                    sx={{ p: 0.5 }}
                                                />
                                            </Box>

                                            {/* ===== BADGES ===== */}
                                            <Box
                                                sx={{
                                                    mt: 1,
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center'
                                                }}
                                            >
                                                <Chip
                                                    label={videoInfo.resolution}
                                                    size="small"
                                                    sx={{ fontSize: '0.7rem', height: 20 }}
                                                />

                                                {isHDR && (
                                                    <Box
                                                        sx={{
                                                            px: 1,
                                                            py: 0.25,
                                                            borderRadius: 1,
                                                            fontSize: '0.6rem',
                                                            fontWeight: 700,
                                                            color: '#fff',
                                                            background: isDolbyVision
                                                                ? 'linear-gradient(135deg,#7b2ff7,#00c6ff)'
                                                                : 'linear-gradient(135deg,#ff9800,#ffc107)'
                                                        }}
                                                    >
                                                        {isDolbyVision ? 'DOLBY VISION' : 'HDR'}
                                                    </Box>
                                                )}
                                            </Box>

                                            {/* ===== META ===== */}
                                            <Box sx={{ mt: 1, display: 'grid', gap: 0.5 }}>
                                                <Meta icon={<PlayIcon />} text={videoInfo.duration} />
                                                <Meta icon={<SpeedIcon />} text={videoInfo.codec} />
                                                <Meta
                                                    icon={<AudioFile />}
                                                    text={`${videoInfo.audioCount} audio tracks`}
                                                />
                                            </Box>
                                        </CardContent>

                                        {/* ===== ACTIONS ===== */}
                                        <CardActions
                                            sx={{
                                                px: 1,
                                                py: 0.75,
                                                borderTop: `1px dashed ${alpha(theme.palette.divider, 0.8)}`
                                            }}
                                        >
                                            <Action
                                                title="Copy Path"
                                                icon={<CopyIcon />}
                                                onClick={() => handleCopyPath(file.filePath)}
                                            />
                                            <Action
                                                title="Download"
                                                icon={<DownloadIcon />}
                                                onClick={() =>
                                                    handleDownloadFile(file.filePath, file.fileName)
                                                }
                                            />
                                            <Action
                                                title="Delete"
                                                icon={<DeleteIcon />}
                                                color="error"
                                                onClick={() => handleDeleteClick(file.id)}
                                            />

                                            <Box sx={{ flexGrow: 1 }} />

                                            <Action
                                                title="View details"
                                                icon={<OpenIcon />}
                                                onClick={() => setDetailsFile(file)}
                                            />
                                        </CardActions>
                                    </Card>
                                </motion.div>
                            </Grid>
                        );
                    })}
                </Grid>

                {/* ===== INFINITE LOADER ===== */}
                <Box
                    ref={loaderRef}
                    sx={{
                        height: 56,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                >
                    {visibleCount < files.length && <CircularProgress size={22} />}
                </Box>
            </Box>

            {/* ================= DETAILS MODAL ================= */}
            <AnimatePresence>
                {detailsFile && (
                    <Dialog
                        open
                        onClose={closeDetails}
                        maxWidth="md"
                        fullWidth
                        scroll="paper"
                        PaperProps={{
                            component: motion.div,
                            initial: { opacity: 0, scale: 0.95 },
                            animate: { opacity: 1, scale: 1 },
                            exit: { opacity: 0, scale: 0.9 }
                        }}
                    >
                        <DialogTitle sx={{ pr: 5 }}>
                            Media Details
                            <IconButton
                                onClick={closeDetails}
                                sx={{ position: 'absolute', right: 8, top: 8 }}
                            >
                                <CloseIcon />
                            </IconButton>
                        </DialogTitle>

                        <Divider />

                        <DialogContent dividers>
                            {renderFileDetails(detailsFile)}
                        </DialogContent>
                    </Dialog>
                )}
            </AnimatePresence>
        </>
    );
};

/* =========================
   SMALL HELPERS
   ========================= */

const Meta = ({ icon, text }) => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        {React.cloneElement(icon, { fontSize: 'small', color: 'action' })}
        <Typography variant="caption">{text}</Typography>
    </Box>
);

const Action = ({ title, icon, onClick, color }) => (
    <Tooltip title={title}>
        <IconButton size="small" color={color} onClick={onClick}>
            {icon}
        </IconButton>
    </Tooltip>
);

export default MediaGridView;
