import { useMemo, useState } from 'react';
import { Box, Typography, ToggleButtonGroup, ToggleButton, Skeleton, useMediaQuery, useTheme } from '@mui/material';
import { LineChart } from '@mui/x-charts/LineChart';
import { format } from 'date-fns';
import { useT, useThemeMode } from '@shared/theme';

/** Dual-axis GMP chart: ₹ on the left, % on the right, shared time x-axis. Sized entirely
 * by its parent (never a hardcoded pixel `width`) — see the `width: '100%', minWidth: 0`
 * chain below, which is what actually keeps this full-width on mobile. */
export default function GmpChart({ points = [], loading }) {
  const T = useT();
  const { mode } = useThemeMode();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [view, setView] = useState('both'); // 'both' | 'rupee' | 'pct'

  const axisColor = mode === 'dark' ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.55)';
  const gridColor = mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)';

  const { xData, gmpData, pctData } = useMemo(() => ({
    xData: points.map((p) => new Date(p.t)),
    gmpData: points.map((p) => p.gmp),
    pctData: points.map((p) => p.gmpPct),
  }), [points]);

  const showRupee = view !== 'pct';
  const showPct = view !== 'rupee';
  const compact = points.length <= 20;

  const series = useMemo(() => [
    showRupee && {
      id: 'gmp', data: gmpData, label: 'GMP (₹)', yAxisId: 'left', color: T.teal,
      curve: 'monotoneX', area: view === 'rupee', showMark: compact,
    },
    showPct && {
      id: 'gmpPct', data: pctData, label: 'GMP %', yAxisId: 'right', color: '#a855f7',
      curve: 'monotoneX', showMark: compact,
    },
  ].filter(Boolean), [showRupee, showPct, gmpData, pctData, view, compact, T.teal]);

  const yAxis = useMemo(() => {
    const axes = [];
    if (showRupee) axes.push({ id: 'left', scaleType: 'linear', label: '₹', valueFormatter: (v) => `₹${v}` });
    if (showPct) axes.push({ id: 'right', scaleType: 'linear', position: 'right', label: '%', valueFormatter: (v) => `${v}%` });
    return axes;
  }, [showRupee, showPct]);

  // Tighter margins on mobile leave more room for the actual plot area — the axis
  // labels stay legible (MUI already thins out time-axis ticks to fit) while the chart
  // itself keeps using the full card width in both cases.
  const margin = isMobile
    ? { left: 36, right: 36, top: 12, bottom: 24 }
    : { left: 48, right: 48, top: 16, bottom: 28 };

  return (
    <Box sx={{
      bgcolor: T.glass, border: `1px solid ${T.border}`, borderRadius: 3, p: { xs: 1.5, sm: 2 },
      width: '100%', minWidth: 0, boxSizing: 'border-box',
    }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 1.25 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 800, color: T.textPrimary }}>GMP History</Typography>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={view}
          onChange={(_, v) => v && setView(v)}
          sx={{
            '& .MuiToggleButton-root': {
              px: 1.25, py: 0.25, fontSize: 11, fontWeight: 700,
              color: T.textMuted, borderColor: T.border, textTransform: 'none',
            },
            '& .Mui-selected': { color: `${T.teal} !important`, bgcolor: `${T.tealBg} !important` },
          }}
        >
          <ToggleButton value="both">₹ / %</ToggleButton>
          <ToggleButton value="rupee">₹</ToggleButton>
          <ToggleButton value="pct">%</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {loading ? (
        <Skeleton variant="rounded" height={260} sx={{ bgcolor: T.glassHover }} />
      ) : points.length === 0 ? (
        <Box sx={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography sx={{ color: T.textFaint, fontSize: 13 }}>No GMP history yet.</Typography>
        </Box>
      ) : (
        <Box sx={{ width: '100%', minWidth: 0 }}>
          <LineChart
            height={280}
            xAxis={[{ data: xData, scaleType: 'time', valueFormatter: (v) => format(v, 'dd MMM') }]}
            yAxis={yAxis}
            series={series}
            margin={margin}
            slotProps={{ legend: { hidden: series.length < 2 } }}
            sx={{
              '.MuiChartsAxis-tickLabel': { fill: axisColor, fontSize: 10 },
              '.MuiChartsAxis-line':      { stroke: gridColor },
              '.MuiChartsAxis-tick':      { stroke: gridColor },
              '.MuiChartsLegend-mark':    { rx: 2 },
              '.MuiChartsLegend-label':   { fill: T.textMuted, fontSize: 11 },
            }}
          />
        </Box>
      )}
    </Box>
  );
}
