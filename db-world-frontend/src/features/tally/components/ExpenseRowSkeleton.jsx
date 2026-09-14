import { Box, Skeleton } from '@mui/material';
import { useT } from '@shared/theme';

/** The shape of an {@link ExpenseRow} while the feed loads, so nothing reflows when it lands. */
export default function ExpenseRowSkeleton() {
  const T = useT();
  const base = { bgcolor: T.glassHover, borderRadius: 1 };
  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', gap: 1.5,
      px: { xs: 1.25, sm: 1.75 }, py: 1.5, borderRadius: 3,
      bgcolor: T.glass, border: `1px solid ${T.border}`,
    }}>
      <Skeleton variant="rounded" width={38} height={38} sx={{ ...base, borderRadius: 2.5, flexShrink: 0 }} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Skeleton variant="text" width="55%" height={19} sx={base} />
        <Skeleton variant="text" width="35%" height={14} sx={base} />
      </Box>
      <Skeleton variant="text" width={62} height={19} sx={base} />
    </Box>
  );
}
