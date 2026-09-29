import React, { useRef, useState, useMemo, useCallback, useEffect, useLayoutEffect } from 'react';
import { motion } from 'framer-motion';
import { Box, Typography, IconButton, Skeleton, useMediaQuery, useTheme } from '@mui/material';
import { ChevronLeft, ChevronRight } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useLocation } from 'react-router-dom';
import { notify } from '@shared/notify';
import Constants from '@shared/constants';
import { getContinueWatching, removeContinueWatching } from '../../api/cinemaApi';
import { openRecord } from '../../utils/recordNav';
import ContinueCard from './ContinueCard';

const SCROLL_AMOUNT = 0.75;
const QUERY_KEY = ['continue-watching'];

/**
 * How long a removed tile stays recoverable.
 *
 * Removing does not hide a tile, it DELETES every scrap of progress the user has for
 * that record — on a small button that sits a few pixels from "more info". Getting that
 * wrong costs you your place in a three-hour film with no way back, so the delete is
 * deferred rather than confirmed: the tile goes at once, the request does not leave for
 * six seconds, and Undo simply cancels it. Nothing to restore because nothing was lost.
 */
const UNDO_MS = 6000;

/**
 * Whether this browser saw anything to resume last time.
 *
 * Without it the rail cannot tell "still loading" from "nothing to resume", so it drew
 * six skeletons on every single page load and then collapsed to nothing for every user
 * who had finished everything — a ~200px jump, every time. The flag is a hint, not
 * state: wrong at worst once, after which it corrects itself.
 */
const HAD_ITEMS_KEY = 'db-cw-had-items';
const readHadItems = () => {
  try { return window.localStorage.getItem(HAD_ITEMS_KEY) === '1'; } catch { return false; }
};
const writeHadItems = (had) => {
  try { window.localStorage.setItem(HAD_ITEMS_KEY, had ? '1' : '0'); } catch { /* private mode */ }
};

// Loading placeholder that matches ContinueCard's footprint (16:9 + teal progress
// bar; mobile has a title line below) so the row doesn't jump when cards arrive.
const ContinueCardSkeleton = ({ isMobile }) => (
  <Box sx={{ flexShrink: 0, width: { xs: 230, sm: 260, md: 300 } }}>
    <Box sx={{
      position: 'relative', width: '100%', aspectRatio: '16/9', borderRadius: 1,
      overflow: 'hidden', bgcolor: 'rgba(255,255,255,.06)',
    }}>
      <Skeleton variant="rectangular" width="100%" height="100%"
        sx={{ bgcolor: 'rgba(255,255,255,.06)', '@media (prefers-reduced-motion: reduce)': { animation: 'none' } }} />
      <Box sx={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 4, bgcolor: 'rgba(255,255,255,.12)' }} />
    </Box>
    {isMobile && (
      <Skeleton variant="text" width="60%" height={16} sx={{ mt: 0.6, bgcolor: 'rgba(255,255,255,.06)' }} />
    )}
  </Box>
);

/**
 * Continue Watching row — self-contained: fetches the enriched resume tiles,
 * renders a progress bar + resume-on-click + remove per card, and hides itself
 * when there's nothing to resume. Completed titles are filtered server-side.
 */
const ContinueRailRow = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();

  const scrollRef = useRef(null);
  const [showLeft, setShowLeft] = useState(false);
  // Starts false and is computed before paint. Starting true flashed a right-hand
  // chevron on rows that do not overflow.
  const [showRight, setShowRight] = useState(false);

  const hadItemsLastVisit = useRef(readHadItems());

  const { data: items = [], isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: getContinueWatching,
    staleTime: 60 * 1000,
    // Resume positions go stale the moment you watch anything. Returning from the
    // player inside the stale window left every bar showing where you were BEFORE.
    refetchOnMount: 'always',
  });

  useEffect(() => {
    if (!isLoading) writeHadItems(items.length > 0);
  }, [isLoading, items.length]);

  /** Tiles removed but still inside their undo window. */
  const [pendingIds, setPendingIds] = useState(() => new Set());
  const timers = useRef(new Map());

  const visible = useMemo(
    () => (pendingIds.size ? items.filter((i) => !pendingIds.has(i.recordId)) : items),
    [items, pendingIds],
  );

  const dropPending = useCallback((recordId) => {
    setPendingIds((prev) => {
      if (!prev.has(recordId)) return prev;
      const next = new Set(prev);
      next.delete(recordId);
      return next;
    });
  }, []);

  const removeMut = useMutation({
    mutationFn: (recordId) => removeContinueWatching(recordId),
    onError: () => notify.error('Could not remove that — putting it back.'),
    // Clear the pending flag only AFTER the refetch lands, or the tile flashes back
    // between the local drop and the server's answer. On failure the refetch still has
    // the record, so releasing the flag is exactly what restores it.
    onSettled: async (_data, _error, recordId) => {
      await qc.invalidateQueries({ queryKey: QUERY_KEY });
      dropPending(recordId);
    },
  });

  const onRemove = useCallback((item) => {
    if (timers.current.has(item.recordId)) return;
    setPendingIds((prev) => new Set(prev).add(item.recordId));

    const timer = setTimeout(() => {
      timers.current.delete(item.recordId);
      removeMut.mutate(item.recordId);
    }, UNDO_MS);
    timers.current.set(item.recordId, timer);

    notify.message(`Removed ${item.title}`, {
      duration: UNDO_MS,
      action: {
        label: 'Undo',
        onClick: () => {
          const t = timers.current.get(item.recordId);
          // No timer means the window already closed and the delete is in flight;
          // un-hiding now would flash the tile back until the refetch removed it again.
          if (!t) return;
          clearTimeout(t);
          timers.current.delete(item.recordId);
          // The query data was never touched, so the tile returns to its own place.
          dropPending(item.recordId);
        },
      },
    });
  }, [removeMut, dropPending]);

  // Leaving the page is a decision too: send anything still waiting rather than
  // silently keeping progress the user asked to drop.
  useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach((timer, recordId) => {
        clearTimeout(timer);
        removeContinueWatching(recordId).catch(() => { /* best effort on unmount */ });
      });
      map.clear();
    };
  }, []);

  const onResume = useCallback((item) => {
    // Navigate instantly; the player resolves the CDN URL + rich episode metadata on
    // mount from the mediaFileId in the URL (buildMediaFromFileId), using these hints to
    // skip the record lookup. Removes the old tap-to-open lag.
    navigate(Constants.playerPath(item.resumeFileId), {
      state: { resume: { recordId: item.recordId, title: item.title, type: item.type } },
    });
  }, [navigate]);

  // Open the record's detail overlay (modal on desktop, sheet on mobile) — the
  // ✕ removes and the card taps resume, so details need their own affordance.
  const onInfo = useCallback((item, rect) => {
    openRecord(
      navigate, location,
      {
        id: item.recordId, title: item.title, type: item.type,
        posterPath: item.posterPath, backdropPath: item.backdropPath, logoPath: item.logoPath,
      },
      rect ? { originRect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height } } : {},
    );
  }, [navigate, location]);

  const updateButtons = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setShowLeft(el.scrollLeft > 8);
    setShowRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 8);
  }, []);

  // Before paint, and again whenever the row itself changes size — a window resize
  // can start or stop the overflow without any scroll event ever firing.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    updateButtons();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(updateButtons);
    ro.observe(el);
    return () => ro.disconnect();
  }, [updateButtons, visible.length]);

  const scroll = (dir) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * SCROLL_AMOUNT, behavior: 'smooth' });
  };

  // Skeletons are only honest for someone who had something to resume last time;
  // for everyone else the rail stays out of the layout until it has news.
  const showSkeletons = isLoading && items.length === 0 && hadItemsLastVisit.current;
  if (isLoading && !showSkeletons) return null;
  if (!isLoading && visible.length === 0) return null;

  const chevronSx = {
    position: 'absolute', top: '50%', transform: 'translateY(-50%)',
    zIndex: 8, bgcolor: 'rgba(20,20,20,.85)', color: '#fff', height: '100%', width: 40,
    borderRadius: 0, '&:hover': { bgcolor: 'rgba(20,20,20,.95)' },
    '&:focus-visible': { outline: '3px solid #0d9488', outlineOffset: -3 },
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
    >
      <Box component="section" aria-label="Continue Watching" sx={{ mb: { xs: 2.5, md: 3.5 } }}>
        <Box sx={{ px: 'clamp(12px, 4vw, 48px)', mb: 1 }}>
          <Typography variant="h6" sx={{
            color: '#e5e5e5', fontWeight: 700,
            fontSize: 'clamp(0.95rem, 1.5vw, 1.4rem)', letterSpacing: 0.2,
          }}>
            Continue Watching
          </Typography>
        </Box>

        <Box sx={{ position: 'relative' }}>
          {showLeft && !isMobile && (
            <IconButton aria-label="Scroll left" onClick={() => scroll(-1)} sx={{ ...chevronSx, left: 0 }}>
              <ChevronLeft />
            </IconButton>
          )}
          {showRight && !isMobile && (
            <IconButton aria-label="Scroll right" onClick={() => scroll(1)} sx={{ ...chevronSx, right: 0 }}>
              <ChevronRight />
            </IconButton>
          )}

          <Box
            ref={scrollRef}
            // One listener. This element also carried an onScroll prop, so every scroll
            // event ran updateButtons twice.
            onScroll={updateButtons}
            sx={{
              display: 'flex', gap: { xs: 1, md: 1.5 },
              overflowX: 'auto', overflowY: 'visible',
              px: 'clamp(12px, 4vw, 48px)', py: '16px', my: '-16px',
              scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' },
            }}
          >
            {showSkeletons
              ? Array.from({ length: 6 }).map((_, i) => (
                  <ContinueCardSkeleton key={`sk-${i}`} isMobile={isMobile} />
                ))
              : visible.map((item) => (
                  <ContinueCard
                    key={item.recordId}
                    item={item}
                    onResume={onResume}
                    onRemove={onRemove}
                    onInfo={onInfo}
                    isMobile={isMobile}
                  />
                ))}
          </Box>
        </Box>
      </Box>
    </motion.div>
  );
};

export default ContinueRailRow;
