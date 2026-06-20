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

const HeroSkeletonMobile = ({ isXs, isTablet }) => {
  const heroHeight = isXs ? '68svh' : isTablet ? '62svh' : '65svh';
  const cardRadius = isXs ? 20 : 26;
  const panelRadius = isXs ? 18 : 22;
  const stripCardWidth = isXs ? 116 : 138;
  const stripCardHeight = isXs ? 68 : 80;

  return (
    <Box sx={{ position: 'relative', pb: 2.1 }}>
      <Box sx={{ px: { xs: 1.5, sm: 2 } }}>
        {/* Main hero skeleton */}
        <Box
          sx={{
            position: 'relative',
            width: '100%',
            height: heroHeight,
            borderRadius: `${cardRadius}px`,
            overflow: 'hidden',
            bgcolor: 'transparent',
            boxShadow: '0 20px 46px rgba(0,0,0,0.20)',
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

          {/* Soft visual shading */}
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              background:
                'linear-gradient(to bottom, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.04) 16%, rgba(0,0,0,0.08) 42%, rgba(0,0,0,0.24) 74%, rgba(0,0,0,0.46) 100%)',
            }}
          />

          {/* Bottom content panel */}
          <Box
            sx={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              p: isXs ? '0 14px 14px' : '0 18px 18px',
            }}
          >
            <Box
              sx={{
                borderRadius: `${panelRadius}px`,
                p: isXs ? 1.2 : 1.5,
                bgcolor: 'rgba(20,20,20,0.78)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              {/* Badges */}
              <Box sx={{ display: 'flex', gap: 0.7, mb: 1 }}>
                <SkeletonBlock width={48} height={20} sx={{ borderRadius: 999 }} />
                <SkeletonBlock width={64} height={20} sx={{ borderRadius: 999 }} />
              </Box>

              {/* Title */}
              <SkeletonBlock width="78%" height={22} sx={{ mb: 0.8 }} />
              <SkeletonBlock width="52%" height={22} sx={{ mb: 1.2 }} />

              {/* Meta */}
              <Box sx={{ display: 'flex', gap: 1, mb: 1.2 }}>
                <SkeletonBlock width={40} height={12} />
                <SkeletonBlock width={48} height={12} />
                <SkeletonBlock width={56} height={12} />
              </Box>

              {/* Overview */}
              <SkeletonBlock width="95%" height={11} sx={{ mb: 0.7 }} />
              <SkeletonBlock width="84%" height={11} sx={{ mb: 1.4 }} />

              {/* Actions */}
              <Box sx={{ display: 'flex', gap: 1 }}>
                <SkeletonBlock height={44} sx={{ flex: 1.2, borderRadius: 999 }} />
                <SkeletonBlock height={44} sx={{ flex: 1, borderRadius: 999 }} />
                <SkeletonBlock width={44} height={44} sx={{ borderRadius: 12 }} />
              </Box>
            </Box>
          </Box>
        </Box>

        {/* Preview strip skeleton */}
        <Box sx={{ pt: 1.2 }}>
          <Box
            sx={{
              display: 'flex',
              gap: 1,
              overflow: 'hidden',
              px: 0.2,
              pb: 0.35,
            }}
          >
            {[0, 1, 2, 3].map((i) => (
              <Box
                key={i}
                sx={{
                  flex: '0 0 auto',
                  width: stripCardWidth,
                  minWidth: stripCardWidth,
                  height: stripCardHeight,
                  borderRadius: 2,
                  overflow: 'hidden',
                  position: 'relative',
                  border:
                    i === 0
                      ? '2px solid rgba(13,148,136,0.55)'
                      : '1px solid rgba(255,255,255,0.08)',
                  boxShadow:
                    i === 0
                      ? '0 8px 18px rgba(13,148,136,0.14)'
                      : '0 8px 16px rgba(0,0,0,0.14)',
                }}
              >
                <SkeletonBlock
                  width="100%"
                  height="100%"
                  sx={{
                    borderRadius: 0,
                    bgcolor: shimmerStrong,
                  }}
                />
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    background:
                      'linear-gradient(to top, rgba(0,0,0,0.34) 0%, rgba(0,0,0,0.08) 58%, transparent 100%)',
                  }}
                />
                <Box
                  sx={{
                    position: 'absolute',
                    left: 8,
                    right: 8,
                    bottom: 6,
                  }}
                >
                  <SkeletonBlock width="78%" height={10} />
                </Box>
              </Box>
            ))}
          </Box>

          {/* Dots */}
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              gap: 0.75,
              pt: 1.05,
              pb: 0.1,
            }}
          >
            {[0, 1, 2, 3, 4].map((i) => (
              <Box
                key={i}
                sx={{
                  width: i === 0 ? 24 : 7,
                  height: 7,
                  borderRadius: 999,
                  bgcolor:
                    i === 0
                      ? 'rgba(13,148,136,0.55)'
                      : 'rgba(255,255,255,0.18)',
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
  const heroHeight = isTv
    ? 'clamp(760px, 86vh, 1100px)'
    : isMonitor
      ? 'clamp(680px, 82vh, 980px)'
      : 'clamp(560px, 78vh, 860px)';

  const contentLeft = isTv ? 56 : isMonitor ? 72 : 56;
  const contentBottom = isTv ? 160 : isMonitor ? 140 : 120;

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
          maxWidth: isTv ? 780 : 640,
          width: 'min(50vw, 780px)',
        }}
      >
        <Box sx={{ display: 'flex', gap: 1, mb: 1.6 }}>
          <SkeletonBlock width={64} height={22} sx={{ borderRadius: 999 }} />
          <SkeletonBlock width={48} height={16} />
          <SkeletonBlock width={42} height={16} />
        </Box>

        <SkeletonBlock width="82%" height={isTv ? 80 : 56} sx={{ mb: 2, borderRadius: 1 }} />
        <SkeletonBlock width="52%" height={isTv ? 80 : 56} sx={{ mb: 2.4, borderRadius: 1 }} />

        <Box sx={{ display: 'flex', gap: 1.4, mb: 2 }}>
          <SkeletonBlock width={70} height={14} />
          <SkeletonBlock width={80} height={14} />
          <SkeletonBlock width={64} height={14} />
        </Box>

        <SkeletonBlock width="86%" height={14} sx={{ mb: 1 }} />
        <SkeletonBlock width="78%" height={14} sx={{ mb: 1 }} />
        <SkeletonBlock width="62%" height={14} sx={{ mb: 2.5 }} />

        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <SkeletonBlock width={140} height={isTv ? 60 : 46} sx={{ borderRadius: 999 }} />
          <SkeletonBlock width={170} height={isTv ? 60 : 46} sx={{ borderRadius: 999 }} />
          <SkeletonBlock
            width={isTv ? 54 : 42}
            height={isTv ? 54 : 42}
            sx={{ borderRadius: '50%' }}
          />
        </Box>
      </Box>

      {/* Indicator dots */}
      <Box
        sx={{
          position: 'absolute',
          bottom: isTv ? 50 : 36,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: 0.8,
        }}
      >
        {[0, 1, 2, 3, 4].map((i) => (
          <Box
            key={i}
            sx={{
              width: i === 0 ? (isTv ? 30 : 24) : isTv ? 10 : 8,
              height: isTv ? 10 : 8,
              borderRadius: 999,
              bgcolor:
                i === 0
                  ? 'rgba(13,148,136,0.55)'
                  : 'rgba(255,255,255,0.22)',
            }}
          />
        ))}
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
    if (featured.length <= 1 || reducedMotion) return;
    timerRef.current = setInterval(() => {
      setDir(1);
      setIdx((i) => (i + 1) % featured.length);
    }, CYCLE_MS);
  }, [featured.length, reducedMotion]);

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
    />
  );
};

export default HeroBanner;