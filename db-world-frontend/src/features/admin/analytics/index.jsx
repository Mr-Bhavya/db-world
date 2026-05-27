import React from 'react';
import { Box, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';

import OverviewCards from './components/OverviewCards';
import ActivityTrendChart from './components/ActivityTrendChart';
import ClientBreakdownChart from './components/ClientBreakdownChart';
import TopRecordsTable from './components/TopRecordsTable';
import TopUsersTable from './components/TopUsersTable';
import {
  fetchOverview, fetchTrend, fetchClientBreakdown, fetchTopRecords, fetchTopUsers,
} from './api/analyticsApi';

const TREND_DAYS = 30;

const AnalyticsDashboard = () => {
  const { enqueueSnackbar } = useSnackbar();
  const onErr = (label) => (err) =>
    enqueueSnackbar(`Failed to load ${label}: ${err?.response?.data?.message ?? err.message}`,
      { variant: 'error' });

  const overviewQ  = useQuery({ queryKey: ['admin', 'analytics', 'overview'],          queryFn: fetchOverview,                                onError: onErr('overview') });
  const trendQ     = useQuery({ queryKey: ['admin', 'analytics', 'trend', TREND_DAYS], queryFn: () => fetchTrend(TREND_DAYS),                  onError: onErr('trend') });
  const breakdownQ = useQuery({ queryKey: ['admin', 'analytics', 'client-breakdown'],  queryFn: fetchClientBreakdown,                          onError: onErr('client breakdown') });
  const recordsQ   = useQuery({ queryKey: ['admin', 'analytics', 'top-records'],       queryFn: () => fetchTopRecords(20),                     onError: onErr('top records') });
  const usersQ     = useQuery({ queryKey: ['admin', 'analytics', 'top-users'],         queryFn: () => fetchTopUsers(20),                       onError: onErr('top users') });

  return (
    <Box sx={{ p: { xs: 1.5, md: 3 }, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="h5" sx={{ fontWeight: 700 }}>Analytics</Typography>

      <OverviewCards data={overviewQ.data} loading={overviewQ.isLoading} />

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' } }}>
        <ActivityTrendChart  data={trendQ.data}     loading={trendQ.isLoading}     days={TREND_DAYS} />
        <ClientBreakdownChart data={breakdownQ.data} loading={breakdownQ.isLoading} />
      </Box>

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
        <TopRecordsTable data={recordsQ.data} loading={recordsQ.isLoading} />
        <TopUsersTable   data={usersQ.data}   loading={usersQ.isLoading} />
      </Box>
    </Box>
  );
};

export default AnalyticsDashboard;
