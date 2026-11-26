import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { DataGrid } from '@mui/x-data-grid';
import {
  alpha,
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  InputAdornment,
  Pagination,
  Paper,
  Skeleton,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useT } from '@shared/theme';
import { adminSurface } from '@features/admin/adminUi';
import {
  ArticleRounded as Article,
  DeleteRounded as Delete,
  FolderRounded as Folder,
  HttpRounded as Http,
  RefreshRounded as Refresh,
  ReplayRounded as Replay,
  SearchRounded as Search,
  YouTube,
  LinkRounded as LinkIcon,
  CheckCircleRounded as CheckCircle,
  ErrorRounded as ErrorIcon,
  HistoryRounded as HistoryIcon,
  PauseRounded as Pause,
  CloudDownloadRounded as CloudDownload,
  FilterAltOffRounded as FilterAltOff,
  CloseRounded as Close,
} from '@mui/icons-material';
import { notify } from '@shared/notify';
import { useQueryClient } from '@tanstack/react-query';

import { useJobHistory } from '../hooks/useJobHistory';
import { deleteJob } from '../services/ingestionApi';
import LogViewerDrawer from '../jobs/LogViewerDrawer';
import RerunEditDialog from '../jobs/RerunEditDialog';
import ConfirmDialog from '@features/admin/filemanager/components/ConfirmDialog';
import { formatEta, formatSize } from '../utils/format';

const PAGE_SIZES = [25, 50, 100];
const SEARCH_DEBOUNCE_MS = 300;

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_COLORS = {
  SUCCESS: 'success',
  FAILED: 'error',
  CANCELLED: 'default',
  QUEUED: 'default',
  DOWNLOADING: 'primary',
  PROCESSING: 'warning',
  PAUSED: 'warning',
};

const STATUS_LABELS = {
  SUCCESS: 'Completed',
  FAILED: 'Failed',
  CANCELLED: 'Cancelled',
  QUEUED: 'Queued',
  DOWNLOADING: 'Downloading',
  PROCESSING: 'Processing',
  PAUSED: 'Paused',
};

const SOURCE_ICONS = {
  YOUTUBE: YouTube,
  HTTP: Http,
  TORRENT: LinkIcon,
  LOCAL: Folder,
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function fmtBytes(value) {
  return formatSize(value, '—');
}

function fmtDuration(ms) {
  return ms ? formatEta(Math.round(ms / 1000)) ?? '—' : '—';
}

function safeFileName(row) {
  if (row?.fileName) return row.fileName;
  if (row?.uri) {
    try {
      return row.uri.split('/').pop()?.split('?')[0] || row.jobId;
    } catch {
      return row.jobId;
    }
  }
  return row?.jobId || '—';
}

function SummaryChip({ icon, label, color = 'default', active = false, onClick }) {
  return (
    <Chip
      size="small"
      icon={icon}
      label={label}
      color={color}
      variant={active ? 'filled' : 'outlined'}
      onClick={onClick}
      aria-pressed={onClick ? active : undefined}
      sx={{
        borderRadius: 999,
        fontWeight: 700,
        fontSize: '0.72rem',
        height: 30,
      }}
    />
  );
}

function HistoryActionButton({
  title,
  icon,
  color = 'default',
  loading = false,
  disabled = false,
  onClick,
}) {
  return (
    <Tooltip title={title}>
      <span>
        <IconButton
          size="small"
          color={color}
          onClick={onClick}
          disabled={disabled}
          aria-label={title}
          sx={{
            width: 30,
            height: 30,
            borderRadius: 2,
          }}
        >
          {loading ? <CircularProgress size={14} color="inherit" /> : icon}
        </IconButton>
      </span>
    </Tooltip>
  );
}

const GridEmptyOverlay = memo(function GridEmptyOverlay({ search, onClear }) {
  const T = useT();
  const S = adminSurface(T);

  return (
    <Box
      sx={{
        height: '100%',
        display: 'grid',
        placeItems: 'center',
        p: 3,
      }}
    >
      <Paper
        variant="outlined"
        sx={{
          px: 3,
          py: 4,
          maxWidth: 420,
          textAlign: 'center',
          borderRadius: 3,
          borderStyle: 'dashed',
          borderColor: S.border,
          bgcolor: S.inset,
        }}
      >
        <Stack spacing={1.25} alignItems="center">
          <Box
            sx={{
              width: 54,
              height: 54,
              borderRadius: '50%',
              display: 'grid',
              placeItems: 'center',
              bgcolor: T.tealBg,
              color: T.teal,
            }}
          >
            <HistoryIcon sx={{ fontSize: 26 }} />
          </Box>

          <Typography variant="h6" fontWeight={800}>
            No history found
          </Typography>

          <Typography variant="body2" color="text.secondary">
            {search
              ? 'No jobs match your filters. Try a different keyword or status.'
              : 'Completed and past jobs will appear here.'}
          </Typography>

          {search ? (
            <Button
              size="small"
              variant="outlined"
              startIcon={<FilterAltOff />}
              onClick={onClear}
            >
              Clear filters
            </Button>
          ) : null}
        </Stack>
      </Paper>
    </Box>
  );
});


// Mobile history row — a compact card (a data grid is unusable on a phone).
function HistoryCard({ row, deleting, onRerun, onLogs, onDelete, T, S }) {
  const Icon = SOURCE_ICONS[row.sourceType] ?? Http;
  const isYt = row.sourceType === 'YOUTUBE';
  const label = safeFileName(row);
  const ms = row.startedAt && row.completedAt
    ? new Date(row.completedAt) - new Date(row.startedAt)
    : null;
  return (
    <Paper variant="outlined" sx={{ borderRadius: 2.5, p: 1.25, borderColor: S.border, bgcolor: S.card }}>
      <Stack direction="row" spacing={1} alignItems="flex-start">
        <Box sx={{ width: 32, height: 32, borderRadius: 2, flexShrink: 0, display: 'grid',
          placeItems: 'center', bgcolor: isYt ? T.errorBg : S.inset, color: isYt ? T.error : T.textMuted }}>
          <Icon sx={{ fontSize: 18 }} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography noWrap fontWeight={700} sx={{ fontSize: '0.82rem' }}>{label}</Typography>
          {row.recordName ? (
            <Typography noWrap variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              #{row.recordId} · {row.recordName}
            </Typography>
          ) : null}
        </Box>
        <Chip size="small" label={STATUS_LABELS[row.status] ?? row.status}
          color={STATUS_COLORS[row.status] ?? 'default'}
          sx={{ fontSize: '0.64rem', height: 21, fontWeight: 700, borderRadius: 999, flexShrink: 0 }} />
      </Stack>

      <Stack direction="row" spacing={0.75} sx={{ mt: 0.75, flexWrap: 'wrap' }} useFlexGap>
        <Typography variant="caption" color="text.secondary">{fmtBytes(row.totalBytes || row.downloadedBytes)}</Typography>
        {ms != null ? <Typography variant="caption" color="text.secondary">· {fmtDuration(ms)}</Typography> : null}
        {row.startedAt ? (
          <Typography variant="caption" color="text.secondary">· {new Date(row.startedAt).toLocaleDateString()}</Typography>
        ) : null}
      </Stack>

      {row.status === 'FAILED' && row.failReason ? (
        <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: T.error,
          overflowWrap: 'anywhere' }}>
          {row.failReason}
        </Typography>
      ) : null}

      <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 1 }}>
        <Button size="small" variant="outlined" startIcon={<Replay fontSize="small" />}
          onClick={onRerun} sx={{ minHeight: 40, borderRadius: 999, textTransform: 'none', fontWeight: 700 }}>Rerun</Button>
        <Button size="small" variant="text" startIcon={<Article fontSize="small" />}
          onClick={onLogs} sx={{ minHeight: 40, borderRadius: 999, textTransform: 'none', fontWeight: 700 }}>Logs</Button>
        <Box sx={{ flex: 1 }} />
        <IconButton color="error" onClick={onDelete} disabled={deleting} aria-label="Delete job"
          sx={{ width: 44, height: 44 }}>
          {deleting ? <CircularProgress size={16} color="inherit" /> : <Delete fontSize="small" />}
        </IconButton>
      </Stack>
    </Paper>
  );
}

function HistoryCardSkeleton({ S }) {
  return (
    <Paper variant="outlined" sx={{ borderRadius: 2.5, p: 1.25, borderColor: S.border, bgcolor: S.card }}>
      <Stack direction="row" spacing={1} alignItems="center">
        <Skeleton variant="rounded" width={32} height={32} />
        <Box sx={{ flex: 1 }}>
          <Skeleton width="70%" />
          <Skeleton width="40%" />
        </Box>
        <Skeleton variant="rounded" width={64} height={21} sx={{ borderRadius: 999 }} />
      </Stack>
      <Skeleton width="50%" sx={{ mt: 0.75 }} />
      <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
        <Skeleton variant="rounded" width={80} height={32} sx={{ borderRadius: 999 }} />
        <Skeleton variant="rounded" width={64} height={32} sx={{ borderRadius: 999 }} />
      </Stack>
    </Paper>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function JobHistory() {
  const T = useT();
  const S = adminSurface(T);
  const theme = useTheme();
  const isSmDown = useMediaQuery(theme.breakpoints.down('sm'));

  const qc = useQueryClient();

  const [logJobId, setLogJobId] = useState(null);
  const [rerunEditJobId, setRerunEditJobId] = useState(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(null);
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: PAGE_SIZES[0] });
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [busy, setBusy] = useState({});

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [search]);

  // Any filter change restarts at the first page.
  useEffect(() => {
    setPaginationModel((m) => (m.page === 0 ? m : { ...m, page: 0 }));
  }, [debouncedSearch, statusFilter]);

  const { data, isLoading, isFetching, isPlaceholderData, error, refetch } = useJobHistory({
    page: paginationModel.page,
    size: paginationModel.pageSize,
    q: debouncedSearch,
    status: statusFilter,
  });

  const rows = data?.content ?? [];
  const totalElements = data?.totalElements ?? 0;
  const totalPages = data?.totalPages ?? 0;

  // A delete can empty the last page — step back instead of showing a blank page.
  useEffect(() => {
    if (!isPlaceholderData && totalPages > 0 && paginationModel.page >= totalPages) {
      setPaginationModel((m) => ({ ...m, page: totalPages - 1 }));
    }
  }, [isPlaceholderData, totalPages, paginationModel.page]);

  // Status totals across the whole table (independent of the current search/filter).
  const counts = useMemo(() => {
    const c = data?.counts ?? {};
    return {
      total: c.TOTAL ?? 0,
      success: c.SUCCESS ?? 0,
      failed: c.FAILED ?? 0,
      cancelled: c.CANCELLED ?? 0,
      paused: c.PAUSED ?? 0,
      processing: (c.DOWNLOADING ?? 0) + (c.PROCESSING ?? 0),
    };
  }, [data]);

  const toggleStatus = useCallback(
    (status) => setStatusFilter((cur) => (cur === status ? null : status)),
    []
  );

  const act = useCallback(
    async (id, name, fn) => {
      const key = `${id}_${name}`;
      setBusy((prev) => ({ ...prev, [key]: true }));

      try {
        const res = await fn();
        notify.success(res?.message || `${name} completed`);
        qc.invalidateQueries({ queryKey: ['ingestion-history'] });
      } catch (e) {
        notify.error(e?.response?.data?.message ?? `${name} failed`);
      } finally {
        setBusy((prev) => ({ ...prev, [key]: false }));
      }
    },
    [qc]
  );

  const clearSearch = useCallback(() => setSearch(''), []);
  const clearFilters = useCallback(() => {
    setSearch('');
    setStatusFilter(null);
  }, []);
  const hasFilters = !!search || !!statusFilter;

  const runDelete = useCallback(() => {
    const row = confirmDelete;
    setConfirmDelete(null);
    if (row) act(row.jobId, 'Delete', () => deleteJob(row.jobId));
  }, [act, confirmDelete]);

  const columns = useMemo(
    () => [
      {
        field: 'sourceType',
        headerName: 'Src',
        width: 64,
        sortable: false,
        align: 'center',
        headerAlign: 'center',
        renderCell: ({ value }) => {
          const Icon = SOURCE_ICONS[value] ?? Http;
          const isYt = value === 'YOUTUBE';
          return (
            <Box
              sx={{
                width: 28,
                height: 28,
                display: 'grid',
                placeItems: 'center',
                borderRadius: 2,
                bgcolor: isYt ? T.errorBg : S.inset,
              }}
            >
              <Icon
                sx={{
                  fontSize: 17,
                  color: isYt ? T.error : T.textMuted,
                }}
              />
            </Box>
          );
        },
      },
      {
        field: 'fileName',
        headerName: 'File',
        flex: 1,
        minWidth: 220,
        renderCell: ({ row }) => {
          const label = safeFileName(row);
          return (
            <Tooltip title={row.uri ?? label}>
              <Typography variant="caption" noWrap fontWeight={600}>
                {label}
              </Typography>
            </Tooltip>
          );
        },
      },
      {
        field: 'recordName',
        headerName: 'Record',
        width: 200,
        renderCell: ({ row }) =>
          row.recordName ? (
            <Tooltip title={`ID: ${row.recordId}`}>
              <Typography variant="caption" noWrap>
                {row.recordName}
              </Typography>
            </Tooltip>
          ) : (
            <Typography variant="caption" color="text.disabled">
              —
            </Typography>
          ),
      },
      {
        field: 'status',
        headerName: 'Status',
        width: 130,
        renderCell: ({ row, value }) => {
          const chip = (
            <Chip
              label={STATUS_LABELS[value] ?? value}
              size="small"
              color={STATUS_COLORS[value] ?? 'default'}
              sx={{
                fontSize: '0.68rem',
                height: 22,
                fontWeight: 700,
                borderRadius: 999,
              }}
            />
          );
          return value === 'FAILED' && row.failReason
            ? <Tooltip title={row.failReason}>{chip}</Tooltip>
            : chip;
        },
      },
      {
        field: 'step',
        headerName: 'Stage',
        width: 120,
        renderCell: ({ value }) =>
          value ? (
            <Typography variant="caption" color="text.secondary">
              {value}
            </Typography>
          ) : (
            <Typography variant="caption" color="text.disabled">
              —
            </Typography>
          ),
      },
      {
        field: 'downloadedBytes',
        headerName: 'Size',
        width: 100,
        renderCell: ({ row }) => (
          <Typography variant="caption">
            {fmtBytes(row.totalBytes || row.downloadedBytes)}
          </Typography>
        ),
      },
      {
        field: 'startedAt',
        headerName: 'Started',
        width: 170,
        renderCell: ({ value }) =>
          value ? (
            <Typography variant="caption" color="text.secondary">
              {new Date(value).toLocaleString()}
            </Typography>
          ) : (
            <Typography variant="caption" color="text.disabled">
              —
            </Typography>
          ),
      },
      {
        field: 'duration',
        headerName: 'Duration',
        width: 110,
        sortable: false,
        renderCell: ({ row }) => {
          if (!row.startedAt || !row.completedAt) {
            return (
              <Typography variant="caption" color="text.disabled">
                —
              </Typography>
            );
          }
          const ms = new Date(row.completedAt) - new Date(row.startedAt);
          return <Typography variant="caption">{fmtDuration(ms)}</Typography>;
        },
      },
      {
        field: 'actions',
        headerName: 'Actions',
        width: 132,
        sortable: false,
        filterable: false,
        align: 'center',
        headerAlign: 'center',
        renderCell: ({ row }) => {
          const id = row.jobId;
          const del = !!busy[`${id}_Delete`];
          return (
            <Stack direction="row" spacing={0.2}>
              <HistoryActionButton
                title="Rerun"
                color="primary"
                disabled={del}
                onClick={() => setRerunEditJobId(id)}
                icon={<Replay fontSize="small" />}
              />

              <HistoryActionButton
                title="Logs"
                onClick={() => setLogJobId(id)}
                disabled={del}
                icon={<Article fontSize="small" />}
              />

              <HistoryActionButton
                title="Delete"
                color="error"
                loading={del}
                disabled={del}
                onClick={() => setConfirmDelete(row)}
                icon={<Delete fontSize="small" />}
              />
            </Stack>
          );
        },
      },
    ],
    [busy, T, S]
  );

  return (
    <Box>
      <Stack spacing={1.5}>
        {/* Compact toolbar — search + status summary + refresh in one wrapping row */}
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          alignItems={{ sm: 'center' }}
          useFlexGap
        >
          <TextField
            size="small"
            placeholder="Search file, URL, job ID, record…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ flexGrow: 1, minWidth: 0, maxWidth: { sm: 380 } }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search fontSize="small" />
                </InputAdornment>
              ),
              endAdornment: search ? (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={clearSearch} aria-label="Clear search">
                    <Close fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ) : null,
            }}
            inputProps={{ 'aria-label': 'Search job history' }}
          />

          <Stack
            direction="row"
            spacing={0.75}
            alignItems="center"
            flexWrap="wrap"
            useFlexGap
            sx={{ ml: { sm: 'auto' } }}
          >
            <SummaryChip icon={<HistoryIcon sx={{ fontSize: 14 }} />} label={`Total ${counts.total}`}
              active={!statusFilter} onClick={() => setStatusFilter(null)} />
            <SummaryChip icon={<CheckCircle sx={{ fontSize: 14 }} />} label={`${counts.success}`} color="success"
              active={statusFilter === 'SUCCESS'} onClick={() => toggleStatus('SUCCESS')} />
            <SummaryChip icon={<ErrorIcon sx={{ fontSize: 14 }} />} label={`${counts.failed}`} color="error"
              active={statusFilter === 'FAILED'} onClick={() => toggleStatus('FAILED')} />
            {(counts.cancelled > 0 || statusFilter === 'CANCELLED') && (
              <SummaryChip icon={<Delete sx={{ fontSize: 14 }} />} label={`${counts.cancelled}`}
                active={statusFilter === 'CANCELLED'} onClick={() => toggleStatus('CANCELLED')} />
            )}
            {(counts.paused > 0 || statusFilter === 'PAUSED') && (
              <SummaryChip icon={<Pause sx={{ fontSize: 14 }} />} label={`${counts.paused}`} color="warning"
                active={statusFilter === 'PAUSED'} onClick={() => toggleStatus('PAUSED')} />
            )}
            {counts.processing > 0 && <SummaryChip icon={<CloudDownload sx={{ fontSize: 14 }} />} label={`${counts.processing}`} color="primary" />}
            <Tooltip title="Refresh">
              <span>
                <IconButton
                  size="small"
                  onClick={() => refetch()}
                  disabled={isFetching}
                  aria-label="Refresh history"
                  sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5 }}
                >
                  {isFetching ? <CircularProgress size={16} /> : <Refresh fontSize="small" />}
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        </Stack>

        {/* Error */}
        {error ? (
          <Alert severity="error" sx={{ borderRadius: 3 }}
            action={<Button color="inherit" size="small" onClick={() => refetch()}>Retry</Button>}>
            Failed to load history.
          </Alert>
        ) : null}

        {/* Desktop: data grid · Mobile: card list (a grid is unusable on a phone) */}
        {isSmDown ? (
          isLoading ? (
            <Stack spacing={1} aria-busy="true" aria-label="Loading job history">
              {[0, 1, 2, 3].map((i) => <HistoryCardSkeleton key={i} S={S} />)}
            </Stack>
          ) : rows.length === 0 ? (
            <Paper variant="outlined" sx={{ borderRadius: 3, borderStyle: 'dashed',
              borderColor: S.border, bgcolor: S.inset, p: 3, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                {hasFilters ? 'No jobs match your filters.' : 'Completed and past jobs will appear here.'}
              </Typography>
              {hasFilters ? (
                <Button size="small" startIcon={<FilterAltOff />} onClick={clearFilters} sx={{ mt: 1 }}>
                  Clear filters
                </Button>
              ) : null}
            </Paper>
          ) : (
            <Stack spacing={1} sx={{ opacity: isPlaceholderData ? 0.6 : 1, transition: 'opacity 150ms' }}>
              {rows.map((row) => (
                <HistoryCard
                  key={row.jobId}
                  row={row}
                  deleting={!!busy[`${row.jobId}_Delete`]}
                  onRerun={() => setRerunEditJobId(row.jobId)}
                  onLogs={() => setLogJobId(row.jobId)}
                  onDelete={() => setConfirmDelete(row)}
                  T={T}
                  S={S}
                />
              ))}
              {totalPages > 1 ? (
                <Stack alignItems="center" sx={{ pt: 1 }}>
                  <Pagination
                    count={totalPages}
                    page={paginationModel.page + 1}
                    onChange={(_, p) => {
                      setPaginationModel((m) => ({ ...m, page: p - 1 }));
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    size="medium"
                    siblingCount={0}
                    color="primary"
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                    {totalElements} jobs
                  </Typography>
                </Stack>
              ) : null}
            </Stack>
          )
        ) : (
        <Paper
          elevation={0}
          variant="outlined"
          sx={{
            borderRadius: 3,
            overflow: 'hidden',
            borderColor: S.border,
            bgcolor: S.card,
            boxShadow: 'none',
          }}
        >
          <Box sx={{ height: { xs: 560, md: 620 } }}>
            <DataGrid
              rows={rows}
              columns={columns}
              getRowId={(row) => row.jobId}
              loading={isLoading || isPlaceholderData}
              disableRowSelectionOnClick
              disableColumnSorting
              disableColumnFilter
              density="compact"
              paginationMode="server"
              rowCount={totalElements}
              paginationModel={paginationModel}
              onPaginationModelChange={setPaginationModel}
              pageSizeOptions={PAGE_SIZES}
              slots={{
                noRowsOverlay: () => (
                  <GridEmptyOverlay search={hasFilters} onClear={clearFilters} />
                ),
                noResultsOverlay: () => (
                  <GridEmptyOverlay search={hasFilters} onClear={clearFilters} />
                ),
              }}
              slotProps={{
                loadingOverlay: { variant: 'skeleton', noRowsVariant: 'skeleton' },
              }}
              sx={{
                border: 'none',
                '& .MuiDataGrid-columnHeaders': {
                  bgcolor: S.inset,
                  borderBottom: `1px solid ${alpha(T.border, 0.9)}`,
                },
                '& .MuiDataGrid-cell': {
                  borderBottom: `1px solid ${alpha(T.border, 0.5)}`,
                },
                '& .MuiDataGrid-row:hover': {
                  bgcolor: alpha(T.teal, 0.04),
                },
                '& .MuiDataGrid-footerContainer': {
                  borderTop: `1px solid ${alpha(T.border, 0.9)}`,
                },
                '& .MuiDataGrid-toolbarContainer': {
                  p: 1,
                },
              }}
            />
          </Box>
        </Paper>
        )}
      </Stack>

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete job?"
        message={`"${confirmDelete ? safeFileName(confirmDelete) : ''}" and its logs will be removed from history. Imported media files are not touched.`}
        onConfirm={runDelete}
        onClose={() => setConfirmDelete(null)}
      />

      <LogViewerDrawer
        jobId={logJobId}
        open={!!logJobId}
        onClose={() => setLogJobId(null)}
      />

      <RerunEditDialog
        jobId={rerunEditJobId}
        open={!!rerunEditJobId}
        onClose={() => {
          setRerunEditJobId(null);
          qc.invalidateQueries({ queryKey: ['ingestion-history'] });
        }}
      />
    </Box>
  );
}