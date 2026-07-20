import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Box, Typography, Skeleton } from '@mui/material';
import { tmdbImg } from '../../api/cinemaApi';
import { RAIL_TYPE_CONFIG, RAIL_TYPE_DEFAULT } from '../RailRow/railTypeConfig';
import useCardInteraction from './parts/useCardInteraction';
import { useViewportWidth, fluidDesktopHeight } from '../../hooks/useFluidCardSize';
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
  forceExpanded = false, onWatchlist, onLike, onLove, onWatched, edgeArrowRef = null,
}) => {

  // Resolve type: explicit prop wins, then infer from legacy boolean props
  const type = typeProp ?? (expandOnHover ? 'prime' : rank != null ? 'top10' : wide ? 'wide' : 'standard');
  const cfg = RAIL_TYPE_CONFIG[type] ?? RAIL_TYPE_CONFIG[RAIL_TYPE_DEFAULT];

  // Single source of truth for "is this a prime card". Previously the prime
  // branches keyed off the legacy `expandOnHover` boolean, so a rail passing
  // `type="prime"` (without the old flag) silently rendered a dead portrait.
  const isPrime = type === 'prime';
  const isWideType = type === 'wide' || type === 'continue';
  const useInlineWideHover = isWideType;

  const {
    isMobile, tier, isTv,
    hovered, anchorRect, cardRef,
    imgError, imgLoaded, setImgError, setImgLoaded,
    onMouseEnter, onMouseLeave, closeNow, goDetail, goPlay,
  } = useCardInteraction({ expandOnHover: isPrime, useInlineWideHover, index, onHoverExpand, record });

  // Fluid desktop card height — scales smoothly with the viewport so a small
  // laptop and a large monitor get proportional cards (see useFluidCardSize).
  const vw = useViewportWidth();
  const deskH = fluidDesktopHeight(cfg.tiers.desktop, tier, vw);

  // Standard cards use poster (2:3) on mobile/tablet, backdrop (16:9) on desktop/tv
  const isMobileTier = tier === 'mobile' || tier === 'tablet';
  const effectiveAspect = (cfg.mobileAspect && isMobileTier) ? cfg.mobileAspect : cfg.cardAspect;
  const isLandscape = effectiveAspect === '16/9';

  if (!record) return <RecordCardSkeleton wide={wide} prime={isPrime} top10={rank != null} />;

  // Desktop expands a portrait slot to landscape on hover. Mobile has no hover,
  // so it shows the portrait poster (same shape as the desktop idle slot) and
  // opens the detail page on tap.
  const isExpanded = isPrime && (forceExpanded || hovered);
  const isTopTen = rank != null;

  // ── image — display-type default + per-rail imageVariant ──────────────────
  const { useTextBackdrop, imgPath } = resolveCardImage({
    record, cfg, imageVariant, landscape: isExpanded || isLandscape,
  });
  const imgSrc = imgError ? null : tmdbImg(imgPath, isExpanded || isLandscape || isTopTen ? 'w780' : 'w342');

  // Still shown behind the hover popup's trailer. A LANDSCAPE card already shows a
  // backdrop, so the popup must reuse that exact same image — otherwise the artwork
  // visibly swaps on hover (e.g. text backdrop → clean backdrop). A PORTRAIT card
  // (poster/top10/jumbo) keeps the landscape backdrop still, which is the intended
  // look. Either way the trailer then fades in on top.
  const popupStillSrc = isLandscape
    ? imgSrc
    : tmdbImg(record.backdropPath ?? record.posterPath, 'w780');

  // ── Desktop prime: distinct fixed-slot / expand-on-hover layout ────────────
  if (isPrime && !isMobile) {
    return (
      <PrimeDesktopCard
        record={record} interaction={interaction} cfg={cfg} primeHeight={deskH}
        expandDir={expandDir} isExpanded={isExpanded}
        cardRef={cardRef} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}
        goDetail={goDetail} goPlay={goPlay}
        imgError={imgError} imgLoaded={imgLoaded} setImgError={setImgError} setImgLoaded={setImgLoaded}
        onWatchlist={onWatchlist} onLike={onLike} onLove={onLove}
      />
    );
  }

  // ── dimensions — driven by RAIL_TYPE_CONFIG ─────────────────────────────
  // Prime uses the SAME portrait size on mobile/tablet as desktop (deskH), so the
  // featured rail is equally prominent everywhere; mobile just has no hover-expand
  // (tap opens the detail via the standard-render onClick below).
  const PRIME_HEIGHT = { xs: deskH, sm: deskH, md: deskH };

  const cardWidth = (type === 'prime')
    ? {
      xs: `calc(${deskH}px * ${9 / 16})`,
      sm: `calc(${deskH}px * ${9 / 16})`,
      md: isExpanded
        ? `calc(${deskH}px * ${16 / 9})`
        : `calc(${deskH}px * ${9 / 16})`,
    }
    : (type === 'top10')
      ? { xs: Math.round(cfg.tiers.mobile * 2 / 3), sm: Math.round(cfg.tiers.tablet * 2 / 3), md: Math.round(deskH * 2 / 3) }
      : (type === 'wide' || type === 'continue')
        ? { xs: Math.round(cfg.tiers.mobile * 16 / 9), sm: Math.round(cfg.tiers.tablet * 16 / 9), md: Math.round(deskH * 16 / 9) }
        : (type === 'person')
          ? { xs: cfg.tiers.mobile, sm: cfg.tiers.tablet, md: deskH }
          : (type === 'jumbo')
            ? { xs: Math.round(cfg.tiers.mobile * 2 / 3), sm: Math.round(cfg.tiers.tablet * 2 / 3), md: Math.round(deskH * 2 / 3) }
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
                md: Math.round(deskH * dr),
              };
            })();

  const aspectRatio = effectiveAspect.replace('/', ' / ');

  // ── motion ────────────────────────────────────────────────────────────────
  const motionAnimate = isPrime
    ? { zIndex: isExpanded ? 10 : 1 }
    : useInlineWideHover
      ? (hovered ? { scale: 1.02, y: -4, zIndex: 10 } : { scale: 1, y: 0, zIndex: 1 })
      // Popup cards: the portal popup fully covers the card on hover, so a scale
      // bump here would only flash a faint double-image behind it — keep it still
      // and let the popup do the "grow" so the morph reads as one entity.
      : (hovered ? { scale: 1, zIndex: 10 } : { scale: 1, zIndex: 1 });

  const motionTransition = isPrime
    ? { duration: 0 }
    : useInlineWideHover
      ? { duration: 0.2, ease: 'easeOut' }
      : { duration: 0.15, ease: 'easeOut' };

  // Whether to show the static landscape title overlay (hidden while hovered or
  // when the image already has the title burned in).
  const showTitleOverlay = isLandscape && !isPrime && !hovered
    && !(useTextBackdrop && !!record.backdropPathText);

  return (
    <motion.div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={isMobile ? goDetail : undefined}
      animate={motionAnimate}
      transition={motionTransition}
      tabIndex={isTv ? 0 : undefined}
      style={{ flexShrink: 0, cursor: 'pointer', position: 'relative', display: 'flex', alignItems: 'flex-end' }}
    >
      {/* ── Top 10 rank numeral (Netflix) — metallic gradient fill + crisp edge, held
             in a fixed-height, clipped wrapper so the oversized glyph can NEVER make
             the row taller than the poster (which was creating a vertical scroll: with
             overflowX:auto the container's overflowY:visible computes to auto, so any
             vertical overflow becomes scrollable). ── */}
      {rank != null && (
        <Box sx={{
          height: { xs: cfg.tiers.mobile, sm: cfg.tiers.tablet, md: deskH },
          display: 'flex', alignItems: 'flex-end', overflow: 'hidden',
          flexShrink: 0, zIndex: 0, pointerEvents: 'none',
          mr: { xs: -1.5, sm: -2.5, md: -3.5 },   // poster tucks over the numeral's right edge
          animation: 'topTenIn 0.45s cubic-bezier(0.22,1,0.36,1) both',
          '@keyframes topTenIn': {
            from: { opacity: 0, transform: 'scale(0.94)' },
            to: { opacity: 1, transform: 'scale(1)' },
          },
        }}>
          <Typography sx={{
            fontSize: { xs: '11rem', sm: '13rem', md: '16rem' },
            fontWeight: 900,
            fontFamily: '"Bebas Neue", "Helvetica Neue", Arial, sans-serif',
            lineHeight: 0.78,
            letterSpacing: { xs: '-0.04em', md: '-0.06em' },
            // Brushed-metal gradient fill with a dark edge so it reads on any poster.
            background: 'linear-gradient(180deg, #ffffff 0%, #d6dce2 44%, #8b95a1 72%, #5b646f 100%)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            color: 'transparent',
            WebkitTextStroke: { xs: '1.5px rgba(0,0,0,0.45)', md: '2.5px rgba(0,0,0,0.5)' },
            userSelect: 'none',
            filter: 'drop-shadow(2px 5px 12px rgba(0,0,0,0.85))',
          }}>
            {rank}
          </Typography>
        </Box>
      )}

      {/* ── Card box ── */}
      <Box
        ref={cardRef}
        sx={{
          width: cardWidth,
          height: isPrime ? PRIME_HEIGHT : undefined,
          aspectRatio: !isPrime ? aspectRatio : undefined,
          borderRadius: 1,
          overflow: 'hidden',
          bgcolor: 'rgba(255,255,255,.06)',
          position: 'relative',
          boxShadow: isPrime
            ? 'none'
            : useInlineWideHover
              ? (hovered ? '0 6px 14px rgba(0,0,0,.16)' : '0 1px 4px rgba(0,0,0,.10)')
              : (hovered ? '0 16px 48px rgba(0,0,0,.75)' : '0 2px 8px rgba(0,0,0,.3)'),
          transition: isPrime
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
        {cfg.showPosterTitle && !isLandscape && !isPrime && !hovered && (
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
        {hovered && !isPrime && !useInlineWideHover && <CompactHoverOverlay record={record} />}

        {/* Watched badge */}
        {interaction.watched && <WatchedBadge />}
      </Box>

      {/* Netflix portal popup — desktop, non-prime mode */}
      <AnimatePresence>
        {hovered && !isPrime && !useInlineWideHover && !isMobile && anchorRect && (
          <HoverPopup
            key={`hover-popup-${record.id}`}
            record={record}
            interaction={interaction}
            onWatchlist={onWatchlist}
            onLike={onLike}
            onLove={onLove}
            onWatched={onWatched}
            anchorRect={anchorRect}
            anchorRef={cardRef}
            edgeArrowRef={edgeArrowRef}
            stillSrc={popupStillSrc}
            onClose={onMouseLeave}
            onDismiss={closeNow}
            onHoverEnter={onMouseEnter}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default RecordCard;