import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Box, Chip, Skeleton, useMediaQuery, useTheme } from '@mui/material';
import { useSelector } from 'react-redux';
import { AnimatePresence, motion } from 'framer-motion';

import Navbar     from '../../navbar';
import HeroBanner from '../../components/HeroBanner/HeroBanner';
import RailRow    from '../../components/RailRow/RailRow';
import { fetchPageRails, fetchPageCategories } from '../../api/cinemaApi';
import useInteractions from '../../hooks/useInteractions';
import useRailRecords  from '../../hooks/useRailRecords';
import { useCategory } from '../../navbar/CategoryContext';
import Constants from '@shared/constants';

// ─── page type maps ───────────────────────────────────────────────────────────

const PAGE_MAP = {
  home:    'home',
  browse:  'home',
  movies:  'movies',
  series:  'series',
};

// ─── Genre filter bar (desktop only) ─────────────────────────────────────────

const GenreBar = ({ genres, selected, onSelect }) => (
  <Box
    sx={{
      display: { xs: 'none', md: 'flex' }, // hidden on mobile — nav handles it
      gap: 1, overflowX: 'auto',
      px: 4, py: 1.5,
      scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' },
    }}
  >
    <Chip
      label="All"
      size="small"
      onClick={() => onSelect(null)}
      sx={{
        flexShrink: 0,
        bgcolor: !selected ? 'primary.main' : 'rgba(255,255,255,.12)',
        color: '#fff', fontWeight: 600,
        '&:hover': { bgcolor: !selected ? 'primary.dark' : 'rgba(255,255,255,.2)' },
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
          color: '#fff', fontWeight: 500,
          '&:hover': { bgcolor: g.id === selected ? 'primary.dark' : 'rgba(255,255,255,.2)' },
        }}
      />
    ))}
  </Box>
);

// ─── Rail loading skeletons ───────────────────────────────────────────────────

const RailSkeleton = () => (
  <Box sx={{ mb: 3.5, px: { xs: 2, md: 4 } }}>
    <Skeleton variant="text" width={200} height={28} sx={{ bgcolor: 'rgba(255,255,255,.08)', mb: 1 }} />
    <Box sx={{ display: 'flex', gap: 1.5 }}>
      {[...Array(6)].map((_, i) => (
        <Skeleton
          key={i}
          variant="rectangular"
          width={150} height={225}
          sx={{ borderRadius: 1.5, bgcolor: 'rgba(255,255,255,.06)', flexShrink: 0 }}
        />
      ))}
    </Box>
  </Box>
);

// ─── CinemaPage ───────────────────────────────────────────────────────────────

const CinemaPage = ({ pageType = 'home' }) => {
  const apiPage = PAGE_MAP[pageType] ?? 'home';
  const navigate = useNavigate();
  const theme    = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // ── Category from global context (shared with navbar) ──
  const { selectedCategory, selectCategory, clearCategory } = useCategory();
  const category = selectedCategory?.id ?? null;

  // ── Hero dominant color (mobile) ──
  const [heroColor, setHeroColor] = useState(null);

  const [rails,       setRails]       = useState([]);
  const [genres,      setGenres]      = useState([]);
  const [loadingMeta, setLoadingMeta] = useState(true);

  // Clear category when page type changes (navigating between Home/Movies/Series)
  useEffect(() => {
    clearCategory();
  }, [apiPage]); // eslint-disable-line react-hooks/exhaustive-deps

  // Hero: eagerly load the first rail's records
  const heroRail = rails[0] ?? null;
  const { records: heroRecords, loading: heroLoading, trigger: heroTrigger } =
    useRailRecords(heroRail?.id, Math.min(heroRail?.limitSize ?? 8, 8), false, category);

  // Auth — get userId for interactions
  const user   = useSelector(s => s.userReducer?.user ?? s.userReducer);
  const userId = user?.id ?? user?.userId ?? null;

  const { interactions, loadForRecords, toggleWatchlist, toggleLike, toggleLove, toggleWatched } = useInteractions();

  // ── Fetch rail metadata + genres when page/category changes ──
  useEffect(() => {
    let cancelled = false;
    setLoadingMeta(true);
    setRails([]);

    Promise.all([
      fetchPageRails(apiPage, category),
      fetchPageCategories(apiPage),
    ]).then(([railList, genreList]) => {
      if (cancelled) return;
      setRails(Array.isArray(railList) ? railList : []);
      setGenres(Array.isArray(genreList) ? genreList : []);
    }).catch(console.error)
      .finally(() => { if (!cancelled) setLoadingMeta(false); });

    return () => { cancelled = true; };
  }, [apiPage, category]);

  // Eagerly load hero rail once known
  useEffect(() => {
    if (heroRail) heroTrigger();
  }, [heroRail, heroTrigger]);

  // Batch-load interactions for hero records
  useEffect(() => {
    if (userId && heroRecords.length > 0)
      loadForRecords(userId, heroRecords.map(r => r.id));
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
    } else if (title.includes('series') || title.includes('tv') || title.includes('show') || apiPage === 'series') {
      navigate(Constants.DB_CINEMA_SERIES_ROUTE);
    } else {
      navigate(Constants.DB_CINEMA_BROWSE_ROUTE);
    }
  }, [apiPage, navigate]);

  // Desktop genre bar: select passes full genre object
  const handleGenreSelect = useCallback((genreOrNull) => {
    if (!genreOrNull) clearCategory();
    else selectCategory(genreOrNull);
  }, [selectCategory, clearCategory]);

  const remainingRails = useMemo(() => rails.slice(1), [rails]);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        overflowX: 'hidden',
        background: isMobile && heroColor
          ? `linear-gradient(180deg, rgb(${heroColor}) 0%, rgb(28,22,22) 100vh, #141414 150vh)`
          : '#141414',
        transition: 'background 0.8s ease',
        '--cinema-bg': '#141414',
        color: '#fff',
        pb: 8,
      }}
    >
      {/* ── Cinema Navbar ── */}
      <Navbar coverColor={isMobile ? heroColor : null} />

      {/* ── Hero Banner ── */}
      <HeroBanner
        records={heroRecords}
        interactions={interactions}
        onWatchlist={handleWatchlist}
        loading={loadingMeta || heroLoading}
        onColorExtracted={setHeroColor}
      />

      {/* ── Genre filter (desktop only) ── */}
      <AnimatePresence>
        {genres.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <GenreBar genres={genres} selected={category} onSelect={handleGenreSelect} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Rails ── */}
      <Box sx={{ mt: { xs: 1, md: 2 } }}>
        {loadingMeta && rails.length === 0 ? (
          <>
            <RailSkeleton />
            <RailSkeleton />
            <RailSkeleton />
          </>
        ) : (
          <>
            {heroRail && (
              <RailRow
                rail={heroRail}
                category={category}
                interactions={interactions}
                onWatchlist={handleWatchlist}
                onLike={handleLike}
                onLove={handleLove}
                onWatched={handleWatched}
                onExplore={handleExploreAll}
                wide={true}
                eager={true}
              />
            )}

            {remainingRails.map((rail, idx) => (
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
                wide={false}
                eager={false}
                top10={rail.title?.toLowerCase().includes('top 10') || rail.title?.toLowerCase().includes('top10')}
                expandOnHover={idx % 5 === 3}
              />
            ))}
          </>
        )}
      </Box>
    </Box>
  );
};

export default CinemaPage;
