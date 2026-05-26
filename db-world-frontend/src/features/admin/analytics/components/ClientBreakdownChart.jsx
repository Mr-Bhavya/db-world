import React from 'react';
import { Card, CardContent, Typography, Skeleton, Box } from '@mui/material';
import { PieChart } from '@mui/x-charts/PieChart';

const ClientBreakdownChart = ({ data, loading }) => {
  const series = (data ?? []).map((d, i) => ({
    id: d.clientType ?? `c${i}`,
    value: Number(d.count ?? 0),
    label: d.clientType ?? 'Unknown',
  }));

  return (
    <Card variant="outlined">
      <CardContent>
        <Typography sx={{ fontSize: '0.78rem', textTransform: 'uppercase', color: 'text.secondary', letterSpacing: '0.04em', mb: 1 }}>
          Client breakdown (last 30 days)
        </Typography>
        {loading ? (
          <Skeleton variant="rounded" height={240} />
        ) : !series.length ? (
          <Box sx={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography sx={{ color: 'text.secondary', fontSize: '0.85rem' }}>No data yet.</Typography>
          </Box>
        ) : (
          <PieChart
            height={240}
            series={[{ data: series, innerRadius: 50, paddingAngle: 1, cornerRadius: 4 }]}
            margin={{ top: 10, bottom: 10, left: 10, right: 10 }}
          />
        )}
      </CardContent>
    </Card>
  );
};

export default ClientBreakdownChart;
