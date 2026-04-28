import { useState, useCallback } from 'react';
import {
  Box, Typography, Grid, Card, CardContent, Button, Chip,
  IconButton, Tooltip, CircularProgress, LinearProgress,
  Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TablePagination, TableSortLabel, Paper,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import {
  Sync, CheckCircle, Error as ErrorIcon, HourglassEmpty,
  Schedule, PlayArrow, Refresh, SkipNext, Warning,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useT } from '@shared/theme';
import {
  getTmdbSyncStats,
  getTmdbSyncRecords,
  triggerTmdbSync,
  retryTmdbSync,
  forceTmdbSync,
} from '../api/adminApi';

/* ── Constants ──────────────────────────────────────────────────── */

const STATUS_META = {
  SUCCESS: { color: '#10b981', bg: 'rgba(16,185,129,0.12)', icon: <CheckCircle sx={{ fontSize: 13 }} /> },
  FAILED:  { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',  icon: <ErrorIcon   sx={{ fontSize: 13 }} /> },
  SKIPPED: { color: '#6b7280', bg: 'rgba(107,114,128,0.12)', icon: <SkipNext   sx={{ fontSize: 13 }} /> },
  RUNNING: { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', icon: <HourglassEmpty sx={{ fontSize: 13 }} /> },
};

const STATUSES     = Object.keys(STATUS_META);
const RECORD_TYPES = ['MOVIE', 'TV_SERIES'];

const COLUMNS = [
  { id: 'tmdbId',      label: 'TMDB ID',     sortKey: 'tmdbId',        minWidth: 90  },
  { id: 'title',       label: 'Name',         sortable: false,          minWidth: 180 },
  { id: 'recordType',  label: 'Type',         sortable: false,          minWidth: 80  },
  { id: 'status',      label: 'Status',       sortKey: 'status',        minWidth: 100 },
  { id: 'lastChecked', label: 'Last Checked', sortKey: 'lastCheckedAt', minWidth: 150 },
  { id: 'lastSynced',  label: 'Last Synced',  sortKey: 'lastSyncedAt',  minWidth: 150 },
  { id: 'version',     label: 'Version',      sortable: false,          minWidth: 80  },
  { id: 'error',       label: 'Error',        sortable: false,          minWidth: 200 },
  { id: 'actions',     label: '',             sortable: false,          minWidth: 55  },
];

/* ── Stat card ───────────────────────────────────────────────────── */

function StatCard({ label, value, icon, color }) {
  const T = useT();
  return (
    <Card sx={{ border: `1px solid ${color}22`, borderRadius: 2, bgcolor: T.glass }}>
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
          <Box sx={{ color, display: 'flex', '& svg': { fontSize: 18 } }}>{icon}</Box>
          <Typography sx={{ fontSize: 11, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
            {label}
          </Typography>
        </Box>
        <Typography sx={{ fontSize: '1.5rem', fontWeight: 800, color: T.text, lineHeight: 1 }}>
          {value ?? '—'}
        </Typography>
      </CardContent>
    </Card>
  );
}

/* ── Status chip ─────────────────────────────────────────────────── */

function StatusChip({ status }) {
  const meta = STATUS_META[status] ?? STATUS_META.SKIPPED;
  return (
    <Chip label={status} size="small" icon={meta.icon}
      sx={{ bgcolor: meta.bg, color: meta.color, fontWeight: 700, fontSize: 10, height: 20,
        '& .MuiChip-icon': { color: meta.color, ml: 0.5 } }} />
  );
}

/* ── Pill filter ─────────────────────────────────────────────────── */

function PillGroup({ label, options, value, onChange, getColor, getLabel }) {
  const T = useT();
  return (
    <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', alignItems: 'center' }}>
      {label && <Typography sx={{ fontSize: 11, color: T.textFaint, fontWeight: 600, mr: 0.25 }}>{label}</Typography>}
      {options.map(opt => {
        const active = value === opt.value;
        const color  = getColor ? getColor(opt.value) : T.teal;
        return (
          <Box key={opt.value ?? 'all'} onClick={() => onChange(opt.value)}
            sx={{
              px: 1.25, py: 0.3, borderRadius: 99, border: '1px solid', cursor: 'pointer',
              fontSize: 11, fontWeight: 700, userSelect: 'none', transition: 'all .15s',
              borderColor: active ? color : T.border,
              color:       active ? color : T.textMuted,
              bgcolor:     active ? `${color}18` : 'transparent',
              '&:hover': { borderColor: color, color },
            }}>
            {getLabel ? getLabel(opt.value) : opt.label}
          </Box>
        );
      })}
    </Box>
  );
}

/* ── Main page ───────────────────────────────────────────────────── */

export default function TmdbSyncPage() {
  const T  = useT();
  const { enqueueSnackbar } = useSnackbar();
  const qc = useQueryClient();

  const [params, setParams] = useState({
    page: 0, size: 20,
    status: '', recordType: '',
    sortBy: 'lastCheckedAt', sortDir: 'desc',
  });
  const [forceOpen, setForceOpen] = useState(false);

  const set = useCallback((k, v) => setParams(p => ({ ...p, page: 0, [k]: v })), []);

  /* ── Queries ── */

  const { data: stats } = useQuery({
    queryKey: ['tmdb-sync-stats'],
    queryFn: getTmdbSyncStats,
    refetchInterval: 30_000,
  });

  const { data: recordsPage, isFetching } = useQuery({
    queryKey: ['tmdb-sync-records', params],
    queryFn: () => getTmdbSyncRecords({
      page: params.page, size: params.size,
      ...(params.status     && { status:     params.status }),
      ...(params.recordType && { recordType: params.recordType }),
      sort: `${params.sortBy},${params.sortDir}`,
    }),
    keepPreviousData: true,
  });

  const records = recordsPage?.content       ?? [];
  const total   = recordsPage?.totalElements ?? 0;

  /* ── Mutations ── */

  const triggerMutation = useMutation({
    mutationFn: triggerTmdbSync,
    onSuccess: (_, type) => {
      enqueueSnackbar(`Sync triggered${type ? ` for ${type}` : ''}`, { variant: 'success' });
      setTimeout(() => qc.invalidateQueries({ queryKey: ['tmdb-sync-stats'] }), 2000);
    },
    onError: () => enqueueSnackbar('Trigger failed', { variant: 'error' }),
  });

  const forceMutation = useMutation({
    mutationFn: forceTmdbSync,
    onSuccess: () => {
      enqueueSnackbar('Force sync started — this may take a while', { variant: 'info' });
      setForceOpen(false);
    },
    onError: () => enqueueSnackbar('Force sync failed to start', { variant: 'error' }),
  });

  const retryMutation = useMutation({
    mutationFn: retryTmdbSync,
    onSuccess: () => {
      enqueueSnackbar('Retry queued', { variant: 'success' });
      qc.invalidateQueries({ queryKey: ['tmdb-sync-records'] });
    },
    onError: () => enqueueSnackbar('Retry failed', { variant: 'error' }),
  });

  /* ── Helpers ── */

  const isBusy = triggerMutation.isPending;

  const fmt = (iso) => iso
    ? new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
    : '—';

  const handleSort = (key) =>
    setParams(p => ({
      ...p, page: 0,
      sortBy:  key,
      sortDir: p.sortBy === key && p.sortDir === 'desc' ? 'asc' : 'desc',
    }));

  const cellSx = { borderColor: T.border, color: T.textMuted, fontSize: 12, py: 1, px: 1.5 };
  const headSx = {
    bgcolor: T.adminBg ?? T.glass,
    color: T.textFaint, fontSize: 11, fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.07em',
    borderColor: T.border, py: 1.25, px: 1.5, whiteSpace: 'nowrap',
  };
  const sortLabelSx = {
    color: `${T.textFaint} !important`,
    '&.Mui-active': { color: `${T.teal} !important` },
    '& .MuiTableSortLabel-icon': { color: `${T.textFaint} !important` },
    '&.Mui-active .MuiTableSortLabel-icon': { color: `${T.teal} !important` },
  };

  /* ── Render ── */

  return (
    <Box sx={{ p: { xs: 1.5, md: 3 }, bgcolor: T.bg, minHeight: '100%', color: T.text }}>

      {/* ── Header ── */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 3, flexWrap: 'wrap' }}>
        <Sync sx={{ color: T.teal, fontSize: 26, mt: 0.3 }} />
        <Box sx={{ flex: 1, minWidth: 160 }}>
          <Typography sx={{ fontSize: { xs: 17, md: 20 }, fontWeight: 800, color: T.text, lineHeight: 1.2 }}>
            TMDB Sync
          </Typography>
          <Typography sx={{ fontSize: 12, color: T.textMuted, mt: 0.2 }}>
            Monitor and trigger TMDB metadata synchronisation
          </Typography>
        </Box>

        {/* Action buttons */}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          <Button size="small" variant="outlined"
            startIcon={isBusy ? <CircularProgress size={12} /> : <PlayArrow sx={{ fontSize: 14 }} />}
            disabled={isBusy} onClick={() => triggerMutation.mutate('MOVIE')}
            sx={{ borderColor: T.border, color: T.textMuted, fontSize: 12, fontWeight: 600,
              '&:hover': { borderColor: T.teal, color: T.teal } }}>
            Movies
          </Button>
          <Button size="small" variant="outlined"
            startIcon={isBusy ? <CircularProgress size={12} /> : <PlayArrow sx={{ fontSize: 14 }} />}
            disabled={isBusy} onClick={() => triggerMutation.mutate('TV_SERIES')}
            sx={{ borderColor: T.border, color: T.textMuted, fontSize: 12, fontWeight: 600,
              '&:hover': { borderColor: T.teal, color: T.teal } }}>
            TV Series
          </Button>
          <Button size="small" variant="contained"
            startIcon={isBusy ? <CircularProgress size={12} color="inherit" /> : <Sync sx={{ fontSize: 14 }} />}
            disabled={isBusy} onClick={() => triggerMutation.mutate(null)}
            sx={{ bgcolor: T.teal, '&:hover': { bgcolor: T.tealHover }, fontSize: 12, fontWeight: 700 }}>
            Sync All
          </Button>
          <Tooltip title="Re-fetch metadata for every record (ignores recent-check guard). Use with caution.">
            <Button size="small" variant="outlined" startIcon={<Warning sx={{ fontSize: 13 }} />}
              onClick={() => setForceOpen(true)}
              sx={{ borderColor: '#f59e0b55', color: '#f59e0b', fontSize: 12, fontWeight: 700,
                '&:hover': { borderColor: '#f59e0b', bgcolor: '#f59e0b12' } }}>
              Force All
            </Button>
          </Tooltip>
        </Box>
      </Box>

      {/* ── Stats cards ── */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: 'Success',     value: stats?.success,  color: '#10b981', icon: <CheckCircle /> },
          { label: 'Failed',      value: stats?.failed,   color: '#ef4444', icon: <ErrorIcon /> },
          { label: 'Skipped',     value: stats?.skipped,  color: '#6b7280', icon: <SkipNext /> },
          { label: 'Running',     value: stats?.running,  color: '#f59e0b', icon: <HourglassEmpty /> },
          {
            label: 'Last Synced',
            value: stats?.lastSyncedAt
              ? new Date(stats.lastSyncedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
              : '—',
            color: T.teal, icon: <Schedule />,
          },
        ].map(s => (
          <Grid item xs={6} sm={4} md={2.4} key={s.label}>
            <StatCard {...s} />
          </Grid>
        ))}
      </Grid>

      {/* ── Filters ── */}
      <Box sx={{
        display: 'flex', flexWrap: 'wrap', gap: { xs: 1, md: 1.5 }, alignItems: 'center',
        px: { xs: 1, md: 1.5 }, py: 1.25,
        borderTop: `1px solid ${T.border}`,
        borderBottom: `1px solid ${T.border}`,
        bgcolor: T.glass, mb: 0,
        borderRadius: '8px 8px 0 0',
      }}>
        {/* Status pills */}
        <PillGroup
          label="Status:"
          options={[{ value: '', label: 'All' }, ...STATUSES.map(s => ({ value: s, label: s }))]}
          value={params.status}
          onChange={v => set('status', v)}
          getColor={v => v ? (STATUS_META[v]?.color ?? T.teal) : T.teal}
          getLabel={v => v || 'All'}
        />

        {/* Type pills */}
        <PillGroup
          label="Type:"
          options={[{ value: '', label: 'All' }, ...RECORD_TYPES.map(t => ({ value: t, label: t }))]}
          value={params.recordType}
          onChange={v => set('recordType', v)}
          getLabel={v => v === 'TV_SERIES' ? 'TV' : v || 'All'}
        />

        <Box sx={{ flex: 1 }} />

        <Tooltip title="Refresh">
          <IconButton size="small"
            onClick={() => { qc.invalidateQueries({ queryKey: ['tmdb-sync-records'] }); qc.invalidateQueries({ queryKey: ['tmdb-sync-stats'] }); }}
            sx={{ color: T.textMuted, '&:hover': { color: T.teal } }}>
            <Refresh sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>

        <Typography sx={{ fontSize: 12, color: T.textMuted, fontWeight: 600 }}>
          {total.toLocaleString()} records
        </Typography>
      </Box>

      {/* ── Table ── */}
      <Paper elevation={0}
        sx={{ border: `1px solid ${T.border}`, borderTop: 'none', borderRadius: '0 0 8px 8px', overflow: 'hidden', bgcolor: T.glass }}>
        {isFetching && (
          <LinearProgress sx={{ bgcolor: `${T.teal}22`, '& .MuiLinearProgress-bar': { bgcolor: T.teal } }} />
        )}

        <TableContainer sx={{ overflowX: 'auto' }}>
          <Table size="small" sx={{ minWidth: 820 }}>
            <TableHead>
              <TableRow>
                {COLUMNS.map(col => (
                  <TableCell key={col.id} sx={{ ...headSx, minWidth: col.minWidth }}>
                    {col.sortable === false || !col.sortKey ? col.label : (
                      <TableSortLabel
                        active={params.sortBy === col.sortKey}
                        direction={params.sortBy === col.sortKey ? params.sortDir : 'desc'}
                        onClick={() => handleSort(col.sortKey)}
                        sx={sortLabelSx}>
                        {col.label}
                      </TableSortLabel>
                    )}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>

            <TableBody>
              {records.map((row, i) => (
                <TableRow key={row.id ?? i}
                  sx={{ '& td': { borderColor: T.border }, '&:hover': { bgcolor: `${T.border}40` } }}>

                  {/* TMDB ID */}
                  <TableCell sx={cellSx}>
                    <Typography component="span"
                      sx={{ fontFamily: 'monospace', color: T.teal, fontWeight: 700, fontSize: 12 }}>
                      {row.tmdbId}
                    </Typography>
                  </TableCell>

                  {/* Title */}
                  <TableCell sx={{ ...cellSx, maxWidth: 200 }}>
                    <Tooltip title={row.title ?? ''}>
                      <Typography sx={{ fontSize: 12, color: T.text, fontWeight: 500,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>
                        {row.title ?? '—'}
                      </Typography>
                    </Tooltip>
                  </TableCell>

                  {/* Type */}
                  <TableCell sx={cellSx}>
                    <Chip label={row.recordType === 'TV_SERIES' ? 'TV' : (row.recordType ?? '—')}
                      size="small"
                      sx={{ height: 18, fontSize: 10, fontWeight: 700, bgcolor: `${T.teal}18`, color: T.teal }} />
                  </TableCell>

                  {/* Status */}
                  <TableCell sx={cellSx}>
                    <StatusChip status={row.status} />
                  </TableCell>

                  {/* Last Checked */}
                  <TableCell sx={{ ...cellSx, fontSize: 11, color: T.textFaint, whiteSpace: 'nowrap' }}>
                    {fmt(row.lastCheckedAt)}
                  </TableCell>

                  {/* Last Synced */}
                  <TableCell sx={{ ...cellSx, fontSize: 11, color: T.textFaint, whiteSpace: 'nowrap' }}>
                    {fmt(row.lastSyncedAt)}
                  </TableCell>

                  {/* Version */}
                  <TableCell sx={{ ...cellSx, fontFamily: 'monospace', fontSize: 11, color: T.textFaint }}>
                    {row.syncVersion ?? '—'}
                  </TableCell>

                  {/* Error */}
                  <TableCell sx={{ ...cellSx, maxWidth: 220 }}>
                    {row.errorMessage && (
                      <Tooltip title={row.errorMessage} placement="top-start">
                        <Typography sx={{ fontSize: 11, color: '#ef4444',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220, cursor: 'default' }}>
                          {row.errorMessage}
                        </Typography>
                      </Tooltip>
                    )}
                  </TableCell>

                  {/* Actions */}
                  <TableCell sx={cellSx} align="right">
                    <Tooltip title={row.status === 'FAILED' ? 'Retry sync' : 'Re-sync'}>
                      <IconButton size="small" onClick={() => retryMutation.mutate(row.id)}
                        disabled={retryMutation.isPending}
                        sx={{ color: T.textFaint, '&:hover': { color: row.status === 'FAILED' ? '#f59e0b' : T.teal, bgcolor: `${T.teal}18` } }}>
                        <Refresh sx={{ fontSize: 15 }} />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}

              {!isFetching && records.length === 0 && (
                <TableRow>
                  <TableCell colSpan={COLUMNS.length}
                    sx={{ textAlign: 'center', py: 6, color: T.textMuted, borderBottom: 'none', fontSize: 13 }}>
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
          page={params.page}
          rowsPerPage={params.size}
          rowsPerPageOptions={[10, 20, 50, 100]}
          onPageChange={(_, p) => setParams(prev => ({ ...prev, page: p }))}
          onRowsPerPageChange={(e) => setParams(prev => ({ ...prev, page: 0, size: +e.target.value }))}
          sx={{
            borderTop: `1px solid ${T.border}`,
            color: T.textMuted,
            bgcolor: T.glass,
            '& .MuiIconButton-root': { color: T.textMuted },
            '& .MuiSelect-icon': { color: T.textMuted },
            '& .MuiTablePagination-select': { color: T.text },
          }}
        />
      </Paper>

      {/* ── Force Sync Confirm Dialog ── */}
      <Dialog open={forceOpen} onClose={() => setForceOpen(false)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { bgcolor: T.sidebar ?? T.glass, border: `1px solid ${T.border}`, borderRadius: 2 } }}>
        <DialogTitle sx={{ color: T.text, display: 'flex', alignItems: 'center', gap: 1.5, pb: 1 }}>
          <Warning sx={{ color: '#f59e0b', fontSize: 22 }} />
          Force Re-Sync All Records
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: T.textMuted, fontSize: 13, lineHeight: 1.6 }}>
            This will re-fetch TMDB metadata for <strong style={{ color: T.text }}>every record</strong> in the database,
            bypassing the recent-check guard. It may run for a long time and will consume significant TMDB API quota.
          </Typography>
          <Typography sx={{ color: T.textMuted, fontSize: 13, mt: 1.5, lineHeight: 1.6 }}>
            Use <strong style={{ color: T.text }}>Sync All</strong> for a regular incremental refresh.
            Only force-sync if metadata is corrupted or was never loaded correctly.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setForceOpen(false)} sx={{ color: T.textMuted }}>Cancel</Button>
          <Button onClick={() => forceMutation.mutate(null)} variant="contained"
            disabled={forceMutation.isPending}
            sx={{ bgcolor: '#f59e0b', '&:hover': { bgcolor: '#d97706' }, fontWeight: 700, color: '#000' }}>
            {forceMutation.isPending ? <CircularProgress size={16} color="inherit" /> : 'Force Sync All'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
