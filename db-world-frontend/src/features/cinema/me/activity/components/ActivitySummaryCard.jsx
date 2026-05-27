import React from 'react';
import { Box, Card, CardContent, Typography, Skeleton, Chip, useTheme } from '@mui/material';
import { AccessTime, Download, CheckCircle, Whatshot } from '@mui/icons-material';

const StatTile = ({ icon, label, value, suffix }) => {
  const theme = useTheme();
  return (
    <Box sx={{
      flex: 1, minWidth: 160,
      display: 'flex', alignItems: 'center', gap: 1.5,
      px: 2, py: 1.5,
    }}>
      <Box sx={{
        width: 40, height: 40, borderRadius: 2,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        bgcolor: theme.palette.action.hover,
        color: theme.palette.primary.main,
      }}>
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {label}
        </Typography>
        <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, lineHeight: 1.2 }}>
          {value}<Box component="span" sx={{ fontSize: '0.85rem', fontWeight: 500, color: 'text.secondary', ml: 0.5 }}>{suffix}</Box>
        </Typography>
      </Box>
    </Box>
  );
};

const ActivitySummaryCard = ({ summary, loading }) => {
  if (loading) {
    return (
      <Card variant="outlined">
        <CardContent>
          <Skeleton variant="rounded" height={72} />
        </CardContent>
      </Card>
    );
  }
  if (!summary) return null;

  const hours = Number(summary.totalStreamHours ?? 0).toFixed(1);
  const gb    = Number(summary.totalDownloadGB ?? 0).toFixed(2);
  const pct   = Number(summary.completionRate ?? 0).toFixed(0);
  const topGenres = summary.topGenres ?? [];

  return (
    <Card variant="outlined">
      <CardContent sx={{ p: { xs: 1, sm: 2 } }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'stretch' }}>
          <StatTile icon={<AccessTime />}  label="Hours streamed" value={hours} suffix="h" />
          <StatTile icon={<Download />}    label="Downloaded"     value={gb}    suffix="GB" />
          <StatTile icon={<CheckCircle />} label="Completion"     value={pct}   suffix="%" />
          <StatTile icon={<Whatshot />}    label="Top genres"
                    value={topGenres.length || '—'} suffix={topGenres.length === 1 ? 'genre' : 'genres'} />
        </Box>
        {topGenres.length > 0 && (
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1, pl: 2 }}>
            {topGenres.map((g) => <Chip key={g} label={g} size="small" />)}
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default ActivitySummaryCard;
