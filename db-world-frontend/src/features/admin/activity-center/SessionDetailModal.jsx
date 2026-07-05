import React from 'react';
import {
  Box, Typography, Dialog, DialogContent, IconButton, Chip, Stack, Skeleton,
  useMediaQuery, useTheme as useMuiTheme, alpha,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DevicesIcon from '@mui/icons-material/Devices';
import TimelineIcon from '@mui/icons-material/Timeline';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import ReplayIcon from '@mui/icons-material/Replay';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import StopCircleIcon from '@mui/icons-material/StopCircle';
import SearchIcon from '@mui/icons-material/Search';
import FastForwardIcon from '@mui/icons-material/FastForward';
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat';
import { useQuery } from '@tanstack/react-query';
import { useT } from '@shared/theme/ThemeContext';
import { fetchSessionEvents } from './activityApi';

// ─── formatting helpers (mirrors SessionsTab's — kept local per-tab convention) ─

function fmtBytes(b) {
  if (b == null) return '—';
  if (b === 0) return '0 B';
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(0)} KB`;
  if (b < 1024 ** 3) return `${(b / 1024 ** 2).toFixed(1)} MB`;
  return `${(b / 1024 ** 3).toFixed(2)} GB`;
}

function fmtSpeed(bps) {
  if (!bps) return '—';
  return `${(Number(bps) / 8 / 1_000_000).toFixed(1)} MB/s`;
}

function fmtPct(p) {
  if (p == null) return null;
  return Math.max(0, Math.min(100, Number(p)));
}

function fmtDateTime(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString([], {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function fmtTime(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function fmtPositionMs(ms) {
  if (ms == null) return null;
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

// Formats a millisecond duration as H:MM:SS (once past an hour) or M:SS —
// used for the watch-time tile (watchPositionMs / watchDurationMs).
function fmtDuration(ms) {
  if (ms == null) return '—';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

// ─── chip color maps (mirror SessionsTab) ─────────────────────────────────────

const ACTIVITY_COLOR = { DOWNLOAD: '#0d9488', STREAM: '#3b82f6', SEARCH: '#f59e0b' };

const STATE_COLOR = {
  RESOLVING: '#8b5cf6',
  ACTIVE: '#10b981',
  PAUSED: '#f59e0b',
  COMPLETED: '#0d9488',
  FAILED: '#ef4444',
  ABORTED: '#6b7280',
};

const chipSx = { height: 20, fontSize: '0.68rem', fontWeight: 600 };

function ActivityChip({ activity }) {
  if (!activity) return null;
  const color = ACTIVITY_COLOR[activity] ?? '#6b7280';
  return (
    <Chip label={activity} size="small"
      sx={{ ...chipSx, color, bgcolor: alpha(color, 0.14), border: `1px solid ${alpha(color, 0.35)}` }} />
  );
}

function StateChip({ state }) {
  if (!state) return null;
  const color = STATE_COLOR[state] ?? '#6b7280';
  return (
    <Chip label={state} size="small"
      sx={{ ...chipSx, color, bgcolor: alpha(color, 0.14), border: `1px solid ${alpha(color, 0.35)}` }} />
  );
}

function titleOf(session) {
  if (!session) return '';
  if (!session.recordName) return session.fileName || 'Untitled session';
  const ep = session.seasonNumber != null && session.episodeNumber != null
    ? ` S${String(session.seasonNumber).padStart(2, '0')}E${String(session.episodeNumber).padStart(2, '0')}`
    : '';
  return `${session.recordName}${ep}`;
}

// ─── summary metric grid ──────────────────────────────────────────────────────

function MetricCell({ label, value, valueColor }) {
  const T = useT();
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography sx={{ fontSize: 10, color: T.textFaint, textTransform: 'uppercase', letterSpacing: 0.5, mb: 0.3, fontWeight: 700 }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: 13, color: valueColor ?? T.text, fontWeight: 600, wordBreak: 'break-word' }}>
        {value ?? '—'}
      </Typography>
    </Box>
  );
}

function SummaryGrid({ session }) {
  const T = useT();
  const wasted = (session.uniqueBytes != null && session.nginxTransferredBytes != null)
    ? Math.max(0, session.nginxTransferredBytes - session.uniqueBytes)
    : null;
  const pct = fmtPct(session.completionPercent);
  const watchedPct = fmtPct(session.watchedPercent);
  const isStream = session.activity === 'STREAM' && session.watchDurationMs > 0;

  const metrics = [
    ['State', session.state ? <StateChip key="s" state={session.state} /> : '—'],
    ['Activity', session.activity ? <ActivityChip key="a" activity={session.activity} /> : '—'],
    ['Channel', session.channel],
    ['Client app', session.clientApp],
    ...(isStream ? [
      ['Watched %', watchedPct != null ? `${watchedPct.toFixed(1)}%` : '—'],
      ['Watch time', `${fmtDuration(session.watchPositionMs)} / ${fmtDuration(session.watchDurationMs)}`],
    ] : []),
    ['Completion', pct != null ? `${pct.toFixed(1)}%` : '—'],
    ['Unique bytes', fmtBytes(session.uniqueBytes)],
    ...(session.nginxTransferredBytes != null ? [['Transferred (nginx)', fmtBytes(session.nginxTransferredBytes)]] : []),
    ...(wasted != null ? [['Wasted (re-transfer)', fmtBytes(wasted)]] : []),
    ['File size', fmtBytes(session.fileSize)],
    ['Peak connections', session.peakConnections ?? '—'],
    ['Avg speed', fmtSpeed(session.avgSpeedBps)],
    ['Max speed', fmtSpeed(session.maxSpeedBps)],
    ...(session.attemptCount != null ? [['Attempts', session.attemptCount]] : []),
    ...(session.pauseCount != null ? [['Pauses', session.pauseCount]] : []),
    ...(session.resumeCount != null ? [['Resumes', session.resumeCount]] : []),
    ...(session.failCount != null ? [['Failures', session.failCount]] : []),
    ['Started', fmtDateTime(session.startedAt)],
    ['Last activity', fmtDateTime(session.lastEventAt)],
    ['Completed', fmtDateTime(session.completedAt)],
  ];

  return (
    <Box sx={{ px: { xs: 2, sm: 3 }, py: 2 }}>
      <Box sx={{
        display: 'grid', gap: 2,
        gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, 1fr)', md: 'repeat(4, 1fr)' },
      }}>
        {metrics.map(([label, value]) => <MetricCell key={label} label={label} value={value} />)}
      </Box>

      {(session.lastErrorCode || session.lastErrorMessage) && (
        <Box sx={{
          mt: 2, p: 1.25, borderRadius: 1.5,
          bgcolor: alpha('#ef4444', 0.08), border: `1px solid ${alpha('#ef4444', 0.3)}`,
        }}>
          <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#ef4444', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Last error{session.lastErrorCode ? ` · ${session.lastErrorCode}` : ''}
          </Typography>
          <Typography sx={{ fontSize: 12.5, color: T.text, mt: 0.25, wordBreak: 'break-word' }}>
            {session.lastErrorMessage || '—'}
          </Typography>
        </Box>
      )}
    </Box>
  );
}

// ─── event timeline ────────────────────────────────────────────────────────────

const EVENT_META = {
  RESOLVE: { icon: SearchIcon, color: '#8b5cf6' },
  START: { icon: PlayArrowIcon, color: '#3b82f6' },
  PROGRESS: { icon: TrendingFlatIcon, color: '#0d9488' },
  PAUSE: { icon: PauseIcon, color: '#f59e0b' },
  RESUME: { icon: PlayArrowIcon, color: '#3b82f6' },
  RETRY: { icon: ReplayIcon, color: '#f59e0b' },
  FAIL: { icon: ErrorIcon, color: '#ef4444' },
  COMPLETE: { icon: CheckCircleIcon, color: '#10b981' },
  ABORT: { icon: StopCircleIcon, color: '#6b7280' },
  SEEK: { icon: FastForwardIcon, color: '#3b82f6' },
};

function eventMeta(eventType) {
  if (EVENT_META[eventType]) return EVENT_META[eventType];
  if (eventType?.startsWith('STREAM_')) return { icon: TimelineIcon, color: '#3b82f6' };
  return { icon: TimelineIcon, color: '#6b7280' };
}

function eventDetail(evt) {
  const parts = [];
  if (evt.bytesDelta != null) parts.push(`+${fmtBytes(evt.bytesDelta)}`);
  if (evt.cumulativeBytes != null) parts.push(`${fmtBytes(evt.cumulativeBytes)} total`);
  if (evt.speedBps != null) parts.push(fmtSpeed(evt.speedBps));
  if (evt.connections != null) parts.push(`${evt.connections} conn`);
  if (evt.positionMs != null) parts.push(`pos ${fmtPositionMs(evt.positionMs)}`);
  const pct = fmtPct(evt.completionPercent);
  if (pct != null) parts.push(`${pct.toFixed(1)}%`);
  if (evt.source) parts.push(evt.source);
  return parts.join(' · ');
}

function EventRow({ event, isLast }) {
  const T = useT();
  const { icon: Icon, color } = eventMeta(event.eventType);
  const isFail = event.eventType === 'FAIL';
  const isComplete = event.eventType === 'COMPLETE';
  const detail = eventDetail(event);

  return (
    <Stack direction="row" spacing={1.5} sx={{ position: 'relative' }}>
      {/* left rail */}
      <Stack alignItems="center" sx={{ flexShrink: 0, width: 28 }}>
        <Box sx={{
          width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          bgcolor: alpha(color, 0.16), border: `1px solid ${alpha(color, 0.4)}`, flexShrink: 0, zIndex: 1,
        }}>
          <Icon sx={{ fontSize: 14, color }} />
        </Box>
        {!isLast && <Box sx={{ flex: 1, width: '2px', bgcolor: alpha(T.border, 0.8), minHeight: 20 }} />}
      </Stack>

      <Box sx={{ pb: isLast ? 0 : 1.75, minWidth: 0, flex: 1 }}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <Typography sx={{
            fontSize: 12.5, fontWeight: 700,
            color: isFail ? '#ef4444' : isComplete ? '#10b981' : T.text,
          }}>
            {event.eventType}
          </Typography>
          <Typography sx={{ fontSize: 11, color: T.textFaint }}>{fmtTime(event.eventTime)}</Typography>
        </Stack>
        {detail && (
          <Typography sx={{ fontSize: 11.5, color: T.textMuted, mt: 0.15, wordBreak: 'break-word' }}>
            {detail}
          </Typography>
        )}
        {(event.errorCode || event.errorMessage) && (
          <Typography sx={{ fontSize: 11.5, color: '#ef4444', mt: 0.25, wordBreak: 'break-word' }}>
            {event.errorCode ? `${event.errorCode}: ` : ''}{event.errorMessage}
          </Typography>
        )}
      </Box>
    </Stack>
  );
}

function TimelineSkeleton() {
  return (
    <Stack spacing={2} sx={{ px: { xs: 2, sm: 3 }, py: 2 }}>
      {[...Array(5)].map((_, i) => (
        <Stack key={i} direction="row" spacing={1.5} alignItems="center">
          <Skeleton variant="circular" width={24} height={24} />
          <Box sx={{ flex: 1 }}>
            <Skeleton width="30%" height={16} />
            <Skeleton width="55%" height={14} />
          </Box>
        </Stack>
      ))}
    </Stack>
  );
}

function EventTimeline({ sessionId, open }) {
  const T = useT();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['sessionEvents', sessionId],
    queryFn: () => fetchSessionEvents(sessionId),
    enabled: open && !!sessionId,
  });

  const events = data ?? [];

  return (
    <Box sx={{ px: { xs: 2, sm: 3 }, py: 2, borderTop: `1px solid ${T.border}` }}>
      <Stack direction="row" spacing={1} alignItems="center" mb={1.5}>
        <TimelineIcon sx={{ fontSize: 18, color: T.textFaint }} />
        <Typography sx={{ fontSize: 13, fontWeight: 700, color: T.text }}>Event timeline</Typography>
        {events.length > 0 && (
          <Typography sx={{ fontSize: 11, color: T.textFaint }}>({events.length})</Typography>
        )}
      </Stack>

      {isLoading ? (
        <TimelineSkeleton />
      ) : isError ? (
        <Typography sx={{ fontSize: 12.5, color: '#ef4444' }}>Failed to load the event timeline.</Typography>
      ) : events.length === 0 ? (
        <Typography sx={{ fontSize: 12.5, color: T.textFaint }}>No events recorded for this session.</Typography>
      ) : (
        <Box>
          {events.map((evt, i) => (
            <EventRow key={evt.id ?? i} event={evt} isLast={i === events.length - 1} />
          ))}
        </Box>
      )}
    </Box>
  );
}

// ─── SessionDetailModal (main export) ─────────────────────────────────────────

export default function SessionDetailModal({ session, onClose }) {
  const T = useT();
  const muiTheme = useMuiTheme();
  const mobile = useMediaQuery(muiTheme.breakpoints.down('sm'));
  const open = !!session;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth fullScreen={mobile}
      PaperProps={{ sx: { height: mobile ? '100%' : '85vh', maxHeight: mobile ? '100%' : '85vh', display: 'flex', flexDirection: 'column', bgcolor: T.bg } }}>
      {session && (
        <>
          <Box sx={{ px: { xs: 2, sm: 3 }, pt: 2, pb: 1.5, flexShrink: 0, borderBottom: `1px solid ${T.border}` }}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Stack direction="row" spacing={0.75} alignItems="center" mb={0.5}>
                  <DevicesIcon sx={{ fontSize: 16, color: T.textFaint }} />
                  <Typography sx={{ fontSize: 10.5, color: T.textFaint, fontFamily: 'monospace' }}>
                    {session.sessionId}
                  </Typography>
                </Stack>
                <Typography variant="subtitle1" fontWeight={700} title={titleOf(session)}
                  sx={{ wordBreak: 'break-word', lineHeight: 1.3, fontSize: { xs: '0.95rem', sm: '1.05rem' }, color: T.text }}>
                  {titleOf(session)}
                </Typography>
                <Typography sx={{ fontSize: 12, color: T.textMuted, mt: 0.25 }}>
                  {session.userEmail || 'Unknown user'}
                </Typography>
              </Box>
              <IconButton size="small" onClick={onClose} sx={{ color: T.textFaint, flexShrink: 0 }}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Stack>
          </Box>

          <DialogContent sx={{ p: 0, overflow: 'auto', flex: 1 }}>
            <SummaryGrid session={session} />
            <EventTimeline sessionId={session.sessionId} open={open} />
          </DialogContent>
        </>
      )}
    </Dialog>
  );
}
