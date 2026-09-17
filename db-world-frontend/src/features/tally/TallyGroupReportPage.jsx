import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Box, Skeleton } from '@mui/material';
import { motion, useReducedMotion } from 'framer-motion';
import { useT } from '@shared/theme';
import { useGroupReport } from './hooks/useTally';
import {
  categoryEmoji, formatMoneyCompact, reportCaption, spendingTrend,
} from './utils/tallyFormat';
import { SERIES_SLOTS, useChartPalette } from './utils/chartPalette';
import { DEFAULT_WINDOW } from './utils/reportWindow';
import ReportPeriodNav from './components/ReportPeriodNav';
import SpendingChart from './components/SpendingChart';
import CumulativeChart from './components/CumulativeChart';
import CategoryDonut from './components/CategoryDonut';
import SpendingBreakdown from './components/SpendingBreakdown';
import GroupMemberSpending from './components/GroupMemberSpending';
import {
  BiggestExpense, NothingSpent, ReportCard, StatTile, STAT_TILE_MIN_H, TrendChip,
} from './components/reportPieces';

/** What one column of the "over time" chart is, in the words of its own switch. */
const BY_UNIT = { WEEKDAY: 'By day', DAY: 'By day', MONTH: 'By month', YEAR: 'By year' };

/** Two on a phone, four from md — four across a phone leave room for about five digits. */
const TILES = { xs: '1fr 1fr', md: 'repeat(4, 1fr)' };

/**
 * What one group cost, and who carried it.
 *
 * <p>Deliberately the mirror image of the personal report rather than a copy of it. There the
 * headline is your own share, because telling somebody they "spent" a bill they were reimbursed
 * for is no use to them. Here the headline is the group's whole spend, because that is the
 * question a group answers — and the per-member rows carry paid alongside used, since the gap
 * between those two is the entire story of a shared ledger.
 *
 * <p>Your own share is still on screen, in the second tile. Without it a group report is about
 * everybody and nobody.
 *
 * <h2>What this page used to be</h2>
 * One 38px total with three more figures written into the caption under it, then a bar chart,
 * then two ranked lists — every quantity on the page drawn as the same horizontal bar, and the
 * whole thing scrolling as one undivided column. The figures are tiles now, each section is a
 * card that says where it starts and stops, and the charts each answer a different question:
 * <em>when</em> it was spent, <em>on what</em>, and <em>by whom</em>.
 *
 * <p>Only the report. The header, the balance and the tab bar belong to TallyGroupShell and stay
 * mounted across tab changes, so arriving here swaps the column and nothing else.
 */
export default function TallyGroupReportTab() {
  const { groupId } = useParams();
  const T = useT();
  const palette = useChartPalette();
  const reduce = useReducedMotion();

  const [window, setWindow] = useState(DEFAULT_WINDOW);
  const [overTime, setOverTime] = useState('daily');

  const { data: report, isPending, isFetching } = useGroupReport(groupId, window);

  const total = Number(report?.total ?? 0);
  const myShare = Number(report?.myShare ?? 0);
  const count = Number(report?.expenseCount ?? 0);
  const trend = spendingTrend(total, report?.previousTotal, report?.period);
  const nothingYet = !isPending && report && total === 0;

  // Rank decides the colour, so the biggest category is the accent -- and the same data read as
  // a list and read as a ring cannot disagree about which colour is which category.
  const categoryRows = useMemo(() => (report?.categories ?? []).map((row, i) => ({
    key: row.category ?? 'uncategorised',
    emoji: row.category ? categoryEmoji(row.category) : '\u{1F4E6}',
    label: row.category ?? 'Uncategorised',
    amount: row.amount,
    color: palette.at(i),
  })), [report, palette]);

  // Past the last colour the tail folds into one grey slice rather than becoming more hues
  // nobody can tell apart. Only the ring folds -- the list still names every category, and those
  // rows carry the same grey, so a slice and its members always match.
  const slices = useMemo(() => {
    const head = categoryRows.slice(0, SERIES_SLOTS);
    const tail = categoryRows.slice(SERIES_SLOTS);
    if (tail.length === 0) return head;

    return [...head, {
      key: 'other',
      label: `${tail.length} more`,
      amount: tail.reduce((sum, row) => sum + Number(row.amount ?? 0), 0),
      color: palette.other,
    }];
  }, [categoryRows, palette]);

  if (isPending && !report) {
    return (
      <>
        <ReportPeriodNav window={window} onChange={setWindow} busy />
        <Box sx={{ display: 'grid', gap: 1.5, mb: 2.5, gridTemplateColumns: TILES }}>
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton
              key={i}
              variant="rounded"
              // The tile's own floor, not a number guessed next to it: 84px stood ~9px short of
              // a real tile from `sm` up, four times over, and the chart below it jumped.
              sx={{ height: STAT_TILE_MIN_H, bgcolor: T.glass, borderRadius: 3 }}
            />
          ))}
        </Box>
        <Skeleton variant="rounded" height={260} sx={{ bgcolor: T.glass, borderRadius: 3.5 }} />
      </>
    );
  }

  return (
    <>
      <ReportPeriodNav
        window={window}
        onChange={setWindow}
        report={report}
        busy={isFetching}
      />

      {/* ── The figures ──────────────────────────────────────────────────── */}
      {/* Four tiles rather than one big total with the other three written into its caption.
          Two across on a phone, four from md. Compact money throughout: a tile this wide cannot
          hold "₹1,20,450.00", and a clipped amount is worse than a rounded one. */}
      <Box
        component={motion.div}
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        sx={{ display: 'grid', gap: 1.5, mb: trend ? 1.5 : 2.5, gridTemplateColumns: TILES }}
      >
        <StatTile
          accent
          label="Group total"
          value={formatMoneyCompact(total)}
          sub={reportCaption(report)}
        />
        <StatTile
          label="Your share"
          value={formatMoneyCompact(myShare)}
          sub={total > 0 ? `${Math.round((myShare / total) * 100)}% of it` : 'nothing yet'}
        />
        <StatTile
          label="A day"
          value={formatMoneyCompact(report?.dailyAverage)}
          sub={`${count} ${count === 1 ? 'expense' : 'expenses'}`}
        />
        {/* "Moved, not spent" is doing real work: a settlement hands over money that was already
            counted when the expense was recorded, and a reader who adds this tile to the total
            has counted every shared bill twice. */}
        <StatTile
          label="Settled"
          value={formatMoneyCompact(report?.settled)}
          sub="moved, not spent"
        />
      </Box>

      {/* The comparison keeps its whole sentence, which is why it sits here rather than squeezed
          into the total's tile. */}
      {trend && (
        <Box sx={{ mb: 2.5 }}>
          <TrendChip trend={trend} />
        </Box>
      )}

      {nothingYet && (
        <NothingSpent
          period={report?.period}
          hint="Step back to an earlier one, or add an expense to this group."
        />
      )}

      {report && total > 0 && (
        <>
          {/* ── When it was spent ──────────────────────────────────────── */}
          <ReportCard
            title="Over time"
            action={(
              <ViewSwitch
                value={overTime}
                onChange={setOverTime}
                options={[
                  // Named for what a column actually is, which a custom range decides by its
                  // own length rather than by a period it does not have.
                  { value: 'daily', label: BY_UNIT[report.bucketUnit] ?? 'By day' },
                  { value: 'running', label: 'Running total' },
                ]}
              />
            )}
          >
            {overTime === 'daily' ? (
              <SpendingChart unit={report.bucketUnit} buckets={report.buckets} />
            ) : (
              <CumulativeChart
                period={report.period}
                unit={report.bucketUnit}
                buckets={report.buckets}
                previousBuckets={report.previousBuckets}
              />
            )}
          </ReportCard>

          {/* ── What it went on ────────────────────────────────────────── */}
          {/* The ring and the list are one thing rather than two views of it. The ring answers
              "was it mostly one category"; the list answers which, and how much, and is what
              keeps every slice labelled rather than identified by colour alone. */}
          <ReportCard title="Where it went">
            <Box sx={{
              display: 'flex', gap: { xs: 1, sm: 2.5 },
              flexDirection: { xs: 'column', sm: 'row' },
              alignItems: { sm: 'center' },
            }}>
              <CategoryDonut slices={slices} total={total} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <SpendingBreakdown
                  rows={categoryRows}
                  total={total}
                  max={SERIES_SLOTS}
                  emptyText="Nothing categorised yet"
                />
              </Box>
            </Box>
          </ReportCard>

          {/* ── Who spent it ───────────────────────────────────────────── */}
          <ReportCard title="Who paid, who used">
            <GroupMemberSpending rows={report.members ?? []} />
          </ReportCard>

          {report.biggest && (
            <BiggestExpense expense={report.biggest} label="BIGGEST EXPENSE" />
          )}
        </>
      )}
    </>
  );
}

/**
 * The two ways to read one chart, on that chart's own card.
 *
 * <p>A switch rather than two stacked charts. They are the same spending asked about twice —
 * which days the money went out on, and how fast it added up — and drawing both at once doubles
 * the height of the page to answer a question most readers only ask one way.
 */
function ViewSwitch({ value, onChange, options }) {
  const T = useT();

  return (
    <Box sx={{
      display: 'inline-flex', gap: 0.25, p: 0.25, borderRadius: 2, flexShrink: 0,
      bgcolor: T.bg, border: `1px solid ${T.border}`,
    }}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Box
            key={option.value}
            component="button"
            type="button"
            aria-pressed={selected}
            onClick={() => !selected && onChange(option.value)}
            sx={{
              px: 1, py: 0.4, borderRadius: 1.5, border: 'none',
              cursor: selected ? 'default' : 'pointer',
              fontFamily: 'inherit', fontSize: 11.5, fontWeight: 700, whiteSpace: 'nowrap',
              color: selected ? T.teal : T.textMuted,
              bgcolor: selected ? T.tealBg : 'transparent',
              transition: 'color .18s ease, background-color .18s ease',
              '&:hover': { color: selected ? T.teal : T.textPrimary },
              '&:focus-visible': { outline: `2px solid ${T.teal}`, outlineOffset: -2 },
            }}
          >
            {option.label}
          </Box>
        );
      })}
    </Box>
  );
}
