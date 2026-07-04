import React, { useMemo, useState } from 'react';
import {
  Box, Typography, Skeleton, ToggleButtonGroup, ToggleButton,
} from '@mui/material';
import {
  Bolt, CloudDownload, PlayArrow, Group,
  Storage, Speed, CheckCircleOutline,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { useT } from '@shared/theme/ThemeContext';

import ActivityTrendChart   from '@features/admin/analytics/components/ActivityTrendChart';
import ClientBreakdownChart from '@features/admin/analytics/components/ClientBreakdownChart';
import TopRecordsTable      from '@features/admin/analytics/components/TopRecordsTable';
import TopUsersTable        from '@features/admin/analytics/components/TopUsersTable';

import {
  fetchActivityOverview, fetchActivityTrend, fetchClientBreakdown,
  fetchTopContent, fetchTopUsers,
} from './activityApi';

const KPI_DAYS_OPTIONS = [7, 30];
const CHART_DAYS = 30;
const TOP_LIMIT = 20;

// ─── formatting helpers ──────────────────────────────────────────────────────

// gbDelivered arrives already converted to GB (BigDecimal) from the backend.
const fmtGb = (gb) => `${Number(gb ?? 0).toFixed(2)}`;

// avgSpeedBps is bits-per-second; render as MB/s to match the other admin panels.
const fmtSpeed = (bps) => `${(Number(bps ?? 0) / 8 / 1_000_000).toFixed(1)}`;

const fmtPct = (rate) => `${Number(rate ?? 0).toFixed(1)}`;

const fmtInt = (n) => Number(n ?? 0).toLocaleString();

// ─── KPI tile ─────────────────────────────────────────────────────────────────

const ACCENTS = {
  teal:   { fg: '#0d9488', bg: 'rgba(13,148,136,0.12)' },
  blue:   { fg: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  green:  { fg: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  amber:  { fg: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  purple: { fg: '#a855f7', bg: 'rgba(168,85,247,0.12)' },
  red:    { fg: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
};

function KpiTile({ icon, label, value, suffix, accent, index = 0 }) {
  const T = useT();
  const a = ACCENTS[accent] ?? ACCENTS.teal;
  return (
    <Box
      component={motion.div}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.04 }}
      sx={{
        bgcolor: T.glass,
        border: `1px solid ${T.border}`,
        borderRadius: 2,
        p: { xs: 1.25, sm: 1.75 },
        display: 'flex', alignItems: 'center', gap: 1.25,
        minWidth: 0,
        transition: 'border-color .15s, transform .15s',
        '&:hover': { borderColor: T.borderHover, transform: 'translateY(-1px)' },
      }}
    >
      <Box sx={{
        width: 38, height: 38, borderRadius: 1.5, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        bgcolor: a.bg, color: a.fg,
      }}>
        {React.cloneElement(icon, { sx: { fontSize: 20 } })}
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography sx={{
          fontSize: 9.5, color: T.textFaint, textTransform: 'uppercase',
          letterSpacing: '0.07em', fontWeight: 700, lineHeight: 1.4,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {label}
        </Typography>
        <Typography sx={{
          fontSize: { xs: '1.05rem', sm: '1.25rem' }, fontWeight: 800,
          lineHeight: 1.2, color: T.text,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {value}
          {suffix && (
            <Box component="span" sx={{ fontSize: '0.7rem', fontWeight: 500, color: T.textFaint, ml: 0.4 }}>
              {suffix}
            </Box>
          )}
        </Typography>
      </Box>
    </Box>
  );
}

function KpiGrid({ data, loading, days }) {
  const T = useT();

  const tiles = useMemo(() => ([
    { key: 'activeNow',       accent: 'teal',   icon: <Bolt />,               label: 'Active now',        value: fmtInt(data?.activeNow) },
    { key: 'streamsToday',    accent: 'blue',   icon: <PlayArrow />,          label: 'Streams today',     value: fmtInt(data?.streamsToday) },
    { key: 'downloadsToday',  accent: 'purple', icon: <CloudDownload />,      label: 'Downloads today',   value: fmtInt(data?.downloadsToday) },
    { key: 'uniqueUsers',     accent: 'green',  icon: <Group />,              label: `Unique users (${days}d)`, value: fmtInt(data?.uniqueUsers) },
    { key: 'gbDelivered',     accent: 'amber',  icon: <Storage />,            label: `Delivered (${days}d)`,    value: fmtGb(data?.gbDelivered), suffix: 'GB' },
    { key: 'avgSpeedBps',     accent: 'blue',   icon: <Speed />,              label: 'Avg speed',         value: fmtSpeed(data?.avgSpeedBps), suffix: 'MB/s' },
    { key: 'completionRate',  accent: 'green',  icon: <CheckCircleOutline />, label: 'Completion rate',   value: fmtPct(data?.completionRate), suffix: '%' },
  ]), [data, days]);

  if (loading) {
    return (
      <Box sx={{
        display: 'grid', gap: { xs: 1, sm: 1.5 },
        gridTemplateColumns: {
          xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', lg: 'repeat(7, 1fr)',
        },
      }}>
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} variant="rounded" height={70} sx={{ bgcolor: T.glass, borderRadius: 2 }} />
        ))}
      </Box>
    );
  }

  if (!data) {
    return (
      <Box sx={{
        bgcolor: T.glass, border: `1px solid ${T.border}`, borderRadius: 2,
        py: 3, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Typography sx={{ fontSize: 12.5, color: T.textFaint }}>No overview data yet.</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{
      display: 'grid', gap: { xs: 1, sm: 1.5 },
      gridTemplateColumns: {
        xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', lg: 'repeat(7, 1fr)',
      },
    }}>
      {tiles.map((t, i) => (
        <KpiTile key={t.key} index={i} accent={t.accent} icon={t.icon} label={t.label} value={t.value} suffix={t.suffix} />
      ))}
    </Box>
  );
}

// ─── OverviewTab ──────────────────────────────────────────────────────────────

export default function OverviewTab() {
  const T = useT();
  const [kpiDays, setKpiDays] = useState(7);

  const overviewQ = useQuery({
    queryKey: ['activityOverview', kpiDays],
    queryFn: () => fetchActivityOverview(kpiDays),
    staleTime: 30_000,
  });

  const trendQ = useQuery({
    queryKey: ['activityTrend', CHART_DAYS],
    queryFn: () => fetchActivityTrend(CHART_DAYS),
    staleTime: 30_000,
  });

  const breakdownQ = useQuery({
    queryKey: ['activityClientBreakdown', CHART_DAYS],
    queryFn: () => fetchClientBreakdown(CHART_DAYS),
    staleTime: 30_000,
  });

  const topContentQ = useQuery({
    queryKey: ['activityTopContent', CHART_DAYS, TOP_LIMIT],
    queryFn: () => fetchTopContent(CHART_DAYS, TOP_LIMIT),
    staleTime: 30_000,
  });

  const topUsersQ = useQuery({
    queryKey: ['activityTopUsers', CHART_DAYS, TOP_LIMIT],
    queryFn: () => fetchTopUsers(CHART_DAYS, TOP_LIMIT),
    staleTime: 30_000,
  });

  // ActivityTrendChart already expects { date, streams, downloads } — TrendDto matches verbatim.
  const trendData = trendQ.data;

  // ClientBreakdownChart expects { clientType, count } — ClientBreakdownDto uses { clientApp, count }.
  const breakdownData = useMemo(
    () => (breakdownQ.data ?? []).map((d) => ({ clientType: d.clientApp, count: d.count })),
    [breakdownQ.data],
  );

  // TopRecordsTable expects recordId/title/recordType/streamCount/downloadCount/uniqueUsers —
  // TopContentDto matches verbatim, no mapping needed.
  const topContentData = topContentQ.data;

  // TopUsersTable expects { userId, email, totalActivities, totalGb, lastActive } —
  // TopUserDto uses `totalSessions` where the table expects `totalActivities`.
  const topUsersData = useMemo(
    () => (topUsersQ.data ?? []).map((u) => ({
      userId: u.userId,
      email: u.email,
      totalActivities: u.totalSessions,
      totalGb: u.totalGb,
      lastActive: u.lastActive,
    })),
    [topUsersQ.data],
  );

  return (
    <Box sx={{
      p: { xs: 1.5, sm: 2, md: 2.5 },
      display: 'flex', flexDirection: 'column', gap: { xs: 1.5, sm: 2 },
    }}>
      {/* ── KPI strip ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
        <Typography sx={{
          fontSize: 11, color: T.textFaint, textTransform: 'uppercase',
          letterSpacing: '0.08em', fontWeight: 700,
        }}>
          Overview
        </Typography>
        <ToggleButtonGroup
          value={kpiDays}
          exclusive
          size="small"
          onChange={(_, v) => v != null && setKpiDays(v)}
          sx={{
            '& .MuiToggleButton-root': {
              fontSize: 11, fontWeight: 700, color: T.textMuted,
              border: `1px solid ${T.border}`, px: 1.25, py: 0.25,
              textTransform: 'none',
              '&.Mui-selected': { color: T.teal, bgcolor: T.tealBg, borderColor: T.teal },
            },
          }}
        >
          {KPI_DAYS_OPTIONS.map((d) => (
            <ToggleButton key={d} value={d}>{d}d</ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>

      <KpiGrid data={overviewQ.data} loading={overviewQ.isLoading} days={kpiDays} />

      {/* ── Trend + client breakdown ── */}
      <Box sx={{
        display: 'grid', gap: { xs: 1.5, sm: 2 },
        gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' },
      }}>
        <ActivityTrendChart   data={trendData}     loading={trendQ.isLoading}     days={CHART_DAYS} />
        <ClientBreakdownChart data={breakdownData} loading={breakdownQ.isLoading} />
      </Box>

      {/* ── Top content + top users ── */}
      <Box sx={{
        display: 'grid', gap: { xs: 1.5, sm: 2 },
        gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' },
      }}>
        <TopRecordsTable data={topContentData} loading={topContentQ.isLoading} />
        <TopUsersTable   data={topUsersData}   loading={topUsersQ.isLoading} />
      </Box>
    </Box>
  );
}
