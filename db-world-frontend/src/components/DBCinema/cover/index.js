import React, { useEffect, useState } from 'react';
import axios from '../services/axios';
import { useNavigate } from 'react-router-dom';
import { useSwipeable } from 'react-swipeable';
import ColorThief from 'colorthief';
import requests from '../services/requests';
import Constants from '../../Constants';
import { removeWatchlistRecord, watchlistRecord } from '../../ApiServices';
import CommonServices from '../../CommonServices';
import { Capacitor } from '@capacitor/core';
import { StatusBar } from '@capacitor/status-bar';

// MUI Components
import {
  Box,
  Button,
  Typography,
  IconButton,
  useTheme,
  useMediaQuery,
  Skeleton,
  styled
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Info as InfoIcon,
  Download as DownloadIcon,
  Add as AddIcon,
  Check as CheckIcon,
  ChevronLeft as PrevIcon,
  ChevronRight as NextIcon
} from '@mui/icons-material';

// Framer Motion
import { motion, AnimatePresence } from 'framer-motion';

// Styled Components
const CoverContainer = styled(motion.div)(({ theme }) => ({
  position: 'relative',
  width: '100%',
  marginTop: '50px',
  height: 'calc(100vh - 160px)',
  backgroundColor: 'var(--navbar-bg-color)',
  zIndex: 900,
  overflow: 'hidden',
  // transition: `margin-top ${theme.transitions.duration.standard}ms ${theme.transitions.easing.easeInOut}, 
  //             height ${theme.transitions.duration.standard}ms ${theme.transitions.easing.easeInOut}`,
              
  transition: 'background-color var(--color-transition)',
  
  '&.collapsed': {
    height: 'calc(100vh - 50px)'
  },

  [theme.breakpoints.down('md')]: {
    height: 'calc(100vh - 250px)',
    marginTop: '100px',
    
    '&.collapsed': {
      height: 'calc(100vh - 250px)'
    }
  }
}));

const CoverMain = styled(motion.div)(({ theme }) => ({
  position: 'relative',
  display: 'flex',
  height: '100%',
  objectFit: 'cover',
  backgroundSize: 'cover',
  backgroundPosition: 'center center',
  transition: `background-image ${theme.transitions.duration.standard}ms ${theme.transitions.easing.easeInOut}, 
              background-color ${theme.transitions.duration.standard}ms ${theme.transitions.easing.easeInOut}`,
  
  [theme.breakpoints.down('md')]: {
    margin: theme.spacing(2),
    border: '1px solid white',
    borderRadius: '15px',
    boxShadow: theme.shadows[8],
    height: 'calc(100% - 100px)'
  }
}));

const CoverContents = styled(motion.div)(({ theme }) => ({
  marginLeft: '60px',
  paddingBottom: '30px',
  width: '600px',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'flex-end',
  lineHeight: 1.6,
  color: theme.palette.common.white,
  zIndex: 2,
  
  [theme.breakpoints.down('md')]: {
    marginLeft: 'auto',
    marginRight: 'auto',
    width: '320px',
    padding: theme.spacing(1),
    textAlign: 'center'
  }
}));

const MovieTitle = styled(motion.div)(({ theme }) => ({
  fontSize: '80px',
  lineHeight: 'normal',
  textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
  
  [theme.breakpoints.down('md')]: {
    fontSize: '32px'
  }
}));

const MovieOverview = styled(motion.div)(({ theme }) => ({
  fontSize: '18px',
  fontWeight: 'normal',
  marginTop: '10px',
  textShadow: '1px 1px 2px rgba(0,0,0,0.5)',
  
  [theme.breakpoints.down('md')]: {
    fontSize: '16px'
  }
}));

const ActionButton = styled(Button)(({ theme }) => ({
  borderRadius: '4px',
  fontSize: '18px',
  padding: '8px 18px',
  fontWeight: 'bold',
  marginRight: '8px',
  textTransform: 'none',
  
  '&.play': {
    backgroundColor: theme.palette.common.white,
    color: theme.palette.text.primary,
    '&:hover': {
      opacity: 0.8,
      backgroundColor: theme.palette.common.white
    }
  },
  
  '&.more': {
    backgroundColor: '#545455',
    color: theme.palette.common.white,
    opacity: 0.8,
    '&:hover': {
      opacity: 1,
      backgroundColor: '#545455'
    }
  },
  
  [theme.breakpoints.down('md')]: {
    fontSize: '14px',
    width: '43%',
    margin: 'auto'
  }
}));

const CoverControls = styled(motion.div)(({ theme }) => ({
  position: 'absolute',
  bottom: '20px',
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

const TopFadeEffect = styled('div')(({ theme }) => ({
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  background: `linear-gradient(to bottom, var(--navbar-bg-color, rgba(0,0,0,0.0)), transparent)`,
  pointerEvents: 'none',
  zIndex: 2
}));

const BottomFadeEffect = styled('div')(({ theme }) => ({
  position: 'absolute',
  bottom: 0,
  left: 0,
  width: '100%',
  height: '30%',
  background: `linear-gradient(to top, var(--navbar-bg-color, rgba(0,0,0,0.7)), transparent)`,
  pointerEvents: 'none',
  zIndex: 2
}));


function Cover({ recordCount = 5, isNavbarCollapsed, onColorChange = () => {} }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [records, setRecords] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [coverColor, setCoverColor] = useState('rgba(0,0,0,0.9)');
  const navigate = useNavigate();
  const [isWatchListed, setIsWatchListed] = useState(false);

  const onToggleWatchlist = async (e) => {
    e.stopPropagation();
    const record = records[currentIndex];
    if (!isWatchListed) {
      setIsWatchListed(true);
      const response = await watchlistRecord(record.recordId);
      if (response.httpStatusCode === 200) {
        setRecords((prev) => {
          return prev.map((prevRecord) => {
            if (prevRecord.recordId === record.recordId) {
              return { ...prevRecord, isWatchListed: true };
            }
            return prevRecord;
          });
        });
      } else {
        setIsWatchListed(false);
        console.log(response.message);
      }
    } else {
      setIsWatchListed(false);
      const response = await removeWatchlistRecord(record.recordId);
      if (response.httpStatusCode === 200) {
        setRecords((prev) => {
          return prev.map((prevRecord) => {
            if (prevRecord.recordId === record.recordId) {
              return { ...prevRecord, isWatchListed: false };
            }
            return prevRecord;
          });
        });
      } else {
        setIsWatchListed(true);
        console.log(response.message);
      }
    }
  };

  useEffect(() => {
    async function fetchCoverMovies() {
      try {
        const response = await axios.get(requests.fetchCoverRecord, {
          headers: { Authorization: 'Bearer ' + localStorage.getItem('token') },
          params: { pageSize: recordCount }
        });
        const recordsData = response.data.data.records.map((record) => {
          record.tmdb =
            record.type === Constants.RECORD_TYPE_MOVIE
              ? record.movieTmdb
              : record.seriesTmdb;
          return record;
        });
        setRecords(recordsData);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching cover movies:', error);
        setLoading(false);
      }
    }
    fetchCoverMovies();
  }, [recordCount]);

  const animationDuration = 500; // ms

  const handleNext = (e) => {
    // if (e) e.stopPropagation();
    if (records.length === 0 || animating) return;
    setAnimating(true);
    setTimeout(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % records.length);
      setAnimating(false);
    }, animationDuration);
  };

  const handlePrev = (e) => {
    // if (e) e.stopPropagation();
    if (records.length === 0 || animating) return;
    setAnimating(true);
    setTimeout(() => {
      setCurrentIndex((prevIndex) => (prevIndex - 1 + records.length) % records.length);
      setAnimating(false);
    }, animationDuration);
  };

  // Extract dominant color and update navbar CSS variable
  useEffect(() => {
    if (!records.length) return;
    const record = records[currentIndex];
    if (!record?.tmdb) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = CommonServices.getImageUrlFromTmdb(
      record?.tmdb,
      isMobile ? Constants.IMAGE_TYPE_POSTER : Constants.IMAGE_TYPE_BACKDROP,
      'original'
    );
    img.onload = () => {
      const colorThief = new ColorThief();
      const [r, g, b] = colorThief.getColor(img);
      const color = `rgba(${r},${g},${b},0.5)`;
      document.documentElement.style.setProperty('--navbar-bg-color', color);
      setCoverColor(color);

      if (Capacitor.getPlatform() === 'android') {
        let hexColor = CommonServices.rgbaToHex(color).slice(0, 7);
        StatusBar.setBackgroundColor({ color: hexColor });
        StatusBar.hide({ animation: 'FADE' });
        StatusBar.setOverlaysWebView({ overlay: true });
      }

      if (typeof onColorChange === 'function') {
        onColorChange(color);
      }
    };
    setIsWatchListed(record?.isWatchListed);
  }, [records, currentIndex, isMobile]);

  // Auto-cycle slides every 10 seconds
  useEffect(() => {
    if (!records.length) return;
    const interval = setInterval(() => {
      handleNext();
    }, 10000);
    return () => clearInterval(interval);
  }, [records, animating]);

  const handlers = useSwipeable({
    onSwipedLeft: handleNext,
    onSwipedRight: handlePrev,
    trackMouse: true
  });

  if (loading) return <CoverSkeleton />;

  const record = records[currentIndex];
  if (!record) return null;

  const navigateToDetails = (e) => {
    e?.stopPropagation();
    const route = record.type.toLowerCase() === Constants.RECORD_TYPE_MOVIE
      ? Constants.DB_MOVIE_DETIALS_ROUTE
      : Constants.DB_SERIES_DETIALS_ROUTE;
  
    const slug = `${record.recordId}-${record.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    navigate(route.replace(':title', slug));
  };

  const navigateToDownload = (e) => {
    e.stopPropagation();
    navigate(
      `${Constants.DB_DONWLOAD_RECORD_ROUTE.replace(':recordId', record.recordId)}`,
      { state: { movie: record, userRole: '' } }
    );
  };

  return (
    <CoverContainer
      {...handlers}
      className={isNavbarCollapsed ? 'collapsed' : ''}
      style={{ background: coverColor }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >

{/* <TopFadeEffect /> */}
{/* <BottomFadeEffect /> */}
    {/* <Box sx={{ height: isMobile ? '20px' : '20px', backgroundColor: coverColor }} /> */}
    <AnimatePresence mode="wait">
        <CoverMain
          key={currentIndex}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          style={{
            backgroundImage: `url("${CommonServices.getImageUrlFromTmdb(
              record?.tmdb,
              isMobile ? Constants.IMAGE_TYPE_POSTER : Constants.IMAGE_TYPE_BACKDROP,
              'original'
            )}")`,
            backgroundColor: coverColor
          }}
          onClick={navigateToDetails}
        >
          {!isMobile && (
            <CoverContents
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <MovieTitle>
                {record.tmdb.title || record.tmdb.name || record.tmdb.original_name}
              </MovieTitle>
              
              <MovieOverview>
                {record.tmdb.overview &&
                  (record.tmdb.overview.length > 200
                    ? record.tmdb.overview.substring(0, 200) + '...'
                    : record.tmdb.overview)}
              </MovieOverview>
              
              <Box sx={{ display: 'flex', mt: 2 }}>
                <ActionButton
                  className="play text-dark"
                  variant="contained"
                  startIcon={<DownloadIcon />}
                  onClick={navigateToDownload}
                >
                  Download
                </ActionButton>
                <ActionButton
                  className="more"
                  variant="contained"
                  startIcon={<InfoIcon />}
                  onClick={navigateToDetails}
                >
                  More Info
                </ActionButton>
              </Box>
            </CoverContents>
          )}

          
        </CoverMain>

        {isMobile && (
            <Box
              sx={{
                position: 'absolute',
                bottom: 16,
                left: 0,
                right: 0,
                display: 'flex',
                justifyContent: 'center',
                gap: 1
              }}
            >
              <ActionButton
                className="play text-dark"
                variant="contained"
                size="small"
                startIcon={<DownloadIcon />}
                onClick={navigateToDownload}
              >
                Download
              </ActionButton>
              <ActionButton
                variant={isWatchListed ? "contained" : "outlined"}
                color={isWatchListed ? "success" : "inherit"}
                size="small"
                startIcon={isWatchListed ? <CheckIcon /> : <AddIcon />}
                onClick={onToggleWatchlist}
                sx={{
                  color: isWatchListed ? 'common.white' : 'common.white',
                  borderColor: 'common.white'
                }}
              >
                {isWatchListed ? 'Listed' : 'My List'}
              </ActionButton>
            </Box>
          )}

      </AnimatePresence>

      {/* <FadedBottom /> */}
      
      <CoverControls>
        <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
          <IconButton onClick={handlePrev} size="large">
            <PrevIcon />
          </IconButton>
        </motion.div>
        <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
          <IconButton onClick={handleNext} size="large">
            <NextIcon />
          </IconButton>
        </motion.div>
      </CoverControls>
    </CoverContainer>
  );
}

function CoverSkeleton() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  return (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        marginTop: isMobile ? '100px' : '50px',
        height: isMobile ? 'calc(100vh - 250px)' : 'calc(100vh - 120px)',
        backgroundColor: 'grey.900',
        overflow: 'hidden',
        zIndex: 900
      }}
    >
      <Skeleton
        variant="rectangular"
        width="100%"
        height="100%"
        animation="wave"
      />
      
      {!isMobile && (
        <Box
          sx={{
            position: 'absolute',
            bottom: '30px',
            left: '60px',
            color: 'common.white',
            zIndex: 2
          }}
        >
          <Skeleton
            variant="text"
            width="60%"
            height="80px"
            animation="wave"
            sx={{ mb: 1 }}
          />
          <Skeleton
            variant="text"
            width="80%"
            height="40px"
            animation="wave"
            sx={{ mb: 2 }}
          />
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Skeleton
              variant="rectangular"
              width="140px"
              height="40px"
              animation="wave"
              sx={{ borderRadius: 1 }}
            />
            <Skeleton
              variant="rectangular"
              width="140px"
              height="40px"
              animation="wave"
              sx={{ borderRadius: 1 }}
            />
          </Box>
        </Box>
      )}
    </Box>
  );
}

export default Cover;