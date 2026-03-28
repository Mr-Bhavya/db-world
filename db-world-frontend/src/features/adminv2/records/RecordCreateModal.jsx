// db-world-frontend/src/features/adminv2/records/RecordCreateModal.jsx
import { useState, useRef } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, MenuItem, Box, Typography, CircularProgress, IconButton, Chip, Alert } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { createRecord, searchTmdb } from '../api/adminApi';

const TMDB_IMG   = 'https://image.tmdb.org/t/p/w185';
const inputSx    = { '& .MuiOutlinedInput-root':{ bgcolor:'rgba(255,255,255,0.04)', color:'#fff', '& fieldset':{ borderColor:'rgba(255,255,255,0.1)' }, '&:hover fieldset':{ borderColor:'rgba(255,255,255,0.2)' }, '&.Mui-focused fieldset':{ borderColor:'#6366f1' } }, '& .MuiInputLabel-root':{ color:'rgba(255,255,255,0.5)' } };

export default function RecordCreateModal({ open, onClose }) {
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const [type,        setType]        = useState('MOVIE');
  const [query,       setQuery]       = useState('');
  const [results,     setResults]     = useState([]);
  const [selected,    setSelected]    = useState(null);
  const [searching,   setSearching]   = useState(false);
  const [searchError, setSearchError] = useState('');
  const searchTimer = useRef(null);

  const doSearch = async (q) => {
    if (!q.trim()) { setResults([]); return; }
    setSearching(true); setSearchError('');
    try { setResults(await searchTmdb(type, q)); }
    catch { setSearchError('TMDB search failed'); }
    finally { setSearching(false); }
  };

  const handleQueryChange = (e) => {
    const v = e.target.value; setQuery(v); setSelected(null);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => doSearch(v), 500);
  };

  const { mutate, isPending } = useMutation({
    mutationFn: () => createRecord({ type, tmdbId: selected.id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey:['records'] });
      enqueueSnackbar('Record created', { variant:'success' });
      handleClose();
    },
    onError: (e) => enqueueSnackbar(e?.response?.data?.message ?? 'Create failed', { variant:'error' }),
  });

  const handleClose = () => {
    setType('MOVIE'); setQuery(''); setResults([]); setSelected(null); setSearchError('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} PaperProps={{ sx:{ bgcolor:'#0d0d18', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', width:'100%', maxWidth:580 } }}>
      <DialogTitle sx={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        Add Record
        <IconButton onClick={handleClose} sx={{ color:'rgba(255,255,255,0.5)' }}><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent sx={{ display:'flex', flexDirection:'column', gap:2 }}>
        {/* Type select */}
        <TextField select label="Type" value={type} onChange={e => { setType(e.target.value); setResults([]); setSelected(null); }} size="small" sx={inputSx}>
          <MenuItem value="MOVIE">Movie</MenuItem>
          <MenuItem value="SERIES">Series</MenuItem>
        </TextField>

        {/* TMDB search */}
        <TextField size="small" label="Search TMDB" value={query} onChange={handleQueryChange} sx={inputSx}
          InputProps={{ endAdornment: searching ? <CircularProgress size={16} sx={{ color:'rgba(255,255,255,0.4)' }} /> : <SearchIcon sx={{ color:'rgba(255,255,255,0.3)', fontSize:18 }} /> }} />

        {searchError && <Alert severity="error" sx={{ bgcolor:'rgba(239,68,68,0.1)', color:'#ef4444' }}>{searchError}</Alert>}

        {/* Results */}
        {results.length > 0 && (
          <Box sx={{ display:'flex', flexDirection:'column', gap:1, maxHeight:320, overflowY:'auto' }}>
            {results.slice(0,10).map(r => {
              const isSelected = selected?.id === r.id;
              return (
                <Box key={r.id} onClick={() => setSelected(isSelected ? null : r)}
                  sx={{ display:'flex', gap:1.5, p:1.5, borderRadius:1.5, border:`1px solid ${isSelected ? '#6366f1' : 'rgba(255,255,255,0.06)'}`, bgcolor: isSelected ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.03)', cursor:'pointer', '&:hover':{ borderColor:'rgba(99,102,241,0.4)' }, transition:'all .15s' }}>
                  <Box sx={{ width:46, height:68, borderRadius:1, overflow:'hidden', flexShrink:0, bgcolor:'rgba(255,255,255,0.06)' }}>
                    {r.posterPath && <Box component="img" src={`${TMDB_IMG}${r.posterPath}`} alt={r.title ?? r.name} sx={{ width:'100%', height:'100%', objectFit:'cover' }} />}
                  </Box>
                  <Box sx={{ flex:1, minWidth:0 }}>
                    <Typography sx={{ fontWeight:600, fontSize:14, color:'#fff' }}>{r.title ?? r.name}</Typography>
                    <Box sx={{ display:'flex', gap:1, mt:.25 }}>
                      {(r.releaseDate ?? r.firstAirDate) && <Chip label={(r.releaseDate ?? r.firstAirDate).slice(0,4)} size="small" sx={{ height:18, fontSize:10, bgcolor:'rgba(255,255,255,0.08)', color:'rgba(255,255,255,0.6)' }} />}
                      {r.voteAverage > 0 && <Chip label={`★ ${r.voteAverage.toFixed(1)}`} size="small" sx={{ height:18, fontSize:10, bgcolor:'rgba(245,158,11,0.15)', color:'#f59e0b' }} />}
                    </Box>
                    <Typography sx={{ fontSize:12, color:'rgba(255,255,255,0.45)', mt:.5, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>{r.overview}</Typography>
                  </Box>
                  {isSelected && <CheckCircleIcon sx={{ color:'#6366f1', flexShrink:0 }} />}
                </Box>
              );
            })}
          </Box>
        )}

        {selected && (
          <Alert severity="info" icon={<CheckCircleIcon />} sx={{ bgcolor:'rgba(99,102,241,0.1)', color:'#6366f1', '& .MuiAlert-icon':{ color:'#6366f1' } }}>
            Selected: <b>{selected.title ?? selected.name}</b> (TMDB ID: {selected.id})
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px:3, pb:2 }}>
        <Button onClick={handleClose} sx={{ color:'rgba(255,255,255,0.5)' }}>Cancel</Button>
        <Button onClick={() => mutate()} disabled={!selected || isPending} variant="contained" sx={{ bgcolor:'#6366f1','&:hover':{ bgcolor:'#5254cc' } }}>
          {isPending ? <CircularProgress size={18} color="inherit" /> : 'Add Record'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
