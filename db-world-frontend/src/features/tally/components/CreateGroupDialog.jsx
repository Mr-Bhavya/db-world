import { useEffect } from 'react';
import { Box, TextField, Typography, useMediaQuery, useTheme } from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import { useT } from '@shared/theme';
import { createGroupSchema } from '../schemas/tallySchemas';
import { GROUP_CATEGORIES } from '../utils/tallyFormat';
import { TallyFormDialog, TallySubmitButton, TallyCancelButton, tallyFieldSx } from './tallyFormUi';

/**
 * Two fields, one of them optional.
 *
 * Everything else a group needs — its owner, its currency, its first member — the server
 * decides. Asking for any of it here would be asking the user to make a decision they have no
 * information for on the very first screen of the app.
 */
export default function CreateGroupDialog({ open, onClose, onCreate, busy }) {
  const T = useT();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  const { control, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm({
    resolver: zodResolver(createGroupSchema),
    defaultValues: { name: '', category: '' },
  });

  useEffect(() => { if (open) reset({ name: '', category: '' }); }, [open, reset]);

  const category = watch('category');

  const submit = handleSubmit((values) => {
    onCreate({ name: values.name.trim(), category: values.category?.trim() || null });
  });

  return (
    <TallyFormDialog
      open={open}
      onClose={onClose}
      busy={busy}
      fullScreen={fullScreen}
      title="New group"
      subtitle="A shared ledger for a household, a trip, or a night out"
      actions={(
        <>
          <TallyCancelButton onClick={onClose} disabled={busy} />
          <TallySubmitButton busy={busy} onClick={submit}>Create group</TallySubmitButton>
        </>
      )}
    >
      <Box component="form" onSubmit={submit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Controller
          name="name"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              autoFocus
              fullWidth
              label="Group name"
              placeholder="Home"
              error={Boolean(errors.name)}
              helperText={errors.name?.message}
              sx={tallyFieldSx(T)}
            />
          )}
        />

        <Box>
          <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: T.textMuted, mb: 1 }}>
            What kind of group? <Box component="span" sx={{ fontWeight: 500 }}>(optional)</Box>
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            {GROUP_CATEGORIES.map((option) => {
              const selected = category === option;
              return (
                <Box
                  key={option}
                  component={motion.button}
                  type="button"
                  whileTap={{ scale: 0.95 }}
                  // Tapping the chosen one again clears it, so "optional" is actually optional.
                  onClick={() => setValue('category', selected ? '' : option, { shouldDirty: true })}
                  sx={{
                    px: 1.5, py: 0.7, borderRadius: 999, cursor: 'pointer',
                    fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                    bgcolor: selected ? T.tealBg : T.glass,
                    color: selected ? T.teal : T.textMuted,
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

        <Typography sx={{ fontSize: 12, color: T.textMuted, lineHeight: 1.5 }}>
          You will be added as the owner. Add everybody else — including people who do not have
          a db-world account — once the group exists.
        </Typography>
      </Box>
    </TallyFormDialog>
  );
}
