import React, { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Box, Typography, IconButton, Chip, Skeleton, Tooltip,
  useMediaQuery, useTheme,
} from '@mui/material';
import {
  PlayArrow, Check, ThumbUp, ThumbUpOutlined,
  Favorite, FavoriteBorder,
  Visibility, VisibilityOff,
  BookmarkAdd, BookmarkAdded,
  Info, Star, VolumeOff, VolumeUp,
} from '@mui/icons-material';
import { tmdbImg } from '../../api/cinemaApi';
import Constants from '@shared/constants';

// ─── helpers ─────────────────────────────────────────────────────────────────

const year = (d) => (d ? String(d).slice(0, 4) : '');

const POPUP_W = 450; // wider popup

// ─── Skeleton ────────────────────────────────────────────────────────────────

export const RecordCardSkeleton = ({ wide, top10, prime }) => (
  <Box sx={{
    flexShrink: 0,
    pl: top10 ? { xs: 3, md: 4 } : 0,
    width: prime ? { xs: 285, md: 390 } : wide ? { xs: 200, md: 280 } : { xs: 110, md: 150 },
    ...(prime
      ? { height: { xs: 160, md: 220 } }
      : { aspectRatio: wide ? '16/9' : '2/3' }),
    borderRadius: 1.5,
    overflow: 'hidden',
    bgcolor: 'rgba(255,255,255,.06)',
  }}>
    <Skeleton variant="rectangular" width="100%" height="100%" sx={{ bgcolor: 'rgba(255,255,255,.06)' }} />
  </Box>
);

// ─── Interaction action buttons ───────────────────────────────────────────────

const ActionBtn = ({ icon, activeIcon, active, tooltip, onClick, variant = 'outline' }) => (
  <Tooltip title={tooltip} PopperProps={{ style: { zIndex: 10001 } }}>
    <IconButton
      size="small"
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      sx={
        variant === 'filled'
          ? { bgcolor: '#fff', color: '#000', p: 0.8, '&:hover': { bgcolor: 'rgba(255,255,255,.85)' } }
          : {
              border: `1.5px solid ${active ? 'rgba(255,255,255,.9)' : 'rgba(255,255,255,.45)'}`,
              color: active ? '#fff' : 'rgba(255,255,255,.8)',
              bgcolor: active ? 'rgba(255,255,255,.12)' : 'transparent',
              p: 0.7,
              transition: 'all 0.15s',
              '&:hover': { borderColor: '#fff', bgcolor: 'rgba(255,255,255,.1)' },
            }
      }
    >
      {active ? activeIcon : icon}
    </IconButton>
  </Tooltip>
);

// ─── Netflix hover popup (portal) ────────────────────────────────────────────

const fmtRuntime = (mins) => {
  if (!mins || mins <= 0) return null;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m > 0 ? `${m}m` : ''}`.trim() : `${m}m`;
};

const HoverPopup = ({ record, interaction = {}, onWatchlist, onLike, onLove, onWatched, anchorRect, onClose }) => {
  const navigate = useNavigate();
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [muted, setMuted] = useState(true);
  const isMovie = record.type === 'MOVIE';
  const iframeRef = useRef(null);

  const videoSrc = record.previewVideoUrl
    ? `${record.previewVideoUrl}&autoplay=1&mute=0&controls=0&modestbranding=1&rel=0&iv_load_policy=3&fs=0&disablekb=1&playsinline=1&loop=1&enablejsapi=1&vq=hd1080`
    : null;

  const POPUP_VIDEO_H = Math.round(POPUP_W * 9 / 16);
  const popupH = POPUP_VIDEO_H + (record.overview ? 290 : 210);
  const left = Math.max(8, Math.min(
    anchorRect.left + anchorRect.width / 2 - POPUP_W / 2,
    window.innerWidth - POPUP_W - 8
  ));
  const top = Math.max(8, Math.min(
    anchorRect.top + anchorRect.height / 2 - popupH / 2,
    window.innerHeight - popupH - 8
  ));

    const toggleMute = (e) => {
        e.stopPropagation();

        if (!iframeRef.current) return;

        const command = muted ? 'unMute' : 'mute';

        iframeRef.current.contentWindow.postMessage(
            JSON.stringify({
                event: 'command',
                func: command,
                args: []
            }),
            '*'
        );

        setMuted(prev => !prev);
    };

  const goDetail = (e) => {
    e?.stopPropagation();
    const base = isMovie ? Constants.DB_MOVIE_DETIALS_ROUTE : Constants.DB_SERIES_DETIALS_ROUTE;
    navigate(base.replace(':title', `${record.id}-${(record.title ?? '').replace(/\s+/g, '-').toLowerCase()}`));
    onClose();
  };

  const goPlay = (e) => {
    e?.stopPropagation();
    const base = isMovie ? Constants.DB_MOVIE_DETIALS_ROUTE : Constants.DB_SERIES_DETIALS_ROUTE;
    navigate(
      base.replace(':title', `${record.id}-${(record.title ?? '').replace(/\s+/g, '-').toLowerCase()}`),
      { state: { defaultTab: 'Watch' } }
    );
    onClose();
  };

  return createPortal(
    <motion.div
      key="nfx-popup"
      initial={{ opacity: 0, scale: 0.88, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 4 }}
      transition={{ duration: 0.16, ease: 'easeOut' }}
      style={{
        position: 'fixed', top, left,
        width: POPUP_W, zIndex: 9999,
        borderRadius: 8, overflow: 'hidden',
        boxShadow: '0 28px 90px rgba(0,0,0,0.98)',
        background: '#181818',
        cursor: 'default',
      }}
      onMouseLeave={onClose}
    >
      {/* ── Video / Backdrop ── */}
      <Box sx={{ width: '100%', aspectRatio: '16/9', position: 'relative', bgcolor: '#000', overflow: 'hidden' }}>
        <Box
          component="img"
          src={tmdbImg(record.backdropPath ?? record.posterPath, 'w780')}
          alt={record.title}
          sx={{
            width: '100%', height: '100%', objectFit: 'cover',
            position: 'absolute', inset: 0,
            opacity: videoLoaded ? 0 : 1,
            transition: 'opacity 0.4s',
          }}
        />
        <Box sx={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to top, #181818 0%, transparent 60%)',
          opacity: videoLoaded ? 0 : 1,
          transition: 'opacity 0.4s',
        }} />
        {videoSrc && (
            <Box
                component="iframe"
                ref={iframeRef}
                src={videoSrc}
                allow="autoplay; encrypted-media; picture-in-picture"
                onLoad={() => setVideoLoaded(true)}
                sx={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    width: '120%',
                    height: '120%',
                    transform: 'translate(-50%, -50%) scale(1.2)', // 🔥 crop UI
                    border: 'none',
                    opacity: videoLoaded ? 1 : 0,
                    transition: 'opacity 0.4s',
                    pointerEvents: 'none' // 🔥 disable UI interaction
                }}
            />
        )}
          <Box
              sx={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  width: '100%',
                  height: '14%', // bottom mask
                  background: 'linear-gradient(to top, black, transparent)',
                  zIndex: 2
              }}
          />
        {/* Mute toggle */}
        {videoSrc && (
            <IconButton
                size="small"
                onClick={toggleMute}
                sx={{
                    position: 'absolute',
                    bottom: 8,
                    right: 8,
                    zIndex: 5,
                    bgcolor: 'rgba(0,0,0,0.55)',
                    color: '#fff',
                    border: '1.5px solid rgba(255,255,255,0.45)',
                    p: 0.5,
                    '&:hover': { bgcolor: 'rgba(0,0,0,0.8)' },
                }}
            >
                {muted ? <VolumeOff sx={{ fontSize: 14 }} /> : <VolumeUp sx={{ fontSize: 14 }} />}
            </IconButton>
        )}
      </Box>

      {/* ── Info ── */}
      <Box sx={{ px: 2, pt: 1.5, pb: 2, bgcolor: '#181818' }}>

        {/* ── Action row ── */}
        <Box sx={{ display: 'flex', gap: 0.8, mb: 1.2, alignItems: 'center' }}>
          <ActionBtn
            variant="filled"
            icon={<PlayArrow sx={{ fontSize: 20 }} />}
            activeIcon={<PlayArrow sx={{ fontSize: 20 }} />}
            tooltip="Play / Download"
            onClick={goPlay}
          />
          <ActionBtn
            icon={<BookmarkAdd sx={{ fontSize: 17 }} />}
            activeIcon={<BookmarkAdded sx={{ fontSize: 17, color: '#46d369' }} />}
            active={interaction.watchlisted}
            tooltip={interaction.watchlisted ? 'Remove from My List' : 'Add to My List'}
            onClick={() => onWatchlist?.(record)}
          />
          <ActionBtn
            icon={<ThumbUpOutlined sx={{ fontSize: 17 }} />}
            activeIcon={<ThumbUp sx={{ fontSize: 17, color: '#fff' }} />}
            active={interaction.liked}
            tooltip={interaction.liked ? 'Unlike' : 'Like'}
            onClick={() => onLike?.(record)}
          />
          <ActionBtn
            icon={<FavoriteBorder sx={{ fontSize: 17 }} />}
            activeIcon={<Favorite sx={{ fontSize: 17, color: '#fff' }} />}
            active={interaction.loved}
            tooltip={interaction.loved ? 'Remove from Favourites' : 'Love it'}
            onClick={() => onLove?.(record)}
          />
          <ActionBtn
            icon={<VisibilityOff sx={{ fontSize: 17 }} />}
            activeIcon={<Visibility sx={{ fontSize: 17, color: '#a5d6a7' }} />}
            active={interaction.watched}
            tooltip={interaction.watched ? 'Mark as Unwatched' : 'Mark as Watched'}
            onClick={() => onWatched?.(record)}
          />
          <Box sx={{ ml: 'auto' }}>
            <ActionBtn
              icon={<Info sx={{ fontSize: 17 }} />}
              activeIcon={<Info sx={{ fontSize: 17 }} />}
              tooltip="More Info"
              onClick={goDetail}
            />
          </Box>
        </Box>

        {/* Metadata row */}
        <Box sx={{ display: 'flex', gap: 1, mb: 0.9, flexWrap: 'wrap', alignItems: 'center' }}>
          {record.voteAverage > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
              <Star sx={{ fontSize: 12, color: '#46d369' }} />
              <Typography sx={{ color: '#46d369', fontSize: '0.78rem', fontWeight: 700 }}>
                {Number(record.voteAverage).toFixed(1)}
              </Typography>
            </Box>
          )}
          {year(record.releaseDate) && (
            <Typography sx={{ color: 'rgba(255,255,255,.55)', fontSize: '0.78rem' }}>
              {year(record.releaseDate)}
            </Typography>
          )}
          {isMovie && fmtRuntime(record.runtime) && (
            <Typography sx={{ color: 'rgba(255,255,255,.55)', fontSize: '0.78rem' }}>
              {fmtRuntime(record.runtime)}
            </Typography>
          )}
          {!isMovie && record.numberOfSeasons > 0 && (
            <Typography sx={{ color: 'rgba(255,255,255,.55)', fontSize: '0.78rem' }}>
              {record.numberOfSeasons === 1 ? '1 Season' : `${record.numberOfSeasons} Seasons`}
            </Typography>
          )}
          <Chip
            label={isMovie ? 'Movie' : 'Series'}
            size="small"
            sx={{
              height: 18, fontSize: '0.64rem', fontWeight: 700, color: '#fff',
              bgcolor: isMovie ? '#e50914' : '#0080ff',
              '& .MuiChip-label': { px: 0.8 },
            }}
          />
        </Box>

        {/* Title */}
        <Typography sx={{
          color: '#fff', fontWeight: 800, fontSize: '1rem',
          lineHeight: 1.3, mb: record.overview ? 0.8 : 0.6,
          display: '-webkit-box', WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {record.title}
        </Typography>

        {/* Overview */}
        {record.overview && (
          <Typography sx={{
            color: 'rgba(255,255,255,.6)', fontSize: '0.8rem',
            lineHeight: 1.55, mb: 0.9,
            display: '-webkit-box', WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {record.overview}
          </Typography>
        )}

        {/* Genres */}
        {record.genres?.length > 0 && (
          <Typography sx={{ color: 'rgba(255,255,255,.38)', fontSize: '0.72rem', mb: 0.7 }}>
            {record.genres.slice(0, 4).join(' · ')}
          </Typography>
        )}

        {/* Providers */}
        {record.providers?.length > 0 && (
          <Box sx={{ display: 'flex', gap: 0.7, flexWrap: 'wrap' }}>
            {record.providers.slice(0, 6).map(p =>
              p.logoPath && (
                <Box
                  key={p.providerId ?? p.providerName}
                  component="img"
                  src={tmdbImg(p.logoPath, 'w92')}
                  alt={p.providerName}
                  title={p.providerName}
                  sx={{ width: 26, height: 26, borderRadius: 1, objectFit: 'cover' }}
                />
              )
            )}
          </Box>
        )}
      </Box>
    </motion.div>,
    document.body
  );
};

// ─── RecordCard ───────────────────────────────────────────────────────────────

const RecordCard = ({
  record, wide = false, interaction = {},
  onWatchlist, onLike, onLove, onWatched,
  rank, expandOnHover = false,
}) => {
  const theme    = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();

  const [hovered,    setHovered]    = useState(false);
  const [imgError,   setImgError]   = useState(false);
  const [imgLoaded,  setImgLoaded]  = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [anchorRect, setAnchorRect] = useState(null);

  const cardRef    = useRef(null);
  const hoverTimer = useRef(null);
  const videoTimer = useRef(null);

  const isMovie = record?.type === 'MOVIE';

  // ── hover ─────────────────────────────────────────────────────────────────
  const onMouseEnter = useCallback(() => {
    if (isMobile) return;
    hoverTimer.current = setTimeout(() => {
      if (cardRef.current) setAnchorRect(cardRef.current.getBoundingClientRect());
      setHovered(true);
      if (expandOnHover) videoTimer.current = setTimeout(() => setVideoReady(true), 700);
    }, 380);
  }, [isMobile, expandOnHover]);

  const onMouseLeave = useCallback(() => {
    clearTimeout(hoverTimer.current);
    clearTimeout(videoTimer.current);
    setHovered(false);
    setVideoReady(false);
    setAnchorRect(null);
  }, []);

  // ── navigation ────────────────────────────────────────────────────────────
  const goDetail = useCallback((e) => {
    e?.stopPropagation();
    const base = isMovie ? Constants.DB_MOVIE_DETIALS_ROUTE : Constants.DB_SERIES_DETIALS_ROUTE;
    navigate(base.replace(':title', `${record.id}-${(record.title ?? '').replace(/\s+/g, '-').toLowerCase()}`));
  }, [isMovie, navigate, record?.id, record?.title]);

  const goPlay = useCallback((e) => {
    e?.stopPropagation();
    const base = isMovie ? Constants.DB_MOVIE_DETIALS_ROUTE : Constants.DB_SERIES_DETIALS_ROUTE;
    navigate(
      base.replace(':title', `${record.id}-${(record.title ?? '').replace(/\s+/g, '-').toLowerCase()}`),
      { state: { defaultTab: 'Watch' } }
    );
  }, [isMovie, navigate, record?.id, record?.title]);

  if (!record) return <RecordCardSkeleton wide={wide} prime={expandOnHover} />;

  const isExpanded = expandOnHover && hovered;

  // ── image ──────────────────────────────────────────────────────────────────
  const imgPath = isExpanded
    ? (record.backdropPath ?? record.posterPath)
    : wide
      ? (record.backdropPath ?? record.posterPath)
      : (record.posterPath ?? record.backdropPath);

  const imgSrc = imgError ? null : tmdbImg(imgPath, isExpanded || wide ? 'w780' : 'w342');

  // ── dimensions ────────────────────────────────────────────────────────────
  // Prime rail uses a FIXED height — only width changes on hover (true horizontal expand).
  // Wide rail uses 16:9 aspect ratio.  Poster rail uses 2:3.
  const PRIME_HEIGHT = { xs: 160, sm: 190, md: 420 };

  const cardWidth = expandOnHover
    ? {
        xs: isExpanded ? `calc(160px * ${16/9})` : `calc(160px * ${9/16})`,
        sm: isExpanded ? `calc(190px * ${16/9})` : `calc(190px * ${9/16})`,
        md: isExpanded ? `calc(420px * ${16/9})` : `calc(420px * ${9/16})`,
      }
    : wide
      ? { xs: 200, sm: 240, md: 280 }
      : { xs: 110, sm: 130, md: 150 };

  const aspectRatio = expandOnHover
    ? (isExpanded ? '16 / 9' : '9 / 16')   // 👈 MAGIC
    : wide
      ? '16 / 9'
      : '2 / 3';

  // ── motion ────────────────────────────────────────────────────────────────
  const motionAnimate = expandOnHover
    ? { zIndex: hovered ? 10 : 1 }
    : hovered ? { scale: 1.05, zIndex: 10 } : { scale: 1, zIndex: 1 };

  return (
    <motion.div
      ref={cardRef}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={isMobile ? goDetail : undefined}
      animate={motionAnimate}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      style={{ flexShrink: 0, cursor: 'pointer', position: 'relative', display: 'flex', alignItems: 'flex-end' }}
    >
      {/* ── Top 10 rank badge ── */}
      {rank != null && (
        <Typography sx={{
          fontSize: { xs: '5.5rem', md: '8rem' }, fontWeight: 900,
          lineHeight: 0.85, color: 'transparent',
          WebkitTextStroke: { xs: '2px rgba(255,255,255,0.55)', md: '3px rgba(255,255,255,0.6)' },
          mr: -1.5, zIndex: 0, userSelect: 'none', flexShrink: 0,
          textShadow: '2px 2px 8px rgba(0,0,0,0.8)',
        }}>
          {rank}
        </Typography>
      )}

      {/* ── Card box ── */}
      <Box
        sx={{
          width: cardWidth,
              height: expandOnHover ? PRIME_HEIGHT : undefined,
              aspectRatio: !expandOnHover ? aspectRatio : undefined,
          borderRadius: 1.5,
          overflow: 'hidden',
          bgcolor: 'rgba(255,255,255,.06)',
          position: 'relative',
          boxShadow: hovered ? '0 16px 48px rgba(0,0,0,.75)' : '0 2px 8px rgba(0,0,0,.3)',
          transition: 'width 0.35s cubic-bezier(0.4,0,0.2,1), transform 0.2s',
        }}
      >
        {/* Skeleton */}
        {!imgLoaded && (
          <Skeleton variant="rectangular" width="100%" height="100%"
            sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(255,255,255,.06)' }} />
        )}

        {/* Image */}
        {imgSrc && (
          <Box
            component="img"
            src={imgSrc}
            alt={record.title}
            onLoad={() => setImgLoaded(true)}
            onError={() => { setImgError(true); setImgLoaded(true); }}
            sx={{
              width: '100%', height: '100%', objectFit: 'cover', display: 'block',
              opacity: imgLoaded ? 1 : 0, transition: 'opacity .3s',
            }}
          />
        )}

        {/* Prime expand: video */}
        {isExpanded && videoReady && record.previewVideoUrl && (
          <Box
            component="iframe"
            src={record.previewVideoUrl}
            allow="autoplay; encrypted-media"
            sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
          />
        )}

        {/* Prime expand: info bar */}
        {isExpanded && (
          <Box sx={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            background: 'linear-gradient(to top, rgba(0,0,0,.97) 0%, rgba(0,0,0,.4) 75%, transparent 100%)',
            p: 1.2, pt: 3,
          }}>
            <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.82rem', mb: 0.5, lineHeight: 1.2 }}>
              {record.title}
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5, mb: 0.6, alignItems: 'center' }}>
              {record.voteAverage > 0 && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
                  <Star sx={{ fontSize: 11, color: '#46d369' }} />
                  <Typography sx={{ color: '#46d369', fontSize: '0.7rem', fontWeight: 700 }}>
                    {Number(record.voteAverage).toFixed(1)}
                  </Typography>
                </Box>
              )}
              {year(record.releaseDate) && (
                <Typography sx={{ color: 'rgba(255,255,255,.5)', fontSize: '0.7rem' }}>
                  {year(record.releaseDate)}
                </Typography>
              )}
            </Box>
            {record.genres?.length > 0 && (
              <Typography sx={{ color: 'rgba(255,255,255,.4)', fontSize: '0.64rem', mb: 0.8 }}>
                {record.genres.slice(0, 3).join(' · ')}
              </Typography>
            )}
            {/* Full interaction row for Prime expand */}
            <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
              <Tooltip title="Play">
                <IconButton size="small" onClick={goPlay}
                  sx={{ bgcolor: '#fff', color: '#000', p: 0.5, '&:hover': { bgcolor: 'rgba(255,255,255,.85)' } }}>
                  <PlayArrow sx={{ fontSize: 14 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title={interaction.watchlisted ? 'In My List' : 'Add to My List'}>
                <IconButton size="small" onClick={(e) => { e.stopPropagation(); onWatchlist?.(record); }}
                  sx={{ border: '1.5px solid rgba(255,255,255,.5)', color: interaction.watchlisted ? '#46d369' : '#fff', p: 0.4, '&:hover': { borderColor: '#fff' } }}>
                  {interaction.watchlisted ? <BookmarkAdded sx={{ fontSize: 12 }} /> : <BookmarkAdd sx={{ fontSize: 12 }} />}
                </IconButton>
              </Tooltip>
              <Tooltip title={interaction.liked ? 'Unlike' : 'Like'}>
                <IconButton size="small" onClick={(e) => { e.stopPropagation(); onLike?.(record); }}
                  sx={{ border: '1.5px solid rgba(255,255,255,.5)', color: '#fff', p: 0.4, '&:hover': { borderColor: '#fff' } }}>
                  {interaction.liked ? <ThumbUp sx={{ fontSize: 12 }} /> : <ThumbUpOutlined sx={{ fontSize: 12 }} />}
                </IconButton>
              </Tooltip>
              <Tooltip title={interaction.loved ? 'Loved' : 'Love it'}>
                <IconButton size="small" onClick={(e) => { e.stopPropagation(); onLove?.(record); }}
                  sx={{ border: '1.5px solid rgba(255,255,255,.5)', color: interaction.loved ? '#e50914' : '#fff', p: 0.4, '&:hover': { borderColor: '#fff' } }}>
                  {interaction.loved ? <Favorite sx={{ fontSize: 12 }} /> : <FavoriteBorder sx={{ fontSize: 12 }} />}
                </IconButton>
              </Tooltip>
              <Tooltip title={interaction.watched ? 'Watched' : 'Mark Watched'}>
                <IconButton size="small" onClick={(e) => { e.stopPropagation(); onWatched?.(record); }}
                  sx={{ border: '1.5px solid rgba(255,255,255,.5)', color: interaction.watched ? '#a5d6a7' : '#fff', p: 0.4, '&:hover': { borderColor: '#fff' } }}>
                  {interaction.watched ? <Visibility sx={{ fontSize: 12 }} /> : <VisibilityOff sx={{ fontSize: 12 }} />}
                </IconButton>
              </Tooltip>
              <Tooltip title="More Info">
                <IconButton size="small" onClick={goDetail}
                  sx={{ border: '1.5px solid rgba(255,255,255,.5)', color: '#fff', p: 0.4, ml: 'auto', '&:hover': { borderColor: '#fff' } }}>
                  <Info sx={{ fontSize: 12 }} />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        )}

        {/* Default compact hover overlay (non-expand, on card itself) */}
        {hovered && !expandOnHover && (
          <Box sx={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to top, rgba(0,0,0,.85) 0%, rgba(0,0,0,.1) 55%, transparent 100%)',
            display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', p: 0.8,
          }}>
            <Typography sx={{
              color: '#fff', fontWeight: 700, fontSize: '0.7rem', lineHeight: 1.3, mb: 0.3,
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>
              {record.title}
            </Typography>
            {record.voteAverage > 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
                <Star sx={{ fontSize: 10, color: '#46d369' }} />
                <Typography sx={{ color: '#46d369', fontSize: '0.64rem', fontWeight: 700 }}>
                  {Number(record.voteAverage).toFixed(1)}
                </Typography>
              </Box>
            )}
          </Box>
        )}

        {/* Watched badge */}
        {interaction.watched && (
          <Box sx={{
            position: 'absolute', top: 5, right: 5,
            bgcolor: 'rgba(0,0,0,.72)', borderRadius: 10, px: 0.7, py: 0.2,
            display: 'flex', alignItems: 'center', gap: 0.3,
          }}>
            <Check sx={{ fontSize: 9, color: '#4caf50' }} />
            <Typography sx={{ fontSize: '0.58rem', color: '#4caf50', fontWeight: 700 }}>Watched</Typography>
          </Box>
        )}
      </Box>

      {/* ── Netflix portal popup — desktop, non-prime mode ── */}
      {hovered && !expandOnHover && !isMobile && anchorRect && (
        <HoverPopup
          record={record}
          interaction={interaction}
          onWatchlist={onWatchlist}
          onLike={onLike}
          onLove={onLove}
          onWatched={onWatched}
          anchorRect={anchorRect}
          onClose={onMouseLeave}
        />
      )}
    </motion.div>
  );
};

export default RecordCard;
