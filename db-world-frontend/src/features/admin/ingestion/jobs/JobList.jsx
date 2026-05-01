import React, { useMemo, useState } from 'react';
import {
  Box, Typography, Stack, Chip, ToggleButtonGroup, ToggleButton,
  alpha,
} from '@mui/material';
import { useT } from '@shared/theme';
import {
  PlayArrow, Queue, Pause, CheckCircle, Error as ErrorIcon,
  AllInclusive
} from '@mui/icons-material';
import { AnimatePresence } from 'framer-motion';
import JobCard from './JobCard';
import useIngestionStore from '../store/ingestionStore';

const GROUPS = [
  { key: 'all',       label: 'All',       Icon: AllInclusive, statuses: null },
  { key: 'active',    label: 'Active',    Icon: PlayArrow,    statuses: ['STARTED','DOWNLOADING','PROCESSING'] },
  { key: 'queued',    label: 'Queued',    Icon: Queue,        statuses: ['QUEUED'] },
  { key: 'paused',    label: 'Paused',    Icon: Pause,        statuses: ['PAUSED'] },
  { key: 'completed', label: 'Done',      Icon: CheckCircle,  statuses: ['SUCCESS'] },
  { key: 'failed',    label: 'Failed',    Icon: ErrorIcon,    statuses: ['FAILED','CANCELLED'] },
];

function SummaryBar({ jobs }) {
  const T = useT();
  const counts = useMemo(() => {
    let active = 0, queued = 0, done = 0, failed = 0, totalSpeed = 0;
    Object.values(jobs).forEach((j) => {
      const s = j.status;
      if (['STARTED','DOWNLOADING','PROCESSING'].includes(s)) active++;
      else if (s === 'QUEUED')   queued++;
      else if (s === 'SUCCESS')  done++;
      else if (s === 'FAILED' || s === 'CANCELLED') failed++;
      if (j.progress?.speed) totalSpeed += j.progress.speed;
    });
    return { active, queued, done, failed, totalSpeed };
  }, [jobs]);

  return (
    <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 1.5 }}>
      {[
        { label: 'Active',  value: counts.active,  color: T.teal },
        { label: 'Queued',  value: counts.queued,  color: '#0288d1' },
        { label: 'Done',    value: counts.done,    color: T.success },
        { label: 'Failed',  value: counts.failed,  color: T.error },
      ].map((s) => (
        <Chip
          key={s.label}
          label={`${s.label}: ${s.value}`}
          size="small"
          sx={{
            bgcolor: alpha(s.color, 0.1),
            color: s.color,
            fontWeight: 600,
            fontSize: '0.72rem',
          }}
        />
      ))}
      {counts.totalSpeed > 0 && (
        <Chip
          label={`${(counts.totalSpeed / 1024 / 1024).toFixed(1)} MB/s`}
          size="small"
          variant="outlined"
          sx={{ fontSize: '0.72rem' }}
        />
      )}
    </Stack>
  );
}

export default function JobList() {
  const jobs     = useIngestionStore((s) => s.jobs);
  const wsStatus = useIngestionStore((s) => s.wsStatus);
  const [filter, setFilter] = useState('all');

  const jobArray = useMemo(() => Object.values(jobs), [jobs]);

  const filtered = useMemo(() => {
    const group = GROUPS.find((g) => g.key === filter);
    if (!group?.statuses) return jobArray;
    return jobArray.filter((j) => group.statuses.includes(j.status));
  }, [jobArray, filter]);

  // Sort: active first, then queued, then terminal; newest first within each
  const sorted = useMemo(() => {
    const ORDER = { DOWNLOADING:0, PROCESSING:1, STARTED:2, QUEUED:3, PAUSED:4, SUCCESS:5, FAILED:6, CANCELLED:7 };
    return [...filtered].sort((a, b) => {
      const oa = ORDER[a.status] ?? 99;
      const ob = ORDER[b.status] ?? 99;
      if (oa !== ob) return oa - ob;
      return (b.startTime ?? 0) - (a.startTime ?? 0);
    });
  }, [filtered]);

  return (
    <Box>
      <SummaryBar jobs={jobs} />

      {/* Filter tabs */}
      <Box sx={{ mb: 2, overflowX: 'auto' }}>
        <ToggleButtonGroup
          size="small"
          value={filter}
          exclusive
          onChange={(_, v) => v && setFilter(v)}
        >
          {GROUPS.map(({ key, label, Icon, statuses }) => {
            const count = statuses
              ? jobArray.filter((j) => statuses.includes(j.status)).length
              : jobArray.length;
            return (
              <ToggleButton key={key} value={key} sx={{ gap: 0.5, px: 1.5 }}>
                <Icon sx={{ fontSize: 15 }} />
                {label}
                {count > 0 && (
                  <Chip label={count} size="small" sx={{ ml: 0.5, height: 18, fontSize: '0.65rem' }} />
                )}
              </ToggleButton>
            );
          })}
        </ToggleButtonGroup>
      </Box>

      {/* Job cards */}
      {sorted.length === 0 ? (
        <Box sx={{ py: 6, textAlign: 'center' }}>
          <Typography color="text.secondary">
            {wsStatus === 'connecting' ? 'Connecting…' :
             wsStatus === 'connected'  ? 'No jobs match this filter.' :
             'Waiting for WebSocket connection…'}
          </Typography>
        </Box>
      ) : (
        <Stack spacing={1.25}>
          <AnimatePresence initial={false}>
            {sorted.map((job) => (
              <JobCard key={job.jobId} job={job} />
            ))}
          </AnimatePresence>
        </Stack>
      )}
    </Box>
  );
}
