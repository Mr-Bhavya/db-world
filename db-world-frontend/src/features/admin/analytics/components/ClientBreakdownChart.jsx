import React from 'react';
import { Box, Typography, Skeleton } from '@mui/material';
import { PieChart } from '@mui/x-charts/PieChart';
import { useT } from '@shared/theme/ThemeContext';

const PALETTE = ['#0d9488', '#3b82f6', '#f59e0b', '#a855f7', '#ef4444', '#10b981', '#ec4899'];

export default function ClientBreakdownChart({ data, loading }) {
  const T = useT();

  const series = (data ?? []).map((d, i) => ({
    id:    d.clientType ?? `c${i}`,
    value: Number(d.count ?? 0),
    label: d.clientType ?? 'Unknown',
    color: PALETTE[i % PALETTE.length],
  }));

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
        Client breakdown · last 30 days
      </Typography>

      {loading ? (
        <Skeleton variant="rounded" height={240} sx={{ bgcolor: T.glass }} />
      ) : !series.length ? (
        <Box sx={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography sx={{ color: T.textFaint, fontSize: 13 }}>No data yet.</Typography>
        </Box>
      ) : (
        <PieChart
          height={240}
          series={[{
            data: series,
            innerRadius: 54, outerRadius: 96, paddingAngle: 2, cornerRadius: 4,
            highlightScope: { fade: 'global', highlight: 'item' },
          }]}
          margin={{ top: 10, bottom: 10, left: 10, right: 10 }}
          sx={{
            '.MuiChartsLegend-label': { fill: T.textMuted, fontSize: 11 },
          }}
        />
      )}
    </Box>
  );
}
