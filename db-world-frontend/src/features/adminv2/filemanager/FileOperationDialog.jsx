import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Typography, IconButton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useT } from '@shared/theme';
import { useFileManagerStore } from './useFileManagerStore';
import { renameItem, createDirectory, moveItem, copyItem } from './fileManagerApi';

const nameSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255)
    .refine(v => !v.includes('/') && !v.includes('\\'), 'Name cannot contain / or \\'),
});

const pathSchema = z.object({
  destination: z.string().min(1, 'Destination is required').startsWith('/', 'Must start with /'),
});

export default function FileOperationDialog() {
  const T = useT();
  const { enqueueSnackbar } = useSnackbar();
  const qc = useQueryClient();
  const { operationDialog, closeOperation, currentPath } = useFileManagerStore();

  const isNameOp = operationDialog?.type === 'rename' || operationDialog?.type === 'mkdir';
  const schema = isNameOp ? nameSchema : pathSchema;

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: isNameOp
      ? { name: operationDialog?.type === 'rename' ? (operationDialog?.item?.name ?? '') : '' }
      : { destination: currentPath },
  });

  const { mutate, isPending } = useMutation({
    mutationFn: (data) => {
      const { type, item } = operationDialog;
      if (type === 'rename') return renameItem(item.path, data.name);
      if (type === 'mkdir')  return createDirectory(currentPath, data.name);
      if (type === 'move')   return moveItem(item.path, data.destination);
      if (type === 'copy')   return copyItem(item.path, data.destination);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['file-manager', currentPath] });
      enqueueSnackbar(
        operationDialog?.type === 'rename' ? 'Renamed successfully'
          : operationDialog?.type === 'mkdir' ? 'Folder created'
          : operationDialog?.type === 'move' ? 'Moved successfully'
          : 'Copied successfully',
        { variant: 'success' }
      );
      reset(); closeOperation();
    },
    onError: (e) => enqueueSnackbar(e?.response?.data?.message ?? 'Operation failed', { variant: 'error' }),
  });

  const title = {
    rename: `Rename "${operationDialog?.item?.name}"`,
    mkdir:  'New Folder',
    move:   `Move "${operationDialog?.item?.name}"`,
    copy:   `Copy "${operationDialog?.item?.name}"`,
  }[operationDialog?.type ?? 'mkdir'] ?? '';

  const handleClose = () => { if (!isPending) { reset(); closeOperation(); } };

  return (
    <Dialog key={operationDialog?.type ?? 'closed'} open={Boolean(operationDialog)} onClose={handleClose} maxWidth="xs" fullWidth
      PaperProps={{ sx: { bgcolor: T.sidebar, border: `1px solid ${T.border}` } }}>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        color: T.textPrimary, fontSize: 15, fontWeight: 700, pb: 1 }}>
        {title}
        <IconButton size="small" onClick={handleClose} sx={{ color: T.textFaint }}>
          <CloseIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </DialogTitle>

      <form onSubmit={handleSubmit(data => mutate(data))}>
        <DialogContent sx={{ pb: 1 }}>
          {isNameOp ? (
            <TextField
              {...register('name')}
              autoFocus fullWidth size="small"
              label={operationDialog?.type === 'mkdir' ? 'Folder Name' : 'New Name'}
              error={Boolean(errors.name)}
              helperText={errors.name?.message}
              InputProps={{ sx: { fontSize: 13 } }}
              sx={{ '& .MuiOutlinedInput-root': { bgcolor: T.inputBg ?? 'transparent' } }}
            />
          ) : (
            <>
              <Typography sx={{ fontSize: 12, color: T.textFaint, mb: 1 }}>
                Destination path (absolute from root, e.g. /videos/movies)
              </Typography>
              <TextField
                {...register('destination')}
                autoFocus fullWidth size="small"
                label="Destination Path"
                error={Boolean(errors.destination)}
                helperText={errors.destination?.message}
                InputProps={{ sx: { fontSize: 13 } }}
                sx={{ '& .MuiOutlinedInput-root': { bgcolor: T.inputBg ?? 'transparent' } }}
              />
            </>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 2.5, pb: 2, gap: 1 }}>
          <Button onClick={handleClose} disabled={isPending} sx={{ color: T.textMuted, fontSize: 13 }}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={isPending}
            sx={{ bgcolor: T.teal, '&:hover': { bgcolor: T.tealHover }, fontSize: 13 }}>
            {isPending ? 'Processing…' : 'Confirm'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
