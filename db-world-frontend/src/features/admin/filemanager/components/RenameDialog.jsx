import { useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, IconButton, CircularProgress,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/Edit';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useT } from '@shared/theme';
import { renameItem } from '../api/fileManagerApi';
import { useInvalidateFm } from '../hooks/useInvalidateFm';

const nameSchema = z.object({
  name: z.string().trim()
    .min(1, 'Name is required')
    .max(255, 'Name is too long')
    .refine((v) => !/[/\\]/.test(v), 'Name cannot contain / or \\')
    .refine((v) => !v.includes('..'), 'Name cannot contain ..'),
});

/** Single validated text-field dialog, prefilled with `item.name`, for renaming a file/folder. */
export default function RenameDialog({ open, onClose, item }) {
  const T = useT();
  const { enqueueSnackbar } = useSnackbar();
  const { invalidateDir } = useInvalidateFm();

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(nameSchema),
    defaultValues: { name: item?.name ?? '' },
  });

  // Re-prime the field whenever a new target opens (item is the same object
  // reference for the duration of one rename, so this only fires on open).
  useEffect(() => {
    if (open) reset({ name: item?.name ?? '' });
  }, [open, item, reset]);

  const { mutate, isPending } = useMutation({
    mutationFn: (values) => renameItem({ locationId: item.locationId, path: item.path, newName: values.name.trim() }),
    onSuccess: () => {
      invalidateDir(item.locationId);
      enqueueSnackbar('Renamed successfully', { variant: 'success' });
      onClose?.();
    },
    onError: (e) => enqueueSnackbar(e?.response?.data?.message ?? 'Failed to rename', { variant: 'error' }),
  });

  const handleClose = () => { if (!isPending) onClose?.(); };

  return (
    <Dialog
      open={Boolean(open && item)}
      onClose={handleClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{ sx: { bgcolor: T.sidebar, border: `1px solid ${T.border}` } }}
    >
      <DialogTitle sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        color: T.textPrimary, fontSize: 15, fontWeight: 700, pb: 1,
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <EditIcon sx={{ fontSize: 18, color: T.teal }} />
          Rename
        </span>
        <IconButton size="small" onClick={handleClose} sx={{ color: T.textFaint }}>
          <CloseIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </DialogTitle>

      {item && (
        <form onSubmit={handleSubmit((values) => mutate(values))}>
          <DialogContent sx={{ pb: 1 }}>
            <TextField
              {...register('name')}
              autoFocus
              fullWidth
              size="small"
              label="Name"
              error={Boolean(errors.name)}
              helperText={errors.name?.message}
              InputProps={{ sx: { fontSize: 13 } }}
              sx={{ '& .MuiOutlinedInput-root': { bgcolor: T.inputBg ?? 'transparent' } }}
            />
          </DialogContent>

          <DialogActions sx={{ px: 2.5, pb: 2, gap: 1 }}>
            <Button onClick={handleClose} disabled={isPending} sx={{ color: T.textMuted, fontSize: 13 }}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={isPending}
              sx={{ bgcolor: T.teal, fontSize: 13, '&:hover': { bgcolor: T.tealHover } }}
            >
              {isPending ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : 'Rename'}
            </Button>
          </DialogActions>
        </form>
      )}
    </Dialog>
  );
}
