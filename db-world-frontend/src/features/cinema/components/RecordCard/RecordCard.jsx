import React, { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
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
  ExpandMore, Star, VolumeOff, VolumeUp,
} from '@mui/icons-material';
import { tmdbImg } from '../../api/cinemaApi';
import { openRecord, preloadDetail, rectOf } from '../../utils/recordNav';
import useDeviceTier from '../../hooks/useDeviceTier';
import { RAIL_TYPE_CONFIG, RAIL_TYPE_DEFAULT } from '../RailRow/railTypeConfig';

// ─── helpers ─────────────────────────────────────────────────────────────────

const year = (d) => (d ? String(d).slice(0, 4) : '');

const POPUP_W = 450; // wider popup

// Shared cooldown: after navigating from a popup, block new hover popups for 600ms
// so the next card's popup doesn't appear while the modal is loading.
let navBlockUntil = 0;

// ─── Skeleton ────────────────────────────────────────────────────────────────

export const RecordCardSkeleton = ({ type = 'standard', wide, top10, prime }) => {
  // Support legacy boolean props from WatchlistRailRow
  const resolvedType = type !== 'standard'
    ? type
    : prime ? 'prime' : top10 ? 'top10' : wide ? 'wide' : 'standard';

  const cfg = RAIL_TYPE_CONFIG[resolvedType] ?? RAIL_TYPE_CONFIG[RAIL_TYPE_DEFAULT];
  const deskH = cfg.tiers.desktop;
  const mobH = cfg.tiers.mobile;
  const tabH = cfg.tiers.tablet;
  const isCirc = resolvedType === 'person';
  const is10 = resolvedType === 'top10';
  const isPrim = resolvedType === 'prime';
  const isWide = ['wide', 'continue', 'billboard'].includes(resolvedType);

  const [daw, dah] = cfg.cardAspect.split('/').map(Number);
  const mobAsp = cfg.mobileAspect ?? cfg.cardAspect;
  const [maw, mah] = mobAsp.split('/').map(Number);

  const w = isPrim
    ? { xs: Math.round(mobH * 9 / 16), sm: Math.round(tabH * 9 / 16), md: Math.round(deskH * 9 / 16) }
    : is10
      ? { xs: Math.round(mobH * 2 / 3), sm: Math.round(tabH * 2 / 3), md: Math.round(deskH * 2 / 3) }
      : isWide
        ? { xs: Math.round(mobH * 16 / 9), sm: Math.round(tabH * 16 / 9), md: Math.round(deskH * 16 / 9) }
        : isCirc
          ? { xs: mobH, sm: tabH, md: deskH }
          : {
            xs: Math.round(mobH * maw / mah),
            sm: Math.round(tabH * maw / mah),
            md: Math.round(deskH * daw / dah),
          };

  const h = isPrim
    ? { xs: mobH, sm: tabH, md: deskH }
    : isCirc
      ? { xs: mobH, sm: tabH, md: deskH }
      : undefined;

  // Standard (and any type with mobileAspect) uses a different aspect on mobile vs desktop.
  const aspectRatioSx = h ? {} : cfg.mobileAspect
    ? { aspectRatio: { xs: cfg.mobileAspect, md: cfg.cardAspect } }
    : { aspectRatio: cfg.cardAspect };

  return (
    <Box sx={{
      flexShrink: 0,
      pl: is10 ? { xs: 6, md: 10 } : 0,
      width: w,
      ...aspectRatioSx,
      borderRadius: isCirc ? '50%' : 1.5,
      overflow: 'hidden',
      bgcolor: 'rgba(255,255,255,.06)',
    }}>
      <Skeleton variant="rectangular" width="100%" height="100%"
        sx={{
          bgcolor: 'rgba(255,255,255,.06)',
          '@media (prefers-reduced-motion: reduce)': { animation: 'none' }
        }} />
    </Box>
  );
};

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
      JSON.stringify({
        event: 'command',
        func: command,
        args: []
      }),
      '*'
    );

    setMuted(prev => !prev);
  };

  // HoverPopup is desktop-only (the parent skips it when isMobile), so we
  // always pass the background location — this triggers the Netflix-style
  // modal overlay in App.jsx instead of a full-page navigation.
  const goDetail = (e) => {
    e?.stopPropagation();
    navBlockUntil = Date.now() + 600;
    // Pass the full popup rect so the modal expands FROM the popup shape.
    // top/left/POPUP_W/popupH are already computed in this scope.
    openRecord(navigate, location, record, {
      originRect: { top, left, width: POPUP_W, height: popupH },
    });
    // Delay close by one frame so the popup is visible on the modal's first frame —
    // this makes the expand feel continuous rather than close-then-reopen.
    requestAnimationFrame(() => onClose());
  };

  const goPlay = (e) => {
    e?.stopPropagation();
    navBlockUntil = Date.now() + 600;
    openRecord(navigate, location, record, { play: true });
    onClose();
  };

  // Scale the popup from the card's width so it visually expands from the card.
  // anchorRect.width / POPUP_W gives the fraction that matches the card footprint.
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

        {/* ── Action row (Netflix four: Play · My List · Like · Expand) ── */}
        <Box sx={{ display: 'flex', gap: 0.8, mb: 1.2, alignItems: 'center' }}>
          <ActionBtn
            variant="filled"
            icon={<PlayArrow sx={{ fontSize: 20 }} />}
            activeIcon={<PlayArrow sx={{ fontSize: 20 }} />}
            tooltip="Play / Download"
            onClick={goPlay}
          />
          {!interaction?.watched && (
            <ActionBtn
              icon={<BookmarkAdd sx={{ fontSize: 17 }} />}
              activeIcon={<BookmarkAdded sx={{ fontSize: 17, color: '#46d369' }} />}
              active={interaction.watchlisted}
              tooltip={interaction.watchlisted ? 'Remove from My List' : 'Add to My List'}
              onClick={() => onWatchlist?.(record)}
            />
          )}
          <ActionBtn
            icon={<ThumbUpOutlined sx={{ fontSize: 17 }} />}
            activeIcon={<ThumbUp sx={{ fontSize: 17, color: '#fff' }} />}
            active={interaction.liked}
            tooltip={interaction.liked ? 'Unlike' : 'Like'}
            onClick={() => onLike?.(record)}
          />
          <Box sx={{ ml: 'auto' }}>
            <ActionBtn
              icon={<ExpandMore sx={{ fontSize: 19 }} />}
              activeIcon={<ExpandMore sx={{ fontSize: 19 }} />}
              tooltip="More details"
              onClick={goDetail}
            />
          </Box>
        </Box>

        {/* Metadata row — ★ TMDB score · year · runtime/seasons · type (plain) */}
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
          {/* Type as plain muted text — no coloured pill */}
          <Box sx={{
            ml: 0.2, px: 0.7, py: 0.1, borderRadius: 0.5,
            border: '1px solid rgba(255,255,255,.28)',
            color: 'rgba(255,255,255,.7)', fontSize: '0.6rem', fontWeight: 700, letterSpacing: 0.4,
          }}>
            {isMovie ? 'MOVIE' : 'SERIES'}
          </Box>
        </Box>

        {/* Title */}
        <Typography sx={{
          color: '#fff', fontWeight: 800, fontSize: 'clamp(0.85rem, 1.5vw, 1rem)',
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
  record, rank, expandOnHover = false, type: typeProp, wide = false, interaction = {},
  index, onHoverExpand, expandDir = 'left',
  forceExpanded = false, onWatchlist, onLike, onLove, onWatched
}) => {

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const tier = useDeviceTier();
  const isTv = tier === 'tv';
  // Resolve type: explicit prop wins, then infer from legacy boolean props
  const type = typeProp ?? (expandOnHover ? 'prime' : rank != null ? 'top10' : wide ? 'wide' : 'standard');
  const cfg = RAIL_TYPE_CONFIG[type] ?? RAIL_TYPE_CONFIG[RAIL_TYPE_DEFAULT];
  const baseH = cfg.tiers[tier];

  const isWideType = type === 'wide' || type === 'continue';
  const useInlineWideHover = isWideType;

  // Standard cards use poster (2:3) on mobile/tablet, backdrop (16:9) on desktop/tv
  const isMobileTier = tier === 'mobile' || tier === 'tablet';
  const effectiveAspect = (cfg.mobileAspect && isMobileTier) ? cfg.mobileAspect : cfg.cardAspect;
  const isLandscape = effectiveAspect === '16/9';
  const navigate = useNavigate();
  const location = useLocation();

  const [hovered, setHovered] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [anchorRect, setAnchorRect] = useState(null);

  const cardRef = useRef(null);
  const hoverTimer = useRef(null);

  const isMovie = record?.type === 'MOVIE';

  // ── hover ─────────────────────────────────────────────────────────────────
  const onMouseEnter = useCallback(() => {
    if (isMobile) return;
    if (Date.now() < navBlockUntil) return; // suppressed: just navigated from a popup
    preloadDetail(); // warm the detail chunk so the modal opens instantly on click
    // Prime (expandOnHover) cards open fast for snappy switching between cards;
    // the popup-style cards keep the longer intent delay. The grow direction is
    // decided by RailRow from real pointer movement (passed back as expandDir).
    const delay = expandOnHover ? 110 : useInlineWideHover ? 140 : 380;
    hoverTimer.current = setTimeout(() => {
      if (cardRef.current) setAnchorRect(cardRef.current.getBoundingClientRect());
      setHovered(true);
      if (expandOnHover) onHoverExpand?.(index);
    }, delay);
  }, [isMobile, expandOnHover, onHoverExpand, index, useInlineWideHover]);

  const onMouseLeave = useCallback(() => {
    clearTimeout(hoverTimer.current);
    setHovered(false);
    setAnchorRect(null);
    if (expandOnHover) onHoverExpand?.(null, null);
  }, [expandOnHover, onHoverExpand]);

  // ── navigation ────────────────────────────────────────────────────────────
  // Always open the detail as an OVERLAY (background location set): a bottom
  // sheet on mobile, a Netflix-style modal on desktop. The underlying page
  // stays mounted, so closing keeps scroll position and avoids a refetch.
  const goDetail = useCallback((e) => {
    e?.stopPropagation();
    openRecord(navigate, location, record, { originRect: rectOf(e?.currentTarget) });
  }, [navigate, location, record]);

  const goPlay = useCallback((e) => {
    e?.stopPropagation();
    openRecord(navigate, location, record, { play: true });
  }, [navigate, location, record]);

  if (!record) return <RecordCardSkeleton wide={wide} prime={expandOnHover} top10={rank != null} />;

  // Mobile has no hover, so prime cards always show in the featured landscape
  // state (otherwise they shrink to a tiny 9:16 portrait and look broken).
  const isExpanded = expandOnHover && (forceExpanded || hovered || isMobile);

  // Top 10 jumbo mode: a Netflix-style featured row. The rank prop being set
  // means the parent RailRow already detected this as a Top 10 rail; we then
  // render a bigger portrait poster and an enormous stroked rank number.
  const isTopTen = rank != null;

  // ── image ──────────────────────────────────────────────────────────────────
  // Landscape cards show backdrop. wide/continue/billboard prefer backdropPathText
  // (TMDB title-burned image) so the card always shows a name without an overlay.
  const useTextBackdrop = cfg.useTextBackdrop ?? false;
  const imgPath = isExpanded || isLandscape
    ? useTextBackdrop
      ? (record.backdropPathText ?? record.backdropPath ?? record.posterPath)
      : (record.backdropPath ?? record.backdropPathText ?? record.posterPath)
    : (record.posterPath ?? record.backdropPath ?? record.backdropPathText);

  const imgSrc = imgError ? null : tmdbImg(imgPath, isExpanded || isLandscape || isTopTen ? 'w780' : 'w342');

  // ── dimensions — driven by RAIL_TYPE_CONFIG ─────────────────────────────
  const PRIME_HEIGHT = {
    xs: cfg.tiers.mobile,
    sm: cfg.tiers.tablet,
    md: cfg.tiers.desktop,
  };

  const cardWidth = (type === 'prime')
    ? {
      xs: `calc(${cfg.tiers.mobile}px * ${16 / 9})`,
      sm: `calc(${cfg.tiers.tablet}px * ${16 / 9})`,
      md: isExpanded
        ? `calc(${cfg.tiers.desktop}px * ${16 / 9})`
        : `calc(${cfg.tiers.desktop}px * ${9 / 16})`,
    }
    : (type === 'top10')
      ? { xs: Math.round(cfg.tiers.mobile * 2 / 3), sm: Math.round(cfg.tiers.tablet * 2 / 3), md: Math.round(cfg.tiers.desktop * 2 / 3) }
      : (type === 'wide' || type === 'continue')
        ? { xs: Math.round(cfg.tiers.mobile * 16 / 9), sm: Math.round(cfg.tiers.tablet * 16 / 9), md: Math.round(cfg.tiers.desktop * 16 / 9) }
        : (type === 'person')
          ? { xs: cfg.tiers.mobile, sm: cfg.tiers.tablet, md: cfg.tiers.desktop }
          : (type === 'jumbo')
            ? { xs: Math.round(cfg.tiers.mobile * 2 / 3), sm: Math.round(cfg.tiers.tablet * 2 / 3), md: Math.round(cfg.tiers.desktop * 2 / 3) }
            : // standard/billboard: xs/sm use mobileAspect (poster), md+ use cardAspect (backdrop)
            (() => {
              const [daw, dah] = cfg.cardAspect.split('/').map(Number);
              const dr = daw / dah;
              const mobAsp = cfg.mobileAspect ?? cfg.cardAspect;
              const [maw, mah] = mobAsp.split('/').map(Number);
              const mr = maw / mah;
              return {
                xs: Math.round(cfg.tiers.mobile * mr),
                sm: Math.round(cfg.tiers.tablet * mr),
                md: Math.round(cfg.tiers.desktop * dr),
              };
            })();

  const aspectRatio = effectiveAspect.replace('/', ' / ');

  // ── motion ────────────────────────────────────────────────────────────────
  // Prime cards: pure horizontal width expand — no lift, no shadow, no glow.
  // Non-prime cards keep the simple scale-on-hover behaviour.
  const motionAnimate = expandOnHover
    ? { zIndex: isExpanded ? 10 : 1 }
    : useInlineWideHover
      ? (hovered ? { scale: 1.02, y: -4, zIndex: 10 } : { scale: 1, y: 0, zIndex: 1 })
      : (hovered ? { scale: 1.03, zIndex: 10 } : { scale: 1, zIndex: 1 });

  const motionTransition = expandOnHover
    ? { duration: 0 }
    : useInlineWideHover
      ? { duration: 0.2, ease: 'easeOut' }
      : { duration: 0.15, ease: 'easeOut' };

  // ── Desktop prime rail: fixed portrait SLOT (never reflows) + an absolute
  // landscape overlay on hover that grows toward `expandDir`. Because the slot
  // footprint is constant, hovering across cards never shifts the row, so the
  // cursor lands on the next card instead of skipping several. ───────────────
  const desktopPrime = expandOnHover && !isMobile;
  if (desktopPrime) {
    const PRIME_H = cfg.tiers.desktop;
    const PORTRAIT = Math.round(PRIME_H * 9 / 16);   // 214
    const GAP = 6;                              // breathing room to neighbours
    const LANDSCAPE = Math.round(PRIME_H * 16 / 9) - GAP; // expanded width, minus the gap
    const portraitSrc = imgError ? null : tmdbImg(record.posterPath ?? record.backdropPath, 'w342');
    const landscapeSrc = imgError ? null : tmdbImg(record.backdropPath ?? record.posterPath, 'w780');
    const iconBtn = (title, onClick, child, extra = {}) => (
      <Tooltip title={title}>
        <IconButton size="small" onClick={onClick}
          sx={{ border: '1.5px solid rgba(255,255,255,.5)', color: '#fff', p: 0.65, '&:hover': { borderColor: '#fff' }, ...extra }}>
          {child}
        </IconButton>
      </Tooltip>
    );
    return (
      <Box
        ref={cardRef}
        component={motion.div}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onClick={goDetail}
        animate={{ zIndex: isExpanded ? 10 : 1 }}
        transition={{ duration: 0 }}
        sx={{ flexShrink: 0, position: 'relative', width: PORTRAIT, height: PRIME_H, cursor: 'pointer' }}
      >
        {/* Idle portrait poster — the fixed footprint */}
        <Box sx={{ position: 'absolute', inset: 0, borderRadius: 1.5, overflow: 'hidden', bgcolor: 'rgba(255,255,255,.06)' }}>
          {!imgLoaded && <Skeleton variant="rectangular" width="100%" height="100%" sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(255,255,255,.06)' }} />}
          {portraitSrc && (
            <Box component="img" src={portraitSrc} alt={record.title}
              onLoad={() => setImgLoaded(true)} onError={() => { setImgError(true); setImgLoaded(true); }}
              sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          )}
          {interaction.watched && (
            <Box sx={{ position: 'absolute', top: 6, right: 6, bgcolor: 'rgba(0,0,0,.72)', borderRadius: 10, px: 0.7, py: 0.2, display: 'flex', alignItems: 'center', gap: 0.3 }}>
              <Check sx={{ fontSize: 10, color: '#4caf50' }} />
              <Typography sx={{ fontSize: '0.6rem', color: '#4caf50', fontWeight: 700 }}>Watched</Typography>
            </Box>
          )}
        </Box>

        {/* Hover overlay — absolute landscape, grows toward expandDir (no reflow) */}
        {isExpanded && (
          <Box
            component={motion.div}
            initial={{ width: PORTRAIT, opacity: 0.5 }}
            animate={{ width: LANDSCAPE, opacity: 1 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            sx={{
              position: 'absolute', top: 0, height: PRIME_H,
              // Anchor to the slot edge on the side we came from; the GAP baked
              // into LANDSCAPE leaves a gap to the neighbour on the growing side
              // (the anchored side already has the rail's gap).
              ...(expandDir === 'left' ? { right: 0 } : { left: 0 }),
              borderRadius: 1.5, overflow: 'hidden', zIndex: 5, bgcolor: '#141414',
              // No shadow/glow — just the clean expand.
            }}
          >
            {landscapeSrc && (
              <Box component="img" src={landscapeSrc} alt={record.title}
                sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
            )}
            <Box sx={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              background: 'linear-gradient(to top, rgba(0,0,0,.97) 0%, rgba(0,0,0,.4) 75%, transparent 100%)',
              p: 1.6, pt: 4,
            }}>
              <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: '1.05rem', mb: 0.6, lineHeight: 1.2 }}>
                {record.title}
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.9, mb: 0.7, alignItems: 'center' }}>
                {record.voteAverage > 0 && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
                    <Star sx={{ fontSize: 15, color: '#46d369' }} />
                    <Typography sx={{ color: '#46d369', fontSize: '0.85rem', fontWeight: 700 }}>{Number(record.voteAverage).toFixed(1)}</Typography>
                  </Box>
                )}
                {year(record.releaseDate) && <Typography sx={{ color: 'rgba(255,255,255,.6)', fontSize: '0.85rem' }}>{year(record.releaseDate)}</Typography>}
              </Box>
              {record.genres?.length > 0 && (
                <Typography sx={{ color: 'rgba(255,255,255,.45)', fontSize: '0.74rem', mb: 1 }}>
                  {record.genres.slice(0, 3).join(' · ')}
                </Typography>
              )}
              <Box sx={{ display: 'flex', gap: 0.6, alignItems: 'center' }}>
                <Tooltip title="Play">
                  <IconButton size="small" onClick={goPlay} sx={{ bgcolor: '#fff', color: '#000', p: 0.7, '&:hover': { bgcolor: 'rgba(255,255,255,.85)' } }}>
                    <PlayArrow sx={{ fontSize: 18 }} />
                  </IconButton>
                </Tooltip>
                {!interaction?.watched && iconBtn(interaction.watchlisted ? 'In My List' : 'Add to My List',
                  (e) => { e.stopPropagation(); onWatchlist?.(record); },
                  interaction.watchlisted ? <BookmarkAdded sx={{ fontSize: 16 }} /> : <BookmarkAdd sx={{ fontSize: 16 }} />,
                  { color: interaction.watchlisted ? '#46d369' : '#fff' })}
                {iconBtn(interaction.liked ? 'Unlike' : 'Like',
                  (e) => { e.stopPropagation(); onLike?.(record); },
                  interaction.liked ? <ThumbUp sx={{ fontSize: 16 }} /> : <ThumbUpOutlined sx={{ fontSize: 16 }} />)}
                {iconBtn('More details', goDetail, <ExpandMore sx={{ fontSize: 18 }} />, { ml: 'auto' })}
              </Box>
            </Box>
          </Box>
        )}
      </Box>
    );
  }

  return (
    <motion.div
      ref={cardRef}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={isMobile ? goDetail : undefined}
      animate={motionAnimate}
      transition={motionTransition}
      tabIndex={isTv ? 0 : undefined}
      style={{ flexShrink: 0, cursor: 'pointer', position: 'relative', display: 'flex', alignItems: 'flex-end' }}
    >
      {/* ── Top 10 jumbo rank ── Netflix-style stroked numeral that sits
          alongside the poster and tucks behind the left edge for depth. */}
      {rank != null && (
        <Typography sx={{
          fontSize: { xs: '9rem', sm: '12rem', md: '16rem' },
          fontWeight: 900,
          fontFamily: '"Bebas Neue", "Helvetica Neue", Arial, sans-serif',
          lineHeight: 0.78,
          letterSpacing: { xs: '-0.06em', md: '-0.08em' },
          color: 'transparent',
          WebkitTextStroke: {
            xs: '3px rgba(255,255,255,0.92)',
            md: '5px rgba(255,255,255,0.92)',
          },
          mr: { xs: -2.5, sm: -3.5, md: -5 },
          mb: 0,
          zIndex: 0,
          userSelect: 'none',
          flexShrink: 0,
          textShadow: '4px 4px 18px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.6)',
          // Subtle entrance — fade-in plus a tiny rise so the numeral feels
          // like it slides in from the bottom alongside the poster.
          animation: 'topTenIn 0.45s ease-out both',
          '@keyframes topTenIn': {
            from: { opacity: 0, transform: 'translateY(8px)' },
            to: { opacity: 1, transform: 'translateY(0)' },
          },
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

          boxShadow: expandOnHover
            ? 'none'
            : useInlineWideHover
              ? (hovered ? '0 6px 14px rgba(0,0,0,.16)' : '0 1px 4px rgba(0,0,0,.10)')
              : (hovered ? '0 16px 48px rgba(0,0,0,.75)' : '0 2px 8px rgba(0,0,0,.3)'),

          transition: expandOnHover
            ? 'width 0.34s cubic-bezier(0.4,0,0.2,1)'
            : useInlineWideHover
              ? 'transform 0.2s ease, box-shadow 0.2s ease'
              : 'width 0.42s cubic-bezier(0.32,0.72,0,1), box-shadow 0.32s ease',

          ...(isTv && {
            '&:focus-visible': {
              outline: '4px solid',
              outlineColor: 'primary.main',
              outlineOffset: '4px',
              transform: 'scale(1.08)',
              zIndex: 10,
              transition: 'transform 0.15s ease',
            },
          }),
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

        {/* Prime expand: info bar.
            Mobile renders a simplified bar (title + rating + year only) — the
            whole card is tappable to open the detail page where all the
            interaction buttons live in the Hero. Desktop renders the full
            netflix-style bar with the interaction row, but only when actually
            hovered (not when the card just happens to be mounted at md). */}
        {isExpanded && isMobile && (
          <Box sx={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            background: 'linear-gradient(to top, rgba(0,0,0,.95) 0%, rgba(0,0,0,.45) 70%, transparent 100%)',
            p: 1, pt: 2.5,
          }}>
            <Typography sx={{
              color: '#fff', fontWeight: 700, fontSize: '0.82rem', lineHeight: 1.2,
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>
              {record.title}
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.75, mt: 0.4, alignItems: 'center' }}>
              {record.voteAverage > 0 && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
                  <Star sx={{ fontSize: 11, color: '#46d369' }} />
                  <Typography sx={{ color: '#46d369', fontSize: '0.7rem', fontWeight: 700 }}>
                    {Number(record.voteAverage).toFixed(1)}
                  </Typography>
                </Box>
              )}
              {year(record.releaseDate) && (
                <Typography sx={{ color: 'rgba(255,255,255,.55)', fontSize: '0.7rem' }}>
                  {year(record.releaseDate)}
                </Typography>
              )}
            </Box>
          </Box>
        )}

        {isExpanded && !isMobile && (
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
            {/* Full interaction row — desktop only */}
            <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
              <Tooltip title="Play">
                <IconButton size="small" onClick={goPlay}
                  sx={{ bgcolor: '#fff', color: '#000', p: 0.5, '&:hover': { bgcolor: 'rgba(255,255,255,.85)' } }}>
                  <PlayArrow sx={{ fontSize: 14 }} />
                </IconButton>
              </Tooltip>
              {!interaction?.watched && (
                <Tooltip title={interaction.watchlisted ? 'In My List' : 'Add to My List'}>
                  <IconButton size="small" onClick={(e) => { e.stopPropagation(); onWatchlist?.(record); }}
                    sx={{ border: '1.5px solid rgba(255,255,255,.5)', color: interaction.watchlisted ? '#46d369' : '#fff', p: 0.4, '&:hover': { borderColor: '#fff' } }}>
                    {interaction.watchlisted ? <BookmarkAdded sx={{ fontSize: 12 }} /> : <BookmarkAdd sx={{ fontSize: 12 }} />}
                  </IconButton>
                </Tooltip>
              )}
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
              <Tooltip title="More details">
                <IconButton size="small" onClick={goDetail}
                  sx={{ border: '1.5px solid rgba(255,255,255,.5)', color: '#fff', p: 0.4, ml: 'auto', '&:hover': { borderColor: '#fff' } }}>
                  <ExpandMore sx={{ fontSize: 15 }} />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        )}

        {/* Landscape card title overlays — three distinct styles per rail type.
            Hidden while hovered (popup takes over) and hidden when the displayed
            image already has the title burned in (backdropPathText present). */}
        {isLandscape && !expandOnHover && !hovered && !(useTextBackdrop && !!record.backdropPathText) && (() => {
          const titleStyle = cfg.titleStyle ?? 'fade';

          // ── Shared meta row ──────────────────────────────────────────────
          const metaRow = (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7, flexWrap: 'nowrap' }}>
              {record.voteAverage > 0 && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.2, flexShrink: 0 }}>
                  <Star sx={{ fontSize: 9, color: '#46d369' }} />
                  <Typography sx={{ color: '#46d369', fontSize: '0.6rem', fontWeight: 800, lineHeight: 1 }}>
                    {Number(record.voteAverage).toFixed(1)}
                  </Typography>
                </Box>
              )}
              {year(record.releaseDate) && (
                <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.6rem', lineHeight: 1, flexShrink: 0 }}>
                  {year(record.releaseDate)}
                </Typography>
              )}
              {record.genres?.length > 0 && (
                <Typography sx={{
                  color: 'rgba(255,255,255,0.32)', fontSize: '0.56rem', lineHeight: 1,
                  overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                }}>
                  {record.genres.slice(0, 2).join(' · ')}
                </Typography>
              )}
            </Box>
          );

          // ── Style: glass ─────────────────────────────────────────────────
          // Frosted-glass compact bar pinned to the bottom of the card.
          if (titleStyle === 'glass') return (
            <Box sx={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              backdropFilter: 'blur(14px) saturate(160%)',
              WebkitBackdropFilter: 'blur(14px) saturate(160%)',
              background: 'rgba(0,0,0,0.52)',
              borderTop: '1px solid rgba(255,255,255,0.07)',
              px: 1.2, pt: 0.65, pb: 0.6,
              pointerEvents: 'none',
            }}>
              <Typography sx={{
                color: '#fff', fontWeight: 700,
                fontSize: 'clamp(0.66rem, 1.7vw, 0.86rem)',
                lineHeight: 1.2, mb: 0.25,
                display: '-webkit-box', WebkitLineClamp: 1,
                WebkitBoxOrient: 'vertical', overflow: 'hidden',
                letterSpacing: 0.1,
              }}>
                {record.title}
              </Typography>
              {metaRow}
            </Box>
          );

          // ── Style: tag ───────────────────────────────────────────────────
          // Floating pill badge anchored to bottom-left. Shows only the title.
          if (titleStyle === 'tag') return (
            <Box sx={{
              position: 'absolute', bottom: 7, left: 7,
              maxWidth: '82%',
              bgcolor: 'rgba(0,0,0,0.68)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              borderRadius: '5px',
              px: 0.85, py: 0.4,
              border: '1px solid rgba(255,255,255,0.11)',
              pointerEvents: 'none',
            }}>
              <Typography sx={{
                color: '#fff', fontWeight: 650,
                fontSize: 'clamp(0.62rem, 1.5vw, 0.8rem)',
                lineHeight: 1.2,
                overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
              }}>
                {record.title}
              </Typography>
            </Box>
          );

          // ── Style: fade (default) ────────────────────────────────────────
          // Deep gradient from the bottom — title stacked above meta row.
          return (
            <Box sx={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              background: 'linear-gradient(to top, rgba(0,0,0,0.94) 0%, rgba(0,0,0,0.55) 52%, transparent 100%)',
              px: 1.2, pb: 1, pt: 3.5,
              pointerEvents: 'none',
            }}>
              <Typography sx={{
                color: '#fff', fontWeight: 750,
                fontSize: 'clamp(0.68rem, 1.8vw, 0.9rem)',
                lineHeight: 1.15, mb: 0.35,
                display: '-webkit-box', WebkitLineClamp: 1,
                WebkitBoxOrient: 'vertical', overflow: 'hidden',
                textShadow: '0 1px 8px rgba(0,0,0,0.9)',
                letterSpacing: 0.15,
              }}>
                {record.title}
              </Typography>
              {metaRow}
            </Box>
          );
        })()}

        {/* Poster title caption — only for type="poster" (posterPlain stays clean).
            Portrait cards have no landscape overlay, so this gives them a name bar. */}
        {cfg.showPosterTitle && !isLandscape && !expandOnHover && !hovered && (
          <Box sx={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.4) 55%, transparent 100%)',
            px: 1, pb: 0.8, pt: 2.5, pointerEvents: 'none',
          }}>
            <Typography sx={{
              color: '#fff', fontWeight: 700, fontSize: 'clamp(0.66rem, 1.6vw, 0.82rem)',
              lineHeight: 1.2, display: '-webkit-box', WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical', overflow: 'hidden',
              textShadow: '0 1px 6px rgba(0,0,0,0.9)',
            }}>
              {record.title}
            </Typography>
          </Box>
        )}

        {/* Wide / Continue inline hover details */}
        {hovered && useInlineWideHover && !isMobile && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-end',
              background: `
                linear-gradient(to top,
                  rgba(0,0,0,0.96) 0%,
                  rgba(0,0,0,0.82) 28%,
                  rgba(0,0,0,0.35) 62%,
                  rgba(0,0,0,0.06) 100%)
              `,
              p: 1.25,
            }}
          >
            <Box sx={{ mb: 0.7 }}>
              <Typography
                sx={{
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: '0.95rem',
                  lineHeight: 1.2,
                  mb: 0.35,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {record.title}
              </Typography>

              <Box sx={{ display: 'flex', gap: 0.7, alignItems: 'center', flexWrap: 'wrap', mb: 0.45 }}>
                {record.voteAverage > 0 && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                    <Star sx={{ fontSize: 12, color: '#46d369' }} />
                    <Typography sx={{ color: '#46d369', fontSize: '0.72rem', fontWeight: 800 }}>
                      {Number(record.voteAverage).toFixed(1)}
                    </Typography>
                  </Box>
                )}

                {year(record.releaseDate) && (
                  <Typography sx={{ color: 'rgba(255,255,255,.62)', fontSize: '0.72rem', fontWeight: 600 }}>
                    {year(record.releaseDate)}
                  </Typography>
                )}

                {record.genres?.length > 0 && (
                  <Typography
                    sx={{
                      color: 'rgba(255,255,255,.46)',
                      fontSize: '0.68rem',
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis',
                      maxWidth: '70%',
                    }}
                  >
                    {record.genres.slice(0, 3).join(' · ')}
                  </Typography>
                )}
              </Box>
            </Box>

            <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
              <Tooltip title="Play">
                <IconButton
                  size="small"
                  onClick={goPlay}
                  sx={{
                    bgcolor: '#fff',
                    color: '#000',
                    p: 0.55,
                    '&:hover': { bgcolor: 'rgba(255,255,255,.88)' },
                  }}
                >
                  <PlayArrow sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>

              {!interaction?.watched && (
                <Tooltip title={interaction.watchlisted ? 'In My List' : 'Add to My List'}>
                  <IconButton
                    size="small"
                    onClick={(e) => { e.stopPropagation(); onWatchlist?.(record); }}
                    sx={{
                      border: '1.5px solid rgba(255,255,255,.5)',
                      color: interaction.watchlisted ? '#46d369' : '#fff',
                      p: 0.42,
                      '&:hover': { borderColor: '#fff', bgcolor: 'rgba(255,255,255,.08)' },
                    }}
                  >
                    {interaction.watchlisted
                      ? <BookmarkAdded sx={{ fontSize: 13 }} />
                      : <BookmarkAdd sx={{ fontSize: 13 }} />}
                  </IconButton>
                </Tooltip>
              )}

              <Tooltip title={interaction.liked ? 'Unlike' : 'Like'}>
                <IconButton
                  size="small"
                  onClick={(e) => { e.stopPropagation(); onLike?.(record); }}
                  sx={{
                    border: '1.5px solid rgba(255,255,255,.5)',
                    color: '#fff',
                    p: 0.42,
                    '&:hover': { borderColor: '#fff', bgcolor: 'rgba(255,255,255,.08)' },
                  }}
                >
                  {interaction.liked
                    ? <ThumbUp sx={{ fontSize: 13 }} />
                    : <ThumbUpOutlined sx={{ fontSize: 13 }} />}
                </IconButton>
              </Tooltip>

              <Tooltip title={interaction.loved ? 'Loved' : 'Love it'}>
                <IconButton
                  size="small"
                  onClick={(e) => { e.stopPropagation(); onLove?.(record); }}
                  sx={{
                    border: '1.5px solid rgba(255,255,255,.5)',
                    color: interaction.loved ? '#e50914' : '#fff',
                    p: 0.42,
                    '&:hover': { borderColor: '#fff', bgcolor: 'rgba(255,255,255,.08)' },
                  }}
                >
                  {interaction.loved
                    ? <Favorite sx={{ fontSize: 13 }} />
                    : <FavoriteBorder sx={{ fontSize: 13 }} />}
                </IconButton>
              </Tooltip>

              <Tooltip title="More details">
                <IconButton
                  size="small"
                  onClick={goDetail}
                  sx={{
                    border: '1.5px solid rgba(255,255,255,.5)',
                    color: '#fff',
                    p: 0.42,
                    ml: 'auto',
                    '&:hover': { borderColor: '#fff', bgcolor: 'rgba(255,255,255,.08)' },
                  }}
                >
                  <ExpandMore sx={{ fontSize: 15 }} />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        )}

        {/* Default compact hover overlay (non-expand, on card itself) */}
        {hovered && !expandOnHover && !useInlineWideHover && (
          <Box sx={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to top, rgba(0,0,0,.85) 0%, rgba(0,0,0,.1) 55%, transparent 100%)',
            display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', p: 0.8,
          }}>
            <Typography sx={{
              color: '#fff', fontWeight: 700, fontSize: 'clamp(0.65rem, 2vw, 0.9rem)', lineHeight: 1.3, mb: 0.3,
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>
              {record.title}
            </Typography>
            {record.voteAverage > 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
                <Star sx={{ fontSize: 10, color: '#46d369' }} />
                <Typography sx={{ color: '#46d369', fontSize: 'clamp(0.6rem, 1.5vw, 0.78rem)', fontWeight: 700 }}>
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
      {hovered && !expandOnHover && !useInlineWideHover && !isMobile && anchorRect && (
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
