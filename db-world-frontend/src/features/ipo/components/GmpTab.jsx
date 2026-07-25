import { useMemo } from 'react';
import { Box, Typography, Chip } from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import { useT } from '@shared/theme';
import { formatShortDate, formatCurrency, formatPct, expectedListingPrice, dayOverDayDelta } from '../utils/format';
import GmpChart from './GmpChart';
import IpoGuruAttribution from './IpoGuruAttribution';
import SectionCard from './SectionCard';
import DayWiseTable from './DayWiseTable';

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
      <Typography sx={{ fontSize: 12.5, fontWeight: 700, color }}>
        {up ? '+' : '-'}{formatCurrency(Math.abs(change.delta))}
      </Typography>
    </Box>
  );
}

/** Expected listing price = upper price band + latest GMP, with the implied gain % vs
 * the band. Hidden entirely (renders nothing) when either input is missing. */
function ExpectedListingStat({ ipo, points }) {
  const T = useT();
  const latestGmp = ipo.gmp ?? (points.length ? points[points.length - 1].gmp : null);
  const result = expectedListingPrice(ipo.priceMax, latestGmp);
  if (!result) return null;
  const gainColor = result.gainPct > 0 ? T.success : result.gainPct < 0 ? T.error : T.textMuted;
  const gainBg = result.gainPct > 0 ? T.successBg : result.gainPct < 0 ? T.errorBg : T.glassHover;
  return (
    <SectionCard title="Expected listing price" icon={<TrendingUpIcon sx={{ fontSize: 15, color: T.teal }} />}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.25, flexWrap: 'wrap' }}>
        <Typography sx={{ fontSize: 24, fontWeight: 900, color: T.textPrimary }}>
          {formatCurrency(result.price)}
        </Typography>
        <Chip
          size="small"
          label={formatPct(result.gainPct)}
          sx={{ height: 22, fontSize: 12, fontWeight: 800, color: gainColor, bgcolor: gainBg }}
        />
      </Box>
      <Typography sx={{ fontSize: 11.5, color: T.textFaint, mt: 0.5 }}>
        vs upper price band {formatCurrency(ipo.priceMax) ?? '—'}
      </Typography>
    </SectionCard>
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

/** Plain text cell — kept tiny/local since it's used only by the column renderers above. */
function Cell({ children, bold, muted, align }) {
  const T = useT();
  return (
    <Typography sx={{
      fontSize: 13, fontWeight: bold ? 700 : 400, textAlign: align ?? 'left',
      color: muted ? T.textMuted : T.textPrimary,
    }}>
      {children}
    </Typography>
  );
}

/**
 * GMP tab — dual-axis (₹/%) chart with the (contractual) IPO Guru attribution kept
 * prominent right next to the data it credits, an expected-listing-price stat, and a
 * most-recent-first day-wise GMP history table.
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
    <Box sx={{ width: '100%', minWidth: 0 }}>
      <IpoGuruAttribution />
      <Box sx={{ width: '100%', minWidth: 0, mb: 2 }}>
        <GmpChart points={points} loading={loading} />
      </Box>

      {!loading && <ExpectedListingStat ipo={ipo} points={points} />}

      <SectionCard title="Day-wise GMP" icon={<HistoryOutlinedIcon sx={{ fontSize: 15, color: T.teal }} />}>
        <DayWiseTable columns={GMP_COLUMNS} rows={rows} loading={loading} emptyLabel="No GMP history yet." />
      </SectionCard>
    </Box>
  );
}
