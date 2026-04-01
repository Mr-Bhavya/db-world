import { useCallback, useMemo, useState, useEffect } from 'react';
import {
  Box, Typography, Fab, useMediaQuery, useTheme, Button,
  CircularProgress, Skeleton, LinearProgress, IconButton, Tooltip,
  Select, MenuItem,
} from '@mui/material';
import AddIcon              from '@mui/icons-material/Add';
import MovieIcon            from '@mui/icons-material/Movie';
import TvIcon               from '@mui/icons-material/Tv';
import ListIcon             from '@mui/icons-material/List';
import FirstPageIcon        from '@mui/icons-material/FirstPage';
import LastPageIcon         from '@mui/icons-material/LastPage';
import ChevronLeftIcon      from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon     from '@mui/icons-material/ChevronRight';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useT } from '@shared/theme';
import { getRecordsTable, deleteRecord } from '../api/adminApi';
import { useRecordStore } from '../stores/useRecordStore';
import RecordFilters      from './RecordFilters';
import RecordTable        from './RecordTable';
import RecordGrid         from './RecordGrid';
import RecordMobileList   from './RecordMobileList';
import RecordDetailDrawer from './RecordDetailDrawer';
import RecordCreateModal  from './RecordCreateModal';
import RecordEditModal    from './RecordEditModal';
import TmdbDetailModal    from './TmdbDetailModal';
import RecordFullDetailModal from './RecordFullDetailModal';
import MediaFilesModal    from './MediaFilesModal';

// ── Pagination bar ────────────────────────────────────────────────────────────
function PaginationBar({ page, totalPages, totalElements, pageSize, onPage, onPageSize, isFetching, T }) {
  const start = totalElements === 0 ? 0 : page * pageSize + 1;
  const end   = Math.min((page + 1) * pageSize, totalElements);

  // Build page buttons: always show first, last, current ±1, with ellipsis gaps
  const pageButtons = useMemo(() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i);
    const set = new Set([0, totalPages - 1, page, page - 1, page + 1].filter(p => p >= 0 && p < totalPages));
    const sorted = [...set].sort((a, b) => a - b);
    const result = [];
    sorted.forEach((p, i) => {
      if (i > 0 && p - sorted[i - 1] > 1) result.push('…');
      result.push(p);
    });
    return result;
  }, [page, totalPages]);

  return (
    <Box sx={{ flexShrink: 0, display: 'flex', alignItems: 'center', flexWrap: 'wrap',
      gap: { xs: 0.5, sm: 1 }, px: { xs: 1.5, sm: 2.5, md: 3 }, py: 1,
      borderTop: `1px solid ${T.border}`, bgcolor: T.adminBg }}>

      {/* Record range */}
      <Typography sx={{ fontSize: 12, color: T.textMuted, mr: { xs: 0, sm: 1 } }}>
        {start}–{end} of {totalElements}
      </Typography>

      {/* Page size */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Typography sx={{ fontSize: 11, color: T.textFaint }}>per page</Typography>
        <Select value={pageSize} size="small"
          onChange={e => { onPageSize(Number(e.target.value)); onPage(0); }}
          sx={{ height: 28, fontSize: 11, color: T.textPrimary,
            '.MuiOutlinedInput-notchedOutline': { borderColor: T.border },
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: T.teal },
            '.MuiSvgIcon-root': { color: T.textFaint },
            bgcolor: T.inputBg }}>
          {[10, 25, 50, 100].map(n => <MenuItem key={n} value={n} sx={{ fontSize: 12 }}>{n}</MenuItem>)}
        </Select>
      </Box>

      <Box sx={{ flex: 1 }} />

      {/* Fetching indicator */}
      {isFetching && <CircularProgress size={14} sx={{ color: T.teal }} />}

      {/* Nav buttons */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
        <Tooltip title="First page">
          <span>
            <IconButton size="small" disabled={page === 0} onClick={() => onPage(0)}
              sx={{ color: T.textFaint, '&:not(:disabled):hover': { color: T.teal, bgcolor: T.tealBg } }}>
              <FirstPageIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Previous page">
          <span>
            <IconButton size="small" disabled={page === 0} onClick={() => onPage(page - 1)}
              sx={{ color: T.textFaint, '&:not(:disabled):hover': { color: T.teal, bgcolor: T.tealBg } }}>
              <ChevronLeftIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </span>
        </Tooltip>

        {/* Page number buttons — hidden on xs */}
        <Box sx={{ display: { xs: 'none', sm: 'flex' }, alignItems: 'center', gap: 0.25 }}>
          {pageButtons.map((p, i) =>
            p === '…'
              ? <Typography key={`e${i}`} sx={{ fontSize: 12, color: T.textFaint, px: 0.5 }}>…</Typography>
              : <Box key={p} onClick={() => onPage(p)}
                  sx={{ minWidth: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    borderRadius: 1, cursor: 'pointer', fontSize: 12, fontWeight: p === page ? 700 : 400,
                    color: p === page ? T.teal : T.textMuted,
                    bgcolor: p === page ? T.tealBg : 'transparent',
                    border: `1px solid ${p === page ? T.teal + '55' : 'transparent'}`,
                    '&:hover': { bgcolor: T.tealBg, color: T.teal } }}>
                  {p + 1}
                </Box>
          )}
        </Box>

        {/* Current page label on xs */}
        <Typography sx={{ display: { xs: 'block', sm: 'none' }, fontSize: 12, color: T.textMuted, px: 0.5 }}>
          {page + 1} / {totalPages}
        </Typography>

        <Tooltip title="Next page">
          <span>
            <IconButton size="small" disabled={page >= totalPages - 1} onClick={() => onPage(page + 1)}
              sx={{ color: T.textFaint, '&:not(:disabled):hover': { color: T.teal, bgcolor: T.tealBg } }}>
              <ChevronRightIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Last page">
          <span>
            <IconButton size="small" disabled={page >= totalPages - 1} onClick={() => onPage(totalPages - 1)}
              sx={{ color: T.textFaint, '&:not(:disabled):hover': { color: T.teal, bgcolor: T.tealBg } }}>
              <LastPageIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </span>
        </Tooltip>
      </Box>
    </Box>
  );
}

// ── Skeleton rows loader ───────────────────────────────────────────────────────
function SkeletonRows({ T }) {
  return (
    <Box sx={{ px: { xs: 1, md: 2 }, py: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      {[...Array(10)].map((_, i) => (
        <Skeleton key={i} variant="rectangular" height={42}
          sx={{ borderRadius: 1, bgcolor: T.glass, width: '100%' }} />
      ))}
    </Box>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function RecordManagementV2() {
  const T       = useT();
  const theme   = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { enqueueSnackbar } = useSnackbar();
  const qc = useQueryClient();

  const {
    viewMode, filters, pageSize, setPageSize, sortModel,
    modalState, editRecordId, tmdbModalRecord,
    openModal, closeModal, closeTmdbModal,
  } = useRecordStore();

  const [page, setPage] = useState(0);

  // Reset to page 0 whenever filters or sort change
  useEffect(() => { setPage(0); }, [filters, sortModel]);

  const queryParams = useMemo(() => {
    const base = {
      page,
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
  }, [filters, pageSize, sortModel, page]);

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey:  ['records', queryParams],
    queryFn:   () => getRecordsTable(queryParams),
    placeholderData: prev => prev,
    staleTime: 30_000,
  });

  const rows         = data?.content ?? [];
  const totalElements = data?.totalElements ?? 0;
  const totalPages    = data?.totalPages ?? 1;

  const { mutate: doDelete } = useMutation({
    mutationFn: deleteRecord,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['records'] });
      enqueueSnackbar('Record deleted', { variant: 'success' });
    },
    onError: () => enqueueSnackbar('Delete failed', { variant: 'error' }),
  });

  const handleDelete = useCallback((id) => {
    if (window.confirm('Delete this record?')) doDelete(id);
  }, [doDelete]);

  const editRecord = useMemo(() =>
    rows.find(r => r.recordId === editRecordId) ?? null,
  [rows, editRecordId]);

  const stats = useMemo(() => ({
    movies: rows.filter(r => r.type === 'MOVIE').length,
    series: rows.filter(r => r.type === 'TV_SERIES').length,
  }), [rows]);

  return (
    <Box sx={{ height: 'calc(100vh - 52px)', display: 'flex', flexDirection: 'column',
      bgcolor: T.adminBg, color: T.textPrimary, overflow: 'hidden' }}>

      {/* Header */}
      <Box sx={{ px: { xs: 2, md: 3 }, pt: { xs: 1.5, md: 2 }, pb: 0.75,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: { xs: 18, md: 22 }, color: T.textPrimary }}>
            Records
          </Typography>
          <Typography sx={{ fontSize: 12, color: T.textMuted, mt: 0.25 }}>
            Manage movies and series catalog
          </Typography>
        </Box>
        {!isMobile && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => openModal('create')}
            sx={{ bgcolor: T.teal, '&:hover': { bgcolor: T.tealHover }, fontWeight: 600 }}>
            Add Record
          </Button>
        )}
      </Box>

      {/* Stats bar */}
      <Box sx={{ display: 'flex', gap: 2, px: { xs: 2, md: 3 }, py: 0.5,
        flexWrap: 'wrap', alignItems: 'center', flexShrink: 0,
        borderBottom: `1px solid ${T.border}` }}>
        {[
          { label: 'Total',  value: totalElements, icon: <ListIcon  sx={{ fontSize: 14, color: T.teal }} />,    color: T.teal    },
          { label: 'Movies', value: stats.movies,  icon: <MovieIcon sx={{ fontSize: 14, color: T.teal }} />,    color: T.teal    },
          { label: 'Series', value: stats.series,  icon: <TvIcon    sx={{ fontSize: 14, color: T.success }} />, color: T.success },
        ].map(s => (
          <Box key={s.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            {s.icon}
            <Typography sx={{ fontSize: 12, color: T.textMuted }}>{s.label}:</Typography>
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: s.color }}>{s.value}</Typography>
          </Box>
        ))}
      </Box>

      {/* Filters */}
      <RecordFilters onAdd={() => openModal('create')} />

      {/* Loading bar — shown when fetching (not initial skeleton) */}
      {isFetching && !isLoading && (
        <LinearProgress sx={{ height: 2, flexShrink: 0,
          bgcolor: T.tealBg, '& .MuiLinearProgress-bar': { bgcolor: T.teal } }} />
      )}

      {/* Error */}
      {error && (
        <Box sx={{ px: 2, py: 1, flexShrink: 0 }}>
          <Box sx={{ bgcolor: T.errorBg, border: `1px solid ${T.error}40`,
            borderRadius: 2, p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography sx={{ color: T.error, fontSize: 13 }}>Failed to load records</Typography>
            <Button size="small" onClick={refetch} sx={{ color: T.error }}>Retry</Button>
          </Box>
        </Box>
      )}

      {/* Data */}
      <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0,
        '&::-webkit-scrollbar': { width: 6 },
        '&::-webkit-scrollbar-thumb': { bgcolor: T.scrollThumb, borderRadius: 3 } }}>
        {isLoading ? (
          <SkeletonRows T={T} />
        ) : isMobile ? (
          <RecordMobileList rows={rows} loading={false} onDelete={handleDelete} />
        ) : viewMode === 'table' ? (
          <RecordTable rows={rows} totalElements={totalElements} loading={false} onDelete={handleDelete} />
        ) : (
          <RecordGrid rows={rows} loading={false} onDelete={handleDelete} />
        )}
      </Box>

      {/* Pagination */}
      {!isLoading && totalElements > 0 && (
        <PaginationBar
          page={page}
          totalPages={totalPages}
          totalElements={totalElements}
          pageSize={pageSize}
          onPage={setPage}
          onPageSize={setPageSize}
          isFetching={isFetching}
          T={T}
        />
      )}

      {/* Mobile FAB */}
      {isMobile && (
        <Fab onClick={() => openModal('create')}
          sx={{ position: 'fixed', bottom: 24, right: 24,
            bgcolor: T.teal, '&:hover': { bgcolor: T.tealHover }, color: '#fff' }}>
          <AddIcon />
        </Fab>
      )}

      <RecordDetailDrawer rows={rows} />
      <RecordCreateModal    open={modalState === 'create'} onClose={closeModal} />
      <RecordEditModal      open={modalState === 'edit'}   record={editRecord} onClose={closeModal} />
      <TmdbDetailModal      record={tmdbModalRecord} onClose={closeTmdbModal} />
      <RecordFullDetailModal />
      <MediaFilesModal />
    </Box>
  );
}
