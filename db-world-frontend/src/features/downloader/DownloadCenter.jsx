import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import {
  Alert, Box, Button, Chip, Container, Dialog, DialogActions, DialogContent,
  DialogTitle, FormControlLabel, IconButton, LinearProgress, ListItemIcon,
  ListItemText, Menu, MenuItem, Stack, Switch, Tab, Tabs, Tooltip, Typography,
} from '@mui/material';
import {
  CancelOutlined, CheckCircleOutline, CloudDownloadOutlined, DeleteOutline,
  Download, Downloading, ErrorOutline, MovieRounded, Pause, PlayArrow,
  Refresh, Replay, MoreVertRounded, Wifi, InfoOutlined,
} from '@mui/icons-material';
import { useT } from '@shared/theme';
import Constants from '@shared/constants';
import DbWorldDownload from '@platform/android/DbWorldDownload';
import { useDownloads } from '@features/cinema/download-queue/useDownloads';
import { errorMessage, formatBytes, useMediaJobs } from './downloaderApi';
import {
  countDownloadTabs, filterDownloads, formatAbsoluteTime, formatRelativeTime,
  summarizeDownloads,
} from './downloadCenterModel';
import MediaJobList from './MediaJobList';
import DownloadCard from './components/DownloadCard';
import SheetDialog from '@shared/components/SheetDialog';

const EMPTY_LIST = [];
const DEVICE_ACTIVE = new Set(['running', 'pending', 'paused', 'handed_off']);
const DEVICE_LABELS = {
  pending: 'Queued',
  running: 'Saving to device',
  paused: 'Paused',
  success: 'Saved',
  handed_off: 'Browser download started',
  acknowledged: 'Browser transfer closed',
  failed: 'Failed',
  cancelled: 'Cancelled',
};
const DEVICE_STATUS = {
  pending: [Downloading, 'warning', 'warningBg'],
  running: [Downloading, 'teal', 'tealBg'],
  paused: [Pause, 'warning', 'warningBg'],
  success: [CheckCircleOutline, 'success', 'successBg'],
  handed_off: [Download, 'info', 'infoBg'],
  acknowledged: [CheckCircleOutline, 'success', 'successBg'],
  failed: [ErrorOutline, 'error', 'errorBg'],
  cancelled: [ErrorOutline, 'warning', 'warningBg'],
};
const SOURCE_OPTIONS = [
  ['cinema', 'Cinema', MovieRounded],
  ['downloader', 'Media Downloader', Downloading],
  ['all', 'All', CloudDownloadOutlined],
];
const STATUS_OPTIONS = [
  ['all', 'All'],
  ['active', 'Active'],
  ['ready', 'Saved'],
  ['failed', 'Attention'],
];

const DEMO_DOWNLOADS = [
  { downloadId: 'demo-running', title: 'The Runner', fileName: 'the-runner-1080p.mkv', source: 'cinema', status: 'running', progress: 64, bytesDownloaded: 2_450_000_000, bytesTotal: 3_820_000_000, speedBytesPerSec: 8_600_000, etaSeconds: 159, canPlay: false, addedAt: new Date().toISOString(), mimeType: 'video/x-matroska', quality: '1080p', videoCodec: 'H.265' },
  { downloadId: 'demo-paused', title: 'Aadithya', episodeName: 'The Offer', seasonNumber: 2, episodeNumber: 3, fileName: 'aadithya-s02e03-the-offer-1080p.mkv', source: 'cinema', status: 'paused', progress: 38, bytesDownloaded: 640_000_000, bytesTotal: 1_680_000_000, speedBytesPerSec: 0, etaSeconds: -1, canPlay: false, addedAt: new Date(Date.now() - 35 * 60_000).toISOString(), mimeType: 'video/x-matroska', quality: '1080p', audio: 'Tamil 5.1' },
  { downloadId: 'demo-saved', title: 'Drishyam 2', fileName: 'drishyam-2-2160p.mkv', source: 'cinema', status: 'success', progress: 100, bytesDownloaded: 5_400_000_000, bytesTotal: 5_400_000_000, canPlay: true, addedAt: new Date(Date.now() - 24 * 60 * 60_000).toISOString(), completedAt: new Date(Date.now() - 23.7 * 60 * 60_000).toISOString(), durationMs: 18 * 60_000, mimeType: 'video/x-matroska', quality: '2160p', hdr: 'HDR10' },
  { downloadId: 'demo-failed', title: 'Archive Interview', fileName: 'archive-interview.mp4', source: 'downloader', status: 'failed', progress: 17, bytesDownloaded: 82_000_000, bytesTotal: 480_000_000, errorMessage: 'Network connection changed. Retry when connected.', addedAt: new Date(Date.now() - 3 * 24 * 60 * 60_000).toISOString() },
];

function displayMediaName(item) {
  const season = item.seasonNumber ?? item.season;
  const episode = item.episodeNumber ?? item.episode;
  if (season != null || episode != null) {
    const code = [
      season != null ? `S${String(season).padStart(2, '0')}` : '',
      episode != null ? `E${String(episode).padStart(2, '0')}` : '',
    ].filter(Boolean).join('');
    return [item.title, code, item.episodeName].filter(Boolean).join(' · ');
  }
  const match = String(item.fileName ?? '').match(/S(\d{1,2})E(\d{1,2})(?:[._ -]*(.*?))?(?:\.(mkv|mp4|webm|mov))?$/i);
  return match
    ? [item.title || 'Series', `S${match[1].padStart(2, '0')}E${match[2].padStart(2, '0')}`].filter(Boolean).join(' · ')
    : item.title || item.fileName || 'Download';
}

function durationLabel(ms) {
  const seconds = Math.max(0, Math.round(Number(ms || 0) / 1000));
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours) return `${hours}h ${minutes % 60}m`;
  if (minutes) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

function InfoRow({ label, value, T }) {
  if (value == null || value === '') return null;
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, py: 0.85, borderBottom: `1px solid ${T.glassBorder}` }}>
      <Typography sx={{ color: T.textMuted, fontSize: 12 }}>{label}</Typography>
      <Typography sx={{ color: T.text, fontSize: 12, fontWeight: 650, textAlign: 'right', overflowWrap: 'anywhere' }}>{String(value)}</Typography>
    </Box>
  );
}

function EmptyPanel({ source, onCinema, onDownloader }) {
  const T = useT();
  const isCinema = source === 'cinema';
  return (
    <Box sx={{
      py: 3, px: 2, textAlign: 'center', borderRadius: 2,
      bgcolor: T.glass, border: `1px dashed ${T.glassBorder}`,
    }}>
      {isCinema ? <MovieRounded sx={{ color: T.textFaint, fontSize: 30 }} /> : <CloudDownloadOutlined sx={{ color: T.textFaint, fontSize: 30 }} />}
      <Typography sx={{ color: T.text, fontWeight: 750, mt: 0.5 }}>
        {isCinema ? 'No cinema downloads yet' : 'No media downloads match this view'}
      </Typography>
      <Typography sx={{ mt: 0.35, mb: 1.25, color: T.textMuted, fontSize: 13 }}>
        {isCinema ? 'Open Cinema, choose a title, then save a file to this device.' : 'Start a URL or file preparation from Media Downloader.'}
      </Typography>
      <Button
        variant="outlined"
        startIcon={isCinema ? <MovieRounded /> : <Download />}
        onClick={isCinema ? onCinema : onDownloader}
        sx={{ minHeight: 44, color: T.teal, borderColor: T.glassBorder }}
      >
        {isCinema ? 'Browse Cinema' : 'Open Media Downloader'}
      </Button>
    </Box>
  );
}

export default function DownloadCenter() {
  const T = useT();
  const navigate = useNavigate();
  const media = useMediaJobs();
  const device = useDownloads();
  const nativeClient = Capacitor.isNativePlatform();

  const [source, setSource] = useState('cinema');
  const [tab, setTab] = useState('all');
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [infoItem, setInfoItem] = useState(null);
  const [deleteDeviceFile, setDeleteDeviceFile] = useState(true);
  const [busyIds, setBusyIds] = useState(() => new Set());
  const demoMode = new URLSearchParams(window.location.search).get('demoDownloads') === '1'
    || localStorage.getItem('dbworld:downloads:demo') === '1';
  const [demoDownloads, setDemoDownloads] = useState(DEMO_DOWNLOADS);

  const jobs = media.data || EMPTY_LIST;
  const allDevices = demoMode ? demoDownloads : (device.downloads || EMPTY_LIST);
  const filtered = useMemo(() => filterDownloads(jobs, allDevices, source, tab), [jobs, allDevices, source, tab]);
  const tabCounts = useMemo(() => countDownloadTabs(jobs, allDevices, source), [jobs, allDevices, source]);
  const summary = useMemo(() => summarizeDownloads(jobs, allDevices), [jobs, allDevices]);
  const deviceCount = filtered.deviceDownloads.length;
  const showServer = source !== 'cinema';
  const hasQueued = allDevices.some((item) => item.status === 'pending');
  const hasRunning = allDevices.some((item) => item.status === 'running');
  const hasPaused = allDevices.some((item) => item.status === 'paused');
  const queuedCount = allDevices.filter((item) => item.status === 'pending').length;
  const showTransferToolbar = nativeClient || demoMode || hasQueued || hasRunning || hasPaused;

  const goCinema = () => navigate(Constants.DB_CINEMA_BROWSE_ROUTE);
  const goDownloader = () => navigate(Constants.DB_MEDIA_DOWNLOADER_ROUTE);
  const refresh = () => { media.refetch(); device.refresh(); };

  const act = async (item, action, options) => {
    const id = item.downloadId;
    setBusyIds((previous) => new Set([...previous, id]));
    setError('');
    try {
      if (demoMode) {
        setDemoDownloads((items) => items.map((entry) => {
          if (entry.downloadId !== id) return entry;
          if (action === 'pause') return { ...entry, status: 'paused', speedBytesPerSec: 0, etaSeconds: -1 };
          if (action === 'resume' || action === 'retry') return { ...entry, status: 'running', speedBytesPerSec: 5_200_000, etaSeconds: 120 };
          if (action === 'cancel') return { ...entry, status: 'cancelled', speedBytesPerSec: 0 };
          if (action === 'remove') return null;
          return entry;
        }).filter(Boolean));
        return;
      }
      if (action === 'finish') await DbWorldDownload.completeBrowserDownload({ downloadId: id });
      else if (action === 'play') {
        const fileStatus = await DbWorldDownload.downloadFileExists({ downloadId: id });
        if (!fileStatus?.exists) {
          await device.refresh();
          throw new Error('This file is no longer on the device. The stale download entry was removed.');
        }
        const uri = item.localUri || item.playableUri;
        if (!uri) throw new Error('The saved file location is unavailable. Download the file again.');
        navigate(Constants.playerPath(item.mediaFileId || item.downloadId), {
          state: {
            media: {
              url: uri,
              fileId: item.downloadId,
              mediaFileId: item.mediaFileId || null,
              title: item.title || item.fileName,
              fileName: item.fileName,
              offline: true,
              episodes: [],
              variants: [],
            },
          },
        });
        return;
      } else if (action === 'remove') {
        await device.actions.remove(id, options);
      } else {
        await device.actions[action](id);
      }
      await device.refresh();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusyIds((previous) => new Set([...previous].filter((busyId) => busyId !== id)));
      setConfirm(null);
    }
  };

  return (
    <Box sx={{
      minHeight: '100vh',
      bgcolor: T.bg,
      color: T.text,
      pt: { xs: '64px', sm: '72px', md: '80px' },
      pb: { xs: 2, md: 3 },
      overflowX: 'hidden',
    }}>
      <Container maxWidth="lg" sx={{ px: { xs: 1, sm: 2 }, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Box sx={{
            width: 38, height: 38, flexShrink: 0, display: 'grid', placeItems: 'center',
            borderRadius: 2, bgcolor: T.tealBg, color: T.teal,
          }}>
            <Downloading sx={{ fontSize: 20 }} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography component="h1" sx={{ fontWeight: 850, fontSize: { xs: '1.2rem', sm: '1.45rem' }, lineHeight: 1.1 }}>
              Downloads
            </Typography>
            <Typography sx={{ fontSize: { xs: 11, sm: 12 }, color: T.textFaint, mt: 0.15 }}>
              {summary.active > 0 ? `${summary.active} active transfer${summary.active === 1 ? '' : 's'}` : `${summary.ready} saved item${summary.ready === 1 ? '' : 's'}`}
            </Typography>
          </Box>
          <Tooltip title="Download options">
            <IconButton aria-label="Download options" onClick={(event) => setMenuAnchor(event.currentTarget)} sx={{ width: 44, height: 44, color: T.text }}>
              <MoreVertRounded />
            </IconButton>
          </Tooltip>
        </Box>
        <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
          <MenuItem onClick={() => { setMenuAnchor(null); goCinema(); }}>
            <ListItemIcon><MovieRounded sx={{ color: T.teal }} /></ListItemIcon>
            <ListItemText primary="Browse Cinema" />
          </MenuItem>
          <MenuItem onClick={() => { setMenuAnchor(null); goDownloader(); }}>
            <ListItemIcon><Downloading sx={{ color: T.info }} /></ListItemIcon>
            <ListItemText primary="Media Downloader" />
          </MenuItem>
          <MenuItem onClick={() => { setMenuAnchor(null); refresh(); }}>
            <ListItemIcon><Refresh sx={{ color: T.textMuted }} /></ListItemIcon>
            <ListItemText primary="Refresh downloads" />
          </MenuItem>
          {showTransferToolbar && (
            <>
              <MenuItem disabled={!hasRunning && !hasQueued} onClick={() => {
                if (demoMode) setDemoDownloads((items) => items.map((item) => ['running', 'pending'].includes(item.status) ? { ...item, status: 'paused', speedBytesPerSec: 0 } : item));
                else device.actions.pauseAll();
                setMenuAnchor(null);
              }}>
                <ListItemIcon><Pause sx={{ color: T.warning }} /></ListItemIcon>
                <ListItemText primary={`Pause all${queuedCount ? ` (${queuedCount} queued)` : ''}`} />
              </MenuItem>
              <MenuItem disabled={!hasPaused} onClick={() => {
                if (demoMode) setDemoDownloads((items) => items.map((item) => item.status === 'paused' ? { ...item, status: 'running', speedBytesPerSec: 5_200_000 } : item));
                else device.actions.resumeAll();
                setMenuAnchor(null);
              }}>
                <ListItemIcon><PlayArrow sx={{ color: T.success }} /></ListItemIcon>
                <ListItemText primary="Resume all" />
              </MenuItem>
              <MenuItem disableRipple onClick={(event) => event.stopPropagation()}>
                <ListItemIcon><Wifi sx={{ color: device.wifiOnly ? T.teal : T.textMuted }} /></ListItemIcon>
                <FormControlLabel
                  control={<Switch checked={device.wifiOnly} onChange={(event) => device.toggleWifiOnly(event.target.checked)} inputProps={{ 'aria-label': 'Download using Wi-Fi only' }} />}
                  label={<ListItemText primary="Wi-Fi only" />}
                  sx={{ m: 0, flex: 1 }}
                />
              </MenuItem>
            </>
          )}
        </Menu>

        <Box sx={{
          display: 'grid',
          gridTemplateColumns: '1fr',
          alignItems: 'center',
          gap: 0.5,
          p: 0.5,
          mb: 1,
          border: `1px solid ${T.glassBorder}`,
          borderRadius: 2,
          bgcolor: T.glass,
        }}>
          <Tabs
            value={source}
            onChange={(_, next) => setSource(next)}
            variant="scrollable"
            scrollButtons={false}
            aria-label="Download source"
            sx={{
              minHeight: 42,
              '& .MuiTabs-indicator': { display: 'none' },
              '& .MuiTab-root': {
                  minHeight: 44, minWidth: 0, flex: 1, px: { xs: 0.5, sm: 1.25 },
                borderRadius: 1.5, color: T.textMuted, fontSize: 12, textTransform: 'none',
                '&.Mui-selected': { color: T.teal, bgcolor: T.tealBg, fontWeight: 800 },
              },
            }}
          >
            {SOURCE_OPTIONS.map(([value, label, Icon]) => (
              <Tab
                key={value}
                value={value}
                icon={<Icon sx={{ fontSize: 16 }} />}
                iconPosition="start"
                label={value === 'downloader'
                  ? <><Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>Downloader</Box><Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Media Downloader</Box></>
                  : label}
              />
            ))}
          </Tabs>

          <Tabs
            value={tab}
            onChange={(_, next) => setTab(next)}
            variant="scrollable"
            scrollButtons={false}
            aria-label="Download status"
            sx={{
              minHeight: 40,
              '& .MuiTabs-indicator': { bgcolor: T.teal },
              '& .MuiTab-root': { minHeight: 44, minWidth: 0, flex: 1, px: 0.5, color: T.textFaint, fontSize: 11, textTransform: 'none' },
              '& .Mui-selected': { color: T.text, fontWeight: 800 },
            }}
          >
            {STATUS_OPTIONS.map(([value, label]) => (
              <Tab key={value} value={value} label={`${label} ${tabCounts[value]}`} />
            ))}
          </Tabs>
        </Box>

        {(error || media.error) && <Alert severity="error" sx={{ mb: 1 }} onClose={() => setError('')}>{error || errorMessage(media.error)}</Alert>}
        {(media.isLoading || device.loading) && <LinearProgress aria-label="Loading downloads" sx={{ mb: 1, height: 2 }} />}

        {showServer && filtered.serverJobs.length > 0 && (
          <Box sx={{ mb: 1.25 }}>
            <Typography component="h2" sx={{ mb: 0.75, fontSize: 13, fontWeight: 800, color: T.textMuted }}>
              Server preparations
            </Typography>
            <MediaJobList jobs={filtered.serverJobs} selectionJobs={jobs} compact />
          </Box>
        )}

        <Box>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.75 }}>
            <Typography component="h2" sx={{ fontSize: 13, fontWeight: 800, color: T.textMuted }}>
              {source === 'cinema' ? 'Cinema downloads' : source === 'downloader' ? 'Saved to this device' : 'Device downloads'}
            </Typography>
            <Chip label={deviceCount} size="small" sx={{ height: 22, bgcolor: T.tealBg, color: T.teal, fontWeight: 800 }} />
          </Stack>

          {filtered.deviceDownloads.length === 0 && !device.loading ? (
            <EmptyPanel source={source} onCinema={goCinema} onDownloader={goDownloader} />
          ) : (
            <Stack gap={0.75}>
              {filtered.deviceDownloads.map((item) => {
                const [StatusIcon, tone, toneBg] = DEVICE_STATUS[item.status] || [Downloading, 'textMuted', null];
                const active = DEVICE_ACTIVE.has(item.status);
                const busy = busyIds.has(item.downloadId);
                const progress = (nativeClient || demoMode) && ['running', 'pending', 'paused'].includes(item.status) ? {
                  indeterminate: !item.bytesTotal,
                  value: item.progress,
                  percent: item.bytesTotal > 0 ? item.progress : null,
                  bytesDownloaded: item.bytesDownloaded,
                  bytesTotal: item.bytesTotal,
                  speed: item.status === 'paused' ? null : item.speedBytesPerSec,
                  eta: item.status === 'paused' ? null : item.etaSeconds,
                  paused: item.status === 'paused',
                  message: { pending: 'Waiting to start', paused: 'Paused' }[item.status],
                } : null;
                let mainAction = null;
                if (item.status === 'handed_off') mainAction = <Tooltip title="Close browser transfer"><IconButton color="success" aria-label="Close browser transfer" disabled={busy} onClick={() => act(item, 'finish')}><CheckCircleOutline /></IconButton></Tooltip>;
                else if ((nativeClient || demoMode) && ['running', 'pending'].includes(item.status)) mainAction = <IconButton color="warning" aria-label="Pause download" disabled={busy} onClick={() => act(item, 'pause')}><Pause /></IconButton>;
                else if ((nativeClient || demoMode) && item.status === 'paused') mainAction = <IconButton color="success" aria-label="Resume download" disabled={busy} onClick={() => act(item, 'resume')}><PlayArrow /></IconButton>;
                else if (item.status === 'success' && item.canPlay) mainAction = <Tooltip title="Play offline"><IconButton aria-label="Play offline" disabled={busy} onClick={() => act(item, 'play')} sx={{ color: T.teal }}><PlayArrow /></IconButton></Tooltip>;
                else if (['failed', 'cancelled'].includes(item.status)) mainAction = <Tooltip title="Retry download"><IconButton color="warning" aria-label="Retry download" disabled={busy} onClick={() => act(item, 'retry')}><Replay /></IconButton></Tooltip>;

                return (
                  <DownloadCard
                    key={item.downloadId}
                    title={displayMediaName(item)}
                    subtitle={item.source === 'downloader' ? 'Media Downloader' : null}
                    thumbnail={item.thumbnailUrl}
                    statusLabel={DEVICE_LABELS[item.status] || item.status}
                    statusIcon={StatusIcon}
                    tone={tone}
                    toneBg={toneBg}
                    progress={progress}
                    error={item.errorMessage}
                    actions={<>
                      <Tooltip title="File details"><IconButton aria-label="File details" onClick={() => setInfoItem(item)} sx={{ color: T.info }}><InfoOutlined /></IconButton></Tooltip>
                      {mainAction}
                      {active && item.status !== 'handed_off' && (
                        <Tooltip title="Cancel"><IconButton aria-label="Cancel download" disabled={busy} onClick={() => act(item, 'cancel')} color="error"><CancelOutlined /></IconButton></Tooltip>
                      )}
                      {!active && (
                        <Tooltip title="Remove"><IconButton aria-label="Remove download" disabled={busy} onClick={() => { setDeleteDeviceFile(item.status === 'success'); setConfirm(item); }} sx={{ color: T.textMuted, '&:hover': { color: T.error } }}><DeleteOutline /></IconButton></Tooltip>
                      )}
                    </>}
                    compact
                  >
                    {item.status === 'handed_off' && <Alert severity="info" icon={<Download />} sx={{ mt: 0.75, py: 0 }}>Close this entry after the browser transfer finishes.</Alert>}
                  </DownloadCard>
                );
              })}
            </Stack>
          )}
        </Box>
      </Container>

      <Dialog open={!!confirm} onClose={() => !confirm || !busyIds.has(confirm.downloadId) ? setConfirm(null) : null} fullWidth maxWidth="xs">
        <DialogTitle>Remove download?</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: 'text.secondary' }}>The download record will be removed from this list.</Typography>
          {confirm?.status === 'success' && (
            <FormControlLabel
              control={<Switch checked={deleteDeviceFile} onChange={(event) => setDeleteDeviceFile(event.target.checked)} inputProps={{ 'aria-label': 'Delete saved file from device' }} />}
              label="Also delete the saved file from this device"
              sx={{ mt: 1.5 }}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm(null)} disabled={!!confirm && busyIds.has(confirm.downloadId)}>Keep</Button>
          <Button color="error" startIcon={<DeleteOutline />} disabled={!!confirm && busyIds.has(confirm.downloadId)}
            onClick={() => confirm && act(confirm, 'remove', { deleteFile: deleteDeviceFile })}>
            Remove
          </Button>
        </DialogActions>
      </Dialog>
      <SheetDialog
        open={Boolean(infoItem)}
        onClose={() => setInfoItem(null)}
        fullWidth
        maxWidth="xs"
        slotProps={{
          backdrop: {
            sx: { bgcolor: T.bg === '#000000' ? 'rgba(0,0,0,0.82)' : 'rgba(15,23,42,0.52)', backdropFilter: 'blur(6px)' },
          },
        }}
        PaperProps={{
          sx: {
            bgcolor: T.bg === '#000000' ? '#17191e' : '#ffffff',
            color: T.text,
            border: `1px solid ${T.glassBorder}`,
            backgroundImage: 'none',
          },
        }}
      >
        <DialogTitle sx={{ color: T.text, fontWeight: 800 }}>Download details</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontWeight: 800, mb: 0.5, color: T.text }}>{displayMediaName(infoItem ?? {})}</Typography>
          <Typography sx={{ color: T.textMuted, fontSize: 12, overflowWrap: 'anywhere' }}>{infoItem?.fileName}</Typography>
          <Box sx={{ mt: 1.5 }}>
            <InfoRow T={T} label="Status" value={infoItem ? (DEVICE_LABELS[infoItem.status] || infoItem.status) : ''} />
            <InfoRow T={T} label="Source" value={infoItem?.source === 'downloader' ? 'Media Downloader' : 'Cinema'} />
            <InfoRow T={T} label="Quality" value={infoItem?.quality || infoItem?.resolution} />
            <InfoRow T={T} label="Video" value={infoItem?.videoCodec || infoItem?.codec} />
            <InfoRow T={T} label="Audio" value={infoItem?.audio} />
            <InfoRow T={T} label="HDR" value={infoItem?.hdr} />
            <InfoRow T={T} label="File type" value={infoItem?.mimeType} />
            <InfoRow T={T} label="Size" value={infoItem?.bytesTotal ? formatBytes(infoItem.bytesTotal) : null} />
            <InfoRow T={T} label="Added" value={formatRelativeTime(infoItem?.addedAt)} />
            <InfoRow T={T} label="Started" value={formatAbsoluteTime(infoItem?.startedAt || infoItem?.addedAt) || null} />
            <InfoRow T={T} label="Completed" value={formatAbsoluteTime(infoItem?.completedAt) || null} />
            <InfoRow T={T} label="Download time" value={infoItem?.durationMs ? durationLabel(infoItem.durationMs) : null} />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}><Button onClick={() => setInfoItem(null)} sx={{ minHeight: 44 }}>Close</Button></DialogActions>
      </SheetDialog>
    </Box>
  );
}
