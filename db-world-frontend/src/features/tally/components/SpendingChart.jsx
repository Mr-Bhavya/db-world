import { useMemo } from 'react';
import { Box, useMediaQuery, useTheme } from '@mui/material';
import { BarChart } from '@mui/x-charts/BarChart';
import { useT, useThemeMode } from '@shared/theme';
import { bucketLabel, formatMoneyCompact } from '../utils/tallyFormat';

/** Roughly how many labels fit under the axis before they start colliding. */
const LABEL_BUDGET = { WEEK: 7, MONTH: 7, YEAR: 12 };

/**
 * The shape of a period's spending: one bar per day for a week or a month, per month for a year.
 *
 * The empty bars are the point. A chart drawn only from the days money was spent compresses a
 * quiet fortnight into nothing and makes a steady month and a single blowout look identical —
 * the gaps between spends are most of what somebody is looking for here. The server sends every
 * bucket including the zeroes for the same reason.
 */
export default function SpendingChart({ period = 'MONTH', buckets = [], height = 200 }) {
  const T = useT();
  const { mode } = useThemeMode();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const axisColor = mode === 'dark' ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.55)';
  const gridColor = mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)';

  const { labels, values } = useMemo(() => ({
    labels: buckets.map((b) => bucketLabel(period, b.start)),
    values: buckets.map((b) => Number(b.amount ?? 0)),
  }), [buckets, period]);

  if (buckets.length === 0) return null;

  // A month has thirty-odd bars and room for about seven labels, so most ticks are dropped
  // rather than shrunk to the point of illegibility or rotated into a thicket. The tooltip
  // names the exact day, which is the only time anybody needs it.
  const budget = LABEL_BUDGET[period] ?? 7;
  const every = Math.max(1, Math.ceil(labels.length / (isMobile ? budget : budget * 1.6)));

  return (
    <Box sx={{ width: '100%', minWidth: 0 }}>
      <BarChart
        height={height}
        hideLegend
        xAxis={[{
          scaleType: 'band',
          data: labels,
          tickLabelInterval: (_, index) => index % every === 0,
          tickLabelStyle: { fontSize: 10 },
        }]}
        yAxis={[{
          scaleType: 'linear',
          // No value axis: the headline above the chart already carries the total, and a
          // rupee scale down the side of a phone-width chart costs more room than it earns.
          position: 'none',
        }]}
        series={[{
          data: values,
          label: 'Your share',
          color: T.teal,
          valueFormatter: (v) => (v ? formatMoneyCompact(v) : 'nothing'),
        }]}
        margin={{ left: 4, right: 4, top: 8, bottom: 22 }}
        borderRadius={4}
        sx={{
          '.MuiChartsAxis-tickLabel': { fill: axisColor, fontSize: 10 },
          '.MuiChartsAxis-line': { stroke: gridColor },
          '.MuiChartsAxis-tick': { stroke: gridColor },
        }}
      />
    </Box>
  );
}
