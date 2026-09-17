import { useEffect, useState } from 'react';
import {
  Box, Typography, TextField, InputAdornment, useMediaQuery, useTheme,
} from '@mui/material';
import CurrencyRupeeRoundedIcon from '@mui/icons-material/CurrencyRupeeRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import SwapHorizRoundedIcon from '@mui/icons-material/SwapHorizRounded';
import { motion } from 'framer-motion';
import { useT } from '@shared/theme';
import { newIdempotencyKey } from '../api/tallyApi';
import { settlementSchema, SETTLEMENT_METHODS } from '../schemas/tallySchemas';
import {
  TallyFormDialog, TallySubmitButton, TallyCancelButton, tallyFieldSx, MemberAvatar,
} from './tallyFormUi';

/** Two decimals, because the server rejects a third and MySQL in strict mode rejects it twice. */
const money = (n) => (Math.round(n * 100) / 100).toFixed(2);

/**
 * Fractions of the suggested figure.
 *
 * <p>Half is the one people actually ask for; a quarter covers "I can only do a bit now"; all of
 * it is there so the chips are also a way BACK after experimenting, rather than a one-way door.
 */
const AMOUNT_PRESETS = [
  { label: 'Quarter', of: 0.25 },
  { label: 'Half', of: 0.5 },
  { label: 'All of it', of: 1 },
];

/**
 * Recording a payment somebody has already made.
 *
 * Past tense throughout — "paid", not "pay". Nothing here moves money; it writes down that
 * money moved, which is a different act and needs to read like one, or people will wait for a
 * transfer that is never going to happen.
 */
export default function RecordPaymentDialog({
  open, onClose, onRecord, busy, members = [], myMemberId, prefill = null,
}) {
  const T = useT();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  const active = members.filter((m) => m.status === 'ACTIVE');
  const memberOf = (id) => members.find((m) => m.id === id);

  /*
   * With exactly two people, choosing who paid settles who received -- so BOTH sides are filled
   * in on open rather than leaving the reader to answer a question with one possible answer.
   *
   * <p>Filled in, not removed. An earlier version replaced the pickers with a read-only
   * statement on the grounds that the swap covered every direction, and that was wrong in a way
   * worth recording: with no `myMemberId` -- a ghost or unclaimed member -- `from` came out
   * empty, there was no control to set it, and the submit button stayed disabled forever. A
   * prefill that turns out wrong has to be correctable, which means the pickers stay.
   */
  const pair = active.length === 2 ? active : null;

  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('');
  const [error, setError] = useState(null);
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);

  // Of the SUGGESTION, not of whatever is in the box -- otherwise tapping Half twice would
  // quarter it, and the chips would stop meaning what they say.
  const suggested = Number(prefill?.amount ?? 0);

  useEffect(() => {
    if (!open) return;
    // One token per opening. Settlement is one-sided, so a retry that carried a NEW key would
    // not be a retry -- it would move the balance a second time and look like an overpayment.
    setIdempotencyKey(newIdempotencyKey());
    setError(null);
    setMethod('');
    /*
     * Both sides, and on a pair never empty.
     *
     * `myMemberId` is nullable -- a ghost member, or one nobody has claimed -- so it cannot be
     * the only source for "me". On a pair, fall back to the two people in order; the direction
     * may then be the wrong way round, which is what the swap is for, but neither side is ever
     * blank and neither is ever unsettable.
     */
    const first = prefill?.fromMemberId ?? myMemberId ?? pair?.[0]?.id ?? '';
    const second = prefill?.toMemberId
      ?? (pair ? pair.find((m) => m.id !== first)?.id ?? '' : '');
    setFrom(first);
    setTo(second);
    setAmount(prefill?.amount ? String(prefill.amount) : '');
  }, [open, prefill, myMemberId, pair]);

  const submit = () => {
    const payload = {
      fromMemberId: from, toMemberId: to, amount, method: method || '', settledAt: undefined,
    };
    const parsed = settlementSchema.safeParse(payload);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the details');
      return;
    }
    setError(null);
    onRecord({
      ...payload,
      method: method || null,
      // Carried straight through from the prefill. A repayment against a loan is an ordinary
      // payment plus the name of the loan it clears -- that name is the only thing that makes
      // per-loan progress recoverable later, and it is not something the reader can type.
      settlesExpenseId: prefill?.settlesExpenseId ?? null,
      idempotencyKey,
    });
  };

  const swap = () => { setFrom(to); setTo(from); };

  return (
    <TallyFormDialog
      open={open}
      onClose={onClose}
      busy={busy}
      fullScreen={fullScreen}
      title={prefill?.settlesExpenseId ? 'Record a repayment' : 'Record a payment'}
      subtitle={prefill?.loanLabel
        ? `Against ${prefill.loanLabel}`
        : 'Write down money that has already changed hands'}
      actions={(
        <>
          <TallyCancelButton onClick={onClose} disabled={busy} />
          <TallySubmitButton busy={busy} disabled={!from || !to || !amount} onClick={submit}>
            Record it
          </TallySubmitButton>
        </>
      )}
    >
      {/* Who paid whom, as a sentence rather than two unrelated dropdowns. */}
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 1,
        p: 1.5, borderRadius: 3, bgcolor: T.glass, border: `1px solid ${T.border}`,
      }}>
        <PersonPicker label="Paid" value={from} onChange={setFrom} members={active} myMemberId={myMemberId} />
        <SwapButton onClick={swap} />
        <PersonPicker label="Received" value={to} onChange={setTo} members={active} myMemberId={myMemberId} />
      </Box>

      {from && to && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, justifyContent: 'center' }}>
          <Typography sx={{ fontSize: 13, color: T.textMuted }}>
            {memberOf(from)?.displayName ?? '—'}
          </Typography>
          <ArrowForwardRoundedIcon sx={{ fontSize: 15, color: T.teal }} />
          <Typography sx={{ fontSize: 13, color: T.textMuted }}>
            {memberOf(to)?.displayName ?? '—'}
          </Typography>
        </Box>
      )}

      <TextField
        fullWidth
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="0.00"
        inputMode="decimal"
        aria-label="Amount paid"
        // Selects the whole suggested figure, so typing replaces it. Without this, changing
        // 12,450.75 to 6,000 meant tapping into the middle of the number and backspacing
        // through eight characters -- on a phone, with a 28px font, aiming at a caret.
        onFocus={(e) => e.target.select()}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <CurrencyRupeeRoundedIcon sx={{ fontSize: 24, color: T.teal }} />
              </InputAdornment>
            ),
          },
        }}
        sx={{
          ...tallyFieldSx(T),
          '& .MuiInputBase-input': { fontSize: 28, fontWeight: 800, color: T.textPrimary, py: 1.3 },
        }}
      />

      {/* Part payments are the normal case, not the exception -- the settle-up sheet says so in
          as many words -- so the fractions get a tap each rather than a retype. Offered only
          when there is a suggested figure to take a fraction OF. */}
      {suggested > 0 && (
        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
          {AMOUNT_PRESETS.map(({ label, of }) => {
            const value = money(suggested * of);
            return (
              <Box
                key={label}
                component="button"
                type="button"
                onClick={() => setAmount(value)}
                sx={{
                  appearance: 'none', cursor: 'pointer', px: 1.25, py: 0.5,
                  borderRadius: 2, fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700,
                  border: `1px solid ${amount === value ? T.teal : T.border}`,
                  bgcolor: amount === value ? T.tealBg : 'transparent',
                  color: amount === value ? T.teal : T.textMuted,
                }}
              >
                {label}
              </Box>
            );
          })}
        </Box>
      )}

      <Box>
        <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: T.textMuted, mb: 1 }}>
          How? <Box component="span" sx={{ fontWeight: 500 }}>(optional)</Box>
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
          {SETTLEMENT_METHODS.map((option) => {
            const selected = method === option;
            return (
              <Box
                key={option}
                component={motion.button}
                type="button"
                whileTap={{ scale: 0.94 }}
                onClick={() => setMethod(selected ? '' : option)}
                sx={{
                  px: 1.4, py: 0.6, borderRadius: 999, cursor: 'pointer',
                  fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit',
                  bgcolor: selected ? T.tealBg : T.glass,
                  color: selected ? T.teal : T.textMuted,
                  border: `1px solid ${selected ? T.glassBorderHover : T.border}`,
                  transition: 'all .15s ease',
                }}
              >
                {option}
              </Box>
            );
          })}
        </Box>
      </Box>

      {prefill?.amount && (
        <Typography sx={{ fontSize: 12, color: T.textMuted, lineHeight: 1.55 }}>
          Suggested from the settle-up plan. Change the amount if they paid something else —
          a part payment is fine, and so is paying more.
        </Typography>
      )}

      {error && (
        <Typography sx={{ fontSize: 12.5, color: '#f59e0b', fontWeight: 600 }}>{error}</Typography>
      )}
    </TallyFormDialog>
  );
}

/** A compact person selector: avatars, not a dropdown of names. */
/** Flips the direction, so neither end has to be re-picked to swap them. */
function SwapButton({ onClick }) {
  const T = useT();
  return (
    <Box
      component={motion.button}
      type="button"
      whileTap={{ scale: 0.9, rotate: 180 }}
      onClick={onClick}
      aria-label="Swap who paid whom"
      sx={{
        display: 'grid', placeItems: 'center', flexShrink: 0,
        width: 34, height: 34, borderRadius: '50%', cursor: 'pointer',
        bgcolor: T.glassHover, border: `1px solid ${T.border}`, color: T.teal,
      }}
    >
      <SwapHorizRoundedIcon sx={{ fontSize: 17 }} />
    </Box>
  );
}

function PersonPicker({ label, value, onChange, members, myMemberId }) {
  const T = useT();
  return (
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography sx={{ fontSize: 10.5, fontWeight: 800, color: T.textMuted, mb: 0.6, letterSpacing: 0.3 }}>
        {label.toUpperCase()}
      </Typography>
      <Box sx={{
        display: 'flex', gap: 0.5, overflowX: 'auto', pb: 0.25,
        scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' },
      }}>
        {members.map((member) => {
          const selected = value === member.id;
          return (
            <Box
              key={member.id}
              component={motion.button}
              type="button"
              whileTap={{ scale: 0.9 }}
              onClick={() => onChange(member.id)}
              title={member.displayName}
              aria-label={`${label}: ${member.displayName}`}
              aria-pressed={selected}
              sx={{
                p: 0.25, borderRadius: '50%', cursor: 'pointer', flexShrink: 0,
                border: `2px solid ${selected ? T.teal : 'transparent'}`,
                background: 'none', transition: 'border-color .15s ease',
              }}
            >
              <MemberAvatar member={member} size={30} dimmed={!selected} />
            </Box>
          );
        })}
      </Box>
      <Typography noWrap sx={{ fontSize: 11.5, color: T.textMuted, mt: 0.4 }}>
        {value
          ? (value === myMemberId ? 'You' : members.find((m) => m.id === value)?.displayName)
          : 'Pick somebody'}
      </Typography>
    </Box>
  );
}
