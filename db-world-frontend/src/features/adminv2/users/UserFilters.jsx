import { useRef } from 'react';
import { Box, TextField, InputAdornment, IconButton, Tooltip } from '@mui/material';
import SearchIcon   from '@mui/icons-material/Search';
import ClearIcon    from '@mui/icons-material/Clear';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import { useT }     from '@shared/theme';

const ROLE_OPTIONS = ['ALL', 'OWNER', 'ADMIN', 'VIEWER'];

export default function UserFilters({ search, role, onSearch, onRole, onAddUser }) {
  const T        = useT();
  const timerRef = useRef(null);

  const handleSearch = (e) => {
    const v = e.target.value;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onSearch(v), 300);
  };

  return (
    <Box sx={{
      display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center',
      px: { xs: 1.5, md: 2.5 }, py: 1.25,
      borderBottom: `1px solid ${T.border}`,
      bgcolor: T.glass,
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
            bgcolor: T.bg, borderRadius: 2, color: T.text,
            '& fieldset':             { borderColor: T.border },
            '&:hover fieldset':       { borderColor: '#0d9488' },
            '&.Mui-focused fieldset': { borderColor: '#0d9488' },
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
            borderColor: role === r ? '#0d9488' : T.border,
            color:       role === r ? '#0d9488' : T.textMuted,
            bgcolor:     role === r ? '#0d948818' : 'transparent',
            cursor: 'pointer', fontSize: 12, fontWeight: 600,
            userSelect: 'none', transition: 'all .15s',
            '&:hover': { borderColor: '#0d9488', color: '#0d9488' },
          }}>
            {r}
          </Box>
        ))}
      </Box>

      {/* Add user */}
      <Tooltip title="Add User">
        <IconButton onClick={onAddUser}
          sx={{ bgcolor: '#0d9488', color: '#fff', borderRadius: 2, ml: 'auto', '&:hover': { bgcolor: '#0f766e' } }}>
          <GroupAddIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  );
}
