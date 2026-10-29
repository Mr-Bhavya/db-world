import React, { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Alert, Box, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, LinearProgress, Stack, Tooltip, Typography } from '@mui/material';
import { Cancel, CheckCircleOutline, DeleteOutline, Download, Downloading, ErrorOutline, Replay, Schedule, Subtitles } from '@mui/icons-material';
import { useQueryClient } from '@tanstack/react-query';
import { activeStatuses, DOWNLOADS_KEY, errorMessage, formatBytes, formatEta, jobAction, mediaFiles, saveMedia, statusLabel } from './downloaderApi';

export default function MediaJobList({ jobs = [], admin = false }) {
  const client = useQueryClient();
  const reducedMotion = useReducedMotion();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [selected, setSelected] = useState([]);
  const [sidecars, setSidecars] = useState(null);
  const [notice, setNotice] = useState('');
  const act = async (job, action) => {
    setBusy(job.id); setError('');
    try { await jobAction(job.id, action, admin); await client.invalidateQueries({ queryKey: DOWNLOADS_KEY }); }
    catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(''); setConfirm(null); }
  };
  const save = async (items, name) => {
    setBusy(items[0].id); setError('');
    try { await saveMedia(items, name); setNotice('Added to device downloads.'); }
    catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(''); }
  };
  const showFiles = async (job) => {
    setBusy(job.id);
    try { setSidecars({ job, files: await mediaFiles(job.id) }); }
    catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(''); }
  };
  const readySelected = jobs.filter((job) => job.status === 'READY' && selected.includes(job.id));
  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {notice && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNotice('')}>{notice}</Alert>}
      {!admin && readySelected.length > 1 && <Button startIcon={<Download />} onClick={() => save(readySelected)} disabled={!!busy} sx={{ mb: 1 }}>Save {readySelected.length} as ZIP</Button>}
      {!jobs.length && <Typography color="text.secondary" sx={{ py: 6, textAlign: 'center' }}>No preparations yet.</Typography>}
      {jobs.map((job) => <Box key={job.id} component={motion.div} initial={reducedMotion ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reducedMotion ? 0 : 0.18 }} sx={{ py: 2, borderBottom: '1px solid', borderColor: 'divider', minWidth: 0 }}>
        <Stack direction="row" gap={1.5} alignItems="flex-start">
          {!admin && job.status === 'READY' && <Checkbox inputProps={{ 'aria-label': `Select ${job.title}` }} checked={selected.includes(job.id)}
            onChange={(event) => setSelected((previous) => event.target.checked ? [...previous, job.id] : previous.filter((id) => id !== job.id))} />}
          {job.thumbnail && <Box component="img" src={job.thumbnail} alt="" sx={{ display: { xs: 'none', sm: 'block' }, width: 112, aspectRatio: '16/9', objectFit: 'cover', borderRadius: 1 }} />}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography fontWeight={700} sx={{ overflowWrap: 'anywhere' }}>{job.title || job.fileName || 'Preparing media'}</Typography>
            <Stack direction="row" flexWrap="wrap" gap={1} alignItems="center" mt={0.75}>
              <Chip size="small" icon={job.status === 'READY' ? <CheckCircleOutline /> : job.status === 'FAILED' ? <ErrorOutline /> : job.status === 'QUEUED' ? <Schedule /> : <Downloading />} label={statusLabel(job)} color={job.status === 'FAILED' ? 'error' : job.status === 'READY' ? 'success' : 'default'} />
              <Typography variant="caption" color="text.secondary">{job.preset}{job.preset === 'custom' ? ` / ${job.quality}p` : ''}</Typography>
              {job.source && <Typography variant="caption" color="text.secondary">{job.source}</Typography>}
              {admin && <Typography variant="caption" sx={{ overflowWrap: 'anywhere' }}>{job.owner}</Typography>}
            </Stack>
            {activeStatuses.includes(job.status) && <Box mt={1.5}>
              <LinearProgress variant={job.progress == null || job.status !== 'DOWNLOADING' ? 'indeterminate' : 'determinate'} value={job.progress ?? 0} aria-label={`${job.title} preparation progress`} />
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                {formatBytes(job.bytesDownloaded)} / {formatBytes(job.bytesTotal)}{job.speed > 0 ? ` / ${formatBytes(job.speed)}/s / ETA ${formatEta(job.eta)}` : ''}
              </Typography>
            </Box>}
            {job.error && <Alert severity="error" sx={{ mt: 1 }}>{job.error}</Alert>}
            {job.status === 'READY' && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              {formatBytes(job.bytesTotal)} / Expires {new Date(job.expiresAt).toLocaleString()}
            </Typography>}
          </Box>
        </Stack>
        <Stack direction="row" gap={1} flexWrap="wrap" justifyContent="flex-end" mt={1}>
          {!admin && job.status === 'READY' && <>
            <Button size="small" variant="contained" startIcon={<Download />} disabled={!!busy} onClick={() => save([job])}>Save to Device</Button>
            <Tooltip title="Subtitle and thumbnail files"><span><IconButton aria-label={`Files for ${job.title}`} disabled={!!busy} onClick={() => showFiles(job)}><Subtitles /></IconButton></span></Tooltip>
          </>}
          {activeStatuses.includes(job.status) && <Tooltip title="Cancel preparation"><span><IconButton aria-label={`Cancel ${job.title}`} disabled={!!busy} onClick={() => act(job, 'cancel')}><Cancel /></IconButton></span></Tooltip>}
          {['FAILED', 'CANCELLED', 'EXPIRED', 'DELETED'].includes(job.status) && <Tooltip title="Retry preparation"><span><IconButton aria-label={`Retry ${job.title}`} disabled={!!busy} onClick={() => act(job, 'retry')}><Replay /></IconButton></span></Tooltip>}
          {!['DELETED', 'EXPIRED'].includes(job.status) && <Tooltip title="Delete server files"><span><IconButton aria-label={`Delete ${job.title}`} disabled={!!busy} onClick={() => setConfirm(job)}><DeleteOutline /></IconButton></span></Tooltip>}
        </Stack>
      </Box>)}
      <Dialog open={!!confirm} onClose={() => !busy && setConfirm(null)} fullWidth maxWidth="xs">
        <DialogTitle>Delete server files?</DialogTitle>
        <DialogContent>{confirm?.title}</DialogContent>
        <DialogActions><Button onClick={() => setConfirm(null)} disabled={!!busy}>Keep</Button><Button color="error" startIcon={<DeleteOutline />} disabled={!!busy} onClick={() => act(confirm, 'delete')}>Delete</Button></DialogActions>
      </Dialog>
      <Dialog open={!!sidecars} onClose={() => setSidecars(null)} fullWidth maxWidth="sm">
        <DialogTitle>Prepared files</DialogTitle>
        <DialogContent><Stack gap={1}>{sidecars?.files.map((name) => <Button key={name} startIcon={<Download />} onClick={() => save([sidecars.job], name)} disabled={!!busy} sx={{ justifyContent: 'flex-start', overflowWrap: 'anywhere', textAlign: 'left', textTransform: 'none' }}>{name}</Button>)}</Stack></DialogContent>
        <DialogActions><Button onClick={() => setSidecars(null)}>Close</Button></DialogActions>
      </Dialog>
    </Box>
  );
}