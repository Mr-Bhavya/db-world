import React, { useState } from 'react';
import {
  Box, Typography, Grid, Card, CardContent, Chip, IconButton,
  Tooltip, TextField, MenuItem, Skeleton,
} from '@mui/material';
import DownloadIcon    from '@mui/icons-material/CloudDownload';
import PlayArrowIcon   from '@mui/icons-material/PlayArrow';
import SearchIcon      from '@mui/icons-material/Search';
import PeopleIcon      from '@mui/icons-material/People';
import StorageIcon     from '@mui/icons-material/Storage';
import TrendingUpIcon  from '@mui/icons-material/TrendingUp';
import HttpIcon        from '@mui/icons-material/Http';
import SpeedIcon       from '@mui/icons-material/Speed';
import RefreshIcon     from '@mui/icons-material/Refresh';
import MovieFilterIcon from '@mui/icons-material/MovieFilter';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useT }        from '@shared/theme/ThemeContext';
import {
  fetchCinemaDashboard, ACTIVITY_TYPES, TIME_RANGES, fmtBytes,
} from './activityApi';
import CinemaFeed  from './CinemaFeed';
import ApiLogsFeed from './ApiLogsFeed';

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub, color, loading }) {
  const T = useT();
  return (
    <Card elevation={0} sx={{ border: `1px solid ${T.border}`, borderRadius: 2, bgcolor: T.glass, height: '100%' }}>
      <CardContent sx={{ p: { xs: 1.75, md: 2.25 }, '&:last-child': { pb: { xs: 1.75, md: 2.25 } } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: 11, color: T.textFaint, fontWeight: 500, mb: 0.4, whiteSpace: 'nowrap' }}>
              {label}
            </Typography>
            {loading
              ? <Skeleton width={72} height={30} />
              : <Typography sx={{ fontSize: { xs: 20, md: 26 }, fontWeight: 800, color: T.text, lineHeight: 1 }}>
                  {value ?? '—'}
                </Typography>
            }
            {sub && (
              <Typography sx={{ fontSize: 10, color: T.textFaint, mt: 0.4 }}>{sub}</Typography>
            )}
          </Box>
          <Box sx={{
            width: 40, height: 40, flexShrink: 0, ml: 1,
            borderRadius: 2, bgcolor: `${color}18`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

// ─── Section tab button ───────────────────────────────────────────────────────
function SectionTab({ id, icon, label, active, onClick }) {
  const T = useT();
  return (
    <Box
      onClick={() => onClick(id)}
      sx={{
        display: 'flex', alignItems: 'center', gap: 1,
        px: { xs: 1.5, sm: 2.5 }, py: { xs: 1.5, sm: 2 },
        cursor: 'pointer', userSelect: 'none',
        borderBottom: active ? '2px solid #0d9488' : '2px solid transparent',
        color: active ? '#0d9488' : T.textMuted,
        fontWeight: active ? 700 : 500,
        fontSize: { xs: 12, sm: 14 },
        transition: 'all .15s',
        '&:hover': { color: '#0d9488' },
        whiteSpace: 'nowrap',
      }}
    >
      {React.cloneElement(icon, { sx: { fontSize: { xs: 16, sm: 18 } } })}
      {label}
    </Box>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ActivityCenter() {
  const T   = useT();
  const qc  = useQueryClient();

  const [section,      setSection]      = useState('cinema');
  const [hours,        setHours]        = useState(24);
  const [activityType, setActivityType] = useState('');

  const days = Math.max(1, Math.round(hours / 24));

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['cinema-dashboard', days],
    queryFn:  () => fetchCinemaDashboard(days),
    staleTime: 30_000,
  });

  const handleRefresh = () => {
    qc.invalidateQueries({ queryKey: ['cinema-dashboard'] });
    qc.invalidateQueries({ queryKey: ['cinema-recent'] });
    qc.invalidateQueries({ queryKey: ['cinema-users'] });
    qc.invalidateQueries({ queryKey: ['api-logs'] });
  };

  const statCards = section === 'cinema' ? [
    { icon: <TrendingUpIcon sx={{ fontSize: 20, color: '#0d9488' }} />, color: '#0d9488', label: 'Total Activities', value: stats?.totalActivities,          sub: `Last ${hours}h` },
    { icon: <DownloadIcon   sx={{ fontSize: 20, color: '#0d9488' }} />, color: '#0d9488', label: 'Downloads',        value: stats?.totalDownloads,            sub: fmtBytes(stats?.totalBytesTransferred) },
    { icon: <PlayArrowIcon  sx={{ fontSize: 20, color: '#3b82f6' }} />, color: '#3b82f6', label: 'Streams',          value: stats?.totalStreams,               sub: 'sessions' },
    { icon: <SearchIcon     sx={{ fontSize: 20, color: '#f59e0b' }} />, color: '#f59e0b', label: 'Searches',         value: stats?.totalSearches,             sub: 'queries' },
    { icon: <PeopleIcon     sx={{ fontSize: 20, color: '#8b5cf6' }} />, color: '#8b5cf6', label: 'Active Users',     value: stats?.activeUsers,               sub: 'unique' },
    { icon: <StorageIcon    sx={{ fontSize: 20, color: '#10b981' }} />, color: '#10b981', label: 'Data Transferred', value: fmtBytes(stats?.totalBytesTransferred), sub: 'total' },
  ] : [
    { icon: <HttpIcon    sx={{ fontSize: 20, color: '#3b82f6' }} />, color: '#3b82f6', label: 'API Requests',  value: '—', sub: 'all endpoints' },
    { icon: <SpeedIcon   sx={{ fontSize: 20, color: '#10b981' }} />, color: '#10b981', label: 'Avg Latency',  value: '—', sub: 'ms' },
    { icon: <PeopleIcon  sx={{ fontSize: 20, color: '#8b5cf6' }} />, color: '#8b5cf6', label: 'Users',        value: '—', sub: 'unique callers' },
  ];

  return (
    <Box sx={{ bgcolor: T.bg, minHeight: '100%', p: { xs: 1.5, sm: 2, md: 3 }, color: T.text }}>

      {/* ── Header ── */}
      <Box sx={{ display: 'flex', alignItems: { xs: 'flex-start', sm: 'center' }, mb: 2.5, gap: 1.5, flexWrap: 'wrap' }}>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontWeight: 800, fontSize: { xs: 20, md: 24 }, color: T.text, lineHeight: 1.2 }}>
            Activity Center
          </Typography>
          <Typography sx={{ fontSize: 13, color: T.textFaint, mt: 0.25 }}>
            Cinema activity · API request logs · deduplicates parallel connections
          </Typography>
        </Box>

        {/* Controls — only show time/type for cinema */}
        {section === 'cinema' && (
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
            <TextField select size="small" value={hours} onChange={e => setHours(Number(e.target.value))} sx={{ minWidth: 130 }}>
              {TIME_RANGES.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
            </TextField>
            <TextField select size="small" value={activityType} onChange={e => setActivityType(e.target.value)} sx={{ minWidth: 120 }}>
              {ACTIVITY_TYPES.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
            </TextField>
          </Box>
        )}
        <Tooltip title="Refresh all">
          <IconButton size="small" onClick={handleRefresh}
            sx={{ color: T.textFaint, border: `1px solid ${T.border}`, '&:hover': { color: '#0d9488' } }}>
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* ── Stat cards ── */}
      <Grid container spacing={1.5} sx={{ mb: 2.5 }}>
        {statCards.map((s, i) => (
          <Grid item xs={6} sm={4} md={section === 'cinema' ? 2 : 4} key={i}>
            <StatCard {...s} loading={section === 'cinema' ? statsLoading : false} />
          </Grid>
        ))}
      </Grid>

      {/* ── Section card ── */}
      <Card elevation={0} sx={{ border: `1px solid ${T.border}`, borderRadius: 2, bgcolor: T.glass, overflow: 'hidden' }}>

        {/* Section tabs */}
        <Box sx={{
          display: 'flex', borderBottom: `1px solid ${T.border}`,
          overflowX: 'auto', px: { xs: 0.5, sm: 1 },
          '&::-webkit-scrollbar': { display: 'none' },
        }}>
          <SectionTab
            id="cinema"
            icon={<MovieFilterIcon />}
            label="Cinema Activity"
            active={section === 'cinema'}
            onClick={setSection}
          />
          <SectionTab
            id="api"
            icon={<HttpIcon />}
            label="API Logs"
            active={section === 'api'}
            onClick={setSection}
          />
        </Box>

        {/* Section content */}
        {section === 'cinema' && (
          <CinemaFeed
            hours={hours}
            activityType={activityType}
            onHoursChange={setHours}
            onTypeChange={setActivityType}
          />
        )}
        {section === 'api' && <ApiLogsFeed />}
      </Card>
    </Box>
  );
}
