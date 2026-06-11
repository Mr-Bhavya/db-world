import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Box, IconButton } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { motion } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import CloseIcon from '@mui/icons-material/Close';
import { useT } from '@shared/theme/ThemeContext';
import RecordDetailContent from './RecordDetailContent';

/**
 * Mobile record detail — a NON-DRAGGABLE bottom sheet with two snap states.
 *
 *   • Opens at 75% (PEEK). The cinema page stays mounted + dimmed behind it.
 *   • Any interaction at PEEK — scrolling up, tapping a tab, or a navigating
 *     button — promotes it to 100% (FULL). The quick-action toggles
 *     (Like / My List / Love / Watched + Share) are marked [data-noexpand] and
 *     do NOT promote it.
 *   • At FULL, scrolling to the top and continuing to pull down collapses
 *     FULL → PEEK, then closes.
 *   • Pull-down at PEEK, backdrop tap, or the X → animated slide-down close.
 *   • Hardware Back closes immediately (handled by BackButtonHandler).
 *
 * Motion uses translateY (GPU-composited) rather than animating height, so the
 * open/snap/close are smooth. Snap positions are a % of the full-height sheet:
 * peek = shifted down 25% (75% visible), full = 0, closed = fully off-screen.
 */

const SNAP = { peek: '25%', full: '0%', closed: '100%' };

// Gesture thresholds (px).
const EXPAND_SWIPE  = 22;   // upward swipe at PEEK → FULL
const COLLAPSE_PULL = 56;   // downward overscroll at top → FULL→PEEK
const CLOSE_PULL    = 150;  // total downward overscroll at top → close

export default function RecordDetailSheet() {
  const navigate = useNavigate();
  const location = useLocation();
  const T = useT();
  // Match the detail body so any uncovered area (short content, dvh quirks)
  // reads as the surface, never a black bar.
  const surface = T.bg === '#000000' ? '#141414' : T.bg;

  const [mode, setMode] = useState('peek');   // 'peek' | 'full'
  const [closing, setClosing] = useState(false);
  const [scrollEl, setScrollEl] = useState(null);
  const scrollerRef = useRef(null);
  const modeRef = useRef('peek');
  const closingRef = useRef(false);
  modeRef.current = mode;

  const preview = location.state?.cardRecord ?? null;
  // When a cast/crew person is drilled into, the sheet must be a passive
  // full-height container: force FULL, disable snap gestures, and hide its own
  // handle/close so the person view (with its own Back) scrolls normally. The
  // person view is a separate history entry, so the sheet's close() (which
  // pops only one entry) would otherwise leave it half-closed and break the UI.
  const personOpen = !!location.state?.person;
  const target = closing ? 'closed' : ((mode === 'full' || personOpen) ? 'full' : 'peek');
  const isFull = (mode === 'full' || personOpen) && !closing;

  const expand = useCallback(() => {
    if (closingRef.current) return;
    setMode((m) => (m === 'peek' ? 'full' : m));
  }, []);

  // Animated close: slide down, then pop the overlay route once the spring
  // settles (onAnimationComplete). The page underneath is untouched.
  const close = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
  }, []);

  const handleAnimComplete = useCallback(() => {
    if (closingRef.current) navigate(-1);
  }, [navigate]);

  const setScrollerRef = useCallback((node) => {
    scrollerRef.current = node;
    setScrollEl(node);
  }, []);

  // Lock background (window) scroll while open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Drilling into a person implies full height — persist it so returning from
  // the person view doesn't snap the record sheet back to the 75% peek.
  useEffect(() => {
    if (personOpen) setMode('full');
  }, [personOpen]);

  // Any click inside the content promotes PEEK → FULL, except [data-noexpand].
  const onContentClickCapture = useCallback((e) => {
    if (personOpen || modeRef.current !== 'peek') return;
    if (e.target.closest?.('[data-noexpand]')) return;
    expand();
  }, [expand, personOpen]);

  // Gestures. At PEEK the scroller is overflow:hidden so a swipe expands/closes
  // instead of scrolling; at FULL the content scrolls and only an
  // overscroll-at-top pull collapses/closes.
  useEffect(() => {
    const el = scrollEl;
    if (!el || personOpen) return undefined; // gestures off while drilled into a person

    let startY = 0;
    let atTopAnchorY = null;

    const onTouchStart = (e) => { startY = e.touches[0].clientY; atTopAnchorY = null; };

    const onTouchMove = (e) => {
      if (closingRef.current) return;
      const y = e.touches[0].clientY;
      if (modeRef.current === 'peek') {
        const dy = y - startY;
        if (dy <= -EXPAND_SWIPE) { expand(); startY = y; }
        else if (dy >= COLLAPSE_PULL) { close(); }
        return;
      }
      if (el.scrollTop <= 0) {
        if (atTopAnchorY === null) atTopAnchorY = y;
        const over = y - atTopAnchorY;
        if (over >= CLOSE_PULL) { close(); }
        else if (over >= COLLAPSE_PULL) { setMode('peek'); }
      } else {
        atTopAnchorY = null;
      }
    };

    let wheelAccum = 0;
    const onWheel = (e) => {
      if (closingRef.current) return;
      if (modeRef.current === 'peek') {
        if (e.deltaY > 0) expand();
        else if (e.deltaY < 0) close();
        return;
      }
      if (el.scrollTop <= 0 && e.deltaY < 0) {
        wheelAccum += -e.deltaY;
        if (wheelAccum >= CLOSE_PULL) close();
        else if (wheelAccum >= COLLAPSE_PULL) setMode('peek');
      } else {
        wheelAccum = 0;
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

  return (
    <>
      {/* Dimmed backdrop — tap to close. pointerEvents off while closing so a
          faded-but-mounted backdrop can never swallow clicks on the page. */}
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

      {/* Sheet — full height, revealed via translateY. */}
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
        }}
      >
        {/* Grab handle + close are hidden while drilled into a person — the
            person view supplies its own Back/sticky bar. */}
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

        {/* Scroll container. Locked at PEEK so the first swipe expands instead
            of scrolling; free-scrolling at FULL. */}
        <Box
          ref={setScrollerRef}
          onClickCapture={onContentClickCapture}
          sx={{
            flex: 1,
            overflowY: isFull ? 'auto' : 'hidden',
            overflowX: 'hidden',
            overscrollBehavior: 'contain',
            WebkitOverflowScrolling: 'touch',
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
