import { Box, Skeleton } from '@mui/material';
import { useT } from '@shared/theme';

/** Loading placeholder matching IpoCard's shape 1:1 (same shell, accent strip, grid,
 * bottom row) so the list doesn't "jump" once real data lands. */
export default function IpoCardSkeleton() {
  const T = useT();
  return (
    <Box
      sx={{
        bgcolor: T.glass,
        border: `1px solid ${T.border}`,
        borderLeft: `3px solid ${T.border}`,
        borderRadius: 3,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        p: 1.75,
      }}
    >
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

      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
        <Box>
          <Skeleton variant="text" width={56} height={12} sx={{ bgcolor: T.glassHover }} />
          <Skeleton variant="text" width={70} height={18} sx={{ mt: 0.25, bgcolor: T.glassHover }} />
        </Box>
        <Box>
          <Skeleton variant="text" width={32} height={12} sx={{ bgcolor: T.glassHover }} />
          <Skeleton variant="text" width={64} height={18} sx={{ mt: 0.25, bgcolor: T.glassHover }} />
        </Box>
      </Box>

      {/* Placeholder for the open/closed subscription bar — most cards in a typical
          list are open/closed, so the skeleton reserves its space to avoid a layout
          jump once real data (and the real bar) lands. */}
      <Box>
        <Skeleton variant="text" width={90} height={12} sx={{ bgcolor: T.glassHover }} />
        <Skeleton variant="rounded" width="100%" height={5} sx={{ mt: 0.6, borderRadius: 999, bgcolor: T.glassHover }} />
      </Box>

      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 1,
        mt: 'auto', pt: 1, borderTop: `1px solid ${T.border}`,
      }}>
        <Skeleton variant="text" width={112} height={14} sx={{ bgcolor: T.glassHover }} />
      </Box>
    </Box>
  );
}
