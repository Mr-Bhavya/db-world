import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Chip, useMediaQuery, useTheme } from '@mui/material';
import { useAuth } from '@features/auth/context/Authentication';
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
import usePageMeta from '@shared/hooks/usePageMeta';

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
  // PageType enum the backend expects ('HOME' | 'MOVIES' | 'SERIES'). Sent with
  // each rail-records fetch so a multi-page rail scopes its content to this page.
  const railPageType = apiPage.toUpperCase();

  usePageMeta(
    apiPage === 'movies' ? 'Movies — DB Cinema'
      : apiPage === 'series' ? 'TV Shows — DB Cinema'
        : 'Browse — DB Cinema',
    {
      exact: true,
      description:
        apiPage === 'movies' ? 'Stream and download the latest movies on DB Cinema.'
          : apiPage === 'series' ? 'Binge the latest TV shows and series on DB Cinema.'
            : 'Browse movies and TV shows to stream and download on DB Cinema.',
    }
  );

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

  const { data: railsData, isLoading: railsLoading } = useQuery({
    queryKey: ['cinema-rails', apiPage, category ?? null],
    queryFn: () => fetchPageRails(apiPage, category),
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
  const rails = useMemo(
    () => (Array.isArray(railsData) ? railsData : []),
    [railsData]
  );

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

  // Continue Watching is rendered by its own component (lower down), so it can't be
  // the hero banner — the hero is the highest-priority rail that isn't it.
  const heroRail = rails.find((r) => r?.rule?.type !== 'continueWatching') ?? null;
  const { records: heroRecords, loading: heroLoading, trigger: heroTrigger } =
    useRailRecords(heroRail?.id, Math.min(heroRail?.limitSize ?? 8, 8), false, category, railPageType);

  const { auth } = useAuth();
  const user = auth.user;
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

  // Every rail except the hero, in the backend's priority order. Continue Watching
  // stays in this list (rather than being force-pinned to the top) so its
  // admin-configured priority/position is honoured like any other rail.
  const remainingRails = useMemo(
    () => rails.filter((r) => r !== heroRail),
    [rails, heroRail]
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
          opacity: hasHeroColor && isMobile ? 1 : 0,
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
          opacity: hasHeroColor && isMobile ? 1 : 0,
          transition:
            'background 900ms cubic-bezier(0.22, 1, 0.36, 1), opacity 700ms ease',
        }}
      />

      {/* Main content */}
      <Box sx={{ position: 'relative', zIndex: 1 }}>
        <Navbar coverColor={isMobile ? heroColor : null} />

        {/* Hero scrolls away naturally with the page (Netflix-style) — no fade or
            parallax. The rails still ride up over its dissolving bottom edge. */}
        <Box sx={{ position: 'relative', zIndex: 0 }}>
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
        {/* Fixed-px overlap (NOT vh) so the first rail rides up onto the hero by a
            consistent amount on every screen — a vh overlap grew on big monitors
            and rode up over the hero's title/buttons. */}
        <Box sx={{ position: 'relative', zIndex: 1, background: 'transparent', mt: { xs: 0, md: '-130px', lg: '-146px', xl: '-166px' } }}>
          {railsLoading && rails.length === 0 ? (
            <>
              <RailSkeleton />
              <RailSkeleton />
              <RailSkeleton />
            </>
          ) : (
            <>
              {/* Rails render in priority order. The continueWatching rail is swapped
                  for the self-contained ContinueRailRow (progress + resume + remove;
                  hides itself when empty) in place, so it keeps its configured slot. */}
              {remainingRails.map((rail) =>
                rail?.rule?.type === 'continueWatching' ? (
                  <ContinueRailRow key={rail.id} />
                ) : (
                  <RailRow
                    key={rail.id}
                    rail={rail}
                    category={category}
                    pageType={railPageType}
                    interactions={interactions}
                    onWatchlist={handleWatchlist}
                    onLike={handleLike}
                    onLove={handleLove}
                    onWatched={handleWatched}
                    onExplore={handleExploreAll}
                    eager={false}
                  />
                )
              )}
            </>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default CinemaPage;