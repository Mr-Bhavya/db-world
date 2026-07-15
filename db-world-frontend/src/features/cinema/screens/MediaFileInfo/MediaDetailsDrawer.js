/**
 * MediaDetailsDrawer — shared media-file detail sheet.
 *
 * Usage (search — load by fileId):
 *   <MediaDetailsDrawer open={open} onClose={onClose} fileId={file.fileId} filePath={file.filePath} />
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
  Audiotrack, Subtitles,
} from '@mui/icons-material';
import { getQuality, getCodec, getHdrTags } from '../../media/helpers';
import { QBadge, HdrBadge, CodecBadge } from '../../media/Badges';
import { motion } from 'framer-motion';
import { Capacitor } from '@capacitor/core';
import { useNavigate, useLocation } from 'react-router-dom';
import { notify } from '@shared/notify';
import { loadStreamFileInfoByFiledId, loadStreamFileInfoByPath, resolveMediaUrl, resolveMediaUrlByPath } from '@shared/services/ApiServices';
import CommonServices from '@shared/services/CommonServices';
import Constants from '@shared/constants';
import { MediaInfoContent } from './MediaInfoContent';
import DbWorldDownload from '@platform/android/DbWorldDownload';
import { tmdbImg } from '../../api/cinemaApi';
import { resolveAndBuildMedia } from '../../media/playerLaunch';
import { buildStoryboard } from '../../utils/storyboard';


// ─── CopyButton — shows check on success ─────────────────────────────────────

const CopyButton = ({ getUrl, label, size = 'small' }) => {
  const [done, setDone] = useState(false);
  const [working, setWorking] = useState(false);
  const handle = async () => {
    setWorking(true);
    try {
      const url = await getUrl();
      if (url) {
        const r = await CommonServices.handleCopy(url);
        if (r.success) { setDone(true); setTimeout(() => setDone(false), 2000); }
        else notify.error('Copy failed');
      }
    } finally {
      setWorking(false);
    }
  };
  return (
    <Tooltip title={done ? 'Copied!' : label}>
      <IconButton size={size} onClick={handle} disabled={working}
        sx={{ border: '1px solid', borderColor: done ? 'success.main' : 'divider', borderRadius: 1.5, p: 0.7, color: done ? 'success.main' : 'text.secondary' }}>
        {done ? <Check sx={{ fontSize: 16 }} /> : <ContentCopy sx={{ fontSize: 16 }} />}
      </IconButton>
    </Tooltip>
  );
};

// ─── Inner content (shared between Drawer and Dialog) ────────────────────────

const DrawerBody = ({ mediaInfo, onClose, allFiles, record }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [resolving, setResolving] = useState(false);

  const { general, video, audio, subtitle } = mediaInfo;
  const quality  = getQuality(video, general?.fileName);
  const codec    = getCodec(video?.format);
  const hdrTags  = getHdrTags(video?.hdrDetails, general?.fileName);
  const bitDepth = video?.bitDepth;

  const matchesCurrentFile = (item, target) => {
    if (target?.mediaFileId && item?.mediaFileId) {
      return item.mediaFileId === target.mediaFileId;
    }
    return (item?.filePath || item?.general?.filePath) === (target?.filePath || target?.general?.filePath);
  };

  const resolveOne = async (item, type) => {
    if (item?.mediaFileId) {
      return resolveMediaUrl(item.mediaFileId, type);
    }

    const targetPath = item?.filePath || item?.general?.filePath;
    if (targetPath) {
      return resolveMediaUrlByPath(targetPath, type);
    }

    throw new Error('No media identifier or file path available');
  };

  const handlePlay = async () => {
    setResolving(true);
    onClose();
    try {
      const files = allFiles?.length ? allFiles : [mediaInfo];
      const current = files.find(f => matchesCurrentFile(f, mediaInfo)) ?? mediaInfo;
      const title = record?.tmdb?.title || record?.tmdb?.name || record?.name || general?.fileName || '';

      let media;
      if (current?.mediaFileId) {
        // Record-linked file: shared batch resolve + uniform payload (storyboard, requestId, ids).
        media = await resolveAndBuildMedia({
          current,
          variantFiles: files,
          record,
          title,
          fileId: mediaInfo.id || mediaInfo.mediaFileId,
        });
      } else {
        // Unassigned file (path-based, no mediaFileId): single resolve, no batch.
        const res = await resolveOne(current, 'ONLINE');
        const url = res?.data?.cdnUrl;
        if (!url) throw new Error('No stream URL');
        media = {
          url,
          fileId:      String(mediaInfo.id || mediaInfo.mediaFileId || ''),
          mediaFileId: res?.data?.mediaFileId || null,
          title,
          fileName:    general?.fileName || '',
          recordId:    record?.id || record?.recordId || res?.data?.recordId || null,
          audio:       res?.data?.mediaFile?.audio || [],
          variants:    [{ url, label: getQuality(current.video, current.general?.fileName), mediaFileId: current.mediaFileId }],
          episodes:    [],
          storyboard:  buildStoryboard(url, res?.data?.mediaFileId, res?.data?.mediaFile) || null,
          requestId:   res?.data?.requestId || null,
        };
      }
      navigate(Constants.playerPath(media.mediaFileId || media.fileId), { state: { media } });
    } catch (_e) {
      notify.error('Failed to prepare stream');
    } finally {
      setResolving(false);
    }
  };

  const handleDownload = async () => {
    setResolving(true);
    try {
        const res = await resolveOne(mediaInfo, 'DOWNLOAD');
        const cdnUrl = res?.data?.cdnUrl;
        if (!cdnUrl) throw new Error('No CDN URL');
        if (Capacitor.getPlatform() === 'android') {
          await DbWorldDownload.ensurePermissions();
          const dlResult = await DbWorldDownload.startDownload({
            url: cdnUrl,
            fileName: general?.fileName || 'download',
            title: record?.tmdb?.title || general?.fileName || 'Download',
            thumbnailUrl: tmdbImg(record?.tmdb?.posterPath, 'w185') || '',
          });
          if (dlResult?.alreadyDownloaded) {
            notify.info(`Already downloaded: ${general?.fileName || 'file'}`, { duration: 3000 });
          } else {
            notify.success(`Added to downloads: ${general?.fileName || 'file'}`, { duration: 3000 });
          }
        } else {
          CommonServices.handleDownload(cdnUrl, { fileName: general?.fileName, openInNewTab: true });
        }
    } catch (e) {
      const msg = e?.message || e?.code || String(e);
      console.error('Download failed', msg, e);
      notify.error(`Download error: ${msg || 'unknown'}`, { duration: 8000 });
    } finally {
      setResolving(false);
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
          <QBadge quality={quality} />
          {codec && <CodecBadge codec={codec} />}
          {hdrTags.map(t => <HdrBadge key={t} tag={t} />)}
          {bitDepth === 10 && (
            <Box sx={{
              display: 'inline-flex', alignItems: 'center',
              px: 0.9, py: 0.2, borderRadius: 1,
              bgcolor: alpha('#6366f1', 0.16), color: '#818cf8',
              border: `1px solid ${alpha('#6366f1', 0.32)}`,
              fontSize: '0.65rem', fontWeight: 700, lineHeight: 1.6, flexShrink: 0,
            }}>10-bit</Box>
          )}
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
          size="small" variant="contained"
          startIcon={resolving ? <CircularProgress size={14} color="inherit" /> : <PlayArrow />}
          onClick={handlePlay}
          disabled={resolving}
          sx={{ bgcolor: '#fff', color: '#000', fontWeight: 700, fontSize: '0.8rem', textTransform: 'none', px: 2, py: 0.8, borderRadius: 1.5, '&:hover': { bgcolor: 'rgba(255,255,255,.85)' } }}
        >
          Play
        </Button>
        <CopyButton
          getUrl={() => resolveOne(mediaInfo, 'ONLINE').then(r => r?.data?.cdnUrl)}
          label="Copy stream URL"
        />

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

        <Button
          size="small" variant="outlined"
          startIcon={resolving ? <CircularProgress size={14} color="inherit" /> : <Download />}
          onClick={handleDownload}
          disabled={resolving}
          sx={{ fontSize: '0.8rem', textTransform: 'none', px: 2, py: 0.8, borderRadius: 1.5 }}
        >
          Download
        </Button>
        <CopyButton
          getUrl={() => resolveOne(mediaInfo, 'DOWNLOAD').then(r => r?.data?.cdnUrl)}
          label="Copy download URL"
        />
      </Box>
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

const MediaDetailsDrawer = ({ open, onClose, fileId, filePath, mediaInfo: propMediaInfo, allFiles: allFilesProp, record: recordProp }) => {
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
    if (!fileId && !filePath) return;
    setLoading(true);
    setMediaInfo(null);
    const load = async () => {
      const handleResponse = (res, syntheticId) => {
        if (res.httpStatusCode === 200) {
          const converted = CommonServices.convertMediaInfoToCustomFormat(syntheticId, res.data, true);
          setMediaInfo(converted[0] ?? null);
          return true;
        }
        if (res.httpStatusCode === 401 || res.httpStatusCode === 403) {
          notify.error('Authentication required');
          navigate(Constants.LOGIN_ROUTE, { state: { from: location } });
          return true;
        }
        return false;
      };

      try {
        if (fileId) {
          try {
            const res = await loadStreamFileInfoByFiledId(fileId);
            if (handleResponse(res, fileId)) return;
          } catch (error) {
            if (!filePath) throw error;
          }
        }

        if (filePath) {
          const res = await loadStreamFileInfoByPath(filePath);
          if (handleResponse(res, fileId ?? filePath)) return;
        }

        notify.error('Failed to load media info');
      } catch {
        notify.error('Failed to load media information');
      }
    };

    load().finally(() => setLoading(false));
  }, [open, fileId, filePath, propMediaInfo, navigate, location]);

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
