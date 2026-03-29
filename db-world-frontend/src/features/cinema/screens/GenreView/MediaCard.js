import React, { useState, useMemo } from 'react';
import {
    Box,
    CircularProgress,
    Typography,
    Chip,
    IconButton,
    useTheme,
    useMediaQuery,
    alpha,
    Card,
    CardMedia,
    CardContent,
    Rating,
    Tooltip
} from '@mui/material';
import {
    PlayArrow,
    Star,
    CalendarToday,
    Theaters,
    LiveTv,
    Language,
    AccessTime
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import Constants from '@shared/constants';

const MediaCard = ({ record, onClick, index }) => {
    const theme = useTheme();
    const [imageLoaded, setImageLoaded] = useState(false);
    const [imageError, setImageError] = useState(false);
    
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'md'));

    const normalizedRecord = useMemo(() => ({
        ...record,
        tmdb: record.movieTmdb || record.seriesTmdb || record.tmdb || {},
        type: record.type || (record.movieTmdb ? Constants.RECORD_TYPE_MOVIE : Constants.RECORD_TYPE_SERIES),
        title: record.name || record.title || "Unknown Title",
        rating: record.tmdb?.vote_average || record.rating || 0,
        year: record.tmdb?.release_date?.split("-")[0] || record.releaseYear || "N/A",
        language: record.tmdb?.original_language || "en",
        runtime: record.tmdb?.runtime || null,
        voteCount: record.tmdb?.vote_count || 0,
    }), [record]);

    const getImageUrl = () => {
        if (imageError)
            return "https://via.placeholder.com/300x450/333/fff?text=No+Image";

        const posterPath = normalizedRecord.tmdb?.poster_path || record.poster_path;

        return posterPath
            ? `https://image.tmdb.org/t/p/w500${posterPath}`
            : record.thumbnailUrl || "https://via.placeholder.com/300x450/333/fff?text=No+Image";
    };

    const isMovie = normalizedRecord.type?.toLowerCase() === Constants.RECORD_TYPE_MOVIE;

    const formatRuntime = (minutes) => {
        if (!minutes) return null;
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours}h ${mins}m`;
    };

    const getLanguageName = (code) => {
        const map = {
            en: "EN", es: "ES", fr: "FR", de: "DE", 
            ja: "JA", ko: "KO", zh: "CN", hi: "HI",
        };
        return map[code] || code?.toUpperCase();
    };

    const getQualityBadge = () => {
        if (normalizedRecord.rating >= 8) return { label: "Exc", color: "success" };
        if (normalizedRecord.rating >= 7) return { label: "Great", color: "primary" };
        if (normalizedRecord.rating >= 6) return { label: "Good", color: "warning" };
        return null;
    };

    const qualityBadge = getQualityBadge();

    // Calculate if we have space for additional info
    const showAdditionalInfo = !isMobile && normalizedRecord.title.length < 25;

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.03 }}
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.98 }}
            style={{ 
                width: isMobile ? '150px' : isTablet ? '170px' : '190px',
                margin: '4px'
            }}
        >
            <Tooltip
                title={
                    <Box sx={{ p: 1, maxWidth: 280 }}>
                        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                            {normalizedRecord.title}
                        </Typography>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                            <Rating value={normalizedRecord.rating / 2} readOnly size="small" />
                            <Typography variant="body2" fontWeight={600}>
                                {normalizedRecord.rating.toFixed(1)}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                ({normalizedRecord.voteCount} votes)
                            </Typography>
                        </Box>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                            {isMovie ? "Movie" : "TV Series"} • {normalizedRecord.year}
                        </Typography>
                        {normalizedRecord.tmdb?.overview && (
                            <Typography variant="caption" color="text.secondary">
                                {normalizedRecord.tmdb.overview.slice(0, 100)}...
                            </Typography>
                        )}
                    </Box>
                }
                arrow
                placement="top"
            >
                <Card
                    onClick={onClick}
                    sx={{
                        width: "100%",
                        height: isMobile ? '260px' : isTablet ? '300px' : '340px',
                        cursor: "pointer",
                        background: theme.palette.background.paper,
                        border: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
                        borderRadius: '10px',
                        overflow: "hidden",
                        position: "relative",
                        transition: "all 0.25s ease",
                        "&:hover": {
                            boxShadow: `0 8px 25px ${alpha(theme.palette.primary.main, 0.3)}`,
                            borderColor: theme.palette.primary.main,
                        },
                    }}
                >
                    {/* Quality Badge */}
                    {qualityBadge && (
                        <Chip
                            label={qualityBadge.label}
                            size="small"
                            color={qualityBadge.color}
                            sx={{
                                position: "absolute",
                                top: 6,
                                left: 6,
                                zIndex: 10,
                                fontSize: "0.6rem",
                                fontWeight: 700,
                                height: 20,
                                backdropFilter: 'blur(10px)',
                            }}
                        />
                    )}

                    {/* Type Badge */}
                    <Chip
                        icon={isMovie ? <Theaters sx={{ fontSize: '14px' }} /> : <LiveTv sx={{ fontSize: '14px' }} />}
                        label={isMovie ? "MOV" : "TV"}
                        size="small"
                        sx={{
                            position: "absolute",
                            top: 6,
                            right: 6,
                            zIndex: 10,
                            fontSize: "0.6rem",
                            background: alpha(theme.palette.background.paper, 0.9),
                            backdropFilter: 'blur(10px)',
                            height: 20,
                            fontWeight: 600,
                        }}
                    />

                    {/* Image - Larger proportion */}
                    <Box sx={{ 
                        position: "relative", 
                        width: "100%", 
                        height: isMobile ? '180px' : isTablet ? '210px' : '240px',
                        overflow: 'hidden'
                    }}>
                        <CardMedia
                            component="img"
                            src={getImageUrl()}
                            alt={normalizedRecord.title}
                            onLoad={() => setImageLoaded(true)}
                            onError={() => {
                                setImageError(true);
                                setImageLoaded(true);
                            }}
                            sx={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                                filter: imageLoaded ? "none" : "blur(8px)",
                                opacity: imageLoaded ? 1 : 0.7,
                                transition: "all 0.3s ease",
                            }}
                        />

                        {!imageLoaded && (
                            <Box
                                sx={{
                                    position: "absolute",
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    bottom: 0,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    background: theme.palette.background.default,
                                }}
                            >
                                <CircularProgress size={20} />
                            </Box>
                        )}

                        {/* Hover overlay */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            whileHover={{ opacity: 1 }}
                            style={{
                                position: "absolute",
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                background: alpha(theme.palette.common.black, 0.7),
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            <IconButton
                                sx={{
                                    background: theme.palette.primary.main,
                                    color: "white",
                                    width: 44,
                                    height: 44,
                                    '&:hover': {
                                        background: theme.palette.primary.dark,
                                        transform: 'scale(1.1)',
                                    },
                                    transition: 'all 0.2s ease',
                                }}
                            >
                                <PlayArrow />
                            </IconButton>
                        </motion.div>
                    </Box>

                    {/* Content - Dynamic height based on available space */}
                    <CardContent
                        sx={{
                            p: 1.5,
                            pb: '12px !important',
                            height: isMobile ? '80px' : isTablet ? '90px' : '100px',
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "space-between",
                            gap: 0.5,
                        }}
                    >
                        {/* Title - Flexible height */}
                        <Typography
                            variant="subtitle2"
                            sx={{
                                fontWeight: 600,
                                lineHeight: 1.3,
                                height: showAdditionalInfo ? '2.2em' : '2.6em',
                                overflow: "hidden",
                                display: "-webkit-box",
                                WebkitLineClamp: showAdditionalInfo ? 2 : 3,
                                WebkitBoxOrient: "vertical",
                                fontSize: isMobile ? '0.8rem' : '0.85rem',
                                flex: 1,
                            }}
                        >
                            {normalizedRecord.title}
                        </Typography>

                        {/* Main Info Row */}
                        <Box sx={{ 
                            display: "flex", 
                            alignItems: "center", 
                            justifyContent: "space-between",
                            gap: 1
                        }}>
                            {/* Rating */}
                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexShrink: 0 }}>
                                <Star sx={{ 
                                    fontSize: isMobile ? 12 : 14, 
                                    color: "warning.main" 
                                }} />
                                <Typography 
                                    variant="caption" 
                                    fontWeight={600}
                                    sx={{ fontSize: isMobile ? '0.7rem' : '0.75rem' }}
                                >
                                    {normalizedRecord.rating > 0 ? normalizedRecord.rating.toFixed(1) : 'NR'}
                                </Typography>
                            </Box>

                            {/* Year */}
                            <Typography 
                                variant="caption" 
                                color="text.secondary"
                                sx={{ 
                                    fontSize: isMobile ? '0.7rem' : '0.75rem',
                                    flexShrink: 0
                                }}
                            >
                                {normalizedRecord.year}
                            </Typography>

                            {/* Additional Info - Only show when there's space */}
                            {showAdditionalInfo && normalizedRecord.runtime && (
                                <Box sx={{ 
                                    display: "flex", 
                                    alignItems: "center", 
                                    gap: 0.25,
                                    flexShrink: 0
                                }}>
                                    <AccessTime sx={{ fontSize: 10, color: "text.secondary" }} />
                                    <Typography 
                                        variant="caption" 
                                        color="text.secondary"
                                        sx={{ fontSize: '0.65rem' }}
                                    >
                                        {formatRuntime(normalizedRecord.runtime)}
                                    </Typography>
                                </Box>
                            )}
                        </Box>

                        {/* Second Row - Additional details when space available */}
                        {showAdditionalInfo && (
                            <Box sx={{ 
                                display: "flex", 
                                alignItems: "center", 
                                justifyContent: "space-between",
                                gap: 1
                            }}>
                                {/* Language */}
                                <Box sx={{ display: "flex", alignItems: "center", gap: 0.25 }}>
                                    <Language sx={{ fontSize: 10, color: "text.secondary" }} />
                                    <Typography 
                                        variant="caption" 
                                        color="text.secondary"
                                        sx={{ fontSize: '0.65rem' }}
                                    >
                                        {getLanguageName(normalizedRecord.language)}
                                    </Typography>
                                </Box>

                                {/* Votes count when available */}
                                {normalizedRecord.voteCount > 0 && (
                                    <Typography 
                                        variant="caption" 
                                        color="text.secondary"
                                        sx={{ fontSize: '0.65rem' }}
                                    >
                                        {normalizedRecord.voteCount > 1000 
                                            ? `${(normalizedRecord.voteCount / 1000).toFixed(1)}k` 
                                            : normalizedRecord.voteCount
                                        } votes
                                    </Typography>
                                )}
                            </Box>
                        )}
                    </CardContent>
                </Card>
            </Tooltip>
        </motion.div>
    );
};

export default MediaCard;