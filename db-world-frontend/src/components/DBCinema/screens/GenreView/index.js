import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  CircularProgress,
  Button,
  Typography,
  Chip,
  IconButton,
  useTheme,
  alpha,
  Card,
  CardMedia,
  CardContent,
  Rating,
  Tooltip
} from '@mui/material';
import {
  ArrowBack,
  PlayArrow,
  Star,
  CalendarToday,
  Theaters,
  LiveTv,
  Language,
  AccessTime
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import requests from '../../services/requests';
import Constants from '../../../Constants';
import { loadDbCinemaRecordsFromUrl } from '../../../ApiServices';
import MediaCard from './MediaCard';

const PAGE_SIZE = 20;
const CARD_WIDTH = 180;
const CARD_HEIGHT = 320;
const CARD_MARGIN = 8;

const GenreView = ({ genre, onBack }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const [records, setRecords] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [error, setError] = useState(null);

  const loaderRef = useRef(null);
  const containerRef = useRef(null);
  const observerRef = useRef(null);

  // Get current page type from URL to determine media type
  const getMediaTypeFromRoute = useCallback(() => {
    const path = location.pathname;
    console.log("Current path:", path);

    if (path.includes(Constants.DB_CINEMA_MOVIES_ROUTE)) {
      console.log("Detected Movies page");
      return 'movie';
    }
    if (path.includes(Constants.DB_CINEMA_SERIES_ROUTE)) {
      console.log("Detected TV Shows page");
      return 'series';
    }
    console.log("Detected Home/Browse page - loading all media types");
    return 'all';
  }, [location.pathname]);

  // Normalize record data
  const normalizeRecord = useCallback((record) => {
    return {
      ...record,
      tmdb: record.movieTmdb || record.seriesTmdb || record.tmdb || {},
      type: record.type || (record.movieTmdb ? Constants.RECORD_TYPE_MOVIE : Constants.RECORD_TYPE_SERIES),
      title: record.name || record.title || 'Unknown Title',
      rating: record.tmdb?.vote_average || record.rating || 0,
      year: record.tmdb?.release_date?.split('-')[0] || record.releaseYear || 'N/A',
      language: record.tmdb?.original_language || 'en',
      runtime: record.tmdb?.runtime || null,
      voteCount: record.tmdb?.vote_count || 0
    };
  }, []);

  // Fetch records with proper media type filtering - FIXED VERSION
  const fetchRecords = useCallback(async (pageNum = 1, isInitial = false) => {
    if (isLoading && !isInitial) return;

    setIsLoading(true);
    setError(null);

    try {
      const mediaType = getMediaTypeFromRoute();

      // Build query parameters
      const queryParams = {
        page: pageNum,
        size: PAGE_SIZE
      };

      // Add genre filter
      if (genre?.id) {
        queryParams.genres = genre.id;
        console.log(`Filtering by genre: ${genre.name} (ID: ${genre.id})`);
      }

      // Add media type filter based on current page
      if (mediaType !== 'all') {
        queryParams.type = mediaType;
        console.log(`Filtering by media type: ${mediaType}`);
      }

      console.log('Fetching records with params:', queryParams);

      const response = await loadDbCinemaRecordsFromUrl(
        requests.fetchAllRecords,
        queryParams
      );

      console.log('API Response received:', response);

      const newRecords = (response.data?.records || response.data?.content || [])
        .map(normalizeRecord);

      const totalPages = response.data?.totalPages ||
        Math.ceil((response.data?.totalElements || 0) / PAGE_SIZE) ||
        1;

      if (isInitial) {
        setRecords(newRecords);
        setPage(2);
        setIsInitialLoading(false);
      } else {
        setRecords(prev => [...prev, ...newRecords]);
        setPage(prev => prev + 1);
      }

      setHasMore(pageNum < totalPages && newRecords.length === PAGE_SIZE);

      console.log(`Loaded ${newRecords.length} records, has more: ${pageNum < totalPages && newRecords.length === PAGE_SIZE}, page: ${pageNum}, totalPages: ${totalPages}`);

    } catch (error) {
      console.error('Error fetching genre records:', error);
      setError('Failed to load content. Please try again.');
    } finally {
      setIsLoading(false);
      if (isInitial) {
        setIsInitialLoading(false);
      }
    }
  }, [genre, isLoading, normalizeRecord, getMediaTypeFromRoute]);

  // Reset and fetch when genre changes - FIXED
  useEffect(() => {
    console.log("Genre changed, fetching records...");
    setRecords([]);
    setPage(1);
    setHasMore(true);
    setIsInitialLoading(true);
    setError(null);

    // Use setTimeout to avoid state update during render
    setTimeout(() => {
      fetchRecords(1, true);
    }, 0);
  }, [genre?.id]); // Only depend on genre.id

  // Improved infinite scroll - FIXED
  useEffect(() => {
    if (isInitialLoading || isLoading || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoading && hasMore) {
          console.log("Loading more records...");
          fetchRecords(page);
        }
      },
      { root: null, threshold: 0.1, rootMargin: '200px' }
    );

    const node = loaderRef.current;
    if (node) observer.observe(node);

    return () => {
      if (node) observer.unobserve(node);
    };
  }, [isInitialLoading, isLoading, hasMore, page, fetchRecords]);

  const navigateToDetails = (record) => {
    const normalizedRecord = normalizeRecord(record);
    const isMovie = normalizedRecord.type?.toLowerCase() === Constants.RECORD_TYPE_MOVIE;
    const route = isMovie ? Constants.DB_MOVIE_DETIALS_ROUTE : Constants.DB_SERIES_DETIALS_ROUTE;

    // Create SEO-friendly URL
    const titleSlug = normalizedRecord.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');

    const path = route.replace(':title', `${normalizedRecord.recordId}-${titleSlug}`);
    navigate(path, { state: { record: normalizedRecord } });
  };

  // Retry loading on error
  const handleRetry = () => {
    setError(null);
    fetchRecords(1, true);
  };

  if (isInitialLoading) {
    return (
      <Box
        sx={{
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 2,
          background: `linear-gradient(135deg, ${theme.palette.background.default} 0%, ${alpha(theme.palette.primary.main, 0.1)} 100%)`
        }}
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <CircularProgress
            size={40}
            thickness={4}
            sx={{ color: 'primary.main' }}
          />
        </motion.div>
        <Typography variant="h6" color="text.secondary">
          Loading {genre?.name}...
        </Typography>
      </Box>
    );
  }

  if (error && records.length === 0) {
    return (
      <Box
        sx={{
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 3,
          p: 3,
          textAlign: 'center',
          background: `linear-gradient(135deg, ${theme.palette.background.default} 0%, ${alpha(theme.palette.primary.main, 0.1)} 100%)`
        }}
      >
        <Typography variant="h5" color="error">
          Oops! Something went wrong
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
          {error}
        </Typography>
        <Button
          variant="contained"
          onClick={handleRetry}
          startIcon={<ArrowBack />}
        >
          Try Again
        </Button>
      </Box>
    );
  }

  return (
    <Box
      ref={containerRef}
      sx={{
        height: '100vh',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        background: "rgba(0,0,0,0.9)",
        backdropFilter: "blur(10px)",
      }}
    >

      {/* Content Grid */}
      <Box
        sx={{
          p: { xs: 1, sm: 2 },
          display: "grid",
          gap: { xs: 1.5, sm: 2 },
          gridTemplateColumns: {
            xs: "repeat(2, 1fr)",        // small phones
            sm: "repeat(3, 1fr)",        // phones / small tablets
            md: "repeat(4, 1fr)",        // tablets
            lg: "repeat(6, 1fr)",        // laptops
            xl: "repeat(7, 1fr)",        // desktops
            "2xl": "repeat(8, 1fr)",     // ultrawide (custom if needed)
          },
          justifyItems: "center",
          mx: "auto",
          width: "100%",
          maxWidth: "1800px",
        }}
      >
        <AnimatePresence>
          {records.map((record, index) => (
            <MediaCard
              key={`${record.recordId || record.id}-${index}`}
              record={record}
              onClick={() => navigateToDetails(record)}
              index={index}
            />
          ))}
        </AnimatePresence>
      </Box>

      {/* Load More Section */}
      <Box
        ref={loaderRef}
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          py: 4,
          minHeight: '80px'
        }}
      >
        <AnimatePresence>
          {isLoading && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <CircularProgress size={24} />
                <Typography variant="body2" color="text.secondary">
                  Loading more...
                </Typography>
              </Box>
            </motion.div>
          )}

          {!hasMore && records.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <Typography
                variant="body1"
                color="text.secondary"
                sx={{ textAlign: 'center' }}
              >
                You've seen all {records.length} titles
              </Typography>
            </motion.div>
          )}

          {error && records.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="body2" color="error" sx={{ mb: 2 }}>
                  {error}
                </Typography>
                <Button
                  variant="outlined"
                  onClick={handleRetry}
                  size="small"
                >
                  Retry
                </Button>
              </Box>
            </motion.div>
          )}
        </AnimatePresence>
      </Box>

      {/* Empty State */}
      {records.length === 0 && !isLoading && !error && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              py: 10,
              textAlign: 'center'
            }}
          >
            <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
              No titles found
            </Typography>
            <Typography variant="body2" color="text.secondary">
              We couldn't find any content in the {genre?.name} genre.
            </Typography>
            <Button
              variant="outlined"
              onClick={onBack}
              sx={{ mt: 2 }}
              startIcon={<ArrowBack />}
            >
              Back to Categories
            </Button>
          </Box>
        </motion.div>
      )}
    </Box>
  );
};

export default GenreView; 