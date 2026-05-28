import React, { useState } from 'react';
import { Box, Chip, Grid, Typography, Button, IconButton, Tooltip, useTheme, useMediaQuery } from '@mui/material';
import { motion, useScroll, useTransform } from "framer-motion";
import {
  PlayArrow, BookmarkAdd, BookmarkAdded,
  ThumbUp, ThumbUpOutlined, Favorite, FavoriteBorder,
  Visibility, VisibilityOff } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import {
  addWatchlist, removeWatchlist,
  addLike, removeLike,
  addLove, removeLove,
  addWatched, removeWatched,
} from '../../api/cinemaApi';
import Constants from '@shared/constants';
import { Backdrop, BackdropImage, HeaderContent } from './CustomComponents';

// ─── Interaction hook (local optimistic state) ────────────────────────────────

function useLocalInteraction(record) {
    const [watchlisted, setWatchlisted] = useState(record?.isWatchListed ?? false);
    const [liked,       setLiked]       = useState(record?.isLiked ?? false);
    const [loved,       setLoved]       = useState(record?.isLoved ?? false);
    const [watched,     setWatched]     = useState(record?.isWatched ?? false);

    const makeToggle = (current, setter, addFn, removeFn) => async () => {
        setter(!current);
        try { await (current ? removeFn(record.id) : addFn(record.id)); }
        catch { setter(current); }
    };

    return {
        watchlisted, liked, loved, watched,
        toggleWatchlist: makeToggle(watchlisted, setWatchlisted, addWatchlist, removeWatchlist),
        toggleLike:      makeToggle(liked,       setLiked,       addLike,      removeLike),
        toggleLove:      makeToggle(loved,       setLoved,       addLove,      removeLove),
        toggleWatched:   makeToggle(watched,     setWatched,     addWatched,   removeWatched),
    };
}

// ─── Small circle icon button (matches HoverPopup style) ─────────────────────

const IBtn = ({ icon, activeIcon, active, tooltip, onClick }) => (
    <Tooltip title={tooltip} PopperProps={{ style: { zIndex: 1400 } }}>
        <IconButton
            onClick={onClick}
            size="medium"
            sx={{
                border: `1.5px solid ${active ? 'rgba(255,255,255,.9)' : 'rgba(255,255,255,.45)'}`,
                color: active ? '#fff' : 'rgba(255,255,255,.8)',
                bgcolor: active ? 'rgba(255,255,255,.12)' : 'transparent',
                p: 1,
                transition: 'all 0.15s',
                '&:hover': { borderColor: '#fff', bgcolor: 'rgba(255,255,255,.1)' },
            }}
        >
            {active ? activeIcon : icon}
        </IconButton>
    </Tooltip>
);

// ─────────────────────────────────────────────────────────────────────────────

const BackdropSection = ({ record }) => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const navigate = useNavigate();
    const ix = useLocalInteraction(record);

    const { scrollY } = useScroll();
    const backdropY = useTransform(scrollY, [0, 300], [0, 100]);
    const backdropOpacity = useTransform(scrollY, [0, 300], [1, 0.5]);

    // Safely get tmdb data whether it's movie or series
    const tmdb = record?.tmdb || record?.movieTmdb || record?.seriesTmdb || {};
    const isSeries = record?.type?.toLowerCase() === 'series';
    
    // Get appropriate runtime/duration display
    const getRuntimeDisplay = () => {
        if (isSeries) {
            const seasons = tmdb.numberOfSeasons ?? tmdb.number_of_seasons;
            const episodes = tmdb.numberOfEpisodes ?? tmdb.number_of_episodes;
            if (!seasons && !episodes) return null;
            return `${seasons ?? '?'} Season${seasons !== 1 ? 's' : ''} • ${episodes ?? '?'} Episode${episodes !== 1 ? 's' : ''}`;
        }
        return tmdb.runtime ? `${tmdb.runtime} mins` : null;
    };

    // Get appropriate release/air date display
    const getDateDisplay = () => {
        if (isSeries) {
            const firstAir = tmdb.firstAirDate ?? tmdb.first_air_date;
            const lastAir = tmdb.lastAirDate ?? tmdb.last_air_date;
            if (firstAir && lastAir) {
                return `${String(firstAir).split('-')[0]} - ${String(lastAir).split('-')[0]}`;
            }
            return firstAir || 'N/A';
        }
        return tmdb.releaseDate ?? tmdb.release_date;
    };

    return (
        <Backdrop
            style={{
                y: backdropY,
                opacity: backdropOpacity
            }}
        >
            {(tmdb.backdropPath ?? tmdb.backdrop_path) && (
                <BackdropImage
                    style={{
                        backgroundImage: `url(https://image.tmdb.org/t/p/original${tmdb.backdropPath ?? tmdb.backdrop_path})`,
                    }}
                />
            )}
            <HeaderContent>
                <Grid container spacing={3} alignItems="flex-end">
                    {!isMobile && (
                        <Grid item xs={12} md="auto">
                            <motion.img
                                src={`https://image.tmdb.org/t/p/w500${tmdb.posterPath ?? tmdb.poster_path ?? tmdb.backdropPath ?? tmdb.backdrop_path}`}
                                alt={tmdb.title ?? tmdb.name}
                                style={{
                                    width: '100%',
                                    maxWidth: 300,
                                    height: 'auto',
                                    objectFit: 'contain',
                                    borderRadius: theme.shape.borderRadius,
                                    boxShadow: theme.shadows[10],
                                }}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.5 }}
                                onError={(e) => {
                                    e.target.src = '/placeholder-poster.jpg';
                                }}
                            />
                        </Grid>
                    )}
                    <Grid item xs={12} md>
                        <Typography
                            variant="h3"
                            sx={{
                                fontWeight: 'bold',
                                fontSize: isMobile ? '1.5rem' : '2.5rem',
                                mb: 1
                            }}
                        >
                            {tmdb.title ?? tmdb.name}
                        </Typography>
                        {tmdb.tagline && (
                            <Typography variant="subtitle1" sx={{ fontStyle: 'italic', mb: 2 }}>
                                &quot;{tmdb.tagline}&quot;
                            </Typography>
                        )}
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                            {getDateDisplay() && (
                                <Chip label={isSeries ? `Aired: ${getDateDisplay()}` : `Released: ${getDateDisplay()}`} size="small" />
                            )}
                            {getRuntimeDisplay() && (
                                <Chip label={getRuntimeDisplay()} size="small" />
                            )}
                            {(tmdb.voteAverage ?? tmdb.vote_average) > 0 && (
                                <Chip label={`Rating: ${(tmdb.voteAverage ?? tmdb.vote_average).toFixed(1)}/10`} size="small" />
                            )}
                            {isSeries && tmdb.status && (
                                <Chip label={tmdb.status} size="small" />
                            )}
                        </Box>
                        {record?.id && (
                            <Box sx={{ display: 'flex', gap: 1.2, mt: 2.5, flexWrap: 'wrap', alignItems: 'center' }}>
                                {/* Play */}
                                <Button
                                    variant="contained"
                                    startIcon={<PlayArrow />}
                                    onClick={() => navigate(Constants.DB_RECORD_MEDIA_FILES_ROUTE.replace(':recordId', record.id))}
                                    sx={{
                                        bgcolor: '#fff', color: '#000', fontWeight: 700,
                                        fontSize: '0.95rem', px: 3, py: 1.1, borderRadius: 2,
                                        textTransform: 'none',
                                        '&:hover': { bgcolor: 'rgba(255,255,255,.85)' },
                                    }}
                                >
                                    Play
                                </Button>

                                {/* Watchlist */}
                                <IBtn
                                    icon={<BookmarkAdd />}
                                    activeIcon={<BookmarkAdded sx={{ color: '#46d369' }} />}
                                    active={ix.watchlisted}
                                    tooltip={ix.watchlisted ? 'Remove from My List' : 'Add to My List'}
                                    onClick={ix.toggleWatchlist}
                                />

                                {/* Like */}
                                <IBtn
                                    icon={<ThumbUpOutlined />}
                                    activeIcon={<ThumbUp />}
                                    active={ix.liked}
                                    tooltip={ix.liked ? 'Unlike' : 'Like'}
                                    onClick={ix.toggleLike}
                                />

                                {/* Love */}
                                <IBtn
                                    icon={<FavoriteBorder />}
                                    activeIcon={<Favorite sx={{ color: '#e50914' }} />}
                                    active={ix.loved}
                                    tooltip={ix.loved ? 'Remove from Favourites' : 'Love it'}
                                    onClick={ix.toggleLove}
                                />

                                {/* Watched */}
                                <IBtn
                                    icon={<VisibilityOff />}
                                    activeIcon={<Visibility sx={{ color: '#a5d6a7' }} />}
                                    active={ix.watched}
                                    tooltip={ix.watched ? 'Mark as Unwatched' : 'Mark as Watched'}
                                    onClick={ix.toggleWatched}
                                />
                            </Box>
                        )}
                    </Grid>
                </Grid>
            </HeaderContent>
        </Backdrop>
    );
}

export default BackdropSection;