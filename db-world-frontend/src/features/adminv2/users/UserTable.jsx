import { useMemo } from 'react';
import { Box, Chip, IconButton, Tooltip } from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { useUserStore } from '../stores/useUserStore';
import { useT } from '@shared/theme';
import { formatDistanceToNow } from 'date-fns';
import { ROLE_COLORS } from './constants';

export default function UserTable({ users, loading, onDelete }) {
  const T = useT();
  const { setSelectedRows, sortModel, setSortModel, openDrawer, openModal } = useUserStore();

  const gridSx = useMemo(() => ({
    bgcolor: 'transparent', border: 'none', color: T.textPrimary,
    '& .MuiDataGrid-columnHeaders':   { bgcolor: T.tealBg, borderBottom: `1px solid ${T.border}`, color: T.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },
    '& .MuiDataGrid-row':             { borderBottom: `1px solid ${T.border}`, '&:hover': { bgcolor: T.hoverBg } },
    '& .MuiDataGrid-cell':            { borderBottom: 'none', color: T.textPrimary, fontSize: 13 },
    '& .MuiDataGrid-footerContainer': { borderTop: `1px solid ${T.border}`, color: T.textMuted, bgcolor: T.tealBg },
    '& .MuiCheckbox-root':            { color: T.textMuted },
    '& .MuiDataGrid-virtualScroller': { minHeight: 200, bgcolor: T.sidebar },
    '& .MuiTablePagination-root':     { color: T.textMuted },
    '& .MuiTablePagination-select':   { color: T.textPrimary },
    '& .MuiSvgIcon-root':             { color: T.textMuted },
  }), [T]);

  const columns = useMemo(() => [
    {
      field: 'fullName', headerName: 'User', flex: 1.8, minWidth: 200,
      valueGetter: (_, row) => `${row.firstName ?? ''} ${row.lastName ?? ''}`.trim(),
      renderCell: ({ value, row }) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ width: 32, height: 32, borderRadius: '50%', bgcolor: T.teal, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0, color: '#fff' }}>
            {(row.firstName?.[0] ?? '?').toUpperCase()}
          </Box>
          <Box sx={{ overflow: 'hidden' }}>
            <Box sx={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: T.textPrimary }}>{value}</Box>
            <Box sx={{ fontSize: 11, color: T.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.email}</Box>
          </Box>
        </Box>
      ),
    },
    { field: 'mobileNo', headerName: 'Mobile', flex: 1, minWidth: 130, valueFormatter: v => v ?? '—' },
    {
      field: 'userRole', headerName: 'Role', width: 110,
      renderCell: ({ row }) => {
        const role = row.userRole?.roleName ?? 'VIEWER';
        return <Chip label={role} size="small" sx={{ bgcolor: `${ROLE_COLORS[role]}22`, color: ROLE_COLORS[role], border: `1px solid ${ROLE_COLORS[role]}44`, fontWeight: 600, fontSize: 11 }} />;
      },
    },
    { field: 'noOfLogin', headerName: 'Logins', width: 80, type: 'number', align: 'center', headerAlign: 'center' },
    {
      field: 'lastLogin', headerName: 'Last Login', width: 150,
      valueGetter: (_, row) => row.loginData?.[0]?.lastLoginDate ?? null,
      renderCell: ({ value }) => value
        ? <Box sx={{ fontSize: 12, color: T.textMuted }}>{formatDistanceToNow(new Date(value), { addSuffix: true })}</Box>
        : <Box sx={{ fontSize: 12, color: T.textFaint }}>—</Box>,
    },
    {
      field: 'actions', headerName: '', width: 120, sortable: false,
      renderCell: ({ row }) => (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="View details">
            <IconButton size="small" onClick={() => openDrawer(row.userId)} sx={{ color: T.textMuted, '&:hover': { color: T.teal, bgcolor: T.tealBg } }}>
              <VisibilityIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Edit">
            <IconButton size="small" onClick={() => openModal('edit', row.userId)} sx={{ color: T.textMuted, '&:hover': { color: '#10b981', bgcolor: 'rgba(16,185,129,0.1)' } }}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton size="small" onClick={() => onDelete(row.userId)} sx={{ color: T.textMuted, '&:hover': { color: T.error, bgcolor: T.errorBg } }}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ], [T, openDrawer, openModal, onDelete]);

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
      initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
      sx={gridSx}
      slotProps={{ loadingOverlay: { variant: 'skeleton', noRowsVariant: 'skeleton' } }}
    />
  );
}
