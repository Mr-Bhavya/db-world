import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Grid, Card, CardContent, Button, Chip, IconButton,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Alert, CircularProgress, Tooltip, LinearProgress, Paper, Switch,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  alpha, Divider,
} from '@mui/material';
import {
  Schedule, PlayArrow, Stop, Refresh, CheckCircle, Error as ErrorIcon,
  History, Timer, AccessTime, Code,
} from '@mui/icons-material';
import axios from 'axios';

const JOB_META = {
  'TagScheduler':          { color: '#f59e0b', desc: 'Recalculates all content tags (Trending, Featured, etc.)', cron: '0 0 3 * * *' },
  'TmdbSyncScheduler':     { color: '#6366f1', desc: 'Syncs outdated TMDB metadata for all records',           cron: '0 0 4 * * *' },
  'RailCacheInvalidation': { color: '#10b981', desc: 'Invalidates stale rail cache entries',                   cron: '0 */30 * * * *' },
};

function JobCard({ job, onTrigger, onToggle }) {
  const meta  = JOB_META[job.name] ?? { color: '#6366f1', desc: '', cron: '—' };
  const isRunning = job.status === 'RUNNING';
  return (
    <Card sx={{ bgcolor: '#12121e', border: `1px solid ${meta.color}25`, borderRadius: 2 }}>
      <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1.5 }}>
          <Box>
            <Typography sx={{ fontSize: '0.88rem', fontWeight: 700, color: '#fff' }}>{job.name}</Typography>
            <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', mt: 0.25 }}>
              {meta.desc}
            </Typography>
          </Box>
          <Switch size="small" checked={job.enabled !== false} onChange={() => onToggle(job)}
            sx={{ ml: 1, flexShrink: 0, '& .MuiSwitch-thumb': { bgcolor: job.enabled !== false ? meta.color : undefined } }} />
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <Code sx={{ fontSize: 13, color: 'rgba(255,255,255,0.3)' }} />
          <Typography sx={{ fontSize: '0.7rem', fontFamily: 'monospace', color: 'rgba(255,255,255,0.5)' }}>
            {job.cronExpression ?? meta.cron}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 2 }}>
          {isRunning ? (
            <Chip label="Running" size="small" icon={<CircularProgress size={9} sx={{ color: '#10b981 !important' }} />}
              sx={{ bgcolor: 'rgba(16,185,129,0.12)', color: '#10b981', height: 20, fontSize: '0.65rem',
                '& .MuiChip-icon': { ml: 0.5 } }} />
          ) : job.lastStatus === 'FAILED' ? (
            <Chip label="Last Failed" size="small" icon={<ErrorIcon sx={{ fontSize: 11 }} />}
              sx={{ bgcolor: 'rgba(239,68,68,0.12)', color: '#ef4444', height: 20, fontSize: '0.65rem',
                '& .MuiChip-icon': { color: '#ef4444', ml: 0.5 } }} />
          ) : (
            <Chip label="Idle" size="small"
              sx={{ bgcolor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)', height: 20, fontSize: '0.65rem' }} />
          )}
          {job.lastRunAt && (
            <Typography sx={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)' }}>
              Last: {new Date(job.lastRunAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
            </Typography>
          )}
        </Box>

        {isRunning && <LinearProgress sx={{ height: 2, borderRadius: 1, mb: 1.5,
          bgcolor: 'rgba(255,255,255,0.06)', '& .MuiLinearProgress-bar': { bgcolor: meta.color } }} />}

        <Button size="small" variant="outlined" fullWidth
          startIcon={isRunning ? <Stop sx={{ fontSize: 14 }} /> : <PlayArrow sx={{ fontSize: 14 }} />}
          disabled={isRunning} onClick={() => onTrigger(job)}
          sx={{ borderColor: `${meta.color}40`, color: meta.color, fontSize: '0.75rem',
            '&:hover': { borderColor: meta.color, bgcolor: alpha(meta.color, 0.08) },
            '&:disabled': { borderColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.3)' } }}>
          {isRunning ? 'Running…' : 'Run Now'}
        </Button>
      </CardContent>
    </Card>
  );
}

export default function SchedulerPanel() {
  const [jobs,    setJobs]    = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alert,   setAlert]   = useState(null);

  const showAlert = (msg, sev = 'success') => {
    setAlert({ msg, sev });
    setTimeout(() => setAlert(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [jobsRes, histRes] = await Promise.all([
        axios.get('/api/admin/scheduler/jobs').catch(() => ({ data: [] })),
        axios.get('/api/admin/scheduler/history').catch(() => ({ data: [] })),
      ]);

      const jobsData = Array.isArray(jobsRes.data) ? jobsRes.data : [];

      // If API returns empty, seed with known jobs so the UI is useful
      if (jobsData.length === 0) {
        setJobs(Object.keys(JOB_META).map(name => ({
          id: name, name, enabled: true, status: 'IDLE', lastStatus: null, lastRunAt: null,
          cronExpression: JOB_META[name].cron,
        })));
      } else {
        setJobs(jobsData);
      }

      setHistory(Array.isArray(histRes.data) ? histRes.data : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleTrigger = async (job) => {
    try {
      await axios.post(`/api/admin/scheduler/trigger/${job.name}`);
      showAlert(`${job.name} triggered`);
      // Optimistically mark as running
      setJobs(prev => prev.map(j => j.name === job.name ? { ...j, status: 'RUNNING' } : j));
      setTimeout(load, 2000);
    } catch {
      showAlert('Trigger failed', 'error');
    }
  };

  const handleToggle = async (job) => {
    try {
      await axios.patch(`/api/admin/scheduler/toggle/${job.name}`);
      setJobs(prev => prev.map(j => j.name === job.name ? { ...j, enabled: !j.enabled } : j));
    } catch {
      showAlert('Toggle failed', 'error');
    }
  };

  const fmt = (iso) => iso ? new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
  const fmtDuration = (ms) => ms == null ? '—' : ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Schedule sx={{ color: '#6366f1', fontSize: 28 }} />
        <Box>
          <Typography sx={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff' }}>Scheduler Panel</Typography>
          <Typography sx={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)' }}>
            Manage and trigger scheduled background jobs
          </Typography>
        </Box>
        <Box sx={{ flex: 1 }} />
        <Tooltip title="Refresh">
          <IconButton onClick={load} disabled={loading}
            sx={{ color: 'rgba(255,255,255,0.5)', '&:hover': { color: '#6366f1' } }}>
            {loading ? <CircularProgress size={18} sx={{ color: '#6366f1' }} /> : <Refresh />}
          </IconButton>
        </Tooltip>
      </Box>

      {alert && <Alert severity={alert.sev} sx={{ mb: 2 }} onClose={() => setAlert(null)}>{alert.msg}</Alert>}

      {/* Job cards */}
      <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgba(255,255,255,0.35)',
        textTransform: 'uppercase', letterSpacing: '0.1em', mb: 1.5 }}>
        Scheduled Jobs
      </Typography>
      <Grid container spacing={2} sx={{ mb: 4 }}>
        {jobs.map((job) => (
          <Grid item xs={12} sm={6} md={4} key={job.id ?? job.name}>
            <JobCard job={job} onTrigger={handleTrigger} onToggle={handleToggle} />
          </Grid>
        ))}
        {!loading && jobs.length === 0 && (
          <Grid item xs={12}>
            <Box sx={{ textAlign: 'center', py: 5 }}>
              <Schedule sx={{ fontSize: 40, color: 'rgba(255,255,255,0.1)', mb: 1 }} />
              <Typography sx={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem' }}>
                No scheduler jobs registered
              </Typography>
            </Box>
          </Grid>
        )}
      </Grid>

      {/* Execution history */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <History sx={{ color: '#6366f1', fontSize: 18 }} />
        <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgba(255,255,255,0.35)',
          textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Execution History
        </Typography>
      </Box>
      <Paper sx={{ bgcolor: '#0f0f1a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ '& th': { bgcolor: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.4)',
                fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
                borderColor: 'rgba(255,255,255,0.06)' } }}>
                <TableCell>Job Name</TableCell>
                <TableCell>Started At</TableCell>
                <TableCell>Duration</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Message</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {history.map((row, i) => (
                <TableRow key={i} sx={{
                  '& td': { color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem', borderColor: 'rgba(255,255,255,0.05)' },
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' },
                }}>
                  <TableCell sx={{ fontWeight: 600, color: '#fff !important' }}>{row.jobName}</TableCell>
                  <TableCell sx={{ fontSize: '0.72rem !important', color: 'rgba(255,255,255,0.45) !important' }}>
                    {fmt(row.startedAt)}
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Timer sx={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }} />
                      <Typography sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>
                        {fmtDuration(row.durationMs)}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    {row.status === 'SUCCESS' ? (
                      <Chip label="Success" size="small" icon={<CheckCircle sx={{ fontSize: 11 }} />}
                        sx={{ bgcolor: 'rgba(16,185,129,0.1)', color: '#10b981', height: 18, fontSize: '0.62rem',
                          '& .MuiChip-icon': { color: '#10b981', ml: 0.5 } }} />
                    ) : row.status === 'FAILED' ? (
                      <Chip label="Failed" size="small" icon={<ErrorIcon sx={{ fontSize: 11 }} />}
                        sx={{ bgcolor: 'rgba(239,68,68,0.1)', color: '#ef4444', height: 18, fontSize: '0.62rem',
                          '& .MuiChip-icon': { color: '#ef4444', ml: 0.5 } }} />
                    ) : (
                      <Chip label={row.status ?? 'Unknown'} size="small"
                        sx={{ bgcolor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)', height: 18, fontSize: '0.62rem' }} />
                    )}
                  </TableCell>
                  <TableCell>
                    {row.message && (
                      <Tooltip title={row.message}>
                        <Typography sx={{ fontSize: '0.72rem', maxWidth: 250,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          color: row.status === 'FAILED' ? '#ef4444' : 'rgba(255,255,255,0.45)' }}>
                          {row.message}
                        </Typography>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {history.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={5} sx={{ textAlign: 'center', py: 5, color: 'rgba(255,255,255,0.25)', borderBottom: 'none' }}>
                    No execution history available
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
