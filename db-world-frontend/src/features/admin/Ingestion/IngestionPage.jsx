import React from 'react';
import {
  Box, Tab, Tabs, Typography, Paper, Stack, Chip,
  useTheme, alpha, useMediaQuery, Collapse, Button,
} from '@mui/material';
import {
  Add, CloudDownload, History, LinkOff, FolderSpecial,
  FiberManualRecord as DotIcon, SignalCellularAlt,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { useIngestionWS } from './hooks/useIngestionWS';
import useIngestionStore from './store/ingestionStore';
import IngestionForm from './form/IngestionForm';
import JobList from './jobs/JobList';
import JobHistory from './history/JobHistory';
import UnassignedFiles from './files/UnassignedFiles';
import LinkFileForm from './files/LinkFileForm';

// ── Connection status badge ───────────────────────────────────────────────

function WsBadge() {
  const theme    = useTheme();
  const wsStatus = useIngestionStore((s) => s.wsStatus);
  const jobs     = useIngestionStore((s) => s.jobs);
  const lastUpdated = useIngestionStore((s) => s.lastUpdated);

  const cfgMap = {
    connected:    { color: theme.palette.success.main,  text: 'Live' },
    connecting:   { color: theme.palette.warning.main,  text: 'Connecting…' },
    disconnected: { color: theme.palette.grey[500],     text: 'Offline' },
    error:        { color: theme.palette.error.main,    text: 'Error' },
  };
  const cfg = cfgMap[wsStatus] ?? cfgMap.disconnected;
  const activeCount = Object.values(jobs).filter(
    (j) => ['DOWNLOADING', 'PROCESSING', 'STARTED'].includes(j.status)
  ).length;

  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <Chip
        icon={<SignalCellularAlt sx={{ fontSize: '14px !important', color: `${cfg.color} !important` }} />}
        label={cfg.text}
        size="small"
        sx={{
          bgcolor: alpha(cfg.color, 0.1),
          color: cfg.color,
          fontWeight: 600,
          fontSize: '0.72rem',
          height: 26,
          border: `1px solid ${alpha(cfg.color, 0.25)}`,
        }}
      />
      {activeCount > 0 && (
        <Chip
          label={`${activeCount} active`}
          size="small"
          color="primary"
          sx={{ fontSize: '0.72rem', height: 26 }}
        />
      )}
      {lastUpdated && wsStatus === 'connected' && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
          <DotIcon sx={{ fontSize: 8 }} />
          {new Date(lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </Typography>
      )}
    </Stack>
  );
}

// ── Tab definitions ───────────────────────────────────────────────────────

const TABS = [
  { label: 'New Job',        Icon: Add,           id: 'new-job' },
  { label: 'Live Jobs',      Icon: CloudDownload, id: 'live' },
  { label: 'History',        Icon: History,       id: 'history' },
  { label: 'Unassigned',     Icon: LinkOff,       id: 'unassigned' },
  { label: 'Link File',      Icon: FolderSpecial, id: 'link-file' },
];

// ── Main page ─────────────────────────────────────────────────────────────

export default function IngestionPage() {
  // Start WebSocket
  useIngestionWS();

  const theme    = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const activeTab  = useIngestionStore((s) => s.activeTab);
  const setActiveTab = useIngestionStore((s) => s.setActiveTab);
  const jobs       = useIngestionStore((s) => s.jobs);

  const liveCount = Object.keys(jobs).length;

  const tabContent = [
    <IngestionForm key="new-job" onSubmitted={() => setActiveTab(1)} />,
    <JobList       key="live" />,
    <JobHistory    key="history" />,
    <UnassignedFiles key="unassigned" />,
    <LinkFileForm  key="link-file" />,
  ];

  return (
    <Box sx={{ maxWidth: 1300, mx: 'auto', p: isMobile ? 1.5 : 2.5 }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        <Stack
          direction={isMobile ? 'column' : 'row'}
          justifyContent="space-between"
          alignItems={isMobile ? 'flex-start' : 'center'}
          spacing={1.5}
          mb={2.5}
        >
          <Box>
            <Typography variant={isMobile ? 'h5' : 'h4'} fontWeight={700}>
              Media Ingestion
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Download · Process · Enrich · Store
            </Typography>
          </Box>
          <WsBadge />
        </Stack>
      </motion.div>

      {/* ── Tabs ────────────────────────────────────────────────────────── */}
      <Paper
        variant="outlined"
        sx={{ borderRadius: 2, overflow: 'hidden' }}
      >
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          variant={isMobile ? 'scrollable' : 'standard'}
          scrollButtons="auto"
          sx={{
            borderBottom: `1px solid ${theme.palette.divider}`,
            bgcolor: alpha(theme.palette.background.default, 0.5),
            minHeight: 46,
            '& .MuiTab-root': { minHeight: 46, py: 0.75 },
          }}
        >
          {TABS.map(({ label, Icon, id }, i) => (
            <Tab
              key={id}
              label={
                <Stack direction="row" spacing={0.75} alignItems="center">
                  <Icon sx={{ fontSize: 16 }} />
                  <span>{label}</span>
                  {id === 'live' && liveCount > 0 && (
                    <Chip
                      label={liveCount}
                      size="small"
                      color="primary"
                      sx={{ height: 18, fontSize: '0.65rem', ml: 0.25 }}
                    />
                  )}
                </Stack>
              }
              id={`ingestion-tab-${i}`}
              aria-controls={`ingestion-panel-${i}`}
            />
          ))}
        </Tabs>

        {/* ── Tab content ─────────────────────────────────────────────────── */}
        <Box sx={{ p: isMobile ? 1.5 : 2.5 }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.18 }}
            >
              {tabContent[activeTab]}
            </motion.div>
          </AnimatePresence>
        </Box>
      </Paper>
    </Box>
  );
}
