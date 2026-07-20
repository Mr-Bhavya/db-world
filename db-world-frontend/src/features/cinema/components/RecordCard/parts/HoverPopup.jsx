import React, { useState, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { Box, Typography, IconButton } from '@mui/material';
import {
  PlayArrow,
  BookmarkAdd, BookmarkAdded, ExpandMore, Star, VolumeOff, VolumeUp,
} from '@mui/icons-material';
import { tmdbImg } from '../../../api/cinemaApi';
import { openRecord } from '../../../utils/recordNav';
import ActionButton from './ActionButton';
import CardReactionButton from './CardReactionButton';
import { POPUP_W, year, fmtRuntime, navBlock } from './cardHelpers';

const SPRING = { type: 'spring', stiffness: 300, damping: 30, mass: 0.85 };

// Netflix-style hover popup rendered into a body portal (desktop, non-prime cards).
//
// Mounting/unmounting is owned by the card; wrap the render site in
// <AnimatePresence> (see RecordCard) so the exit variant actually runs. The
// popup keeps the hover alive via onHoverEnter so it doesn't self-close when it
// covers the card underneath.
const HoverPopup = ({
  record, interaction = {}, onWatchlist, onLike, onLove,
  anchorRect, onClose, onHoverEnter,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const reduceMotion = useReducedMotion();
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [muted, setMuted] = useState(true);
  const isMovie = record.type === 'MOVIE';
  const iframeRef = useRef(null);

  // mute=1 so autoplay isn't blocked; unmute on demand via the JS API.
  const videoSrc = record.previewVideoUrl
    ? `${record.previewVideoUrl}&autoplay=1&mute=1&controls=0&modestbranding=1&rel=0&iv_load_policy=3&fs=0&disablekb=1&playsinline=1&loop=1&enablejsapi=1&vq=hd1080&origin=${encodeURIComponent(typeof window !== 'undefined' ? window.location.origin : '')}`
    : null;

  // Position the popup centred on the card, clamped to the viewport, plus the
  // transform offset that lets it emerge from the card's own footprint.
  const layout = useMemo(() => {
    if (!anchorRect) return null;
    const videoH = Math.round(POPUP_W * 9 / 16);
    const height = videoH + (record.overview ? 290 : 210);
    const left = Math.max(8, Math.min(
      anchorRect.left + anchorRect.width / 2 - POPUP_W / 2,
      window.innerWidth - POPUP_W - 8,
    ));
    const top = Math.max(8, Math.min(
      anchorRect.top + anchorRect.height / 2 - height / 2,
      window.innerHeight - height - 8,
    ));
    const originX = (anchorRect.left + anchorRect.width / 2) - (left + POPUP_W / 2);
    const originY = (anchorRect.top + anchorRect.height / 2) - (top + height / 2);
    const scale = Math.max(0.5, Math.min(anchorRect.width / POPUP_W, 0.9));
    return { height, left, top, originX, originY, scale };
  }, [anchorRect, record.overview]);

  const variants = useMemo(() => {
    if (!layout) return {};
    if (reduceMotion) {
      return {
        initial: { opacity: 0 },
        animate: { opacity: 1, transition: { duration: 0.15 } },
        exit: { opacity: 0, transition: { duration: 0.12 } },
      };
    }
    const at = { scale: layout.scale, x: layout.originX, y: layout.originY };
    return {
      initial: { opacity: 0, ...at },
      animate: {
        opacity: 1, scale: 1, x: 0, y: 0,
        transition: { default: SPRING, opacity: { duration: 0.18 } },
      },
      // Retract back toward the card on close instead of snapping.
      exit: { opacity: 0, ...at, transition: { duration: 0.16, ease: 'easeIn' } },
    };
  }, [layout, reduceMotion]);

  const toggleMute = (e) => {
    e.stopPropagation();
    if (!iframeRef.current?.contentWindow) return;
    iframeRef.current.contentWindow.postMessage(
      JSON.stringify({ event: 'command', func: muted ? 'unMute' : 'mute', args: [] }), '*',
    );
    setMuted(prev => !prev);
  };

  // HoverPopup is desktop-only, so we always pass the background location —
  // this triggers the Netflix-style modal overlay in App.jsx.
  const goDetail = (e) => {
    e?.stopPropagation();
    navBlock.until = Date.now() + 600;
    openRecord(navigate, location, record, {
      originRect: { top: layout.top, left: layout.left, width: POPUP_W, height: layout.height },
    });
    requestAnimationFrame(() => onClose());
  };

  const goPlay = (e) => {
    e?.stopPropagation();
    navBlock.until = Date.now() + 600;
    openRecord(navigate, location, record, { play: true });
    onClose();
  };

  if (!layout) return null;

  return createPortal(
    <motion.div
      key="nfx-popup"
      variants={variants}
      initial="initial"
      animate="animate"
      exit="exit"
      onMouseEnter={onHoverEnter}
      onMouseLeave={onClose}
      style={{
        position: 'fixed', top: layout.top, left: layout.left,
        width: POPUP_W, zIndex: 9999,
        borderRadius: 8, overflow: 'hidden',
        boxShadow: '0 28px 90px rgba(0,0,0,0.98)',
        background: '#181818',
        cursor: 'default',
        transformOrigin: 'center center',
        willChange: 'transform, opacity',
      }}
    >
      {/* ── Video / Backdrop ── */}
      <Box sx={{ width: '100%', aspectRatio: '16/9', position: 'relative', bgcolor: '#000', overflow: 'hidden' }}>
        {/* Backdrop stays put; the video simply fades in on top of it, so there's
            no black flash between iframe load and playback. */}
        <Box
          component="img"
          src={tmdbImg(record.backdropPath ?? record.posterPath, 'w780')}
          alt={record.title}
          sx={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }}
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
            onLoad={() => setTimeout(() => setVideoLoaded(true), 180)}
            sx={{
              position: 'absolute', top: '50%', left: '50%',
              width: '120%', height: '120%',
              transform: 'translate(-50%, -50%) scale(1.2)',
              border: 'none',
              opacity: videoLoaded ? 1 : 0,
              transition: 'opacity 0.5s',
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
          <CardReactionButton
            record={record}
            liked={interaction.liked}
            loved={interaction.loved}
            onLike={onLike}
            onLove={onLove}
            iconSize={17}
            pad={0.7}
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