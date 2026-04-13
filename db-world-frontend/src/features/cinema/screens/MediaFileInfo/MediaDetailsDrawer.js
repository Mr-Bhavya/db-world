/**
 * MediaDetailsDrawer — shared media-file detail sheet.
 *
 * Usage (search — load by fileId):
 *   <MediaDetailsDrawer open={open} onClose={onClose} fileId={file.fileId} />
 *
 * Usage (download page — data already loaded):
 *   <MediaDetailsDrawer open={open} onClose={onClose} mediaInfo={mediaInfo} />
 */
import React, { useState, useEffect } from 'react';
import {
  Box, Typography, IconButton, Button, Drawer, Dialog, DialogContent,
  useTheme, useMediaQuery, alpha, CircularProgress, Divider, Tooltip,
} from '@mui/material';
import {
  Close, PlayArrow, Download, ContentCopy, Check,
  Audiotrack, Subtitles, FourK, Hd,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { useNavigate, useLocation } from 'react-router-dom';
import { loadStreamFileInfoByFiledId } from '@shared/services/ApiServices';
import CommonServices from '@shared/services/CommonServices';
import Constants from '@shared/constants';
import { MediaInfoContent } from './MediaInfoContent';
import CinemaPlayer from '../../player/CinemaPlayer';
import AndroidPlugins from '@platform/android/AndroidPlugins';
import { toast } from '@shared/components/ui/Toast';

const DbWorldDownload = registerPlugin('DbWorldDownload');

// ─── Re-use the same badge helpers from download page ─────────────────────────

const QUALITY_META = {
  '8K': { color: '#ff3d00' }, '4K': { color: '#ff6b35' }, '2160p': { color: '#ff6b35' },
  '2K': { color: '#f59e0b' }, '1440p': { color: '#f59e0b' },
  '1080p': { color: '#10b981' }, '720p': { color: '#3b82f6' },
  '480p': { color: '#8b5cf6' }, 'SD': { color: '#6b7280' }, 'Unknown': { color: '#4b5563' },
};
const HDR_META = {
  'DV': { color: '#7c3aed', label: 'Dolby Vision' }, 'HDR10+': { color: '#d97706', label: 'HDR10+' },
  'HDR10': { color: '#b45309', label: 'HDR10' }, 'HDR': { color: '#92400e', label: 'HDR' },
};
const CODEC_META = { 'AV1': { color: '#0891b2' }, 'H.265': { color: '#059669' }, 'H.264': { color: '#2563eb' }, 'VP9': { color: '#7c3aed' } };

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
  const m = fileName?.match(/(\d{3,4}p|4K|8K)/i);
  if (m) return m[1].toLowerCase() === '4k' ? '4K' : m[1].toLowerCase() === '8k' ? '8K' : m[1];
  return 'Unknown';
}
function getCodec(fmt) {
  if (!fmt) return null;
  const f = fmt.toUpperCase();
  if (f.includes('AV1')) return 'AV1';
  if (f.includes('HEVC') || f.includes('H.265') || f.includes('H265')) return 'H.265';
  if (f.includes('AVC') || f.includes('H.264') || f.includes('H264')) return 'H.264';
  if (f.includes('VP9')) return 'VP9';
  return fmt.split('(')[0].trim().split(' ')[0];
}
function getHdrTags(hdrDetails, fileName) {
  const src = `${hdrDetails || ''} ${fileName || ''}`.toUpperCase();
  const tags = [];
  if (src.includes('DOLBY VISION') || src.includes(' DV ') || src.includes('.DV.')) tags.push('DV');
  if (src.includes('HDR10+') || src.includes('HDR10PLUS')) tags.push('HDR10+');
  else if (src.includes('HDR10')) tags.push('HDR10');
  else if (src.includes('HDR')) tags.push('HDR');
  return tags;
}

const Badge = ({ color, label, border = false }) => (
  <Box sx={{
    display: 'inline-flex', alignItems: 'center',
    px: 0.9, py: 0.15, borderRadius: 0.8,
    bgcolor: border ? alpha(color, 0.16) : color,
    color: border ? color : '#fff',
    border: border ? `1px solid ${alpha(color, 0.4)}` : 'none',
    fontSize: '0.65rem', fontWeight: 700, lineHeight: 1.7, flexShrink: 0,
  }}>
    {label}
  </Box>
);

// ─── CopyButton — shows check on success ─────────────────────────────────────

const CopyButton = ({ url, label, size = 'small' }) => {
  const [done, setDone] = useState(false);
  const handle = async () => {
    const r = await CommonServices.handleCopy(url);
    if (r.success) { setDone(true); setTimeout(() => setDone(false), 2000); }
    else toast.error('Copy failed');
  };
  return (
    <Tooltip title={done ? 'Copied!' : label}>
      <IconButton size={size} onClick={handle} disabled={!url}
        sx={{ border: '1px solid', borderColor: done ? 'success.main' : 'divider', borderRadius: 1.5, p: 0.7, color: done ? 'success.main' : 'text.secondary' }}>
        {done ? <Check sx={{ fontSize: 16 }} /> : <ContentCopy sx={{ fontSize: 16 }} />}
      </IconButton>
    </Tooltip>
  );
};

// ─── Inner content (shared between Drawer and Dialog) ────────────────────────

const DrawerBody = ({ mediaInfo, onClose, allFiles, record }) => {
  const theme = useTheme();
  const [playerOpen, setPlayerOpen] = useState(false);

  const { general, video, audio, subtitle } = mediaInfo;
  const quality  = getQuality(video, general?.fileName);
  const codec    = getCodec(video?.format);
  const hdrTags  = getHdrTags(video?.hdrDetails, general?.fileName);
  const bitDepth = video?.bitDepth;
  const qMeta    = QUALITY_META[quality] || QUALITY_META['Unknown'];

  const handlePlay = () => {
    if (Capacitor.getPlatform() === 'android') {
      AndroidPlugins.launchNativePlayer({
        url:            mediaInfo.streamUrl,
        title:          record?.tmdb?.title || record?.tmdb?.name || record?.name || general?.fileName,
        fileName:       general?.fileName || '',
        fileId:         String(mediaInfo.id || ''),
        preferredAudio: 'Hindi',
        preferredSub:   null,
      });
    } else {
      setPlayerOpen(true);
    }
  };

  const handleDownload = () => {
    if (Capacitor.getPlatform() === 'android') {
      DbWorldDownload.startDownload({ url: mediaInfo.downloadUrl, fileName: general?.fileName || 'download' })
        .catch(e => console.error('Download failed', e));
    } else {
      CommonServices.handleDownload(mediaInfo.downloadUrl, { fileName: general?.fileName, openInNewTab: true });
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: theme.palette.background.default }}>
      {/* ── Header ── */}
      <Box sx={{
        px: { xs: 2, sm: 3 }, pt: { xs: 2, sm: 2.5 }, pb: 1.5,
        borderBottom: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
        flexShrink: 0,
      }}>
        {/* Title row */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 1 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{
              fontWeight: 700, fontSize: { xs: '0.9rem', sm: '1rem' }, lineHeight: 1.4,
              wordBreak: 'break-all', color: theme.palette.text.primary,
            }}>
              {general?.fileName || 'Media File'}
            </Typography>
          </Box>
          <IconButton size="small" onClick={onClose} sx={{ flexShrink: 0, mt: -0.5 }}>
            <Close sx={{ fontSize: 20 }} />
          </IconButton>
        </Box>

        {/* Badges */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.6, mb: 1.5 }}>
          <Badge color={qMeta.color} label={quality === '2160p' ? '4K' : quality} />
          {codec && <Badge color={CODEC_META[codec]?.color || '#6b7280'} label={codec} border />}
          {hdrTags.map(t => <Badge key={t} color={HDR_META[t]?.color || '#6b7280'} label={HDR_META[t]?.label ?? t} border />)}
          {bitDepth === 10 && <Badge color="#6366f1" label="10-bit" border />}
        </Box>

        {/* Quick stats */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 1.5 }}>
          {video?.resolution && <QuickStat label="Resolution" value={video.resolution} />}
          {video?.frameRate && <QuickStat label="FPS" value={video.frameRate} />}
          {video?.bitRate && <QuickStat label="Video" value={`${(video.bitRate / 1e6).toFixed(1)} Mbps`} />}
          {general?.duration && <QuickStat label="Duration" value={CommonServices.formatDuration(general.duration)} />}
          {general?.fileSize && <QuickStat label="Size" value={general.fileSize} />}
        </Box>

        {/* Audio + subtitle summary */}
        {(audio?.length > 0 || subtitle?.length > 0) && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.8 }}>
            {audio?.slice(0, 3).map((a, i) => (
              <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.3, borderRadius: 1, bgcolor: alpha(theme.palette.info.main, 0.08), border: `1px solid ${alpha(theme.palette.info.main, 0.2)}` }}>
                <Audiotrack sx={{ fontSize: 11, color: theme.palette.info.main }} />
                <Typography sx={{ fontSize: '0.68rem', color: theme.palette.info.main, fontWeight: 500 }}>
                  {a.format?.split('(')[0].trim()} {a.channels ? `${a.channels}ch` : ''} {a.language ? `· ${a.language}` : ''}
                </Typography>
              </Box>
            ))}
            {subtitle?.length > 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.3, borderRadius: 1, bgcolor: alpha(theme.palette.warning.main, 0.08), border: `1px solid ${alpha(theme.palette.warning.main, 0.2)}` }}>
                <Subtitles sx={{ fontSize: 11, color: theme.palette.warning.main }} />
                <Typography sx={{ fontSize: '0.68rem', color: theme.palette.warning.main, fontWeight: 500 }}>
                  {subtitle.length} sub{subtitle.length > 1 ? 's' : ''}{subtitle.length <= 4 ? `: ${subtitle.map(s => s.language).filter(Boolean).join(', ')}` : ''}
                </Typography>
              </Box>
            )}
          </Box>
        )}
      </Box>

      {/* ── Scrollable details ── */}
      <Box sx={{ flex: 1, overflowY: 'auto', '&::-webkit-scrollbar': { width: 6 }, '&::-webkit-scrollbar-thumb': { bgcolor: alpha(theme.palette.divider, 0.6), borderRadius: 3 } }}>
        <MediaInfoContent mediaInfo={mediaInfo} />
      </Box>

      {/* ── Actions footer ── */}
      <Box sx={{
        px: { xs: 2, sm: 3 }, py: 1.5,
        borderTop: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
        display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center',
        bgcolor: alpha(theme.palette.background.paper, 0.6),
        flexShrink: 0,
      }}>
        <Button
          size="small" variant="contained" startIcon={<PlayArrow />}
          onClick={handlePlay}
          sx={{ bgcolor: '#fff', color: '#000', fontWeight: 700, fontSize: '0.8rem', textTransform: 'none', px: 2, py: 0.8, borderRadius: 1.5, '&:hover': { bgcolor: 'rgba(255,255,255,.85)' } }}
        >
          Play
        </Button>
        <CopyButton url={mediaInfo.streamUrl} label="Copy stream URL" />

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

        <Button
          size="small" variant="outlined" startIcon={<Download />}
          onClick={handleDownload}
          sx={{ fontSize: '0.8rem', textTransform: 'none', px: 2, py: 0.8, borderRadius: 1.5 }}
        >
          Download
        </Button>
        <CopyButton url={mediaInfo.downloadUrl} label="Copy download URL" />
      </Box>

      <CinemaPlayer open={playerOpen} onClose={() => setPlayerOpen(false)}
        mediaInfo={mediaInfo} allFiles={allFiles ?? [mediaInfo]} record={record} />
    </Box>
  );
};

const QuickStat = ({ label, value }) => {
  const theme = useTheme();
  return (
    <Box>
      <Typography sx={{ fontSize: '0.6rem', color: theme.palette.text.disabled, textTransform: 'uppercase', letterSpacing: '0.06em', lineHeight: 1 }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, color: theme.palette.text.primary, lineHeight: 1.4 }}>
        {value}
      </Typography>
    </Box>
  );
};

// ─── Main exported component ──────────────────────────────────────────────────

const MediaDetailsDrawer = ({ open, onClose, fileId, mediaInfo: propMediaInfo, allFiles: allFilesProp, record: recordProp }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const location = useLocation();

  const [loading, setLoading] = useState(false);
  const [mediaInfo, setMediaInfo] = useState(propMediaInfo ?? null);

  // When propMediaInfo changes, sync it
  useEffect(() => {
    if (propMediaInfo) setMediaInfo(propMediaInfo);
  }, [propMediaInfo]);

  // Fetch if only fileId given
  useEffect(() => {
    if (!open || propMediaInfo) return;
    if (!fileId) return;
    setLoading(true);
    setMediaInfo(null);
    loadStreamFileInfoByFiledId(fileId)
      .then(res => {
        if (res.httpStatusCode === 200) {
          const converted = CommonServices.convertMediaInfoToCustomFormat(fileId, res.data, true);
          setMediaInfo(converted[0] ?? null);
        } else if (res.httpStatusCode === 401 || res.httpStatusCode === 403) {
          toast.error('Authentication required');
          navigate(Constants.LOGIN_ROUTE, { state: { from: location } });
        } else {
          toast.error(res.message || 'Failed to load media info');
        }
      })
      .catch(() => toast.error('Failed to load media information'))
      .finally(() => setLoading(false));
  }, [open, fileId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClose = () => {
    onClose();
    if (!propMediaInfo) setTimeout(() => setMediaInfo(null), 300);
  };

  const inner = loading ? (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, minHeight: 240 }}>
      <CircularProgress />
    </Box>
  ) : !mediaInfo ? (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, flexDirection: 'column', gap: 2, minHeight: 240, color: 'text.secondary' }}>
      <Typography>No media information available</Typography>
      <Button size="small" onClick={handleClose}>Close</Button>
    </Box>
  ) : (
    <DrawerBody mediaInfo={mediaInfo} onClose={handleClose} allFiles={allFilesProp} record={recordProp} />
  );

  // ── Mobile / tablet: bottom drawer ────────────────────────────────────────
  if (isMobile || isTablet) {
    return (
      <Drawer
        anchor="bottom"
        open={open}
        onClose={handleClose}
        PaperProps={{
          sx: {
            height: isMobile ? '93dvh' : '82dvh',
            borderRadius: '16px 16px 0 0',
            overflow: 'hidden',
            bgcolor: theme.palette.background.default,
          },
        }}
        sx={{ zIndex: 1400 }}
      >
        {/* Drag handle */}
        <Box sx={{ display: 'flex', justifyContent: 'center', pt: 1, pb: 0.5, flexShrink: 0 }}>
          <Box sx={{ width: 40, height: 4, borderRadius: 2, bgcolor: alpha(theme.palette.divider, 0.6) }} />
        </Box>
        <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {inner}
        </Box>
      </Drawer>
    );
  }

  // ── Desktop: centered dialog ───────────────────────────────────────────────
  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullWidth
      maxWidth="md"
      PaperProps={{
        component: motion.div,
        initial: { opacity: 0, y: 24 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: 24 },
        transition: { duration: 0.2 },
        sx: {
          height: '88vh',
          borderRadius: 3,
          overflow: 'hidden',
          bgcolor: theme.palette.background.default,
          display: 'flex', flexDirection: 'column',
        },
      }}
      sx={{ zIndex: 1400 }}
    >
      <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        {inner}
      </DialogContent>
    </Dialog>
  );
};

export default MediaDetailsDrawer;
