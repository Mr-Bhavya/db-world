import React from 'react';
import { Box, Card, CardContent, Typography, Skeleton, LinearProgress } from '@mui/material';
import { PlayArrow, Download as DownloadIcon, Search as SearchIcon, CheckCircle, Cancel, HourglassEmpty } from '@mui/icons-material';

const formatRelative = (iso) => {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

const formatBytes = (bytes) => {
  if (!bytes || bytes <= 0) return null;
  const gb = bytes / 1e9;
  return gb >= 0.1 ? `${gb.toFixed(2)} GB` : `${(bytes / 1e6).toFixed(0)} MB`;
};

const statusIcon = (state) => {
  switch (state) {
    case 'COMPLETED':          return <CheckCircle fontSize="small" color="success" />;
    case 'FAILED':
    case 'ABORTED':            return <Cancel fontSize="small" color="error" />;
    case 'ACTIVE':
    case 'PAUSED':
    case 'RESOLVING':          return <HourglassEmpty fontSize="small" color="warning" />;
    default:                   return <HourglassEmpty fontSize="small" />;
  }
};

const typeIcon = (activity) => {
  switch (activity) {
    case 'STREAM':   return <PlayArrow fontSize="small" />;
    case 'DOWNLOAD': return <DownloadIcon fontSize="small" />;
    case 'SEARCH':   return <SearchIcon fontSize="small" />;
    default:         return null;
  }
};

const stateLabel = (state) => {
  switch (state) {
    case 'ACTIVE':    return 'In progress';
    case 'PAUSED':     return 'Paused';
    case 'RESOLVING':  return 'Resolving';
    case 'FAILED':     return 'Failed';
    case 'ABORTED':    return 'Aborted';
    case 'COMPLETED':  return 'Completed';
    default:           return '';
  }
};

const ActivityRow = ({ item }) => {
  const pct = Number(item.completionPercent ?? 0);
  const size = formatBytes(item.uniqueBytes ?? item.fileSize);

  let secondary = stateLabel(item.state) || (item.activity ?? '').toLowerCase();
  if (size) secondary = `${secondary} · ${size}`;

  return (
    <Card
      variant="outlined"
      sx={{ transition: 'border-color 120ms ease' }}
    >
      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
            {typeIcon(item.activity)}
            {statusIcon(item.state)}
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography noWrap sx={{ fontSize: '0.9rem', fontWeight: 600 }}>
              {item.title ?? item.fileName ?? '—'}
            </Typography>
            <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
              {secondary}{' · '}
              {formatRelative(item.lastEventAt ?? item.startedAt)}
            </Typography>
            {pct > 0 && pct < 100 && (
              <LinearProgress
                variant="determinate"
                value={pct}
                sx={{ mt: 0.5, height: 4, borderRadius: 2 }}
              />
            )}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

const ActivityTimelineList = ({ items, loading }) => {
  if (loading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} variant="rounded" height={66} />)}
      </Box>
    );
  }
  if (!items?.length) {
    return (
      <Card variant="outlined">
        <CardContent>
          <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', textAlign: 'center' }}>
            Nothing here yet. Start a stream or download to populate your activity.
          </Typography>
        </CardContent>
      </Card>
    );
  }
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {items.map((it) => <ActivityRow key={it.sessionId} item={it} />)}
    </Box>
  );
};

export default ActivityTimelineList;
