import { useMemo } from 'react';
import { Box, useMediaQuery, useTheme } from '@mui/material';
import { LineChart } from '@mui/x-charts/LineChart';
import { useT, useThemeMode } from '@shared/theme';
import { bucketLabel, formatMoneyCompact } from '../utils/tallyFormat';
import { cumulativeSeries } from '../utils/chartSeries';

/** Roughly how many labels fit under the axis before they start colliding. */
const LABEL_BUDGET = { WEEKDAY: 7, DAY: 7, MONTH: 12, YEAR: 12 };

/** What to call the period behind this one, in the legend. */
const PREVIOUS_LABEL = { WEEK: 'Last week', MONTH: 'Last month', YEAR: 'Last year' };
const CURRENT_LABEL = { WEEK: 'This week', MONTH: 'This month', YEAR: 'This year' };

/**
 * The period's spending as a climbing total, with the period before it drawn behind.
 *
 * <h2>What this answers that the bars do not</h2>
 * The bar chart shows the shape of a month — which days had a big night out in them. This shows
 * the <em>pace</em>: by the 15th, are we above or below where we were by the 15th of last month.
 * That is the question a shared ledger gets asked halfway through a month, and neither a bar
 * chart nor a single "last month" total can answer it: a total is where the last period finished,
 * not where it had got to by today.
 *
 * <p>The two periods are aligned by <b>index</b>, not by date — day 1 against day 1 — because
 * they are not the same length. A 31-day January compared with February has three days with
 * nothing to sit beside, and they are dropped rather than bunched onto the 28th.
 *
 * <p>The current line stops at today rather than running flat to the end of the month. Days that
 * have not happened yet are not days on which nothing was spent, and a flat tail draws them as
 * though they were.
 *
 * <p>Last period is grey and dashed rather than a second series colour. It is a reference, not
 * another category, and giving it a hue of its own would make the chart look like a comparison
 * of two equal things instead of this one against its own history.
 */
export default function CumulativeChart({
  period, unit = 'DAY', buckets = [], previousBuckets = [], height = 210,
}) {
  const T = useT();
  const { mode } = useThemeMode();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const axisColor = mode === 'dark' ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.55)';
  const gridColor = mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)';
  const ghostColor = mode === 'dark' ? 'rgba(255,255,255,0.32)' : 'rgba(0,0,0,0.30)';

  const labels = useMemo(
    () => buckets.map((b) => bucketLabel(unit, b.start)),
    [buckets, unit],
  );
  const { current, previous, hasPrevious } = useMemo(
    () => cumulativeSeries(buckets, previousBuckets),
    [buckets, previousBuckets],
  );

  if (buckets.length === 0) return null;

  const budget = LABEL_BUDGET[unit] ?? 7;
  const every = Math.max(1, Math.ceil(labels.length / (isMobile ? budget : budget * 1.6)));
  // A range the reader picked has no name, so the legend says what it is instead of guessing
  // at "last month" for eleven weeks.
  const previousLabel = PREVIOUS_LABEL[period] ?? 'The period before';
  const currentLabel = CURRENT_LABEL[period] ?? 'This period';

  return (
    <Box sx={{ width: '100%', minWidth: 0 }}>
      <LineChart
        height={height}
        hideLegend={!hasPrevious}
        xAxis={[{
          scaleType: 'point',
          data: labels,
          tickLabelInterval: (_, index) => index % every === 0,
          tickLabelStyle: { fontSize: 10 },
        }]}
        yAxis={[{
          scaleType: 'linear',
          position: 'none',
        }]}
        // Last period first, so this period draws over it rather than under.
        series={[
          ...(hasPrevious ? [{
            id: 'previous',
            data: previous,
            label: previousLabel,
            color: ghostColor,
            showMark: false,
            curve: 'monotoneX',
            valueFormatter: (v) => (v == null ? '—' : formatMoneyCompact(v)),
          }] : []),
          {
            id: 'current',
            data: current,
            label: currentLabel,
            color: T.teal,
            area: true,
            showMark: false,
            curve: 'monotoneX',
            valueFormatter: (v) => (v == null ? 'not yet' : formatMoneyCompact(v)),
          },
        ]}
        margin={{ left: 4, right: 4, top: 8, bottom: 22 }}
        sx={{
          '.MuiChartsAxis-tickLabel': { fill: axisColor, fontSize: 10 },
          '.MuiChartsAxis-line': { stroke: gridColor },
          '.MuiChartsAxis-tick': { stroke: gridColor },
          '.MuiLineElement-root': { strokeWidth: 2 },
          // Dashed, so the reference reads as a reference even where it crosses this period's
          // line and even for a reader who cannot tell the two colours apart.
          '.MuiLineElement-series-previous': { strokeDasharray: '6 5' },
          '.MuiAreaElement-series-current': { fill: T.teal, fillOpacity: 0.14 },
          // The legend is an HTML <ul>, not part of the SVG -- so this is `color` on a span and
          // not `fill` on a <text>, and an sx rule written the SVG way silently matches nothing.
          // Worth stating because the default it falls back to is the MUI theme's ink, which
          // this app never switches to dark: rgba(0,0,0,0.87) on a near-black card, leaving the
          // two series unlabelled exactly where telling them apart is the point.
          '.MuiChartsLegend-label': { color: T.textMuted, fontSize: 11.5 },
        }}
      />
    </Box>
  );
}
