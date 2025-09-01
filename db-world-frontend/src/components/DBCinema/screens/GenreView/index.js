import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, CircularProgress, Button } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import requests from '../../services/requests';
import Constants from '../../../Constants';
import { loadDbCinemaRecordsFromUrl } from '../../../ApiServices';

const NAVBAR_HEIGHT = 60; // Set this to match your actual navbar height
const PAGE_SIZE = 10; // Number of records per page

const GenreView = ({ genre, onBack, navigate }) => {
  const [records, setRecords] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const loaderRef = useRef(null);
  const containerRef = useRef(null);

  // Normalize record data to have consistent tmdb field
  const normalizeRecord = (record) => {
    return {
      ...record,
      tmdb: record.movieTmdb || record.seriesTmdb || {},
      type: record.type || (record.movieTmdb ? Constants.RECORD_TYPE_MOVIE : Constants.RECORD_TYPE_SERIES)
    };
  };

  // Fetch records for the selected genre
  const fetchRecords = useCallback(async () => {
    if (!hasMore || isLoading) return;
    
    setIsLoading(true);
    try {
      const response = await loadDbCinemaRecordsFromUrl(
        requests.fetchAllRecords, 
        { genres: genre.id, page, size: PAGE_SIZE }
      );
      
      const newRecords = (response.data?.records || response.data?.content || [])
        .map(normalizeRecord);
      
      const totalPages = response.data?.totalPages || 
                       Math.ceil(response.data?.totalElements / PAGE_SIZE) || 
                       1;

      setRecords(prev => [...prev, ...newRecords]);
      setPage(prev => prev + 1);
      setHasMore(page < totalPages);
    } catch (error) {
      console.error('Error fetching genre records:', error);
    } finally {
      setIsLoading(false);
    }
  }, [genre, page, hasMore, isLoading]);

  // Initial load
  useEffect(() => {
    setRecords([]);
    setPage(1);
    setHasMore(true);
    fetchRecords();
  }, [genre]);

  // Infinite scroll setup
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const firstEntry = entries[0];
        if (firstEntry.isIntersecting && hasMore && !isLoading) {
          fetchRecords();
        }
      },
      { 
        root: null,
        threshold: 0.5,
        rootMargin: '100px'
      }
    );

    const currentLoader = loaderRef.current;
    if (currentLoader) {
      observer.observe(currentLoader);
    }

    return () => {
      if (currentLoader) {
        observer.unobserve(currentLoader);
      }
    };
  }, [hasMore, isLoading, fetchRecords]);

  const navigateToDetails = (record) => {
    const isMovie = record.type?.toLowerCase() === Constants.RECORD_TYPE_MOVIE;
    const route = isMovie ? Constants.DB_MOVIE_DETIALS_ROUTE : Constants.DB_SERIES_DETIALS_ROUTE;
    const path = route.replace(
      ':title', 
      `${record.recordId}-${record.name?.toLowerCase().replace(/ /g, '-')}`
    );
    navigate(path);
  };

  // Get image URL with proper fallbacks
  const getImageUrl = (record) => {
    const posterPath = record.tmdb?.poster_path || record.poster_path;
    if (posterPath) {
      return `https://image.tmdb.org/t/p/w500${posterPath}`;
    }
    return record.thumbnailUrl || 'https://via.placeholder.com/150x225';
  };

  return (
    <Box 
      ref={containerRef}
      sx={{ 
        p: 2,
        height: `calc(100vh - ${NAVBAR_HEIGHT}px)`,
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        position: 'relative',
        top: `${NAVBAR_HEIGHT}px`
      }}
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
          gap: 2,
          pb: 4
        }}
      >
        <AnimatePresence>
          {records.map((record) => {
            const normalizedRecord = normalizeRecord(record);
            return (
              <motion.div
                key={`${normalizedRecord.recordId || normalizedRecord.id}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                whileHover={{ scale: 1.05 }}
                onClick={() => navigateToDetails(normalizedRecord)}
              >
                <img
                  src={getImageUrl(normalizedRecord)}
                  alt={normalizedRecord.name || normalizedRecord.title}
                  style={{
                    width: '100%',
                    height: '225px',
                    objectFit: 'cover',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    backgroundColor: '#333'
                  }}
                  loading="lazy"
                  onError={(e) => {
                    e.target.src = 'https://via.placeholder.com/150x225';
                  }}
                />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </Box>
      
      <Box 
        ref={loaderRef} 
        sx={{ 
          display: 'flex', 
          justifyContent: 'center', 
          py: 4,
          minHeight: '50px'
        }}
      >
        {hasMore ? (
          <Button
            variant="contained"
            color="primary"
            onClick={fetchRecords}
            disabled={isLoading}
            sx={{ minWidth: '200px' }}
          >
            {isLoading ? (
              <CircularProgress size={24} color="inherit" />
            ) : (
              'Load More'
            )}
          </Button>
        ) : (
          <Box sx={{ color: 'text.secondary' }}>No more records to load</Box>
        )}
      </Box>
    </Box>
  );
};

export default GenreView;