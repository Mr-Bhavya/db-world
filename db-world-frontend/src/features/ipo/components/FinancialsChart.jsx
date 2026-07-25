import { useMemo } from 'react';
import { Box, useMediaQuery, useTheme } from '@mui/material';
import { BarChart } from '@mui/x-charts/BarChart';
import { useT, useThemeMode } from '@shared/theme';

/**
 * Grouped Revenue vs. PAT (profit/loss) column chart, one pair of bars per fiscal year in
 * the order the API returns them (ascending — `fiscalYear` is a display string like
 * "FY 2021-22" or "Feb 2026", rendered verbatim on the x-axis, never re-parsed/re-sorted).
 *
 * PAT gets its own y-axis (right-hand side) rather than sharing Revenue's scale — the two
 * figures are routinely an order of magnitude apart, so a shared linear scale would
 * flatten PAT into an invisible sliver next to Revenue. That axis carries a piecewise
 * `colorMap` keyed on zero, so a loss year's bar renders in the error color and a profit
 * year in the success color — sign is legible at a glance, not just from the bar dipping
 * below the baseline. Revenue keeps a single static teal.
 *
 * Sized like every other chart on this page — no hardcoded `width`, full-width parent.
 * Renders nothing when there's no financials data (the caller already renders its own
 * loading/empty/error state around this).
 */
export default function FinancialsChart({ rows = [] }) {
  const T = useT();
  const { mode } = useThemeMode();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const axisColor = mode === 'dark' ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.55)';
  const gridColor = mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)';

  const { years, revenue, pat } = useMemo(() => ({
    years: rows.map((r) => r.fiscalYear ?? '—'),
    revenue: rows.map((r) => (r.revenue != null ? Number(r.revenue) : null)),
    pat: rows.map((r) => (r.pat != null ? Number(r.pat) : null)),
  }), [rows]);

  if (rows.length === 0) return null;

  const rotateLabels = isMobile && years.length > 4;
  const margin = isMobile
    ? { left: 40, right: 40, top: 16, bottom: rotateLabels ? 40 : 24 }
    : { left: 52, right: 52, top: 16, bottom: 28 };

  return (
    <Box sx={{ width: '100%', minWidth: 0, mb: 2 }}>
      <BarChart
        height={240}
        xAxis={[{
          scaleType: 'band',
          data: years,
          tickLabelStyle: rotateLabels
            ? { angle: -30, textAnchor: 'end', fontSize: 10 }
            : { fontSize: 10 },
        }]}
        yAxis={[
          { id: 'revenue', scaleType: 'linear', valueFormatter: (v) => `₹${v}` },
          {
            id: 'pat',
            scaleType: 'linear',
            position: 'right',
            valueFormatter: (v) => `₹${v}`,
            colorMap: { type: 'piecewise', thresholds: [0], colors: [T.error, T.success] },
          },
        ]}
        series={[
          { data: revenue, label: 'Revenue', yAxisId: 'revenue', color: T.teal },
          { data: pat, label: 'PAT', yAxisId: 'pat' },
        ]}
        margin={margin}
        borderRadius={3}
        sx={{
          '.MuiChartsAxis-tickLabel': { fill: axisColor, fontSize: 10 },
          '.MuiChartsAxis-line':      { stroke: gridColor },
          '.MuiChartsAxis-tick':      { stroke: gridColor },
          '.MuiChartsLegend-mark':    { rx: 2 },
          '.MuiChartsLegend-label':   { fill: T.textMuted, fontSize: 11 },
        }}
      />
    </Box>
  );
}
