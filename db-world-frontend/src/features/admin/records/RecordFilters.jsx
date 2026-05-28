import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, TextField, ToggleButton, ToggleButtonGroup, InputAdornment, IconButton, Tooltip, MenuItem, Select, Popover, useMediaQuery, useTheme } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import TableRowsIcon from '@mui/icons-material/TableRows';
import GridViewIcon from '@mui/icons-material/GridView';
import FilterListOffIcon from '@mui/icons-material/FilterListOff';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import AddIcon from '@mui/icons-material/Add';
import SortIcon from '@mui/icons-material/Sort';
import { useT, getSelectMenuProps } from '@shared/theme';
import { useRecordStore } from '../stores/useRecordStore';

const SORT_OPTIONS = [
  { value: 'recordId,desc', label: 'Latest' },
  { value: 'recordId,asc',  label: 'Oldest' },
  { value: 'name,asc',      label: 'Name A–Z' },
  { value: 'name,desc',     label: 'Name Z–A' },
  { value: 'year,desc',     label: 'Year (New)' },
  { value: 'year,asc',      label: 'Year (Old)' },
];

export default function RecordFilters({ onAdd }) {
  const T = useT();
  const theme = useTheme();
  const isXs = useMediaQuery(theme.breakpoints.down('sm'));
  const { filters, setFilter, clearFilters, viewMode, setViewMode, sortModel, setSortModel } = useRecordStore();
  const sortKey = sortModel.length > 0 ? `${sortModel[0].field},${sortModel[0].sort}` : 'recordId,desc';
  const handleSortChange = (e) => {
    const [field, sort] = e.target.value.split(',');
    setSortModel([{ field, sort }]);
  };
  const searchTimer = useRef(null);
  const [moreAnchor, setMoreAnchor] = useState(null);

  useEffect(() => () => clearTimeout(searchTimer.current), []);

  const debouncedSet = useCallback((key, val) => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setFilter(key, val), 350);
  }, [setFilter]);

  const hasFilters = Object.values(filters).some(v => v !== '');
  // Year + TMDB ID are uncommon filters — on phones they go behind a popover
  // to keep the toolbar to a single line.
  const hasMoreFilters = filters.year !== '' || filters.tmdbId !== '';

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
        InputLabelProps={{ shrink: true }}
        SelectProps={{ displayEmpty: true, MenuProps: getSelectMenuProps(T) }}>
        <MenuItem value="">All</MenuItem>
        <MenuItem value="MOVIE">Movie</MenuItem>
        <MenuItem value="TV_SERIES">Series</MenuItem>
      </TextField>

      {/* Year + TMDB ID — inline on sm+, behind a "More filters" popover on xs. */}
      <Box sx={{ display: { xs: 'none', sm: 'flex' }, gap: 1 }}>
        <TextField size="small" label="Year" type="number" defaultValue={filters.year}
          onChange={e => debouncedSet('year', e.target.value)} sx={{ ...inputSx, width: 90 }}
          inputProps={{ min: 1900, max: 2100 }} />

        <TextField size="small" label="TMDB ID" type="number" defaultValue={filters.tmdbId}
          onChange={e => debouncedSet('tmdbId', e.target.value)} sx={{ ...inputSx, width: 100 }} />
      </Box>

      {isXs && (
        <>
          <Tooltip title="More filters">
            <IconButton
              size="small"
              onClick={(e) => setMoreAnchor(e.currentTarget)}
              sx={{
                color: hasMoreFilters ? T.teal : T.textMuted,
                bgcolor: hasMoreFilters ? T.tealBg : 'transparent',
                border: `1px solid ${hasMoreFilters ? T.teal + '40' : T.glassBorder}`,
                borderRadius: 1.5,
                '&:hover': { bgcolor: T.tealBg, color: T.teal },
              }}
            >
              <FilterAltIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Popover
            open={Boolean(moreAnchor)}
            anchorEl={moreAnchor}
            onClose={() => setMoreAnchor(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
            PaperProps={{ sx: { bgcolor: T.sidebar, border: `1px solid ${T.glassBorder}`, p: 1.5, mt: 0.5, display: 'flex', flexDirection: 'column', gap: 1, minWidth: 220 } }}
          >
            <TextField size="small" label="Year" type="number" defaultValue={filters.year}
              onChange={e => debouncedSet('year', e.target.value)} sx={inputSx}
              inputProps={{ min: 1900, max: 2100 }} />
            <TextField size="small" label="TMDB ID" type="number" defaultValue={filters.tmdbId}
              onChange={e => debouncedSet('tmdbId', e.target.value)} sx={inputSx} />
          </Popover>
        </>
      )}

      {hasFilters && (
        <Tooltip title="Clear filters">
          <IconButton onClick={clearFilters} size="small" sx={{ color: T.textMuted, '&:hover': { color: T.error } }}>
            <FilterListOffIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}

      <Select
        size="small"
        value={sortKey}
        onChange={handleSortChange}
        startAdornment={<SortIcon sx={{ fontSize: 14, color: T.textFaint, mr: 0.5, display: { xs: 'none', sm: 'inline-flex' } }} />}
        sx={{
          color: T.textPrimary, fontSize: 12, height: 32,
          minWidth: { xs: 90, sm: 110 },
          bgcolor: T.inputBg,
          '& .MuiOutlinedInput-notchedOutline': { borderColor: T.glassBorder },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: T.teal },
          '& .MuiSelect-icon': { color: T.textMuted },
        }}
      >
        {SORT_OPTIONS.map(o => (
          <MenuItem key={o.value} value={o.value} sx={{ fontSize: 12 }}>{o.label}</MenuItem>
        ))}
      </Select>

      <Box sx={{ flex: 1 }} />

      <ToggleButtonGroup size="small" value={viewMode} exclusive onChange={(_, v) => v && setViewMode(v)}>
        <ToggleButton value="table" sx={toggleSx}><Tooltip title="Table"><TableRowsIcon fontSize="small" /></Tooltip></ToggleButton>
        <ToggleButton value="grid"  sx={toggleSx}><Tooltip title="Grid"><GridViewIcon fontSize="small" /></Tooltip></ToggleButton>
      </ToggleButtonGroup>

      {/* Add icon is redundant on mobile (a FAB handles it from the parent) but
          stays on sm+ where the header button is also hidden in the same range. */}
      <Tooltip title="Add Record">
        <IconButton onClick={onAdd}
          sx={{
            bgcolor: T.teal, color: '#fff', borderRadius: 2,
            '&:hover': { bgcolor: T.tealHover },
            display: { xs: 'none', sm: 'inline-flex' },
          }}>
          <AddIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  );
}
