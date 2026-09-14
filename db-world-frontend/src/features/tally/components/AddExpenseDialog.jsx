import { useEffect, useMemo, useState } from 'react';
import {
  Box, Typography, TextField, InputAdornment, Collapse, Button,
  useMediaQuery, useTheme,
} from '@mui/material';
import CurrencyRupeeRoundedIcon from '@mui/icons-material/CurrencyRupeeRounded';
import CallSplitRoundedIcon from '@mui/icons-material/CallSplitRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import { useForm, Controller } from 'react-hook-form';
import { motion, AnimatePresence } from 'framer-motion';
import { useT } from '@shared/theme';
import { newIdempotencyKey } from '../api/tallyApi';
import { expenseSchema } from '../schemas/tallySchemas';
import { EXPENSE_CATEGORIES, SPLIT_METHODS, formatMoney } from '../utils/tallyFormat';
import { previewShares, sumAmounts, toPaise, fromPaise } from '../utils/tallyMath';
import {
  TallyFormDialog, TallySubmitButton, TallyCancelButton, tallyFieldSx,
  MemberAvatar, MemberToggleRow,
} from './tallyFormUi';

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Adding — or correcting — an expense.
 *
 * The screen is ordered the way the question is actually asked: how much, what for, who paid,
 * who it is for. Everything past that is folded away, because the overwhelming majority of
 * expenses are one payer splitting equally with everyone, and a form that makes you walk past
 * four splitting methods to record a ₹200 lunch does not get used.
 *
 * The preview underneath the split is the important part. It runs the same largest-remainder
 * allocator the server does, so what you are shown is what gets written — including the stray
 * paisa, which lands on the same person in both.
 */
export default function AddExpenseDialog({
  open, onClose, onSubmit, busy, members = [], myMemberId, editing = null,
}) {
  const T = useT();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  const active = useMemo(() => members.filter((m) => m.status === 'ACTIVE'), [members]);
  const nameOf = (id) => members.find((m) => m.id === id)?.displayName ?? 'Someone';
  const delegationOf = (id) => active.find((m) => m.id === id)?.paidForByMemberId ?? null;

  const { control, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm({
    defaultValues: {
      description: '', totalAmount: '', expenseDate: today(), category: '', notes: '',
    },
  });

  const [method, setMethod] = useState('EQUAL');
  const [payers, setPayers] = useState({});           // memberId -> amount string
  const [participants, setParticipants] = useState([]); // memberId[]
  const [weights, setWeights] = useState({});         // memberId -> string, meaning depends on method
  const [showSplit, setShowSplit] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);

  const totalAmount = watch('totalAmount');
  const category = watch('category');

  /* Reset every time the dialog opens, seeded either from the expense being corrected or from
     the sensible default: I paid, everybody splits it. */
  useEffect(() => {
    if (!open) return;
    // A fresh retry token per opening, not per request: a resend of the SAME submit has to
    // carry the same key, or it is not a retry, it is a second expense.
    setIdempotencyKey(newIdempotencyKey());

    if (editing) {
      reset({
        description: editing.description ?? '',
        totalAmount: String(editing.totalAmount ?? ''),
        expenseDate: editing.expenseDate ?? today(),
        category: editing.category ?? '',
        notes: editing.notes ?? '',
      });
      setMethod(editing.divisionMethod ?? 'EQUAL');
      setPayers(Object.fromEntries((editing.payers ?? []).map((p) => [p.memberId, String(p.amount)])));
      setParticipants((editing.shares ?? []).map((s) => s.beneficiaryMemberId));
      setWeights(Object.fromEntries((editing.shares ?? []).map((s) => [
        s.beneficiaryMemberId,
        String(editing.divisionMethod === 'PERCENT' ? (s.sharePercent ?? '')
          : editing.divisionMethod === 'SHARES' ? (s.shareWeight ?? '')
            : s.amount),
      ])));
      setShowSplit(true);
      return;
    }

    reset({ description: '', totalAmount: '', expenseDate: today(), category: '', notes: '' });
    setMethod('EQUAL');
    setPayers(myMemberId ? { [myMemberId]: '' } : {});
    setParticipants(active.map((m) => m.id));
    setWeights({});
    setShowSplit(false);
  }, [open, editing, reset, myMemberId, active]);

  /* A single payer's amount always equals the total, so it is kept in step rather than asked
     for twice. Only when the bill is genuinely split across payers does it become a field. */
  const payerIds = Object.keys(payers);
  const singlePayer = payerIds.length === 1;
  useEffect(() => {
    if (singlePayer && totalAmount) setPayers((p) => ({ ...p, [payerIds[0]]: totalAmount }));
  }, [totalAmount, singlePayer, payerIds[0]]);   // eslint-disable-line react-hooks/exhaustive-deps

  const participantRows = participants.map((memberId) => ({
    memberId,
    exactAmount: method === 'EXACT' ? (weights[memberId] ?? '') : undefined,
    percent: method === 'PERCENT' ? (weights[memberId] ?? '') : undefined,
    shareWeight: method === 'SHARES' ? (weights[memberId] ?? '1') : undefined,
  }));

  /* The preview. Guarded because the allocator throws on nonsense, and half-typed input is
     nonsense for as long as somebody is typing it. */
  const preview = useMemo(() => {
    try {
      if (!totalAmount || !participants.length) return [];
      return previewShares({
        total: totalAmount, method, participants: participantRows, delegationOf,
      });
    } catch {
      return [];
    }
  }, [totalAmount, method, JSON.stringify(participantRows)]);   // eslint-disable-line react-hooks/exhaustive-deps

  const payerTotal = sumAmounts(Object.values(payers));
  const payersMatch = (() => {
    try { return toPaise(payerTotal) === toPaise(totalAmount || '0'); } catch { return false; }
  })();
  const exactRemainder = (() => {
    if (method !== 'EXACT') return null;
    try {
      return fromPaise(toPaise(totalAmount || '0') - toPaise(sumAmounts(Object.values(weights))));
    } catch { return null; }
  })();
  const percentTotal = method === 'PERCENT'
    ? participants.reduce((sum, id) => sum + Number(weights[id] || 0), 0)
    : null;

  const blocker = (() => {
    if (!participants.length) return 'Pick at least one person to split this with';
    if (!payerIds.length) return 'Somebody has to have paid';
    if (!payersMatch) return `The payments add up to ${formatMoney(payerTotal)}, not ${formatMoney(totalAmount || 0)}`;
    if (method === 'EXACT' && exactRemainder && toPaise(exactRemainder) !== 0n) {
      return Number(exactRemainder) > 0
        ? `${formatMoney(exactRemainder)} still unaccounted for`
        : `${formatMoney(-Number(exactRemainder))} over the total`;
    }
    if (method === 'PERCENT' && Math.abs(percentTotal - 100) > 0.0001) {
      return `Percentages add up to ${percentTotal || 0}%, not 100%`;
    }
    return null;
  })();

  const submit = handleSubmit((values) => {
    const payload = {
      description: values.description.trim(),
      totalAmount: values.totalAmount,
      divisionMethod: method,
      category: values.category || null,
      expenseDate: values.expenseDate,
      notes: values.notes?.trim() || null,
      idempotencyKey,
      payers: payerIds.map((memberId) => ({ memberId, amount: payers[memberId] })),
      participants: participantRows.map((p) => ({
        memberId: p.memberId,
        exactAmount: p.exactAmount || null,
        percent: p.percent || null,
        shareWeight: p.shareWeight || null,
        // Sent resolved. The server only fills in the standing default when the field is
        // absent, and leaving it out would silently re-resolve a delegation the preview has
        // already shown the user.
        owedByMemberId: preview.find((r) => r.memberId === p.memberId)?.owedByMemberId ?? p.memberId,
      })),
    };

    const parsed = expenseSchema.safeParse(payload);
    if (!parsed.success) return;   // the field-level messages are already on screen
    onSubmit(payload);
  });

  return (
    <TallyFormDialog
      open={open}
      onClose={onClose}
      busy={busy}
      fullScreen={fullScreen}
      title={editing ? 'Correct this expense' : 'Add an expense'}
      subtitle={editing
        ? 'The original is kept and marked corrected, so the history stays honest'
        : undefined}
      actions={(
        <>
          <TallyCancelButton onClick={onClose} disabled={busy} />
          <TallySubmitButton busy={busy} disabled={Boolean(blocker)} onClick={submit}>
            {editing ? 'Save correction' : 'Add expense'}
          </TallySubmitButton>
        </>
      )}
    >
      <Box component="form" onSubmit={submit} sx={{ display: 'flex', flexDirection: 'column', gap: 2.25 }}>

        {/* ── How much ─────────────────────────────────────────────────── */}
        <Controller
          name="totalAmount"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              autoFocus
              fullWidth
              placeholder="0.00"
              inputMode="decimal"
              aria-label="Amount"
              error={Boolean(errors.totalAmount)}
              helperText={errors.totalAmount?.message}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <CurrencyRupeeRoundedIcon sx={{ fontSize: 26, color: T.teal }} />
                    </InputAdornment>
                  ),
                  sx: { fontSize: 32, fontWeight: 800, letterSpacing: -1 },
                },
              }}
              sx={{
                ...tallyFieldSx(T),
                '& .MuiInputBase-input': { fontSize: 32, fontWeight: 800, color: T.textPrimary, py: 1.5 },
              }}
            />
          )}
        />

        <Controller
          name="description"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              fullWidth
              label="What was it for?"
              placeholder="Groceries"
              error={Boolean(errors.description)}
              helperText={errors.description?.message}
              sx={tallyFieldSx(T)}
            />
          )}
        />

        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: { xs: 'wrap', sm: 'nowrap' } }}>
          <Controller
            name="expenseDate"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                type="date"
                label="When"
                sx={{ ...tallyFieldSx(T), flex: 1, minWidth: 150 }}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            )}
          />
        </Box>

        {/* ── Category ─────────────────────────────────────────────────── */}
        <Box>
          <FieldLabel>Category</FieldLabel>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            {EXPENSE_CATEGORIES.map(({ value, emoji }) => {
              const selected = category === value;
              return (
                <Box
                  key={value}
                  component={motion.button}
                  type="button"
                  whileTap={{ scale: 0.94 }}
                  onClick={() => setValue('category', selected ? '' : value)}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 0.6,
                    px: 1.25, py: 0.6, borderRadius: 999, cursor: 'pointer',
                    fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit',
                    bgcolor: selected ? T.tealBg : T.glass,
                    color: selected ? T.teal : T.textMuted,
                    border: `1px solid ${selected ? T.glassBorderHover : T.border}`,
                    transition: 'all .15s ease',
                  }}
                >
                  <span aria-hidden>{emoji}</span>{value}
                </Box>
              );
            })}
          </Box>
        </Box>

        {/* ── Who paid ─────────────────────────────────────────────────── */}
        <Box>
          <FieldLabel>Who paid?</FieldLabel>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            {active.map((member) => {
              const selected = member.id in payers;
              return (
                <Box
                  key={member.id}
                  component={motion.button}
                  type="button"
                  whileTap={{ scale: 0.94 }}
                  onClick={() => setPayers((prev) => {
                    // Tapping a different single payer replaces rather than adds: one payer is
                    // the normal case, and "multiple" is opt-in through the button below.
                    if (member.id in prev) {
                      const { [member.id]: _drop, ...rest } = prev;
                      return Object.keys(rest).length ? rest : prev;
                    }
                    return singlePayer
                      ? { [member.id]: totalAmount ?? '' }
                      : { ...prev, [member.id]: '' };
                  })}
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

          <Collapse in={!singlePayer}>
            <Box sx={{ mt: 1.25, display: 'flex', flexDirection: 'column', gap: 1 }}>
              {payerIds.map((memberId) => (
                <Box key={memberId} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography sx={{ fontSize: 13, color: T.textMuted, flex: 1, minWidth: 0 }} noWrap>
                    {nameOf(memberId)} paid
                  </Typography>
                  <TextField
                    size="small"
                    inputMode="decimal"
                    value={payers[memberId] ?? ''}
                    onChange={(e) => setPayers((p) => ({ ...p, [memberId]: e.target.value }))}
                    sx={{ ...tallyFieldSx(T), width: 118 }}
                    slotProps={{ input: { startAdornment: <InputAdornment position="start">₹</InputAdornment> } }}
                  />
                </Box>
              ))}
              <Hint tone={payersMatch ? 'ok' : 'warn'}>
                {payersMatch
                  ? `Payments add up to ${formatMoney(payerTotal)}`
                  : `Payments add up to ${formatMoney(payerTotal)} — the expense is ${formatMoney(totalAmount || 0)}`}
              </Hint>
            </Box>
          </Collapse>
        </Box>

        {/* ── How to split ─────────────────────────────────────────────── */}
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
            <FieldLabel sx={{ mb: 0 }}>
              Split between {participants.length} of {active.length}
            </FieldLabel>
            <Button
              size="small"
              onClick={() => setShowSplit((s) => !s)}
              startIcon={<CallSplitRoundedIcon sx={{ fontSize: 16 }} />}
              sx={{ textTransform: 'none', fontSize: 12.5, fontWeight: 700, color: T.teal }}
            >
              {showSplit ? 'Done' : 'Change'}
            </Button>
          </Box>

          {/* Closed by default: equally between everyone is what almost every expense is, and
              the summary line below already says so in words. */}
          <Collapse in={showSplit}>
            <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 1.25 }}>
              {SPLIT_METHODS.map((m) => {
                const selected = method === m.value;
                return (
                  <Box
                    key={m.value}
                    component={motion.button}
                    type="button"
                    whileTap={{ scale: 0.94 }}
                    onClick={() => { setMethod(m.value); setWeights({}); }}
                    title={m.hint}
                    sx={{
                      px: 1.4, py: 0.6, borderRadius: 2, cursor: 'pointer',
                      fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit',
                      bgcolor: selected ? T.teal : T.glass,
                      color: selected ? '#fff' : T.textMuted,
                      border: `1px solid ${selected ? T.teal : T.border}`,
                      transition: 'all .15s ease',
                    }}
                  >
                    {m.label}
                  </Box>
                );
              })}
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
              {active.map((member) => {
                const included = participants.includes(member.id);
                const share = preview.find((p) => p.memberId === member.id);
                const paidFor = delegationOf(member.id);
                return (
                  <MemberToggleRow
                    key={member.id}
                    member={member}
                    selected={included}
                    subtitle={paidFor ? `${nameOf(paidFor)} pays for them` : undefined}
                    onToggle={() => setParticipants((prev) => (
                      included ? prev.filter((id) => id !== member.id) : [...prev, member.id]
                    ))}
                    trailing={included && method !== 'EQUAL' ? (
                      <TextField
                        size="small"
                        inputMode="decimal"
                        value={weights[member.id] ?? (method === 'SHARES' ? '1' : '')}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setWeights((w) => ({ ...w, [member.id]: e.target.value }))}
                        sx={{ ...tallyFieldSx(T), width: method === 'SHARES' ? 74 : 104 }}
                        slotProps={{
                          input: {
                            startAdornment: method === 'EXACT'
                              ? <InputAdornment position="start">₹</InputAdornment> : null,
                            endAdornment: method === 'PERCENT'
                              ? <InputAdornment position="end">%</InputAdornment> : null,
                          },
                        }}
                      />
                    ) : (
                      <Typography sx={{
                        fontSize: 13.5, fontWeight: 700, minWidth: 62, textAlign: 'right',
                        color: included ? T.textPrimary : T.textMuted,
                      }}>
                        {included && share ? formatMoney(share.amount) : '—'}
                      </Typography>
                    )}
                  />
                );
              })}
            </Box>
          </Collapse>

          {/* ── Live preview ───────────────────────────────────────────── */}
          <AnimatePresence mode="wait">
            {preview.length > 0 && (
              <Box
                key={`${method}-${preview.length}`}
                component={motion.div}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.22 }}
                sx={{ overflow: 'hidden', mt: 1.25 }}
              >
                <Box sx={{
                  p: 1.5, borderRadius: 2.5,
                  bgcolor: T.glass, border: `1px solid ${T.border}`,
                }}>
                  <Typography sx={{ fontSize: 11.5, fontWeight: 800, color: T.textMuted, mb: 0.9 }}>
                    WHO ENDS UP OWING WHAT
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.6 }}>
                    {preview.map((row) => {
                      const delegated = row.owedByMemberId !== row.memberId;
                      return (
                        <Box key={row.memberId} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography noWrap sx={{ fontSize: 13, color: T.textMuted, flex: 1 }}>
                            {nameOf(row.memberId)}
                            {delegated && (
                              <Box component="span" sx={{ color: T.teal, fontWeight: 600 }}>
                                {` → ${nameOf(row.owedByMemberId)} pays`}
                              </Box>
                            )}
                          </Typography>
                          <Typography sx={{ fontSize: 13, fontWeight: 700, color: T.textPrimary }}>
                            {formatMoney(row.amount)}
                          </Typography>
                        </Box>
                      );
                    })}
                  </Box>
                </Box>
              </Box>
            )}
          </AnimatePresence>
        </Box>

        {/* One clear reason the button is disabled, rather than silent refusal. */}
        <AnimatePresence>
          {blocker && (
            <Box
              component={motion.div}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}
            >
              <WarningAmberRoundedIcon sx={{ fontSize: 16, color: '#f59e0b' }} />
              <Typography sx={{ fontSize: 12.5, color: '#f59e0b', fontWeight: 600 }}>
                {blocker}
              </Typography>
            </Box>
          )}
        </AnimatePresence>
      </Box>
    </TallyFormDialog>
  );
}

function FieldLabel({ children, sx }) {
  const T = useT();
  return (
    <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: T.textMuted, mb: 1, ...sx }}>
      {children}
    </Typography>
  );
}

function Hint({ tone, children }) {
  const T = useT();
  const color = tone === 'ok' ? T.teal : '#f59e0b';
  const Icon = tone === 'ok' ? CheckRoundedIcon : WarningAmberRoundedIcon;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
      <Icon sx={{ fontSize: 15, color }} />
      <Typography sx={{ fontSize: 12, color, fontWeight: 600 }}>{children}</Typography>
    </Box>
  );
}
