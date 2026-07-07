import React, { memo, useCallback, useMemo, useState } from 'react';
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
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import { useT } from '@shared/theme';
import {
  Article,
  Delete,
  Folder,
  Http,
  Refresh,
  Replay,
  Tune,
  Search,
  YouTube,
  Link as LinkIcon,
  CheckCircle,
  Error as ErrorIcon,
  History as HistoryIcon,
  Pause,
  CloudDownload,
  FilterAltOff,
  Close,
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { useQueryClient } from '@tanstack/react-query';

import { useJobHistory } from '../hooks/useJobHistory';
import { deleteJob, rerunJob } from '../services/ingestionApi';
import LogViewerDrawer from '../jobs/LogViewerDrawer';
import RerunEditDialog from '../jobs/RerunEditDialog';

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
  if (value === null || value === undefined) return '—';
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return '—';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function fmtDuration(ms) {
  if (!ms) return '—';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
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

function matchesSearch(row, search) {
  if (!search) return true;
  const q = search.toLowerCase();

  return [
    row?.uri,
    row?.fileName,
    row?.jobId,
    row?.recordName,
    row?.status,
    row?.step,
    row?.sourceType,
  ]
    .filter(Boolean)
    .some((v) => String(v).toLowerCase().includes(q));
}

function SummaryChip({ icon, label, color = 'default' }) {
  return (
    <Chip
      size="small"
      icon={icon}
      label={label}
      color={color}
      variant="outlined"
      sx={{
        borderRadius: 999,
        fontWeight: 700,
        fontSize: '0.72rem',
        height: 28,
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
  const theme = useTheme();

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
          borderRadius: 4,
          borderStyle: 'dashed',
          bgcolor: alpha(theme.palette.primary.main, 0.02),
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
              bgcolor: alpha(theme.palette.primary.main, 0.08),
              color: 'primary.main',
            }}
          >
            <HistoryIcon sx={{ fontSize: 26 }} />
          </Box>

          <Typography variant="h6" fontWeight={800}>
            No history found
          </Typography>

          <Typography variant="body2" color="text.secondary">
            {search
              ? 'No jobs match your search. Try a different keyword.'
              : 'Completed and past jobs will appear here.'}
          </Typography>

          {search ? (
            <Button
              size="small"
              variant="outlined"
              startIcon={<FilterAltOff />}
              onClick={onClear}
            >
              Clear search
            </Button>
          ) : null}
        </Stack>
      </Paper>
    </Box>
  );
});

const GridLoadingOverlay = memo(function GridLoadingOverlay() {
  return (
    <Box
      sx={{
        height: '100%',
        display: 'grid',
        placeItems: 'center',
      }}
    >
      <Stack spacing={1.15} alignItems="center">
        <CircularProgress />
        <Typography variant="body2" fontWeight={700}>
          Loading job history…
        </Typography>
      </Stack>
    </Box>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function JobHistory() {
  const T = useT();
  const theme = useTheme();

  const { enqueueSnackbar } = useSnackbar();
  const qc = useQueryClient();

  const [logJobId, setLogJobId] = useState(null);
  const [rerunEditJobId, setRerunEditJobId] = useState(null);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState({});

  const { data, isLoading, error, refetch } = useJobHistory();

  const allRows = useMemo(() => data ?? [], [data]);

  const rows = useMemo(
    () => allRows.filter((row) => matchesSearch(row, search)),
    [allRows, search]
  );

  const counts = useMemo(() => {
    let success = 0;
    let failed = 0;
    let cancelled = 0;
    let paused = 0;
    let processing = 0;

    allRows.forEach((row) => {
      switch (row.status) {
        case 'SUCCESS':
          success += 1;
          break;
        case 'FAILED':
          failed += 1;
          break;
        case 'CANCELLED':
          cancelled += 1;
          break;
        case 'PAUSED':
          paused += 1;
          break;
        case 'DOWNLOADING':
        case 'PROCESSING':
          processing += 1;
          break;
        default:
          break;
      }
    });

    return {
      total: allRows.length,
      success,
      failed,
      cancelled,
      paused,
      processing,
    };
  }, [allRows]);

  const act = useCallback(
    async (id, name, fn) => {
      const key = `${id}_${name}`;
      setBusy((prev) => ({ ...prev, [key]: true }));

      try {
        const res = await fn();
        enqueueSnackbar(res?.message || `${name} completed`, {
          variant: 'success',
        });
        qc.invalidateQueries({ queryKey: ['ingestion-history'] });
      } catch (e) {
        enqueueSnackbar(
          e?.response?.data?.message ?? `${name} failed`,
          { variant: 'error' }
        );
      } finally {
        setBusy((prev) => ({ ...prev, [key]: false }));
      }
    },
    [enqueueSnackbar, qc]
  );

  const clearSearch = useCallback(() => setSearch(''), []);

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
          return (
            <Box
              sx={{
                width: 28,
                height: 28,
                display: 'grid',
                placeItems: 'center',
                borderRadius: 2,
                bgcolor: alpha(
                  value === 'YOUTUBE'
                    ? theme.palette.error.main
                    : theme.palette.text.primary,
                  0.06
                ),
              }}
            >
              <Icon
                sx={{
                  fontSize: 17,
                  color: value === 'YOUTUBE' ? 'error.main' : 'text.secondary',
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
        renderCell: ({ value }) => (
          <Chip
            label={value}
            size="small"
            color={STATUS_COLORS[value] ?? 'default'}
            sx={{
              fontSize: '0.68rem',
              height: 22,
              fontWeight: 700,
              borderRadius: 999,
            }}
          />
        ),
      },
      {
        field: 'step',
        headerName: 'Last step',
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
        width: 176,
        sortable: false,
        filterable: false,
        align: 'center',
        headerAlign: 'center',
        renderCell: ({ row }) => {
          const id = row.jobId;
          return (
            <Stack direction="row" spacing={0.2}>
              <HistoryActionButton
                title="Rerun"
                color="primary"
                loading={!!busy[`${id}_Rerun`]}
                disabled={!!busy[`${id}_Rerun`] || !!busy[`${id}_Delete`]}
                onClick={() => act(id, 'Rerun', () => rerunJob(id))}
                icon={<Replay fontSize="small" />}
              />

              <HistoryActionButton
                title="Edit & rerun"
                color="primary"
                disabled={!!busy[`${id}_Rerun`] || !!busy[`${id}_Delete`]}
                onClick={() => setRerunEditJobId(id)}
                icon={<Tune fontSize="small" />}
              />

              <HistoryActionButton
                title="Logs"
                onClick={() => setLogJobId(id)}
                disabled={!!busy[`${id}_Rerun`] || !!busy[`${id}_Delete`]}
                icon={<Article fontSize="small" />}
              />

              <HistoryActionButton
                title="Delete"
                color="error"
                loading={!!busy[`${id}_Delete`]}
                disabled={!!busy[`${id}_Rerun`] || !!busy[`${id}_Delete`]}
                onClick={() => act(id, 'Delete', () => deleteJob(id))}
                icon={<Delete fontSize="small" />}
              />
            </Stack>
          );
        },
      },
    ],
    [act, busy, theme]
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
                  <IconButton size="small" onClick={clearSearch}>
                    <Close fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ) : null,
            }}
          />

          <Stack
            direction="row"
            spacing={0.75}
            alignItems="center"
            flexWrap="wrap"
            useFlexGap
            sx={{ ml: { sm: 'auto' } }}
          >
            <SummaryChip icon={<HistoryIcon sx={{ fontSize: 14 }} />} label={`Total ${counts.total}`} />
            <SummaryChip icon={<CheckCircle sx={{ fontSize: 14 }} />} label={`${counts.success}`} color="success" />
            <SummaryChip icon={<ErrorIcon sx={{ fontSize: 14 }} />} label={`${counts.failed}`} color="error" />
            {counts.cancelled > 0 && <SummaryChip icon={<Delete sx={{ fontSize: 14 }} />} label={`${counts.cancelled}`} />}
            {counts.paused > 0 && <SummaryChip icon={<Pause sx={{ fontSize: 14 }} />} label={`${counts.paused}`} color="warning" />}
            {counts.processing > 0 && <SummaryChip icon={<CloudDownload sx={{ fontSize: 14 }} />} label={`${counts.processing}`} color="primary" />}
            <Tooltip title="Refresh">
              <span>
                <IconButton
                  size="small"
                  onClick={() => refetch()}
                  disabled={isLoading}
                  sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5 }}
                >
                  {isLoading ? <CircularProgress size={16} /> : <Refresh fontSize="small" />}
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        </Stack>

        {/* Error */}
        {error ? (
          <Alert severity="error" sx={{ borderRadius: 3 }}>
            Failed to load history.
          </Alert>
        ) : null}

        {/* Grid */}
        <Paper
          elevation={0}
          variant="outlined"
          sx={{
            borderRadius: 4,
            overflow: 'hidden',
          }}
        >
          <Box sx={{ height: { xs: 560, md: 620 } }}>
            <DataGrid
              rows={rows}
              columns={columns}
              getRowId={(row) => row.jobId}
              loading={isLoading}
              disableRowSelectionOnClick
              density="compact"
              pageSizeOptions={[25, 50, 100]}
              initialState={{
                pagination: {
                  paginationModel: { pageSize: 25 },
                },
              }}
              slots={{
                noRowsOverlay: () => (
                  <GridEmptyOverlay search={search} onClear={clearSearch} />
                ),
                noResultsOverlay: () => (
                  <GridEmptyOverlay search={search} onClear={clearSearch} />
                ),
                loadingOverlay: GridLoadingOverlay,
              }}
              sx={{
                border: 'none',
                '& .MuiDataGrid-columnHeaders': {
                  bgcolor:
                    theme.palette.mode === 'dark'
                      ? alpha(theme.palette.common.white, 0.025)
                      : alpha(theme.palette.primary.main, 0.03),
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
      </Stack>

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