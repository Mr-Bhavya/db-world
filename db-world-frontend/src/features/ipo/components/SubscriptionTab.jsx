import { useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import BusinessCenterOutlinedIcon from '@mui/icons-material/BusinessCenterOutlined';
import WorkspacePremiumOutlinedIcon from '@mui/icons-material/WorkspacePremiumOutlined';
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import { useT } from '@shared/theme';
import { formatShortDate, formatMultiplier } from '../utils/format';
import SubscriptionChart from './SubscriptionChart';
import SectionCard from './SectionCard';
import DayWiseTable from './DayWiseTable';

/** One labelled subscription figure (QIB/NII/Retail/Total) — icon + multiplier, null-safe
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
 * Subscription tab — current QIB/NII(HNI)/Retail/Total breakdown (from the latest history
 * row; total falls back to `ipo.subTotal` when there's no history yet), the existing
 * multi-line chart, and a most-recent-first day-wise subscription table.
 */
export default function SubscriptionTab({ ipo, points, loading }) {
  const T = useT();
  const latest = points.length ? points[points.length - 1] : null;
  const totalValue = latest?.total ?? ipo.subTotal ?? null;

  const rows = useMemo(() => [...points].reverse().map((p) => ({
    key: p.t, date: p.t, qib: p.qib, nii: p.nii, retail: p.retail, total: p.total,
  })), [points]);

  return (
    <Box>
      <SectionCard title="Current subscription" icon={<PeopleAltOutlinedIcon sx={{ fontSize: 15, color: T.teal }} />}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2,1fr)', sm: 'repeat(4,1fr)' }, gap: 1.5 }}>
          <BreakdownTile icon={PeopleAltOutlinedIcon} label="Total" value={formatMultiplier(totalValue)} highlight />
          <BreakdownTile icon={BusinessCenterOutlinedIcon} label="QIB" value={formatMultiplier(latest?.qib)} />
          <BreakdownTile icon={WorkspacePremiumOutlinedIcon} label="NII (HNI)" value={formatMultiplier(latest?.nii)} />
          <BreakdownTile icon={PersonOutlineOutlinedIcon} label="Retail" value={formatMultiplier(latest?.retail)} />
        </Box>
      </SectionCard>

      <Box sx={{ mb: 2 }}>
        <SubscriptionChart points={points} loading={loading} />
      </Box>

      <SectionCard title="Day-wise subscription" icon={<HistoryOutlinedIcon sx={{ fontSize: 15, color: T.teal }} />}>
        <DayWiseTable columns={SUB_COLUMNS} rows={rows} loading={loading} emptyLabel="No subscription data yet." />
      </SectionCard>
    </Box>
  );
}
