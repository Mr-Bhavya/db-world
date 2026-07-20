import React, { memo, useMemo, useState } from 'react';
import {
  alpha,
  Alert,
  Box,
  Chip,
  Paper,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  AllInclusive,
  CheckCircle,
  CloudDownload,
  Error as ErrorIcon,
  Pause,
  PlayArrow,
  Queue,
  Speed,
  Sync,
  WifiOff,
} from '@mui/icons-material';
import { AnimatePresence, motion } from 'framer-motion';

import JobCard from './JobCard';
import useIngestionStore from '../store/ingestionStore';
import JobCardPreview from './JobCardPreview';

// Set to true only when you explicitly want to preview mock cards
const SHOW_PREVIEW = false;

// ─────────────────────────────────────────────────────────────────────────────
// Groups
// ─────────────────────────────────────────────────────────────────────────────

const GROUPS = [
  { key: 'all', label: 'All', Icon: AllInclusive, statuses: null },
  { key: 'active', label: 'Active', Icon: PlayArrow, statuses: ['STARTED', 'DOWNLOADING', 'PROCESSING'] },
  { key: 'queued', label: 'Queued', Icon: Queue, statuses: ['QUEUED'] },
  { key: 'paused', label: 'Paused', Icon: Pause, statuses: ['PAUSED'] },
  { key: 'completed', label: 'Done', Icon: CheckCircle, statuses: ['SUCCESS'] },
  { key: 'failed', label: 'Failed', Icon: ErrorIcon, statuses: ['FAILED', 'CANCELLED'] },
];

const STATUS_ORDER = {
  DOWNLOADING: 0,
  PROCESSING: 1,
  STARTED: 2,
  QUEUED: 3,
  PAUSED: 4,
  SUCCESS: 5,
  FAILED: 6,
  CANCELLED: 7,
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatSpeed(bytesPerSecond) {
  if (!bytesPerSecond || bytesPerSecond <= 0) return null;
  return `${(bytesPerSecond / 1024 / 1024).toFixed(1)} MB/s`;
}

function getWsEmptyMessage(wsStatus, filter) {
  if (wsStatus === 'connecting') {
    return {
      title: 'Connecting…',
      subtitle: 'Waiting for live job updates.',
      icon: <Sync sx={{ fontSize: 22 }} />,
      severity: 'info',
    };
  }

  if (wsStatus !== 'connected') {
    return {
      title: 'Connection unavailable',
      subtitle: 'Waiting for WebSocket updates.',
      icon: <WifiOff sx={{ fontSize: 22 }} />,
      severity: 'warning',
    };
  }

  return {
    title: filter === 'all' ? 'No live jobs yet' : 'No jobs match this filter',
    subtitle:
      filter === 'all'
        ? 'Start a new ingestion job and it will appear here.'
        : 'Try another filter.',
    icon: <CloudDownload sx={{ fontSize: 22 }} />,
    severity: 'info',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Filter bar — the status toggles double as the summary (each carries its count)
// ─────────────────────────────────────────────────────────────────────────────

const FilterBar = memo(function FilterBar({
  filter,
  setFilter,
  groupedCounts,
  isMobile,
}) {
  return (
    <Box sx={{ overflowX: 'auto', pb: isMobile ? 0 : 0.2 }}>
      <ToggleButtonGroup
        size="small"
        value={filter}
        exclusive
        onChange={(_, value) => value && setFilter(value)}
        sx={{
          flexWrap: isMobile ? 'nowrap' : 'wrap',
          '& .MuiToggleButton-root': {
            gap: isMobile ? 1 : 0.65,
            px: isMobile ? 0.95 : 1.35,
            py: isMobile ? 0.38 : 0.75,
            minHeight: isMobile ? 28 : undefined,
            textTransform: 'none',
            fontWeight: 700,
            borderRadius: '999px !important',
            whiteSpace: 'nowrap',
            fontSize: isMobile ? '0.73rem' : undefined,
          },
        }}
      >
        {GROUPS.map(({ key, label, Icon }) => {
          const count = groupedCounts[key] ?? 0;

          return (
            <ToggleButton key={key} value={key}>
              <Icon sx={{ fontSize: isMobile ? 13.5 : 15 }} />
              {label}
              {count > 0 ? (
                <Chip
                  label={count}
                  size="small"
                  color={filter === key ? 'primary' : 'default'}
                  sx={{
                    ml: 0.15,
                    height: isMobile ? 16 : 19,
                    fontSize: isMobile ? '0.6rem' : '0.66rem',
                    fontWeight: 800,
                    '& .MuiChip-label': { px: isMobile ? 0.6 : 0.8 },
                  }}
                />
              ) : null}
            </ToggleButton>
          );
        })}
      </ToggleButtonGroup>
    </Box>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Empty state
// ─────────────────────────────────────────────────────────────────────────────

const EmptyState = memo(function EmptyState({ wsStatus, filter, isMobile }) {
  const theme = useTheme();
  const info = getWsEmptyMessage(wsStatus, filter);

  return (
    <Paper
      elevation={0}
      variant={isMobile ? undefined : 'outlined'}
      sx={{
        borderRadius: isMobile ? 3 : 4,
        py: { xs: 2.1, md: 6 },
        px: isMobile ? 1.1 : 2,
        textAlign: 'center',
        borderStyle: isMobile ? 'none' : 'dashed',
        borderColor: alpha(theme.palette.divider, 0.85),
        bgcolor: alpha(theme.palette.primary.main, isMobile ? 0.015 : 0.02),
        boxShadow: 'none',
      }}
    >
      <Stack spacing={isMobile ? 0.8 : 1.25} alignItems="center">
        <Box
          sx={{
            width: isMobile ? 40 : 58,
            height: isMobile ? 40 : 58,
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            bgcolor: alpha(theme.palette.primary.main, 0.08),
            color: 'primary.main',
          }}
        >
          {info.icon}
        </Box>

        <Typography variant={isMobile ? 'subtitle2' : 'h6'} fontWeight={800}>
          {info.title}
        </Typography>

        <Typography
          variant={isMobile ? 'caption' : 'body2'}
          color="text.secondary"
          sx={{ maxWidth: 460 }}
        >
          {info.subtitle}
        </Typography>

        {info.severity === 'warning' ? (
          <Alert
            severity="warning"
            sx={{
              mt: 0.4,
              borderRadius: 3,
              py: isMobile ? 0 : undefined,
              px: isMobile ? 0.4 : undefined,
            }}
          >
            <Typography variant={isMobile ? 'caption' : 'body2'}>
              Live job updates depend on the WebSocket connection.
            </Typography>
          </Alert>
        ) : null}
      </Stack>
    </Paper>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function JobList() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const jobs = useIngestionStore((s) => s.jobs);
  const wsStatus = useIngestionStore((s) => s.wsStatus);
  const [filter, setFilter] = useState('all');

  const jobArray = useMemo(() => Object.values(jobs), [jobs]);

  const groupedCounts = useMemo(() => {
    const counts = {
      all: jobArray.length,
      active: 0,
      queued: 0,
      paused: 0,
      completed: 0,
      failed: 0,
    };

    jobArray.forEach((job) => {
      const status = job.status;

      if (['STARTED', 'DOWNLOADING', 'PROCESSING'].includes(status)) counts.active += 1;
      else if (status === 'QUEUED') counts.queued += 1;
      else if (status === 'PAUSED') counts.paused += 1;
      else if (status === 'SUCCESS') counts.completed += 1;
      else if (['FAILED', 'CANCELLED'].includes(status)) counts.failed += 1;
    });

    return counts;
  }, [jobArray]);

  const totalSpeed = useMemo(
    () => jobArray.reduce((sum, j) => sum + (Number(j?.progress?.speed) || 0), 0),
    [jobArray]
  );

  const filtered = useMemo(() => {
    const group = GROUPS.find((g) => g.key === filter);
    if (!group?.statuses) return jobArray;
    return jobArray.filter((job) => group.statuses.includes(job.status));
  }, [jobArray, filter]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const orderA = STATUS_ORDER[a.status] ?? 99;
      const orderB = STATUS_ORDER[b.status] ?? 99;

      if (orderA !== orderB) return orderA - orderB;
      return (b.startTime ?? 0) - (a.startTime ?? 0);
    });
  }, [filtered]);

  const hasJobs = sorted.length > 0;

  return (
    <Box>
      <Stack spacing={isMobile ? 0.9 : 1.5}>
        {/* Compact filter row — status toggles (with counts) + live throughput */}
        <Stack direction="row" spacing={1} alignItems="center">
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <FilterBar
              filter={filter}
              setFilter={setFilter}
              groupedCounts={groupedCounts}
              isMobile={isMobile}
            />
          </Box>
          {totalSpeed > 0 ? (
            <Chip
              size="small"
              icon={<Speed sx={{ fontSize: 15 }} />}
              label={formatSpeed(totalSpeed)}
              color="primary"
              variant="outlined"
              sx={{ fontWeight: 700, borderRadius: 999, flexShrink: 0 }}
            />
          ) : null}
        </Stack>

        {/* Optional preview for local UI testing only */}
        {SHOW_PREVIEW ? <JobCardPreview /> : null}

        {/* Jobs */}
        {!hasJobs ? (
          <EmptyState wsStatus={wsStatus} filter={filter} isMobile={isMobile} />
        ) : (
          <Stack spacing={isMobile ? 0.7 : 1.25}>
            <AnimatePresence initial={false}>
              {sorted.map((job) => (
                <motion.div
                  key={job.jobId}
                  layout
                  initial={{ opacity: 0, y: 8, scale: 0.995 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.995 }}
                  transition={{ duration: 0.14 }}
                >
                  <JobCard job={job} />
                </motion.div>
              ))}
            </AnimatePresence>
          </Stack>
        )}
      </Stack>
    </Box>
  );
}
