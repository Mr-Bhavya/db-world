import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Card, CardContent, Button, Chip,
  IconButton, Table, TableBody, TableCell, TableHead, TableRow, CircularProgress, Tooltip,
  LinearProgress, Switch, alpha, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Alert
} from '@mui/material';
import {
  Schedule, PlayArrow, Refresh, CheckCircle,
  Error as ErrorIcon, History, Timer, Code,
  Edit as EditIcon, DragIndicator, Close as CloseIcon,
} from '@mui/icons-material';
import { Reorder, useDragControls, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import axiosInstance from '../../../shared/components/ui/utils/AxiosInstants';
import { useT } from '@shared/theme';

// ─── API ──────────────────────────────────────────────────────────────────────
const api = {
  jobs:    ()               => axiosInstance.get('/api/admin/scheduler/jobs').then(r => r.data?.data ?? []),
  history: ()               => axiosInstance.get('/api/admin/scheduler/history?limit=50').then(r => r.data?.data ?? []),
  trigger: (jobId)          => axiosInstance.post(`/api/admin/scheduler/trigger/${jobId}`),
  toggle:  (jobId)          => axiosInstance.patch(`/api/admin/scheduler/toggle/${jobId}`),
  updateCron: (jobId, body) => axiosInstance.patch(`/api/admin/scheduler/cron/${jobId}`, body),
  reorder: (orders)         => axiosInstance.patch('/api/admin/scheduler/reorder', orders),
};

// ─── Per-job display metadata ─────────────────────────────────────────────────
const JOB_META = {
  TagScheduler:       { color: '#f59e0b', label: 'Tag Scheduler' },
  TmdbMovieSync:      { color: '#6366f1', label: 'TMDB Movie Sync' },
  TmdbTvSync:         { color: '#a855f7', label: 'TMDB TV Sync' },
  PersonSyncScheduler:{ color: '#0d9488', label: 'Person Detail Sync' },
};

// ─── Cron helper ──────────────────────────────────────────────────────────────
function describeCron(expr, timezone) {
  if (!expr) return '—';
  const parts = expr.split(' ');
  if (parts.length < 6) return expr;
  const [, min, hour] = parts;
  if (hour === '*/6') return 'Every 6 hours';
  if (hour === '*/2') return 'Every 2 hours';
  if (hour === '*/1') return 'Every hour';
  if (/^\d+$/.test(hour)) {
    const h = parseInt(hour, 10);
    const m = parseInt(min, 10);
    return `Daily at ${h}:${String(m).padStart(2, '0')}${timezone ? ' ' + timezone.replace('Asia/', '') : ''}`;
  }
  return expr;
}

// ─── Edit Cron Dialog ─────────────────────────────────────────────────────────
function EditCronDialog({ open, job, onClose, onSave }) {
  const T = useT();
  const [cron, setCron]   = useState('');
  const [tz, setTz]       = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (open && job) {
      setCron(job.cronExpression ?? '');
      setTz(job.timezone ?? '');
      setError('');
    }
  }, [open, job]);

  const validate = () => {
    const parts = cron.trim().split(/\s+/);
    if (parts.length !== 6) { setError('Spring cron needs 6 parts: second minute hour day month weekday'); return false; }
    setError('');
    return true;
  };

  const handleSave = () => {
    if (!validate()) return;
    onSave(job.id, { cronExpression: cron.trim(), timezone: tz.trim() || undefined });
  };

  if (!job) return null;
  const meta = JOB_META[job.id] ?? { color: T.teal };

  const inputSx = {
    '& .MuiOutlinedInput-root': {
      bgcolor: T.inputBg ?? T.glass, color: T.textPrimary,
      fontFamily: 'monospace',
      '& fieldset': { borderColor: T.glassBorder },
      '&:hover fieldset': { borderColor: meta.color },
      '&.Mui-focused fieldset': { borderColor: meta.color },
    },
    '& .MuiInputLabel-root': { color: T.textMuted },
    '& .MuiInputLabel-root.Mui-focused': { color: meta.color },
    '& .MuiFormHelperText-root': { color: T.error },
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { bgcolor: T.sidebar ?? T.glass, border: `1px solid ${T.glassBorder}`, borderRadius: 2 } }}>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: T.text }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Schedule sx={{ color: meta.color, fontSize: 20 }} />
          Edit Schedule — {JOB_META[job.id]?.label ?? job.id}
        </Box>
        <IconButton size="small" onClick={onClose} sx={{ color: T.textFaint }}>
          <CloseIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
        <Alert severity="info" sx={{ bgcolor: `${meta.color}14`, color: T.textMuted, border: `1px solid ${meta.color}33`, fontSize: 12,
          '& .MuiAlert-icon': { color: meta.color } }}>
          Spring cron: <code>second minute hour day-of-month month day-of-week</code><br />
          Examples: <code>0 0 2 * * *</code> = daily 2AM &nbsp;·&nbsp; <code>0 0 */6 * * *</code> = every 6h
        </Alert>
        <TextField size="small" label="Cron Expression" value={cron} onChange={e => { setCron(e.target.value); setError(''); }}
          sx={inputSx} error={!!error} helperText={error || describeCron(cron, tz || job.timezone)} />
        <TextField size="small" label="Timezone (optional)" value={tz} onChange={e => setTz(e.target.value)}
          placeholder="Asia/Kolkata" sx={{ ...inputSx, '& .MuiOutlinedInput-root': { ...inputSx['& .MuiOutlinedInput-root'], fontFamily: 'inherit' } }}
          helperText="Leave blank to keep current timezone" />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <Button onClick={onClose} sx={{ color: T.textMuted }}>Cancel</Button>
        <Button variant="contained" onClick={handleSave}
          sx={{ bgcolor: meta.color, '&:hover': { bgcolor: meta.color }, fontWeight: 600 }}>
          Save Schedule
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Draggable Job Card ───────────────────────────────────────────────────────
function DraggableJobCard({ job, onTrigger, onToggle, onEdit, triggering }) {
  const T            = useT();
  const dragControls = useDragControls();
  const meta         = JOB_META[job.id] ?? { color: T.teal, label: job.name };
  const isRunning    = job.status === 'RUNNING' || triggering;

  return (
    <Reorder.Item
      value={job}
      dragListener={false}
      dragControls={dragControls}
      style={{ listStyle: 'none' }}
      layout
    >
      <Card sx={{
        bgcolor: T.glass,
        border: `1px solid ${isRunning ? meta.color + '55' : T.border}`,
        borderRadius: 2,
        mb: 1.5,
        transition: 'border-color 0.2s',
        '&:hover': { borderColor: meta.color + '66' },
        cursor: 'default',
        userSelect: 'none',
      }}>
        <CardContent sx={{ p: { xs: 1.5, sm: 2 }, '&:last-child': { pb: { xs: 1.5, sm: 2 } }, display: 'flex', gap: 1.5 }}>

          {/* Drag handle */}
          <Box
            onPointerDown={e => dragControls.start(e)}
            sx={{
              display: 'flex', alignItems: 'center', cursor: 'grab',
              color: T.textFaint, flexShrink: 0, touchAction: 'none',
              '&:active': { cursor: 'grabbing' },
            }}
          >
            <DragIndicator sx={{ fontSize: 18 }} />
          </Box>

          <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
            {/* Name row + toggle */}
            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: { xs: '0.82rem', sm: '0.88rem' }, fontWeight: 700, color: T.text, lineHeight: 1.3 }}>
                  {meta.label}
                </Typography>
                <Typography sx={{ fontSize: { xs: '0.7rem', sm: '0.72rem' }, color: T.textFaint, mt: 0.3, lineHeight: 1.4 }}>
                  {job.description}
                </Typography>
              </Box>
              <Tooltip title={job.enabled !== false ? 'Disable job' : 'Enable job'}>
                <Switch size="small" checked={job.enabled !== false} onChange={() => onToggle(job)}
                  sx={{ flexShrink: 0,
                    '& .MuiSwitch-thumb': { bgcolor: job.enabled !== false ? meta.color : undefined },
                    '& .MuiSwitch-track': { bgcolor: job.enabled !== false ? `${meta.color}55` : undefined },
                  }} />
              </Tooltip>
            </Box>

            {/* Cron row */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
              <Code sx={{ fontSize: 12, color: T.textFaint, flexShrink: 0 }} />
              <Tooltip title={job.cronExpression ?? ''}>
                <Typography sx={{ fontSize: '0.68rem', fontFamily: 'monospace', color: T.textMuted, mr: 'auto' }}>
                  {describeCron(job.cronExpression, job.timezone)}
                </Typography>
              </Tooltip>
              <Tooltip title="Edit schedule">
                <IconButton size="small" onClick={() => onEdit(job)}
                  sx={{ p: 0.25, color: T.textFaint, '&:hover': { color: meta.color } }}>
                  <EditIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Tooltip>
            </Box>

            {/* Status + last run */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              {isRunning ? (
                <Chip label="Running" size="small"
                  icon={<CircularProgress size={9} sx={{ color: `${T.success} !important` }} />}
                  sx={{ bgcolor: T.successBg, color: T.success, height: 20, fontSize: '0.65rem', '& .MuiChip-icon': { ml: 0.5 } }} />
              ) : job.lastStatus === 'FAILED' ? (
                <Chip label="Last Failed" size="small" icon={<ErrorIcon sx={{ fontSize: 11 }} />}
                  sx={{ bgcolor: T.errorBg, color: T.error, height: 20, fontSize: '0.65rem', '& .MuiChip-icon': { color: T.error, ml: 0.5 } }} />
              ) : (
                <Chip label="Idle" size="small"
                  sx={{ bgcolor: T.glassHover, color: T.textMuted, height: 20, fontSize: '0.65rem' }} />
              )}
              {job.lastRunAt && (
                <Typography sx={{ fontSize: '0.66rem', color: T.textFaint }}>
                  Last: {new Date(job.lastRunAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                </Typography>
              )}
            </Box>

            {isRunning && (
              <LinearProgress sx={{ height: 2, borderRadius: 1, bgcolor: T.glassHover,
                '& .MuiLinearProgress-bar': { bgcolor: meta.color } }} />
            )}

            <Button size="small" variant="outlined" fullWidth startIcon={<PlayArrow sx={{ fontSize: 14 }} />}
              disabled={isRunning} onClick={() => onTrigger(job)}
              sx={{
                mt: 'auto', borderColor: alpha(meta.color, 0.35), color: meta.color, fontSize: '0.75rem',
                '&:hover': { borderColor: meta.color, bgcolor: alpha(meta.color, 0.08) },
                '&:disabled': { borderColor: T.border, color: T.textFaint },
              }}>
              {isRunning ? 'Running…' : 'Run Now'}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Reorder.Item>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────
export default function SchedulerPanel() {
  const T  = useT();
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  // ── Data ────────────────────────────────────────────────────────────────────
  const { data: jobs = [], isLoading: jobsLoading } = useQuery({
    queryKey: ['scheduler-jobs'],
    queryFn:  api.jobs,
    refetchInterval: 15_000,
  });

  const { data: history = [], isLoading: histLoading } = useQuery({
    queryKey: ['scheduler-history'],
    queryFn:  api.history,
    refetchInterval: 5_000,
  });

  // ── Local ordered jobs (for drag-to-reorder) ─────────────────────────────
  const [orderedJobs, setOrderedJobs] = useState([]);
  const [orderDirty,  setOrderDirty]  = useState(false);

  useEffect(() => {
    if (jobs.length > 0 && !orderDirty) {
      setOrderedJobs([...jobs].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)));
    }
  }, [jobs, orderDirty]);

  const handleReorder = (newOrder) => {
    setOrderedJobs(newOrder);
    setOrderDirty(true);
  };

  // ── Edit cron dialog ─────────────────────────────────────────────────────
  const [editJob, setEditJob] = useState(null);

  // ── Triggering ───────────────────────────────────────────────────────────
  const [triggeringId, setTriggeringId] = useState(null);

  const triggerMutation = useMutation({
    mutationFn: (job) => api.trigger(job.id),
    onMutate:   (job) => setTriggeringId(job.id),
    onSuccess:  (_, job) => {
      enqueueSnackbar(`${JOB_META[job.id]?.label ?? job.id} triggered`, { variant: 'success' });
      qc.invalidateQueries({ queryKey: ['scheduler-history'] });
      setTimeout(() => {
        setTriggeringId(null);
        qc.invalidateQueries({ queryKey: ['scheduler-jobs'] });
        qc.invalidateQueries({ queryKey: ['scheduler-history'] });
      }, 2000);
    },
    onError: (_, job) => {
      setTriggeringId(null);
      enqueueSnackbar(`Failed to trigger ${JOB_META[job.id]?.label ?? job.id}`, { variant: 'error' });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (job) => api.toggle(job.id),
    onSuccess:  (_, job) => {
      enqueueSnackbar(`${JOB_META[job.id]?.label ?? job.id} toggled`, { variant: 'info' });
      qc.invalidateQueries({ queryKey: ['scheduler-jobs'] });
    },
    onError: () => enqueueSnackbar('Toggle failed', { variant: 'error' }),
  });

  const cronMutation = useMutation({
    mutationFn: ({ jobId, body }) => api.updateCron(jobId, body),
    onSuccess: () => {
      enqueueSnackbar('Schedule updated', { variant: 'success' });
      setEditJob(null);
      qc.invalidateQueries({ queryKey: ['scheduler-jobs'] });
    },
    onError: () => enqueueSnackbar('Failed to update schedule', { variant: 'error' }),
  });

  const reorderMutation = useMutation({
    mutationFn: (orders) => api.reorder(orders),
    onSuccess:  () => {
      enqueueSnackbar('Order saved', { variant: 'success', autoHideDuration: 1500 });
      setOrderDirty(false);
      qc.invalidateQueries({ queryKey: ['scheduler-jobs'] });
    },
    onError: () => enqueueSnackbar('Failed to save order', { variant: 'error' }),
  });

  const handleSaveOrder = () => {
    reorderMutation.mutate(orderedJobs.map((j, i) => ({ id: j.id, order: i })));
  };

  const isLoading = jobsLoading || histLoading;

  const fmt   = (iso) => iso ? new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
  const fmtMs = (ms) =>  ms == null ? '—' : ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2, md: 3 }, bgcolor: T.bg, minHeight: '100%', color: T.text }}>

      {/* ── Header ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 2 }, mb: { xs: 2, sm: 3 }, flexWrap: 'wrap' }}>
        <Schedule sx={{ color: T.teal, fontSize: { xs: 22, sm: 26 } }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: { xs: '1rem', sm: '1.15rem' }, fontWeight: 800, color: T.text, lineHeight: 1.2 }}>
            Scheduler
          </Typography>
          <Typography sx={{ fontSize: { xs: '0.72rem', sm: '0.78rem' }, color: T.textFaint }}>
            Manage and manually trigger background jobs · drag to reorder
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          {orderDirty && (
            <Button size="small" variant="contained"
              onClick={handleSaveOrder}
              disabled={reorderMutation.isPending}
              sx={{ fontSize: '0.72rem', bgcolor: T.teal, '&:hover': { bgcolor: T.tealHover ?? T.teal }, fontWeight: 700 }}>
              {reorderMutation.isPending ? <CircularProgress size={14} color="inherit" /> : 'Save Order'}
            </Button>
          )}
          <Tooltip title="Refresh">
            <IconButton size="small" disabled={isLoading}
              onClick={() => qc.invalidateQueries({ queryKey: ['scheduler-jobs', 'scheduler-history'] })}
              sx={{ color: T.textFaint, border: `1px solid ${T.border}`, '&:hover': { color: T.teal, borderColor: T.teal } }}>
              {isLoading ? <CircularProgress size={16} sx={{ color: T.teal }} /> : <Refresh sx={{ fontSize: 18 }} />}
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* ── Draggable Job Cards ── */}
      <Typography sx={{
        fontSize: '0.7rem', fontWeight: 700, color: T.textFaint,
        textTransform: 'uppercase', letterSpacing: '0.1em', mb: 1.5,
      }}>
        Scheduled Jobs
      </Typography>

      {orderedJobs.length === 0 && !jobsLoading && (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <Schedule sx={{ fontSize: 40, color: T.textFaint, mb: 1 }} />
          <Typography sx={{ color: T.textMuted, fontSize: '0.85rem' }}>No scheduler jobs registered</Typography>
        </Box>
      )}

      <Reorder.Group axis="y" values={orderedJobs} onReorder={handleReorder}
        style={{ padding: 0, margin: 0 }}>
        <AnimatePresence>
          {orderedJobs.map((job) => (
            <DraggableJobCard
              key={job.id}
              job={job}
              triggering={triggeringId === job.id}
              onTrigger={(j) => triggerMutation.mutate(j)}
              onToggle={(j) => toggleMutation.mutate(j)}
              onEdit={(j) => setEditJob(j)}
            />
          ))}
        </AnimatePresence>
      </Reorder.Group>

      {/* ── Execution History ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, mt: 1 }}>
        <History sx={{ color: T.teal, fontSize: 18 }} />
        <Typography sx={{
          fontSize: '0.7rem', fontWeight: 700, color: T.textFaint,
          textTransform: 'uppercase', letterSpacing: '0.1em',
        }}>
          Execution History
        </Typography>
        <Typography sx={{ fontSize: '0.65rem', color: T.textFaint, ml: 'auto' }}>
          auto-refreshes every 5s
        </Typography>
      </Box>

      <Box sx={{ bgcolor: T.glass, border: `1px solid ${T.border}`, borderRadius: 2, overflow: 'hidden' }}>
        <Box sx={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <Table size="small" sx={{ minWidth: 520 }}>
            <TableHead>
              <TableRow sx={{
                '& th': {
                  bgcolor: T.glassHover, color: T.textFaint,
                  fontSize: '0.68rem', fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                  borderColor: T.border, whiteSpace: 'nowrap', py: 1.25,
                },
              }}>
                <TableCell>Job</TableCell>
                <TableCell>Started</TableCell>
                <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Duration</TableCell>
                <TableCell>Status</TableCell>
                <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Message</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {history.map((row, i) => (
                <TableRow key={i} sx={{
                  '& td': { color: T.textMuted, fontSize: '0.8rem', borderColor: T.border },
                  '&:hover': { bgcolor: T.glassHover },
                  '&:last-child td': { borderBottom: 'none' },
                }}>
                  <TableCell sx={{ fontWeight: 600, color: `${T.text} !important`, whiteSpace: 'nowrap' }}>
                    {JOB_META[row.jobName]?.label ?? row.jobName}
                  </TableCell>
                  <TableCell sx={{ fontSize: '0.72rem !important', whiteSpace: 'nowrap' }}>
                    {fmt(row.startedAt)}
                  </TableCell>
                  <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Timer sx={{ fontSize: 12, color: T.textFaint }} />
                      <Typography sx={{ fontSize: '0.75rem', color: T.textMuted }}>{fmtMs(row.durationMs)}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    {row.status === 'SUCCESS' ? (
                      <Chip label="Success" size="small" icon={<CheckCircle sx={{ fontSize: 11 }} />}
                        sx={{ bgcolor: T.successBg, color: T.success, height: 18, fontSize: '0.62rem', '& .MuiChip-icon': { color: T.success, ml: 0.5 } }} />
                    ) : row.status === 'FAILED' ? (
                      <Chip label="Failed" size="small" icon={<ErrorIcon sx={{ fontSize: 11 }} />}
                        sx={{ bgcolor: T.errorBg, color: T.error, height: 18, fontSize: '0.62rem', '& .MuiChip-icon': { color: T.error, ml: 0.5 } }} />
                    ) : (
                      <Chip label={row.status ?? 'Unknown'} size="small"
                        sx={{ bgcolor: T.glassHover, color: T.textMuted, height: 18, fontSize: '0.62rem' }} />
                    )}
                  </TableCell>
                  <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                    {row.message && (
                      <Tooltip title={row.message}>
                        <Typography sx={{
                          fontSize: '0.72rem', maxWidth: { sm: 200, md: 300 },
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          color: row.status === 'FAILED' ? T.error : T.textFaint,
                        }}>
                          {row.message}
                        </Typography>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {history.length === 0 && !histLoading && (
                <TableRow>
                  <TableCell colSpan={5} sx={{
                    textAlign: 'center', py: 5,
                    color: T.textFaint, fontSize: '0.82rem', borderBottom: 'none',
                  }}>
                    No execution history yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Box>
      </Box>

      {/* ── Edit Cron Dialog ── */}
      <EditCronDialog
        open={!!editJob}
        job={editJob}
        onClose={() => setEditJob(null)}
        onSave={(jobId, body) => cronMutation.mutate({ jobId, body })}
      />
    </Box>
  );
}
