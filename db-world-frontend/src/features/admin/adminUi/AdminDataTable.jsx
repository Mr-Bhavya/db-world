/**
 * AdminDataTable — ONE themed MUI DataGrid wrapper for the whole admin console.
 * Replaces the per-module ~150-line gridSx overrides + hand-rolled <Table>s.
 * Clean & flat: solid header, subtle row separators, teal selection, no glass.
 *
 * Props: rows, columns, loading, error, onRetry, getRowId, onRowClick,
 *        pageSize, autoHeight, height, density, emptyTitle, emptyMessage,
 *        emptyIcon, toolbar (node) — plus any DataGrid prop via ...rest.
 */
import React from 'react';
import { Box } from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import { useT } from '@shared/theme';
import { adminSurface } from './theme';
import { EmptyState, ErrorState } from './primitives';

export const AdminDataTable = ({
  rows = [],
  columns = [],
  loading = false,
  error = null,
  onRetry,
  getRowId,
  onRowClick,
  pageSize = 25,
  autoHeight = false,
  height = 560,
  density = 'standard',
  emptyTitle = 'No results',
  emptyMessage,
  emptyIcon,
  toolbar,
  sx = {},
  ...rest
}) => {
  const T = useT();
  const S = adminSurface(T);

  if (error) {
    return (
      <Box sx={{ bgcolor: S.card, border: `1px solid ${S.border}`, borderRadius: 3 }}>
        <ErrorState message={typeof error === 'string' ? error : 'Failed to load data'} onRetry={onRetry} />
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%', ...(autoHeight ? {} : { height }) }}>
      <DataGrid
        rows={rows}
        columns={columns}
        loading={loading}
        getRowId={getRowId}
        onRowClick={onRowClick}
        autoHeight={autoHeight}
        density={density}
        disableRowSelectionOnClick
        pageSizeOptions={[10, 25, 50, 100]}
        initialState={{ pagination: { paginationModel: { pageSize } } }}
        slots={{
          ...(toolbar ? { toolbar: () => toolbar } : {}),
          noRowsOverlay: () => <EmptyState icon={emptyIcon} title={emptyTitle} message={emptyMessage} />,
        }}
        sx={{
          border: `1px solid ${S.border}`,
          borderRadius: 3,
          bgcolor: S.card,
          color: T.text,
          fontSize: '0.82rem',
          '--DataGrid-rowBorderColor': S.divider,
          '--DataGrid-containerBackground': S.inset,
          '& .MuiDataGrid-columnHeaders': { bgcolor: S.inset },
          '& .MuiDataGrid-columnHeader': { bgcolor: S.inset },
          '& .MuiDataGrid-columnHeaderTitle': { fontWeight: 700, color: T.textMuted, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: 0.4 },
          '& .MuiDataGrid-cell': { borderColor: S.divider },
          '& .MuiDataGrid-row': {
            cursor: onRowClick ? 'pointer' : 'default',
            '&:hover': { bgcolor: S.cardHover },
            '&.Mui-selected': { bgcolor: T.tealBg, '&:hover': { bgcolor: T.tealBgHover } },
          },
          '& .MuiDataGrid-footerContainer': { borderTop: `1px solid ${S.border}`, bgcolor: S.card },
          '& .MuiTablePagination-root': { color: T.textMuted },
          '& .MuiDataGrid-columnSeparator': { display: 'none' },
          '& .MuiDataGrid-overlay': { bgcolor: 'transparent' },
          '& .MuiDataGrid-virtualScroller': { bgcolor: S.card },
          ...sx,
        }}
        {...rest}
      />
    </Box>
  );
};

export default AdminDataTable;
