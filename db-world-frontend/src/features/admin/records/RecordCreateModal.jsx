import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, MenuItem, Box, Typography, CircularProgress, IconButton, Chip, Alert, FormControlLabel, Checkbox } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useT, getSelectMenuProps } from '@shared/theme';
import { createRecord, searchTmdb } from '../api/adminApi';
import { createRecordSchema } from '../schemas/recordSchemas';

const TMDB_IMG = 'https://image.tmdb.org/t/p/original';

export default function RecordCreateModal({ open, onClose }) {
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

  useEffect(() => () => clearTimeout(searchTimer.current), []);

  const { control, handleSubmit, watch, reset, formState: { errors } } = useForm({
    resolver: zodResolver(createRecordSchema),
    defaultValues: { type: 'MOVIE' },
  });
  const typeValue = watch('type');

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

  const { mutate, isPending } = useMutation({
    mutationFn: (d) => createRecord({ type: d.type, tmdbId: d.tmdbId, hideFromRails: d.hideFromRails }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['records'] }); enqueueSnackbar('Record created', { variant: 'success' }); handleClose(); },
    onError: (e) => enqueueSnackbar(e?.response?.data?.message ?? 'Create failed', { variant: 'error' }),
  });

  const onSubmit = (d) => {
    if (!selected) { enqueueSnackbar('Please select a TMDB result', { variant: 'warning' }); return; }
    mutate({ type: d.type, tmdbId: selected.id, hideFromRails });
  };

  const handleClose = () => {
    setQuery(''); setYear(''); setResults([]); setSelected(null); setSearchError('');
    setHideFromRails(false);
    reset({ type: 'MOVIE' });
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose}
      PaperProps={{ sx: { bgcolor: T.sidebar, border: `1px solid ${T.glassBorder}`, color: T.textPrimary, width: '100%', maxWidth: 580, borderRadius: 2 } }}>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 700, color: T.textPrimary }}>
        Add Record
        <IconButton onClick={handleClose} sx={{ color: T.textMuted }}><CloseIcon /></IconButton>
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

          {searchError && <Alert severity="error" sx={{ bgcolor: T.errorBg, color: T.error, border: `1px solid ${T.error}44`, '& .MuiAlert-icon': { color: T.error } }}>{searchError}</Alert>}

          {results.length > 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, maxHeight: 300, overflowY: 'auto',
              '&::-webkit-scrollbar': { width: 4 }, '&::-webkit-scrollbar-thumb': { bgcolor: T.scrollThumb, borderRadius: 2 } }}>
              {results.slice(0, 10).map(r => {
                const isSelected = selected?.id === r.id;
                return (
                  <Box key={r.id} onClick={() => setSelected(isSelected ? null : r)}
                    sx={{
                      display: 'flex', gap: 1.5, p: 1.5, borderRadius: 1.5, cursor: 'pointer', transition: 'all .15s',
                      border: `1px solid ${isSelected ? T.teal : T.glassBorder}`,
                      bgcolor: isSelected ? T.tealBg : T.glass,
                      '&:hover': { borderColor: T.teal, bgcolor: T.tealBg },
                    }}>
                    <Box sx={{ width: 44, height: 66, borderRadius: 1, overflow: 'hidden', flexShrink: 0, bgcolor: T.glass }}>
                      {r.poster_path && <Box component="img" src={`${TMDB_IMG}${r.poster_path}`} alt={r.title ?? r.name} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 600, fontSize: 14, color: T.textPrimary }}>{r.title ?? r.name}</Typography>
                      <Box sx={{ display: 'flex', gap: 1, mt: .25 }}>
                        {(r.release_date ?? r.first_air_date) && <Chip label={(r.release_date ?? r.first_air_date).slice(0, 4)} size="small" sx={{ height: 18, fontSize: 10, bgcolor: T.glass, color: T.textMuted }} />}
                        {r.vote_average > 0 && <Chip label={`★ ${r.vote_average.toFixed(1)}`} size="small" sx={{ height: 18, fontSize: 10, bgcolor: `${T.warning}18`, color: T.warning }} />}
                      </Box>
                      <Typography sx={{ fontSize: 12, color: T.textMuted, mt: .5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{r.overview}</Typography>
                    </Box>
                    {isSelected && <CheckCircleIcon sx={{ color: T.teal, flexShrink: 0 }} />}
                  </Box>

                );
              })}
            </Box>
          )}

          {selected && (
            <Alert severity="success" icon={<CheckCircleIcon />}
              sx={{ bgcolor: T.successBg, color: T.success, border: `1px solid ${T.success}44`, '& .MuiAlert-icon': { color: T.success } }}>
              Selected: <b>{selected.title ?? selected.name}</b> (TMDB ID: {selected.id})
            </Alert>
          )}

          <FormControlLabel
            sx={{ color: T.textMuted, mx: 0, mt: -0.5 }}
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
          <Button onClick={handleClose} sx={{ color: T.textMuted }}>Cancel</Button>
          <Button type="submit" disabled={!selected || isPending} variant="contained"
            sx={{ bgcolor: T.teal, '&:hover': { bgcolor: T.tealHover }, fontWeight: 600 }}>
            {isPending ? <CircularProgress size={18} color="inherit" /> : 'Add Record'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
