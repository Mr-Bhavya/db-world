import { useCallback, useMemo, useRef, useEffect } from 'react';
import { Box, Typography, Fab, useMediaQuery, useTheme, Button, CircularProgress } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import MovieIcon from '@mui/icons-material/Movie';
import TvIcon from '@mui/icons-material/Tv';
import ListIcon from '@mui/icons-material/List';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useT } from '@shared/theme';
import { getRecordsTable, deleteRecord } from '../api/adminApi';
import { useRecordStore } from '../stores/useRecordStore';
import RecordFilters from './RecordFilters';
import RecordTable from './RecordTable';
import RecordGrid from './RecordGrid';
import RecordMobileList from './RecordMobileList';
import RecordDetailDrawer from './RecordDetailDrawer';
import RecordCreateModal from './RecordCreateModal';
import RecordEditModal from './RecordEditModal';
import TmdbDetailModal from './TmdbDetailModal';
import RecordFullDetailModal from './RecordFullDetailModal';
import MediaFilesModal from './MediaFilesModal';

export default function RecordManagementV2() {
  const T = useT();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { enqueueSnackbar } = useSnackbar();
  const qc = useQueryClient();
  const sentinelRef = useRef(null);

  const {
    viewMode, filters, pageSize, sortModel,
    modalState, editRecordId, tmdbModalRecord,
    openModal, closeModal, closeTmdbModal,
  } = useRecordStore();

  const queryParams = useMemo(() => {
    const base = {
      size: pageSize,
      ...(filters.name     && { name:     filters.name }),
      ...(filters.type     && { type:     filters.type }),
      ...(filters.year     && { year:     Number(filters.year) }),
      ...(filters.tmdbId   && { tmdbId:   Number(filters.tmdbId) }),
      ...(filters.recordId && { recordId: Number(filters.recordId) }),
    };
    if (sortModel.length > 0) {
      base.sort = sortModel.map(s => `${s.field},${s.sort}`).join('&sort=');
    }
    return base;
  }, [filters, pageSize, sortModel]);

  const { data, isLoading, isFetchingNextPage, fetchNextPage, hasNextPage, error, refetch } = useInfiniteQuery({
    queryKey: ['records', queryParams],
    queryFn: ({ pageParam = 0 }) => getRecordsTable({ ...queryParams, page: pageParam }),
    getNextPageParam: (last) => {
      const next = (last.number ?? 0) + 1;
      return next < (last.totalPages ?? 1) ? next : undefined;
    },
    placeholderData: prev => prev,
  });

  const allRows = useMemo(() => data?.pages.flatMap(p => p.content ?? []) ?? [], [data]);
  const totalElements = data?.pages[0]?.totalElements ?? 0;

  // Infinite scroll sentinel
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage(); },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const { mutate: doDelete } = useMutation({
    mutationFn: deleteRecord,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['records'] }); enqueueSnackbar('Record deleted', { variant: 'success' }); },
    onError:   () => enqueueSnackbar('Delete failed', { variant: 'error' }),
  });

  const handleDelete = useCallback((id) => {
    if (window.confirm('Delete this record?')) doDelete(id);
  }, [doDelete]);

  const editRecord = useMemo(() => allRows.find(r => r.recordId === editRecordId) ?? null, [allRows, editRecordId]);

  const stats = useMemo(() => ({
    total:  totalElements,
    movies: allRows.filter(r => r.type === 'MOVIE').length,
    series: allRows.filter(r => r.type === 'TV_SERIES').length,
  }), [allRows, totalElements]);

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: T.adminBg, color: T.textPrimary, minHeight: 0 }}>

      {/* Header */}
      <Box sx={{ px: { xs: 2, md: 3 }, pt: { xs: 2, md: 3 }, pb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: { xs: 18, md: 22 }, color: T.textPrimary }}>Records</Typography>
          <Typography sx={{ fontSize: 12, color: T.textMuted, mt: .25 }}>Manage movies and series catalog</Typography>
        </Box>
        {!isMobile && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => openModal('create')}
            sx={{ bgcolor: T.teal, '&:hover': { bgcolor: T.tealHover }, fontWeight: 600 }}>
            Add Record
          </Button>
        )}
      </Box>

      {/* Stats bar */}
      <Box sx={{ display: 'flex', gap: 2, px: { xs: 2, md: 3 }, py: .75, flexWrap: 'wrap', flexShrink: 0 }}>
        {[
          { label: 'Total',   value: stats.total,   icon: <ListIcon  sx={{ fontSize: 14, color: T.teal }} />,    color: T.teal    },
          { label: 'Movies',  value: stats.movies,  icon: <MovieIcon sx={{ fontSize: 14, color: T.teal }} />,    color: T.teal    },
          { label: 'Series',  value: stats.series,  icon: <TvIcon    sx={{ fontSize: 14, color: T.success }} />, color: T.success },
        ].map(s => (
          <Box key={s.label} sx={{ display: 'flex', alignItems: 'center', gap: .75 }}>
            {s.icon}
            <Typography sx={{ fontSize: 13, color: T.textMuted }}>{s.label}:</Typography>
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: s.color }}>{s.value}</Typography>
          </Box>
        ))}
        <Box sx={{ ml: 'auto', fontSize: 12, color: T.textFaint, alignSelf: 'center' }}>
          {allRows.length} / {totalElements} loaded
        </Box>
      </Box>

      {/* Filters */}
      <RecordFilters onAdd={() => openModal('create')} />

      {/* Error */}
      {error && (
        <Box sx={{ px: 2, py: 1, flexShrink: 0 }}>
          <Box sx={{ bgcolor: T.errorBg, border: `1px solid ${T.error}40`, borderRadius: 2, p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography sx={{ color: T.error, fontSize: 13 }}>Failed to load records</Typography>
            <Button size="small" onClick={refetch} sx={{ color: T.error }}>Retry</Button>
          </Box>
        </Box>
      )}

      {/* Data view + scroll */}
      <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0, '&::-webkit-scrollbar': { width: 6 }, '&::-webkit-scrollbar-thumb': { bgcolor: T.scrollThumb, borderRadius: 3 } }}>
        {isMobile ? (
          <RecordMobileList rows={allRows} loading={isLoading} onDelete={handleDelete} />
        ) : viewMode === 'table' ? (
          <RecordTable rows={allRows} totalElements={totalElements} loading={isLoading} onDelete={handleDelete} />
        ) : (
          <RecordGrid rows={allRows} loading={isLoading} onDelete={handleDelete} />
        )}

        {/* Sentinel triggers next page fetch */}
        <Box ref={sentinelRef} sx={{ height: 4 }} />

        {isFetchingNextPage && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <CircularProgress size={22} sx={{ color: T.teal }} />
          </Box>
        )}
      </Box>

      {/* Mobile FAB */}
      {isMobile && (
        <Fab onClick={() => openModal('create')} sx={{ position: 'fixed', bottom: 24, right: 24, bgcolor: T.teal, '&:hover': { bgcolor: T.tealHover }, color: '#fff' }}>
          <AddIcon />
        </Fab>
      )}

      <RecordDetailDrawer rows={allRows} />
      <RecordCreateModal    open={modalState === 'create'} onClose={closeModal} />
      <RecordEditModal      open={modalState === 'edit'}   record={editRecord} onClose={closeModal} />
      <TmdbDetailModal      record={tmdbModalRecord} onClose={closeTmdbModal} />
      <RecordFullDetailModal />
      <MediaFilesModal />
    </Box>
  );
}
