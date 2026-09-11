import { useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import BusinessCenterOutlinedIcon from '@mui/icons-material/BusinessCenterOutlined';
import WorkspacePremiumOutlinedIcon from '@mui/icons-material/WorkspacePremiumOutlined';
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import HowToRegOutlinedIcon from '@mui/icons-material/HowToRegOutlined';
import AnchorOutlinedIcon from '@mui/icons-material/AnchorOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import TableChartOutlinedIcon from '@mui/icons-material/TableChartOutlined';
import { useT } from '@shared/theme';
import {
  formatShortDate, formatMultiplier, subscriptionMeta, orderSubscriptionCategories,
  subTrancheParentOf, totalSharesOffered,
} from '../utils/format';
import SectionCard, { SectionStack } from './SectionCard';
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
const fmtCr = (n) => (n == null ? '—' : `₹${CR_FMT.format(Number(n))} Cr`);

/**
 * Per-category demand card: the multiple (big, colour-tiered), a fill-capped bar, and — for a
 * category that is a slice of another — a note saying so.
 *
 * The card no longer repeats shares offered / lots. Those are exact figures meant to be compared
 * down a column, which is what the "Shares offered, bid & amount" table below is for; printing
 * them here as well meant the same five rows of numbers appeared twice on one tab. The card's job
 * is the scan — how hot is each tranche — so it keeps the multiple, the bar and the share of the
 * offer, and hands the precise arithmetic to the table.
 */
function CategoryDetailCard({ row, parentLabel, sharePct }) {
  const T = useT();
  const meta = subscriptionMeta(row.times, T);
  const Icon = categoryIcon(row.category);
  return (
    <Box sx={{ p: 1.5, borderRadius: 2.5, border: `1px solid ${T.glassBorder}`, bgcolor: T.glass, minWidth: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
        <Icon sx={{ fontSize: 16, color: meta?.color ?? T.textMuted, flexShrink: 0 }} />
        <Typography sx={{ fontSize: 12, fontWeight: 700, color: T.textMuted, minWidth: 0 }} noWrap>
          {categoryLabel(row.category)}
        </Typography>
        {sharePct != null && (
          <Typography sx={{
            ml: 'auto', flexShrink: 0, fontSize: 10.5, fontWeight: 700, color: T.textMuted,
            px: 0.65, py: 0.1, borderRadius: 999, bgcolor: T.glassHover,
          }}>
            {sharePct}
          </Typography>
        )}
      </Box>
      {/* A tranche that is part of another one says so, rather than sitting beside its own parent
          looking like a peer — S-NII and B-NII are the two halves of NII, and reading all three as
          siblings makes the issue look bigger than it is. */}
      {parentLabel && (
        <Typography sx={{ fontSize: 10.5, color: T.textFaint, mt: 0.15 }} noWrap>
          within {parentLabel}
        </Typography>
      )}
      <Typography sx={{
        fontSize: 22, fontWeight: 800, color: meta?.color ?? T.textPrimary, lineHeight: 1.1, mt: 0.5,
        fontVariantNumeric: 'tabular-nums',
      }}>
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
    </Box>
  );
}

/** Fallback per-category bar (multiples only) — used when the fuller breakdown isn't available
 * yet, e.g. an older history row captured before the detail was stored. */
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
    <Typography sx={{
      fontSize: 13, fontWeight: bold ? 700 : 400, textAlign: align ?? 'left', color: T.textPrimary,
      fontVariantNumeric: align === 'right' ? 'tabular-nums' : undefined,
    }}>
      {children}
    </Typography>
  );
}

/**
 * Subscription tab — who is bidding, how hard, and against how many shares.
 *
 * Two things it deliberately no longer shows.
 *
 * The "Total" and "Average" headline pair is gone. Total restated the figure the hero already
 * leads with two hundred pixels above — and, because the hero reads `ipo.subTotal` from the
 * 30-minute live tier while this tab reads the latest history point from the 2-hourly poll, the
 * two could print different multiples on one screen. Average was worse than redundant: it is the
 * unweighted mean of the category multiples, which is not the same quantity as the registrar's
 * share-weighted total and has no meaning of its own. The per-category cards are the tab's lead
 * now, which is what it is for.
 *
 * Shares offered / lots are gone from the cards, because the table underneath is where exact
 * figures belong and it already carried every one of them.
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
  const hasDetail = detailRows.length > 0;

  // Counts each share once — see `totalSharesOffered`. Summing every reported category counted
  // the NII tranche twice (whole, then as its S-NII/B-NII halves) and skewed every percentage.
  const totalOffered = useMemo(() => totalSharesOffered(detailRows), [detailRows]);
  const detailKeys = useMemo(() => detailRows.map((d) => d.category), [detailRows]);

  // Fallback: category → multiple bars when there's no fuller breakdown yet.
  const latestKeys = useMemo(
    () => orderSubscriptionCategories(Object.keys(latestCategories).filter((k) => latestCategories[k] != null)),
    [latestCategories],
  );
  const hasAnyCategory = latestKeys.length > 0;

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
    { key: 'cat', label: 'Category', minWidth: 108, render: (r) => <Cell bold>{categoryLabel(r.category)}</Cell> },
    { key: 'off', label: 'Shares offered', align: 'right', render: (r) => <Cell align="right">{fmtShares(r.sharesOffered)}</Cell> },
    { key: 'bid', label: 'Shares bid', align: 'right', render: (r) => <Cell align="right">{fmtShares(r.sharesBid)}</Cell> },
    { key: 'amt', label: 'Bid amount (₹Cr)', align: 'right', render: (r) => <Cell align="right">{fmtCr(r.bidAmountCr)}</Cell> },
  ], []);
  const breakdownRows = useMemo(() => detailRows.map((d) => ({ key: d.category, ...d })), [detailRows]);

  const asOf = ipo.subscriptionUpdatedLabel ? `As of ${ipo.subscriptionUpdatedLabel}.` : null;

  return (
    <SectionStack>
      {(hasDetail || hasAnyCategory) && (
        <SectionCard
          title="Demand by category"
          subtitle={[asOf, totalOffered != null ? `${INT_FMT.format(totalOffered)} shares on offer.` : null]
            .filter(Boolean).join(' ') || undefined}
          icon={<PeopleAltOutlinedIcon sx={{ fontSize: 15, color: T.teal }} />}
        >
          {hasDetail ? (
            <Box sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 150px), 1fr))',
              gap: 1.5,
            }}>
              {detailRows.map((row) => {
                const parent = subTrancheParentOf(row.category, detailKeys);
                const share = totalOffered != null && row.sharesOffered != null && !parent
                  ? `${((Number(row.sharesOffered) / totalOffered) * 100).toFixed(0)}%`
                  : null;
                return (
                  <CategoryDetailCard
                    key={row.category}
                    row={row}
                    parentLabel={parent ? categoryLabel(parent) : null}
                    sharePct={share}
                  />
                );
              })}
            </Box>
          ) : (
            <Box sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 180px), 1fr))',
              gap: 2,
            }}>
              {latestKeys.map((key) => (
                <CategoryBar key={key} icon={categoryIcon(key)} label={categoryLabel(key)} value={latestCategories[key]} />
              ))}
            </Box>
          )}
        </SectionCard>
      )}

      {hasDetail && (
        <SectionCard
          title="Shares offered, bid & amount"
          icon={<TableChartOutlinedIcon sx={{ fontSize: 15, color: T.teal }} />}
        >
          <DayWiseTable columns={breakdownColumns} rows={breakdownRows} loading={loading} emptyLabel="No subscription data yet." />
        </SectionCard>
      )}

      <SectionCard
        title="Day-wise subscription"
        subtitle="Each row is a reading recorded on that date, most recent first."
        icon={<HistoryOutlinedIcon sx={{ fontSize: 15, color: T.teal }} />}
      >
        <DayWiseTable columns={dayColumns} rows={dayRows} loading={loading} emptyLabel="No subscription data yet." />
      </SectionCard>
    </SectionStack>
  );
}
