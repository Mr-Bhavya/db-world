import React, { useEffect, useMemo, useState } from 'react';
import {
  Box, Button, CircularProgress, Collapse, IconButton,
  Paper, Skeleton, Tooltip, Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { motion } from 'framer-motion';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import DownloadIcon from '@mui/icons-material/Download';
import FolderIcon from '@mui/icons-material/Folder';
import AudiotrackIcon from '@mui/icons-material/Audiotrack';
import SubtitlesIcon from '@mui/icons-material/Subtitles';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import { useSnackbar } from 'notistack';
import { Capacitor } from '@capacitor/core';
import { useT } from '@shared/theme/ThemeContext';
import { tmdbImg } from '../../../api/cinemaApi';
import { loadStreamFileInfoByRecordId, resolveMediaUrl } from '@shared/services/ApiServices';
import CommonServices from '@shared/services/CommonServices';
import AndroidPlugins from '@platform/android/AndroidPlugins';
import DbWorldDownload from '@platform/android/DbWorldDownload';
import CinemaPlayer from '../../../player/CinemaPlayer';
import { buildAndroidEpisodeList } from '../../../utils/episodeUtils';
import SectionHeading from '../shared/SectionHeading';
import {
  formatBitrate, getCodec, getQuality,
  QUALITY_META, QUALITY_ORDER,
} from '../helpers';

function CopyBtn({ getUrl }) {
  const [copied, setCopied] = useState(false);
  const [working, setWorking] = useState(false);
  const handle = async () => {
    setWorking(true);
    try {
      const url = await getUrl();
      if (url) { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    } catch { /* ignore */ } finally { setWorking(false); }
  };
  return (
    <Tooltip title={copied ? 'Copied!' : 'Copy URL'}>
      <IconButton size="small" onClick={handle} disabled={working}
        sx={{ border: `1px solid ${alpha('#fff', copied ? 0.4 : 0.15)}`, borderRadius: 1.5, p: 0.6, color: copied ? '#4caf50' : 'inherit' }}
      >
        {copied ? <CheckIcon sx={{ fontSize: 15 }} /> : <ContentCopyIcon sx={{ fontSize: 15 }} />}
      </IconButton>
    </Tooltip>
  );
}

function StatItem({ label, value }) {
  const T = useT();
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.1 }}>
      <Typography sx={{ fontSize: '0.62rem', color: T.textFaint, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</Typography>
      <Typography sx={{ fontSize: '0.75rem', color: T.text, fontWeight: 500 }}>{value}</Typography>
    </Box>
  );
}

function FileCard({ mediaInfo, allFiles, record }) {
  const T = useT();
  const { enqueueSnackbar } = useSnackbar();
  const [playerOpen, setPlayerOpen] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [enrichedFiles, setEnrichedFiles] = useState(null);
  const { general, video, audio, subtitle } = mediaInfo;
  const quality = getQuality(video, general?.fileName);
  const codec   = getCodec(video?.format);
  const qMeta   = QUALITY_META[quality] ?? QUALITY_META['Unknown'];

  const resolveAll = async (type) => {
    const files = (allFiles?.length > 0 ? allFiles : [mediaInfo]);
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
        const episodes = buildAndroidEpisodeList(enriched, current);
        AndroidPlugins.launchNativePlayer({
          url: current?.streamUrl,
          title: record?.tmdb?.title || record?.title || general?.fileName || '',
          fileName: general?.fileName || '',
          fileId: String(mediaInfo.id || ''),
          preferredAudio: 'Hindi',
          preferredSub: null,
          episodes,
        });
      } else {
        setPlayerOpen(true);
      }
    } catch {
      enqueueSnackbar('Failed to prepare stream', { variant: 'error' });
    } finally {
      setResolving(false);
    }
  };

  const handleDownload = async () => {
    setResolving(true);
    try {
      const res = await resolveMediaUrl(mediaInfo.mediaFileId, 'DOWNLOAD');
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
          enqueueSnackbar(`Already downloaded: ${general?.fileName || 'file'}`, { variant: 'info', autoHideDuration: 3000 });
        } else {
          enqueueSnackbar(`Added to downloads: ${general?.fileName || 'file'}`, { variant: 'success', autoHideDuration: 3000 });
        }
      } else {
        CommonServices.handleDownload(cdnUrl, { fileName: general?.fileName, openInNewTab: true });
      }
    } catch (e) {
      const msg = e?.message || e?.code || String(e);
      enqueueSnackbar(`Download error: ${msg || 'unknown'}`, { variant: 'error', autoHideDuration: 8000 });
    } finally {
      setResolving(false);
    }
  };

  return (
    <>
      <Paper
        elevation={0}
        sx={{
          border: `1px solid ${T.glassBorder}`,
          borderRadius: 2,
          bgcolor: T.glass,
          overflow: 'hidden',
          transition: 'border-color 0.2s, transform .2s, box-shadow .2s',
          '&:hover': {
            borderColor: alpha(T.teal, 0.45),
            transform: 'translateY(-2px)',
            boxShadow: `0 12px 32px ${alpha('#000', 0.3)}`,
          },
        }}
      >
        <Box sx={{ p: { xs: 1.5, sm: 2 } }}>
          <Typography variant="body2" sx={{ color: T.text, fontWeight: 600, wordBreak: 'break-all', lineHeight: 1.4, mb: 1, fontSize: '0.85rem' }}>
            {general?.fileName ?? 'Unknown file'}
          </Typography>

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.6, mb: 1.5 }}>
            <Box sx={{ display: 'inline-flex', alignItems: 'center', px: 1, py: 0.25, borderRadius: 1, bgcolor: qMeta.color, color: '#fff', fontSize: '0.7rem', fontWeight: 800 }}>
              {qMeta.label}
            </Box>
            {codec && (
              <Box sx={{ display: 'inline-flex', px: 0.8, py: 0.25, borderRadius: 1, bgcolor: alpha(T.text, 0.08), color: T.textMuted, border: `1px solid ${alpha(T.text, 0.12)}`, fontSize: '0.65rem', fontWeight: 700 }}>
                {codec}
              </Box>
            )}
            {video?.hdrDetails && (
              <Box sx={{ display: 'inline-flex', px: 0.8, py: 0.25, borderRadius: 1, bgcolor: alpha('#d97706', 0.15), color: '#d97706', border: `1px solid ${alpha('#d97706', 0.35)}`, fontSize: '0.65rem', fontWeight: 700 }}>
                HDR
              </Box>
            )}
            {video?.bitDepth === 10 && (
              <Box sx={{ px: 0.8, py: 0.25, borderRadius: 1, bgcolor: alpha('#818cf8', 0.15), color: '#818cf8', border: `1px solid ${alpha('#818cf8', 0.35)}`, fontSize: '0.65rem', fontWeight: 700 }}>
                10-bit
              </Box>
            )}
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 0.75, mb: 1.5 }}>
            {video?.resolution  && <StatItem label="Resolution" value={video.resolution} />}
            {video?.frameRate   && <StatItem label="Frame Rate" value={`${video.frameRate} fps`} />}
            {video?.bitRate     && <StatItem label="Video Bitrate" value={formatBitrate(video.bitRate)} />}
            {general?.duration  && <StatItem label="Duration" value={CommonServices.formatDuration(general.duration)} />}
            {general?.fileSize  && <StatItem label="File Size" value={general.fileSize} />}
          </Box>

          {audio?.length > 0 && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.6, mb: 1 }}>
              {audio.map((a, i) => (
                <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.3, borderRadius: 1, bgcolor: alpha('#2196f3', 0.08), border: `1px solid ${alpha('#2196f3', 0.2)}` }}>
                  <AudiotrackIcon sx={{ fontSize: 12, color: '#64b5f6' }} />
                  <Typography sx={{ fontSize: '0.7rem', color: '#64b5f6', fontWeight: 500 }}>
                    {[a.format?.split('(')[0].trim(), a.channels ? `${a.channels}ch` : null, a.language].filter(Boolean).join(' · ')}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}

          {subtitle?.length > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
              <SubtitlesIcon sx={{ fontSize: 13, color: T.textFaint }} />
              <Typography sx={{ fontSize: '0.72rem', color: T.textFaint }}>
                {subtitle.length} subtitle{subtitle.length > 1 ? 's' : ''}
                {': '}{subtitle.slice(0, 4).map(s => s.language).filter(Boolean).join(', ')}{subtitle.length > 4 ? '…' : ''}
              </Typography>
            </Box>
          )}

          <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <Button
              size="small" variant="contained"
              startIcon={resolving ? <CircularProgress size={14} color="inherit" /> : <PlayArrowIcon />}
              onClick={handlePlay}
              disabled={resolving}
              sx={{ bgcolor: '#fff', color: '#000', fontWeight: 700, fontSize: '0.78rem', textTransform: 'none', px: 1.8, py: 0.7, borderRadius: 1.5, '&:hover': { bgcolor: '#e0e0e0' } }}
            >
              Play
            </Button>
            <CopyBtn getUrl={() => resolveMediaUrl(mediaInfo.mediaFileId, 'ONLINE').then(r => r?.data?.cdnUrl)} />

            <Box sx={{ width: 1, height: 20, bgcolor: alpha(T.text, 0.15), mx: 0.25 }} />

            <Button
              size="small" variant="outlined"
              startIcon={resolving ? <CircularProgress size={14} color="inherit" /> : <DownloadIcon />}
              onClick={handleDownload}
              disabled={resolving}
              sx={{ fontSize: '0.78rem', textTransform: 'none', px: 1.8, py: 0.7, borderRadius: 1.5 }}
            >
              Download
            </Button>
            <CopyBtn getUrl={() => resolveMediaUrl(mediaInfo.mediaFileId, 'DOWNLOAD').then(r => r?.data?.cdnUrl)} />
          </Box>
        </Box>
      </Paper>

      <CinemaPlayer
        open={playerOpen}
        onClose={() => { setPlayerOpen(false); setEnrichedFiles(null); }}
        mediaInfo={enrichedFiles ? (enrichedFiles.find(f => f.mediaFileId === mediaInfo.mediaFileId) ?? mediaInfo) : mediaInfo}
        allFiles={enrichedFiles ?? (allFiles ?? [])}
        record={record}
      />
    </>
  );
}

function QualityGroup({ quality, files, allFiles, record }) {
  const T = useT();
  const [open, setOpen] = useState(true);
  const meta = QUALITY_META[quality] ?? QUALITY_META['Unknown'];

  return (
    <Box sx={{ mb: 2.5 }}>
      <Box
        onClick={() => setOpen(v => !v)}
        sx={{
          display: 'flex', alignItems: 'center', gap: 1.5,
          px: 2, py: 1.2, mb: open ? 1.5 : 0,
          bgcolor: alpha(meta.color, 0.08),
          border: `1px solid ${alpha(meta.color, 0.2)}`,
          borderLeft: `4px solid ${meta.color}`,
          borderRadius: '0 8px 8px 0',
          cursor: 'pointer', userSelect: 'none',
          '&:hover': { bgcolor: alpha(meta.color, 0.14) },
        }}
      >
        <Typography sx={{ fontWeight: 800, fontSize: '1rem', color: meta.color, minWidth: 52 }}>{meta.label}</Typography>
        <Box sx={{ height: 16, width: 1, bgcolor: alpha(meta.color, 0.3) }} />
        <Typography sx={{ fontSize: '0.8rem', color: T.textMuted, flex: 1 }}>
          {files.length} file{files.length !== 1 ? 's' : ''}
        </Typography>
        <IconButton size="small" sx={{ color: meta.color, p: 0.3 }}>
          {open ? <ExpandLessIcon sx={{ fontSize: 18 }} /> : <ExpandMoreIcon sx={{ fontSize: 18 }} />}
        </IconButton>
      </Box>

      <Collapse in={open} timeout="auto" unmountOnExit>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {files.map((f, i) => (
            <FileCard key={f.id ?? i} mediaInfo={f} allFiles={allFiles} record={record} />
          ))}
        </Box>
      </Collapse>
    </Box>
  );
}

export default function WatchSection({ recordId, record }) {
  const T = useT();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!recordId) return;
    setLoading(true);
    loadStreamFileInfoByRecordId(recordId)
      .then(res => {
        if (res?.httpStatusCode === 200 || res?.data) {
          setFiles(res.data ?? res);
        }
      })
      .catch(() => setHasError(true))
      .finally(() => setLoading(false));
  }, [recordId]);

  const grouped = useMemo(() => {
    const map = {};
    files.forEach(f => {
      const q = getQuality(f.video, f.general?.fileName);
      if (!map[q]) map[q] = [];
      map[q].push(f);
    });
    return map;
  }, [files]);

  const sortedQualities = QUALITY_ORDER.filter(q => grouped[q]);

  if (loading) {
    return (
      <Box sx={{ py: 3 }}>
        {[1, 2].map(i => (
          <Skeleton key={i} variant="rectangular" width="100%" height={120}
            sx={{ bgcolor: alpha(T.text, 0.07), mb: 1.5, borderRadius: 2 }}
          />
        ))}
      </Box>
    );
  }

  if (hasError || files.length === 0) {
    return (
      <Box sx={{ py: 6, textAlign: 'center' }}>
        <FolderIcon sx={{ fontSize: 52, color: T.textFaint, mb: 1.5 }} />
        <Typography variant="body1" sx={{ color: T.textMuted, fontWeight: 600, mb: 0.5 }}>No Media Files</Typography>
        <Typography variant="body2" sx={{ color: T.textFaint }}>No media files are available for this title yet.</Typography>
      </Box>
    );
  }

  return (
    <Box
      component={motion.div}
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.05 }}
      transition={{ duration: 0.4 }}
      sx={{ py: 3 }}
    >
      <SectionHeading sx={{ mb: 2.5 }}>
        {files.length} File{files.length !== 1 ? 's' : ''} Available
      </SectionHeading>
      {sortedQualities.map(q => (
        <QualityGroup key={q} quality={q} files={grouped[q]} allFiles={files} record={record} />
      ))}
    </Box>
  );
}
