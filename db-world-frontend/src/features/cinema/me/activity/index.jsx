import React, { useEffect, useState } from 'react';
import { Box, Container, Tab, Tabs, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';

import ActivitySummaryCard from './components/ActivitySummaryCard';
import ActivityTimelineList from './components/ActivityTimelineList';
import { fetchMyActivitySummary, fetchMyActivities } from './api/myActivityApi';

const TYPE_TABS = [
  { value: '',         label: 'All' },
  { value: 'STREAM',   label: 'Streams' },
  { value: 'DOWNLOAD', label: 'Downloads' },
];

const PAGE_SIZE = 30;

const MyActivityPage = () => {
  const { enqueueSnackbar } = useSnackbar();
  const [type, setType] = useState('');

  const summaryQ = useQuery({
    queryKey: ['me', 'activity', 'summary'],
    queryFn: fetchMyActivitySummary,
  });

  const listQ = useQuery({
    queryKey: ['me', 'activity', 'list', type],
    queryFn: () => fetchMyActivities({ type: type || undefined, page: 0, size: PAGE_SIZE }),
  });

  // useQuery's onError was removed in TanStack Query v5 — surface fetch failures
  // via isError/error instead, same user-visible toast as before.
  useEffect(() => {
    if (summaryQ.isError) {
      const err = summaryQ.error;
      enqueueSnackbar(`Failed to load summary: ${err?.response?.data?.message ?? err.message}`,
        { variant: 'error' });
    }
  }, [summaryQ.isError, summaryQ.error, enqueueSnackbar]);

  useEffect(() => {
    if (listQ.isError) {
      const err = listQ.error;
      enqueueSnackbar(`Failed to load activity timeline: ${err?.response?.data?.message ?? err.message}`,
        { variant: 'error' });
    }
  }, [listQ.isError, listQ.error, enqueueSnackbar]);

  const timelineItems = listQ.data?.content;

  return (
    <Container maxWidth="md" sx={{ pt: { xs: 'calc(56px + 24px)', md: 'calc(64px + 24px)' }, pb: 3 }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
        My Activity
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <ActivitySummaryCard summary={summaryQ.data} loading={summaryQ.isLoading} />

        <Box>
          <Tabs
            value={type}
            onChange={(_, v) => setType(v)}
            sx={{ mb: 1.5, minHeight: 36, '& .MuiTab-root': { minHeight: 36, fontSize: '0.85rem' } }}
          >
            {TYPE_TABS.map(t => <Tab key={t.value || 'all'} value={t.value} label={t.label} />)}
          </Tabs>
          <ActivityTimelineList items={timelineItems} loading={listQ.isLoading} />
        </Box>
      </Box>
    </Container>
  );
};

export default MyActivityPage;
