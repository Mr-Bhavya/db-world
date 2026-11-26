import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Tooltip, Typography } from '@mui/material';
import { Cancel, CheckBox, CheckBoxOutlineBlank, CheckCircleOutline, DeleteOutline, Download, Downloading, ErrorOutline, Replay, Schedule, Subtitles } from '@mui/icons-material';
import { useQueryClient } from '@tanstack/react-query';
import { useT } from '@shared/theme';
import { activeStatuses, DOWNLOADS_KEY, errorMessage, formatBytes, jobAction, mediaFiles, saveMedia, statusLabel } from './downloaderApi';
import { formatAbsoluteTime, formatRelativeTime, pruneReadySelection } from './downloadCenterModel';
import DownloadCard from './components/DownloadCard';

const STATUS_STYLE = {
  READY: [CheckCircleOutline, 'success', 'successBg'],
  FAILED: [ErrorOutline, 'error', 'errorBg'],
  QUEUED: [Schedule, 'warning', 'warningBg'],
  DOWNLOADING: [Downloading, 'teal', 'tealBg'],
  CONVERTING: [Downloading, 'info', 'infoBg'],
  CANCELLED: [Cancel, 'warning', 'warningBg'],
  EXPIRED: [Schedule, 'warning', 'warningBg'],
  DELETED: [DeleteOutline, 'textMuted', null],
};

const STAGE_MESSAGE = {
  QUEUED: (job) => `Waiting for a free download slot${job.queuePosition ? ` · #${job.queuePosition} in line` : ''}`,
  DOWNLOADING: (job) => (job.progress == null ? 'Starting download on the server…' : undefined),
  CONVERTING: () => 'Merging and converting on the server…',
};

export default function MediaJobList({ jobs = [], selectionJobs = jobs, admin = false, emptyMessage = 'No jobs match these filters.' }) {
  const T = useT();
  const client = useQueryClient();
  const [error, setError] = useState('');
  const [busyIds, setBusyIds] = useState(() => new Set());
  const [confirm, setConfirm] = useState(null);
  const [selected, setSelected] = useState([]);
  const [sidecars, setSidecars] = useState(null);
  const [notice, setNotice] = useState('');
  const readyJobs = useMemo(() => selectionJobs.filter((job) => job.status === 'READY'), [selectionJobs]);
  const readySelected = readyJobs.filter((job) => selected.includes(job.id));
  const allSelected = readyJobs.length > 0 && readyJobs.every((job) => selected.includes(job.id));

  useEffect(() => {
    setSelected((previous) => pruneReadySelection(previous, selectionJobs));
  }, [selectionJobs]);

  const runForItems = async (ids, operation) => {
    setBusyIds((previous) => new Set([...previous, ...ids]));
    setError('');
    try { await operation(); }
    catch (failure) { setError(errorMessage(failure)); }
    finally {
      setBusyIds((previous) => new Set([...previous].filter((id) => !ids.includes(id))));
      setConfirm(null);
    }
  };
  const act = (job, action) => runForItems([job.id], async () => {
    await jobAction(job.id, action, admin);
    await client.invalidateQueries({ queryKey: DOWNLOADS_KEY });
  });
  const save = (items, name) => runForItems(items.map((job) => job.id), async () => {
    await saveMedia(items, name);
    setNotice(items.length > 1 ? `Added ${items.length} files as a ZIP to device downloads.` : 'Added to device downloads.');
  });
  const showFiles = (job) => runForItems([job.id], async () => {
    setSidecars({ job, files: await mediaFiles(job.id) });
  });

  const toggleReadySelection = (id, checked) => setSelected((previous) => checked
    ? [...new Set([...previous, id])]
    : previous.filter((selectedId) => selectedId !== id));
  const toggleAllReady = () => setSelected(allSelected ? [] : readyJobs.map((job) => job.id));
  const selectedBusy = readySelected.some((job) => busyIds.has(job.id));

  return (
    <Box sx={{ minWidth: 0, pb: { xs: selected.length && !admin ? 9 : 0, md: 0 } }}>
      {error && <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setError('')}>{error}</Alert>}
      {notice && <Alert severity="success" sx={{ mb: 1.5 }} onClose={() => setNotice('')}>{notice}</Alert>}

      {!admin && readyJobs.length > 0 && (
        <Stack
          direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} gap={1}
          sx={{
            position: { xs: 'fixed', sm: 'sticky' }, bottom: { xs: 'calc(12px + env(safe-area-inset-bottom))', sm: 'auto' }, top: { sm: 8 },
            left: { xs: 12, sm: 'auto' }, right: { xs: 12, sm: 'auto' }, zIndex: 1100,
            width: { xs: 'auto', sm: 'fit-content' }, maxWidth: '100%', mb: 1.25, p: 1,
            bgcolor: T.bg, border: `1px solid ${T.glassBorder}`, borderRadius: 2.5,
            boxShadow: { xs: '0 8px 30px rgba(0,0,0,0.28)', sm: 'none' },
          }}
        >
          <Button
            onClick={toggleAllReady}
            startIcon={allSelected ? <CheckBox /> : <CheckBoxOutlineBlank />}
            aria-label={allSelected ? 'Clear all selected ready jobs' : 'Select all ready jobs'}
            sx={{ minHeight: 44, color: T.text, textTransform: 'none', whiteSpace: 'nowrap' }}
          >{allSelected ? 'Clear selection' : 'Select all ready'}</Button>
          {selected.length > 0 && <Typography sx={{ fontSize: 13, color: T.textMuted, whiteSpace: 'nowrap' }}>{readySelected.length} selected</Typography>}
          {readySelected.length > 0 && (
            <Button
              variant="contained" startIcon={<Download />} onClick={() => save(readySelected)} disabled={selectedBusy}
              sx={{ minHeight: 44, whiteSpace: 'nowrap', bgcolor: T.teal, '&:hover': { bgcolor: T.tealHover } }}
            >{readySelected.length > 1 ? `Save ${readySelected.length} as ZIP` : 'Save to device'}</Button>
          )}
        </Stack>
      )}

      {jobs.length === 0 && <Typography sx={{ py: 3, textAlign: 'center', color: T.textMuted }}>{emptyMessage}</Typography>}
      <Stack gap={1.25}>
        {jobs.map((job) => {
          const [StatusIcon, tone, toneBg] = STATUS_STYLE[job.status] || [Downloading, 'textMuted', null];
          const active = activeStatuses.includes(job.status);
          const busy = busyIds.has(job.id);
          const dateTitle = formatAbsoluteTime(job.createdAt);
          const expiresTitle = formatAbsoluteTime(job.expiresAt);
          const detail = (
            <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mt: 1 }}>
              {job.status === 'READY' && (
                <>
                  <Tooltip title={dateTitle || 'Creation date unavailable'}><Typography component="span" sx={{ fontSize: 12, color: T.textMuted, cursor: 'help' }}>{formatRelativeTime(job.createdAt)}</Typography></Tooltip>
                  <Tooltip title={expiresTitle || 'Expiration date unavailable'}><Typography component="span" sx={{ fontSize: 12, color: T.textMuted, cursor: 'help' }}>{formatRelativeTime(job.expiresAt, Date.now(), 'future')}</Typography></Tooltip>
                  <Typography component="span" sx={{ fontSize: 12, color: T.textMuted }}>{job.bytesTotal > 0 ? formatBytes(job.bytesTotal) : 'Calculating size…'}</Typography>
                </>
              )}
            </Stack>
          );
          const actions = (
            <>
              {!admin && job.status === 'READY' && <>
                <Button variant="contained" startIcon={<Download />} disabled={busy} onClick={() => save([job])} sx={{ minHeight: 44, bgcolor: T.teal, '&:hover': { bgcolor: T.tealHover } }}>Save to device</Button>
                <Tooltip title="View prepared subtitles and thumbnails"><span><Button startIcon={<Subtitles />} disabled={busy} onClick={() => showFiles(job)} sx={{ minHeight: 44 }}>Prepared files</Button></span></Tooltip>
              </>}
              {active && <Button startIcon={<Cancel />} disabled={busy} onClick={() => act(job, 'cancel')} sx={{ minHeight: 44 }}>Cancel</Button>}
              {['FAILED', 'CANCELLED', 'EXPIRED', 'DELETED'].includes(job.status) && <Button startIcon={<Replay />} disabled={busy} onClick={() => act(job, 'retry')} sx={{ minHeight: 44 }}>Retry</Button>}
              {!active && job.status !== 'DELETED' && <Button color="error" startIcon={<DeleteOutline />} disabled={busy} onClick={() => setConfirm(job)} sx={{ minHeight: 44 }}>Delete</Button>}
            </>
          );
          return (
            <DownloadCard
              key={job.id}
              title={job.title || job.fileName || 'Preparing media'}
              subtitle={`${job.preset || 'Standard'}${job.preset === 'custom' && job.quality ? ` · ${job.quality}p` : ''}${job.source ? ` · ${job.source}` : ''}${admin && job.owner ? ` · ${job.owner}` : ''}`}
              thumbnail={job.thumbnail}
              statusLabel={statusLabel(job)} statusIcon={StatusIcon} tone={tone} toneBg={toneBg}
              selection={!admin && job.status === 'READY' ? (
                <Checkbox
                  checked={selected.includes(job.id)}
                  onChange={(event) => toggleReadySelection(job.id, event.target.checked)}
                  inputProps={{ 'aria-label': `Select ${job.title || job.fileName || 'media job'}` }}
                  sx={{ width: 44, height: 44, color: T.teal, '&.Mui-checked': { color: T.teal } }}
                />
              ) : null}
              progress={active ? {
                indeterminate: job.progress == null || job.status !== 'DOWNLOADING',
                value: job.progress ?? 0,
                percent: job.progress,
                bytesDownloaded: job.bytesDownloaded,
                bytesTotal: job.bytesTotal,
                speed: job.speed,
                eta: job.eta,
                message: STAGE_MESSAGE[job.status]?.(job),
              } : null}
              surface={admin ? 'admin' : 'glass'}
              detail={detail}
              error={job.error}
              actions={actions}
            />
          );
        })}
      </Stack>

      <Dialog open={!!confirm} onClose={() => !confirm || !busyIds.has(confirm.id) ? setConfirm(null) : null} fullWidth maxWidth="xs">
        <DialogTitle>Delete server preparation?</DialogTitle>
        <DialogContent>{confirm?.title || confirm?.fileName}</DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm(null)} disabled={!!confirm && busyIds.has(confirm.id)} sx={{ minHeight: 44 }}>Keep</Button>
          <Button color="error" startIcon={<DeleteOutline />} disabled={!!confirm && busyIds.has(confirm.id)} onClick={() => confirm && act(confirm, 'delete')} sx={{ minHeight: 44 }}>Delete</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={!!sidecars} onClose={() => setSidecars(null)} fullWidth maxWidth="sm">
        <DialogTitle>Prepared files</DialogTitle>
        <DialogContent>
          <Stack gap={0.75}>
            {(sidecars?.files || []).map((name) => <Button key={name} startIcon={<Download />} onClick={() => save([sidecars.job], name)} disabled={busyIds.has(sidecars.job.id)} sx={{ minHeight: 44, justifyContent: 'flex-start', overflowWrap: 'anywhere', textAlign: 'left', textTransform: 'none' }}>{name}</Button>)}
            {sidecars?.files?.length === 0 && <Typography sx={{ py: 2, color: T.textMuted }}>No additional files are available.</Typography>}
          </Stack>
        </DialogContent>
        <DialogActions><Button onClick={() => setSidecars(null)} sx={{ minHeight: 44 }}>Close</Button></DialogActions>
      </Dialog>
    </Box>
  );
}
