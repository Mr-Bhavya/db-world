import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Box, Typography } from '@mui/material';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import { AnimatePresence } from 'framer-motion';
import { useConfirm } from 'material-ui-confirm';
import { useT } from '@shared/theme';
import { useExpenses, useGroupLoans, useVoidExpense } from './hooks/useTally';
import { groupExpensesByDate, formatMoney } from './utils/tallyFormat';
import { useGroupChrome } from './components/GroupLayout';
import { GROUP_STICKY_TOP } from './components/GroupStickyBar';
import ExpenseRow from './components/ExpenseRow';
import ExpenseRowSkeleton from './components/ExpenseRowSkeleton';
import LoanRow from './components/LoanRow';

/**
 * Everything that has been spent in one group, newest day first.
 *
 * <p>Only the feed. The header, the balance, the tab bar, the balances column and every
 * group-level action belong to {@link TallyGroupShell}, which stays mounted while you move
 * between the three tabs — so this file is one of three interchangeable middles rather than a
 * page in its own right.
 *
 * <p>It reads the group off the shell's context, which works because the router renders it
 * inside that provider.
 */
export default function TallyGroupExpensesTab() {
  const T = useT();
  const { groupId } = useParams();
  const confirm = useConfirm();
  const { myMemberId, nameOf, openExpense, openRepay } = useGroupChrome();

  const { data: page, isLoading } = useExpenses(groupId);
  const { data: loans = [] } = useGroupLoans(groupId);
  const voidExpense = useVoidExpense(groupId);

  // `page?.items ?? []` produces a new array on every render while the feed is still loading,
  // which would make the grouping below recompute each time for no reason.
  const expenses = useMemo(() => page?.items ?? [], [page]);
  const days = useMemo(() => groupExpensesByDate(expenses), [expenses]);

  /**
   * Loans, above the feed.
   *
   * <p>Not inside it: the feed is grouped by day and a loan is not a day's spending, it is an
   * open commitment that outlives the day it was made. And not behind a tab either -- if
   * somebody owes you money, that is what you opened the ledger to check.
   *
   * <p>Settled ones are still listed, dimmed, because "Riya paid me back in full" is a thing
   * worth being able to see rather than something that silently disappears.
   */
  const loansBand = loans.length > 0 && (
    <Box sx={{ mb: 2.5 }}>
      <Typography sx={{
        fontSize: 12, fontWeight: 800, color: T.textMuted, letterSpacing: 0.2, mb: 1,
      }}>
        Lent &amp; borrowed
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {loans.map((loan) => (
          <LoanRow key={loan.id} loan={loan} onRepay={openRepay} />
        ))}
      </Box>
    </Box>
  );

  const askVoid = (expense) => {
    confirm({
      title: 'Remove this expense?',
      description: `"${expense.description}" (${formatMoney(expense.totalAmount)}) will stop `
        + 'counting towards anybody\'s balance. It stays in the history, marked removed.',
      confirmationText: 'Remove',
      cancellationText: 'Keep it',
    }).then(() => voidExpense.mutate(expense.id)).catch(() => {});
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {Array.from({ length: 4 }, (_, i) => <ExpenseRowSkeleton key={i} />)}
      </Box>
    );
  }

  if (expenses.length === 0) {
    return (
      <>
        {loansBand}
        <Box sx={{
          textAlign: 'center', py: { xs: 5, sm: 7 }, px: 2,
          borderRadius: 4, bgcolor: T.glass, border: `1px dashed ${T.glassBorder}`,
        }}>
          <ReceiptLongRoundedIcon sx={{ fontSize: 32, color: T.textMuted, mb: 1 }} />
          <Typography sx={{ fontSize: 16, fontWeight: 800, color: T.textPrimary }}>
            Nothing spent yet
          </Typography>
          <Typography sx={{ fontSize: 13.5, color: T.textMuted, mt: 0.5, maxWidth: 320, mx: 'auto' }}>
            Add the first expense and everyone&apos;s balance will work itself out.
          </Typography>
        </Box>
      </>
    );
  }

  return (
    <>
      {loansBand}

      <AnimatePresence initial={false}>
        {days.map((day) => (
          <Box key={day.label} sx={{ mb: 2.5 }}>
            {/* Offset by the pinned bar as well as the app bar. At the app bar's height alone
                the date slides under the pinned tabs and disappears, which is worse than not
                being sticky at all. */}
            <Typography sx={{
              position: 'sticky', top: GROUP_STICKY_TOP, zIndex: 2,
              fontSize: 12, fontWeight: 800, color: T.textMuted,
              bgcolor: T.bg, py: 0.75, letterSpacing: 0.2,
            }}>
              {day.label}
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {day.items.map((expense, i) => (
                <ExpenseRow
                  key={expense.id}
                  expense={expense}
                  index={i}
                  myMemberId={myMemberId}
                  nameOf={nameOf}
                  onEdit={openExpense}
                  onVoid={askVoid}
                />
              ))}
            </Box>
          </Box>
        ))}
      </AnimatePresence>

      {page?.hasMore && (
        <Typography sx={{ fontSize: 12, color: T.textMuted, textAlign: 'center', mt: 1 }}>
          Showing the most recent {expenses.length}. Older ones are still counted in the balances.
        </Typography>
      )}
    </>
  );
}
