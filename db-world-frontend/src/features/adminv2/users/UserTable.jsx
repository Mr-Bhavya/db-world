import { useMemo } from 'react';
import { Box, Chip, IconButton, Tooltip } from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import { useUserStore } from '../stores/useUserStore';
import { formatDistanceToNow } from 'date-fns';

const ROLE_COLORS = { OWNER:'#f59e0b', ADMIN:'#6366f1', VIEWER:'#10b981' };

const gridSx = {
  bgcolor:'transparent', border:'none', color:'#fff',
  '& .MuiDataGrid-columnHeaders':{ bgcolor:'rgba(255,255,255,0.04)', borderBottom:'1px solid rgba(255,255,255,0.08)', color:'rgba(255,255,255,0.5)', fontSize:11, textTransform:'uppercase', letterSpacing:.5 },
  '& .MuiDataGrid-row':{ borderBottom:'1px solid rgba(255,255,255,0.04)', '&:hover':{ bgcolor:'rgba(255,255,255,0.03)' } },
  '& .MuiDataGrid-cell':{ borderBottom:'none', color:'rgba(255,255,255,0.85)', fontSize:13 },
  '& .MuiDataGrid-footerContainer':{ borderTop:'1px solid rgba(255,255,255,0.06)', color:'rgba(255,255,255,0.5)' },
  '& .MuiCheckbox-root':{ color:'rgba(255,255,255,0.3)' },
  '& .MuiDataGrid-virtualScroller':{ minHeight:200 },
};

export default function UserTable({ users, loading, onDelete }) {
  const { setSelectedRows, sortModel, setSortModel, openDrawer, openModal } = useUserStore();

  const columns = useMemo(() => [
    {
      field:'fullName', headerName:'Name', flex:1.5, minWidth:160,
      valueGetter: (_, row) => `${row.firstName ?? ''} ${row.lastName ?? ''}`.trim(),
      renderCell: ({ value, row }) => (
        <Box sx={{ display:'flex', alignItems:'center', gap:1 }}>
          <Box sx={{ width:30, height:30, borderRadius:'50%', bgcolor:'#6366f1', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, flexShrink:0 }}>
            {(row.firstName?.[0] ?? '?').toUpperCase()}
          </Box>
          <Box sx={{ overflow:'hidden' }}>
            <Box sx={{ fontWeight:500, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{value}</Box>
            <Box sx={{ fontSize:11, color:'rgba(255,255,255,0.4)' }}>{row.email}</Box>
          </Box>
        </Box>
      ),
    },
    { field:'email', headerName:'Email', flex:1.5, minWidth:180 },
    { field:'mobileNo', headerName:'Mobile', flex:1, minWidth:130, valueFormatter: v => v ?? '—' },
    {
      field:'userRole', headerName:'Role', width:110,
      renderCell: ({ row }) => {
        const role = row.userRole?.roleName ?? 'VIEWER';
        return <Chip label={role} size="small" sx={{ bgcolor:`${ROLE_COLORS[role]}22`, color:ROLE_COLORS[role], border:`1px solid ${ROLE_COLORS[role]}44`, fontWeight:600, fontSize:11 }} />;
      },
    },
    { field:'noOfLogin', headerName:'Logins', width:90, type:'number', align:'center', headerAlign:'center' },
    {
      field:'lastLogin', headerName:'Last Login', width:140,
      valueGetter: (_, row) => row.loginData?.[0]?.loginTime ?? null,
      renderCell: ({ value }) => value ? <Box sx={{ fontSize:12, color:'rgba(255,255,255,0.5)' }}>{formatDistanceToNow(new Date(value), { addSuffix:true })}</Box> : '—',
    },
    {
      field:'actions', headerName:'', width:160, sortable:false,
      renderCell: ({ row }) => (
        <Box sx={{ display:'flex', gap:0.5 }}>
          <Tooltip title="View"><IconButton size="small" onClick={() => openDrawer(row.userId)} sx={{ color:'rgba(255,255,255,0.5)','&:hover':{ color:'#6366f1' } }}><VisibilityIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Edit"><IconButton size="small" onClick={() => openModal('edit', row.userId)} sx={{ color:'rgba(255,255,255,0.5)','&:hover':{ color:'#10b981' } }}><EditIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Change Role"><IconButton size="small" onClick={() => openModal('role', row.userId)} sx={{ color:'rgba(255,255,255,0.5)','&:hover':{ color:'#f59e0b' } }}><AdminPanelSettingsIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Delete"><IconButton size="small" onClick={() => onDelete(row.userId)} sx={{ color:'rgba(255,255,255,0.5)','&:hover':{ color:'#ef4444' } }}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
        </Box>
      ),
    },
  ], [openDrawer, openModal, onDelete]);

  return (
    <DataGrid
      rows={users}
      columns={columns}
      getRowId={r => r.userId}
      loading={loading}
      checkboxSelection
      disableRowSelectionOnClick
      sortModel={sortModel}
      onSortModelChange={setSortModel}
      onRowSelectionModelChange={ids => setSelectedRows(Array.from(ids))}
      pageSizeOptions={[25, 50, 100]}
      initialState={{ pagination:{ paginationModel:{ pageSize:25 } } }}
      sx={gridSx}
      slotProps={{ loadingOverlay:{ variant:'skeleton', noRowsVariant:'skeleton' } }}
    />
  );
}
