import { Box, Skeleton, Typography } from '@mui/material';
import { useT } from '@shared/theme';

/**
 * The shape of an {@link ExpenseRow} while the feed loads, so nothing reflows when it lands.
 *
 * <h2>Why every bar sits inside a Typography</h2>
 * A Skeleton carrying a hand-written `height` is a second copy of the row's type metrics, and
 * it drifts. This one guessed 19px and 14px for lines that are 14.5px and 12px at the default
 * 1.5 line-height — 21.75 and 18 — so the placeholder stood three pixels shorter than every row
 * that replaced it. `variant="text"` with no height takes exactly one line box of whatever font
 * it inherits, so wrapping it in the Typography it stands in for makes the two agree by
 * construction and keeps agreeing if the row's sizes are ever changed.
 */
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
        <Typography sx={{ fontSize: 14.5, fontWeight: 700 }}>
          <Skeleton variant="text" width="55%" sx={base} />
        </Typography>
        <Typography sx={{ fontSize: 12, mt: 0.15 }}>
          <Skeleton variant="text" width="35%" sx={base} />
        </Typography>
      </Box>

      {/* The impact column is two lines in the real row: the amount, and YOU OWE / YOU GET BACK
          underneath it. Standing in for only the first left the row's tallest column short. */}
      <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
        <Typography sx={{ fontSize: 13.5, lineHeight: 1.3 }}>
          <Skeleton variant="text" width={62} sx={base} />
        </Typography>
        <Typography sx={{ fontSize: 10.5 }}>
          <Skeleton variant="text" width={58} sx={base} />
        </Typography>
      </Box>

      {/* The overflow button's footprint. Without it every column to its left is ~41px wider
          here than in the row that replaces this, so the whole feed shifts sideways on load. */}
      <Box sx={{
        width: 29, height: 29, ml: -0.5, flexShrink: 0,
        display: 'grid', placeItems: 'center',
      }}>
        <Skeleton variant="circular" width={17} height={17} sx={base} />
      </Box>
    </Box>
  );
}
