import { Box, Skeleton } from '@mui/material';
import { useT } from '@shared/theme';

/**
 * The shape of a {@link GroupCard} while it loads.
 *
 * A skeleton rather than a spinner: the grid keeps its height, so nothing reflows when the data
 * lands, and the page already looks like the page instead of like an empty box with a circle.
 */
export default function GroupCardSkeleton() {
  const T = useT();
  const base = { bgcolor: T.glassHover, borderRadius: 1 };
  return (
    <Box sx={{
      p: 2, borderRadius: 3.5, bgcolor: T.glass,
      border: `1px solid ${T.glassBorder}`,
      display: 'flex', flexDirection: 'column', gap: 1.5,
    }}>
      <Box sx={{ pl: 1 }}>
        <Skeleton variant="text" width="58%" height={22} sx={base} />
        <Skeleton variant="text" width="38%" height={16} sx={base} />
      </Box>
      <Box sx={{ pl: 1 }}>
        <Skeleton variant="text" width="30%" height={13} sx={base} />
        <Skeleton variant="text" width="46%" height={28} sx={base} />
      </Box>
    </Box>
  );
}
