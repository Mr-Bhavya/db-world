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

import { CYCLE_MS } from './heroUtils';
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

const HeroSkeletonMobile = ({ isXs }) => {
  // Match HeroBannerMobile's `metrics.cardHeight` exactly so the row doesn't
  // resize when the real hero card loads in.
  const cardHeight = isXs ? '66svh' : '60svh';
  const cardRadius = isXs ? 18 : 22;

  return (
    <Box sx={{ px: { xs: 1.5, sm: 2 }, pt: { xs: 1, sm: 1.5 }, pb: { xs: 1.5, sm: 2 } }}>
      {/* Contained fixed-height card skeleton — matches the real hero card */}
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          height: cardHeight,
          borderRadius: `${cardRadius}px`,
          overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.10)',
          boxShadow: '0 18px 44px rgba(0,0,0,0.42)',
          bgcolor: shimmerBg,
        }}
      >
        {/* Image shimmer fills the card */}
        <SkeletonBlock
          width="100%"
          height="100%"
          sx={{ position: 'absolute', inset: 0, borderRadius: 0, bgcolor: shimmerStrong }}
        />

        {/* Bottom scrim */}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background:
              'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 30%, transparent 70%)',
          }}
        />

        {/* Content placeholders overlaid at the bottom */}
        <Box
          sx={{
            position: 'absolute',
            left: 0, right: 0, bottom: 0,
            zIndex: 2,
            px: 2,
            pb: 2,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 1,
          }}
        >
          {/* Logo-first layout: taller block reads as the title logo, not a label */}
          <SkeletonBlock width="62%" height={isXs ? 52 : 60} sx={{ borderRadius: 1 }} />
          <SkeletonBlock width="44%" height={12} sx={{ mb: 1 }} />

          {/* My List · Play · Info — Play height matches metrics.btnHeight */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.25 }}>
            <SkeletonBlock width={42} height={42} sx={{ borderRadius: '50%' }} />
            <SkeletonBlock width={150} height={isXs ? 44 : 48} sx={{ borderRadius: 1 }} />
            <SkeletonBlock width={42} height={42} sx={{ borderRadius: '50%' }} />
          </Box>

          <Box sx={{ display: 'flex', gap: 0.7, mt: 1.4 }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <Box
                key={i}
                sx={{
                  width: i === 0 ? 22 : 7,
                  height: 7,
                  borderRadius: 999,
                  bgcolor: i === 0 ? 'rgba(13,148,136,0.55)' : 'rgba(255,255,255,0.18)',
                }}
              />
            ))}
          </Box>
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

const HeroBanner = ({
  records = [],
  interactions = {},
  onWatchlist,
  loading,
  onColorExtracted,
  variant = 'spotlight',
  heading = null,
  breadcrumb = null,
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

  const featured = useMemo(() => records.slice(0, 8), [records]);
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
    // Auto-advance on desktop only; mobile stays on the tapped/swiped slide.
    if (featured.length <= 1 || reducedMotion || isMobileLike) return;
    timerRef.current = setInterval(() => {
      setDir(1);
      setIdx((i) => (i + 1) % featured.length);
    }, CYCLE_MS);
  }, [featured.length, reducedMotion, isMobileLike]);

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

  const colorImage = useMemo(() => {
    if (!record) return null;
    return tmdbImg(
      record.posterPathClean ?? record.backdropPath ?? record.backdropPathText,
      'w342'
    );
  }, [record]);

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
      ranked={ranked}
      onHoverPause={pauseCycle}
      onHoverResume={resumeCycle}
    />
  );
};

export default HeroBanner;