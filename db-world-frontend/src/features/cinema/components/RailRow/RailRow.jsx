import React, { useRef, useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Box, Typography, IconButton, useMediaQuery, useTheme,
} from '@mui/material';
import { ChevronLeft, ChevronRight } from '@mui/icons-material';
import RecordCard, { RecordCardSkeleton } from '../RecordCard/RecordCard';
import useRailRecords from '../../hooks/useRailRecords';
import useDeviceTier from '../../hooks/useDeviceTier';
import { RAIL_TYPE_CONFIG, RAIL_TYPE_DEFAULT, inferRailType } from './railTypeConfig';

const SCROLL_AMOUNT = 0.75;

const ScrollDots = ({ scrollRef, count = 5 }) => {
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => {
      const max = el.scrollWidth - el.clientWidth;
      if (max <= 0) { setActiveIdx(0); return; }
      setActiveIdx(Math.round((el.scrollLeft / max) * (count - 1)));
    };
    el.addEventListener('scroll', update, { passive: true });
    update();
    return () => el.removeEventListener('scroll', update);
  }, [scrollRef, count]);

  return (
    <Box sx={{ display: 'flex', gap: 0.6, alignItems: 'center', ml: 'auto', flexShrink: 0, pr: 0.5 }}>
      {Array.from({ length: count }).map((_, i) => (
        <Box
          key={i}
          sx={{
            width:  i === activeIdx ? 6 : 4,
            height: i === activeIdx ? 6 : 4,
            borderRadius: '50%',
            bgcolor: i === activeIdx ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.22)',
            transition: 'all 0.18s ease',
            flexShrink: 0,
          }}
        />
      ))}
    </Box>
  );
};

// ─── RailRow ─────────────────────────────────────────────────────────────────

const RailRow = ({
  rail,
  category,
  interactions = {},
  onWatchlist,
  onLike,
  onLove,
  onWatched,
  onExplore,
  eager = false,
  // Legacy boolean props — kept for backward compat with WatchlistRailRow
  wide: wideProp,
  top10: top10Prop,
  expandOnHover: expandOnHoverProp,
}) => {
  const theme    = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm')); // < 600px
  const tier     = useDeviceTier();
  const isTv     = tier === 'tv';

  // Resolve rail type: DTO field wins, then legacy props, then title inference, then default
  const type = inferRailType({ ...rail, type: rail?.type ?? (expandOnHoverProp ? 'prime' : top10Prop ? 'top10' : wideProp ? 'wide' : null) });
  const cfg = RAIL_TYPE_CONFIG[type] ?? RAIL_TYPE_CONFIG[RAIL_TYPE_DEFAULT];

  // Derived flags from config (no more heuristic string matching)
  const expandOnHover = cfg.expandOnHover ?? false;
  const isTop10       = cfg.showRank      ?? false;
  const isBillboard   = cfg.scroll === 'snap';

  const rowRef      = useRef(null);
  const scrollRef   = useRef(null);
  const observerRef = useRef(null);

  const [showLeft,  setShowLeft]  = useState(false);
  const [showRight, setShowRight] = useState(true);

  // Prime-rail expand coordination
  const [expand,   setExpand]   = useState({ idx: null, dir: null });
  const lastXRef   = useRef(null);
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

  // Prime shift: landscape width − portrait width at current desktop tier
  const deskH      = cfg.tiers.desktop;
  const PRIME_SHIFT = Math.round(deskH * 16/9) - Math.round(deskH * 9/16);

  const cardShift = (i) => {
    if (expand.idx == null) return 0;
    if (expand.dir === 'left'  && i < expand.idx) return -PRIME_SHIFT;
    if (expand.dir === 'right' && i > expand.idx) return  PRIME_SHIFT;
    return 0;
  };

  const { records, loading, hasNext, initialLoaded, trigger, loadMore } =
    useRailRecords(rail?.id, rail?.limitSize, rail?.infiniteScroll, category);

  // Lazy load via Intersection Observer
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

  useEffect(() => {
    if (eager && !initialLoaded) trigger();
  }, [eager, initialLoaded, trigger]);

  // Arrow button visibility
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

  // Horizontal scroll persistence
  const hScrollKey = rail?.id ? `cinema_rail_h_${rail.id}` : null;

  useEffect(() => {
    if (!hScrollKey || !records.length || !scrollRef.current) return;
    const saved = parseInt(sessionStorage.getItem(hScrollKey) || '0', 10);
    if (saved > 0) scrollRef.current.scrollLeft = saved;
  // hScrollKey and scrollRef are stable; only restore once when records first load
  }, [records.length]); // eslint-disable-line react-hooks/exhaustive-deps

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
  // clamp covers phone edge → TV overscan (48px) automatically
  const px            = 'clamp(12px, 4vw, 48px)';

  return (
    <motion.div
      ref={rowRef}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
    >
      <Box sx={{ mb: { xs: 2.5, md: 3.5 } }}>

        {/* ── Row header: [Title] [scroll dots] ── */}
        {type !== 'billboard' && (
          <Box
            sx={{ display: 'flex', alignItems: 'center', px: 'clamp(12px, 4vw, 48px)', mb: 1, cursor: 'default', gap: 1 }}
          >
            <Typography
              variant="h6"
              sx={{
                color: '#e5e5e5', fontWeight: 700,
                fontSize: 'clamp(0.95rem, 1.5vw, 1.4rem)',
                letterSpacing: 0.2, flexShrink: 0,
              }}
            >
              {rail.title}
            </Typography>

            {!rail?.infiniteScroll && <ScrollDots scrollRef={scrollRef} />}
          </Box>
        )}

        {/* ── Scroll container ── */}
        <Box sx={{ position: 'relative' }}>
          {/* Left arrow — desktop only, not TV (TV uses D-pad) */}
          {showLeft && !isMobile && !isTv && (
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

          {/* Right arrow — desktop only, not TV */}
          {showRight && !isMobile && !isTv && (
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

          {/* Cards row */}
          <Box
            ref={scrollRef}
            onScroll={handleScrollWithSave}
            onMouseMove={expandOnHover ? handleMouseMove : undefined}
            sx={{
              display: 'flex',
              gap: isTop10 ? 0.5 : { xs: 1, md: 1.5 },
              overflowX: isBillboard ? 'hidden' : 'auto',
              overflowY: 'clip',
              px,
              scrollbarWidth: 'none',
              '&::-webkit-scrollbar': { display: 'none' },
              py: isTop10 ? '72px' : '16px',
              my: isTop10 ? '-72px' : '-16px',
              ...(isBillboard && {
                scrollSnapType: 'x mandatory',
                '& > *': { scrollSnapAlign: 'start' },
              }),
            }}
          >
            {(!initialLoaded || (loading && records.length === 0))
              ? Array.from({ length: skeletonCount }).map((_, i) => (
                  <RecordCardSkeleton key={i} type={type} />
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
                        type={type}
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
                      type={type}
                      interaction={interactions[rec.id] ?? {}}
                      onWatchlist={onWatchlist}
                      onLike={onLike}
                      onLove={onLove}
                      onWatched={onWatched}
                      rank={isTop10 ? i + 1 : undefined}
                    />
                  )
                ))
            }

            {/* Inline loading-more skeletons */}
            {loading && records.length > 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', px: 1 }}>
                {[...Array(3)].map((_, i) => <RecordCardSkeleton key={i} type={type} />)}
              </Box>
            )}
          </Box>
        </Box>
      </Box>
    </motion.div>
  );
};

export default RailRow;
