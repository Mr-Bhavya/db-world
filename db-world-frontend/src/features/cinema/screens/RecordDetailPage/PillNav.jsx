import React, { useEffect, useRef, useState } from 'react';
import { Box, Container } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { motion } from 'framer-motion';
import { useT } from '@shared/theme/ThemeContext';

/**
 * Sticky horizontal pill nav with IntersectionObserver-driven scrollspy.
 * Sections is an array of { id, label }. Clicking a pill smooth-scrolls to
 * the matching section element on the page.
 *
 * scrollRoot lets the observer use a custom scroll container — needed when
 * the page is rendered inside a Dialog (the dialog's scroll container, not
 * the viewport, is what actually scrolls).
 */
export default function PillNav({ sections, scrollRoot = null, stickyOffset = 0 }) {
  const T = useT();
  const [active, setActive] = useState(sections[0]?.id);
  const barRef = useRef(null);

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

  // Center the active pill within the horizontally-scrolling bar (mobile).
  useEffect(() => {
    if (!barRef.current) return;
    const activeEl = barRef.current.querySelector(`[data-id="${active}"]`);
    if (activeEl && typeof activeEl.scrollIntoView === 'function') {
      activeEl.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [active]);

  const handleClick = (id) => {
    setActive(id);
    const el = document.getElementById(id);
    if (!el) return;
    if (scrollRoot) {
      // el.offsetTop is relative to the section's offsetParent, which is NOT
      // the Dialog Paper in modal mode — so the old math overshot or missed.
      // Use getBoundingClientRect against the scrollRoot's own viewport rect
      // to compute the true scroll target.
      const elRect   = el.getBoundingClientRect();
      const rootRect = scrollRoot.getBoundingClientRect();
      const top = scrollRoot.scrollTop + (elRect.top - rootRect.top) - stickyOffset - 12;
      scrollRoot.scrollTo({ top, behavior: 'smooth' });
    } else {
      const y = el.getBoundingClientRect().top + window.scrollY - stickyOffset - 12;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  return (
    <Box sx={{
      position: 'sticky',
      top: stickyOffset,
      zIndex: 10,
      bgcolor: alpha(T.bg, 0.85),
      backdropFilter: 'blur(12px)',
      borderBottom: `1px solid ${alpha(T.text, 0.08)}`,
      boxShadow: `0 2px 16px ${alpha(T.text, 0.06)}`,
    }}>
      <Container maxWidth="lg" sx={{ px: { xs: 1, md: 3 } }}>
        <Box
          ref={barRef}
          sx={{
            display: 'flex', gap: 0.75, py: 1.25,
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
                  border: 'none',
                  borderRadius: 999,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  fontSize: { xs: '0.78rem', sm: '0.86rem' },
                  fontWeight: 700,
                  letterSpacing: 0.2,
                  color: isActive ? '#fff' : T.textMuted,
                  bgcolor: 'transparent',
                  flexShrink: 0,
                  transition: 'color .2s',
                  '&:hover': { color: isActive ? '#fff' : T.text },
                }}
              >
                {isActive && (
                  <Box
                    component={motion.span}
                    layoutId="pill-nav-bg"
                    sx={{
                      position: 'absolute', inset: 0,
                      bgcolor: T.teal,
                      borderRadius: 999,
                      boxShadow: `0 4px 14px ${alpha('#0d9488', 0.35)}`,
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
  );
}
