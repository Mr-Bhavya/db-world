import { useEffect, useState } from 'react';
import {
  Box, Dialog, DialogTitle, DialogContent, DialogActions, IconButton, Typography,
  Table, TableHead, TableRow, TableCell, TableBody, Button, TextField, Chip, Tooltip, CircularProgress,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import StorageIcon from '@mui/icons-material/Storage';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useT } from '@shared/theme';
import { useLocations } from '../hooks/useLocations';
import { createLocation, updateLocation, deleteLocation } from '../api/fileManagerApi';
import { useInvalidateFm } from '../hooks/useInvalidateFm';
import ConfirmDialog from './ConfirmDialog';

const locationSchema = z.object({
  label: z.string().trim().min(1, 'Label is required').max(120, 'Label is too long'),
  absolutePath: z.string().trim().min(1, 'Path is required').max(1000, 'Path is too long'),
});

const EMPTY_VALUES = { label: '', absolutePath: '' };

/**
 * Admin table of configured file-manager root locations, with inline
 * add/edit (RHF + Zod) and delete (routed through the shared `ConfirmDialog`
 * — never `window.confirm`). Every mutation invalidates
 * `['file-manager','locations']` via `useInvalidateFm`.
 */
export default function LocationManagerDialog({ open, onClose }) {
  const T = useT();
  const { enqueueSnackbar } = useSnackbar();
  const { invalidateLocations } = useInvalidateFm();
  const { data: locations = [], isLoading } = useLocations();

  const [editing, setEditing] = useState(null); // null | 'new' | location entity
  const [deleteTarget, setDeleteTarget] = useState(null);

  const { control, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(locationSchema),
    defaultValues: EMPTY_VALUES,
  });

  useEffect(() => {
    if (editing === 'new') reset(EMPTY_VALUES);
    else if (editing) reset({ label: editing.label, absolutePath: editing.absolutePath });
  }, [editing, reset]);

  const saveMut = useMutation({
    mutationFn: (values) => (editing && editing !== 'new'
      ? updateLocation(editing.id, values)
      : createLocation(values)),
    onSuccess: () => {
      invalidateLocations();
      enqueueSnackbar(editing !== 'new' ? 'Location updated' : 'Location added', { variant: 'success' });
      setEditing(null);
    },
    onError: (e) => enqueueSnackbar(e?.response?.data?.message ?? 'Failed to save location', { variant: 'error' }),
  });

  const deleteMut = useMutation({
    mutationFn: (id) => deleteLocation(id),
    onSuccess: () => {
      invalidateLocations();
      enqueueSnackbar('Location removed', { variant: 'success' });
      setDeleteTarget(null);
    },
    onError: (e) => enqueueSnackbar(e?.response?.data?.message ?? 'Failed to remove location', { variant: 'error' }),
  });

  const fieldSx = { '& .MuiOutlinedInput-root': { bgcolor: T.inputBg ?? 'transparent', fontSize: 13 } };

  const handleClose = () => { setEditing(null); onClose?.(); };
  const cellSx = { borderColor: T.border, color: T.textPrimary, fontSize: 12.5 };

  return (
    <>
      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { bgcolor: T.sidebar, border: `1px solid ${T.border}` } }}
      >
        <DialogTitle sx={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          color: T.textPrimary, fontSize: 15, fontWeight: 700, pb: 1,
        }}>
          Manage Locations
          <IconButton size="small" onClick={handleClose} sx={{ color: T.textFaint }}>
            <CloseIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ pb: 1 }}>
          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress size={22} sx={{ color: T.teal }} />
            </Box>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ color: T.textFaint, fontSize: 11, fontWeight: 700, borderColor: T.border }}>Label</TableCell>
                  <TableCell sx={{ color: T.textFaint, fontSize: 11, fontWeight: 700, borderColor: T.border }}>Path</TableCell>
                  <TableCell sx={{ color: T.textFaint, fontSize: 11, fontWeight: 700, borderColor: T.border }}>Status</TableCell>
                  <TableCell sx={{ color: T.textFaint, fontSize: 11, fontWeight: 700, borderColor: T.border }} align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {locations.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} sx={{ borderColor: T.border, textAlign: 'center', color: T.textFaint, fontSize: 12, py: 2 }}>
                      No locations configured
                    </TableCell>
                  </TableRow>
                )}
                {locations.map((loc) => (
                  <TableRow key={loc.id}>
                    <TableCell sx={cellSx}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        <StorageIcon sx={{ fontSize: 14, color: T.textFaint }} />
                        {loc.label}
                      </Box>
                    </TableCell>
                    <TableCell sx={{ ...cellSx, color: T.textMuted, wordBreak: 'break-all', maxWidth: 180 }}>
                      {loc.absolutePath}
                    </TableCell>
                    <TableCell sx={{ borderColor: T.border }}>
                      <Chip
                        label={loc.available ? 'Available' : 'Unavailable'}
                        size="small"
                        sx={{
                          fontSize: 10.5, height: 20,
                          bgcolor: loc.available ? T.successBg : T.warningBg,
                          color: loc.available ? T.success : T.warning,
                          border: 'none',
                        }}
                      />
                    </TableCell>
                    <TableCell sx={{ borderColor: T.border }} align="right">
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => setEditing(loc)} sx={{ color: T.textFaint, '&:hover': { color: T.teal } }}>
                          <EditIcon sx={{ fontSize: 15 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton size="small" onClick={() => setDeleteTarget(loc)} sx={{ color: T.textFaint, '&:hover': { color: T.error } }}>
                          <DeleteIcon sx={{ fontSize: 15 }} />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {editing ? (
            <Box
              component="form"
              onSubmit={handleSubmit((values) => saveMut.mutate(values))}
              sx={{
                mt: 2, p: 1.5, border: `1px solid ${T.border}`, borderRadius: 1.5,
                display: 'flex', flexDirection: 'column', gap: 1.25,
              }}
            >
              <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: T.textPrimary }}>
                {editing === 'new' ? 'New Location' : `Edit "${editing.label}"`}
              </Typography>
              <Controller
                name="label"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field} size="small" label="Label" fullWidth sx={fieldSx}
                    error={Boolean(errors.label)} helperText={errors.label?.message}
                  />
                )}
              />
              <Controller
                name="absolutePath"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field} size="small" label="Absolute Path" fullWidth sx={fieldSx}
                    error={Boolean(errors.absolutePath)} helperText={errors.absolutePath?.message}
                  />
                )}
              />
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                <Button size="small" onClick={() => setEditing(null)} disabled={saveMut.isPending} sx={{ color: T.textMuted, fontSize: 12.5 }}>
                  Cancel
                </Button>
                <Button
                  type="submit" size="small" variant="contained" disabled={saveMut.isPending}
                  sx={{ bgcolor: T.teal, fontSize: 12.5, '&:hover': { bgcolor: T.tealHover } }}
                >
                  {saveMut.isPending ? <CircularProgress size={14} sx={{ color: '#fff' }} /> : 'Save'}
                </Button>
              </Box>
            </Box>
          ) : (
            <Button
              startIcon={<AddIcon sx={{ fontSize: 16 }} />}
              onClick={() => setEditing('new')}
              size="small"
              sx={{ mt: 1.5, color: T.teal, '&:hover': { bgcolor: T.tealBg } }}
            >
              Add Location
            </Button>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 2.5, pb: 2 }}>
          <Button onClick={handleClose} sx={{ color: T.textMuted, fontSize: 13 }}>Close</Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Remove location"
        message={`Remove "${deleteTarget?.label}"? Files on disk are not deleted, but this location will no longer be browsable.`}
        confirmLabel="Remove"
        danger
        onConfirm={() => deleteMut.mutate(deleteTarget.id)}
        onClose={() => setDeleteTarget(null)}
      />
    </>
  );
}
