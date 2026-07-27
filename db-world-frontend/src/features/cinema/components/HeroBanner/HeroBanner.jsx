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
import HeroBannerDesktop from './HeroBannerDesktop';

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

const HeroSkeletonDesktop = ({ isMonitor, isTv }) => {
  // Mirror HeroBannerDesktop's `metrics` so the skeleton fills the same footprint
  // at every desktop-class size: desktop, large monitor and TV.
  const heroHeight = isTv
    ? 'clamp(760px, 90vh, 1120px)'
    : isMonitor
      ? 'clamp(680px, 88vh, 1040px)'
      : 'clamp(600px, 86vh, 940px)';

  const contentLeft = isTv ? 56 : isMonitor ? 72 : 56;
  const contentBottom = isTv ? 240 : isMonitor ? 206 : 176;
  const contentWidth = isTv
    ? 'min(35vw, 780px)'
    : isMonitor
      ? 'min(38vw, 680px)'
      : 'min(44vw, 560px)';

  // ~⅔ of the real logoMaxH (200 / 168 / 132) so it reads as a logo, not a slab.
  const logoW = isTv ? 360 : isMonitor ? 320 : 260;
  const logoH = isTv ? 132 : isMonitor ? 112 : 92;
  const buttonHeight = isTv ? 60 : 46;
  const roundBtn = isTv ? 54 : 42;
  const navBtn = isTv ? 44 : 36;
  const thumbW = isTv ? 132 : isMonitor ? 116 : 104;
  const thumbH = isTv ? 74 : isMonitor ? 66 : 58;
  const overviewLines = isTv ? 4 : 3;
  const lineWidths = ['86%', '78%', '70%', '58%'];

  return (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        height: heroHeight,
        overflow: 'hidden',
        bgcolor: 'transparent',
      }}
    >
      {/* Image shimmer */}
      <SkeletonBlock
        width="100%"
        height="100%"
        sx={{
          position: 'absolute',
          inset: 0,
          borderRadius: 0,
          bgcolor: shimmerStrong,
        }}
      />

      {/* Left reading gradient */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(to right, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.20) 40%, transparent 72%)',
          pointerEvents: 'none',
        }}
      />

      {/* Bottom dissolve */}
      <Box
        sx={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: '60%',
          background:
            'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.16) 48%, rgba(0,0,0,0.42) 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* Content shimmer */}
      <Box
        sx={{
          position: 'absolute',
          left: contentLeft,
          bottom: contentBottom,
          width: contentWidth,
          maxWidth: 'calc(100vw - 180px)',
        }}
      >
        {/* Logo placeholder (logo-first layout) */}
        <SkeletonBlock width={logoW} height={logoH} sx={{ mb: 2, borderRadius: 2 }} />

        {/* Single meta line: rating pill + genres · year · type */}
        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <SkeletonBlock width={64} height={22} sx={{ borderRadius: 999 }} />
          <SkeletonBlock width={56} height={16} />
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
          <SkeletonBlock width={140} height={buttonHeight} sx={{ borderRadius: 999 }} />
          <SkeletonBlock width={170} height={buttonHeight} sx={{ borderRadius: 999 }} />
          <SkeletonBlock width={roundBtn} height={roundBtn} sx={{ borderRadius: '50%' }} />
        </Box>
      </Box>

      {/* Slide navigator placeholder — right-side thumbnail strip */}
      <Box
        sx={{
          position: 'absolute',
          bottom: contentBottom,
          right: contentLeft,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
        }}
      >
        <SkeletonBlock width={navBtn} height={navBtn} sx={{ borderRadius: '50%' }} />
        {[0, 1, 2, 3].map((i) => (
          <SkeletonBlock
            key={i}
            width={thumbW}
            height={thumbH}
            sx={{ borderRadius: 1.5, bgcolor: shimmerStrong }}
          />
        ))}
        <SkeletonBlock width={navBtn} height={navBtn} sx={{ borderRadius: '50%' }} />
      </Box>
    </Box>
  );
};

// ─── HeroBanner ────────────────────────────────────────────────────────────

const HeroBanner = ({
  records = [],
  interactions = {},
  onWatchlist,
  loading,
  onColorExtracted,
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
      <HeroSkeletonDesktop isMonitor={isMonitor} isTv={isTv} />
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

  return (
    <HeroBannerDesktop
      {...commonProps}
      isMonitor={isMonitor}
      isTv={isTv}
      onHoverPause={pauseCycle}
      onHoverResume={resumeCycle}
    />
  );
};

export default HeroBanner;