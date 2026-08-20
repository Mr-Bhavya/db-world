import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, IconButton } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { motion } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import CloseIcon from '@mui/icons-material/Close';
import { useT } from '@shared/theme/ThemeContext';
import RecordDetailContent from './RecordDetailContent';
import { HERO_CONTROL_SIZE, HERO_CONTROL_TOP } from './HeroTrailer';

const SNAP = { peek: '25%', full: '0%', closed: '100%' };

const EXPAND_SWIPE  = 22;
const COLLAPSE_PULL = 56;
const CLOSE_PULL    = 150;

// Reference-counted body scroll lock. A record→person→record drill-in can remount this sheet
// (a different-type record swaps the matched overlay <Route>), so two instances briefly overlap.
// The old save/restore-`prev` pattern then snapshotted `overflow:hidden` as the "previous" value
// and restored THAT on the final close — leaving the cinema page permanently scroll-locked. The
// counter only touches the body when the first sheet locks and the last one unlocks, and always
// clears to '' (never re-applies a stale 'hidden').
let _bodyLockCount = 0;
function lockBodyScroll() {
  if (_bodyLockCount === 0) document.body.style.overflow = 'hidden';
  _bodyLockCount += 1;
}
function unlockBodyScroll() {
  _bodyLockCount = Math.max(0, _bodyLockCount - 1);
  if (_bodyLockCount === 0) document.body.style.overflow = '';
}

export default function RecordDetailSheet() {
  const navigate = useNavigate();
  const location = useLocation();
  const T = useT();

  // Memoize surface so it doesn't recalculate every render
  const surface = useMemo(() => T.bg === '#000000' ? '#141414' : T.bg, [T.bg]);

  const [mode, setMode] = useState('peek');
  const [closing, setClosing] = useState(false);
  const [scrollEl, setScrollEl] = useState(null);
  // The close sits OUTSIDE the scroller (so it survives at peek height, where
  // scrolling is disabled), which means it can't scroll away on its own. Once
  // the pill nav sticks it would sit right on top of it, so it retires and
  // PillNav's own back control takes over.
  const [scrolledPastHero, setScrolledPastHero] = useState(false);

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
  const handleAnimComplete = useCallback(() => {
    if (closingRef.current && !navigatedRef.current) {
      navigatedRef.current = true; // guard against double fire
      // Dismiss straight back to the background page (the cinema page the overlay was opened
      // over) — same as the desktop modal. A plain navigate(-1) would only unwind ONE history
      // entry, so closing a record opened from a person view would re-surface the person view
      // instead of returning to cinema.
      const background = location.state?.background;
      if (background) {
        navigate(background.pathname + (background.search ?? ''), { replace: true });
      } else {
        navigate(-1);
      }
    }
  }, [navigate, location.state]);

  // Single ref callback — no dual tracking
  const setScrollerRef = useCallback((node) => {
    setScrollEl(node);
  }, []);

  // Lock background scroll (ref-counted — survives a record→person→record remount).
  useEffect(() => {
    lockBodyScroll();
    return () => unlockBodyScroll();
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

  // Retire the close once the pill nav has taken over the corner.
  useEffect(() => {
    const el = scrollEl;
    if (!el) return undefined;
    const onScroll = () => setScrolledPastHero(el.scrollTop > 24);
    onScroll();
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [scrollEl]);

  return (
    <>
      {/* Dimmed backdrop. Blur and dim track the sheet's snap position, so the page
          behind falls further out of focus as the sheet takes over the screen —
          the sheet reads as rising through depth rather than sliding over a flat scrim. */}
      <Box
        component={motion.div}
        onClick={close}
        initial={{ opacity: 0, backdropFilter: 'blur(0px)', backgroundColor: alpha('#000', 0) }}
        animate={{
          opacity: closing ? 0 : 1,
          backdropFilter: closing ? 'blur(0px)' : isFull ? 'blur(14px)' : 'blur(3px)',
          // Dim animated by framer alongside the blur instead of by a CSS transition:
          // two properties of one movement were being driven by two different curves,
          // so the darkening and the defocusing arrived at slightly different times.
          backgroundColor: alpha('#000', closing ? 0 : isFull ? 0.72 : 0.55),
        }}
        transition={{ duration: 0.34, ease: [0.32, 0.72, 0, 1] }}
        sx={{
          position: 'fixed', inset: 0, zIndex: 1299,
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
        {/* The handle FLOATS over the artwork rather than sitting in a 16px band of its
            own above it. That band read as a border drawn across the top of the sheet,
            and it pushed the artwork down away from the sheet's rounded edge; overlaid,
            the poster runs right to the top and the sheet reads as the artwork itself
            rising into view — which is what iOS sheets, Apple Music and Hotstar all do.
            
            White with a shadow, not a theme colour: it now sits on ARTWORK, which can be
            any brightness, so `T.text` would vanish against a pale poster. */}
        {!personOpen && (
          <Box aria-hidden sx={{
            position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)',
            zIndex: 31, pointerEvents: 'none',
            width: 42, height: 4, borderRadius: 2,
            bgcolor: alpha('#fff', 0.62),
            boxShadow: '0 1px 4px rgba(0,0,0,0.55)',
          }} />
        )}

        {!personOpen && !scrolledPastHero && (
          <IconButton
            onClick={close}
            size="small"
            aria-label="Close"
            sx={{
              // Left, matching the back affordance on the full-page hero and
              // leaving the top-right free for the trailer controls.
              //
              // Plain HERO_CONTROL_TOP now: the scroller starts at the sheet's very top,
              // so this shares an origin with the trailer's mute/replay controls inside
              // the hero. It used to add the grab-handle band's 16px on top, which is
              // exactly the kind of arithmetic that goes stale when the layout changes.
              // Both are HERO_CONTROL_SIZE, so their centres agree and not just their
              // top edges.
              position: 'absolute',
              top: HERO_CONTROL_TOP,
              left: 10, zIndex: 30,
              bgcolor: alpha('#000', 0.55), color: '#fff',
              border: `1px solid ${alpha('#fff', 0.18)}`,
              backdropFilter: 'blur(8px)',
              width: HERO_CONTROL_SIZE, height: HERO_CONTROL_SIZE,
              transition: 'opacity .2s',
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