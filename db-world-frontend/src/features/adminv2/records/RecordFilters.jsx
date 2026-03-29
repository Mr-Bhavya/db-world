// db-world-frontend/src/features/adminv2/records/RecordFilters.jsx
import { useCallback, useEffect, useRef } from 'react';
import { Box, TextField, ToggleButton, ToggleButtonGroup, InputAdornment, IconButton, Tooltip, MenuItem } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import TableRowsIcon from '@mui/icons-material/TableRows';
import GridViewIcon from '@mui/icons-material/GridView';
import FilterListOffIcon from '@mui/icons-material/FilterListOff';
import AddIcon from '@mui/icons-material/Add';
import { useRecordStore } from '../stores/useRecordStore';

const inputSx = {
  minWidth: 120,
  '& .MuiOutlinedInput-root': {
    bgcolor: '#ffffff', color: '#0f172a', borderRadius: 1.5,
    '& fieldset': { borderColor: 'rgba(0,0,0,0.15)' },
    '&:hover fieldset': { borderColor: 'rgba(0,0,0,0.3)' },
    '&.Mui-focused fieldset': { borderColor: '#0d9488' },
  },
  '& .MuiInputLabel-root': { color: 'rgba(15,23,42,0.5)', fontSize: 12 },
  '& .MuiSelect-icon': { color: 'rgba(15,23,42,0.45)' },
  '& .MuiInputBase-input': { color: '#0f172a' },
};
const toggleSx = {
  bgcolor: '#ffffff', border: '1px solid rgba(0,0,0,0.12) !important',
  borderRadius: '8px !important', color: 'rgba(15,23,42,0.55)',
  '&.Mui-selected': { bgcolor: 'rgba(13,148,136,0.1)', color: '#0d9488' },
  '&:hover': { bgcolor: 'rgba(13,148,136,0.06)' },
};

export default function RecordFilters({ onAdd }) {
  const { filters, setFilter, clearFilters, viewMode, setViewMode } = useRecordStore();
  const searchTimer = useRef(null);

  useEffect(() => () => clearTimeout(searchTimer.current), []);

  const debouncedSet = useCallback((key, val) => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setFilter(key, val), 350);
  }, [setFilter]);

  const hasFilters = Object.values(filters).some(v => v !== '');

  return (
    <Box sx={{
      display: 'flex', flexWrap: 'wrap', gap: 1,
      p: { xs: '8px 12px', md: '10px 16px' },
      borderBottom: '1px solid rgba(0,0,0,0.07)',
      alignItems: 'center',
      bgcolor: '#f8fffe',
    }}>
      {/* Name search */}
      <TextField size="small" placeholder="Search name…" defaultValue={filters.name}
        onChange={e => debouncedSet('name', e.target.value)} sx={{ ...inputSx, flex: '1 1 180px' }}
        InputProps={{
          startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: 'rgba(15,23,42,0.3)', fontSize: 16 }} /></InputAdornment>,
        }} />

      {/* Type filter */}
      <TextField select size="small" label="Type" value={filters.type} onChange={e => setFilter('type', e.target.value)} sx={{ ...inputSx, minWidth: 130 }}>
        <MenuItem value="">All</MenuItem>
        <MenuItem value="MOVIE">Movie</MenuItem>
        <MenuItem value="TV_SERIES">Series</MenuItem>
      </TextField>

      {/* Year */}
      <TextField size="small" label="Year" type="number" defaultValue={filters.year}
        onChange={e => debouncedSet('year', e.target.value)} sx={{ ...inputSx, width: 100 }}
        inputProps={{ min: 1900, max: 2100 }} />

      {/* TMDB ID */}
      <TextField size="small" label="TMDB ID" type="number" defaultValue={filters.tmdbId}
        onChange={e => debouncedSet('tmdbId', e.target.value)} sx={{ ...inputSx, width: 110 }} />

      {/* Clear filters */}
      {hasFilters && (
        <Tooltip title="Clear filters">
          <IconButton onClick={clearFilters} size="small" sx={{ color: 'rgba(15,23,42,0.4)', '&:hover': { color: '#ef4444' } }}>
            <FilterListOffIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}

      <Box sx={{ flex: 1 }} />

      {/* View toggle */}
      <ToggleButtonGroup size="small" value={viewMode} exclusive onChange={(_, v) => v && setViewMode(v)}>
        <ToggleButton value="table" sx={toggleSx}><Tooltip title="Table"><TableRowsIcon fontSize="small" /></Tooltip></ToggleButton>
        <ToggleButton value="grid"  sx={toggleSx}><Tooltip title="Grid"><GridViewIcon fontSize="small" /></Tooltip></ToggleButton>
      </ToggleButtonGroup>

      {/* Add record */}
      <Tooltip title="Add Record">
        <IconButton onClick={onAdd} sx={{ bgcolor: '#0d9488', color: '#fff', borderRadius: 2, '&:hover': { bgcolor: '#0f766e' } }}>
          <AddIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  );
}
