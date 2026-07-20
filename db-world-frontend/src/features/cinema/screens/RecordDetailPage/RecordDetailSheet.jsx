import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, IconButton } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { motion } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import CloseIcon from '@mui/icons-material/Close';
import { useT } from '@shared/theme/ThemeContext';
import RecordDetailContent from './RecordDetailContent';

const SNAP = { peek: '25%', full: '0%', closed: '100%' };

const EXPAND_SWIPE  = 22;
const COLLAPSE_PULL = 56;
const CLOSE_PULL    = 150;

export default function RecordDetailSheet() {
  const navigate = useNavigate();
  const location = useLocation();
  const T = useT();

  // Memoize surface so it doesn't recalculate every render
  const surface = useMemo(() => T.bg === '#000000' ? '#141414' : T.bg, [T.bg]);

  const [mode, setMode] = useState('peek');
  const [closing, setClosing] = useState(false);
  const [scrollEl, setScrollEl] = useState(null);

  // Refs for gesture handlers (avoid stale closures)
  const modeRef = useRef(mode);
  const closingRef = useRef(false);
  const navigatedRef = useRef(false); // ← guard against double navigate

  // Sync refs
  modeRef.current = mode;
  closingRef.current = closing;

  const preview = location.state?.cardRecord ?? null;
  const personOpen = !!location.state?.person;
  const target = closing ? 'closed' : ((mode === 'full' || personOpen) ? 'full' : 'peek');
  const isFull = (mode === 'full' || personOpen) && !closing;

  const expand = useCallback(() => {
    if (closingRef.current) return;
    setMode((m) => (m === 'peek' ? 'full' : m));
  }, []);

  const close = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
  }, []);

  // FIX #1: Only navigate on close animation, not peek↔full transitions.
  // Check `closingRef` instead of relying on animation type.
  const handleAnimComplete = useCallback((definition) => {
    if (closingRef.current && !navigatedRef.current) {
      navigatedRef.current = true; // guard against double fire
      navigate(-1);
    }
  }, [navigate]);

  // Single ref callback — no dual tracking
  const setScrollerRef = useCallback((node) => {
    setScrollEl(node);
  }, []);

  // Lock background scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Person drill-in → force full
  useEffect(() => {
    if (personOpen) setMode('full');
  }, [personOpen]);

  // Click-to-expand at PEEK
  const onContentClickCapture = useCallback((e) => {
    if (personOpen || modeRef.current !== 'peek') return;
    if (e.target.closest?.('[data-noexpand]')) return;
    expand();
  }, [expand, personOpen]);

  // Gesture handlers
  useEffect(() => {
    const el = scrollEl;
    if (!el || personOpen) return;

    let startY = 0;
    let atTopAnchorY = null;
    let wheelAccum = 0;
    let lastWheelDir = 0; // FIX #3: track wheel direction

    const onTouchStart = (e) => {
      startY = e.touches[0].clientY;
      atTopAnchorY = null;
    };

    const onTouchMove = (e) => {
      if (closingRef.current) return;
      const y = e.touches[0].clientY;

      if (modeRef.current === 'peek') {
        const dy = y - startY;
        if (dy <= -EXPAND_SWIPE) { expand(); startY = y; }
        else if (dy >= COLLAPSE_PULL) { close(); }
        return;
      }

      // FULL mode — overscroll-at-top detection
      if (el.scrollTop <= 0) {
        if (atTopAnchorY === null) atTopAnchorY = y;
        const over = y - atTopAnchorY;
        if (over >= CLOSE_PULL) { close(); }
        else if (over >= COLLAPSE_PULL) { setMode('peek'); }
      } else {
        atTopAnchorY = null;
      }
    };

    const onWheel = (e) => {
      if (closingRef.current) return;

      if (modeRef.current === 'peek') {
        if (e.deltaY > 0) expand();
        else if (e.deltaY < 0) close();
        return;
      }

      if (el.scrollTop <= 0 && e.deltaY < 0) {
        // FIX #3: Reset accumulator on direction change
        const dir = Math.sign(e.deltaY);
        if (dir !== lastWheelDir) { wheelAccum = 0; lastWheelDir = dir; }

        wheelAccum += -e.deltaY;
        if (wheelAccum >= CLOSE_PULL) close();
        else if (wheelAccum >= COLLAPSE_PULL) setMode('peek');
      } else {
        wheelAccum = 0;
        lastWheelDir = 0;
      }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: true });
    el.addEventListener('wheel', onWheel, { passive: true });

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('wheel', onWheel);
    };
  }, [scrollEl, expand, close, personOpen]);

  // FIX #4: Prevent pull-to-refresh on Android/iOS when at PEEK or at top of FULL
  useEffect(() => {
    const el = scrollEl;
    if (!el) return;

    const preventPullToRefresh = (e) => {
      if (modeRef.current === 'peek') {
        // At PEEK, all vertical touch is handled by our gesture — block browser default
        if (e.cancelable) e.preventDefault();
        return;
      }
      // At FULL, only prevent if at scroll top and pulling down
      if (el.scrollTop <= 0 && e.touches[0]?.clientY > (e.target._touchStartY ?? 0)) {
        if (e.cancelable) e.preventDefault();
      }
    };

    const captureStart = (e) => {
      // Store touch start Y on the target for the move handler
      e.target._touchStartY = e.touches[0].clientY;
    };

    el.addEventListener('touchstart', captureStart, { passive: true });
    el.addEventListener('touchmove', preventPullToRefresh, { passive: false });

    return () => {
      el.removeEventListener('touchstart', captureStart);
      el.removeEventListener('touchmove', preventPullToRefresh);
    };
  }, [scrollEl]);

  return (
    <>
      {/* Dimmed backdrop */}
      <Box
        component={motion.div}
        onClick={close}
        initial={{ opacity: 0 }}
        animate={{ opacity: closing ? 0 : 1 }}
        transition={{ duration: 0.28, ease: 'easeOut' }}
        sx={{
          position: 'fixed', inset: 0, zIndex: 1299,
          bgcolor: alpha('#000', 0.55),
          backdropFilter: 'blur(2px)',
          pointerEvents: closing ? 'none' : 'auto',
        }}
      />

      {/* Sheet */}
      <Box
        component={motion.div}
        initial={{ y: '100%' }}
        animate={{
          y: SNAP[target],
          borderTopLeftRadius: isFull ? 0 : 20,
          borderTopRightRadius: isFull ? 0 : 20,
        }}
        transition={{ type: 'spring', stiffness: 420, damping: 44, mass: 0.85 }}
        onAnimationComplete={handleAnimComplete}
        sx={{
          position: 'fixed', left: 0, right: 0, top: 0,
          height: '100dvh', zIndex: 1300,
          bgcolor: surface,
          overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 -16px 56px rgba(0,0,0,0.6)',
          willChange: 'transform',
          // FIX #4: Prevent overscroll bounce on iOS
          overscrollBehavior: 'none',
        }}
      >
        {!personOpen && (
          <Box sx={{ flexShrink: 0, display: 'flex', justifyContent: 'center', pt: 1, pb: 0.5 }}>
            <Box sx={{ width: 42, height: 4, borderRadius: 2, bgcolor: alpha(T.text, 0.22) }} />
          </Box>
        )}

        {!personOpen && (
          <IconButton
            onClick={close}
            size="small"
            aria-label="Close"
            sx={{
              position: 'absolute', top: 8, right: 10, zIndex: 30,
              bgcolor: alpha('#000', 0.55), color: '#fff',
              border: `1px solid ${alpha('#fff', 0.18)}`,
              backdropFilter: 'blur(8px)',
              width: 34, height: 34,
              '&:hover': { bgcolor: alpha('#000', 0.8) },
            }}
          >
            <CloseIcon sx={{ fontSize: 18 }} />
          </IconButton>
        )}

        <Box
          ref={setScrollerRef}
          onClickCapture={onContentClickCapture}
          sx={{
            flex: 1,
            overflowY: isFull ? 'auto' : 'hidden',
            overflowX: 'hidden',
            overscrollBehavior: 'contain',
          }}
        >
          <RecordDetailContent
            inModal
            scrollRoot={scrollEl}
            onClose={close}
            stickyOffset={0}
            preview={preview}
          />
        </Box>
      </Box>
    </>
  );
}