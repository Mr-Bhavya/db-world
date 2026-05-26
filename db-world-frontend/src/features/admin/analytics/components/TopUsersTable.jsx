import React from 'react';
import { Card, CardContent, Typography, Skeleton } from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';

const formatRelative = (iso) => {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

const columns = [
  { field: 'email',           headerName: 'User',            flex: 2, minWidth: 220 },
  { field: 'totalActivities', headerName: 'Activities',      width: 130, type: 'number' },
  { field: 'totalGb',         headerName: 'GB',              width: 100, type: 'number',
    valueFormatter: (v) => Number(v ?? 0).toFixed(2) },
  { field: 'lastActive',      headerName: 'Last active',     width: 150,
    valueFormatter: (v) => formatRelative(v) },
];

const TopUsersTable = ({ data, loading }) => {
  const rows = (data ?? []).map((d) => ({ id: d.userId, ...d }));

  return (
    <Card variant="outlined">
      <CardContent sx={{ height: 380, display: 'flex', flexDirection: 'column' }}>
        <Typography sx={{ fontSize: '0.78rem', textTransform: 'uppercase', color: 'text.secondary', letterSpacing: '0.04em', mb: 1 }}>
          Top users (last 30 days)
        </Typography>
        {loading ? (
          <Skeleton variant="rounded" sx={{ flex: 1 }} />
        ) : (
          <DataGrid
            rows={rows}
            columns={columns}
            density="compact"
            disableRowSelectionOnClick
            pageSizeOptions={[10, 20]}
            initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
            sx={{ border: 0, '& .MuiDataGrid-columnHeaders': { fontSize: '0.75rem' } }}
          />
        )}
      </CardContent>
    </Card>
  );
};

export default TopUsersTable;
