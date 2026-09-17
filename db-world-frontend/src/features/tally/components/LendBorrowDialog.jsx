import { useEffect, useMemo, useState } from 'react';
import {
  Box, InputAdornment, MenuItem, TextField, ToggleButton, ToggleButtonGroup, Typography,
  useMediaQuery, useTheme,
} from '@mui/material';
import CurrencyRupeeRoundedIcon from '@mui/icons-material/CurrencyRupeeRounded';
import { useT } from '@shared/theme';
import { newIdempotencyKey } from '../api/tallyApi';
import { sanitiseAmountInput } from '../utils/tallyFormat';
import { loanSchema } from '../schemas/tallySchemas';
import ExpenseDateField from './ExpenseDateField';
import {
  TallyFormDialog, TallySubmitButton, TallyCancelButton, tallyFieldSx, MemberAvatar,
} from './tallyFormUi';

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Money lent or borrowed.
 *
 * <h2>Why this is not the expense dialog</h2>
 * A loan has no split to decide and no category to choose: there are two people and one of them
 * owes the whole amount. Recording one through the expense form meant inventing a description,
 * choosing a food-or-travel category for money that bought nothing, and setting a 100/0 percent
 * split -- five decisions to record one fact.
 *
 * <p>So the direction is a two-option toggle and everything else follows from it. The reader
 * never sees a payer or a share; those are derived on the server, once, because getting the
 * direction backwards silently inverts a debt.
 *
 * <h2>Past tense, like the payment dialog</h2>
 * "Lent", not "Lend". Nothing here moves money -- it writes down that money moved -- and the
 * wording has to say so, or somebody waits for a transfer that is never going to happen.
 */
export default function LendBorrowDialog({
  open, onClose, onSubmit, busy, members = [], myMemberId,
}) {
  const T = useT();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  // Never the caller: lending to yourself is not a thing, and offering it invites the one
  // mistake the server has to refuse.
  const others = useMemo(
    () => members.filter((m) => m.status === 'ACTIVE' && m.id !== myMemberId),
    [members, myMemberId],
  );

  const [direction, setDirection] = useState('LENT');
  const [counterparty, setCounterparty] = useState('');
  const [amount, setAmount] = useState('');
  const [loanDate, setLoanDate] = useState(today);
  const [dueDate, setDueDate] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState(null);
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);

  useEffect(() => {
    if (!open) return;
    // One token per opening, for the reason an expense wants one: a retry carrying a NEW key is
    // not a retry, it is a second loan.
    setIdempotencyKey(newIdempotencyKey());
    setError(null);
    setDirection('LENT');
    // Pre-picked when there is only one other person, which is the case in every direct ledger
    // -- the overwhelmingly common home for a loan.
    setCounterparty(others.length === 1 ? others[0].id : '');
    setAmount('');
    setLoanDate(today());
    setDueDate('');
    setNote('');
  }, [open, others]);

  const lent = direction === 'LENT';
  const them = others.find((m) => m.id === counterparty);

  const submit = () => {
    const payload = { counterpartyMemberId: counterparty, direction, amount, loanDate, dueDate, note };
    const parsed = loanSchema.safeParse(payload);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the details');
      return;
    }
    setError(null);
    onSubmit({
      counterpartyMemberId: counterparty,
      direction,
      amount,
      loanDate,
      dueDate: dueDate || null,
      note: note.trim() || null,
      idempotencyKey,
    });
  };

  return (
    <TallyFormDialog
      open={open}
      onClose={onClose}
      busy={busy}
      fullScreen={fullScreen}
      title={lent ? 'Money you lent' : 'Money you borrowed'}
      subtitle="Written down, not transferred — nothing here moves money"
      actions={(
        <>
          <TallyCancelButton onClick={onClose} disabled={busy} />
          <TallySubmitButton busy={busy} disabled={!counterparty || !amount} onClick={submit}>
            {lent ? 'Record the loan' : 'Record it'}
          </TallySubmitButton>
        </>
      )}
    >
      {/* The direction, first and as two words rather than a dropdown. It changes the meaning of
          every other field on the form, so it cannot be something the reader scrolls past. */}
      <ToggleButtonGroup
        exclusive
        fullWidth
        value={direction}
        onChange={(_, next) => next && setDirection(next)}
        sx={{
          '& .MuiToggleButton-root': {
            textTransform: 'none', fontWeight: 700, fontSize: 13.5, py: 1,
            color: T.textMuted, borderColor: T.border,
            '&.Mui-selected': {
              bgcolor: T.glassHover, color: T.textPrimary,
              '&:hover': { bgcolor: T.glassHover },
            },
          },
        }}
      >
        <ToggleButton value="LENT">I gave money</ToggleButton>
        <ToggleButton value="BORROWED">I took money</ToggleButton>
      </ToggleButtonGroup>

      <TextField
        select
        fullWidth
        value={counterparty}
        onChange={(e) => setCounterparty(e.target.value)}
        label={lent ? 'Who did you give it to?' : 'Who did you take it from?'}
        sx={tallyFieldSx(T)}
      >
        {others.length === 0 && (
          <MenuItem value="" disabled>Add somebody to this ledger first</MenuItem>
        )}
        {others.map((m) => (
          <MenuItem key={m.id} value={m.id}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <MemberAvatar member={m} size={24} />
              {m.displayName}
            </Box>
          </MenuItem>
        ))}
      </TextField>

      <TextField
        fullWidth
        value={amount}
        onChange={(e) => setAmount(sanitiseAmountInput(e.target.value))}
        placeholder="0.00"
        inputMode="decimal"
        aria-label="Amount"
        sx={tallyFieldSx(T)}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <CurrencyRupeeRoundedIcon sx={{ fontSize: 24, color: T.teal }} />
              </InputAdornment>
            ),
          },
        }}
      />

      {/* The sentence the form is building, so the direction can be checked without re-reading
          the toggle. This is the field people get wrong. */}
      {them && amount && (
        <Typography sx={{ fontSize: 13, color: T.textMuted, textAlign: 'center' }}>
          {lent
            ? `${them.displayName} will owe you ₹${amount}`
            : `You will owe ${them.displayName} ₹${amount}`}
        </Typography>
      )}

      <ExpenseDateField value={loanDate} onChange={setLoanDate} />

      <TextField
        fullWidth
        type="date"
        value={dueDate}
        onChange={(e) => setDueDate(e.target.value)}
        label="Pay back by (optional)"
        sx={tallyFieldSx(T)}
        slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: loanDate } }}
        helperText="Leave it empty if there is no agreed date"
      />

      <TextField
        fullWidth
        value={note}
        onChange={(e) => setNote(e.target.value)}
        label="What was it for? (optional)"
        sx={tallyFieldSx(T)}
      />

      {error && (
        <Typography sx={{ fontSize: 13, color: '#ef4444', fontWeight: 600 }}>{error}</Typography>
      )}
    </TallyFormDialog>
  );
}
