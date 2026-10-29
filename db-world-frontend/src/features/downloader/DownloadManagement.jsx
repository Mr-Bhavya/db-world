import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Alert, Box, Button, LinearProgress, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { DeleteSweep, Refresh } from '@mui/icons-material';
import { cleanupMedia, DOWNLOADS_KEY, errorMessage, formatBytes, useMediaJobs } from './downloaderApi';
import MediaJobList from './MediaJobList';

export default function DownloadManagement() {
  const jobs = useMediaJobs(true);
  const client = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [date, setDate] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const visible = (jobs.data || []).filter((job) => (status === 'all' || job.status === status)
    && (!date || job.createdAt.startsWith(date))
    && `${job.owner} ${job.source || ''} ${job.title} ${job.id}`.toLowerCase().includes(search.toLowerCase()));
  const clean = async () => {
    setBusy(true); setError('');
    try { const count = await cleanupMedia(); setNotice(`${count} expired preparations cleaned.`); await client.invalidateQueries({ queryKey: DOWNLOADS_KEY }); }
    catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(false); }
  };
  const used = (jobs.data || []).filter((job) => job.status === 'READY').reduce((total, job) => total + job.bytesTotal, 0);
  return <Box sx={{ p: { xs: 1, sm: 3 }, minWidth: 0 }}>
    <Typography component="h1" variant="h5" fontWeight={800} mb={1}>Download Management</Typography>
    <Typography color="text.secondary" mb={2}>{jobs.data?.length || 0} jobs / {formatBytes(used)} ready files</Typography>
    <Stack direction={{ xs: 'column', md: 'row' }} gap={1.5} mb={2}>
      <TextField size="small" label="User, site, title or job ID" value={search} onChange={(event) => setSearch(event.target.value)} sx={{ flex: 1 }} />
      <TextField size="small" type="date" label="Created date" value={date} onChange={(event) => setDate(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
      <TextField select size="small" label="Status" value={status} onChange={(event) => setStatus(event.target.value)} sx={{ minWidth: 150 }}>
        {['all', 'QUEUED', 'DOWNLOADING', 'CONVERTING', 'READY', 'FAILED', 'CANCELLED', 'EXPIRED', 'DELETED'].map((value) => <MenuItem key={value} value={value}>{value === 'all' ? 'All statuses' : value}</MenuItem>)}
      </TextField>
      <Button startIcon={<Refresh />} onClick={() => jobs.refetch()}>Refresh</Button>
      <Button startIcon={<DeleteSweep />} disabled={busy} onClick={clean}>Clean expired</Button>
    </Stack>
    {(error || jobs.error) && <Alert severity="error">{error || errorMessage(jobs.error)}</Alert>}
    {notice && <Alert severity="success" onClose={() => setNotice('')}>{notice}</Alert>}
    {jobs.isLoading && <LinearProgress aria-label="Loading user downloads" />}
    <MediaJobList jobs={visible} admin />
  </Box>;
}