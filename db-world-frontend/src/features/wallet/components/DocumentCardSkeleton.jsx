import { Box, Skeleton } from '@mui/material';
import { useT } from '@shared/theme';

/**
 * Placeholder for one `DocumentCard`, following its real shape — thumbnail tile beside a name and
 * type chip, a facts line, then the footer rule with its meta and expiry pill. It deliberately
 * draws no accent edge: validity is exactly what we're still waiting to learn, and guessing a
 * colour would flash the wrong one.
 */
export default function DocumentCardSkeleton() {
  const T = useT();
  const block = { bgcolor: T.glassHover };

  return (
    <Box sx={{
      bgcolor: T.glass, border: `1px solid ${T.border}`, borderRadius: 3.5,
      p: { xs: 1.5, sm: 1.75 }, display: 'flex', flexDirection: 'column', gap: 1.25,
      width: '100%', boxSizing: 'border-box',
    }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25 }}>
        <Skeleton
          variant="rounded"
          sx={{ ...block, borderRadius: 2, flexShrink: 0, width: { xs: 68, sm: 76 }, height: { xs: 68, sm: 76 } }}
        />
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Skeleton variant="text" width="80%" height={22} sx={block} />
          <Skeleton variant="rounded" width={78} height={16} sx={{ ...block, mt: 0.5, borderRadius: 1 }} />
          <Skeleton variant="text" width="55%" height={18} sx={{ ...block, mt: 0.5 }} />
        </Box>
        <Skeleton variant="circular" width={24} height={24} sx={{ ...block, flexShrink: 0 }} />
      </Box>

      <Skeleton variant="text" width="45%" height={16} sx={block} />

      <Box sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1,
        pt: 1.25, borderTop: `1px solid ${T.border}`,
      }}>
        <Skeleton variant="text" width={92} height={16} sx={block} />
        <Skeleton variant="rounded" width={104} height={20} sx={{ ...block, borderRadius: 999 }} />
      </Box>
    </Box>
  );
}
