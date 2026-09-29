import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { Box, Skeleton, useMediaQuery, useTheme } from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import { tmdbImg } from '../../api/cinemaApi';
import { openRecord } from '../../utils/recordNav';

import SpotlightMobileHero, { CARD_INSET, MAX_SPOTLIGHT_W } from './SpotlightMobileHero';
import SpotlightHero from '../Billboard/SpotlightHero';
import CategoryBillboard from '../Billboard/CategoryBillboard';

import { CYCLE_MS, heroArtCandidates } from './heroUtils';
import { useHeroColor } from './useHeroColor';
import { HERO_TOP_INSET } from '../../navbar/navMetrics';

// ─── Skeleton ──────────────────────────────────────────────────────────────

const shimmerBg = 'rgba(255,255,255,0.06)';
const shimmerStrong = 'rgba(255,255,255,0.09)';
// Furniture sitting ON a card, which is already lighter than the page behind it.
const shimmerOnCard = 'rgba(255,255,255,0.15)';

const SkeletonBlock = (props) => (
  <Skeleton
    variant="rectangular"
    animation="wave"
    {...props}
    sx={{
      bgcolor: shimmerBg,
      borderRadius: 1.2,
      // MUI's Skeleton root carries `height: 1.2em`, overridden to `auto` only for the
      // text variant. A definite height defeats `aspect-ratio` outright, so a
      // rectangular block sized by ratio collapsed to a ~19px bar — which is why the
      // mobile hero showed stripes where its poster card should have been. The `height`
      // PROP still wins over this, because MUI applies it as an inline style.
      height: 'auto',
      ...(props.sx || {}),
    }}
  />
);

/**
 * Mirrors SpotlightMobileHero.
 *
 * Same gutters, same card ratio, the same room left for the peeking edge, and the same
 * two blocks underneath — progress segments, then a full-width primary and two square
 * actions. The point is that the real hero lands at exactly this size and position, so
 * nothing shifts when it arrives.
 */
const HeroSkeletonMobile = ({ isXs, variant = 'spotlight' }) => {
  const gutter = isXs ? 16 : 24;            // SpotlightMobileHero's own gutter
  const ratio = isXs ? '3 / 2' : '16 / 9';  // and its card ratio

  return (
    <Box sx={{
      position: 'relative',
      overflowX: 'clip',
      pt: HERO_TOP_INSET,
      pb: 2.5,
      px: `${gutter}px`,
    }}>
      {/* Movies / TV draw a breadcrumb-and-heading line above the card; Home does not. */}
      {variant !== 'spotlight' && (
        <SkeletonBlock width={150} height={20} sx={{ borderRadius: 0.8, mb: 1.5 }} />
      )}

      <Box sx={{ width: '100%', maxWidth: MAX_SPOTLIGHT_W, mx: 'auto' }}>
        <Box sx={{
          position: 'relative',
          // The hero leaves this much of its own width to the next card's peeking edge.
          width: `calc(100% - ${CARD_INSET}px)`,
          aspectRatio: ratio,
          borderRadius: 4,
          overflow: 'hidden',
          bgcolor: shimmerStrong,
          border: '1px solid rgba(255,255,255,0.10)',
          boxShadow: '0 18px 40px rgba(0,0,0,0.55)',
        }}>
          {/* badge chip, top-left */}
          <SkeletonBlock
            width={92} height={24}
            sx={{ position: 'absolute', top: 12, left: 12, borderRadius: 999, bgcolor: shimmerOnCard }}
          />

          {/* title block + meta line, bottom-left — where the logo and meta land */}
          <Box sx={{ position: 'absolute', left: isXs ? 14 : 20, right: isXs ? 14 : 20, bottom: isXs ? 14 : 20 }}>
            <SkeletonBlock
              height={isXs ? 34 : 44}
              sx={{ width: '58%', borderRadius: 1, bgcolor: shimmerOnCard, mb: 1 }}
            />
            <SkeletonBlock height={14} sx={{ width: '72%', borderRadius: 0.8, bgcolor: shimmerOnCard }} />
          </Box>
        </Box>

        {/* progress segments — compact and centred, as in the live hero */}
        <Box sx={{
          display: 'flex', gap: '6px', alignItems: 'center', justifyContent: 'center',
          height: 24, mt: 1.5,
        }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <SkeletonBlock key={i} width={22} height={3} sx={{ borderRadius: 999 }} />
          ))}
        </Box>

        {/* Play, then My List and More Info — the hero's action row, same heights and
            gap, so the buttons land without pushing the first rail down. */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1.5 }}>
          <SkeletonBlock height={48} sx={{ flex: 1, borderRadius: 999 }} />
          <SkeletonBlock width={48} height={48} sx={{ borderRadius: 2, flexShrink: 0 }} />
          <SkeletonBlock width={48} height={48} sx={{ borderRadius: 2, flexShrink: 0 }} />
        </Box>
      </Box>
    </Box>
  );
};

const HeroSkeletonDesktop = ({ isMonitor, isTv, variant = 'spotlight' }) => {
  // Mirror the live billboard footprint so nothing jumps when the real hero loads.
  // Home = a rounded "spotlight" card inset in a gutter; Movies/TV = a full-bleed billboard
  // with a soft bottom fade and a thumbnail-navigator placeholder bottom-right.
  const isSpotlight = variant !== 'billboard';

  const gutter = isTv || isMonitor ? 40 : 28;
  const navClear = (isTv ? 76 : 68) + 14;
  const radius = isTv ? 22 : 18;
  const padX = isTv ? 60 : isMonitor ? 54 : 46;
  const padTop = isSpotlight ? (isTv ? 28 : 22) : isTv ? 100 : 88;
  const padBottom = isSpotlight
    ? isTv ? 96 : isMonitor ? 84 : 72
    : isTv ? 190 : isMonitor ? 170 : 150;
  const spotVh = isMonitor || isTv ? 95 : 110;

  const contentWidth = isTv ? 'min(42vw, 780px)' : isMonitor ? 'min(44vw, 680px)' : 'min(50vw, 560px)';
  // ~⅔ of the real logoMaxH so it reads as a title logo, not a slab.
  const logoW = isTv ? 320 : isMonitor ? 280 : 230;
  const logoH = isTv ? 116 : isMonitor ? 98 : 80;
  const btnH = isTv ? 56 : 46;
  const roundBtn = isTv ? 52 : 42;
  const overviewLines = isTv ? 4 : isMonitor ? 3 : 2;
  const lineWidths = ['88%', '80%', '72%', '60%'];
  const thumbW = isTv ? 108 : isMonitor ? 96 : 84;
  const thumbH = isTv ? 62 : isMonitor ? 56 : 48;

  const frame = (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        aspectRatio: '16 / 9',
        overflow: 'hidden',
        bgcolor: shimmerBg,
        ...(isSpotlight
          ? {
              maxHeight: `calc(${spotVh}vh - ${navClear + gutter}px)`,
              borderRadius: `${radius}px`,
              border: '1px solid rgba(255,255,255,0.12)',
            }
          : { minHeight: isTv ? '92vh' : '90vh', maxHeight: '100vh' }),
      }}
    >
      {/* Image shimmer */}
      <SkeletonBlock
        width="100%"
        height="100%"
        sx={{ position: 'absolute', inset: 0, borderRadius: 0, bgcolor: shimmerStrong }}
      />

      {/* Left reading scrim */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background:
            'linear-gradient(to right, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.20) 40%, transparent 72%)',
        }}
      />

      {/* Content shimmer — bottom-left, matching BillboardContent */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          zIndex: 2,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          px: `${padX}px`,
          pt: `${padTop}px`,
          pb: `${padBottom}px`,
        }}
      >
        <Box sx={{ width: contentWidth, maxWidth: 'calc(100% - 40px)' }}>
          {/* Ribbon: app-logo dot + type label */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <SkeletonBlock width={isTv ? 32 : 26} height={isTv ? 32 : 26} sx={{ borderRadius: '50%' }} />
            <SkeletonBlock width={72} height={12} />
          </Box>

          {/* Title logo */}
          <SkeletonBlock width={logoW} height={logoH} sx={{ mb: 2, borderRadius: 2 }} />

          {/* Meta line */}
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <SkeletonBlock width={54} height={16} />
            <SkeletonBlock width={64} height={16} />
            <SkeletonBlock width={44} height={16} />
          </Box>

          {/* Overview lines */}
          {Array.from({ length: overviewLines }).map((_, i) => (
            <SkeletonBlock
              key={i}
              width={lineWidths[i] ?? '60%'}
              height={14}
              sx={{ mb: i === overviewLines - 1 ? 2.5 : 1 }}
            />
          ))}

          {/* Play · More Info · round add */}
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <SkeletonBlock width={130} height={btnH} sx={{ borderRadius: 999 }} />
            <SkeletonBlock width={168} height={btnH} sx={{ borderRadius: 999 }} />
            <SkeletonBlock width={roundBtn} height={roundBtn} sx={{ borderRadius: '50%' }} />
          </Box>
        </Box>
      </Box>

      {/* Movies/TV: thumbnail-navigator placeholder bottom-right */}
      {!isSpotlight && (
        <Box sx={{ position: 'absolute', right: `${padX}px`, bottom: `${padBottom}px`, zIndex: 3, display: 'flex', gap: 1 }}>
          {[0, 1, 2].map((i) => (
            <SkeletonBlock key={i} width={thumbW} height={thumbH} sx={{ borderRadius: 2, opacity: i === 0 ? 1 : 0.5 }} />
          ))}
        </Box>
      )}
    </Box>
  );

  // Home insets the card in a gutter (with nav clearance); Movies/TV is full-bleed.
  return isSpotlight ? (
    <Box sx={{ px: `${gutter}px`, pt: `${navClear}px`, pb: `${gutter}px` }}>{frame}</Box>
  ) : (
    frame
  );
};

// ─── HeroBanner ────────────────────────────────────────────────────────────

/** Shared, frozen blank for the "no interactions yet" case — one identity forever,
 *  so a miss never allocates and never breaks a memo downstream. */
const EMPTY_INTERACTION = Object.freeze({});

const HeroBanner = ({
  records = [],
  interactions = {},
  onWatchlist,
  loading,
  onColorExtracted,
  variant = 'spotlight',
  heading = null,
  breadcrumb = null,
  breadcrumbHref = null,
  ranked = false,
  top10 = false,
  rankLabel = null,
}) => {
  const theme = useTheme();

  const isMobileLike = useMediaQuery(theme.breakpoints.down('md'));
  const isXs = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'md'));
  const isMonitor = useMediaQuery('(min-width:1536px)');
  const isTv = useMediaQuery('(min-width:1920px) and (min-height:900px)');
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

  const navigate = useNavigate();
  const location = useLocation();

  const [idx, setIdx] = useState(0);
  const [dir, setDir] = useState(1);
  const [heroColor, setHeroColor] = useState('20,20,20');

  const timerRef = useRef(null);

  // Eight suits the desktop thumbnail navigator, but eight segments in the
  // mobile progress bar read as a broken loading bar rather than a carousel.
  const featured = useMemo(
    () => records.slice(0, isMobileLike ? 5 : 8),
    [records, isMobileLike]
  );

  // Crossing the breakpoint can leave idx past the end of the shortened list,
  // which would blank the hero until the next tick.
  useEffect(() => {
    setIdx((i) => (i >= featured.length ? 0 : i));
  }, [featured.length]);

  const record = featured[idx] ?? null;
  // useMemo for the `?? {}`: that literal allocated a NEW object on every render
  // whenever the lookup missed, which is most renders for a title with no
  // interactions yet. `ix` goes straight into the mobile hero, so an unstable
  // identity here defeated its React.memo no matter what the deck did.
  const ix = useMemo(
    () => interactions[record?.id] ?? EMPTY_INTERACTION,
    [interactions, record?.id],
  );

  const goToDetail = useCallback(() => {
    if (!record) return;
    openRecord(navigate, location, record);
  }, [navigate, location, record]);

  const goToPlay = useCallback(() => {
    if (!record) return;
    openRecord(navigate, location, record, { play: true });
  }, [navigate, location, record]);

  const startCycle = useCallback(() => {
    clearInterval(timerRef.current);
    // Mobile auto-advances too — its segmented progress bar fills across one
    // CYCLE_MS, so the two would contradict each other if it didn't.
    if (featured.length <= 1 || reducedMotion) return;
    timerRef.current = setInterval(() => {
      setDir(1);
      setIdx((i) => (i + 1) % featured.length);
    }, CYCLE_MS);
  }, [featured.length, reducedMotion]);

  // Pause the auto-advance while the pointer is over the hero, resume on leave.
  const pauseCycle = useCallback(() => clearInterval(timerRef.current), []);
  const resumeCycle = useCallback(() => startCycle(), [startCycle]);

  useEffect(() => {
    startCycle();
    const handleVisibility = () => {
      if (document.hidden) clearInterval(timerRef.current);
      else startCycle();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      clearInterval(timerRef.current);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [startCycle]);

  const go = useCallback(
    (direction) => {
      if (featured.length <= 1) return;

      clearInterval(timerRef.current);

      setDir(direction);
      setIdx((i) => (i + direction + featured.length) % featured.length);

      startCycle();
    },
    [featured.length, startCycle]
  );

  const goToIndex = useCallback(
    (targetIndex) => {
      if (targetIndex === idx) return;

      clearInterval(timerRef.current);

      setDir(targetIndex > idx ? 1 : -1);
      setIdx(targetIndex);

      startCycle();
    },
    [idx, startCycle]
  );

  // Must be the SAME image the hero actually paints, at a cheap size. It used
  // to hardcode `posterPathClean ?? backdropPath`, which diverges from what
  // gets shown on tablets and desktop (backdrop-first) and on any title whose
  // clean poster is missing — so the page wash was sometimes keyed to artwork
  // that was never on screen.
  //
  // Every tier is backdrop-first now that the phone hero is a spotlight rather than a
  // poster deck, so there is one rule instead of a mobile branch.
  const colorImage = useMemo(() => {
    if (!record) return null;
    const path = heroArtCandidates(record, {
      portrait: false,
      hasLogo: Boolean(record.logoPath),
      titled: false,
    }).find(Boolean);
    return path ? tmdbImg(path, 'w342') : null;
  }, [record]);

  useHeroColor(colorImage, {
    darkenFactor: isMobileLike ? 0.42 : 0.36,
    onChange: (rgb) => {
      setHeroColor(rgb);
      onColorExtracted?.(rgb);
    },
  });

  // Warm BOTH neighbours, at the size this tier will actually request and via the same
  // candidate list the hero paints from. Only the next one was warmed before, and only by
  // raw backdropPath — so a backward swipe mounted a card whose artwork had never been
  // fetched. It appeared empty for a beat, which reads as a flicker at exactly the moment
  // the turn starts.
  useEffect(() => {
    if (featured.length < 2 || typeof Image === 'undefined') return;

    const size = isMobileLike ? (isXs ? 'w780' : 'w1280') : 'original';

    [
      (idx + 1) % featured.length,
      (idx - 1 + featured.length) % featured.length,
    ].forEach((i) => {
      const next = featured[i];
      const path = heroArtCandidates(next, {
        portrait: false,
        hasLogo: Boolean(next?.logoPath),
        titled: false,
      }).find(Boolean);
      if (path) {
        const img = new Image();
        img.src = tmdbImg(path, size);
      }
      // The TITLE LOGO too, not just the backdrop. It is a separate request that only
      // starts when the slide mounts, so it lands a beat after the artwork — which is
      // how the hero ends up on screen showing a picture, a rating and no name at all.
      if (next?.logoPath) {
        const logo = new Image();
        logo.src = tmdbImg(next.logoPath, 'w500');
      }
    });
  }, [idx, featured, isMobileLike, isXs]);

  if (loading && !record) {
    return isMobileLike ? (
      <HeroSkeletonMobile isXs={isXs} variant={variant} />
    ) : (
      <HeroSkeletonDesktop isMonitor={isMonitor} isTv={isTv} variant={variant} />
    );
  }

  if (!record) return null;

  const commonProps = {
    record,
    featured,
    idx,
    dir,
    ix,
    heroColor,
    reducedMotion,
    onWatchlist,
    go,
    goToIndex,
    goToPlay,
    goToDetail,
  };

  if (isMobileLike) {
    return (
      <SpotlightMobileHero
        {...commonProps}
        isXs={isXs}
        isTablet={isTablet}
        variant={variant}
        heading={heading}
        breadcrumb={breadcrumb}
        breadcrumbHref={breadcrumbHref}
        ranked={ranked}
        top10={top10}
        rankLabel={rankLabel}
        // A swipe should not be fighting the auto-advance clock.
        onInteract={pauseCycle}
        onInteractEnd={resumeCycle}
      />
    );
  }

  const tier = isTv ? 'tv' : isMonitor ? 'monitor' : 'desktop';
  const DesktopHero = variant === 'billboard' ? CategoryBillboard : SpotlightHero;

  return (
    <DesktopHero
      {...commonProps}
      isMonitor={isMonitor}
      isTv={isTv}
      tier={tier}
      heading={heading}
      breadcrumb={breadcrumb}
      breadcrumbHref={breadcrumbHref}
      ranked={ranked}
      onHoverPause={pauseCycle}
      onHoverResume={resumeCycle}
    />
  );
};

export default HeroBanner;