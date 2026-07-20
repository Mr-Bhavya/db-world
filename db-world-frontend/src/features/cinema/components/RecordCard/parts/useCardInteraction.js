import { useState, useRef, useCallback, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMediaQuery, useTheme } from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { openRecord, preloadDetail, rectOf } from '../../../utils/recordNav';
import { fetchRecord } from '../../../api/cinemaApi';
import useDeviceTier from '../../../hooks/useDeviceTier';
import { navBlock } from './cardHelpers';

// Shared per-card interaction state + handlers (hover intent, refs, device tier,
// navigation). Used by every card type so the behaviour stays identical.
export default function useCardInteraction({ expandOnHover, useInlineWideHover, index, onHoverExpand, record }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const tier = useDeviceTier();
  const isTv = tier === 'tv';
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();

  const [hovered, setHovered] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [anchorRect, setAnchorRect] = useState(null);

  const cardRef = useRef(null);
  const hoverTimer = useRef(null); // delayed open  (intent-to-enter)
  const leaveTimer = useRef(null); // delayed close (intent-to-leave)

  useEffect(() => () => {
    clearTimeout(hoverTimer.current);
    clearTimeout(leaveTimer.current);
  }, []);

  const onMouseEnter = useCallback(() => {
    if (isMobile) return;
    // Re-entering (e.g. moving back onto the overflowing overlay) cancels a
    // pending collapse, so quick boundary crossings don't toggle the card.
    clearTimeout(leaveTimer.current);
    if (Date.now() < navBlock.until) return; // suppressed: just navigated from a popup
    if (hovered) return;                      // already open — nothing to schedule
    preloadDetail(); // warm the detail chunk so the modal opens instantly on click
    // Prime cards open fast for snappy switching; popup-style cards keep a longer
    // intent delay. The grow direction is decided by RailRow (passed as expandDir).
    const delay = expandOnHover ? 110 : useInlineWideHover ? 140 : 380;
    hoverTimer.current = setTimeout(() => {
      if (cardRef.current) setAnchorRect(cardRef.current.getBoundingClientRect());
      setHovered(true);
      // Warm the DETAIL DATA (not just the chunk) so the modal usually opens with
      // the full record already cached → the preview→full fill is instant, no flash.
      // Same key/fetcher RecordDetailContent uses; staleTime dedupes repeat hovers.
      if (record?.id != null) {
        qc.prefetchQuery({
          queryKey: ['cinema-record', String(record.id)],
          queryFn: () => fetchRecord(record.id),
          staleTime: 5 * 60 * 1000,
        });
      }
      if (expandOnHover) onHoverExpand?.(index);
    }, delay);
  }, [isMobile, expandOnHover, onHoverExpand, index, useInlineWideHover, hovered, qc, record]);

  const onMouseLeave = useCallback(() => {
    // Cancel any not-yet-fired open first.
    clearTimeout(hoverTimer.current);
    // Symmetric intent: hold the expanded state briefly so the gap between two
    // adjacent cards (or the slot/overlay seam) doesn't trigger an instant
    // collapse → re-expand flicker. Re-entering within this window cancels it.
    const CLOSE_DELAY = expandOnHover ? 90 : useInlineWideHover ? 80 : 60;
    clearTimeout(leaveTimer.current);
    leaveTimer.current = setTimeout(() => {
      setHovered(false);
      // NB: keep anchorRect — the popup's exit animation still needs it. It's
      // recomputed on the next enter, so a stale value here is harmless.
      if (expandOnHover) onHoverExpand?.(null, null);
    }, CLOSE_DELAY);
  }, [expandOnHover, useInlineWideHover, onHoverExpand]);

  // Immediate close (no intent delay) — used to dismiss the hover popup on scroll,
  // so it vanishes at once instead of hanging frozen through a drag-scroll.
  const closeNow = useCallback(() => {
    clearTimeout(hoverTimer.current);
    clearTimeout(leaveTimer.current);
    setHovered(false);
    if (expandOnHover) onHoverExpand?.(null, null);
  }, [expandOnHover, onHoverExpand]);

  // Always open the detail as an OVERLAY (background location set): a bottom sheet
  // on mobile, a Netflix modal on desktop. The page stays mounted.
  const goDetail = useCallback((e) => {
    e?.stopPropagation();
    openRecord(navigate, location, record, { originRect: rectOf(e?.currentTarget) });
  }, [navigate, location, record]);

  const goPlay = useCallback((e) => {
    e?.stopPropagation();
    openRecord(navigate, location, record, { play: true });
  }, [navigate, location, record]);

  return {
    isMobile, tier, isTv,
    hovered, anchorRect, cardRef,
    imgError, imgLoaded, setImgError, setImgLoaded,
    onMouseEnter, onMouseLeave, closeNow, goDetail, goPlay,
  };
}