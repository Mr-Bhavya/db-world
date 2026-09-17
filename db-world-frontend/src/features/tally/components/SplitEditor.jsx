import { Box, Typography, TextField, InputAdornment, Button } from '@mui/material';
import AutoFixHighRoundedIcon from '@mui/icons-material/AutoFixHighRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import { motion } from 'framer-motion';
import { useT } from '@shared/theme';
import { SPLIT_METHODS, formatMoney } from '../utils/tallyFormat';
import { tallyFieldSx, MemberToggleRow } from './tallyFormUi';

/** Percent shortcuts, offered only when there are exactly two people to apply them to. */
const PAIR_PRESETS = [[50, 50], [60, 40], [70, 30], [75, 25], [100, 0]];

/**
 * How the expense is divided, and who is in it.
 *
 * <h2>The auto-fill rule</h2>
 * Under Amounts and Percent every field starts pre-filled with an even share, and typing into
 * one <b>locks</b> it. From then on only the untouched fields move as the remainder is
 * re-spread. That is the whole difficulty: re-balancing everything on each keystroke is the
 * obvious implementation, and it makes the value you set a moment ago jump while you type the
 * next one, so you can never get two of three to stick.
 *
 * It falls out of the state shape rather than being enforced by an effect: {@code weights}
 * holds <em>only what the user typed</em>, and everything shown is derived at render time by
 * {@link redistribute}. There is nothing to keep in sync, so nothing can drift, and clearing a
 * lock is just deleting a key.
 */
export default function SplitEditor({
  method, onMethodChange,
  members, participants, onParticipantsChange,
  weights, onWeightsChange,
  effective, locked, remainderNote, over,
  preview, nameOf, delegationOf,
}) {
  const T = useT();

  const needsFields = method === 'EXACT' || method === 'PERCENT' || method === 'SHARES';
  const isBalanced = method === 'EXACT' || method === 'PERCENT';

  const valueFor = (id) => (method === 'SHARES' ? (weights[id] ?? '1') : (effective[id] ?? ''));

  const setField = (id, raw) => onWeightsChange({ ...weights, [id]: raw });

  const unlock = (id) => {
    const { [id]: _dropped, ...rest } = weights;
    onWeightsChange(rest);
  };

  /** Clears every lock, so the whole amount re-spreads evenly. */
  const evenAgain = () => onWeightsChange({});

  const applyPreset = ([a, b]) => onWeightsChange({
    [participants[0]]: String(a),
    [participants[1]]: String(b),
  });

  return (
    <Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 1.25 }}>
        {SPLIT_METHODS.map((m) => {
          const selected = method === m.value;
          return (
            <Box
              key={m.value}
              component={motion.button}
              type="button"
              whileTap={{ scale: 0.94 }}
              // Each method keeps its own values (see AddExpenseDialog): switching away and
              // back restores what you typed, and nothing is carried ACROSS methods, where a
              // 60 would mean rupees, per cent or shares depending on where it landed.
              onClick={() => onMethodChange(m.value)}
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

      {/* Shortcuts, and a way back to an even split once you have been fiddling. */}
      {needsFields && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.75, mb: 1.25 }}>
          <Button
            size="small"
            onClick={evenAgain}
            startIcon={<AutoFixHighRoundedIcon sx={{ fontSize: 15 }} />}
            sx={{ textTransform: 'none', fontSize: 12, fontWeight: 700, color: T.teal, py: 0.2 }}
          >
            Split evenly
          </Button>

          {method === 'PERCENT' && participants.length === 2 && PAIR_PRESETS.map((preset) => (
            <Box
              key={preset.join('-')}
              component={motion.button}
              type="button"
              whileTap={{ scale: 0.92 }}
              onClick={() => applyPreset(preset)}
              sx={{
                px: 1, py: 0.4, borderRadius: 999, cursor: 'pointer',
                fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit',
                bgcolor: T.glass, color: T.textMuted, border: `1px solid ${T.border}`,
                '&:hover': { bgcolor: T.glassHover, color: T.textPrimary },
              }}
            >
              {preset[0]}/{preset[1]}
            </Box>
          ))}

          {remainderNote && (
            <Typography sx={{
              fontSize: 11.5, fontWeight: 700, ml: 'auto',
              color: over ? '#ef4444' : '#f59e0b',
            }}>
              {remainderNote}
            </Typography>
          )}
        </Box>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
        {members.map((member) => {
          const included = participants.includes(member.id);
          const share = preview.find((p) => p.memberId === member.id);
          const paidFor = delegationOf(member.id);
          const isLocked = locked.has(member.id);

          return (
            <MemberToggleRow
              key={member.id}
              member={member}
              selected={included}
              subtitle={paidFor ? `${nameOf(paidFor)} pays for them` : undefined}
              onToggle={() => {
                onParticipantsChange(included
                  ? participants.filter((id) => id !== member.id)
                  : [...participants, member.id]);
                // Dropping somebody drops their typed value with them, or it would keep
                // eating into the total from a row that is no longer on screen.
                if (included && isLocked) unlock(member.id);
              }}
              trailing={included && needsFields ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
                  {isLocked && isBalanced && (
                    <LockRoundedIcon
                      role="button"
                      tabIndex={0}
                      aria-label={`Let ${member.displayName}'s share balance automatically again`}
                      onClick={(e) => { e.stopPropagation(); unlock(member.id); }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); unlock(member.id); }
                      }}
                      titleAccess="You set this. Tap to let it balance automatically again."
                      sx={{ fontSize: 13, color: T.teal, cursor: 'pointer' }}
                    />
                  )}
                  <TextField
                    size="small"
                    inputMode="decimal"
                    value={valueFor(member.id)}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setField(member.id, e.target.value)}
                    sx={{ ...tallyFieldSx(T), width: method === 'SHARES' ? 74 : 108 }}
                    slotProps={{
                      input: {
                        startAdornment: method === 'EXACT'
                          ? <InputAdornment position="start">₹</InputAdornment> : null,
                        endAdornment: method === 'PERCENT'
                          ? <InputAdornment position="end">%</InputAdornment> : null,
                      },
                    }}
                  />
                </Box>
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
    </Box>
  );
}
