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

import {
  CYCLE_MS,
  extractDominantColor,
  darken,
  updateThemeColor,
} from './heroUtils';

const HeroBannerSkeleton = ({ isMobileLike, isTv }) => {
  if (isMobileLike) {
    return (
      <Box
        sx={{
          minHeight: '82svh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          pt: 'max(16px, env(safe-area-inset-top))',
          pb: 2,
          px: 2,
          background:
            'linear-gradient(to bottom, rgb(var(--hero-color, 20,20,20)) 0%, var(--cinema-bg, #141414) 100%)',
        }}
      >
        <Box
          sx={{
            width: { xs: 'min(76vw, 320px)', sm: 'min(58vw, 360px)' },
            aspectRatio: '2 / 3',
            borderRadius: 3,
            overflow: 'hidden',
            bgcolor: 'rgba(255,255,255,.07)',
          }}
        >
          <Skeleton
            variant="rectangular"
            width="100%"
            height="100%"
            sx={{ bgcolor: 'rgba(255,255,255,.07)' }}
          />
        </Box>

        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 1.2,
            mt: 2.5,
            width: { xs: 'min(76vw, 320px)', sm: 'min(58vw, 360px)' },
          }}
        >
          <Skeleton
            variant="rounded"
            height={52}
            sx={{ bgcolor: 'rgba(255,255,255,.07)', borderRadius: 2 }}
          />
          <Skeleton
            variant="rounded"
            height={52}
            sx={{ bgcolor: 'rgba(255,255,255,.07)', borderRadius: 2 }}
          />
          <Skeleton
            variant="rounded"
            height={52}
            sx={{ bgcolor: 'rgba(255,255,255,.07)', borderRadius: 2 }}
          />
        </Box>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        width: '100%',
        height: isTv ? 'clamp(760px, 86vh, 1100px)' : 'clamp(560px, 78vh, 860px)',
        bgcolor: '#0a0a0a',
      }}
    >
      <Skeleton
        variant="rectangular"
        width="100%"
        height="100%"
        sx={{ bgcolor: 'rgba(255,255,255,.05)' }}
      />
    </Box>
  );
};

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
  const [progressKey, setProgressKey] = useState(0);

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
      setProgressKey((k) => k + 1);
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
      setProgressKey((k) => k + 1);

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
      setProgressKey((k) => k + 1);

      startCycle();
    },
    [idx, startCycle]
  );

  useEffect(() => {
    if (!record) return;

    const imageForColor = tmdbImg(
      record.posterPathClean ?? record.backdropPath ?? record.backdropPathText,
      'w342'
    );

    if (!imageForColor) return;

    let cancelled = false;

    extractDominantColor(imageForColor).then((color) => {
      if (cancelled || !color) return;

      const darkColor = darken(color, isMobileLike ? 0.42 : 0.36);

      setHeroColor(darkColor);
      updateThemeColor(darkColor);
      onColorExtracted?.(darkColor);
    });

    return () => {
      cancelled = true;
    };
  }, [record, isMobileLike, onColorExtracted]);

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
    return <HeroBannerSkeleton isMobileLike={isMobileLike} isTv={isTv} />;
  }

  if (!record) return null;

  const commonProps = {
    record,
    featured,
    idx,
    dir,
    ix,
    heroColor,
    progressKey,
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