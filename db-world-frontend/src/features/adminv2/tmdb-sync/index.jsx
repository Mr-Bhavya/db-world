import React, { useState } from 'react';
import {
  Box, Typography, Grid, Card, CardContent, Button, Chip,
  IconButton, Tooltip, CircularProgress, LinearProgress,
  FormControl, InputLabel, Select, MenuItem, Paper,
  Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TablePagination,
} from '@mui/material';
import {
  Sync, CheckCircle, Error as ErrorIcon, HourglassEmpty,
  Schedule, PlayArrow, Refresh, SkipNext,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useT } from '@shared/theme';
import {
  getTmdbSyncStats,
  getTmdbSyncRecords,
  triggerTmdbSync,
  retryTmdbSync,
} from '../api/adminApi';

/* ── Status metadata ─────────────────────────────────────────── */

const STATUS_META = {
  SUCCESS: { color: '#10b981', bg: 'rgba(16,185,129,0.12)', icon: <CheckCircle sx={{ fontSize: 13 }} /> },
  FAILED:  { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',  icon: <ErrorIcon   sx={{ fontSize: 13 }} /> },
  SKIPPED: { color: '#6b7280', bg: 'rgba(107,114,128,0.12)', icon: <SkipNext   sx={{ fontSize: 13 }} /> },
  RUNNING: { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', icon: <HourglassEmpty sx={{ fontSize: 13 }} /> },
};

const STATUSES = Object.keys(STATUS_META);
const RECORD_TYPES = ['MOVIE', 'TV_SERIES'];

/* ── Stat card ───────────────────────────────────────────────── */

function StatCard({ label, value, icon, color }) {
  const T = useT();
  return (
    <Card sx={{ border: `1px solid ${color}22`, borderRadius: 2, bgcolor: T.glass }}>
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
          <Box sx={{ color, display: 'flex' }}>{icon}</Box>
          <Typography sx={{ fontSize: '0.7rem', color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {label}
          </Typography>
        </Box>
        <Typography sx={{ fontSize: '1.65rem', fontWeight: 800, color: T.text, lineHeight: 1 }}>
          {value ?? '—'}
        </Typography>
      </CardContent>
    </Card>
  );
}

/* ── Status chip ─────────────────────────────────────────────── */

function StatusChip({ status }) {
  const meta = STATUS_META[status] ?? STATUS_META.SKIPPED;
  return (
    <Chip
      label={status}
      size="small"
      icon={meta.icon}
      sx={{
        bgcolor: meta.bg,
        color: meta.color,
        fontWeight: 600,
        fontSize: '0.65rem',
        height: 20,
        '& .MuiChip-icon': { color: meta.color, ml: 0.5 },
      }}
    />
  );
}

/* ── Main page ───────────────────────────────────────────────── */

export default function TmdbSyncPage() {
  const T = useT();
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');

  /* ── Queries ── */

  const { data: stats } = useQuery({
    queryKey: ['tmdb-sync-stats'],
    queryFn: getTmdbSyncStats,
    refetchInterval: 30_000,
  });

  const { data: recordsPage, isFetching: recordsLoading } = useQuery({
    queryKey: ['tmdb-sync-records', page, rowsPerPage, filterStatus, filterType],
    queryFn: () => getTmdbSyncRecords({
      page,
      size: rowsPerPage,
      ...(filterStatus && { status: filterStatus }),
      ...(filterType   && { recordType: filterType }),
    }),
    keepPreviousData: true,
  });

  const records = recordsPage?.content ?? [];
  const total   = recordsPage?.totalElements ?? 0;

  /* ── Mutations ── */

  const triggerMutation = useMutation({
    mutationFn: triggerTmdbSync,
    onSuccess: (_, type) => {
      enqueueSnackbar(`Sync triggered${type ? ` for ${type}` : ''}`, { variant: 'success' });
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ['tmdb-sync-stats'] }), 2000);
    },
    onError: () => enqueueSnackbar('Trigger failed', { variant: 'error' }),
  });

  const retryMutation = useMutation({
    mutationFn: retryTmdbSync,
    onSuccess: () => {
      enqueueSnackbar('Retry queued', { variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['tmdb-sync-records'] });
    },
    onError: () => enqueueSnackbar('Retry failed', { variant: 'error' }),
  });

  /* ── Helpers ── */

  const fmt = (iso) =>
    iso
      ? new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
      : '—';

  const handleFilterChange = (setter) => (e) => {
    setter(e.target.value);
    setPage(0);
  };

  const isSyncing = triggerMutation.isPending;

  /* ── Render ── */

  return (
    <Box sx={{ p: 3 }}>

      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <Sync sx={{ color: T.teal, fontSize: 28 }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: '1.15rem', fontWeight: 700, color: T.text }}>
            TMDB Sync
          </Typography>
          <Typography sx={{ fontSize: '0.78rem', color: T.textMuted }}>
            Monitor and trigger TMDB metadata synchronisation
          </Typography>
        </Box>
        <Button
          variant="outlined"
          size="small"
          startIcon={isSyncing ? <CircularProgress size={12} /> : <PlayArrow />}
          disabled={isSyncing}
          onClick={() => triggerMutation.mutate('MOVIE')}
          sx={{ borderColor: T.border, color: T.textMuted, '&:hover': { borderColor: T.teal, color: T.teal } }}
        >
          Movies
        </Button>
        <Button
          variant="outlined"
          size="small"
          startIcon={isSyncing ? <CircularProgress size={12} /> : <PlayArrow />}
          disabled={isSyncing}
          onClick={() => triggerMutation.mutate('TV_SERIES')}
          sx={{ borderColor: T.border, color: T.textMuted, '&:hover': { borderColor: T.teal, color: T.teal } }}
        >
          TV Series
        </Button>
        <Button
          variant="contained"
          size="small"
          startIcon={isSyncing ? <CircularProgress size={12} color="inherit" /> : <Sync />}
          disabled={isSyncing}
          onClick={() => triggerMutation.mutate(null)}
          sx={{ bgcolor: T.teal, '&:hover': { bgcolor: T.tealHover } }}
        >
          Sync All
        </Button>
      </Box>

      {/* Stats cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: 'Success',  value: stats?.success,  color: '#10b981', icon: <CheckCircle />    },
          { label: 'Failed',   value: stats?.failed,   color: '#ef4444', icon: <ErrorIcon />       },
          { label: 'Skipped',  value: stats?.skipped,  color: '#6b7280', icon: <SkipNext />        },
          { label: 'Running',  value: stats?.running,  color: '#f59e0b', icon: <HourglassEmpty />  },
          {
            label: 'Last Synced',
            value: stats?.lastSyncedAt
              ? new Date(stats.lastSyncedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
              : '—',
            color: T.teal,
            icon: <Schedule />,
          },
        ].map((s) => (
          <Grid item xs={6} sm={4} md={2.4} key={s.label}>
            <StatCard {...s} />
          </Grid>
        ))}
      </Grid>

      {/* Filters */}
      <Box sx={{ display: 'flex', gap: 1.5, mb: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel sx={{ color: T.textMuted }}>Status</InputLabel>
          <Select
            value={filterStatus}
            onChange={handleFilterChange(setFilterStatus)}
            label="Status"
            sx={{ color: T.text, bgcolor: T.inputBg, '& .MuiOutlinedInput-notchedOutline': { borderColor: T.border } }}
          >
            <MenuItem value="">All</MenuItem>
            {STATUSES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel sx={{ color: T.textMuted }}>Type</InputLabel>
          <Select
            value={filterType}
            onChange={handleFilterChange(setFilterType)}
            label="Type"
            sx={{ color: T.text, bgcolor: T.inputBg, '& .MuiOutlinedInput-notchedOutline': { borderColor: T.border } }}
          >
            <MenuItem value="">All</MenuItem>
            {RECORD_TYPES.map((t) => (
              <MenuItem key={t} value={t}>{t === 'TV_SERIES' ? 'TV Series' : 'Movie'}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <Tooltip title="Refresh">
          <IconButton
            size="small"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['tmdb-sync-records'] })}
            sx={{ color: T.textMuted, '&:hover': { color: T.teal } }}
          >
            <Refresh sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>

        <Box sx={{ flex: 1 }} />

        <Typography sx={{ fontSize: '0.78rem', color: T.textMuted }}>
          {total.toLocaleString()} records
        </Typography>
      </Box>

      {/* Table */}
      <Paper
        elevation={0}
        sx={{ border: `1px solid ${T.border}`, borderRadius: 2, overflow: 'hidden', bgcolor: T.glass }}
      >
        {recordsLoading && (
          <LinearProgress
            sx={{ bgcolor: `${T.teal}22`, '& .MuiLinearProgress-bar': { bgcolor: T.teal } }}
          />
        )}

        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{
                '& th': {
                  bgcolor: T.adminBg,
                  color: T.textMuted,
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  borderColor: T.border,
                  py: 1.25,
                },
              }}>
                <TableCell>TMDB ID</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Last Checked</TableCell>
                <TableCell>Last Synced</TableCell>
                <TableCell>Version</TableCell>
                <TableCell>Error</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {records.map((row, i) => (
                <TableRow
                  key={row.id ?? i}
                  sx={{
                    '& td': { color: T.textMuted, fontSize: '0.8rem', borderColor: T.border, py: 1 },
                    '&:hover': { bgcolor: T.glassHover },
                  }}
                >
                  <TableCell>
                    <Typography
                      component="span"
                      sx={{ fontFamily: 'monospace', color: T.teal, fontWeight: 700, fontSize: '0.8rem' }}
                    >
                      {row.tmdbId}
                    </Typography>
                  </TableCell>

                  <TableCell>
                    <Chip
                      label={row.recordType === 'TV_SERIES' ? 'TV' : row.recordType}
                      size="small"
                      sx={{ height: 18, fontSize: '0.62rem', bgcolor: T.tealBg, color: T.teal }}
                    />
                  </TableCell>

                  <TableCell>
                    <StatusChip status={row.status} />
                  </TableCell>

                  <TableCell sx={{ fontSize: '0.72rem !important', color: `${T.textFaint} !important` }}>
                    {fmt(row.lastCheckedAt)}
                  </TableCell>

                  <TableCell sx={{ fontSize: '0.72rem !important', color: `${T.textFaint} !important` }}>
                    {fmt(row.lastSyncedAt)}
                  </TableCell>

                  <TableCell
                    sx={{ fontFamily: 'monospace', fontSize: '0.72rem !important', color: `${T.textFaint} !important` }}
                  >
                    {row.syncVersion ?? '—'}
                  </TableCell>

                  <TableCell sx={{ maxWidth: 240 }}>
                    {row.errorMessage && (
                      <Tooltip title={row.errorMessage} placement="top-start">
                        <Typography
                          sx={{
                            fontSize: '0.72rem',
                            color: '#ef4444',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            maxWidth: 240,
                            cursor: 'default',
                          }}
                        >
                          {row.errorMessage}
                        </Typography>
                      </Tooltip>
                    )}
                  </TableCell>

                  <TableCell align="right">
                    {row.status === 'FAILED' && (
                      <Tooltip title="Retry sync">
                        <IconButton
                          size="small"
                          onClick={() => retryMutation.mutate(row.id)}
                          disabled={retryMutation.isPending}
                          sx={{ color: T.textFaint, '&:hover': { color: '#f59e0b' } }}
                        >
                          <Refresh sx={{ fontSize: 15 }} />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}

              {!recordsLoading && records.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    sx={{ textAlign: 'center', py: 6, color: T.textMuted, borderBottom: 'none', fontSize: '0.875rem' }}
                  >
                    No sync records found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination
          component="div"
          count={total}
          page={page}
          rowsPerPage={rowsPerPage}
          onPageChange={(_, p) => setPage(p)}
          onRowsPerPageChange={(e) => { setRowsPerPage(+e.target.value); setPage(0); }}
          rowsPerPageOptions={[10, 20, 50, 100]}
          sx={{
            color: T.textMuted,
            borderTop: `1px solid ${T.border}`,
            '& .MuiIconButton-root': { color: T.textMuted },
            '& .MuiSelect-icon': { color: T.textMuted },
          }}
        />
      </Paper>
    </Box>
  );
}
