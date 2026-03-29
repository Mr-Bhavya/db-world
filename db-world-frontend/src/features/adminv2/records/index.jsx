// db-world-frontend/src/features/adminv2/records/index.jsx
import { useCallback, useMemo } from 'react';
import { Box, Typography, Fab, useMediaQuery, useTheme, Button } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import MovieIcon from '@mui/icons-material/Movie';
import TvIcon from '@mui/icons-material/Tv';
import ListIcon from '@mui/icons-material/List';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { getRecordsTable, deleteRecord } from '../api/adminApi';
import { useRecordStore } from '../stores/useRecordStore';
import RecordFilters from './RecordFilters';
import RecordTable from './RecordTable';
import RecordGrid from './RecordGrid';
import RecordMobileList from './RecordMobileList';
import RecordDetailDrawer from './RecordDetailDrawer';
import RecordCreateModal from './RecordCreateModal';
import RecordEditModal from './RecordEditModal';

export default function RecordManagementV2() {
  const theme   = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { enqueueSnackbar } = useSnackbar();
  const qc = useQueryClient();

  const { viewMode, filters, page, pageSize, sortModel, modalState, editRecordId, openModal, closeModal } = useRecordStore();

  // Build query params for server-side request
  const queryParams = useMemo(() => {
    const params = {
      page,
      size: pageSize,
      ...(filters.name    && { name:    filters.name }),
      ...(filters.type    && { type:    filters.type }),
      ...(filters.year    && { year:    Number(filters.year) }),
      ...(filters.tmdbId  && { tmdbId:  Number(filters.tmdbId) }),
      ...(filters.recordId && { recordId: Number(filters.recordId) }),
    };
    if (sortModel.length > 0) {
      params.sort = sortModel.map(s => `${s.field},${s.sort}`).join('&sort=');
    }
    return params;
  }, [filters, page, pageSize, sortModel]);

  const queryKey = ['records', queryParams];

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: () => getRecordsTable(queryParams),
    placeholderData: (prev) => prev,
  });

  const { mutate: doDelete } = useMutation({
    mutationFn: deleteRecord,
    onSuccess: () => { qc.invalidateQueries({ queryKey:['records'] }); enqueueSnackbar('Record deleted', { variant:'success' }); },
    onError:   () => enqueueSnackbar('Delete failed', { variant:'error' }),
  });

  const handleDelete = useCallback((id) => {
    if (window.confirm('Delete this record?')) doDelete(id);
  }, [doDelete]);

  const editRecord = useMemo(() =>
    data?.content?.find(r => r.recordId === editRecordId) ?? null,
  [data, editRecordId]);

  const stats = useMemo(() => ({
    total:   data?.totalElements ?? 0,
    movies:  data?.content?.filter(r => r.type === 'MOVIE').length ?? 0,
    series:  data?.content?.filter(r => r.type === 'TV_SERIES').length ?? 0,
  }), [data]);

  return (
    <Box sx={{ height:'100%', display:'flex', flexDirection:'column', bgcolor:'#f0f9f8', color:'#0f172a', minHeight:0 }}>
      {/* Page header */}
      <Box sx={{ px:{ xs:2, md:3 }, pt:{ xs:2, md:3 }, pb:1, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <Box>
          <Typography sx={{ fontWeight:700, fontSize:{ xs:18, md:22 }, color:'#0f172a' }}>Records</Typography>
          <Typography sx={{ fontSize:12, color:'rgba(15,23,42,0.5)', mt:.25 }}>Manage movies and series catalog</Typography>
        </Box>
        {!isMobile && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => openModal('create')}
            sx={{ bgcolor:'#0d9488', '&:hover':{ bgcolor:'#0f766e' } }}>
            Add Record
          </Button>
        )}
      </Box>

      {/* Stats bar */}
      <Box sx={{ display:'flex', gap:2, px:{ xs:2, md:3 }, py:1, flexWrap:'wrap' }}>
        {[
          { label:'Total',        value: stats.total,  icon:<ListIcon  sx={{ fontSize:14, color:'#0d9488' }} />, color:'#0d9488' },
          { label:'Movies (page)', value: stats.movies, icon:<MovieIcon sx={{ fontSize:14, color:'#0d9488' }} />, color:'#0d9488' },
          { label:'Series (page)', value: stats.series, icon:<TvIcon    sx={{ fontSize:14, color:'#10b981' }} />, color:'#10b981' },
        ].map(s => (
          <Box key={s.label} sx={{ display:'flex', alignItems:'center', gap:.75 }}>
            {s.icon}
            <Typography sx={{ fontSize:13, color:'rgba(15,23,42,0.6)' }}>{s.label}:</Typography>
            <Typography sx={{ fontSize:13, fontWeight:700, color:s.color }}>{s.value}</Typography>
          </Box>
        ))}
        {data?.totalElements != null && (
          <Box sx={{ ml:'auto', fontSize:12, color:'rgba(15,23,42,0.4)' }}>
            Page {(data.number ?? 0) + 1} of {data.totalPages ?? 1}
          </Box>
        )}
      </Box>

      {/* Filters */}
      <RecordFilters onAdd={() => openModal('create')} />

      {/* Error */}
      {error && (
        <Box sx={{ p:2 }}>
          <Box sx={{ bgcolor:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.25)', borderRadius:2, p:2, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <Typography sx={{ color:'#ef4444', fontSize:13 }}>Failed to load records</Typography>
            <Button size="small" onClick={refetch} sx={{ color:'#ef4444' }}>Retry</Button>
          </Box>
        </Box>
      )}

      {/* Data view */}
      <Box sx={{ flex:1, overflow:'auto', minHeight:0 }}>
        {isMobile ? (
          <RecordMobileList data={data} loading={isLoading} onDelete={handleDelete} />
        ) : viewMode === 'table' ? (
          <RecordTable data={data} loading={isLoading} onDelete={handleDelete} queryKey={queryKey} />
        ) : (
          <RecordGrid data={data} loading={isLoading} onDelete={handleDelete} queryKey={queryKey} />
        )}
      </Box>

      {/* Mobile FAB */}
      {isMobile && (
        <Fab onClick={() => openModal('create')} sx={{ position:'fixed', bottom:24, right:24, bgcolor:'#0d9488', '&:hover':{ bgcolor:'#0f766e' } }}>
          <AddIcon />
        </Fab>
      )}

      {/* Drawers & Modals */}
      <RecordDetailDrawer data={data} />
      <RecordCreateModal open={modalState === 'create'} onClose={closeModal} />
      <RecordEditModal   open={modalState === 'edit'}   record={editRecord} onClose={closeModal} />
    </Box>
  );
}
