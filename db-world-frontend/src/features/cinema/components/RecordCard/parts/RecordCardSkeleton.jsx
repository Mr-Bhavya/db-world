import React from 'react';
import { Box, Skeleton } from '@mui/material';
import { RAIL_TYPE_CONFIG, RAIL_TYPE_DEFAULT } from '../../RailRow/railTypeConfig';

// Loading placeholder sized to match each display type's card footprint.
const RecordCardSkeleton = ({ type = 'standard', wide, top10, prime }) => {
  // Support legacy boolean props from WatchlistRailRow
  const resolvedType = type !== 'standard'
    ? type
    : prime ? 'prime' : top10 ? 'top10' : wide ? 'wide' : 'standard';

  const cfg = RAIL_TYPE_CONFIG[resolvedType] ?? RAIL_TYPE_CONFIG[RAIL_TYPE_DEFAULT];
  const deskH = cfg.tiers.desktop;
  const mobH = cfg.tiers.mobile;
  const tabH = cfg.tiers.tablet;
  const isCirc = resolvedType === 'person';
  const is10 = resolvedType === 'top10';
  const isPrim = resolvedType === 'prime';
  const isWide = ['wide', 'continue', 'billboard'].includes(resolvedType);

  const [daw, dah] = cfg.cardAspect.split('/').map(Number);
  const mobAsp = cfg.mobileAspect ?? cfg.cardAspect;
  const [maw, mah] = mobAsp.split('/').map(Number);

  const w = isPrim
    ? { xs: Math.round(mobH * 9 / 16), sm: Math.round(tabH * 9 / 16), md: Math.round(deskH * 9 / 16) }
    : is10
      ? { xs: Math.round(mobH * 2 / 3), sm: Math.round(tabH * 2 / 3), md: Math.round(deskH * 2 / 3) }
      : isWide
        ? { xs: Math.round(mobH * 16 / 9), sm: Math.round(tabH * 16 / 9), md: Math.round(deskH * 16 / 9) }
        : isCirc
          ? { xs: mobH, sm: tabH, md: deskH }
          : {
            xs: Math.round(mobH * maw / mah),
            sm: Math.round(tabH * maw / mah),
            md: Math.round(deskH * daw / dah),
          };

  const h = isPrim
    ? { xs: mobH, sm: tabH, md: deskH }
    : isCirc
      ? { xs: mobH, sm: tabH, md: deskH }
      : undefined;

  const aspectRatioSx = h ? {} : cfg.mobileAspect
    ? { aspectRatio: { xs: cfg.mobileAspect, md: cfg.cardAspect } }
    : { aspectRatio: cfg.cardAspect };

  return (
    <Box sx={{
      flexShrink: 0,
      pl: is10 ? { xs: 6, md: 10 } : 0,
      width: w,
      ...aspectRatioSx,
      borderRadius: isCirc ? '50%' : 1.5,
      overflow: 'hidden',
      bgcolor: 'rgba(255,255,255,.06)',
    }}>
      <Skeleton variant="rectangular" width="100%" height="100%"
        sx={{
          bgcolor: 'rgba(255,255,255,.06)',
          '@media (prefers-reduced-motion: reduce)': { animation: 'none' }
        }} />
    </Box>
  );
};

export default RecordCardSkeleton;
