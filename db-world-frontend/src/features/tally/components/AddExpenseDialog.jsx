import { useEffect, useMemo, useState } from 'react';
import {
  Box, Typography, TextField, InputAdornment, Collapse, Button,
  useMediaQuery, useTheme,
} from '@mui/material';
import CurrencyRupeeRoundedIcon from '@mui/icons-material/CurrencyRupeeRounded';
import CallSplitRoundedIcon from '@mui/icons-material/CallSplitRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import { useForm, Controller } from 'react-hook-form';
import { motion, AnimatePresence } from 'framer-motion';
import { useT } from '@shared/theme';
import { newIdempotencyKey } from '../api/tallyApi';
import { expenseSchema } from '../schemas/tallySchemas';
import { formatMoney } from '../utils/tallyFormat';
import {
  previewShares, sumAmounts, toPaise, fromPaise, redistribute,
} from '../utils/tallyMath';
import {
  TallyFormDialog, TallySubmitButton, TallyCancelButton, tallyFieldSx,
} from './tallyFormUi';
import CategoryPicker from './CategoryPicker';
import ExpenseDateField from './ExpenseDateField';
import PayerPicker from './PayerPicker';
import SplitEditor from './SplitEditor';

const today = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/**
 * Adding — or correcting — an expense.
 *
 * Ordered the way the question is actually asked: how much, what for, when, who paid, who it
 * is for. The splitting controls stay folded away, because almost every expense is one person
 * paying and everybody splitting evenly, and a form that walks you past four division methods
 * to record a ₹200 lunch does not get used twice.
 *
 * The preview under the split runs the same largest-remainder allocator the server does, so
 * what you are shown is what gets written — including which person absorbs the stray paisa.
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
    defaultValues: { description: '', totalAmount: '', expenseDate: today(), category: '' },
  });

  const [method, setMethod] = useState('EQUAL');
  const [payers, setPayers] = useState({});             // memberId -> amount string
  const [multiPayer, setMultiPayer] = useState(false);
  const [participants, setParticipants] = useState([]); // memberId[]
  const [weights, setWeights] = useState({});           // ONLY what the user typed
  const [showSplit, setShowSplit] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);
  const [schemaError, setSchemaError] = useState(null);

  const totalAmount = watch('totalAmount');
  const category = watch('category');

  useEffect(() => {
    if (!open) return;
    // One retry token per opening, not per request: a resend of the SAME submit must carry the
    // same key, or it is not a retry, it is a second expense.
    setIdempotencyKey(newIdempotencyKey());
    setSchemaError(null);

    if (editing) {
      reset({
        description: editing.description ?? '',
        totalAmount: String(editing.totalAmount ?? ''),
        expenseDate: editing.expenseDate ?? today(),
        category: editing.category ?? '',
      });
      setMethod(editing.divisionMethod ?? 'EQUAL');
      setPayers(Object.fromEntries((editing.payers ?? []).map((p) => [p.memberId, String(p.amount)])));
      setMultiPayer((editing.payers ?? []).length > 1);
      setParticipants((editing.shares ?? []).map((s) => s.beneficiaryMemberId));
      // Every field counts as typed when correcting: the saved expense is somebody's decision,
      // not a suggestion to re-balance out from under them.
      setWeights(Object.fromEntries((editing.shares ?? []).map((s) => [
        s.beneficiaryMemberId,
        String(editing.divisionMethod === 'PERCENT' ? (s.sharePercent ?? '')
          : editing.divisionMethod === 'SHARES' ? (s.shareWeight ?? '')
            : s.amount),
      ])));
      setShowSplit(true);
      return;
    }

    reset({ description: '', totalAmount: '', expenseDate: today(), category: '' });
    setMethod('EQUAL');
    setPayers(myMemberId ? { [myMemberId]: '' } : {});
    setMultiPayer(false);
    setParticipants(active.map((m) => m.id));
    setWeights({});
    setShowSplit(false);
  }, [open, editing, reset, myMemberId, active]);

  /* With one payer the amount is the total. Keeping it in step here rather than asking for it
     means one less number to type, and one less way for the two to disagree. */
  const payerIds = Object.keys(payers);
  useEffect(() => {
    if (!multiPayer && payerIds.length === 1 && totalAmount) {
      setPayers((p) => ({ ...p, [payerIds[0]]: totalAmount }));
    }
  }, [totalAmount, multiPayer, payerIds.length, payerIds[0]]);   // eslint-disable-line react-hooks/exhaustive-deps

  /* ── The split, derived rather than stored ──────────────────────────────
     `weights` holds only the fields somebody typed into. Everything shown is computed here,
     so an untouched field always absorbs the remainder and a typed one is never rewritten. */
  const isBalanced = method === 'EXACT' || method === 'PERCENT';
  const locked = useMemo(() => new Set(Object.keys(weights)), [weights]);
  const balanced = useMemo(() => (isBalanced
    ? redistribute({
      total: method === 'PERCENT' ? '100' : (totalAmount || '0'),
      memberIds: participants,
      locked,
      values: weights,
    })
    : { values: weights, remainder: '0.00', over: false }
  ), [isBalanced, method, totalAmount, participants, locked, weights]);

  const participantRows = participants.map((memberId) => ({
    memberId,
    exactAmount: method === 'EXACT' ? (balanced.values[memberId] ?? '') : undefined,
    percent: method === 'PERCENT' ? (balanced.values[memberId] ?? '') : undefined,
    shareWeight: method === 'SHARES' ? (weights[memberId] ?? '1') : undefined,
  }));

  const preview = useMemo(() => {
    try {
      if (!totalAmount || !participants.length) return [];
      return previewShares({ total: totalAmount, method, participants: participantRows, delegationOf });
    } catch {
      return [];   // half-typed input is not an error yet, it is just not a number
    }
  }, [totalAmount, method, JSON.stringify(participantRows)]);   // eslint-disable-line react-hooks/exhaustive-deps

  const remainderNote = (() => {
    if (!isBalanced) return null;
    let left;
    try { left = toPaise(balanced.remainder); } catch { return null; }
    if (left === 0n) return null;
    const abs = fromPaise(left < 0n ? -left : left);
    const pretty = method === 'PERCENT' ? `${abs}%` : formatMoney(abs);
    return left > 0n ? `${pretty} still unassigned` : `${pretty} over`;
  })();

  const payerTotal = sumAmounts(Object.values(payers));
  const payersMatch = (() => {
    try { return toPaise(payerTotal) === toPaise(totalAmount || '0'); } catch { return false; }
  })();

  const blocker = (() => {
    if (!totalAmount) return null;   // nothing typed yet; not an error, just not ready
    if (!participants.length) return 'Pick at least one person to split this with';
    if (!payerIds.length) return 'Somebody has to have paid';
    if (!payersMatch) {
      return `The payments add up to ${formatMoney(payerTotal)}, not ${formatMoney(totalAmount)}`;
    }
    if (remainderNote) return remainderNote;
    return null;
  })();

  const submit = handleSubmit((values) => {
    const payload = {
      description: values.description.trim(),
      totalAmount: values.totalAmount,
      divisionMethod: method,
      category: values.category || null,
      expenseDate: values.expenseDate,
      notes: null,
      idempotencyKey,
      payers: payerIds.map((memberId) => ({ memberId, amount: payers[memberId] })),
      participants: participantRows.map((p) => ({
        memberId: p.memberId,
        exactAmount: p.exactAmount ?? null,
        percent: p.percent ?? null,
        shareWeight: p.shareWeight ?? null,
        // Sent resolved: the server only fills the standing default when the field is absent,
        // and omitting it would re-resolve a delegation the preview has already shown.
        owedByMemberId: preview.find((r) => r.memberId === p.memberId)?.owedByMemberId ?? p.memberId,
      })),
    };

    const parsed = expenseSchema.safeParse(payload);
    if (!parsed.success) {
      // NEVER return silently here. This used to, on the assumption that field-level errors
      // were already rendered -- they were not, because this form has no zod resolver, so a
      // rejected payload produced a button that did nothing and said nothing at all. If
      // validation refuses something the on-screen checks let through, that is a bug in those
      // checks, and the only way anyone finds out is if it is said out loud.
      const issue = parsed.error.issues[0];
      setSchemaError((issue?.message ?? 'Something here is not valid')
        + (issue?.path?.length ? ` (${issue.path.join('.')})` : ''));
      return;
    }
    setSchemaError(null);
    onSubmit(payload);
  });

  const splitSummary = (() => {
    if (!participants.length) return 'nobody yet';
    const who = participants.length === active.length
      ? 'everyone'
      : `${participants.length} of ${active.length}`;
    const how = method === 'EQUAL' ? 'evenly' : `by ${method.toLowerCase()}`;
    return `${who}, ${how}`;
  })();

  return (
    <TallyFormDialog
      open={open}
      onClose={onClose}
      busy={busy}
      fullScreen={fullScreen}
      title={editing ? 'Correct this expense' : 'Add an expense'}
      subtitle={editing ? 'The original is kept and marked corrected' : undefined}
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

        <Controller
          name="expenseDate"
          control={control}
          render={({ field }) => (
            <ExpenseDateField value={field.value} onChange={field.onChange} />
          )}
        />

        <CategoryPicker value={category} onChange={(v) => setValue('category', v)} />

        <PayerPicker
          members={active}
          myMemberId={myMemberId}
          payers={payers}
          onChange={setPayers}
          totalAmount={totalAmount}
          multi={multiPayer}
          onToggleMulti={setMultiPayer}
        />

        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: T.textMuted }}>
                Split between
              </Typography>
              {!showSplit && (
                <Typography noWrap sx={{ fontSize: 13, color: T.textPrimary, fontWeight: 600 }}>
                  {splitSummary}
                </Typography>
              )}
            </Box>
            <Button
              size="small"
              onClick={() => setShowSplit((s) => !s)}
              startIcon={<CallSplitRoundedIcon sx={{ fontSize: 16 }} />}
              sx={{ textTransform: 'none', fontSize: 12.5, fontWeight: 700, color: T.teal }}
            >
              {showSplit ? 'Done' : 'Change'}
            </Button>
          </Box>

          <Collapse in={showSplit}>
            <Box sx={{ mt: 1 }}>
              <SplitEditor
                method={method}
                onMethodChange={setMethod}
                members={active}
                participants={participants}
                onParticipantsChange={setParticipants}
                weights={weights}
                onWeightsChange={setWeights}
                effective={balanced.values}
                locked={locked}
                remainderNote={remainderNote}
                over={balanced.over}
                preview={preview}
                nameOf={nameOf}
                delegationOf={delegationOf}
              />
            </Box>
          </Collapse>

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
                <Box sx={{ p: 1.5, borderRadius: 2.5, bgcolor: T.glass, border: `1px solid ${T.border}` }}>
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

        <AnimatePresence>
          {(blocker || schemaError) && (
            <Box
              component={motion.div}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}
            >
              <WarningAmberRoundedIcon sx={{ fontSize: 16, color: '#f59e0b' }} />
              <Typography sx={{ fontSize: 12.5, color: '#f59e0b', fontWeight: 600 }}>
                {blocker ?? schemaError}
              </Typography>
            </Box>
          )}
        </AnimatePresence>
      </Box>
    </TallyFormDialog>
  );
}
