// Navbar — Cinema with floating pill bottom nav (mobile) + themed desktop bar
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { alpha } from '@mui/material/styles';
import Constants from '@shared/constants';
import SearchOverlay from '../screens/search';
import { fetchPageCategories, fetchUnreadCount, fetchNotifications } from '../api/cinemaApi';
import DB_WORLD_TEAL_SVG from '@assets/images/db-circle-icon.webp';

import {
  AppBar,
  Toolbar,
  IconButton,
  Button,
  ButtonBase,
  Box,
  Badge,
  useTheme,
  useMediaQuery,
  styled,
} from '@mui/material';
import {
  Search as SearchIcon,
  ExpandMore as ExpandMoreIcon,
  Movie as MovieIcon,
  Tv as TvIcon,
  Home as HomeIcon,
  NotificationsOutlined as BellIcon,
  ArrowBack as BackIcon,
  FileDownload as DownloadIcon,
  Tune as TuneIcon,
} from '@mui/icons-material';
import { AnimatePresence } from 'framer-motion';
import { Capacitor } from '@capacitor/core';
import CategoryModal from './CategoryModal';
import { useCategory } from './CategoryContext';
import NotificationPanel from '../components/notifications/NotificationPanel';
import { useActiveDownloadCount } from '../download-queue/useActiveDownloadCount';
import useDeviceTier from '../hooks/useDeviceTier';

// Download nav icon with a live badge showing how many downloads are running/queued.
function DownloadNavIcon() {
  const count = useActiveDownloadCount();
  return (
    <Badge
      badgeContent={count}
      color="primary"
      overlap="circular"
      sx={{ '& .MuiBadge-badge': { fontSize: '0.55rem', height: 15, minWidth: 15, p: '0 4px' } }}
    >
      <DownloadIcon />
    </Badge>
  );
}

// ─── Styled components ────────────────────────────────────────────────────────

const StyledAppBar = styled(AppBar, {
  shouldForwardProp: (p) => !['scrolled', 'coverColor'].includes(p),
})(({ scrolled, coverColor, theme }) => ({
  background: scrolled
    ? alpha(theme.palette.background.paper ?? '#141414', 0.97)
    : coverColor
      ? 'transparent'
      : `linear-gradient(180deg, ${alpha(theme.palette.common.black, 0.75)} 0%, transparent 100%)`,
  backdropFilter: scrolled ? 'blur(8px)' : 'none',
  WebkitBackdropFilter: scrolled ? 'blur(8px)' : 'none',
  boxShadow: scrolled ? `0 1px 0 ${alpha(theme.palette.common.white, 0.06)}` : 'none',
  borderBottom: 'none',
  transition: 'background 0.4s ease, backdrop-filter 0.4s ease',
  backgroundImage: 'none',
  willChange: 'background',
}));

/** Desktop text-only nav link */
const NavLink = styled(Button, {
  shouldForwardProp: (p) => p !== 'active',
})(({ active, theme }) => ({
  color: active
    ? theme.palette.text.primary
    : alpha(theme.palette.text.primary ?? '#fff', 0.68),
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
  '&:hover': {
    color: theme.palette.text.primary,
    background: 'none',
    boxShadow: 'none',
  },
  '&::after': {
    content: '""',
    position: 'absolute',
    bottom: -1,
    left: '50%',
    transform: 'translateX(-50%)',
    width: active ? '5px' : 0,
    height: active ? '5px' : 0,
    borderRadius: '50%',
    backgroundColor: theme.palette.primary.main,
    transition: 'width 0.2s ease, height 0.2s ease',
  },
}));

/**
 * Outer wrapper: full-width fixed bar that uses flexbox to centre the pill.
 * Using a flex-wrapper + auto margins avoids transform: translateX(-50%) which
 * can create a ghost horizontal-scroll on some browsers/devices.
 */
const FloatingNavWrapper = styled(Box)(() => ({
  position: 'fixed',
  bottom: 16,
  left: 0,
  right: 0,
  zIndex: 1200,
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  padding: '0 12px',         // minimum edge gap on narrow screens
  pointerEvents: 'none',     // clicks fall through the wrapper to the page
}));

/** The pill itself — not positioned, just sized + styled */
const FloatingBottomNav = styled(Box)(({ theme }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  pointerEvents: 'auto',
  maxWidth: 'calc(100vw - 24px)',  // never wider than the screen
  overflow: 'hidden',
  background: alpha(theme.palette.common.black, 0.92),
  backdropFilter: 'blur(28px)',
  WebkitBackdropFilter: 'blur(28px)',
  borderRadius: 50,
  border: `1px solid ${alpha(theme.palette.common.white, 0.09)}`,
  boxShadow: `0 8px 32px ${alpha(theme.palette.common.black, 0.6)}, inset 0 1px 0 ${alpha(theme.palette.common.white, 0.05)}`,
  height: 60,
  padding: '4px 6px',
}));

/** Single item inside the floating pill */
const FloatingNavItem = styled(ButtonBase, {
  shouldForwardProp: p => p !== 'active',
})(({ active, theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 3,
  padding: '0 14px',
  height: '100%',
  borderRadius: 40,
  // flex: allow items to shrink when system font is very large
  flex: '1 1 auto',
  minWidth: 44,
  overflow: 'hidden',
  color: active
    ? theme.palette.common.white
    : alpha(theme.palette.common.white, 0.42),
  background: active
    ? alpha(theme.palette.primary.main, 0.22)
    : 'transparent',
  transition: 'color 0.18s ease, background 0.18s ease',
  '&:hover': {
    color: alpha(theme.palette.common.white, 0.82),
    background: alpha(theme.palette.common.white, 0.07),
  },
}));

// ─── TV Drawer (≥ 1920px + coarse pointer) ───────────────────────────────────

function TvDrawer({ activeId, unreadCount, onSearch, onFilter, onBell, onNavigate, isAndroid }) {
  const [expanded, setExpanded] = React.useState(false);
  const theme = useTheme();

  const tvItems = [
    { id: 0, title: 'Home',          route: Constants.DB_CINEMA_BROWSE_ROUTE,  icon: <HomeIcon /> },
    { id: 1, title: 'Movies',        route: Constants.DB_CINEMA_MOVIES_ROUTE,  icon: <MovieIcon /> },
    { id: 2, title: 'TV Shows',      route: Constants.DB_CINEMA_SERIES_ROUTE,  icon: <TvIcon /> },
    { id: 3, title: 'Search',        route: null,                               icon: <SearchIcon /> },
    { id: 4, title: 'Filter',        route: null,                               icon: <TuneIcon /> },
    { id: 5, title: 'Notifications', route: null,                               icon: (
        <Badge badgeContent={unreadCount > 0 ? unreadCount : null} color="error" max={99}
          sx={{ '& .MuiBadge-badge': { fontSize: '0.6rem', height: 16, minWidth: 16, p: '0 4px' } }}>
          <BellIcon />
        </Badge>
      )
    },
    ...(isAndroid ? [{ id: 6, title: 'Downloads', route: Constants.DB_DOWNLOAD_QUEUE_ROUTE, icon: <DownloadNavIcon /> }] : []),
  ];

  const handleItemClick = (item) => {
    if (item.id === 3) { onSearch?.(); }
    else if (item.id === 4) { onFilter?.(); }
    else if (item.id === 5) { onBell?.(); }
    else if (item.route) { onNavigate?.(item.route); }
  };

  return (
    <Box
      onFocus={() => setExpanded(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setExpanded(false);
      }}
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        width: expanded ? 220 : 72,
        zIndex: 1300,
        background: alpha(theme.palette.common.black, 0.82),
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderRight: `1px solid ${alpha(theme.palette.common.white, 0.08)}`,
        pt: 6,
        pb: 4,
        display: 'flex',
        flexDirection: 'column',
        gap: 0.5,
        overflow: 'hidden',
        transition: 'width 0.25s ease',
      }}
    >
      {tvItems.map((item) => {
        const isActive = item.id === activeId;
        return (
          <ButtonBase
            key={item.id}
            tabIndex={0}
            focusRipple
            onClick={() => handleItemClick(item)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              px: 2,
              py: 1.5,
              minHeight: 52,
              borderRadius: 1,
              mx: 1,
              color: isActive
                ? theme.palette.common.white
                : alpha(theme.palette.common.white, 0.55),
              background: isActive
                ? alpha(theme.palette.primary.main, 0.18)
                : 'transparent',
              borderLeft: isActive
                ? `3px solid ${theme.palette.primary.main}`
                : '3px solid transparent',
              transition: 'color 0.18s ease, background 0.18s ease',
              '&:hover': {
                color: theme.palette.common.white,
                background: alpha(theme.palette.common.white, 0.08),
              },
              '&.Mui-focusVisible': {
                outline: `4px solid ${theme.palette.primary.main}`,
                outlineOffset: -4,
              },
              justifyContent: 'flex-start',
              overflow: 'hidden',
              whiteSpace: 'nowrap',
            }}
          >
            <Box sx={{ display: 'flex', flexShrink: 0, fontSize: '1.4rem', lineHeight: 1 }}>
              {item.icon}
            </Box>
            <Box
              component="span"
              sx={{
                fontSize: '0.95rem',
                fontWeight: isActive ? 700 : 400,
                letterSpacing: '0.01em',
                opacity: expanded ? 1 : 0,
                transition: 'opacity 0.2s ease',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {item.title}
            </Box>
          </ButtonBase>
        );
      })}
    </Box>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

function Navbar({ coverColor, onGenreSelect }) {
  const theme    = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm')); // < 600px only
  const tier     = useDeviceTier();
  const isTv     = tier === 'tv';
  const navigate = useNavigate();
  const location = useLocation();

  const isAndroid = Capacitor.getPlatform() === 'android';

  const {
    selectedCategory,
    selectedNav,
    selectCategory,
    clearCategory,
    selectNav,
  } = useCategory();

  const scrollTimerRef = useRef(null);

  const [categoryList,      setCategoryList]      = useState([]);
  const [isScrolled,        setIsScrolled]        = useState(false);
  const [searchActive,      setSearchActive]      = useState(false);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [unreadCount,       setUnreadCount]       = useState(0);
  const [bellAnchorEl,      setBellAnchorEl]      = useState(null);

  // All page navigation items (used by desktop nav + routing sync)
  const navItems = useMemo(() => [
    { id: 0, title: 'Home',       route: Constants.DB_CINEMA_BROWSE_ROUTE,  icon: <HomeIcon /> },
    { id: 1, title: 'Movies',     route: Constants.DB_CINEMA_MOVIES_ROUTE,  icon: <MovieIcon /> },
    { id: 2, title: 'TV Shows',   route: Constants.DB_CINEMA_SERIES_ROUTE,  icon: <TvIcon /> },
    { id: 3, title: 'Categories', route: null,                               icon: null },
    ...(isAndroid ? [{ id: 4, title: 'Downloads', route: Constants.DB_DOWNLOAD_QUEUE_ROUTE, icon: <DownloadNavIcon /> }] : []),
  ], [isAndroid]);

  // Mobile bottom pill items: Home / Movies / Shows / Search / Downloads
  const bottomNavItems = useMemo(() => [
    { id: 0,  title: 'Home',      route: Constants.DB_CINEMA_BROWSE_ROUTE,  icon: <HomeIcon /> },
    { id: 1,  title: 'Movies',    route: Constants.DB_CINEMA_MOVIES_ROUTE,  icon: <MovieIcon /> },
    { id: 2,  title: 'Shows',     route: Constants.DB_CINEMA_SERIES_ROUTE,  icon: <TvIcon /> },
    { id: 99, title: 'Search',    route: null,                               icon: <SearchIcon /> },
    ...(isAndroid ? [{ id: 4, title: 'Downloads', route: Constants.DB_DOWNLOAD_QUEUE_ROUTE, icon: <DownloadNavIcon /> }] : []),
  ], [isAndroid]);

  // Sync selectedNav with current URL
  useEffect(() => {
    const path = location.pathname;
    let match = navItems[0];
    if (path.includes(Constants.DB_CINEMA_MOVIES_ROUTE))  match = navItems[1];
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

  // Load category list for the modal
  useEffect(() => {
    fetchPageCategories('home')
      .then(data => setCategoryList(Array.isArray(data) ? data : []))
      .catch(() => setCategoryList([]));
  }, []);

  // Load unread notification count once on mount.
  // Also surface a one-shot snackbar for REQUEST_FULFILLED notifications — admins
  // mark a media request fulfilled on the admin side and the user sees a toast
  // the next time they load the app. sessionStorage dedupes so the same toast
  // does not fire on every navbar remount within a session.
  useEffect(() => {
    fetchUnreadCount()
      .then(count => {
        const c = Number(count) || 0;
        setUnreadCount(c);
        if (c > 0) {
          fetchNotifications(30)
            .then(list => {
              if (!Array.isArray(list)) return;
              let seen = [];
              try {
                seen = JSON.parse(sessionStorage.getItem('dbw.fulfilledSeen') || '[]');
              } catch { seen = []; }
              const fresh = list.filter(n =>
                !n.read
                && ['REQUEST_FULFILLED', 'REQUEST_DISMISSED', 'CATALOG_INGESTED', 'CATALOG_FULFILLED_BY_SEARCH'].includes(n.type)
                && !seen.includes(n.id)
              );
              if (fresh.length === 0) return;

              fresh.forEach(n => {
                const isCatalogIn = n.type === 'CATALOG_INGESTED';
                const isCatalogBySearch = n.type === 'CATALOG_FULFILLED_BY_SEARCH';
                const isFulfilled = n.type === 'REQUEST_FULFILLED';
                const isDismissed = n.type === 'REQUEST_DISMISSED';

                let message;
                if (isCatalogIn) {
                  message = `"${n.recordTitle}" has been added to the catalog. We'll notify you again when media files arrive.`;
                } else if (isCatalogBySearch) {
                  message = `"${n.recordTitle}" is now available — use search to download the file.`;
                } else if (isFulfilled) {
                  message = `"${n.recordTitle}" is now available — your request was fulfilled.`;
                } else {
                  message = n.message
                    ? `Your request for "${n.recordTitle}" was dismissed: ${n.message}`
                    : `Your request for "${n.recordTitle}" was dismissed by an admin.`;
                }

                // Dismissed catalog requests don't have a record yet (recordId is 0 sentinel).
                const canRoute = !(isDismissed && (!n.recordId || n.recordId === 0));

                notify[isDismissed ? 'warning' : 'success'](message, {
                  duration: isDismissed ? 8000 : 6000,
                  action: canRoute
                    ? {
                        label: 'View',
                        onClick: () => {
                          const isSeries = ['TV_SERIES', 'SERIES', 'TV'].includes((n.recordType ?? '').toUpperCase());
                          const slug = (n.recordTitle ?? '').trim().replace(/\s+/g, '-').toLowerCase();
                          const param = n.recordId ? `${n.recordId}-${slug}` : encodeURIComponent(n.recordTitle ?? '');
                          const route = (isSeries
                            ? Constants.DB_SERIES_DETIALS_ROUTE
                            : Constants.DB_MOVIE_DETIALS_ROUTE
                          ).replace(':title', param);
                          navigate(route);
                        },
                      }
                    : undefined,
                });
              });

              try {
                sessionStorage.setItem(
                  'dbw.fulfilledSeen',
                  JSON.stringify([...seen, ...fresh.map(n => n.id)])
                );
              } catch { /* storage full or disabled */ }
            })
            .catch(() => {});
        }
      })
      .catch(() => {});
  //  and navigate are stable refs from their providers; empty dep is intentional
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Handlers ────────────────────────────────────────────────────────────────

  const handleNavSelect = useCallback((item) => {
    if (item.id === 3) {
      setCategoryModalOpen(true);
    } else if (item.id === 99) {
      setSearchActive(true);
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
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [selectCategory, onGenreSelect]);

  const handleClearCategory = useCallback(() => {
    clearCategory();
    selectCategory(null);
    onGenreSelect?.(null);
    setCategoryModalOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [clearCategory, onGenreSelect, selectCategory]);

  const handleBellClick = (e) => setBellAnchorEl(e.currentTarget);
  const handleBellClose = () => setBellAnchorEl(null);
  const handleUnreadClear = useCallback(() => setUnreadCount(0), []);

  // ─── Derived state ───────────────────────────────────────────────────────────

  const isMediaPage = selectedNav && (selectedNav.id === 1 || selectedNav.id === 2);

  const iconBtn = (onClick, children, extraSx = {}) => (
    <IconButton
      size="medium"
      onClick={onClick}
      sx={{
        color: alpha(theme.palette.common.white, 0.9),
        '&:hover': { color: theme.palette.common.white, bgcolor: alpha(theme.palette.common.white, 0.06) },
        ...extraSx,
      }}
    >
      {children}
    </IconButton>
  );

  // ─── JSX ─────────────────────────────────────────────────────────────────────

  if (isTv) {
    return (
      <>
        <TvDrawer
          activeId={selectedNav?.id ?? 0}
          unreadCount={unreadCount}
          onSearch={() => setSearchActive(true)}
          onFilter={() => setCategoryModalOpen(true)}
          onBell={(e) => setBellAnchorEl(e?.currentTarget ?? document.body)}
          onNavigate={(route) => { navigate(route); }}
          isAndroid={isAndroid}
        />
        {/* Spacer so page content isn't hidden under the 72px drawer */}
        <Box sx={{ ml: '72px' }} />

        <CategoryModal
          open={categoryModalOpen}
          categories={categoryList}
          selectedCategory={selectedCategory}
          onSelect={handleCategorySelect}
          onClear={handleClearCategory}
          onClose={() => setCategoryModalOpen(false)}
          appBarHeight={0}
        />
        <NotificationPanel
          anchorEl={bellAnchorEl}
          onClose={handleBellClose}
          onUnreadClear={handleUnreadClear}
        />
        <AnimatePresence>
          {searchActive && <SearchOverlay onClose={() => setSearchActive(false)} />}
        </AnimatePresence>
      </>
    );
  }

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
                <>
                  <IconButton size="small" onClick={handleBackToHome}
                    sx={{ color: '#fff', p: 0.5 }}>
                    <BackIcon sx={{ fontSize: '1.3rem' }} />
                  </IconButton>
                  <Box component="span" sx={{ fontWeight: 700, fontSize: '1.2rem', color: '#fff', letterSpacing: '-0.01em', lineHeight: 1 }}>
                    {selectedNav?.title}
                  </Box>
                </>
              ) : (
                <>
                  <Link to={Constants.DB_WORLD_HOME_ROUTE} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                    <img src={DB_WORLD_TEAL_SVG} alt="Logo" style={{ height: 26 }} />
                  </Link>
                  <Box component="span" sx={{ fontWeight: 700, fontSize: '1.2rem', color: '#fff', letterSpacing: '-0.01em', lineHeight: 1 }}>
                    {selectedNav?.title ?? 'Home'}
                  </Box>
                </>
              )
            ) : (
              // Desktop: logo + nav links
              <>
                <Link to={Constants.DB_WORLD_HOME_ROUTE} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <img src={DB_WORLD_TEAL_SVG} alt="Logo" style={{ height: 30 }} />
                  <Box component="span" sx={{ fontWeight: 800, fontSize: '1.15rem', color: theme.palette.primary.main, letterSpacing: '-0.02em', lineHeight: 1 }}>
                    DB Cinema
                  </Box>
                </Link>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 1 }}>
                  {navItems.map(item => (
                    <NavLink
                      key={item.id}
                      active={selectedNav?.id === item.id}
                      onClick={() => handleNavSelect(item)}
                      endIcon={item.id === 3
                        ? <ExpandMoreIcon sx={{ fontSize: '1rem !important', ml: -0.5 }} />
                        : undefined}
                    >
                      {item.id === 3 && selectedCategory ? selectedCategory.name : item.title}
                    </NavLink>
                  ))}
                </Box>
              </>
            )}
          </Box>

          {/* RIGHT */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3, flexShrink: 0 }}>
            {/* Bell — shown on all screen sizes */}
            {iconBtn(handleBellClick, (
              <Badge
                badgeContent={unreadCount > 0 ? unreadCount : null}
                color="error"
                max={99}
                sx={{ '& .MuiBadge-badge': { fontSize: '0.6rem', height: 16, minWidth: 16, p: '0 4px' } }}
              >
                <BellIcon sx={{ fontSize: '1.3rem' }} />
              </Badge>
            ))}

            {/* Filter — mobile top bar AND desktop */}
            {iconBtn(
              () => setCategoryModalOpen(true),
              <TuneIcon sx={{ fontSize: '1.3rem' }} />,
              selectedCategory ? { color: theme.palette.primary.main } : {},
            )}

            {/* Search — desktop only */}
            {!isMobile && (
              iconBtn(() => setSearchActive(true), <SearchIcon sx={{ fontSize: '1.35rem' }} />)
            )}
          </Box>
        </Toolbar>
      </StyledAppBar>

      {/* ── Category modal ── */}
      <CategoryModal
        open={categoryModalOpen}
        categories={categoryList}
        selectedCategory={selectedCategory}
        onSelect={handleCategorySelect}
        onClear={handleClearCategory}
        onClose={() => setCategoryModalOpen(false)}
        appBarHeight={isMobile ? 52 : 68}
      />

      {/* ── Notification panel ── */}
      <NotificationPanel
        anchorEl={bellAnchorEl}
        onClose={handleBellClose}
        onUnreadClear={handleUnreadClear}
      />

      {/* ── Search Overlay ── */}
      <AnimatePresence>
        {searchActive && <SearchOverlay onClose={() => setSearchActive(false)} />}
      </AnimatePresence>

      {/* ── Spacer:
            mobile → just toolbar height (52px); no filter row anymore
            desktop → 0 so hero image bleeds under the transparent AppBar
      ── */}
      <Box sx={{ height: { xs: '52px', md: '0px' } }} />

      {/* ── Floating pill bottom navigation (mobile only) ── */}
      {isMobile && (
        <FloatingNavWrapper>
          <FloatingBottomNav>
            {bottomNavItems.map(item => {
              const isActive = item.id === 99
                ? searchActive
                : selectedNav?.id === item.id;
              return (
                <FloatingNavItem
                  key={item.id}
                  active={isActive}
                  onClick={() => handleNavSelect(item)}
                >
                  <Box sx={{ display: 'flex', fontSize: '1.3rem', lineHeight: 1, flexShrink: 0 }}>
                    {item.icon}
                  </Box>
                  {/* Use px (not rem) so system font-size can't blow up the pill */}
                  <Box component="span" sx={{
                    fontSize: '9px',
                    fontWeight: isActive ? 700 : 400,
                    letterSpacing: '0.03em',
                    lineHeight: 1,
                    color: 'inherit',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: '100%',
                  }}>
                    {item.title}
                  </Box>
                </FloatingNavItem>
              );
            })}
          </FloatingBottomNav>
        </FloatingNavWrapper>
      )}

    </>
  );
}

export default Navbar;
