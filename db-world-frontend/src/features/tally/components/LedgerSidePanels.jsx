import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Skeleton, Typography } from '@mui/material';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import { motion, useReducedMotion } from 'framer-motion';
import Constants from '@shared/constants';
import { useT } from '@shared/theme';
import { useGroupReport, useSettlements } from '../hooks/useTally';
import {
  balanceColor, categoryEmoji, formatExpenseDate, formatMoney, formatMoneyCompact,
  reportCaption, spendingTrend,
} from '../utils/tallyFormat';
import { DEFAULT_WINDOW } from '../utils/reportWindow';
import { MemberAvatar } from './tallyFormUi';
import LoanRow from './LoanRow';
import SpendingBreakdown from './SpendingBreakdown';
import { TrendChip } from './reportPieces';

/**
 * What fills a ledger's side column on a desktop, besides a group's balances.
 *
 * <p>The column used to exist only for groups, so a one-to-one ledger and your own spending were
 * a single 760px column in the middle of a 1920px screen: the phone layout, stretched. Widening
 * that column instead would put a description at one edge of the screen and its amount at the
 * other. So these pages get a side column too, holding the things you glance at rather than
 * scroll: the payments between you (which were otherwise only in History), the loans, and for
 * your own spending, the month so far.
 *
 * <p>Desktop only. On a phone the same column would sit above the feed and push every expense
 * down a screen, and each of these already has a home there: loans above the feed, payments in
 * History, the month in the Spending report.
 */

/** Same label as the balances panel beside it, so the column reads as one set of sections. */
export function SideLabel({ children }) {
  const T = useT();
  return (
    <Typography sx={{
      fontSize: 11, fontWeight: 800, letterSpacing: 0.7,
      textTransform: 'uppercase', color: T.textFaint, mb: 1,
    }}>
      {children}
    </Typography>
  );
}

/* ============================== loans ============================== */

/**
 * Loans, moved here from above the feed. On a desktop they stay in view while you scroll the
 * expenses, and the feed starts with the thing it is named after.
 */
export function LoansPanel({ loans, onRepay }) {
  if (!loans?.length) return null;
  return (
    <Box>
      <SideLabel>Lent &amp; borrowed</SideLabel>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {loans.map((loan) => <LoanRow key={loan.id} loan={loan} onRepay={onRepay} />)}
      </Box>
    </Box>
  );
}

/* ============================== payments ============================== */

/** How many payments show before the rest fold behind a link. */
const PAYMENTS_SHOWN = 5;

/** The settledAt instant as the reader's own calendar day, for {@link formatExpenseDate}. */
function localDay(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Every payment recorded in this ledger, newest first.
 *
 * <p>These were fetched by nobody. A payment moved the balance and wrote a line into History, but
 * the ledger page itself never showed one, so "did Rashmi's ₹50,000 go in?" meant opening the
 * change log and reading through every expense edit to find it.
 */
export function PaymentsPanel({ groupId, members, myMemberId }) {
  const T = useT();
  const reduce = useReducedMotion();
  const { data: payments = [], isPending } = useSettlements(groupId);
  const [showAll, setShowAll] = useState(false);

  const nameOf = (id) => members.find((m) => m.id === id)?.displayName ?? 'Someone';
  const visible = showAll ? payments : payments.slice(0, PAYMENTS_SHOWN);
  const hidden = payments.length - PAYMENTS_SHOWN;
  const base = { bgcolor: T.glassHover, borderRadius: 1 };

  return (
    <Box>
      <SideLabel>{payments.length > 0 ? `Payments · ${payments.length}` : 'Payments'}</SideLabel>

      {isPending && (
        <Box sx={{ borderRadius: 3, border: `1px solid ${T.glassBorder}`, overflow: 'hidden' }}>
          {[0, 1].map((i) => (
            <Box key={i} sx={{
              display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 1.1,
              borderBottom: i === 0 ? `1px solid ${T.border}` : 'none',
            }}>
              <Skeleton variant="circular" width={26} height={26} sx={{ ...base, flexShrink: 0 }} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: 12.5 }}><Skeleton variant="text" width="65%" sx={base} /></Typography>
                <Typography sx={{ fontSize: 11 }}><Skeleton variant="text" width="35%" sx={base} /></Typography>
              </Box>
              <Typography sx={{ fontSize: 12.5 }}><Skeleton variant="text" width={64} sx={base} /></Typography>
            </Box>
          ))}
        </Box>
      )}

      {!isPending && payments.length === 0 && (
        <Box sx={{ px: 1.5, py: 1.25, borderRadius: 3, border: `1px dashed ${T.glassBorder}` }}>
          <Typography sx={{ fontSize: 12.5, color: T.textMuted, lineHeight: 1.5 }}>
            No payments yet. When somebody settles up, it shows here.
          </Typography>
        </Box>
      )}

      {!isPending && payments.length > 0 && (
        <Box sx={{ borderRadius: 3, border: `1px solid ${T.glassBorder}`, overflow: 'hidden' }}>
          {visible.map((payment, i) => {
            const fromMe = payment.fromMemberId === myMemberId;
            const toMe = payment.toMemberId === myMemberId;
            const sentence = fromMe
              ? `You paid ${nameOf(payment.toMemberId)}`
              : toMe
                ? `${nameOf(payment.fromMemberId)} paid you`
                : `${nameOf(payment.fromMemberId)} paid ${nameOf(payment.toMemberId)}`;
            // Money coming to you is green and money leaving you amber, the same two colours a
            // balance uses. Somebody else's payment is none of your business, so it stays grey.
            const tone = toMe ? balanceColor(1, T) : fromMe ? balanceColor(-1, T) : T.textMuted;

            return (
              <Box
                key={payment.id}
                component={motion.div}
                initial={reduce ? false : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, delay: reduce ? 0 : Math.min(i * 0.04, 0.2) }}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 1.1,
                  borderBottom: i < visible.length - 1 ? `1px solid ${T.border}` : 'none',
                }}
              >
                <MemberAvatar
                  member={{ id: payment.fromMemberId, displayName: nameOf(payment.fromMemberId) }}
                  size={26}
                />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography noWrap sx={{
                    fontSize: 12.5, color: T.textPrimary,
                    fontWeight: fromMe || toMe ? 700 : 500,
                  }}>
                    {sentence}
                  </Typography>
                  <Typography noWrap sx={{ fontSize: 11, color: T.textFaint }}>
                    {[formatExpenseDate(localDay(payment.settledAt)), payment.method]
                      .filter(Boolean).join(' · ')}
                  </Typography>
                </Box>
                <Typography sx={{
                  fontSize: 12.5, fontWeight: 800, color: tone, whiteSpace: 'nowrap',
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {formatMoney(payment.amount)}
                </Typography>
              </Box>
            );
          })}
        </Box>
      )}

      {hidden > 0 && (
        <Box
          component="button"
          type="button"
          onClick={() => setShowAll((open) => !open)}
          sx={{
            display: 'block', mt: 0.75, px: 0, py: 0.5, border: 'none', bgcolor: 'transparent',
            cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700,
            color: T.teal,
            '&:focus-visible': { outline: `2px solid ${T.teal}`, outlineOffset: 2 },
          }}
        >
          {showAll ? 'Show fewer' : `Show ${hidden} more`}
        </Box>
      )}
    </Box>
  );
}

/* ============================== the month so far ============================== */

/**
 * Your own spending, this month, for the one ledger that has no Report tab.
 *
 * <p>It has no tab because a report of a one-person ledger is mostly the same number four times.
 * But the question "how much have I spent this month" is still the one people keep this ledger
 * to answer, and on a desktop there is room to answer it beside the list.
 */
export function MonthPanel({ groupId }) {
  const T = useT();
  const navigate = useNavigate();
  const { data: report, isPending } = useGroupReport(groupId, DEFAULT_WINDOW);

  const total = Number(report?.total ?? 0);
  const count = Number(report?.expenseCount ?? 0);
  const trend = spendingTrend(total, report?.previousTotal, report?.period);
  const rows = (report?.categories ?? []).map((row) => ({
    key: row.category ?? 'uncategorised',
    emoji: row.category ? categoryEmoji(row.category) : '\u{1F4E6}',
    label: row.category ?? 'Uncategorised',
    amount: row.amount,
  }));
  const base = { bgcolor: T.glassHover, borderRadius: 1 };

  return (
    <Box>
      <SideLabel>This month</SideLabel>
      <Box sx={{
        p: 1.75, borderRadius: 3,
        bgcolor: T.glass, border: `1px solid ${T.glassBorder}`,
      }}>
        {isPending && !report ? (
          <>
            <Typography sx={{ fontSize: 26, lineHeight: 1.15 }}>
              <Skeleton variant="text" width="55%" sx={base} />
            </Typography>
            <Typography sx={{ fontSize: 12.5, mt: 0.4 }}>
              <Skeleton variant="text" width="70%" sx={base} />
            </Typography>
          </>
        ) : (
          <>
            <Typography sx={{
              fontSize: 26, fontWeight: 800, color: T.textPrimary,
              letterSpacing: -0.8, lineHeight: 1.15,
            }}>
              {formatMoneyCompact(total)}
            </Typography>
            <Typography sx={{ fontSize: 12.5, color: T.textMuted, mt: 0.4 }}>
              {[reportCaption(report), count > 0 && `${count} ${count === 1 ? 'expense' : 'expenses'}`]
                .filter(Boolean).join(' · ')}
            </Typography>

            {(trend || Number(report?.dailyAverage) > 0) && (
              <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, mt: 1.25 }}>
                {trend && <TrendChip trend={trend} />}
                {Number(report?.dailyAverage) > 0 && (
                  <Typography sx={{ fontSize: 12, color: T.textMuted, fontWeight: 600 }}>
                    {formatMoney(report.dailyAverage)} a day
                  </Typography>
                )}
              </Box>
            )}

            {rows.length > 0 && (
              <Box sx={{ mt: 1.5, pt: 0.75, borderTop: `1px solid ${T.border}` }}>
                <SpendingBreakdown rows={rows} total={total} max={5} emptyText="" />
              </Box>
            )}
          </>
        )}
      </Box>

      <Box
        component="button"
        type="button"
        onClick={() => navigate(Constants.DB_TALLY_REPORT_ROUTE)}
        sx={{
          display: 'inline-flex', alignItems: 'center', gap: 0.5,
          mt: 1, px: 0, py: 0.5, border: 'none', bgcolor: 'transparent',
          cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700,
          color: T.teal,
          '&:focus-visible': { outline: `2px solid ${T.teal}`, outlineOffset: 2 },
        }}
      >
        All your spending, shared ledgers included
        <ArrowForwardRoundedIcon sx={{ fontSize: 15 }} />
      </Box>
    </Box>
  );
}
