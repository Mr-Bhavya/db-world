import React, { useRef, useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Box, Typography, IconButton, useMediaQuery, useTheme,
} from '@mui/material';
import { ChevronLeft, ChevronRight } from '@mui/icons-material';
import RecordCard, { RecordCardSkeleton } from '../RecordCard/RecordCard';

const SCROLL_AMOUNT = 0.75;

/**
 * Watchlist rail row — takes pre-fetched records as props.
 * Returns null when loading is done and there are no records.
 */
const WatchlistRailRow = ({
  records = [],
  loading = false,
  interactions = {},
  onWatchlist,
  onLike,
  onLove,
  onWatched,
}) => {
  const theme    = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const scrollRef = useRef(null);
  const [showLeft,  setShowLeft]  = useState(false);
  const [showRight, setShowRight] = useState(true);

  const updateButtons = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setShowLeft(el.scrollLeft > 8);
    setShowRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 8);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateButtons, { passive: true });
    updateButtons();
    return () => el.removeEventListener('scroll', updateButtons);
  }, [updateButtons, records]);

  const scroll = (dir) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * SCROLL_AMOUNT, behavior: 'smooth' });
  };

  // Hide entirely when not loading and no records
  if (!loading && records.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
    >
      <Box sx={{ mb: { xs: 2.5, md: 3.5 } }}>
        {/* Row header */}
        <Box sx={{ px: { xs: 2, md: 4 }, mb: 1 }}>
          <Typography
            variant="h6"
            sx={{
              color: '#e5e5e5', fontWeight: 700,
              fontSize: { xs: '1rem', md: '1.2rem' },
              letterSpacing: 0.2,
            }}
          >
            My List
          </Typography>
        </Box>

        {/* Scroll container */}
        <Box sx={{ position: 'relative' }}>
          {showLeft && !isMobile && (
            <IconButton
              onClick={() => scroll(-1)}
              sx={{
                position: 'absolute', left: 0, top: '50%',
                transform: 'translateY(-50%)',
                zIndex: 5, bgcolor: 'rgba(20,20,20,.85)',
                color: '#fff', height: '100%', width: 40, borderRadius: 0,
                '&:hover': { bgcolor: 'rgba(20,20,20,.95)' },
              }}
            >
              <ChevronLeft />
            </IconButton>
          )}

          {showRight && !isMobile && (
            <IconButton
              onClick={() => scroll(1)}
              sx={{
                position: 'absolute', right: 0, top: '50%',
                transform: 'translateY(-50%)',
                zIndex: 5, bgcolor: 'rgba(20,20,20,.85)',
                color: '#fff', height: '100%', width: 40, borderRadius: 0,
                '&:hover': { bgcolor: 'rgba(20,20,20,.95)' },
              }}
            >
              <ChevronRight />
            </IconButton>
          )}

          <Box
            ref={scrollRef}
            onScroll={updateButtons}
            sx={{
              display: 'flex', gap: { xs: 1, md: 1.5 },
              overflowX: 'auto', overflowY: 'visible',
              px: { xs: 2, md: 4 },
              scrollbarWidth: 'none',
              '&::-webkit-scrollbar': { display: 'none' },
              py: '16px', my: '-16px',
            }}
          >
            {loading && records.length === 0
              ? [...Array(6)].map((_, i) => <RecordCardSkeleton key={i} />)
              : records.map((rec) => (
                  <RecordCard
                    key={rec.id}
                    record={rec}
                    interaction={interactions[rec.id] ?? {}}
                    onWatchlist={onWatchlist}
                    onLike={onLike}
                    onLove={onLove}
                    onWatched={onWatched}
                  />
                ))
            }
          </Box>
        </Box>
      </Box>
    </motion.div>
  );
};

export default WatchlistRailRow;
