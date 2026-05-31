import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box, Grid, Typography, Card, CardContent, Chip,
  LinearProgress, Skeleton, IconButton, Tooltip,
  alpha, useMediaQuery, useTheme,
} from '@mui/material';
import {
  People, Movie, Sync, VideoLibrary, Computer,
  Refresh, Label, Storage, Analytics, ArrowForward,
  Movie as MovieIcon, Tv, CheckCircle, Error, HourglassEmpty,
  Folder, Schedule, LocalOffer, ManageAccounts,
  Dashboard as DashboardIcon, Insights, WbSunny, NightsStay,
  Inbox,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useT } from '@shared/theme';
import Constants from '@shared/constants';
import { useAuth } from '@features/auth/context/Authentication';
import axiosInstance from '@shared/components/ui/utils/AxiosInstants';
import usePendingRequestCounts from '@features/admin/requests/hooks/usePendingRequestCounts';


// ─── Accent palette ────────────────────────────────────────────────────────────
const ACCENTS = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444',
  '#06b6d4', '#8b5cf6', '#f97316', '#ec4899',
];
const A = {
  indigo:  ACCENTS[0],
  emerald: ACCENTS[1],
  amber:   ACCENTS[2],
  red:     ACCENTS[3],
  cyan:    ACCENTS[4],
  violet:  ACCENTS[5],
  orange:  ACCENTS[6],
  pink:    ACCENTS[7],
};

// ─── Admin nav sections (mirrors AdminLayout NAV) ──────────────────────────────
const NAV_SECTIONS = [
  { id: 'users',          label: 'User Management', icon: ManageAccounts, path: 'users',          color: A.indigo,  group: 'Users'    },
  { id: 'records',        label: 'Records',          icon: Movie,          path: 'records',        color: A.cyan,    group: 'Content'  },
  { id: 'media-files',    label: 'Media Files',      icon: VideoLibrary,   path: 'media-files',    color: A.violet,  group: 'Content'  },
  { id: 'tag-management', label: 'Tags & Rails',     icon: LocalOffer,     path: 'tag-management', color: A.amber,   group: 'Content'  },
  { id: 'tmdb-sync',      label: 'TMDB Sync',        icon: Sync,           path: 'tmdb-sync',      color: A.emerald, group: 'Content'  },
  { id: 'ingestion',      label: 'Media Ingestion',  icon: Folder,         path: 'ingestion',      color: A.orange,  group: 'Activity' },
  { id: 'activity-center',label: 'Activity & Insights', icon: Insights,    path: 'activity-center',color: A.red,     group: 'Activity', badge: 'Live' },
  { id: 'system-info',    label: 'System Info',      icon: Computer,       path: 'system-info',    color: A.indigo,  group: 'System'   },
  { id: 'logs',           label: 'Log Viewer',       icon: Analytics,      path: 'logs',           color: A.violet,  group: 'System'   },
  { id: 'redis',          label: 'Redis Cache',      icon: Storage,        path: 'redis',          color: A.emerald, group: 'System'   },
  { id: 'scheduler',      label: 'Scheduler',        icon: Schedule,       path: 'scheduler',      color: A.amber,   group: 'System'   },
];

// ─── Utilities ─────────────────────────────────────────────────────────────────
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}


async function fetchDashboardStats() {
  // axiosInstance carries the JWT, picks up the api.db-world.in base URL,
  // and handles silent refresh on 401 — no need to repeat that here.
  const res = await axiosInstance.get('/api/admin/dashboard/stats');
  return res.data?.data;
}

// ─── Animation variants ────────────────────────────────────────────────────────
const fadeUp = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };
const stagger = { show: { transition: { staggerChildren: 0.06 } } };

// ─── StatCard ─────────────────────────────────────────────────────────────────
const StatCard = ({ icon, label, value, sub, color, onClick, loading, badge, pulse }) => {
  const T = useT();
  const IconEl = icon;
  return (
    <Card
      component={motion.div}
      variants={fadeUp}
      whileHover={{ y: -3, boxShadow: `0 8px 24px ${alpha(color, 0.18)}` }}
      transition={{ duration: 0.18 }}
      onClick={onClick}
      sx={{
        bgcolor: T.glass,
        border: `1px solid ${pulse ? alpha(color, 0.45) : T.border}`,
        borderRadius: 3,
        cursor: onClick ? 'pointer' : 'default',
        backdropFilter: 'blur(12px)',
        overflow: 'hidden',
        position: 'relative',
        animation: pulse ? 'statPulse 2.4s ease-in-out infinite' : 'none',
        '@keyframes statPulse': {
          '0%, 100%': { boxShadow: `0 0 0 0 ${alpha(color, 0.35)}` },
          '50%':      { boxShadow: `0 0 0 8px ${alpha(color, 0)}` },
        },
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0, left: 0, right: 0,
          height: 3,
          bgcolor: color,
          borderRadius: '12px 12px 0 0',
        },
      }}
    >
      <CardContent sx={{ p: { xs: 2, sm: 2.5 }, '&:last-child': { pb: { xs: 2, sm: 2.5 } } }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1.5 }}>
          <Box sx={{ p: 1, borderRadius: 1.5, bgcolor: alpha(color, 0.14), display: 'inline-flex' }}>
            <IconEl sx={{ fontSize: 20, color }} />
          </Box>
          {badge && (
            <Chip label={badge} size="small"
              sx={{ height: 18, fontSize: '0.58rem', fontWeight: 700, bgcolor: alpha(color, 0.18), color }} />
          )}
        </Box>
        {loading ? (
          <Skeleton variant="text" width={70} height={38} sx={{ bgcolor: alpha(T.text, 0.06) }} />
        ) : (
          <Typography sx={{ fontSize: { xs: '1.55rem', sm: '1.9rem' }, fontWeight: 800, color: T.text, lineHeight: 1 }}>
            {value ?? '—'}
          </Typography>
        )}
        <Typography sx={{ fontSize: '0.75rem', color: T.textMuted, mt: 0.5, fontWeight: 500 }}>{label}</Typography>
        {sub && (
          <Typography sx={{ fontSize: '0.68rem', color: alpha(color, 0.85), mt: 0.5, fontWeight: 500 }}>{sub}</Typography>
        )}
      </CardContent>
    </Card>
  );
};

// ─── NavTile ─────────────────────────────────────────────────────────────────
const NavTile = ({ section, onClick }) => {
  const T = useT();
  const { icon: IconEl, label, color, badge } = section;
  return (
    <Box
      component={motion.div}
      variants={fadeUp}
      whileHover={{ y: -2, boxShadow: `0 6px 20px ${alpha(color, 0.2)}` }}
      transition={{ duration: 0.16 }}
      onClick={onClick}
      sx={{
        p: { xs: 1.5, sm: 2 },
        borderRadius: 2.5,
        bgcolor: T.glass,
        border: `1px solid ${T.border}`,
        cursor: 'pointer',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 1,
        textAlign: 'center',
        position: 'relative',
        transition: 'border-color 0.2s',
        '&:hover': { borderColor: alpha(color, 0.45), bgcolor: alpha(color, 0.04) },
      }}
    >
      <Box sx={{ p: 1.2, borderRadius: 2, bgcolor: alpha(color, 0.14), display: 'inline-flex' }}>
        <IconEl sx={{ fontSize: 20, color }} />
      </Box>
      <Typography sx={{ fontSize: '0.72rem', color: T.text, fontWeight: 600, lineHeight: 1.2 }}>
        {label}
      </Typography>
      {badge && (
        <Chip label={badge} size="small"
          sx={{ height: 16, fontSize: '0.52rem', fontWeight: 700, bgcolor: alpha(A.red, 0.2), color: A.red,
            position: 'absolute', top: 6, right: 6, '& .MuiChip-label': { px: 0.7 } }} />
      )}
    </Box>
  );
};

// ─── SystemBar ─────────────────────────────────────────────────────────────────
const SystemBar = ({ label, value, color, loading }) => {
  const T = useT();
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography sx={{ fontSize: '0.72rem', color: T.textMuted }}>{label}</Typography>
        {loading
          ? <Skeleton variant="text" width={32} sx={{ bgcolor: alpha(T.text, 0.06) }} />
          : <Typography sx={{ fontSize: '0.72rem', color: T.text, fontWeight: 700 }}>
              {value != null ? `${value.toFixed(1)}%` : '—'}
            </Typography>}
      </Box>
      <LinearProgress
        variant={loading ? 'indeterminate' : 'determinate'}
        value={Math.min(value ?? 0, 100)}
        sx={{
          height: 5, borderRadius: 3,
          bgcolor: T.border,
          '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 3 },
        }}
      />
    </Box>
  );
};

// ─── Section header ────────────────────────────────────────────────────────────
const SectionHeader = ({ icon: IconEl, label, color, onAction, actionLabel }) => {
  const T = useT();
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={{ p: 0.6, borderRadius: 1, bgcolor: alpha(color, 0.14), display: 'inline-flex' }}>
          <IconEl sx={{ fontSize: 16, color }} />
        </Box>
        <Typography sx={{ fontWeight: 700, color: T.text, fontSize: '0.88rem' }}>{label}</Typography>
      </Box>
      {onAction && (
        <Chip
          label={actionLabel ?? 'View All'}
          size="small"
          onClick={onAction}
          icon={<ArrowForward sx={{ fontSize: '11px !important' }} />}
          sx={{
            bgcolor: alpha(color, 0.1), color, fontSize: '0.68rem',
            cursor: 'pointer', fontWeight: 600,
            '&:hover': { bgcolor: alpha(color, 0.2) },
          }}
        />
      )}
    </Box>
  );
};

// ─── Main ──────────────────────────────────────────────────────────────────────
const AdminDashboard = () => {
  const T = useT();
  const muiTheme = useTheme();
  const navigate = useNavigate();
  const { user, role } = useAuth();

  const isXs = useMediaQuery(muiTheme.breakpoints.down('sm'));
  const isSm = useMediaQuery(muiTheme.breakpoints.between('sm', 'md'));

  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [now,     setNow]     = useState(new Date());

  // Live pending counts (media + catalog) — drives the Pending Requests KPI card.
  const pending = usePendingRequestCounts();

  const nav = useCallback((path) => navigate(`${Constants.DB_ADMIN_BASE_ROUTE}/${path}`), [navigate]);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchDashboardStats()
      .then(setStats)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const s = stats;

  // Tags come from the backend as an array of active TagDefinition entries
  const tagEntries = useMemo(() => {
    if (!Array.isArray(s?.tags)) return [];
    return s.tags.map((t, i) => ({
      key:   t.tagType,
      label: t.displayName,
      count: t.count,
      color: ACCENTS[i % ACCENTS.length],
    }));
  }, [s?.tags]);

  // Nav tile columns: 4 on md+, 3 on sm, 2 on xs — computed from NAV_SECTIONS
  const navColumns = isXs ? 3 : isSm ? 4 : 6;

  const displayName = user?.username ?? user?.name ?? user?.email ?? 'Admin';
  const displayRole = role ? role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '';

  return (
    <Box sx={{ p: { xs: 2, sm: 2.5, md: 3 }, maxWidth: 1500, mx: 'auto', bgcolor: T.adminBg, minHeight: '100%' }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <Box
        component={motion.div}
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        sx={{
          display: 'flex', alignItems: { xs: 'flex-start', sm: 'center' },
          justifyContent: 'space-between', flexDirection: { xs: 'column', sm: 'row' },
          gap: 1.5, mb: 3,
        }}
      >
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.3 }}>
            <Typography sx={{ fontSize: { xs: '1.3rem', sm: '1.55rem' }, fontWeight: 800, color: T.text, lineHeight: 1 }}>
              {getGreeting()}, {displayName}
            </Typography>
            {now.getHours() < 18
              ? <WbSunny sx={{ fontSize: 20, color: A.amber }} />
              : <NightsStay sx={{ fontSize: 20, color: A.violet }} />}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography sx={{ fontSize: '0.78rem', color: T.textMuted }}>
              {now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
            </Typography>
            {displayRole && (
              <Chip label={displayRole} size="small"
                sx={{ height: 18, fontSize: '0.58rem', fontWeight: 700, bgcolor: T.tealBg, color: T.teal,
                  '& .MuiChip-label': { px: 1 } }} />
            )}
          </Box>
        </Box>
        <Tooltip title="Refresh data">
          <IconButton
            onClick={load}
            disabled={loading}
            sx={{
              color: T.textMuted, border: `1px solid ${T.border}`, borderRadius: 2,
              '&:hover': { color: T.teal, bgcolor: T.tealBg, borderColor: T.teal },
            }}
          >
            <Refresh sx={{
              fontSize: 18,
              animation: loading ? 'spin 1s linear infinite' : 'none',
              '@keyframes spin': { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } },
            }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* ── Error banner ─────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <Box sx={{ mb: 2.5, p: 1.5, borderRadius: 2, bgcolor: T.errorBg, border: `1px solid ${alpha(T.error, 0.3)}` }}>
              <Typography sx={{ fontSize: '0.8rem', color: T.error, fontWeight: 500 }}>{error}</Typography>
            </Box>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── KPI Cards ───────────────────────────────────────────────────────── */}
      <Box
        component={motion.div}
        variants={stagger}
        initial="hidden"
        animate="show"
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'repeat(2, 1fr)',
            sm: 'repeat(3, 1fr)',
            md: 'repeat(5, 1fr)',
          },
          gap: 2,
          mb: 3,
        }}
      >
        <StatCard
          icon={People} color={A.indigo}
          label="Total Users"
          value={s?.users?.total}
          sub={s?.users ? `${s.users.owners} Owners · ${s.users.admins} Admins · ${s.users.viewers} Viewers` : null}
          loading={loading}
          onClick={() => nav('users')}
        />
        <StatCard
          icon={Movie} color={A.cyan}
          label="Records"
          value={s?.records?.total}
          sub={s?.records ? `${s.records.movies} movies · ${s.records.series} series` : null}
          loading={loading}
          onClick={() => nav('records')}
        />
        <StatCard
          icon={VideoLibrary} color={A.violet}
          label="Media Files"
          value={s?.media?.totalFiles}
          loading={loading}
          onClick={() => nav('media-files')}
        />
        <StatCard
          icon={Sync} color={A.emerald}
          label="TMDB Synced"
          value={s?.sync?.synced}
          sub={s?.sync ? `${s.sync.pending} pending · ${s.sync.failed} failed` : null}
          badge={s?.sync?.failed > 0 ? `${s.sync.failed} failed` : null}
          loading={loading}
          onClick={() => nav('tmdb-sync')}
        />
        <StatCard
          icon={Inbox} color={A.red}
          label="Pending Requests"
          value={pending.total}
          sub={pending.total > 0
            ? `${pending.media} media · ${pending.catalog} new titles`
            : 'All caught up'}
          badge={pending.total > 0 ? `${pending.total} new` : null}
          loading={pending.isLoading}
          onClick={() => nav('requests')}
          pulse={pending.total > 0}
        />
      </Box>

      {/* ── Quick Navigation ────────────────────────────────────────────────── */}
      <Card
        component={motion.div}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.3 }}
        sx={{ bgcolor: T.glass, border: `1px solid ${T.border}`, borderRadius: 3, mb: 3, backdropFilter: 'blur(12px)' }}
      >
        <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <Box sx={{ p: 0.6, borderRadius: 1, bgcolor: T.tealBg, display: 'inline-flex' }}>
              <DashboardIcon sx={{ fontSize: 16, color: T.teal }} />
            </Box>
            <Typography sx={{ fontWeight: 700, color: T.text, fontSize: '0.88rem' }}>Quick Navigation</Typography>
          </Box>
          <Box
            component={motion.div}
            variants={stagger}
            initial="hidden"
            animate="show"
            sx={{ display: 'grid', gridTemplateColumns: `repeat(${navColumns}, 1fr)`, gap: { xs: 1, sm: 1.5 } }}
          >
            {NAV_SECTIONS.map(section => (
              <NavTile key={section.id} section={section} onClick={() => nav(section.path)} />
            ))}
          </Box>
        </CardContent>
      </Card>

      {/* ── Main content grid ────────────────────────────────────────────────── */}
      <Grid container spacing={2.5}>

        {/* Left column */}
        <Grid item xs={12} lg={8}>

          {/* Recent Records */}
          <Card sx={{ bgcolor: T.glass, border: `1px solid ${T.border}`, borderRadius: 3, mb: 2.5, backdropFilter: 'blur(12px)' }}>
            <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
              <SectionHeader icon={Movie} label="Recent Records" color={A.cyan} onAction={() => nav('records')} />
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {loading
                  ? Array.from({ length: 6 }).map((_, i) => (
                      <Skeleton key={i} variant="rectangular" height={48} sx={{ borderRadius: 1.5, bgcolor: alpha(T.text, 0.05) }} />
                    ))
                  : (s?.recentRecords ?? []).length === 0
                    ? <Typography sx={{ fontSize: '0.8rem', color: T.textMuted, py: 2, textAlign: 'center' }}>No recent records</Typography>
                    : (s.recentRecords).map((r) => (
                        <Box
                          key={r.id}
                          component={motion.div}
                          whileHover={{ x: 4 }}
                          transition={{ duration: 0.12 }}
                          sx={{
                            display: 'flex', alignItems: 'center', gap: 1.5,
                            p: 1, borderRadius: 1.5, cursor: 'pointer',
                            '&:hover': { bgcolor: T.glassHover },
                            transition: 'background 0.15s',
                          }}
                          onClick={() => nav('records')}
                        >
                          {r.tmdbPosterPath ? (
                            <Box
                              component="img"
                              src={`https://image.tmdb.org/t/p/w92${r.tmdbPosterPath}`}
                              sx={{ width: 30, height: 45, borderRadius: 0.75, objectFit: 'cover', flexShrink: 0 }}
                              onError={e => { e.target.style.display = 'none'; }}
                            />
                          ) : (
                            <Box sx={{ width: 30, height: 45, borderRadius: 0.75, bgcolor: T.border,
                              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              {r.type === 'SERIES'
                                ? <Tv sx={{ fontSize: 14, color: T.textMuted }} />
                                : <MovieIcon sx={{ fontSize: 14, color: T.textMuted }} />}
                            </Box>
                          )}
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography sx={{ fontSize: '0.82rem', color: T.text, fontWeight: 600,
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {r.name}
                            </Typography>
                            <Typography sx={{ fontSize: '0.65rem', color: T.textMuted }}>
                              {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : ''}
                            </Typography>
                          </Box>
                          <Chip
                            label={r.type === 'SERIES' ? 'Series' : 'Movie'}
                            size="small"
                            sx={{
                              height: 18, fontSize: '0.58rem', fontWeight: 700,
                              bgcolor: r.type === 'SERIES' ? alpha(A.violet, 0.18) : alpha(A.cyan, 0.18),
                              color: r.type === 'SERIES' ? A.violet : A.cyan,
                              '& .MuiChip-label': { px: 0.8 },
                            }}
                          />
                        </Box>
                      ))
                }
              </Box>
            </CardContent>
          </Card>

          {/* Content Tags — dynamic from API */}
          <Card sx={{ bgcolor: T.glass, border: `1px solid ${T.border}`, borderRadius: 3, backdropFilter: 'blur(12px)' }}>
            <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
              <SectionHeader icon={Label} label="Content Tags" color={A.amber} onAction={() => nav('tag-management')} actionLabel="Manage" />
              {loading ? (
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1.5 }}>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} variant="rectangular" height={56} sx={{ borderRadius: 1.5, bgcolor: alpha(T.text, 0.05) }} />
                  ))}
                </Box>
              ) : tagEntries.length === 0 ? (
                <Typography sx={{ fontSize: '0.8rem', color: T.textMuted, py: 2, textAlign: 'center' }}>No tag data</Typography>
              ) : (
                <Box
                  component={motion.div}
                  variants={stagger}
                  initial="hidden"
                  animate="show"
                  sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' }, gap: 1.5 }}
                >
                  {tagEntries.map(t => (
                    <Box
                      key={t.key}
                      component={motion.div}
                      variants={fadeUp}
                      onClick={() => nav('tag-management')}
                      sx={{
                        p: 1.5, borderRadius: 2, cursor: 'pointer',
                        bgcolor: alpha(t.color, 0.06),
                        border: `1px solid ${alpha(t.color, 0.15)}`,
                        '&:hover': { bgcolor: alpha(t.color, 0.12), borderColor: alpha(t.color, 0.3) },
                        transition: 'all 0.15s',
                      }}
                    >
                      <Typography sx={{ fontSize: '1.15rem', fontWeight: 800, color: t.color, lineHeight: 1 }}>
                        {t.count}
                      </Typography>
                      <Typography sx={{ fontSize: '0.67rem', color: T.textMuted, mt: 0.3 }}>{t.label}</Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Right column */}
        <Grid item xs={12} lg={4}>

          {/* System Health */}
          <Card sx={{ bgcolor: T.glass, border: `1px solid ${T.border}`, borderRadius: 3, mb: 2.5, backdropFilter: 'blur(12px)' }}>
            <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
              <SectionHeader icon={Computer} label="System Health" color={A.emerald} onAction={() => nav('system-info')} actionLabel="Details" />
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <SystemBar
                  label="CPU Usage"
                  value={s?.system?.cpuPercent}
                  color={s?.system?.cpuPercent > 80 ? A.red : s?.system?.cpuPercent > 60 ? A.amber : A.emerald}
                  loading={loading}
                />
                <SystemBar
                  label="JVM Memory"
                  value={s?.system?.memPercent}
                  color={s?.system?.memPercent > 80 ? A.red : s?.system?.memPercent > 60 ? A.amber : A.indigo}
                  loading={loading}
                />
              </Box>
              {s?.system && (
                <Box sx={{ mt: 2, pt: 1.5, borderTop: `1px solid ${T.border}`, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                  {[
                    { label: 'JVM Memory', value: `${s.system.memUsedMb} / ${s.system.memTotalMb} MB` },
                    { label: 'Uptime',     value: s.system.uptime },
                  ].map(row => (
                    <Box key={row.label} sx={{ textAlign: 'center', p: 1, borderRadius: 1.5, bgcolor: alpha(T.text, 0.03) }}>
                      <Typography sx={{ fontSize: '0.62rem', color: T.textMuted, mb: 0.3 }}>{row.label}</Typography>
                      <Typography sx={{ fontSize: '0.76rem', color: T.text, fontWeight: 700 }}>{row.value}</Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>

          {/* TMDB Sync */}
          <Card sx={{ bgcolor: T.glass, border: `1px solid ${T.border}`, borderRadius: 3, mb: 2.5, backdropFilter: 'blur(12px)' }}>
            <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
              <SectionHeader icon={Sync} label="TMDB Sync" color={A.cyan} onAction={() => nav('tmdb-sync')} actionLabel="Manage" />
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {[
                  { icon: CheckCircle, color: A.emerald, label: 'Synced',  val: s?.sync?.synced },
                  { icon: HourglassEmpty, color: A.amber, label: 'Pending', val: s?.sync?.pending },
                  { icon: Error,        color: A.red,    label: 'Failed',  val: s?.sync?.failed },
                ].map((row, idx, arr) => {
                  const RowIcon = row.icon;
                  return (
                    <Box key={row.label} sx={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      py: 1,
                      borderBottom: idx < arr.length - 1 ? `1px solid ${T.border}` : 'none',
                    }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        <RowIcon sx={{ fontSize: 15, color: row.color }} />
                        <Typography sx={{ fontSize: '0.78rem', color: T.textMuted }}>{row.label}</Typography>
                      </Box>
                      {loading
                        ? <Skeleton variant="text" width={32} sx={{ bgcolor: alpha(T.text, 0.06) }} />
                        : <Typography sx={{ fontSize: '0.9rem', fontWeight: 800, color: row.color }}>{row.val ?? '—'}</Typography>}
                    </Box>
                  );
                })}
              </Box>
              {s?.sync?.lastSyncedAt && (
                <Typography sx={{ fontSize: '0.63rem', color: T.textMuted, mt: 1.5, pt: 1, borderTop: `1px solid ${T.border}` }}>
                  Last sync: {new Date(s.sync.lastSyncedAt * 1000).toLocaleString()}
                </Typography>
              )}
            </CardContent>
          </Card>

          {/* Storage snapshot */}
          <Card sx={{ bgcolor: T.glass, border: `1px solid ${T.border}`, borderRadius: 3, backdropFilter: 'blur(12px)' }}>
            <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
              <SectionHeader icon={Storage} label="Storage Snapshot" color={A.violet} onAction={() => nav('media-files')} actionLabel="Files" />
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                {[
                  { label: 'Total Files', val: s?.media?.totalFiles, color: A.violet },
                  { label: 'Records',     val: s?.records?.total,    color: A.cyan   },
                  { label: 'Movies',      val: s?.records?.movies,   color: A.indigo },
                  { label: 'Series',      val: s?.records?.series,   color: A.emerald},
                ].map(item => (
                  <Box key={item.label} sx={{ p: 1.5, borderRadius: 2,
                    bgcolor: alpha(item.color, 0.07), border: `1px solid ${alpha(item.color, 0.15)}` }}>
                    {loading
                      ? <Skeleton variant="text" width={40} height={28} sx={{ bgcolor: alpha(T.text, 0.06) }} />
                      : <Typography sx={{ fontSize: '1.2rem', fontWeight: 800, color: item.color, lineHeight: 1 }}>
                          {item.val ?? '—'}
                        </Typography>}
                    <Typography sx={{ fontSize: '0.65rem', color: T.textMuted, mt: 0.3 }}>{item.label}</Typography>
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
