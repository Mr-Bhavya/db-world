import React, { useMemo } from 'react';
import { Box, Typography, Skeleton } from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import { useT } from '@shared/theme/ThemeContext';

const columns = [
  { field: 'title',         headerName: 'Title',         flex: 2, minWidth: 200 },
  { field: 'recordType',    headerName: 'Type',          width: 90  },
  { field: 'streamCount',   headerName: 'Streams',       width: 100, type: 'number' },
  { field: 'downloadCount', headerName: 'Downloads',     width: 110, type: 'number' },
  { field: 'uniqueUsers',   headerName: 'Users',         width: 90,  type: 'number' },
];

export default function TopRecordsTable({ data, loading }) {
  const T = useT();
  const rows = (data ?? []).map((d) => ({ id: d.recordId, ...d }));

  const gridSx = useMemo(() => ({
    border: 0, color: T.text,
    '& .MuiDataGrid-columnHeaders':       { bgcolor: T.glass, borderColor: T.border, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' },
    '& .MuiDataGrid-columnHeaderTitle':   { fontWeight: 700, color: T.textFaint },
    '& .MuiDataGrid-cell':                { borderColor: T.border, fontSize: 12.5 },
    '& .MuiDataGrid-row:hover':           { bgcolor: T.hoverBg },
    '& .MuiDataGrid-footerContainer':     { borderColor: T.border },
    '& .MuiTablePagination-root':         { color: T.textMuted },
    '& .MuiDataGrid-overlay':             { bgcolor: 'transparent', color: T.textFaint },
    '& .MuiDataGrid-virtualScroller':     { '&::-webkit-scrollbar': { height: 6, width: 6 }, '&::-webkit-scrollbar-thumb': { bgcolor: T.scrollThumb, borderRadius: 3 } },
  }), [T]);

  return (
    <Box sx={{
      bgcolor: T.glass, border: `1px solid ${T.border}`, borderRadius: 2,
      p: { xs: 1.5, sm: 2 }, display: 'flex', flexDirection: 'column',
      height: 380, minWidth: 0,
    }}>
      <Typography sx={{
        fontSize: 11, color: T.textFaint, textTransform: 'uppercase',
        letterSpacing: '0.08em', fontWeight: 700, mb: 1,
      }}>
        Top records · last 30 days
      </Typography>
      {loading ? (
        <Skeleton variant="rounded" sx={{ flex: 1, bgcolor: T.glass }} />
      ) : (
        <DataGrid
          rows={rows}
          columns={columns}
          density="compact"
          disableRowSelectionOnClick
          pageSizeOptions={[10, 20]}
          initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
          sx={gridSx}
        />
      )}
    </Box>
  );
}
