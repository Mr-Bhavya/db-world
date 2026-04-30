import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box, Typography, Chip, IconButton, Button, Collapse,
  CircularProgress, useTheme, useMediaQuery, alpha, Tooltip, Stack,
} from '@mui/material';
import {
  PlayArrow, Download, ContentCopy, Check, Audiotrack,
  ExpandMore, ExpandLess, VideoSettings, LiveTv, Movie, Tv,
  InfoOutlined, SubtitlesOutlined,
} from '@mui/icons-material';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
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
import { QUALITY_ORDER, QUALITY_META } from '../../media/constants';
import { QBadge, HdrBadge, CodecBadge } from '../../media/Badges';
import { getQuality, getCodec, getHdrTags, getSeason, getEpisodeNumber, qualityRank } from '../../media/helpers';

// ─── Shared hook: play + download for one file ────────────────────────────────

function useFileActions(file, allFiles, record) {
  const { enqueueSnackbar } = useSnackbar();
  const [resolving, setResolving] = useState(false);
  const [playerOpen, setPlayerOpen] = useState(false);
  const [enrichedFiles, setEnrichedFiles] = useState(null);

  const resolveAll = useCallback(async (type) => {
    const targets = allFiles?.length ? allFiles : [file];
    return Promise.all(targets.map(async (f) => {
      if (!f?.mediaFileId) return f;
      try {
        const res = await resolveMediaUrl(f.mediaFileId, type);
        return res?.data?.cdnUrl ? { ...f, streamUrl: res.data.cdnUrl } : f;
      } catch { return f; }
    }));
  }, [file, allFiles]);

  const handlePlay = useCallback(async () => {
    setResolving(true);
    try {
      const enriched = await resolveAll('ONLINE');
      setEnrichedFiles(enriched);
      const current = enriched.find(f => f.mediaFileId === file.mediaFileId) ?? enriched[0];
      if (Capacitor.getPlatform() === 'android') {
        AndroidPlugins.launchNativePlayer({
          url: current?.streamUrl,
          title: file.general?.fileName || record?.tmdb?.title || '',
          fileName: file.general?.fileName || '',
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
  }, [file, allFiles, record, resolveAll, enqueueSnackbar]);

  const handleDownload = useCallback(async () => {
    setResolving(true);
    try {
      const res = await resolveMediaUrl(file.mediaFileId, 'DOWNLOAD');
      const cdnUrl = res?.data?.cdnUrl;
      console.log('[Download] resolve res:', JSON.stringify(res));
      console.log('[Download] cdnUrl:', cdnUrl);
      if (!cdnUrl) throw new Error('resolve returned no cdnUrl');
      if (Capacitor.getPlatform() === 'android') {
        console.log('[Download] calling ensurePermissions...');
        await DbWorldDownload.ensurePermissions();
        console.log('[Download] ensurePermissions ok — calling startDownload');
        const dlResult = await DbWorldDownload.startDownload({
          url: cdnUrl,
          fileName: file.general?.fileName || 'download',
          title: file.general?.fileName || record?.tmdb?.title || 'Download',
        });
        console.log('[Download] startDownload result:', JSON.stringify(dlResult));
        enqueueSnackbar(`Added: ${file.general?.fileName || 'file'}`, { variant: 'success' });
      } else {
        CommonServices.handleDownload(cdnUrl, { fileName: file.general?.fileName, openInNewTab: true });
      }
    } catch (err) {
      const msg = err?.message || err?.code || String(err);
      console.error('[Download] FAILED:', msg, err);
      enqueueSnackbar(`Download error: ${msg || 'unknown'}`, { variant: 'error', autoHideDuration: 8000 });
    } finally { setResolving(false); }
  }, [file, record, enqueueSnackbar]);

  return { resolving, playerOpen, setPlayerOpen, enrichedFiles, setEnrichedFiles, handlePlay, handleDownload };
}

// ─── Async copy button ────────────────────────────────────────────────────────

const CopyUrlButton = ({ getUrl, label = 'Copy URL' }) => {
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
        border: '1px solid', borderColor: copied ? 'success.main' : 'divider',
        borderRadius: 1.5, p: 0.75,
        color: copied ? 'success.main' : 'text.secondary',
        transition: 'border-color 0.2s, color 0.2s',
      }}>
        {copied ? <Check sx={{ fontSize: 14 }} /> : <ContentCopy sx={{ fontSize: 14 }} />}
      </IconButton>
    </Tooltip>
  );
};

// ─── Quality label (hero text element) ───────────────────────────────────────

const QualityLabel = ({ quality, size = 'md' }) => {
  const meta = QUALITY_META[quality] || QUALITY_META['Unknown'];
  const labels = {
    '8K': '8K', '4K': '4K UHD', '2160p': '4K UHD',
    '2K': '2K', '1440p': '1440p',
    '1080p': 'Full HD', '720p': 'HD', '480p': 'SD', 'SD': 'SD',
  };
  const display = labels[quality] || quality;
  const fontSize = size === 'sm' ? { xs: '0.95rem', sm: '1.05rem' } : { xs: '1.15rem', sm: '1.3rem' };
  return (
    <Typography sx={{
      fontWeight: 900, letterSpacing: '-0.02em',
      fontSize, color: meta.color, lineHeight: 1,
    }}>
      {display}
    </Typography>
  );
};

// ─── Compact file stats ───────────────────────────────────────────────────────

const FileMeta = ({ file }) => {
  const theme = useTheme();
  const { general, video } = file;
  const parts = [
    video?.resolution,
    general?.duration && CommonServices.formatDuration(general.duration),
    general?.fileSize,
    video?.bitRate && `${(video.bitRate / 1_000_000).toFixed(1)} Mbps`,
  ].filter(Boolean);

  return (
    <Typography sx={{
      fontSize: '0.75rem', color: theme.palette.text.secondary,
      letterSpacing: '0.01em', lineHeight: 1.5,
    }}>
      {parts.join('  ·  ')}
    </Typography>
  );
};

// ─── Audio tracks summary ─────────────────────────────────────────────────────

const AudioSummary = ({ audio, subtitle, compact = false }) => {
  const theme = useTheme();
  if (!audio?.length && !subtitle?.length) return null;

  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.6, alignItems: 'center' }}>
      {audio?.slice(0, compact ? 2 : 4).map((a, i) => {
        const lang = a.language || `Track ${i + 1}`;
        const fmt  = a.format?.split('(')[0].trim();
        const ch   = a.channels ? `${a.channels}ch` : '';
        return (
          <Box key={i} sx={{
            display: 'flex', alignItems: 'center', gap: 0.4,
            px: 0.9, py: 0.25, borderRadius: 1,
            bgcolor: alpha(theme.palette.info.main, 0.08),
            border: `1px solid ${alpha(theme.palette.info.main, 0.18)}`,
          }}>
            <Audiotrack sx={{ fontSize: 10, color: theme.palette.info.main, opacity: 0.8 }} />
            <Typography sx={{ fontSize: '0.65rem', fontWeight: 500, color: theme.palette.info.main }}>
              {[lang, fmt, ch].filter(Boolean).join(' · ')}
            </Typography>
          </Box>
        );
      })}
      {audio?.length > (compact ? 2 : 4) && (
        <Typography sx={{ fontSize: '0.65rem', color: theme.palette.text.disabled }}>
          +{audio.length - (compact ? 2 : 4)} audio
        </Typography>
      )}
      {subtitle?.length > 0 && !compact && (
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 0.4,
          px: 0.9, py: 0.25, borderRadius: 1,
          bgcolor: alpha(theme.palette.warning.main, 0.07),
          border: `1px solid ${alpha(theme.palette.warning.main, 0.18)}`,
        }}>
          <SubtitlesOutlined sx={{ fontSize: 10, color: theme.palette.warning.main, opacity: 0.8 }} />
          <Typography sx={{ fontSize: '0.65rem', fontWeight: 500, color: theme.palette.warning.main }}>
            {subtitle.length} sub{subtitle.length > 1 ? 's' : ''}
          </Typography>
        </Box>
      )}
    </Box>
  );
};

// ─── Action buttons row ───────────────────────────────────────────────────────

const FileActions = ({ file, allFiles, record, compact = false }) => {
  const theme = useTheme();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { resolving, playerOpen, setPlayerOpen, enrichedFiles, setEnrichedFiles, handlePlay, handleDownload } =
    useFileActions(file, allFiles, record);

  const isDark = theme.palette.mode === 'dark';
  const playBg = isDark ? '#fff' : '#0f172a';
  const playColor = isDark ? '#000' : '#fff';
  const iconSx = { border: '1px solid', borderColor: 'divider', borderRadius: 1.5, p: 0.75 };

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'nowrap' }}>
        {compact ? (
          <Tooltip title="Play">
            <span>
              <IconButton size="small" onClick={handlePlay} disabled={resolving}
                sx={{ ...iconSx, bgcolor: playBg, color: playColor, borderColor: 'transparent',
                  '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.88)' : 'rgba(15,23,42,0.88)' },
                }}>
                {resolving ? <CircularProgress size={12} color="inherit" /> : <PlayArrow sx={{ fontSize: 14 }} />}
              </IconButton>
            </span>
          </Tooltip>
        ) : (
          <Button
            size="small" variant="contained"
            startIcon={resolving ? <CircularProgress size={13} color="inherit" /> : <PlayArrow sx={{ fontSize: 18 }} />}
            onClick={handlePlay} disabled={resolving}
            sx={{
              bgcolor: playBg, color: playColor, fontWeight: 700,
              fontSize: '0.78rem', textTransform: 'none', borderRadius: 1.5,
              px: { xs: 1.5, sm: 2 }, py: 0.7, flexShrink: 0,
              '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.88)' : 'rgba(15,23,42,0.88)' },
            }}
          >
            Play
          </Button>
        )}

        <Tooltip title="Download">
          <span>
            <IconButton size="small" onClick={handleDownload} disabled={resolving} sx={iconSx}>
              {resolving ? <CircularProgress size={12} /> : <Download sx={{ fontSize: compact ? 13 : 15 }} />}
            </IconButton>
          </span>
        </Tooltip>

        <CopyUrlButton
          getUrl={() => resolveMediaUrl(file.mediaFileId, 'DOWNLOAD').then(r => r?.data?.cdnUrl)}
          label="Copy download URL"
        />

        <Tooltip title="File details">
          <IconButton size="small" onClick={() => setDrawerOpen(true)} sx={iconSx}>
            <InfoOutlined sx={{ fontSize: compact ? 13 : 15 }} />
          </IconButton>
        </Tooltip>
      </Box>

      <CinemaPlayer
        open={playerOpen}
        onClose={() => { setPlayerOpen(false); setEnrichedFiles(null); }}
        mediaInfo={enrichedFiles ? (enrichedFiles.find(f => f.mediaFileId === file.mediaFileId) ?? file) : file}
        allFiles={enrichedFiles ?? allFiles ?? [file]}
        record={record}
      />
      <MediaDetailsDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        mediaInfo={file}
        allFiles={allFiles ?? [file]}
        record={record}
      />
    </>
  );
};

// ─── Movie file card ──────────────────────────────────────────────────────────

const MovieFileCard = ({ file, allFiles, record }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { general, video, audio, subtitle } = file;

  const quality  = getQuality(video, general?.fileName);
  const codec    = getCodec(video?.format);
  const hdrTags  = getHdrTags(video?.hdrDetails, general?.fileName);
  const bitDepth = video?.bitDepth;
  const qColor   = (QUALITY_META[quality] || QUALITY_META['Unknown']).color;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Box sx={{
        borderRadius: 2, overflow: 'hidden',
        border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
        borderLeft: `4px solid ${qColor}`,
        bgcolor: theme.palette.mode === 'dark'
          ? alpha(theme.palette.background.paper, 0.5)
          : theme.palette.background.paper,
        transition: 'border-color 0.2s, box-shadow 0.2s',
        '&:hover': {
          borderColor: alpha(qColor, 0.6),
          boxShadow: `0 4px 24px ${alpha(qColor, 0.12)}`,
        },
      }}>
        <Box sx={{
          px: { xs: 2, sm: 2.5 }, pt: { xs: 1.8, sm: 2 }, pb: { xs: 1.5, sm: 1.8 },
          display: 'flex', flexDirection: 'column', gap: 1,
        }}>
          {/* Quality + badges */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.6 }}>
              <QualityLabel quality={quality} />
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center' }}>
                {codec && <CodecBadge codec={codec} />}
                {hdrTags.map(t => <HdrBadge key={t} tag={t} />)}
                {bitDepth === 10 && (
                  <Box sx={{
                    px: 0.9, py: 0.2, borderRadius: 1,
                    bgcolor: alpha('#6366f1', 0.14), color: '#818cf8',
                    border: `1px solid ${alpha('#6366f1', 0.32)}`,
                    fontSize: '0.63rem', fontWeight: 700, lineHeight: 1.6,
                  }}>10-bit</Box>
                )}
              </Box>
            </Box>
            {/* Actions top-right on desktop, below on mobile */}
            {!isMobile && (
              <FileActions file={file} allFiles={allFiles} record={record} compact={false} />
            )}
          </Box>

          {/* Stats */}
          <FileMeta file={file} />

          {/* Audio + subs */}
          <AudioSummary audio={audio} subtitle={subtitle} compact={false} />

          {/* Mobile actions */}
          {isMobile && (
            <Box sx={{ pt: 0.5 }}>
              <FileActions file={file} allFiles={allFiles} record={record} compact={false} />
            </Box>
          )}
        </Box>
      </Box>
    </motion.div>
  );
};

// ─── Episode quality variant row (compact, inside episode expand) ─────────────

const EpisodeQualityRow = ({ file, allEpisodeFiles, record, index }) => {
  const theme = useTheme();
  const { general, video, audio, subtitle } = file;
  const quality = getQuality(video, general?.fileName);
  const codec   = getCodec(video?.format);
  const hdrTags = getHdrTags(video?.hdrDetails, general?.fileName);
  const qColor  = (QUALITY_META[quality] || QUALITY_META['Unknown']).color;

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.15, delay: index * 0.04 }}
    >
      <Box sx={{
        px: { xs: 1.5, sm: 2 }, py: { xs: 1, sm: 1.1 },
        borderLeft: `3px solid ${qColor}`,
        transition: 'background 0.15s',
        '&:hover': { bgcolor: alpha(qColor, 0.05) },
      }}>
        {/* Row 1: quality badges (left) + actions (right, never wraps) */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flex: 1, minWidth: 0, flexWrap: 'wrap' }}>
            <QualityLabel quality={quality} size="sm" />
            {codec && <CodecBadge codec={codec} />}
            {hdrTags.map(t => <HdrBadge key={t} tag={t} />)}
          </Box>
          <Box sx={{ flexShrink: 0 }}>
            <FileActions file={file} allFiles={allEpisodeFiles} record={record} compact />
          </Box>
        </Box>

        {/* Row 2: file meta + audio/sub summary */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center' }}>
          <FileMeta file={file} />
          {audio?.length > 0 && <AudioSummary audio={audio} subtitle={subtitle} compact />}
        </Box>
      </Box>
    </motion.div>
  );
};

// ─── Episode row (collapsible) ────────────────────────────────────────────────

const EpisodeRow = ({ episodeNum, files, allSeasonFiles, record }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const sortedFiles = useMemo(() =>
    [...files].sort((a, b) =>
      qualityRank(getQuality(a.video, a.general?.fileName)) -
      qualityRank(getQuality(b.video, b.general?.fileName))
    ), [files]);

  const uniqueQualities = useMemo(() =>
    [...new Set(sortedFiles.map(f => getQuality(f.video, f.general?.fileName)))],
    [sortedFiles]);

  const [expanded, setExpanded] = useState(files.length === 1);
  const hasMultiple = files.length > 1;
  const isUnknown = episodeNum === 'Unknown';

  return (
    <Box sx={{
      borderRadius: 2, overflow: 'hidden', mb: 1,
      border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
      bgcolor: theme.palette.mode === 'dark'
        ? alpha(theme.palette.background.paper, 0.4)
        : theme.palette.background.paper,
      transition: 'border-color 0.18s',
      '&:hover': { borderColor: alpha(theme.palette.primary.main, 0.25) },
    }}>
      {/* Episode header */}
      <Box
        onClick={() => hasMultiple && setExpanded(v => !v)}
        sx={{
          display: 'flex', alignItems: 'center', gap: 1.5,
          px: { xs: 1.5, sm: 2 }, py: { xs: 1.1, sm: 1.2 },
          cursor: hasMultiple ? 'pointer' : 'default',
          userSelect: 'none',
          bgcolor: expanded && hasMultiple
            ? alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.07 : 0.04)
            : 'transparent',
          transition: 'background 0.15s',
          '&:hover': hasMultiple ? { bgcolor: alpha(theme.palette.primary.main, 0.06) } : {},
        }}
      >
        {/* Episode badge */}
        <Box sx={{
          minWidth: isUnknown ? 52 : 40, height: 26, borderRadius: 1.5, flexShrink: 0,
          bgcolor: alpha(theme.palette.primary.main, 0.12),
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Typography sx={{ fontSize: '0.7rem', fontWeight: 900, color: theme.palette.primary.main, letterSpacing: '0.03em' }}>
            {isUnknown ? '?' : `E${String(episodeNum).padStart(2, '0')}`}
          </Typography>
        </Box>

        {/* Quality summary */}
        <Stack direction="row" spacing={0.4} sx={{ flex: 1, overflow: 'hidden', flexWrap: 'nowrap', alignItems: 'center' }}>
          {uniqueQualities.slice(0, isMobile ? 3 : 5).map(q => <QBadge key={q} quality={q} />)}
          {uniqueQualities.length > (isMobile ? 3 : 5) && (
            <Typography sx={{ fontSize: '0.62rem', color: theme.palette.text.disabled, whiteSpace: 'nowrap' }}>
              +{uniqueQualities.length - (isMobile ? 3 : 5)}
            </Typography>
          )}
        </Stack>

        {/* File count */}
        {hasMultiple && (
          <Typography sx={{ fontSize: '0.68rem', color: theme.palette.text.disabled, flexShrink: 0, whiteSpace: 'nowrap' }}>
            {files.length} files
          </Typography>
        )}
        {!hasMultiple && sortedFiles[0]?.general?.fileSize && (
          <Typography sx={{ fontSize: '0.68rem', color: theme.palette.text.disabled, flexShrink: 0, whiteSpace: 'nowrap' }}>
            {sortedFiles[0].general.fileSize}
          </Typography>
        )}

        {hasMultiple && (
          <Box sx={{ color: 'text.secondary', lineHeight: 0, flexShrink: 0 }}>
            {expanded ? <ExpandLess sx={{ fontSize: 18 }} /> : <ExpandMore sx={{ fontSize: 18 }} />}
          </Box>
        )}
      </Box>

      {/* Quality variants */}
      <Collapse in={expanded || !hasMultiple} timeout="auto" unmountOnExit>
        <Box sx={{ borderTop: `1px solid ${alpha(theme.palette.divider, 0.4)}` }}>
          {sortedFiles.map((file, i) => (
            <React.Fragment key={file.id ?? file.mediaFileId ?? i}>
              {i > 0 && <Box sx={{ borderTop: `1px solid ${alpha(theme.palette.divider, 0.25)}` }} />}
              <EpisodeQualityRow file={file} allEpisodeFiles={sortedFiles} record={record} index={i} />
            </React.Fragment>
          ))}
        </Box>
      </Collapse>
    </Box>
  );
};

// ─── Season picker ────────────────────────────────────────────────────────────

const SeasonPicker = ({ seasons, activeSeason, onSelect, groupedBySeasonEpisode }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const seasonLabel = s => s === 'Unknown' ? 'Unknown' : `Season ${parseInt(s, 10)}`;

  const summary = useCallback((s) => {
    const sData = groupedBySeasonEpisode[s] ?? {};
    const epCount = Object.keys(sData).length;
    const allFiles = Object.values(sData).flat();
    const topQual = QUALITY_ORDER.find(q =>
      allFiles.some(f => getQuality(f.video, f.general?.fileName) === q)
    );
    return { epCount, topQual };
  }, [groupedBySeasonEpisode]);

  return (
    <Box sx={{
      display: 'flex', gap: 1, overflowX: 'auto', pb: 0.5,
      scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' },
    }}>
      {seasons.map(s => {
        const active = activeSeason === s;
        const { epCount, topQual } = summary(s);
        const qMeta = topQual ? (QUALITY_META[topQual] || QUALITY_META['Unknown']) : null;
        return (
          <Box
            key={s}
            onClick={() => onSelect(s)}
            sx={{
              flexShrink: 0, cursor: 'pointer', borderRadius: 2,
              px: { xs: 1.5, sm: 2 }, py: { xs: 0.9, sm: 1.1 },
              border: `1.5px solid ${active ? theme.palette.primary.main : alpha(theme.palette.divider, 0.5)}`,
              bgcolor: active
                ? alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.14 : 0.07)
                : alpha(theme.palette.background.paper, 0.5),
              transition: 'all 0.18s',
              '&:hover': { borderColor: active ? undefined : alpha(theme.palette.primary.main, 0.4) },
            }}
          >
            <Typography sx={{
              fontWeight: 700, fontSize: '0.82rem', lineHeight: 1.25,
              color: active ? theme.palette.primary.main : theme.palette.text.primary,
            }}>
              {seasonLabel(s)}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, mt: 0.4 }}>
              <Typography sx={{ fontSize: '0.62rem', color: theme.palette.text.disabled, whiteSpace: 'nowrap' }}>
                {epCount} ep
              </Typography>
              {qMeta && !isMobile && (
                <Box sx={{
                  px: 0.6, borderRadius: 0.5,
                  bgcolor: qMeta.color, color: '#fff',
                  fontSize: '0.53rem', fontWeight: 800, lineHeight: 1.8,
                }}>
                  {qMeta.label}
                </Box>
              )}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
};

// ─── Series view ──────────────────────────────────────────────────────────────

const SeriesView = ({ files, record }) => {
  const theme = useTheme();

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
    }), [groupedBySeasonEpisode]);

  const [activeSeason, setActiveSeason] = useState(() => seasons[0] ?? null);

  useEffect(() => {
    if (seasons.length > 0 && !seasons.includes(activeSeason)) setActiveSeason(seasons[0]);
  }, [seasons]); // eslint-disable-line

  const episodeMap = groupedBySeasonEpisode[activeSeason] ?? {};
  const episodes = useMemo(() =>
    Object.keys(episodeMap).sort((a, b) => {
      if (a === 'Unknown') return 1;
      if (b === 'Unknown') return -1;
      return Number(a) - Number(b);
    }), [episodeMap]);

  const totalFiles = Object.values(episodeMap).reduce((s, a) => s + a.length, 0);
  const seasonLabel = s => s === 'Unknown' ? 'Unknown' : `Season ${parseInt(s, 10)}`;

  return (
    <Box>
      {seasons.length > 1 && (
        <Box sx={{ mb: 2.5 }}>
          <SeasonPicker
            seasons={seasons}
            activeSeason={activeSeason}
            onSelect={setActiveSeason}
            groupedBySeasonEpisode={groupedBySeasonEpisode}
          />
        </Box>
      )}

      {activeSeason && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <LiveTv sx={{ color: theme.palette.primary.main, fontSize: 20 }} />
          <Typography sx={{ fontWeight: 700, fontSize: '1rem' }}>
            {seasonLabel(activeSeason)}
          </Typography>
          <Typography sx={{ fontSize: '0.78rem', color: theme.palette.text.secondary }}>
            · {episodes.length} episode{episodes.length !== 1 ? 's' : ''}
            {totalFiles !== episodes.length ? ` · ${totalFiles} files` : ''}
          </Typography>
        </Box>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={activeSeason}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2 }}
        >
          {episodes.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 8, color: theme.palette.text.disabled }}>
              <Typography>No files for this season</Typography>
            </Box>
          ) : (
            episodes.map(ep => (
              <EpisodeRow
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

// ─── Movie view (quality-filtered list) ──────────────────────────────────────

const MovieView = ({ files, record }) => {
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
    activeQuality === 'All'
      ? QUALITY_ORDER.flatMap(q => grouped[q] ?? [])
      : grouped[activeQuality] ?? [],
    [activeQuality, grouped]);

  return (
    <Box>
      {qualities.length > 2 && (
        <Box sx={{
          display: 'flex', gap: 0.8, overflowX: 'auto', pb: 1.5, mb: 2.5,
          scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' },
        }}>
          {qualities.map(q => {
            const meta = q === 'All' ? null : (QUALITY_META[q] || QUALITY_META['Unknown']);
            const count = q === 'All' ? files.length : (grouped[q]?.length ?? 0);
            const active = activeQuality === q;
            return (
              <Chip
                key={q}
                label={`${meta?.label ?? 'All'}  ${count}`}
                size="small"
                onClick={() => setActiveQuality(q)}
                sx={{
                  flexShrink: 0, fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer',
                  bgcolor: active
                    ? (meta ? meta.color : theme.palette.primary.main)
                    : alpha(theme.palette.divider, 0.35),
                  color: active ? '#fff' : theme.palette.text.secondary,
                  border: 'none',
                  '&:hover': { bgcolor: active ? undefined : alpha(theme.palette.divider, 0.55) },
                }}
              />
            );
          })}
        </Box>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.2 }}>
        {displayed.map((f, i) => (
          <MovieFileCard key={f.id ?? f.mediaFileId ?? i} file={f} allFiles={files} record={record} />
        ))}
      </Box>
    </Box>
  );
};

// ─── Loading state ────────────────────────────────────────────────────────────

const LoadingState = () => (
  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 14, gap: 2 }}>
    <CircularProgress size={36} />
    <Typography variant="body2" sx={{ color: 'text.secondary' }}>Loading files…</Typography>
  </Box>
);

// ─── Empty state ──────────────────────────────────────────────────────────────

const EmptyState = () => (
  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 14, gap: 2, color: 'text.disabled' }}>
    <VideoSettings sx={{ fontSize: 52, opacity: 0.25 }} />
    <Typography variant="body1" sx={{ fontWeight: 600, opacity: 0.5 }}>No media files available</Typography>
    <Typography variant="body2" sx={{ opacity: 0.4 }}>Files will appear here once media is added to the server</Typography>
  </Box>
);

// ─── Main export ──────────────────────────────────────────────────────────────

const MediaFilesPage = (props) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { recordId: urlRecordId } = useParams();
  const theme = useTheme();

  const record = props.record || location.state?.record;
  const resolvedRecordId = urlRecordId ?? record?.id ?? record?.recordId;

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

  const recType = record?.type?.toUpperCase() ?? '';
  const isSeries = recType === 'TV_SERIES' || recType === 'SERIES' || recType === 'TV';

  return (
    <Box sx={{ color: theme.palette.text.primary }}>
      {/* Section header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
        {isSeries
          ? <LiveTv sx={{ color: theme.palette.primary.main, fontSize: 22 }} />
          : <Movie sx={{ color: theme.palette.primary.main, fontSize: 22 }} />
        }
        <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: '-0.01em' }}>
          Available Files
        </Typography>
        {!loading && mediaFileList.length > 0 && (
          <Chip
            label={mediaFileList.length}
            size="small"
            sx={{
              fontWeight: 700, fontSize: '0.72rem',
              bgcolor: alpha(theme.palette.primary.main, 0.12),
              color: theme.palette.primary.main,
              height: 22,
            }}
          />
        )}
      </Box>

      {loading ? (
        <LoadingState />
      ) : mediaFileList.length === 0 ? (
        <EmptyState />
      ) : isSeries ? (
        <SeriesView files={mediaFileList} record={record} />
      ) : (
        <MovieView files={mediaFileList} record={record} />
      )}
    </Box>
  );
};

export default MediaFilesPage;
