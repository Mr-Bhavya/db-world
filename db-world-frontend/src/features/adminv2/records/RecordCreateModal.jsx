// db-world-frontend/src/features/adminv2/records/RecordCreateModal.jsx
import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, MenuItem, Box, Typography, CircularProgress, IconButton, Chip, Alert } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { createRecord, searchTmdb } from '../api/adminApi';
import { createRecordSchema } from '../schemas/recordSchemas';

const TMDB_IMG = 'https://image.tmdb.org/t/p/w185';
const inputSx  = {
  '& .MuiOutlinedInput-root': { bgcolor:'rgba(0,0,0,0.03)', color:'#0f172a', '& fieldset':{ borderColor:'rgba(0,0,0,0.15)' }, '&:hover fieldset':{ borderColor:'rgba(0,0,0,0.3)' }, '&.Mui-focused fieldset':{ borderColor:'#0d9488' } },
  '& .MuiInputLabel-root': { color:'rgba(15,23,42,0.5)' },
  '& .MuiFormHelperText-root': { color:'#ef4444' },
  '& .MuiSelect-icon': { color:'rgba(15,23,42,0.45)' },
};

export default function RecordCreateModal({ open, onClose }) {
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const [query,       setQuery]       = useState('');
  const [year,        setYear]        = useState('');
  const [results,     setResults]     = useState([]);
  const [selected,    setSelected]    = useState(null);
  const [searching,   setSearching]   = useState(false);
  const [searchError, setSearchError] = useState('');
  const searchTimer = useRef(null);

  useEffect(() => () => clearTimeout(searchTimer.current), []);

  const { control, handleSubmit, watch, reset, formState:{ errors } } = useForm({
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
    }
    catch { setSearchError('TMDB search failed'); }
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
    mutationFn: (d) => createRecord({ type: d.type, tmdbId: d.tmdbId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey:['records'] });
      enqueueSnackbar('Record created', { variant:'success' });
      handleClose();
    },
    onError: (e) => enqueueSnackbar(e?.response?.data?.message ?? 'Create failed', { variant:'error' }),
  });

  const onSubmit = (d) => {
    if (!selected) { enqueueSnackbar('Please select a TMDB result', { variant:'warning' }); return; }
    mutate({ type: d.type, tmdbId: selected.id });
  };

  const handleClose = () => {
    setQuery(''); setYear(''); setResults([]); setSelected(null); setSearchError('');
    reset({ type: 'MOVIE' });
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} PaperProps={{ sx:{ bgcolor:'#ffffff', border:'1px solid rgba(0,0,0,0.1)', color:'#0f172a', width:'100%', maxWidth:580, borderRadius:2 } }}>
      <DialogTitle sx={{ display:'flex', justifyContent:'space-between', alignItems:'center', fontWeight:700, color:'#0f172a' }}>
        Add Record
        <IconButton onClick={handleClose} sx={{ color:'rgba(15,23,42,0.4)' }}><CloseIcon /></IconButton>
      </DialogTitle>
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogContent sx={{ display:'flex', flexDirection:'column', gap:2 }}>
          {/* Type select */}
          <Controller name="type" control={control} render={({ field }) => (
            <TextField {...field} select label="Type" size="small" sx={inputSx} error={!!errors.type} helperText={errors.type?.message}
              onChange={e => { field.onChange(e); setResults([]); setSelected(null); }}>
              <MenuItem value="MOVIE">Movie</MenuItem>
              <MenuItem value="TV_SERIES">Series</MenuItem>
            </TextField>
          )} />

          {/* TMDB search */}
          <Box sx={{ display:'flex', gap:1 }}>
            <TextField size="small" label="Search TMDB" value={query} onChange={handleQueryChange} sx={{ ...inputSx, flex:1 }}
              InputProps={{ endAdornment: searching ? <CircularProgress size={16} sx={{ color:'#0d9488' }} /> : <SearchIcon sx={{ color:'rgba(15,23,42,0.3)', fontSize:18 }} /> }} />
            <TextField size="small" label="Year" value={year} onChange={handleYearChange} sx={{ ...inputSx, width:90 }}
              inputProps={{ maxLength:4 }} />
          </Box>

          {searchError && <Alert severity="error">{searchError}</Alert>}

          {/* Results */}
          {results.length > 0 && (
            <Box sx={{ display:'flex', flexDirection:'column', gap:1, maxHeight:320, overflowY:'auto' }}>
              {results.slice(0,10).map(r => {
                const isSelected = selected?.id === r.id;
                return (
                  <Box key={r.id} onClick={() => setSelected(isSelected ? null : r)}
                    sx={{ display:'flex', gap:1.5, p:1.5, borderRadius:1.5, border:`1px solid ${isSelected ? '#0d9488' : 'rgba(0,0,0,0.1)'}`, bgcolor: isSelected ? 'rgba(13,148,136,0.06)' : '#fafafa', cursor:'pointer', '&:hover':{ borderColor:'rgba(13,148,136,0.4)', bgcolor:'rgba(13,148,136,0.03)' }, transition:'all .15s' }}>
                    <Box sx={{ width:46, height:68, borderRadius:1, overflow:'hidden', flexShrink:0, bgcolor:'rgba(0,0,0,0.06)' }}>
                      {r.posterPath && <Box component="img" src={`${TMDB_IMG}${r.posterPath}`} alt={r.title ?? r.name} sx={{ width:'100%', height:'100%', objectFit:'cover' }} />}
                    </Box>
                    <Box sx={{ flex:1, minWidth:0 }}>
                      <Typography sx={{ fontWeight:600, fontSize:14, color:'#0f172a' }}>{r.title ?? r.name}</Typography>
                      <Box sx={{ display:'flex', gap:1, mt:.25 }}>
                        {(r.releaseDate ?? r.firstAirDate) && <Chip label={(r.releaseDate ?? r.firstAirDate).slice(0,4)} size="small" sx={{ height:18, fontSize:10, bgcolor:'rgba(0,0,0,0.06)', color:'rgba(15,23,42,0.65)' }} />}
                        {r.voteAverage > 0 && <Chip label={`★ ${r.voteAverage.toFixed(1)}`} size="small" sx={{ height:18, fontSize:10, bgcolor:'rgba(245,158,11,0.12)', color:'#b45309' }} />}
                      </Box>
                      <Typography sx={{ fontSize:12, color:'rgba(15,23,42,0.5)', mt:.5, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>{r.overview}</Typography>
                    </Box>
                    {isSelected && <CheckCircleIcon sx={{ color:'#0d9488', flexShrink:0 }} />}
                  </Box>
                );
              })}
            </Box>
          )}

          {selected && (
            <Alert severity="success" icon={<CheckCircleIcon />} sx={{ bgcolor:'rgba(13,148,136,0.08)', color:'#0d9488', border:'1px solid rgba(13,148,136,0.2)', '& .MuiAlert-icon':{ color:'#0d9488' } }}>
              Selected: <b>{selected.title ?? selected.name}</b> (TMDB ID: {selected.id})
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ px:3, pb:2 }}>
          <Button onClick={handleClose} sx={{ color:'rgba(15,23,42,0.55)' }}>Cancel</Button>
          <Button type="submit" disabled={!selected || isPending} variant="contained" sx={{ bgcolor:'#0d9488','&:hover':{ bgcolor:'#0f766e' } }}>
            {isPending ? <CircularProgress size={18} color="inherit" /> : 'Add Record'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
