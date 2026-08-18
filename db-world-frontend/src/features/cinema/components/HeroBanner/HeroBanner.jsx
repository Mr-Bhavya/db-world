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

import HeroBannerMobile from './HeroBannerMobile';
import SpotlightHero from '../Billboard/SpotlightHero';
import CategoryBillboard from '../Billboard/CategoryBillboard';

import { CYCLE_MS, heroArtCandidates } from './heroUtils';
import { useHeroColor } from './useHeroColor';

// ─── Skeleton ──────────────────────────────────────────────────────────────

const shimmerBg = 'rgba(255,255,255,0.06)';
const shimmerStrong = 'rgba(255,255,255,0.09)';

const SkeletonBlock = (props) => (
  <Skeleton
    variant="rectangular"
    animation="wave"
    {...props}
    sx={{
      bgcolor: shimmerBg,
      borderRadius: 1.2,
      ...(props.sx || {}),
    }}
  />
);

const HeroSkeletonMobile = ({ isXs }) => (
  // Mirrors HeroBannerMobile exactly: full-bleed frame, MIN-height (never a
  // fixed height), content bottom-anchored in flow. Same min-height expression
  // as the real hero so the page doesn't jump when it loads in.
  <Box
    sx={{
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-end',
      minHeight: isXs ? 'clamp(480px, 74vh, 780px)' : 'clamp(540px, 68vh, 900px)',
      '@supports (height: 1svh)': {
        minHeight: isXs ? 'clamp(480px, 74svh, 780px)' : 'clamp(540px, 68svh, 900px)',
      },
      pt: 'calc(56px + env(safe-area-inset-top, 0px))',
      overflow: 'hidden',
      bgcolor: shimmerBg,
    }}
  >
    <SkeletonBlock
      width="100%"
      height="100%"
      sx={{ position: 'absolute', inset: 0, borderRadius: 0, bgcolor: shimmerStrong }}
    />

    {/* Same three-layer scrim shape as the real hero, neutral variant */}
    <Box
      aria-hidden
      sx={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        background: `
          linear-gradient(to top,
            #141414 0%, rgba(20,20,20,0.97) 8%, rgba(20,20,20,0.86) 20%,
            rgba(20,20,20,0.58) 38%, rgba(20,20,20,0.22) 58%, rgba(20,20,20,0) 80%),
          linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, transparent 26%)
        `,
      }}
    />

    <Box
      sx={{
        position: 'relative',
        zIndex: 2,
        mt: 'auto',
        px: { xs: 2.5, sm: 5 },
      }}
    >
      <Box
        sx={{
          width: '100%',
          maxWidth: { xs: 560, sm: 680 },
          mx: 'auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 1.15,
        }}
      >
        {/* Ribbon: DB mark + type label */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <SkeletonBlock width={22} height={22} sx={{ borderRadius: '50%' }} />
          <SkeletonBlock width={54} height={10} />
        </Box>

        {/* Title logo */}
        <SkeletonBlock width="66%" height={isXs ? 58 : 74} sx={{ borderRadius: 1.5 }} />

        {/* Meta line */}
        <SkeletonBlock width="52%" height={12} />

        {/* My List · Play · Info — the three-across row */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1.75, sm: 3 }, mt: 0.6 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
            <SkeletonBlock width={26} height={26} sx={{ borderRadius: 1 }} />
            <SkeletonBlock width={44} height={9} />
          </Box>
          <SkeletonBlock width={isXs ? 150 : 190} height={48} sx={{ borderRadius: 1.2 }} />
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
            <SkeletonBlock width={26} height={26} sx={{ borderRadius: 1 }} />
            <SkeletonBlock width={28} height={9} />
          </Box>
        </Box>
      </Box>
    </Box>

    {/* Dots — same 30x44 hit cells as the real hero */}
    <Box
      sx={{
        position: 'relative',
        zIndex: 2,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        pt: 0.25,
        pb: 'calc(4px + env(safe-area-inset-bottom, 0px))',
      }}
    >
      {[0, 1, 2, 3, 4].map((i) => (
        <Box key={i} sx={{ width: 30, height: 44, display: 'grid', placeItems: 'center' }}>
          <Box
            sx={{
              width: i === 0 ? 18 : 6,
              height: 6,
              borderRadius: 999,
              bgcolor: i === 0 ? 'rgba(20,184,166,0.6)' : 'rgba(255,255,255,0.18)',
            }}
          />
        </Box>
      ))}
    </Box>
  </Box>
);

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
  const ix = interactions[record?.id] ?? {};

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
  const colorImage = useMemo(() => {
    if (!record) return null;
    const path = heroArtCandidates(record, {
      portrait: isXs,
      hasLogo: Boolean(record.logoPath),
    }).find(Boolean);
    return path ? tmdbImg(path, 'w342') : null;
  }, [record, isXs]);

  useHeroColor(colorImage, {
    darkenFactor: isMobileLike ? 0.42 : 0.36,
    onChange: (rgb) => {
      setHeroColor(rgb);
      onColorExtracted?.(rgb);
    },
  });

  // Preload next backdrop
  useEffect(() => {
    if (featured.length < 2) return;

    const nextIdx = (idx + 1) % featured.length;
    const nextRecord = featured[nextIdx];

    const nextUrl = tmdbImg(
      nextRecord?.backdropPath ?? nextRecord?.backdropPathText,
      'original'
    );

    if (nextUrl) {
      const img = new Image();
      img.src = nextUrl;
    }
  }, [idx, featured]);

  if (loading && !record) {
    return isMobileLike ? (
      <HeroSkeletonMobile isXs={isXs} isTablet={isTablet} />
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
      <HeroBannerMobile
        {...commonProps}
        isXs={isXs}
        isTablet={isTablet}
        variant={variant}
        heading={heading}
        breadcrumb={breadcrumb}
        breadcrumbHref={breadcrumbHref}
        ranked={ranked}
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