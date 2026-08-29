import { useMemo, useState } from 'react';
import { Box, Typography, ToggleButtonGroup, ToggleButton, useMediaQuery, useTheme } from '@mui/material';
import { BarChart } from '@mui/x-charts/BarChart';
import { useT, useThemeMode } from '@shared/theme';
import { shortFinancialLabel } from '../utils/format';

/** The tabs, in display order. `combined` (the default) overlays Revenue + Profit as grouped
 * bars for an at-a-glance "are they growing AND profitable" read; the three single-metric tabs
 * each plot one `IpoFinancialDto` field full-width. `field` is the key each single tab plots and
 * `color` its static series color. Profit alone also gets a per-bar sign color (loss = red /
 * profit = green) via the y-axis `colorMap` when shown on its own tab; its static `color`
 * (green) is what the legend swatch uses in the combined view and the common profit case. */
const TABS = [
  { value: 'combined',    label: 'Rev + Profit' },
  { value: 'revenue',     label: 'Revenue',      field: 'revenue',     color: (T) => T.teal },
  { value: 'pat',         label: 'Profit',       field: 'pat',         color: (T) => T.success },
  { value: 'totalAssets', label: 'Total Assets', field: 'totalAssets', color: (T) => T.violet },
];

/** Compact on-bar value label — whole rupee-crore, grouped ("1,234"), blank for a missing
 * data point (MUI already skips drawing a bar for `null`, so an empty label just avoids a
 * stray "null"/"undefined" floating over the gap). */
const formatBarValue = (v) => (v == null ? '' : Math.round(Number(v)).toLocaleString('en-IN'));

/**
 * Financials bar chart for the detail page. A small tab group switches between a combined
 * Revenue + Profit view (default) and each single metric (Revenue / Profit / Total Assets).
 *
 * - Combined: two grouped series (Revenue teal, Profit violet) with a legend and a left value
 *   axis — magnitudes read off the axis, so no crowded on-bar labels, and the legend swatches
 *   match the bar colors exactly.
 * - Single: one full-width bar per fiscal period, Groww-style, with the value printed above each
 *   bar (`barLabel`) and no axis. The legend is hidden (the tab already names the metric), which
 *   is why the earlier build's stray legend swatch could disagree with the bar color.
 *
 * Order comes straight from the backend (already chronological by `periodEnd`) — never re-sorted
 * here, same rule as the P&L table below it.
 *
 * Profit can legitimately be negative (a loss year), so on its own tab its bars are colored
 * per-value via a piecewise y-axis `colorMap` (loss red / profit green), y-axis auto-extending
 * below zero. Renders nothing when there's no financials data — the caller (`FinancialsTable`)
 * owns the loading/empty/error state around this.
 */
export default function FinancialsChart({ rows = [] }) {
  const T = useT();
  const { mode } = useThemeMode();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [tab, setTab] = useState('combined');

  const axisColor = mode === 'dark' ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.55)';
  const gridColor = mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)';

  const { years, revenue, profit, assets } = useMemo(() => ({
    years: rows.map((r) => shortFinancialLabel(r.fiscalYear) ?? '—'),
    revenue: rows.map((r) => (r.revenue != null ? Number(r.revenue) : null)),
    profit: rows.map((r) => (r.pat != null ? Number(r.pat) : null)),
    assets: rows.map((r) => (r.totalAssets != null ? Number(r.totalAssets) : null)),
  }), [rows]);

  if (rows.length === 0) return null;

  const isCombined = tab === 'combined';
  const isProfit = tab === 'pat';
  const rotateLabels = isMobile && years.length > 5;
  const active = TABS.find((t) => t.value === tab) ?? TABS[0];
  const singleData = tab === 'revenue' ? revenue : tab === 'totalAssets' ? assets : profit;

  const series = isCombined
    ? [
        { data: revenue, label: 'Revenue', color: T.teal,   yAxisId: 'value' },
        { data: profit,  label: 'Profit',  color: T.violet, yAxisId: 'value' },
      ]
    : [{
        data: singleData,
        label: active.label,
        yAxisId: 'value',
        ...(active.color ? { color: active.color(T) } : {}),
        barLabel: (item) => formatBarValue(item.value),
        barLabelPlacement: 'outside',
      }];

  // Combined shows a left value-axis + legend (two series; magnitudes read off the axis, no
  // crowding on-bar labels). Single keeps the on-bar labels with no axis — which needs real top
  // headroom so the outside label above the TALLEST bar isn't clipped by the plot edge (the bug
  // where a tall bar's value vanished).
  const margin = isCombined
    ? { left: 48, right: 12, top: 16, bottom: rotateLabels ? 40 : 28 }
    : (isMobile
        ? { left: 8, right: 8, top: 44, bottom: rotateLabels ? 40 : 24 }
        : { left: 16, right: 16, top: 44, bottom: 28 });

  return (
    <Box sx={{ width: '100%', minWidth: 0, mb: 2 }}>
      <Box sx={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexWrap: 'wrap', gap: 1, mb: 1,
      }}>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={tab}
          onChange={(_, v) => v && setTab(v)}
          sx={{
            '& .MuiToggleButton-root': {
              px: 1.25, py: 0.25, fontSize: 11, fontWeight: 700,
              color: T.textMuted, borderColor: T.border, textTransform: 'none',
            },
            '& .Mui-selected': { color: `${T.teal} !important`, bgcolor: `${T.tealBg} !important` },
          }}
        >
          {TABS.map((t) => (
            <ToggleButton key={t.value} value={t.value}>{t.label}</ToggleButton>
          ))}
        </ToggleButtonGroup>
        <Typography sx={{ fontSize: 10.5, color: T.textMuted, fontWeight: 600 }}>
          All values in ₹ Cr
        </Typography>
      </Box>

      <BarChart
        height={260}
        hideLegend={!isCombined}
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
          // Single view keeps the axis off (on-bar labels carry the values); the combined view
          // shows it on the left so its two series can be read against a shared scale.
          position: isCombined ? 'left' : 'none',
          valueFormatter: (v) => `₹${v}`,
          ...(isProfit ? { colorMap: { type: 'piecewise', thresholds: [0], colors: [T.error, T.success] } } : {}),
        }]}
        series={series}
        margin={margin}
        borderRadius={3}
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
