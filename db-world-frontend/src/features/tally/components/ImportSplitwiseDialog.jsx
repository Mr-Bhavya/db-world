import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Box, Chip, CircularProgress, TextField, Typography,
} from '@mui/material';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import { useT } from '@shared/theme';
import { notify } from '@shared/notify';
import { usePreviewSplitwise, useImportSplitwise } from '../hooks/useTally';
import { formatMoney, balanceTone, GROUP_CATEGORIES } from '../utils/tallyFormat';
import IconSheet from './IconSheet';
import {
  TallyFormDialog, TallyFormSection, TallySubmitButton, TallyCancelButton, tallyFieldSx,
} from './tallyFormUi';
import SplitwisePersonRow from './SplitwisePersonRow';

/** Splitwise exports are a few kilobytes; anything this size is not one. */
const MAX_BYTES = 1_000_000;

/**
 * Bringing an existing Splitwise group across.
 *
 * <p>Two steps, because the file cannot answer the one question that matters. Its columns are
 * names — no emails, no ids — so somebody has to say who each person is, and getting that wrong
 * would put real debts on the wrong account in a ledger that cannot be edited afterwards. So the
 * file is read first and nothing is written until the names are settled.
 *
 * <p>The preview deliberately shows the boring numbers too — how many expenses, over what dates,
 * what each person paid and used, and where the export says they ended up. Those are what you
 * check against the Splitwise app before committing, and the last of them is what the server
 * reconciles against.
 */
export default function ImportSplitwiseDialog({ open, onClose, onImported }) {
  const T = useT();
  const fileInput = useRef(null);

  const [csv, setCsv] = useState('');
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState(null);
  const [groupName, setGroupName] = useState('');
  const [icon, setIcon] = useState('');
  const [pickingIcon, setPickingIcon] = useState(false);
  const [category, setCategory] = useState('Trip');
  /** csvName -> { userId, displayName }. A missing entry means "not chosen yet". */
  const [people, setPeople] = useState({});

  const readFile = usePreviewSplitwise();
  const runImport = useImportSplitwise();

  // Seeded from an effect rather than useState's initial value, which is only read once and
  // would show the previous file's numbers the second time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setCsv(''); setFileName(''); setPreview(null);
    setGroupName(''); setIcon(''); setCategory('Trip'); setPeople({});
  }, [open]);

  const pick = (event) => {
    const file = event.target.files?.[0];
    // Reset first, so choosing the same file twice after an error still fires a change event.
    event.target.value = '';
    if (!file) return;

    if (file.size > MAX_BYTES) {
      notify.error('That file is too large to be a Splitwise export.');
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => notify.error('Could not read that file.');
    reader.onload = () => {
      const text = String(reader.result ?? '');
      setCsv(text);
      setFileName(file.name);
      readFile.mutate(text, {
        onSuccess: (result) => {
          setPreview(result);
          // A trip export is usually named after the trip, so the file name is a better first
          // guess than an empty box -- and it is still a guess, so it stays editable.
          setGroupName(file.name.replace(/\.csv$/i, '').replace(/[_-]+/g, ' ').trim());
        },
        onError: () => { setCsv(''); setFileName(''); },
      });
    };
    reader.readAsText(file);
  };

  const unchosen = useMemo(
    () => (preview?.people ?? []).filter((p) => !people[p.name]).map((p) => p.name),
    [preview, people],
  );

  const claimedTwice = useMemo(() => {
    const ids = Object.values(people).map((p) => p.userId).filter(Boolean);
    return ids.length !== new Set(ids).size;
  }, [people]);

  const canImport = preview && groupName.trim() && unchosen.length === 0 && !claimedTwice;

  const submit = () => {
    runImport.mutate({
      csv,
      groupName: groupName.trim(),
      groupCategory: category || null,
      icon: icon || null,
      people: preview.people.map((p) => ({
        csvName: p.name,
        userId: people[p.name]?.userId ?? null,
        displayName: people[p.name]?.displayName ?? p.name,
      })),
    }, {
      onSuccess: (result) => {
        onClose();
        onImported?.(result);
      },
    });
  };

  const busy = readFile.isPending || runImport.isPending;

  return (
    <TallyFormDialog
      open={open}
      onClose={onClose}
      title="Import from Splitwise"
      subtitle={preview
        ? 'Check the numbers, then say who everybody is'
        : 'Export a group from Splitwise as a spreadsheet, then choose the file'}
      busy={busy}
      maxWidth="sm"
      actions={preview ? (
        <>
          <TallyCancelButton onClick={onClose} disabled={busy} />
          <TallySubmitButton onClick={submit} busy={runImport.isPending} disabled={!canImport}>
            Import
          </TallySubmitButton>
        </>
      ) : (
        <TallyCancelButton onClick={onClose} disabled={busy}>Close</TallyCancelButton>
      )}
    >
      {!preview ? (
        <PickFile T={T} onPick={() => fileInput.current?.click()} busy={readFile.isPending} />
      ) : (
        <>
          <Summary preview={preview} fileName={fileName} T={T} />

          {preview.warnings?.length > 0 && (
            <Alert
              severity="warning"
              icon={<WarningAmberRoundedIcon fontSize="small" />}
              sx={{
                mb: 2, borderRadius: 2.5, fontSize: 13,
                bgcolor: T.warningBg, color: T.textPrimary,
                border: `1px solid ${T.border}`,
                '& .MuiAlert-icon': { color: T.warning },
              }}
            >
              {preview.warnings.map((w) => <Box key={w} sx={{ mb: 0.5 }}>{w}</Box>)}
            </Alert>
          )}

          {/* Cards rather than rules between the steps. A divider says "something else starts
              here"; it does not say what, and on a phone the heading it belongs to has usually
              scrolled past by the time the rows below it need explaining. */}
          <TallyFormSection title="Who is who">
          <Typography sx={{ fontSize: 12.5, color: T.textMuted, mb: 1.5 }}>
            Match each name to a db-world account, or leave it as a name for somebody without one.
            Include yourself.
          </Typography>

          {preview.people.map((person) => (
            <SplitwisePersonRow
              key={person.name}
              person={person}
              value={people[person.name]}
              onChange={(next) => setPeople((prev) => ({ ...prev, [person.name]: next }))}
            />
          ))}

          {claimedTwice && (
            <Typography sx={{ fontSize: 12.5, color: T.error, mt: 1 }}>
              Two of these are the same account. Each column has to be a different person.
            </Typography>
          )}

          </TallyFormSection>

          <Box sx={{ height: 12 }} />

          <TallyFormSection title="The group">
          <TextField
            label="Group name"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            fullWidth
            size="small"
            sx={{ ...tallyFieldSx(T), mb: 1.5 }}
          />

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 1.5 }}>
            {GROUP_CATEGORIES.map((c) => (
              <Chip
                key={c}
                label={c}
                size="small"
                onClick={() => setCategory(c)}
                sx={{
                  fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  bgcolor: category === c ? T.tealBg : T.glass,
                  color: category === c ? T.teal : T.textMuted,
                  border: `1px solid ${category === c ? T.glassBorderHover : T.border}`,
                }}
              />
            ))}
          </Box>

          {/* The first twelve of twenty-four used to be laid out here, which meant the other
              twelve were unreachable from this screen for no reason anybody could see. */}
          <Box
            component="button"
            type="button"
            onClick={() => setPickingIcon(true)}
            aria-label="Choose an icon"
            sx={{
              display: 'flex', alignItems: 'center', gap: 1,
              px: 1, py: 0.6, borderRadius: 2, cursor: 'pointer', fontFamily: 'inherit',
              bgcolor: T.glass, border: `1px solid ${T.border}`,
            }}
          >
            <Box aria-hidden sx={{ fontSize: 19, lineHeight: 1 }}>{icon || '👥'}</Box>
            <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: T.teal }}>
              Choose an icon
            </Typography>
          </Box>

          <IconSheet
            open={pickingIcon}
            value={icon}
            onClose={() => setPickingIcon(false)}
            onPick={(emoji) => { setIcon(emoji); setPickingIcon(false); }}
          />
          <Typography sx={{ fontSize: 11.5, color: T.textFaint, mt: 0.75 }}>
            Leave the icon blank and one will be picked from the name.
          </Typography>
          </TallyFormSection>
        </>
      )}

      {/* Hidden, triggered by the styled button -- the same shape the wallet uses. */}
      <input
        ref={fileInput}
        type="file"
        accept=".csv,text/csv"
        onChange={pick}
        style={{ display: 'none' }}
      />
    </TallyFormDialog>
  );
}

/* ============================== pieces ============================== */

function PickFile({ T, onPick, busy }) {
  return (
    <Box
      onClick={busy ? undefined : onPick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (!busy && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onPick(); } }}
      sx={{
        textAlign: 'center', py: 5, px: 3, borderRadius: 3.5, cursor: busy ? 'default' : 'pointer',
        bgcolor: T.glass, border: `1px dashed ${T.glassBorder}`,
        '&:hover': { borderColor: T.glassBorderHover },
        '&:focus-visible': { outline: `2px solid ${T.teal}`, outlineOffset: 2 },
      }}
    >
      {busy ? (
        <CircularProgress size={28} sx={{ color: T.teal, mb: 1 }} />
      ) : (
        <UploadFileRoundedIcon sx={{ fontSize: 34, color: T.teal, mb: 1 }} />
      )}
      <Typography sx={{ fontSize: 15, fontWeight: 700, color: T.textPrimary, mb: 0.5 }}>
        {busy ? 'Reading the file…' : 'Choose a Splitwise export'}
      </Typography>
      <Typography sx={{ fontSize: 13, color: T.textMuted }}>
        In Splitwise, open the group and use <b>Export as spreadsheet</b>. Nothing is saved until
        you have checked it.
      </Typography>
    </Box>
  );
}

/**
 * What the file contains, in the terms somebody can check against the Splitwise app.
 *
 * <p>The closing balance is the important column: it is what the server reconciles the import
 * against, and if it does not look right here then the file is not what you think it is.
 */
function Summary({ preview, fileName, T }) {
  return (
    <Box sx={{ mb: 2 }}>
      <Typography noWrap sx={{ fontSize: 12.5, color: T.textFaint, mb: 1 }}>{fileName}</Typography>

      <Box sx={{
        display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1.5,
        p: 1.5, borderRadius: 2.5, bgcolor: T.tealBg, border: `1px solid ${T.glassBorder}`,
      }}>
        <Stat label="Expenses" value={preview.expenseCount} T={T} />
        <Stat label="Payments" value={preview.paymentCount} T={T} />
        <Stat label="Total spent" value={formatMoney(preview.totalSpend)} T={T} />
      </Box>

      <Typography sx={{ fontSize: 12.5, color: T.textMuted, mb: 1.5 }}>
        {preview.firstDate} to {preview.lastDate}
        {preview.inferredRows > 0 && (
          <> · {preview.inferredRows} row{preview.inferredRows === 1 ? '' : 's'} had several payers</>
        )}
      </Typography>

      {preview.people.map((person) => {
        const tone = balanceTone(person.closingBalance);
        return (
          <Box key={person.name} sx={{
            display: 'flex', alignItems: 'baseline', gap: 1, py: 0.35,
          }}>
            <Typography noWrap sx={{ fontSize: 13, color: T.textPrimary, flex: 1, minWidth: 0 }}>
              {person.name}
            </Typography>
            <Typography sx={{ fontSize: 12, color: T.textFaint, whiteSpace: 'nowrap' }}>
              paid {formatMoney(person.paid)} · used {formatMoney(person.consumed)}
            </Typography>
            {person.closingBalance != null && (
              <Typography sx={{
                fontSize: 12.5, fontWeight: 800, whiteSpace: 'nowrap',
                color: tone.kind === 'settled' ? T.textMuted
                  : tone.kind === 'owed' ? T.success : T.error,
              }}>
                {tone.kind === 'settled' ? 'settled' : formatMoney(person.closingBalance)}
              </Typography>
            )}
          </Box>
        );
      })}

      {!preview.reconcilable && (
        <Typography sx={{ fontSize: 12.5, color: T.warning, mt: 1 }}>
          This export has no closing balances, so the import cannot be checked against
          Splitwise&apos;s own figures.
        </Typography>
      )}
    </Box>
  );
}

function Stat({ label, value, T }) {
  return (
    <Box sx={{ minWidth: 88 }}>
      <Typography sx={{
        fontSize: 10.5, fontWeight: 800, letterSpacing: 0.5,
        textTransform: 'uppercase', color: T.textFaint,
      }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: 15, fontWeight: 800, color: T.textPrimary }}>
        {value}
      </Typography>
    </Box>
  );
}
