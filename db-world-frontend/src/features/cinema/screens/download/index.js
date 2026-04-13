import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box, Container, Typography, Chip, IconButton, Button, Collapse,
  Divider, CircularProgress, useTheme, useMediaQuery, alpha, Tooltip,
  Stack,
} from '@mui/material';
import {
  ArrowBack, ExpandMore, ExpandLess, PlayArrow, Download, ContentCopy,
  Check, Subtitles, Audiotrack, FourK, Hd, Tv, Movie,
  VideoSettings, ChevronRight,
} from '@mui/icons-material';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Capacitor } from '@capacitor/core';
import { loadStreamFileInfoByRecordId } from '@shared/services/ApiServices';
import CinemaPlayer from '../../player/CinemaPlayer';
import MediaDetailsDrawer from '../MediaFileInfo/MediaDetailsDrawer';
import CommonServices from '@shared/services/CommonServices';
import Constants from '@shared/constants';
import AndroidPlugins from '@platform/android/AndroidPlugins';
import { registerPlugin } from '@capacitor/core';
const DbWorldDownload = registerPlugin('DbWorldDownload');

// ─── Constants ────────────────────────────────────────────────────────────────

const QUALITY_ORDER = ['8K', '4K', '2160p', '2K', '1440p', '1080p', '720p', '480p', '360p', 'SD', 'Unknown'];

const QUALITY_META = {
  '8K':    { color: '#ff3d00', label: '8K',    icon: <FourK sx={{ fontSize: 14 }} /> },
  '4K':    { color: '#ff6b35', label: '4K',    icon: <FourK sx={{ fontSize: 14 }} /> },
  '2160p': { color: '#ff6b35', label: '4K',    icon: <FourK sx={{ fontSize: 14 }} /> },
  '2K':    { color: '#f59e0b', label: '2K',    icon: <Hd sx={{ fontSize: 14 }} /> },
  '1440p': { color: '#f59e0b', label: '1440p', icon: <Hd sx={{ fontSize: 14 }} /> },
  '1080p': { color: '#10b981', label: '1080p', icon: <Hd sx={{ fontSize: 14 }} /> },
  '720p':  { color: '#3b82f6', label: '720p',  icon: <Hd sx={{ fontSize: 14 }} /> },
  '480p':  { color: '#8b5cf6', label: '480p',  icon: null },
  '360p':  { color: '#6b7280', label: '360p',  icon: null },
  'SD':    { color: '#6b7280', label: 'SD',    icon: null },
  'Unknown':{ color: '#4b5563', label: '?',   icon: null },
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
  if (src.includes('DOLBY VISION') || (src.includes(' DV ') || src.includes('.DV.'))) tags.push('DV');
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

// ─── Inline badge components ──────────────────────────────────────────────────

const QBadge = ({ quality }) => {
  const meta = QUALITY_META[quality] || QUALITY_META['Unknown'];
  return (
    <Box sx={{
      display: 'inline-flex', alignItems: 'center', gap: 0.4,
      px: 1, py: 0.2, borderRadius: 1,
      bgcolor: meta.color, color: '#fff',
      fontSize: '0.7rem', fontWeight: 800, lineHeight: 1.6, letterSpacing: '0.03em',
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
      px: 0.9, py: 0.2, borderRadius: 1,
      bgcolor: alpha(meta.color, 0.18), color: meta.color,
      border: `1px solid ${alpha(meta.color, 0.4)}`,
      fontSize: '0.65rem', fontWeight: 700, lineHeight: 1.6, flexShrink: 0,
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
      px: 0.9, py: 0.2, borderRadius: 1,
      bgcolor: alpha(meta.color, 0.15), color: meta.color,
      border: `1px solid ${alpha(meta.color, 0.35)}`,
      fontSize: '0.65rem', fontWeight: 700, lineHeight: 1.6, flexShrink: 0,
    }}>
      {codec}
    </Box>
  );
};

// ─── CopyIconButton ────────────────────────────────────────────────────────────

const CopyIconButton = ({ url, label }) => {
  const theme = useTheme();
  const [copied, setCopied] = useState(false);
  const handle = async () => {
    const res = await CommonServices.handleCopy(url);
    if (res.success) { setCopied(true); setTimeout(() => setCopied(false), 2000); }
  };
  return (
    <Tooltip title={copied ? 'Copied!' : label}>
      <IconButton
        size="small"
        onClick={handle}
        disabled={!url}
        sx={{
          border: `1px solid ${copied ? theme.palette.success.main : alpha(theme.palette.divider, 0.5)}`,
          borderRadius: 1.5, p: 0.7,
          color: copied ? 'success.main' : 'text.secondary',
        }}
      >
        {copied ? <Check sx={{ fontSize: 16 }} /> : <ContentCopy sx={{ fontSize: 16 }} />}
      </IconButton>
    </Tooltip>
  );
};

// ─── StatItem ─────────────────────────────────────────────────────────────────

const StatItem = ({ icon, label, value }) => {
  const theme = useTheme();
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.1 }}>
      <Typography sx={{ fontSize: '0.62rem', color: theme.palette.text.disabled, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: '0.75rem', color: theme.palette.text.primary, fontWeight: 500 }}>
        {icon} {value}
      </Typography>
    </Box>
  );
};

// ─── FileCard ─────────────────────────────────────────────────────────────────

const FileCard = ({ mediaInfo, allFiles = [], record }) => {
  const theme = useTheme();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [playerOpen, setPlayerOpen] = useState(false);

  const { general, video, audio, subtitle } = mediaInfo;
  const quality  = getQuality(video, general?.fileName);
  const codec    = getCodec(video?.format);
  const hdrTags  = getHdrTags(video?.hdrDetails, general?.fileName);
  const bitDepth = video?.bitDepth;

  const handlePlay = () => {
    if (Capacitor.getPlatform() === 'android') {
      AndroidPlugins.launchNativePlayer({
        url: mediaInfo.streamUrl,
        title: record?.tmdb?.title || general?.fileName || '',
        fileName: general?.fileName || '',
        fileId: String(mediaInfo.id || ''),
        preferredAudio: 'Hindi',
        preferredSub: null,
      });
    } else {
      setPlayerOpen(true);
    }
  };

  const handleDownload = () => {
    if (Capacitor.getPlatform() === 'android') {
      DbWorldDownload.startDownload({
        url: mediaInfo.downloadUrl,
        fileName: general?.fileName || 'download',
      }).catch(e => console.error('Download failed', e));
    } else {
      CommonServices.handleDownload(mediaInfo.downloadUrl, {
        fileName: general?.fileName,
        openInNewTab: true,
      });
    }
  };

  return (
    <>
      <Box sx={{
        bgcolor: alpha(theme.palette.background.paper, 0.6),
        border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
        borderRadius: 2,
        overflow: 'hidden',
        transition: 'border-color 0.2s',
        '&:hover': { borderColor: alpha(theme.palette.primary.main, 0.4) },
      }}>
        <Box sx={{ p: { xs: 1.5, sm: 2 } }}>
          {/* File name */}
          <Typography sx={{
            fontSize: '0.8rem', fontWeight: 600, color: theme.palette.text.primary,
            wordBreak: 'break-all', lineHeight: 1.4, mb: 1,
          }}>
            {general?.fileName || 'Unknown file'}
          </Typography>

          {/* Tags row */}
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

          {/* Quick stats grid */}
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 0.6 }}>
            {video?.resolution && (
              <StatItem icon="🎬" label="Resolution" value={video.resolution} />
            )}
            {video?.frameRate && (
              <StatItem icon="⚡" label="Frame Rate" value={`${video.frameRate} fps`} />
            )}
            {video?.bitRate && (
              <StatItem icon="📡" label="Video Bitrate" value={`${(video.bitRate / 1e6).toFixed(1)} Mbps`} />
            )}
            {general?.duration && (
              <StatItem icon="⏱" label="Duration" value={CommonServices.formatDuration(general.duration)} />
            )}
            {general?.fileSize && (
              <StatItem icon="📦" label="Size" value={general.fileSize} />
            )}
            {general?.overallBitrate && (
              <StatItem icon="🔗" label="Total Bitrate" value={general.overallBitrate} />
            )}
          </Box>

          {/* Audio summary */}
          {audio?.length > 0 && (
            <Box sx={{ mt: 1.2, display: 'flex', flexWrap: 'wrap', gap: 0.8 }}>
              {audio.map((a, i) => (
                <Box key={i} sx={{
                  display: 'flex', alignItems: 'center', gap: 0.5,
                  px: 1, py: 0.3, borderRadius: 1,
                  bgcolor: alpha(theme.palette.info.main, 0.08),
                  border: `1px solid ${alpha(theme.palette.info.main, 0.2)}`,
                }}>
                  <Audiotrack sx={{ fontSize: 12, color: theme.palette.info.main }} />
                  <Typography sx={{ fontSize: '0.7rem', color: theme.palette.info.main, fontWeight: 500 }}>
                    {a.format?.split('(')[0].trim()} {a.channels ? `${a.channels}ch` : ''} {a.language ? `· ${a.language}` : ''}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}

          {/* Subtitle summary */}
          {subtitle?.length > 0 && (
            <Box sx={{ mt: 0.8, display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Subtitles sx={{ fontSize: 13, color: theme.palette.text.disabled }} />
              <Typography sx={{ fontSize: '0.72rem', color: theme.palette.text.disabled }}>
                {subtitle.length} subtitle{subtitle.length > 1 ? 's' : ''}
                {': '}
                {subtitle.slice(0, 4).map(s => s.language).filter(Boolean).join(', ')}
                {subtitle.length > 4 ? '…' : ''}
              </Typography>
            </Box>
          )}

          {/* ── Actions ── */}
          <Box sx={{ display: 'flex', gap: 1, mt: 1.8, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Play group */}
            <Button
              size="small" variant="contained" startIcon={<PlayArrow />}
              onClick={handlePlay}
              sx={{ bgcolor: '#fff', color: '#000', fontWeight: 700, fontSize: '0.78rem', textTransform: 'none', px: 1.8, py: 0.7, borderRadius: 1.5, '&:hover': { bgcolor: 'rgba(255,255,255,.85)' } }}
            >
              Play
            </Button>
            <CopyIconButton url={mediaInfo.streamUrl} label="Copy stream URL" />

            <Divider orientation="vertical" flexItem sx={{ mx: 0.25 }} />

            {/* Download group */}
            <Button
              size="small" variant="outlined" startIcon={<Download />}
              onClick={handleDownload}
              sx={{ fontSize: '0.78rem', textTransform: 'none', px: 1.8, py: 0.7, borderRadius: 1.5 }}
            >
              Download
            </Button>
            <CopyIconButton url={mediaInfo.downloadUrl} label="Copy download URL" />

            <Box sx={{ flex: 1 }} />

            {/* Details */}
            <Button
              size="small" variant="text"
              endIcon={<ChevronRight sx={{ fontSize: 16 }} />}
              onClick={() => setDrawerOpen(true)}
              sx={{ fontSize: '0.72rem', textTransform: 'none', color: theme.palette.text.secondary, px: 1 }}
            >
              Details
            </Button>
          </Box>
        </Box>
      </Box>

      <CinemaPlayer
        open={playerOpen}
        onClose={() => setPlayerOpen(false)}
        mediaInfo={mediaInfo}
        allFiles={allFiles}
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
    <Box sx={{ mb: 2 }}>
      {/* Quality header */}
      <Box
        onClick={() => setOpen(v => !v)}
        sx={{
          display: 'flex', alignItems: 'center', gap: 1.5,
          px: 2, py: 1.2, mb: open ? 1.5 : 0,
          bgcolor: alpha(meta.color, 0.1),
          border: `1px solid ${alpha(meta.color, 0.25)}`,
          borderLeft: `4px solid ${meta.color}`,
          borderRadius: '0 8px 8px 0',
          cursor: 'pointer',
          userSelect: 'none',
          transition: 'background 0.15s',
          '&:hover': { bgcolor: alpha(meta.color, 0.15) },
        }}
      >
        <Box sx={{ fontWeight: 800, fontSize: '1rem', color: meta.color, minWidth: 52 }}>
          {meta.label}
        </Box>
        <Box sx={{ height: 16, width: 1, bgcolor: alpha(meta.color, 0.3) }} />
        <Typography sx={{ fontSize: '0.8rem', color: theme.palette.text.secondary, flex: 1 }}>
          {files.length} file{files.length !== 1 ? 's' : ''}
        </Typography>
        <IconButton size="small" sx={{ color: meta.color, p: 0.3 }}>
          {open ? <ExpandLess sx={{ fontSize: 18 }} /> : <ExpandMore sx={{ fontSize: 18 }} />}
        </IconButton>
      </Box>

      <Collapse in={open} timeout="auto" unmountOnExit>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {files.map((f, i) => (
            <motion.div key={f.id ?? i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: i * 0.04 }}>
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
    [grouped]
  );

  const displayed = useMemo(() => {
    if (activeQuality === 'All') return grouped;
    return { [activeQuality]: grouped[activeQuality] || [] };
  }, [activeQuality, grouped]);

  return (
    <Box>
      {/* Quality filter chips */}
      {qualities.length > 2 && (
        <Box sx={{
          display: 'flex', gap: 1, overflowX: 'auto', pb: 1.5, mb: 2,
          scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' },
        }}>
          {qualities.map(q => {
            const meta = q === 'All' ? null : QUALITY_META[q];
            const count = q === 'All' ? files.length : (grouped[q]?.length ?? 0);
            const active = activeQuality === q;
            return (
              <Chip
                key={q}
                label={`${meta?.label ?? q}  ${count}`}
                size="small"
                onClick={() => setActiveQuality(q)}
                sx={{
                  flexShrink: 0, fontWeight: 600, fontSize: '0.75rem',
                  bgcolor: active ? (meta ? meta.color : theme.palette.primary.main) : alpha(theme.palette.divider, 0.3),
                  color: active ? '#fff' : theme.palette.text.secondary,
                  border: 'none', cursor: 'pointer',
                  '&:hover': { bgcolor: active ? undefined : alpha(theme.palette.divider, 0.5) },
                }}
              />
            );
          })}
        </Box>
      )}

      {/* Sections */}
      {QUALITY_ORDER.filter(q => displayed[q]?.length > 0).map(q => (
        <QualitySection key={q} quality={q} files={displayed[q]} allFiles={files} record={record} />
      ))}
    </Box>
  );
};

// ─── SeriesFiles ──────────────────────────────────────────────────────────────

const SeriesFiles = ({ files, record }) => {
  const theme = useTheme();

  const groupedBySeason = useMemo(() => {
    const map = {};
    files.forEach(f => {
      const season = getSeason(f.general?.fileName) ?? 'Unknown';
      if (!map[season]) map[season] = {};
      const q = getQuality(f.video, f.general?.fileName);
      if (!map[season][q]) map[season][q] = [];
      map[season][q].push(f);
    });
    return map;
  }, [files]);

  const seasons = useMemo(() =>
    Object.keys(groupedBySeason).sort((a, b) => {
      if (a === 'Unknown') return 1;
      if (b === 'Unknown') return -1;
      return Number(a) - Number(b);
    }),
    [groupedBySeason]
  );

  // Active season filter — default to first season
  const [activeSeason, setActiveSeason] = useState(() => seasons[0] ?? null);

  // If seasons load/change and activeSeason not in list, reset
  useEffect(() => {
    if (seasons.length > 0 && !seasons.includes(activeSeason)) {
      setActiveSeason(seasons[0]);
    }
  }, [seasons]); // eslint-disable-line react-hooks/exhaustive-deps

  const seasonLabel = (s) => s === 'Unknown' ? 'Unknown' : `Season ${parseInt(s, 10)}`;

  const activeSeasonData = groupedBySeason[activeSeason] ?? {};
  const activeQualities = QUALITY_ORDER.filter(q => activeSeasonData[q]?.length > 0);
  const totalFiles = Object.values(activeSeasonData).reduce((s, a) => s + a.length, 0);

  return (
    <Box>
      {/* Season filter tabs */}
      {seasons.length > 1 && (
        <Box sx={{
          display: 'flex', gap: 1, overflowX: 'auto', pb: 1.5, mb: 2.5,
          scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' },
        }}>
          {seasons.map(s => {
            const active = activeSeason === s;
            const sData = groupedBySeason[s] ?? {};
            const count = Object.values(sData).reduce((acc, a) => acc + a.length, 0);
            const quals = QUALITY_ORDER.filter(q => sData[q]?.length > 0);
            return (
              <Box
                key={s}
                onClick={() => setActiveSeason(s)}
                sx={{
                  flexShrink: 0, cursor: 'pointer',
                  px: 2, py: 1, borderRadius: 2,
                  border: `1px solid ${active ? theme.palette.primary.main : alpha(theme.palette.divider, 0.4)}`,
                  bgcolor: active ? alpha(theme.palette.primary.main, 0.15) : alpha(theme.palette.background.paper, 0.4),
                  transition: 'all 0.18s',
                  '&:hover': { bgcolor: active ? undefined : alpha(theme.palette.primary.main, 0.06) },
                }}
              >
                <Typography sx={{ fontWeight: 700, fontSize: '0.82rem', color: active ? theme.palette.primary.main : theme.palette.text.primary, lineHeight: 1.3 }}>
                  {seasonLabel(s)}
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'nowrap' }}>
                  <Typography sx={{ fontSize: '0.65rem', color: theme.palette.text.disabled }}>
                    {count} file{count !== 1 ? 's' : ''}
                  </Typography>
                  {quals.slice(0, 3).map(q => {
                    const meta = QUALITY_META[q] || QUALITY_META['Unknown'];
                    return (
                      <Box key={q} sx={{ px: 0.6, borderRadius: 0.6, bgcolor: meta.color, color: '#fff', fontSize: '0.58rem', fontWeight: 800, lineHeight: 1.6 }}>
                        {meta.label}
                      </Box>
                    );
                  })}
                  {quals.length > 3 && (
                    <Typography sx={{ fontSize: '0.62rem', color: theme.palette.text.disabled }}>+{quals.length - 3}</Typography>
                  )}
                </Box>
              </Box>
            );
          })}
        </Box>
      )}

      {/* Active season content */}
      {activeSeason && (
        <Box>
          {/* Season label + file count */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
            <Tv sx={{ color: theme.palette.primary.main, fontSize: 20 }} />
            <Typography sx={{ fontWeight: 700, fontSize: '1rem' }}>
              {seasonLabel(activeSeason)}
            </Typography>
            <Typography sx={{ fontSize: '0.78rem', color: theme.palette.text.secondary }}>
              · {totalFiles} file{totalFiles !== 1 ? 's' : ''}
            </Typography>
          </Box>

          {activeQualities.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 6, color: theme.palette.text.disabled }}>
              <Typography>No files for this season</Typography>
            </Box>
          ) : (
            activeQualities.map(q => (
              <QualitySection key={q} quality={q} files={activeSeasonData[q]} allFiles={files} record={record} />
            ))
          )}
        </Box>
      )}
    </Box>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const MediaDownloadViewer = (props) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { recordId: urlRecordId } = useParams();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const record = props.record || location.state?.record;
  const resolvedRecordId = urlRecordId ?? record?.id ?? record?.recordId;
  const showBack = props.showBack ?? true;
  const onBack = props.onBack;

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

  const posterPath = record?.tmdb?.posterPath || record?.tmdb?.poster_path
    || record?.tmdb?.backdropPath || record?.tmdb?.backdrop_path;
  const title = record?.tmdb?.title || record?.tmdb?.name || record?.title || '';
  const overview = record?.tmdb?.overview || '';
  const releaseYear = record?.tmdb?.releaseDate || record?.tmdb?.release_date;

  return (
    <Box sx={{ bgcolor: theme.palette.background.default, minHeight: '100vh', color: theme.palette.text.primary }}>
      {/* ── Hero / Header ── */}
      <Box sx={{
        position: 'relative', overflow: 'hidden',
        background: `linear-gradient(to bottom, ${alpha(theme.palette.background.default, 0)} 0%, ${theme.palette.background.default} 100%)`,
      }}>
        {/* Backdrop blur */}
        {posterPath && (
          <Box sx={{
            position: 'absolute', inset: 0, zIndex: 0,
            backgroundImage: `url(https://image.tmdb.org/t/p/w780${posterPath})`,
            backgroundSize: 'cover', backgroundPosition: 'center top',
            filter: 'blur(28px) brightness(0.18)',
            transform: 'scale(1.1)',
          }} />
        )}

        <Container maxWidth="xl" sx={{ position: 'relative', zIndex: 1, pt: { xs: 2, sm: 3 }, pb: 4 }}>
          {/* Back */}
          {showBack && (
            <Button
              startIcon={<ArrowBack />} onClick={() => onBack ? onBack() : navigate(-1)}
              size="small" variant="outlined"
              sx={{ mb: 3, textTransform: 'none', borderColor: alpha('#fff', 0.25), color: alpha('#fff', 0.8), '&:hover': { borderColor: '#fff', bgcolor: alpha('#fff', 0.08) } }}
            >
              Back
            </Button>
          )}

          <Box sx={{ display: 'flex', gap: { xs: 2, sm: 3, md: 4 }, alignItems: 'flex-end', flexDirection: { xs: 'row' } }}>
            {/* Poster */}
            {posterPath && (
              <Box
                component="img"
                src={`https://image.tmdb.org/t/p/w300${posterPath}`}
                alt={title}
                sx={{
                  width: { xs: 80, sm: 120, md: 160 },
                  flexShrink: 0,
                  borderRadius: 2,
                  boxShadow: `0 8px 32px rgba(0,0,0,0.5)`,
                  aspectRatio: '2/3',
                  objectFit: 'cover',
                }}
              />
            )}

            {/* Info */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                <Chip
                  icon={isSeries ? <Tv sx={{ fontSize: 14 }} /> : <Movie sx={{ fontSize: 14 }} />}
                  label={isSeries ? 'TV Series' : 'Movie'}
                  size="small"
                  sx={{ bgcolor: alpha(theme.palette.primary.main, 0.2), color: theme.palette.primary.main, fontWeight: 700, fontSize: '0.7rem' }}
                />
                {releaseYear && (
                  <Typography sx={{ fontSize: '0.8rem', color: alpha('#fff', 0.5) }}>
                    {String(releaseYear).slice(0, 4)}
                  </Typography>
                )}
              </Box>
              <Typography variant={isMobile ? 'h5' : 'h4'} sx={{ fontWeight: 800, color: '#fff', lineHeight: 1.15, mb: 1 }}>
                {title}
              </Typography>
              {overview && !isMobile && (
                <Typography sx={{
                  fontSize: '0.85rem', color: alpha('#fff', 0.6), lineHeight: 1.6,
                  display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                  maxWidth: 600,
                }}>
                  {overview}
                </Typography>
              )}
            </Box>
          </Box>
        </Container>
      </Box>

      {/* ── Files Section ── */}
      <Container maxWidth="xl" sx={{ pb: { xs: 10, sm: 6 } }}>
        {/* Section title */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
          <VideoSettings color="primary" />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Available Files
          </Typography>
          {!loading && (
            <Chip
              label={`${mediaFileList.length} total`}
              size="small"
              color="primary" variant="outlined"
            />
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
