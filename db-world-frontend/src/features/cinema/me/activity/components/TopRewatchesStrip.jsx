import React from 'react';
import { Box, Card, CardContent, Typography, Skeleton, Chip } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import Constants from '@shared/constants';

const recordRoute = (recordType, title) => {
  const encoded = encodeURIComponent(title ?? '');
  const isSeries = ['TV_SERIES', 'SERIES', 'TV'].includes((recordType ?? '').toUpperCase());
  return isSeries
    ? Constants.DB_SERIES_DETIALS_ROUTE.replace(':title', encoded)
    : Constants.DB_MOVIE_DETIALS_ROUTE.replace(':title', encoded);
};

const RewatchTile = ({ item }) => {
  const navigate = useNavigate();
  const total = item.totalCount ?? ((item.downloadCount ?? 0) + (item.streamCount ?? 0));
  return (
    <Card
      variant="outlined"
      onClick={() => navigate(recordRoute(item.recordType, item.title))}
      sx={{
        minWidth: 220, flex: '0 0 220px',
        cursor: 'pointer',
        transition: 'transform 120ms ease, border-color 120ms ease',
        '&:hover': { transform: 'translateY(-2px)', borderColor: 'primary.main' },
      }}
    >
      <CardContent sx={{ p: 1.5 }}>
        <Typography
          noWrap
          sx={{ fontSize: '0.9rem', fontWeight: 600 }}
          title={item.title}
        >
          {item.title}
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.5, mt: 1, flexWrap: 'wrap' }}>
          <Chip size="small" label={`▶ ${item.streamCount ?? 0}`} />
          <Chip size="small" label={`⬇ ${item.downloadCount ?? 0}`} />
          <Chip size="small" color="primary" label={`${total}× total`} />
        </Box>
      </CardContent>
    </Card>
  );
};

const TopRewatchesStrip = ({ items, loading }) => {
  if (loading) {
    return (
      <Box sx={{ display: 'flex', gap: 1.5, overflowX: 'auto' }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} variant="rounded" width={220} height={92} sx={{ flex: '0 0 220px' }} />
        ))}
      </Box>
    );
  }
  if (!items?.length) {
    return (
      <Card variant="outlined">
        <CardContent>
          <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>
            No rewatches yet. Finish a movie or series to see it here.
          </Typography>
        </CardContent>
      </Card>
    );
  }
  return (
    <Box sx={{
      display: 'flex', gap: 1.5, overflowX: 'auto', pb: 1,
      '&::-webkit-scrollbar': { height: 6 },
      '&::-webkit-scrollbar-thumb': { bgcolor: 'divider', borderRadius: 3 },
    }}>
      {items.map((it) => <RewatchTile key={it.recordId} item={it} />)}
    </Box>
  );
};

export default TopRewatchesStrip;
