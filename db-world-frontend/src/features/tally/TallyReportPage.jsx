import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, IconButton, Skeleton, Tooltip, Typography } from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import Constants from '@shared/constants';
import usePageMeta from '@shared/hooks/usePageMeta';
import { useT } from '@shared/theme';
import { useSpendingReport } from './hooks/useTally';
import {
  categoryEmoji, formatMoney, groupIcon, reportCaption, spendingTrend,
} from './utils/tallyFormat';
import { DEFAULT_WINDOW } from './utils/reportWindow';
import ReportPeriodNav from './components/ReportPeriodNav';
import SpendingChart from './components/SpendingChart';
import SpendingBreakdown from './components/SpendingBreakdown';
import { BiggestExpense, NothingSpent, TrendChip } from './components/reportPieces';

/**
 * Said once, beside the figure, because the number is deliberately not the one somebody
 * remembers handing over and that needs explaining exactly once.
 */
const SHARE_EXPLAINER = 'What you consumed, not what you paid out. Money you front for other '
  + 'people is not counted here — it comes back to you as a balance instead.';

/**
 * What you actually spent on yourself, across every ledger at once.
 *
 * <p>The headline is your <em>share</em>, never the bills you paid. Somebody who fronts a
 * ₹6,000 dinner for six and is paid back has not spent ₹6,000, and a report that says so is
 * useless to the one person in a group who always picks up the tab — which is exactly the
 * person most likely to open this screen. The tooltip beside the figure says so out loud,
 * because a number that is not the one you remember handing over needs explaining once.
 */
export default function TallyReportPage() {
  usePageMeta('Spending report', {
    description: 'What you have spent across every Tally ledger, by period and category.',
  });

  const T = useT();
  const navigate = useNavigate();
  const reduce = useReducedMotion();

  const [window, setWindow] = useState(DEFAULT_WINDOW);

  const { data: report, isPending, isFetching } = useSpendingReport(window);

  const total = Number(report?.total ?? 0);
  const trend = spendingTrend(total, report?.previousTotal, report?.period);
  const nothingYet = !isPending && report && total === 0;

  return (
    <Box sx={{
      minHeight: '100dvh', bgcolor: T.bg,
      pt: { xs: 'calc(56px + 16px)', md: 'calc(64px + 24px)' },
      px: { xs: 2, sm: 3, md: 4 },
      pb: { xs: 'calc(32px + env(safe-area-inset-bottom))', sm: 6 },
    }}>
      <Box sx={{ maxWidth: 760, mx: 'auto', width: '100%' }}>

        {/* ── Header ───────────────────────────────────────────────────────── */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
          <IconButton
            onClick={() => navigate(Constants.DB_TALLY_ROUTE)}
            aria-label="Back to Tally"
            sx={{ color: T.textPrimary, ml: -1 }}
          >
            <ArrowBackRoundedIcon />
          </IconButton>
          <InsightsRoundedIcon sx={{ fontSize: 20, color: T.teal }} />
          <Typography component="h1" sx={{
            fontSize: { xs: 20, sm: 24 }, fontWeight: 800,
            color: T.textPrimary, letterSpacing: -0.6,
          }}>
            Spending
          </Typography>
        </Box>

        <ReportPeriodNav
          window={window}
          onChange={setWindow}
          report={report}
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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
            <Typography sx={{
              fontSize: 12, fontWeight: 800, letterSpacing: 0.6,
              textTransform: 'uppercase', color: T.textFaint,
            }}>
              Your share
            </Typography>
            <Tooltip enterTouchDelay={0} leaveTouchDelay={4000} title={SHARE_EXPLAINER}>
              <InfoOutlinedIcon sx={{ fontSize: 14, color: T.textFaint, cursor: 'help' }} />
            </Tooltip>
          </Box>

          {isPending && !report ? (
            /* Wrapped in the type it replaces so it is one line box of the same font. The
               flat 44px was ~9px taller than the 32px/1.1 figure on a phone. */
            <Typography sx={{ fontSize: { xs: 32, sm: 38 }, lineHeight: 1.1 }}>
              <Skeleton variant="text" width={180} sx={{ bgcolor: T.glass }} />
            </Typography>
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

          {/* The two figures that give the total meaning: how it compares, and the rate. */}
          {!nothingYet && report && (
            <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1.5, mt: 1.5 }}>
              {trend && <TrendChip trend={trend} />}
              {Number(report.dailyAverage) > 0 && (
                <Typography sx={{ fontSize: 12.5, color: T.textMuted, fontWeight: 600 }}>
                  {formatMoney(report.dailyAverage)} a day
                </Typography>
              )}
            </Box>
          )}
        </Box>

        {/* ── Everything below needs something to have been spent ──────────── */}
        {isPending && !report && <Skeleton variant="rounded" height={200} sx={{ bgcolor: T.glass, borderRadius: 3 }} />}

        {nothingYet && (
          <NothingSpent
            period={report?.period}
            hint="Add an expense in any of your ledgers and it will show up here."
          />
        )}

        {report && total > 0 && (
          <>
            <Box sx={{
              p: { xs: 1.5, sm: 2 }, mb: 3, borderRadius: 3.5,
              bgcolor: T.glass, border: `1px solid ${T.border}`,
            }}>
              <SpendingChart unit={report.bucketUnit} buckets={report.buckets} />
            </Box>

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

            <SpendingBreakdown
              title="Who with"
              total={total}
              emptyText="No ledgers yet"
              rows={(report.ledgers ?? []).map((l) => ({
                key: l.groupId,
                emoji: groupIcon(l),
                label: l.name,
                amount: l.amount,
              }))}
            />

            {report.biggest && (
              <BiggestExpense expense={report.biggest} label="BIGGEST SINGLE SHARE" />
            )}
          </>
        )}
      </Box>
    </Box>
  );
}
