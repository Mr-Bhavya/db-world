import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { alpha, useTheme } from '@mui/material/styles';
import {
  Box,
  Container,
  Typography,
  Chip,
  Avatar,
  IconButton,
  Tooltip,
  Tabs,
  Tab,
  Divider,
  Rating,
  TextField,
  Button,
  Skeleton,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  CircularProgress,
  Alert,
  Paper,
  Dialog,
  useMediaQuery,
  Collapse,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ThumbUpOutlinedIcon from '@mui/icons-material/ThumbUpOutlined';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CloseIcon from '@mui/icons-material/Close';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import StarIcon from '@mui/icons-material/Star';
import FolderIcon from '@mui/icons-material/Folder';
import AudiotrackIcon from '@mui/icons-material/Audiotrack';
import SubtitlesIcon from '@mui/icons-material/Subtitles';
import DownloadIcon from '@mui/icons-material/Download';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import OndemandVideoIcon from '@mui/icons-material/OndemandVideo';
import ShareIcon from '@mui/icons-material/Share';

import { Capacitor } from '@capacitor/core';
import { registerPlugin } from '@capacitor/core';

import {
  fetchRecord,
  fetchInteraction,
  tmdbImg,
  addWatchlist,
  removeWatchlist,
  addLike,
  removeLike,
  addLove,
  removeLove,
  addWatched,
  removeWatched,
  fetchUserReviews,
  fetchMyReview,
  upsertReview,
  deleteReview,
} from '../api/cinemaApi';
import { loadStreamFileInfoByRecordId } from '@shared/services/ApiServices';
import CommonServices from '@shared/services/CommonServices';
import CinemaPlayer from '../player/CinemaPlayer';
import Constants from '@shared/constants';

import AndroidPlugins from '@platform/android/AndroidPlugins';
import { useT } from '@shared/theme/ThemeContext';
import MediaDownloadViewer from './download';

const DbWorldDownload = registerPlugin('DbWorldDownload');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getUserId = () => {
  try {
    const token = localStorage.getItem('token');
    if (!token) return null;
    const payload = JSON.parse(atob(token.split('.')[1] ?? 'e30='));
    return payload?.userId ?? null;
  } catch {
    return null;
  }
};

const formatCurrency = (val) => {
  if (!val || val === 0) return null;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
};

const formatDate = (dateStr) => {
  if (!dateStr) return null;
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return dateStr;
  }
};

const formatRuntime = (minutes) => {
  if (!minutes) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

const formatDuration = (ms) => {
  if (!ms) return null;
  const totalSec = Math.round(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`;
};

const formatBitrate = (bps) => {
  if (!bps) return null;
  if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(1)} Mbps`;
  return `${Math.round(bps / 1000)} kbps`;
};

const getRatingColor = (rating) => {
  if (rating >= 7.5) return '#4caf50';
  if (rating >= 6) return '#ff9800';
  return '#f44336';
};

// Quality helpers for Files tab
const QUALITY_ORDER = ['8K', '4K', '2160p', '1440p', '1080p', '720p', '480p', 'SD', 'Unknown'];
const QUALITY_META = {
  '8K':    { color: '#ff3d00', label: '8K' },
  '4K':    { color: '#ff6b35', label: '4K' },
  '2160p': { color: '#ff6b35', label: '4K' },
  '1440p': { color: '#f59e0b', label: '1440p' },
  '1080p': { color: '#10b981', label: '1080p' },
  '720p':  { color: '#3b82f6', label: '720p' },
  '480p':  { color: '#8b5cf6', label: '480p' },
  'SD':    { color: '#6b7280', label: 'SD' },
  'Unknown': { color: '#4b5563', label: '?' },
};
const CODEC_META = {
  'AV1':   { color: '#0891b2' },
  'H.265': { color: '#059669' },
  'H.264': { color: '#2563eb' },
  'VP9':   { color: '#7c3aed' },
};

function getQuality(video, fileName) {
  console.log('Determining quality for video:', video, 'and filename:', fileName);
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
    if (m) return m[1];
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
  return videoFormat.split('(')[0].trim().split(' ')[0] || null;
}

// ─── Shared small components ──────────────────────────────────────────────────

function SectionHeading({ children, sx }) {
  const T = useT();
  return (
    <Typography
      variant="h6"
      sx={{ color: T.text, fontWeight: 700, mb: 2, mt: 1, letterSpacing: 0.3, ...sx }}
    >
      {children}
    </Typography>
  );
}

function StatRow({ label, value, link }) {
  const T = useT();
  if (value == null || value === '') return null;
  return (
    <Box sx={{ display: 'flex', gap: 1.5, py: 0.75, borderBottom: `1px solid ${alpha(T.text, 0.06)}` }}>
      <Typography variant="body2" sx={{ color: T.textFaint, minWidth: 130, flexShrink: 0 }}>
        {label}
      </Typography>
      {link ? (
        <Box
          component="a" href={link} target="_blank" rel="noopener noreferrer"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: T.teal, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
        >
          <Typography variant="body2" sx={{ color: T.teal }}>{value}</Typography>
          <OpenInNewIcon sx={{ fontSize: 14 }} />
        </Box>
      ) : (
        <Typography variant="body2" sx={{ color: T.textMuted }}>{String(value)}</Typography>
      )}
    </Box>
  );
}

// ─── Video Player Dialog ───────────────────────────────────────────────────────

function VideoDialog({ video, onClose }) {
  if (!video) return null;
  const isYouTube = video.site === 'YouTube';
  const embedUrl = isYouTube ? `https://www.youtube.com/embed/${video.key}?autoplay=1` : null;

  return (
    <Dialog
      open
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{ sx: { bgcolor: '#000', borderRadius: 2, overflow: 'hidden' } }}
    >
      <Box sx={{ position: 'relative' }}>
        <IconButton
          onClick={onClose}
          sx={{ position: 'absolute', top: 8, right: 8, zIndex: 1, bgcolor: alpha('#000', 0.6), color: '#fff' }}
        >
          <CloseIcon />
        </IconButton>
        {embedUrl ? (
          <Box
            component="iframe"
            src={embedUrl}
            title={video.name}
            allow="autoplay; encrypted-media; fullscreen"
            allowFullScreen
            sx={{ width: '100%', aspectRatio: '16/9', border: 'none', display: 'block' }}
          />
        ) : (
          <Box sx={{ p: 4, color: '#fff', textAlign: 'center' }}>
            <Typography>Video from {video.site} — not embeddable</Typography>
            {video.key && (
              <Button
                component="a" href={`https://www.youtube.com/watch?v=${video.key}`}
                target="_blank" rel="noopener noreferrer"
                sx={{ mt: 2, color: '#00bcd4' }}
                startIcon={<OpenInNewIcon />}
              >
                Open in YouTube
              </Button>
            )}
          </Box>
        )}
        <Box sx={{ p: 1.5, bgcolor: '#111' }}>
          <Typography variant="body2" sx={{ color: '#fff', fontWeight: 600 }}>{video.name}</Typography>
          <Chip label={video.type} size="small" sx={{ mt: 0.5, bgcolor: alpha('#00bcd4', 0.15), color: '#00bcd4', fontSize: '0.65rem', height: 18 }} />
        </Box>
      </Box>
    </Dialog>
  );
}

// ─── Image Lightbox Dialog ────────────────────────────────────────────────────

function ImageLightbox({ images, startIndex, onClose }) {
  const [idx, setIdx] = useState(startIndex ?? 0);
  const img = images[idx];
  if (!img) return null;

  const prev = () => setIdx((i) => (i - 1 + images.length) % images.length);
  const next = () => setIdx((i) => (i + 1) % images.length);

  const handleKey = useCallback((e) => {
    if (e.key === 'ArrowLeft') prev();
    if (e.key === 'ArrowRight') next();
    if (e.key === 'Escape') onClose();
  }, [idx]);

  return (
    <Dialog
      open
      onClose={onClose}
      maxWidth="xl"
      fullWidth
      PaperProps={{ sx: { bgcolor: 'rgba(0,0,0,0.97)', borderRadius: 2 } }}
      onKeyDown={handleKey}
    >
      <Box sx={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <IconButton
          onClick={onClose}
          sx={{ position: 'absolute', top: 8, right: 8, zIndex: 2, bgcolor: alpha('#000', 0.6), color: '#fff' }}
        >
          <CloseIcon />
        </IconButton>

        {images.length > 1 && (
          <>
            <IconButton
              onClick={prev}
              sx={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', zIndex: 2, bgcolor: alpha('#000', 0.6), color: '#fff' }}
            >
              <ChevronLeftIcon />
            </IconButton>
            <IconButton
              onClick={next}
              sx={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', zIndex: 2, bgcolor: alpha('#000', 0.6), color: '#fff' }}
            >
              <ChevronRightIcon />
            </IconButton>
          </>
        )}

        <Box
          component="img"
          src={tmdbImg(img.filePath, 'original')}
          alt={img.imageType ?? 'Image'}
          sx={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain', display: 'block' }}
        />

        <Box sx={{ p: 1.5, width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Chip label={img.imageType ?? 'Image'} size="small" sx={{ bgcolor: '#1e1e1e', color: '#b3b3b3', fontSize: '0.68rem' }} />
            {img.width && img.height && (
              <Typography variant="caption" sx={{ color: '#757575' }}>{img.width} × {img.height}</Typography>
            )}
          </Box>
          <Typography variant="caption" sx={{ color: '#757575' }}>{idx + 1} / {images.length}</Typography>
        </Box>
      </Box>
    </Dialog>
  );
}

// ─── Lazy Image ───────────────────────────────────────────────────────────────

function LazyImage({ src, alt, onClick, sx }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  return (
    <Box
      sx={{ position: 'relative', overflow: 'hidden', cursor: onClick ? 'pointer' : 'default', ...sx }}
      onClick={onClick}
    >
      {!loaded && !error && (
        <Skeleton variant="rectangular" sx={{ position: 'absolute', inset: 0, bgcolor: '#242424' }} />
      )}
      {!error && (
        <Box
          component="img"
          src={src}
          alt={alt}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          sx={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: loaded ? 1 : 0,
            transition: 'opacity 0.3s',
            display: 'block',
          }}
        />
      )}
      {error && (
        <Box sx={{ width: '100%', height: '100%', bgcolor: '#1e1e1e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography variant="caption" sx={{ color: '#424242' }}>No image</Typography>
        </Box>
      )}
    </Box>
  );
}

// ─── Share helpers ────────────────────────────────────────────────────────────

function ShareButton({ record }) {
  const tmdb = record?.tmdb ?? {};
  const isMovie = record?.type === 'MOVIE';
  const [copied, setCopied] = React.useState(false);
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const shareUrl = window.location.href;
  const year = isMovie ? tmdb.releaseDate?.slice(0, 4) : tmdb.firstAirDate?.slice(0, 4);
  const shareTitle = [tmdb.title, year].filter(Boolean).join(' (') + (year ? ')' : '');
  const shareText = tmdb.overview ? tmdb.overview.slice(0, 120) + '…' : shareTitle;

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: shareTitle, text: shareText, url: shareUrl });
      } catch (e) {
        if (e?.name !== 'AbortError') setDialogOpen(true);
      }
    } else {
      setDialogOpen(true);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <>
      <Tooltip title="Share" placement="top">
        <IconButton
          size="small"
          onClick={handleShare}
          sx={{
            bgcolor: alpha('#fff', 0.1),
            border: `1.5px solid ${alpha('#fff', 0.2)}`,
            color: '#b3b3b3',
            width: 38, height: 38,
            backdropFilter: 'blur(4px)',
            transition: 'all 0.2s',
            '&:hover': { bgcolor: alpha('#fff', 0.18) },
          }}
        >
          <ShareIcon sx={{ fontSize: 19 }} />
        </IconButton>
      </Tooltip>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { bgcolor: '#1a1a1a', color: '#fff', borderRadius: 2 } }}>
        <Box sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>Share</Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)', mb: 2 }}>{shareTitle}</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: 'rgba(255,255,255,0.06)', borderRadius: 1.5, p: 1.2 }}>
            <Typography variant="body2" sx={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem' }}>
              {shareUrl}
            </Typography>
            <IconButton size="small" onClick={handleCopy} sx={{ color: copied ? '#4caf50' : '#fff', flexShrink: 0 }}>
              {copied ? <CheckIcon sx={{ fontSize: 18 }} /> : <ContentCopyIcon sx={{ fontSize: 18 }} />}
            </IconButton>
          </Box>
          <Box sx={{ display: 'flex', gap: 1.5, mt: 2.5, flexWrap: 'wrap' }}>
            <Button size="small" variant="outlined" onClick={() => window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareTitle)}`, '_blank')}
              sx={{ borderColor: '#1da1f2', color: '#1da1f2', textTransform: 'none', fontSize: '0.78rem' }}>
              Twitter / X
            </Button>
            <Button size="small" variant="outlined" onClick={() => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, '_blank')}
              sx={{ borderColor: '#1877f2', color: '#1877f2', textTransform: 'none', fontSize: '0.78rem' }}>
              Facebook
            </Button>
            <Button size="small" variant="outlined" onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(shareTitle + ' ' + shareUrl)}`, '_blank')}
              sx={{ borderColor: '#25d366', color: '#25d366', textTransform: 'none', fontSize: '0.78rem' }}>
              WhatsApp
            </Button>
          </Box>
          <Button fullWidth onClick={() => setDialogOpen(false)} sx={{ mt: 2, color: 'rgba(255,255,255,0.5)', textTransform: 'none' }}>
            Close
          </Button>
        </Box>
      </Dialog>
    </>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero({ record, interaction, onToggle, interactionLoading, onPlayTrailer, onWatchClick }) {
  const tmdb = record?.tmdb ?? {};
  const isMovie = record?.type === 'MOVIE';
  const theme = useTheme();
  const isXs = useMediaQuery(theme.breakpoints.down('sm'));

  const backdropUrl = tmdbImg(tmdb.backdropPath, 'original');
  const posterUrl   = tmdbImg(tmdb.posterPath,   'w342');

  const year = isMovie ? tmdb.releaseDate?.slice(0, 4) : tmdb.firstAirDate?.slice(0, 4);
  const endYear = !isMovie && tmdb.lastAirDate ? tmdb.lastAirDate.slice(0, 4) : null;

  const runtimeLine = isMovie
    ? formatRuntime(tmdb.runtime)
    : tmdb.numberOfSeasons != null
      ? `${tmdb.numberOfSeasons} Season${tmdb.numberOfSeasons !== 1 ? 's' : ''}${tmdb.numberOfEpisodes ? ` · ${tmdb.numberOfEpisodes} Episodes` : ''}`
      : null;

  const rating = tmdb.voteAverage ? Math.round(tmdb.voteAverage * 10) / 10 : null;
  const ratingColor = rating ? getRatingColor(rating) : '#757575';

  const btns = [
    { key: 'watchlisted', label: 'Watchlist', ActiveIcon: BookmarkIcon, InactiveIcon: BookmarkBorderIcon, activeColor: '#0d9488', add: addWatchlist, remove: removeWatchlist },
    { key: 'liked',       label: 'Like',      ActiveIcon: ThumbUpIcon,    InactiveIcon: ThumbUpOutlinedIcon,   activeColor: '#2196f3', add: addLike,      remove: removeLike      },
    { key: 'loved',       label: 'Love',      ActiveIcon: FavoriteIcon,   InactiveIcon: FavoriteBorderIcon,    activeColor: '#e91e63', add: addLove,      remove: removeLove      },
    { key: 'watched',     label: 'Watched',   ActiveIcon: VisibilityIcon, InactiveIcon: VisibilityOffIcon,     activeColor: '#4caf50', add: addWatched,   remove: removeWatched   },
  ];

  return (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        height: { xs: 420, sm: 500, md: 580 },
        overflow: 'hidden',
        bgcolor: '#080808',
        // Hard cinematic edge — box-shadow creates depth in light mode
        boxShadow: '0 8px 40px rgba(0,0,0,0.45)',
      }}
    >
      {/* Backdrop */}
      {backdropUrl && (
        <Box
          component="img"
          src={backdropUrl}
          alt=""
          sx={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center top',
            opacity: 0.55,
          }}
        />
      )}

      {/* Gradient layers */}
      <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.65) 55%, rgba(0,0,0,0.1) 100%)' }} />
      {/* Strong bottom gradient — always dark so buttons stay visible */}
      <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.96) 0%, rgba(0,0,0,0.55) 40%, transparent 75%)' }} />

      {/* Back button */}
      <Box sx={{ position: 'absolute', top: 16, left: { xs: 12, md: 24 }, zIndex: 2 }}>
        <IconButton
          size="small"
          onClick={() => window.history.back()}
          sx={{ bgcolor: alpha('#000', 0.5), color: '#fff', backdropFilter: 'blur(8px)', '&:hover': { bgcolor: alpha('#000', 0.7) } }}
        >
          <ArrowBackIcon sx={{ fontSize: 20 }} />
        </IconButton>
      </Box>

      {/* Content */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'flex-end',
          px: { xs: 2, sm: 3, md: 5 },
          pb: { xs: 3, md: 5 },
        }}
      >
        <Box sx={{ display: 'flex', gap: { xs: 2, md: 3.5 }, alignItems: 'flex-end', width: '100%', maxWidth: 900 }}>

          {/* Poster */}
          {posterUrl && !isXs && (
            <Box
              component="img"
              src={posterUrl}
              alt={tmdb.title ?? record?.name}
              sx={{
                width: { sm: 110, md: 150 },
                aspectRatio: '2/3',
                borderRadius: 2,
                boxShadow: '0 16px 48px rgba(0,0,0,0.8)',
                flexShrink: 0,
                border: '2px solid rgba(255,255,255,0.1)',
                objectFit: 'cover',
              }}
            />
          )}

          {/* Info */}
          <Box sx={{ flex: 1, minWidth: 0 }}>

            {/* Record type badge */}
            <Chip
              label={isMovie ? 'Movie' : 'TV Series'}
              size="small"
              sx={{ bgcolor: alpha('#0d9488', 0.25), color: '#0d9488', fontSize: '0.68rem', fontWeight: 700, mb: 1, height: 20, border: `1px solid ${alpha('#0d9488', 0.4)}` }}
            />

            {/* Title */}
            <Typography
              variant="h3"
              sx={{
                color: '#fff',
                fontWeight: 800,
                lineHeight: 1.05,
                fontSize: { xs: '1.6rem', sm: '2rem', md: '2.6rem' },
                textShadow: '0 2px 12px rgba(0,0,0,0.9)',
                mb: 0.5,
                letterSpacing: -0.5,
              }}
            >
              {tmdb.title ?? record?.name}
            </Typography>

            {/* Original title */}
            {tmdb.originalTitle && tmdb.originalTitle !== tmdb.title && (
              <Typography variant="body2" sx={{ color: '#9e9e9e', mb: 0.75, fontStyle: 'italic' }}>
                {tmdb.originalTitle}
              </Typography>
            )}

            {/* Meta row */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: { xs: 0.75, md: 1.25 }, mb: 1.5 }}>
              {year && (
                <Typography variant="body2" sx={{ color: '#bdbdbd', fontWeight: 500 }}>
                  {year}{endYear && endYear !== year ? `–${endYear}` : ''}
                </Typography>
              )}
              {runtimeLine && (
                <>
                  <Box sx={{ width: 3, height: 3, borderRadius: '50%', bgcolor: '#616161' }} />
                  <Typography variant="body2" sx={{ color: '#bdbdbd' }}>{runtimeLine}</Typography>
                </>
              )}
              {tmdb.status && (
                <>
                  <Box sx={{ width: 3, height: 3, borderRadius: '50%', bgcolor: '#616161' }} />
                  <Chip
                    label={tmdb.status}
                    size="small"
                    sx={{
                      bgcolor: tmdb.status === 'Released' || tmdb.status === 'Ended' ? alpha('#4caf50', 0.15) : alpha('#ff9800', 0.15),
                      color: tmdb.status === 'Released' || tmdb.status === 'Ended' ? '#4caf50' : '#ff9800',
                      fontSize: '0.65rem', height: 18,
                    }}
                  />
                </>
              )}
              {rating != null && (
                <>
                  <Box sx={{ width: 3, height: 3, borderRadius: '50%', bgcolor: '#616161' }} />
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
                    <StarIcon sx={{ fontSize: 14, color: '#ff9800' }} />
                    <Typography variant="body2" sx={{ color: ratingColor, fontWeight: 700 }}>{rating}</Typography>
                    {tmdb.voteCount > 0 && (
                      <Typography variant="caption" sx={{ color: '#616161' }}>({tmdb.voteCount.toLocaleString()})</Typography>
                    )}
                  </Box>
                </>
              )}
            </Box>

            {/* Genres */}
            {(tmdb.genres ?? []).length > 0 && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.6, mb: 1.5 }}>
                {(tmdb.genres ?? []).map((g) => (
                  <Chip
                    key={g.id}
                    label={g.name}
                    size="small"
                    sx={{ bgcolor: alpha('#fff', 0.1), color: '#e0e0e0', fontSize: '0.7rem', height: 22, backdropFilter: 'blur(4px)', border: `1px solid ${alpha('#fff', 0.08)}` }}
                  />
                ))}
              </Box>
            )}

            {/* Tagline */}
            {tmdb.tagline && (
              <Typography variant="body2" sx={{ color: '#9e9e9e', fontStyle: 'italic', mb: 1.5, fontSize: '0.85rem', display: { xs: 'none', sm: 'block' } }}>
                "{tmdb.tagline}"
              </Typography>
            )}

            {/* Action buttons */}
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
              {/* Watch / Stream */}
              {onWatchClick && (
                <Button
                  variant="contained"
                  startIcon={<OndemandVideoIcon />}
                  onClick={onWatchClick}
                  size="small"
                  sx={{
                    bgcolor: '#0d9488',
                    color: '#fff',
                    fontWeight: 700,
                    textTransform: 'none',
                    px: 2,
                    borderRadius: 5,
                    '&:hover': { bgcolor: '#0f766e' },
                    fontSize: '0.82rem',
                  }}
                >
                  Watch
                </Button>
              )}

              {/* Play Trailer */}
              {onPlayTrailer && (
                <Button
                  variant="contained"
                  startIcon={<PlayArrowIcon />}
                  onClick={onPlayTrailer}
                  size="small"
                  sx={{
                    bgcolor: alpha('#fff', 0.15),
                    color: '#fff',
                    fontWeight: 700,
                    textTransform: 'none',
                    px: 2,
                    borderRadius: 5,
                    backdropFilter: 'blur(4px)',
                    border: `1px solid ${alpha('#fff', 0.25)}`,
                    '&:hover': { bgcolor: alpha('#fff', 0.25) },
                    fontSize: '0.82rem',
                  }}
                >
                  Trailer
                </Button>
              )}

              {/* Interaction icon buttons */}
              {btns.map(({ key, label, ActiveIcon, InactiveIcon, activeColor }) => {
                const active = interaction?.[key] ?? false;
                return (
                  <Tooltip key={key} title={label} placement="top">
                    <span>
                      <IconButton
                        size="small"
                        disabled={interactionLoading}
                        onClick={() => onToggle(key, active)}
                        sx={{
                          bgcolor: active ? alpha(activeColor, 0.25) : alpha('#fff', 0.1),
                          border: `1.5px solid ${active ? activeColor : alpha('#fff', 0.2)}`,
                          color: active ? activeColor : '#b3b3b3',
                          width: 38,
                          height: 38,
                          backdropFilter: 'blur(4px)',
                          transition: 'all 0.2s',
                          '&:hover': { bgcolor: active ? alpha(activeColor, 0.35) : alpha('#fff', 0.18) },
                        }}
                      >
                        {active ? <ActiveIcon sx={{ fontSize: 19 }} /> : <InactiveIcon sx={{ fontSize: 19 }} />}
                      </IconButton>
                    </span>
                  </Tooltip>
                );
              })}

              {/* Share button */}
              <ShareButton record={record} />
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

// ─── Tab: Overview ────────────────────────────────────────────────────────────

function OverviewTab({ record }) {
  const T = useT();
  const tmdb = record?.tmdb ?? {};
  const isMovie = record?.type === 'MOVIE';
  const providers = tmdb.providers ?? [];

  const grouped = providers.reduce((acc, p) => {
    const type = p.providerType ?? 'OTHER';
    if (!acc[type]) acc[type] = [];
    acc[type].push(p);
    return acc;
  }, {});
  Object.values(grouped).forEach((arr) => arr.sort((a, b) => (a.provider?.displayPriority ?? 99) - (b.provider?.displayPriority ?? 99)));
  const providerOrder = ['FLATRATE', 'NETWORK', 'RENT', 'BUY'];
  const typeLabel = { FLATRATE: 'Streaming', RENT: 'Rent', BUY: 'Buy', NETWORK: 'Network' };
  const sortedProviderKeys = [...providerOrder.filter((k) => grouped[k]), ...Object.keys(grouped).filter((k) => !providerOrder.includes(k))];

  const chipSx = { bgcolor: alpha(T.teal, 0.12), color: T.teal, fontSize: '0.72rem', border: `1px solid ${alpha(T.teal, 0.2)}` };
  const subChipSx = { bgcolor: T.glass, color: T.textMuted, fontSize: '0.72rem' };

  return (
    <Box sx={{ py: 3 }}>
      {/* Overview text */}
      {tmdb.overview && (
        <Typography variant="body1" sx={{ color: T.textMuted, lineHeight: 1.85, mb: 4, maxWidth: 760, fontSize: { xs: '0.95rem', md: '1rem' } }}>
          {tmdb.overview}
        </Typography>
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: { xs: 3, md: 5 } }}>

        {/* Left: Key details */}
        <Box>
          <SectionHeading>Details</SectionHeading>
          {isMovie ? (
            <>
              <StatRow label="Release Date" value={formatDate(tmdb.releaseDate)} />
              <StatRow label="Runtime"      value={formatRuntime(tmdb.runtime)} />
              <StatRow label="Status"       value={tmdb.status} />
              <StatRow label="Language"     value={tmdb.originalLanguage?.toUpperCase()} />
              <StatRow label="Budget"       value={formatCurrency(tmdb.budget)} />
              <StatRow label="Revenue"      value={formatCurrency(tmdb.revenue)} />
              {tmdb.imdbId && <StatRow label="IMDb" value={tmdb.imdbId} link={`https://www.imdb.com/title/${tmdb.imdbId}`} />}
              {tmdb.homepage && <StatRow label="Homepage" value="Visit website" link={tmdb.homepage} />}
              {tmdb.belongsToCollection && <StatRow label="Collection" value={tmdb.belongsToCollection.name} />}
            </>
          ) : (
            <>
              <StatRow label="First Air Date"   value={formatDate(tmdb.firstAirDate)} />
              <StatRow label="Last Air Date"    value={formatDate(tmdb.lastAirDate)} />
              <StatRow label="In Production"    value={tmdb.inProduction != null ? (tmdb.inProduction ? 'Yes' : 'No') : null} />
              <StatRow label="Seasons"          value={tmdb.numberOfSeasons} />
              <StatRow label="Episodes"         value={tmdb.numberOfEpisodes} />
              <StatRow label="Episode Runtime"  value={tmdb.episodeRunTimes?.length > 0 ? tmdb.episodeRunTimes.map(formatRuntime).join(', ') : null} />
              <StatRow label="Status"           value={tmdb.status} />
              <StatRow label="Type"             value={tmdb.type} />
              <StatRow label="Language"         value={tmdb.originalLanguage?.toUpperCase()} />
              {tmdb.homepage && <StatRow label="Homepage" value="Visit website" link={tmdb.homepage} />}
            </>
          )}

          {/* Production */}
          {(tmdb.productionCompanies ?? []).length > 0 && (
            <Box sx={{ mt: 3 }}>
              <SectionHeading sx={{ fontSize: '0.9rem' }}>Companies</SectionHeading>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                {(tmdb.productionCompanies ?? []).map((c, i) => (
                  <Chip key={i} label={`${c.name}${c.originCountry ? ` (${c.originCountry})` : ''}`} size="small" sx={subChipSx} />
                ))}
              </Box>
            </Box>
          )}
        </Box>

        {/* Right: Production + Providers */}
        <Box>
          {/* Countries & languages */}
          {(tmdb.productionCountries ?? []).length > 0 && (
            <Box sx={{ mb: 3 }}>
              <SectionHeading sx={{ fontSize: '0.9rem' }}>Countries</SectionHeading>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                {(tmdb.productionCountries ?? []).map((c, i) => (
                  <Chip key={i} label={c.name} size="small" sx={subChipSx} />
                ))}
              </Box>
            </Box>
          )}

          {(tmdb.spokenLanguages ?? []).length > 0 && (
            <Box sx={{ mb: 3 }}>
              <SectionHeading sx={{ fontSize: '0.9rem' }}>Languages</SectionHeading>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                {(tmdb.spokenLanguages ?? []).map((l, i) => (
                  <Chip key={i} label={l.englishName ?? l.name} size="small" sx={subChipSx} />
                ))}
              </Box>
            </Box>
          )}

          {!isMovie && (tmdb.createdBy ?? []).length > 0 && (
            <Box sx={{ mb: 3 }}>
              <SectionHeading sx={{ fontSize: '0.9rem' }}>Created By</SectionHeading>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                {(tmdb.createdBy ?? []).map((c, i) => (
                  <Chip key={i} label={c.name} size="small" sx={chipSx} />
                ))}
              </Box>
            </Box>
          )}

          {/* TV: last + next episode */}
          {!isMovie && (tmdb.lastEpisodeToAir || tmdb.nextEpisodeToAir) && (
            <Box sx={{ mb: 3 }}>
              {tmdb.lastEpisodeToAir && (
                <Paper sx={{ bgcolor: T.glass, p: 1.5, borderRadius: 1.5, mb: 1.5, border: `1px solid ${alpha(T.text, 0.08)}` }}>
                  <Typography variant="caption" sx={{ color: T.textFaint, textTransform: 'uppercase', letterSpacing: 1 }}>Last Episode</Typography>
                  <Typography variant="body2" sx={{ color: T.text, mt: 0.5, fontWeight: 600 }}>
                    S{String(tmdb.lastEpisodeToAir.seasonNumber).padStart(2,'0')}E{String(tmdb.lastEpisodeToAir.episodeNumber).padStart(2,'0')} — {tmdb.lastEpisodeToAir.name}
                  </Typography>
                  <Typography variant="caption" sx={{ color: T.textFaint }}>{formatDate(tmdb.lastEpisodeToAir.airDate)}</Typography>
                </Paper>
              )}
              {tmdb.nextEpisodeToAir && (
                <Paper sx={{ bgcolor: T.glass, p: 1.5, borderRadius: 1.5, border: `1px solid ${alpha(T.teal, 0.25)}` }}>
                  <Typography variant="caption" sx={{ color: T.teal, textTransform: 'uppercase', letterSpacing: 1 }}>Next Episode</Typography>
                  <Typography variant="body2" sx={{ color: T.text, mt: 0.5, fontWeight: 600 }}>
                    S{String(tmdb.nextEpisodeToAir.seasonNumber).padStart(2,'0')}E{String(tmdb.nextEpisodeToAir.episodeNumber).padStart(2,'0')} — {tmdb.nextEpisodeToAir.name}
                  </Typography>
                  <Typography variant="caption" sx={{ color: T.textFaint }}>{formatDate(tmdb.nextEpisodeToAir.airDate)}</Typography>
                </Paper>
              )}
            </Box>
          )}

          {/* Where to Watch */}
          {sortedProviderKeys.length > 0 && (
            <Box>
              <SectionHeading>Where to Watch</SectionHeading>
              {sortedProviderKeys.map((type) => (
                <Box key={type} sx={{ mb: 2 }}>
                  <Typography variant="caption" sx={{ color: T.textFaint, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, display: 'block', mb: 0.75 }}>
                    {typeLabel[type] ?? type}
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {grouped[type].map((p, i) => {
                      const logoUrl = tmdbImg(p.provider?.logoPath, 'w92');
                      return (
                        <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: T.glass, border: `1px solid ${alpha(T.text, 0.08)}`, borderRadius: 1.5, px: 1.25, py: 0.75 }}>
                          {logoUrl && <Box component="img" src={logoUrl} alt={p.provider?.name} sx={{ width: 26, height: 26, borderRadius: 0.75, objectFit: 'cover' }} />}
                          <Typography variant="body2" sx={{ color: T.textMuted, fontWeight: 500, fontSize: '0.82rem' }}>{p.provider?.name}</Typography>
                          {p.regionCode && <Chip label={p.regionCode} size="small" sx={{ bgcolor: 'transparent', color: T.textFaint, fontSize: '0.6rem', height: 16 }} />}
                        </Box>
                      );
                    })}
                  </Box>
                </Box>
              ))}
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}

// ─── Tab: Cast & Crew ─────────────────────────────────────────────────────────

function CastCrewTab({ record }) {
  const T = useT();
  const tmdb = record?.tmdb ?? {};
  const credits = tmdb.credits ?? [];

  const cast = [...(Array.isArray(credits) ? credits.filter((c) => c.creditType === 'CAST') : [])]
    .sort((a, b) => (a.castOrder ?? 999) - (b.castOrder ?? 999));

  const crew = Array.isArray(credits) ? credits.filter((c) => c.creditType === 'CREW') : [];
  const crewByDept = crew.reduce((acc, c) => {
    const dept = c.department ?? 'Other';
    if (!acc[dept]) acc[dept] = [];
    acc[dept].push(c);
    return acc;
  }, {});

  return (
    <Box sx={{ py: 3 }}>
      {cast.length > 0 && (
        <>
          <SectionHeading>Cast</SectionHeading>
          <Box
            sx={{
              display: 'flex',
              gap: 2,
              overflowX: 'auto',
              pb: 1.5,
              mb: 4,
              scrollbarWidth: 'thin',
              scrollbarColor: `${alpha(T.text, 0.2)} transparent`,
              '&::-webkit-scrollbar': { height: 5 },
              '&::-webkit-scrollbar-thumb': { background: alpha(T.text, 0.2), borderRadius: 3 },
            }}
          >
            {cast.map((c, i) => {
              const imgUrl = tmdbImg(c.person?.profilePath, 'w185');
              const initials = (c.person?.name ?? '?').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
              return (
                <Box
                  key={c.creditId ?? i}
                  sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, width: 88, gap: 0.75 }}
                >
                  <Avatar
                    src={imgUrl ?? undefined}
                    alt={c.person?.name}
                    sx={{ width: 72, height: 72, bgcolor: alpha(T.teal, 0.3), fontSize: '1rem', fontWeight: 700, border: `2px solid ${alpha(T.text, 0.1)}` }}
                  >
                    {!imgUrl && initials}
                  </Avatar>
                  <Typography variant="caption" sx={{ color: T.text, fontWeight: 600, textAlign: 'center', lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {c.person?.name}
                  </Typography>
                  <Typography variant="caption" sx={{ color: T.textFaint, textAlign: 'center', lineHeight: 1.2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', fontSize: '0.68rem' }}>
                    {c.character}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        </>
      )}

      {Object.keys(crewByDept).length > 0 && (
        <>
          <SectionHeading>Crew</SectionHeading>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 3 }}>
            {Object.entries(crewByDept).map(([dept, members]) => (
              <Box key={dept}>
                <Typography variant="caption" sx={{ color: T.teal, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, display: 'block', mb: 1 }}>
                  {dept}
                </Typography>
                {members.map((m, i) => (
                  <Box key={m.creditId ?? i} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5, borderBottom: `1px solid ${alpha(T.text, 0.05)}` }}>
                    <Typography variant="body2" sx={{ color: T.textMuted }}>{m.person?.name}</Typography>
                    <Typography variant="body2" sx={{ color: T.textFaint, fontSize: '0.8rem' }}>{m.job}</Typography>
                  </Box>
                ))}
              </Box>
            ))}
          </Box>
        </>
      )}

      {cast.length === 0 && Object.keys(crewByDept).length === 0 && (
        <Typography variant="body2" sx={{ color: T.textFaint }}>No cast or crew information available.</Typography>
      )}
    </Box>
  );
}

// ─── Tab: Gallery (Videos + Images) ──────────────────────────────────────────

function GalleryTab({ record }) {
  const T = useT();
  const tmdb = record?.tmdb ?? {};
  const videos = tmdb.videos ?? [];
  const allImages = tmdb.images ?? [];

  const [activeVideo, setActiveVideo] = useState(null);
  const [lightbox, setLightbox] = useState(null); // { images, startIndex }
  const [showAllImages, setShowAllImages] = useState(false);

  const trailers    = videos.filter((v) => v.type === 'Trailer' || v.type === 'Teaser');
  const otherVideos = videos.filter((v) => v.type !== 'Trailer' && v.type !== 'Teaser');

  // Group images by type
  const imageGroups = allImages.reduce((acc, img) => {
    const type = img.imageType ?? 'Image';
    if (!acc[type]) acc[type] = [];
    acc[type].push(img);
    return acc;
  }, {});
  const imageGroupOrder = ['Backdrop', 'Poster', 'Still', 'Logo'];
  const sortedImageKeys = [
    ...imageGroupOrder.filter((k) => imageGroups[k]),
    ...Object.keys(imageGroups).filter((k) => !imageGroupOrder.includes(k)),
  ];

  const VISIBLE_IMAGES = 12;

  const renderVideoRow = (list, label) => {
    if (!list.length) return null;
    return (
      <Box sx={{ mb: 4 }}>
        <SectionHeading>{label}</SectionHeading>
        <Box sx={{ display: 'flex', gap: 2, overflowX: 'auto', pb: 1, scrollbarWidth: 'thin', scrollbarColor: `${alpha(T.text, 0.2)} transparent`, '&::-webkit-scrollbar': { height: 5 }, '&::-webkit-scrollbar-thumb': { background: alpha(T.text, 0.2), borderRadius: 3 } }}>
          {list.map((v, i) => {
            const isYT = v.site === 'YouTube';
            const thumb = isYT ? `https://img.youtube.com/vi/${v.key}/hqdefault.jpg` : null;
            return (
              <Box
                key={v.key ?? i}
                onClick={() => setActiveVideo(v)}
                sx={{
                  flexShrink: 0,
                  width: { xs: 220, md: 260 },
                  bgcolor: T.glass,
                  borderRadius: 2,
                  overflow: 'hidden',
                  border: `1px solid ${alpha(T.text, 0.07)}`,
                  cursor: 'pointer',
                  transition: 'transform 0.15s, box-shadow 0.15s',
                  '&:hover': { transform: 'translateY(-3px)', boxShadow: `0 8px 24px rgba(0,0,0,0.35)` },
                }}
              >
                <Box sx={{ position: 'relative', width: '100%', height: 140 }}>
                  {thumb ? (
                    <Box component="img" src={thumb} alt={v.name} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <Box sx={{ width: '100%', height: '100%', bgcolor: alpha(T.text, 0.06), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <PlayArrowIcon sx={{ fontSize: 48, color: alpha(T.text, 0.2) }} />
                    </Box>
                  )}
                  <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(0,0,0,0.3)' }}>
                    <Box sx={{ width: 44, height: 44, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
                      <PlayArrowIcon sx={{ color: '#fff', fontSize: 26 }} />
                    </Box>
                  </Box>
                </Box>
                <Box sx={{ p: 1.25 }}>
                  <Typography variant="body2" sx={{ color: T.text, fontWeight: 600, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', fontSize: '0.82rem' }}>
                    {v.name}
                  </Typography>
                  <Chip label={v.type} size="small" sx={{ mt: 0.75, bgcolor: alpha(T.teal, 0.12), color: T.teal, fontSize: '0.65rem', height: 18 }} />
                </Box>
              </Box>
            );
          })}
        </Box>
      </Box>
    );
  };

  return (
    <Box sx={{ py: 3 }}>
      {/* Videos */}
      {renderVideoRow(trailers, 'Trailers & Teasers')}
      {renderVideoRow(otherVideos, 'Other Videos')}
      {videos.length === 0 && (
        <Typography variant="body2" sx={{ color: T.textFaint, mb: 4 }}>No videos available.</Typography>
      )}

      {/* Images */}
      {sortedImageKeys.map((type) => {
        const imgs = imageGroups[type];
        const visible = showAllImages ? imgs : imgs.slice(0, VISIBLE_IMAGES);
        const isPortrait = type === 'Poster';
        return (
          <Box key={type} sx={{ mb: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
              <SectionHeading sx={{ mb: 0 }}>{type}s</SectionHeading>
              <Typography variant="caption" sx={{ color: T.textFaint }}>{imgs.length} images</Typography>
            </Box>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: isPortrait
                  ? { xs: 'repeat(3, 1fr)', sm: 'repeat(4, 1fr)', md: 'repeat(6, 1fr)' }
                  : { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', md: 'repeat(4, 1fr)' },
                gap: 1,
              }}
            >
              {visible.map((img, i) => (
                <LazyImage
                  key={i}
                  src={tmdbImg(img.filePath, 'w500')}
                  alt={type}
                  onClick={() => setLightbox({ images: imgs, startIndex: i })}
                  sx={{
                    borderRadius: 1.5,
                    aspectRatio: isPortrait ? '2/3' : '16/9',
                    border: `1px solid ${alpha(T.text, 0.07)}`,
                    transition: 'transform 0.15s',
                    '&:hover': { transform: 'scale(1.02)', zIndex: 1 },
                  }}
                />
              ))}
            </Box>
            {imgs.length > VISIBLE_IMAGES && (
              <Button
                size="small"
                onClick={() => setShowAllImages((v) => !v)}
                sx={{ mt: 1.5, color: T.teal, textTransform: 'none', fontSize: '0.82rem' }}
              >
                {showAllImages ? 'Show less' : `Show all ${imgs.length} images`}
              </Button>
            )}
          </Box>
        );
      })}

      {allImages.length === 0 && videos.length === 0 && (
        <Typography variant="body2" sx={{ color: T.textFaint }}>No gallery content available.</Typography>
      )}

      {activeVideo && <VideoDialog video={activeVideo} onClose={() => setActiveVideo(null)} />}
      {lightbox && (
        <ImageLightbox
          images={lightbox.images}
          startIndex={lightbox.startIndex}
          onClose={() => setLightbox(null)}
        />
      )}
    </Box>
  );
}

// ─── Tab: Seasons ─────────────────────────────────────────────────────────────

function SeasonsTab({ record }) {
  const T = useT();
  const tmdb = record?.tmdb ?? {};
  const seasons = tmdb.seasons ?? [];
  const [openSeason, setOpenSeason] = useState(null);

  if (seasons.length === 0) {
    return (
      <Box sx={{ py: 3 }}>
        <Typography variant="body2" sx={{ color: T.textFaint }}>No season information available.</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ py: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <SectionHeading sx={{ mb: 0 }}>{seasons.length} Seasons</SectionHeading>
        {tmdb.firstAirDate && (
          <Typography variant="body2" sx={{ color: T.textFaint }}>
            {tmdb.firstAirDate?.slice(0, 4)}
            {tmdb.lastAirDate && tmdb.lastAirDate.slice(0, 4) !== tmdb.firstAirDate.slice(0, 4)
              ? `–${tmdb.lastAirDate.slice(0, 4)}`
              : ''}
          </Typography>
        )}
      </Box>

      {seasons.map((season, si) => {
        const isOpen = openSeason === si;
        const posterUrl = tmdbImg(season.posterPath, 'w185');
        return (
          <Accordion
            key={si}
            expanded={isOpen}
            onChange={() => setOpenSeason(isOpen ? null : si)}
            disableGutters
            elevation={0}
            sx={{
              bgcolor: T.glass,
              border: `1px solid ${isOpen ? alpha(T.teal, 0.35) : alpha(T.text, 0.07)}`,
              borderRadius: '10px !important',
              mb: 1.5,
              '&:before': { display: 'none' },
              transition: 'border-color 0.2s',
            }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon sx={{ color: T.textFaint }} />}
              sx={{ px: 2, py: 0.5, '& .MuiAccordionSummary-content': { my: 1 } }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1, flexWrap: 'wrap', minWidth: 0 }}>
                {posterUrl && (
                  <Box component="img" src={posterUrl} alt={season.name} sx={{ width: 48, height: 72, objectFit: 'cover', borderRadius: 1, flexShrink: 0, display: { xs: 'none', sm: 'block' } }} />
                )}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body1" sx={{ color: T.text, fontWeight: 700 }}>
                    Season {season.seasonNumber}
                    {season.name && season.name !== `Season ${season.seasonNumber}` && (
                      <Typography component="span" variant="body2" sx={{ color: T.textMuted, ml: 1, fontWeight: 400 }}>— {season.name}</Typography>
                    )}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', mt: 0.25, flexWrap: 'wrap' }}>
                    {season.episodeCount != null && (
                      <Chip label={`${season.episodeCount} eps`} size="small" sx={{ bgcolor: alpha(T.text, 0.08), color: T.textFaint, fontSize: '0.65rem', height: 18 }} />
                    )}
                    {season.airDate && (
                      <Typography variant="caption" sx={{ color: T.textFaint }}>{formatDate(season.airDate)}</Typography>
                    )}
                    {season.voteAverage != null && season.voteAverage > 0 && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
                        <StarIcon sx={{ fontSize: 12, color: '#ff9800' }} />
                        <Typography variant="caption" sx={{ color: T.textFaint }}>{Math.round(season.voteAverage * 10) / 10}</Typography>
                      </Box>
                    )}
                  </Box>
                </Box>
              </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ px: 2, pt: 0, pb: 2 }}>
              {season.overview && (
                <Typography variant="body2" sx={{ color: T.textMuted, mb: 2, lineHeight: 1.7 }}>{season.overview}</Typography>
              )}
              {(season.episodes ?? []).length > 0 ? (
                <Box>
                  {season.episodes.map((ep, ei) => (
                    <Box
                      key={ei}
                      sx={{
                        display: 'flex',
                        gap: 2,
                        py: 1,
                        borderBottom: `1px solid ${alpha(T.text, 0.05)}`,
                        '&:last-child': { borderBottom: 'none' },
                        flexWrap: { xs: 'wrap', sm: 'nowrap' },
                        alignItems: 'flex-start',
                      }}
                    >
                      {ep.stillPath && (
                        <Box
                          component="img"
                          src={tmdbImg(ep.stillPath, 'w185')}
                          alt={ep.name}
                          loading="lazy"
                          sx={{ width: 90, height: 52, objectFit: 'cover', borderRadius: 1, flexShrink: 0, display: { xs: 'none', sm: 'block' } }}
                        />
                      )}
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.25 }}>
                          <Typography variant="body2" sx={{ color: T.teal, fontWeight: 700, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                            E{String(ep.episodeNumber).padStart(2, '0')}
                          </Typography>
                          <Typography variant="body2" sx={{ color: T.text, fontWeight: 500 }}>{ep.name}</Typography>
                        </Box>
                        {ep.overview && (
                          <Typography variant="caption" sx={{ color: T.textFaint, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {ep.overview}
                          </Typography>
                        )}
                      </Box>
                      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexShrink: 0 }}>
                        {ep.airDate && <Typography variant="caption" sx={{ color: T.textFaint }}>{formatDate(ep.airDate)}</Typography>}
                        {ep.runtime != null && <Typography variant="caption" sx={{ color: T.textFaint }}>{formatRuntime(ep.runtime)}</Typography>}
                      </Box>
                    </Box>
                  ))}
                </Box>
              ) : (
                <Typography variant="body2" sx={{ color: T.textFaint }}>No episode data available.</Typography>
              )}
            </AccordionDetails>
          </Accordion>
        );
      })}
    </Box>
  );
}

// ─── Review cards ─────────────────────────────────────────────────────────────

function UserReviewCard({ review, T }) {
  const initials = (review.username ?? '?').slice(0, 2).toUpperCase();
  return (
    <Paper sx={{ bgcolor: T.glass, border: `1px solid ${alpha(T.text, 0.07)}`, borderRadius: 2, p: 2, mb: 1.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.25 }}>
        <Avatar sx={{ width: 36, height: 36, bgcolor: alpha(T.teal, 0.3), fontSize: '0.8rem', fontWeight: 700, color: T.teal }}>
          {initials}
        </Avatar>
        <Box sx={{ flex: 1 }}>
          <Typography variant="body2" sx={{ color: T.text, fontWeight: 600 }}>{review.username}</Typography>
          {review.createdAt && <Typography variant="caption" sx={{ color: T.textFaint }}>{formatDate(review.createdAt)}</Typography>}
        </Box>
        {review.rating != null && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Rating value={review.rating / 2} precision={0.5} readOnly size="small" sx={{ color: '#ff9800' }} />
            <Typography variant="caption" sx={{ color: T.textMuted }}>{review.rating}/10</Typography>
          </Box>
        )}
      </Box>
      {review.content && (
        <Typography variant="body2" sx={{ color: T.textMuted, lineHeight: 1.7 }}>{review.content}</Typography>
      )}
    </Paper>
  );
}

function TmdbReviewCard({ review, T }) {
  const [expanded, setExpanded] = useState(false);
  const content = review.content ?? '';
  const isLong = content.length > 400;

  return (
    <Paper sx={{ bgcolor: T.glass, border: `1px solid ${alpha(T.text, 0.07)}`, borderRadius: 2, p: 2, mb: 1.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.25 }}>
        <Avatar sx={{ width: 36, height: 36, bgcolor: alpha(T.text, 0.08), fontSize: '0.8rem', color: T.textMuted }}>
          {(review.author ?? '?').slice(0, 2).toUpperCase()}
        </Avatar>
        <Box sx={{ flex: 1 }}>
          <Typography variant="body2" sx={{ color: T.text, fontWeight: 600 }}>{review.author}</Typography>
          {review.authorDetails?.username && review.authorDetails.username !== review.author && (
            <Typography variant="caption" sx={{ color: T.textFaint }}>@{review.authorDetails.username}</Typography>
          )}
        </Box>
        {review.authorDetails?.rating != null && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Rating value={review.authorDetails.rating / 2} precision={0.5} readOnly size="small" sx={{ color: '#ff9800' }} />
            <Typography variant="caption" sx={{ color: T.textMuted }}>{review.authorDetails.rating}/10</Typography>
          </Box>
        )}
      </Box>
      <Typography
        variant="body2"
        sx={{ color: T.textMuted, lineHeight: 1.7, ...(!expanded && isLong ? { display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' } : {}) }}
      >
        {content}
      </Typography>
      {isLong && (
        <Button size="small" onClick={() => setExpanded((v) => !v)} sx={{ color: T.teal, mt: 0.5, p: 0, minWidth: 0, textTransform: 'none', fontSize: '0.78rem' }}>
          {expanded ? 'Show less' : 'Show more'}
        </Button>
      )}
    </Paper>
  );
}

// ─── Tab: Reviews ─────────────────────────────────────────────────────────────

function ReviewsTab({ record, recordId }) {
  const T = useT();
  const { enqueueSnackbar } = useSnackbar();
  const qc = useQueryClient();

  const [reviewRating, setReviewRating] = useState(0);
  const [reviewContent, setReviewContent] = useState('');
  const [editMode, setEditMode] = useState(false);

  const { data: userReviews = [], isLoading: reviewsLoading } = useQuery({
    queryKey: ['userReviews', recordId],
    queryFn: () => fetchUserReviews(recordId),
    staleTime: 2 * 60 * 1000,
  });

  const { data: myReview } = useQuery({
    queryKey: ['myReview', recordId],
    queryFn: () => fetchMyReview(recordId),
    staleTime: 2 * 60 * 1000,
  });

  const upsertMutation = useMutation({
    mutationFn: ({ rating, content }) => upsertReview(recordId, rating, content),
    onSuccess: () => {
      enqueueSnackbar('Review submitted.', { variant: 'success' });
      qc.invalidateQueries(['userReviews', recordId]);
      qc.invalidateQueries(['myReview', recordId]);
      setReviewContent(''); setReviewRating(0); setEditMode(false);
    },
    onError: () => enqueueSnackbar('Failed to submit review.', { variant: 'error' }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteReview(recordId),
    onSuccess: () => {
      enqueueSnackbar('Review deleted.', { variant: 'success' });
      qc.invalidateQueries(['userReviews', recordId]);
      qc.invalidateQueries(['myReview', recordId]);
    },
    onError: () => enqueueSnackbar('Failed to delete review.', { variant: 'error' }),
  });

  const handleSubmit = () => {
    if (!reviewRating) { enqueueSnackbar('Please select a rating.', { variant: 'warning' }); return; }
    upsertMutation.mutate({ rating: reviewRating, content: reviewContent });
  };

  const handleEdit = () => {
    setReviewRating(myReview?.rating ?? 0);
    setReviewContent(myReview?.content ?? '');
    setEditMode(true);
  };

  const tmdbReviews = record?.tmdb?.reviews ?? [];
  const otherReviews = userReviews.filter((r) => r.id !== myReview?.id);

  const fieldSx = {
    '& .MuiOutlinedInput-root': {
      bgcolor: T.inputBg ?? alpha(T.text, 0.04),
      color: T.text,
      '& fieldset': { borderColor: alpha(T.text, 0.15) },
      '&:hover fieldset': { borderColor: alpha(T.text, 0.3) },
      '&.Mui-focused fieldset': { borderColor: T.teal },
    },
    '& .MuiInputBase-input::placeholder': { color: T.textFaint },
  };

  return (
    <Box sx={{ py: 3 }}>
      <SectionHeading>Your Review</SectionHeading>

      {myReview && !editMode ? (
        <Paper sx={{ bgcolor: T.glass, border: `1px solid ${alpha(T.teal, 0.3)}`, borderRadius: 2, p: 2, mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Rating value={myReview.rating / 2} precision={0.5} readOnly size="small" sx={{ color: '#ff9800' }} />
              <Typography variant="body2" sx={{ color: T.textMuted }}>{myReview.rating}/10</Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <Tooltip title="Edit">
                <IconButton size="small" onClick={handleEdit} sx={{ color: T.teal }}><EditIcon sx={{ fontSize: 18 }} /></IconButton>
              </Tooltip>
              <Tooltip title="Delete">
                <IconButton size="small" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending} sx={{ color: '#f44336' }}>
                  {deleteMutation.isPending ? <CircularProgress size={16} color="inherit" /> : <DeleteIcon sx={{ fontSize: 18 }} />}
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
          {myReview.content && <Typography variant="body2" sx={{ color: T.textMuted, lineHeight: 1.7 }}>{myReview.content}</Typography>}
        </Paper>
      ) : (
        <Paper sx={{ bgcolor: T.glass, border: `1px solid ${alpha(T.text, 0.1)}`, borderRadius: 2, p: 2, mb: 3 }}>
          <Typography variant="body2" sx={{ color: T.textMuted, mb: 1.5 }}>{editMode ? 'Update your review' : 'Write a review'}</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Typography variant="body2" sx={{ color: T.textFaint, minWidth: 60 }}>Rating</Typography>
            <Rating value={reviewRating / 2} precision={0.5} onChange={(_, val) => setReviewRating(Math.round((val ?? 0) * 2))} sx={{ color: '#ff9800' }} />
            <Typography variant="body2" sx={{ color: T.textMuted }}>{reviewRating > 0 ? `${reviewRating}/10` : ''}</Typography>
          </Box>
          <TextField
            fullWidth multiline rows={3}
            placeholder="Share your thoughts (optional)"
            value={reviewContent}
            onChange={(e) => setReviewContent(e.target.value)}
            sx={{ mb: 2, ...fieldSx }}
          />
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={upsertMutation.isPending}
              startIcon={upsertMutation.isPending ? <CircularProgress size={16} color="inherit" /> : null}
              sx={{ bgcolor: T.teal, '&:hover': { bgcolor: T.tealHover ?? '#0f766e' }, textTransform: 'none', fontWeight: 600 }}
            >
              {editMode ? 'Update' : 'Submit'}
            </Button>
            {editMode && (
              <Button variant="text" onClick={() => { setEditMode(false); setReviewContent(''); setReviewRating(0); }} sx={{ color: T.textFaint, textTransform: 'none' }}>
                Cancel
              </Button>
            )}
          </Box>
        </Paper>
      )}

      {reviewsLoading ? (
        <CircularProgress size={24} sx={{ color: T.teal, display: 'block', mb: 3 }} />
      ) : otherReviews.length > 0 ? (
        <>
          <SectionHeading>All Reviews ({otherReviews.length})</SectionHeading>
          {otherReviews.map((r) => <UserReviewCard key={r.id} review={r} T={T} />)}
        </>
      ) : null}

      {tmdbReviews.length > 0 && (
        <>
          <Divider sx={{ borderColor: alpha(T.text, 0.08), my: 3 }} />
          <SectionHeading>TMDB Reviews ({tmdbReviews.length})</SectionHeading>
          {tmdbReviews.map((r, i) => <TmdbReviewCard key={i} review={r} T={T} />)}
        </>
      )}
    </Box>
  );
}

// ─── Tab: Watch (Media Files) ─────────────────────────────────────────────────

function CopyBtn({ url }) {
  const [copied, setCopied] = useState(false);
  const handle = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
  };
  return (
    <Tooltip title={copied ? 'Copied!' : 'Copy URL'}>
      <IconButton size="small" onClick={handle} disabled={!url} sx={{ border: `1px solid ${alpha('#fff', copied ? 0.4 : 0.15)}`, borderRadius: 1.5, p: 0.6, color: copied ? '#4caf50' : 'inherit' }}>
        {copied ? <CheckIcon sx={{ fontSize: 15 }} /> : <ContentCopyIcon sx={{ fontSize: 15 }} />}
      </IconButton>
    </Tooltip>
  );
}

function FileCard({ mediaInfo, allFiles, record }) {
  const T = useT();
  const { enqueueSnackbar } = useSnackbar();
  const [playerOpen, setPlayerOpen] = useState(false);
  const { general, video, audio, subtitle } = mediaInfo;
  const quality = getQuality(video, general?.fileName);
  const codec   = getCodec(video?.format);
  const qMeta   = QUALITY_META[quality] ?? QUALITY_META['Unknown'];
  const cMeta   = codec && CODEC_META[codec];

  const handlePlay = () => {
    if (Capacitor.getPlatform() === 'android') {
      AndroidPlugins.launchNativePlayer({
        url: mediaInfo.streamUrl,
        title: record?.tmdb?.title || record?.title || general?.fileName || '',
        fileName: general?.fileName || '',
        fileId: String(mediaInfo.id || ''),
        preferredAudio: 'Hindi',
        preferredSub: null,
      });
    } else {
      setPlayerOpen(true);
    }
  };

  const handleDownload = async () => {
    if (Capacitor.getPlatform() === 'android') {
      try {
        await DbWorldDownload.startDownload({
          url: mediaInfo.downloadUrl,
          fileName: general?.fileName || 'download',
        });
        enqueueSnackbar(`Added to downloads: ${general?.fileName || 'file'}`, {
          variant: 'success', autoHideDuration: 3000,
        });
      } catch (e) {
        console.error('Download failed', e);
        enqueueSnackbar('Failed to start download', { variant: 'error' });
      }
    } else {
      CommonServices.handleDownload(mediaInfo.downloadUrl, { fileName: general?.fileName, openInNewTab: true });
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
          transition: 'border-color 0.2s',
          '&:hover': { borderColor: alpha(T.teal, 0.4) },
        }}
      >
        <Box sx={{ p: { xs: 1.5, sm: 2 } }}>
          {/* Filename */}
          <Typography variant="body2" sx={{ color: T.text, fontWeight: 600, wordBreak: 'break-all', lineHeight: 1.4, mb: 1, fontSize: '0.85rem' }}>
            {general?.fileName ?? 'Unknown file'}
          </Typography>

          {/* Badges */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.6, mb: 1.5 }}>
            <Box sx={{ display: 'inline-flex', alignItems: 'center', px: 1, py: 0.25, borderRadius: 1, bgcolor: qMeta.color, color: '#fff', fontSize: '0.7rem', fontWeight: 800 }}>
              {qMeta.label}
            </Box>
            {codec && (
              <Box sx={{ display: 'inline-flex', px: 0.8, py: 0.25, borderRadius: 1, bgcolor: cMeta ? alpha(cMeta.color, 0.15) : alpha(T.text, 0.08), color: cMeta?.color ?? T.textMuted, border: `1px solid ${cMeta ? alpha(cMeta.color, 0.35) : alpha(T.text, 0.12)}`, fontSize: '0.65rem', fontWeight: 700 }}>
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

          {/* Stats grid */}
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 0.75, mb: 1.5 }}>
            {video?.resolution  && <StatItem label="Resolution" value={video.resolution} />}
            {video?.frameRate   && <StatItem label="Frame Rate" value={`${video.frameRate} fps`} />}
            {video?.bitRate     && <StatItem label="Video Bitrate" value={formatBitrate(video.bitRate)} />}
            {general?.duration  && <StatItem label="Duration" value={CommonServices.formatDuration(general.duration)} />}
            {general?.fileSize  && <StatItem label="File Size" value={general.fileSize} />}
          </Box>

          {/* Audio */}
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

          {/* Subtitles */}
          {subtitle?.length > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
              <SubtitlesIcon sx={{ fontSize: 13, color: T.textFaint }} />
              <Typography sx={{ fontSize: '0.72rem', color: T.textFaint }}>
                {subtitle.length} subtitle{subtitle.length > 1 ? 's' : ''}
                {': '}{subtitle.slice(0, 4).map(s => s.language).filter(Boolean).join(', ')}{subtitle.length > 4 ? '…' : ''}
              </Typography>
            </Box>
          )}

          {/* Actions */}
          <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <Button
              size="small" variant="contained" startIcon={<PlayArrowIcon />}
              onClick={handlePlay}
              sx={{ bgcolor: '#fff', color: '#000', fontWeight: 700, fontSize: '0.78rem', textTransform: 'none', px: 1.8, py: 0.7, borderRadius: 1.5, '&:hover': { bgcolor: '#e0e0e0' } }}
            >
              Play
            </Button>
            <CopyBtn url={mediaInfo.streamUrl} />

            <Box sx={{ width: 1, height: 20, bgcolor: alpha(T.text, 0.15), mx: 0.25 }} />

            <Button
              size="small" variant="outlined" startIcon={<DownloadIcon />}
              onClick={handleDownload}
              sx={{ fontSize: '0.78rem', textTransform: 'none', px: 1.8, py: 0.7, borderRadius: 1.5 }}
            >
              Download
            </Button>
            <CopyBtn url={mediaInfo.downloadUrl} />
          </Box>
        </Box>
      </Paper>

      <CinemaPlayer
        open={playerOpen}
        onClose={() => setPlayerOpen(false)}
        mediaInfo={mediaInfo}
        allFiles={allFiles}
        record={record}
      />
    </>
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
          cursor: 'pointer',
          userSelect: 'none',
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

function WatchTab({ recordId, record }) {
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
          const converted = CommonServices.convertMediaInfoToCustomFormat(null, res.data ?? res);
          // setFiles(converted);
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

  console.log('sorted : ', sortedQualities);

  if (loading) {
    return (
      <Box sx={{ py: 3 }}>
        {[1, 2].map(i => <Skeleton key={i} variant="rectangular" width="100%" height={120} sx={{ bgcolor: alpha(T.text, 0.07), mb: 1.5, borderRadius: 2 }} />)}
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
    <Box sx={{ py: 3 }}>
      <SectionHeading sx={{ mb: 2.5 }}>
        {files.length} File{files.length !== 1 ? 's' : ''} Available
      </SectionHeading>
      {sortedQualities.map(q => (
        <QualityGroup key={q} quality={q} files={grouped[q]} allFiles={files} record={record} />
      ))}
    </Box>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RecordDetailPage() {
  const { title } = useParams();
  const id = title?.split('-')[0];
  const navigate = useNavigate();
  const location = useLocation();
  const { enqueueSnackbar } = useSnackbar();
  const qc = useQueryClient();
  const T = useT();
  const theme = useTheme();

  const [activeTab, setActiveTab] = useState(0);
  const [interactionState, setInteractionState] = useState(null);
  const [trailerVideo, setTrailerVideo] = useState(null);

  const userId = getUserId();

  // Fetch record
  const {
    data: record,
    isLoading: recordLoading,
    isError: recordError,
    error: recordErrorObj,
  } = useQuery({
    queryKey: ['cinema-record', id],
    queryFn: () => fetchRecord(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
    retry: (count, err) => err?.response?.status !== 401 && err?.response?.status !== 404 && count < 2,
  });

  // Fetch interaction
  const { data: interaction } = useQuery({
    queryKey: ['cinema-interaction', userId, id],
    queryFn: () => fetchInteraction(userId, id),
    enabled: !!userId && !!id,
    staleTime: 2 * 60 * 1000,
  });

  React.useEffect(() => {
    if (interaction) setInteractionState(interaction);
  }, [interaction]);

  React.useEffect(() => {
    if (!recordError) return;
    const status = recordErrorObj?.response?.status;
    if (status === 401) navigate(Constants.LOGIN_ROUTE, { state: { from: location } });
    else if (status === 404) navigate(Constants.DB_CINEMA_BROWSE_ROUTE);
    else enqueueSnackbar('Failed to load record.', { variant: 'error' });
  }, [recordError, recordErrorObj, navigate, location, enqueueSnackbar]);

  React.useEffect(() => {
    if (!recordLoading && !recordError && record === null) navigate(Constants.DB_CINEMA_BROWSE_ROUTE);
  }, [record, recordLoading, recordError, navigate]);

  const toggleMutation = useMutation({
    mutationFn: async ({ key, active, add, remove }) => active ? remove(id) : add(id),
    onMutate: ({ key, active }) => setInteractionState((prev) => ({ ...prev, [key]: !active })),
    onSuccess: () => qc.invalidateQueries(['cinema-interaction', userId, id]),
    onError: (err, { key, active }) => {
      setInteractionState((prev) => ({ ...prev, [key]: active }));
      if (err?.response?.status === 401) navigate(Constants.LOGIN_ROUTE, { state: { from: location } });
      else enqueueSnackbar('Action failed. Please try again.', { variant: 'error' });
    },
  });

  const actionMap = {
    watchlisted: { add: addWatchlist, remove: removeWatchlist },
    liked:       { add: addLike,      remove: removeLike      },
    loved:       { add: addLove,      remove: removeLove      },
    watched:     { add: addWatched,   remove: removeWatched   },
  };

  const handleToggle = useCallback((key, active) => {
    if (!userId) { navigate(Constants.LOGIN_ROUTE, { state: { from: location } }); return; }
    const { add, remove } = actionMap[key];
    toggleMutation.mutate({ key, active, add, remove });
  }, [userId, toggleMutation, navigate, location]);

  const isTv = record?.type === 'TV_SERIES';

  // ── Dynamic page meta (for sharing) ─────────────────────────────────────
  React.useEffect(() => {
    if (!record) return;
    const tmdb = record.tmdb ?? {};
    const isMovie = record.type === 'MOVIE';
    const year = isMovie ? tmdb.releaseDate?.slice(0, 4) : tmdb.firstAirDate?.slice(0, 4);
    const title = [tmdb.title, year].filter(Boolean).join(' (') + (year ? ')' : '');
    const description = tmdb.overview || `Watch ${tmdb.title} on DB Cinema`;
    const image = tmdb.backdropPath
      ? `https://image.tmdb.org/t/p/w1280${tmdb.backdropPath}`
      : tmdb.posterPath
        ? `https://image.tmdb.org/t/p/w500${tmdb.posterPath}`
        : '';

    document.title = `${title} — DB Cinema`;

    const setMeta = (attr, value, content) => {
      let el = document.querySelector(`meta[${attr}="${value}"]`);
      if (!el) { el = document.createElement('meta'); el.setAttribute(attr, value); document.head.appendChild(el); }
      el.setAttribute('content', content);
    };

    setMeta('name', 'description', description);
    setMeta('property', 'og:title', title);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:image', image);
    setMeta('property', 'og:url', window.location.href);
    setMeta('property', 'og:type', isMovie ? 'video.movie' : 'video.tv_show');
    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', title);
    setMeta('name', 'twitter:description', description);
    setMeta('name', 'twitter:image', image);

    return () => { document.title = 'DB Cinema'; };
  }, [record]);

  // First trailer for play button
  const firstTrailer = React.useMemo(() => {
    const videos = record?.tmdb?.videos ?? [];
    return videos.find((v) => (v.type === 'Trailer' || v.type === 'Teaser') && v.site === 'YouTube') ?? null;
  }, [record]);

  const tabs = [
    'Overview',
    'Cast & Crew',
    'Gallery',
    ...(isTv ? ['Seasons'] : []),
    'Reviews',
    'Watch',
  ];

  const watchTabIdx = tabs.indexOf('Watch');

  // Tab bar: always opaque T.bg so content below never shows through
  const tabBg   = T.bg;
  const tabBord = T.border;

  if (recordLoading) {
    return (
      <Box sx={{ bgcolor: T.bg, minHeight: '100vh' }}>
        <Skeleton variant="rectangular" width="100%" height={500} sx={{ bgcolor: alpha(T.text, 0.07) }} />
        <Container maxWidth="lg" sx={{ py: 4 }}>
          <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} variant="rounded" width={90} height={32} sx={{ bgcolor: alpha(T.text, 0.07) }} />
            ))}
          </Box>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} variant="rectangular" width="100%" height={80} sx={{ bgcolor: alpha(T.text, 0.05), mb: 2, borderRadius: 1.5 }} />
          ))}
        </Container>
      </Box>
    );
  }

  if (recordError || !record) {
    return (
      <Box sx={{ bgcolor: T.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
        <Alert
          severity="error"
          action={<Button color="inherit" size="small" onClick={() => navigate(Constants.DB_CINEMA_BROWSE_ROUTE)}>Browse</Button>}
        >
          Record not found or unavailable.
        </Alert>
      </Box>
    );
  }

  const currentInteraction = interactionState ?? interaction;

  return (
    <Box sx={{ bgcolor: T.bg, minHeight: '100vh' }}>
      {/* Hero */}
      <Hero
        record={record}
        interaction={currentInteraction}
        onToggle={handleToggle}
        interactionLoading={toggleMutation.isPending}
        onPlayTrailer={firstTrailer ? () => setTrailerVideo(firstTrailer) : null}
        onWatchClick={() => setActiveTab(watchTabIdx)}
      />

      {/* Tab Bar */}
      <Box sx={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        bgcolor: tabBg,
        borderBottom: `2px solid ${T.teal}`,
        boxShadow: `0 2px 16px ${alpha(T.text, 0.12)}`,
      }}>
        <Container maxWidth="lg" sx={{ px: { xs: 1, md: 3 } }}>
          <Tabs
            value={activeTab}
            onChange={(_, v) => setActiveTab(v)}
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
            sx={{
              minHeight: 48,
              '& .MuiTab-root': {
                color: T.textFaint,
                textTransform: 'none',
                fontWeight: 600,
                fontSize: { xs: '0.82rem', md: '0.9rem' },
                minHeight: 48,
                px: { xs: 1.5, md: 2.5 },
                borderRadius: 1,
                my: 0.5,
                transition: 'background 0.15s, color 0.15s',
                '&.Mui-selected': {
                  color: T.teal,
                  bgcolor: alpha(T.teal, 0.1),
                },
                '&:hover': { color: T.text, bgcolor: alpha(T.text, 0.05) },
              },
              '& .MuiTabs-indicator': { display: 'none' },
            }}
          >
            {tabs.map((t, i) => <Tab key={t} label={t} value={i} />)}
          </Tabs>
        </Container>
      </Box>

      {/* Tab Content */}
      <Container maxWidth="lg" sx={{ px: { xs: 2, md: 3 } }}>
        {tabs[activeTab] === 'Overview'   && <OverviewTab record={record} />}
        {tabs[activeTab] === 'Cast & Crew'&& <CastCrewTab record={record} />}
        {tabs[activeTab] === 'Gallery'    && <GalleryTab record={record} />}
        {tabs[activeTab] === 'Seasons'    && <SeasonsTab record={record} />}
        {tabs[activeTab] === 'Reviews'    && <ReviewsTab record={record} recordId={id} />}
        {tabs[activeTab] === 'Watch'      && <MediaDownloadViewer recordId={id} record={record} showBack={false} showHeroSection={false} />}
      </Container>

      {/* Trailer dialog */}
      {trailerVideo && <VideoDialog video={trailerVideo} onClose={() => setTrailerVideo(null)} />}
    </Box>
  );
}
