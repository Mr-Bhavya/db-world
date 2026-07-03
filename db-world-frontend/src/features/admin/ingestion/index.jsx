import React, { memo, useMemo } from 'react';
import {
  alpha,
  Box,
  Chip,
  Paper,
  Stack,
  Tab,
  Tabs,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useT } from '@shared/theme';
import {
  Add,
  CloudDownload,
  FolderSpecial,
  History,
  LinkOff,
  Wifi,
  WifiOff,
  Sync,
  ErrorOutline,
  Bolt,
  FiberManualRecord as DotIcon,
  DownloadDone,
} from '@mui/icons-material';
import { AnimatePresence, motion } from 'framer-motion';

import { useIngestionWS } from './hooks/useIngestionWS';
import useIngestionStore from './store/ingestionStore';
import IngestionForm from './form/IngestionForm';
import JobList from './jobs/JobList';
import JobHistory from './history/JobHistory';
import UnassignedFiles from './files/UnassignedFiles';
import LinkFileForm from './files/LinkFileForm';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const TABS = [
  { label: 'New Job', Icon: Add, id: 'new-job' },
  { label: 'Live Jobs', Icon: CloudDownload, id: 'live' },
  { label: 'History', Icon: History, id: 'history' },
  { label: 'Unassigned', Icon: LinkOff, id: 'unassigned' },
  { label: 'Link File', Icon: FolderSpecial, id: 'link-file' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatTime(value) {
  if (!value) return null;
  try {
    return new Date(value).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return null;
  }
}

function getWsConfig(T, wsStatus) {
  switch (wsStatus) {
    case 'connected':
      return {
        text: 'Live',
        color: T.success,
        icon: <Wifi sx={{ fontSize: 15 }} />,
        bg: alpha(T.success, 0.1),
        border: alpha(T.success, 0.28),
      };
    case 'connecting':
      return {
        text: 'Connecting…',
        color: T.warning,
        icon: <Sync sx={{ fontSize: 15 }} />,
        bg: alpha(T.warning, 0.1),
        border: alpha(T.warning, 0.28),
      };
    case 'error':
      return {
        text: 'Error',
        color: T.error,
        icon: <ErrorOutline sx={{ fontSize: 15 }} />,
        bg: alpha(T.error, 0.1),
        border: alpha(T.error, 0.28),
      };
    case 'disconnected':
    default:
      return {
        text: 'Offline',
        color: T.textFaint,
        icon: <WifiOff sx={{ fontSize: 15 }} />,
        bg: alpha(T.textFaint, 0.08),
        border: alpha(T.textFaint, 0.2),
      };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Status badge cluster
// ─────────────────────────────────────────────────────────────────────────────

const WsBadge = memo(function WsBadge({ compact = false }) {
  const T = useT();
  const wsStatus = useIngestionStore((s) => s.wsStatus);
  const jobs = useIngestionStore((s) => s.jobs);
  const lastUpdated = useIngestionStore((s) => s.lastUpdated);

  const cfg = getWsConfig(T, wsStatus);

  const activeCount = useMemo(
    () =>
      Object.values(jobs).filter((j) =>
        ['DOWNLOADING', 'PROCESSING', 'STARTED'].includes(j.status)
      ).length,
    [jobs]
  );

  const updatedTime = useMemo(() => formatTime(lastUpdated), [lastUpdated]);

  if (compact) {
    return (
      <Stack
        direction="row"
        spacing={0.6}
        alignItems="center"
        flexWrap="wrap"
        useFlexGap
      >
        <Chip
          icon={React.cloneElement(cfg.icon, {
            sx: { fontSize: '14px !important', color: `${cfg.color} !important` },
          })}
          label={cfg.text}
          size="small"
          sx={{
            bgcolor: cfg.bg,
            color: cfg.color,
            fontWeight: 700,
            fontSize: '0.68rem',
            height: 24,
            border: `1px solid ${cfg.border}`,
            borderRadius: 999,
          }}
        />

        {activeCount > 0 ? (
          <Chip
            icon={<Bolt sx={{ fontSize: '13px !important' }} />}
            label={`${activeCount}`}
            size="small"
            color="primary"
            variant="outlined"
            sx={{
              fontSize: '0.68rem',
              height: 24,
              fontWeight: 700,
              borderRadius: 999,
            }}
          />
        ) : null}

        {updatedTime && wsStatus === 'connected' ? (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.35,
              fontSize: '0.66rem',
              lineHeight: 1,
            }}
          >
            <DotIcon sx={{ fontSize: 7 }} />
            {updatedTime}
          </Typography>
        ) : null}
      </Stack>
    );
  }

  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={1}
      alignItems={{ xs: 'flex-start', sm: 'center' }}
      useFlexGap
      flexWrap="wrap"
    >
      <Chip
        icon={React.cloneElement(cfg.icon, {
          sx: { fontSize: '16px !important', color: `${cfg.color} !important` },
        })}
        label={cfg.text}
        size="small"
        sx={{
          bgcolor: cfg.bg,
          color: cfg.color,
          fontWeight: 700,
          fontSize: '0.74rem',
          height: 30,
          border: `1px solid ${cfg.border}`,
          borderRadius: 999,
        }}
      />

      {activeCount > 0 ? (
        <Chip
          icon={<Bolt sx={{ fontSize: '15px !important' }} />}
          label={`${activeCount} active`}
          size="small"
          color="primary"
          variant="outlined"
          sx={{
            fontSize: '0.74rem',
            height: 30,
            fontWeight: 700,
            borderRadius: 999,
          }}
        />
      ) : (
        <Chip
          icon={<DownloadDone sx={{ fontSize: '15px !important' }} />}
          label="No active jobs"
          size="small"
          variant="outlined"
          sx={{
            fontSize: '0.74rem',
            height: 30,
            fontWeight: 700,
            borderRadius: 999,
          }}
        />
      )}

      {updatedTime && wsStatus === 'connected' ? (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            px: 0.5,
          }}
        >
          <DotIcon sx={{ fontSize: 8 }} />
          Updated {updatedTime}
        </Typography>
      ) : null}
    </Stack>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Header
// ─────────────────────────────────────────────────────────────────────────────

const HeaderHero = memo(function HeaderHero({ liveCount, compact = false }) {
  const theme = useTheme();

  if (compact) {
    return (
      <Paper
        elevation={0}
        variant="outlined"
        sx={{
          borderRadius: 3,
          overflow: 'hidden',
          borderColor: alpha(theme.palette.divider, 0.5),
          background:
            theme.palette.mode === 'dark'
              ? `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.12)} 0%, rgba(255,255,255,0.02) 100%)`
              : `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.06)} 0%, rgba(255,255,255,0.96) 100%)`,
          boxShadow: 'none',
        }}
      >
        <Box sx={{ p: 1.2 }}>
          <Stack spacing={0.75}>
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              spacing={1}
            >
              <Box minWidth={0}>
                <Typography
                  variant="subtitle1"
                  fontWeight={900}
                  sx={{
                    fontSize: '1.05rem',
                    lineHeight: 1.1,
                  }}
                >
                  Media Ingestion
                </Typography>
              </Box>

              <WsBadge compact />
            </Stack>

            <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap>
              <Chip
                size="small"
                color="primary"
                variant="outlined"
                label={`${liveCount} live`}
                sx={{
                  fontWeight: 700,
                  borderRadius: 999,
                  height: 22,
                  fontSize: '0.66rem',
                }}
              />
              <Chip
                size="small"
                variant="outlined"
                label="Queue • Process • Link"
                sx={{
                  fontWeight: 700,
                  borderRadius: 999,
                  height: 22,
                  fontSize: '0.66rem',
                }}
              />
            </Stack>
          </Stack>
        </Box>
      </Paper>
    );
  }

  return (
    <Paper
      elevation={0}
      variant="outlined"
      sx={{
        borderRadius: 4,
        overflow: 'hidden',
        borderColor: alpha(theme.palette.divider, 0.75),
        background:
          theme.palette.mode === 'dark'
            ? `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.16)} 0%, rgba(255,255,255,0.025) 100%)`
            : `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.08)} 0%, rgba(255,255,255,0.94) 100%)`,
      }}
    >
      <Box sx={{ p: { xs: 2, md: 2.75 } }}>
        <Stack
          direction={{ xs: 'column', lg: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', lg: 'center' }}
          spacing={1.75}
        >
          <Box>
            <Typography
              variant="h4"
              fontWeight={900}
              sx={{
                fontSize: {
                  xs: '1.55rem',
                  sm: '1.9rem',
                  md: '2.2rem',
                },
                lineHeight: 1.12,
              }}
            >
              Media Ingestion
            </Typography>

            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mt: 0.75, maxWidth: 720 }}
            >
              Download, process, enrich, link and track media ingestion jobs from a single workspace.
            </Typography>

            <Stack
              direction="row"
              spacing={1}
              useFlexGap
              flexWrap="wrap"
              sx={{ mt: 1.5 }}
            >
              <Chip
                size="small"
                color="primary"
                variant="outlined"
                label={`${liveCount} live job${liveCount !== 1 ? 's' : ''}`}
                sx={{ fontWeight: 700, borderRadius: 999 }}
              />
              <Chip
                size="small"
                variant="outlined"
                label="Queue • Process • Link"
                sx={{ fontWeight: 700, borderRadius: 999 }}
              />
            </Stack>
          </Box>

          <WsBadge />
        </Stack>
      </Box>
    </Paper>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Tabs
// ─────────────────────────────────────────────────────────────────────────────

const PageTabs = memo(function PageTabs({
  activeTab,
  setActiveTab,
  liveCount,
  compact = false,
}) {
  const T = useT();

  return (
    <Tabs
      value={activeTab}
      onChange={(_, value) => setActiveTab(value)}
      variant="scrollable"
      scrollButtons="auto"
      allowScrollButtonsMobile
      sx={{
        minHeight: compact ? 42 : 56,
        px: compact ? 0.25 : { xs: 0.5, sm: 1 },
        borderBottom: `1px solid ${T.border}`,
        bgcolor: alpha(T.bg, compact ? 0.4 : 0.55),
        '& .MuiTabs-indicator': {
          height: compact ? 2.5 : 3,
          borderRadius: 999,
        },
        '& .MuiTab-root': {
          minHeight: compact ? 42 : 56,
          py: compact ? 0.55 : 1,
          px: compact ? 1 : { xs: 1.25, sm: 1.75 },
          textTransform: 'none',
          fontWeight: 700,
          fontSize: compact ? '0.8rem' : '0.92rem',
          minWidth: compact ? 'auto' : undefined,
        },
      }}
    >
      {TABS.map(({ label, Icon, id }, index) => (
        <Tab
          key={id}
          id={`ingestion-tab-${index}`}
          aria-controls={`ingestion-panel-${index}`}
          label={
            <Stack direction="row" spacing={compact ? 0.45 : 0.85} alignItems="center">
              <Icon sx={{ fontSize: compact ? 15 : 17 }} />
              <span>{label}</span>

              {id === 'live' && liveCount > 0 ? (
                <Chip
                  label={liveCount}
                  size="small"
                  color="primary"
                  sx={{
                    height: compact ? 18 : 20,
                    minWidth: compact ? 18 : 22,
                    fontSize: compact ? '0.62rem' : '0.68rem',
                    ml: 0.15,
                    fontWeight: 800,
                    '& .MuiChip-label': { px: compact ? 0.6 : 0.8 },
                  }}
                />
              ) : null}
            </Stack>
          }
        />
      ))}
    </Tabs>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

export default function IngestionPage() {
  useIngestionWS();

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isCompactMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const activeTab = useIngestionStore((s) => s.activeTab);
  const setActiveTab = useIngestionStore((s) => s.setActiveTab);
  const jobs = useIngestionStore((s) => s.jobs);

  const liveCount = useMemo(() => Object.keys(jobs).length, [jobs]);

  const tabContent = useMemo(
    () => [
      <IngestionForm key="new-job" onSubmitted={() => setActiveTab(1)} />,
      <JobList key="live" />,
      <JobHistory key="history" />,
      <UnassignedFiles key="unassigned" />,
      <LinkFileForm key="link-file" />,
    ],
    [setActiveTab]
  );

  return (
    <Box
      sx={{
        maxWidth: 1440,
        mx: 'auto',
        px: isCompactMobile ? 0.75 : { xs: 1, sm: 2, lg: 3 },
        py: isCompactMobile ? 0.75 : { xs: 1.25, sm: 2, lg: 2.5 },
      }}
    >
      <Stack spacing={isCompactMobile ? 1 : 2.25}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22 }}
        >
          <HeaderHero liveCount={liveCount} compact={isCompactMobile} />
        </motion.div>

        {/* Content shell */}
        <Paper
          elevation={0}
          variant='outlined'
          sx={{
            borderRadius: isCompactMobile ? 3 : 4,
            overflow: 'hidden',
            borderColor: alpha(theme.palette.divider, 0.75),
            background:
              theme.palette.mode === 'dark'
                ? 'linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.01) 100%)'
                : 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.96) 100%)',
            boxShadow: isCompactMobile
              ? 'none'
              : theme.palette.mode === 'dark'
                ? '0 10px 30px rgba(0,0,0,0.18)'
                : '0 10px 30px rgba(15, 23, 42, 0.05)',
          }}
        >
          {/* Tabs */}
          <PageTabs
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            liveCount={liveCount}
            compact={isCompactMobile}
          />

          {/* Tab content */}
          <Box
            role="tabpanel"
            id={`ingestion-panel-${activeTab}`}
            aria-labelledby={`ingestion-tab-${activeTab}`}
            sx={{
              p: isCompactMobile ? 0.85 : { xs: 1.25, sm: 2, lg: 2.5 },
              minHeight: isCompactMobile ? 380 : { xs: 420, md: 520 },
            }}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, x: 10, scale: 0.995 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -10, scale: 0.995 }}
                transition={{ duration: 0.16 }}
              >
                {tabContent[activeTab]}
              </motion.div>
            </AnimatePresence>
          </Box>
        </Paper>
      </Stack>
    </Box>
  );
}