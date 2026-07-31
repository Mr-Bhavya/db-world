import React, { useEffect, useMemo, useState } from 'react';
import { Box, Typography, Chip, LinearProgress, Skeleton } from '@mui/material';
import {
  People, Movie, VideoLibrary, Sync, Inbox, Computer, Storage, Label,
  Tv, Movie as MovieIcon, WbSunny, NightsStay, Dashboard as DashboardIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { useT } from '@shared/theme';
import Constants from '@shared/constants';
import { useAuth } from '@features/auth/context/Authentication';
import axiosInstance from '@shared/components/ui/utils/AxiosInstants';
import usePendingRequestCounts from '@features/admin/requests/hooks/usePendingRequestCounts';
import { quickNavModules } from '@features/admin/adminModules';
import {
  AdminPage, StatCard, StatGrid, SectionCard, EmptyState, TableSkeleton, adminSurface,
} from '@features/admin/adminUi';

const getGreeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

const fetchDashboardStats = async () =>
  (await axiosInstance.get('/api/admin/dashboard/stats')).data?.data;

// Backend sends RecordType.name(): 'MOVIE' | 'TV_SERIES'. (Previously compared to
// 'SERIES', so every series showed as a Movie — fixed here.)
const isSeries = (type) => type === 'TV_SERIES' || type === 'SERIES';

// ─── Quick-nav tile (clean & flat, single teal accent) ───────────────────────
const NavTile = ({ module, pending, onClick, T }) => {
  const S = adminSurface(T);
  const Icon = module.icon;
  const dynamicBadge =
    module.id === 'requests' && pending > 0 ? String(pending)
      : module.badge === 'Live' ? 'Live'
      : null;
  return (
    <Box
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onClick()}
      sx={{
        position: 'relative', p: { xs: 1.5, sm: 1.75 }, borderRadius: 2.5,
        bgcolor: S.card, border: `1px solid ${S.border}`, cursor: 'pointer',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, textAlign: 'center',
        transition: 'border-color .18s, background-color .18s, transform .18s',
        '&:hover': { borderColor: T.teal, bgcolor: S.cardHover, transform: 'translateY(-2px)' },
        '&:focus-visible': { outline: `2px solid ${T.teal}`, outlineOffset: 2 },
      }}
    >
      <Box sx={{ width: 38, height: 38, borderRadius: 2, display: 'grid', placeItems: 'center', bgcolor: T.tealBg, color: T.teal }}>
        <Icon sx={{ fontSize: 20 }} />
      </Box>
      <Typography sx={{ fontSize: '0.72rem', color: T.text, fontWeight: 600, lineHeight: 1.2 }}>{module.label}</Typography>
      {dynamicBadge && (
        <Chip label={dynamicBadge} size="small"
          sx={{ position: 'absolute', top: 6, right: 6, height: 16, fontSize: '0.52rem', fontWeight: 800,
            bgcolor: module.id === 'requests' ? '#ef4444' : '#10b981', color: '#fff', '& .MuiChip-label': { px: 0.7 } }} />
      )}
    </Box>
  );
};

// ─── System usage bar ─────────────────────────────────────────────────────────
const SystemBar = ({ label, value, loading, T }) => {
  const color = value > 80 ? '#ef4444' : value > 60 ? '#f59e0b' : T.teal;
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography sx={{ fontSize: '0.72rem', color: T.textMuted }}>{label}</Typography>
        {loading ? <Skeleton variant="text" width={32} /> : (
          <Typography sx={{ fontSize: '0.72rem', color: T.text, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
            {value != null ? `${value.toFixed(1)}%` : '—'}
          </Typography>
        )}
      </Box>
      <LinearProgress variant={loading ? 'indeterminate' : 'determinate'} value={Math.min(value ?? 0, 100)}
        sx={{ height: 6, borderRadius: 3, bgcolor: T.border, '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 3 } }} />
    </Box>
  );
};

const AdminDashboard = () => {
  const T = useT();
  const S = adminSurface(T);
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const { user, role } = useAuth();
  const pending = usePendingRequestCounts();

  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const { data: s, isLoading: loading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['admin-dashboard-stats'],
    queryFn: fetchDashboardStats,
    staleTime: 60_000,
  });

  const nav = (path) => navigate(`${Constants.DB_ADMIN_BASE_ROUTE}/${path}`);

  const tagEntries = useMemo(() => (Array.isArray(s?.tags) ? s.tags : []), [s?.tags]);
  const modules = useMemo(() => quickNavModules(), []);

  const displayName = user?.username ?? user?.name ?? user?.email ?? 'Admin';
  const displayRole = role ? role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '';

  const roleChip = displayRole
    ? <Chip label={displayRole} size="small" sx={{ height: 22, fontSize: '0.62rem', fontWeight: 700, bgcolor: T.tealBg, color: T.teal }} />
    : null;

  return (
    <Box sx={{ bgcolor: S.page, minHeight: '100%' }}>
      <AdminPage
        title={`${getGreeting()}, ${displayName}`}
        subtitle={now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
        icon={now.getHours() < 18 ? WbSunny : NightsStay}
        actions={roleChip}
        onRefresh={refetch}
        refreshing={isFetching}
      >
        {isError && (
          <Box sx={{ mb: 2.5, p: 1.5, borderRadius: 2, bgcolor: T.errorBg, border: `1px solid ${T.error}44` }}>
            <Typography sx={{ fontSize: '0.8rem', color: T.error, fontWeight: 600 }}>
              {error?.message ?? 'Failed to load dashboard stats'}
            </Typography>
          </Box>
        )}

        {/* KPI cards */}
        <StatGrid min={170} sx={{ mb: 3 }}>
          <StatCard icon={People} label="Total Users" value={s?.users?.total} loading={loading} index={0}
            sub={s?.users ? `${s.users.owners} owners · ${s.users.admins} admins · ${s.users.viewers} viewers` : null}
            onClick={() => nav('users')} />
          <StatCard icon={Movie} label="Records" value={s?.records?.total} loading={loading} index={1}
            sub={s?.records ? `${s.records.movies} movies · ${s.records.series} series` : null}
            onClick={() => nav('records')} />
          <StatCard icon={VideoLibrary} label="Media Files" value={s?.media?.totalFiles} loading={loading} index={2}
            onClick={() => nav('media-files')} />
          <StatCard icon={Sync} label="TMDB Synced" value={s?.sync?.synced} loading={loading} index={3}
            sub={s?.sync ? `${s.sync.pending} pending · ${s.sync.failed} failed` : null}
            onClick={() => nav('records')} />
          <StatCard icon={Inbox} label="Pending Requests" value={pending.total} loading={pending.isLoading} index={4}
            accent={pending.total > 0 ? '#f59e0b' : T.teal}
            badge={pending.total > 0 ? `${pending.total} new` : null}
            sub={pending.total > 0 ? `${pending.media} media · ${pending.catalog} new titles` : 'All caught up'}
            onClick={() => nav('requests')} />
        </StatGrid>

        {/* Quick navigation — from the module registry */}
        <SectionCard title="Quick Navigation" icon={DashboardIcon} sx={{ mb: 3 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(3, 1fr)', sm: 'repeat(5, 1fr)', md: 'repeat(6, 1fr)' }, gap: { xs: 1, sm: 1.5 } }}>
            {modules.map((m) => (
              <NavTile key={m.id} module={m} pending={pending.total} onClick={() => nav(m.path)} T={T} />
            ))}
          </Box>
        </SectionCard>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 2fr) minmax(0, 1fr)' }, gap: 2.5, alignItems: 'start' }}>
          {/* Left column */}
          <Box sx={{ minWidth: 0 }}>
            <SectionCard title="Recent Records" icon={Movie} onAction={() => nav('records')} sx={{ mb: 2.5 }}>
              {loading ? (
                <TableSkeleton rows={6} />
              ) : (s?.recentRecords ?? []).length === 0 ? (
                <EmptyState icon={Movie} title="No recent records" message="Newly added titles will appear here." />
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                  {s.recentRecords.map((r) => {
                    const series = isSeries(r.type);
                    return (
                      <Box key={r.id} component={motion.div} whileHover={reduce ? undefined : { x: 3 }}
                        onClick={() => nav('records')}
                        sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1, borderRadius: 1.5, cursor: 'pointer', '&:hover': { bgcolor: S.cardHover } }}>
                        {r.tmdbPosterPath ? (
                          <Box component="img" src={`https://image.tmdb.org/t/p/w92${r.tmdbPosterPath}`}
                            sx={{ width: 30, height: 45, borderRadius: 0.75, objectFit: 'cover', flexShrink: 0 }}
                            onError={(e) => { e.target.style.display = 'none'; }} />
                        ) : (
                          <Box sx={{ width: 30, height: 45, borderRadius: 0.75, bgcolor: S.inset, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                            {series ? <Tv sx={{ fontSize: 14, color: T.textMuted }} /> : <MovieIcon sx={{ fontSize: 14, color: T.textMuted }} />}
                          </Box>
                        )}
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography sx={{ fontSize: '0.82rem', color: T.text, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</Typography>
                          <Typography sx={{ fontSize: '0.65rem', color: T.textMuted }}>{r.createdAt ? new Date(r.createdAt).toLocaleDateString() : ''}</Typography>
                        </Box>
                        <Chip label={series ? 'Series' : 'Movie'} size="small"
                          sx={{ height: 18, fontSize: '0.58rem', fontWeight: 700, bgcolor: T.tealBg, color: T.teal, '& .MuiChip-label': { px: 0.8 } }} />
                      </Box>
                    );
                  })}
                </Box>
              )}
            </SectionCard>
          </Box>

          {/* Right column */}
          <Box sx={{ minWidth: 0 }}>
            <SectionCard title="System Health" icon={Computer} actionLabel="Details" onAction={() => nav('system-info')} sx={{ mb: 2.5 }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <SystemBar label="CPU (process)" value={s?.system?.cpuPercent} loading={loading} T={T} />
                <SystemBar label="JVM Memory" value={s?.system?.memPercent} loading={loading} T={T} />
              </Box>
              {s?.system && (
                <Box sx={{ mt: 2, pt: 1.5, borderTop: `1px solid ${S.divider}`, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                  {[
                    { label: 'Memory', value: `${s.system.memUsedMb} / ${s.system.memTotalMb} MB` },
                    { label: 'Uptime', value: s.system.uptime },
                  ].map((row) => (
                    <Box key={row.label} sx={{ textAlign: 'center', p: 1, borderRadius: 1.5, bgcolor: S.inset }}>
                      <Typography sx={{ fontSize: '0.62rem', color: T.textMuted, mb: 0.3 }}>{row.label}</Typography>
                      <Typography sx={{ fontSize: '0.76rem', color: T.text, fontWeight: 700 }}>{row.value}</Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </SectionCard>

            <SectionCard title="TMDB Sync" icon={Sync} actionLabel="Records" onAction={() => nav('records')} sx={{ mb: 2.5 }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.5 }}>
                {[
                  { label: 'Synced', val: s?.sync?.synced, color: T.teal },
                  { label: 'Pending', val: s?.sync?.pending, color: s?.sync?.pending > 0 ? '#f59e0b' : T.textMuted },
                  { label: 'Failed', val: s?.sync?.failed, color: s?.sync?.failed > 0 ? '#ef4444' : T.textMuted },
                ].map((item) => (
                  <Box key={item.label} sx={{ p: 1.25, borderRadius: 2, bgcolor: S.inset, border: `1px solid ${S.border}`, textAlign: 'center' }}>
                    {loading
                      ? <Skeleton variant="text" width={28} height={26} sx={{ bgcolor: S.card, mx: 'auto' }} />
                      : <Typography sx={{ fontSize: '1.1rem', fontWeight: 800, color: item.color, lineHeight: 1 }}>{item.val ?? '—'}</Typography>}
                    <Typography sx={{ fontSize: '0.62rem', color: T.textMuted, mt: 0.3 }}>{item.label}</Typography>
                  </Box>
                ))}
              </Box>
              {s?.sync?.lastSyncedAt && (
                <Typography sx={{ fontSize: '0.68rem', color: T.textFaint, mt: 1.5, textAlign: 'center' }}>
                  Last synced {new Date(s.sync.lastSyncedAt).toLocaleString()}
                </Typography>
              )}
            </SectionCard>

            <SectionCard title="Storage Snapshot" icon={Storage} actionLabel="Files" onAction={() => nav('media-files')}>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                {[
                  { label: 'Total Files', val: s?.media?.totalFiles },
                  { label: 'Records', val: s?.records?.total },
                  { label: 'Movies', val: s?.records?.movies },
                  { label: 'Series', val: s?.records?.series },
                ].map((item) => (
                  <Box key={item.label} sx={{ p: 1.5, borderRadius: 2, bgcolor: S.inset, border: `1px solid ${S.border}` }}>
                    {loading
                      ? <Skeleton variant="text" width={40} height={28} sx={{ bgcolor: S.card }} />
                      : <Typography sx={{ fontSize: '1.2rem', fontWeight: 800, color: T.teal, lineHeight: 1 }}>{item.val ?? '—'}</Typography>}
                    <Typography sx={{ fontSize: '0.65rem', color: T.textMuted, mt: 0.3 }}>{item.label}</Typography>
                  </Box>
                ))}
              </Box>
            </SectionCard>
          </Box>
        </Box>

        {/* Content Tags — full width so the row below the columns uses all space */}
        <SectionCard title="Content Tags" icon={Label} actionLabel="Manage" onAction={() => nav('tag-management')} sx={{ mt: 2.5 }}>
          {loading ? (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(3, 1fr)', sm: 'repeat(auto-fill, minmax(120px, 1fr))' }, gap: 1.5 }}>
              {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} variant="rounded" height={56} sx={{ bgcolor: S.inset, borderRadius: 1.5 }} />)}
            </Box>
          ) : tagEntries.length === 0 ? (
            <EmptyState icon={Label} title="No tag data" />
          ) : (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(3, 1fr)', sm: 'repeat(auto-fill, minmax(120px, 1fr))' }, gap: 1.5 }}>
              {tagEntries.map((t) => (
                <Box key={t.tagType} onClick={() => nav('tag-management')}
                  sx={{ p: 1.5, borderRadius: 2, cursor: 'pointer', bgcolor: S.inset, border: `1px solid ${S.border}`,
                    transition: 'border-color .15s, background-color .15s', '&:hover': { borderColor: T.teal, bgcolor: S.cardHover } }}>
                  <Typography sx={{ fontSize: '1.15rem', fontWeight: 800, color: T.teal, lineHeight: 1 }}>{t.count}</Typography>
                  <Typography sx={{ fontSize: '0.67rem', color: T.textMuted, mt: 0.3 }}>{t.displayName}</Typography>
                </Box>
              ))}
            </Box>
          )}
        </SectionCard>
      </AdminPage>
    </Box>
  );
};

export default AdminDashboard;
