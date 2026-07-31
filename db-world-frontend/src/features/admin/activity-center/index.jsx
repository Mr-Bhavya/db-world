import React, { useState } from 'react';
import { Box, Tabs, Tab, useMediaQuery, useTheme } from '@mui/material';
import InsightsIcon from '@mui/icons-material/Insights';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import DevicesIcon  from '@mui/icons-material/Devices';
import HttpIcon     from '@mui/icons-material/Http';
import { useQueryClient } from '@tanstack/react-query';
import { useT } from '@shared/theme';
import { AdminPage, StickyBar, useSwipeNav } from '@features/admin/adminUi';
import OverviewTab from './OverviewTab';
import SessionsTab from './SessionsTab';
import ApiLogsFeed from './ApiLogsFeed';

// Query keys used by the tabs' TanStack Query hooks (see OverviewTab — which now
// also hosts the live-sessions view — and SessionsTab; ApiLogsFeed manages its
// own fetch/state and isn't query-cache backed, so it's refreshed independently
// below).
const ACTIVITY_QUERY_KEYS = [
  'activityOverview', 'activityTrend', 'activityClientBreakdown',
  'activityTopContent', 'activityTopUsers',
  'liveSessions',
  'sessions', 'activityUsers',
];

const TABS = [
  { id: 'overview', label: 'Overview',    icon: <InsightsIcon fontSize="small" /> },
  { id: 'sessions', label: 'Sessions',    icon: <DevicesIcon fontSize="small" /> },
  { id: 'requests', label: 'Request Log', icon: <HttpIcon fontSize="small" /> },
];

export default function ActivityCenter() {
  const T = useT();
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('md'));
  const queryClient = useQueryClient();

  const [tab, setTab] = useState('overview');
  const [refreshing, setRefreshing] = useState(false);

  const tabIdx = TABS.findIndex((t) => t.id === tab);
  const swipe = useSwipeNav({
    onPrev: () => setTab(TABS[Math.max(0, tabIdx - 1)].id),
    onNext: () => setTab(TABS[Math.min(TABS.length - 1, tabIdx + 1)].id),
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({
      predicate: (q) => {
        const k = q.queryKey?.[0];
        return typeof k === 'string' && ACTIVITY_QUERY_KEYS.includes(k);
      },
    });
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 500);
  };

  return (
    <AdminPage
      title="Activity & Insights"
      subtitle="Site-wide overview · live activity · sessions · request log"
      icon={InsightsRoundedIcon}
      onRefresh={handleRefresh}
      refreshing={refreshing}
      maxWidth={1600}
    >
      {/* Tabs — pinned to the top of the scroll area (direct AdminPage child) */}
      <StickyBar sx={{ p: 0, overflow: 'hidden' }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          sx={{
            minHeight: { xs: 44, sm: 48 },
            px: { xs: 0.5, sm: 1 },
            '& .MuiTab-root': {
              minHeight: { xs: 44, sm: 48 },
              fontSize: { xs: 12, sm: 13 },
              fontWeight: 600,
              textTransform: 'none',
              color: T.textMuted,
              minWidth: isMobile ? 'auto' : 120,
              px: { xs: 1.25, sm: 2 },
              gap: 0.75,
            },
            '& .Mui-selected': { color: `${T.teal} !important` },
            '& .MuiTabs-indicator': { bgcolor: T.teal, height: 2 },
          }}
        >
          {TABS.map((t) => (
            <Tab key={t.id} value={t.id} icon={t.icon} iconPosition="start" label={t.label} />
          ))}
        </Tabs>
      </StickyBar>

      {/* Tab content (swipe-navigable) — children render their own cards, so this
          panel adds no card frame (avoids the card-in-card double wrapper). */}
      <Box {...swipe} sx={{ minHeight: { xs: 380, md: 520 } }}>
        {tab === 'overview' && <OverviewTab />}
        {tab === 'sessions' && <SessionsTab />}
        {tab === 'requests' && <ApiLogsFeed />}
      </Box>
    </AdminPage>
  );
}
