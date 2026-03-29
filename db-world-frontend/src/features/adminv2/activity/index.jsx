// db-world-frontend/src/features/adminv2/activity/index.jsx
import { useState, useMemo } from 'react';
import {
  Box, Typography, Grid, Card, CardContent, Chip, Avatar, IconButton,
  Tooltip, TextField, MenuItem, Tab, Tabs, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, LinearProgress, Skeleton,
  InputAdornment, Collapse, Divider, Badge, useMediaQuery, useTheme,
} from '@mui/material';
import DownloadIcon    from '@mui/icons-material/Download';
import PlayArrowIcon   from '@mui/icons-material/PlayArrow';
import SearchIcon      from '@mui/icons-material/Search';
import PeopleIcon      from '@mui/icons-material/People';
import StorageIcon     from '@mui/icons-material/Storage';
import ExpandMoreIcon  from '@mui/icons-material/ExpandMore';
import ExpandLessIcon  from '@mui/icons-material/ExpandLess';
import RefreshIcon     from '@mui/icons-material/Refresh';
import TrendingUpIcon  from '@mui/icons-material/TrendingUp';
import LinkIcon        from '@mui/icons-material/Link';
import { useQuery }    from '@tanstack/react-query';
import {
  fetchDashboardStats, fetchAllRecent, fetchUserList,
  ACTIVITY_TYPES, TIME_RANGES, TYPE_META,
  formatBytes, formatTimeAgo, getFileName,
} from './activityApi';

// ─── Stat Card ───────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub, color, loading }) {
  return (
    <Card elevation={0} sx={{ border: '1px solid rgba(0,0,0,0.07)', borderRadius: 2, bgcolor: '#ffffff', height: '100%' }}>
      <CardContent sx={{ p: { xs: 2, md: 2.5 }, '&:last-child': { pb: { xs: 2, md: 2.5 } } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <Typography sx={{ fontSize: 12, color: 'rgba(15,23,42,0.5)', fontWeight: 500, mb: .5 }}>{label}</Typography>
            {loading
              ? <Skeleton width={80} height={36} />
              : <Typography sx={{ fontSize: { xs: 22, md: 28 }, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{value}</Typography>
            }
            {sub && <Typography sx={{ fontSize: 11, color: 'rgba(15,23,42,0.4)', mt: .5 }}>{sub}</Typography>}
          </Box>
          <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

// ─── Activity Row ─────────────────────────────────────────────────────────────
function ActivityRow({ activity, showUser = true }) {
  const [open, setOpen] = useState(false);
  const meta = TYPE_META[activity.activityType] ?? { color: '#6b7280', bg: 'rgba(107,114,128,0.1)', label: activity.activityType };
  const fileName = getFileName(activity.filePath || activity.activityValue);
  const isSearch = activity.activityType === 'SEARCH';
  const hasDetails = activity.bytesTransferred || activity.fileSize || activity.updateCount > 1;

  return (
    <>
      <TableRow
        hover
        sx={{ '& td': { borderColor: 'rgba(0,0,0,0.05)', py: 1.25 }, cursor: hasDetails ? 'pointer' : 'default' }}
        onClick={() => hasDetails && setOpen(o => !o)}
      >
        {/* Type badge */}
        <TableCell sx={{ width: 110, pl: 2 }}>
          <Chip
            size="small"
            label={meta.label}
            icon={
              activity.activityType === 'DOWNLOAD' ? <DownloadIcon sx={{ fontSize: '12px !important' }} /> :
              activity.activityType === 'STREAM'   ? <PlayArrowIcon sx={{ fontSize: '12px !important' }} /> :
              <SearchIcon sx={{ fontSize: '12px !important' }} />
            }
            sx={{ bgcolor: meta.bg, color: meta.color, fontWeight: 700, fontSize: 11, height: 22, '& .MuiChip-icon': { color: meta.color } }}
          />
        </TableCell>

        {/* File / keyword */}
        <TableCell sx={{ maxWidth: { xs: 120, sm: 220, md: 320 } }}>
          <Tooltip title={activity.filePath || activity.activityValue || ''} placement="top">
            <Typography sx={{ fontSize: 13, fontWeight: 500, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {isSearch ? `🔍 ${activity.activityValue}` : fileName}
            </Typography>
          </Tooltip>
          {!isSearch && activity.fileSize > 0 && (
            <Typography sx={{ fontSize: 11, color: 'rgba(15,23,42,0.4)' }}>{formatBytes(activity.fileSize)}</Typography>
          )}
        </TableCell>

        {/* User */}
        {showUser && (
          <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Avatar sx={{ width: 24, height: 24, bgcolor: '#0d9488', fontSize: 11 }}>
                {activity.userEmail?.[0]?.toUpperCase() ?? '?'}
              </Avatar>
              <Typography sx={{ fontSize: 12, color: 'rgba(15,23,42,0.7)' }}>{activity.userEmail}</Typography>
            </Box>
          </TableCell>
        )}

        {/* Bytes + connections */}
        <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
          {activity.bytesTransferred > 0 && (
            <Box>
              <Typography sx={{ fontSize: 12, color: '#0f172a' }}>{formatBytes(activity.bytesTransferred)}</Typography>
              {activity.updateCount > 1 && (
                <Chip label={`${activity.updateCount} conn`} size="small"
                  icon={<LinkIcon sx={{ fontSize: '10px !important' }} />}
                  sx={{ height: 16, fontSize: 9, mt: .25, bgcolor: 'rgba(13,148,136,0.08)', color: '#0d9488', '& .MuiChip-icon': { color: '#0d9488' } }} />
              )}
            </Box>
          )}
        </TableCell>

        {/* Time */}
        <TableCell sx={{ whiteSpace: 'nowrap', pr: 2 }}>
          <Typography sx={{ fontSize: 12, color: 'rgba(15,23,42,0.5)' }}>{formatTimeAgo(activity.lastUpdated)}</Typography>
        </TableCell>

        {/* Expand */}
        {hasDetails && (
          <TableCell sx={{ width: 36, pr: 1 }}>
            <IconButton size="small" sx={{ color: 'rgba(15,23,42,0.3)' }}>
              {open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
            </IconButton>
          </TableCell>
        )}
      </TableRow>

      {/* Expanded details */}
      {hasDetails && (
        <TableRow>
          <TableCell colSpan={6} sx={{ p: 0, borderBottom: open ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
            <Collapse in={open} timeout="auto">
              <Box sx={{ bgcolor: 'rgba(13,148,136,0.03)', px: 3, py: 1.5, display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                {activity.filePath && (
                  <Box>
                    <Typography sx={{ fontSize: 10, color: 'rgba(15,23,42,0.4)', textTransform: 'uppercase', letterSpacing: .5, mb: .25 }}>Path</Typography>
                    <Typography sx={{ fontSize: 12, color: '#0f172a', fontFamily: 'monospace', wordBreak: 'break-all' }}>{activity.filePath}</Typography>
                  </Box>
                )}
                {activity.sessionId && (
                  <Box>
                    <Typography sx={{ fontSize: 10, color: 'rgba(15,23,42,0.4)', textTransform: 'uppercase', letterSpacing: .5, mb: .25 }}>Session</Typography>
                    <Typography sx={{ fontSize: 11, color: 'rgba(15,23,42,0.6)', fontFamily: 'monospace' }}>{activity.sessionId?.slice(-32)}</Typography>
                  </Box>
                )}
                {activity.remoteAddr && (
                  <Box>
                    <Typography sx={{ fontSize: 10, color: 'rgba(15,23,42,0.4)', textTransform: 'uppercase', letterSpacing: .5, mb: .25 }}>IP</Typography>
                    <Typography sx={{ fontSize: 12, color: '#0f172a' }}>{activity.remoteAddr}</Typography>
                  </Box>
                )}
                {activity.updateCount > 1 && (
                  <Box>
                    <Typography sx={{ fontSize: 10, color: 'rgba(15,23,42,0.4)', textTransform: 'uppercase', letterSpacing: .5, mb: .25 }}>Connections</Typography>
                    <Chip label={`${activity.updateCount} parallel connections merged`} size="small" sx={{ bgcolor: 'rgba(13,148,136,0.1)', color: '#0d9488', fontSize: 11 }} />
                  </Box>
                )}
                {activity.createdTime && (
                  <Box>
                    <Typography sx={{ fontSize: 10, color: 'rgba(15,23,42,0.4)', textTransform: 'uppercase', letterSpacing: .5, mb: .25 }}>Started</Typography>
                    <Typography sx={{ fontSize: 12, color: 'rgba(15,23,42,0.6)' }}>{new Date(activity.createdTime).toLocaleString()}</Typography>
                  </Box>
                )}
              </Box>
            </Collapse>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

// ─── Top Users Table ──────────────────────────────────────────────────────────
function TopUsersTable({ users = [], loading }) {
  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: .5, color: 'rgba(15,23,42,0.5)', borderColor: 'rgba(0,0,0,0.07)' }}>User</TableCell>
            <TableCell align="center" sx={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: .5, color: '#0d9488', borderColor: 'rgba(0,0,0,0.07)' }}>DL</TableCell>
            <TableCell align="center" sx={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: .5, color: '#3b82f6', borderColor: 'rgba(0,0,0,0.07)' }}>Stream</TableCell>
            <TableCell align="center" sx={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: .5, color: '#f59e0b', borderColor: 'rgba(0,0,0,0.07)' }}>Search</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {loading
            ? Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {[1,1,1,1].map((_, j) => <TableCell key={j}><Skeleton /></TableCell>)}
                </TableRow>
              ))
            : users.slice(0, 8).map((u, i) => (
                <TableRow key={i} hover sx={{ '& td': { borderColor: 'rgba(0,0,0,0.05)' } }}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Avatar sx={{ width: 24, height: 24, bgcolor: '#0d9488', fontSize: 11 }}>
                        {u.userEmail?.[0]?.toUpperCase() ?? '?'}
                      </Avatar>
                      <Typography sx={{ fontSize: 12, color: '#0f172a' }}>{u.userEmail}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell align="center"><Typography sx={{ fontSize: 12, fontWeight: 700, color: '#0d9488' }}>{u.downloadCount ?? 0}</Typography></TableCell>
                  <TableCell align="center"><Typography sx={{ fontSize: 12, fontWeight: 700, color: '#3b82f6' }}>{u.streamCount ?? 0}</Typography></TableCell>
                  <TableCell align="center"><Typography sx={{ fontSize: 12, fontWeight: 700, color: '#f59e0b' }}>{u.searchCount ?? 0}</Typography></TableCell>
                </TableRow>
              ))
          }
          {!loading && users.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} align="center" sx={{ color: 'rgba(15,23,42,0.35)', py: 3, fontSize: 13 }}>No data</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

// ─── Top Files ────────────────────────────────────────────────────────────────
function TopFilesSection({ files = [], loading }) {
  const max = Math.max(...files.map(f => f.downloadCount ?? 0), 1);
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {loading
        ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} height={40} />)
        : files.slice(0, 8).map((f, i) => (
            <Box key={i}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: .5 }}>
                <Tooltip title={f.filePath || f.fileName || ''}>
                  <Typography sx={{ fontSize: 12, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '75%' }}>
                    {getFileName(f.filePath || f.fileName)}
                  </Typography>
                </Tooltip>
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#0d9488', ml: 1 }}>{f.downloadCount}</Typography>
              </Box>
              <LinearProgress variant="determinate" value={(f.downloadCount / max) * 100}
                sx={{ height: 4, borderRadius: 2, bgcolor: 'rgba(13,148,136,0.1)', '& .MuiLinearProgress-bar': { bgcolor: '#0d9488' } }} />
            </Box>
          ))
      }
      {!loading && files.length === 0 && (
        <Typography sx={{ fontSize: 13, color: 'rgba(15,23,42,0.35)', textAlign: 'center', py: 2 }}>No data</Typography>
      )}
    </Box>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CinemaActivity() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [tab,          setTab]          = useState(0);
  const [hours,        setHours]        = useState(24);
  const [activityType, setActivityType] = useState('');
  const [search,       setSearch]       = useState('');
  const [limit,        setLimit]        = useState(100);

  const days = Math.max(1, Math.round(hours / 24));

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ['cinema-stats', days],
    queryFn: () => fetchDashboardStats(days),
    staleTime: 30_000,
  });

  const { data: recentRaw, isLoading: recentLoading, refetch: refetchRecent } = useQuery({
    queryKey: ['cinema-recent', hours, activityType, limit],
    queryFn: () => fetchAllRecent({ limit, activityType, hours }),
    staleTime: 15_000,
  });

  const { data: usersRaw, isLoading: usersLoading } = useQuery({
    queryKey: ['cinema-users', hours],
    queryFn: () => fetchUserList(hours),
    staleTime: 30_000,
  });

  const activities = useMemo(() => {
    const list = recentRaw?.activities ?? [];
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(a =>
      getFileName(a.filePath || a.activityValue)?.toLowerCase().includes(q) ||
      a.userEmail?.toLowerCase().includes(q) ||
      a.activityValue?.toLowerCase().includes(q)
    );
  }, [recentRaw, search]);

  const users = usersRaw?.users ?? [];
  const topFiles  = stats?.topFiles  ?? [];
  const keywords  = stats?.popularKeywords ?? [];

  const handleRefresh = () => { refetchStats(); refetchRecent(); };

  return (
    <Box sx={{ bgcolor: '#f0f9f8', minHeight: '100%', p: { xs: 2, md: 3 } }}>

      {/* ── Header ── */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3, flexWrap: 'wrap', gap: 1.5 }}>
        <Box>
          <Typography sx={{ fontWeight: 800, fontSize: { xs: 20, md: 26 }, color: '#0f172a' }}>Cinema Activity</Typography>
          <Typography sx={{ fontSize: 13, color: 'rgba(15,23,42,0.5)', mt: .25 }}>
            Track downloads, streams, and searches · deduplicates parallel connections
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Time range */}
          <TextField select size="small" value={hours} onChange={e => setHours(Number(e.target.value))}
            sx={{ minWidth: 130, bgcolor: '#fff', borderRadius: 1,
              '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'rgba(0,0,0,0.15)' }, '&.Mui-focused fieldset': { borderColor: '#0d9488' } },
            }}>
            {TIME_RANGES.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
          </TextField>
          {/* Activity type */}
          <TextField select size="small" value={activityType} onChange={e => setActivityType(e.target.value)}
            sx={{ minWidth: 130, bgcolor: '#fff', borderRadius: 1,
              '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'rgba(0,0,0,0.15)' }, '&.Mui-focused fieldset': { borderColor: '#0d9488' } },
            }}>
            {ACTIVITY_TYPES.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
          </TextField>
          <Tooltip title="Refresh">
            <IconButton onClick={handleRefresh} sx={{ bgcolor: '#fff', border: '1px solid rgba(0,0,0,0.12)', color: '#0d9488' }}>
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* ── Stat cards ── */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { icon: <TrendingUpIcon sx={{ fontSize: 22, color: '#0d9488' }} />, label: 'Total Activities', value: stats?.totalActivities ?? '—',  color: '#0d9488', sub: `Last ${hours}h` },
          { icon: <DownloadIcon   sx={{ fontSize: 22, color: '#0d9488' }} />, label: 'Downloads',        value: stats?.totalDownloads ?? '—',   color: '#0d9488', sub: formatBytes(stats?.totalBytesTransferred) },
          { icon: <PlayArrowIcon  sx={{ fontSize: 22, color: '#3b82f6' }} />, label: 'Streams',          value: stats?.totalStreams ?? '—',     color: '#3b82f6', sub: `Sessions` },
          { icon: <SearchIcon     sx={{ fontSize: 22, color: '#f59e0b' }} />, label: 'Searches',         value: stats?.totalSearches ?? '—',   color: '#f59e0b', sub: `Queries` },
          { icon: <PeopleIcon     sx={{ fontSize: 22, color: '#8b5cf6' }} />, label: 'Active Users',     value: stats?.activeUsers ?? '—',     color: '#8b5cf6', sub: `Unique users` },
          { icon: <StorageIcon    sx={{ fontSize: 22, color: '#10b981' }} />, label: 'Data Transferred', value: formatBytes(stats?.totalBytesTransferred), color: '#10b981', sub: `Total` },
        ].map((s, i) => (
          <Grid item xs={6} sm={4} md={2} key={i}>
            <StatCard {...s} loading={statsLoading} />
          </Grid>
        ))}
      </Grid>

      {/* ── Tabs ── */}
      <Card elevation={0} sx={{ border: '1px solid rgba(0,0,0,0.07)', borderRadius: 2, bgcolor: '#ffffff', overflow: 'hidden' }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{
          borderBottom: '1px solid rgba(0,0,0,0.07)',
          '& .MuiTab-root': { textTransform: 'none', fontSize: 13, fontWeight: 600, color: 'rgba(15,23,42,0.55)', minHeight: 48 },
          '& .Mui-selected': { color: '#0d9488' },
          '& .MuiTabs-indicator': { bgcolor: '#0d9488' },
        }}>
          <Tab label="Activity Feed" />
          <Tab label="Active Users" />
          <Tab label="Top Files" />
          {keywords.length > 0 && <Tab label="Keywords" />}
        </Tabs>

        {/* ── Activity Feed ── */}
        {tab === 0 && (
          <Box>
            {/* Search + limit */}
            <Box sx={{ display: 'flex', gap: 1.5, p: 2, borderBottom: '1px solid rgba(0,0,0,0.06)', flexWrap: 'wrap', alignItems: 'center' }}>
              <TextField size="small" placeholder="Search files, users, keywords…" value={search} onChange={e => setSearch(e.target.value)}
                sx={{ flex: '1 1 220px', '& .MuiOutlinedInput-root': { bgcolor: '#fafafa', '& fieldset': { borderColor: 'rgba(0,0,0,0.12)' }, '&.Mui-focused fieldset': { borderColor: '#0d9488' } } }}
                InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 16, color: 'rgba(15,23,42,0.35)' }} /></InputAdornment> }}
              />
              <TextField select size="small" label="Show" value={limit} onChange={e => setLimit(Number(e.target.value))}
                sx={{ minWidth: 90, '& .MuiOutlinedInput-root': { bgcolor: '#fafafa', '& fieldset': { borderColor: 'rgba(0,0,0,0.12)' }, '&.Mui-focused fieldset': { borderColor: '#0d9488' } } }}>
                {[50, 100, 200, 500].map(n => <MenuItem key={n} value={n}>{n}</MenuItem>)}
              </TextField>
              <Typography sx={{ fontSize: 12, color: 'rgba(15,23,42,0.45)', ml: 'auto' }}>
                {activities.length} {search ? 'filtered' : ''} activities
              </Typography>
            </Box>

            {recentLoading && <LinearProgress sx={{ '& .MuiLinearProgress-bar': { bgcolor: '#0d9488' } }} />}

            <TableContainer sx={{ maxHeight: { xs: 400, md: 600 }, overflowY: 'auto' }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ width: 110, pl: 2, fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: .5, color: 'rgba(15,23,42,0.5)', bgcolor: '#fafffe', borderColor: 'rgba(0,0,0,0.07)' }}>Type</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: .5, color: 'rgba(15,23,42,0.5)', bgcolor: '#fafffe', borderColor: 'rgba(0,0,0,0.07)' }}>File / Search</TableCell>
                    <TableCell sx={{ display: { xs: 'none', md: 'table-cell' }, fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: .5, color: 'rgba(15,23,42,0.5)', bgcolor: '#fafffe', borderColor: 'rgba(0,0,0,0.07)' }}>User</TableCell>
                    <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' }, fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: .5, color: 'rgba(15,23,42,0.5)', bgcolor: '#fafffe', borderColor: 'rgba(0,0,0,0.07)' }}>Transferred</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: .5, color: 'rgba(15,23,42,0.5)', bgcolor: '#fafffe', borderColor: 'rgba(0,0,0,0.07)', pr: 2 }}>When</TableCell>
                    <TableCell sx={{ width: 36, bgcolor: '#fafffe', borderColor: 'rgba(0,0,0,0.07)' }} />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {!recentLoading && activities.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 6, color: 'rgba(15,23,42,0.35)', fontSize: 14 }}>
                        No activities found
                      </TableCell>
                    </TableRow>
                  )}
                  {recentLoading && Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      {[110, '40%', '20%', 80, 80].map((w, j) => (
                        <TableCell key={j}><Skeleton width={w} /></TableCell>
                      ))}
                    </TableRow>
                  ))}
                  {activities.map((a, i) => <ActivityRow key={a.id ?? i} activity={a} />)}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {/* ── Active Users ── */}
        {tab === 1 && (
          <Box sx={{ p: { xs: 1.5, md: 2 } }}>
            <Typography sx={{ fontSize: 12, color: 'rgba(15,23,42,0.45)', mb: 2 }}>
              Top users by activity in the last {hours}h — DL = downloads, connections counted once per session
            </Typography>
            <TopUsersTable users={users} loading={usersLoading} />
          </Box>
        )}

        {/* ── Top Files ── */}
        {tab === 2 && (
          <Box sx={{ p: { xs: 2, md: 3 } }}>
            <Typography sx={{ fontSize: 12, color: 'rgba(15,23,42,0.45)', mb: 2 }}>
              Most downloaded files — each download counted once regardless of parallel connections
            </Typography>
            <TopFilesSection files={topFiles} loading={statsLoading} />
          </Box>
        )}

        {/* ── Keywords ── */}
        {tab === 3 && (
          <Box sx={{ p: { xs: 2, md: 3 } }}>
            <Typography sx={{ fontSize: 12, color: 'rgba(15,23,42,0.45)', mb: 2 }}>Popular search keywords</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
              {keywords.map((k, i) => (
                <Chip
                  key={i}
                  label={`${k.keyword} (${k.count})`}
                  icon={<SearchIcon sx={{ fontSize: '14px !important' }} />}
                  sx={{
                    bgcolor: 'rgba(245,158,11,0.1)', color: '#b45309',
                    fontWeight: 600, fontSize: 12,
                    border: '1px solid rgba(245,158,11,0.2)',
                    '& .MuiChip-icon': { color: '#b45309' },
                  }}
                />
              ))}
              {keywords.length === 0 && !statsLoading && (
                <Typography sx={{ fontSize: 13, color: 'rgba(15,23,42,0.35)' }}>No search data</Typography>
              )}
            </Box>
          </Box>
        )}
      </Card>
    </Box>
  );
}
