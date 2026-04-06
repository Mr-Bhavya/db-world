import React, { useState, useCallback } from 'react';
import { DataGrid } from '@mui/x-data-grid';
import {
  Box, Chip, Typography, IconButton, Tooltip, Stack,
  CircularProgress, Alert, TextField, InputAdornment, Button,
  alpha,
} from '@mui/material';
import { useT } from '@shared/theme';
import {
  Replay, Article, Delete, Search, Refresh,
  YouTube, Http, Folder,
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { useQueryClient } from '@tanstack/react-query';
import { useJobHistory } from '../hooks/useJobHistory';
import { rerunJob, deleteJob, getJobReport } from '../services/ingestionApi';
import LogViewerDrawer from '../jobs/LogViewerDrawer';

const STATUS_COLORS = {
  SUCCESS:   'success',
  FAILED:    'error',
  CANCELLED: 'default',
  QUEUED:    'default',
  DOWNLOADING: 'primary',
  PROCESSING:  'warning',
  PAUSED:    'warning',
};

const SOURCE_ICONS = { YOUTUBE: YouTube, HTTP: Http, TORRENT: Http, LOCAL: Folder };

function fmtBytes(b) {
  if (!b) return '—';
  if (b < 1024 ** 3) return `${(b / 1024 ** 2).toFixed(1)} MB`;
  return `${(b / 1024 ** 3).toFixed(2)} GB`;
}

function fmtDuration(ms) {
  if (!ms) return '—';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

export default function JobHistory() {
  const T = useT();
  const { enqueueSnackbar } = useSnackbar();
  const qc = useQueryClient();
  const [logJobId, setLogJobId] = useState(null);
  const [search, setSearch]     = useState('');
  const [busy, setBusy]         = useState({});

  const { data, isLoading, error, refetch } = useJobHistory();
  const rows = (data ?? []).filter((r) =>
    !search || r.uri?.toLowerCase().includes(search.toLowerCase()) ||
    r.fileName?.toLowerCase().includes(search.toLowerCase()) ||
    r.jobId?.toLowerCase().includes(search.toLowerCase())
  );

  const act = useCallback(async (id, name, fn) => {
    setBusy((b) => ({ ...b, [id + name]: true }));
    try {
      const res = await fn();
      enqueueSnackbar(res.message || `${name} OK`, { variant: 'success' });
      qc.invalidateQueries({ queryKey: ['ingestion-history'] });
    } catch (e) {
      enqueueSnackbar(e?.response?.data?.message ?? `${name} failed`, { variant: 'error' });
    } finally {
      setBusy((b) => ({ ...b, [id + name]: false }));
    }
  }, [enqueueSnackbar, qc]);

  const columns = [
    {
      field: 'sourceType',
      headerName: 'Src',
      width: 50,
      renderCell: ({ value }) => {
        const Icon = SOURCE_ICONS[value] ?? Http;
        return <Icon sx={{ fontSize: 18, color: value === 'YOUTUBE' ? 'error.main' : 'text.secondary' }} />;
      },
    },
    {
      field: 'fileName',
      headerName: 'File',
      flex: 1,
      minWidth: 200,
      renderCell: ({ value, row }) => (
        <Tooltip title={row.uri ?? value ?? ''}>
          <Typography variant="caption" noWrap>{value ?? row.uri?.split('/').pop() ?? row.jobId}</Typography>
        </Tooltip>
      ),
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 120,
      renderCell: ({ value }) => (
        <Chip
          label={value}
          size="small"
          color={STATUS_COLORS[value] ?? 'default'}
          sx={{ fontSize: '0.68rem', height: 20 }}
        />
      ),
    },
    {
      field: 'step',
      headerName: 'Last step',
      width: 110,
      renderCell: ({ value }) =>
        value ? <Typography variant="caption" color="text.secondary">{value}</Typography> : '—',
    },
    {
      field: 'downloadedBytes',
      headerName: 'Size',
      width: 90,
      renderCell: ({ row }) => fmtBytes(row.totalBytes || row.downloadedBytes),
    },
    {
      field: 'startedAt',
      headerName: 'Started',
      width: 150,
      renderCell: ({ value }) =>
        value ? (
          <Typography variant="caption" color="text.secondary">
            {new Date(value).toLocaleString()}
          </Typography>
        ) : '—',
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 130,
      sortable: false,
      renderCell: ({ row }) => {
        const id = row.jobId;
        return (
          <Stack direction="row" spacing={0.25}>
            <Tooltip title="Rerun">
              <span>
                <IconButton
                  size="small"
                  onClick={() => act(id, 'Rerun', () => rerunJob(id))}
                  disabled={!!busy[id + 'Rerun']}
                >
                  {busy[id + 'Rerun'] ? <CircularProgress size={12} /> : <Replay fontSize="small" />}
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Logs">
              <IconButton size="small" onClick={() => setLogJobId(id)}>
                <Article fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete">
              <span>
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => act(id, 'Delete', () => deleteJob(id))}
                  disabled={!!busy[id + 'Delete']}
                >
                  {busy[id + 'Delete'] ? <CircularProgress size={12} /> : <Delete fontSize="small" />}
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        );
      },
    },
  ];

  return (
    <Box>
      {/* Toolbar */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="center" mb={2}>
        <TextField
          size="small"
          placeholder="Search by name, URL, job ID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ flex: 1, maxWidth: 400 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
        <Button
          size="small"
          startIcon={<Refresh />}
          onClick={() => refetch()}
          disabled={isLoading}
        >
          Refresh
        </Button>
        <Typography variant="caption" color="text.secondary">
          {rows.length} jobs
        </Typography>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>Failed to load history.</Alert>}

      <Box sx={{ height: 520 }}>
        <DataGrid
          rows={rows}
          columns={columns}
          getRowId={(r) => r.jobId}
          loading={isLoading}
          density="compact"
          disableRowSelectionOnClick
          pageSizeOptions={[25, 50, 100]}
          initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
          sx={{
            border: `1px solid ${T.border}`,
            borderRadius: 2,
            '& .MuiDataGrid-row:hover': {
              bgcolor: alpha(T.teal, 0.04),
            },
          }}
        />
      </Box>

      <LogViewerDrawer
        jobId={logJobId}
        open={!!logJobId}
        onClose={() => setLogJobId(null)}
      />
    </Box>
  );
}
