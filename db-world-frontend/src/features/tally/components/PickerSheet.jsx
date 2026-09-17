import { useMemo, useState } from 'react';
import {
  Box, InputAdornment, TextField, Typography, useMediaQuery, useTheme,
} from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { motion } from 'framer-motion';
import { useT } from '@shared/theme';
import { TallyFormDialog, TallyCancelButton } from './tallyFormUi';

/**
 * A grid of pictures to choose one of.
 *
 * <h2>What this replaces, and why</h2>
 * The categories used to live in a 248px-wide anchored popover holding thirty-one items in a
 * single column behind an autofocusing search box. On a phone the form underneath was already
 * full-screen, so that was a little floating panel over a full-screen form — and the autofocus
 * opened the keyboard, which ate most of the little panel's height. What was left showed about
 * four items at a time out of thirty-one.
 *
 * <p>So: the same dialog component the forms themselves use, which on a phone is a sheet. The
 * items are a grid rather than a list because each one is a picture and one short word — laid out
 * in rows of four that is eight per thumb-height instead of four, and the eye scans a grid of
 * pictures far faster than a column of text.
 *
 * <p>Search is still there and still first, but it only takes focus on a pointer device. On a
 * phone the keyboard now appears when you ask for it, not before you have seen anything. It
 * matches on the label, which is why an icon list has to carry names at all: an emoji is a
 * picture and nobody can type it.
 *
 * <p>Written once and shared, because "grid of emoji with a search box" being two implementations
 * is how one of them ends up with a keyboard problem the other fixed.
 *
 * @param groups  {@code [{ label, items: [{ key, emoji, label }] }]}.
 * @param value   the selected {@code key}, if any.
 * @param onPick  called with a key, or with {@code ''} to clear.
 */
export default function PickerSheet({
  open, title, subtitle, groups = [], value, clearable = true, onClose, onPick,
}) {
  const T = useT();
  const theme = useTheme();
  const sheet = useMediaQuery(theme.breakpoints.down('sm'));
  const [term, setTerm] = useState('');

  const shown = useMemo(() => {
    const needle = term.trim().toLowerCase();
    if (!needle) return groups;
    return groups
      .map((g) => ({ ...g, items: g.items.filter((i) => i.label.toLowerCase().includes(needle)) }))
      .filter((g) => g.items.length);
  }, [groups, term]);

  const close = () => { setTerm(''); onClose(); };
  const pick = (key) => { setTerm(''); onPick(key); };

  const selected = groups.flatMap((g) => g.items).find((i) => i.key === value);

  return (
    <TallyFormDialog
      open={open}
      onClose={close}
      fullScreen={sheet}
      title={title}
      subtitle={subtitle}
      actions={<TallyCancelButton onClick={close}>Close</TallyCancelButton>}
    >
      <Box sx={{ mb: 2 }}>
        <TextField
          // Focus on a pointer device only. On a phone this opens the keyboard over the very
          // grid it is meant to help you search, before you have had a chance to just look.
          autoFocus={!sheet}
          fullWidth
          size="small"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search"
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRoundedIcon sx={{ fontSize: 18, color: T.textMuted }} />
                </InputAdornment>
              ),
            },
          }}
          sx={{
            '& .MuiInputBase-root': { bgcolor: T.glass, borderRadius: 2.5, fontSize: 14 },
            '& .MuiInputBase-input': { color: T.textPrimary },
            '& .MuiOutlinedInput-notchedOutline': { borderColor: T.border },
          }}
        />
      </Box>

      {clearable && selected && (
        <Box
          component={motion.button}
          type="button"
          whileTap={{ scale: 0.97 }}
          onClick={() => pick('')}
          sx={{
            display: 'flex', alignItems: 'center', gap: 0.6, mb: 2,
            px: 1.25, py: 0.6, borderRadius: 999, cursor: 'pointer',
            fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700,
            bgcolor: 'transparent', color: T.textMuted,
            border: `1px dashed ${T.border}`,
          }}
        >
          <CloseRoundedIcon sx={{ fontSize: 15 }} />
          Clear {selected.label}
        </Box>
      )}

      {shown.length === 0 && (
        <Typography sx={{ fontSize: 13.5, color: T.textMuted, py: 2 }}>
          Nothing matches “{term}”.
        </Typography>
      )}

      {shown.map((group) => (
        <Box key={group.label} sx={{ mb: 2.5 }}>
          <Typography sx={{
            fontSize: 11, fontWeight: 800, letterSpacing: 0.6,
            textTransform: 'uppercase', color: T.textFaint, mb: 1,
          }}>
            {group.label}
          </Typography>

          {/* auto-fill rather than a per-breakpoint column count: the same rule gives three
              across a narrow phone and five in the dialog on a desktop, and never leaves a tile
              stretched to half the width because a group has an odd number in it. */}
          <Box sx={{
            display: 'grid', gap: 1,
            gridTemplateColumns: 'repeat(auto-fill, minmax(78px, 1fr))',
          }}>
            {group.items.map((item) => {
              const isOn = value === item.key;
              return (
                <Box
                  key={item.key}
                  component={motion.button}
                  type="button"
                  whileTap={{ scale: 0.94 }}
                  onClick={() => pick(isOn && clearable ? '' : item.key)}
                  aria-pressed={isOn}
                  sx={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    justifyContent: 'center', gap: 0.4,
                    px: 0.5, py: 1.25, borderRadius: 2.5, cursor: 'pointer',
                    fontFamily: 'inherit', minWidth: 0,
                    bgcolor: isOn ? T.tealBg : T.glass,
                    border: `1px solid ${isOn ? T.glassBorderHover : T.border}`,
                    transition: 'background-color .15s ease, border-color .15s ease',
                    '&:hover': { bgcolor: isOn ? T.tealBg : T.glassHover },
                    '&:focus-visible': { outline: `2px solid ${T.teal}`, outlineOffset: 2 },
                  }}
                >
                  <Box aria-hidden sx={{ fontSize: 20, lineHeight: 1 }}>{item.emoji}</Box>
                  <Typography noWrap sx={{
                    fontSize: 11, fontWeight: 600, maxWidth: '100%',
                    color: isOn ? T.teal : T.textMuted,
                  }}>
                    {item.label}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        </Box>
      ))}
    </TallyFormDialog>
  );
}
