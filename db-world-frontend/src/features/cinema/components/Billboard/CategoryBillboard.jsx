import React, { useCallback, useEffect, useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { CYCLE_MS, FADE_SECS } from '../HeroBanner/heroUtils';
import ArtBackdrop from './ArtBackdrop';
import { BillboardContent, Top10Badge, ThumbnailPills, heroMetrics } from './billboardParts';

const EASE = [0.22, 1, 0.36, 1];

/**
 * MOVIES / TV SHOWS / genre billboard — full-bleed cover image, NO colour tint (neutral scrims so
 * every title looks consistent), only a soft bottom FADE into the page. A genre page shows a
 * breadcrumb at the top; a thumbnail navigator sits bottom-right.
 */
export default function CategoryBillboard({
  record,
  featured = [],
  idx = 0,
  reducedMotion = false,
  ix = {},
  onWatchlist,
  go,
  goToIndex,
  goToPlay,
  goToDetail,
  isMonitor = false,
  isTv = false,
  tier = 'desktop',
  heading = null,
  breadcrumb = null,
  ranked = false,
  onHoverPause,
  onHoverResume,
}) {
  const m = heroMetrics(isMonitor, isTv);
  const layout = useMemo(() => ({
    padTop: isTv ? 100 : 88,                              // clear the fixed nav
    // Big bottom room: the first rail rides up ONTO the image, so content must sit well above it.
    padBottom: isTv ? 190 : isMonitor ? 170 : 150,
  }), [isMonitor, isTv]);

  const hasHeader = !!breadcrumb;

  // Arrow-key slide nav (this variant has a visible navigator).
  useEffect(() => {
    const onKey = (e) => {
      if (!featured || featured.length <= 1) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); go?.(-1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); go?.(1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [featured, go]);

  const handlePlay = useCallback(() => goToPlay?.(record), [goToPlay, record]);
  const handleInfo = useCallback(() => goToDetail?.(record), [goToDetail, record]);

  if (!record) return null;

  return (
    <Box onMouseEnter={onHoverPause} onMouseLeave={onHoverResume} sx={{ position: 'relative', userSelect: 'none' }}>
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          aspectRatio: '16 / 9',            // ratio keeps the backdrop from stretching / over-cropping…
          minHeight: isTv ? '92vh' : '90vh', // …but a tall floor so the hero fills the screen
          maxHeight: '100vh',
          overflow: 'hidden',
          bgcolor: '#141414',               // neutral — no per-title colour on Movies/TV
        }}
      >
        <AnimatePresence mode="sync" initial={false}>
          <motion.div key={record.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reducedMotion ? 0.2 : FADE_SECS, ease: EASE }} style={{ position: 'absolute', inset: 0 }}>
            {/* Neutral scrims, no colour tint and no hard bottom mask — the soft gradient below blends it. */}
            <ArtBackdrop record={record} tier={tier} reducedMotion={reducedMotion} cycleMs={CYCLE_MS} fit="cover" gradient="billboard" bottomScrim={false} />
          </motion.div>
        </AnimatePresence>

        {/* Gentle low-strength bottom fade: darkens the lower image just enough for legibility and
            blends into the page, so the first rail can ride up onto the image without a hard edge. */}
        <Box aria-hidden sx={{
          position: 'absolute', left: 0, right: 0, bottom: 0, height: '62%', zIndex: 1, pointerEvents: 'none',
          background: 'linear-gradient(to bottom, transparent 0%, rgba(20,20,20,0.26) 46%, rgba(20,20,20,0.6) 76%, #141414 100%)',
        }} />

        <Box sx={{ position: 'absolute', inset: 0, zIndex: 2, display: 'flex', flexDirection: 'column', justifyContent: hasHeader ? 'space-between' : 'flex-end', px: `${m.padX}px`, pt: `${layout.padTop}px`, pb: `${layout.padBottom}px` }}>
          {hasHeader && (
            <Box sx={{ flexShrink: 0 }}>
              <Typography sx={{ color: 'rgba(255,255,255,0.72)', fontWeight: 700, fontSize: m.metaSize, textShadow: '0 2px 8px rgba(0,0,0,0.6)' }}>
                {breadcrumb} <Box component="span" sx={{ opacity: 0.5, px: 0.5 }}>›</Box>{' '}
                <Box component="span" sx={{ color: '#fff' }}>{heading}</Box>
              </Typography>
            </Box>
          )}

          <BillboardContent record={record} ix={ix} m={m} isTv={isTv} reducedMotion={reducedMotion} onWatchlist={onWatchlist} onPlay={handlePlay} onInfo={handleInfo} />
        </Box>

        {/* Bottom-right: Top-10 badge (if ranked) above the thumbnail navigator. */}
        {(ranked || featured.length > 1) && (
          <Box sx={{ position: 'absolute', bottom: `${layout.padBottom}px`, right: `${m.padX}px`, zIndex: 3, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
            {ranked && <Top10Badge idx={idx} record={record} isTv={isTv} />}
            {featured.length > 1 && (
              <ThumbnailPills
                featured={featured}
                idx={idx}
                onSelect={goToIndex}
                onPrev={() => go?.(-1)}
                onNext={() => go?.(1)}
                isTv={isTv}
                isMonitor={isMonitor}
              />
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
}
