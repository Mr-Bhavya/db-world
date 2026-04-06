import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Grid, Typography, Card, CardContent, Chip,
  LinearProgress, Skeleton, IconButton, Tooltip,
  alpha,
} from '@mui/material';
import {
  People, Movie, Sync, VideoLibrary, TrendingUp, Computer,
  Refresh, Add, Label, Storage, Analytics, ArrowForward,
  Movie as MovieIcon, Tv, CheckCircle, Error, HourglassEmpty,
  Dashboard, Memory, Speed,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useT } from '@shared/theme';
import Constants from '@shared/constants';

// ─── Accent palette (theme-independent) ───────────────────────────────────────
const A = {
  indigo:  '#6366f1',
  emerald: '#10b981',
  amber:   '#f59e0b',
  red:     '#ef4444',
  cyan:    '#06b6d4',
  violet:  '#8b5cf6',
};

// ─── API call ─────────────────────────────────────────────────────────────────
async function fetchDashboardStats() {
  const res = await fetch('/api/admin/dashboard/stats', {
    headers: { Authorization: `Bearer ${localStorage.getItem('token') ?? sessionStorage.getItem('token') ?? ''}` },
  });
  if (!res.ok) throw new Error('Failed to fetch stats');
  const json = await res.json();
  return json.data;
}

// ─── StatCard ─────────────────────────────────────────────────────────────────
const StatCard = ({ icon, label, value, sub, color, onClick, loading, badge }) => {
  const T = useT();
  return (
    <Card
      component={motion.div}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.15 }}
      sx={{ bgcolor: T.glass, border: `1px solid ${T.border}`, borderRadius: 2.5, cursor: onClick ? 'pointer' : 'default' }}
      onClick={onClick}
    >
      <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1.5 }}>
          <Box sx={{ p: 1, borderRadius: 1.5, bgcolor: alpha(color, 0.15), display: 'inline-flex' }}>
            {React.cloneElement(icon, { sx: { fontSize: 22, color } })}
          </Box>
          {badge && (
            <Chip label={badge} size="small"
              sx={{ height: 18, fontSize: '0.58rem', fontWeight: 700, bgcolor: alpha(color, 0.2), color }} />
          )}
        </Box>
        {loading ? (
          <Skeleton variant="text" width={80} height={36} sx={{ bgcolor: T.glass }} />
        ) : (
          <Typography sx={{ fontSize: '1.8rem', fontWeight: 800, color: T.text, lineHeight: 1 }}>
            {value ?? '—'}
          </Typography>
        )}
        <Typography sx={{ fontSize: '0.78rem', color: T.textMuted, mt: 0.5 }}>{label}</Typography>
        {sub && <Typography sx={{ fontSize: '0.7rem', color: alpha(color, 0.8), mt: 0.5 }}>{sub}</Typography>}
      </CardContent>
    </Card>
  );
};

// ─── SystemBar ────────────────────────────────────────────────────────────────
const SystemBar = ({ label, value, color, loading }) => {
  const T = useT();
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography sx={{ fontSize: '0.72rem', color: T.textMuted }}>{label}</Typography>
        {loading
          ? <Skeleton variant="text" width={32} sx={{ bgcolor: T.glass }} />
          : <Typography sx={{ fontSize: '0.72rem', color: T.text, fontWeight: 600 }}>
              {value != null ? `${value.toFixed(1)}%` : '—'}
            </Typography>}
      </Box>
      <LinearProgress
        variant={loading ? 'indeterminate' : 'determinate'}
        value={value ?? 0}
        sx={{
          height: 5, borderRadius: 3,
          bgcolor: T.border,
          '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 3 },
        }}
      />
    </Box>
  );
};

// ─── Main ─────────────────────────────────────────────────────────────────────
const AdminDashboard = () => {
  const T = useT();
  const navigate = useNavigate();
  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const nav = (path) => navigate(`${Constants.DB_ADMIN_BASE_ROUTE}/${path}`);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchDashboardStats()
      .then(setStats)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const s = stats;

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 1400, mx: 'auto', bgcolor: T.adminBg, minHeight: '100%' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography sx={{ fontSize: '1.4rem', fontWeight: 800, color: T.text, lineHeight: 1 }}>
            Dashboard
          </Typography>
          <Typography sx={{ fontSize: '0.8rem', color: T.textMuted, mt: 0.4 }}>
            Overview of your DB World instance
          </Typography>
        </Box>
        <Tooltip title="Refresh">
          <IconButton onClick={load} disabled={loading}
            sx={{ color: T.textMuted, '&:hover': { color: T.teal, bgcolor: T.tealBg } }}>
            <Refresh sx={{ fontSize: 20, animation: loading ? 'spin 1s linear infinite' : 'none',
              '@keyframes spin': { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } } }} />
          </IconButton>
        </Tooltip>
      </Box>

      {error && (
        <Box sx={{ mb: 2, p: 1.5, borderRadius: 1.5, bgcolor: alpha(A.red, 0.1), border: `1px solid ${alpha(A.red, 0.3)}` }}>
          <Typography sx={{ fontSize: '0.8rem', color: A.red }}>{error}</Typography>
        </Box>
      )}

      {/* ── KPI Cards ─────────────────────────────────────────────────────── */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={3}>
          <StatCard
            icon={<People />} color={A.indigo}
            label="Total Users"
            value={s?.users?.total}
            sub={s?.users ? `${s.users.owners}O · ${s.users.admins}A · ${s.users.viewers}V` : null}
            loading={loading}
            onClick={() => nav('users')}
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard
            icon={<Movie />} color={A.cyan}
            label="Records"
            value={s?.records?.total}
            sub={s?.records ? `${s.records.movies} movies · ${s.records.series} series` : null}
            loading={loading}
            onClick={() => nav('records')}
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard
            icon={<VideoLibrary />} color={A.violet}
            label="Media Files"
            value={s?.media?.totalFiles}
            loading={loading}
            onClick={() => nav('media-files')}
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard
            icon={<Sync />} color={A.emerald}
            label="TMDB Synced"
            value={s?.sync?.synced}
            sub={s?.sync ? `${s.sync.pending} pending · ${s.sync.failed} failed` : null}
            badge={s?.sync?.failed > 0 ? `${s.sync.failed} failed` : null}
            loading={loading}
            onClick={() => nav('tmdb-sync')}
          />
        </Grid>
      </Grid>

      <Grid container spacing={2.5}>
        {/* ── Left column ─────────────────────────────────────────────────── */}
        <Grid item xs={12} lg={8}>

          {/* Tags overview */}
          <Card sx={{ bgcolor: T.glass, border: `1px solid ${T.border}`, borderRadius: 2.5, mb: 2.5 }}>
            <CardContent sx={{ p: 2.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Label sx={{ fontSize: 18, color: A.amber }} />
                  <Typography sx={{ fontWeight: 700, color: T.text, fontSize: '0.9rem' }}>Content Tags</Typography>
                </Box>
                <Chip label="Manage" size="small" onClick={() => nav('tag-management')}
                  icon={<ArrowForward sx={{ fontSize: '12px !important' }} />}
                  sx={{ bgcolor: alpha(A.amber, 0.12), color: A.amber, fontSize: '0.7rem', cursor: 'pointer',
                    '&:hover': { bgcolor: alpha(A.amber, 0.22) } }} />
              </Box>
              <Grid container spacing={1.5}>
                {[
                  { key: 'trending',     label: 'Trending',        color: A.red    },
                  { key: 'featured',     label: 'Featured',        color: A.amber  },
                  { key: 'newRelease',   label: 'New Release',     color: A.emerald },
                  { key: 'editorPick',   label: 'Editor\'s Pick',  color: A.indigo },
                  { key: 'showOnTop',    label: 'Show On Top',     color: A.cyan   },
                  { key: 'recentlyAdded', label: 'Recently Added', color: A.violet },
                  { key: 'top10',        label: 'Top 10',          color: '#f97316' },
                ].map(t => (
                  <Grid item xs={6} sm={4} md={3} key={t.key}>
                    <Box sx={{ p: 1.5, borderRadius: 1.5, bgcolor: alpha(t.color, 0.06),
                      border: `1px solid ${alpha(t.color, 0.15)}` }}>
                      {loading
                        ? <Skeleton variant="text" width={40} sx={{ bgcolor: T.glass }} />
                        : <Typography sx={{ fontSize: '1.1rem', fontWeight: 800, color: t.color }}>
                            {s?.tags?.[t.key] ?? '—'}
                          </Typography>}
                      <Typography sx={{ fontSize: '0.68rem', color: T.textMuted }}>{t.label}</Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>

          {/* Recent records */}
          <Card sx={{ bgcolor: T.glass, border: `1px solid ${T.border}`, borderRadius: 2.5 }}>
            <CardContent sx={{ p: 2.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Movie sx={{ fontSize: 18, color: A.cyan }} />
                  <Typography sx={{ fontWeight: 700, color: T.text, fontSize: '0.9rem' }}>Recent Records</Typography>
                </Box>
                <Chip label="View All" size="small" onClick={() => nav('records')}
                  icon={<ArrowForward sx={{ fontSize: '12px !important' }} />}
                  sx={{ bgcolor: alpha(A.cyan, 0.1), color: A.cyan, fontSize: '0.7rem', cursor: 'pointer',
                    '&:hover': { bgcolor: alpha(A.cyan, 0.2) } }} />
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {loading ? Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} variant="rectangular" height={44} sx={{ borderRadius: 1.5, bgcolor: T.glass }} />
                )) : (s?.recentRecords ?? []).map((r) => (
                  <Box key={r.id} sx={{
                    display: 'flex', alignItems: 'center', gap: 1.5,
                    p: 1, borderRadius: 1.5,
                    '&:hover': { bgcolor: T.glassHover },
                  }}>
                    {r.tmdbPosterPath ? (
                      <Box component="img"
                        src={`https://image.tmdb.org/t/p/w92${r.tmdbPosterPath}`}
                        sx={{ width: 28, height: 42, borderRadius: 0.5, objectFit: 'cover', flexShrink: 0 }}
                        onError={e => { e.target.style.display = 'none'; }}
                      />
                    ) : (
                      <Box sx={{ width: 28, height: 42, borderRadius: 0.5, bgcolor: T.glass,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {r.type === 'SERIES' ? <Tv sx={{ fontSize: 14, color: T.textMuted }} /> : <MovieIcon sx={{ fontSize: 14, color: T.textMuted }} />}
                      </Box>
                    )}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: '0.8rem', color: T.text, fontWeight: 500,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.name}
                      </Typography>
                      <Typography sx={{ fontSize: '0.65rem', color: T.textMuted }}>
                        {r.type}  ·  {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : ''}
                      </Typography>
                    </Box>
                    <Chip label={r.type === 'SERIES' ? 'Series' : 'Movie'} size="small"
                      sx={{ height: 16, fontSize: '0.55rem', fontWeight: 700,
                        bgcolor: r.type === 'SERIES' ? alpha(A.violet, 0.2) : alpha(A.cyan, 0.2),
                        color: r.type === 'SERIES' ? A.violet : A.cyan, '& .MuiChip-label': { px: 0.8 } }} />
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* ── Right column ─────────────────────────────────────────────────── */}
        <Grid item xs={12} lg={4}>

          {/* System health */}
          <Card sx={{ bgcolor: T.glass, border: `1px solid ${T.border}`, borderRadius: 2.5, mb: 2.5 }}>
            <CardContent sx={{ p: 2.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Computer sx={{ fontSize: 18, color: A.emerald }} />
                  <Typography sx={{ fontWeight: 700, color: T.text, fontSize: '0.9rem' }}>System Health</Typography>
                </Box>
                <Chip label="Details" size="small" onClick={() => nav('system-info')}
                  icon={<ArrowForward sx={{ fontSize: '12px !important' }} />}
                  sx={{ bgcolor: alpha(A.emerald, 0.1), color: A.emerald, fontSize: '0.7rem', cursor: 'pointer',
                    '&:hover': { bgcolor: alpha(A.emerald, 0.2) } }} />
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <SystemBar label="CPU (JVM process)" value={s?.system?.cpuPercent}
                  color={s?.system?.cpuPercent > 80 ? A.red : s?.system?.cpuPercent > 60 ? A.amber : A.emerald}
                  loading={loading} />
                <SystemBar label="JVM Memory" value={s?.system?.memPercent}
                  color={s?.system?.memPercent > 80 ? A.red : s?.system?.memPercent > 60 ? A.amber : A.indigo}
                  loading={loading} />
              </Box>
              {s?.system && (
                <Box sx={{ mt: 2, pt: 1.5, borderTop: `1px solid ${T.border}`,
                  display: 'flex', justifyContent: 'space-between' }}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography sx={{ fontSize: '0.65rem', color: T.textMuted }}>JVM Memory</Typography>
                    <Typography sx={{ fontSize: '0.8rem', color: T.text, fontWeight: 600 }}>
                      {s.system.memUsedMb}MB / {s.system.memTotalMb}MB
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography sx={{ fontSize: '0.65rem', color: T.textMuted }}>Uptime</Typography>
                    <Typography sx={{ fontSize: '0.8rem', color: T.text, fontWeight: 600 }}>
                      {s.system.uptime}
                    </Typography>
                  </Box>
                </Box>
              )}
            </CardContent>
          </Card>

          {/* TMDB Sync status */}
          <Card sx={{ bgcolor: T.glass, border: `1px solid ${T.border}`, borderRadius: 2.5, mb: 2.5 }}>
            <CardContent sx={{ p: 2.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Sync sx={{ fontSize: 18, color: A.cyan }} />
                  <Typography sx={{ fontWeight: 700, color: T.text, fontSize: '0.9rem' }}>TMDB Sync</Typography>
                </Box>
                <Chip label="Manage" size="small" onClick={() => nav('tmdb-sync')}
                  sx={{ bgcolor: alpha(A.cyan, 0.1), color: A.cyan, fontSize: '0.7rem', cursor: 'pointer' }} />
              </Box>
              {[
                { icon: <CheckCircle sx={{ fontSize: 15 }} />, color: A.emerald, label: 'Synced',  val: s?.sync?.synced },
                { icon: <HourglassEmpty sx={{ fontSize: 15 }} />, color: A.amber,  label: 'Pending', val: s?.sync?.pending },
                { icon: <Error sx={{ fontSize: 15 }} />,         color: A.red,    label: 'Failed',  val: s?.sync?.failed },
              ].map(row => (
                <Box key={row.label} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  py: 0.7, borderBottom: `1px solid ${T.border}` }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, color: row.color }}>
                    {row.icon}
                    <Typography sx={{ fontSize: '0.78rem', color: T.textMuted }}>{row.label}</Typography>
                  </Box>
                  {loading
                    ? <Skeleton variant="text" width={32} sx={{ bgcolor: T.glass }} />
                    : <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: row.color }}>{row.val ?? '—'}</Typography>}
                </Box>
              ))}
              {s?.sync?.lastSyncedAt && (
                <Typography sx={{ fontSize: '0.65rem', color: T.textMuted, mt: 1 }}>
                  Last sync: {new Date(s.sync.lastSyncedAt * 1000).toLocaleString()}
                </Typography>
              )}
            </CardContent>
          </Card>

          {/* Quick actions */}
          <Card sx={{ bgcolor: T.glass, border: `1px solid ${T.border}`, borderRadius: 2.5 }}>
            <CardContent sx={{ p: 2.5 }}>
              <Typography sx={{ fontWeight: 700, color: T.text, fontSize: '0.9rem', mb: 1.5 }}>
                Quick Actions
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                {[
                  { label: 'Add Record',     color: A.cyan,   icon: <Add />,      path: 'records'      },
                  { label: 'Manage Tags',    color: A.amber,  icon: <Label />,    path: 'tag-management' },
                  { label: 'Trigger Sync',   color: A.emerald, icon: <Sync />,   path: 'tmdb-sync'    },
                  { label: 'View Logs',      color: A.violet, icon: <Analytics />, path: 'logs'       },
                  { label: 'System Info',    color: A.indigo, icon: <Computer />, path: 'system-info'  },
                ].map(a => (
                  <Box key={a.path}
                    onClick={() => nav(a.path)}
                    sx={{
                      display: 'flex', alignItems: 'center', gap: 1.5,
                      p: 1, borderRadius: 1.5, cursor: 'pointer',
                      '&:hover': { bgcolor: alpha(a.color, 0.08) },
                      transition: 'background 0.15s',
                    }}
                  >
                    <Box sx={{ p: 0.6, borderRadius: 1, bgcolor: alpha(a.color, 0.14), color: a.color, display: 'flex' }}>
                      {React.cloneElement(a.icon, { sx: { fontSize: 15 } })}
                    </Box>
                    <Typography sx={{ fontSize: '0.8rem', color: T.text, fontWeight: 500 }}>
                      {a.label}
                    </Typography>
                    <ArrowForward sx={{ fontSize: 13, color: T.textMuted, ml: 'auto' }} />
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default AdminDashboard;
