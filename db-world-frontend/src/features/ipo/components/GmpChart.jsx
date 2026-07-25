import { useId, useMemo, useState } from 'react';
import { Box, Typography, ToggleButtonGroup, ToggleButton, Skeleton, useMediaQuery, useTheme } from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import { LineChart } from '@mui/x-charts/LineChart';
import { ChartsReferenceLine } from '@mui/x-charts/ChartsReferenceLine';
import { useXScale, useYScale } from '@mui/x-charts/hooks';
import { format } from 'date-fns';
import { useT, useThemeMode } from '@shared/theme';
import { formatCurrency, formatPct, formatShortDate, dayOverDayDelta } from '../utils/format';

const Y_AXIS_ID = 'gmpValue';

/** One labelled figure in the header stat row — a small uppercase caption over the
 * actual value, right-aligned for the second ("Change") slot so the pair reads as a
 * balanced two-column header the way the reference "GMP JOURNEY" card does. */
function StatBlock({ label, align, children }) {
  const T = useT();
  return (
    <Box sx={{ textAlign: align ?? 'left', minWidth: 0 }}>
      <Typography sx={{
        fontSize: 10.5, color: T.textFaint, textTransform: 'uppercase', letterSpacing: 0.4,
        fontWeight: 700, mb: 0.25,
      }}>
        {label}
      </Typography>
      {children}
    </Box>
  );
}

/** "Latest GMP" (big ₹ figure + %, colored by sign) and "Change" (▲/▼ + ₹ delta since
 * the first recorded point, colored by sign) — the stat row that sits above the chart
 * in the reference "GMP JOURNEY" design. Null-safe throughout: a missing latest value
 * renders an em dash rather than "₹null"/"₹NaN", and `change` is null (renders "—")
 * whenever there's fewer than two points or either side of the comparison is missing. */
function GmpJourneyHeader({ latest, sinceLabel, change }) {
  const T = useT();
  const latestGmp = latest?.gmp ?? null;
  const latestPct = latest?.gmpPct ?? null;
  const latestColor = latestGmp == null ? T.textPrimary : latestGmp >= 0 ? T.success : T.error;
  const changeColor = !change || change.direction === 'flat'
    ? T.textFaint
    : change.direction === 'up' ? T.success : T.error;
  const ChangeIcon = change?.direction === 'up' ? TrendingUpIcon : change?.direction === 'down' ? TrendingDownIcon : null;

  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1.5, mb: 1.75, flexWrap: 'wrap' }}>
      <StatBlock label="Latest GMP">
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, flexWrap: 'wrap' }}>
          <Typography sx={{ fontSize: 22, fontWeight: 900, color: latestColor, lineHeight: 1.1 }}>
            {formatCurrency(latestGmp) ?? '—'}
          </Typography>
          {latestPct != null && (
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: latestColor }}>
              {formatPct(latestPct)}
            </Typography>
          )}
        </Box>
      </StatBlock>
      <StatBlock label={sinceLabel ? `Change · since ${sinceLabel}` : 'Change'} align="right">
        {change == null ? (
          <Typography sx={{ fontSize: 18, fontWeight: 800, color: T.textFaint, lineHeight: 1.1 }}>—</Typography>
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.3 }}>
            {ChangeIcon && <ChangeIcon sx={{ fontSize: 18, color: changeColor }} />}
            <Typography sx={{ fontSize: 18, fontWeight: 800, color: changeColor, lineHeight: 1.1 }}>
              {change.direction === 'up' ? '+' : change.direction === 'down' ? '−' : ''}
              {formatCurrency(Math.abs(change.delta))}
            </Typography>
          </Box>
        )}
      </StatBlock>
    </Box>
  );
}

/** Subtle full-width footer strip echoing the latest point's date + GMP ₹/% — the
 * reference design's "…and here's today's reading, spelled out" closing line. */
function GmpJourneyFooter({ latest }) {
  const T = useT();
  if (!latest) return null;
  const pct = formatPct(latest.gmpPct);
  return (
    <Box sx={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, flexWrap: 'wrap',
      mt: 1.5, pt: 1, borderTop: `1px solid ${T.border}`,
    }}>
      <Typography sx={{ fontSize: 11.5, color: T.textFaint, fontWeight: 600 }}>
        {formatShortDate(latest.t) ?? '—'}
      </Typography>
      <Typography sx={{ fontSize: 11.5, color: T.textMuted, fontWeight: 700 }}>
        GMP {formatCurrency(latest.gmp) ?? '—'}
        {pct != null && (
          <Box component="span" sx={{ color: latest.gmp >= 0 ? T.success : T.error, ml: 0.5 }}>
            {pct}
          </Box>
        )}
      </Typography>
    </Box>
  );
}

/** Custom emphasized marker for the last data point, drawn on top of the regular
 * (smaller) per-point marks — a filled accent circle with a themed halo ring so it
 * pops as "you are here" against the gradient area fill beneath it. Rendered as a
 * child of `LineChart`, so it shares the chart's coordinate system via the same
 * `useXScale`/`useYScale` hooks the built-in plots use internally; resolves to
 * nothing if either scale can't place the point (e.g. mid-animation/resize). */
function LastPointMark({ x, y, color }) {
  const T = useT();
  const xScale = useXScale();
  const yScale = useYScale();
  if (x == null || y == null) return null;
  const cx = xScale(x);
  const cy = yScale(y);
  if (!Number.isFinite(cx) || !Number.isFinite(cy)) return null;
  return <circle cx={cx} cy={cy} r={6} fill={color} stroke={T.bg} strokeWidth={2.5} />;
}

function GmpChartSkeleton() {
  const T = useT();
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.75 }}>
        <Skeleton variant="text" width={110} height={40} sx={{ bgcolor: T.glassHover }} />
        <Skeleton variant="text" width={80} height={40} sx={{ bgcolor: T.glassHover }} />
      </Box>
      <Skeleton variant="rounded" height={240} sx={{ bgcolor: T.glassHover }} />
      <Skeleton variant="text" width="100%" height={20} sx={{ bgcolor: T.glassHover, mt: 1.5 }} />
    </Box>
  );
}

/**
 * GMP "journey" chart — rebuilt to match the shared reference design: a Latest/Change
 * stat header, a single-series area+line (`@mui/x-charts` `LineChart`) in the app's
 * teal accent with a gradient fill fading to transparent, circular marks at every
 * point plus an emphasized larger dot on the last one, a dashed "today" reference
 * line at the latest date, three horizontal ₹/% reference lines at the plotted
 * series' min/mid/max, a footer strip echoing the latest reading, and the (required)
 * grey-market disclaimer. A ₹/% toggle (defaulting to ₹) swaps which field is
 * plotted — unlike the old dual-axis chart this replaces, only one metric is ever on
 * screen at once, so there's a single (deliberately hidden — see `position: 'none'`
 * below) y-axis and the plot gets the chart's full width.
 *
 * Sized entirely by its parent (never a hardcoded pixel `width`) — see the
 * `width: '100%', minWidth: 0` chain below, which is what actually keeps this
 * full-width on mobile.
 */
export default function GmpChart({ points = [], loading }) {
  const T = useT();
  const { mode } = useThemeMode();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const rawGradientId = useId();
  const gradientId = `gmp-area-gradient-${rawGradientId.replace(/[^a-zA-Z0-9]/g, '')}`;
  const [view, setView] = useState('rupee'); // 'rupee' | 'pct' — defaults to ₹

  const axisColor = mode === 'dark' ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.55)';
  const gridColor = mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)';

  const hasHistory = points.length > 0;
  const hasTrend = points.length > 1;
  const latest = hasHistory ? points[points.length - 1] : null;
  const first = hasHistory ? points[0] : null;
  const change = hasTrend ? dayOverDayDelta(latest.gmp, first.gmp) : null;

  const field = view === 'pct' ? 'gmpPct' : 'gmp';
  // Reference-line labels read as plain axis-style figures ("₹91"/"40.0%"), not
  // gain/loss deltas — so unlike the header/footer stats they skip `formatPct`'s
  // forced "+" prefix on a positive value.
  const formatRefValue = view === 'pct' ? (v) => `${Number(v).toFixed(1)}%` : formatCurrency;

  const { xData, yData, domain } = useMemo(() => {
    const xd = points.map((p) => new Date(p.t));
    const yd = points.map((p) => (p[field] != null ? Number(p[field]) : null));
    const known = yd.filter((v) => v != null);
    if (known.length === 0) return { xData: xd, yData: yd, domain: null };
    const min = Math.min(...known);
    const max = Math.max(...known);
    const pad = (max - min || Math.abs(max) || 1) * 0.15;
    return { xData: xd, yData: yd, domain: { min, mid: (min + max) / 2, max, axisMin: min - pad, axisMax: max + pad } };
  }, [points, field]);

  const lastDate = xData.length ? xData[xData.length - 1] : null;
  const lastValue = yData.length ? yData[yData.length - 1] : null;
  const sinceLabel = hasTrend ? formatShortDate(first.t) : null;

  const margin = isMobile
    ? { left: 8, right: 40, top: 20, bottom: 24 }
    : { left: 8, right: 52, top: 20, bottom: 28 };

  return (
    <Box sx={{
      bgcolor: T.glass, border: `1px solid ${T.border}`, borderRadius: 3, p: { xs: 1.5, sm: 2 },
      width: '100%', minWidth: 0, boxSizing: 'border-box',
    }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: loading || !hasHistory ? 1.25 : 0 }}>
        <Typography sx={{ fontSize: 12, fontWeight: 800, color: T.textFaint, textTransform: 'uppercase', letterSpacing: 0.6 }}>
          GMP Journey
        </Typography>
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
          <ToggleButton value="rupee">₹</ToggleButton>
          <ToggleButton value="pct">%</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {loading ? (
        <GmpChartSkeleton />
      ) : !hasHistory ? (
        <Box sx={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography sx={{ color: T.textFaint, fontSize: 13 }}>No GMP history yet.</Typography>
        </Box>
      ) : (
        <>
          <GmpJourneyHeader latest={latest} sinceLabel={sinceLabel} change={change} />

          {!hasTrend ? (
            <Box sx={{
              height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: `1px dashed ${T.border}`, borderRadius: 2, px: 2,
            }}>
              <Typography sx={{ color: T.textFaint, fontSize: 12.5, textAlign: 'center' }}>
                Not enough GMP history yet to chart a trend.
              </Typography>
            </Box>
          ) : (
            <Box sx={{ width: '100%', minWidth: 0 }}>
              <LineChart
                height={240}
                xAxis={[{ data: xData, scaleType: 'time', valueFormatter: (v) => format(v, 'dd MMM') }]}
                yAxis={[{
                  id: Y_AXIS_ID,
                  scaleType: 'linear',
                  position: 'none', // data labels + reference lines convey the values; no left axis needed
                  domainLimit: 'strict',
                  ...(domain ? { min: domain.axisMin, max: domain.axisMax } : {}),
                }]}
                series={[{
                  id: 'value',
                  data: yData,
                  label: view === 'pct' ? 'GMP %' : 'GMP (₹)',
                  yAxisId: Y_AXIS_ID,
                  color: T.teal,
                  curve: 'monotoneX',
                  area: true,
                  showMark: true,
                }]}
                margin={margin}
                slotProps={{ legend: { hidden: true } }}
                sx={{
                  '.MuiAreaElement-root': { fill: `url(#${gradientId})` },
                  '.MuiChartsAxis-tickLabel': { fill: axisColor, fontSize: 10 },
                  '.MuiChartsAxis-line':      { stroke: gridColor },
                  '.MuiChartsAxis-tick':      { stroke: gridColor },
                }}
              >
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={T.teal} stopOpacity={0.4} />
                    <stop offset="100%" stopColor={T.teal} stopOpacity={0} />
                  </linearGradient>
                </defs>

                {domain && (
                  <>
                    <ChartsReferenceLine
                      y={domain.max}
                      axisId={Y_AXIS_ID}
                      label={formatRefValue(domain.max)}
                      labelAlign="end"
                      lineStyle={{ stroke: gridColor }}
                      labelStyle={{ fontSize: 10, fill: axisColor, fontWeight: 700 }}
                    />
                    <ChartsReferenceLine
                      y={domain.mid}
                      axisId={Y_AXIS_ID}
                      label={formatRefValue(domain.mid)}
                      labelAlign="end"
                      lineStyle={{ stroke: gridColor, strokeDasharray: '2 4' }}
                      labelStyle={{ fontSize: 10, fill: axisColor, fontWeight: 700 }}
                    />
                    <ChartsReferenceLine
                      y={domain.min}
                      axisId={Y_AXIS_ID}
                      label={formatRefValue(domain.min)}
                      labelAlign="end"
                      lineStyle={{ stroke: gridColor }}
                      labelStyle={{ fontSize: 10, fill: axisColor, fontWeight: 700 }}
                    />
                  </>
                )}

                {lastDate && (
                  <ChartsReferenceLine
                    x={lastDate}
                    lineStyle={{ stroke: T.textFaint, strokeDasharray: '4 4' }}
                  />
                )}

                {lastDate && lastValue != null && (
                  <LastPointMark x={lastDate} y={lastValue} color={T.teal} />
                )}
              </LineChart>
            </Box>
          )}

          <GmpJourneyFooter latest={latest} />
          <Typography sx={{ fontSize: 10.5, color: T.textFaint, mt: 1, lineHeight: 1.5 }}>
            GMP is informal, indicative, and sourced from grey market channels. Not investment advice.
          </Typography>
        </>
      )}
    </Box>
  );
}
