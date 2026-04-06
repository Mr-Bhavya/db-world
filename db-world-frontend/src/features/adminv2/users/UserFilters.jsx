import { useRef } from 'react';
import { Box, TextField, ToggleButton, ToggleButtonGroup, InputAdornment, IconButton, Tooltip, Select, MenuItem } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import TableRowsIcon from '@mui/icons-material/TableRows';
import GridViewIcon from '@mui/icons-material/GridView';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import SortIcon from '@mui/icons-material/Sort';
import { useUserStore } from '../stores/useUserStore';
import { useT } from '@shared/theme';

const SORT_OPTIONS = [
  { value: 'userId,desc',    label: 'Latest' },
  { value: 'userId,asc',     label: 'Oldest' },
  { value: 'fullName,asc',   label: 'Name A–Z' },
  { value: 'fullName,desc',  label: 'Name Z–A' },
  { value: 'email,asc',      label: 'Email A–Z' },
];

const ROLE_OPTIONS = ['ALL', 'OWNER', 'ADMIN', 'VIEWER'];

export default function UserFilters({ onAddUser }) {
  const T = useT();
  const { searchTerm, setSearchTerm, roleFilter, setRoleFilter, viewMode, setViewMode, sortModel, setSortModel } = useUserStore();
  const sortKey = sortModel.length > 0 ? `${sortModel[0].field},${sortModel[0].sort}` : 'userId,desc';
  const handleSortChange = (e) => {
    const [field, sort] = e.target.value.split(',');
    setSortModel([{ field, sort }]);
  };
  const timerRef = useRef(null);

  const handleSearch = (e) => {
    const v = e.target.value;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setSearchTerm(v), 250);
  };

  return (
    <Box sx={{
      display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center',
      p: { xs: '8px 12px', md: '10px 16px' },
      borderBottom: `1px solid ${T.border}`,
      bgcolor: T.sidebar,
    }}>
      <TextField
        size="small"
        placeholder="Search name, email…"
        defaultValue={searchTerm}
        onChange={handleSearch}
        sx={{
          flex: '1 1 200px', minWidth: 0,
          '& .MuiOutlinedInput-root': {
            bgcolor: T.glass, borderRadius: 2, color: T.textPrimary,
            '& fieldset':             { borderColor: T.glassBorder },
            '&:hover fieldset':       { borderColor: T.teal },
            '&.Mui-focused fieldset': { borderColor: T.teal },
          },
          '& input': { color: T.textPrimary },
          '& .MuiInputLabel-root': { color: T.textMuted },
        }}
        InputProps={{
          startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: T.textMuted, fontSize: 18 }} /></InputAdornment>,
          endAdornment: searchTerm && (
            <InputAdornment position="end">
              <IconButton size="small" onClick={() => setSearchTerm('')} sx={{ color: T.textMuted }}>
                <ClearIcon fontSize="small" />
              </IconButton>
            </InputAdornment>
          ),
        }}
      />

      <Box sx={{ display: 'flex', gap: 0.75, flexShrink: 0, flexWrap: 'wrap' }}>
        {ROLE_OPTIONS.map(r => (
          <Box
            key={r}
            onClick={() => setRoleFilter(r)}
            sx={{
              px: 1.5, py: 0.5, borderRadius: 99, border: '1px solid',
              borderColor: roleFilter === r ? T.teal : T.glassBorder,
              color:        roleFilter === r ? T.teal : T.textMuted,
              bgcolor:      roleFilter === r ? T.tealBg : 'transparent',
              cursor: 'pointer', fontSize: 12, fontWeight: 600,
              userSelect: 'none', transition: 'all .15s',
              '&:hover': { borderColor: T.teal, color: T.teal },
            }}
          >
            {r}
          </Box>
        ))}
      </Box>

      <Select
        size="small"
        value={sortKey}
        onChange={handleSortChange}
        startAdornment={<SortIcon sx={{ fontSize: 14, color: T.textMuted, mr: 0.5 }} />}
        sx={{
          color: T.textPrimary, fontSize: 12, height: 32,
          bgcolor: T.glass,
          '& .MuiOutlinedInput-notchedOutline': { borderColor: T.glassBorder },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: T.teal },
          '& .MuiSelect-icon': { color: T.textMuted },
        }}
      >
        {SORT_OPTIONS.map(o => (
          <MenuItem key={o.value} value={o.value} sx={{ fontSize: 12 }}>{o.label}</MenuItem>
        ))}
      </Select>

      <ToggleButtonGroup size="small" value={viewMode} exclusive onChange={(_, v) => v && setViewMode(v)}>
        <ToggleButton value="table" sx={{ bgcolor: T.glass, border: `1px solid ${T.glassBorder} !important`, borderRadius: '8px !important', color: T.textMuted, '&.Mui-selected': { bgcolor: T.tealBg, color: T.teal } }}>
          <Tooltip title="Table"><TableRowsIcon fontSize="small" /></Tooltip>
        </ToggleButton>
        <ToggleButton value="grid"  sx={{ bgcolor: T.glass, border: `1px solid ${T.glassBorder} !important`, borderRadius: '8px !important', color: T.textMuted, '&.Mui-selected': { bgcolor: T.tealBg, color: T.teal } }}>
          <Tooltip title="Grid"><GridViewIcon fontSize="small" /></Tooltip>
        </ToggleButton>
      </ToggleButtonGroup>

      <Tooltip title="Add User">
        <IconButton onClick={onAddUser} sx={{ bgcolor: T.teal, color: '#fff', borderRadius: 2, '&:hover': { bgcolor: T.tealHover } }}>
          <GroupAddIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  );
}
