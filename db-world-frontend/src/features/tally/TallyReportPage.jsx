import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, IconButton, Skeleton, Tooltip, Typography } from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import TrendingDownRoundedIcon from '@mui/icons-material/TrendingDownRounded';
import TrendingFlatRoundedIcon from '@mui/icons-material/TrendingFlatRounded';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import Constants from '@shared/constants';
import { useT } from '@shared/theme';
import { useSpendingReport } from './hooks/useTally';
import {
  categoryEmoji, formatMoney, formatExpenseDate, groupIcon, reportCaption, spendingTrend,
} from './utils/tallyFormat';
import ReportPeriodNav from './components/ReportPeriodNav';
import SpendingChart from './components/SpendingChart';
import SpendingBreakdown from './components/SpendingBreakdown';

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
  const T = useT();
  const navigate = useNavigate();
  const reduce = useReducedMotion();

  const [period, setPeriod] = useState('MONTH');
  // null means "the current period", which is the server's default. Stepping replaces it with
  // an anchor the server sent us, so the two never disagree about where a month begins.
  const [anchor, setAnchor] = useState(null);

  const { data: report, isPending, isFetching } = useSpendingReport(period, anchor);

  const total = Number(report?.total ?? 0);
  const trend = spendingTrend(total, report?.previousTotal, period);
  const nothingYet = !isPending && report && total === 0;

  /* Switching Week/Month/Year drops the anchor.
     The anchor is a date inside a period of the old size, and carrying it over lands you on
     "the week containing the 1st of last September" — technically correct and never what was
     meant. Going back to the current period is the only unsurprising answer. */
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

          {/* The two figures that give the total meaning: how it compares, and the rate. */}
          {!nothingYet && report && (
            <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1.5, mt: 1.5 }}>
              {trend && <TrendChip trend={trend} T={T} />}
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

        {nothingYet && <NothingSpent period={period} T={T} />}

        {report && total > 0 && (
          <>
            <Box sx={{
              p: { xs: 1.5, sm: 2 }, mb: 3, borderRadius: 3.5,
              bgcolor: T.glass, border: `1px solid ${T.border}`,
            }}>
              <SpendingChart period={period} buckets={report.buckets} />
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

            {report.biggest && <Biggest expense={report.biggest} T={T} />}
          </>
        )}
      </Box>
    </Box>
  );
}

/* ============================== pieces ============================== */

function TrendChip({ trend, T }) {
  // Up is not automatically bad -- a month with a holiday in it is supposed to cost more -- so
  // this is deliberately neutral in colour and only the arrow carries the direction.
  const Icon = trend.direction === 'up' ? TrendingUpRoundedIcon
    : trend.direction === 'down' ? TrendingDownRoundedIcon
      : TrendingFlatRoundedIcon;

  return (
    <Box sx={{
      display: 'inline-flex', alignItems: 'center', gap: 0.5,
      px: 1, py: 0.35, borderRadius: 99,
      bgcolor: T.glass, border: `1px solid ${T.border}`,
    }}>
      <Icon sx={{ fontSize: 15, color: T.textMuted }} />
      <Typography sx={{ fontSize: 12, fontWeight: 700, color: T.textMuted }}>
        {trend.label}
      </Typography>
    </Box>
  );
}

function Biggest({ expense, T }) {
  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', gap: 1.5,
      p: 1.75, borderRadius: 3, mb: 2,
      bgcolor: T.glass, border: `1px solid ${T.border}`,
    }}>
      <Box sx={{
        width: 34, height: 34, borderRadius: 2, flexShrink: 0,
        display: 'grid', placeItems: 'center', fontSize: 17,
        bgcolor: T.tealBg,
      }}>
        {expense.category ? categoryEmoji(expense.category) : '🧾'}
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography sx={{ fontSize: 11.5, color: T.textFaint, fontWeight: 700, letterSpacing: 0.4 }}>
          BIGGEST SINGLE SHARE
        </Typography>
        <Typography noWrap sx={{ fontSize: 14, fontWeight: 700, color: T.textPrimary }}>
          {expense.description}
        </Typography>
      </Box>
      <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 800, color: T.textPrimary }}>
          {formatMoney(expense.amount)}
        </Typography>
        <Typography sx={{ fontSize: 11.5, color: T.textMuted }}>
          {formatExpenseDate(expense.date)}
        </Typography>
      </Box>
    </Box>
  );
}

function NothingSpent({ period, T }) {
  const unit = { WEEK: 'week', MONTH: 'month', YEAR: 'year' }[period] ?? 'month';
  return (
    <Box sx={{
      textAlign: 'center', py: 6, px: 3, borderRadius: 3.5,
      bgcolor: T.glass, border: `1px dashed ${T.glassBorder}`,
    }}>
      <Box sx={{ fontSize: 34, mb: 1 }}>🧾</Box>
      <Typography sx={{ fontSize: 15.5, fontWeight: 700, color: T.textPrimary, mb: 0.5 }}>
        Nothing in this {unit}
      </Typography>
      <Typography sx={{ fontSize: 13.5, color: T.textMuted }}>
        Add an expense in any of your ledgers and it will show up here.
      </Typography>
    </Box>
  );
}
