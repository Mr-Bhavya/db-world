import { useState, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMediaQuery, useTheme } from '@mui/material';
import { openRecord, preloadDetail, rectOf } from '../../../utils/recordNav';
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

  const [hovered, setHovered] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [anchorRect, setAnchorRect] = useState(null);

  const cardRef = useRef(null);
  const hoverTimer = useRef(null);

  const onMouseEnter = useCallback(() => {
    if (isMobile) return;
    if (Date.now() < navBlock.until) return; // suppressed: just navigated from a popup
    preloadDetail(); // warm the detail chunk so the modal opens instantly on click
    // Prime cards open fast for snappy switching; popup-style cards keep a longer
    // intent delay. The grow direction is decided by RailRow (passed as expandDir).
    const delay = expandOnHover ? 110 : useInlineWideHover ? 140 : 380;
    hoverTimer.current = setTimeout(() => {
      if (cardRef.current) setAnchorRect(cardRef.current.getBoundingClientRect());
      setHovered(true);
      if (expandOnHover) onHoverExpand?.(index);
    }, delay);
  }, [isMobile, expandOnHover, onHoverExpand, index, useInlineWideHover]);

  const onMouseLeave = useCallback(() => {
    clearTimeout(hoverTimer.current);
    setHovered(false);
    setAnchorRect(null);
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
    onMouseEnter, onMouseLeave, goDetail, goPlay,
  };
}
