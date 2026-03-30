import { useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, MenuItem, Box, Typography, CircularProgress, IconButton, Chip, Divider } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useT, getSelectMenuProps } from '@shared/theme';
import { updateRecord, addRecordTag, removeRecordTag } from '../api/adminApi';
import { updateRecordSchema } from '../schemas/recordSchemas';
import { MANUAL_TAGS, AUTO_TAGS, TAG_COLORS, TAG_LABELS } from './tagConstants';

export default function RecordEditModal({ open, record, onClose }) {
  const T = useT();
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const inputSx = {
    '& .MuiOutlinedInput-root': {
      bgcolor: T.inputBg, color: T.textPrimary,
      '& fieldset':             { borderColor: T.glassBorder },
      '&:hover fieldset':       { borderColor: T.borderHover },
      '&.Mui-focused fieldset': { borderColor: T.teal },
    },
    '& .MuiInputLabel-root':             { color: T.textMuted },
    '& .MuiInputLabel-root.Mui-focused': { color: T.teal },
    '& .MuiFormHelperText-root':         { color: T.error },
    '& .MuiSelect-icon':                 { color: T.textMuted },
  };

  const { control, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(updateRecordSchema),
    defaultValues: { type: 'MOVIE', tmdbId: '' },
  });

  useEffect(() => {
    if (record) reset({ type: record.type, tmdbId: record.tmdbId ?? '' });
  }, [record, reset]);

  const { mutate: doUpdate, isPending: updating } = useMutation({
    mutationFn: (d) => updateRecord(record.recordId, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['records'] }); enqueueSnackbar('Record updated', { variant: 'success' }); onClose(); },
    onError: (e) => enqueueSnackbar(e?.response?.data?.message ?? 'Update failed', { variant: 'error' }),
  });

  const parseTags = (tags) => tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [];

  const { mutate: doAddTag, isPending: addingTag } = useMutation({
    mutationFn: ({ tagType }) => addRecordTag(record.recordId, { tagType }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['records'] }); enqueueSnackbar('Tag added', { variant: 'success', autoHideDuration: 1500 }); },
    onError: () => enqueueSnackbar('Failed to add tag', { variant: 'error' }),
  });

  const { mutate: doRemoveTag } = useMutation({
    mutationFn: (tagType) => removeRecordTag(record.recordId, tagType),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['records'] }),
    onError: () => enqueueSnackbar('Failed to remove tag', { variant: 'error' }),
  });

  const currentTags   = parseTags(record?.tags);
  const availableTags = MANUAL_TAGS.filter(t => !currentTags.includes(t));

  if (!record) return null;

  return (
    <Dialog open={open} onClose={onClose}
      PaperProps={{ sx: { bgcolor: T.sidebar, border: `1px solid ${T.glassBorder}`, color: T.textPrimary, width: '100%', maxWidth: 520, borderRadius: 2 } }}>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 700, color: T.textPrimary }}>
        Edit — <Box component="span" sx={{ color: T.textMuted, fontSize: 14, fontWeight: 400, ml: .5 }}>{record.name}</Box>
        <IconButton onClick={onClose} sx={{ color: T.textMuted }}><CloseIcon /></IconButton>
      </DialogTitle>
      <form onSubmit={handleSubmit(d => doUpdate(d))}>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Controller name="type" control={control} render={({ field }) => (
            <TextField {...field} select label="Type" size="small" sx={inputSx}
              SelectProps={{ MenuProps: getSelectMenuProps(T) }}
              error={!!errors.type} helperText={errors.type?.message}>
              <MenuItem value="MOVIE">Movie</MenuItem>
              <MenuItem value="TV_SERIES">Series</MenuItem>
            </TextField>
          )} />

          <Controller name="tmdbId" control={control} render={({ field }) => (
            <TextField {...field} label="TMDB ID" type="number" size="small" sx={inputSx}
              error={!!errors.tmdbId} helperText={errors.tmdbId?.message} />
          )} />

          <Divider sx={{ borderColor: T.border }} />

          <Box>
            <Typography sx={{ fontSize: 12, color: T.textFaint, textTransform: 'uppercase', letterSpacing: .6, mb: 1 }}>Tags</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: .75 }}>
              {currentTags.map(tagType => {
                const isAuto = AUTO_TAGS.has(tagType);
                const color = TAG_COLORS[tagType] ?? T.teal;
                return (
                  <Chip
                    key={tagType}
                    label={TAG_LABELS[tagType] ?? tagType.replace(/_/g, ' ')}
                    size="small"
                    onDelete={isAuto ? undefined : () => doRemoveTag(tagType)}
                    deleteIcon={isAuto ? undefined : <DeleteIcon sx={{ fontSize: '12px !important' }} />}
                    sx={{ bgcolor: `${color}18`, color, border: `1px solid ${color}44`, fontWeight: 700, fontSize: 11,
                      opacity: isAuto ? 0.8 : 1 }}
                  />
                );
              })}
              {currentTags.length === 0 && (
                <Typography sx={{ fontSize: 12, color: T.textFaint }}>No tags assigned</Typography>
              )}
            </Box>

            {availableTags.length > 0 && (
              <Box sx={{ mt: 1.5 }}>
                <Typography sx={{ fontSize: 11, color: T.textFaint, mb: .75 }}>Add tag:</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: .5 }}>
                  {availableTags.map(t => (
                    <Box key={t} onClick={() => doAddTag({ tagType: t })}
                      sx={{ px: 1.25, py: .35, borderRadius: 99, border: `1px solid ${TAG_COLORS[t]}66`, color: TAG_COLORS[t], fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: .5, '&:hover': { bgcolor: `${TAG_COLORS[t]}18` }, transition: 'all .15s' }}>
                      {addingTag ? <CircularProgress size={10} color="inherit" /> : <AddIcon sx={{ fontSize: 12 }} />}
                      {TAG_LABELS[t]}
                    </Box>
                  ))}
                </Box>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose} sx={{ color: T.textMuted }}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={updating}
            sx={{ bgcolor: T.teal, '&:hover': { bgcolor: T.tealHover }, fontWeight: 600 }}>
            {updating ? <CircularProgress size={18} color="inherit" /> : 'Save'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
