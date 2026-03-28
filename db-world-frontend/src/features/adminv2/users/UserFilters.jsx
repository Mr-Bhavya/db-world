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
  wrap:   { display:'flex', flexWrap:'wrap', gap:1, alignItems:'center', p:{ xs:'8px 12px', md:'12px 16px' }, borderBottom:'1px solid rgba(255,255,255,0.06)' },
  search: { flex:'1 1 200px', minWidth:0, '& .MuiOutlinedInput-root':{ bgcolor:'rgba(255,255,255,0.04)', borderRadius:2, color:'#fff', '& fieldset':{ borderColor:'rgba(255,255,255,0.1)' }, '&:hover fieldset':{ borderColor:'rgba(255,255,255,0.2)' } } },
  chip:   (active) => ({ px:1.5, py:0.5, borderRadius:99, border:'1px solid', borderColor: active ? '#6366f1' : 'rgba(255,255,255,0.1)', color: active ? '#6366f1' : 'rgba(255,255,255,0.6)', bgcolor: active ? 'rgba(99,102,241,0.12)' : 'transparent', cursor:'pointer', fontSize:12, fontWeight:600, userSelect:'none', transition:'all .15s' }),
  toggle: { bgcolor:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.1) !important', borderRadius:'8px !important', color:'rgba(255,255,255,0.5)', '&.Mui-selected':{ bgcolor:'rgba(99,102,241,0.2)', color:'#6366f1' } },
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
          startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color:'rgba(255,255,255,0.3)', fontSize:18 }} /></InputAdornment>,
          endAdornment: searchTerm && (
            <InputAdornment position="end">
              <IconButton size="small" onClick={() => setSearchTerm('')} sx={{ color:'rgba(255,255,255,0.4)' }}>
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
        <IconButton onClick={onAddUser} sx={{ bgcolor:'#6366f1', color:'#fff', borderRadius:2, '&:hover':{ bgcolor:'#5254cc' } }}>
          <GroupAddIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  );
}
