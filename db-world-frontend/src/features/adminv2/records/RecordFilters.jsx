import { useCallback, useEffect, useRef } from 'react';
import { Box, TextField, ToggleButton, ToggleButtonGroup, InputAdornment, IconButton, Tooltip, MenuItem } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import TableRowsIcon from '@mui/icons-material/TableRows';
import GridViewIcon from '@mui/icons-material/GridView';
import FilterListOffIcon from '@mui/icons-material/FilterListOff';
import AddIcon from '@mui/icons-material/Add';
import { useT, getSelectMenuProps } from '@shared/theme';
import { useRecordStore } from '../stores/useRecordStore';

export default function RecordFilters({ onAdd }) {
  const T = useT();
  const { filters, setFilter, clearFilters, viewMode, setViewMode } = useRecordStore();
  const searchTimer = useRef(null);

  useEffect(() => () => clearTimeout(searchTimer.current), []);

  const debouncedSet = useCallback((key, val) => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setFilter(key, val), 350);
  }, [setFilter]);

  const hasFilters = Object.values(filters).some(v => v !== '');

  const inputSx = {
    minWidth: 110,
    '& .MuiOutlinedInput-root': {
      bgcolor: T.inputBg, color: T.textPrimary, borderRadius: 1.5,
      '& fieldset':             { borderColor: T.glassBorder },
      '&:hover fieldset':       { borderColor: T.borderHover },
      '&.Mui-focused fieldset': { borderColor: T.teal },
    },
    '& .MuiInputLabel-root':             { color: T.textMuted, fontSize: 12 },
    '& .MuiInputLabel-root.Mui-focused': { color: T.teal },
    '& .MuiSelect-icon':                 { color: T.textMuted },
    '& .MuiInputBase-input':             { color: T.textPrimary },
  };

  const toggleSx = {
    bgcolor: T.glass, border: `1px solid ${T.glassBorder} !important`,
    borderRadius: '8px !important', color: T.textMuted,
    '&.Mui-selected': { bgcolor: T.tealBg, color: T.teal, borderColor: `${T.teal}40 !important` },
    '&:hover': { bgcolor: T.tealBg },
  };

  return (
    <Box sx={{
      display: 'flex', flexWrap: 'wrap', gap: 1,
      p: { xs: '8px 12px', md: '10px 16px' },
      borderBottom: `1px solid ${T.border}`,
      alignItems: 'center',
      bgcolor: T.sidebar,
      flexShrink: 0,
    }}>
      <TextField size="small" placeholder="Search name…" defaultValue={filters.name}
        onChange={e => debouncedSet('name', e.target.value)} sx={{ ...inputSx, flex: '1 1 160px' }}
        InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: T.textFaint, fontSize: 15 }} /></InputAdornment> }} />

      <TextField select size="small" label="Type" value={filters.type}
        onChange={e => setFilter('type', e.target.value)}
        sx={{ ...inputSx, minWidth: 120 }}
        SelectProps={{ MenuProps: getSelectMenuProps(T) }}>
        <MenuItem value="">All</MenuItem>
        <MenuItem value="MOVIE">Movie</MenuItem>
        <MenuItem value="TV_SERIES">Series</MenuItem>
      </TextField>

      <TextField size="small" label="Year" type="number" defaultValue={filters.year}
        onChange={e => debouncedSet('year', e.target.value)} sx={{ ...inputSx, width: 90 }}
        inputProps={{ min: 1900, max: 2100 }} />

      <TextField size="small" label="TMDB ID" type="number" defaultValue={filters.tmdbId}
        onChange={e => debouncedSet('tmdbId', e.target.value)} sx={{ ...inputSx, width: 100 }} />

      {hasFilters && (
        <Tooltip title="Clear filters">
          <IconButton onClick={clearFilters} size="small" sx={{ color: T.textMuted, '&:hover': { color: T.error } }}>
            <FilterListOffIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}

      <Box sx={{ flex: 1 }} />

      <ToggleButtonGroup size="small" value={viewMode} exclusive onChange={(_, v) => v && setViewMode(v)}>
        <ToggleButton value="table" sx={toggleSx}><Tooltip title="Table"><TableRowsIcon fontSize="small" /></Tooltip></ToggleButton>
        <ToggleButton value="grid"  sx={toggleSx}><Tooltip title="Grid"><GridViewIcon fontSize="small" /></Tooltip></ToggleButton>
      </ToggleButtonGroup>

      <Tooltip title="Add Record">
        <IconButton onClick={onAdd} sx={{ bgcolor: T.teal, color: '#fff', borderRadius: 2, '&:hover': { bgcolor: T.tealHover } }}>
          <AddIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  );
}
