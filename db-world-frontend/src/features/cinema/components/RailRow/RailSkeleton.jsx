import React from 'react';
import { Box, Skeleton } from '@mui/material';
import useDeviceTier from '../../hooks/useDeviceTier';
import { useViewportWidth, desktopFluidFactor } from '../../hooks/useFluidCardSize';
import RecordCardSkeleton from '../RecordCard/parts/RecordCardSkeleton';

// Page-level rail placeholder shown before the rail list resolves. Mirrors
// RailRow's layout (same horizontal padding + fluid inter-card gap + row margin)
// and reuses RecordCardSkeleton so the placeholder cards match the REAL cards at
// every tier — mobile, tablet, desktop, large monitor (fluid scale-up) and TV.
// (The old bespoke SkeletonCard sized off `cfg.tiers[tier]`, which over-sized on
// TV and skipped the desktop fluid factor on large monitors.)
const RAIL_PX = 'clamp(12px, 4vw, 48px)';

const RailSkeleton = ({ type = 'standard', count = 6 }) => {
  const tier = useDeviceTier();
  const vw = useViewportWidth();
  const isTop10 = type === 'top10';

  // Same gap rule as RailRow: fluid on desktop, breakpoint-based elsewhere.
  const railGap = tier === 'desktop'
    ? `${Math.round((isTop10 ? 4 : 16) * desktopFluidFactor(vw))}px`
    : (isTop10 ? 0.5 : { xs: 1.25, md: 2 });

  return (
    <Box sx={{ mb: { xs: 3.25, md: 5 } }}>
      <Box sx={{ px: RAIL_PX, mb: 1 }}>
        <Skeleton
          variant="text"
          width={200}
          height={28}
          sx={{
            bgcolor: 'rgba(255,255,255,.08)',
            '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
          }}
        />
      </Box>

      <Box sx={{ display: 'flex', gap: railGap, px: RAIL_PX, overflowX: 'hidden' }}>
        {Array.from({ length: count }).map((_, i) => (
          <RecordCardSkeleton key={i} type={type} />
        ))}
      </Box>
    </Box>
  );
};

export default RailSkeleton;
