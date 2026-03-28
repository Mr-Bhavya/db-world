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
import { updateRecord, createTag, deleteTag } from '../api/adminApi';
import { updateRecordSchema } from '../schemas/recordSchemas';

const ALL_TAGS   = ['FEATURED','NEW_RELEASE','TRENDING','EDITOR_PICK','SHOW_ON_TOP','RECENTLY_ADDED','TOP_10'];
const TAG_COLORS = { FEATURED:'#f59e0b', NEW_RELEASE:'#10b981', TRENDING:'#ef4444', EDITOR_PICK:'#8b5cf6', SHOW_ON_TOP:'#6366f1', RECENTLY_ADDED:'#06b6d4', TOP_10:'#ec4899' };
const inputSx    = { '& .MuiOutlinedInput-root':{ bgcolor:'rgba(255,255,255,0.04)', color:'#fff', '& fieldset':{ borderColor:'rgba(255,255,255,0.1)' }, '&:hover fieldset':{ borderColor:'rgba(255,255,255,0.2)' }, '&.Mui-focused fieldset':{ borderColor:'#6366f1' } }, '& .MuiInputLabel-root':{ color:'rgba(255,255,255,0.5)' }, '& .MuiFormHelperText-root':{ color:'#ef4444' } };

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

  // Update record details
  const { mutate: doUpdate, isPending: updating } = useMutation({
    mutationFn: (d) => updateRecord(record.recordId, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey:['records'] }); enqueueSnackbar('Record updated', { variant:'success' }); onClose(); },
    onError: (e) => enqueueSnackbar(e?.response?.data?.message ?? 'Update failed', { variant:'error' }),
  });

  // Add tag
  const { mutate: doAddTag, isPending: addingTag } = useMutation({
    mutationFn: ({ tagType }) => createTag(record.recordId, { tagType, priority: 0 }),
    onSuccess: () => { qc.invalidateQueries({ queryKey:['records'] }); enqueueSnackbar('Tag added', { variant:'success', autoHideDuration:1500 }); },
    onError: () => enqueueSnackbar('Failed to add tag', { variant:'error' }),
  });

  // Remove tag
  const { mutate: doRemoveTag } = useMutation({
    mutationFn: (tagId) => deleteTag(tagId),
    onSuccess: () => { qc.invalidateQueries({ queryKey:['records'] }); },
    onError: () => enqueueSnackbar('Failed to remove tag', { variant:'error' }),
  });

  const currentTags    = record?.tags ?? [];
  const currentTypes   = currentTags.map(t => t.tagType);
  const availableTags  = ALL_TAGS.filter(t => !currentTypes.includes(t));

  if (!record) return null;

  return (
    <Dialog open={open} onClose={onClose} PaperProps={{ sx:{ bgcolor:'#0d0d18', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', width:'100%', maxWidth:520 } }}>
      <DialogTitle sx={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        Edit Record — <Box component="span" sx={{ color:'rgba(255,255,255,0.5)', fontSize:14, fontWeight:400, ml:.5 }}>{record.name}</Box>
        <IconButton onClick={onClose} sx={{ color:'rgba(255,255,255,0.5)' }}><CloseIcon /></IconButton>
      </DialogTitle>
      <form onSubmit={handleSubmit(d => doUpdate(d))}>
        <DialogContent sx={{ display:'flex', flexDirection:'column', gap:2 }}>
          {/* Type */}
          <Controller name="type" control={control} render={({ field }) => (
            <TextField {...field} select label="Type" size="small" sx={inputSx} error={!!errors.type} helperText={errors.type?.message}>
              <MenuItem value="MOVIE">Movie</MenuItem>
              <MenuItem value="SERIES">Series</MenuItem>
            </TextField>
          )} />

          {/* TMDB ID */}
          <Controller name="tmdbId" control={control} render={({ field }) => (
            <TextField {...field} label="TMDB ID" type="number" size="small" sx={inputSx} error={!!errors.tmdbId} helperText={errors.tmdbId?.message} />
          )} />

          <Divider sx={{ borderColor:'rgba(255,255,255,0.06)' }} />

          {/* Tags section */}
          <Box>
            <Typography sx={{ fontSize:12, color:'rgba(255,255,255,0.4)', textTransform:'uppercase', letterSpacing:.6, mb:1 }}>Tags</Typography>
            <Box sx={{ display:'flex', flexWrap:'wrap', gap:.75 }}>
              {currentTags.map(tag => (
                <Chip
                  key={tag.id ?? tag.tagType}
                  label={tag.tagType.replace(/_/g,' ')}
                  size="small"
                  onDelete={() => doRemoveTag(tag.id)}
                  deleteIcon={<DeleteIcon sx={{ fontSize:'12px !important' }} />}
                  sx={{ bgcolor:`${TAG_COLORS[tag.tagType] ?? '#6366f1'}22`, color: TAG_COLORS[tag.tagType] ?? '#6366f1', border:`1px solid ${TAG_COLORS[tag.tagType] ?? '#6366f1'}44`, fontWeight:700, fontSize:11 }}
                />
              ))}
              {currentTags.length === 0 && (
                <Typography sx={{ fontSize:12, color:'rgba(255,255,255,0.3)' }}>No tags assigned</Typography>
              )}
            </Box>

            {/* Add tag */}
            {availableTags.length > 0 && (
              <Box sx={{ mt:1.5 }}>
                <Typography sx={{ fontSize:11, color:'rgba(255,255,255,0.35)', mb:.75 }}>Add tag:</Typography>
                <Box sx={{ display:'flex', flexWrap:'wrap', gap:.5 }}>
                  {availableTags.map(t => (
                    <Box key={t} onClick={() => doAddTag({ tagType: t })}
                      sx={{ px:1.25, py:.35, borderRadius:99, border:`1px solid ${TAG_COLORS[t]}44`, color:TAG_COLORS[t], fontSize:11, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:.5, '&:hover':{ bgcolor:`${TAG_COLORS[t]}22` }, transition:'all .15s' }}>
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
          <Button onClick={onClose} sx={{ color:'rgba(255,255,255,0.5)' }}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={updating} sx={{ bgcolor:'#6366f1','&:hover':{ bgcolor:'#5254cc' } }}>
            {updating ? <CircularProgress size={18} color="inherit" /> : 'Save'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
