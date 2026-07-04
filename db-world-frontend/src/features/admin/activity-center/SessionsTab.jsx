import React, { useMemo, useState } from 'react';
import {
  Box, Typography, Paper, Stack, Chip, TextField, MenuItem, IconButton, Tooltip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination,
  Skeleton, LinearProgress, alpha, useMediaQuery, useTheme as useMuiTheme,
} from '@mui/material';
import DevicesIcon from '@mui/icons-material/Devices';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import FilterListIcon from '@mui/icons-material/FilterList';
import ClearIcon from '@mui/icons-material/Clear';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { useT } from '@shared/theme/ThemeContext';
import { fetchSessions } from './activityApi';
import SessionDetailModal from './SessionDetailModal';

// ─── enum options (mirrors backend enums exactly — see
// com.db.dbworld.audit.tracking.enums.{ActivityKind,TrackChannel,SessionState,ClientApp}) ──

const ACTIVITY_OPTIONS = ['DOWNLOAD', 'STREAM', 'SEARCH'];
const CHANNEL_OPTIONS = ['APP', 'WEB', 'BROWSER', 'EXTERNAL', 'SERVER'];
const STATE_OPTIONS = ['RESOLVING', 'ACTIVE', 'PAUSED', 'COMPLETED', 'FAILED', 'ABORTED'];
const CLIENT_APP_OPTIONS = [
  'DBWORLD_APP', 'ARIA2', 'CHROME', 'FIREFOX', 'SAFARI', 'EDGE', 'IDM', 'ONEDM',
  'VLC', 'MPV', 'KODI', 'WGET', 'CURL', 'UNKNOWN',
];

const EMPTY_FILTERS = { activity: '', channel: '', clientApp: '', state: '', from: '', to: '' };

// ─── formatting helpers ──────────────────────────────────────────────────────

function fmtBytes(b) {
  if (!b) return '—';
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(0)} KB`;
  if (b < 1024 ** 3) return `${(b / 1024 ** 2).toFixed(1)} MB`;
  return `${(b / 1024 ** 3).toFixed(2)} GB`;
}

// avgSpeedBps/maxSpeedBps arrive as bits-per-second — render as MB/s to match
// the rest of the admin activity panels (see OverviewTab.fmtSpeed / LiveTab.fmtSpeed).
function fmtSpeed(bps) {
  if (!bps) return '—';
  return `${(Number(bps) / 8 / 1_000_000).toFixed(1)} MB/s`;
}

function fmtPct(p) {
  if (p == null) return 0;
  return Math.max(0, Math.min(100, Number(p)));
}

function fmtClock(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString([], {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

// ─── chip color maps (same palette as LiveTab, kept local per-tab convention) ─

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

function ProgressBar({ pct, width }) {
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
      <Typography variant="caption" sx={{ color: T.textMuted, minWidth: 34, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        {v.toFixed(1)}%
      </Typography>
    </Stack>
  );
}

function titleOf(session) {
  if (!session.recordName) return session.fileName || '—';
  const ep = session.seasonNumber != null && session.episodeNumber != null
    ? ` S${String(session.seasonNumber).padStart(2, '0')}E${String(session.episodeNumber).padStart(2, '0')}`
    : '';
  return `${session.recordName}${ep}`;
}

// ─── desktop table row ────────────────────────────────────────────────────────

function SessionRow({ session, isLg, isXl, onOpen }) {
  const T = useT();
  return (
    <TableRow hover onClick={() => onOpen(session)} sx={{ cursor: 'pointer', '& td': { py: 0.75 } }}>
      <TableCell>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
          <PersonOutlineIcon sx={{ fontSize: 16, color: T.textFaint, flexShrink: 0 }} />
          <Typography variant="body2" noWrap title={session.userEmail} sx={{ maxWidth: { md: 150, lg: 190 } }}>
            {session.userEmail || '—'}
          </Typography>
        </Stack>
      </TableCell>
      <TableCell>
        <Typography variant="body2" fontWeight={600} noWrap title={titleOf(session)}
          sx={{ maxWidth: { md: 180, lg: 260, xl: 340 } }}>
          {titleOf(session)}
        </Typography>
      </TableCell>
      <TableCell><ActivityChip activity={session.activity} /></TableCell>
      <TableCell><ChannelClientChip channel={session.channel} clientApp={session.clientApp} /></TableCell>
      <TableCell><StateChip state={session.state} /></TableCell>
      <TableCell><ProgressBar pct={session.completionPercent} /></TableCell>
      {isLg && (
        <TableCell align="right">
          <Typography variant="caption" color="text.secondary">
            {fmtBytes(session.uniqueBytes)}{session.fileSize ? ` / ${fmtBytes(session.fileSize)}` : ''}
          </Typography>
        </TableCell>
      )}
      {isLg && (
        <TableCell align="right">
          <Typography variant="caption" color="text.secondary">{session.peakConnections ?? '—'}</Typography>
        </TableCell>
      )}
      {isXl && (
        <TableCell align="right">
          <Typography variant="caption" color="text.secondary">{fmtSpeed(session.avgSpeedBps)}</Typography>
        </TableCell>
      )}
      {isXl && (
        <TableCell>
          <Typography variant="caption" color="text.secondary">{fmtClock(session.startedAt)}</Typography>
        </TableCell>
      )}
      <TableCell>
        <Typography variant="caption" color="text.secondary">{fmtClock(session.lastEventAt)}</Typography>
      </TableCell>
    </TableRow>
  );
}

// ─── mobile card ──────────────────────────────────────────────────────────────

function SessionCard({ session, onOpen }) {
  const T = useT();
  return (
    <Paper variant="outlined" onClick={() => onOpen(session)}
      sx={{
        borderRadius: 2, p: 1.25, cursor: 'pointer', borderColor: T.border, bgcolor: T.glass,
        transition: 'border-color .15s', '&:active': { borderColor: T.teal },
      }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="body2" fontWeight={600} title={titleOf(session)}
            sx={{ fontSize: '0.82rem', lineHeight: 1.35, wordBreak: 'break-word' }}>
            {titleOf(session)}
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
        <ProgressBar pct={session.completionPercent} width="100%" />
      </Box>

      <Stack direction="row" justifyContent="space-between" spacing={1} sx={{ mt: 0.75 }}>
        <Typography variant="caption" sx={{ color: T.textMuted }}>
          {fmtBytes(session.uniqueBytes)} · {session.peakConnections ?? 0} conn · {fmtSpeed(session.avgSpeedBps)}
        </Typography>
        <Typography variant="caption" sx={{ color: T.textFaint }}>
          {fmtClock(session.lastEventAt)}
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

// ─── SessionsTab (main export) ────────────────────────────────────────────────

export default function SessionsTab() {
  const T = useT();
  const muiTheme = useMuiTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('md'));
  const isLg = useMediaQuery(muiTheme.breakpoints.up('lg'));
  const isXl = useMediaQuery(muiTheme.breakpoints.up('xl'));

  const [userQuery, setUserQuery] = useState('');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(!isMobile);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(25);
  const [selectedSession, setSelectedSession] = useState(null);

  // The API's `userId` filter is numeric (see activityApi.fetchSessions / the
  // backend's ActivitySessionRepository.search). We surface a single free-text
  // "user" field for convenience — when it parses as an integer we send it as
  // userId; otherwise it's just not applied (no username/email search endpoint
  // exists on /sessions today, see task-p2-7-report.md for detail).
  const userIdFilter = useMemo(() => {
    const trimmed = userQuery.trim();
    if (!trimmed) return undefined;
    return /^\d+$/.test(trimmed) ? Number(trimmed) : undefined;
  }, [userQuery]);
  const userQueryIsNonNumeric = userQuery.trim() !== '' && userIdFilter === undefined;

  const appliedFilters = useMemo(() => ({
    userId: userIdFilter,
    activity: filters.activity || undefined,
    channel: filters.channel || undefined,
    clientApp: filters.clientApp || undefined,
    state: filters.state || undefined,
    from: filters.from ? new Date(filters.from).toISOString() : undefined,
    to: filters.to ? new Date(filters.to).toISOString() : undefined,
  }), [userIdFilter, filters]);

  const hasActiveFilters = Object.values(appliedFilters).some((v) => v !== undefined);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['sessions', appliedFilters, page, size],
    queryFn: () => fetchSessions({ ...appliedFilters, page, size }),
    keepPreviousData: true,
  });

  const sessions = data?.content ?? [];
  const totalElements = data?.totalElements ?? 0;
  const extraCols = 2 + (isLg ? 2 : 0) + (isXl ? 2 : 0);

  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(0);
  };

  const clearFilters = () => {
    setUserQuery('');
    setFilters(EMPTY_FILTERS);
    setPage(0);
  };

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2, md: 2.5 }, display: 'flex', flexDirection: 'column', gap: { xs: 1.5, sm: 2 } }}>
      {/* ── Filter bar ── */}
      <Box sx={{ border: `1px solid ${T.border}`, borderRadius: 2, bgcolor: T.glass, overflow: 'hidden' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 1, flexWrap: 'wrap' }}>
          <Tooltip title={showFilters ? 'Hide filters' : 'Show filters'}>
            <IconButton size="small" onClick={() => setShowFilters((f) => !f)}
              sx={{
                color: showFilters || hasActiveFilters ? T.teal : T.textFaint,
                border: `1px solid ${T.border}`,
                bgcolor: showFilters || hasActiveFilters ? T.tealBg : 'transparent',
                '&:hover': { borderColor: T.teal },
              }}>
              <FilterListIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <DevicesIcon sx={{ fontSize: 18, color: T.textFaint }} />
          <Typography sx={{ fontSize: 12.5, color: T.textMuted }}>
            {totalElements.toLocaleString()} session{totalElements === 1 ? '' : 's'}
          </Typography>
          {isFetching && !isLoading && (
            <Typography sx={{ fontSize: 11, color: T.textFaint }}>refreshing…</Typography>
          )}
          {hasActiveFilters && (
            <Box sx={{ ml: 'auto' }}>
              <Chip size="small" icon={<ClearIcon sx={{ fontSize: '14px !important' }} />} label="Clear filters"
                onClick={clearFilters}
                sx={{ height: 22, fontSize: 11, bgcolor: T.tealBg, color: T.teal }} />
            </Box>
          )}
        </Box>

        <AnimatePresence initial={false}>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18 }}
              style={{ overflow: 'hidden' }}
            >
              <Box sx={{
                display: 'grid', gap: 1,
                gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, 1fr)', md: 'repeat(6, 1fr)' },
                px: 1.5, pb: 1.5, borderTop: `1px solid ${T.border}`, pt: 1.5,
              }}>
                <TextField
                  size="small" label="User (numeric ID)" value={userQuery}
                  onChange={(e) => { setUserQuery(e.target.value); setPage(0); }}
                  error={userQueryIsNonNumeric}
                  helperText={userQueryIsNonNumeric ? 'Numeric user ID only' : ' '}
                  fullWidth
                />
                <TextField select size="small" label="Activity" value={filters.activity}
                  onChange={(e) => updateFilter('activity', e.target.value)} fullWidth>
                  <MenuItem value="">All</MenuItem>
                  {ACTIVITY_OPTIONS.map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
                </TextField>
                <TextField select size="small" label="Channel" value={filters.channel}
                  onChange={(e) => updateFilter('channel', e.target.value)} fullWidth>
                  <MenuItem value="">All</MenuItem>
                  {CHANNEL_OPTIONS.map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
                </TextField>
                <TextField select size="small" label="Client" value={filters.clientApp}
                  onChange={(e) => updateFilter('clientApp', e.target.value)} fullWidth>
                  <MenuItem value="">All</MenuItem>
                  {CLIENT_APP_OPTIONS.map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
                </TextField>
                <TextField select size="small" label="State" value={filters.state}
                  onChange={(e) => updateFilter('state', e.target.value)} fullWidth>
                  <MenuItem value="">All</MenuItem>
                  {STATE_OPTIONS.map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
                </TextField>
                <Stack direction="row" spacing={1} sx={{ gridColumn: { xs: '1 / -1', sm: 'auto' } }}>
                  <TextField
                    size="small" label="From" type="datetime-local" value={filters.from}
                    onChange={(e) => updateFilter('from', e.target.value)}
                    InputLabelProps={{ shrink: true }} fullWidth
                  />
                  <TextField
                    size="small" label="To" type="datetime-local" value={filters.to}
                    onChange={(e) => updateFilter('to', e.target.value)}
                    InputLabelProps={{ shrink: true }} fullWidth
                  />
                </Stack>
              </Box>
            </motion.div>
          )}
        </AnimatePresence>
      </Box>

      {/* ── Body ── */}
      {isLoading ? (
        isMobile ? (
          <Stack spacing={1}>{[...Array(5)].map((_, i) => <SkeletonCard key={i} />)}</Stack>
        ) : (
          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
            <Table size="small"><TableBody>{[...Array(6)].map((_, i) => <SkeletonRow key={i} cols={extraCols} />)}</TableBody></Table>
          </TableContainer>
        )
      ) : sessions.length === 0 ? (
        <Box sx={{
          p: 2, minHeight: 220,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 1, color: T.textMuted, textAlign: 'center',
        }}>
          <DevicesIcon sx={{ fontSize: 28, color: T.textFaint }} />
          <Typography sx={{ fontSize: 13, color: T.textMuted }}>
            {hasActiveFilters ? 'No sessions match the current filters.' : 'No sessions recorded yet.'}
          </Typography>
        </Box>
      ) : isMobile ? (
        <Stack spacing={1}>
          {sessions.map((s) => <SessionCard key={s.sessionId} session={s} onOpen={setSelectedSession} />)}
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
                <TableCell>State</TableCell>
                <TableCell>Progress</TableCell>
                {isLg && <TableCell align="right">Size</TableCell>}
                {isLg && <TableCell align="right">Conn.</TableCell>}
                {isXl && <TableCell align="right">Speed</TableCell>}
                {isXl && <TableCell>Started</TableCell>}
                <TableCell>Last activity</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sessions.map((s) => (
                <SessionRow key={s.sessionId} session={s} isLg={isLg} isXl={isXl} onOpen={setSelectedSession} />
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {!isLoading && totalElements > 0 && (
        <TablePagination
          component="div"
          count={totalElements}
          page={page}
          rowsPerPage={size}
          onPageChange={(_, p) => setPage(p)}
          onRowsPerPageChange={(e) => { setSize(+e.target.value); setPage(0); }}
          rowsPerPageOptions={[10, 25, 50, 100]}
          sx={{
            color: T.textMuted, borderTop: `1px solid ${T.border}`, fontSize: '0.75rem',
            '& .MuiTablePagination-selectIcon, & .MuiIconButton-root': { color: T.textMuted },
          }}
        />
      )}

      <SessionDetailModal session={selectedSession} onClose={() => setSelectedSession(null)} />
    </Box>
  );
}
