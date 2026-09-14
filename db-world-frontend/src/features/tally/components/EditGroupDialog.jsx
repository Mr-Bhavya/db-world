import { useEffect, useState } from 'react';
import { Box, Typography, TextField, useMediaQuery, useTheme } from '@mui/material';
import { motion } from 'framer-motion';
import { useT } from '@shared/theme';
import { GROUP_CATEGORIES, GROUP_ICONS, groupIcon } from '../utils/tallyFormat';
import { TallyFormDialog, TallySubmitButton, TallyCancelButton, tallyFieldSx } from './tallyFormUi';

/**
 * Name, type and icon in one place.
 *
 * This replaced a dialog that could only rename. Renaming alone is the least useful of the
 * three — a group's icon is what you actually navigate the list by, and its type is what the
 * server uses to guess that icon in the first place.
 *
 * For a one-to-one ledger the name is the other person's, so only the icon is offered: letting
 * somebody rename "Amma" to something else would quietly break the one thing that makes the
 * list readable.
 */
export default function EditGroupDialog({ open, group, busy, onClose, onSave }) {
  const T = useT();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  const direct = group?.kind === 'DIRECT';

  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [icon, setIcon] = useState('');

  // Seeded on every open. `useState(group.name)` reads its argument once, so the second time
  // the dialog opened it would still be showing the name from the first.
  useEffect(() => {
    if (!open || !group) return;
    setName(group.name ?? '');
    setCategory(group.category ?? '');
    setIcon(groupIcon(group));
  }, [open, group]);

  const submit = () => {
    if (!direct && !name.trim()) return;
    onSave({
      name: direct ? null : name.trim(),
      category: direct ? null : (category || ''),
      icon,
    });
  };

  return (
    <TallyFormDialog
      open={open}
      onClose={onClose}
      busy={busy}
      fullScreen={fullScreen}
      maxWidth="xs"
      title={direct ? 'Change icon' : 'Edit group'}
      subtitle={direct ? group?.name : undefined}
      actions={(
        <>
          <TallyCancelButton onClick={onClose} disabled={busy} />
          <TallySubmitButton busy={busy} disabled={!direct && !name.trim()} onClick={submit}>
            Save
          </TallySubmitButton>
        </>
      )}
    >
      {!direct && (
        <TextField
          autoFocus
          fullWidth
          value={name}
          onChange={(e) => setName(e.target.value)}
          onFocus={(e) => e.target.select()}
          label="Name"
          sx={tallyFieldSx(T)}
        />
      )}

      <Box>
        <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: T.textMuted, mb: 1 }}>
          Icon
        </Typography>
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(44px, 1fr))',
          gap: 0.75,
        }}>
          {GROUP_ICONS.map((option) => {
            const selected = icon === option;
            return (
              <Box
                key={option}
                component={motion.button}
                type="button"
                whileTap={{ scale: 0.9 }}
                onClick={() => setIcon(option)}
                aria-label={`Use ${option}`}
                aria-pressed={selected}
                sx={{
                  aspectRatio: '1', display: 'grid', placeItems: 'center',
                  fontSize: 20, cursor: 'pointer', borderRadius: 2.5,
                  bgcolor: selected ? T.tealBg : T.glass,
                  border: `1px solid ${selected ? T.glassBorderHover : T.border}`,
                  transition: 'all .15s ease',
                  '&:hover': { bgcolor: selected ? T.tealBgHover : T.glassHover },
                }}
              >
                {option}
              </Box>
            );
          })}
        </Box>
      </Box>

      {!direct && (
        <Box>
          <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: T.textMuted, mb: 1 }}>
            Type <Box component="span" sx={{ fontWeight: 500 }}>(optional)</Box>
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            {GROUP_CATEGORIES.map((option) => {
              const selected = category === option;
              return (
                <Box
                  key={option}
                  component={motion.button}
                  type="button"
                  whileTap={{ scale: 0.94 }}
                  onClick={() => setCategory(selected ? '' : option)}
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
      )}
    </TallyFormDialog>
  );
}
