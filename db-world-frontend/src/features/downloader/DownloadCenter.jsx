import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import {
  Alert, Box, Button, Chip, Container, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControlLabel, IconButton, LinearProgress, Stack, Switch, ToggleButton, ToggleButtonGroup,
  Tooltip, Typography,
} from '@mui/material';
import {
  CheckCircleOutline, CloudDownloadOutlined, Download, Downloading, ErrorOutline,
  Pause, PlayArrow, Refresh, Replay, Schedule, Storage, Wifi,
} from '@mui/icons-material';
import { useT } from '@shared/theme';
import Constants from '@shared/constants';
import DbWorldDownload, { openDownloadedFile } from '@platform/android/DbWorldDownload';
import { useDownloads } from '@features/cinema/download-queue/useDownloads';
import { errorMessage, formatBytes, useMediaJobs } from './downloaderApi';
import { countDownloadTabs, filterDownloads, formatAbsoluteTime, formatRelativeTime, summarizeDownloads } from './downloadCenterModel';
import MediaJobList from './MediaJobList';
import DownloadCard from './components/DownloadCard';

const EMPTY_LIST = [];
const DEVICE_ACTIVE = new Set(['running', 'pending', 'paused', 'handed_off']);
const DEVICE_LABELS = {
  pending: 'Queued', running: 'Saving to device', paused: 'Paused', success: 'Saved',
  handed_off: 'Browser download started', acknowledged: 'Browser transfer closed',
  failed: 'Failed', cancelled: 'Cancelled',
};
const DEVICE_STATUS = {
  pending: [Schedule, 'warning', 'warningBg'],
  running: [Downloading, 'teal', 'tealBg'],
  paused: [Pause, 'warning', 'warningBg'],
  success: [CheckCircleOutline, 'success', 'successBg'],
  handed_off: [Download, 'info', 'infoBg'],
  acknowledged: [CheckCircleOutline, 'success', 'successBg'],
  failed: [ErrorOutline, 'error', 'errorBg'],
  cancelled: [ErrorOutline, 'warning', 'warningBg'],
};
const SOURCE_OPTIONS = [
  ['all', 'All sources'], ['cinema', 'Cinema'], ['downloader', 'Media Downloader'],
];
const TAB_OPTIONS = [
  ['all', 'All'], ['active', 'Active'], ['ready', 'Ready / saved'], ['failed', 'Failed / expired'],
];

function SummaryStat({ icon: Icon, label, value, sub, color }) {
  const T = useT();
  return (
    <Box sx={{ minWidth: 0, p: { xs: 1.5, sm: 2 }, borderRadius: 2.5, border: `1px solid ${T.glassBorder}`, bgcolor: T.glass }}>
      <Stack direction="row" alignItems="center" gap={1}>
        <Box sx={{ width: 36, height: 36, borderRadius: 1.5, display: 'grid', placeItems: 'center', bgcolor: `${color}20`, color, flexShrink: 0 }}><Icon fontSize="small" /></Box>
        <Typography sx={{ fontSize: 12, color: T.textMuted, overflowWrap: 'anywhere' }}>{label}</Typography>
      </Stack>
      <Typography sx={{ mt: 1, fontSize: { xs: 20, sm: 23 }, lineHeight: 1.15, fontWeight: 800, color: T.text, fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere' }}>{value}</Typography>
      {sub && <Typography sx={{ mt: 0.3, fontSize: 11, color: T.textFaint }}>{sub}</Typography>}
    </Box>
  );
}

function EmptyPanel({ icon: Icon = CloudDownloadOutlined, title, description, onStart }) {
  const T = useT();
  return (
    <Box sx={{ py: 3.5, px: 2, textAlign: 'center', borderRadius: 2, bgcolor: T.glass, border: `1px dashed ${T.glassBorder}` }}>
      <Icon sx={{ color: T.textFaint, fontSize: 34, mb: 0.5 }} />
      <Typography sx={{ color: T.text, fontWeight: 700 }}>{title}</Typography>
      <Typography sx={{ mt: 0.35, mb: 1.5, color: T.textMuted, fontSize: 13 }}>{description}</Typography>
      {onStart && <Button onClick={onStart} startIcon={<Download />} sx={{ minHeight: 44, color: T.teal, fontWeight: 700 }}>Start a new download</Button>}
    </Box>
  );
}

export default function DownloadCenter() {
  const T = useT();
  const navigate = useNavigate();
  const media = useMediaJobs();
  const device = useDownloads();
  const [source, setSource] = useState('all');
  const [tab, setTab] = useState('all');
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [busyIds, setBusyIds] = useState(() => new Set());
  const nativeClient = Capacitor.isNativePlatform();
  const jobs = media.data || EMPTY_LIST;
  const allDevices = device.downloads || EMPTY_LIST;
  const filtered = useMemo(() => filterDownloads(jobs, allDevices, source, tab), [jobs, allDevices, source, tab]);
  const tabCounts = useMemo(() => countDownloadTabs(jobs, allDevices, source), [jobs, allDevices, source]);
  const summary = useMemo(() => summarizeDownloads(jobs, allDevices), [jobs, allDevices]);
  const startNew = () => navigate(Constants.DB_MEDIA_DOWNLOADER_ROUTE);

  const act = async (item, action) => {
    const id = item.downloadId;
    setBusyIds((previous) => new Set([...previous, id]));
    setError('');
    try {
      if (action === 'finish') await DbWorldDownload.completeBrowserDownload({ downloadId: id });
      else if (action === 'play') await openDownloadedFile(item);
      else if (action === 'remove') await device.actions.remove(id);
      else await device.actions[action](id);
      await device.refresh();
    } catch (failure) { setError(errorMessage(failure)); }
    finally {
      setBusyIds((previous) => new Set([...previous].filter((busyId) => busyId !== id)));
      setConfirm(null);
    }
  };
  const refresh = () => { media.refetch(); device.refresh(); };
  const sectionFilterDescription = (name, allCount) => {
    if (allCount > 0) return `No ${name} match the selected source and status filters.`;
    return `No ${name} yet. Start a new download to prepare media.`;
  };
  const startDate = (value) => formatAbsoluteTime(value) || 'Date unavailable';

  return (
    <Box sx={{
      minHeight: '100vh', bgcolor: T.bg, color: T.textPrimary,
      pt: { xs: '76px', sm: '88px', md: '104px', xl: '120px' }, pb: { xs: 4, md: 6 },
      '@media (prefers-reduced-motion: reduce)': { '& .MuiLinearProgress-bar': { animation: 'none', transition: 'none' } },
    }}>
      <Container maxWidth="lg" sx={{ minWidth: 0 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} gap={1.5} mb={2.25}>
          <Stack direction="row" gap={1.5} alignItems="center" sx={{ minWidth: 0 }}>
            <Box sx={{ width: 48, height: 48, flexShrink: 0, borderRadius: 2, bgcolor: T.tealBg, color: T.teal, display: 'grid', placeItems: 'center' }}><Downloading /></Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography component="h1" sx={{ fontWeight: 850, fontSize: { xs: '1.55rem', sm: '1.9rem' }, lineHeight: 1.15, overflowWrap: 'anywhere' }}>Download Center</Typography>
              <Typography sx={{ mt: 0.35, fontSize: 14, color: T.textMuted }}>Track server preparations and downloads saved to this device.</Typography>
            </Box>
          </Stack>
          <Stack direction="row" gap={1} alignItems="center" sx={{ width: { xs: '100%', sm: 'auto' }, justifyContent: 'flex-end' }}>
            <Tooltip title="Refresh downloads"><span><IconButton aria-label="Refresh downloads" onClick={refresh} sx={{ width: 44, height: 44, color: T.textMuted, border: `1px solid ${T.glassBorder}`, '&:focus-visible': { outline: `3px solid ${T.teal}`, outlineOffset: 2 } }}><Refresh /></IconButton></span></Tooltip>
            <Button variant="contained" startIcon={<Download />} onClick={startNew} sx={{ minHeight: 44, bgcolor: T.teal, '&:hover': { bgcolor: T.tealHover }, flex: { xs: 1, sm: 'initial' } }}>New download</Button>
          </Stack>
        </Stack>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(4, minmax(0, 1fr))' }, gap: { xs: 1, sm: 1.5 }, mb: 2.25 }}>
          <SummaryStat icon={Downloading} label="Active" value={summary.active} sub={summary.liveSpeed > 0 ? `${formatBytes(summary.liveSpeed)}/s combined` : summary.active > 0 ? 'Waiting for data' : null} color={T.teal} />
          <SummaryStat icon={CheckCircleOutline} label="Ready / saved" value={summary.ready} color={T.success} />
          <SummaryStat icon={ErrorOutline} label="Failed" value={summary.failed} color={T.error} />
          <SummaryStat icon={Storage} label="Total ready size" value={summary.readyBytesKnown ? formatBytes(summary.readyBytes) : '—'} sub={summary.readyBytesKnown ? 'Known file sizes' : 'Size not reported'} color={T.info} />
        </Box>

        <Box sx={{ p: { xs: 1.25, sm: 1.75 }, mb: 2.5, borderRadius: 3, border: `1px solid ${T.glassBorder}`, bgcolor: T.glass }}>
          <Stack gap={1.5}>
            <Box>
              <Typography sx={{ mb: 0.75, fontSize: 11, fontWeight: 800, color: T.textFaint, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Source</Typography>
              <ToggleButtonGroup
                exclusive value={source} onChange={(_, value) => value && setSource(value)} aria-label="Filter by download source"
                sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, '& .MuiToggleButtonGroup-grouped': { border: `1px solid ${T.glassBorder} !important`, borderRadius: '12px !important', mx: 0, px: { xs: 1, sm: 1.5 }, minHeight: 44, color: T.textMuted, textTransform: 'none', fontSize: { xs: 12, sm: 13 }, '&.Mui-selected': { color: T.teal, bgcolor: T.tealBg, borderColor: `${T.teal} !important` }, '&:focus-visible': { outline: `3px solid ${T.teal}`, outlineOffset: 2 } }}}
              >
                {SOURCE_OPTIONS.map(([value, label]) => <ToggleButton key={value} value={value}>{label}</ToggleButton>)}
              </ToggleButtonGroup>
            </Box>
            <Box>
              <Typography sx={{ mb: 0.75, fontSize: 11, fontWeight: 800, color: T.textFaint, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Status</Typography>
              <Stack direction="row" flexWrap="wrap" gap={0.75} role="group" aria-label="Filter by download status">
                {TAB_OPTIONS.map(([value, label]) => (
                  <Chip
                    key={value} clickable onClick={() => setTab(value)} aria-pressed={tab === value}
                    label={`${label} · ${tabCounts[value]}`} sx={{ minHeight: 44, px: 0.3, fontWeight: 700, cursor: 'pointer', bgcolor: tab === value ? T.tealBg : 'transparent', color: tab === value ? T.teal : T.textMuted, border: `1px solid ${tab === value ? T.teal : T.glassBorder}`, '&:hover': { bgcolor: T.tealBg }, '&:focus-visible': { outline: `3px solid ${T.teal}`, outlineOffset: 2 } }}
                  />
                ))}
              </Stack>
            </Box>
          </Stack>
        </Box>

        {nativeClient && (
          <Box sx={{ mb: 2.5, p: { xs: 1.25, sm: 1.75 }, borderRadius: 3, border: `1px solid ${T.glassBorder}`, bgcolor: T.glass }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} justifyContent="space-between" gap={1}>
              <Stack direction="row" alignItems="center" gap={0.75} flexWrap="wrap">
                <Typography sx={{ fontSize: 13, fontWeight: 750, color: T.text }}>Device transfer controls</Typography>
                <Button startIcon={<Pause />} disabled={!allDevices.some((item) => item.status === 'running' || item.status === 'pending')} onClick={device.actions.pauseAll} sx={{ minHeight: 44 }}>Pause all</Button>
                <Button startIcon={<PlayArrow />} disabled={!allDevices.some((item) => item.status === 'paused')} onClick={device.actions.resumeAll} sx={{ minHeight: 44 }}>Resume all</Button>
              </Stack>
              <FormControlLabel
                control={<Switch checked={device.wifiOnly} onChange={(event) => device.toggleWifiOnly(event.target.checked)} inputProps={{ 'aria-label': 'Download using Wi-Fi only' }} />}
                label={<Stack direction="row" alignItems="center" gap={0.5}><Wifi fontSize="small" /><Typography sx={{ fontSize: 13 }}>Wi-Fi only</Typography></Stack>}
                sx={{ minHeight: 44, m: 0, color: T.textMuted }}
              />
            </Stack>
          </Box>
        )}

        {(error || media.error) && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error || errorMessage(media.error)}</Alert>}
        {(media.isLoading || device.loading) && <LinearProgress aria-label="Loading downloads" sx={{ mb: 2, '& .MuiLinearProgress-bar': { transitionDuration: '200ms' } }} />}

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'repeat(2, minmax(0, 1fr))' }, alignItems: 'start', gap: { xs: 2, md: 2.5 } }}>
          <Box sx={{ minWidth: 0, p: { xs: 1.25, sm: 1.75 }, border: `1px solid ${T.glassBorder}`, borderRadius: 3, bgcolor: T.glass }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1} mb={1.25}>
              <Typography component="h2" sx={{ fontSize: 16, fontWeight: 800, color: T.text }}>Server preparations</Typography>
              <Chip size="small" label={source === 'cinema' ? '0 · Not included' : filtered.serverJobs.length} sx={{ color: T.teal, bgcolor: T.tealBg, fontWeight: 700 }} />
            </Stack>
            {source === 'cinema' ? (
              <EmptyPanel icon={CloudDownloadOutlined} title="No server preparations in Cinema" description="Server preparations are created by Media Downloader; Cinema downloads appear in the device section." />
            ) : filtered.serverJobs.length > 0 ? (
              <MediaJobList jobs={filtered.serverJobs} selectionJobs={jobs} emptyMessage={sectionFilterDescription('server preparations', jobs.length)} />
            ) : (
              <EmptyPanel
                title={tab === 'all' && jobs.length === 0 ? 'No server preparations yet' : 'No matching server preparations'}
                description={sectionFilterDescription('server preparations', jobs.length)} onStart={startNew}
              />
            )}
          </Box>

          <Box sx={{ minWidth: 0, p: { xs: 1.25, sm: 1.75 }, border: `1px solid ${T.glassBorder}`, borderRadius: 3, bgcolor: T.glass }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1} mb={1.25}>
              <Typography component="h2" sx={{ fontSize: 16, fontWeight: 800, color: T.text }}>Device downloads</Typography>
              <Chip size="small" label={filtered.deviceDownloads.length} sx={{ color: T.teal, bgcolor: T.tealBg, fontWeight: 700 }} />
            </Stack>
            {filtered.deviceDownloads.length === 0 && !device.loading ? (
              <EmptyPanel
                title={tab === 'all' && allDevices.length === 0 ? 'No device downloads yet' : 'No matching device downloads'}
                description={sectionFilterDescription('device downloads', allDevices.filter((item) => source === 'all' || (item.source === 'downloader' ? 'downloader' : 'cinema') === source).length)}
                onStart={startNew}
              />
            ) : (
              <Stack gap={1.25}>
                {filtered.deviceDownloads.map((item) => {
                  const [StatusIcon, tone, toneBg] = DEVICE_STATUS[item.status] || [Downloading, 'textMuted', null];
                  const active = DEVICE_ACTIVE.has(item.status);
                  const busy = busyIds.has(item.downloadId);
                  const progress = nativeClient && ['running', 'pending', 'paused'].includes(item.status) ? {
                    indeterminate: !item.bytesTotal,
                    value: item.progress,
                    percent: item.bytesTotal > 0 ? item.progress : null,
                    bytesDownloaded: item.bytesDownloaded,
                    bytesTotal: item.bytesTotal,
                    speed: item.status === 'paused' ? null : item.speedBytesPerSec,
                    eta: item.status === 'paused' ? null : item.etaSeconds,
                    paused: item.status === 'paused',
                    message: { pending: 'Waiting to start on this device…', paused: 'Paused' }[item.status],
                  } : null;
                  const dateTitle = startDate(item.addedAt);
                  let mainAction = null;
                  if (item.status === 'handed_off') mainAction = <Button startIcon={<CheckCircleOutline />} disabled={busy} onClick={() => act(item, 'finish')} sx={{ minHeight: 44 }}>Close browser transfer</Button>;
                  else if (nativeClient && ['running', 'pending'].includes(item.status)) mainAction = <Button startIcon={<Pause />} disabled={busy} onClick={() => act(item, 'pause')} sx={{ minHeight: 44 }}>Pause</Button>;
                  else if (nativeClient && item.status === 'paused') mainAction = <Button startIcon={<PlayArrow />} disabled={busy} onClick={() => act(item, 'resume')} sx={{ minHeight: 44 }}>Resume</Button>;
                  else if (item.status === 'success' && item.canPlay) mainAction = <Button startIcon={<PlayArrow />} disabled={busy} onClick={() => act(item, 'play')} sx={{ minHeight: 44 }}>Open file</Button>;
                  else if (['failed', 'cancelled'].includes(item.status)) mainAction = <Button startIcon={<Replay />} disabled={busy} onClick={() => act(item, 'retry')} sx={{ minHeight: 44 }}>Retry</Button>;
                  const secondary = (
                    <>
                      {active && item.status !== 'handed_off' && <Button startIcon={<ErrorOutline />} disabled={busy} onClick={() => act(item, 'cancel')} sx={{ minHeight: 44 }}>Cancel</Button>}
                      <Button startIcon={<Download />} disabled={busy} onClick={() => setConfirm(item)} sx={{ minHeight: 44 }}>Remove entry</Button>
                    </>
                  );
                  return (
                    <DownloadCard
                      key={item.downloadId} title={item.title || item.fileName} subtitle={item.fileName !== item.title ? item.fileName : item.source === 'downloader' ? 'Media Downloader' : 'Cinema'}
                      thumbnail={item.thumbnailUrl} statusLabel={DEVICE_LABELS[item.status] || item.status} statusIcon={StatusIcon} tone={tone} toneBg={toneBg}
                      progress={progress}
                      detail={<Stack direction="row" flexWrap="wrap" gap={1} sx={{ mt: 1 }}><Tooltip title={dateTitle}><Typography component="span" sx={{ fontSize: 12, color: T.textMuted, cursor: 'help' }}>{formatRelativeTime(item.addedAt)}</Typography></Tooltip></Stack>}
                      error={item.errorMessage}
                      actions={<>{mainAction}{secondary}</>}
                    >
                      {item.status === 'handed_off' && <Alert severity="info" icon={<Download />} sx={{ mt: 1.25 }}>Your browser is downloading this file. Close this entry when it finishes.</Alert>}
                    </DownloadCard>
                  );
                })}
              </Stack>
            )}
          </Box>
        </Box>

        <Dialog open={!!confirm} onClose={() => !confirm || !busyIds.has(confirm.downloadId) ? setConfirm(null) : null} fullWidth maxWidth="xs">
          <DialogTitle>{nativeClient && confirm?.status === 'success' ? 'Delete device file?' : 'Remove download entry?'}</DialogTitle>
          <DialogContent>{confirm?.title}</DialogContent>
          <DialogActions>
            <Button disabled={!!confirm && busyIds.has(confirm.downloadId)} onClick={() => setConfirm(null)} sx={{ minHeight: 44 }}>Keep</Button>
            <Button disabled={!!confirm && busyIds.has(confirm.downloadId)} onClick={() => confirm && act(confirm, 'remove')} sx={{ minHeight: 44 }}>Remove</Button>
          </DialogActions>
        </Dialog>
      </Container>
    </Box>
  );
}
