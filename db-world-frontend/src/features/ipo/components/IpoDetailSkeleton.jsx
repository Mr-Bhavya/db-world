import { Box, Skeleton } from '@mui/material';
import { useT } from '@shared/theme';

const PAGE_SX = { pt: { xs: 'calc(56px + 24px)', md: 'calc(64px + 24px)' }, px: { xs: 2, sm: 3 }, pb: 4 };

/**
 * Loading placeholder for `IpoDetailPage` while the MAIN `useIpo(id)` query is in flight.
 *
 * It follows the real page's shape rather than a generic stack of rounded blocks: the back
 * breadcrumb, then the hero card with its accent edge, logo well, name + badge row, the lead
 * figure beside its supporting ones, and the timing strip — then the tab bar, then the first
 * section cards. An earlier version still described a layout two redesigns old (a 2-column md
 * grid that no longer exists), so the page visibly rearranged itself the moment data landed.
 *
 * The on-demand financials section has its own independent skeleton (see `FinancialsTable`) and
 * isn't part of this one.
 */
export default function IpoDetailSkeleton() {
  const T = useT();
  const block = { bgcolor: T.glassHover };

  return (
    <Box sx={{ ...PAGE_SX, maxWidth: 1100, width: '100%', mx: 'auto' }}>
      {/* Back breadcrumb, above the card — same place the loaded page puts it. */}
      <Skeleton variant="text" width={104} height={22} sx={{ ...block, mb: 1.25 }} />

      {/* Hero */}
      <Box sx={{
        position: 'relative', bgcolor: T.glass, border: `1px solid ${T.border}`, borderRadius: 3.5,
        p: { xs: 1.75, sm: 2.25 }, mb: 2, overflow: 'hidden',
        // The accent edge can't be coloured yet (status is exactly what we're waiting for), so it
        // holds the space in the neutral border tone rather than guessing at a lifecycle colour.
        '&::before': {
          content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: 3,
          background: T.border,
        },
      }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: { xs: 1.25, sm: 1.5 } }}>
          <Skeleton
            variant="rounded"
            sx={{ ...block, borderRadius: 2.5, flexShrink: 0, width: { xs: 46, sm: 54 }, height: { xs: 46, sm: 54 } }}
          />
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Skeleton variant="text" width="60%" height={28} sx={block} />
            <Box sx={{ display: 'flex', gap: 0.75, mt: 0.6 }}>
              <Skeleton variant="rounded" width={58} height={18} sx={{ ...block, borderRadius: 999 }} />
              <Skeleton variant="rounded" width={72} height={18} sx={{ ...block, borderRadius: 999 }} />
            </Box>
          </Box>
        </Box>

        {/* Lead figure | supporting figures — the same split the loaded hero uses, so nothing
            shifts sideways when the numbers arrive. */}
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 260px) 1fr' },
          gap: { xs: 1.5, md: 2.5 },
          mt: { xs: 2, sm: 2.25 },
        }}>
          <Box sx={{
            minWidth: 0,
            pb: { xs: 1.5, md: 0 },
            borderBottom: { xs: `1px solid ${T.border}`, md: 'none' },
            pr: { md: 2.5 },
            borderRight: { md: `1px solid ${T.border}` },
          }}>
            <Skeleton variant="text" width={116} height={14} sx={block} />
            <Skeleton variant="text" width="70%" height={42} sx={{ ...block, mt: 0.35 }} />
            <Skeleton variant="text" width={104} height={14} sx={block} />
          </Box>
          <Box sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(3, minmax(0, 1fr))' },
            columnGap: 2, rowGap: 1.75, alignSelf: 'center',
          }}>
            {[0, 1, 2].map((i) => (
              <Box key={i} sx={{ minWidth: 0 }}>
                <Skeleton variant="text" width="75%" height={14} sx={block} />
                <Skeleton variant="text" width="55%" height={24} sx={{ ...block, mt: 0.25 }} />
              </Box>
            ))}
          </Box>
        </Box>

        <Box sx={{ mt: 1.75, pt: 1.5, borderTop: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', gap: 1 }}>
          <Skeleton variant="text" width={180} height={16} sx={block} />
          <Skeleton variant="rounded" width={82} height={22} sx={{ ...block, borderRadius: 999 }} />
        </Box>
      </Box>

      {/* Tab bar */}
      <Box sx={{ display: 'flex', gap: 2.5, mb: 2, pb: 1, borderBottom: `1px solid ${T.border}` }}>
        {[68, 52, 92, 76].map((w) => (
          <Skeleton key={w} variant="text" width={w} height={22} sx={block} />
        ))}
      </Box>

      {/* Timeline, key facts, and the first of the long-form sections */}
      <Skeleton variant="rounded" height={130} sx={{ mb: 2, bgcolor: T.glass, borderRadius: 3 }} />
      <Skeleton variant="rounded" height={160} sx={{ mb: 2, bgcolor: T.glass, borderRadius: 3 }} />
      <Skeleton variant="rounded" height={220} sx={{ bgcolor: T.glass, borderRadius: 3 }} />
    </Box>
  );
}
