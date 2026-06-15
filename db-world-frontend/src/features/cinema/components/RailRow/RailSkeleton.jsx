import React from 'react';
import { Box, Skeleton } from '@mui/material';
import { RAIL_TYPE_CONFIG, RAIL_TYPE_DEFAULT } from './railTypeConfig';
import useDeviceTier from '../../hooks/useDeviceTier';

const SkeletonCard = ({ type, tier }) => {
  const cfg     = RAIL_TYPE_CONFIG[type] ?? RAIL_TYPE_CONFIG[RAIL_TYPE_DEFAULT];
  const h       = cfg.tiers[tier];
  const isCirc  = type === 'person';
  const isTop10 = type === 'top10';
  const isPrime = type === 'prime';
  // Compute width from aspect ratio in config
  const [aw, ah] = cfg.cardAspect.split('/').map(Number);
  const w = isPrime  ? Math.round(h * 9/16)   // portrait before expand
    : isTop10        ? Math.round(h * 2/3)     // top10 with rank offset
    : isCirc         ? h                       // circle
    :                  Math.round(h * aw / ah); // everything else: use config aspect

  return (
    <Box sx={{
      flexShrink: 0,
      pl: isTop10 ? { xs: 6, md: 10 } : 0,
      width: w,
      height: (isPrime || isCirc) ? h : undefined,
      aspectRatio: (!isPrime && !isCirc) ? cfg.cardAspect : undefined,
      borderRadius: isCirc ? '50%' : 1.5,
      overflow: 'hidden',
      bgcolor: 'rgba(255,255,255,.06)',
    }}>
      <Skeleton
        variant="rectangular"
        width="100%"
        height="100%"
        sx={{
          bgcolor: 'rgba(255,255,255,.06)',
          '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
        }}
      />
    </Box>
  );
};

const RailSkeleton = ({ type = 'standard', count = 6 }) => {
  const tier = useDeviceTier();

  return (
    <Box sx={{ mb: { xs: 2.5, md: 3.5 }, px: { xs: 2, md: 4 } }}>
      <Skeleton
        variant="text"
        width={200}
        height={28}
        sx={{
          bgcolor: 'rgba(255,255,255,.08)',
          mb: 1,
          '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
        }}
      />
      <Box sx={{ display: 'flex', gap: type === 'top10' ? 0.5 : 1.5, overflowX: 'hidden' }}>
        {Array.from({ length: count }).map((_, i) => (
          <SkeletonCard key={i} type={type} tier={tier} />
        ))}
      </Box>
    </Box>
  );
};

export default RailSkeleton;
