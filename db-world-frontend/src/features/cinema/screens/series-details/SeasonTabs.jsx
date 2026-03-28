import React, { useState } from 'react';
import {
    Box,
    Tabs,
    Tab,
    Grid,
    Typography,
    Chip,
    useTheme,
    useMediaQuery,
    Skeleton
} from '@mui/material';
import PropTypes from 'prop-types';

const SeasonTabs = ({ seasons, loading = false }) => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const [activeSeasonTab, setActiveSeasonTab] = useState(0);
    const [loadedImages, setLoadedImages] = useState({});

    const handleSeasonTabChange = (event, newValue) => {
        setActiveSeasonTab(newValue);
    };

    const handleImageLoad = (index) => {
        setLoadedImages(prev => ({ ...prev, [index]: true }));
    };

    const handleImageError = (index) => {
        setLoadedImages(prev => ({ ...prev, [index]: true })); // Still mark as loaded to hide skeleton
    };

    if (loading) {
        return (
            <Box sx={{ mt: 4 }}>
                <Skeleton variant="text" width="30%" height={40} sx={{ mb: 2 }} />
                <Box sx={{ display: 'flex', gap: 2, mb: 3, overflow: 'hidden' }}>
                    {[0, 1, 2].map((item) => (
                        <Skeleton key={item} variant="rounded" width={100} height={36} />
                    ))}
                </Box>
                <Grid container spacing={2}>
                    <Grid item xs={12} md={4}>
                        <Skeleton
                            variant="rounded"
                            width="100%"
                            height={isMobile ? 200 : 400}
                            sx={{ aspectRatio: '2/3' }}
                        />
                    </Grid>
                    <Grid item xs={12} md={8}>
                        <Skeleton variant="text" width="60%" height={40} />
                        <Skeleton variant="text" width="100%" height={24} sx={{ mt: 1 }} />
                        <Skeleton variant="text" width="100%" height={24} />
                        <Skeleton variant="text" width="80%" height={24} />
                        <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                            <Skeleton variant="rounded" width={80} height={32} />
                            <Skeleton variant="rounded" width={120} height={32} />
                        </Box>
                    </Grid>
                </Grid>
            </Box>
        );
    }

    if (!seasons || !Array.isArray(seasons)) {
        return (
            <Box sx={{ mt: 4 }}>
                <Typography variant="h6" color="text.secondary">
                    No season information available
                </Typography>
            </Box>
        );
    }

    return (
        <Box sx={{ mt: 4 }}>
            <Typography variant="h5" component="h2" gutterBottom>
                Seasons
            </Typography>

            <Tabs
                value={activeSeasonTab}
                onChange={handleSeasonTabChange}
                variant={isMobile ? 'scrollable' : 'standard'}
                scrollButtons="auto"
                allowScrollButtonsMobile
                sx={{
                    mb: 2,
                    '& .MuiTabs-indicator': {
                        backgroundColor: theme.palette.primary.main,
                    },
                }}
            >
                {seasons.map((season, index) => (
                    <Tab
                        key={season?.id || index}
                        label={`Season ${season?.season_number || index + 1}`}
                        sx={{
                            color: activeSeasonTab === index ?
                                theme.palette.primary.main :
                                theme.palette.text.secondary,
                            minWidth: 'unset',
                            px: 2,
                            textTransform: 'none'
                        }}
                    />
                ))}
            </Tabs>

            {seasons.map((season, index) => (
                <Box
                    key={season?.id || index}
                    sx={{ display: index === activeSeasonTab ? 'block' : 'none' }}
                >
                    <Grid container spacing={2}>
                        {/* Poster Image Column */}
                        <Grid item xs={12} md={4}>
                            <Box sx={{
                                position: 'relative',
                                width: '100%',
                                borderRadius: 2,
                                overflow: 'hidden',
                                aspectRatio: '2/3',
                                boxShadow: theme.shadows[4],
                                bgcolor: theme.palette.grey[900] // Fallback background
                            }}>
                                {!loadedImages[index] && (
                                    <Skeleton
                                        variant="rectangular"
                                        width="100%"
                                        height="100%"
                                        sx={{ position: 'absolute' }}
                                    />
                                )}
                                <Box
                                    component="img"
                                    src={
                                        season?.poster_path
                                            ? `https://image.tmdb.org/t/p/w300${season.poster_path}`
                                            : '/placeholder-poster.jpg'
                                    }
                                    alt={season?.name || `Season ${season?.season_number || index + 1}`}
                                    sx={{
                                        width: '100%',
                                        height: '100%',
                                        objectFit: 'cover',
                                        display: 'block',
                                        opacity: loadedImages[index] ? 1 : 0,
                                        transition: 'opacity 0.3s ease'
                                    }}
                                    onLoad={() => handleImageLoad(index)}
                                    onError={() => handleImageError(index)}
                                />
                            </Box>
                        </Grid>

                        {/* Season Content Column */}
                        <Grid item xs={6} md={4}>
                            <Typography variant="h6" gutterBottom>
                                {season?.name || `Season ${season?.season_number || index + 1}`}
                            </Typography>

                            <Typography
                                variant="body2"
                                paragraph
                                sx={{
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-word',
                                    color: theme.palette.text.secondary
                                }}
                            >
                                {season?.overview || 'No season overview available'}
                            </Typography>

                            <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                                {season?.episode_count && (
                                    <Chip
                                        label={`${season.episode_count} Episode${season.episode_count !== 1 ? 's' : ''}`}
                                        size="small"
                                        sx={{ bgcolor: theme.palette.grey[800] }}
                                    />
                                )}
                                {season?.air_date && (
                                    <Chip
                                        label={`Aired: ${new Date(season.air_date).toLocaleDateString()}`}
                                        size="small"
                                        sx={{ bgcolor: theme.palette.grey[800] }}
                                    />
                                )}
                                {season?.vote_average > 0 && (
                                    <Chip
                                        label={`Rating: ${season.vote_average.toFixed(1)}`}
                                        size="small"
                                        sx={{ bgcolor: theme.palette.grey[800] }}
                                    />
                                )}
                            </Box>
                        </Grid>
                    </Grid>
                </Box>
            ))}
        </Box>
    );
};

SeasonTabs.propTypes = {
    seasons: PropTypes.arrayOf(
        PropTypes.shape({
            id: PropTypes.number,
            name: PropTypes.string,
            overview: PropTypes.string,
            poster_path: PropTypes.string,
            season_number: PropTypes.number,
            air_date: PropTypes.string,
            episode_count: PropTypes.number,
            vote_average: PropTypes.number
        })
    ),
    loading: PropTypes.bool
};

export default SeasonTabs;