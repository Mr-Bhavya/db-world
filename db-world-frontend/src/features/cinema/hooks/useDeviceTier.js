import { useTheme, useMediaQuery } from '@mui/material';

// Returns current device tier. 'tv' requires ≥1920px width AND coarse pointer
// (d-pad remote), distinguishing it from a large desktop monitor with a mouse.
export default function useDeviceTier() {
  const theme = useTheme();
  const isMobileBreak = useMediaQuery(theme.breakpoints.down('sm'));       // < 600px
  const isTabletBreak = useMediaQuery(theme.breakpoints.between('sm', 'md')); // 600–959px
  const isTvWidth     = useMediaQuery('(min-width:1920px)');
  const isCoarse      = useMediaQuery('(pointer: coarse)');

  if (isTvWidth && isCoarse) return 'tv';
  if (isMobileBreak)         return 'mobile';
  if (isTabletBreak)         return 'tablet';
  return 'desktop';
}
