import React, { useState, useEffect, useMemo } from 'react';
import {
  Box, Typography, Button, Chip,
  IconButton, Table, TableBody, TableCell, TableHead, TableRow, CircularProgress, Tooltip,
  Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Alert,
  ToggleButton, ToggleButtonGroup, Divider, MenuItem, Stack, Grow,
} from '@mui/material';
import {
  Schedule, ScheduleRounded, CheckCircle,
  Error as ErrorIcon, History, Timer,
  Close as CloseIcon, SaveRounded, Autorenew,
  ExpandMoreRounded, PersonRounded,
} from '@mui/icons-material';
import { Reorder, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notify } from '@shared/notify';
import axiosInstance from '../../../shared/components/ui/utils/AxiosInstants';
import { useT } from '@shared/theme';
import {
  AdminPage, SectionCard, AdminActionButton, EmptyState, adminSurface,
} from '@features/admin/adminUi';
import RunLogPanel from './RunLogPanel';
import JobCard from './JobCard';
import { JOB_META } from './jobMeta';
import { describeSchedule } from './schedulerUtils';

// ─── API ──────────────────────────────────────────────────────────────────────
const api = {
  jobs:    ()               => axiosInstance.get('/api/admin/scheduler/jobs').then(r => r.data?.data ?? []),
  history: (jobName, limit = 50) => axiosInstance
        .get('/api/admin/scheduler/history', { params: { limit, jobName } })
        .then(r => r.data?.data ?? []),
  trigger: (jobId)              => axiosInstance.post(`/api/admin/scheduler/trigger/${jobId}`),
  toggle:  (jobId)              => axiosInstance.patch(`/api/admin/scheduler/toggle/${jobId}`),
  updateCron:     (jobId, body) => axiosInstance.patch(`/api/admin/scheduler/cron/${jobId}`,     body),
  updateInterval: (jobId, body) => axiosInstance.patch(`/api/admin/scheduler/interval/${jobId}`, body),
  updateSettings: (jobId, body) => axiosInstance.patch(`/api/admin/scheduler/jobs/${jobId}`,     body),
  reorder: (orders)             => axiosInstance.patch('/api/admin/scheduler/reorder', orders),
};



// ─── Cron expression parser / builder ────────────────────────────────────────
/**
 * Parses a Spring 6-field cron expression into a "kind + parameters" shape
 * the visual builder can edit. Falls back to {kind:'CUSTOM', raw} for
 * anything we don't recognise so the user can still hand-edit.
 *
 * Spring layout: second minute hour day-of-month month day-of-week
 */
function parseCron(expr) {
  const parts = (expr ?? '').trim().split(/\s+/);
  if (parts.length !== 6) return { kind: 'CUSTOM', raw: expr ?? '' };
  const [sec, min, hour, dom, month, dow] = parts;
  const isNum = (v) => /^\d+$/.test(v);

  // Hourly: every N hours at minute M  →  `0 M */N * * *`
  if (sec === '0' && isNum(min) && /^\*\/\d+$/.test(hour) && dom === '*' && month === '*' && dow === '*') {
    return { kind: 'HOURLY', everyHours: parseInt(hour.split('/')[1], 10), minute: parseInt(min, 10) };
  }
  // Daily at HH:MM
  if (sec === '0' && isNum(min) && isNum(hour) && dom === '*' && month === '*' && dow === '*') {
    return { kind: 'DAILY', hour: parseInt(hour, 10), minute: parseInt(min, 10) };
  }
  // Weekly: comma-separated DOW names or numbers
  if (sec === '0' && isNum(min) && isNum(hour) && dom === '*' && month === '*' && dow !== '*') {
    return { kind: 'WEEKLY', hour: parseInt(hour, 10), minute: parseInt(min, 10), days: dow.split(',').map(d => d.trim()) };
  }
  // Monthly on day D
  if (sec === '0' && isNum(min) && isNum(hour) && isNum(dom) && month === '*' && dow === '*') {
    return { kind: 'MONTHLY', hour: parseInt(hour, 10), minute: parseInt(min, 10), day: parseInt(dom, 10) };
  }
  return { kind: 'CUSTOM', raw: expr };
}

function buildCron(parsed) {
  switch (parsed.kind) {
    case 'HOURLY':  return `0 ${parsed.minute} */${parsed.everyHours} * * *`;
    case 'DAILY':   return `0 ${parsed.minute} ${parsed.hour} * * *`;
    case 'WEEKLY':  return `0 ${parsed.minute} ${parsed.hour} * * ${(parsed.days ?? []).join(',') || 'MON'}`;
    case 'MONTHLY': return `0 ${parsed.minute} ${parsed.hour} ${parsed.day} * *`;
    case 'CUSTOM':  return parsed.raw;
    default:        return '';
  }
}

const DOW_OPTIONS = [
  { value: 'MON', label: 'Mon' }, { value: 'TUE', label: 'Tue' },
  { value: 'WED', label: 'Wed' }, { value: 'THU', label: 'Thu' },
  { value: 'FRI', label: 'Fri' }, { value: 'SAT', label: 'Sat' },
  { value: 'SUN', label: 'Sun' },
];

/**
 * Preset-driven cron builder. Renders mode tabs (Hourly / Daily / Weekly /
 * Monthly / Custom) with the appropriate inputs per mode, plus the raw
 * expression + a live human description below for verification.
 */
function CronBuilder({ value, onChange, color }) {
  const T = useT();
  const S = adminSurface(T);
  const [parsed, setParsed] = useState(() => parseCron(value));

  // Reconcile if parent value changes externally (e.g. when the dialog re-opens).
  useEffect(() => { setParsed(parseCron(value)); }, [value]);

  const update = (next) => {
    setParsed(next);
    onChange(buildCron(next));
  };

  const human = useMemo(() => {
    const expr = buildCron(parsed);
    return describeSchedule({ cronExpression: expr, jobType: 'CRON' });
  }, [parsed]);

  const inputSx = {
    '& .MuiOutlinedInput-root': {
      bgcolor: T.inputBg, color: T.textPrimary,
      '& fieldset':             { borderColor: S.border },
      '&:hover fieldset':       { borderColor: color },
      '&.Mui-focused fieldset': { borderColor: color },
    },
    '& .MuiInputLabel-root': { color: T.textMuted },
    '& .MuiInputLabel-root.Mui-focused': { color: color },
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <ToggleButtonGroup
        value={parsed.kind} exclusive size="small"
        onChange={(_, kind) => {
          if (!kind) return;
          // Sensible defaults per mode so swapping doesn't produce garbage cron.
          const fresh = (
            kind === 'HOURLY'  ? { kind, everyHours: 1, minute: 0 } :
            kind === 'DAILY'   ? { kind, hour: 2, minute: 0 } :
            kind === 'WEEKLY'  ? { kind, hour: 2, minute: 0, days: ['MON'] } :
            kind === 'MONTHLY' ? { kind, hour: 2, minute: 0, day: 1 } :
                                 { kind: 'CUSTOM', raw: buildCron(parsed) }
          );
          update(fresh);
        }}
        sx={{ flexWrap: 'wrap',
          '& .MuiToggleButton-root': {
            fontSize: '0.72rem', textTransform: 'none', px: 1.5, py: 0.4,
            color: T.textMuted, borderColor: T.border,
            '&.Mui-selected': { bgcolor: `${color}1f`, color, borderColor: `${color}55` },
          } }}>
        <ToggleButton value="HOURLY">Hourly</ToggleButton>
        <ToggleButton value="DAILY">Daily</ToggleButton>
        <ToggleButton value="WEEKLY">Weekly</ToggleButton>
        <ToggleButton value="MONTHLY">Monthly</ToggleButton>
        <ToggleButton value="CUSTOM">Custom</ToggleButton>
      </ToggleButtonGroup>

      {parsed.kind === 'HOURLY' && (
        <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          <Typography sx={{ fontSize: '0.78rem', color: T.textMuted }}>Every</Typography>
          <TextField select size="small" value={parsed.everyHours}
            onChange={e => update({ ...parsed, everyHours: parseInt(e.target.value, 10) })}
            sx={{ width: 90, ...inputSx }}>
            {[1, 2, 3, 4, 6, 8, 12].map(n => <MenuItem key={n} value={n}>{n} hour{n>1?'s':''}</MenuItem>)}
          </TextField>
          <Typography sx={{ fontSize: '0.78rem', color: T.textMuted }}>at minute</Typography>
          <TextField select size="small" value={parsed.minute}
            onChange={e => update({ ...parsed, minute: parseInt(e.target.value, 10) })}
            sx={{ width: 90, ...inputSx }}>
            {[0, 5, 10, 15, 20, 30, 45].map(n => <MenuItem key={n} value={n}>:{String(n).padStart(2,'0')}</MenuItem>)}
          </TextField>
        </Stack>
      )}

      {parsed.kind === 'DAILY' && (
        <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          <Typography sx={{ fontSize: '0.78rem', color: T.textMuted }}>At</Typography>
          <TextField select size="small" value={parsed.hour}
            onChange={e => update({ ...parsed, hour: parseInt(e.target.value, 10) })}
            sx={{ width: 90, ...inputSx }}>
            {Array.from({ length: 24 }, (_, i) => <MenuItem key={i} value={i}>{String(i).padStart(2,'0')}</MenuItem>)}
          </TextField>
          <Typography sx={{ fontSize: '0.78rem', color: T.textMuted }}>:</Typography>
          <TextField select size="small" value={parsed.minute}
            onChange={e => update({ ...parsed, minute: parseInt(e.target.value, 10) })}
            sx={{ width: 90, ...inputSx }}>
            {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map(n => <MenuItem key={n} value={n}>{String(n).padStart(2,'0')}</MenuItem>)}
          </TextField>
        </Stack>
      )}

      {parsed.kind === 'WEEKLY' && (
        <Stack sx={{ gap: 1 }}>
          <Stack direction="row" sx={{ gap: 0.5, flexWrap: 'wrap' }}>
            {DOW_OPTIONS.map(d => {
              const on = parsed.days?.includes(d.value);
              return (
                <Chip key={d.value} label={d.label} size="small" clickable
                  onClick={() => {
                    const next = on
                        ? (parsed.days ?? []).filter(x => x !== d.value)
                        : [...(parsed.days ?? []), d.value];
                    update({ ...parsed, days: next.length ? next : ['MON'] });
                  }}
                  sx={{ fontSize: '0.72rem', height: 26,
                    bgcolor: on ? `${color}22` : S.inset,
                    color:   on ? color : T.textMuted,
                    border: `1px solid ${on ? color + '55' : S.border}` }} />
              );
            })}
          </Stack>
          <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
            <Typography sx={{ fontSize: '0.78rem', color: T.textMuted }}>at</Typography>
            <TextField select size="small" value={parsed.hour}
              onChange={e => update({ ...parsed, hour: parseInt(e.target.value, 10) })}
              sx={{ width: 90, ...inputSx }}>
              {Array.from({ length: 24 }, (_, i) => <MenuItem key={i} value={i}>{String(i).padStart(2,'0')}</MenuItem>)}
            </TextField>
            <Typography sx={{ fontSize: '0.78rem', color: T.textMuted }}>:</Typography>
            <TextField select size="small" value={parsed.minute}
              onChange={e => update({ ...parsed, minute: parseInt(e.target.value, 10) })}
              sx={{ width: 90, ...inputSx }}>
              {[0, 15, 30, 45].map(n => <MenuItem key={n} value={n}>{String(n).padStart(2,'0')}</MenuItem>)}
            </TextField>
          </Stack>
        </Stack>
      )}

      {parsed.kind === 'MONTHLY' && (
        <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          <Typography sx={{ fontSize: '0.78rem', color: T.textMuted }}>Day</Typography>
          <TextField select size="small" value={parsed.day}
            onChange={e => update({ ...parsed, day: parseInt(e.target.value, 10) })}
            sx={{ width: 90, ...inputSx }}>
            {Array.from({ length: 28 }, (_, i) => <MenuItem key={i+1} value={i+1}>{i+1}</MenuItem>)}
          </TextField>
          <Typography sx={{ fontSize: '0.78rem', color: T.textMuted }}>at</Typography>
          <TextField select size="small" value={parsed.hour}
            onChange={e => update({ ...parsed, hour: parseInt(e.target.value, 10) })}
            sx={{ width: 90, ...inputSx }}>
            {Array.from({ length: 24 }, (_, i) => <MenuItem key={i} value={i}>{String(i).padStart(2,'0')}</MenuItem>)}
          </TextField>
          <Typography sx={{ fontSize: '0.78rem', color: T.textMuted }}>:</Typography>
          <TextField select size="small" value={parsed.minute}
            onChange={e => update({ ...parsed, minute: parseInt(e.target.value, 10) })}
            sx={{ width: 90, ...inputSx }}>
            {[0, 15, 30, 45].map(n => <MenuItem key={n} value={n}>{String(n).padStart(2,'0')}</MenuItem>)}
          </TextField>
        </Stack>
      )}

      {parsed.kind === 'CUSTOM' && (
        <TextField size="small" label="Cron Expression"
          value={parsed.raw ?? ''} onChange={e => update({ kind: 'CUSTOM', raw: e.target.value })}
          sx={{ ...inputSx, '& .MuiOutlinedInput-root': { ...inputSx['& .MuiOutlinedInput-root'], fontFamily: 'monospace' } }}
          helperText="second minute hour day-of-month month day-of-week" />
      )}

      {/* Preview */}
      <Box sx={{ bgcolor: S.inset, border: `1px solid ${S.border}`, borderRadius: 1, p: 1 }}>
        <Typography sx={{ fontSize: '0.66rem', color: T.textFaint, textTransform: 'uppercase',
          letterSpacing: '0.08em', mb: 0.25 }}>
          Result
        </Typography>
        <Typography sx={{ fontSize: '0.78rem', color, fontFamily: 'monospace' }}>
          {buildCron(parsed)}
        </Typography>
        <Typography sx={{ fontSize: '0.72rem', color: T.textMuted, mt: 0.25 }}>
          {human}
        </Typography>
      </Box>
    </Box>
  );
}

// ─── Shared settings section (displayName + notes) ────────────────────────────
function SettingsSection({ displayName, notes, defaultName, onDisplayName, onNotes, color }) {
  const T = useT();
  const S = adminSurface(T);
  const inputSx = {
    '& .MuiOutlinedInput-root': {
      bgcolor: T.inputBg, color: T.textPrimary,
      '& fieldset':             { borderColor: S.border },
      '&:hover fieldset':       { borderColor: color },
      '&.Mui-focused fieldset': { borderColor: color },
    },
    '& .MuiInputLabel-root': { color: T.textMuted },
    '& .MuiInputLabel-root.Mui-focused': { color: color },
  };
  return (
    <Stack sx={{ gap: 1.5 }}>
      <TextField size="small" label="Display name" value={displayName ?? ''}
        onChange={e => onDisplayName(e.target.value)}
        placeholder={defaultName ?? ''}
        helperText={`Leave empty to use the default${defaultName ? ` ("${defaultName}")` : ''}`}
        sx={inputSx} />
      <TextField size="small" label="Notes" value={notes ?? ''}
        onChange={e => onNotes(e.target.value)}
        multiline minRows={2} maxRows={4}
        helperText="Your own annotation, shown beneath the system description"
        sx={inputSx} />
    </Stack>
  );
}

// ─── Edit Cron Dialog (CRON jobs only) ────────────────────────────────────────
function EditCronDialog({ open, job, onClose, onSave }) {
  const T = useT();
  const S = adminSurface(T);
  const [cron, setCron]               = useState('');
  const [tz, setTz]                   = useState('');
  const [displayName, setDisplayName] = useState('');
  const [notes, setNotes]             = useState('');
  const [recheck, setRecheck]         = useState(20);
  const [error, setError]             = useState('');

  useEffect(() => {
    if (open && job) {
      setCron(job.cronExpression ?? '');
      setTz(job.timezone ?? '');
      setDisplayName(job.name && job.name !== job.defaultName ? job.name : '');
      setNotes(job.notes ?? '');
      setRecheck(job.recheckIntervalHours ?? 20);
      setError('');
    }
  }, [open, job]);

  // Recheck interval applies only to the TMDB change-sync jobs (or any job that
  // already carries the value). Other jobs don't gate on it.
  const showRecheck = job
    && (job.id === 'TmdbMovieSync' || job.id === 'TmdbTvSync' || job.recheckIntervalHours != null);

  const handleSave = () => {
    const parts = (cron ?? '').trim().split(/\s+/);
    if (parts.length !== 6) return; // builder won't normally produce invalid expr, but defend
    const body = {
      cronExpression: cron.trim(),
      timezone:       tz.trim() || undefined,
      displayName,
      notes,
    };
    if (showRecheck) {
      const rh = parseInt(recheck, 10);
      if (!Number.isFinite(rh) || rh <= 0) { setError('Recheck interval must be a positive integer'); return; }
      body.recheckIntervalHours = rh;
    }
    onSave(job.id, body);
  };

  if (!job) return null;
  const meta = JOB_META[job.id] ?? { color: T.teal };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { bgcolor: S.card, border: `1px solid ${S.border}`, borderRadius: 2 } }}>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: T.text }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Schedule sx={{ color: meta.color, fontSize: 20 }} />
          Edit — {JOB_META[job.id]?.label ?? job.id}
        </Box>
        <IconButton size="small" onClick={onClose} sx={{ color: T.textFaint }}>
          <CloseIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
        <Typography sx={{ fontSize: '0.7rem', color: T.textFaint, textTransform: 'uppercase',
          letterSpacing: '0.08em', fontWeight: 700 }}>Schedule</Typography>

        <CronBuilder value={cron} onChange={setCron} color={meta.color} />

        <TextField size="small" label="Timezone (optional)" value={tz} onChange={e => setTz(e.target.value)}
          placeholder="Asia/Kolkata"
          helperText="Leave blank to keep current timezone"
          sx={{
            '& .MuiOutlinedInput-root': { bgcolor: T.inputBg, color: T.textPrimary,
              '& fieldset': { borderColor: S.border },
              '&:hover fieldset': { borderColor: meta.color },
              '&.Mui-focused fieldset': { borderColor: meta.color } },
            '& .MuiInputLabel-root': { color: T.textMuted },
            '& .MuiInputLabel-root.Mui-focused': { color: meta.color },
          }} />

        {showRecheck && (
          <TextField size="small" label="Recheck interval (hours)" type="number" value={recheck}
            onChange={e => { setRecheck(e.target.value); setError(''); }}
            inputProps={{ min: 1, max: 168, step: 1 }}
            error={!!error}
            helperText={error
              || 'Skip a record re-checked within this many hours, even if TMDB re-lists it. Keep it below the run frequency (e.g. 20 for a daily run) so a genuine later change still syncs.'}
            sx={{
              '& .MuiOutlinedInput-root': { bgcolor: T.inputBg, color: T.textPrimary,
                '& fieldset': { borderColor: S.border },
                '&:hover fieldset': { borderColor: meta.color },
                '&.Mui-focused fieldset': { borderColor: meta.color } },
              '& .MuiInputLabel-root': { color: T.textMuted },
              '& .MuiInputLabel-root.Mui-focused': { color: meta.color },
              '& .MuiFormHelperText-root': { color: error ? T.error : T.textFaint },
            }} />
        )}

        <Divider sx={{ borderColor: S.divider }} />

        <Typography sx={{ fontSize: '0.7rem', color: T.textFaint, textTransform: 'uppercase',
          letterSpacing: '0.08em', fontWeight: 700 }}>Labels</Typography>

        <SettingsSection
          displayName={displayName} notes={notes}
          defaultName={job.defaultName ?? JOB_META[job.id]?.label ?? job.id}
          onDisplayName={setDisplayName} onNotes={setNotes}
          color={meta.color}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <Button onClick={onClose} sx={{ color: T.textMuted }}>Cancel</Button>
        <Button variant="contained" onClick={handleSave}
          sx={{ bgcolor: meta.color, '&:hover': { bgcolor: meta.color }, fontWeight: 600 }}>
          Save Changes
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Edit Interval Dialog (FIXED_DELAY jobs only) ─────────────────────────────
function EditIntervalDialog({ open, job, onClose, onSave }) {
  const T = useT();
  const S = adminSurface(T);
  const [seconds, setSeconds]             = useState(60);
  const [stability, setStability]         = useState(5);
  const [displayName, setDisplayName]     = useState('');
  const [notes, setNotes]                 = useState('');
  const [error, setError]                 = useState('');

  useEffect(() => {
    if (open && job) {
      setSeconds(job.intervalSeconds ?? 60);
      setStability(job.stabilityWindowSeconds ?? 5);
      setDisplayName(job.name && job.name !== job.defaultName ? job.name : '');
      setNotes(job.notes ?? '');
      setError('');
    }
  }, [open, job]);

  const handleSave = () => {
    const n = parseInt(seconds, 10);
    if (!Number.isFinite(n) || n <= 0)  { setError('Interval must be a positive integer'); return; }
    if (n > 86400) { setError('Interval over 24 hours — use a cron job instead'); return; }
    const sw = parseInt(stability, 10);
    if (!Number.isFinite(sw) || sw < 0) { setError('Stability window must be 0 or a positive integer'); return; }
    onSave(job.id, {
      intervalSeconds:        n,
      stabilityWindowSeconds: sw,
      displayName,
      notes,
    });
  };

  if (!job) return null;
  const meta = JOB_META[job.id] ?? { color: T.teal };

  const inputSx = {
    '& .MuiOutlinedInput-root': {
      bgcolor: T.inputBg, color: T.textPrimary,
      '& fieldset':             { borderColor: S.border },
      '&:hover fieldset':       { borderColor: meta.color },
      '&.Mui-focused fieldset': { borderColor: meta.color },
    },
    '& .MuiInputLabel-root': { color: T.textMuted },
    '& .MuiInputLabel-root.Mui-focused': { color: meta.color },
    '& .MuiFormHelperText-root': { color: T.error },
  };

  const human = (() => {
    const n = parseInt(seconds, 10);
    if (!Number.isFinite(n) || n <= 0) return '—';
    if (n < 60) return `Every ${n} seconds`;
    if (n % 60 === 0) {
      const m = n / 60;
      return m === 1 ? 'Every minute' : `Every ${m} minutes`;
    }
    return `Every ${n}s`;
  })();

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { bgcolor: S.card, border: `1px solid ${S.border}`, borderRadius: 2 } }}>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: T.text }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Autorenew sx={{ color: meta.color, fontSize: 20 }} />
          Edit — {JOB_META[job.id]?.label ?? job.id}
        </Box>
        <IconButton size="small" onClick={onClose} sx={{ color: T.textFaint }}>
          <CloseIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
        <Alert severity="info" sx={{ bgcolor: `${meta.color}14`, color: T.textMuted,
          border: `1px solid ${meta.color}33`, fontSize: 12,
          '& .MuiAlert-icon': { color: meta.color } }}>
          Fixed-delay job. Interval &amp; stability window read live from DB on each tick — no restart.
        </Alert>

        <Typography sx={{ fontSize: '0.7rem', color: T.textFaint, textTransform: 'uppercase',
          letterSpacing: '0.08em', fontWeight: 700 }}>Schedule</Typography>

        <TextField size="small" label="Interval (seconds)" type="number" value={seconds}
          onChange={e => { setSeconds(e.target.value); setError(''); }}
          inputProps={{ min: 1, max: 86400, step: 1 }}
          sx={inputSx} error={!!error && error.includes('Interval')} helperText={error.includes('Interval') ? error : human} autoFocus />
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          {[30, 60, 120, 300, 600, 1800].map(s => (
            <Chip key={s} label={`${s}s`} size="small" clickable
              onClick={() => { setSeconds(s); setError(''); }}
              sx={{
                bgcolor: parseInt(seconds, 10) === s ? `${meta.color}22` : S.inset,
                color:   parseInt(seconds, 10) === s ? meta.color : T.textMuted,
                border: `1px solid ${parseInt(seconds, 10) === s ? meta.color + '55' : S.border}`,
                fontSize: '0.7rem', height: 22,
                '&:hover': { bgcolor: `${meta.color}18` },
              }} />
          ))}
        </Box>

        {/* Stability window — only shown for MediaSync-style jobs that use it.
            The field on the job is null for jobs that don't, so we only show it
            when the job already has a value or when this is MediaSync. */}
        {(job.id === 'MediaSync' || job.stabilityWindowSeconds != null) && (
          <>
            <TextField size="small" label="Stability window (seconds)" type="number" value={stability}
              onChange={e => { setStability(e.target.value); setError(''); }}
              inputProps={{ min: 0, max: 600, step: 1 }}
              sx={inputSx}
              error={!!error && error.includes('Stability')}
              helperText={error.includes('Stability') ? error
                : 'Files modified within the last N seconds are skipped this tick (defends against half-written files)'} />
          </>
        )}

        <Divider sx={{ borderColor: S.divider }} />

        <Typography sx={{ fontSize: '0.7rem', color: T.textFaint, textTransform: 'uppercase',
          letterSpacing: '0.08em', fontWeight: 700 }}>Labels</Typography>

        <SettingsSection
          displayName={displayName} notes={notes}
          defaultName={job.defaultName ?? JOB_META[job.id]?.label ?? job.id}
          onDisplayName={setDisplayName} onNotes={setNotes}
          color={meta.color}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <Button onClick={onClose} sx={{ color: T.textMuted }}>Cancel</Button>
        <Button variant="contained" onClick={handleSave}
          sx={{ bgcolor: meta.color, '&:hover': { bgcolor: meta.color }, fontWeight: 600 }}>
          Save Changes
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Run outcome ───────────────────────────────────────────────────

/** camelCase counter key → readable label ("filesOnDisk" → "Files on disk"). */
function labelFor(key) {
  const spaced = String(key).replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * What a run actually did, as counter chips plus its note.
 *
 * Runs recorded before this existed carry no summary — those rows just show their message,
 * exactly as they always did.
 */
function RunSummary({ summary, message, failed }) {
  const T = useT();
  const S = adminSurface(T);
  const counters = summary?.counters ?? {};
  const entries  = Object.entries(counters);
  const note     = summary?.note;

  if (entries.length === 0 && !note && !message) return null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      {entries.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
          {entries.map(([k, v]) => {
            // A non-zero failure count is the one number worth colouring — it is the reason
            // someone opened this dialog.
            const bad = /fail/i.test(k) && Number(v) > 0;
            return (
              <Chip
                key={k}
                size="small"
                label={`${labelFor(k)} ${v}`}
                sx={{
                  height: 18, fontSize: '0.62rem', borderRadius: 0.75,
                  bgcolor: bad ? T.errorBg : S.inset,
                  color:   bad ? T.error   : T.textMuted,
                  '& .MuiChip-label': { px: 0.75 },
                }}
              />
            );
          })}
        </Box>
      )}
      {(note || message) && (
        <Typography sx={{
          fontSize: '0.7rem', fontStyle: 'italic',
          color: failed && message ? T.error : T.textFaint,
        }}>
          {message || note}
        </Typography>
      )}
    </Box>
  );
}

/** Whether the run came from its schedule or from someone pressing "Run now". */
function TriggerCell({ row }) {
  const T = useT();
  if (row.triggeredBy === 'MANUAL') {
    return (
      <Tooltip title={row.triggeredByUser ? `Run manually by ${row.triggeredByUser}` : 'Run manually'}>
        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.4, color: T.textMuted }}>
          <PersonRounded sx={{ fontSize: 12 }} />
          <Typography sx={{ fontSize: '0.68rem' }}>Manual</Typography>
        </Box>
      </Tooltip>
    );
  }
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.4, color: T.textFaint }}>
      <ScheduleRounded sx={{ fontSize: 12 }} />
      <Typography sx={{ fontSize: '0.68rem' }}>
        {row.triggeredBy === 'SCHEDULED' ? 'Scheduled' : '—'}
      </Typography>
    </Box>
  );
}

// ─── Per-job history modal ────────────────────────────────────────────────────
/**
 * Forwarded-ref wrapper so MUI's transitions can target the motion'd content.
 * Grow gives a scale-from-center + fade entrance that pairs naturally with the
 * "click button → modal pops up" interaction (vs Slide which feels drawery).
 */
const GrowTransition = React.forwardRef(function GrowTransition(props, ref) {
  return <Grow ref={ref} timeout={{ enter: 260, exit: 200 }} style={{ transformOrigin: 'center top' }} {...props} />;
});

function HistoryModal({ job, onClose }) {
  const T = useT();
  const S = adminSurface(T);
  const open = !!job;
  // One row open at a time — stacking several log panels in a capped-height dialog just
  // pushes the row you were reading off screen.
  const [expandedRun, setExpandedRun] = useState(null);
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['scheduler-job-history', job?.id],
    queryFn:  () => api.history(job.id, 100),
    enabled:  open,
    refetchInterval: open ? 5_000 : false,
  });

  useEffect(() => { setExpandedRun(null); }, [job?.id]);

  const meta = JOB_META[job?.id] ?? { color: T.teal };
  const fmt   = (iso) => iso ? new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
  const fmtMs = (ms)  => ms == null ? '—' : ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      TransitionComponent={GrowTransition}
      PaperProps={{
        sx: {
          bgcolor: S.card, color: T.text,
          border: `1px solid ${S.border}`,
          borderRadius: 2,
          // Cap height so a long history is internally scrollable rather than
          // pushing the dialog off-screen.
          maxHeight: { xs: '92vh', sm: '85vh' },
          boxShadow: '0 24px 60px rgba(0,0,0,0.45)',
          m: { xs: 1, sm: 2 },
        },
      }}
      slotProps={{
        backdrop: {
          sx: {
            backgroundColor: 'rgba(0,0,0,0.55)',
          },
        },
      }}
    >
      {!!job && (
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 240 }}>
          {/* Header */}
          <Box sx={{
            p: 2,
            borderBottom: `1px solid ${S.divider}`,
            display: 'flex', alignItems: 'center', gap: 1.5,
            // Faint accent stripe at top to echo the job color.
            position: 'relative',
            '&::before': {
              content: '""',
              position: 'absolute', left: 0, right: 0, top: 0, height: 2,
              bgcolor: meta.color,
            },
          }}>
            <History sx={{ color: meta.color, fontSize: 22 }} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: T.text }}>
                {meta.label ?? job.id} — History
              </Typography>
              <Typography sx={{ fontSize: '0.7rem', color: T.textFaint }}>
                Last {rows.length} runs · auto-refreshes every 5s
              </Typography>
            </Box>
            <IconButton size="small" onClick={onClose} sx={{ color: T.textFaint }}>
              <CloseIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Box>

          {/* Body */}
          <Box sx={{ flex: 1, overflowY: 'auto' }}>
            {isLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress size={20} sx={{ color: meta.color }} />
              </Box>
            ) : rows.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 6, px: 2 }}>
                <History sx={{ fontSize: 36, color: T.textFaint, mb: 1 }} />
                <Typography sx={{ color: T.textMuted, fontSize: '0.82rem' }}>
                  No runs recorded for this job yet
                </Typography>
              </Box>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow sx={{
                    '& th': {
                      bgcolor: S.inset, color: T.textFaint,
                      fontSize: '0.66rem', fontWeight: 700,
                      textTransform: 'uppercase', letterSpacing: '0.08em',
                      borderColor: S.divider, py: 1.25,
                      position: 'sticky', top: 0, zIndex: 1,
                    },
                  }}>
                    <TableCell>Started</TableCell>
                    {/* Five columns do not fit a phone-width dialog. Duration and
                        trigger fold away there and reappear on the summary line
                        below the row, so nothing is actually lost. */}
                    <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Duration</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Trigger</TableCell>
                    <TableCell sx={{ width: 36 }} />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((row, i) => {
                    const key      = row.id ?? `${row.startedAt}-${i}`;
                    const expanded = expandedRun === key;
                    const hasLogs  = !!row.runId;
                    return (
                    <React.Fragment key={key}>
                      <TableRow
                        onClick={hasLogs ? () => setExpandedRun(expanded ? null : key) : undefined}
                        sx={{
                          '& td': {
                            color: T.textMuted, fontSize: '0.78rem',
                            borderColor: expanded ? 'transparent' : S.divider,
                          },
                          '&:hover': { bgcolor: S.cardHover },
                          cursor: hasLogs ? 'pointer' : 'default',
                        }}
                      >
                        <TableCell sx={{ whiteSpace: 'nowrap', fontSize: '0.72rem !important' }}>
                          {fmt(row.startedAt)}
                        </TableCell>
                        <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Timer sx={{ fontSize: 12, color: T.textFaint }} />
                            <Typography sx={{ fontSize: '0.74rem', color: T.textMuted }}>
                              {fmtMs(row.durationMs)}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          {row.status === 'SUCCESS' ? (
                            <Chip label="Success" size="small" icon={<CheckCircle sx={{ fontSize: 11 }} />}
                              sx={{ bgcolor: T.successBg, color: T.success, height: 18, fontSize: '0.62rem',
                                '& .MuiChip-icon': { color: T.success, ml: 0.5 } }} />
                          ) : row.status === 'FAILED' ? (
                            <Chip label="Failed" size="small" icon={<ErrorIcon sx={{ fontSize: 11 }} />}
                              sx={{ bgcolor: T.errorBg, color: T.error, height: 18, fontSize: '0.62rem',
                                '& .MuiChip-icon': { color: T.error, ml: 0.5 } }} />
                          ) : (
                            <Chip label={row.status ?? '—'} size="small"
                              sx={{ bgcolor: S.inset, color: T.textMuted, height: 18, fontSize: '0.62rem' }} />
                          )}
                        </TableCell>
                        <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                          <TriggerCell row={row} />
                        </TableCell>
                        <TableCell sx={{ pr: 1 }}>
                          {hasLogs && (
                            <Tooltip title={expanded ? 'Hide logs' : 'Show this run\u2019s logs'}>
                              <ExpandMoreRounded sx={{
                                fontSize: 16, color: T.textFaint, display: 'block',
                                transition: 'transform 160ms ease',
                                transform: expanded ? 'rotate(180deg)' : 'none',
                              }} />
                            </Tooltip>
                          )}
                        </TableCell>
                      </TableRow>

                      {/* What the run actually did — the counters the job reported. */}
                      {(row.summary || row.message) && (
                        <TableRow sx={{ '& td': { borderColor: expanded ? 'transparent' : S.divider, py: 0.5, pl: 3 } }}>
                          <TableCell colSpan={5}>
                            <Box sx={{ display: { xs: 'flex', sm: 'none' }, gap: 1, mb: 0.5 }}>
                              <Typography sx={{ fontSize: '0.68rem', color: T.textFaint }}>
                                {fmtMs(row.durationMs)}
                              </Typography>
                              <TriggerCell row={row} />
                            </Box>
                            <RunSummary summary={row.summary} message={row.message} failed={row.status === 'FAILED'} />
                          </TableCell>
                        </TableRow>
                      )}

                      {expanded && (
                        <TableRow sx={{ '& td': { borderColor: S.divider, py: 1, px: 2 } }}>
                          <TableCell colSpan={5}>
                            <RunLogPanel runId={row.runId} startedAt={row.startedAt} />
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </Box>
        </Box>
      )}
    </Dialog>
  );
}


// ─── Main Panel ───────────────────────────────────────────────────────────────
export default function SchedulerPanel() {
  const qc = useQueryClient();

  // ── Data ────────────────────────────────────────────────────────────────────
  const { data: jobs = [], isLoading: jobsLoading } = useQuery({
    queryKey: ['scheduler-jobs'],
    queryFn:  api.jobs,
    // Adaptive: a flat 15s meant pressing "Run now" could sit there for fifteen
    // seconds before the card admitted anything was happening, and a job that
    // finished in two seconds could start and end entirely between two polls. While
    // anything is RUNNING we watch closely; the rest of the time this page is a
    // near-static list and does not deserve the traffic.
    refetchInterval: (query) => {
      const rows = query.state.data ?? [];
      return rows.some((j) => j.status === 'RUNNING') ? 2_000 : 15_000;
    },
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

  // ── Dialogs / drawers ────────────────────────────────────────────────────
  const [editJob,    setEditJob]    = useState(null);
  const [historyJob, setHistoryJob] = useState(null);

  // ── Triggering ───────────────────────────────────────────────────────────
  const [triggeringId, setTriggeringId] = useState(null);

  const triggerMutation = useMutation({
    mutationFn: (job) => api.trigger(job.id),
    onMutate:   (job) => setTriggeringId(job.id),
    onSuccess:  (_, job) => {
      notify.success(`${JOB_META[job.id]?.label ?? job.id} triggered`);
      // Refetch straight away so the server's own RUNNING status takes over as soon
      // as it exists; the optimistic flag below only has to bridge that gap. Once the
      // list reports RUNNING the adaptive interval keeps it fresh, so the second
      // refresh no longer has to guess a duration.
      qc.invalidateQueries({ queryKey: ['scheduler-jobs'] });
      qc.invalidateQueries({ queryKey: ['scheduler-job-history', job.id] });
      setTimeout(() => setTriggeringId(null), 1500);
    },
    onError: (_, job) => {
      setTriggeringId(null);
      notify.error(`Failed to trigger ${JOB_META[job.id]?.label ?? job.id}`);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (job) => api.toggle(job.id),
    onSuccess:  (_, job) => {
      notify.info(`${JOB_META[job.id]?.label ?? job.id} toggled`);
      qc.invalidateQueries({ queryKey: ['scheduler-jobs'] });
    },
    onError: () => notify.error('Toggle failed'),
  });

  /**
   * Composite save: writes any of (cron|interval) + (displayName/notes/stability)
   * in parallel. The backend has separate endpoints because cron/interval
   * trigger re-scheduling and the settings endpoint doesn't, but the UI
   * presents one Save action.
   */
  const saveMutation = useMutation({
    mutationFn: async ({ jobId, body }) => {
      const tasks = [];
      if (body.cronExpression !== undefined) {
        tasks.push(api.updateCron(jobId, {
          cronExpression: body.cronExpression,
          timezone:       body.timezone,
        }));
      }
      if (body.intervalSeconds !== undefined) {
        tasks.push(api.updateInterval(jobId, { intervalSeconds: body.intervalSeconds }));
      }
      const settings = {};
      if (body.displayName            !== undefined) settings.displayName            = body.displayName;
      if (body.notes                  !== undefined) settings.notes                  = body.notes;
      if (body.stabilityWindowSeconds !== undefined) settings.stabilityWindowSeconds = body.stabilityWindowSeconds;
      if (body.recheckIntervalHours   !== undefined) settings.recheckIntervalHours   = body.recheckIntervalHours;
      if (Object.keys(settings).length > 0) {
        tasks.push(api.updateSettings(jobId, settings));
      }
      return Promise.all(tasks);
    },
    onSuccess: () => {
      notify.success('Saved — changes take effect on next tick');
      setEditJob(null);
      qc.invalidateQueries({ queryKey: ['scheduler-jobs'] });
    },
    onError: () => notify.error('Save failed'),
  });

  const reorderMutation = useMutation({
    mutationFn: (orders) => api.reorder(orders),
    onSuccess:  () => {
      notify.success('Order saved', { duration: 1500 });
      setOrderDirty(false);
      qc.invalidateQueries({ queryKey: ['scheduler-jobs'] });
    },
    onError: () => notify.error('Failed to save order'),
  });

  const handleSaveOrder = () => {
    reorderMutation.mutate(orderedJobs.map((j, i) => ({ id: j.id, order: i })));
  };

  const isLoading = jobsLoading;

  return (
    <AdminPage
      title="Scheduler"
      subtitle="Background jobs · drag to reorder · history button opens per-job log"
      icon={ScheduleRounded}
      onRefresh={() => qc.invalidateQueries({ queryKey: ['scheduler-jobs'] })}
      refreshing={isLoading}
      actions={orderDirty && (
        <AdminActionButton
          icon={SaveRounded}
          variant="primary"
          onClick={handleSaveOrder}
          loading={reorderMutation.isPending}
        >
          Save Order
        </AdminActionButton>
      )}
    >
      {/* ── Draggable Job Cards ── */}
      <SectionCard title="Scheduled Jobs" flushMobile>
        {orderedJobs.length === 0 && !jobsLoading && (
          <EmptyState icon={Schedule} title="No scheduler jobs registered" />
        )}

        <Reorder.Group axis="y" values={orderedJobs} onReorder={handleReorder}
          style={{ padding: 0, margin: 0 }}>
          <AnimatePresence>
            {orderedJobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                triggering={triggeringId === job.id}
                onTrigger={(j) => triggerMutation.mutate(j)}
                onToggle={(j) => toggleMutation.mutate(j)}
                onEdit={(j) => setEditJob(j)}
                onShowHistory={(j) => setHistoryJob(j)}
              />
            ))}
          </AnimatePresence>
        </Reorder.Group>
      </SectionCard>

      {/* ── Edit dialog — branches on jobType, single save mutation ── */}
      <EditCronDialog
        open={!!editJob && editJob?.jobType !== 'FIXED_DELAY'}
        job={editJob?.jobType !== 'FIXED_DELAY' ? editJob : null}
        onClose={() => setEditJob(null)}
        onSave={(jobId, body) => saveMutation.mutate({ jobId, body })}
      />
      <EditIntervalDialog
        open={!!editJob && editJob?.jobType === 'FIXED_DELAY'}
        job={editJob?.jobType === 'FIXED_DELAY' ? editJob : null}
        onClose={() => setEditJob(null)}
        onSave={(jobId, body) => saveMutation.mutate({ jobId, body })}
      />

      {/* ── Per-job History Modal ── */}
      <HistoryModal
        job={historyJob}
        onClose={() => setHistoryJob(null)}
      />
    </AdminPage>
  );
}
