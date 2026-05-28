import React from 'react';
import { Box, Card, CardContent, Typography, Skeleton, Chip, LinearProgress, useTheme } from '@mui/material';
import { PlayArrow, Download as DownloadIcon, Search as SearchIcon, CheckCircle, Cancel, HourglassEmpty } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import Constants from '@shared/constants';

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

const formatMs = (ms) => {
  if (!ms || ms < 1000) return null;
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

const statusIcon = (status) => {
  switch (status) {
    case 'COMPLETED':   return <CheckCircle fontSize="small" color="success" />;
    case 'ABORTED':     return <Cancel fontSize="small" color="error" />;
    case 'IN_PROGRESS': return <HourglassEmpty fontSize="small" color="warning" />;
    default:            return <HourglassEmpty fontSize="small" />;
  }
};

const typeIcon = (type) => {
  switch (type) {
    case 'STREAM':   return <PlayArrow fontSize="small" />;
    case 'DOWNLOAD': return <DownloadIcon fontSize="small" />;
    case 'SEARCH':   return <SearchIcon fontSize="small" />;
    default:         return null;
  }
};

const recordRoute = (recordType, title) => {
  if (!title) return null;
  const encoded = encodeURIComponent(title);
  const isSeries = ['TV_SERIES', 'SERIES', 'TV'].includes((recordType ?? '').toUpperCase());
  return isSeries
    ? Constants.DB_SERIES_DETIALS_ROUTE.replace(':title', encoded)
    : Constants.DB_MOVIE_DETIALS_ROUTE.replace(':title', encoded);
};

const ActivityRow = ({ item }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const target = recordRoute(item.recordType, item.recordTitle);
  const pct = Number(item.completionPercent ?? 0);

  let secondary = '';
  if (item.activityType === 'STREAM' && item.positionMs && item.durationMs) {
    secondary = `Resume from ${formatMs(item.positionMs)} of ${formatMs(item.durationMs)}`;
  } else if (item.activityType === 'STREAM' && (item.streamCount ?? 0) > 0) {
    secondary = `Completed ${item.streamCount}×`;
  } else if (item.activityType === 'DOWNLOAD' && (item.downloadCount ?? 0) > 0) {
    secondary = `Downloaded ${item.downloadCount}×`;
  } else if (item.completionStatus === 'IN_PROGRESS') {
    secondary = 'In progress';
  } else if (item.completionStatus === 'ABORTED') {
    secondary = 'Aborted';
  }

  return (
    <Card
      variant="outlined"
      onClick={target ? () => navigate(target) : undefined}
      sx={{
        cursor: target ? 'pointer' : 'default',
        transition: 'border-color 120ms ease',
        '&:hover': target ? { borderColor: 'primary.main' } : undefined,
      }}
    >
      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
            {typeIcon(item.activityType)}
            {statusIcon(item.completionStatus)}
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography noWrap sx={{ fontSize: '0.9rem', fontWeight: 600 }}>
              {item.recordTitle ?? item.filePath ?? '—'}
            </Typography>
            <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
              {secondary || (item.activityType ?? '').toLowerCase()}{' · '}
              {formatRelative(item.lastUpdated)}
            </Typography>
            {pct > 0 && pct < 100 && (
              <LinearProgress
                variant="determinate"
                value={pct}
                sx={{ mt: 0.5, height: 4, borderRadius: 2 }}
              />
            )}
          </Box>
          {item.clientType && item.clientType !== 'UNKNOWN' && (
            <Chip size="small" label={item.clientType} sx={{ flexShrink: 0 }} />
          )}
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
      {items.map((it) => <ActivityRow key={it.id} item={it} />)}
    </Box>
  );
};

export default ActivityTimelineList;
