import { Box, Skeleton } from '@mui/material';
import { useT } from '@shared/theme';

const PAGE_SX = { pt: { xs: 'calc(56px + 24px)', md: 'calc(64px + 24px)' }, px: { xs: 2, sm: 3 }, pb: 4 };

/**
 * Loading placeholder for IpoDetailPage while the MAIN `useIpo(id)` query is in flight —
 * mirrors the loaded shape (back button, logo + name + status header, about, timeline /
 * issue-details grid, subscription, charts, allotment) so the page doesn't visibly
 * "reflow" once real data lands. The on-demand financials section has its own independent
 * skeleton (see FinancialsTable) and isn't part of this one.
 */
export default function IpoDetailSkeleton() {
  const T = useT();
  return (
    <Box sx={{ ...PAGE_SX, maxWidth: 1100, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25, mb: 2.5 }}>
        <Skeleton variant="circular" width={40} height={40} sx={{ bgcolor: T.glass, flexShrink: 0 }} />
        <Skeleton variant="circular" width={44} height={44} sx={{ bgcolor: T.glass, flexShrink: 0 }} />
        <Box sx={{ minWidth: 0, flex: 1, pt: 0.5 }}>
          <Skeleton variant="text" width="55%" height={26} sx={{ bgcolor: T.glass }} />
          <Skeleton variant="rounded" width={70} height={18} sx={{ mt: 0.75, borderRadius: 999, bgcolor: T.glass }} />
        </Box>
      </Box>

      <Skeleton variant="rounded" height={80} sx={{ mb: 2, bgcolor: T.glass, borderRadius: 3 }} />

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: { xs: 0, md: 1.5 } }}>
        <Skeleton variant="rounded" height={100} sx={{ mb: 2, bgcolor: T.glass, borderRadius: 3 }} />
        <Skeleton variant="rounded" height={100} sx={{ mb: 2, bgcolor: T.glass, borderRadius: 3 }} />
      </Box>

      <Skeleton variant="rounded" height={90} sx={{ mb: 2, bgcolor: T.glass, borderRadius: 3 }} />
      <Skeleton variant="rounded" height={260} sx={{ mb: 2, bgcolor: T.glass, borderRadius: 3 }} />
      <Skeleton variant="rounded" height={220} sx={{ mb: 2, bgcolor: T.glass, borderRadius: 3 }} />
      <Skeleton variant="rounded" height={110} sx={{ bgcolor: T.glass, borderRadius: 3 }} />
    </Box>
  );
}
