import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Chip, useMediaQuery, useTheme } from '@mui/material';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useSelector } from 'react-redux';
import { useQuery } from '@tanstack/react-query';

import Navbar from '../../navbar';
import HeroBanner from '../../components/HeroBanner/HeroBanner';
import RailRow from '../../components/RailRow/RailRow';
import RailSkeleton from '../../components/RailRow/RailSkeleton';
import ContinueRailRow from '../../components/ContinueRailRow/ContinueRailRow';
import { fetchPageRails, fetchPageCategories } from '../../api/cinemaApi';
import useInteractions from '../../hooks/useInteractions';
import useRailRecords from '../../hooks/useRailRecords';
import { useCategory } from '../../navbar/CategoryContext';
import Constants from '@shared/constants';

const PAGE_MAP = {
  home: 'home',
  browse: 'home',
  movies: 'movies',
  series: 'series',
};

const _GenreBar = ({ genres, selected, onSelect }) => (
  <Box
    sx={{
      display: { xs: 'none', md: 'flex' },
      gap: 1,
      overflowX: 'auto',
      px: 4,
      py: 1.5,
      scrollbarWidth: 'none',
      '&::-webkit-scrollbar': { display: 'none' },
    }}
  >
    <Chip
      label="All"
      size="small"
      onClick={() => onSelect(null)}
      sx={{
        flexShrink: 0,
        bgcolor: !selected ? 'primary.main' : 'rgba(255,255,255,.12)',
        color: '#fff',
        fontWeight: 600,
        '&:hover': {
          bgcolor: !selected ? 'primary.dark' : 'rgba(255,255,255,.2)',
        },
      }}
    />
    {genres.map((g) => (
      <Chip
        key={g.id}
        label={g.name}
        size="small"
        onClick={() => onSelect(g.id === selected ? null : g)}
        sx={{
          flexShrink: 0,
          bgcolor: g.id === selected ? 'primary.main' : 'rgba(255,255,255,.12)',
          color: '#fff',
          fontWeight: 500,
          '&:hover': {
            bgcolor: g.id === selected ? 'primary.dark' : 'rgba(255,255,255,.2)',
          },
        }}
      />
    ))}
  </Box>
);

const CinemaPage = ({ pageType = 'home' }) => {
  const apiPage = PAGE_MAP[pageType] ?? 'home';
  const navigate = useNavigate();
  const theme = useTheme();

  // Device buckets
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'md'));
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isMonitor = useMediaQuery('(min-width:1536px)');
  const isTv = useMediaQuery('(min-width:1920px) and (min-height:900px)');
  const isDesktop = !isMobile && !isMonitor && !isTv;

  const { selectedCategory, selectCategory, clearCategory } = useCategory();
  const category = selectedCategory?.id ?? null;

  const [heroColor, setHeroColor] = useState(null);

  // The rails rise over the hero and hide it, so no opacity fade is needed — just
  // a gentle parallax lag so the image lingers as the rails cover it. Driven by
  // scroll position via framer-motion → no React re-renders.
  const { scrollY } = useScroll();
  const heroParallax = useTransform(scrollY, [0, 520], [0, 120]);

  const { data: railsData, isLoading: railsLoading } = useQuery({
    queryKey: ['cinema-rails', apiPage, category ?? null],
    queryFn: () => fetchPageRails(apiPage, category),
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
  const rails = Array.isArray(railsData) ? railsData : [];

  useQuery({
    queryKey: ['cinema-categories', apiPage],
    queryFn: () => fetchPageCategories(apiPage),
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  useEffect(() => {
    clearCategory();
    setHeroColor(null);
  }, [apiPage]); // eslint-disable-line react-hooks/exhaustive-deps

  const scrollKey = `cinema_scroll_${apiPage}`;
  const scrollRestored = React.useRef(false);

  useEffect(() => {
    scrollRestored.current = false;
    return () => {
      sessionStorage.setItem(scrollKey, String(window.scrollY));
    };
  }, [apiPage]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (railsLoading || rails.length === 0 || scrollRestored.current) return;
    const saved = parseInt(sessionStorage.getItem(scrollKey) || '0', 10);
    if (saved > 0) {
      scrollRestored.current = true;
      const t = setTimeout(() => window.scrollTo({ top: saved, behavior: 'instant' }), 80);
      return () => clearTimeout(t);
    }
  }, [railsLoading, rails.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const heroRail = rails[0] ?? null;
  const { records: heroRecords, loading: heroLoading, trigger: heroTrigger } =
    useRailRecords(heroRail?.id, Math.min(heroRail?.limitSize ?? 8, 8), false, category);

  const user = useSelector((s) => s.userReducer?.user ?? s.userReducer);
  const userId = user?.id ?? user?.userId ?? null;

  const {
    interactions,
    loadForRecords,
    toggleWatchlist,
    toggleLike,
    toggleLove,
    toggleWatched,
  } = useInteractions();

  useEffect(() => {
    if (heroRail) heroTrigger();
  }, [heroRail, heroTrigger]);

  useEffect(() => {
    if (userId && heroRecords.length > 0) {
      loadForRecords(userId, heroRecords.map((r) => r.id));
    }
  }, [userId, heroRecords, loadForRecords]);

  const handleWatchlist = useCallback((record) => {
    if (!userId) return;
    toggleWatchlist(userId, record.id, interactions[record.id]?.watchlisted ?? false);
  }, [userId, interactions, toggleWatchlist]);

  const handleLike = useCallback((record) => {
    if (!userId) return;
    toggleLike(userId, record.id, interactions[record.id]?.liked ?? false);
  }, [userId, interactions, toggleLike]);

  const handleLove = useCallback((record) => {
    if (!userId) return;
    toggleLove(userId, record.id, interactions[record.id]?.loved ?? false);
  }, [userId, interactions, toggleLove]);

  const handleWatched = useCallback((record) => {
    if (!userId) return;
    toggleWatched(userId, record.id, interactions[record.id]?.watched ?? false);
  }, [userId, interactions, toggleWatched]);

  const handleExploreAll = useCallback((rail) => {
    const title = rail?.title?.toLowerCase() ?? '';
    if (title.includes('movie') || apiPage === 'movies') {
      navigate(Constants.DB_CINEMA_MOVIES_ROUTE);
    } else if (
      title.includes('series') ||
      title.includes('tv') ||
      title.includes('show') ||
      apiPage === 'series'
    ) {
      navigate(Constants.DB_CINEMA_SERIES_ROUTE);
    } else {
      navigate(Constants.DB_CINEMA_BROWSE_ROUTE);
    }
  }, [apiPage, navigate]);

  const _handleGenreSelect = useCallback((genreOrNull) => {
    if (!genreOrNull) clearCategory();
    else selectCategory(genreOrNull);
  }, [selectCategory, clearCategory]);

  const remainingRails = useMemo(
    () => (rails.length > 1 ? rails.slice(1) : []),
    [rails]
  );

  const safeHeroColor = heroColor || '20,20,20';
  const hasHeroColor = Boolean(heroColor);

  // Device-specific overlay sizing.
  // `solidEnd` is tuned to land just past the hero's bottom edge so the colour
  // wash starts fading exactly where the hero dissolves — the hero and the rails
  // read as one continuous page instead of a hero block sitting on a colour slab.
  const overlayConfig = useMemo(() => {
    if (isTv) {
      return { height: '220vh', solidEnd: 42, fadeMid: 62 };
    }
    if (isMonitor) {
      return { height: '210vh', solidEnd: 42, fadeMid: 62 };
    }
    if (isDesktop) {
      return { height: '200vh', solidEnd: 42, fadeMid: 62 };
    }
    if (isTablet) {
      return { height: '175vh', solidEnd: 44, fadeMid: 64 };
    }
    // mobile xs — taller hero card; keep the wash solid around it, fade into rails
    return { height: '175vh', solidEnd: 52, fadeMid: 68 };
  }, [isDesktop, isMonitor, isTablet, isTv]);

  const overlayGradient = useMemo(() => {
    const { solidEnd, fadeMid } = overlayConfig;
    return `
      linear-gradient(
        180deg,
        rgb(${safeHeroColor}) 0%,
        rgb(${safeHeroColor}) ${solidEnd}%,
        rgba(${safeHeroColor}, 0.72) ${fadeMid}%,
        rgba(${safeHeroColor}, 0.34) 82%,
        rgba(${safeHeroColor}, 0.12) 90%,
        #141414 100%
      )
    `;
  }, [overlayConfig, safeHeroColor]);

  return (
    <Box
      sx={{
        position: 'relative',
        minHeight: '100vh',
        overflowX: 'hidden',
        background: '#141414',
        color: '#fff',
        pb: { xs: '96px', md: 8 },
        '--cinema-bg': '#141414',
      }}
    >
      {/* Device-specific image-color overlay */}
      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: overlayConfig.height,
          pointerEvents: 'none',
          zIndex: 0,
          background: overlayGradient,
          opacity: hasHeroColor ? 1 : 0,
          transition:
            'background 900ms cubic-bezier(0.22, 1, 0.36, 1), opacity 700ms ease',
          willChange: 'background, opacity',
        }}
      />

      {/* Top ambient glow */}
      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: isTv ? '72vh' : isMonitor ? '68vh' : isTablet ? '58vh' : '52vh',
          pointerEvents: 'none',
          zIndex: 0,
          background: `
            radial-gradient(
              ellipse at 50% 0%,
              rgba(${safeHeroColor}, 0.20) 0%,
              rgba(${safeHeroColor}, 0.08) 30%,
              transparent 70%
            )
          `,
          opacity: hasHeroColor ? 1 : 0,
          transition:
            'background 900ms cubic-bezier(0.22, 1, 0.36, 1), opacity 700ms ease',
        }}
      />

      {/* Main content */}
      <Box sx={{ position: 'relative', zIndex: 1 }}>
        <Navbar coverColor={isMobile ? heroColor : null} />

        {/* Desktop: hero sits behind the rails and fades/parallaxes on scroll.
            Mobile keeps the static card hero (no fade). */}
        <Box
          component={motion.div}
          style={isMobile ? undefined : { y: heroParallax }}
          sx={{ position: 'relative', zIndex: 0 }}
        >
          <HeroBanner
            records={heroRecords}
            interactions={interactions}
            onWatchlist={handleWatchlist}
            loading={railsLoading || heroLoading}
            onColorExtracted={setHeroColor}
          />
        </Box>

        {/* Rails ride up over the hero (desktop) and stay transparent so the
            colour wash shows through. */}
        <Box sx={{ position: 'relative', zIndex: 1, background: 'transparent', mt: { xs: 0, md: '-7vh' } }}>
          {railsLoading && rails.length === 0 ? (
            <>
              <RailSkeleton />
              <RailSkeleton />
              <RailSkeleton />
            </>
          ) : (
            <>
              {/* Continue Watching — self-contained (progress + resume + remove);
                  hides itself when empty. Drops any backend continueWatching rail
                  below to avoid a duplicate plain row. */}
              <ContinueRailRow />
              {remainingRails
                .filter((rail) => rail?.rule?.type !== 'continueWatching')
                .map((rail) => (
                <RailRow
                  key={rail.id}
                  rail={rail}
                  category={category}
                  interactions={interactions}
                  onWatchlist={handleWatchlist}
                  onLike={handleLike}
                  onLove={handleLove}
                  onWatched={handleWatched}
                  onExplore={handleExploreAll}
                  eager={false}
                />
              ))}
            </>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default CinemaPage;