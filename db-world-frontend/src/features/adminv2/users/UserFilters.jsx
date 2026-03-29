import { useRef } from 'react';
import { Box, TextField, ToggleButton, ToggleButtonGroup, InputAdornment, IconButton, Tooltip } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import TableRowsIcon from '@mui/icons-material/TableRows';
import GridViewIcon from '@mui/icons-material/GridView';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import { useUserStore } from '../stores/useUserStore';

const ROLE_OPTIONS = ['ALL','OWNER','ADMIN','VIEWER'];

const sx = {
  wrap:   { display:'flex', flexWrap:'wrap', gap:1, alignItems:'center', p:{ xs:'8px 12px', md:'12px 16px' }, borderBottom:'1px solid rgba(0,0,0,0.07)', bgcolor:'#f8fffe' },
  search: { flex:'1 1 200px', minWidth:0, '& .MuiOutlinedInput-root':{ bgcolor:'#ffffff', borderRadius:2, color:'#0f172a', '& fieldset':{ borderColor:'rgba(0,0,0,0.12)' }, '&:hover fieldset':{ borderColor:'rgba(0,0,0,0.25)' }, '&.Mui-focused fieldset':{ borderColor:'#0d9488' } } },
  chip:   (active) => ({ px:1.5, py:0.5, borderRadius:99, border:'1px solid', borderColor: active ? '#0d9488' : 'rgba(0,0,0,0.12)', color: active ? '#0d9488' : 'rgba(15,23,42,0.55)', bgcolor: active ? 'rgba(13,148,136,0.1)' : 'transparent', cursor:'pointer', fontSize:12, fontWeight:600, userSelect:'none', transition:'all .15s' }),
  toggle: { bgcolor:'#ffffff', border:'1px solid rgba(0,0,0,0.12) !important', borderRadius:'8px !important', color:'rgba(15,23,42,0.45)', '&.Mui-selected':{ bgcolor:'rgba(13,148,136,0.1)', color:'#0d9488' } },
};

export default function UserFilters({ onAddUser }) {
  const { searchTerm, setSearchTerm, roleFilter, setRoleFilter, viewMode, setViewMode } = useUserStore();
  const timerRef = useRef(null);

  const handleSearch = (e) => {
    const v = e.target.value;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setSearchTerm(v), 250);
  };

  return (
    <Box sx={sx.wrap}>
      <TextField
        size="small"
        placeholder="Search name, email…"
        defaultValue={searchTerm}
        onChange={handleSearch}
        sx={sx.search}
        InputProps={{
          startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color:'rgba(15,23,42,0.35)', fontSize:18 }} /></InputAdornment>,
          endAdornment: searchTerm && (
            <InputAdornment position="end">
              <IconButton size="small" onClick={() => setSearchTerm('')} sx={{ color:'rgba(15,23,42,0.4)' }}>
                <ClearIcon fontSize="small" />
              </IconButton>
            </InputAdornment>
          ),
        }}
      />
      <Box sx={{ display:'flex', gap:0.75, flexShrink:0 }}>
        {ROLE_OPTIONS.map(r => (
          <Box key={r} sx={sx.chip(roleFilter === r)} onClick={() => setRoleFilter(r)}>{r}</Box>
        ))}
      </Box>
      <ToggleButtonGroup size="small" value={viewMode} exclusive onChange={(_, v) => v && setViewMode(v)}>
        <ToggleButton value="table" sx={sx.toggle}><Tooltip title="Table"><TableRowsIcon fontSize="small" /></Tooltip></ToggleButton>
        <ToggleButton value="grid"  sx={sx.toggle}><Tooltip title="Grid"><GridViewIcon fontSize="small" /></Tooltip></ToggleButton>
      </ToggleButtonGroup>
      <Tooltip title="Add User">
        <IconButton onClick={onAddUser} sx={{ bgcolor:'#0d9488', color:'#fff', borderRadius:2, '&:hover':{ bgcolor:'#0f766e' } }}>
          <GroupAddIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  );
}
