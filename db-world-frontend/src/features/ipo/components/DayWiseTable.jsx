import { Box, Typography, Skeleton } from '@mui/material';
import { useT } from '@shared/theme';
import ScrollableTable, { stickyColumnSx } from './ScrollableTable';

const GAP_PX = 8; // matches the `gap: 1` (MUI spacing unit) used on every grid row below

/** Per-column floor width in px — generous enough that a "24 Jul 2026" date or a
 * "1,23,456.78" currency value never wrap-crushes, used both for each grid column's
 * `minmax()` track and to add up the table's overall `minWidth` for `ScrollableTable`.
 * The first column (always the row's date/label) gets a bit more room than the rest. */
const colFloorWidth = (col, index) => col.minWidth ?? (index === 0 ? 108 : 88);

/**
 * Generic responsive "day-wise" history table shared by the GMP and Subscription tabs —
 * grid-based (matches FinancialsTable's row pattern) rather than a real `<table>`, so it
 * reads as one system with the rest of the detail page. Callers own their own column
 * definitions (`{ key, label, align, render(row), minWidth? }`) and row shape; this just
 * handles the shared grid/skeleton/empty-state scaffolding.
 *
 * Wrapped in the shared `ScrollableTable` so it never overlaps/overflows on a narrow
 * screen — the table gets a floor width (sum of each column's minimum) and scrolls
 * horizontally past that, with the first column (the date) pinned via `stickyColumnSx`
 * so the row stays identifiable while the rest of it scrolls underneath.
 */
export default function DayWiseTable({ columns, rows, loading, emptyLabel = 'No history yet.' }) {
  const T = useT();
  const colWidths = columns.map(colFloorWidth);
  const gridTemplateColumns = columns.map((c, i) => `minmax(${colWidths[i]}px, ${c.width ?? '1fr'})`).join(' ');
  const tableMinWidth = colWidths.reduce((sum, w) => sum + w, 0) + GAP_PX * (columns.length - 1);
  const labelSx = {
    fontSize: 10.5, color: T.textFaint, textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 700,
  };

  if (loading) {
    return (
      <ScrollableTable minWidth={tableMinWidth}>
        {[0, 1, 2, 3].map((i) => (
          <Box key={i} sx={{ display: 'grid', gridTemplateColumns, gap: 1, py: 0.85 }}>
            {columns.map((c, ci) => (
              <Skeleton
                key={c.key}
                variant="text"
                width={ci === 0 ? 64 : 40}
                height={16}
                sx={{
                  ml: c.align === 'right' ? 'auto' : 0,
                  ...(ci === 0 ? stickyColumnSx(T, GAP_PX) : {}),
                  bgcolor: T.glassHover,
                }}
              />
            ))}
          </Box>
        ))}
      </ScrollableTable>
    );
  }

  if (!rows || rows.length === 0) {
    return (
      <Box sx={{ py: 1.5, textAlign: 'center' }}>
        <Typography sx={{ fontSize: 12.5, color: T.textFaint }}>{emptyLabel}</Typography>
      </Box>
    );
  }

  return (
    <ScrollableTable minWidth={tableMinWidth}>
      <Box sx={{ display: 'grid', gridTemplateColumns, gap: 1, pb: 0.75, mb: 0.25, borderBottom: `1px solid ${T.border}` }}>
        {columns.map((c, ci) => (
          <Typography
            key={c.key}
            sx={{ ...labelSx, textAlign: c.align ?? 'left', ...(ci === 0 ? stickyColumnSx(T, GAP_PX) : {}) }}
          >
            {c.label}
          </Typography>
        ))}
      </Box>
      {rows.map((row, i) => (
        <Box
          key={row.key ?? i}
          sx={{
            display: 'grid', gridTemplateColumns, gap: 1, py: 0.85,
            borderBottom: i === rows.length - 1 ? 'none' : `1px solid ${T.border}`,
          }}
        >
          {columns.map((c, ci) => (
            <Box key={c.key} sx={{ minWidth: 0, ...(ci === 0 ? stickyColumnSx(T, GAP_PX) : {}) }}>
              {c.render(row)}
            </Box>
          ))}
        </Box>
      ))}
    </ScrollableTable>
  );
}
