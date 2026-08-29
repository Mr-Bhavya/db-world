import React, { useEffect, useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { motion, AnimatePresence } from 'framer-motion';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import OndemandVideoIcon from '@mui/icons-material/OndemandVideo';

import { tmdbImg } from '../../api/cinemaApi';
import { HERO_ACCENT, ctaPrimary, ctaShape } from './shared/ctaShape';

const SHOW_AFTER_PX = 380;

/**
 * Mobile-only: once the hero has scrolled away, playback comes back as a compact
 * bar so it's never more than one tap off. Reads whichever element actually
 * scrolls — the page on a cold load, the dialog/sheet scroller inside an overlay.
 */
export default function StickyWatchBar({ record, progress, onWatchClick, scrollRoot }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const target = scrollRoot ?? window;
    const read = () => (scrollRoot ? scrollRoot.scrollTop : window.scrollY);

    let frameId = null;
      // Coalesced to one read per frame. A scroll listener that calls setState fires far
      // more often than the screen refreshes, and each call runs React's bail-out path
      // even when the boolean has not changed — on a low-end phone that is work competing
      // with the scroll it is measuring. Same shape as the global header's handler.
    const onScroll = () => {
      if (frameId) return;
      frameId = window.requestAnimationFrame(() => {
        setVisible(read() > SHOW_AFTER_PX);
        frameId = null;
      });
    };
    onScroll();

    target.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      target.removeEventListener('scroll', onScroll);
      if (frameId) window.cancelAnimationFrame(frameId);
    };
  }, [scrollRoot]);

  if (!onWatchClick) return null;

  const tmdb = record?.tmdb ?? {};
  const poster = tmdbImg(tmdb.posterPath, 'w154');
  const resumable = progress?.percent > 0 && progress?.percent < 97;

  return (
    <AnimatePresence>
      {visible && (
        <Box
          component={motion.div}
          data-noexpand
          initial={{ y: '120%' }}
          animate={{ y: 0 }}
          exit={{ y: '120%' }}
          transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
          sx={{
            position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 1200,
            display: { xs: 'flex', md: 'none' },
            alignItems: 'center', gap: 1.25,
            px: 2, pt: 1.25,
            pb: 'calc(10px + env(safe-area-inset-bottom))',
            bgcolor: alpha('#0a0a0a', 0.88),
            backdropFilter: 'blur(20px) saturate(180%)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            borderTop: `1px solid ${alpha('#fff', 0.08)}`,
          }}
        >
          {poster && (
            <Box
              component="img"
              src={poster}
              alt=""
              draggable={false}
              sx={{
                width: 34, aspectRatio: '2/3', flexShrink: 0,
                borderRadius: 0.75, objectFit: 'cover',
                border: `1px solid ${alpha('#fff', 0.12)}`,
              }}
            />
          )}

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{
              fontSize: '0.8rem', fontWeight: 800, color: '#fff',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {tmdb.title ?? record?.name}
            </Typography>
            {resumable && progress?.remainingLabel && (
              <Typography sx={{ fontSize: '0.66rem', fontWeight: 600, color: alpha('#fff', 0.5) }}>
                {progress.remainingLabel} left
              </Typography>
            )}
          </Box>

          <Button
            component={motion.button}
            whileTap={{ scale: 0.97 }}
            variant="contained"
            startIcon={resumable
              ? <PlayArrowIcon sx={{ fontSize: '1.1rem !important' }} />
              : <OndemandVideoIcon sx={{ fontSize: '1.1rem !important' }} />}
            onClick={onWatchClick}
            // Same shape and teal as the hero's Watch button, from the same source —
            // this bar stands in for that button, so a drift in either was visible on
            // the way back up the page. `compact` keeps it small enough to share the
            // row with the poster and title.
            sx={{ ...ctaShape({ compact: true }), ...ctaPrimary(HERO_ACCENT) }}
          >
            {resumable ? 'Resume' : 'Watch'}
          </Button>
        </Box>
      )}
    </AnimatePresence>
  );
}
