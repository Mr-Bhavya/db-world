import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { Box, Typography, IconButton, Button } from '@mui/material';
import {
  PlayArrow,
  BookmarkAdd, BookmarkAdded, ExpandMore, Star, VolumeOff, VolumeUp,
} from '@mui/icons-material';
import { tmdbImg } from '../../../api/cinemaApi';
import { openRecord } from '../../../utils/recordNav';
import ActionButton from './ActionButton';
import CardReactionButton from './CardReactionButton';
import { POPUP_W, year, fmtRuntime, navBlock, activeHoverPopup } from './cardHelpers';
import { useViewportWidth, popupFluidFactor } from '../../../hooks/useFluidCardSize';

const SPRING = { type: 'spring', stiffness: 300, damping: 30, mass: 0.85 };

// Netflix-style hover popup rendered into a body portal (desktop, non-prime cards).
//
// Mounting/unmounting is owned by the card; wrap the render site in
// <AnimatePresence> (see RecordCard) so the exit variant actually runs. The
// popup keeps the hover alive via onHoverEnter so it doesn't self-close when it
// covers the card underneath.
const HoverPopup = ({
  record, interaction = {}, onWatchlist, onLike, onLove,
  anchorRect, anchorRef, edgeArrowRef, stillSrc, onClose, onDismiss, onHoverEnter,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const reduceMotion = useReducedMotion();
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [muted, setMuted] = useState(true);
  const isMovie = record.type === 'MOVIE';
  const logoUrl = record.logoPath ? tmdbImg(record.logoPath, 'w300') : null;
  const iframeRef = useRef(null);
  const rootRef = useRef(null);

  // Popup width scales gently with the viewport, in step with the fluid cards.
  const vw = useViewportWidth();
  const popupW = Math.round(POPUP_W * popupFluidFactor(vw));

  // Position + emerge-from-the-card geometry for a given card rect. Shared by the
  // initial render (via useMemo) and the imperative scroll tracker below.
  const computeLayout = useCallback((rect) => {
    if (!rect) return null;
    const videoH = Math.round(popupW * 9 / 16);
    const infoH = 170;             // info panel below the media (Play + meta + overview + genres)
    const height = videoH + infoH;

    const cardCX = rect.left + rect.width / 2;
    const cardCY = rect.top + rect.height / 2;
    const centered = cardCX - popupW / 2;

    // Keep the popup fully ON SCREEN (no cutting). Clamp a side to EDGE if it has a
    // scroll arrow to clear; otherwise align FLUSH with the card's edge for the true
    // first/last card. (The full-height arrow handles keep the arrows clickable, so
    // we no longer need to suppress edge-card popups — they're reachable now.)
    const EDGE = 64;
    const edges = edgeArrowRef?.current ?? { left: false, right: false };
    const loLimit = edges.left ? EDGE : Math.min(EDGE, Math.round(rect.left));
    const hiLimit = edges.right
      ? window.innerWidth - popupW - EDGE
      : Math.max(window.innerWidth - popupW - EDGE, Math.round(rect.right) - popupW);
    const left = Math.max(loLimit, Math.min(centered, hiLimit));

    // Media centred on the card vertically; the compact panel hangs below.
    const top = Math.max(8, Math.round(cardCY - videoH / 2));

    const scale = Math.max(0.45, Math.min(rect.width / popupW, 0.95));

    // transformOrigin so the media lands EXACTLY on the card at the start scale —
    // for ANY horizontal alignment (centred interior card OR edge-aligned first/last
    // card). This is what keeps the "card becomes the popup" morph without needing
    // to centre (which is what let edge cards bleed/cut off before).
    const denom = Math.max(1, (1 - scale) * popupW);
    const originXpc = Math.max(0, Math.min(100, ((rect.left - left) / denom) * 100));
    const originYpx = videoH / 2;
    return { height, left, top, scale, originXpc, originYpx };
  }, [popupW, edgeArrowRef]);

  // Follow the card as the page scrolls (vertical) OR the rail scrolls
  // (horizontal), so the popup stays glued to the record instead of freezing in
  // place. capture:true because scroll events don't bubble — the capture phase on
  // window still sees them from the nested horizontal rail scroller.
  const [liveRect, setLiveRect] = useState(anchorRect);
  const scrolledUntil = useRef(0);

  useEffect(() => {
    const el = anchorRef?.current;
    if (!el) return undefined;
    let raf = 0;
    const onMove = () => {
      scrolledUntil.current = Date.now() + 300; // suppress scroll-induced mouseleave
      const r = el.getBoundingClientRect();
      // Reposition IMPERATIVELY in the same scroll frame — routing this through a
      // React state update lags a couple frames behind the native scroll, which is
      // what made the popup visibly trail the card. State is still synced (below)
      // so later re-renders stay consistent.
      const node = rootRef.current;
      const l = node && computeLayout(r);
      if (l) { node.style.left = `${l.left}px`; node.style.top = `${l.top}px`; }
      // Card scrolled fully out of view → nothing left to anchor to.
      if (r.bottom <= 0 || r.top >= window.innerHeight) { onClose(); return; }
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; setLiveRect(r); });
    };
    window.addEventListener('scroll', onMove, { capture: true, passive: true });
    window.addEventListener('resize', onMove);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onMove, { capture: true });
      window.removeEventListener('resize', onMove);
    };
  }, [anchorRef, onClose, computeLayout]);

  // Guard the close: a scroll that slides the popup out from under a stationary
  // cursor fires mouseleave — ignore it while scrolling so "follow the card"
  // doesn't snap the popup shut. A genuine mouse-out still closes it.
  const handleLeave = () => {
    if (Date.now() < scrolledUntil.current) return;
    onClose();
  };

  // Never leave two popups stacked: opening this one dismisses any other that's
  // still glued to a card after a scroll.
  useEffect(() => {
    const prev = activeHoverPopup.close;
    if (prev && prev !== onDismiss) prev();
    activeHoverPopup.close = onDismiss;
    return () => { if (activeHoverPopup.close === onDismiss) activeHoverPopup.close = null; };
  }, [onDismiss]);

  // mute=1 so autoplay isn't blocked; unmute on demand via the JS API.
  const videoSrc = record.previewVideoUrl
    ? `${record.previewVideoUrl}&autoplay=1&mute=1&controls=0&modestbranding=1&rel=0&iv_load_policy=3&fs=0&disablekb=1&playsinline=1&loop=1&enablejsapi=1&vq=hd1080&origin=${encodeURIComponent(typeof window !== 'undefined' ? window.location.origin : '')}`
    : null;

  // Netflix-style: hold on the still for a beat, THEN start the trailer from the
  // top (mounting the iframe here so it autoplays from 0, not mid-clip).
  useEffect(() => {
    if (!videoSrc) return undefined;
    const t = setTimeout(() => setShowVideo(true), 1600);
    return () => clearTimeout(t);
  }, [videoSrc]);

  const layout = useMemo(
    () => computeLayout(liveRect ?? anchorRect),
    [computeLayout, liveRect, anchorRect],
  );

  const variants = useMemo(() => {
    if (!layout) return {};
    if (reduceMotion) {
      return {
        initial: { opacity: 0 },
        animate: { opacity: 1, transition: { duration: 0.15 } },
        exit: { opacity: 0, transition: { duration: 0.12 } },
      };
    }
    return {
      // Scale radiates from transformOrigin (the media centre, sitting ON the card),
      // so the popup grows straight out of — and retracts back into — the card's
      // footprint. No y-drift, so the image never leaves the card.
      initial: { opacity: 0, scale: layout.scale },
      animate: {
        opacity: 1, scale: 1,
        transition: { default: SPRING, opacity: { duration: 0.18 } },
      },
      exit: { opacity: 0, scale: layout.scale, transition: { duration: 0.16, ease: 'easeIn' } },
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
      originRect: { top: layout.top, left: layout.left, width: popupW, height: layout.height },
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
      ref={rootRef}
      variants={variants}
      initial="initial"
      animate="animate"
      exit="exit"
      onMouseEnter={onHoverEnter}
      onMouseLeave={handleLeave}
      style={{
        position: 'fixed', top: layout.top, left: layout.left,
        width: popupW, zIndex: 9999,
        borderRadius: 8, overflow: 'hidden',
        boxShadow: '0 28px 90px rgba(0,0,0,0.98)',
        background: '#181818',
        cursor: 'default',
        transformOrigin: `${layout.originXpc}% ${layout.originYpx}px`,
        willChange: 'transform, opacity',
      }}
    >
      {/* ── Media (16:9) ── */}
      <Box sx={{ width: '100%', aspectRatio: '16/9', position: 'relative', bgcolor: '#000', overflow: 'hidden' }}>
        <Box
          component="img"
          src={stillSrc ?? tmdbImg(record.backdropPath ?? record.posterPath, 'w780')}
          alt={record.title}
          sx={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }}
        />
        <Box sx={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to top, #181818 0%, transparent 60%)',
          opacity: videoLoaded ? 0 : 1, transition: 'opacity 0.4s',
        }} />
        {videoSrc && showVideo && (
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
              opacity: videoLoaded ? 1 : 0, transition: 'opacity 0.5s',
              pointerEvents: 'none',
            }}
          />
        )}
        <Box sx={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: '46%',
          background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.32) 55%, transparent 100%)',
          zIndex: 2,
        }} />
        {/* Logo (or title) on the artwork — hidden while the still shows, revealed
            once the trailer is playing (or immediately if there's no trailer). */}
        <Box sx={{
          position: 'absolute', bottom: 10, left: 14, right: 46, zIndex: 3,
          opacity: (videoLoaded || !videoSrc) ? 1 : 0,
          transition: 'opacity 0.5s ease',
          pointerEvents: 'none',
        }}>
          {logoUrl ? (
            <Box
              component="img"
              src={logoUrl}
              alt={record.title}
              sx={{
                maxHeight: 46, maxWidth: '80%', objectFit: 'contain', objectPosition: 'left bottom',
                display: 'block', filter: 'drop-shadow(0 2px 10px rgba(0,0,0,0.9))',
              }}
            />
          ) : (
            <Typography sx={{
              color: '#fff', fontWeight: 800, fontSize: 'clamp(0.95rem, 1.5vw, 1.15rem)',
              lineHeight: 1.15, textShadow: '0 2px 12px rgba(0,0,0,0.95)',
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>
              {record.title}
            </Typography>
          )}
        </Box>
        {videoSrc && showVideo && (
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

      {/* ── Info panel below the media ── */}
      <Box
        component={motion.div}
        initial={{ opacity: reduceMotion ? 1 : 0, y: reduceMotion ? 0 : 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: reduceMotion ? 0 : 0.1, duration: 0.22, ease: 'easeOut' }}
        sx={{ px: 1.8, pt: 1.4, pb: 1.6, bgcolor: '#181818' }}
      >
        {/* Actions — a prominent, full-width Play, then the secondary icon actions */}
        <Box sx={{ display: 'flex', gap: 0.8, mb: 1.1, alignItems: 'center' }}>
          <Button
            onClick={goPlay}
            variant="contained"
            startIcon={<PlayArrow sx={{ fontSize: 21 }} />}
            sx={{
              bgcolor: '#fff', color: '#000', fontWeight: 800, textTransform: 'none',
              fontSize: '0.86rem', borderRadius: 1, py: 0.5, px: 2.4, boxShadow: 'none',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.85)', boxShadow: 'none' },
            }}
          >
            Play
          </Button>
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
              tooltip="More info"
              onClick={goDetail}
            />
          </Box>
        </Box>

        {/* Meta line */}
        <Box sx={{ display: 'flex', gap: 0.9, mb: 0.7, flexWrap: 'wrap', alignItems: 'center' }}>
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

        {/* Overview (title now lives on the artwork above) */}
        {record.overview && (
          <Typography sx={{
            color: 'rgba(255,255,255,.68)', fontSize: '0.78rem', lineHeight: 1.5, mb: 0.7,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {record.overview}
          </Typography>
        )}

        {/* Genres */}
        {record.genres?.length > 0 && (
          <Typography sx={{ color: 'rgba(255,255,255,.42)', fontSize: '0.72rem' }}>
            {record.genres.slice(0, 4).join(' · ')}
          </Typography>
        )}
      </Box>
    </motion.div>,
    document.body
  );
};

export default HoverPopup;