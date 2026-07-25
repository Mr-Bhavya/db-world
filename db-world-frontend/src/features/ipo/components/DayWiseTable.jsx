import { Box, Typography, Skeleton } from '@mui/material';
import { useT } from '@shared/theme';

/**
 * Generic responsive "day-wise" history table shared by the GMP and Subscription tabs —
 * grid-based (matches FinancialsTable's row pattern) rather than a real `<table>`, so it
 * reads as one system with the rest of the detail page. Callers own their own column
 * definitions (`{ key, label, align, render(row) }`) and row shape; this just handles the
 * shared grid/skeleton/empty-state scaffolding.
 */
export default function DayWiseTable({ columns, rows, loading, emptyLabel = 'No history yet.' }) {
  const T = useT();
  const gridTemplateColumns = columns.map((c) => c.width ?? '1fr').join(' ');
  const labelSx = {
    fontSize: 10.5, color: T.textFaint, textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 700,
  };

  if (loading) {
    return (
      <Box>
        {[0, 1, 2, 3].map((i) => (
          <Box key={i} sx={{ display: 'grid', gridTemplateColumns, gap: 1, py: 0.85 }}>
            {columns.map((c, ci) => (
              <Skeleton
                key={c.key}
                variant="text"
                width={ci === 0 ? 64 : 40}
                height={16}
                sx={{ bgcolor: T.glassHover, ml: c.align === 'right' ? 'auto' : 0 }}
              />
            ))}
          </Box>
        ))}
      </Box>
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
    <Box>
      <Box sx={{ display: 'grid', gridTemplateColumns, gap: 1, pb: 0.75, mb: 0.25, borderBottom: `1px solid ${T.border}` }}>
        {columns.map((c) => (
          <Typography key={c.key} sx={{ ...labelSx, textAlign: c.align ?? 'left' }}>
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
          {columns.map((c) => (
            <Box key={c.key} sx={{ minWidth: 0 }}>
              {c.render(row)}
            </Box>
          ))}
        </Box>
      ))}
    </Box>
  );
}
