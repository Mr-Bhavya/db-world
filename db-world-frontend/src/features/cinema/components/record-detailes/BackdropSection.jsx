import { Box, Chip, Grid, Typography, useTheme, useMediaQuery } from '@mui/material';
import { motion, useScroll, useTransform } from "framer-motion";
import Reaction from '../../icons/reaction';
import Watchlist from '../../icons/watchlist';
import Watched from '../../icons/watched';
import Download from '../../icons/download';
import { Backdrop, BackdropImage, HeaderContent } from './CustomComponents';

const BackdropSection = ({ record }) => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    const { scrollY } = useScroll();
    const backdropY = useTransform(scrollY, [0, 300], [0, 100]);
    const backdropOpacity = useTransform(scrollY, [0, 300], [1, 0.5]);

    // Safely get tmdb data whether it's movie or series
    const tmdb = record?.tmdb || record?.movieTmdb || record?.seriesTmdb || {};
    const isSeries = record?.type?.toLowerCase() === 'series';
    
    // Get appropriate runtime/duration display
    const getRuntimeDisplay = () => {
        if (isSeries) {
            return `${tmdb.number_of_seasons} Season${tmdb.number_of_seasons !== 1 ? 's' : ''} • ${tmdb.number_of_episodes} Episode${tmdb.number_of_episodes !== 1 ? 's' : ''}`;
        }
        return tmdb.runtime ? `${tmdb.runtime} mins` : null;
    };

    // Get appropriate release/air date display
    const getDateDisplay = () => {
        if (isSeries) {
            const firstAir = tmdb.first_air_date;
            const lastAir = tmdb.last_air_date;
            if (firstAir && lastAir) {
                return `${firstAir.split('-')[0]} - ${lastAir.split('-')[0]}`;
            }
            return firstAir || 'N/A';
        }
        return tmdb.release_date;
    };

    return (
        <Backdrop
            style={{
                y: backdropY,
                opacity: backdropOpacity
            }}
        >
            {tmdb.backdrop_path && (
                <BackdropImage
                    style={{
                        backgroundImage: `url(https://image.tmdb.org/t/p/original${tmdb.backdrop_path})`,
                    }}
                />
            )}
            <HeaderContent>
                <Grid container spacing={3} alignItems="flex-end">
                    {!isMobile && (
                        <Grid item xs={12} md="auto">
                            <motion.img
                                src={`https://image.tmdb.org/t/p/w500${tmdb.poster_path || tmdb.backdrop_path}`}
                                alt={tmdb.title || tmdb.name}
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
                            {tmdb.title || tmdb.name}
                        </Typography>
                        {tmdb.tagline && (
                            <Typography variant="subtitle1" sx={{ fontStyle: 'italic', mb: 2 }}>
                                "{tmdb.tagline}"
                            </Typography>
                        )}
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                            {getDateDisplay() && (
                                <Chip label={isSeries ? `Aired: ${getDateDisplay()}` : `Released: ${getDateDisplay()}`} size="small" />
                            )}
                            {getRuntimeDisplay() && (
                                <Chip label={getRuntimeDisplay()} size="small" />
                            )}
                            {tmdb.vote_average > 0 && (
                                <Chip label={`Rating: ${tmdb.vote_average.toFixed(1)}/10`} size="small" />
                            )}
                            {isSeries && tmdb.status && (
                                <Chip label={tmdb.status} size="small" />
                            )}
                        </Box>
                        <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
                            {record?.recordId && (
                                <>
                                    <Reaction 
                                        isLiked={record?.isLiked} 
                                        recordId={record.recordId} 
                                        size="medium"
                                    />
                                    <Watchlist 
                                        isAddedToWatchList={record?.isWatchListed} 
                                        recordId={record.recordId}
                                        size="medium"
                                    />
                                    <Watched 
                                        isWatched={record?.isWatched} 
                                        recordId={record.recordId}
                                        size="medium"
                                    />
                                    <Download 
                                        record={record} 
                                        size="medium" 
                                        mode="navigate" 
                                        tooltip="View download options"
                                    />
                                </>
                            )}
                        </Box>
                    </Grid>
                </Grid>
            </HeaderContent>
        </Backdrop>
    );
}

export default BackdropSection;