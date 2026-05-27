import React, { useMemo } from 'react';
import { Box, Typography, Skeleton } from '@mui/material';
import { LineChart } from '@mui/x-charts/LineChart';
import { useT, useThemeMode } from '@shared/theme/ThemeContext';

export default function ActivityTrendChart({ data, loading, days = 30 }) {
  const T = useT();
  const { mode } = useThemeMode();

  const series = useMemo(() => {
    if (!data?.length) return { dates: [], streams: [], downloads: [] };
    return {
      dates:     data.map(d => d.date),
      streams:   data.map(d => d.streams ?? 0),
      downloads: data.map(d => d.downloads ?? 0),
    };
  }, [data]);

  const axisColor  = mode === 'dark' ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.55)';
  const gridColor  = mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)';

  return (
    <Box sx={{
      bgcolor: T.glass, border: `1px solid ${T.border}`, borderRadius: 2,
      p: { xs: 1.5, sm: 2 }, display: 'flex', flexDirection: 'column',
      minHeight: 280,
    }}>
      <Typography sx={{
        fontSize: 11, color: T.textFaint, textTransform: 'uppercase',
        letterSpacing: '0.08em', fontWeight: 700, mb: 1,
      }}>
        Activity trend · last {days} days
      </Typography>

      {loading ? (
        <Skeleton variant="rounded" height={240} sx={{ bgcolor: T.glass }} />
      ) : !series.dates.length ? (
        <Box sx={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography sx={{ color: T.textFaint, fontSize: 13 }}>No activity yet.</Typography>
        </Box>
      ) : (
        <LineChart
          height={240}
          xAxis={[{ data: series.dates, scaleType: 'band' }]}
          series={[
            { data: series.streams,   label: 'Streams',   color: '#3b82f6', area: false, curve: 'monotoneX' },
            { data: series.downloads, label: 'Downloads', color: '#0d9488', area: false, curve: 'monotoneX' },
          ]}
          margin={{ left: 48, right: 16, top: 16, bottom: 28 }}
          sx={{
            '.MuiChartsAxis-tickLabel':    { fill: axisColor, fontSize: 10 },
            '.MuiChartsAxis-line':         { stroke: gridColor },
            '.MuiChartsAxis-tick':         { stroke: gridColor },
            '.MuiChartsLegend-mark':       { rx: 2 },
            '.MuiChartsLegend-label':      { fill: T.textMuted, fontSize: 11 },
          }}
        />
      )}
    </Box>
  );
}
