import { useMemo } from 'react';
import { Box, Typography, Skeleton } from '@mui/material';
import { LineChart } from '@mui/x-charts/LineChart';
import { format } from 'date-fns';
import { useT, useThemeMode } from '@shared/theme';

/** Multi-line subscription chart: QIB / NII / Retail / Total over time. */
export default function SubscriptionChart({ points = [], loading }) {
  const T = useT();
  const { mode } = useThemeMode();

  const axisColor = mode === 'dark' ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.55)';
  const gridColor = mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)';
  const compact = points.length <= 20;

  const { xData, qib, nii, retail, total } = useMemo(() => ({
    xData:  points.map((p) => new Date(p.t)),
    qib:    points.map((p) => p.qib),
    nii:    points.map((p) => p.nii),
    retail: points.map((p) => p.retail),
    total:  points.map((p) => p.total),
  }), [points]);

  return (
    <Box sx={{ bgcolor: T.glass, border: `1px solid ${T.border}`, borderRadius: 3, p: { xs: 1.5, sm: 2 } }}>
      <Typography sx={{ fontSize: 13, fontWeight: 800, color: T.textPrimary, mb: 1.25 }}>
        Subscription History
      </Typography>

      {loading ? (
        <Skeleton variant="rounded" height={260} sx={{ bgcolor: T.glassHover }} />
      ) : points.length === 0 ? (
        <Box sx={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography sx={{ color: T.textFaint, fontSize: 13 }}>No subscription data yet.</Typography>
        </Box>
      ) : (
        <LineChart
          height={280}
          xAxis={[{ data: xData, scaleType: 'time', valueFormatter: (v) => format(v, 'dd MMM') }]}
          yAxis={[{ scaleType: 'linear', valueFormatter: (v) => `${v}x` }]}
          series={[
            { data: qib,    label: 'QIB',    color: '#38bdf8', curve: 'monotoneX', showMark: compact },
            { data: nii,    label: 'NII',    color: '#a855f7', curve: 'monotoneX', showMark: compact },
            { data: retail, label: 'Retail', color: '#f59e0b', curve: 'monotoneX', showMark: compact },
            { data: total,  label: 'Total',  color: T.teal,    curve: 'monotoneX', showMark: compact },
          ]}
          margin={{ left: 44, right: 16, top: 16, bottom: 28 }}
          sx={{
            '.MuiChartsAxis-tickLabel': { fill: axisColor, fontSize: 10 },
            '.MuiChartsAxis-line':      { stroke: gridColor },
            '.MuiChartsAxis-tick':      { stroke: gridColor },
            '.MuiChartsLegend-mark':    { rx: 2 },
            '.MuiChartsLegend-label':   { fill: T.textMuted, fontSize: 11 },
          }}
        />
      )}
    </Box>
  );
}
