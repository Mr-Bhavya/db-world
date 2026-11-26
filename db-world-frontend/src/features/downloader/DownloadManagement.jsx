import React, { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Alert, Box, Chip, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { CheckCircleOutline, CloudDownloadOutlined, DeleteSweep, Downloading, ErrorOutline, Schedule } from '@mui/icons-material';
import { useThemeMode } from '@shared/theme';
import { AdminActionButton, AdminPage, SectionCard, StatCard, StatGrid, StickyBar, adminSurface } from '@features/admin/adminUi';
import { activeStatuses, cleanupMedia, DOWNLOADS_KEY, errorMessage, formatBytes, useMediaJobs } from './downloaderApi';
import { ADMIN_JOB_STATUSES, countJobStatuses, filterAdminJobs } from './downloadCenterModel';
import MediaJobList from './MediaJobList';

const STATUS_OPTIONS = ['all', ...ADMIN_JOB_STATUSES];

export default function DownloadManagement() {
  const { T, mode } = useThemeMode();
  const S = adminSurface(T);
  const accent = mode === 'light' ? '#0f766e' : T.teal;
  const fieldSx = {
    minWidth: 0,
    '& .MuiOutlinedInput-root': {
      minHeight: 44, bgcolor: S.card, color: T.text,
      '& fieldset': { borderColor: S.border },
      '&:hover fieldset': { borderColor: T.borderHover },
      '&.Mui-focused fieldset': { borderColor: T.teal },
    },
    '& .MuiInputLabel-root': { color: T.textMuted },
    '& .MuiInputLabel-root.Mui-focused': { color: accent },
    '& .MuiSelect-icon': { color: T.textMuted },
    '& input': { colorScheme: mode },
  };
  const jobs = useMediaJobs(true);
  const client = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [date, setDate] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const allJobs = useMemo(() => jobs.data || [], [jobs.data]);
  const visible = useMemo(() => filterAdminJobs(allJobs, { status, date, search }), [allJobs, status, date, search]);
  const statusCounts = useMemo(() => countJobStatuses(allJobs), [allJobs]);
  const used = allJobs.filter((job) => job.status === 'READY').reduce((total, job) => total + (Number(job.bytesTotal) || 0), 0);
  const running = allJobs.filter((job) => job.status === 'DOWNLOADING' || job.status === 'CONVERTING');
  const combinedSpeed = running.reduce((total, job) => total + (Number(job.speed) > 0 ? Number(job.speed) : 0), 0);
  const splitLive = status === 'all';
  const liveJobs = splitLive ? visible.filter((job) => activeStatuses.includes(job.status)) : [];
  const listJobs = splitLive ? visible.filter((job) => !activeStatuses.includes(job.status)) : visible;
  const clean = async () => {
    setBusy(true); setError(''); setNotice('');
    try {
      const count = await cleanupMedia();
      setNotice(`${count} expired preparations cleaned.`);
      await client.invalidateQueries({ queryKey: DOWNLOADS_KEY });
    } catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(false); }
  };
  const setStatusFilter = (value) => setStatus(value);

  return (
    <AdminPage
      title="Download Management"
      subtitle={`${allJobs.length} jobs · ${formatBytes(used)} ready files`}
      icon={CloudDownloadOutlined}
      onRefresh={() => jobs.refetch()}
      refreshing={jobs.isFetching}
      actions={<AdminActionButton variant="danger" icon={DeleteSweep} onClick={clean} loading={busy} sx={{ minHeight: 44 }}>Clean expired</AdminActionButton>}
    >
      <StatGrid sx={{ mb: 2 }}>
        <StatCard index={0} icon={Downloading} label="Live transfers" value={running.length} sub={combinedSpeed > 0 ? `${formatBytes(combinedSpeed)}/s combined` : 'No active transfer'} onClick={() => setStatusFilter('DOWNLOADING')} />
        <StatCard index={1} icon={Schedule} label="Queued" value={statusCounts.QUEUED || 0} sub="Waiting for a slot" accent={T.warning} onClick={() => setStatusFilter('QUEUED')} />
        <StatCard index={2} icon={CheckCircleOutline} label="Ready" value={statusCounts.READY || 0} sub={`${formatBytes(used)} on server`} accent={T.success} onClick={() => setStatusFilter('READY')} />
        <StatCard index={3} icon={ErrorOutline} label="Failed" value={statusCounts.FAILED || 0} sub="Can be retried" accent={T.error} onClick={() => setStatusFilter('FAILED')} />
      </StatGrid>

      <StickyBar sx={{ mb: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} gap={1.25}>
          <TextField
            size="small" label="Search user, site, title or job ID" value={search}
            onChange={(event) => setSearch(event.target.value)} sx={{ ...fieldSx, flex: 1 }}
          />
          <TextField
            size="small" type="date" label="Created date" value={date}
            onChange={(event) => setDate(event.target.value)} slotProps={{ inputLabel: { shrink: true } }}
            sx={{ ...fieldSx, minWidth: { md: 190 } }}
          />
          <TextField
            select size="small" label="Status" value={status} onChange={(event) => setStatusFilter(event.target.value)}
            sx={{ ...fieldSx, minWidth: { md: 180 } }}
          >
            {STATUS_OPTIONS.map((value) => <MenuItem key={value} value={value}>{value === 'all' ? `All statuses (${allJobs.length})` : `${value} (${statusCounts[value] || 0})`}</MenuItem>)}
          </TextField>
        </Stack>
        <Box sx={{ display: 'flex', flexWrap: { xs: 'nowrap', md: 'wrap' }, overflowX: { xs: 'auto', md: 'visible' }, scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' }, '& > *': { flexShrink: 0 }, gap: 0.75, mt: 1.25 }} role="group" aria-label="Download job status counts">
          <Chip
            clickable label={`All · ${allJobs.length}`} aria-pressed={status === 'all'} onClick={() => setStatusFilter('all')}
            sx={{ minHeight: 44, bgcolor: status === 'all' ? T.tealBg : S.inset, color: status === 'all' ? accent : T.textMuted, border: `1px solid ${status === 'all' ? T.teal : S.border}`, fontWeight: 700, cursor: 'pointer' }}
          />
          {ADMIN_JOB_STATUSES.map((value) => (
            <Chip
              key={value} clickable label={`${value} · ${statusCounts[value] || 0}`} aria-pressed={status === value} onClick={() => setStatusFilter(value)}
              sx={{ minHeight: 44, bgcolor: status === value ? T.tealBg : S.inset, color: status === value ? accent : T.textMuted, border: `1px solid ${status === value ? T.teal : S.border}`, fontWeight: 700, cursor: 'pointer', '&:hover': { bgcolor: T.tealBg } }}
            />
          ))}
        </Box>
      </StickyBar>

      {(error || jobs.error) && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error || errorMessage(jobs.error)}</Alert>}
      {notice && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNotice('')}>{notice}</Alert>}
      {allJobs.length >= 500 && <Typography sx={{ mb: 1.5, fontSize: 12, color: T.textMuted }}>Showing latest 500 jobs. Older jobs are not included in this view.</Typography>}
      {jobs.isLoading && <Box sx={{ mb: 2 }}><Typography sx={{ color: T.textMuted, mb: 1 }}>Loading download jobs…</Typography></Box>}

      {liveJobs.length > 0 && (
        <SectionCard title={`Live now (${liveJobs.length})`} icon={Downloading} flushMobile sx={{ mb: 2 }}>
          <MediaJobList jobs={liveJobs} admin />
        </SectionCard>
      )}

      <SectionCard title={splitLive ? `History (${listJobs.length})` : `Preparations (${listJobs.length})`} icon={CloudDownloadOutlined} flushMobile>
        <MediaJobList jobs={listJobs} admin emptyMessage={allJobs.length ? 'No jobs match the selected filters.' : 'No download jobs have been created yet.'} />
      </SectionCard>
    </AdminPage>
  );
}
