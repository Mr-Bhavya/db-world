import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Box,
  Typography,
  Button,
  Chip,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  CircularProgress,
  Tooltip,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  ToggleButton,
  ToggleButtonGroup,
  Divider,
  MenuItem,
  Stack,
  Grow,
  Paper,
  useMediaQuery,
  useTheme,
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
import { completionMessage, describeSchedule } from './schedulerUtils';
import SheetDialog from '@shared/components/SheetDialog';

// ─── API ──────────────────────────────────────────────────────────────────────
const api = {
  jobs:    ()               => axiosInstance.get('/api/admin/scheduler/jobs').then(r => r.data?.data ?? []),
  history: (jobName, limit = 50) => axiosInstance
        .get('/api/admin/scheduler/history', { params: { limit, jobName } })
        .then(r => r.data?.data ?? []),
  trigger: (jobId)              => axiosInstance.post(`/api/admin/scheduler/trigger/${jobId}`),
  cancel:  (jobId)              => axiosInstance.post(`/api/admin/scheduler/cancel/${jobId}`),
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
    <SheetDialog open={open} onClose={onClose} maxWidth="sm" fullWidth
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
    </SheetDialog>
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
    <SheetDialog open={open} onClose={onClose} maxWidth="sm" fullWidth
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
    </SheetDialog>
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

/**
 * Whether the run came from its schedule or from someone pressing "Run now".
 *
 * <p>`showUser` writes the name inline instead of hiding it behind a tooltip. Cards use it:
 * there is room, and a tooltip is a hover, which a phone does not have.
 */
function TriggerCell({ row, showUser = false }) {
  const T = useT();
  if (row.triggeredBy === 'MANUAL') {
    const who = row.triggeredByUser;
    const body = (
      <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.4, color: T.textMuted, minWidth: 0 }}>
        <PersonRounded sx={{ fontSize: 12, flexShrink: 0 }} />
        <Typography noWrap sx={{ fontSize: '0.68rem' }}>
          {showUser && who ? `Manual · ${who}` : 'Manual'}
        </Typography>
      </Box>
    );
    if (showUser) return body;
    return (
      <Tooltip title={who ? `Run manually by ${who}` : 'Run manually'}>
        {body}
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

/** A run's outcome as a chip. Shared by the table and the cards so they cannot drift. */
function StatusChip({ status }) {
  const T = useT();
  const S = adminSurface(T);
  const base = { height: 18, fontSize: '0.62rem', flexShrink: 0 };
  if (status === 'SUCCESS') {
    return (
      <Chip label="Success" size="small" icon={<CheckCircle sx={{ fontSize: 11 }} />}
        sx={{ ...base, bgcolor: T.successBg, color: T.success, '& .MuiChip-icon': { color: T.success, ml: 0.5 } }} />
    );
  }
  if (status === 'FAILED') {
    return (
      <Chip label="Failed" size="small" icon={<ErrorIcon sx={{ fontSize: 11 }} />}
        sx={{ ...base, bgcolor: T.errorBg, color: T.error, '& .MuiChip-icon': { color: T.error, ml: 0.5 } }} />
    );
  }
  return <Chip label={status ?? '—'} size="small" sx={{ ...base, bgcolor: S.inset, color: T.textMuted }} />;
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

/**
 * The header's own height, in px, named because the sticky table head has to clear it.
 *
 * Both the header and the `th` row pin themselves to the top of the dialog's scroll area, so
 * without this the columns would slide under the title. A constant is honest here: the header
 * is two lines of type at fixed sizes, and `minHeight` below makes the number true rather than
 * approximately true.
 */
const HEADER_H = 76;

/** "17 Sept 2026, 6:42 pm" — when a run started. */
const fmtStarted = (iso) => (iso ? new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—');

/** "840 ms" / "1.4 s" — plenty of these runs are sub-second, and "0.0 s" would hide that. */
const fmtRunMs = (ms) => (ms == null ? '—' : ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`);

/** Which run is expanded, keyed by id where the row has one. Shared so the table and the cards
 *  agree on the identity of a row — they read the same `expandedRun`. */
const runKey = (row, i) => row.id ?? `${row.startedAt}-${i}`;

/**
 * One run, as a card. The phone layout.
 *
 * <p>A five-column table does not survive a phone-width sheet, and the way it used to cope was
 * quietly lossy: duration and trigger folded away below `sm` and were meant to reappear on the
 * summary line underneath, but that line only renders when the run reported a summary or a
 * message. A run that reported neither showed no duration and no trigger at all. A card has
 * room for every field, so the layout and the bug have the same fix.
 */
function RunCard({ row, expanded, onToggle }) {
  const T = useT();
  const S = adminSurface(T);
  const hasLogs = !!row.runId;

  return (
    <Paper
      variant="outlined"
      sx={{ borderRadius: 2.5, borderColor: S.border, bgcolor: S.card, overflow: 'hidden' }}
    >
      <Box sx={{ p: 1.25 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <StatusChip status={row.status} />
          <Box sx={{ flex: 1 }} />
          <Typography noWrap sx={{ fontSize: '0.68rem', color: T.textFaint }}>
            {fmtStarted(row.startedAt)}
          </Typography>
        </Stack>

        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.75, flexWrap: 'wrap' }} useFlexGap>
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.4, color: T.textMuted }}>
            <Timer sx={{ fontSize: 12, color: T.textFaint }} />
            <Typography sx={{ fontSize: '0.68rem' }}>{fmtRunMs(row.durationMs)}</Typography>
          </Box>
          <Typography sx={{ fontSize: '0.68rem', color: T.textFaint }}>·</Typography>
          <TriggerCell row={row} showUser />
        </Stack>

        {(row.summary || row.message) && (
          <Box sx={{ mt: 0.75 }}>
            <RunSummary summary={row.summary} message={row.message} failed={row.status === 'FAILED'} />
          </Box>
        )}
      </Box>

      {hasLogs && (
        <>
          {/* A labelled, full-width control rather than a chevron: it says what it does without
              a hover, and it is a thumb-sized target instead of a 16px glyph. */}
          <Button
            fullWidth
            onClick={onToggle}
            aria-expanded={expanded}
            endIcon={<ExpandMoreRounded sx={{
              fontSize: 16, transition: 'transform 160ms ease',
              transform: expanded ? 'rotate(180deg)' : 'none',
            }} />}
            sx={{
              justifyContent: 'center', textTransform: 'none',
              fontSize: '0.7rem', fontWeight: 700, color: T.textMuted,
              borderTop: `1px solid ${S.divider}`, borderRadius: 0, py: 0.75,
            }}
          >
            {expanded ? 'Hide logs' : 'Show logs'}
          </Button>
          {expanded && (
            <Box sx={{ px: 1, pb: 1 }}>
              <RunLogPanel runId={row.runId} startedAt={row.startedAt} />
            </Box>
          )}
        </>
      )}
    </Paper>
  );
}

function HistoryModal({ job, onClose }) {
  const T = useT();
  const S = adminSurface(T);
  const theme = useTheme();
  const isPhone = useMediaQuery(theme.breakpoints.down('sm'));
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

  return (
    <SheetDialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      /*
       * Grow on a pointer device only. SheetDialog spreads the caller's props last, so naming
       * TransitionComponent unconditionally beats its own SlideUp — and the result was a dialog
       * anchored to the bottom edge of a phone that popped out of the middle of the screen.
       * The key has to be absent rather than undefined; spreading `undefined` still wins.
       */
      {...(isPhone ? {} : { TransitionComponent: GrowTransition })}
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
          {/*
            Header. Pinned, because the dialog's paper is the scroll area — on a phone the sheet
            is tall and a hundred runs scroll a long way, and the ✕ used to leave with the title.
            An opaque background is load-bearing: the rows scroll behind this.
          */}
          <Box sx={{
            p: 2,
            minHeight: HEADER_H, boxSizing: 'border-box',
            bgcolor: S.card,
            borderBottom: `1px solid ${S.divider}`,
            display: 'flex', alignItems: 'center', gap: 1.5,
            position: 'sticky', top: 0, zIndex: 2,
            // Faint accent stripe at top to echo the job color.
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

          {/*
            Body. Deliberately NOT a scroll region of its own: the paper already is one, and the
            `flex: 1, overflow: auto` that used to live here never worked anyway -- nothing in
            the chain constrained its height. What it did achieve was a third nested scroller
            (paper -> body -> log panel), so a swipe on a phone moved whichever one the browser
            picked. One scroll region, one pinned header.
          */}
          <Box>
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
            ) : isPhone ? (
              <Stack spacing={1} sx={{ p: 1.25 }}>
                {rows.map((row, i) => {
                  const key = runKey(row, i);
                  return (
                    <RunCard
                      key={key}
                      row={row}
                      expanded={expandedRun === key}
                      onToggle={() => setExpandedRun(expandedRun === key ? null : key)}
                    />
                  );
                })}
              </Stack>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow sx={{
                    '& th': {
                      bgcolor: S.inset, color: T.textFaint,
                      fontSize: '0.66rem', fontWeight: 700,
                      textTransform: 'uppercase', letterSpacing: '0.08em',
                      borderColor: S.divider, py: 1.25,
                      // Clears the pinned header rather than sliding under it.
                      position: 'sticky', top: HEADER_H, zIndex: 1,
                    },
                  }}>
                    <TableCell>Started</TableCell>
                    <TableCell>Duration</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Trigger</TableCell>
                    <TableCell sx={{ width: 44 }} />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((row, i) => {
                    const key      = runKey(row, i);
                    const expanded = expandedRun === key;
                    const hasLogs  = !!row.runId;
                    const toggle   = () => setExpandedRun(expanded ? null : key);
                    return (
                    <React.Fragment key={key}>
                      <TableRow
                        onClick={hasLogs ? toggle : undefined}
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
                          {fmtStarted(row.startedAt)}
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Timer sx={{ fontSize: 12, color: T.textFaint }} />
                            <Typography sx={{ fontSize: '0.74rem', color: T.textMuted }}>
                              {fmtRunMs(row.durationMs)}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <StatusChip status={row.status} />
                        </TableCell>
                        <TableCell>
                          <TriggerCell row={row} />
                        </TableCell>
                        <TableCell sx={{ pr: 1 }}>
                          {hasLogs && (
                            <Tooltip title={expanded ? 'Hide logs' : 'Show this run’s logs'}>
                              {/* A real button, for a name in the accessibility tree and a
                                  target bigger than a 16px glyph. The click has to stop here:
                                  letting it reach the row toggles a second time, which is a
                                  no-op that looks like a dead control. */}
                              <IconButton
                                size="small"
                                aria-label={expanded ? 'Hide logs' : 'Show logs'}
                                aria-expanded={expanded}
                                onClick={(e) => { e.stopPropagation(); toggle(); }}
                                sx={{ color: T.textFaint }}
                              >
                                <ExpandMoreRounded sx={{
                                  fontSize: 16,
                                  transition: 'transform 160ms ease',
                                  transform: expanded ? 'rotate(180deg)' : 'none',
                                }} />
                              </IconButton>
                            </Tooltip>
                          )}
                        </TableCell>
                      </TableRow>

                      {/* What the run actually did - the counters the job reported. */}
                      {(row.summary || row.message) && (
                        <TableRow sx={{ '& td': { borderColor: expanded ? 'transparent' : S.divider, py: 0.5, pl: 3 } }}>
                          <TableCell colSpan={5}>
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
    </SheetDialog>
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
    onMutate:   (job) => { setTriggeringId(job.id); watchedRuns.current.add(job.id); },
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

  const [cancellingId, setCancellingId] = useState(null);

  const cancelMutation = useMutation({
    mutationFn: (job) => api.cancel(job.id),
    onMutate:   (job) => setCancellingId(job.id),
    onSuccess:  (_, job) => {
      notify.info(`Stopping ${JOB_META[job.id]?.label ?? job.id}…`);
      qc.invalidateQueries({ queryKey: ['scheduler-jobs'] });
    },
    onError: (e, job) => {
      setCancellingId(null);
      // 409 means it finished between the click and the request landing, which is a
      // perfectly normal race and not worth an error toast.
      notify[e?.response?.status === 409 ? 'info' : 'error'](
        e?.response?.status === 409
          ? `${JOB_META[job.id]?.label ?? job.id} had already finished`
          : 'Failed to cancel the job',
      );
    },
    onSettled: () => setTimeout(() => setCancellingId(null), 1500),
  });

  /**
   * Tells you how a run YOU started ended.
   *
   * A manual run can take minutes; the "triggered" toast is long gone by then, and
   * without this the outcome only exists if you happen to still be looking at that
   * card. Watches for jobs you triggered going RUNNING -> not, and reports what the
   * card would have shown.
   */
  const watchedRuns = useRef(new Set());
  const prevRunning = useRef(new Set());
  useEffect(() => {
    const running = new Set(jobs.filter((j) => j.status === 'RUNNING').map((j) => j.id));
    for (const id of prevRunning.current) {
      if (running.has(id) || !watchedRuns.current.has(id)) continue;
      watchedRuns.current.delete(id);
      const job = jobs.find((j) => j.id === id);
      if (!job) continue;
      const { severity, text } = completionMessage({
        ...job,
        name: JOB_META[job.id]?.label ?? job.name ?? job.id,
      });
      notify[severity](text);
    }
    prevRunning.current = running;
  }, [jobs]);

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
                cancelling={cancellingId === job.id}
                onTrigger={(j) => triggerMutation.mutate(j)}
                onCancel={(j) => cancelMutation.mutate(j)}
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
