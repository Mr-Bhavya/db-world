import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box, Container, Typography, Chip, IconButton, Button, Collapse,
  Divider, CircularProgress, useTheme, useMediaQuery, alpha, Tooltip,
  Stack, Paper,
} from '@mui/material';
import {
  ArrowBack, ExpandMore, ExpandLess, PlayArrow, Download, ContentCopy,
  Check, Subtitles, Audiotrack, FourK, Hd, Tv, Movie,
  VideoSettings, ChevronRight, LiveTv,
} from '@mui/icons-material';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useSnackbar } from 'notistack';
import { Capacitor } from '@capacitor/core';
import { loadStreamFileInfoByRecordId, resolveMediaUrl } from '@shared/services/ApiServices';
import CinemaPlayer from '../../player/CinemaPlayer';
import MediaDetailsDrawer from '../MediaFileInfo/MediaDetailsDrawer';
import CommonServices from '@shared/services/CommonServices';
import Constants from '@shared/constants';
import AndroidPlugins from '@platform/android/AndroidPlugins';
import DbWorldDownload from '@platform/android/DbWorldDownload';

// ─── Constants ────────────────────────────────────────────────────────────────

const QUALITY_ORDER = ['8K', '4K', '2160p', '2K', '1440p', '1080p', '720p', '480p', '360p', 'SD', 'Unknown'];

const QUALITY_META = {
  '8K':    { color: '#ff3d00', label: '8K'    },
  '4K':    { color: '#ff6b35', label: '4K'    },
  '2160p': { color: '#ff6b35', label: '4K'    },
  '2K':    { color: '#f59e0b', label: '2K'    },
  '1440p': { color: '#f59e0b', label: '1440p' },
  '1080p': { color: '#10b981', label: '1080p' },
  '720p':  { color: '#3b82f6', label: '720p'  },
  '480p':  { color: '#8b5cf6', label: '480p'  },
  '360p':  { color: '#6b7280', label: '360p'  },
  'SD':    { color: '#6b7280', label: 'SD'    },
  'Unknown':{ color: '#4b5563', label: '?'   },
};

const HDR_META = {
  'DV':     { color: '#7c3aed', label: 'Dolby Vision' },
  'HDR10+': { color: '#d97706', label: 'HDR10+' },
  'HDR10':  { color: '#b45309', label: 'HDR10' },
  'HDR':    { color: '#92400e', label: 'HDR' },
};

const CODEC_META = {
  'AV1':   { color: '#0891b2' },
  'H.265': { color: '#059669' },
  'H.264': { color: '#2563eb' },
  'VP9':   { color: '#7c3aed' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getQuality(video, fileName) {
  if (video?.resolution) {
    const [w, h] = video.resolution.split('x').map(Number);
    if (h >= 4320 || w >= 7680) return '8K';
    if (h >= 2160 || w >= 3840) return '4K';
    if (h >= 1440 || w >= 2560) return '1440p';
    if (h >= 1080 || w >= 1920) return '1080p';
    if (h >= 720  || w >= 1280) return '720p';
    if (h >= 480  || w >= 854)  return '480p';
    if (h > 0) return 'SD';
  }
  if (fileName) {
    const m = fileName.match(/(\d{3,4}p|4K|8K)/i);
    if (m) return m[1].toLowerCase() === '4k' ? '4K' : m[1].toLowerCase() === '8k' ? '8K' : m[1];
  }
  return 'Unknown';
}

function getCodec(videoFormat) {
  if (!videoFormat) return null;
  const f = videoFormat.toUpperCase();
  if (f.includes('AV1'))  return 'AV1';
  if (f.includes('HEVC') || f.includes('H.265') || f.includes('H265')) return 'H.265';
  if (f.includes('AVC')  || f.includes('H.264') || f.includes('H264')) return 'H.264';
  if (f.includes('VP9'))  return 'VP9';
  return videoFormat.split('(')[0].trim().split(' ')[0];
}

function getHdrTags(hdrDetails, fileName) {
  const src = `${hdrDetails || ''} ${fileName || ''}`.toUpperCase();
  const tags = [];
  if (src.includes('DOLBY VISION') || src.includes(' DV ') || src.includes('.DV.')) tags.push('DV');
  if (src.includes('HDR10+') || src.includes('HDR10 PLUS') || src.includes('HDR10PLUS')) tags.push('HDR10+');
  else if (src.includes('HDR10')) tags.push('HDR10');
  else if (src.includes('HDR')) tags.push('HDR');
  return tags;
}

function getSeason(fileName) {
  if (!fileName) return null;
  const m = fileName.match(/[Ss](\d{1,2})[Ee]\d{1,2}/);
  return m ? String(parseInt(m[1], 10)).padStart(2, '0') : null;
}

function getEpisodeNumber(fileName) {
  if (!fileName) return null;
  const m = fileName.match(/[Ss]\d{1,2}[Ee](\d{1,3})/);
  if (m) return parseInt(m[1], 10);
  // Fallback: standalone Exx at word boundary
  const ep = fileName.match(/(?:^|[\s._-])E(\d{1,3})(?:[\s._-]|$)/i);
  return ep ? parseInt(ep[1], 10) : null;
}

function qualityRank(q) {
  const idx = QUALITY_ORDER.indexOf(q);
  return idx === -1 ? 999 : idx;
}

// ─── Badge components ─────────────────────────────────────────────────────────

const QBadge = ({ quality }) => {
  const meta = QUALITY_META[quality] || QUALITY_META['Unknown'];
  return (
    <Box sx={{
      display: 'inline-flex', alignItems: 'center',
      px: 0.8, py: 0.15, borderRadius: 0.8,
      bgcolor: meta.color, color: '#fff',
      fontSize: '0.66rem', fontWeight: 800, lineHeight: 1.6, letterSpacing: '0.03em',
      flexShrink: 0,
    }}>
      {meta.label}
    </Box>
  );
};

const HdrBadge = ({ tag }) => {
  const meta = HDR_META[tag];
  if (!meta) return null;
  return (
    <Box sx={{
      display: 'inline-flex', alignItems: 'center',
      px: 0.8, py: 0.15, borderRadius: 0.8,
      bgcolor: alpha(meta.color, 0.18), color: meta.color,
      border: `1px solid ${alpha(meta.color, 0.4)}`,
      fontSize: '0.62rem', fontWeight: 700, lineHeight: 1.6, flexShrink: 0,
    }}>
      {meta.label}
    </Box>
  );
};

const CodecBadge = ({ codec }) => {
  const meta = CODEC_META[codec] || { color: '#6b7280' };
  return (
    <Box sx={{
      display: 'inline-flex', alignItems: 'center',
      px: 0.8, py: 0.15, borderRadius: 0.8,
      bgcolor: alpha(meta.color, 0.15), color: meta.color,
      border: `1px solid ${alpha(meta.color, 0.35)}`,
      fontSize: '0.62rem', fontWeight: 700, lineHeight: 1.6, flexShrink: 0,
    }}>
      {codec}
    </Box>
  );
};

// ─── CopyIconButton ───────────────────────────────────────────────────────────

const CopyIconButton = ({ getUrl, label }) => {
  const theme = useTheme();
  const [copied, setCopied] = useState(false);
  const [working, setWorking] = useState(false);
  const handle = async () => {
    setWorking(true);
    try {
      const url = await getUrl();
      if (url) {
        const res = await CommonServices.handleCopy(url);
        if (res.success) { setCopied(true); setTimeout(() => setCopied(false), 2000); }
      }
    } finally { setWorking(false); }
  };
  return (
    <Tooltip title={copied ? 'Copied!' : label}>
      <IconButton size="small" onClick={handle} disabled={working} sx={{
        border: `1px solid ${copied ? theme.palette.success.main : alpha(theme.palette.divider, 0.5)}`,
        borderRadius: 1.5, p: 0.6,
        color: copied ? 'success.main' : 'text.secondary',
      }}>
        {copied ? <Check sx={{ fontSize: 15 }} /> : <ContentCopy sx={{ fontSize: 15 }} />}
      </IconButton>
    </Tooltip>
  );
};

// ─── QualityRow — compact row for one quality variant (used in episodes) ──────

const QualityRow = ({ file, allEpisodeFiles, record }) => {
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [playerOpen, setPlayerOpen] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [enrichedFiles, setEnrichedFiles] = useState(null);

  const { general, video, audio, subtitle } = file;
  const quality  = getQuality(video, general?.fileName);
  const codec    = getCodec(video?.format);
  const hdrTags  = getHdrTags(video?.hdrDetails, general?.fileName);

  const resolveAll = useCallback(async (type) => {
    const targets = allEpisodeFiles?.length > 0 ? allEpisodeFiles : [file];
    return Promise.all(targets.map(async (f) => {
      if (!f?.mediaFileId) return f;
      try {
        const res = await resolveMediaUrl(f.mediaFileId, type);
        const cdnUrl = res?.data?.cdnUrl;
        return cdnUrl ? { ...f, streamUrl: cdnUrl } : f;
      } catch { return f; }
    }));
  }, [file, allEpisodeFiles]);

  const handlePlay = async () => {
    setResolving(true);
    try {
      const enriched = await resolveAll('ONLINE');
      setEnrichedFiles(enriched);
      const current = enriched.find(f => f.mediaFileId === file.mediaFileId) ?? enriched[0];
      if (Capacitor.getPlatform() === 'android') {
        AndroidPlugins.launchNativePlayer({
          url: current?.streamUrl,
          title: general?.fileName || record?.tmdb?.title || '',
          fileName: general?.fileName || '',
          fileId: String(file.id || ''),
          preferredAudio: 'Hindi',
          preferredSub: null,
        });
      } else {
        setPlayerOpen(true);
      }
    } catch {
      enqueueSnackbar('Failed to prepare stream', { variant: 'error' });
    } finally { setResolving(false); }
  };

  const handleDownload = async () => {
    setResolving(true);
    try {
      const res = await resolveMediaUrl(file.mediaFileId, 'DOWNLOAD');
      const cdnUrl = res?.data?.cdnUrl;
      if (!cdnUrl) throw new Error('No CDN URL');
      if (Capacitor.getPlatform() === 'android') {
        await DbWorldDownload.ensurePermissions();
        await DbWorldDownload.startDownload({
          url: cdnUrl,
          fileName: general?.fileName || 'download',
          title: general?.fileName || record?.tmdb?.title || 'Download',
        });
        enqueueSnackbar(`Added: ${general?.fileName || 'file'}`, { variant: 'success', autoHideDuration: 3000 });
      } else {
        CommonServices.handleDownload(cdnUrl, { fileName: general?.fileName, openInNewTab: true });
      }
    } catch {
      enqueueSnackbar('Failed to start download', { variant: 'error' });
    } finally { setResolving(false); }
  };

  return (
    <>
      <Box sx={{
        px: { xs: 1.5, sm: 2 }, py: { xs: 0.9, sm: 1 },
        display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 1.5 },
        flexWrap: { xs: 'wrap', sm: 'nowrap' },
        '&:hover': { bgcolor: alpha(theme.palette.action.hover, 0.35) },
        transition: 'background 0.12s',
      }}>
        {/* Quality badges */}
        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ flexShrink: 0 }}>
          <QBadge quality={quality} />
          {codec && <CodecBadge codec={codec} />}
          {hdrTags.map(t => <HdrBadge key={t} tag={t} />)}
          {video?.bitDepth === 10 && (
            <Box sx={{ px: 0.8, py: 0.15, borderRadius: 0.8, bgcolor: alpha('#6366f1', 0.15), color: '#818cf8', border: `1px solid ${alpha('#6366f1', 0.35)}`, fontSize: '0.6rem', fontWeight: 700, lineHeight: 1.6 }}>
              10-bit
            </Box>
          )}
        </Stack>

        {/* Stats */}
        <Stack direction="row" spacing={1.5} sx={{ flex: 1, overflow: 'hidden', minWidth: 0 }}>
          {general?.fileSize && (
            <Typography sx={{ fontSize: '0.72rem', color: theme.palette.text.secondary, whiteSpace: 'nowrap' }}>
              {general.fileSize}
            </Typography>
          )}
          {general?.duration && (
            <Typography sx={{ fontSize: '0.7rem', color: theme.palette.text.disabled, whiteSpace: 'nowrap' }}>
              {CommonServices.formatDuration(general.duration)}
            </Typography>
          )}
          {audio?.length > 0 && !isMobile && (
            <Typography sx={{ fontSize: '0.68rem', color: theme.palette.text.disabled, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              🔊 {audio.slice(0, 2).map(a => a.language || a.format?.split('(')[0].trim()).filter(Boolean).join(', ')}
            </Typography>
          )}
        </Stack>

        {/* Actions — always on same line */}
        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ flexShrink: 0, ml: 'auto' }}>
          <Button
            size="small" variant="contained"
            startIcon={resolving ? <CircularProgress size={12} color="inherit" /> : <PlayArrow sx={{ fontSize: 16 }} />}
            onClick={handlePlay} disabled={resolving}
            sx={{
              bgcolor: theme.palette.mode === 'dark' ? '#fff' : '#111',
              color: theme.palette.mode === 'dark' ? '#000' : '#fff',
              fontWeight: 700, fontSize: '0.72rem', textTransform: 'none',
              px: { xs: 1.2, sm: 1.5 }, py: 0.5, borderRadius: 1.5, minWidth: 0,
              '&:hover': { bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,.85)' : 'rgba(0,0,0,.85)' },
            }}
          >
            {isMobile ? null : 'Play'}
          </Button>
          <Tooltip title="Download">
            <IconButton size="small" onClick={handleDownload} disabled={resolving}
              sx={{ border: `1px solid ${alpha(theme.palette.divider, 0.5)}`, borderRadius: 1.5, p: 0.6 }}>
              {resolving ? <CircularProgress size={14} /> : <Download sx={{ fontSize: 15 }} />}
            </IconButton>
          </Tooltip>
          <CopyIconButton
            getUrl={() => resolveMediaUrl(file.mediaFileId, 'DOWNLOAD').then(r => r?.data?.cdnUrl)}
            label="Copy download link"
          />
          <Tooltip title="File details">
            <IconButton size="small" onClick={() => setDrawerOpen(true)}
              sx={{ border: `1px solid ${alpha(theme.palette.divider, 0.5)}`, borderRadius: 1.5, p: 0.6 }}>
              <ChevronRight sx={{ fontSize: 15 }} />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>

      <CinemaPlayer
        open={playerOpen}
        onClose={() => { setPlayerOpen(false); setEnrichedFiles(null); }}
        mediaInfo={enrichedFiles ? (enrichedFiles.find(f => f.mediaFileId === file.mediaFileId) ?? file) : file}
        allFiles={enrichedFiles ?? allEpisodeFiles ?? [file]}
        record={record}
      />
      <MediaDetailsDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        mediaInfo={file}
        allFiles={allEpisodeFiles ?? [file]}
        record={record}
      />
    </>
  );
};

// ─── EpisodeCard — collapsible card for one episode's quality variants ─────────

const EpisodeCard = ({ episodeNum, files, allSeasonFiles, record }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Sort files by quality (best first)
  const sortedFiles = useMemo(() =>
    [...files].sort((a, b) =>
      qualityRank(getQuality(a.video, a.general?.fileName)) -
      qualityRank(getQuality(b.video, b.general?.fileName))
    ), [files]);

  const uniqueQualities = useMemo(() =>
    [...new Set(sortedFiles.map(f => getQuality(f.video, f.general?.fileName)))],
    [sortedFiles]);

  // Auto-expand if only one variant; collapse when there are multiple
  const [expanded, setExpanded] = useState(files.length === 1);
  const hasMultiple = files.length > 1;

  const isUnknown = episodeNum === 'Unknown';

  return (
    <Paper variant="outlined" sx={{
      mb: 1, borderRadius: 2, overflow: 'hidden',
      borderColor: alpha(theme.palette.divider, 0.6),
      '&:hover': { borderColor: alpha(theme.palette.primary.main, 0.3) },
      transition: 'border-color 0.18s',
    }}>
      {/* ── Episode header ── */}
      <Box
        onClick={() => hasMultiple && setExpanded(v => !v)}
        sx={{
          display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 1.5 },
          px: { xs: 1.5, sm: 2 }, py: { xs: 1, sm: 1.2 },
          cursor: hasMultiple ? 'pointer' : 'default',
          bgcolor: expanded
            ? alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.08 : 0.04)
            : 'transparent',
          '&:hover': hasMultiple ? { bgcolor: alpha(theme.palette.primary.main, 0.06) } : {},
          transition: 'background 0.15s',
        }}
      >
        {/* Episode number badge */}
        <Box sx={{
          minWidth: isUnknown ? 56 : 44, height: 26, borderRadius: 1.5, flexShrink: 0,
          bgcolor: alpha(theme.palette.primary.main, 0.12),
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Typography sx={{ fontSize: '0.72rem', fontWeight: 800, color: theme.palette.primary.main, letterSpacing: '0.02em' }}>
            {isUnknown ? '?' : `E${String(episodeNum).padStart(2, '0')}`}
          </Typography>
        </Box>

        {/* Quality summary chips */}
        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ flex: 1, overflow: 'hidden', flexWrap: 'nowrap' }}>
          {uniqueQualities.slice(0, isMobile ? 3 : 6).map(q => (
            <QBadge key={q} quality={q} />
          ))}
          {uniqueQualities.length > (isMobile ? 3 : 6) && (
            <Typography sx={{ fontSize: '0.65rem', color: theme.palette.text.disabled, whiteSpace: 'nowrap' }}>
              +{uniqueQualities.length - (isMobile ? 3 : 6)}
            </Typography>
          )}
        </Stack>

        {/* File count or size (compact) */}
        {hasMultiple ? (
          <Typography sx={{ fontSize: '0.68rem', color: theme.palette.text.disabled, flexShrink: 0, whiteSpace: 'nowrap' }}>
            {files.length} files
          </Typography>
        ) : (
          sortedFiles[0]?.general?.fileSize && (
            <Typography sx={{ fontSize: '0.68rem', color: theme.palette.text.disabled, flexShrink: 0, whiteSpace: 'nowrap' }}>
              {sortedFiles[0].general.fileSize}
            </Typography>
          )
        )}

        {/* Expand toggle */}
        {hasMultiple && (
          <IconButton size="small" sx={{ flexShrink: 0, p: 0.3, color: 'text.secondary' }}>
            {expanded ? <ExpandLess sx={{ fontSize: 18 }} /> : <ExpandMore sx={{ fontSize: 18 }} />}
          </IconButton>
        )}
      </Box>

      {/* ── Quality rows ── */}
      <Collapse in={expanded || !hasMultiple} timeout="auto" unmountOnExit>
        <Divider sx={{ opacity: 0.6 }} />
        {sortedFiles.map((file, i) => (
          <React.Fragment key={file.id ?? file.mediaFileId ?? i}>
            <QualityRow file={file} allEpisodeFiles={sortedFiles} record={record} />
            {i < sortedFiles.length - 1 && <Divider sx={{ opacity: 0.3 }} />}
          </React.Fragment>
        ))}
      </Collapse>
    </Paper>
  );
};

// ─── FileCard — full detail card (used for movies) ───────────────────────────

const StatItem = ({ label, value }) => {
  const theme = useTheme();
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.1 }}>
      <Typography sx={{ fontSize: '0.6rem', color: theme.palette.text.disabled, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: '0.75rem', color: theme.palette.text.primary, fontWeight: 500 }}>
        {value}
      </Typography>
    </Box>
  );
};

const FileCard = ({ mediaInfo, allFiles = [], record }) => {
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [playerOpen, setPlayerOpen] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [enrichedFiles, setEnrichedFiles] = useState(null);

  const { general, video, audio, subtitle } = mediaInfo;
  const quality  = getQuality(video, general?.fileName);
  const codec    = getCodec(video?.format);
  const hdrTags  = getHdrTags(video?.hdrDetails, general?.fileName);
  const bitDepth = video?.bitDepth;

  const resolveAll = async (type) => {
    const files = allFiles.length > 0 ? allFiles : [mediaInfo];
    return Promise.all(files.map(async (f) => {
      if (!f?.mediaFileId) return f;
      try {
        const res = await resolveMediaUrl(f.mediaFileId, type);
        const cdnUrl = res?.data?.cdnUrl;
        return cdnUrl ? { ...f, streamUrl: cdnUrl } : f;
      } catch { return f; }
    }));
  };

  const handlePlay = async () => {
    setResolving(true);
    try {
      const enriched = await resolveAll('ONLINE');
      setEnrichedFiles(enriched);
      const current = enriched.find(f => f.mediaFileId === mediaInfo.mediaFileId) ?? enriched[0];
      if (Capacitor.getPlatform() === 'android') {
        AndroidPlugins.launchNativePlayer({
          url: current?.streamUrl,
          title: general?.fileName || record?.tmdb?.title || '',
          fileName: general?.fileName || '',
          fileId: String(mediaInfo.id || ''),
          preferredAudio: 'Hindi',
          preferredSub: null,
        });
      } else {
        setPlayerOpen(true);
      }
    } catch { enqueueSnackbar('Failed to prepare stream', { variant: 'error' }); }
    finally { setResolving(false); }
  };

  const handleDownload = async () => {
    setResolving(true);
    try {
      const res = await resolveMediaUrl(mediaInfo.mediaFileId, 'DOWNLOAD');
      const cdnUrl = res?.data?.cdnUrl;
      if (!cdnUrl) throw new Error('No CDN URL');
      if (Capacitor.getPlatform() === 'android') {
        await DbWorldDownload.ensurePermissions();
        await DbWorldDownload.startDownload({ url: cdnUrl, fileName: general?.fileName || 'download', title: general?.fileName || record?.tmdb?.title || 'Download' });
        enqueueSnackbar(`Added to downloads: ${general?.fileName || 'file'}`, { variant: 'success', autoHideDuration: 3000 });
      } else {
        CommonServices.handleDownload(cdnUrl, { fileName: general?.fileName, openInNewTab: true });
      }
    } catch { enqueueSnackbar('Failed to start download', { variant: 'error' }); }
    finally { setResolving(false); }
  };

  return (
    <>
      <Box sx={{
        bgcolor: alpha(theme.palette.background.paper, 0.6),
        border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
        borderRadius: 2, overflow: 'hidden', transition: 'border-color 0.2s',
        '&:hover': { borderColor: alpha(theme.palette.primary.main, 0.4) },
      }}>
        <Box sx={{ p: { xs: 1.5, sm: 2 } }}>
          <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, wordBreak: 'break-all', lineHeight: 1.4, mb: 1 }}>
            {general?.fileName || 'Unknown file'}
          </Typography>

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.6, mb: 1.5 }}>
            <QBadge quality={quality} />
            {codec && <CodecBadge codec={codec} />}
            {hdrTags.map(t => <HdrBadge key={t} tag={t} />)}
            {bitDepth === 10 && (
              <Box sx={{ px: 0.9, py: 0.2, borderRadius: 1, bgcolor: alpha('#6366f1', 0.15), color: '#818cf8', border: `1px solid ${alpha('#6366f1', 0.35)}`, fontSize: '0.65rem', fontWeight: 700, lineHeight: 1.6 }}>
                10-bit
              </Box>
            )}
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 0.6, mb: 1 }}>
            {video?.resolution  && <StatItem label="Resolution"     value={video.resolution} />}
            {video?.frameRate   && <StatItem label="Frame Rate"     value={`${video.frameRate} fps`} />}
            {video?.bitRate     && <StatItem label="Video Bitrate"  value={`${(video.bitRate / 1e6).toFixed(1)} Mbps`} />}
            {general?.duration  && <StatItem label="Duration"       value={CommonServices.formatDuration(general.duration)} />}
            {general?.fileSize  && <StatItem label="Size"           value={general.fileSize} />}
          </Box>

          {audio?.length > 0 && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.7, mb: 0.5 }}>
              {audio.map((a, i) => (
                <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.3, borderRadius: 1, bgcolor: alpha(theme.palette.info.main, 0.08), border: `1px solid ${alpha(theme.palette.info.main, 0.2)}` }}>
                  <Audiotrack sx={{ fontSize: 11, color: theme.palette.info.main }} />
                  <Typography sx={{ fontSize: '0.7rem', color: theme.palette.info.main, fontWeight: 500 }}>
                    {a.format?.split('(')[0].trim()} {a.channels ? `${a.channels}ch` : ''} {a.language ? `· ${a.language}` : ''}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}

          {subtitle?.length > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
              <Subtitles sx={{ fontSize: 13, color: theme.palette.text.disabled }} />
              <Typography sx={{ fontSize: '0.72rem', color: theme.palette.text.disabled }}>
                {subtitle.length} subtitle{subtitle.length > 1 ? 's' : ''}
                {': '}{subtitle.slice(0, 4).map(s => s.language).filter(Boolean).join(', ')}{subtitle.length > 4 ? '…' : ''}
              </Typography>
            </Box>
          )}

          <Box sx={{ display: 'flex', gap: 1, mt: 1.8, flexWrap: 'wrap', alignItems: 'center' }}>
            <Button size="small" variant="contained"
              startIcon={resolving ? <CircularProgress size={14} color="inherit" /> : <PlayArrow />}
              onClick={handlePlay} disabled={resolving}
              sx={{ bgcolor: theme.palette.mode === 'dark' ? '#fff' : '#111', color: theme.palette.mode === 'dark' ? '#000' : '#fff', fontWeight: 700, fontSize: '0.78rem', textTransform: 'none', px: 1.8, py: 0.7, borderRadius: 1.5, '&:hover': { bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,.85)' : 'rgba(0,0,0,.85)' } }}>
              Play
            </Button>
            <CopyIconButton getUrl={() => resolveMediaUrl(mediaInfo.mediaFileId, 'ONLINE').then(r => r?.data?.cdnUrl)} label="Copy stream URL" />
            <Divider orientation="vertical" flexItem sx={{ mx: 0.25 }} />
            <Button size="small" variant="outlined"
              startIcon={resolving ? <CircularProgress size={14} color="inherit" /> : <Download />}
              onClick={handleDownload} disabled={resolving}
              sx={{ fontSize: '0.78rem', textTransform: 'none', px: 1.8, py: 0.7, borderRadius: 1.5 }}>
              Download
            </Button>
            <CopyIconButton getUrl={() => resolveMediaUrl(mediaInfo.mediaFileId, 'DOWNLOAD').then(r => r?.data?.cdnUrl)} label="Copy download URL" />
            <Box sx={{ flex: 1 }} />
            <Button size="small" variant="text" endIcon={<ChevronRight sx={{ fontSize: 16 }} />}
              onClick={() => setDrawerOpen(true)}
              sx={{ fontSize: '0.72rem', textTransform: 'none', color: theme.palette.text.secondary, px: 1 }}>
              Details
            </Button>
          </Box>
        </Box>
      </Box>

      <CinemaPlayer
        open={playerOpen}
        onClose={() => { setPlayerOpen(false); setEnrichedFiles(null); }}
        mediaInfo={enrichedFiles ? (enrichedFiles.find(f => f.mediaFileId === mediaInfo.mediaFileId) ?? mediaInfo) : mediaInfo}
        allFiles={enrichedFiles ?? allFiles}
        record={record}
      />
      <MediaDetailsDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        mediaInfo={mediaInfo}
        allFiles={allFiles}
        record={record}
      />
    </>
  );
};

// ─── QualitySection ───────────────────────────────────────────────────────────

const QualitySection = ({ quality, files, allFiles, record }) => {
  const theme = useTheme();
  const meta = QUALITY_META[quality] || QUALITY_META['Unknown'];
  const [open, setOpen] = useState(true);

  return (
    <Box sx={{ mb: 1.5 }}>
      <Box onClick={() => setOpen(v => !v)} sx={{
        display: 'flex', alignItems: 'center', gap: 1.5,
        px: 2, py: 1, mb: open ? 1 : 0,
        bgcolor: alpha(meta.color, 0.1),
        border: `1px solid ${alpha(meta.color, 0.25)}`,
        borderLeft: `4px solid ${meta.color}`,
        borderRadius: '0 8px 8px 0',
        cursor: 'pointer', userSelect: 'none', transition: 'background 0.15s',
        '&:hover': { bgcolor: alpha(meta.color, 0.15) },
      }}>
        <Box sx={{ fontWeight: 800, fontSize: '0.95rem', color: meta.color, minWidth: 46 }}>{meta.label}</Box>
        <Box sx={{ height: 14, width: 1, bgcolor: alpha(meta.color, 0.3) }} />
        <Typography sx={{ fontSize: '0.78rem', color: theme.palette.text.secondary, flex: 1 }}>
          {files.length} file{files.length !== 1 ? 's' : ''}
        </Typography>
        <IconButton size="small" sx={{ color: meta.color, p: 0.3 }}>
          {open ? <ExpandLess sx={{ fontSize: 17 }} /> : <ExpandMore sx={{ fontSize: 17 }} />}
        </IconButton>
      </Box>
      <Collapse in={open} timeout="auto" unmountOnExit>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {files.map((f, i) => (
            <motion.div key={f.id ?? i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18, delay: i * 0.04 }}>
              <FileCard mediaInfo={f} allFiles={allFiles} record={record} />
            </motion.div>
          ))}
        </Box>
      </Collapse>
    </Box>
  );
};

// ─── MovieFiles ───────────────────────────────────────────────────────────────

const MovieFiles = ({ files, record }) => {
  const theme = useTheme();
  const [activeQuality, setActiveQuality] = useState('All');

  const grouped = useMemo(() => {
    const map = {};
    files.forEach(f => {
      const q = getQuality(f.video, f.general?.fileName);
      if (!map[q]) map[q] = [];
      map[q].push(f);
    });
    return map;
  }, [files]);

  const qualities = useMemo(() =>
    ['All', ...QUALITY_ORDER.filter(q => grouped[q]?.length > 0)],
    [grouped]);

  const displayed = useMemo(() =>
    activeQuality === 'All' ? grouped : { [activeQuality]: grouped[activeQuality] || [] },
    [activeQuality, grouped]);

  return (
    <Box>
      {qualities.length > 2 && (
        <Box sx={{ display: 'flex', gap: 1, overflowX: 'auto', pb: 1.5, mb: 2, scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } }}>
          {qualities.map(q => {
            const meta = q === 'All' ? null : QUALITY_META[q];
            const count = q === 'All' ? files.length : (grouped[q]?.length ?? 0);
            const active = activeQuality === q;
            return (
              <Chip key={q} label={`${meta?.label ?? q}  ${count}`} size="small" onClick={() => setActiveQuality(q)}
                sx={{ flexShrink: 0, fontWeight: 600, fontSize: '0.75rem',
                  bgcolor: active ? (meta ? meta.color : theme.palette.primary.main) : alpha(theme.palette.divider, 0.3),
                  color: active ? '#fff' : theme.palette.text.secondary,
                  border: 'none', cursor: 'pointer', '&:hover': { bgcolor: active ? undefined : alpha(theme.palette.divider, 0.5) },
                }} />
            );
          })}
        </Box>
      )}
      {QUALITY_ORDER.filter(q => displayed[q]?.length > 0).map(q => (
        <QualitySection key={q} quality={q} files={displayed[q]} allFiles={files} record={record} />
      ))}
    </Box>
  );
};

// ─── SeriesFiles ──────────────────────────────────────────────────────────────

const SeriesFiles = ({ files, record }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Group: season → episodeNum → [files]
  // Prefer stored TMDB numbers over filename parsing
  const groupedBySeasonEpisode = useMemo(() => {
    const map = {};
    files.forEach(f => {
      const season = f.tmdbSeasonNumber != null
        ? String(f.tmdbSeasonNumber).padStart(2, '0')
        : getSeason(f.general?.fileName) ?? 'Unknown';
      const episode = f.tmdbEpisodeNumber != null
        ? f.tmdbEpisodeNumber
        : getEpisodeNumber(f.general?.fileName) ?? 'Unknown';
      if (!map[season]) map[season] = {};
      if (!map[season][episode]) map[season][episode] = [];
      map[season][episode].push(f);
    });
    return map;
  }, [files]);

  const seasons = useMemo(() =>
    Object.keys(groupedBySeasonEpisode).sort((a, b) => {
      if (a === 'Unknown') return 1;
      if (b === 'Unknown') return -1;
      return Number(a) - Number(b);
    }),
    [groupedBySeasonEpisode]);

  const [activeSeason, setActiveSeason] = useState(() => seasons[0] ?? null);

  useEffect(() => {
    if (seasons.length > 0 && !seasons.includes(activeSeason)) {
      setActiveSeason(seasons[0]);
    }
  }, [seasons]); // eslint-disable-line react-hooks/exhaustive-deps

  const episodeMap = groupedBySeasonEpisode[activeSeason] ?? {};

  // Sort episodes numerically; 'Unknown' always last
  const episodes = useMemo(() =>
    Object.keys(episodeMap).sort((a, b) => {
      if (a === 'Unknown') return 1;
      if (b === 'Unknown') return -1;
      return Number(a) - Number(b);
    }),
    [episodeMap]);

  const totalFiles = Object.values(episodeMap).reduce((s, arr) => s + arr.length, 0);

  const seasonLabel = (s) => s === 'Unknown' ? 'Unknown' : `Season ${parseInt(s, 10)}`;

  // Compute quality summary per season tab
  const seasonSummary = useCallback((s) => {
    const sData = groupedBySeasonEpisode[s] ?? {};
    const allFiles = Object.values(sData).flat();
    const quals = [...new Set(
      QUALITY_ORDER.filter(q => allFiles.some(f => getQuality(f.video, f.general?.fileName) === q))
    )];
    const epCount = Object.keys(sData).length;
    return { epCount, quals };
  }, [groupedBySeasonEpisode]);

  return (
    <Box>
      {/* ── Season tabs ── */}
      {seasons.length > 1 && (
        <Box sx={{ display: 'flex', gap: 1, overflowX: 'auto', pb: 1.5, mb: 2.5, scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } }}>
          {seasons.map(s => {
            const active = activeSeason === s;
            const { epCount, quals } = seasonSummary(s);
            return (
              <Box key={s} onClick={() => setActiveSeason(s)} sx={{
                flexShrink: 0, cursor: 'pointer',
                px: { xs: 1.5, sm: 2 }, py: { xs: 0.9, sm: 1 }, borderRadius: 2,
                border: `1px solid ${active ? theme.palette.primary.main : alpha(theme.palette.divider, 0.5)}`,
                bgcolor: active ? alpha(theme.palette.primary.main, 0.12) : alpha(theme.palette.background.paper, 0.4),
                transition: 'all 0.18s',
                '&:hover': { bgcolor: active ? undefined : alpha(theme.palette.primary.main, 0.06) },
              }}>
                <Typography sx={{ fontWeight: 700, fontSize: '0.82rem', color: active ? theme.palette.primary.main : theme.palette.text.primary, lineHeight: 1.3 }}>
                  {seasonLabel(s)}
                </Typography>
                <Stack direction="row" spacing={0.5} mt={0.4} alignItems="center">
                  <Typography sx={{ fontSize: '0.62rem', color: theme.palette.text.disabled, whiteSpace: 'nowrap' }}>
                    {epCount} ep
                  </Typography>
                  {quals.slice(0, isMobile ? 2 : 3).map(q => {
                    const meta = QUALITY_META[q] || QUALITY_META['Unknown'];
                    return (
                      <Box key={q} sx={{ px: 0.5, borderRadius: 0.6, bgcolor: meta.color, color: '#fff', fontSize: '0.55rem', fontWeight: 800, lineHeight: 1.7 }}>
                        {meta.label}
                      </Box>
                    );
                  })}
                  {quals.length > (isMobile ? 2 : 3) && (
                    <Typography sx={{ fontSize: '0.6rem', color: theme.palette.text.disabled }}>
                      +{quals.length - (isMobile ? 2 : 3)}
                    </Typography>
                  )}
                </Stack>
              </Box>
            );
          })}
        </Box>
      )}

      {/* ── Season header ── */}
      {activeSeason && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <LiveTv sx={{ color: theme.palette.primary.main, fontSize: 20 }} />
          <Typography sx={{ fontWeight: 700, fontSize: '1rem' }}>
            {seasonLabel(activeSeason)}
          </Typography>
          <Typography sx={{ fontSize: '0.78rem', color: theme.palette.text.secondary }}>
            · {episodes.length} episode{episodes.length !== 1 ? 's' : ''} · {totalFiles} file{totalFiles !== 1 ? 's' : ''}
          </Typography>
        </Box>
      )}

      {/* ── Episode cards ── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeSeason}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
        >
          {episodes.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 6, color: theme.palette.text.disabled }}>
              <Typography>No files for this season</Typography>
            </Box>
          ) : (
            episodes.map(ep => (
              <EpisodeCard
                key={ep}
                episodeNum={ep}
                files={episodeMap[ep]}
                allSeasonFiles={files.filter(f => {
                  const s = f.tmdbSeasonNumber != null
                    ? String(f.tmdbSeasonNumber).padStart(2, '0')
                    : getSeason(f.general?.fileName);
                  return s === activeSeason;
                })}
                record={record}
              />
            ))
          )}
        </motion.div>
      </AnimatePresence>
    </Box>
  );
};

// ─── Main MediaDownloadViewer ─────────────────────────────────────────────────

const MediaDownloadViewer = (props) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { recordId: urlRecordId } = useParams();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const record = props.record || location.state?.record;
  const resolvedRecordId = urlRecordId ?? record?.id ?? record?.recordId;
  const showBack       = props.showBack ?? true;
  const showHeroSection = props.showHeroSection ?? !!props.record;
  const onBack         = props.onBack;

  const [mediaFileList, setMediaFileList] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!resolvedRecordId) { navigate(Constants.DB_CINEMA_BROWSE_ROUTE); return; }
    setLoading(true);
    loadStreamFileInfoByRecordId(resolvedRecordId)
      .then(res => {
        if (res.httpStatusCode === 200) {
          setMediaFileList(CommonServices.convertMediaInfoToCustomFormat(null, res.data));
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [resolvedRecordId, navigate]);

  const isSeries = record?.type?.toLowerCase() === 'series';
  const posterPath = record?.tmdb?.posterPath || record?.tmdb?.poster_path || record?.tmdb?.backdropPath || record?.tmdb?.backdrop_path;
  const title      = record?.tmdb?.title || record?.tmdb?.name || record?.title || '';
  const overview   = record?.tmdb?.overview || '';
  const releaseYear = record?.tmdb?.releaseDate || record?.tmdb?.release_date;

  return (
    <Box sx={{ bgcolor: theme.palette.background.default, minHeight: '100vh', color: theme.palette.text.primary }}>

      {showBack && (
        <Button startIcon={<ArrowBack />} onClick={() => onBack ? onBack() : navigate(-1)}
          size="small" variant="outlined"
          sx={{ my: 3, mx: 2, textTransform: 'none',
            borderColor: alpha(theme.palette.divider, 0.5),
            color: theme.palette.text.secondary,
            '&:hover': { borderColor: theme.palette.primary.main, color: theme.palette.primary.main } }}>
          Back
        </Button>
      )}

      {/* ── Hero ── */}
      {showHeroSection && (
        <Box sx={{ position: 'relative', overflow: 'hidden',
          background: `linear-gradient(to bottom, ${alpha(theme.palette.background.default, 0)} 0%, ${theme.palette.background.default} 100%)` }}>
          {posterPath && (
            <Box sx={{ position: 'absolute', inset: 0, zIndex: 0,
              backgroundImage: `url(https://image.tmdb.org/t/p/w780${posterPath})`,
              backgroundSize: 'cover', backgroundPosition: 'center top',
              filter: 'blur(28px) brightness(0.18)', transform: 'scale(1.1)' }} />
          )}
          <Container maxWidth="xl" sx={{ position: 'relative', zIndex: 1, pt: { xs: 2, sm: 3 }, pb: 4 }}>
            <Box sx={{ display: 'flex', gap: { xs: 2, sm: 3, md: 4 }, alignItems: 'flex-end' }}>
              {posterPath && (
                <Box component="img" src={`https://image.tmdb.org/t/p/w300${posterPath}`} alt={title}
                  sx={{ width: { xs: 70, sm: 110, md: 150 }, flexShrink: 0, borderRadius: 2, boxShadow: '0 8px 32px rgba(0,0,0,0.5)', aspectRatio: '2/3', objectFit: 'cover' }} />
              )}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                  <Chip icon={isSeries ? <Tv sx={{ fontSize: 14 }} /> : <Movie sx={{ fontSize: 14 }} />}
                    label={isSeries ? 'TV Series' : 'Movie'} size="small"
                    sx={{ bgcolor: alpha(theme.palette.primary.main, 0.2), color: theme.palette.primary.main, fontWeight: 700, fontSize: '0.7rem' }} />
                  {releaseYear && (
                    <Typography sx={{ fontSize: '0.8rem', color: alpha(theme.palette.text.primary, 0.5) }}>
                      {String(releaseYear).slice(0, 4)}
                    </Typography>
                  )}
                </Box>
                <Typography variant={isMobile ? 'h5' : 'h4'} sx={{ fontWeight: 800, lineHeight: 1.15, mb: 1 }}>
                  {title}
                </Typography>
                {overview && !isMobile && (
                  <Typography sx={{ fontSize: '0.85rem', color: alpha(theme.palette.text.primary, 0.6), lineHeight: 1.6,
                    display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', maxWidth: 600 }}>
                    {overview}
                  </Typography>
                )}
              </Box>
            </Box>
          </Container>
        </Box>
      )}

      {/* ── Files ── */}
      <Container maxWidth="xl" sx={{ pb: { xs: 10, sm: 6 }, mt: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
          <VideoSettings color="primary" />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Available Files</Typography>
          {!loading && (
            <Chip label={`${mediaFileList.length} total`} size="small" color="primary" variant="outlined" />
          )}
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 12 }}>
            <CircularProgress />
          </Box>
        ) : mediaFileList.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 12, color: theme.palette.text.disabled }}>
            <VideoSettings sx={{ fontSize: 56, mb: 2, opacity: 0.3 }} />
            <Typography>No media files available</Typography>
          </Box>
        ) : isSeries ? (
          <SeriesFiles files={mediaFileList} record={record} />
        ) : (
          <MovieFiles files={mediaFileList} record={record} />
        )}
      </Container>
    </Box>
  );
};

export default MediaDownloadViewer;
