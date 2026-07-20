import { useState } from 'react';
import { Box, Button, Chip } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { DataGrid } from '@mui/x-data-grid';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useConfirm } from 'material-ui-confirm';
import { notify } from '@shared/notify';
import { useT } from '@shared/theme';
import { fetchTypes, deleteType } from './adminWalletApi';
import TypeUpsertDialog from './TypeUpsertDialog';

export default function DocumentTypesTab() {
  const T = useT();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const { data: types = [], isLoading } = useQuery({ queryKey: ['wallet-admin', 'types'], queryFn: fetchTypes });
  const [dialog, setDialog] = useState({ open: false, item: null });
  const del = useMutation({
    mutationFn: (id) => deleteType(id),
    onSuccess: (res) => { qc.invalidateQueries({ queryKey: ['wallet-admin', 'types'] }); notify.success(res?.message ?? 'Done'); },
  });

  const columns = [
    { field: 'code', headerName: 'Code', width: 160 },
    { field: 'displayName', headerName: 'Name', flex: 1 },
    { field: 'requiresNumber', headerName: 'Number?', width: 110, renderCell: (p) => (p.value ? 'Yes' : 'No') },
    { field: 'active', headerName: 'Active', width: 110, renderCell: (p) => (
      <Chip size="small" label={p.value ? 'Active' : 'Inactive'} color={p.value ? 'success' : 'default'} />) },
    { field: 'sortOrder', headerName: 'Order', width: 90 },
    { field: 'actions', headerName: '', width: 160, sortable: false, renderCell: (p) => (
      <>
        <Button size="small" onClick={() => setDialog({ open: true, item: p.row })}>Edit</Button>
        <Button size="small" color="error" onClick={() =>
          confirm({ title: 'Delete type?', description: 'In-use types are deactivated instead.' })
            .then(() => del.mutate(p.row.id)).catch(() => {})}>Delete</Button>
      </>) },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
        <Button startIcon={<AddIcon />} variant="contained" onClick={() => setDialog({ open: true, item: null })}
          sx={{ bgcolor: T.teal, '&:hover': { bgcolor: T.tealHover } }}>New type</Button>
      </Box>
      <Box sx={{ width: '100%', overflowX: 'auto' }}>
        <Box sx={{ height: 480, minWidth: 600 }}>
          <DataGrid rows={types} columns={columns} loading={isLoading} getRowId={(r) => r.id}
            disableRowSelectionOnClick density="compact" />
        </Box>
      </Box>
      <TypeUpsertDialog open={dialog.open} editItem={dialog.item} onClose={() => setDialog({ open: false, item: null })} />
    </Box>
  );
}
