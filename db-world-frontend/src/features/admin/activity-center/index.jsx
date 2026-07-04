import React, { useState } from 'react';
import { Box, Typography, Tabs, Tab, useMediaQuery, useTheme } from '@mui/material';
import InsightsIcon     from '@mui/icons-material/Insights';
import BoltIcon         from '@mui/icons-material/Bolt';
import DevicesIcon      from '@mui/icons-material/Devices';
import HttpIcon         from '@mui/icons-material/Http';
import { useT }         from '@shared/theme/ThemeContext';
import OverviewTab      from './OverviewTab';
import LiveTab          from './LiveTab';
import SessionsTab      from './SessionsTab';
import ApiLogsFeed      from './ApiLogsFeed';

// ─── Tab config ────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'overview', label: 'Overview',    icon: <InsightsIcon fontSize="small" /> },
  { id: 'live',     label: 'Live',        icon: <BoltIcon fontSize="small" /> },
  { id: 'sessions', label: 'Sessions',    icon: <DevicesIcon fontSize="small" /> },
  { id: 'requests', label: 'Request Log', icon: <HttpIcon fontSize="small" /> },
];

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ActivityCenter() {
  const T = useT();
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('md'));

  const [tab, setTab] = useState('overview');

  return (
    <Box sx={{
      bgcolor: T.adminBg, minHeight: '100%',
      p: { xs: 1.5, sm: 2, md: 3 }, color: T.text,
    }}>
      <Box sx={{ maxWidth: 1600, mx: 'auto' }}>
        {/* ── Header ── */}
        <Box sx={{ mb: 2 }}>
          <Typography sx={{
            fontWeight: 800, fontSize: { xs: 18, md: 22 },
            color: T.text, lineHeight: 1.2,
          }}>
            Activity &amp; Insights
          </Typography>
          <Typography sx={{ fontSize: 12, color: T.textFaint, mt: 0.2 }}>
            Site-wide overview · live activity · sessions · request log — unified view
          </Typography>
        </Box>

        {/* ── Tab shell ── */}
        <Box sx={{
          border: `1px solid ${T.border}`, borderRadius: 2,
          bgcolor: T.glass, overflow: 'hidden',
        }}>
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
            sx={{
              minHeight: { xs: 44, sm: 48 },
              borderBottom: `1px solid ${T.border}`,
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

          <Box>
            {tab === 'overview' && <OverviewTab />}
            {tab === 'live'     && <LiveTab />}
            {tab === 'sessions' && <SessionsTab />}
            {tab === 'requests' && <ApiLogsFeed />}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
