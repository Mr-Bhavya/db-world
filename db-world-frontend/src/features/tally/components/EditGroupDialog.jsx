import { useEffect, useState } from 'react';
import { Box, Typography, TextField, useMediaQuery, useTheme } from '@mui/material';
import { motion } from 'framer-motion';
import { useT } from '@shared/theme';
import { GROUP_CATEGORIES, groupIcon } from '../utils/tallyFormat';
import IconSheet from './IconSheet';
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
  const [pickingIcon, setPickingIcon] = useState(false);

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
        {/* One current icon and a way to the other eighty-one. A grid of every icon inline was
            fine at twenty-four; past that it is the largest thing in the dialog and pushes the
            name field -- the one you actually came to change -- below the fold. */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box
            component={motion.button}
            type="button"
            whileTap={{ scale: 0.94 }}
            onClick={() => setPickingIcon(true)}
            aria-label="Change the icon"
            sx={{
              width: 48, height: 48, borderRadius: 2.5, fontSize: 24, cursor: 'pointer',
              display: 'grid', placeItems: 'center', flexShrink: 0,
              bgcolor: T.tealBg, border: `1px solid ${T.glassBorderHover}`,
            }}
          >
            {icon || groupIcon(group)}
          </Box>
          <Box
            component={motion.button}
            type="button"
            whileTap={{ scale: 0.97 }}
            onClick={() => setPickingIcon(true)}
            sx={{
              px: 1.5, py: 0.7, borderRadius: 999, cursor: 'pointer',
              fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700,
              bgcolor: 'transparent', color: T.teal,
              border: `1px dashed ${T.glassBorderHover}`,
            }}
          >
            Choose an icon
          </Box>
        </Box>
      </Box>

      <IconSheet
        open={pickingIcon}
        value={icon}
        onClose={() => setPickingIcon(false)}
        onPick={(emoji) => { setIcon(emoji); setPickingIcon(false); }}
      />

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
