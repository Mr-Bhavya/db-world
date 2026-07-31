import { useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import BusinessCenterOutlinedIcon from '@mui/icons-material/BusinessCenterOutlined';
import WorkspacePremiumOutlinedIcon from '@mui/icons-material/WorkspacePremiumOutlined';
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import HowToRegOutlinedIcon from '@mui/icons-material/HowToRegOutlined';
import AnchorOutlinedIcon from '@mui/icons-material/AnchorOutlined';
import EqualizerOutlinedIcon from '@mui/icons-material/EqualizerOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import TableChartOutlinedIcon from '@mui/icons-material/TableChartOutlined';
import { useT } from '@shared/theme';
import {
  formatShortDate, formatMultiplier, subscriptionMeta, averageSubscription,
  orderSubscriptionCategories,
} from '../utils/format';
import SectionCard from './SectionCard';
import DayWiseTable from './DayWiseTable';

/** Icon per well-known category (case-insensitive); anything unrecognized falls back to the
 * generic people icon rather than rendering iconless. */
const CATEGORY_ICON_MAP = {
  qib: BusinessCenterOutlinedIcon,
  nii: WorkspacePremiumOutlinedIcon,
  hni: WorkspacePremiumOutlinedIcon,
  's-nii': WorkspacePremiumOutlinedIcon,
  'b-nii': WorkspacePremiumOutlinedIcon,
  retail: PersonOutlineOutlinedIcon,
  rii: PersonOutlineOutlinedIcon,
  employee: BadgeOutlinedIcon,
  shareholder: HowToRegOutlinedIcon,
  anchor: AnchorOutlinedIcon,
};
const categoryIcon = (key) => CATEGORY_ICON_MAP[String(key).toLowerCase()] ?? PeopleAltOutlinedIcon;

/** Friendlier label for a couple of categories whose raw key is a little terse on its own (NII
 * reads better as "NII (HNI)"); anything else displays exactly as the backend reported it. */
const CATEGORY_LABEL_OVERRIDES = { nii: 'NII (HNI)', hni: 'NII (HNI)' };
const categoryLabel = (key) => CATEGORY_LABEL_OVERRIDES[String(key).toLowerCase()] ?? key;

// Indian-grouped number formatters, matching how investorgain prints shares/lots/amounts.
const INT_FMT = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const CR_FMT = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });
const fmtShares = (n) => (n == null ? '—' : INT_FMT.format(Math.round(Number(n))));
const fmtLots = (offered, lot) => (offered == null || !lot ? null : `${INT_FMT.format(Math.round(Number(offered) / lot))} lots`);
const fmtCr = (n) => (n == null ? '—' : `₹${CR_FMT.format(Number(n))} Cr`);
const fmtPctOfTotal = (part, whole) => (part == null || !whole ? null : `${((Number(part) / whole) * 100).toFixed(1)}% of total`);

/** One labelled subscription figure (Total/Average) — icon + multiplier, null-safe. */
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
 * Investorgain-style per-category card: the multiple (big, colour-tiered), a fill-capped bar, and a
 * meta line with shares offered · lots · % of total (lots = offered ÷ lot size; % = offered ÷ the
 * summed offered across categories). Falls back gracefully when a figure is missing.
 */
function CategoryDetailCard({ row, lotSize, totalOffered }) {
  const T = useT();
  const meta = subscriptionMeta(row.times, T);
  const Icon = categoryIcon(row.category);
  const metaParts = [
    row.sharesOffered != null ? `${fmtShares(row.sharesOffered)} shares` : null,
    fmtLots(row.sharesOffered, lotSize),
    fmtPctOfTotal(row.sharesOffered, totalOffered),
  ].filter(Boolean);
  return (
    <Box sx={{ p: 1.5, borderRadius: 2.5, border: `1px solid ${T.glassBorder}`, bgcolor: T.glass, minWidth: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
        <Icon sx={{ fontSize: 16, color: meta?.color ?? T.textFaint, flexShrink: 0 }} />
        <Typography sx={{ fontSize: 12, fontWeight: 700, color: T.textMuted }} noWrap>{categoryLabel(row.category)}</Typography>
      </Box>
      <Typography sx={{ fontSize: 22, fontWeight: 800, color: meta?.color ?? T.textPrimary, lineHeight: 1 }}>
        {formatMultiplier(row.times) ?? '—'}
      </Typography>
      {meta && (
        <Box sx={{ height: 6, borderRadius: 999, bgcolor: T.glassHover, overflow: 'hidden', mt: 0.85 }}>
          <Box sx={{
            height: '100%', width: `${meta.fillPct}%`, bgcolor: meta.color, borderRadius: 999,
            boxShadow: meta.hot ? `0 0 6px ${meta.color}` : 'none',
          }} />
        </Box>
      )}
      {metaParts.length > 0 && (
        <Typography sx={{ fontSize: 10.5, color: T.textFaint, mt: 0.7, lineHeight: 1.5 }}>
          {metaParts.join(' · ')}
        </Typography>
      )}
    </Box>
  );
}

/** Fallback per-category progress bar (multiples only) — used when the fuller breakdown isn't
 * available yet (e.g. an older history row captured before the detail was stored). */
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

/**
 * Subscription tab — laid out like investorgain: a Total/Average headline, per-category cards
 * (multiple + shares offered + lots + % of total, from the latest point's `categoryDetail`), a
 * shares-offered/bid/amount table, and the day-wise multiples table. Fully dynamic on whatever
 * categories a source reports (QIB / NII / S-NII / B-NII / RII / Employee / Shareholder / Other),
 * ordered by `orderSubscriptionCategories`. Falls back to simple multiple bars when the fuller
 * breakdown isn't present. No time-series chart — the day-wise table communicates it more clearly
 * for a 3-4 day window (and investorgain shows none either).
 */
export default function SubscriptionTab({ ipo, points, loading }) {
  const T = useT();
  const latest = points.length ? points[points.length - 1] : null;
  const latestCategories = useMemo(() => latest?.categories ?? {}, [latest]);
  const latestDetail = useMemo(() => latest?.categoryDetail ?? [], [latest]);

  // Fuller per-category breakdown (offered/bid/amount), ordered for display.
  const detailRows = useMemo(() => {
    if (!latestDetail.length) return [];
    const order = orderSubscriptionCategories(latestDetail.map((d) => d.category));
    return order.map((c) => latestDetail.find((d) => d.category === c)).filter(Boolean);
  }, [latestDetail]);
  const totalOffered = useMemo(
    () => detailRows.reduce((sum, d) => sum + (Number(d.sharesOffered) || 0), 0),
    [detailRows],
  );
  const hasDetail = detailRows.length > 0;

  // Fallback: category → multiple bars when there's no fuller breakdown yet.
  const latestKeys = useMemo(
    () => orderSubscriptionCategories(Object.keys(latestCategories).filter((k) => latestCategories[k] != null)),
    [latestCategories],
  );
  const hasAnyCategory = latestKeys.length > 0;

  const totalValue = latest?.total ?? ipo.subTotal ?? null;
  // Mean of the known category multiples — not the same as `total` (registrar-reported, share-weighted).
  const avgValue = useMemo(
    () => averageSubscription(hasDetail ? detailRows.map((d) => d.times) : latestKeys.map((k) => latestCategories[k])),
    [hasDetail, detailRows, latestKeys, latestCategories],
  );

  // Day-wise multiples table — union of category keys across every point so columns stay stable.
  const allCategoryKeys = useMemo(() => {
    const set = new Set();
    points.forEach((p) => {
      Object.entries(p.categories ?? {}).forEach(([k, v]) => { if (v != null) set.add(k); });
    });
    return orderSubscriptionCategories(Array.from(set));
  }, [points]);

  const dayColumns = useMemo(() => [
    { key: 'date', label: 'Date', width: '1.2fr', render: (r) => <Cell bold>{formatShortDate(r.date) ?? '—'}</Cell> },
    ...allCategoryKeys.map((key) => ({
      key: `cat_${key}`,
      label: categoryLabel(key),
      align: 'right',
      render: (r) => <Cell align="right">{formatMultiplier(r.categories?.[key]) ?? '—'}</Cell>,
    })),
    { key: 'total', label: 'Total', align: 'right', render: (r) => <Cell bold align="right">{formatMultiplier(r.total) ?? '—'}</Cell> },
  ], [allCategoryKeys]);

  const dayRows = useMemo(() => [...points].reverse().map((p) => ({
    key: p.t, date: p.t, categories: p.categories, total: p.total,
  })), [points]);

  // Shares offered / bid / amount table (current), matching investorgain's detail table.
  const breakdownColumns = useMemo(() => [
    { key: 'cat', label: 'Category', render: (r) => <Cell bold>{categoryLabel(r.category)}</Cell> },
    { key: 'off', label: 'Shares offered', align: 'right', render: (r) => <Cell align="right">{fmtShares(r.sharesOffered)}</Cell> },
    { key: 'bid', label: 'Shares bid', align: 'right', render: (r) => <Cell align="right">{fmtShares(r.sharesBid)}</Cell> },
    { key: 'amt', label: 'Bid amount (₹Cr)', align: 'right', render: (r) => <Cell align="right">{fmtCr(r.bidAmountCr)}</Cell> },
  ], []);
  const breakdownRows = useMemo(() => detailRows.map((d) => ({ key: d.category, ...d })), [detailRows]);

  return (
    <Box sx={{ width: '100%', minWidth: 0 }}>
      <SectionCard title="Current subscription" icon={<PeopleAltOutlinedIcon sx={{ fontSize: 15, color: T.teal }} />}>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 1.5, mb: (hasDetail || hasAnyCategory) ? 2 : 0 }}>
          <BreakdownTile icon={PeopleAltOutlinedIcon} label="Total" value={formatMultiplier(totalValue)} highlight />
          <BreakdownTile icon={EqualizerOutlinedIcon} label="Average" value={formatMultiplier(avgValue)} />
        </Box>

        {hasDetail ? (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(auto-fit, minmax(150px, 1fr))' }, gap: 1.5 }}>
            {detailRows.map((row) => (
              <CategoryDetailCard key={row.category} row={row} lotSize={ipo.lotSize} totalOffered={totalOffered} />
            ))}
          </Box>
        ) : hasAnyCategory ? (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(auto-fit, minmax(150px, 1fr))' }, gap: 2 }}>
            {latestKeys.map((key) => (
              <CategoryBar key={key} icon={categoryIcon(key)} label={categoryLabel(key)} value={latestCategories[key]} />
            ))}
          </Box>
        ) : null}
      </SectionCard>

      {hasDetail && (
        <Box sx={{ mt: 2 }}>
          <SectionCard title="Shares offered, bid & amount" icon={<TableChartOutlinedIcon sx={{ fontSize: 15, color: T.teal }} />}>
            <DayWiseTable columns={breakdownColumns} rows={breakdownRows} loading={loading} emptyLabel="No subscription data yet." />
          </SectionCard>
        </Box>
      )}

      <Box sx={{ mt: 2 }}>
        <SectionCard title="Day-wise subscription" icon={<HistoryOutlinedIcon sx={{ fontSize: 15, color: T.teal }} />}>
          <DayWiseTable columns={dayColumns} rows={dayRows} loading={loading} emptyLabel="No subscription data yet." />
        </SectionCard>
      </Box>
    </Box>
  );
}
