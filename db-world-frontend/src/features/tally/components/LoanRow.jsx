import { Box, Button, Typography } from '@mui/material';
import { motion, useReducedMotion } from 'framer-motion';
import { useT } from '@shared/theme';
import { formatMoney } from '../utils/tallyFormat';

/**
 * Green when you are owed, amber when you owe — the same two colours `balanceColor` gives a
 * balance, so a loan and a balance never disagree about which direction is which.
 */
const toneOf = (lent) => (lent ? '#10b981' : '#f59e0b');

/** "30 Sep", and how far off it is, in the words a reader would use. */
function dueLabel(dueDate, overdue) {
  if (!dueDate) return null;
  const due = new Date(`${dueDate}T00:00:00`);
  const pretty = due.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  const days = Math.round((due - new Date(new Date().toDateString())) / 86_400_000);
  if (overdue) {
    const late = Math.abs(days);
    return `${pretty} · ${late === 1 ? 'a day' : `${late} days`} late`;
  }
  if (days === 0) return `${pretty} · today`;
  if (days === 1) return `${pretty} · tomorrow`;
  return `${pretty} · ${days} days`;
}

/**
 * One loan, and how much of it has come back.
 *
 * <h2>Three numbers, because one cannot carry the story</h2>
 * A balance says "₹500 owed", which reads identically for half of a thousand-rupee loan and the
 * whole of a five-hundred one. Those are different situations — one is somebody paying you back,
 * the other is somebody who has not started — so the principal, what has returned and what is
 * left are all on the row, with the bar making the ratio readable without arithmetic.
 *
 * <p>The bar is the repaid fraction, not the outstanding one. Progress bars fill up as things get
 * better, and a bar that emptied as a debt was cleared would read backwards.
 */
export default function LoanRow({ loan, onRepay, showLedger = false }) {
  const T = useT();
  const reduce = useReducedMotion();

  const lent = loan.direction === 'LENT';
  const tone = toneOf(lent);
  const principal = Number(loan.principal ?? 0);
  const repaid = Number(loan.repaid ?? 0);
  // Clamped: an overpayment is reported honestly in the figures but must not overflow the bar.
  const pct = principal > 0 ? Math.min(100, Math.round((repaid / principal) * 100)) : 0;
  const due = dueLabel(loan.dueDate, loan.overdue);

  return (
    <Box sx={{
      p: 1.5, borderRadius: 3,
      bgcolor: T.glass,
      border: `1px solid ${loan.overdue ? '#ef444455' : T.border}`,
      opacity: loan.settled ? 0.72 : 1,
    }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, minWidth: 0 }}>
        <Typography noWrap sx={{ fontSize: 14.5, fontWeight: 800, color: T.textPrimary, minWidth: 0 }}>
          {loan.counterpartyName}
        </Typography>
        {showLedger && loan.groupName && loan.groupName !== loan.counterpartyName && (
          <Typography noWrap sx={{ fontSize: 11.5, color: T.textFaint, minWidth: 0 }}>
            in {loan.groupName}
          </Typography>
        )}
        <Box sx={{ flex: 1 }} />
        <Typography sx={{
          fontSize: 10.5, fontWeight: 800, letterSpacing: 0.5,
          color: loan.settled ? T.textMuted : tone,
        }}>
          {loan.settled ? 'SETTLED' : lent ? 'LENT' : 'BORROWED'}
        </Typography>
      </Box>

      {/* The three figures, in the order the story happens. */}
      <Typography sx={{ fontSize: 12.5, color: T.textMuted, mt: 0.35 }}>
        {formatMoney(principal)} {lent ? 'lent' : 'borrowed'}
        {' · '}{formatMoney(repaid)} back
        {!loan.settled && <> · <Box component="span" sx={{ color: tone, fontWeight: 700 }}>
          {formatMoney(loan.outstanding)} {lent ? 'due' : 'to pay'}
        </Box></>}
      </Typography>

      <Box sx={{
        mt: 0.9, height: 6, borderRadius: 99, overflow: 'hidden',
        bgcolor: T.glassHover,
      }}>
        <Box
          component={motion.div}
          initial={reduce ? false : { width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: reduce ? 0 : 0.5, ease: [0.22, 1, 0.36, 1] }}
          sx={{ height: '100%', bgcolor: loan.settled ? T.textMuted : tone, borderRadius: 99 }}
        />
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.75, minWidth: 0 }}>
        <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: T.textFaint, flexShrink: 0 }}>
          {pct}%
        </Typography>
        {due && (
          <Typography noWrap sx={{
            fontSize: 11.5, minWidth: 0,
            fontWeight: loan.overdue ? 800 : 600,
            color: loan.overdue ? '#ef4444' : T.textFaint,
          }}>
            {loan.overdue ? '' : 'due '}{due}
          </Typography>
        )}
        {loan.note && !due && (
          <Typography noWrap sx={{ fontSize: 11.5, color: T.textFaint, minWidth: 0 }}>
            {loan.note}
          </Typography>
        )}
        <Box sx={{ flex: 1 }} />
        {!loan.settled && onRepay && (
          <Button
            size="small"
            onClick={() => onRepay(loan)}
            sx={{
              flexShrink: 0, textTransform: 'none', fontWeight: 700, fontSize: 12,
              color: T.teal, minWidth: 0, px: 1,
            }}
          >
            {lent ? 'Got some back' : 'Paid some back'}
          </Button>
        )}
      </Box>
    </Box>
  );
}
