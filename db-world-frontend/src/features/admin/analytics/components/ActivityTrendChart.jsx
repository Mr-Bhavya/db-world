import React, { useMemo } from 'react';
import { Card, CardContent, Typography, Skeleton, Box } from '@mui/material';
import { LineChart } from '@mui/x-charts/LineChart';

const ActivityTrendChart = ({ data, loading, days = 30 }) => {
  const series = useMemo(() => {
    if (!data?.length) return { dates: [], streams: [], downloads: [] };
    return {
      dates:     data.map(d => d.date),
      streams:   data.map(d => d.streams ?? 0),
      downloads: data.map(d => d.downloads ?? 0),
    };
  }, [data]);

  return (
    <Card variant="outlined">
      <CardContent>
        <Typography sx={{ fontSize: '0.78rem', textTransform: 'uppercase', color: 'text.secondary', letterSpacing: '0.04em', mb: 1 }}>
          Activity trend (last {days} days)
        </Typography>
        {loading ? (
          <Skeleton variant="rounded" height={240} />
        ) : !series.dates.length ? (
          <Box sx={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography sx={{ color: 'text.secondary', fontSize: '0.85rem' }}>No activity yet.</Typography>
          </Box>
        ) : (
          <LineChart
            height={240}
            xAxis={[{ data: series.dates, scaleType: 'band' }]}
            series={[
              { data: series.streams,   label: 'Streams' },
              { data: series.downloads, label: 'Downloads' },
            ]}
            margin={{ left: 50, right: 16, top: 16, bottom: 30 }}
            sx={{ '.MuiChartsAxis-tickLabel': { fontSize: '0.7rem' } }}
          />
        )}
      </CardContent>
    </Card>
  );
};

export default ActivityTrendChart;
