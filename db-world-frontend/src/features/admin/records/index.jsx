import { useCallback, useMemo, useState, useEffect } from 'react';
import {
  Box, Typography, useMediaQuery, useTheme, Button,
  CircularProgress, Skeleton, LinearProgress, IconButton, Tooltip,
  Select, MenuItem,
} from '@mui/material';
import AddIcon              from '@mui/icons-material/Add';
import ListIcon             from '@mui/icons-material/List';
import SyncIcon             from '@mui/icons-material/Sync';
import VisibilityIcon       from '@mui/icons-material/Visibility';
import VisibilityOffIcon    from '@mui/icons-material/VisibilityOff';
import DeleteIcon           from '@mui/icons-material/Delete';
import CloseIcon            from '@mui/icons-material/Close';
import FirstPageIcon        from '@mui/icons-material/FirstPage';
import LastPageIcon         from '@mui/icons-material/LastPage';
import ChevronLeftIcon      from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon     from '@mui/icons-material/ChevronRight';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notify } from '@shared/notify';
import { useT } from '@shared/theme';
import { getRecordsTable, deleteRecord, getTmdbSyncStats, refreshRecordFromTmdb, setRecordVisibility } from '../api/adminApi';
import { useRecordStore } from '../stores/useRecordStore';
import RecordFilters      from './RecordFilters';
import RecordTable        from './RecordTable';
import RecordMobileList   from './RecordMobileList';
import RecordDetailDrawer from './RecordDetailDrawer';
import RecordCreateModal  from './RecordCreateModal';
import RecordEditModal    from './RecordEditModal';

// Sync-health chips — double as the status filter (click to toggle). Colors match
// the former standalone TMDB Sync page so the visual language carries over.
const SYNC_CHIPS = [
  { value: 'SUCCESS', key: 'success', label: 'Success', color: '#10b981' },
  { value: 'FAILED',  key: 'failed',  label: 'Failed',  color: '#ef4444' },
  { value: 'SKIPPED', key: 'skipped', label: 'Skipped', color: '#6b7280' },
  { value: 'RUNNING', key: 'running', label: 'Running', color: '#f59e0b' },
];

// ── Bulk action bar — shown when rows are selected ──────────────────────────────
function BulkBar({ count, busy, onResync, onShow, onHide, onDelete, onClear, T }) {
  const action = (icon, label, onClick, danger) => (
    <Box onClick={busy ? undefined : onClick}
      sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: busy ? 'default' : 'pointer',
        px: 1, py: 0.5, borderRadius: 1, fontSize: 13,
        color: danger ? T.error : T.teal, opacity: busy ? 0.5 : 1,
        '&:hover': { bgcolor: danger ? T.errorBg : T.tealBg } }}>
      {icon}{label}
    </Box>
  );
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap',
      px: { xs: 1.5, md: 3 }, py: 0.75, flexShrink: 0,
      bgcolor: T.tealBg, borderBottom: `1px solid ${T.border}` }}>
      <Typography sx={{ fontSize: 13, fontWeight: 700, color: T.teal, mr: 1 }}>{count} selected</Typography>
      {busy && <CircularProgress size={14} sx={{ color: T.teal, mr: 1 }} />}
      {action(<SyncIcon sx={{ fontSize: 16 }} />, 'Re-sync', onResync)}
      {action(<VisibilityIcon sx={{ fontSize: 16 }} />, 'Show on rails', onShow)}
      {action(<VisibilityOffIcon sx={{ fontSize: 16 }} />, 'Hide from rails', onHide)}
      {action(<DeleteIcon sx={{ fontSize: 16 }} />, 'Delete', onDelete, true)}
      <Box sx={{ flex: 1 }} />
      <Tooltip title="Clear selection">
        <IconButton size="small" onClick={onClear} sx={{ color: T.textMuted }}>
          <CloseIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Tooltip>
    </Box>
  );
}

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
  const qc = useQueryClient();

  const {
    filters, setFilter, pageSize, setPageSize, sortModel,
    modalState, editRecordId,
    openModal, closeModal,
    selectedRows, clearSelection,
  } = useRecordStore();

  const [bulkBusy, setBulkBusy] = useState(false);

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
      ...(filters.status   && { status:   filters.status }),
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

  // Defensive de-dupe by recordId. The DataGrid keys rows by id; any duplicate id
  // makes it render the first matching row for all of them (looks like rows
  // "overwrite" with the first on scroll). The backend now returns one row per
  // record, but this guarantees a stray duplicate can never corrupt rendering.
  const rows = useMemo(() => {
    const seen = new Set();
    return (data?.content ?? []).filter(r => {
      if (seen.has(r.recordId)) return false;
      seen.add(r.recordId);
      return true;
    });
  }, [data]);
  const totalElements = data?.totalElements ?? 0;
  const totalPages    = data?.totalPages ?? 1;

  // Sync-health counts for the strip. Polls only while something is RUNNING so we
  // aren't hitting the endpoint every 30s when the catalog is idle.
  const { data: syncStats } = useQuery({
    queryKey: ['tmdb-sync-stats'],
    queryFn:  getTmdbSyncStats,
    staleTime: 30_000,
    refetchInterval: q => (q.state.data?.running > 0 ? 15_000 : false),
  });

  const { mutate: doDelete } = useMutation({
    mutationFn: deleteRecord,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['records'] });
      notify.success('Record deleted');
    },
    onError: () => notify.error('Delete failed'),
  });

  const handleDelete = useCallback((id) => {
    if (window.confirm('Delete this record?')) doDelete(id);
  }, [doDelete]);

  // Bulk actions fan out over the current single-record endpoints (no dedicated
  // bulk API yet). Selection is driven by the DataGrid checkboxes.
  const runBulk = useCallback(async (label, fn) => {
    setBulkBusy(true);
    try {
      await Promise.all(selectedRows.map(fn));
      qc.invalidateQueries({ queryKey: ['records'] });
      qc.invalidateQueries({ queryKey: ['tmdb-sync-stats'] });
      notify.success(`${label} ${selectedRows.length} record${selectedRows.length !== 1 ? 's' : ''}`);
      clearSelection();
    } catch {
      notify.error(`${label} failed for some records`);
    } finally {
      setBulkBusy(false);
    }
  }, [selectedRows, qc, clearSelection]);

  const handleBulkDelete = useCallback(() => {
    if (window.confirm(`Delete ${selectedRows.length} record(s)? This cannot be undone.`)) {
      runBulk('Deleted', id => deleteRecord(id));
    }
  }, [selectedRows, runBulk]);

  const editRecord = useMemo(() =>
    rows.find(r => r.recordId === editRecordId) ?? null,
  [rows, editRecordId]);

  return (
    <Box sx={{ height: 'calc(100vh - 52px)', display: 'flex', flexDirection: 'column',
      bgcolor: T.adminBg, color: T.textPrimary, overflow: 'hidden' }}>

      {/* Header */}
      <Box sx={{ px: { xs: 1.5, md: 3 }, pt: { xs: 1.5, md: 2 }, pb: 0.75,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: { xs: 18, md: 22 }, color: T.textPrimary }}>
            Records
          </Typography>
          <Typography sx={{ fontSize: 12, color: T.textMuted, mt: 0.25, display: { xs: 'none', sm: 'block' } }}>
            Manage the catalog and its TMDB sync state
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => openModal('create')}
          sx={{ bgcolor: T.teal, '&:hover': { bgcolor: T.tealHover }, fontWeight: 600,
            px: { xs: 1.5, sm: 2 }, whiteSpace: 'nowrap' }}>
          {isMobile ? 'Add' : 'Add record'}
        </Button>
      </Box>

      {/* Sync-health strip — Total (true count) + clickable status filters + last sync */}
      <Box sx={{ display: 'flex', gap: 1, px: { xs: 1.5, md: 3 }, py: 0.5,
        flexWrap: 'wrap', alignItems: 'center', flexShrink: 0,
        borderBottom: `1px solid ${T.border}` }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mr: 0.5 }}>
          <ListIcon sx={{ fontSize: 14, color: T.teal }} />
          <Typography sx={{ fontSize: 12, color: T.textMuted }}>Total:</Typography>
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: T.teal }}>{totalElements}</Typography>
        </Box>

        {SYNC_CHIPS.map(c => {
          const active = filters.status === c.value;
          return (
            <Box key={c.value}
              onClick={() => setFilter('status', active ? '' : c.value)}
              title={`Filter by ${c.label.toLowerCase()} sync status`}
              sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer',
                px: 1, py: 0.25, borderRadius: 1,
                border: `1px solid ${active ? c.color : 'transparent'}`,
                bgcolor: active ? `${c.color}22` : 'transparent',
                '&:hover': { bgcolor: `${c.color}18` } }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: c.color, flexShrink: 0 }} />
              <Typography sx={{ fontSize: 12, color: active ? c.color : T.textMuted }}>{c.label}</Typography>
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: c.color }}>{syncStats?.[c.key] ?? 0}</Typography>
            </Box>
          );
        })}

        <Box sx={{ flex: 1 }} />

        {syncStats?.lastSyncedAt && (
          <Typography sx={{ fontSize: 11, color: T.textFaint }}>
            Last synced {new Date(syncStats.lastSyncedAt).toLocaleString('en-IN',
              { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </Typography>
        )}
      </Box>

      {/* Filters */}
      <RecordFilters />

      {/* Bulk action bar — appears when rows are checked */}
      {selectedRows.length > 0 && (
        <BulkBar
          count={selectedRows.length}
          busy={bulkBusy}
          onResync={() => runBulk('Re-synced', id => refreshRecordFromTmdb(id))}
          onShow={() => runBulk('Updated', id => setRecordVisibility(id, false))}
          onHide={() => runBulk('Updated', id => setRecordVisibility(id, true))}
          onDelete={handleBulkDelete}
          onClear={clearSelection}
          T={T}
        />
      )}

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
        {isLoading
          ? <SkeletonRows T={T} />
          : isMobile
            ? <RecordMobileList rows={rows} onDelete={handleDelete} />
            : <RecordTable rows={rows} totalElements={totalElements} loading={false} onDelete={handleDelete} />}
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

      <RecordDetailDrawer rows={rows} />
      <RecordCreateModal    open={modalState === 'create'} onClose={closeModal} />
      <RecordEditModal      open={modalState === 'edit'}   record={editRecord} onClose={closeModal} />
    </Box>
  );
}
