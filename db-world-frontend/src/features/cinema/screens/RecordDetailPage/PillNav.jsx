import React, { useEffect, useRef, useState } from 'react';
import { Box, Container, IconButton, Tooltip } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { AnimatePresence, motion } from 'framer-motion';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useT } from '@shared/theme/ThemeContext';

/**
 * Sticky horizontal pill nav with IntersectionObserver-driven scrollspy.
 * Sections is an array of { id, label }. Clicking a pill smooth-scrolls to
 * the matching section element on the page.
 *
 * scrollRoot lets the observer use a custom scroll container — needed when
 * the page is rendered inside a Dialog (the dialog's scroll container, not
 * the viewport, is what actually scrolls).
 *
 * onDismiss, when given, adds a back/close control that appears only once the
 * bar has stuck to the top. This is how Prime Video and Hotstar handle it: the
 * hero's own close scrolls away with the artwork, and the sticky header takes
 * over the job — so there is always exactly one visible way out, and the two
 * never sit on top of each other.
 */
export default function PillNav({ sections, scrollRoot = null, stickyOffset = 0, onDismiss = null }) {
  const T = useT();
  const [active, setActive] = useState(sections[0]?.id);
  const [stuck, setStuck] = useState(false);
  const barRef = useRef(null);
  const sentinelRef = useRef(null);

  // A zero-height marker directly above the bar: once it leaves the top of the
  // scroller, the bar is pinned. Cheaper and less jittery than reading
  // scrollTop on every frame, and it works the same in the page, the dialog and
  // the sheet because it observes whichever root it's given.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(
      ([entry]) => setStuck(!entry.isIntersecting),
      { root: scrollRoot, rootMargin: `-${stickyOffset + 1}px 0px 0px 0px`, threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [scrollRoot, stickyOffset]);

  useEffect(() => {
    if (!sections.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Pick the entry that is most prominently in view.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) setActive(visible[0].target.id);
      },
      {
        root: scrollRoot,
        // Bias toward the top half — so a section feels "active" once its top
        // is reasonably near the sticky pill bar, not only when fully visible.
        rootMargin: `-${stickyOffset + 60}px 0px -45% 0px`,
        threshold: [0, 0.25, 0.5, 0.75, 1],
      },
    );

    sections.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [sections, scrollRoot, stickyOffset]);

  // Center the active pill within the horizontally-scrolling bar.
  // NOTE: must scroll the bar HORIZONTALLY ourselves — never scrollIntoView.
  // The bar is position:sticky, so scrollIntoView uses the pill's in-flow
  // (top-of-content) position and yanks the whole page back to the top, which
  // is what made clicking a tab "scroll then snap back to the start".
  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    const activeEl = bar.querySelector(`[data-id="${active}"]`);
    if (!activeEl) return;
    const left = activeEl.offsetLeft - (bar.clientWidth - activeEl.clientWidth) / 2;
    bar.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
  }, [active]);

  const handleClick = (id) => {
    setActive(id);
    const el = document.getElementById(id);
    if (!el) return;
    // Scroll the KNOWN container explicitly rather than relying on
    // scrollIntoView's nearest-scrollable-ancestor guess, which is unreliable
    // inside a Dialog/sheet. scrollRoot is the dialog/sheet scroller (or null
    // for the full-page/window case). Defer a frame so a just-expanded mobile
    // sheet has switched from locked (overflow:hidden) to scrollable first.
    requestAnimationFrame(() => {
      const root = scrollRoot;
      if (root && typeof root.scrollTo === 'function') {
        const rootRect = root.getBoundingClientRect();
        const elRect   = el.getBoundingClientRect();
        const top = root.scrollTop + (elRect.top - rootRect.top) - stickyOffset - 56;
        root.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
      } else {
        const y = window.scrollY + el.getBoundingClientRect().top - stickyOffset - 64;
        window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
      }
    });
  };

  return (
    <>
      {/* Stuck-detector. Sits in normal flow just above the bar. */}
      <Box ref={sentinelRef} aria-hidden sx={{ height: 1, mt: '-1px' }} />

    <Box sx={{
      position: 'sticky',
      top: stickyOffset,
      zIndex: 10,
      // Lower opacity + saturation boost so content reads as blurring THROUGH the
      // bar as it scrolls behind, rather than sliding under a flat panel.
      //
      // Tinted from the same elevated surface RecordDetailContent paints, not
      // T.bg: in dark mode T.bg is pure AMOLED black while the body sits on
      // #141414, so tinting from T.bg made the bar a visibly darker band.
      bgcolor: alpha(T.bg === '#000000' ? '#141414' : T.bg, 0.72),
      backdropFilter: 'blur(22px) saturate(180%)',
      WebkitBackdropFilter: 'blur(22px) saturate(180%)',
      borderBottom: `1px solid ${alpha(T.text, 0.08)}`,
      boxShadow: `0 2px 16px ${alpha(T.text, 0.06)}`,
    }}>
      {/* Width ladder must match RecordDetailContent's content Container, or the
          pills drift out of alignment with the sections they scroll to. */}
      <Container maxWidth={false} sx={{
        px: { xs: 1, md: 3, xl: 5 },
        maxWidth: { xs: '100%', lg: 1200, xl: 1560 },
        '@media (min-width:1920px)': { maxWidth: 1840, px: 8 },
        mx: 'auto',
        display: 'flex', alignItems: 'center', gap: 1,
      }}>
        {/* Takes over from the hero's close once that has scrolled away. */}
        <AnimatePresence initial={false}>
          {onDismiss && stuck && (
            <Box
              component={motion.div}
              initial={{ width: 0, opacity: 0, marginRight: 0 }}
              animate={{ width: 'auto', opacity: 1 }}
              exit={{ width: 0, opacity: 0, marginRight: 0 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              sx={{ flexShrink: 0, overflow: 'hidden' }}
            >
              <Tooltip title="Back" placement="bottom">
                <IconButton
                  size="small"
                  onClick={onDismiss}
                  aria-label="Back"
                  sx={{
                    width: 34, height: 34,
                    color: T.text,
                    bgcolor: alpha(T.text, 0.08),
                    border: `1px solid ${alpha(T.text, 0.12)}`,
                    '&:hover': { bgcolor: alpha(T.text, 0.16) },
                  }}
                >
                  <ArrowBackIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
            </Box>
          )}
        </AnimatePresence>

        <Box
          ref={barRef}
          sx={{
            display: 'flex', gap: 0.75, py: 1.25, minWidth: 0, flex: 1,
            overflowX: 'auto',
            scrollbarWidth: 'none',
            '&::-webkit-scrollbar': { display: 'none' },
          }}
        >
          {sections.map((s) => {
            const isActive = active === s.id;
            return (
              <Box
                key={s.id}
                data-id={s.id}
                component={motion.button}
                whileTap={{ scale: 0.96 }}
                onClick={() => handleClick(s.id)}
                sx={{
                  position: 'relative',
                  px: { xs: 1.75, sm: 2.25 },
                  py: { xs: 0.75, sm: 0.85 },
                  borderRadius: 999,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  fontSize: { xs: '0.78rem', sm: '0.86rem', xl: '0.95rem' },
                  fontWeight: 700,
                  letterSpacing: 0.2,
                  // Active pill is a solid light chip with dark text — the
                  // streaming-service convention, and it reads as selected at a
                  // glance where a teal fill competed with the teal CTAs.
                  color: isActive ? '#111' : T.textMuted,
                  bgcolor: 'transparent',
                  border: `1px solid ${isActive ? 'transparent' : alpha(T.text, 0.1)}`,
                  flexShrink: 0,
                  transition: 'color .2s, border-color .2s',
                  '&:hover': {
                    color: isActive ? '#111' : T.text,
                    borderColor: isActive ? 'transparent' : alpha(T.text, 0.22),
                  },
                }}
              >
                {isActive && (
                  <Box
                    component={motion.span}
                    layoutId="pill-nav-bg"
                    sx={{
                      position: 'absolute', inset: 0,
                      bgcolor: '#fff',
                      borderRadius: 999,
                      boxShadow: `0 4px 16px ${alpha('#000', 0.4)}`,
                      zIndex: 0,
                    }}
                    transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                  />
                )}
                <Box component="span" sx={{ position: 'relative', zIndex: 1 }}>
                  {s.label}
                </Box>
              </Box>
            );
          })}
        </Box>
      </Container>
    </Box>
    </>
  );
}
