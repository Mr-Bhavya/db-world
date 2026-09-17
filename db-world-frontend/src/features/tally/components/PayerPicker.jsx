import { Box, Typography, TextField, InputAdornment, Collapse, Button } from '@mui/material';
import GroupAddRoundedIcon from '@mui/icons-material/GroupAddRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import { motion, AnimatePresence } from 'framer-motion';
import { useT } from '@shared/theme';
import { formatMoney } from '../utils/tallyFormat';
import { sumAmounts, toPaise, redistribute } from '../utils/tallyMath';
import { tallyFieldSx, MemberAvatar } from './tallyFormUi';

/**
 * Who put the money in.
 *
 * <b>Two modes, and the mode is explicit.</b> The first version let you tap a second person
 * and quietly swapped the first one out, so reaching two payers was impossible and there was
 * nothing on screen to suggest it should be. Now "More than one person paid" is a visible
 * switch: off, tapping a face just moves the single payer; on, faces add and remove and each
 * one gets its own amount.
 *
 * In single mode the payer's amount is the total — asking for it twice is asking somebody to
 * retype a number the form already has, and to keep it in step by hand.
 */
export default function PayerPicker({
  members, myMemberId, payers, onChange, totalAmount, multi, onToggleMulti,
}) {
  const T = useT();
  const payerIds = Object.keys(payers);
  const nameOf = (id) => members.find((m) => m.id === id)?.displayName ?? 'Someone';

  const paidTotal = sumAmounts(Object.values(payers));
  const matches = (() => {
    try { return toPaise(paidTotal) === toPaise(totalAmount || '0'); } catch { return false; }
  })();

  /* Adding or removing a payer re-spreads the bill across whoever is left, so the common
     "we went halves" case needs no typing at all. Anything already typed stays put — same
     locking rule as the split editor, for the same reason. */
  const rebalance = (next, total) => redistribute({
    total: total || '0',
    memberIds: Object.keys(next),
    locked: new Set(Object.keys(next).filter((id) => next[id] !== '')),
    values: next,
  }).values;

  const tapFace = (memberId) => {
    if (!multi) {
      onChange({ [memberId]: totalAmount ?? '' });
      return;
    }
    if (memberId in payers) {
      // Never leave an expense with nobody paying; the last one stays put.
      if (payerIds.length === 1) return;
      const { [memberId]: _removed, ...rest } = payers;
      onChange(rebalance(rest, totalAmount));
      return;
    }
    onChange(rebalance({ ...payers, [memberId]: '' }, totalAmount));
  };


  return (
    <Box>
      {/* The heading belongs to the section this sits in now; what is left on this row is the
          one control that switches it between one payer and several. */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1, mb: 1 }}>
        <Button
          size="small"
          onClick={() => {
            const turningOn = !multi;
            onToggleMulti(turningOn);
            // Coming back to single mode, keep the largest contributor rather than an
            // arbitrary one -- they are almost always the person who actually paid the bill.
            if (!turningOn && payerIds.length > 1) {
              const biggest = payerIds.reduce((best, id) => {
                try { return toPaise(payers[id] || '0') > toPaise(payers[best] || '0') ? id : best; }
                catch { return best; }
              }, payerIds[0]);
              onChange({ [biggest]: totalAmount ?? '' });
            }
          }}
          startIcon={multi
            ? <PersonRoundedIcon sx={{ fontSize: 15 }} />
            : <GroupAddRoundedIcon sx={{ fontSize: 15 }} />}
          sx={{ textTransform: 'none', fontSize: 12, fontWeight: 700, color: T.teal, py: 0.2 }}
        >
          {multi ? 'Just one person' : 'More than one person paid'}
        </Button>
      </Box>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
        {members.map((member) => {
          const selected = member.id in payers;
          return (
            <Box
              key={member.id}
              component={motion.button}
              type="button"
              whileTap={{ scale: 0.94 }}
              onClick={() => tapFace(member.id)}
              aria-pressed={selected}
              sx={{
                display: 'flex', alignItems: 'center', gap: 0.7,
                pl: 0.5, pr: 1.25, py: 0.4, borderRadius: 999, cursor: 'pointer',
                fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                bgcolor: selected ? T.tealBg : T.glass,
                color: selected ? T.textPrimary : T.textMuted,
                border: `1px solid ${selected ? T.glassBorderHover : T.border}`,
                transition: 'all .15s ease',
              }}
            >
              <MemberAvatar member={member} size={24} dimmed={!selected} />
              {member.id === myMemberId ? 'You' : member.displayName}
            </Box>
          );
        })}
      </Box>

      <Collapse in={multi}>
        <Box sx={{ mt: 1.25, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {payerIds.map((memberId) => (
            <Box key={memberId} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography noWrap sx={{ fontSize: 13, color: T.textMuted, flex: 1, minWidth: 0 }}>
                {memberId === myMemberId ? 'You' : nameOf(memberId)} paid
              </Typography>
              <TextField
                size="small"
                inputMode="decimal"
                value={payers[memberId] ?? ''}
                onChange={(e) => onChange({ ...payers, [memberId]: e.target.value })}
                sx={{ ...tallyFieldSx(T), width: 126 }}
                slotProps={{
                  input: { startAdornment: <InputAdornment position="start">₹</InputAdornment> },
                }}
              />
            </Box>
          ))}

          <AnimatePresence mode="wait">
            <Box
              key={matches ? 'ok' : 'off'}
              component={motion.div}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}
            >
              {matches
                ? <CheckRoundedIcon sx={{ fontSize: 15, color: T.teal }} />
                : <WarningAmberRoundedIcon sx={{ fontSize: 15, color: '#f59e0b' }} />}
              <Typography sx={{ fontSize: 12, fontWeight: 600, color: matches ? T.teal : '#f59e0b' }}>
                {matches
                  ? `That adds up to ${formatMoney(paidTotal)}`
                  : `Paid so far ${formatMoney(paidTotal)} of ${formatMoney(totalAmount || 0)}`}
              </Typography>
            </Box>
          </AnimatePresence>
        </Box>
      </Collapse>
    </Box>
  );
}
