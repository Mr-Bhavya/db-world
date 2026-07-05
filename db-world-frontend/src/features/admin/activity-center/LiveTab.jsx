import React, { useEffect, useMemo, useState } from 'react';
import {
  Box, Typography, Paper, Stack, Chip, Skeleton, LinearProgress,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  useMediaQuery, useTheme as useMuiTheme, alpha,
} from '@mui/material';
import BoltIcon from '@mui/icons-material/Bolt';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import { useQuery } from '@tanstack/react-query';
import { useT } from '@shared/theme/ThemeContext';
import { fetchLiveSessions } from './activityApi';

const WITHIN_MINUTES = 30;
const REFETCH_MS = 5000;

// ─── formatting helpers ──────────────────────────────────────────────────────

function fmtBytes(b) {
  if (b == null) return '—';
  if (b === 0) return '0 B';
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(0)} KB`;
  if (b < 1024 ** 3) return `${(b / 1024 ** 2).toFixed(1)} MB`;
  return `${(b / 1024 ** 3).toFixed(2)} GB`;
}

// avgSpeedBps/maxSpeedBps arrive as bits-per-second — render as MB/s to match
// the rest of the admin activity panels (see OverviewTab.fmtSpeed).
function fmtSpeed(bps) {
  if (!bps) return '—';
  return `${(Number(bps) / 8 / 1_000_000).toFixed(1)} MB/s`;
}

function fmtPct(p) {
  if (p == null) return 0;
  return Math.max(0, Math.min(100, Number(p)));
}

// STREAM live sessions surface playback progress via watchedPercent (how far
// the user watched); the byte completionPercent is small/misleading for
// streams. DOWNLOAD sessions keep the byte-based completionPercent.
function progressFor(session) {
  if (session.activity === 'STREAM' && session.watchedPercent != null) {
    return { pct: session.watchedPercent, label: 'watched' };
  }
  return { pct: session.completionPercent, label: '' };
}

function fmtDuration(startedAt) {
  if (!startedAt) return '—';
  const ms = Date.now() - new Date(startedAt).getTime();
  if (ms < 0) return '0s';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

function fmtClock(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// ─── chip color maps ──────────────────────────────────────────────────────────

const ACTIVITY_COLOR = {
  DOWNLOAD: '#0d9488',
  STREAM:   '#3b82f6',
  SEARCH:   '#f59e0b',
};

const STATE_COLOR = {
  ACTIVE:     '#10b981',
  IN_PROGRESS:'#10b981',
  PAUSED:     '#f59e0b',
  STALLED:    '#f59e0b',
  COMPLETED:  '#0d9488',
  ERROR:      '#ef4444',
  FAILED:     '#ef4444',
  CANCELLED:  '#6b7280',
};

const chipSx = { height: 20, fontSize: '0.68rem', fontWeight: 600 };

function ActivityChip({ activity }) {
  if (!activity) return <Typography variant="caption" color="text.disabled">—</Typography>;
  const color = ACTIVITY_COLOR[activity] ?? '#6b7280';
  return (
    <Chip label={activity} size="small"
      sx={{ ...chipSx, color, bgcolor: alpha(color, 0.14), border: `1px solid ${alpha(color, 0.35)}` }} />
  );
}

function StateChip({ state }) {
  if (!state) return <Typography variant="caption" color="text.disabled">—</Typography>;
  const color = STATE_COLOR[state] ?? '#6b7280';
  return (
    <Chip label={state} size="small"
      sx={{ ...chipSx, color, bgcolor: alpha(color, 0.14), border: `1px solid ${alpha(color, 0.35)}` }} />
  );
}

function ChannelClientChip({ channel, clientApp }) {
  const label = [channel, clientApp].filter(Boolean).join(' · ') || '—';
  if (label === '—') return <Typography variant="caption" color="text.disabled">—</Typography>;
  return <Chip label={label} size="small" variant="outlined" sx={chipSx} />;
}

// ─── progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ pct, width, label }) {
  const T = useT();
  const v = fmtPct(pct);
  return (
    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: width ?? 96 }}>
      <Box sx={{ flex: 1, height: 5, borderRadius: 3, bgcolor: alpha(T.text, 0.1), overflow: 'hidden' }}>
        <Box sx={{
          width: `${v}%`, height: '100%', borderRadius: 3,
          bgcolor: v >= 100 ? '#10b981' : T.teal,
          transition: 'width .4s ease',
        }} />
      </Box>
      <Typography variant="caption" sx={{ color: T.textMuted, minWidth: label ? 74 : 34, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        {v.toFixed(1)}%{label ? ` ${label}` : ''}
      </Typography>
    </Stack>
  );
}

// ─── live indicator ───────────────────────────────────────────────────────────

function LiveIndicator({ count, lastUpdated, isFetching }) {
  const T = useT();
  return (
    <Stack direction="row" spacing={1.25} alignItems="center" flexWrap="wrap" useFlexGap>
      <Stack direction="row" spacing={0.75} alignItems="center">
        <Box sx={{
          width: 8, height: 8, borderRadius: '50%', bgcolor: '#10b981',
          boxShadow: '0 0 0 rgba(16,185,129,0.6)',
          animation: 'live-pulse 1.6s ease-out infinite',
          '@keyframes live-pulse': {
            '0%':   { boxShadow: '0 0 0 0 rgba(16,185,129,0.55)' },
            '70%':  { boxShadow: '0 0 0 7px rgba(16,185,129,0)' },
            '100%': { boxShadow: '0 0 0 0 rgba(16,185,129,0)' },
          },
        }} />
        <Typography sx={{ fontSize: 11, fontWeight: 700, color: T.text, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Live
        </Typography>
      </Stack>
      <Typography sx={{ fontSize: 12.5, color: T.textMuted }}>
        {count} active session{count === 1 ? '' : 's'}
      </Typography>
      <Typography sx={{ fontSize: 11, color: T.textFaint }}>
        {isFetching ? 'refreshing…' : lastUpdated ? `updated ${fmtClock(lastUpdated)}` : ''}
      </Typography>
    </Stack>
  );
}

// ─── desktop table row ────────────────────────────────────────────────────────

function LiveRow({ session, isLg, isXl }) {
  const T = useT();
  return (
    <TableRow hover sx={{ '& td': { py: 0.75 } }}>
      <TableCell>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
          <PersonOutlineIcon sx={{ fontSize: 16, color: T.textFaint, flexShrink: 0 }} />
          <Typography variant="body2" noWrap title={session.userEmail} sx={{ maxWidth: { md: 160, lg: 200 } }}>
            {session.userEmail || '—'}
          </Typography>
        </Stack>
      </TableCell>
      <TableCell>
        <Typography variant="body2" fontWeight={600} noWrap title={session.title}
          sx={{ maxWidth: { md: 200, lg: 280, xl: 360 } }}>
          {session.title || '—'}
        </Typography>
      </TableCell>
      <TableCell><ActivityChip activity={session.activity} /></TableCell>
      <TableCell><ChannelClientChip channel={session.channel} clientApp={session.clientApp} /></TableCell>
      <TableCell><ProgressBar {...progressFor(session)} /></TableCell>
      <TableCell>
        <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
          {fmtSpeed(session.avgSpeedBps)}
        </Typography>
      </TableCell>
      {isLg && (
        <TableCell align="right">
          <Typography variant="caption" color="text.secondary">{session.peakConnections ?? '—'}</Typography>
        </TableCell>
      )}
      {isLg && (
        <TableCell align="right">
          <Typography variant="caption" color="text.secondary">
            {fmtBytes(session.uniqueBytes)}{session.fileSize ? ` / ${fmtBytes(session.fileSize)}` : ''}
          </Typography>
        </TableCell>
      )}
      <TableCell><StateChip state={session.state} /></TableCell>
      {isXl && (
        <TableCell>
          <Typography variant="caption" color="text.secondary">{fmtClock(session.startedAt)}</Typography>
        </TableCell>
      )}
      <TableCell align="right">
        <Typography variant="caption" color="text.secondary">{fmtDuration(session.startedAt)}</Typography>
      </TableCell>
    </TableRow>
  );
}

// ─── mobile card ──────────────────────────────────────────────────────────────

function LiveCard({ session }) {
  const T = useT();
  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, p: 1.25, borderColor: T.border, bgcolor: T.glass }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="body2" fontWeight={600} title={session.title}
            sx={{ fontSize: '0.82rem', lineHeight: 1.35, wordBreak: 'break-word' }}>
            {session.title || '—'}
          </Typography>
          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.25 }}>
            <PersonOutlineIcon sx={{ fontSize: 13, color: T.textFaint, flexShrink: 0 }} />
            <Typography variant="caption" sx={{ color: T.textMuted, wordBreak: 'break-word' }}>
              {session.userEmail || '—'}
            </Typography>
          </Stack>
        </Box>
      </Stack>

      <Stack direction="row" flexWrap="wrap" gap={0.5} mt={1} alignItems="center" useFlexGap>
        <ActivityChip activity={session.activity} />
        <StateChip state={session.state} />
        <ChannelClientChip channel={session.channel} clientApp={session.clientApp} />
      </Stack>

      <Box sx={{ mt: 1 }}>
        <ProgressBar {...progressFor(session)} width="100%" />
      </Box>

      <Stack direction="row" justifyContent="space-between" spacing={1} sx={{ mt: 0.75 }}>
        <Typography variant="caption" sx={{ color: T.textMuted }}>
          {fmtSpeed(session.avgSpeedBps)} · {session.peakConnections ?? 0} conn
        </Typography>
        <Typography variant="caption" sx={{ color: T.textFaint }}>
          {fmtDuration(session.startedAt)}
        </Typography>
      </Stack>
    </Paper>
  );
}

// ─── skeletons ────────────────────────────────────────────────────────────────

function SkeletonRow({ cols }) {
  return (
    <TableRow>
      <TableCell><Skeleton width={120} height={16} /></TableCell>
      <TableCell><Skeleton width={160} height={16} /></TableCell>
      {[...Array(cols)].map((_, i) => <TableCell key={i}><Skeleton width={60} /></TableCell>)}
    </TableRow>
  );
}

function SkeletonCard() {
  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, p: 1.25 }}>
      <Skeleton height={16} width="70%" />
      <Skeleton height={14} width="40%" sx={{ mt: 0.5 }} />
      <Stack direction="row" spacing={0.5} sx={{ mt: 1 }}>
        {[50, 45, 60].map((w, i) => <Skeleton key={i} width={w} height={20} sx={{ borderRadius: 3 }} />)}
      </Stack>
      <Skeleton height={5} sx={{ mt: 1, borderRadius: 3 }} />
    </Paper>
  );
}

// ─── LiveTab (main export) ────────────────────────────────────────────────────

export default function LiveTab() {
  const T = useT();
  const muiTheme = useMuiTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('md'));
  const isLg = useMediaQuery(muiTheme.breakpoints.up('lg'));
  const isXl = useMediaQuery(muiTheme.breakpoints.up('xl'));

  const [lastUpdated, setLastUpdated] = useState(null);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['liveSessions', WITHIN_MINUTES],
    queryFn: () => fetchLiveSessions(WITHIN_MINUTES),
    refetchInterval: REFETCH_MS,
    staleTime: 2000,
  });

  useEffect(() => {
    if (data) setLastUpdated(Date.now());
  }, [data]);

  const sessions = useMemo(() => data ?? [], [data]);
  const extraCols = 3 + (isLg ? 2 : 0) + (isXl ? 1 : 0);

  return (
    <Box sx={{
      p: { xs: 1.5, sm: 2, md: 2.5 },
      display: 'flex', flexDirection: 'column', gap: { xs: 1.5, sm: 2 },
    }}>
      <Box sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 1, flexWrap: 'wrap',
      }}>
        <LiveIndicator count={sessions.length} lastUpdated={lastUpdated} isFetching={isFetching && !isLoading} />
      </Box>

      {isLoading ? (
        isMobile ? (
          <Stack spacing={1}>{[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}</Stack>
        ) : (
          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
            <Table size="small"><TableBody>{[...Array(4)].map((_, i) => <SkeletonRow key={i} cols={extraCols} />)}</TableBody></Table>
          </TableContainer>
        )
      ) : sessions.length === 0 ? (
        <Box sx={{
          p: 2, minHeight: 220,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 1, color: T.textMuted, textAlign: 'center',
        }}>
          <BoltIcon sx={{ fontSize: 28, color: T.textFaint }} />
          <Typography sx={{ fontSize: 13, color: T.textMuted }}>
            No active sessions right now.
          </Typography>
        </Box>
      ) : isMobile ? (
        <Stack spacing={1}>
          {sessions.map((s) => <LiveCard key={s.sessionId} session={s} />)}
        </Stack>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
          {isFetching && <LinearProgress sx={{ height: 2 }} />}
          <Table size="small" stickyHeader sx={{ '& td, & th': { borderColor: alpha(T.border, 0.6) } }}>
            <TableHead>
              <TableRow sx={{ '& th': { fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '.04em', color: 'text.secondary', bgcolor: 'background.paper' } }}>
                <TableCell>User</TableCell>
                <TableCell>Title</TableCell>
                <TableCell>Activity</TableCell>
                <TableCell>Channel / Client</TableCell>
                <TableCell>Progress</TableCell>
                <TableCell>Speed</TableCell>
                {isLg && <TableCell align="right">Conn.</TableCell>}
                {isLg && <TableCell align="right">Bytes</TableCell>}
                <TableCell>State</TableCell>
                {isXl && <TableCell>Started</TableCell>}
                <TableCell align="right">Duration</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sessions.map((s) => (
                <LiveRow key={s.sessionId} session={s} isLg={isLg} isXl={isXl} />
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
