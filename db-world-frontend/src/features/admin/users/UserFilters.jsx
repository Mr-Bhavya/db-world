import { useRef } from 'react';
import { Box, TextField, InputAdornment, IconButton, MenuItem } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon  from '@mui/icons-material/Clear';
import { useT, getSelectMenuProps } from '@shared/theme';
import { adminSurface } from '@features/admin/adminUi';

const ROLE_OPTIONS = ['ALL', 'OWNER', 'ADMIN', 'VIEWER'];
const SORT_OPTIONS = [
  { label: 'Newest',    by: 'userId',       dir: 'desc' },
  { label: 'Oldest',    by: 'userId',       dir: 'asc'  },
  { label: 'Name A–Z',  by: 'firstName',    dir: 'asc'  },
  { label: 'Name Z–A',  by: 'firstName',    dir: 'desc' },
  { label: 'Email A–Z', by: 'email',        dir: 'asc'  },
  { label: 'Recently joined', by: 'creationDate', dir: 'desc' },
];

export default function UserFilters({ search, role, sortBy, sortDir, onSearch, onRole, onSort }) {
  const T        = useT();
  const S        = adminSurface(T);
  const timerRef = useRef(null);

  const handleSearch = (e) => {
    const v = e.target.value;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onSearch(v), 300);
  };

  const sortValue = `${sortBy}:${sortDir}`;

  return (
    <Box sx={{
      display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center',
    }}>
      {/* Search */}
      <TextField
        size="small"
        placeholder="Search name or email…"
        defaultValue={search}
        onChange={handleSearch}
        sx={{
          flex: '1 1 200px', minWidth: 0,
          '& .MuiOutlinedInput-root': {
            bgcolor: S.inset, borderRadius: 2, color: T.text,
            '& fieldset':             { borderColor: S.border },
            '&:hover fieldset':       { borderColor: T.teal },
            '&.Mui-focused fieldset': { borderColor: T.teal },
          },
          '& input': { color: T.text, fontSize: 13 },
        }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon sx={{ color: T.textFaint, fontSize: 17 }} />
            </InputAdornment>
          ),
          endAdornment: search ? (
            <InputAdornment position="end">
              <IconButton size="small" onClick={() => onSearch('')} sx={{ color: T.textFaint }}>
                <ClearIcon sx={{ fontSize: 15 }} />
              </IconButton>
            </InputAdornment>
          ) : null,
        }}
      />

      {/* Role pills */}
      <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
        {ROLE_OPTIONS.map(r => (
          <Box key={r} onClick={() => onRole(r)} sx={{
            px: 1.5, py: 0.4, borderRadius: 99, border: '1px solid',
            borderColor: role === r ? T.teal : S.border,
            color:       role === r ? T.teal : T.textMuted,
            bgcolor:     role === r ? T.tealBg : 'transparent',
            cursor: 'pointer', fontSize: 12, fontWeight: 600,
            userSelect: 'none', transition: 'all .15s',
            '&:hover': { borderColor: T.teal, color: T.teal },
          }}>
            {r}
          </Box>
        ))}
      </Box>

      {/* Sort */}
      <TextField
        select size="small" value={sortValue}
        onChange={e => { const [by, dir] = e.target.value.split(':'); onSort(by, dir); }}
        SelectProps={{ MenuProps: getSelectMenuProps(T) }}
        sx={{
          minWidth: 150, ml: { xs: 0, sm: 'auto' },
          '& .MuiOutlinedInput-root': {
            bgcolor: S.inset, borderRadius: 2, color: T.text,
            '& fieldset': { borderColor: S.border },
            '&:hover fieldset': { borderColor: T.teal },
            '&.Mui-focused fieldset': { borderColor: T.teal },
          },
          '& .MuiSelect-select': { fontSize: 13, color: T.text, py: 1 },
          '& .MuiSelect-icon': { color: T.textMuted },
        }}>
        {SORT_OPTIONS.map(s => (
          <MenuItem key={`${s.by}:${s.dir}`} value={`${s.by}:${s.dir}`} sx={{ color: T.textPrimary, fontSize: 13 }}>
            {s.label}
          </MenuItem>
        ))}
      </TextField>
    </Box>
  );
}
