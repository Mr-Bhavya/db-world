import { Box, Skeleton } from '@mui/material';
import { useT } from '@shared/theme';

/**
 * Loading placeholder for `IpoCard`, matching its shape row for row so the grid doesn't reflow when
 * real data lands: top accent edge, 42px logo beside a two-line name and type chip with the status
 * badge opposite, the hero's label+badge row over its 26px figure row, a row of evenly-divided
 * stats, then the divided footer with its countdown pill.
 *
 * The stat row mirrors the card's three even columns and its edge-spread alignment (first flush
 * left, last flush right, middle centred) — on live data upcoming, open and closed all settle on
 * three, so that is the shape to reserve. Cards that can only fill one or two columns end up
 * shorter than the placeholder rather than taller, which the grid absorbs without reflowing.
 */
export default function IpoCardSkeleton() {
  const T = useT();
  const bar = { bgcolor: T.glassHover };
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
      {/* Header — logo, name over type chip, status badge. */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25 }}>
        <Skeleton variant="rounded" width={42} height={42} sx={{ borderRadius: 2, ...bar, flexShrink: 0 }} />
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Skeleton variant="text" width="88%" height={20} sx={bar} />
          <Skeleton variant="rounded" width={62} height={17} sx={{ mt: 0.5, borderRadius: 1, ...bar }} />
        </Box>
        <Skeleton variant="rounded" width={64} height={22} sx={{ borderRadius: 999, ...bar, flexShrink: 0 }} />
      </Box>

      {/* Hero — label row (with the rating badge opposite) over the 26px figure row (with its
          companion figure opposite). */}
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
          <Skeleton variant="text" width={124} height={13} sx={bar} />
          <Skeleton variant="rounded" width={54} height={12} sx={{ borderRadius: 999, ...bar }} />
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 1.25 }}>
          <Skeleton variant="text" width={112} height={34} sx={bar} />
          <Skeleton variant="text" width={86} height={16} sx={bar} />
        </Box>
      </Box>

      {/* Stats — three even columns, aligned exactly as the card aligns them. */}
      <Box sx={{
        display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', columnGap: 1.5,
        '& > *:last-child': { justifyItems: 'end' },
        '& > *:not(:first-of-type):not(:last-child)': { justifyItems: 'center' },
      }}>
        {[{ l: 74, v: 62 }, { l: 52, v: 44 }, { l: 62, v: 50 }].map((w, i) => (
          <Box key={i} sx={{ display: 'grid', justifyItems: 'start' }}>
            <Skeleton variant="text" width={w.l} height={13} sx={bar} />
            <Skeleton variant="text" width={w.v} height={18} sx={{ mt: 0.35, ...bar }} />
          </Box>
        ))}
      </Box>

      {/* Footer — date range and countdown pill, above the same divider the card uses. */}
      <Box sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1,
        mt: 'auto', pt: 1.25, borderTop: `1px solid ${T.border}`,
      }}>
        <Skeleton variant="text" width={148} height={15} sx={bar} />
        <Skeleton variant="rounded" width={68} height={20} sx={{ borderRadius: 999, ...bar }} />
      </Box>
    </Box>
  );
}
