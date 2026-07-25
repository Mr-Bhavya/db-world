import { Box } from '@mui/material';
import { useT } from '@shared/theme';

/**
 * Shared horizontal-scroll wrapper for the detail page's grid-based data tables
 * (Financials P&L, GMP day-wise, Subscription day-wise) — gives the table a floor
 * width (`minWidth`) so its columns never crush/overlap on a narrow screen, and lets
 * the overflow scroll horizontally with a subtle themed scrollbar instead of wrapping
 * or squeezing values. Pair with `stickyColumnSx` on each table's first-column cells
 * (the row label — a date or fiscal year) so it stays pinned in view while the rest
 * of a wide row scrolls underneath it.
 */
export default function ScrollableTable({ minWidth = 420, children }) {
  const T = useT();
  return (
    <Box
      sx={{
        overflowX: 'auto',
        overscrollBehaviorX: 'contain',
        scrollbarWidth: 'thin',
        scrollbarColor: `${T.scrollThumb} transparent`,
        '&::-webkit-scrollbar': { height: 5 },
        '&::-webkit-scrollbar-track': { background: 'transparent' },
        '&::-webkit-scrollbar-thumb': { bgcolor: T.scrollThumb, borderRadius: 999 },
      }}
    >
      <Box sx={{ minWidth }}>
        {children}
      </Box>
    </Box>
  );
}

/**
 * Sticky-first-column sx — pins a grid row's first cell (the row label) to the left
 * edge of the nearest scrolling ancestor (a `ScrollableTable`) while the rest of the
 * row scrolls underneath it. `bgcolor` is an opaque approximation of the surrounding
 * glass-card surface (`T.bg`, the app's solid page background) rather than the
 * card's own translucent `T.glass` tint — a translucent sticky cell wouldn't fully
 * occlude the other columns' content scrolling underneath it. `gapPx` should match
 * the grid's `gap` (in px) so the `boxShadow` can extend the same solid color across
 * that gap too, otherwise a sliver of whatever's scrolling by would flash through it.
 */
export const stickyColumnSx = (T, gapPx = 8) => ({
  position: 'sticky',
  left: 0,
  zIndex: 1,
  bgcolor: T.bg,
  boxShadow: `${gapPx}px 0 0 0 ${T.bg}`,
  borderRight: `1px solid ${T.border}`,
});
