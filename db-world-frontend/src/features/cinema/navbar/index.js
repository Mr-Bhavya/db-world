// Navbar — Netflix-style with cover-colour tinting on mobile
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import Constants from '@shared/constants';
import SearchOverlay from '../screens/search';
import { fetchPageCategories } from '../api/cinemaApi';
import DB_WORLD_TEAL_SVG from '@assets/images/db-world-circle.png';

import {
  AppBar,
  Toolbar,
  IconButton,
  Button,
  Box,
  useTheme,
  useMediaQuery,
  styled,
  BottomNavigation,
  BottomNavigationAction,
} from '@mui/material';
import {
  Search as SearchIcon,
  ExpandMore as ExpandMoreIcon,
  Movie as MovieIcon,
  Tv as TvIcon,
  Category as CategoryIcon,
  Home as HomeIcon,
  NotificationsOutlined as BellIcon,
  ArrowBack as BackIcon,
  FileDownload as DownloadIcon,
} from '@mui/icons-material';
import { Capacitor } from '@capacitor/core';

import { AnimatePresence } from 'framer-motion';
import CategoryModal from './CategoryModal';
import { useCategory } from './CategoryContext';

// ─── Styled components ────────────────────────────────────────────────────────

const StyledAppBar = styled(AppBar, {
  shouldForwardProp: (p) => !['scrolled', 'coverColor'].includes(p),
})(({ scrolled, coverColor }) => ({
  // At top: show poster colour. When scrolled: remove it (go dark/transparent).
  background: scrolled
    ? 'rgba(20,20,20,0.97)'
    : coverColor
      ? 'transparent'
      : 'linear-gradient(180deg, rgba(0,0,0,0.72) 0%, transparent 100%)',
  backdropFilter: scrolled ? 'blur(4px)' : 'none',
  boxShadow: 'none',
  borderBottom: 'none',
  transition: 'background 0.5s ease',
  backgroundImage: 'none',
  willChange: 'background',
}));

/** Desktop text-only nav link */
const NavLink = styled(Button, {
  shouldForwardProp: (p) => p !== 'active',
})(({ active }) => ({
  color: active ? '#fff' : 'rgba(255,255,255,0.72)',
  textTransform: 'none',
  fontWeight: active ? 700 : 400,
  fontSize: '0.875rem',
  letterSpacing: '0.01em',
  borderRadius: 0,
  padding: '4px 10px',
  minWidth: 'auto',
  lineHeight: 1.4,
  background: 'none',
  border: 'none',
  boxShadow: 'none',
  position: 'relative',
  transition: 'color 0.15s ease',
  '&:hover': { color: '#fff', background: 'none', boxShadow: 'none' },
  '&::after': {
    content: '""',
    position: 'absolute', bottom: -1, left: '50%',
    transform: 'translateX(-50%)',
    width: active ? '4px' : 0, height: active ? '4px' : 0,
    borderRadius: '50%', backgroundColor: '#e50914',
    transition: 'width 0.2s ease, height 0.2s ease',
  },
}));

/** Mobile pill chip */
const Pill = styled(Button, {
  shouldForwardProp: (p) => p !== 'active',
})(({ active }) => ({
  color: active ? '#141414' : 'rgba(255,255,255,0.9)',
  background: active ? '#fff' : 'rgba(255,255,255,0.13)',
  textTransform: 'none',
  fontWeight: active ? 700 : 400,
  fontSize: '0.8rem',
  borderRadius: '14px',
  padding: '5px 14px',
  minWidth: 'auto',
  border: 'none',
  boxShadow: 'none',
  flexShrink: 0,
  transition: 'background 0.2s, color 0.2s',
  '&:hover': { background: active ? '#fff' : 'rgba(255,255,255,0.22)' },
}));

/** Fixed bottom nav (mobile) */
const MobileBottomNav = styled(BottomNavigation)(() => ({
  position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1200,
  background: 'rgba(14,14,14,0.97)', backdropFilter: 'blur(14px)',
  borderTop: '1px solid rgba(255,255,255,0.08)', height: 60,
}));

const MobileBottomNavAction = styled(BottomNavigationAction)(() => ({
  color: 'rgba(255,255,255,0.5)', minWidth: 0, padding: '6px 0 4px',
  '&.Mui-selected': { color: '#fff' },
  '& .MuiBottomNavigationAction-label': {
    fontSize: '0.65rem',
    '&.Mui-selected': { fontSize: '0.65rem', fontWeight: 600 },
  },
}));

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Props:
 *   coverColor  string | null  — 'r,g,b' from hero poster dominant colour
 */
function Navbar({ coverColor, onGenreSelect }) {
  const theme    = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const location = useLocation();

  const {
    selectedCategory,
    selectedNav,
    selectCategory,
    clearCategory,
    selectNav,
  } = useCategory();

  const scrollTimerRef = useRef(null);

  const [categoryList,     setCategoryList]     = useState([]);
  const [isScrolled,       setIsScrolled]       = useState(false);
  const [searchActive,     setSearchActive]     = useState(false);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);

  // ─── nav config ─────────────────────────────────────────────────────────────
  const isAndroid = Capacitor.getPlatform() === 'android';

  const navItems = useMemo(() => [
    { id: 0, title: 'Home',       route: Constants.DB_CINEMA_BROWSE_ROUTE,  icon: <HomeIcon /> },
    { id: 1, title: 'Movies',     route: Constants.DB_CINEMA_MOVIES_ROUTE,  icon: <MovieIcon /> },
    { id: 2, title: 'TV Shows',   route: Constants.DB_CINEMA_SERIES_ROUTE,  icon: <TvIcon /> },
    { id: 3, title: 'Categories', route: null,                               icon: <CategoryIcon /> },
    ...(isAndroid ? [{ id: 4, title: 'Downloads', route: Constants.DB_CINEMA_DOWNLOADS, icon: <DownloadIcon /> }] : []),
  ], [isAndroid]);

  // Sync selectedNav with URL
  useEffect(() => {
    const path = location.pathname;
    let match = navItems[0];
    if (path.includes(Constants.DB_CINEMA_MOVIES_ROUTE)) match = navItems[1];
    else if (path.includes(Constants.DB_CINEMA_SERIES_ROUTE)) match = navItems[2];
    selectNav(match);
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll detection
  useEffect(() => {
    const onScroll = () => {
      if (scrollTimerRef.current) cancelAnimationFrame(scrollTimerRef.current);
      scrollTimerRef.current = requestAnimationFrame(() => setIsScrolled(window.scrollY > 10));
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      if (scrollTimerRef.current) cancelAnimationFrame(scrollTimerRef.current);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  // Load categories
  useEffect(() => {
    fetchPageCategories('home')
      .then(data => setCategoryList(Array.isArray(data) ? data : []))
      .catch(() => setCategoryList([]));
  }, []);

  // ─── handlers ────────────────────────────────────────────────────────────────

  const handleNavSelect = useCallback((item) => {
    if (item.id === 3) {
      setCategoryModalOpen(true);
    } else {
      selectNav(item);
      setCategoryModalOpen(false);
      if (item.route) navigate(item.route);
      onGenreSelect?.(null);
      selectCategory(null);
    }
  }, [selectNav, navigate, onGenreSelect, selectCategory]);

  const handleBackToHome = useCallback(() => {
    handleNavSelect(navItems[0]);
  }, [handleNavSelect, navItems]);

  const handleCategorySelect = useCallback((category) => {
    selectCategory(category);
    setCategoryModalOpen(false);
    onGenreSelect?.(category);
  }, [selectCategory, onGenreSelect]);

  const handleClearCategory = useCallback(() => {
    clearCategory();
    selectCategory(null);
    onGenreSelect?.(null);
    setCategoryModalOpen(false);
  }, [clearCategory, onGenreSelect, selectCategory]);

  // ─── derived state ───────────────────────────────────────────────────────────

  const isMediaPage = selectedNav && (selectedNav.id === 1 || selectedNav.id === 2);
  const bottomNavValue = selectedNav?.id ?? 0;

  // ─── Mobile Row 2 (filter chips) ─────────────────────────────────────────────

  const mobileFilterRow = isMobile && (
    // Collapse on scroll using maxHeight/opacity transition
    <Box sx={{
      maxHeight: isScrolled ? 0 : '52px',
      overflow: 'hidden',
      opacity: isScrolled ? 0 : 1,
      transition: 'max-height 0.3s ease, opacity 0.25s ease',
    }}>
      <Box sx={{
        display: 'flex', gap: 1, overflowX: 'auto',
        px: 2, pb: 1.2, pt: 0.3,
        scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' },
      }}>
        {!isMediaPage && (
          <>
            {/* Shows chip — nav shortcut, never active-styled */}
            <Pill onClick={() => handleNavSelect(navItems[2])}>
              Shows
            </Pill>
            {/* Movies chip — nav shortcut, never active-styled */}
            <Pill onClick={() => handleNavSelect(navItems[1])}>
              Movies
            </Pill>
          </>
        )}

        {/* Categories chip */}
        <Pill
          onClick={() => setCategoryModalOpen(true)}
          endIcon={<ExpandMoreIcon sx={{ fontSize: '0.9rem !important', ml: -0.5 }} />}
          active={!!selectedCategory}
        >
          {selectedCategory ? selectedCategory.name : 'Categories'}
        </Pill>
      </Box>
    </Box>
  );

  // ─── JSX ─────────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── AppBar ── */}
      <StyledAppBar
        position="fixed"
        scrolled={isScrolled}
        coverColor={isMobile ? (coverColor ?? null) : null}
      >
        <Toolbar sx={{ minHeight: { xs: '52px', md: '68px' }, px: { xs: 1.5, md: 4 } }}>

          {/* LEFT */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexGrow: 1, minWidth: 0 }}>
            {isMobile ? (
              isMediaPage ? (
                // Movies / TV Shows page: back arrow + page title
                <>
                  <IconButton
                    size="small"
                    onClick={handleBackToHome}
                    sx={{ color: '#fff', p: 0.5 }}
                  >
                    <BackIcon sx={{ fontSize: '1.3rem' }} />
                  </IconButton>
                  <Box
                    sx={{
                      fontWeight: 700, fontSize: '1.2rem', color: '#fff',
                      letterSpacing: '-0.01em', lineHeight: 1,
                    }}
                    component="span"
                  >
                    {selectedNav?.title}
                  </Box>
                </>
              ) : (
                // Home page: db-world icon + "Home"
                <>
                  <Link to={Constants.DB_WORLD_HOME_ROUTE} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                    <img src={DB_WORLD_TEAL_SVG} alt="Logo" style={{ height: 26 }} />
                  </Link>
                  <Box
                    sx={{
                      fontWeight: 700, fontSize: '1.2rem', color: '#fff',
                      letterSpacing: '-0.01em', lineHeight: 1,
                    }}
                    component="span"
                  >
                    {selectedNav?.title ?? 'Home'}
                  </Box>
                </>
              )
            ) : (
              // Desktop: logo + nav links
              <>
                <Link to={Constants.DB_WORLD_HOME_ROUTE} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <img src={DB_WORLD_TEAL_SVG} alt="Logo" style={{ height: 30 }} />
                  <Box component="span" sx={{ fontWeight: 800, fontSize: '1.15rem', color: '#e50914', letterSpacing: '-0.02em', lineHeight: 1 }}>
                    DB Cinema
                  </Box>
                </Link>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  {navItems.map(item => (
                    <NavLink
                      key={item.id}
                      active={selectedNav?.id === item.id}
                      onClick={() => handleNavSelect(item)}
                      endIcon={item.id === 3 ? <ExpandMoreIcon sx={{ fontSize: '1rem !important', ml: -0.5 }} /> : undefined}
                    >
                      {item.id === 3 && selectedCategory ? selectedCategory.name : item.title}
                    </NavLink>
                  ))}
                </Box>
              </>
            )}
          </Box>

          {/* RIGHT: bell (mobile) + download (Android) + search */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3, flexShrink: 0 }}>
            {isMobile && (
              <IconButton size="medium" sx={{ color: '#fff', '&:hover': { color: 'rgba(255,255,255,0.7)' } }}>
                <BellIcon sx={{ fontSize: '1.35rem' }} />
              </IconButton>
            )}
            {isAndroid && (
              <IconButton
                onClick={() => navigate(Constants.DB_CINEMA_DOWNLOADS)}
                size="medium"
                sx={{ color: '#fff', '&:hover': { color: 'rgba(255,255,255,0.7)' } }}
              >
                <DownloadIcon sx={{ fontSize: '1.35rem' }} />
              </IconButton>
            )}
            <IconButton
              onClick={() => setSearchActive(true)}
              size="medium"
              sx={{ color: '#fff', '&:hover': { color: 'rgba(255,255,255,0.7)' } }}
            >
              <SearchIcon sx={{ fontSize: '1.35rem' }} />
            </IconButton>
          </Box>
        </Toolbar>

        {/* Mobile Row 2: filter chips (collapses on scroll) */}
        {mobileFilterRow}
      </StyledAppBar>

      {/* ── Category dropdown ── */}
      <CategoryModal
        open={categoryModalOpen}
        categories={categoryList}
        selectedCategory={selectedCategory}
        onSelect={handleCategorySelect}
        onClear={handleClearCategory}
        onClose={() => setCategoryModalOpen(false)}
        appBarHeight={isMobile ? (isScrolled ? 52 : 96) : 68}
      />

      {/* ── Search Overlay ── */}
      <AnimatePresence>
        {searchActive && <SearchOverlay onClose={() => setSearchActive(false)} />}
      </AnimatePresence>

      {/* ── Spacer — shrinks when filter row is hidden ── */}
      <Box sx={{
        height: {
          xs: isScrolled ? '52px' : '96px',
          md: '68px',
        },
        transition: 'height 0.3s ease',
      }} />

      {/* ── Mobile bottom navigation ── */}
      {isMobile && (
        <MobileBottomNav
          value={bottomNavValue}
          onChange={(_, newValue) => handleNavSelect(navItems[newValue])}
          showLabels
        >
          {navItems.map(item => (
            <MobileBottomNavAction
              key={item.id}
              label={item.id === 2 ? 'TV Shows' : item.title}
              icon={item.id === 3 ? <CategoryIcon /> : item.icon}
            />
          ))}
        </MobileBottomNav>
      )}

      {/* Bottom spacer so content sits above bottom nav */}
       {/* {isMobile && <Box sx={{ height: '60px' }} />} */}
    </>
  );
}

export default Navbar;
