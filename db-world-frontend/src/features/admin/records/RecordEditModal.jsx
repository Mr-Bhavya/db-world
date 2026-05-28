import { useState, useRef, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, MenuItem, Box, Typography,
  CircularProgress, IconButton, Chip, Divider, Alert,
  FormControlLabel, Checkbox,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useT, getSelectMenuProps } from '@shared/theme';
import { updateRecord, addRecordTag, removeRecordTag, searchTmdb } from '../api/adminApi';
import { createRecordSchema } from '../schemas/recordSchemas';
import { useTagDefs } from './useTagDefs';

const TMDB_IMG = 'https://image.tmdb.org/t/p/original';

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

  const [query,         setQuery]         = useState('');
  const [year,          setYear]          = useState('');
  const [results,       setResults]       = useState([]);
  const [selected,      setSelected]      = useState(null);
  const [searching,     setSearching]     = useState(false);
  const [searchError,   setSearchError]   = useState('');
  const [hideFromRails, setHideFromRails] = useState(false);
  const searchTimer = useRef(null);

  const { control, handleSubmit, watch, reset, formState: { errors } } = useForm({
    resolver: zodResolver(createRecordSchema),
    defaultValues: { type: 'MOVIE' },
  });
  const typeValue = watch('type');

  // Pre-populate search with record name when modal opens
  useEffect(() => {
    if (open && record) {
      reset({ type: record.type });
      setQuery(record.name ?? '');
      setYear('');
      setResults([]);
      setSelected(null);
      setSearchError('');
      setHideFromRails(Boolean(record.hideFromRails));
      if (record.name) {
        clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(() => doSearch(record.name, record.type, ''), 300);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, record]);

  useEffect(() => () => clearTimeout(searchTimer.current), []);

  const doSearch = async (q, type, y) => {
    if (!q.trim()) { setResults([]); return; }
    setSearching(true); setSearchError('');
    try {
      const data = await searchTmdb(type, q, y || undefined);
      setResults(Array.isArray(data) ? data : []);
    } catch { setSearchError('TMDB search failed'); }
    finally { setSearching(false); }
  };

  const handleQueryChange = (e) => {
    const v = e.target.value; setQuery(v); setSelected(null);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => doSearch(v, typeValue, year), 500);
  };

  const handleYearChange = (e) => {
    const v = e.target.value; setYear(v); setSelected(null);
    clearTimeout(searchTimer.current);
    if (query.trim()) searchTimer.current = setTimeout(() => doSearch(query, typeValue, v), 500);
  };

  const { mutate: doUpdate, isPending: updating } = useMutation({
    mutationFn: (d) => updateRecord(record.recordId, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['records'] });
      enqueueSnackbar('Record updated', { variant: 'success' });
      onClose();
    },
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

  const { autoTagTypes, manualTagDefs, tagColor, tagLabel } = useTagDefs();
  const currentTags   = parseTags(record?.tags);
  const availableTags = manualTagDefs.filter(d => !currentTags.includes(d.tagType));

  const onSubmit = (d) => {
    const tmdbId = selected?.id ?? record?.tmdbId;
    if (!tmdbId) { enqueueSnackbar('Please select a TMDB result', { variant: 'warning' }); return; }
    doUpdate({ type: d.type, tmdbId, hideFromRails });
  };

  if (!record) return null;

  return (
    <Dialog open={open} onClose={onClose}
      PaperProps={{ sx: { bgcolor: T.sidebar, border: `1px solid ${T.glassBorder}`, color: T.textPrimary, width: '100%', maxWidth: 580, borderRadius: 2 } }}>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 700, color: T.textPrimary }}>
        Edit Record
        <IconButton onClick={onClose} sx={{ color: T.textMuted }}><CloseIcon /></IconButton>
      </DialogTitle>
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>

          <Controller name="type" control={control} render={({ field }) => (
            <TextField {...field} select label="Type" size="small" sx={inputSx}
              SelectProps={{ MenuProps: getSelectMenuProps(T) }}
              error={!!errors.type} helperText={errors.type?.message}
              onChange={e => { field.onChange(e); setResults([]); setSelected(null); }}>
              <MenuItem value="MOVIE">Movie</MenuItem>
              <MenuItem value="TV_SERIES">Series</MenuItem>
            </TextField>
          )} />

          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField size="small" label="Search TMDB" value={query} onChange={handleQueryChange}
              sx={{ ...inputSx, flex: 1 }}
              InputProps={{ endAdornment: searching
                ? <CircularProgress size={16} sx={{ color: T.teal }} />
                : <SearchIcon sx={{ color: T.textFaint, fontSize: 18 }} /> }} />
            <TextField size="small" label="Year" value={year} onChange={handleYearChange}
              sx={{ ...inputSx, width: 90 }} inputProps={{ maxLength: 4 }} />
          </Box>

          {searchError && (
            <Alert severity="error" sx={{ bgcolor: T.errorBg, color: T.error, border: `1px solid ${T.error}44`, '& .MuiAlert-icon': { color: T.error } }}>{searchError}</Alert>
          )}

          {results.length > 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, maxHeight: 240, overflowY: 'auto',
              '&::-webkit-scrollbar': { width: 4 }, '&::-webkit-scrollbar-thumb': { bgcolor: T.scrollThumb, borderRadius: 2 } }}>
              {results.slice(0, 8).map(r => {
                const isSelected = selected?.id === r.id || (!selected && r.id === record.tmdbId);
                return (
                  <Box key={r.id} onClick={() => setSelected(isSelected && selected?.id === r.id ? null : r)}
                    sx={{
                      display: 'flex', gap: 1.5, p: 1.5, borderRadius: 1.5, cursor: 'pointer', transition: 'all .15s',
                      border: `1px solid ${isSelected ? T.teal : T.glassBorder}`,
                      bgcolor: isSelected ? T.tealBg : T.glass,
                      '&:hover': { borderColor: T.teal, bgcolor: T.tealBg },
                    }}>
                    <Box sx={{ width: 40, height: 60, borderRadius: 1, overflow: 'hidden', flexShrink: 0, bgcolor: T.glass }}>
                      {r.poster_path && <Box component="img" src={`${TMDB_IMG}${r.poster_path}`} alt={r.title ?? r.name} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 600, fontSize: 13, color: T.textPrimary }}>{r.title ?? r.name}</Typography>
                      <Box sx={{ display: 'flex', gap: 1, mt: .25 }}>
                        {(r.release_date ?? r.first_air_date) && (
                          <Chip label={(r.release_date ?? r.first_air_date).slice(0, 4)} size="small" sx={{ height: 16, fontSize: 10, bgcolor: T.glass, color: T.textMuted }} />
                        )}
                        {r.vote_average > 0 && (
                          <Chip label={`★ ${r.vote_average.toFixed(1)}`} size="small" sx={{ height: 16, fontSize: 10, bgcolor: `${T.warning}18`, color: T.warning }} />
                        )}
                        <Chip label={`ID: ${r.id}`} size="small" sx={{ height: 16, fontSize: 10, bgcolor: T.glass, color: T.textFaint }} />
                      </Box>
                    </Box>
                    {isSelected && <CheckCircleIcon sx={{ color: T.teal, flexShrink: 0, fontSize: 18 }} />}
                  </Box>
                );
              })}
            </Box>
          )}

          {(selected || record.tmdbId) && (
            <Alert severity="success" icon={<CheckCircleIcon />}
              sx={{ bgcolor: T.successBg, color: T.success, border: `1px solid ${T.success}44`, '& .MuiAlert-icon': { color: T.success } }}>
              {selected
                ? <>Selected: <b>{selected.title ?? selected.name}</b> (TMDB ID: {selected.id})</>
                : <>Current TMDB ID: <b>{record.tmdbId}</b> — search above to change</>
              }
            </Alert>
          )}

          <Divider sx={{ borderColor: T.border }} />

          <Box>
            <Typography sx={{ fontSize: 12, color: T.textFaint, textTransform: 'uppercase', letterSpacing: .6, mb: 1 }}>Tags</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: .75 }}>
              {currentTags.map(tagType => {
                const isAuto = autoTagTypes.has(tagType);
                const color  = tagColor(tagType);
                return (
                  <Chip
                    key={tagType}
                    label={tagLabel(tagType)}
                    size="small"
                    onDelete={isAuto ? undefined : () => doRemoveTag(tagType)}
                    deleteIcon={isAuto ? undefined : <DeleteIcon sx={{ fontSize: '12px !important' }} />}
                    sx={{
                      bgcolor: `${color}18`, color,
                      border: `1px solid ${color}44`, fontWeight: 700, fontSize: 11,
                      opacity: isAuto ? 0.7 : 1,
                    }}
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
                  {availableTags.map(def => {
                    const color = tagColor(def.tagType);
                    return (
                      <Box key={def.tagType} onClick={() => doAddTag({ tagType: def.tagType })}
                        sx={{ px: 1.25, py: .35, borderRadius: 99, border: `1px solid ${color}66`,
                          color, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: .5,
                          '&:hover': { bgcolor: `${color}18` }, transition: 'all .15s' }}>
                        {addingTag ? <CircularProgress size={10} color="inherit" /> : <AddIcon sx={{ fontSize: 12 }} />}
                        {def.displayName ?? tagLabel(def.tagType)}
                      </Box>
                    );
                  })}
                </Box>
              </Box>
            )}
          </Box>

          <FormControlLabel
            sx={{ color: T.textMuted, mx: 0, mt: 1 }}
            control={
              <Checkbox
                size="small"
                checked={hideFromRails}
                onChange={(e) => setHideFromRails(e.target.checked)}
                sx={{ color: T.textMuted, '&.Mui-checked': { color: T.teal } }}
              />
            }
            label={
              <Box>
                <Typography sx={{ fontSize: 13, color: T.textPrimary, fontWeight: 600 }}>
                  Hide from rails / home page
                </Typography>
                <Typography sx={{ fontSize: 11, color: T.textFaint }}>
                  Record still appears in search results. Useful for 18+ titles or library-only deep cuts.
                </Typography>
              </Box>
            }
          />
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
