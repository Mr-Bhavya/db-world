import { useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import BusinessCenterOutlinedIcon from '@mui/icons-material/BusinessCenterOutlined';
import WorkspacePremiumOutlinedIcon from '@mui/icons-material/WorkspacePremiumOutlined';
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined';
import EqualizerOutlinedIcon from '@mui/icons-material/EqualizerOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import { useT } from '@shared/theme';
import { formatShortDate, formatMultiplier, subscriptionMeta, averageSubscription } from '../utils/format';
import SubscriptionChart from './SubscriptionChart';
import SectionCard from './SectionCard';
import DayWiseTable from './DayWiseTable';

/** One labelled subscription figure (Total/Average) — icon + multiplier, null-safe
 * (falls back to an em dash rather than hiding the tile). */
function BreakdownTile({ icon: Icon, label, value, highlight }) {
  const T = useT();
  return (
    <Box sx={{
      p: 1.25, borderRadius: 2, display: 'flex', alignItems: 'center', gap: 1,
      bgcolor: highlight ? T.tealBg : 'transparent',
      border: highlight ? `1px solid ${T.teal}33` : 'none',
    }}>
      <Icon sx={{ fontSize: 18, color: highlight ? T.teal : T.textFaint, flexShrink: 0 }} />
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: 10.5, color: T.textFaint, textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 700 }}>
          {label}
        </Typography>
        <Typography sx={{ fontSize: 15, fontWeight: 800, color: T.textPrimary, mt: 0.1 }} noWrap>
          {value ?? '—'}
        </Typography>
      </Box>
    </Box>
  );
}

/**
 * One category's subscription progress bar (QIB / NII-HNI / Retail) — reuses the exact
 * same color tiers and fill-capped-at-100% treatment (`subscriptionMeta`) as the list
 * card's own subscription bar, so a "hot" 15× issue reads identically here and there.
 * Null-safe: a category with no value yet (subscription hasn't opened, or the registrar
 * hasn't reported that split) renders nothing rather than a bar stuck at a misleading 0%.
 */
function CategoryBar({ icon: Icon, label, value }) {
  const T = useT();
  const meta = subscriptionMeta(value, T);
  if (!meta) return null;
  return (
    <Box sx={{ minWidth: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 0.6 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, minWidth: 0 }}>
          <Icon sx={{ fontSize: 15, color: meta.color, flexShrink: 0 }} />
          <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: T.textMuted }} noWrap>{label}</Typography>
        </Box>
        <Typography sx={{ fontSize: 12.5, fontWeight: 800, color: meta.color, flexShrink: 0 }}>
          {formatMultiplier(value)}
        </Typography>
      </Box>
      <Box sx={{ height: 6, borderRadius: 999, bgcolor: T.glassHover, overflow: 'hidden' }}>
        <Box sx={{
          height: '100%', width: `${meta.fillPct}%`, borderRadius: 999, bgcolor: meta.color,
          boxShadow: meta.hot ? `0 0 6px ${meta.color}` : 'none',
          transition: 'width 0.3s ease',
        }} />
      </Box>
    </Box>
  );
}

function Cell({ children, bold, align }) {
  const T = useT();
  return (
    <Typography sx={{ fontSize: 13, fontWeight: bold ? 700 : 400, textAlign: align ?? 'left', color: T.textPrimary }}>
      {children}
    </Typography>
  );
}

const SUB_COLUMNS = [
  { key: 'date', label: 'Date', width: '1.2fr', render: (r) => <Cell bold>{formatShortDate(r.date) ?? '—'}</Cell> },
  { key: 'qib', label: 'QIB', align: 'right', render: (r) => <Cell align="right">{formatMultiplier(r.qib) ?? '—'}</Cell> },
  { key: 'nii', label: 'NII', align: 'right', render: (r) => <Cell align="right">{formatMultiplier(r.nii) ?? '—'}</Cell> },
  { key: 'retail', label: 'Retail', align: 'right', render: (r) => <Cell align="right">{formatMultiplier(r.retail) ?? '—'}</Cell> },
  { key: 'total', label: 'Total', align: 'right', render: (r) => <Cell bold align="right">{formatMultiplier(r.total) ?? '—'}</Cell> },
];

/**
 * Subscription tab — current Total/Average headline, per-category (QIB/NII-HNI/Retail)
 * progress bars (from the latest history row; total falls back to `ipo.subTotal` when
 * there's no history yet), the existing multi-line chart, and a most-recent-first
 * day-wise subscription table.
 */
export default function SubscriptionTab({ ipo, points, loading }) {
  const T = useT();
  const latest = points.length ? points[points.length - 1] : null;
  const totalValue = latest?.total ?? ipo.subTotal ?? null;
  // Mean of whichever category multiples are actually known yet — not the same figure as
  // `total`, which the registrar reports independently (weighted by the number of shares
  // reserved per category, not a plain average of the three).
  const avgValue = useMemo(
    () => averageSubscription([latest?.qib, latest?.nii, latest?.retail]),
    [latest],
  );
  const hasAnyCategory = latest != null
    && (latest.qib != null || latest.nii != null || latest.retail != null);

  const rows = useMemo(() => [...points].reverse().map((p) => ({
    key: p.t, date: p.t, qib: p.qib, nii: p.nii, retail: p.retail, total: p.total,
  })), [points]);

  return (
    <Box sx={{ width: '100%', minWidth: 0 }}>
      <SectionCard title="Current subscription" icon={<PeopleAltOutlinedIcon sx={{ fontSize: 15, color: T.teal }} />}>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 1.5, mb: hasAnyCategory ? 2 : 0 }}>
          <BreakdownTile icon={PeopleAltOutlinedIcon} label="Total" value={formatMultiplier(totalValue)} highlight />
          <BreakdownTile icon={EqualizerOutlinedIcon} label="Average" value={formatMultiplier(avgValue)} />
        </Box>

        {hasAnyCategory && (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3,1fr)' }, gap: 2 }}>
            <CategoryBar icon={BusinessCenterOutlinedIcon} label="QIB" value={latest?.qib} />
            <CategoryBar icon={WorkspacePremiumOutlinedIcon} label="NII (HNI)" value={latest?.nii} />
            <CategoryBar icon={PersonOutlineOutlinedIcon} label="Retail" value={latest?.retail} />
          </Box>
        )}
      </SectionCard>

      <Box sx={{ width: '100%', minWidth: 0, mb: 2 }}>
        <SubscriptionChart points={points} loading={loading} />
      </Box>

      <SectionCard title="Day-wise subscription" icon={<HistoryOutlinedIcon sx={{ fontSize: 15, color: T.teal }} />}>
        <DayWiseTable columns={SUB_COLUMNS} rows={rows} loading={loading} emptyLabel="No subscription data yet." />
      </SectionCard>
    </Box>
  );
}
