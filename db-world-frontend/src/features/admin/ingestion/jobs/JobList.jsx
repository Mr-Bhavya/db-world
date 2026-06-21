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
import { useT } from '@shared/theme';
import {
  AllInclusive,
  CheckCircle,
  CloudDownload,
  Error as ErrorIcon,
  HourglassTop,
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
// Summary
// ─────────────────────────────────────────────────────────────────────────────

const SummaryTile = memo(function SummaryTile({
  label,
  value,
  color,
  icon,
  outlined = false,
  isMobile = false,
}) {
  const theme = useTheme();

  return (
    <Paper
      elevation={0}
      variant={isMobile ? undefined : 'outlined'}
      sx={{
        minWidth: { xs: 'calc(50% - 4px)', sm: 140 },
        flex: { xs: '1 1 calc(50% - 4px)', sm: '0 1 auto' },
        p: isMobile ? 0.75 : 1.2,
        borderRadius: isMobile ? 2.1 : 3,
        borderColor: outlined
          ? alpha(theme.palette.divider, 0.85)
          : alpha(color, 0.2),
        bgcolor: outlined
          ? 'background.paper'
          : alpha(color, isMobile ? 0.09 : 0.07),
        boxShadow: 'none',
      }}
    >
      <Stack direction="row" spacing={isMobile ? 0.7 : 1} alignItems="center">
        <Box
          sx={{
            width: isMobile ? 26 : 34,
            height: isMobile ? 26 : 34,
            borderRadius: isMobile ? 1.6 : 2,
            display: 'grid',
            placeItems: 'center',
            color: outlined ? 'text.secondary' : color,
            bgcolor: outlined
              ? alpha(theme.palette.text.primary, 0.04)
              : alpha(color, isMobile ? 0.14 : 0.12),
            flexShrink: 0,
          }}
        >
          {icon}
        </Box>

        <Box minWidth={0}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              display: 'block',
              fontSize: isMobile ? '0.62rem' : undefined,
              lineHeight: 1.05,
            }}
          >
            {label}
          </Typography>
          <Typography
            variant={isMobile ? 'body2' : 'body1'}
            fontWeight={800}
            lineHeight={1.05}
          >
            {value}
          </Typography>
        </Box>
      </Stack>
    </Paper>
  );
});

const SummaryBar = memo(function SummaryBar({ jobs, isMobile }) {
  const T = useT();

  const counts = useMemo(() => {
    let active = 0;
    let queued = 0;
    let paused = 0;
    let done = 0;
    let failed = 0;
    let totalSpeed = 0;

    Object.values(jobs).forEach((j) => {
      const status = j.status;

      if (['STARTED', 'DOWNLOADING', 'PROCESSING'].includes(status)) active += 1;
      else if (status === 'QUEUED') queued += 1;
      else if (status === 'PAUSED') paused += 1;
      else if (status === 'SUCCESS') done += 1;
      else if (status === 'FAILED' || status === 'CANCELLED') failed += 1;

      if (j?.progress?.speed) {
        totalSpeed += Number(j.progress.speed) || 0;
      }
    });

    return {
      active,
      queued,
      paused,
      done,
      failed,
      totalSpeed,
      total: Object.keys(jobs).length,
    };
  }, [jobs]);

  if (isMobile) {
    return (
      <Stack direction="row" flexWrap="wrap" gap={0.6} useFlexGap>
        <Chip
          size="small"
          label={`All ${counts.total}`}
          variant="outlined"
          sx={{
            fontWeight: 700,
            borderRadius: 999,
            height: 22,
            fontSize: '0.66rem',
          }}
        />
        <Chip
          size="small"
          label={`Active ${counts.active}`}
          sx={{
            bgcolor: alpha(T.teal, 0.1),
            color: T.teal,
            fontWeight: 700,
            borderRadius: 999,
            height: 22,
            fontSize: '0.66rem',
          }}
        />
        <Chip
          size="small"
          label={`Queued ${counts.queued}`}
          sx={{
            bgcolor: alpha('#0288d1', 0.1),
            color: '#0288d1',
            fontWeight: 700,
            borderRadius: 999,
            height: 22,
            fontSize: '0.66rem',
          }}
        />
        <Chip
          size="small"
          label={`Done ${counts.done}`}
          sx={{
            bgcolor: alpha(T.success, 0.1),
            color: T.success,
            fontWeight: 700,
            borderRadius: 999,
            height: 22,
            fontSize: '0.66rem',
          }}
        />
        <Chip
          size="small"
          label={`Failed ${counts.failed}`}
          sx={{
            bgcolor: alpha(T.error, 0.1),
            color: T.error,
            fontWeight: 700,
            borderRadius: 999,
            height: 22,
            fontSize: '0.66rem',
          }}
        />
        {counts.totalSpeed > 0 ? (
          <Chip
            size="small"
            label={formatSpeed(counts.totalSpeed)}
            variant="outlined"
            sx={{
              fontWeight: 700,
              borderRadius: 999,
              height: 22,
              fontSize: '0.66rem',
            }}
          />
        ) : null}
      </Stack>
    );
  }

  return (
    <Stack spacing={1.25}>
      <Stack direction="row" flexWrap="wrap" gap={1} useFlexGap>
        <SummaryTile
          label="Active"
          value={counts.active}
          color={T.teal}
          icon={<PlayArrow sx={{ fontSize: 18 }} />}
        />
        <SummaryTile
          label="Queued"
          value={counts.queued}
          color="#0288d1"
          icon={<HourglassTop sx={{ fontSize: 18 }} />}
        />
        <SummaryTile
          label="Paused"
          value={counts.paused}
          color="#ed6c02"
          icon={<Pause sx={{ fontSize: 18 }} />}
        />
        <SummaryTile
          label="Done"
          value={counts.done}
          color={T.success}
          icon={<CheckCircle sx={{ fontSize: 18 }} />}
        />
        <SummaryTile
          label="Failed"
          value={counts.failed}
          color={T.error}
          icon={<ErrorIcon sx={{ fontSize: 18 }} />}
        />

        {counts.totalSpeed > 0 ? (
          <SummaryTile
            label="Total speed"
            value={formatSpeed(counts.totalSpeed)}
            color={T.textMuted}
            icon={<Speed sx={{ fontSize: 18 }} />}
            outlined
          />
        ) : null}
      </Stack>

      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
        <Chip
          size="small"
          variant="outlined"
          label={`Total jobs: ${counts.total}`}
          sx={{ fontWeight: 700, borderRadius: 999 }}
        />
        {counts.totalSpeed > 0 ? (
          <Chip
            size="small"
            variant="outlined"
            label={`Throughput: ${formatSpeed(counts.totalSpeed)}`}
            sx={{ fontWeight: 700, borderRadius: 999 }}
          />
        ) : null}
      </Stack>
    </Stack>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Filter bar
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

  const activeFilterLabel = useMemo(
    () => GROUPS.find((g) => g.key === filter)?.label || 'All',
    [filter]
  );

  return (
    <Box sx={{ px: isMobile ? 0 : undefined }}>
      <Stack spacing={isMobile ? 0.9 : 2}>
        {/* Summary */}
        <SummaryBar jobs={jobs} isMobile={isMobile} />

        {/* Filters */}
        {isMobile ? (
          <Stack spacing={0.55}>
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              sx={{ px: 0.2 }}
            >
              <Typography variant="caption" color="text.secondary" fontWeight={700}>
                {sorted.length} job{sorted.length !== 1 ? 's' : ''} · {activeFilterLabel}
              </Typography>

              {filter !== 'all' ? (
                <Chip
                  size="small"
                  label={activeFilterLabel}
                  color="primary"
                  variant="outlined"
                  sx={{
                    fontWeight: 700,
                    borderRadius: 999,
                    height: 20,
                    fontSize: '0.64rem',
                  }}
                />
              ) : null}
            </Stack>

            <FilterBar
              filter={filter}
              setFilter={setFilter}
              groupedCounts={groupedCounts}
              isMobile={isMobile}
            />
          </Stack>
        ) : (
          <Paper
            elevation={0}
            variant="outlined"
            sx={{
              borderRadius: 4,
              p: 1.5,
            }}
          >
            <Stack spacing={1.1}>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                alignItems={{ xs: 'flex-start', sm: 'center' }}
                justifyContent="space-between"
              >
                <Box>
                  <Typography variant="subtitle2" fontWeight={800}>
                    Filter live jobs
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Showing {sorted.length} job{sorted.length !== 1 ? 's' : ''} in {activeFilterLabel.toLowerCase()} view
                  </Typography>
                </Box>

                {filter !== 'all' ? (
                  <Chip
                    size="small"
                    label={`Filter: ${activeFilterLabel}`}
                    color="primary"
                    variant="outlined"
                    sx={{ fontWeight: 700, borderRadius: 999 }}
                  />
                ) : null}
              </Stack>

              <FilterBar
                filter={filter}
                setFilter={setFilter}
                groupedCounts={groupedCounts}
                isMobile={isMobile}
              />
            </Stack>
          </Paper>
        )}

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