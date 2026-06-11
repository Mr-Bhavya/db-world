import React, { useRef, useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Box, Typography, IconButton, useMediaQuery, useTheme
} from '@mui/material';
import { ChevronLeft, ChevronRight, ArrowForward } from '@mui/icons-material';
import RecordCard, { RecordCardSkeleton } from '../RecordCard/RecordCard';
import useRailRecords from '../../hooks/useRailRecords';

const SCROLL_AMOUNT = 0.75; // fraction of container width to scroll

// ─── RailRow ─────────────────────────────────────────────────────────────────

/**
 * Horizontal-scrollable rail row with lazy loading via Intersection Observer.
 *
 * Props:
 *   rail          RailDto  - { id, title, limitSize, infiniteScroll }
 *   category      Long?    - optional genre filter
 *   interactions  { [id]: dto }
 *   onWatchlist   (record) => void
 *   onLike        (record) => void
 *   wide          boolean  - use backdrop images instead of posters
 *   eager         boolean  - skip intersection observer and load immediately
 */
const RailRow = ({
  rail,
  category,
  interactions = {},
  onWatchlist,
  onLike,
  onLove,
  onWatched,
  onExplore,
  wide = false,
  eager = false,
  top10 = false,
  expandOnHover = false,
}) => {
  const theme    = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const rowRef       = useRef(null);
  const scrollRef    = useRef(null);
  const observerRef  = useRef(null);

  const [showLeft,  setShowLeft]  = useState(false);
  const [showRight, setShowRight] = useState(true);
  const [titleHovered, setTitleHovered] = useState(false);

  // Prime-rail expand coordination: when a card expands horizontally, slide the
  // neighbours on the GROWING side out of the way (transform, so no reflow and
  // no skipping) — the expanded card grows into the gap instead of covering them.
  //
  // The grow direction comes from REAL pointer movement (tracked here), not from
  // which edge a card was entered (that was flaky and caused the random
  // left/right + the skip). Moving right ⇒ grow LEFT so the cards to the right
  // (where the cursor is heading) never move; moving left ⇒ grow RIGHT.
  const [expand, setExpand] = useState({ idx: null, dir: null });
  const lastXRef  = useRef(null);
  const moveDirRef = useRef('right');
  const handleMouseMove = useCallback((e) => {
    if (lastXRef.current != null) {
      const dx = e.clientX - lastXRef.current;
      if (Math.abs(dx) > 2) moveDirRef.current = dx > 0 ? 'right' : 'left';
    }
    lastXRef.current = e.clientX;
  }, []);
  const handleHoverExpand = useCallback((idx) => {
    if (idx == null) { setExpand({ idx: null, dir: null }); return; }
    setExpand({ idx, dir: moveDirRef.current === 'right' ? 'left' : 'right' });
  }, []);
  const PRIME_SHIFT = 450; // ≈ landscape width − portrait width of a prime card
  const cardShift = (i) => {
    if (expand.idx == null) return 0;
    if (expand.dir === 'left'  && i < expand.idx) return -PRIME_SHIFT;
    if (expand.dir === 'right' && i > expand.idx) return  PRIME_SHIFT;
    return 0;
  };

  const { records, loading, hasNext, initialLoaded, trigger, loadMore } =
    useRailRecords(rail?.id, rail?.limitSize, rail?.infiniteScroll, category);

  // Intersection Observer — trigger lazy load when row enters viewport
  useEffect(() => {
    if (!rowRef.current || eager) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { trigger(); obs.disconnect(); } },
      { rootMargin: '400px', threshold: 0.01 }
    );
    obs.observe(rowRef.current);
    observerRef.current = obs;
    return () => obs.disconnect();
  }, [trigger, eager]);

  // Eager load
  useEffect(() => {
    if (eager && !initialLoaded) trigger();
  }, [eager, initialLoaded, trigger]);

  // Update scroll button visibility
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

  // ── Horizontal scroll persistence ────────────────────────────────────────
  const hScrollKey = rail?.id ? `cinema_rail_h_${rail.id}` : null;

  // Restore saved horizontal position after records load
  useEffect(() => {
    if (!hScrollKey || !records.length || !scrollRef.current) return;
    const saved = parseInt(sessionStorage.getItem(hScrollKey) || '0', 10);
    if (saved > 0) {
      scrollRef.current.scrollLeft = saved;
    }
  }, [records.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Save horizontal position on scroll
  const handleScrollWithSave = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateButtons();
    if (hScrollKey) sessionStorage.setItem(hScrollKey, String(el.scrollLeft));
    const nearEnd = el.scrollLeft >= el.scrollWidth - el.clientWidth - 200;
    if (nearEnd && hasNext && !loading) loadMore();
  }, [updateButtons, hasNext, loading, loadMore, hScrollKey]);


  const scroll = (dir) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * SCROLL_AMOUNT, behavior: 'smooth' });
  };

  if (!rail) return null;

  const skeletonCount = Math.min(rail.limitSize ?? 8, 8);

  return (
    <motion.div
      ref={rowRef}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
    >
      <Box sx={{ mb: { xs: 2.5, md: 3.5 } }}>
        {/* ── Row header ── */}
        <Box
          onMouseEnter={() => setTitleHovered(true)}
          onMouseLeave={() => setTitleHovered(false)}
          sx={{
            display: 'flex', alignItems: 'center', gap: 1,
            px: { xs: 2, md: 4 }, mb: 1,
            cursor: 'default',
          }}
        >
          <Typography
            variant="h6"
            sx={{
              color: '#e5e5e5', fontWeight: 700,
              fontSize: { xs: '1rem', md: '1.2rem' },
              letterSpacing: 0.2,
            }}
          >
            {rail.title}
          </Typography>

          {/* "Explore All" link — slides in on title hover */}
          <Box
            component={motion.div}
            animate={{ opacity: titleHovered ? 1 : 0, x: titleHovered ? 0 : -8 }}
            transition={{ duration: 0.2 }}
            onClick={() => onExplore?.(rail)}
            sx={{ display: 'flex', alignItems: 'center', gap: 0.3, cursor: 'pointer' }}
          >
            <Typography
              variant="caption"
              sx={{ color: 'primary.main', fontWeight: 600, fontSize: '0.75rem', letterSpacing: 0.5 }}
            >
              Explore All
            </Typography>
            <ArrowForward sx={{ fontSize: 12, color: 'primary.main' }} />
          </Box>
        </Box>

        {/* ── Scroll container ── */}
        <Box sx={{ position: 'relative' }}>
          {/* Left arrow */}
          {showLeft && !isMobile && (
            <IconButton
              onClick={() => scroll(-1)}
              sx={{
                position: 'absolute', left: 0, top: '50%',
                transform: 'translateY(-50%)',
                zIndex: 5, bgcolor: 'rgba(20,20,20,.85)',
                color: '#fff',
                height: '100%', width: 40, borderRadius: 0,
                '&:hover': { bgcolor: 'rgba(20,20,20,.95)' },
              }}
            >
              <ChevronLeft />
            </IconButton>
          )}

          {/* Right arrow */}
          {showRight && !isMobile && (
            <IconButton
              onClick={() => scroll(1)}
              sx={{
                position: 'absolute', right: 0, top: '50%',
                transform: 'translateY(-50%)',
                zIndex: 5, bgcolor: 'rgba(20,20,20,.85)',
                color: '#fff',
                height: '100%', width: 40, borderRadius: 0,
                '&:hover': { bgcolor: 'rgba(20,20,20,.95)' },
              }}
            >
              <ChevronRight />
            </IconButton>
          )}

          {/* Cards row */}
          <Box
            ref={scrollRef}
            onScroll={handleScrollWithSave}
            onMouseMove={expandOnHover ? handleMouseMove : undefined}
            sx={{
              display: 'flex', gap: { xs: top10 ? 0.5 : 1, md: top10 ? 0.5 : 1.5 },
              overflowX: 'auto', overflowY: 'visible',
              px: { xs: 2, md: 4 },
              scrollbarWidth: 'none',
              '&::-webkit-scrollbar': { display: 'none' },
              // Extra padding to allow hover scale and rank numbers without clipping
              py: top10 ? '40px' : '16px',
              my: top10 ? '-40px' : '-16px',
            }}
          >
            {(!initialLoaded || (loading && records.length === 0))
              ? Array.from({ length: skeletonCount }).map((_, i) => (
                  <RecordCardSkeleton key={i} wide={wide} top10={top10} />
                ))
              : records.map((rec, i) => (
                  expandOnHover ? (
                    <Box
                      key={rec.id}
                      sx={{
                        flexShrink: 0,
                        transform: `translateX(${cardShift(i)}px)`,
                        transition: 'transform 0.32s cubic-bezier(0.4,0,0.2,1)',
                        willChange: 'transform',
                      }}
                    >
                      <RecordCard
                        record={rec}
                        wide={wide}
                        interaction={interactions[rec.id] ?? {}}
                        onWatchlist={onWatchlist}
                        onLike={onLike}
                        onLove={onLove}
                        onWatched={onWatched}
                        expandOnHover
                        index={i}
                        onHoverExpand={handleHoverExpand}
                        expandDir={expand.idx === i ? expand.dir : 'left'}
                      />
                    </Box>
                  ) : (
                    <RecordCard
                      key={rec.id}
                      record={rec}
                      wide={wide}
                      interaction={interactions[rec.id] ?? {}}
                      onWatchlist={onWatchlist}
                      onLike={onLike}
                      onLove={onLove}
                      onWatched={onWatched}
                      rank={top10 ? i + 1 : undefined}
                      expandOnHover={expandOnHover}
                    />
                  )
                ))
            }

            {/* Inline loading more */}
            {loading && records.length > 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', px: 1 }}>
                {[...Array(3)].map((_, i) => <RecordCardSkeleton key={i} wide={wide} />)}
              </Box>
            )}
          </Box>
        </Box>
      </Box>
    </motion.div>
  );
};

export default RailRow;
