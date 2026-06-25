import React from 'react';
import { motion } from 'framer-motion';
import { Box, Typography, Skeleton } from '@mui/material';
import { tmdbImg } from '../../api/cinemaApi';
import { RAIL_TYPE_CONFIG, RAIL_TYPE_DEFAULT } from '../RailRow/railTypeConfig';
import useCardInteraction from './parts/useCardInteraction';
import { resolveCardImage } from './parts/cardImage';
import RecordCardSkeleton from './parts/RecordCardSkeleton';
import HoverPopup from './parts/HoverPopup';
import PrimeDesktopCard from './parts/PrimeDesktopCard';
import {
  CardTitleOverlay, PosterCaption, ExpandedInfoBar,
  WideHoverOverlay, CompactHoverOverlay, WatchedBadge,
} from './parts/CardOverlays';

// Re-exported for the rail rows that import it from here.
export { RecordCardSkeleton };

// ─── RecordCard ───────────────────────────────────────────────────────────────
//
// Thin shell: resolves the display type + dimensions + image, owns shared
// interaction state (via useCardInteraction), then either dispatches the
// distinct desktop-prime layout or renders the standard card box with the
// per-type overlay components from ./parts/CardOverlays.

const RecordCard = ({
  record, rank, expandOnHover = false, type: typeProp, wide = false, interaction = {},
  index, onHoverExpand, expandDir = 'left', imageVariant = null,
  forceExpanded = false, onWatchlist, onLike, onLove, onWatched
}) => {

  // Resolve type: explicit prop wins, then infer from legacy boolean props
  const type = typeProp ?? (expandOnHover ? 'prime' : rank != null ? 'top10' : wide ? 'wide' : 'standard');
  const cfg = RAIL_TYPE_CONFIG[type] ?? RAIL_TYPE_CONFIG[RAIL_TYPE_DEFAULT];
  const isWideType = type === 'wide' || type === 'continue';
  const useInlineWideHover = isWideType;

  const {
    isMobile, tier, isTv,
    hovered, anchorRect, cardRef,
    imgError, imgLoaded, setImgError, setImgLoaded,
    onMouseEnter, onMouseLeave, goDetail, goPlay,
  } = useCardInteraction({ expandOnHover, useInlineWideHover, index, onHoverExpand, record });

  // Standard cards use poster (2:3) on mobile/tablet, backdrop (16:9) on desktop/tv
  const isMobileTier = tier === 'mobile' || tier === 'tablet';
  const effectiveAspect = (cfg.mobileAspect && isMobileTier) ? cfg.mobileAspect : cfg.cardAspect;
  const isLandscape = effectiveAspect === '16/9';

  if (!record) return <RecordCardSkeleton wide={wide} prime={expandOnHover} top10={rank != null} />;

  // Mobile has no hover, so prime cards always show in the featured landscape state.
  const isExpanded = expandOnHover && (forceExpanded || hovered || isMobile);
  const isTopTen = rank != null;

  // ── image — display-type default + per-rail imageVariant ──────────────────
  const { useTextBackdrop, imgPath } = resolveCardImage({
    record, cfg, imageVariant, landscape: isExpanded || isLandscape,
  });
  const imgSrc = imgError ? null : tmdbImg(imgPath, isExpanded || isLandscape || isTopTen ? 'w780' : 'w342');

  // ── Desktop prime: distinct fixed-slot / expand-on-hover layout ────────────
  if (expandOnHover && !isMobile) {
    return (
      <PrimeDesktopCard
        record={record} interaction={interaction} cfg={cfg}
        expandDir={isExpanded ? expandDir : 'right'} isExpanded={isExpanded}
        cardRef={cardRef} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}
        goDetail={goDetail} goPlay={goPlay}
        imgError={imgError} imgLoaded={imgLoaded} setImgError={setImgError} setImgLoaded={setImgLoaded}
        onWatchlist={onWatchlist} onLike={onLike}
      />
    );
  }

  // ── dimensions — driven by RAIL_TYPE_CONFIG ─────────────────────────────
  const PRIME_HEIGHT = { xs: cfg.tiers.mobile, sm: cfg.tiers.tablet, md: cfg.tiers.desktop };

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

  // Whether to show the static landscape title overlay (hidden while hovered or
  // when the image already has the title burned in).
  const showTitleOverlay = isLandscape && !expandOnHover && !hovered
    && !(useTextBackdrop && !!record.backdropPathText);

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
      {/* ── Top 10 stroked rank numeral ── */}
      {rank != null && (
        <Typography sx={{
          fontSize: { xs: '9rem', sm: '12rem', md: '16rem' },
          fontWeight: 900,
          fontFamily: '"Bebas Neue", "Helvetica Neue", Arial, sans-serif',
          lineHeight: 0.78,
          letterSpacing: { xs: '-0.06em', md: '-0.08em' },
          color: 'transparent',
          WebkitTextStroke: { xs: '3px rgba(255,255,255,0.92)', md: '5px rgba(255,255,255,0.92)' },
          mr: { xs: -2.5, sm: -3.5, md: -5 },
          mb: 0, zIndex: 0, userSelect: 'none', flexShrink: 0,
          textShadow: '4px 4px 18px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.6)',
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
              outline: '4px solid', outlineColor: 'primary.main', outlineOffset: '4px',
              transform: 'scale(1.08)', zIndex: 10, transition: 'transform 0.15s ease',
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

        {/* Prime expanded info bar (mobile prime renders here; desktop prime uses PrimeDesktopCard) */}
        {isExpanded && (
          <ExpandedInfoBar
            record={record} interaction={interaction} isMobile={isMobile}
            goPlay={goPlay} onWatchlist={onWatchlist} onLike={onLike} onLove={onLove}
            onWatched={onWatched} goDetail={goDetail}
          />
        )}

        {/* Static landscape title overlay (glass / tag / fade) */}
        {showTitleOverlay && <CardTitleOverlay record={record} titleStyle={cfg.titleStyle ?? 'fade'} />}

        {/* Poster title caption — type="poster" only */}
        {cfg.showPosterTitle && !isLandscape && !expandOnHover && !hovered && (
          <PosterCaption record={record} />
        )}

        {/* Wide / Continue inline hover panel */}
        {hovered && useInlineWideHover && !isMobile && (
          <WideHoverOverlay
            record={record} interaction={interaction}
            goPlay={goPlay} onWatchlist={onWatchlist} onLike={onLike} onLove={onLove} goDetail={goDetail}
          />
        )}

        {/* Default compact hover overlay (poster/standard/jumbo) */}
        {hovered && !expandOnHover && !useInlineWideHover && <CompactHoverOverlay record={record} />}

        {/* Watched badge */}
        {interaction.watched && <WatchedBadge />}
      </Box>

      {/* Netflix portal popup — desktop, non-prime mode */}
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
