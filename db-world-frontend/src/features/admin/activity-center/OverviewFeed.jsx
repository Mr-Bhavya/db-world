import React from 'react';
import {
  Box, Typography, Chip, Avatar, Skeleton, Tooltip,
} from '@mui/material';
import ArrowForwardIcon  from '@mui/icons-material/ArrowForward';
import DownloadIcon      from '@mui/icons-material/CloudDownload';
import PlayArrowIcon     from '@mui/icons-material/PlayArrow';
import SearchIcon        from '@mui/icons-material/Search';
import { useQuery } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { motion } from 'framer-motion';

import OverviewCards         from '@features/admin/analytics/components/OverviewCards';
import ActivityTrendChart    from '@features/admin/analytics/components/ActivityTrendChart';
import ClientBreakdownChart  from '@features/admin/analytics/components/ClientBreakdownChart';
import TopRecordsTable       from '@features/admin/analytics/components/TopRecordsTable';
import TopUsersTable         from '@features/admin/analytics/components/TopUsersTable';
import {
  fetchOverview, fetchTrend, fetchClientBreakdown,
  fetchTopRecords, fetchTopUsers,
} from '@features/admin/analytics/api/analyticsApi';
import {
  fetchCinemaRecent, fetchApiLogs,
  TYPE_META, METHOD_COLOR, statusColor,
  fmtAgo, fmtBytes, fmtDuration, fileName,
} from './activityApi';
import { useT } from '@shared/theme/ThemeContext';

const TREND_DAYS = 30;
const PREVIEW_LIMIT = 6;

// ─── Reusable panel shell ────────────────────────────────────────────────────
function PanelCard({ title, action, children }) {
  const T = useT();
  return (
    <Box sx={{
      bgcolor: T.glass, border: `1px solid ${T.border}`, borderRadius: 2,
      p: { xs: 1.5, sm: 2 }, display: 'flex', flexDirection: 'column',
      minWidth: 0,
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.25 }}>
        <Typography sx={{
          fontSize: 11, color: T.textFaint, textTransform: 'uppercase',
          letterSpacing: '0.08em', fontWeight: 700,
        }}>
          {title}
        </Typography>
        {action && (
          <Box
            onClick={action.onClick}
            sx={{
              display: 'flex', alignItems: 'center', gap: 0.5,
              fontSize: 11, fontWeight: 700, color: T.teal, cursor: 'pointer',
              px: 0.75, py: 0.25, borderRadius: 1,
              '&:hover': { bgcolor: T.tealBg },
            }}
          >
            {action.label}
            <ArrowForwardIcon sx={{ fontSize: 12 }} />
          </Box>
        )}
      </Box>
      {children}
    </Box>
  );
}

// ─── Cinema activity row (compact) ───────────────────────────────────────────
function CinemaPreviewRow({ a, index }) {
  const T = useT();
  const meta = TYPE_META[a.activityType] ?? { color: T.textMuted, label: a.activityType };
  const Icon = a.activityType === 'DOWNLOAD' ? DownloadIcon
             : a.activityType === 'STREAM'   ? PlayArrowIcon
             : SearchIcon;
  const isSearch = a.activityType === 'SEARCH';
  const label    = isSearch ? `"${a.activityValue}"` : fileName(a.filePath || a.activityValue);

  return (
    <Box
      component={motion.div}
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.18, delay: index * 0.03 }}
      sx={{
        display: 'flex', alignItems: 'center', gap: 1.25,
        py: 1, borderBottom: `1px solid ${T.border}`,
        '&:last-of-type': { borderBottom: 'none' },
      }}
    >
      <Box sx={{
        width: 26, height: 26, borderRadius: 1, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        bgcolor: `${meta.color}1A`, color: meta.color,
      }}>
        <Icon sx={{ fontSize: 14 }} />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Tooltip title={a.filePath || a.activityValue || ''}>
          <Typography sx={{
            fontSize: 12.5, color: T.text, fontWeight: 500,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {label}
          </Typography>
        </Tooltip>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.15 }}>
          <Avatar sx={{ width: 14, height: 14, bgcolor: T.teal, fontSize: 8 }}>
            {a.userEmail?.[0]?.toUpperCase() ?? '?'}
          </Avatar>
          <Typography sx={{ fontSize: 10.5, color: T.textFaint, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {a.userEmail ?? 'anonymous'}
          </Typography>
        </Box>
      </Box>
      <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
        {a.bytesTransferred > 0 && (
          <Typography sx={{ fontSize: 11, fontWeight: 700, color: T.text, lineHeight: 1.2 }}>
            {fmtBytes(a.bytesTransferred)}
          </Typography>
        )}
        <Typography sx={{ fontSize: 10, color: T.textFaint }}>{fmtAgo(a.lastUpdated)}</Typography>
      </Box>
    </Box>
  );
}

// ─── API log row (compact) ───────────────────────────────────────────────────
function ApiPreviewRow({ log, index }) {
  const T  = useT();
  const mc = METHOD_COLOR[log.method] ?? '#6b7280';
  const sc = statusColor(log.status);
  return (
    <Box
      component={motion.div}
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.18, delay: index * 0.03 }}
      sx={{
        display: 'flex', alignItems: 'center', gap: 1.25,
        py: 1, borderBottom: `1px solid ${T.border}`,
        '&:last-of-type': { borderBottom: 'none' },
      }}
    >
      <Chip
        size="small" label={log.method}
        sx={{ bgcolor: `${mc}1A`, color: mc, fontWeight: 800, fontSize: 9.5, height: 18, minWidth: 44, '& .MuiChip-label': { px: 0.75 } }}
      />
      <Chip
        size="small" label={log.status}
        sx={{ bgcolor: `${sc}1A`, color: sc, fontWeight: 700, fontSize: 9.5, height: 18, minWidth: 36, '& .MuiChip-label': { px: 0.75 } }}
      />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Tooltip title={`${log.uri}${log.query ? '?' + log.query : ''}`}>
          <Typography sx={{
            fontSize: 12, color: T.text, fontFamily: 'monospace',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {log.uri}
          </Typography>
        </Tooltip>
        <Typography sx={{ fontSize: 10.5, color: T.textFaint, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {log.username ?? 'anonymous'}
        </Typography>
      </Box>
      <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
        <Typography sx={{ fontSize: 11, fontWeight: 600, color: T.text, lineHeight: 1.2 }}>
          {fmtDuration(log.duration)}
        </Typography>
        <Typography sx={{ fontSize: 10, color: T.textFaint }}>{fmtAgo(log.timestamp)}</Typography>
      </Box>
    </Box>
  );
}

// ─── Empty / loading states ──────────────────────────────────────────────────
function PreviewListLoader() {
  const T = useT();
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      {Array.from({ length: PREVIEW_LIMIT }).map((_, i) => (
        <Skeleton key={i} variant="rounded" height={44} sx={{ bgcolor: T.glass }} />
      ))}
    </Box>
  );
}

function PreviewEmpty({ children }) {
  const T = useT();
  return (
    <Box sx={{ py: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Typography sx={{ fontSize: 12.5, color: T.textFaint }}>{children}</Typography>
    </Box>
  );
}

// ─── OverviewFeed ────────────────────────────────────────────────────────────
export default function OverviewFeed({ onJumpToSection }) {
  const { enqueueSnackbar } = useSnackbar();
  const onErr = (label) => (err) =>
    enqueueSnackbar(
      `Failed to load ${label}: ${err?.response?.data?.message ?? err.message}`,
      { variant: 'error' },
    );

  const overviewQ  = useQuery({ queryKey: ['admin', 'analytics', 'overview'],          queryFn: fetchOverview,                onError: onErr('overview') });
  const trendQ     = useQuery({ queryKey: ['admin', 'analytics', 'trend', TREND_DAYS], queryFn: () => fetchTrend(TREND_DAYS), onError: onErr('trend') });
  const breakdownQ = useQuery({ queryKey: ['admin', 'analytics', 'client-breakdown'],  queryFn: fetchClientBreakdown,         onError: onErr('client breakdown') });
  const recordsQ   = useQuery({ queryKey: ['admin', 'analytics', 'top-records'],       queryFn: () => fetchTopRecords(20),    onError: onErr('top records') });
  const usersQ     = useQuery({ queryKey: ['admin', 'analytics', 'top-users'],         queryFn: () => fetchTopUsers(20),      onError: onErr('top users') });

  // Preview queries (smaller pages, fed by the same TanStack cache as the dedicated tabs)
  const cinemaPreviewQ = useQuery({
    queryKey: ['cinema-recent', 24, '', PREVIEW_LIMIT],
    queryFn: () => fetchCinemaRecent({ hours: 24, limit: PREVIEW_LIMIT }),
    staleTime: 15_000,
  });
  const apiPreviewQ = useQuery({
    queryKey: ['admin', 'activity-logs', 'preview'],
    queryFn: () => fetchApiLogs({ page: 0, size: PREVIEW_LIMIT }),
    staleTime: 15_000,
  });

  const cinemaList = cinemaPreviewQ.data?.activities ?? [];
  const apiList    = apiPreviewQ.data?.content ?? [];

  return (
    <Box sx={{
      p: { xs: 1.5, sm: 2, md: 2.5 },
      display: 'flex', flexDirection: 'column', gap: { xs: 1.5, sm: 2 },
    }}>
      <OverviewCards data={overviewQ.data} loading={overviewQ.isLoading} />

      <Box sx={{
        display: 'grid', gap: { xs: 1.5, sm: 2 },
        gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' },
      }}>
        <ActivityTrendChart   data={trendQ.data}     loading={trendQ.isLoading}     days={TREND_DAYS} />
        <ClientBreakdownChart data={breakdownQ.data} loading={breakdownQ.isLoading} />
      </Box>

      <Box sx={{
        display: 'grid', gap: { xs: 1.5, sm: 2 },
        gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' },
      }}>
        <TopRecordsTable data={recordsQ.data} loading={recordsQ.isLoading} />
        <TopUsersTable   data={usersQ.data}   loading={usersQ.isLoading} />
      </Box>

      {/* ── Recent activity previews ──────────────────────────────────────── */}
      <Box sx={{
        display: 'grid', gap: { xs: 1.5, sm: 2 },
        gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' },
      }}>
        <PanelCard
          title="Recent cinema activity"
          action={onJumpToSection ? { label: 'View all', onClick: () => onJumpToSection('cinema') } : null}
        >
          {cinemaPreviewQ.isLoading ? <PreviewListLoader />
            : cinemaList.length === 0 ? <PreviewEmpty>No recent cinema activity</PreviewEmpty>
            : (
              <Box>
                {cinemaList.slice(0, PREVIEW_LIMIT).map((a, i) => (
                  <CinemaPreviewRow key={a.id ?? i} a={a} index={i} />
                ))}
              </Box>
            )}
        </PanelCard>

        <PanelCard
          title="Recent API calls"
          action={onJumpToSection ? { label: 'View all', onClick: () => onJumpToSection('api') } : null}
        >
          {apiPreviewQ.isLoading ? <PreviewListLoader />
            : apiList.length === 0 ? <PreviewEmpty>No recent API calls</PreviewEmpty>
            : (
              <Box>
                {apiList.slice(0, PREVIEW_LIMIT).map((log, i) => (
                  <ApiPreviewRow key={log.id ?? i} log={log} index={i} />
                ))}
              </Box>
            )}
        </PanelCard>
      </Box>
    </Box>
  );
}
