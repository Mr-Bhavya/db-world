import { useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, IconButton, CircularProgress,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { notify } from '@shared/notify';
import { useT } from '@shared/theme';
import { mkdir } from '../api/fileManagerApi';
import { useInvalidateFm } from '../hooks/useInvalidateFm';

const nameSchema = z.object({
  name: z.string().trim()
    .min(1, 'Name is required')
    .max(255, 'Name is too long')
    .refine((v) => !/[/\\]/.test(v), 'Name cannot contain / or \\')
    .refine((v) => !v.includes('..'), 'Name cannot contain ..'),
});

/** Single validated text-field dialog for creating a folder at `path` within `locationId`. */
export default function NewFolderDialog({ open, onClose, locationId, path }) {
  const T = useT();
  const { invalidateDir } = useInvalidateFm();

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(nameSchema),
    defaultValues: { name: '' },
  });

  // Fresh blank field every time the dialog is (re)opened.
  useEffect(() => {
    if (open) reset({ name: '' });
  }, [open, reset]);

  const { mutate, isPending } = useMutation({
    mutationFn: (values) => mkdir({ locationId, path, name: values.name.trim() }),
    onSuccess: () => {
      invalidateDir(locationId);
      notify.success('Folder created');
      onClose?.();
    },
    onError: (e) => notify.error(e?.response?.data?.message ?? 'Failed to create folder'),
  });

  const handleClose = () => { if (!isPending) onClose?.(); };

  return (
    <Dialog
      open={open}
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
          <CreateNewFolderIcon sx={{ fontSize: 18, color: T.teal }} />
          New Folder
        </span>
        <IconButton size="small" onClick={handleClose} sx={{ color: T.textFaint }}>
          <CloseIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </DialogTitle>

      <form onSubmit={handleSubmit((values) => mutate(values))}>
        <DialogContent sx={{ pb: 1 }}>
          <TextField
            {...register('name')}
            autoFocus
            fullWidth
            size="small"
            label="Folder Name"
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
            {isPending ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : 'Create'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
