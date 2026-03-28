// db-world-frontend/src/features/adminv2/records/RecordTable.jsx
import { useCallback, useMemo } from 'react';
import { Box, Chip, IconButton, Tooltip, Link } from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import MovieIcon from '@mui/icons-material/Movie';
import TvIcon from '@mui/icons-material/Tv';
import { formatDistanceToNow } from 'date-fns';
import { useRecordStore } from '../stores/useRecordStore';
import RecordTagsInline from './RecordTagsInline';

// Map DataGrid sort field → Spring Pageable sort param
const SORT_FIELD_MAP = {
  recordId: 'recordId', name: 'name', type: 'type',
  year: 'year', tmdbId: 'tmdbId', createdAt: 'createdAt', updatedAt: 'updatedAt',
};

const gridSx = {
  bgcolor:'transparent', border:'none', color:'#fff',
  '& .MuiDataGrid-columnHeaders':{ bgcolor:'rgba(255,255,255,0.04)', borderBottom:'1px solid rgba(255,255,255,0.08)', color:'rgba(255,255,255,0.5)', fontSize:11, textTransform:'uppercase', letterSpacing:.5 },
  '& .MuiDataGrid-row':{ borderBottom:'1px solid rgba(255,255,255,0.04)', '&:hover':{ bgcolor:'rgba(255,255,255,0.025)' } },
  '& .MuiDataGrid-cell':{ borderBottom:'none', color:'rgba(255,255,255,0.85)', fontSize:13, display:'flex', alignItems:'center' },
  '& .MuiDataGrid-footerContainer':{ borderTop:'1px solid rgba(255,255,255,0.06)', color:'rgba(255,255,255,0.5)' },
  '& .MuiCheckbox-root':{ color:'rgba(255,255,255,0.3)' },
};

export default function RecordTable({ data, loading, onDelete, queryKey }) {
  const { page, pageSize, sortModel, setPage, setPageSize, setSortModel, setSelectedRows, openDrawer, openModal } = useRecordStore();

  // Convert DataGrid sort to Spring sort param for store
  const handleSortChange = useCallback((model) => {
    setSortModel(model.map(s => ({ ...s, field: SORT_FIELD_MAP[s.field] ?? s.field })));
  }, [setSortModel]);

  const displaySortModel = useMemo(() =>
    sortModel.map(s => ({ field: Object.keys(SORT_FIELD_MAP).find(k => SORT_FIELD_MAP[k] === s.field) ?? s.field, sort: s.sort })),
  [sortModel]);

  const columns = useMemo(() => [
    { field:'recordId', headerName:'ID', width:80, type:'number' },
    {
      field:'name', headerName:'Name', flex:1.5, minWidth:160,
      renderCell: ({ value, row }) => (
        <Box sx={{ display:'flex', alignItems:'center', gap:1 }}>
          {row.type === 'MOVIE'
            ? <MovieIcon sx={{ fontSize:16, color:'#6366f1', flexShrink:0 }} />
            : <TvIcon    sx={{ fontSize:16, color:'#10b981', flexShrink:0 }} />}
          <Box sx={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{value}</Box>
        </Box>
      ),
    },
    {
      field:'type', headerName:'Type', width:100,
      renderCell: ({ value }) => (
        <Chip label={value} size="small" sx={{ bgcolor: value === 'MOVIE' ? 'rgba(99,102,241,0.2)' : 'rgba(16,185,129,0.2)', color: value === 'MOVIE' ? '#6366f1' : '#10b981', fontWeight:700, fontSize:10 }} />
      ),
    },
    { field:'year', headerName:'Year', width:80, type:'number' },
    {
      field:'tmdbId', headerName:'TMDB ID', width:110,
      renderCell: ({ value, row }) => value ? (
        <Link href={`https://www.themoviedb.org/${row.type === 'MOVIE' ? 'movie' : 'tv'}/${value}`} target="_blank" sx={{ color:'#6366f1', fontSize:13 }}>{value}</Link>
      ) : '—',
    },
    {
      field:'tags', headerName:'Tags', flex:1.5, minWidth:180, sortable:false,
      renderCell: ({ row }) => <RecordTagsInline record={row} queryKey={queryKey} />,
    },
    {
      field:'createdAt', headerName:'Created', width:130,
      renderCell: ({ value }) => value ? <Box sx={{ fontSize:12, color:'rgba(255,255,255,0.45)' }}>{formatDistanceToNow(new Date(value), { addSuffix:true })}</Box> : '—',
    },
    {
      field:'updatedAt', headerName:'Updated', width:130,
      renderCell: ({ value }) => value ? <Box sx={{ fontSize:12, color:'rgba(255,255,255,0.45)' }}>{formatDistanceToNow(new Date(value), { addSuffix:true })}</Box> : '—',
    },
    {
      field:'actions', headerName:'', width:120, sortable:false,
      renderCell: ({ row }) => (
        <Box sx={{ display:'flex', gap:.5 }}>
          <Tooltip title="View"><IconButton size="small" onClick={() => openDrawer(row.recordId)} sx={{ color:'rgba(255,255,255,0.4)','&:hover':{ color:'#6366f1' } }}><VisibilityIcon sx={{ fontSize:16 }} /></IconButton></Tooltip>
          <Tooltip title="Edit"><IconButton size="small" onClick={() => openModal('edit', row.recordId)} sx={{ color:'rgba(255,255,255,0.4)','&:hover':{ color:'#10b981' } }}><EditIcon sx={{ fontSize:16 }} /></IconButton></Tooltip>
          <Tooltip title="Delete"><IconButton size="small" onClick={() => onDelete(row.recordId)} sx={{ color:'rgba(255,255,255,0.4)','&:hover':{ color:'#ef4444' } }}><DeleteIcon sx={{ fontSize:16 }} /></IconButton></Tooltip>
        </Box>
      ),
    },
  ], [onDelete, openDrawer, openModal, queryKey]);

  return (
    <DataGrid
      rows={data?.content ?? []}
      columns={columns}
      getRowId={r => r.recordId}
      loading={loading}
      rowCount={data?.totalElements ?? 0}
      paginationMode="server"
      sortingMode="server"
      paginationModel={{ page, pageSize }}
      onPaginationModelChange={({ page: p, pageSize: s }) => { setPage(p); setPageSize(s); }}
      sortModel={displaySortModel}
      onSortModelChange={handleSortChange}
      pageSizeOptions={[10, 25, 50, 100]}
      checkboxSelection
      disableRowSelectionOnClick
      onRowSelectionModelChange={ids => setSelectedRows(Array.from(ids))}
      sx={gridSx}
      slotProps={{ loadingOverlay:{ variant:'skeleton', noRowsVariant:'skeleton' } }}
      keepNonExistentRowsSelected
    />
  );
}
