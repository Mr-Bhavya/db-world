import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSwipeable } from 'react-swipeable';
import requests from '../services/requests';
import Constants from '@shared/constants';
import { loadCoverRecords, removeWatchlistRecord, watchlistRecord } from '@shared/services/ApiServices';
import CommonServices from '@shared/services/CommonServices';

// MUI Components
import {
  Box,
  Button,
  IconButton,
  Typography,
  Chip,
  useTheme,
  useMediaQuery,
  alpha,
  Tooltip,
  styled
} from '@mui/material';
import {
  ChevronLeft as PrevIcon,
  ChevronRight as NextIcon,
  Download,
  Add,
  Check,
  PlayArrow,
  Info,
  Star,
  Theaters,
  LiveTv
} from '@mui/icons-material';

// Framer Motion
import { motion, AnimatePresence } from 'framer-motion';
import CoverSkeleton from './CoverSkeleton';

// Constants
const AUTO_CYCLE_INTERVAL = 5000;

// Styled Components
const CoverContainer = styled(Box)(({ theme }) => ({
  position: 'relative',
  width: '100%',
  backgroundColor: 'var(--navbar-bg-color)',
  zIndex: 900,
  overflow: 'hidden',
}));

const CoverMain = styled(Box)(({ theme, ismobile }) => ({
  position: 'relative',
  display: 'flex',
  backgroundSize: 'cover',
  backgroundPosition: 'center center',
  height: ismobile === 'true' ? '40vh' : '80vh',
  minHeight: ismobile === 'true' ? '568px' : '900px',
  maxHeight: '100vh',
  overflow: 'hidden',
  marginLeft: ismobile === 'true' ? '30px' : '0px',
  marginRight: ismobile === 'true' ? '30px' : '0px',

  [theme.breakpoints.down('md')]: {
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(0),
    border: '1px solid white',
    borderRadius: '15px',
    boxShadow: theme.shadows[8],
    height: 'calc(100% - 100px)'
  }
}));

const CoverControls = styled(Box)(({ theme }) => ({
  position: 'absolute',
  bottom: '30px',
  right: '20px',
  display: 'flex',
  gap: '10px',
  zIndex: 3,

  [theme.breakpoints.down('md')]: {
    display: 'none'
  }
}));

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.5 } }
};

const slideVariants = {
  enter: (direction) => ({
    opacity: 0,
    x: direction > 0 ? 1000 : -1000
  }),
  center: {
    opacity: 1,
    x: 0,
    transition: {
      opacity: { duration: 0.5 },
      x: { type: "spring", stiffness: 300, damping: 30 }
    }
  },
  exit: (direction) => ({
    opacity: 0,
    x: direction < 0 ? 1000 : -1000,
    transition: { duration: 0.5 }
  })
};

// Combined Content Component
const CoverContent = ({ 
  record, 
  isWatchListed, 
  onToggleWatchlist, 
  navigateToDetails, 
  navigateToDownload,
  onPlayTrailer,
  isPlayingTrailer,
  hasTrailer,
  isMobile 
}) => {
  const theme = useTheme();
  const [isHovered, setIsHovered] = useState(false);

  const title = record?.tmdb?.title || record?.tmdb?.name || record?.tmdb?.original_name || 'Unknown Title';
  const overview = record?.tmdb?.overview || '';
  const rating = record?.tmdb?.vote_average || 0;
  const year = record?.tmdb?.release_date?.split('-')[0] || record?.tmdb?.first_air_date?.split('-')[0] || '';
  const isMovie = record?.type?.toLowerCase() === 'movie';

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0, y: isMobile ? 30 : 50 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        ease: "easeOut",
        staggerChildren: isMobile ? 0.05 : 0.15
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: isMobile ? 10 : 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.4,
        ease: "easeOut"
      }
    }
  };

  const buttonVariants = {
    hidden: { opacity: 0, scale: 0.9 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: {
        duration: 0.3,
        ease: "backOut"
      }
    },
    hover: {
      scale: 1.02,
      transition: {
        duration: 0.2
      }
    },
    tap: {
      scale: 0.98
    }
  };

  // Mobile Layout
  if (isMobile) {
    return (
      <Box
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        sx={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          background: `
            linear-gradient(0deg, 
              rgba(0,0,0,0.95) 0%, 
              rgba(0,0,0,0.8) 30%, 
              rgba(0,0,0,0.4) 70%, 
              transparent 100%
            )`,
          p: 3,
          // pt: 6,
          zIndex: 2,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'flex-end',
          backdropFilter: 'blur(5px)',
          // borderTop: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
        }}
      >
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          style={{ width: '100%' }}
        >
          {/* Media Info Badges */}
          {/* <motion.div variants={itemVariants} style={{ marginBottom: 12 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Chip
                icon={isMovie ? <Theaters sx={{ fontSize: 14 }} /> : <LiveTv sx={{ fontSize: 14 }} />}
                label={isMovie ? "MOVIE" : "TV"}
                size="small"
                sx={{
                  background: alpha(theme.palette.primary.main, 0.9),
                  color: 'white',
                  fontWeight: 'bold',
                  fontSize: '0.65rem',
                  height: 24
                }}
              />
              <Chip
                icon={<Star sx={{ fontSize: 14, color: 'gold' }} />}
                label={`${rating.toFixed(1)}`}
                size="small"
                sx={{
                  background: alpha('#000', 0.7),
                  color: 'white',
                  fontWeight: 'bold',
                  fontSize: '0.65rem',
                  height: 24,
                  border: `1px solid ${alpha('#FFD700', 0.3)}`
                }}
              />
              {year && (
                <Chip
                  label={year}
                  size="small"
                  sx={{
                    background: alpha(theme.palette.common.white, 0.2),
                    color: 'white',
                    fontWeight: 'bold',
                    fontSize: '0.65rem',
                    height: 24,
                  }}
                />
              )}
            </Box>
          </motion.div> */}

          {/* Title */}
          <motion.div variants={itemVariants}>
            <Typography
              variant="h4"
              sx={{
                color: 'white',
                fontWeight: 800,
                textAlign: 'left',
                mb: 2,
                fontSize: { xs: '1.5rem', sm: '1.8rem' },
                textShadow: '0 2px 8px rgba(0,0,0,0.9)',
                background: `linear-gradient(135deg, ${theme.palette.common.white} 0%, ${alpha(theme.palette.primary.main, 0.8)} 100%)`,
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                lineHeight: 1.2
              }}
            >
              {title}
            </Typography>
          </motion.div>

          {/* Action Buttons */}
          <motion.div
            variants={itemVariants}
            style={{
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
              width: '100%'
            }}
          >
            {/* Download Button */}
            <motion.div
              variants={buttonVariants}
              whileHover="hover"
              whileTap="tap"
              style={{ flex: 1, minWidth: 120 }}
            >
              <Button
                variant="contained"
                size="small"
                startIcon={<Download />}
                onClick={navigateToDownload}
                sx={{
                  background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                  color: 'white',
                  fontWeight: 'bold',
                  fontSize: '0.85rem',
                  px: 2,
                  py: 1.2,
                  borderRadius: '10px',
                  boxShadow: `0 4px 16px ${alpha(theme.palette.primary.main, 0.4)}`,
                  width: '100%',
                  '&:hover': {
                    background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.secondary.dark} 100%)`,
                  }
                }}
              >
                Download
              </Button>
            </motion.div>

            {/* My List Button */}
            <motion.div
              variants={buttonVariants}
              whileHover="hover"
              whileTap="tap"
              style={{ flex: 1, minWidth: 100 }}
            >
              <Button
                variant={isWatchListed ? "contained" : "outlined"}
                color={isWatchListed ? "success" : "inherit"}
                size="small"
                startIcon={isWatchListed ? <Check /> : <Add />}
                onClick={onToggleWatchlist}
                sx={{
                  borderColor: isWatchListed ? 'transparent' : alpha(theme.palette.common.white, 0.4),
                  color: 'white',
                  fontWeight: 'bold',
                  fontSize: '0.85rem',
                  px: 2,
                  py: 1.2,
                  borderRadius: '10px',
                  background: isWatchListed 
                    ? `linear-gradient(135deg, ${theme.palette.success.main} 0%, ${theme.palette.success.dark} 100%)`
                    : alpha(theme.palette.common.white, 0.15),
                  width: '100%',
                  '&:hover': {
                    background: isWatchListed 
                      ? `linear-gradient(135deg, ${theme.palette.success.dark} 0%, ${theme.palette.success.main} 100%)`
                      : alpha(theme.palette.primary.main, 0.25),
                  }
                }}
              >
                {isWatchListed ? 'Listed' : 'My List'}
              </Button>
            </motion.div>
          </motion.div>
        </motion.div>
      </Box>
    );
  }

  // Desktop Layout
  return (
    <Box
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      sx={{
        position: 'relative',
        height: '100%',
        width: '100%',
        display: 'flex',
        alignItems: 'flex-end',
        p: { xs: 3, md: 6, lg: 8 },
        background: `
          linear-gradient(77deg, 
            rgba(0,0,0,0.6) 0%, 
            rgba(0,0,0,0.4) 20%, 
            rgba(0,0,0,0.2) 40%, 
            rgba(0,0,0,0.1) 60%, 
            transparent 85%
          ),
          linear-gradient(0deg, 
            rgba(0,0,0,0.7) 0%, 
            rgba(0,0,0,0.4) 15%, 
            rgba(0,0,0,0.2) 30%, 
            rgba(0,0,0,0.1) 50%, 
            transparent 70%
          )
        `,
        zIndex: 2,
      }}
    >
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        sx={{
          position: 'relative',
          zIndex: 2,
          maxWidth: { xs: '100%', md: '60%', lg: '50%' },
          width: '100%'
        }}
      >
        {/* Media Type & Rating Badge */}
        <motion.div variants={itemVariants} style={{ marginBottom: 16 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Chip
              icon={isMovie ? <Theaters /> : <LiveTv />}
              label={isMovie ? "MOVIE" : "TV SERIES"}
              size="small"
              sx={{
                background: alpha(theme.palette.primary.main, 0.9),
                color: 'white',
                fontWeight: 'bold',
                fontSize: '0.7rem'
              }}
            />
            <Chip
              icon={<Star sx={{ color: 'gold' }} />}
              label={`${rating.toFixed(1)}/10`}
              size="small"
              sx={{
                background: alpha('#000', 0.7),
                color: 'white',
                fontWeight: 'bold',
                border: `1px solid ${alpha('#FFD700', 0.3)}`
              }}
            />
            {year && (
              <Chip
                label={year}
                size="small"
                sx={{
                  background: alpha(theme.palette.common.white, 0.2),
                  color: 'white',
                  fontWeight: 'bold',
                }}
              />
            )}
          </Box>
        </motion.div>

        {/* Title with Gradient Text */}
        <motion.div variants={itemVariants}>
          <Typography
            variant="h1"
            sx={{
              fontSize: { xs: '2.5rem', sm: '3.5rem', md: '4rem', lg: '4.5rem' },
              fontWeight: 900,
              lineHeight: 1.1,
              background: `linear-gradient(135deg, ${theme.palette.common.white} 0%, ${alpha(theme.palette.primary.main, 0.8)} 100%)`,
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              textShadow: '0 4px 20px rgba(0,0,0,0.3)',
              mb: 2
            }}
          >
            {title}
          </Typography>
        </motion.div>

        {/* Overview */}
        <motion.div variants={itemVariants}>
          <Typography
            variant="body1"
            sx={{
              fontSize: { xs: '0.9rem', md: '1.1rem' },
              color: alpha(theme.palette.common.white, 0.9),
              lineHeight: 1.6,
              mb: 4,
              maxWidth: '90%',
              textShadow: '0 2px 8px rgba(0,0,0,0.5)',
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden'
            }}
          >
            {overview}
          </Typography>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          variants={itemVariants}
          style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}
        >
          {/* Play Trailer Button */}
          {hasTrailer && (
            <Tooltip title={isPlayingTrailer ? "Trailer Playing" : "Play Trailer"} arrow>
              <motion.div
                variants={buttonVariants}
                whileHover="hover"
                whileTap="tap"
              >
                <Button
                  variant="contained"
                  size="large"
                  startIcon={<PlayArrow />}
                  onClick={onPlayTrailer}
                  sx={{
                    background: isPlayingTrailer 
                      ? `linear-gradient(135deg, ${theme.palette.success.main} 0%, ${theme.palette.success.dark} 100%)`
                      : `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                    color: 'white',
                    fontWeight: 'bold',
                    fontSize: '1rem',
                    px: 4,
                    py: 1.5,
                    borderRadius: '12px',
                    boxShadow: `0 8px 32px ${alpha(isPlayingTrailer ? theme.palette.success.main : theme.palette.primary.main, 0.4)}`,
                    '&:hover': {
                      background: isPlayingTrailer
                        ? `linear-gradient(135deg, ${theme.palette.success.dark} 0%, ${theme.palette.success.main} 100%)`
                        : `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.secondary.dark} 100%)`,
                    }
                  }}
                >
                  {isPlayingTrailer ? 'Playing...' : 'Play Trailer'}
                </Button>
              </motion.div>
            </Tooltip>
          )}

          {/* Download Button */}
          <Tooltip title="Download" arrow>
            <motion.div
              variants={buttonVariants}
              whileHover="hover"
              whileTap="tap"
            >
              <Button
                variant="outlined"
                size="large"
                startIcon={<Download />}
                onClick={navigateToDownload}
                sx={{
                  borderColor: alpha(theme.palette.common.white, 0.3),
                  color: 'white',
                  fontWeight: 'bold',
                  fontSize: '1rem',
                  px: 3,
                  py: 1.5,
                  borderRadius: '12px',
                  background: alpha(theme.palette.common.white, 0.1),
                  '&:hover': {
                    borderColor: theme.palette.primary.main,
                    background: alpha(theme.palette.primary.main, 0.1),
                  }
                }}
              >
                Download
              </Button>
            </motion.div>
          </Tooltip>

          {/* My List Button */}
          <Tooltip title={isWatchListed ? "Remove from My List" : "Add to My List"} arrow>
            <motion.div
              variants={buttonVariants}
              whileHover="hover"
              whileTap="tap"
            >
              <Button
                variant={isWatchListed ? "contained" : "outlined"}
                color={isWatchListed ? "success" : "inherit"}
                size="large"
                startIcon={isWatchListed ? <Check /> : <Add />}
                onClick={onToggleWatchlist}
                sx={{
                  borderColor: isWatchListed ? 'transparent' : alpha(theme.palette.common.white, 0.3),
                  color: 'white',
                  fontWeight: 'bold',
                  fontSize: '1rem',
                  px: 3,
                  py: 1.5,
                  borderRadius: '12px',
                  background: isWatchListed 
                    ? `linear-gradient(135deg, ${theme.palette.success.main} 0%, ${theme.palette.success.dark} 100%)`
                    : alpha(theme.palette.common.white, 0.1),
                  '&:hover': {
                    background: isWatchListed 
                      ? `linear-gradient(135deg, ${theme.palette.success.dark} 0%, ${theme.palette.success.main} 100%)`
                      : alpha(theme.palette.primary.main, 0.2),
                  }
                }}
              >
                {isWatchListed ? 'In List' : 'My List'}
              </Button>
            </motion.div>
          </Tooltip>

          {/* More Info Button */}
          <Tooltip title="More Details" arrow>
            <motion.div
              variants={buttonVariants}
              whileHover="hover"
              whileTap="tap"
            >
              <Button
                variant="outlined"
                size="large"
                startIcon={<Info />}
                onClick={navigateToDetails}
                sx={{
                  borderColor: alpha(theme.palette.common.white, 0.3),
                  color: 'white',
                  fontWeight: 'bold',
                  fontSize: '1rem',
                  px: 3,
                  py: 1.5,
                  borderRadius: '12px',
                  background: alpha(theme.palette.common.white, 0.1),
                  '&:hover': {
                    borderColor: theme.palette.info.main,
                    background: alpha(theme.palette.info.main, 0.1),
                  }
                }}
              >
                Details
              </Button>
            </motion.div>
          </Tooltip>
        </motion.div>
      </motion.div>
    </Box>
  );
};

// Main Cover Component
function Cover({ recordCount = 5, isNavbarCollapsed, recordTypes = ["movie", "series"] }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [records, setRecords] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isWatchListed, setIsWatchListed] = useState(false);
  const [direction, setDirection] = useState(0);
  const [isPlayingTrailer, setIsPlayingTrailer] = useState(false);
  const [currentTrailer, setCurrentTrailer] = useState(null);
  const [hasTrailer, setHasTrailer] = useState(false);
  const navigate = useNavigate();
  const autoCycleRef = useRef(null);

  // Memoized record data
  const currentRecord = useMemo(() => records[currentIndex], [records, currentIndex]);
  const isMovie = useMemo(() => currentRecord?.type?.toLowerCase() === Constants.RECORD_TYPE_MOVIE, [currentRecord]);

  // Fetch cover records
  useEffect(() => {
    const fetchCoverMovies = async () => {
      try {
        const response = await loadCoverRecords(requests.fetchCoverRecord, {
          recordTypes,
          pageSize: recordCount
        });

        if (response?.data?.records) {
          const recordsData = response.data.records.map(record => ({
            ...record,
            tmdb: record.type === Constants.RECORD_TYPE_MOVIE
              ? record.movieTmdb
              : record.seriesTmdb
          }));
          setRecords(recordsData);
        }
      } catch (error) {
        console.error('Failed to load cover records:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCoverMovies();
  }, [recordCount, recordTypes]);

  // Get trailer URL for current record
  const getTrailerUrl = useCallback((record) => {
    if (!record?.tmdb) return null;
    
    const videos = record.tmdb.videos?.results || [];
    const trailer = videos.find(video => 
      video.type === 'Trailer' && video.site === 'YouTube'
    );
    
    if (trailer) {
      return `https://www.youtube.com/embed/${trailer.key}?autoplay=1&mute=1&controls=0&loop=1&playlist=${trailer.key}&modestbranding=1&rel=0`;
    }
    
    return null;
  }, []);

  // Check if current record has trailer
  useEffect(() => {
    if (currentRecord) {
      const trailerUrl = getTrailerUrl(currentRecord);
      setHasTrailer(!!trailerUrl);
      setCurrentTrailer(trailerUrl);
    }
  }, [currentRecord, getTrailerUrl]);

  // Handle trailer playback
  const handlePlayTrailer = useCallback(() => {
    if (!currentRecord || !hasTrailer) return;
    
    setIsPlayingTrailer(true);
    
    // Auto-stop trailer after 30 seconds
    setTimeout(() => {
      setIsPlayingTrailer(false);
    }, 30000);
  }, [currentRecord, hasTrailer]);

  // Stop trailer when changing slides
  useEffect(() => {
    setIsPlayingTrailer(false);
  }, [currentIndex]);

  // Auto-play trailer for current slide
  useEffect(() => {
    if (!isMobile && currentRecord && hasTrailer && !isPlayingTrailer) {
      const trailerTimer = setTimeout(() => {
        handlePlayTrailer();
      }, 2000);
      
      return () => clearTimeout(trailerTimer);
    }
  }, [currentRecord, isMobile, isPlayingTrailer, handlePlayTrailer, hasTrailer]);

  // Reset & setup auto-cycle
  const resetAutoCycle = useCallback(() => {
    if (autoCycleRef.current) clearInterval(autoCycleRef.current);
    autoCycleRef.current = setInterval(() => {
      setDirection(1);
      setCurrentIndex(prev => (prev + 1) % records.length);
    }, AUTO_CYCLE_INTERVAL);
  }, [records.length]);

  useEffect(() => {
    if (records.length > 0) resetAutoCycle();
    return () => {
      if (autoCycleRef.current) clearInterval(autoCycleRef.current);
    };
  }, [records.length, resetAutoCycle]);

  // Navigation handlers
  const handleNext = useCallback(() => {
    if (records.length === 0) return;
    setDirection(1);
    setCurrentIndex(prev => (prev + 1) % records.length);
    resetAutoCycle();
  }, [records.length, resetAutoCycle]);

  const handlePrev = useCallback(() => {
    if (records.length === 0) return;
    setDirection(-1);
    setCurrentIndex(prev => (prev - 1 + records.length) % records.length);
    resetAutoCycle();
  }, [records.length, resetAutoCycle]);

  // Watchlist toggle
  const onToggleWatchlist = useCallback(async () => {
    if (!currentRecord) return;

    const wasWatchListed = isWatchListed;
    setIsWatchListed(!wasWatchListed);

    try {
      const response = wasWatchListed
        ? await removeWatchlistRecord(currentRecord.recordId)
        : await watchlistRecord(currentRecord.recordId);

      if (response.httpStatusCode === 200) {
        setRecords(prev => prev.map(record =>
          record.recordId === currentRecord.recordId
            ? { ...record, isWatchListed: !wasWatchListed }
            : record
        ));
      } else {
        setIsWatchListed(wasWatchListed);
        console.error(response.message);
      }
    } catch (error) {
      setIsWatchListed(wasWatchListed);
      console.error('Failed to update watchlist:', error);
    }
  }, [currentRecord, isWatchListed]);

  // Navigation to details
  const navigateToDetails = useCallback(() => {
    if (!currentRecord) return;

    const route = isMovie
      ? Constants.DB_MOVIE_DETIALS_ROUTE
      : Constants.DB_SERIES_DETIALS_ROUTE;

    const slug = `${currentRecord.recordId}-${currentRecord.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    navigate(route.replace(':title', slug));
  }, [currentRecord, isMovie, navigate]);

  const navigateToDownload = useCallback(() => {
    if (!currentRecord) return;

    navigate(
      `${Constants.DB_DONWLOAD_RECORD_ROUTE.replace(':recordId', currentRecord.recordId)}`,
      { state: { record: currentRecord } }
    );
  }, [currentRecord, navigate]);

  // Update watchlist state when record changes
  useEffect(() => {
    setIsWatchListed(currentRecord?.isWatchListed ?? false);
  }, [currentRecord]);

  // Swipe handlers
  const handlers = useSwipeable({
    onSwipedLeft: handleNext,
    onSwipedRight: handlePrev,
    trackMouse: true,
    preventDefaultTouchmoveEvent: true
  });

  // Memoized image URL
  const imageUrl = useMemo(() =>
    currentRecord?.tmdb
      ? CommonServices.getImageUrlFromTmdb(
        currentRecord.tmdb,
        isMobile ? Constants.IMAGE_TYPE_POSTER : Constants.IMAGE_TYPE_BACKDROP,
        'original'
      )
      : '',
    [currentRecord, isMobile]);

  if (loading) return <CoverSkeleton />;
  if (!currentRecord) return null;

  return (
    <CoverContainer
      {...handlers}
      className={isNavbarCollapsed ? 'collapsed' : ''}
      component={motion.div}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <AnimatePresence custom={direction} mode="wait">
        <CoverMain
          key={currentIndex}
          component={motion.div}
          custom={direction}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          style={{ 
            backgroundImage: isPlayingTrailer ? 'none' : `url("${imageUrl}")`
          }}
          ismobile={isMobile.toString()}
        >
          {/* Video Trailer for Desktop */}
          {!isMobile && hasTrailer && isPlayingTrailer && currentTrailer && (
            <Box
              component="iframe"
              src={currentTrailer}
              sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                width: '177.78vh',
                height: '100vh',
                minWidth: '100vw',
                minHeight: '56.25vw',
                transform: 'translate(-50%, -50%)',
                border: 'none',
                zIndex: 0
              }}
              allow="autoplay; encrypted-media"
              allowFullScreen
              title="Trailer"
            />
          )}

          {/* Fallback Image */}
          {(!isPlayingTrailer || isMobile || !hasTrailer) && (
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundImage: `url("${imageUrl}")`,
                backgroundSize: 'cover',
                backgroundPosition: 'center center',
                zIndex: 0
              }}
            />
          )}

          {/* Combined Content Component */}
          <CoverContent
            record={currentRecord}
            isWatchListed={isWatchListed}
            onToggleWatchlist={onToggleWatchlist}
            navigateToDetails={navigateToDetails}
            navigateToDownload={navigateToDownload}
            onPlayTrailer={handlePlayTrailer}
            isPlayingTrailer={isPlayingTrailer}
            hasTrailer={hasTrailer}
            isMobile={isMobile}
          />
        </CoverMain>
      </AnimatePresence>

      {/* Navigation Controls */}
      {!isMobile && (
        <CoverControls>
          <NavigationButton icon={<PrevIcon />} onClick={handlePrev} />
          <NavigationButton icon={<NextIcon />} onClick={handleNext} />
        </CoverControls>
      )}
    </CoverContainer>
  );
}

const NavigationButton = ({ icon, onClick }) => (
  <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
    <IconButton 
      onClick={onClick}
      size="large" 
      sx={{ 
        color: 'white',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        '&:hover': {
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
        }
      }}
    >
      {icon}
    </IconButton>
  </motion.div>
);

export default React.memo(Cover);