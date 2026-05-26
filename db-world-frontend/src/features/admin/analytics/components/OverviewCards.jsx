import React from 'react';
import { Box, Card, CardContent, Typography, Skeleton, useTheme } from '@mui/material';
import { Group, CloudDownload, CheckCircle, Cancel } from '@mui/icons-material';

const Tile = ({ icon, label, value, suffix, accent }) => {
  const theme = useTheme();
  return (
    <Card variant="outlined" sx={{ flex: 1, minWidth: 200 }}>
      <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box sx={{
          width: 44, height: 44, borderRadius: 2,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          bgcolor: theme.palette.action.hover,
          color: accent ?? theme.palette.primary.main,
        }}>
          {icon}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {label}
          </Typography>
          <Typography sx={{ fontSize: '1.3rem', fontWeight: 700, lineHeight: 1.2 }}>
            {value}
            {suffix && (
              <Box component="span" sx={{ fontSize: '0.85rem', fontWeight: 500, color: 'text.secondary', ml: 0.5 }}>
                {suffix}
              </Box>
            )}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};

const OverviewCards = ({ data, loading }) => {
  if (loading) {
    return (
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} variant="rounded" height={80} sx={{ flex: 1, minWidth: 200 }} />
        ))}
      </Box>
    );
  }
  if (!data) return null;

  return (
    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
      <Tile icon={<Group />}        label="Active users (7d)"     value={data.activeUsers7d ?? 0} />
      <Tile icon={<CloudDownload />} label="Transferred (7d)"      value={Number(data.gbTransferred7d ?? 0).toFixed(2)} suffix="GB" />
      <Tile icon={<CheckCircle />}   label="Completed (7d)"        value={data.completedTransfers7d ?? 0} />
      <Tile icon={<Cancel />}        label="Aborted rate (7d)"     value={Number(data.abortedRate7d ?? 0).toFixed(1)} suffix="%" />
    </Box>
  );
};

export default OverviewCards;
