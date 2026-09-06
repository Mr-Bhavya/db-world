import { useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import { useT } from '@shared/theme';
import { formatShortDate, formatCurrency, formatPct, dayOverDayDelta } from '../utils/format';
import GmpChart from './GmpChart';
import SectionCard, { SectionStack } from './SectionCard';
import DayWiseTable from './DayWiseTable';
import GreyMarketRead, { hasGreyMarketRead } from './GreyMarketRead';

/** Small ▲/▼ day-over-day change cell — a plain em dash for the earliest row (nothing to
 * compare against) or a genuinely flat day. */
function ChangeCell({ change }) {
  const T = useT();
  if (!change || change.direction === 'flat') {
    return <Typography sx={{ fontSize: 12.5, color: T.textFaint, textAlign: 'right' }}>—</Typography>;
  }
  const up = change.direction === 'up';
  const color = up ? T.success : T.error;
  const Icon = up ? TrendingUpIcon : TrendingDownIcon;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.3 }}>
      <Icon sx={{ fontSize: 14, color }} />
      <Typography sx={{ fontSize: 12.5, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>
        {up ? '+' : '-'}{formatCurrency(Math.abs(change.delta))}
      </Typography>
    </Box>
  );
}

/** Plain text cell — kept tiny/local since it's used only by the column renderers below. */
function Cell({ children, bold, muted, align }) {
  const T = useT();
  return (
    <Typography sx={{
      fontSize: 13, fontWeight: bold ? 700 : 400, textAlign: align ?? 'left',
      color: muted ? T.textMuted : T.textPrimary,
      fontVariantNumeric: align === 'right' ? 'tabular-nums' : undefined,
    }}>
      {children}
    </Typography>
  );
}

const GMP_COLUMNS = [
  {
    key: 'date', label: 'Date', width: '1.2fr',
    render: (r) => <Cell bold>{formatShortDate(r.date) ?? '—'}</Cell>,
  },
  {
    key: 'gmp', label: 'GMP', align: 'right', width: '0.9fr',
    render: (r) => <Cell bold align="right">{formatCurrency(r.gmp) ?? '—'}</Cell>,
  },
  {
    key: 'gmpPct', label: 'GMP %', align: 'right', width: '0.9fr',
    render: (r) => <Cell align="right" muted>{formatPct(r.gmpPct) ?? '—'}</Cell>,
  },
  {
    key: 'change', label: 'Change', align: 'right', width: '1.1fr',
    render: (r) => <ChangeCell change={r.change} />,
  },
];

/**
 * GMP tab — the whole grey market for this IPO, and nothing else.
 *
 * It used to be the chart, an "Expected listing price" stat, and a history table, while the
 * grey market's other half — investorgain's rating, range, per-lot profit estimate, subject-to-
 * sauda and P/E — sat on the Overview tab under the heading "Live market read". That split cost
 * two things: the estimated listing price was rendered three times across the page (hero footnote,
 * Overview, here), and investorgain's P/E landed on the Overview immediately below the
 * prospectus's own P/E from a different source, where two legitimately different numbers read as
 * one being wrong. Both now live here, in one attributed section.
 *
 * (Source attribution for the day-wise series was removed pending the final crediting requirement
 * — it will be re-added deliberately once that's settled, hence `IpoGuruAttribution` is
 * intentionally left in the tree unused.)
 */
export default function GmpTab({ ipo, points, loading }) {
  const T = useT();

  const rows = useMemo(() => {
    const withChange = points.map((p, i) => ({
      key: p.t,
      date: p.t,
      gmp: p.gmp,
      gmpPct: p.gmpPct,
      change: i > 0 ? dayOverDayDelta(p.gmp, points[i - 1].gmp) : null,
    }));
    return [...withChange].reverse();
  }, [points]);

  return (
    <SectionStack>
      <GmpChart points={points} loading={loading} />

      {!loading && hasGreyMarketRead(ipo, points) && <GreyMarketRead ipo={ipo} points={points} />}

      <SectionCard
        title="Day-wise GMP"
        subtitle="Each row is a reading recorded on that date, most recent first."
        icon={<HistoryOutlinedIcon sx={{ fontSize: 15, color: T.teal }} />}
      >
        <DayWiseTable columns={GMP_COLUMNS} rows={rows} loading={loading} emptyLabel="No GMP history yet." />
      </SectionCard>

      {/* One disclaimer for the tab rather than one per section: the chart and the grey-market
          read each carried their own, saying nearly the same thing a screen apart — and the
          chart's lived inside its "has history" branch, so it vanished precisely when there was
          no chart to qualify. Here it is always present, exactly once. */}
      <Typography sx={{ fontSize: 11, color: T.textFaint, lineHeight: 1.55 }}>
        Grey market premium is informal and sourced from unofficial grey-market channels. Every
        figure on this tab is indicative only — not an exchange price, and not investment advice.
      </Typography>
    </SectionStack>
  );
}
