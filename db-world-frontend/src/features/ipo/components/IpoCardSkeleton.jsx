import { Box, Skeleton } from '@mui/material';
import { useT } from '@shared/theme';

/**
 * Loading placeholder matching `IpoCard`'s shape 1:1 — same shell, top accent edge, hero figure,
 * 2-up secondary stats, meta line and footer — so the list doesn't reflow once real data lands.
 */
export default function IpoCardSkeleton() {
  const T = useT();
  return (
    <Box
      sx={{
        position: 'relative',
        bgcolor: T.glass,
        border: `1px solid ${T.border}`,
        borderRadius: 3.5,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        p: { xs: 1.75, sm: 2 },
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute', top: 0, left: 0, right: 0, height: 3, bgcolor: T.border,
        },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25 }}>
        <Skeleton variant="rounded" width={42} height={42} sx={{ borderRadius: 2, bgcolor: T.glassHover, flexShrink: 0 }} />
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Skeleton variant="text" width="80%" height={20} sx={{ bgcolor: T.glassHover }} />
          <Skeleton variant="rounded" width={62} height={16} sx={{ mt: 0.5, borderRadius: 1, bgcolor: T.glassHover }} />
        </Box>
        <Skeleton variant="rounded" width={62} height={21} sx={{ borderRadius: 999, bgcolor: T.glassHover, flexShrink: 0 }} />
      </Box>

      {/* The hero figure — a 10.5px label over a 26px number. */}
      <Box>
        <Skeleton variant="text" width={120} height={12} sx={{ bgcolor: T.glassHover }} />
        <Skeleton variant="text" width={104} height={32} sx={{ bgcolor: T.glassHover }} />
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1.25 }}>
        <Box>
          <Skeleton variant="text" width={64} height={12} sx={{ bgcolor: T.glassHover }} />
          <Skeleton variant="text" width={72} height={18} sx={{ mt: 0.35, bgcolor: T.glassHover }} />
        </Box>
        <Box>
          <Skeleton variant="text" width={48} height={12} sx={{ ml: 'auto', bgcolor: T.glassHover }} />
          <Skeleton variant="text" width={60} height={18} sx={{ mt: 0.35, ml: 'auto', bgcolor: T.glassHover }} />
        </Box>
      </Box>

      <Box sx={{ mt: 'auto', pt: 1.25, borderTop: `1px solid ${T.border}` }}>
        <Skeleton variant="text" width={150} height={14} sx={{ bgcolor: T.glassHover }} />
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
        <Skeleton variant="text" width={130} height={14} sx={{ bgcolor: T.glassHover }} />
        <Skeleton variant="rounded" width={64} height={19} sx={{ borderRadius: 999, bgcolor: T.glassHover }} />
      </Box>
    </Box>
  );
}
