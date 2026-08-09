import React, { useCallback, useMemo } from 'react';
import { Box, useMediaQuery } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { CYCLE_MS, FADE_SECS } from '../HeroBanner/heroUtils';
import ArtBackdrop from './ArtBackdrop';
import { BillboardContent, Top10Badge, heroMetrics, BORDER } from './billboardParts';

const EASE = [0.22, 1, 0.36, 1];

/**
 * HOME spotlight hero — a rounded inset card sitting in a soft glow of the title's dominant colour.
 * Cover image (never distorted), colour-tinted scrims, content bottom-left, NO pagination dots.
 */
export default function SpotlightHero({
  record,
  idx = 0,
  reducedMotion = false,
  ix = {},
  onWatchlist,
  goToPlay,
  goToDetail,
  isMonitor = false,
  isTv = false,
  tier = 'desktop',
  heroColor = '16,16,16',
  ranked = false,
  onHoverPause,
  onHoverResume,
}) {
  const m = heroMetrics(isMonitor, isTv);
  const layout = useMemo(() => ({
    gutter: isTv || isMonitor ? 40 : 28,
    navClear: (isTv ? 76 : 68) + 14,   // space above the card so it clears the fixed nav
    radius: isTv ? 22 : 18,
    padTop: isTv ? 28 : 22,
    padBottom: isTv ? 96 : isMonitor ? 84 : 72,
  }), [isMonitor, isTv]);

  // Home hero height by screen size: big screens need less, small screens fill (overshoot) more.
  //   big (monitor/TV, ≥1536)   → 95vh
  //   medium (laptop, 1280–1536) → 100vh
  //   small (900–1280)          → 110vh
  const isSmallDesktop = useMediaQuery('(max-width:1079.95px)');
  const spotlightVh = (isMonitor || isTv) ? 95 : (isSmallDesktop ? 120 : 110);

  const handlePlay = useCallback(() => goToPlay?.(record), [goToPlay, record]);
  const handleInfo = useCallback(() => goToDetail?.(record), [goToDetail, record]);

  if (!record) return null;

  return (
    <Box
      onMouseEnter={onHoverPause}
      onMouseLeave={onHoverResume}
      sx={{
        position: 'relative',
        px: `${layout.gutter}px`,
        pt: `${layout.navClear}px`,
        pb: `${layout.gutter}px`,
        userSelect: 'none',
        // The colour "background" on Home: a soft glow of the title's dominant colour around the card.
        background: `radial-gradient(120% 90% at 50% 12%, rgba(${heroColor},0.6) 0%, rgba(${heroColor},0.2) 42%, transparent 72%)`,
      }}
    >
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          aspectRatio: '16 / 9',       // Home height by screen: big 95vh · medium 100vh · small 110vh
          maxHeight: `calc(${spotlightVh}vh - ${layout.navClear + layout.gutter}px)`, // minus nav clearance + gutter
          borderRadius: `${layout.radius}px`,
          overflow: 'hidden',
          bgcolor: `rgb(${heroColor})`,
          boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
          border: `1px solid ${BORDER}`,
        }}
      >
        <AnimatePresence mode="sync" initial={false}>
          <motion.div key={record.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reducedMotion ? 0.2 : FADE_SECS, ease: EASE }} style={{ position: 'absolute', inset: 0 }}>
            <ArtBackdrop record={record} tier={tier} reducedMotion={reducedMotion} cycleMs={CYCLE_MS} fit="cover" heroColor={heroColor} gradient="spotlight" />
          </motion.div>
        </AnimatePresence>

        <Box sx={{ position: 'absolute', inset: 0, zIndex: 2, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', px: `${m.padX}px`, pt: `${layout.padTop}px`, pb: `${layout.padBottom}px` }}>
          <BillboardContent record={record} ix={ix} m={m} isTv={isTv} reducedMotion={reducedMotion} onWatchlist={onWatchlist} onPlay={handlePlay} onInfo={handleInfo} />
        </Box>

        {ranked && (
          <Box sx={{ position: 'absolute', bottom: `${layout.padBottom}px`, right: `${m.padX}px`, zIndex: 3 }}>
            <Top10Badge idx={idx} record={record} isTv={isTv} />
          </Box>
        )}
      </Box>
    </Box>
  );
}
