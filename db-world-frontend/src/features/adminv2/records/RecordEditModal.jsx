// db-world-frontend/src/features/adminv2/records/RecordEditModal.jsx
import { useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, MenuItem, Box, Typography, CircularProgress, IconButton, Chip, Divider } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { updateRecord, addRecordTag, removeRecordTag } from '../api/adminApi';
import { updateRecordSchema } from '../schemas/recordSchemas';
import { ALL_TAGS, TAG_COLORS } from './tagConstants';

const inputSx = {
  '& .MuiOutlinedInput-root': { bgcolor:'rgba(0,0,0,0.03)', color:'#0f172a', '& fieldset':{ borderColor:'rgba(0,0,0,0.15)' }, '&:hover fieldset':{ borderColor:'rgba(0,0,0,0.3)' }, '&.Mui-focused fieldset':{ borderColor:'#0d9488' } },
  '& .MuiInputLabel-root': { color:'rgba(15,23,42,0.5)' },
  '& .MuiFormHelperText-root': { color:'#ef4444' },
  '& .MuiSelect-icon': { color:'rgba(15,23,42,0.45)' },
};

export default function RecordEditModal({ open, record, onClose }) {
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const { control, handleSubmit, reset, formState:{ errors } } = useForm({
    resolver: zodResolver(updateRecordSchema),
    defaultValues: { type:'MOVIE', tmdbId:'' },
  });

  useEffect(() => {
    if (record) reset({ type: record.type, tmdbId: record.tmdbId ?? '' });
  }, [record, reset]);

  const { mutate: doUpdate, isPending: updating } = useMutation({
    mutationFn: (d) => updateRecord(record.recordId, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey:['records'] }); enqueueSnackbar('Record updated', { variant:'success' }); onClose(); },
    onError: (e) => enqueueSnackbar(e?.response?.data?.message ?? 'Update failed', { variant:'error' }),
  });

  const parseTags = (tags) =>
    tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [];

  const { mutate: doAddTag, isPending: addingTag } = useMutation({
    mutationFn: ({ tagType }) => addRecordTag(record.recordId, { tagType }),
    onSuccess: () => { qc.invalidateQueries({ queryKey:['records'] }); enqueueSnackbar('Tag added', { variant:'success', autoHideDuration:1500 }); },
    onError: () => enqueueSnackbar('Failed to add tag', { variant:'error' }),
  });

  const { mutate: doRemoveTag } = useMutation({
    mutationFn: (tagType) => removeRecordTag(record.recordId, tagType),
    onSuccess: () => { qc.invalidateQueries({ queryKey:['records'] }); },
    onError: () => enqueueSnackbar('Failed to remove tag', { variant:'error' }),
  });

  const currentTags   = parseTags(record?.tags);
  const availableTags = ALL_TAGS.filter(t => !currentTags.includes(t));

  if (!record) return null;

  return (
    <Dialog open={open} onClose={onClose} PaperProps={{ sx:{ bgcolor:'#ffffff', border:'1px solid rgba(0,0,0,0.1)', color:'#0f172a', width:'100%', maxWidth:520, borderRadius:2 } }}>
      <DialogTitle sx={{ display:'flex', justifyContent:'space-between', alignItems:'center', fontWeight:700, color:'#0f172a' }}>
        Edit Record — <Box component="span" sx={{ color:'rgba(15,23,42,0.5)', fontSize:14, fontWeight:400, ml:.5 }}>{record.name}</Box>
        <IconButton onClick={onClose} sx={{ color:'rgba(15,23,42,0.4)' }}><CloseIcon /></IconButton>
      </DialogTitle>
      <form onSubmit={handleSubmit(d => doUpdate(d))}>
        <DialogContent sx={{ display:'flex', flexDirection:'column', gap:2 }}>
          {/* Type */}
          <Controller name="type" control={control} render={({ field }) => (
            <TextField {...field} select label="Type" size="small" sx={inputSx} error={!!errors.type} helperText={errors.type?.message}>
              <MenuItem value="MOVIE">Movie</MenuItem>
              <MenuItem value="TV_SERIES">Series</MenuItem>
            </TextField>
          )} />

          {/* TMDB ID */}
          <Controller name="tmdbId" control={control} render={({ field }) => (
            <TextField {...field} label="TMDB ID" type="number" size="small" sx={inputSx} error={!!errors.tmdbId} helperText={errors.tmdbId?.message} />
          )} />

          <Divider sx={{ borderColor:'rgba(0,0,0,0.07)' }} />

          {/* Tags section */}
          <Box>
            <Typography sx={{ fontSize:12, color:'rgba(15,23,42,0.45)', textTransform:'uppercase', letterSpacing:.6, mb:1 }}>Tags</Typography>
            <Box sx={{ display:'flex', flexWrap:'wrap', gap:.75 }}>
              {currentTags.map(tagType => (
                <Chip
                  key={tagType}
                  label={tagType.replace(/_/g,' ')}
                  size="small"
                  onDelete={() => doRemoveTag(tagType)}
                  deleteIcon={<DeleteIcon sx={{ fontSize:'12px !important' }} />}
                  sx={{ bgcolor:`${TAG_COLORS[tagType] ?? '#0d9488'}18`, color: TAG_COLORS[tagType] ?? '#0d9488', border:`1px solid ${TAG_COLORS[tagType] ?? '#0d9488'}44`, fontWeight:700, fontSize:11 }}
                />
              ))}
              {currentTags.length === 0 && (
                <Typography sx={{ fontSize:12, color:'rgba(15,23,42,0.35)' }}>No tags assigned</Typography>
              )}
            </Box>

            {availableTags.length > 0 && (
              <Box sx={{ mt:1.5 }}>
                <Typography sx={{ fontSize:11, color:'rgba(15,23,42,0.4)', mb:.75 }}>Add tag:</Typography>
                <Box sx={{ display:'flex', flexWrap:'wrap', gap:.5 }}>
                  {availableTags.map(t => (
                    <Box key={t} onClick={() => doAddTag({ tagType: t })}
                      sx={{ px:1.25, py:.35, borderRadius:99, border:`1px solid ${TAG_COLORS[t]}66`, color:TAG_COLORS[t], fontSize:11, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:.5, '&:hover':{ bgcolor:`${TAG_COLORS[t]}18` }, transition:'all .15s' }}>
                      {addingTag ? <CircularProgress size={10} color="inherit" /> : <AddIcon sx={{ fontSize:12 }} />}
                      {t.replace(/_/g,' ')}
                    </Box>
                  ))}
                </Box>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px:3, pb:2 }}>
          <Button onClick={onClose} sx={{ color:'rgba(15,23,42,0.55)' }}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={updating} sx={{ bgcolor:'#0d9488','&:hover':{ bgcolor:'#0f766e' } }}>
            {updating ? <CircularProgress size={18} color="inherit" /> : 'Save'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
