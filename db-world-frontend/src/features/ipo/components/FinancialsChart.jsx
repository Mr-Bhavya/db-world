import { useMemo, useState } from 'react';
import { Box, Typography, ToggleButtonGroup, ToggleButton, useMediaQuery, useTheme } from '@mui/material';
import { BarChart } from '@mui/x-charts/BarChart';
import { useT, useThemeMode } from '@shared/theme';
import { shortFinancialLabel } from '../utils/format';

/** The three metric tabs, in display order — `field` is the `IpoFinancialDto` key each one
 * plots, `color` the static series color for the two metrics that are never negative
 * (Profit gets a per-bar sign color instead, via the y-axis `colorMap` below, so it has
 * no static color of its own here). */
const METRICS = [
  { value: 'revenue', label: 'Revenue', field: 'revenue', color: (T) => T.teal },
  { value: 'pat', label: 'Profit', field: 'pat', color: null },
  { value: 'totalAssets', label: 'Total Assets', field: 'totalAssets', color: (T) => T.violet },
];

/** Compact on-bar value label — whole rupee-crore, grouped ("1,234"), blank for a missing
 * data point (MUI already skips drawing a bar for `null`, so an empty label just avoids a
 * stray "null"/"undefined" floating over the gap). */
const formatBarValue = (v) => (v == null ? '' : Math.round(Number(v)).toLocaleString('en-IN'));

/**
 * Groww-style single-metric bar chart for the financials section: a small tab group
 * (Revenue / Profit / Total Assets) swaps which `IpoFinancialDto` field is plotted, one
 * full-width bar per fiscal period, value printed above each bar via `barLabel`. Only one
 * metric on screen at a time (unlike the old dual-axis Revenue+PAT chart this replaces),
 * so there's a single y-axis and the plot can use the whole card width instead of splitting
 * it with a second axis.
 *
 * Order comes straight from the backend (already chronological by `periodEnd`) — never
 * re-sorted here, same rule as the P&L table below it.
 *
 * Profit can legitimately be negative (a loss year), so its bars are colored per-value via
 * a piecewise y-axis `colorMap` (loss = error/red, profit = success/green) rather than a
 * single static color, and the y-axis is left to auto-extend below zero. Revenue and Total
 * Assets are never negative, so they just get one static theme color each.
 *
 * Renders nothing when there's no financials data — the caller (`FinancialsTable`) already
 * renders its own loading/empty/error state around this.
 */
export default function FinancialsChart({ rows = [] }) {
  const T = useT();
  const { mode } = useThemeMode();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [metric, setMetric] = useState('revenue');

  const axisColor = mode === 'dark' ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.55)';
  const gridColor = mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)';

  const active = METRICS.find((m) => m.value === metric) ?? METRICS[0];

  const { years, values } = useMemo(() => ({
    years: rows.map((r) => shortFinancialLabel(r.fiscalYear) ?? '—'),
    values: rows.map((r) => (r[active.field] != null ? Number(r[active.field]) : null)),
  }), [rows, active.field]);

  if (rows.length === 0) return null;

  const rotateLabels = isMobile && years.length > 5;
  // No left-hand axis to reserve room for anymore (see `yAxis.position: 'none'` below) —
  // just a little breathing room so the edge bars/labels aren't flush against the card.
  const margin = isMobile
    ? { left: 8, right: 8, top: 30, bottom: rotateLabels ? 40 : 24 }
    : { left: 16, right: 16, top: 30, bottom: 28 };

  const isProfit = active.value === 'pat';

  return (
    <Box sx={{ width: '100%', minWidth: 0, mb: 2 }}>
      <Box sx={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexWrap: 'wrap', gap: 1, mb: 1,
      }}>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={metric}
          onChange={(_, v) => v && setMetric(v)}
          sx={{
            '& .MuiToggleButton-root': {
              px: 1.25, py: 0.25, fontSize: 11, fontWeight: 700,
              color: T.textMuted, borderColor: T.border, textTransform: 'none',
            },
            '& .Mui-selected': { color: `${T.teal} !important`, bgcolor: `${T.tealBg} !important` },
          }}
        >
          {METRICS.map((m) => (
            <ToggleButton key={m.value} value={m.value}>{m.label}</ToggleButton>
          ))}
        </ToggleButtonGroup>
        <Typography sx={{ fontSize: 10.5, color: T.textFaint, fontWeight: 600 }}>
          All values in ₹ Cr
        </Typography>
      </Box>

      <BarChart
        height={260}
        xAxis={[{
          scaleType: 'band',
          data: years,
          tickLabelStyle: rotateLabels
            ? { angle: -30, textAnchor: 'end', fontSize: 10 }
            : { fontSize: 10 },
        }]}
        yAxis={[{
          id: 'value',
          scaleType: 'linear',
          // Groww-style: the on-bar labels already carry the value, so the axis itself
          // (line + ticks + labels) is redundant — `position: 'none'` drops it entirely
          // (and reclaims its width for the plot) while the scale/domain/baseline the bars
          // are drawn against, and the piecewise loss/profit colorMap below, are unaffected;
          // negative Profit bars still render below the zero baseline correctly.
          position: 'none',
          valueFormatter: (v) => `₹${v}`,
          ...(isProfit ? { colorMap: { type: 'piecewise', thresholds: [0], colors: [T.error, T.success] } } : {}),
        }]}
        series={[{
          data: values,
          label: active.label,
          yAxisId: 'value',
          ...(active.color ? { color: active.color(T) } : {}),
          barLabel: (item) => formatBarValue(item.value),
          barLabelPlacement: 'outside',
        }]}
        margin={margin}
        borderRadius={3}
        slotProps={{ legend: { hidden: true } }}
        sx={{
          '.MuiChartsAxis-tickLabel': { fill: axisColor, fontSize: 10 },
          '.MuiChartsAxis-line':      { stroke: gridColor },
          '.MuiChartsAxis-tick':      { stroke: gridColor },
          '.MuiBarLabel-root':        { fill: T.textPrimary, fontSize: 10, fontWeight: 700 },
        }}
      />
    </Box>
  );
}
