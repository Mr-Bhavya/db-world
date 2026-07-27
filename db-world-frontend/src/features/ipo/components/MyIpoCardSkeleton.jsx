import { Box, Skeleton } from '@mui/material';
import { useT } from '@shared/theme';

/** Loading placeholder matching MyIpoCard's shape (header, allotment line, saved-details line,
 * footer with a guided-check button + a "View IPO" link) so the My IPOs list doesn't jump once
 * real data lands. */
export default function MyIpoCardSkeleton() {
  const T = useT();
  return (
    <Box sx={{
      bgcolor: T.glass, border: `1px solid ${T.border}`, borderLeft: `3px solid ${T.border}`,
      borderRadius: 3, height: '100%', display: 'flex', flexDirection: 'column', gap: 1.25, p: 1.75,
    }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, minWidth: 0, flex: 1 }}>
          <Skeleton variant="circular" width={34} height={34} sx={{ bgcolor: T.glassHover, flexShrink: 0 }} />
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Skeleton variant="text" width="72%" height={20} sx={{ bgcolor: T.glassHover }} />
            <Skeleton variant="rounded" width={58} height={16} sx={{ mt: 0.5, borderRadius: 999, bgcolor: T.glassHover }} />
          </Box>
        </Box>
        <Skeleton variant="rounded" width={54} height={19} sx={{ borderRadius: 999, bgcolor: T.glassHover, flexShrink: 0 }} />
      </Box>

      <Skeleton variant="text" width="65%" height={16} sx={{ bgcolor: T.glassHover }} />
      <Skeleton variant="text" width="48%" height={14} sx={{ bgcolor: T.glassHover }} />

      <Box sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1,
        mt: 'auto', pt: 1, borderTop: `1px solid ${T.border}`,
      }}>
        <Skeleton variant="rounded" width={140} height={32} sx={{ borderRadius: 1, bgcolor: T.glassHover }} />
        <Skeleton variant="text" width={60} height={16} sx={{ bgcolor: T.glassHover }} />
      </Box>
    </Box>
  );
}
