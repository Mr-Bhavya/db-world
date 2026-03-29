import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Grid, Card, CardContent, Button, Chip, IconButton,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Select, MenuItem, FormControl, InputLabel, InputAdornment,
  Alert, CircularProgress, Tooltip, LinearProgress, Dialog,
  DialogTitle, DialogContent, DialogActions, Paper, alpha, Divider,
  TablePagination,
} from '@mui/material';
import {
  Sync, CheckCircle, Error as ErrorIcon, HourglassEmpty, Refresh,
  Search, PlayArrow, Visibility, Schedule, TrendingUp,
} from '@mui/icons-material';
import axios from 'axios';

const STATUS_META = {
  SYNCED:  { color: '#10b981', bg: 'rgba(16,185,129,0.1)',  icon: <CheckCircle sx={{ fontSize: 14 }} /> },
  PENDING: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  icon: <HourglassEmpty sx={{ fontSize: 14 }} /> },
  FAILED:  { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   icon: <ErrorIcon sx={{ fontSize: 14 }} /> },
  STALE:   { color: '#6366f1', bg: 'rgba(99,102,241,0.1)', icon: <Schedule sx={{ fontSize: 14 }} /> },
};

function StatCard({ label, value, icon, color }) {
  return (
    <Card sx={{ bgcolor: '#12121e', border: `1px solid ${color}25`, borderRadius: 2 }}>
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Box sx={{ color }}>{icon}</Box>
          <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {label}
          </Typography>
        </Box>
        <Typography sx={{ fontSize: '1.6rem', fontWeight: 800, color: '#fff' }}>{value ?? '—'}</Typography>
      </CardContent>
    </Card>
  );
}

function StatusChip({ status }) {
  const meta = STATUS_META[status] ?? STATUS_META.PENDING;
  return (
    <Chip label={status} size="small" icon={meta.icon}
      sx={{ bgcolor: meta.bg, color: meta.color, fontWeight: 600, fontSize: '0.65rem',
        height: 20, '& .MuiChip-icon': { color: meta.color, ml: 0.5 } }} />
  );
}

export default function TmdbSyncManager() {
  const [stats,    setStats]    = useState(null);
  const [records,  setRecords]  = useState([]);
  const [total,    setTotal]    = useState(0);
  const [page,     setPage]     = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [loading,  setLoading]  = useState(true);
  const [syncing,  setSyncing]  = useState(false);
  const [alert,    setAlert]    = useState(null);
  const [filter,   setFilter]   = useState({ status: '', type: '', query: '' });
  const [detailDialog, setDetailDialog] = useState({ open: false, item: null });

  const showAlert = (msg, sev = 'success') => {
    setAlert({ msg, sev });
    setTimeout(() => setAlert(null), 3500);
  };

  const loadStats = useCallback(async () => {
    try {
      const res = await axios.get('/api/admin/dashboard/stats');
      setStats(res.data?.sync ?? null);
    } catch { /* non-fatal */ }
  }, []);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page, size: rowsPerPage,
        ...(filter.status && { status: filter.status }),
        ...(filter.type   && { type:   filter.type   }),
        ...(filter.query  && { query:  filter.query  }),
      };
      const res = await axios.get('/api/cinema/admin/tmdb/sync/records', { params });
      setRecords(res.data?.content ?? res.data ?? []);
      setTotal(res.data?.totalElements ?? (res.data?.length ?? 0));
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, filter]);

  useEffect(() => { loadStats(); loadRecords(); }, [loadStats, loadRecords]);

  const handleTriggerSync = async (type) => {
    setSyncing(true);
    try {
      await axios.post(`/api/cinema/admin/tmdb/sync/trigger${type ? `?type=${type}` : ''}`);
      showAlert(`Sync triggered${type ? ` for ${type}` : ''}`);
      setTimeout(() => { loadStats(); loadRecords(); }, 1500);
    } catch {
      showAlert('Trigger failed', 'error');
    } finally {
      setSyncing(false);
    }
  };

  const handleRetry = async (item) => {
    try {
      await axios.post(`/api/cinema/admin/tmdb/sync/retry/${item.id}`);
      showAlert('Retry queued');
      loadRecords();
    } catch {
      showAlert('Retry failed', 'error');
    }
  };

  const fmt = (iso) => iso ? new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Sync sx={{ color: '#6366f1', fontSize: 28 }} />
        <Box>
          <Typography sx={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff' }}>TMDB Sync Manager</Typography>
          <Typography sx={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)' }}>
            Monitor and trigger TMDB metadata synchronisation
          </Typography>
        </Box>
        <Box sx={{ flex: 1 }} />
        <Button variant="outlined" size="small"
          startIcon={syncing ? <CircularProgress size={12} /> : <PlayArrow />}
          disabled={syncing} onClick={() => handleTriggerSync('MOVIE')}
          sx={{ borderColor: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem',
            '&:hover': { borderColor: '#6366f1', color: '#6366f1' } }}>
          Sync Movies
        </Button>
        <Button variant="outlined" size="small"
          startIcon={syncing ? <CircularProgress size={12} /> : <PlayArrow />}
          disabled={syncing} onClick={() => handleTriggerSync('SERIES')}
          sx={{ borderColor: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem',
            '&:hover': { borderColor: '#6366f1', color: '#6366f1' } }}>
          Sync Series
        </Button>
        <Button variant="contained" size="small"
          startIcon={syncing ? <CircularProgress size={12} /> : <Sync />}
          disabled={syncing} onClick={() => handleTriggerSync('')}
          sx={{ bgcolor: '#6366f1', fontSize: '0.75rem', '&:hover': { bgcolor: '#5558e3' } }}>
          Sync All
        </Button>
      </Box>

      {alert && (
        <Alert severity={alert.sev} sx={{ mb: 2 }} onClose={() => setAlert(null)}>{alert.msg}</Alert>
      )}

      {/* Stats row */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: 'Total Synced',  value: stats?.synced,  color: '#10b981', icon: <CheckCircle />   },
          { label: 'Pending',       value: stats?.pending, color: '#f59e0b', icon: <HourglassEmpty /> },
          { label: 'Failed',        value: stats?.failed,  color: '#ef4444', icon: <ErrorIcon />      },
          { label: 'Last Sync',     value: stats?.lastSyncAt ? new Date(stats.lastSyncAt).toLocaleDateString('en-IN') : '—',
            color: '#6366f1', icon: <Schedule /> },
        ].map(s => (
          <Grid item xs={6} sm={3} key={s.label}>
            <StatCard {...s} />
          </Grid>
        ))}
      </Grid>

      {/* Filters */}
      <Box sx={{ display: 'flex', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
        <TextField size="small" placeholder="Search by title or TMDB ID…"
          value={filter.query} onChange={e => setFilter(p => ({ ...p, query: e.target.value }))}
          InputProps={{ startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 16, color: 'rgba(255,255,255,0.3)' }} /></InputAdornment>,
            sx: { color: '#fff', bgcolor: '#0f0f1a' } }}
          sx={{ flex: 1, minWidth: 220, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.12)' } }} />
        <FormControl size="small" sx={{ minWidth: 130 }}>
          <InputLabel sx={{ color: 'rgba(255,255,255,0.4)' }}>Status</InputLabel>
          <Select value={filter.status} onChange={e => setFilter(p => ({ ...p, status: e.target.value }))} label="Status"
            sx={{ color: '#fff', bgcolor: '#0f0f1a', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.12)' } }}>
            <MenuItem value="">All</MenuItem>
            {Object.keys(STATUS_META).map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 130 }}>
          <InputLabel sx={{ color: 'rgba(255,255,255,0.4)' }}>Type</InputLabel>
          <Select value={filter.type} onChange={e => setFilter(p => ({ ...p, type: e.target.value }))} label="Type"
            sx={{ color: '#fff', bgcolor: '#0f0f1a', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.12)' } }}>
            <MenuItem value="">All</MenuItem>
            <MenuItem value="MOVIE">Movie</MenuItem>
            <MenuItem value="SERIES">Series</MenuItem>
          </Select>
        </FormControl>
        <Tooltip title="Refresh">
          <IconButton onClick={loadRecords} sx={{ color: 'rgba(255,255,255,0.5)', '&:hover': { color: '#6366f1' } }}>
            <Refresh sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Table */}
      <Paper sx={{ bgcolor: '#0f0f1a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
        {loading && <LinearProgress sx={{ bgcolor: 'rgba(255,255,255,0.05)', '& .MuiLinearProgress-bar': { bgcolor: '#6366f1' } }} />}
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ '& th': { bgcolor: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.4)', fontSize: '0.72rem',
                fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', borderColor: 'rgba(255,255,255,0.06)' } }}>
                <TableCell>TMDB ID</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Last Checked</TableCell>
                <TableCell>Last Synced</TableCell>
                <TableCell>Error</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {records.map((row, i) => (
                <TableRow key={row.id ?? i} sx={{
                  '& td': { color: 'rgba(255,255,255,0.75)', fontSize: '0.8rem', borderColor: 'rgba(255,255,255,0.05)' },
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' },
                }}>
                  <TableCell sx={{ fontFamily: 'monospace', color: '#6366f1 !important', fontWeight: 700 }}>
                    {row.tmdbId}
                  </TableCell>
                  <TableCell>
                    <Chip label={row.recordType} size="small"
                      sx={{ height: 18, fontSize: '0.62rem', bgcolor: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)' }} />
                  </TableCell>
                  <TableCell><StatusChip status={row.status} /></TableCell>
                  <TableCell sx={{ fontSize: '0.72rem !important', color: 'rgba(255,255,255,0.45) !important' }}>
                    {fmt(row.lastCheckedAt)}
                  </TableCell>
                  <TableCell sx={{ fontSize: '0.72rem !important', color: 'rgba(255,255,255,0.45) !important' }}>
                    {fmt(row.lastSyncedAt)}
                  </TableCell>
                  <TableCell>
                    {row.errorMessage && (
                      <Tooltip title={row.errorMessage}>
                        <Typography sx={{ fontSize: '0.72rem', color: '#ef4444', maxWidth: 200,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {row.errorMessage}
                        </Typography>
                      </Tooltip>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
                      <Tooltip title="View details">
                        <IconButton size="small" onClick={() => setDetailDialog({ open: true, item: row })}
                          sx={{ color: 'rgba(255,255,255,0.3)', '&:hover': { color: '#6366f1' } }}>
                          <Visibility sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Tooltip>
                      {row.status === 'FAILED' && (
                        <Tooltip title="Retry sync">
                          <IconButton size="small" onClick={() => handleRetry(row)}
                            sx={{ color: 'rgba(255,255,255,0.3)', '&:hover': { color: '#f59e0b' } }}>
                            <Refresh sx={{ fontSize: 14 }} />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && records.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} sx={{ textAlign: 'center', py: 6, color: 'rgba(255,255,255,0.3)', borderBottom: 'none' }}>
                    No sync records found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div" count={total} page={page} rowsPerPage={rowsPerPage}
          onPageChange={(_, p) => setPage(p)} onRowsPerPageChange={e => { setRowsPerPage(+e.target.value); setPage(0); }}
          rowsPerPageOptions={[10, 20, 50]}
          sx={{ color: 'rgba(255,255,255,0.5)', borderTop: '1px solid rgba(255,255,255,0.06)',
            '& .MuiIconButton-root': { color: 'rgba(255,255,255,0.4)' },
            '& .MuiSelect-icon': { color: 'rgba(255,255,255,0.4)' } }} />
      </Paper>

      {/* Detail dialog */}
      <Dialog open={detailDialog.open} onClose={() => setDetailDialog({ open: false, item: null })}
        maxWidth="sm" fullWidth
        PaperProps={{ sx: { bgcolor: '#12121e', border: '1px solid rgba(255,255,255,0.1)' } }}>
        <DialogTitle sx={{ color: '#fff', fontSize: '1rem' }}>Sync Record Detail</DialogTitle>
        <DialogContent>
          {detailDialog.item && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {Object.entries(detailDialog.item).map(([k, v]) => (
                <Box key={k} sx={{ display: 'flex', gap: 2 }}>
                  <Typography sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', width: 130, flexShrink: 0, textTransform: 'capitalize' }}>
                    {k.replace(/([A-Z])/g, ' $1')}
                  </Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: '#fff', wordBreak: 'break-all' }}>
                    {v == null ? '—' : String(v)}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDetailDialog({ open: false, item: null })} sx={{ color: 'rgba(255,255,255,0.5)' }}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
