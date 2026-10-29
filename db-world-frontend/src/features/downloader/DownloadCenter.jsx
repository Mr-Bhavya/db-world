import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { Alert, Box, Button, Chip, Container, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, LinearProgress, MenuItem, Stack, Tab, Tabs, TextField, Tooltip, Typography } from '@mui/material';
import { Cancel, Check, DeleteOutline, Download, Pause, PlayArrow, Refresh, Replay } from '@mui/icons-material';
import { useT } from '@shared/theme';
import Constants from '@shared/constants';
import DbWorldDownload from '@platform/android/DbWorldDownload';
import { useDownloads } from '@features/cinema/download-queue/useDownloads';
import { activeStatuses, errorMessage, formatBytes, formatEta, useMediaJobs } from './downloaderApi';
import MediaJobList from './MediaJobList';

const deviceActive = ['running', 'pending', 'paused', 'handed_off'];
const deviceLabels = { pending: 'Queued', running: 'Saving to device', paused: 'Paused', success: 'Saved', handed_off: 'Handed to browser', acknowledged: 'Browser transfer closed', failed: 'Failed', cancelled: 'Cancelled' };

export default function DownloadCenter() {
  const T = useT();
  const navigate = useNavigate();
  const media = useMediaJobs();
  const device = useDownloads();
  const [source, setSource] = useState('all');
  const [tab, setTab] = useState('all');
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState('');
  const nativeClient = Capacitor.isNativePlatform();
  const serverJobs = (media.data || []).filter((job) => source !== 'cinema' && (tab === 'all'
    || (tab === 'active' && activeStatuses.includes(job.status))
    || (tab === 'ready' && job.status === 'READY')
    || (tab === 'failed' && ['FAILED', 'CANCELLED', 'EXPIRED'].includes(job.status))));
  const transfers = device.downloads.filter((item) => (source === 'all' || (item.source === 'downloader' ? source === 'downloader' : source === 'cinema'))
    && (tab === 'all' || (tab === 'active' && deviceActive.includes(item.status))
      || (tab === 'ready' && ['success', 'acknowledged'].includes(item.status))
      || (tab === 'failed' && ['failed', 'cancelled'].includes(item.status))));
  const active = (media.data || []).filter((job) => activeStatuses.includes(job.status)).length + device.downloads.filter((item) => deviceActive.includes(item.status)).length;
  const act = async (item, action) => {
    setBusy(item.downloadId); setError('');
    try {
      if (action === 'finish') await DbWorldDownload.completeBrowserDownload({ downloadId: item.downloadId });
      else if (action === 'play') await DbWorldDownload.openDownloadedFile({ localUri: item.localUri, playableUri: item.playableUri });
      else await device.actions[action](item.downloadId);
      await device.refresh();
    } catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(''); setConfirm(null); }
  };

  return (
    <Box sx={{ bgcolor: T.bg, color: T.textPrimary, minHeight: '100vh', py: { xs: 3, md: 5 } }}>
      <Container maxWidth="lg">
        <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1} mb={2}>
          <Box sx={{ minWidth: 0 }}><Typography component="h1" variant="h4" sx={{ fontWeight: 800, fontSize: { xs: '1.65rem', md: '2rem' } }}>Download Center</Typography>
            <Typography variant="body2" color="text.secondary">{active} active</Typography></Box>
          <Stack direction="row" gap={0.5}>
            <Tooltip title="Refresh downloads"><IconButton aria-label="Refresh downloads" onClick={() => { media.refetch(); device.refresh(); }}><Refresh /></IconButton></Tooltip>
            <Tooltip title="New media download"><IconButton aria-label="New media download" onClick={() => navigate(Constants.DB_MEDIA_DOWNLOADER_ROUTE)}><Download /></IconButton></Tooltip>
          </Stack>
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={2} alignItems={{ sm: 'center' }} mb={2}>
          <TextField select size="small" label="Source" value={source} onChange={(event) => setSource(event.target.value)} sx={{ minWidth: 180 }}>
            <MenuItem value="all">All sources</MenuItem><MenuItem value="cinema">Cinema</MenuItem><MenuItem value="downloader">Media Downloader</MenuItem>
          </TextField>
          <Tabs value={tab} onChange={(_, value) => setTab(value)} variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile sx={{ minWidth: 0 }}>
            <Tab value="all" label="All" /><Tab value="active" label="Active" /><Tab value="ready" label="Ready / Saved" /><Tab value="failed" label="Failed / Expired" />
          </Tabs>
        </Stack>
        {(error || media.error) && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error || errorMessage(media.error)}</Alert>}
        {media.isLoading && <LinearProgress aria-label="Loading downloads" />}
        {source !== 'cinema' && <Box mb={4}>
          <Typography component="h2" variant="h6" fontWeight={700}>Server preparations</Typography>
          <MediaJobList jobs={serverJobs} />
        </Box>}
        <Typography component="h2" variant="h6" fontWeight={700} mb={1}>Device downloads</Typography>
        {device.loading && <LinearProgress aria-label="Loading device downloads" />}
        {!device.loading && !transfers.length && <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>No device downloads.</Typography>}
        {transfers.map((item) => <Box key={item.downloadId} sx={{ py: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Stack direction="row" gap={1.5}>
            {item.thumbnailUrl && <Box component="img" src={item.thumbnailUrl} alt="" sx={{ width: { xs: 64, sm: 112 }, aspectRatio: '16/9', objectFit: 'cover', borderRadius: 1, alignSelf: 'flex-start' }} />}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography fontWeight={700} sx={{ overflowWrap: 'anywhere' }}>{item.title}</Typography>
              <Stack direction="row" flexWrap="wrap" gap={1} mt={0.75} alignItems="center">
                <Chip size="small" label={deviceLabels[item.status] || item.status} color={item.status === 'failed' ? 'error' : item.status === 'success' ? 'success' : 'default'} />
                <Typography variant="caption" color="text.secondary">{item.source === 'downloader' ? 'Media Downloader' : 'Cinema'}</Typography>
              </Stack>
              {nativeClient && ['running', 'pending', 'paused'].includes(item.status) && <Box mt={1}>
                <LinearProgress variant={item.bytesTotal > 0 ? 'determinate' : 'indeterminate'} value={Math.min(100, item.progress || 0)} aria-label={`${item.title} transfer progress`} />
                <Typography variant="caption" color="text.secondary">{formatBytes(item.bytesDownloaded)} / {formatBytes(item.bytesTotal)}{item.speedBytesPerSec > 0 ? ` / ${formatBytes(item.speedBytesPerSec)}/s / ETA ${formatEta(item.etaSeconds)}` : ''}</Typography>
              </Box>}
              {item.errorMessage && <Alert severity="error" sx={{ mt: 1 }}>{item.errorMessage}</Alert>}
            </Box>
          </Stack>
          <Stack direction="row" gap={1} justifyContent="flex-end" flexWrap="wrap" mt={1}>
            {item.status === 'handed_off' && <Button startIcon={<Check />} onClick={() => act(item, 'finish')} disabled={!!busy}>Close browser transfer</Button>}
            {nativeClient && item.status === 'running' && <Tooltip title="Pause"><IconButton aria-label={`Pause ${item.title}`} disabled={!!busy} onClick={() => act(item, 'pause')}><Pause /></IconButton></Tooltip>}
            {nativeClient && item.status === 'paused' && <Tooltip title="Resume"><IconButton aria-label={`Resume ${item.title}`} disabled={!!busy} onClick={() => act(item, 'resume')}><PlayArrow /></IconButton></Tooltip>}
            {item.status === 'success' && item.canPlay && <Tooltip title="Open file"><IconButton aria-label={`Open ${item.title}`} disabled={!!busy} onClick={() => act(item, 'play')}><PlayArrow /></IconButton></Tooltip>}
            {['failed', 'cancelled'].includes(item.status) && <Tooltip title="Retry"><IconButton aria-label={`Retry ${item.title}`} disabled={!!busy} onClick={() => act(item, 'retry')}><Replay /></IconButton></Tooltip>}
            {['running', 'pending', 'paused'].includes(item.status) && <Tooltip title="Cancel"><IconButton aria-label={`Cancel ${item.title}`} disabled={!!busy} onClick={() => act(item, 'cancel')}><Cancel /></IconButton></Tooltip>}
            <Tooltip title="Remove device entry"><IconButton aria-label={`Remove ${item.title}`} disabled={!!busy} onClick={() => setConfirm(item)}><DeleteOutline /></IconButton></Tooltip>
          </Stack>
        </Box>)}
        <Dialog open={!!confirm} onClose={() => !busy && setConfirm(null)} fullWidth maxWidth="xs">
          <DialogTitle>{nativeClient && confirm?.status === 'success' ? 'Delete device file?' : 'Remove download entry?'}</DialogTitle>
          <DialogContent>{confirm?.title}</DialogContent>
          <DialogActions><Button disabled={!!busy} onClick={() => setConfirm(null)}>Keep</Button><Button disabled={!!busy} color="error" startIcon={<DeleteOutline />} onClick={() => act(confirm, 'remove')}>Remove</Button></DialogActions>
        </Dialog>
      </Container>
    </Box>
  );
}