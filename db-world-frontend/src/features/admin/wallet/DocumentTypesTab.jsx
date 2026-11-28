import { useState } from 'react';
import { Box, Button, Chip } from '@mui/material';
import { AddRounded } from '@mui/icons-material';
import { DataGrid } from '@mui/x-data-grid';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notify } from '@shared/notify';
import { useT } from '@shared/theme';
import { SectionCard, AdminActionButton, AdminConfirmDialog, adminSurface } from '@features/admin/adminUi';
import { fetchTypes, deleteType } from './adminWalletApi';
import TypeUpsertDialog from './TypeUpsertDialog';

export default function DocumentTypesTab() {
  const T = useT();
  const S = adminSurface(T);
  const qc = useQueryClient();
  const { data: types = [], isLoading } = useQuery({ queryKey: ['wallet-admin', 'types'], queryFn: fetchTypes });
  const [dialog, setDialog] = useState({ open: false, item: null });
  const [deleteTarget, setDeleteTarget] = useState(null);
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
        <Button size="small" color="error" onClick={() => setDeleteTarget(p.row)}>Delete</Button>
      </>) },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1.5 }}>
        <AdminActionButton icon={AddRounded} onClick={() => setDialog({ open: true, item: null })}>
          New type
        </AdminActionButton>
      </Box>
      <SectionCard padding={false}>
        <Box sx={{ width: '100%', overflowX: 'auto' }}>
          <Box sx={{ height: 480, minWidth: 600 }}>
            <DataGrid rows={types} columns={columns} loading={isLoading} getRowId={(r) => r.id}
              disableRowSelectionOnClick density="compact"
              sx={{ border: 'none', '& .MuiDataGrid-columnHeaders': { bgcolor: S.inset } }} />
          </Box>
        </Box>
      </SectionCard>
      <TypeUpsertDialog open={dialog.open} editItem={dialog.item} onClose={() => setDialog({ open: false, item: null })} />
      <AdminConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete document type?"
        message={`"${deleteTarget?.displayName ?? ''}" will be removed. Types that are still in use are deactivated instead.`}
        confirmLabel="Delete type"
        loading={del.isPending}
        onConfirm={() => del.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) })}
        onClose={() => setDeleteTarget(null)}
      />
    </Box>
  );
}
