import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Box, Typography, IconButton } from '@mui/material';
import {
  PlayArrow, ThumbUp, ThumbUpOutlined,
  BookmarkAdd, BookmarkAdded, ExpandMore, Star, VolumeOff, VolumeUp,
} from '@mui/icons-material';
import { tmdbImg } from '../../../api/cinemaApi';
import { openRecord } from '../../../utils/recordNav';
import ActionButton from './ActionButton';
import { POPUP_W, year, fmtRuntime, navBlock } from './cardHelpers';

// Netflix-style hover popup rendered into a body portal (desktop, non-prime cards).
const HoverPopup = ({ record, interaction = {}, onWatchlist, onLike, onLove, onWatched, anchorRect, onClose }) => {
  const navigate = useNavigate();
  const location = useLocation();
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
      JSON.stringify({ event: 'command', func: command, args: [] }),
      '*'
    );
    setMuted(prev => !prev);
  };

  // HoverPopup is desktop-only, so we always pass the background location —
  // this triggers the Netflix-style modal overlay in App.jsx.
  const goDetail = (e) => {
    e?.stopPropagation();
    navBlock.until = Date.now() + 600;
    openRecord(navigate, location, record, {
      originRect: { top, left, width: POPUP_W, height: popupH },
    });
    requestAnimationFrame(() => onClose());
  };

  const goPlay = (e) => {
    e?.stopPropagation();
    navBlock.until = Date.now() + 600;
    openRecord(navigate, location, record, { play: true });
    onClose();
  };

  const initialScale = Math.max(0.5, Math.min(anchorRect.width / POPUP_W, 0.9));

  return createPortal(
    <motion.div
      key="nfx-popup"
      initial={{ opacity: 0, scale: initialScale }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: initialScale * 0.97 }}
      transition={{
        opacity: { duration: 0.12 },
        scale: { type: 'spring', stiffness: 360, damping: 28 },
      }}
      style={{
        position: 'fixed', top, left,
        width: POPUP_W, zIndex: 9999,
        borderRadius: 8, overflow: 'hidden',
        boxShadow: '0 28px 90px rgba(0,0,0,0.98)',
        background: '#181818',
        cursor: 'default',
        transformOrigin: 'center center',
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
              position: 'absolute', top: '50%', left: '50%',
              width: '120%', height: '120%',
              transform: 'translate(-50%, -50%) scale(1.2)',
              border: 'none',
              opacity: videoLoaded ? 1 : 0,
              transition: 'opacity 0.4s',
              pointerEvents: 'none',
            }}
          />
        )}
        <Box sx={{
          position: 'absolute', bottom: 0, left: 0, width: '100%', height: '14%',
          background: 'linear-gradient(to top, black, transparent)', zIndex: 2,
        }} />
        {videoSrc && (
          <IconButton
            size="small"
            onClick={toggleMute}
            sx={{
              position: 'absolute', bottom: 8, right: 8, zIndex: 5,
              bgcolor: 'rgba(0,0,0,0.55)', color: '#fff',
              border: '1.5px solid rgba(255,255,255,0.45)', p: 0.5,
              '&:hover': { bgcolor: 'rgba(0,0,0,0.8)' },
            }}
          >
            {muted ? <VolumeOff sx={{ fontSize: 14 }} /> : <VolumeUp sx={{ fontSize: 14 }} />}
          </IconButton>
        )}
      </Box>

      {/* ── Info ── */}
      <Box sx={{ px: 2, pt: 1.5, pb: 2, bgcolor: '#181818' }}>
        <Box sx={{ display: 'flex', gap: 0.8, mb: 1.2, alignItems: 'center' }}>
          <ActionButton
            variant="filled"
            icon={<PlayArrow sx={{ fontSize: 20 }} />}
            activeIcon={<PlayArrow sx={{ fontSize: 20 }} />}
            tooltip="Play / Download"
            onClick={goPlay}
          />
          {!interaction?.watched && (
            <ActionButton
              icon={<BookmarkAdd sx={{ fontSize: 17 }} />}
              activeIcon={<BookmarkAdded sx={{ fontSize: 17, color: '#46d369' }} />}
              active={interaction.watchlisted}
              tooltip={interaction.watchlisted ? 'Remove from My List' : 'Add to My List'}
              onClick={() => onWatchlist?.(record)}
            />
          )}
          <ActionButton
            icon={<ThumbUpOutlined sx={{ fontSize: 17 }} />}
            activeIcon={<ThumbUp sx={{ fontSize: 17, color: '#fff' }} />}
            active={interaction.liked}
            tooltip={interaction.liked ? 'Unlike' : 'Like'}
            onClick={() => onLike?.(record)}
          />
          <Box sx={{ ml: 'auto' }}>
            <ActionButton
              icon={<ExpandMore sx={{ fontSize: 19 }} />}
              activeIcon={<ExpandMore sx={{ fontSize: 19 }} />}
              tooltip="More details"
              onClick={goDetail}
            />
          </Box>
        </Box>

        <Box sx={{ display: 'flex', gap: 1, mb: 0.9, flexWrap: 'wrap', alignItems: 'center' }}>
          {record.voteAverage > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
              <Star sx={{ fontSize: 13, color: '#46d369' }} />
              <Typography sx={{ color: '#46d369', fontSize: '0.78rem', fontWeight: 800 }}>
                {Number(record.voteAverage).toFixed(1)}
              </Typography>
            </Box>
          )}
          {year(record.releaseDate) && (
            <Typography sx={{ color: 'rgba(255,255,255,.62)', fontSize: '0.78rem', fontWeight: 600 }}>
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
          <Box sx={{
            ml: 0.2, px: 0.7, py: 0.1, borderRadius: 0.5,
            border: '1px solid rgba(255,255,255,.28)',
            color: 'rgba(255,255,255,.7)', fontSize: '0.6rem', fontWeight: 700, letterSpacing: 0.4,
          }}>
            {isMovie ? 'MOVIE' : 'SERIES'}
          </Box>
        </Box>

        <Typography sx={{
          color: '#fff', fontWeight: 800, fontSize: 'clamp(0.85rem, 1.5vw, 1rem)',
          lineHeight: 1.3, mb: record.overview ? 0.8 : 0.6,
          display: '-webkit-box', WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {record.title}
        </Typography>

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

        {record.genres?.length > 0 && (
          <Typography sx={{ color: 'rgba(255,255,255,.38)', fontSize: '0.72rem', mb: 0.7 }}>
            {record.genres.slice(0, 4).join(' · ')}
          </Typography>
        )}

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

export default HoverPopup;
