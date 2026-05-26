import React from 'react';
import { Card, CardContent, Typography, Skeleton } from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';

const columns = [
  { field: 'title',         headerName: 'Title',         flex: 2, minWidth: 220 },
  { field: 'recordType',    headerName: 'Type',          width: 100 },
  { field: 'streamCount',   headerName: 'Streams',       width: 110, type: 'number' },
  { field: 'downloadCount', headerName: 'Downloads',     width: 120, type: 'number' },
  { field: 'uniqueUsers',   headerName: 'Unique users',  width: 130, type: 'number' },
];

const TopRecordsTable = ({ data, loading }) => {
  const rows = (data ?? []).map((d) => ({ id: d.recordId, ...d }));

  return (
    <Card variant="outlined">
      <CardContent sx={{ height: 380, display: 'flex', flexDirection: 'column' }}>
        <Typography sx={{ fontSize: '0.78rem', textTransform: 'uppercase', color: 'text.secondary', letterSpacing: '0.04em', mb: 1 }}>
          Top records (last 30 days)
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

export default TopRecordsTable;
