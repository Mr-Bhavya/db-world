import React from 'react';
import {
  Box, Typography, Grid, Card, CardContent, Button, Chip,
  IconButton, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Alert, CircularProgress, Tooltip,
  LinearProgress, Paper, Switch, alpha,
} from '@mui/material';
import {
  Schedule, PlayArrow, Refresh, CheckCircle,
  Error as ErrorIcon, History, Timer, Code,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import axios from 'axios';
import { useT } from '@shared/theme';

// ─── Per-job display metadata ─────────────────────────────────────────────────
// Colors are accent-only; backgrounds and text use theme tokens.
const JOB_META = {
  TagScheduler:       { color: '#f59e0b', label: 'Tag Scheduler' },
  TmdbMovieSync:      { color: '#6366f1', label: 'TMDB Movie Sync' },
  TmdbTvSync:         { color: '#a855f7', label: 'TMDB TV Sync' },
  PersonSyncScheduler:{ color: '#0d9488', label: 'Person Detail Sync' },
};

// ─── API helpers ──────────────────────────────────────────────────────────────
const api = {
  jobs:    () => axios.get('/api/admin/scheduler/jobs').then(r => r.data?.data ?? []),
  history: () => axios.get('/api/admin/scheduler/history').then(r => r.data?.data ?? []),
  trigger: (jobId) => axios.post(`/api/admin/scheduler/trigger/${jobId}`),
  toggle:  (jobId) => axios.patch(`/api/admin/scheduler/toggle/${jobId}`),
};

// ─── Cron human description ────────────────────────────────────────────────────
function describeCron(expr, timezone) {
  if (!expr) return '—';
  const parts = expr.split(' ');
  if (parts.length < 6) return expr;
  const [, min, hour, , , ,] = parts;
  if (hour === '*/6') return 'Every 6 hours';
  if (hour === '*/2') return 'Every 2 hours';
  if (hour === '*/1') return 'Every hour';
  if (/^\d+$/.test(hour)) {
    const h = parseInt(hour, 10);
    const m = parseInt(min, 10);
    const time = `${h}:${String(m).padStart(2, '0')}`;
    return `Daily at ${time}${timezone ? ' ' + timezone.replace('Asia/', '') : ''}`;
  }
  return expr;
}

// ─── Job card ─────────────────────────────────────────────────────────────────
function JobCard({ job, onTrigger, onToggle, triggering }) {
  const T    = useT();
  const meta = JOB_META[job.id] ?? { color: T.teal, label: job.name };
  const isRunning = job.status === 'RUNNING' || triggering;

  return (
    <Card sx={{
      bgcolor: T.glass,
      border: `1px solid ${isRunning ? meta.color + '55' : T.border}`,
      borderRadius: 2,
      height: '100%',
      transition: 'border-color 0.2s',
      '&:hover': { borderColor: meta.color + '66' },
    }}>
      <CardContent sx={{ p: { xs: 2, sm: 2.5 }, '&:last-child': { pb: { xs: 2, sm: 2.5 } }, display: 'flex', flexDirection: 'column', gap: 1.5 }}>

        {/* Name + toggle */}
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
            <Switch
              size="small"
              checked={job.enabled !== false}
              onChange={() => onToggle(job)}
              sx={{
                flexShrink: 0,
                '& .MuiSwitch-thumb': { bgcolor: job.enabled !== false ? meta.color : undefined },
                '& .MuiSwitch-track': { bgcolor: job.enabled !== false ? meta.color + '55' : undefined },
              }}
            />
          </Tooltip>
        </Box>

        {/* Cron expression */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Code sx={{ fontSize: 12, color: T.textFaint, flexShrink: 0 }} />
          <Tooltip title={job.cronExpression ?? ''}>
            <Typography sx={{ fontSize: '0.68rem', fontFamily: 'monospace', color: T.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {describeCron(job.cronExpression, job.timezone)}
            </Typography>
          </Tooltip>
        </Box>

        {/* Status row */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          {isRunning ? (
            <Chip
              label="Running"
              size="small"
              icon={<CircularProgress size={9} sx={{ color: `${T.success} !important` }} />}
              sx={{ bgcolor: T.successBg, color: T.success, height: 20, fontSize: '0.65rem', '& .MuiChip-icon': { ml: 0.5 } }}
            />
          ) : job.lastStatus === 'FAILED' ? (
            <Chip
              label="Last Failed"
              size="small"
              icon={<ErrorIcon sx={{ fontSize: 11 }} />}
              sx={{ bgcolor: T.errorBg, color: T.error, height: 20, fontSize: '0.65rem', '& .MuiChip-icon': { color: T.error, ml: 0.5 } }}
            />
          ) : (
            <Chip
              label="Idle"
              size="small"
              sx={{ bgcolor: T.glassHover, color: T.textMuted, height: 20, fontSize: '0.65rem' }}
            />
          )}
          {job.lastRunAt && (
            <Typography sx={{ fontSize: '0.66rem', color: T.textFaint }}>
              Last: {new Date(job.lastRunAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
            </Typography>
          )}
        </Box>

        {/* Running progress bar */}
        {isRunning && (
          <LinearProgress sx={{
            height: 2, borderRadius: 1,
            bgcolor: T.glassHover,
            '& .MuiLinearProgress-bar': { bgcolor: meta.color },
          }} />
        )}

        {/* Run now button */}
        <Button
          size="small"
          variant="outlined"
          fullWidth
          startIcon={<PlayArrow sx={{ fontSize: 14 }} />}
          disabled={isRunning}
          onClick={() => onTrigger(job)}
          sx={{
            mt: 'auto',
            borderColor: alpha(meta.color, 0.35),
            color: meta.color,
            fontSize: '0.75rem',
            '&:hover': { borderColor: meta.color, bgcolor: alpha(meta.color, 0.08) },
            '&:disabled': { borderColor: T.border, color: T.textFaint },
          }}
        >
          {isRunning ? 'Running…' : 'Run Now'}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────
export default function SchedulerPanel() {
  const T  = useT();
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const { data: jobs = [], isLoading: jobsLoading } = useQuery({
    queryKey: ['scheduler-jobs'],
    queryFn:  api.jobs,
    refetchInterval: 15_000,
  });

  const { data: history = [], isLoading: histLoading } = useQuery({
    queryKey: ['scheduler-history'],
    queryFn:  api.history,
  });

  // Track which job is being triggered (for optimistic UI)
  const [triggeringId, setTriggeringId] = React.useState(null);

  const triggerMutation = useMutation({
    mutationFn: (job) => api.trigger(job.id),
    onMutate:   (job) => setTriggeringId(job.id),
    onSuccess:  (_, job) => {
      enqueueSnackbar(`${JOB_META[job.id]?.label ?? job.id} triggered`, { variant: 'success' });
      setTimeout(() => {
        setTriggeringId(null);
        qc.invalidateQueries({ queryKey: ['scheduler-jobs'] });
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
      enqueueSnackbar(`${JOB_META[job.id]?.label ?? job.id} toggled (restart to apply)`, { variant: 'info' });
      qc.invalidateQueries({ queryKey: ['scheduler-jobs'] });
    },
    onError: () => enqueueSnackbar('Toggle failed', { variant: 'error' }),
  });

  const isLoading = jobsLoading || histLoading;

  const fmt = (iso) => iso
    ? new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
    : '—';
  const fmtMs = (ms) => ms == null ? '—' : ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;

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
            Manage and manually trigger background jobs
          </Typography>
        </Box>
        <Tooltip title="Refresh">
          <IconButton
            size="small"
            onClick={() => qc.invalidateQueries({ queryKey: ['scheduler-jobs', 'scheduler-history'] })}
            disabled={isLoading}
            sx={{ color: T.textFaint, border: `1px solid ${T.border}`, '&:hover': { color: T.teal, borderColor: T.teal } }}
          >
            {isLoading
              ? <CircularProgress size={16} sx={{ color: T.teal }} />
              : <Refresh sx={{ fontSize: 18 }} />}
          </IconButton>
        </Tooltip>
      </Box>

      {/* ── Job cards ── */}
      <Typography sx={{
        fontSize: '0.7rem', fontWeight: 700, color: T.textFaint,
        textTransform: 'uppercase', letterSpacing: '0.1em', mb: 1.5,
      }}>
        Scheduled Jobs
      </Typography>

      <Grid container spacing={{ xs: 1.5, sm: 2 }} sx={{ mb: { xs: 3, sm: 4 } }}>
        {jobs.map((job) => (
          <Grid item xs={12} sm={6} lg={3} key={job.id ?? job.name}>
            <JobCard
              job={job}
              triggering={triggeringId === job.id}
              onTrigger={(j) => triggerMutation.mutate(j)}
              onToggle={(j) => toggleMutation.mutate(j)}
            />
          </Grid>
        ))}
        {!jobsLoading && jobs.length === 0 && (
          <Grid item xs={12}>
            <Box sx={{ textAlign: 'center', py: { xs: 4, sm: 6 } }}>
              <Schedule sx={{ fontSize: { xs: 32, sm: 40 }, color: T.textFaint, mb: 1 }} />
              <Typography sx={{ color: T.textMuted, fontSize: '0.85rem' }}>
                No scheduler jobs registered
              </Typography>
            </Box>
          </Grid>
        )}
      </Grid>

      {/* ── Execution history ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <History sx={{ color: T.teal, fontSize: 18 }} />
        <Typography sx={{
          fontSize: '0.7rem', fontWeight: 700, color: T.textFaint,
          textTransform: 'uppercase', letterSpacing: '0.1em',
        }}>
          Execution History
        </Typography>
      </Box>

      <Paper sx={{
        bgcolor: T.glass,
        border: `1px solid ${T.border}`,
        borderRadius: 2,
        overflow: 'hidden',
      }}>
        <TableContainer sx={{ overflowX: 'auto' }}>
          <Table size="small" sx={{ minWidth: { xs: 480, sm: 600 } }}>
            <TableHead>
              <TableRow sx={{
                '& th': {
                  bgcolor: T.glassHover, color: T.textFaint,
                  fontSize: '0.68rem', fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                  borderColor: T.border, whiteSpace: 'nowrap',
                  py: 1.25,
                },
              }}>
                <TableCell>Job</TableCell>
                <TableCell>Started</TableCell>
                <TableCell>Duration</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Message</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {history.map((row, i) => (
                <TableRow
                  key={i}
                  sx={{
                    '& td': { color: T.textMuted, fontSize: '0.8rem', borderColor: T.border },
                    '&:hover': { bgcolor: T.glassHover },
                    '&:last-child td': { borderBottom: 'none' },
                  }}
                >
                  <TableCell sx={{ fontWeight: 600, color: `${T.text} !important`, whiteSpace: 'nowrap' }}>
                    {JOB_META[row.jobName]?.label ?? row.jobName}
                  </TableCell>
                  <TableCell sx={{ fontSize: '0.72rem !important', whiteSpace: 'nowrap' }}>
                    {fmt(row.startedAt)}
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Timer sx={{ fontSize: 12, color: T.textFaint }} />
                      <Typography sx={{ fontSize: '0.75rem', color: T.textMuted }}>
                        {fmtMs(row.durationMs)}
                      </Typography>
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
                  <TableCell>
                    {row.message && (
                      <Tooltip title={row.message}>
                        <Typography sx={{
                          fontSize: '0.72rem',
                          maxWidth: { xs: 120, sm: 200, md: 300 },
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
                    textAlign: 'center', py: { xs: 4, sm: 5 },
                    color: T.textFaint, fontSize: '0.82rem', borderBottom: 'none',
                  }}>
                    No execution history yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}
