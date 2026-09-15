import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Box, IconButton, Skeleton, Typography } from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import HandshakeRoundedIcon from '@mui/icons-material/HandshakeRounded';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import Constants from '@shared/constants';
import { useT } from '@shared/theme';
import { useGroup, useGroupReport } from './hooks/useTally';
import {
  categoryEmoji, formatMoney, groupIcon, reportCaption, spendingTrend,
} from './utils/tallyFormat';
import ReportPeriodNav from './components/ReportPeriodNav';
import SpendingChart from './components/SpendingChart';
import SpendingBreakdown from './components/SpendingBreakdown';
import GroupMemberSpending from './components/GroupMemberSpending';
import { BiggestExpense, NothingSpent, TrendChip } from './components/reportPieces';

/**
 * What one group cost, and who carried it.
 *
 * <p>Deliberately the mirror image of the personal report rather than a copy of it. There the
 * headline is your own share, because telling somebody they "spent" a bill they were reimbursed
 * for is no use to them. Here the headline is the group's whole spend, because that is the
 * question a group answers — and the per-member rows carry paid alongside used, since the gap
 * between those two is the entire story of a shared ledger.
 *
 * <p>Your own share is still on screen, under the total. Without it a group report is about
 * everybody and nobody.
 */
export default function TallyGroupReportPage() {
  const T = useT();
  const navigate = useNavigate();
  const { groupId } = useParams();
  const reduce = useReducedMotion();

  const [period, setPeriod] = useState('MONTH');
  const [anchor, setAnchor] = useState(null);

  const { data: group } = useGroup(groupId);
  const { data: report, isPending, isFetching } = useGroupReport(groupId, period, anchor);

  const total = Number(report?.total ?? 0);
  const trend = spendingTrend(total, report?.previousTotal, period);
  const nothingYet = !isPending && report && total === 0;

  // Switching the period size drops the anchor -- see TallyReportPage for why.
  const changePeriod = (next) => {
    setPeriod(next);
    setAnchor(null);
  };

  return (
    <Box sx={{
      minHeight: '100dvh', bgcolor: T.bg,
      pt: { xs: 'calc(56px + 16px)', md: 'calc(64px + 24px)' },
      px: { xs: 2, sm: 3, md: 4 },
      pb: { xs: 'calc(32px + env(safe-area-inset-bottom))', sm: 6 },
    }}>
      <Box sx={{ maxWidth: 760, mx: 'auto', width: '100%' }}>

        {/* ── Header ───────────────────────────────────────────────────────── */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 2.5 }}>
          <IconButton
            onClick={() => navigate(Constants.tallyGroupPath(groupId))}
            aria-label="Back to the group"
            sx={{ color: T.textPrimary, ml: -1 }}
          >
            <ArrowBackRoundedIcon />
          </IconButton>

          {group && (
            <Box sx={{
              width: 32, height: 32, borderRadius: 2, flexShrink: 0,
              display: 'grid', placeItems: 'center', fontSize: 17,
              bgcolor: T.glass, border: `1px solid ${T.border}`,
            }}>
              {groupIcon(group)}
            </Box>
          )}

          <Box sx={{ minWidth: 0 }}>
            <Typography component="h1" noWrap sx={{
              fontSize: { xs: 18, sm: 22 }, fontWeight: 800,
              color: T.textPrimary, letterSpacing: -0.5,
            }}>
              {group?.name ?? 'Spending'}
            </Typography>
            <Typography sx={{ fontSize: 12, color: T.textFaint, mt: -0.25 }}>
              Spending report
            </Typography>
          </Box>
        </Box>

        <ReportPeriodNav
          period={period}
          onPeriodChange={changePeriod}
          report={report}
          onStep={setAnchor}
          busy={isFetching}
        />

        {/* ── Headline ─────────────────────────────────────────────────────── */}
        <Box
          component={motion.div}
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          sx={{
            p: { xs: 2, sm: 2.5 }, mb: 2.5, borderRadius: 3.5,
            bgcolor: T.tealBg, border: `1px solid ${T.glassBorder}`,
          }}
        >
          <Typography sx={{
            fontSize: 12, fontWeight: 800, letterSpacing: 0.6,
            textTransform: 'uppercase', color: T.textFaint, mb: 0.5,
          }}>
            Group total
          </Typography>

          {isPending && !report ? (
            <Skeleton variant="text" width={180} height={44} sx={{ bgcolor: T.glass }} />
          ) : (
            <AnimatePresence mode="wait" initial={false}>
              <Typography
                key={`${report?.from}-${total}`}
                component={motion.div}
                initial={reduce ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? undefined : { opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
                sx={{
                  fontSize: { xs: 32, sm: 38 }, fontWeight: 800,
                  color: T.textPrimary, letterSpacing: -1.2, lineHeight: 1.1,
                }}
              >
                {formatMoney(total)}
              </Typography>
            </AnimatePresence>
          )}

          <Typography sx={{ fontSize: 13.5, color: T.textMuted, mt: 0.5 }}>
            {reportCaption(report)}
            {report?.expenseCount > 0 && (
              <> · {report.expenseCount} {report.expenseCount === 1 ? 'expense' : 'expenses'}</>
            )}
          </Typography>

          {report && total > 0 && (
            <Typography sx={{ fontSize: 13.5, color: T.textMuted, mt: 0.75 }}>
              Your share was{' '}
              <Box component="span" sx={{ fontWeight: 800, color: T.teal }}>
                {formatMoney(report.myShare)}
              </Box>
            </Typography>
          )}

          {!nothingYet && report && (
            <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1.5, mt: 1.5 }}>
              {trend && <TrendChip trend={trend} />}
              {Number(report.dailyAverage) > 0 && (
                <Typography sx={{ fontSize: 12.5, color: T.textMuted, fontWeight: 600 }}>
                  {formatMoney(report.dailyAverage)} a day
                </Typography>
              )}
              {Number(report.settled) > 0 && (
                <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                  <HandshakeRoundedIcon sx={{ fontSize: 15, color: T.textMuted }} />
                  <Typography sx={{ fontSize: 12.5, color: T.textMuted, fontWeight: 600 }}>
                    {formatMoney(report.settled)} settled
                  </Typography>
                </Box>
              )}
            </Box>
          )}
        </Box>

        {isPending && !report && (
          <Skeleton variant="rounded" height={200} sx={{ bgcolor: T.glass, borderRadius: 3 }} />
        )}

        {nothingYet && (
          <NothingSpent
            period={period}
            hint="Step back to an earlier one, or add an expense to this group."
          />
        )}

        {report && total > 0 && (
          <>
            <Box sx={{
              p: { xs: 1.5, sm: 2 }, mb: 3, borderRadius: 3.5,
              bgcolor: T.glass, border: `1px solid ${T.border}`,
            }}>
              <SpendingChart period={period} buckets={report.buckets} />
            </Box>

            <GroupMemberSpending rows={report.members ?? []} />

            <SpendingBreakdown
              title="Where it went"
              total={total}
              emptyText="Nothing categorised yet"
              rows={(report.categories ?? []).map((c) => ({
                key: c.category ?? 'uncategorised',
                emoji: c.category ? categoryEmoji(c.category) : '📦',
                label: c.category ?? 'Uncategorised',
                amount: c.amount,
              }))}
            />

            {report.biggest && (
              <BiggestExpense expense={report.biggest} label="BIGGEST EXPENSE" />
            )}
          </>
        )}
      </Box>
    </Box>
  );
}
