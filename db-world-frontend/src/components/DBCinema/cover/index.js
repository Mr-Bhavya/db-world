import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSwipeable } from 'react-swipeable';
import requests from '../services/requests';
import Constants from '../../Constants';
import { loadCoverRecords, removeWatchlistRecord, watchlistRecord } from '../../ApiServices';
import CommonServices from '../../CommonServices';

// MUI Components
import {
  IconButton,
  useTheme,
  useMediaQuery,
  Box,
  styled
} from '@mui/material';
import {
  ChevronLeft as PrevIcon,
  ChevronRight as NextIcon
} from '@mui/icons-material';

// Framer Motion
import { motion, AnimatePresence } from 'framer-motion';
import CoverSkeleton from './CoverSkeleton';
import MobileOverlay from './MobileOverlay';
import DesktopContent from './DesktopContent';

// Constants
const AUTO_CYCLE_INTERVAL = 5000; // 5s

// Styled Components with MUI transitions
const CoverContainer = styled(Box)(({ theme }) => ({
  position: 'relative',
  width: '100%',
  marginTop: '50px',
  // height: 'calc(100vh - 160px)',
  backgroundColor: 'var(--navbar-bg-color)',
  zIndex: 900,
  overflow: 'hidden',

  '&.collapsed': {
    // height: 'calc(100vh - 160px)'
  },

  [theme.breakpoints.down('md')]: {
    // height: 'calc(100vh - 160px)',
    marginTop: '100px',

    '&.collapsed': {
      // height: 'calc(100vh - 160px)'
    }
  }
}));

const CoverMain = styled(Box)(({ theme, ismobile }) => ({
  position: 'relative',
  display: 'flex',
  backgroundSize: 'cover',
  backgroundPosition: 'center center',
  height: ismobile === 'true' ? '40vh' : '80vh',
  minHeight: ismobile === 'true' ? '568px' : '800px',
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

  '& button': {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    border: 'none',
    color: theme.palette.common.white,
    padding: '8px 12px',
    borderRadius: '4px',
    fontSize: '16px'
  },

  [theme.breakpoints.down('md')]: {
    display: 'none'
  }
}));

// Animation variants for Framer Motion
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

function Cover({ recordCount = 5, isNavbarCollapsed, recordTypes = ["movie", "series"] }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [records, setRecords] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isWatchListed, setIsWatchListed] = useState(false);
  const [direction, setDirection] = useState(0); // 1 for next, -1 for prev
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
  }, []);

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
    return () => clearInterval(autoCycleRef.current);
  }, [records.length, resetAutoCycle]);

  // Navigation handlers
  const handleNext = useCallback((e) => {
    e?.stopPropagation();
    if (records.length === 0) return;
    setDirection(1);
    setCurrentIndex(prev => (prev + 1) % records.length);
    resetAutoCycle();
  }, [records.length, resetAutoCycle]);

  const handlePrev = useCallback((e) => {
    e?.stopPropagation();
    if (records.length === 0) return;
    setDirection(-1);
    setCurrentIndex(prev => (prev - 1 + records.length) % records.length);
    resetAutoCycle();
  }, [records.length, resetAutoCycle]);

  // Watchlist toggle
  const onToggleWatchlist = useCallback(async (e) => {
    e.stopPropagation();
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
  const navigateToDetails = useCallback((e) => {
    e?.stopPropagation();
    if (!currentRecord) return;

    const route = isMovie
      ? Constants.DB_MOVIE_DETIALS_ROUTE
      : Constants.DB_SERIES_DETIALS_ROUTE;

    const slug = `${currentRecord.recordId}-${currentRecord.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    navigate(route.replace(':title', slug));
  }, [currentRecord, isMovie, navigate]);

  const navigateToDownload = useCallback((e) => {
    e.stopPropagation();
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
          style={{ backgroundImage: `url("${imageUrl}")` }}
          ismobile={isMobile.toString()}
          onClick={navigateToDetails}
        >
          {/* Mobile Overlay */}
          {isMobile && (
            <MobileOverlay
              record={currentRecord}
              isWatchListed={isWatchListed}
              onToggleWatchlist={onToggleWatchlist}
              navigateToDownload={navigateToDownload}
            />
          )}

          {/* Desktop Content */}
          {!isMobile && (
            <DesktopContent
              record={currentRecord}
              isWatchListed={isWatchListed}
              onToggleWatchlist={onToggleWatchlist}
              navigateToDetails={navigateToDetails}
              navigateToDownload={navigateToDownload}
            />
          )}
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
    <IconButton onClick={onClick} size="large" sx={{ color: 'white' }}>
      {icon}
    </IconButton>
  </motion.div>
);

export default React.memo(Cover);