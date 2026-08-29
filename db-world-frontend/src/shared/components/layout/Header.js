// src/shared/components/layout/Header.js

import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

import {
  AppBar,
  Avatar,
  Box,
  Container,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';

import {
  AdminPanelSettings as AdminIcon,
  Apps as AppsIcon,
  Close as CloseIcon,
  DarkMode as DarkModeIcon,
  HowToReg as RegisterIcon,
  Insights as ActivityIcon,
  KeyboardArrowDown as ArrowDownIcon,
  LightMode as LightModeIcon,
  Lock as LockIcon,
  LoginRounded as SignInIcon,
  Logout as LogoutIcon,
  Menu as MenuIcon,
  Person as PersonIcon,
  Search as SearchIcon,
} from '@mui/icons-material';

import DbWorldLogo from '@assets/images/db-circle-icon.webp';
import { useAuth } from '@features/auth/context/Authentication';
import Constants from '@shared/constants';
import { useRequireAuth } from '@features/auth/useRequireAuth';
import { useThemeMode } from '@shared/theme';
import { APPS } from '@shared/components/layout/home/homeData';
import { useHomeSummary } from '@shared/components/layout/home/dashboard/homeSummaryApi';
import AppsMenu from './header/AppsMenu';
import CommandPalette from './header/CommandPalette';
import NotificationBell from './header/NotificationBell';

// ─────────────────────────────────────────────────────────────────────────────
// Navigation — apps come from the shared home launcher list (homeData.APPS) so
// the header never has to be kept in sync by hand and never crowds the bar: all
// apps live behind a single "Apps" panel.
//
// That panel, and the drawer's app list, render for signed-out visitors too. Cinema,
// IPO Radar, Weather and Arcade are public routes, so gating navigation on auth left
// exactly the visitors the public browse surface exists for with nowhere to go; the
// protected apps bounce through PrivateRoute's login redirect and come back.
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const clampTextSx = (lines = 1) => ({
  minWidth: 0,
  overflow: 'hidden',
  display: '-webkit-box',
  WebkitLineClamp: lines,
  WebkitBoxOrient: 'vertical',
  overflowWrap: 'anywhere',
  wordBreak: 'break-word',
});

const focusSx = (color) => ({
  '&:focus-visible': {
    outline: `3px solid ${color}`,
    outlineOffset: 3,
  },
});

const getInitial = (user) => {
  return (
    user?.firstName?.[0] ??
    user?.name?.[0] ??
    user?.email?.[0] ??
    'U'
  ).toUpperCase();
};

/**
 * The label for the search shortcut. ⌘ is Mac-only — this app also ships as a Windows desktop
 * browser target and an Android build, where "⌘K" names a key the user does not have.
 */
const SEARCH_SHORTCUT_LABEL =
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad|iPod/i.test(navigator.userAgentData?.platform ?? navigator.platform ?? '')
    ? '⌘K'
    : 'Ctrl K';

const isRouteActive = (pathname, route) => {
  if (!route) return false;
  return pathname === route || pathname.startsWith(`${route}/`);
};

// ─────────────────────────────────────────────────────────────────────────────
// Theme Toggle Icon
// ─────────────────────────────────────────────────────────────────────────────

const ThemeToggleIcon = memo(function ThemeToggleIcon({ mode }) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={mode}
        initial={
          prefersReducedMotion
            ? false
            : {
                rotate: -120,
                scale: 0.6,
                opacity: 0,
              }
        }
        animate={{
          rotate: 0,
          scale: 1,
          opacity: 1,
        }}
        exit={
          prefersReducedMotion
            ? undefined
            : {
                rotate: 120,
                scale: 0.6,
                opacity: 0,
              }
        }
        transition={{
          type: 'spring',
          stiffness: 260,
          damping: 22,
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
        }}
      >
        {mode === 'dark' ? (
          <LightModeIcon sx={{ fontSize: { xs: 20, xl: 23 } }} />
        ) : (
          <DarkModeIcon sx={{ fontSize: { xs: 20, xl: 23 } }} />
        )}
      </motion.div>
    </AnimatePresence>
  );
});

ThemeToggleIcon.displayName = 'ThemeToggleIcon';

// ─────────────────────────────────────────────────────────────────────────────
// Logo
// ─────────────────────────────────────────────────────────────────────────────

const BrandLogo = memo(function BrandLogo({ onClick }) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <Box
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick();
        }
      }}
      aria-label="Go to DB World home"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: {
          xs: 0.9,
          md: 1,
          xl: 1.2,
        },
        cursor: 'pointer',
        minWidth: 0,
        flexShrink: 0,
        mr: {
          xs: 1,
          md: 3,
          lg: 4,
          xl: 5,
        },
        borderRadius: 2,
        ...focusSx('#14b8a6'),
      }}
    >
      <motion.div
        initial={
          prefersReducedMotion
            ? false
            : {
                opacity: 0.7,
                scale: 0.96,
              }
        }
        animate={{
          opacity: 1,
          scale: 1,
        }}
        transition={{
          duration: 0.35,
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        <img
          src={DbWorldLogo}
          alt="DB World"
          style={{
            width: 30,
            height: 30,
            display: 'block',
          }}
        />
      </motion.div>

      <Typography
        sx={{
          fontWeight: 900,
          fontSize: {
            xs: '1rem',
            md: '1.05rem',
            xl: '1.18rem',
          },
          letterSpacing: '-0.03em',
          lineHeight: 1,
          background: 'linear-gradient(90deg, #0d9488, #14b8a6)',
          backgroundClip: 'text',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          whiteSpace: 'nowrap',
        }}
      >
        DB World
      </Typography>
    </Box>
  );
});

BrandLogo.displayName = 'BrandLogo';

// ─────────────────────────────────────────────────────────────────────────────
// Header
// ─────────────────────────────────────────────────────────────────────────────

const Header = () => {
  const muiTheme = useTheme();
  const prefersReducedMotion = useReducedMotion();

  const isMobile = useMediaQuery(muiTheme.breakpoints.down('md'));
  const isTiny = useMediaQuery('(max-width:380px)');

  const navigate = useNavigate();

  const { promptSignIn } = useRequireAuth();
  const location = useLocation();

  const { auth, logout } = useAuth();
  const { mode, toggleMode, T } = useThemeMode();

  const isAuth = Boolean(auth?.isAuthenticated);
  const user = auth?.user;
  const role = auth?.role;

  const isAdmin =
    role === Constants.OWNER_USER_ROLE || role === Constants.ADMIN_USER_ROLE;

  const [scrolled, setScrolled] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [appsAnchor, setAppsAnchor] = useState(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  // Latches on the first Apps-panel open so the summary is fetched at most once per session
  // from the header, and never at all for a visitor who does not use the panel.
  const [appsPanelUsed, setAppsPanelUsed] = useState(false);

  const initial = useMemo(() => getInitial(user), [user]);

  // Live per-app status for the Apps panel. Same query key as the hub's, so arriving from the
  // dashboard costs nothing; elsewhere it stays unfetched until the panel is actually opened.
  const { data: summary } = useHomeSummary({ enabled: appsPanelUsed });

  // All launchable apps for this user (admin-only apps hidden for viewers),
  // sourced from the single home-launcher list so the header never drifts.
  const visibleApps = useMemo(
    () => APPS.filter((app) => !app.adminOnly || isAdmin),
    [isAdmin]
  );

  const scrolledBg =
    mode === 'dark' ? 'rgba(10,10,15,0.88)' : 'rgba(255,255,255,0.92)';

  const drawerBg =
    mode === 'dark' ? 'rgba(10,10,15,0.98)' : 'rgba(255,255,255,0.98)';

  // ⌘K / Ctrl-K anywhere opens search. Ignored while typing into a field so it cannot
  // hijack a form, and Escape closes it (the Dialog's own onClose handles that).
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key?.toLowerCase() !== 'k' || !(event.metaKey || event.ctrlKey)) return;

      const tag = event.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || event.target?.isContentEditable) return;

      event.preventDefault();
      setPaletteOpen((open) => !open);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    let frameId = null;

    const onScroll = () => {
      if (frameId) return;

      frameId = window.requestAnimationFrame(() => {
        setScrolled(window.scrollY > 80);
        frameId = null;
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', onScroll);

      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, []);

  const closeAllMenus = useCallback(() => {
    setDrawerOpen(false);
    setMenuAnchor(null);
    setAppsAnchor(null);
    setPaletteOpen(false);
  }, []);

  /**
   * Sign in without leaving the page.
   *
   * The header is mounted on every route, so navigating to /login from here would throw away
   * whatever the visitor was reading. The modal keeps it, and the page fills in with their data
   * once they are through.
   */
  const handleSignIn = useCallback(() => {
    closeAllMenus();
    promptSignIn();
  }, [closeAllMenus, promptSignIn]);

  const handleNav = useCallback(
    (route) => {
      navigate(route);
      closeAllMenus();
    },
    [navigate, closeAllMenus]
  );

  const handleLogout = useCallback(() => {
    logout();
    setMenuAnchor(null);
    setDrawerOpen(false);
  }, [logout]);

  const shouldHideHeader =
    location.pathname.includes(Constants.DB_CINEMA_ROUTE) ||
    location.pathname.startsWith(Constants.DB_ADMIN_BASE_ROUTE);

  // The hub's own intro carries "Sign in" and "Create account" as its primary calls to action, so
  // the bar repeating them there showed four buttons for two destinations in a single viewport.
  // Everywhere else the bar is the only way in, so it keeps them.
  const showAuthActions = !isAuth && location.pathname !== Constants.DB_WORLD_HOME_ROUTE;

  if (shouldHideHeader) return null;

  return (
    <>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          bgcolor: scrolled ? scrolledBg : 'transparent',
          backgroundImage: 'none',
          backdropFilter: scrolled ? 'blur(14px)' : 'none',
          borderBottom: scrolled ? `1px solid ${T.glassBorder}` : 'none',
          transition:
            'background-color 0.28s ease, backdrop-filter 0.28s ease, border-color 0.28s ease',
          zIndex: 1200,
        }}
      >
        <Container
          maxWidth={false}
          sx={{
            width: '100%',
            maxWidth: {
              xs: '100%',
              lg: 1320,
              xl: 1680,
            },
            '@media (min-width:1920px)': {
              maxWidth: 1880,
            },
            px: {
              xs: 1.5,
              sm: 2.5,
              md: 3,
              xl: 4,
            },
          }}
        >
          <Toolbar
            disableGutters
            sx={{
              minHeight: {
                xs: 56,
                md: 64,
                xl: 72,
              },
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              minWidth: 0,
            }}
          >
            <BrandLogo onClick={() => handleNav(Constants.DB_WORLD_HOME_ROUTE)} />

            {/* Desktop nav — one "Apps" panel that lists every app, so the bar never
                crowds as more apps are added, plus the search entry point. */}
            {!isMobile && (
              <Box
                component="nav"
                aria-label="Main navigation"
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  flex: '1 1 auto',
                  minWidth: 0,
                }}
              >
                <Box
                  component="button"
                  type="button"
                  onClick={(event) => {
                    setAppsPanelUsed(true);
                    setAppsAnchor(event.currentTarget);
                  }}
                  aria-haspopup="menu"
                  aria-expanded={Boolean(appsAnchor)}
                  sx={{
                    appearance: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.6,
                    px: { md: 1.5, xl: 2 },
                    py: { md: 0.7, xl: 0.9 },
                    borderRadius: 1.7,
                    bgcolor: appsAnchor ? T.tealBg : 'transparent',
                    color: appsAnchor ? T.teal : T.textMuted,
                    fontFamily: 'inherit',
                    fontSize: { md: '0.84rem', xl: '0.95rem' },
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    transition: 'color 0.2s ease, background-color 0.2s ease',
                    ...focusSx(T.teal),
                    '&:hover': { color: T.teal, bgcolor: T.tealBg },
                  }}
                >
                  <AppsIcon sx={{ fontSize: { md: 19, xl: 21 } }} />
                  Apps
                  <ArrowDownIcon
                    sx={{
                      fontSize: { md: 18, xl: 20 },
                      transition: 'transform 0.2s ease',
                      transform: appsAnchor ? 'rotate(180deg)' : 'none',
                    }}
                  />
                </Box>

                {/* Search entry point. A field-shaped button rather than a real input: the
                    palette owns the input, and this way the shortcut hint is discoverable. */}
                <Box
                  component="button"
                  type="button"
                  onClick={() => setPaletteOpen(true)}
                  aria-label="Search DB World"
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    flex: '0 1 320px',
                    minWidth: 0,
                    px: 1.5,
                    py: 0.7,
                    cursor: 'pointer',
                    borderRadius: 2,
                    border: `1px solid ${T.glassBorder}`,
                    bgcolor: T.glass,
                    color: T.textFaint,
                    fontFamily: 'inherit',
                    fontSize: { md: '0.82rem', xl: '0.9rem' },
                    fontWeight: 600,
                    textAlign: 'left',
                    transition: 'border-color 0.2s ease, color 0.2s ease',
                    ...focusSx(T.teal),
                    '&:hover': { borderColor: T.borderHover, color: T.textMuted },
                  }}
                >
                  <SearchIcon sx={{ fontSize: 18, flexShrink: 0 }} />
                  <Box component="span" sx={{ flex: 1, ...clampTextSx(1) }}>
                    Search apps, titles, IPOs
                  </Box>
                  <Box
                    component="span"
                    sx={{
                      display: { md: 'none', lg: 'block' },
                      flexShrink: 0,
                      px: 0.6,
                      py: 0.1,
                      borderRadius: 0.8,
                      border: `1px solid ${T.border}`,
                      fontSize: '0.68rem',
                      fontWeight: 800,
                    }}
                  >
                    {SEARCH_SHORTCUT_LABEL}
                  </Box>
                </Box>
              </Box>
            )}

            {/* Desktop actions */}
            {!isMobile && (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.8,
                  flexShrink: 0,
                  ml: 1,
                }}
              >
                {isAuth && <NotificationBell size={36} iconSize={21} />}

                <Tooltip
                  title={
                    mode === 'dark'
                      ? 'Switch to light mode'
                      : 'Switch to dark mode'
                  }
                >
                  <IconButton
                    onClick={toggleMode}
                    size="small"
                    aria-label="Toggle theme"
                    sx={{
                      color: T.textMuted,
                      width: {
                        md: 36,
                        xl: 42,
                      },
                      height: {
                        md: 36,
                        xl: 42,
                      },
                      ...focusSx(T.teal),
                      '&:hover': {
                        color: T.teal,
                        bgcolor: T.tealBg,
                      },
                    }}
                  >
                    <ThemeToggleIcon mode={mode} />
                  </IconButton>
                </Tooltip>

                {isAuth ? (
                  <Tooltip title={user?.firstName ?? user?.name ?? 'Account'}>
                    <IconButton
                      onClick={(event) => setMenuAnchor(event.currentTarget)}
                      aria-label="Open account menu"
                      sx={{
                        p: 0.5,
                        ...focusSx(T.teal),
                      }}
                    >
                      <Avatar
                        sx={{
                          width: {
                            md: 34,
                            xl: 40,
                          },
                          height: {
                            md: 34,
                            xl: 40,
                          },
                          bgcolor: T.teal,
                          color: '#fff',
                          fontSize: {
                            md: '0.85rem',
                            xl: '0.98rem',
                          },
                          fontWeight: 900,
                        }}
                      >
                        {initial}
                      </Avatar>
                    </IconButton>
                  </Tooltip>
                ) : showAuthActions ? (
                  <Box
                    sx={{
                      display: 'flex',
                      gap: 1,
                      flexShrink: 0,
                    }}
                  >
                    <Box
                      component="button"
                      type="button"
                      onClick={handleSignIn}
                      sx={{
                        bgcolor: 'transparent',
                        border: `1px solid ${T.teal}66`,
                        cursor: 'pointer',
                        color: T.teal,
                        px: 2,
                        py: 0.75,
                        borderRadius: 1.5,
                        fontSize: '0.875rem',
                        fontFamily: 'inherit',
                        fontWeight: 800,
                        whiteSpace: 'nowrap',
                        ...focusSx(T.teal),
                        '&:hover': {
                          bgcolor: T.tealBg,
                        },
                      }}
                    >
                      Sign in
                    </Box>

                    <Box
                      component="button"
                      type="button"
                      onClick={() => handleNav(Constants.REGISTRATION_ROUTE)}
                      sx={{
                        bgcolor: T.teal,
                        border: 'none',
                        cursor: 'pointer',
                        color: '#fff',
                        px: 2,
                        py: 0.75,
                        borderRadius: 1.5,
                        fontSize: '0.875rem',
                        fontFamily: 'inherit',
                        fontWeight: 850,
                        whiteSpace: 'nowrap',
                        ...focusSx(T.teal),
                        '&:hover': {
                          bgcolor: T.tealHover,
                        },
                      }}
                    >
                      Create account
                    </Box>
                  </Box>
                ) : null}
              </Box>
            )}

            {/* Mobile actions */}
            {isMobile && (
              <Box
                sx={{
                  ml: 'auto',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.25,
                  flexShrink: 0,
                }}
              >
                <IconButton
                  onClick={() => setPaletteOpen(true)}
                  aria-label="Search DB World"
                  sx={{
                    color: T.textMuted,
                    width: 42,
                    height: 42,
                    ...focusSx(T.teal),
                    '&:hover': { color: T.teal, bgcolor: T.tealBg },
                  }}
                >
                  <SearchIcon />
                </IconButton>

                {isAuth && <NotificationBell size={42} iconSize={22} />}

                {/* Signed-out visitors get the way in on the bar itself, not buried two taps deep
                    in the drawer. Labelled, not icon-only: a padlock on its own does not read as
                    "sign in", and the bar has ~120px of slack at 375px even with the word. */}
                {showAuthActions && (
                  <Box
                    component="button"
                    type="button"
                    onClick={handleSignIn}
                    aria-label="Sign in"
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      bgcolor: T.teal,
                      border: 'none',
                      cursor: 'pointer',
                      color: '#fff',
                      px: 1.4,
                      height: 34,
                      borderRadius: 1.7,
                      fontFamily: 'inherit',
                      fontSize: '0.82rem',
                      fontWeight: 850,
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                      ...focusSx(T.teal),
                      '&:hover': { bgcolor: T.tealHover },
                    }}
                  >
                    <SignInIcon sx={{ fontSize: 16 }} />
                    Sign in
                  </Box>
                )}

                <IconButton
                  onClick={() => setDrawerOpen(true)}
                  aria-label="Open navigation menu"
                  sx={{
                    color: T.textMuted,
                    width: 42,
                    height: 42,
                    ...focusSx(T.teal),
                    '&:hover': {
                      color: T.teal,
                      bgcolor: T.tealBg,
                    },
                  }}
                >
                  <MenuIcon />
                </IconButton>
              </Box>
            )}
          </Toolbar>
        </Container>
      </AppBar>

      {/* Desktop account menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
        transformOrigin={{
          horizontal: 'right',
          vertical: 'top',
        }}
        anchorOrigin={{
          horizontal: 'right',
          vertical: 'bottom',
        }}
        PaperProps={{
          sx: {
            mt: 1,
            minWidth: 230,
            maxWidth: 320,
            borderRadius: 2.5,
            bgcolor: T.sidebar,
            backdropFilter: 'blur(20px)',
            border: `1px solid ${T.glassBorder}`,
            backgroundImage: 'none',
            '& .MuiMenuItem-root': {
              fontSize: '0.875rem',
              color: T.textMuted,
              py: 1.25,
              minHeight: 44,
              '&:hover': {
                bgcolor: T.tealBg,
                color: T.text,
              },
            },
          },
        }}
      >
        <Box sx={{ px: 2, py: 1.5, minWidth: 0 }}>
          <Typography
            sx={{
              fontSize: '0.92rem',
              fontWeight: 800,
              color: T.text,
              ...clampTextSx(1),
            }}
            title={user?.firstName ?? user?.name ?? 'User'}
          >
            {user?.firstName ?? user?.name ?? 'User'}
          </Typography>

          <Typography
            sx={{
              fontSize: '0.75rem',
              color: T.textFaint,
              mt: 0.25,
              ...clampTextSx(1),
            }}
            title={user?.email ?? role}
          >
            {user?.email ?? role}
          </Typography>
        </Box>

        <Divider sx={{ borderColor: T.border }} />

        <MenuItem onClick={() => handleNav(Constants.USER_PROFILE_ROUTE)}>
          <PersonIcon sx={{ fontSize: 18, mr: 1.5, color: T.teal }} />
          My Profile
        </MenuItem>

        <MenuItem onClick={() => handleNav(Constants.DB_MY_ACTIVITY_ROUTE)}>
          <ActivityIcon sx={{ fontSize: 18, mr: 1.5, color: T.teal }} />
          My Activity
        </MenuItem>

        {isAdmin && (
          <MenuItem
            onClick={() =>
              handleNav(`${Constants.DB_ADMIN_BASE_ROUTE}/dashboard`)
            }
          >
            <AdminIcon sx={{ fontSize: 18, mr: 1.5, color: T.teal }} />
            Admin Console
          </MenuItem>
        )}

        <Divider sx={{ borderColor: T.border }} />

        <MenuItem onClick={handleLogout} sx={{ color: `${T.error} !important` }}>
          <LogoutIcon sx={{ fontSize: 18, mr: 1.5, color: T.error }} />
          Sign Out
        </MenuItem>
      </Menu>

      {/* Desktop apps panel — icon + name + a live one-liner per app */}
      <AppsMenu
        anchorEl={appsAnchor}
        onClose={() => setAppsAnchor(null)}
        apps={visibleApps}
        summary={summary}
        activeRoute={location.pathname}
        onNavigate={handleNav}
      />

      {/* Global search */}
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        apps={visibleApps}
        onNavigate={handleNav}
      />

      {/* Mobile drawer */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{
          sx: {
            width: {
              xs: isTiny ? '92vw' : '86vw',
              sm: 360,
            },
            maxWidth: 380,
            bgcolor: drawerBg,
            backdropFilter: 'blur(22px)',
            borderLeft: `1px solid ${T.glassBorder}`,
            backgroundImage: 'none',
            overflow: 'hidden',
          },
        }}
      >
        <motion.div
          initial={prefersReducedMotion ? false : { scaleY: 0 }}
          animate={{ scaleY: drawerOpen ? 1 : 0 }}
          transition={{ duration: 0.28, ease: 'easeOut' }}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 2,
            background: T.teal,
            transformOrigin: 'top',
            zIndex: 10,
          }}
        />

        <Box
          sx={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
          }}
        >
          {/* Drawer header */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1,
              px: 2,
              py: 1.5,
              minWidth: 0,
            }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                minWidth: 0,
              }}
            >
              <img
                src={DbWorldLogo}
                alt="DB World"
                style={{
                  width: 26,
                  height: 26,
                  flexShrink: 0,
                }}
              />

              <Typography
                sx={{
                  fontWeight: 900,
                  fontSize: '0.98rem',
                  lineHeight: 1,
                  background: 'linear-gradient(90deg, #0d9488, #14b8a6)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  whiteSpace: 'nowrap',
                }}
              >
                DB World
              </Typography>
            </Box>

            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.4,
                flexShrink: 0,
              }}
            >
              <Tooltip title={mode === 'dark' ? 'Light mode' : 'Dark mode'}>
                <IconButton
                  size="small"
                  onClick={toggleMode}
                  aria-label="Toggle theme"
                  sx={{
                    color: T.textMuted,
                    ...focusSx(T.teal),
                    '&:hover': {
                      color: T.teal,
                      bgcolor: T.tealBg,
                    },
                  }}
                >
                  <ThemeToggleIcon mode={mode} />
                </IconButton>
              </Tooltip>

              <IconButton
                onClick={() => setDrawerOpen(false)}
                aria-label="Close navigation menu"
                sx={{
                  color: T.textMuted,
                  ...focusSx(T.teal),
                  '&:hover': {
                    color: T.teal,
                    bgcolor: T.tealBg,
                  },
                }}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>
          </Box>

          <Divider sx={{ borderColor: T.border }} />

          {/* User info */}
          {isAuth && (
            <Box
              sx={{
                px: 2,
                py: 1.5,
                display: 'grid',
                gridTemplateColumns: 'auto minmax(0, 1fr)',
                alignItems: 'center',
                gap: 1.4,
                minWidth: 0,
              }}
            >
              <Avatar
                sx={{
                  width: 40,
                  height: 40,
                  bgcolor: T.teal,
                  color: '#fff',
                  fontSize: '0.92rem',
                  fontWeight: 900,
                }}
              >
                {initial}
              </Avatar>

              <Box sx={{ minWidth: 0 }}>
                <Typography
                  sx={{
                    fontSize: '0.9rem',
                    fontWeight: 800,
                    color: T.text,
                    ...clampTextSx(1),
                  }}
                  title={user?.firstName ?? user?.name ?? 'User'}
                >
                  {user?.firstName ?? user?.name ?? 'User'}
                </Typography>

                <Typography
                  sx={{
                    fontSize: '0.74rem',
                    color: T.textFaint,
                    mt: 0.2,
                    ...clampTextSx(1),
                  }}
                  title={user?.email ?? role}
                >
                  {user?.email ?? role}
                </Typography>
              </Box>
            </Box>
          )}

          {/* Nav links */}
          <List
            sx={{
              px: 1,
              pt: 1,
              minWidth: 0,
            }}
          >
            <ListItemButton
              onClick={() => {
                setDrawerOpen(false);
                setPaletteOpen(true);
              }}
              sx={{
                borderRadius: 1.7,
                mb: 0.5,
                minHeight: 50,
                border: `1px solid ${T.glassBorder}`,
                ...focusSx(T.teal),
                '&:hover': { bgcolor: T.tealBg },
              }}
            >
              <ListItemIcon sx={{ color: T.textMuted, minWidth: 38 }}>
                <SearchIcon />
              </ListItemIcon>

              <ListItemText
                primary="Search"
                primaryTypographyProps={{
                  fontSize: '0.9rem',
                  color: T.textMuted,
                  fontWeight: 650,
                  noWrap: true,
                }}
              />
            </ListItemButton>

            {visibleApps.map((item) => {
              const active = isRouteActive(location.pathname, item.route);
              const ItemIcon = item.Icon;

              return (
                <ListItemButton
                  key={item.id}
                  onClick={() => handleNav(item.route)}
                  sx={{
                    borderRadius: 1.7,
                    mb: 0.5,
                    minHeight: 50,
                    bgcolor: active ? T.tealBg : 'transparent',
                    borderLeft: active
                      ? `3px solid ${T.teal}`
                      : '3px solid transparent',
                    ...focusSx(T.teal),
                    '&:hover': {
                      bgcolor: T.tealBg,
                    },
                  }}
                >
                  <ListItemIcon
                    sx={{
                      color: active ? T.teal : T.textMuted,
                      minWidth: 38,
                    }}
                  >
                    {ItemIcon && <ItemIcon />}
                  </ListItemIcon>

                  <ListItemText
                    primary={item.label}
                    primaryTypographyProps={{
                      fontSize: '0.9rem',
                      color: active ? T.teal : T.text,
                      fontWeight: active ? 800 : 650,
                      noWrap: true,
                    }}
                  />
                </ListItemButton>
              );
            })}
          </List>

          {/* Bottom actions */}
          <Box
            sx={{
              mt: 'auto',
              px: 1,
              pb: 2,
              minWidth: 0,
            }}
          >
            <Divider sx={{ borderColor: T.border, mb: 1 }} />

            {isAuth ? (
              <>
                <ListItemButton
                  onClick={() => handleNav(Constants.USER_PROFILE_ROUTE)}
                  sx={{
                    borderRadius: 1.7,
                    mb: 0.5,
                    minHeight: 50,
                    ...focusSx(T.teal),
                    '&:hover': {
                      bgcolor: T.tealBg,
                    },
                  }}
                >
                  <ListItemIcon sx={{ color: T.teal, minWidth: 38 }}>
                    <PersonIcon />
                  </ListItemIcon>

                  <ListItemText
                    primary="My Profile"
                    primaryTypographyProps={{
                      fontSize: '0.9rem',
                      color: T.text,
                      fontWeight: 700,
                    }}
                  />
                </ListItemButton>

                <ListItemButton
                  onClick={() => handleNav(Constants.DB_MY_ACTIVITY_ROUTE)}
                  sx={{
                    borderRadius: 1.7,
                    mb: 0.5,
                    minHeight: 50,
                    ...focusSx(T.teal),
                    '&:hover': {
                      bgcolor: T.tealBg,
                    },
                  }}
                >
                  <ListItemIcon sx={{ color: T.teal, minWidth: 38 }}>
                    <ActivityIcon />
                  </ListItemIcon>

                  <ListItemText
                    primary="My Activity"
                    primaryTypographyProps={{
                      fontSize: '0.9rem',
                      color: T.text,
                      fontWeight: 700,
                    }}
                  />
                </ListItemButton>

                {isAdmin && (
                  <ListItemButton
                    onClick={() =>
                      handleNav(`${Constants.DB_ADMIN_BASE_ROUTE}/dashboard`)
                    }
                    sx={{
                      borderRadius: 1.7,
                      mb: 0.5,
                      minHeight: 50,
                      ...focusSx(T.teal),
                      '&:hover': {
                        bgcolor: T.tealBg,
                      },
                    }}
                  >
                    <ListItemIcon sx={{ color: T.teal, minWidth: 38 }}>
                      <AdminIcon />
                    </ListItemIcon>

                    <ListItemText
                      primary="Admin Console"
                      primaryTypographyProps={{
                        fontSize: '0.9rem',
                        color: T.text,
                        fontWeight: 700,
                      }}
                    />
                  </ListItemButton>
                )}

                <ListItemButton
                  onClick={handleLogout}
                  sx={{
                    borderRadius: 1.7,
                    minHeight: 50,
                    ...focusSx(T.error),
                    '&:hover': {
                      bgcolor: T.errorBg,
                    },
                  }}
                >
                  <ListItemIcon sx={{ color: T.error, minWidth: 38 }}>
                    <LogoutIcon />
                  </ListItemIcon>

                  <ListItemText
                    primary="Sign Out"
                    primaryTypographyProps={{
                      fontSize: '0.9rem',
                      color: T.error,
                      fontWeight: 750,
                    }}
                  />
                </ListItemButton>
              </>
            ) : (
              <>
                <ListItemButton
                  onClick={handleSignIn}
                  sx={{
                    borderRadius: 1.7,
                    mb: 0.5,
                    minHeight: 50,
                    ...focusSx(T.teal),
                    '&:hover': {
                      bgcolor: T.tealBg,
                    },
                  }}
                >
                  <ListItemIcon sx={{ color: T.teal, minWidth: 38 }}>
                    <LockIcon />
                  </ListItemIcon>

                  <ListItemText
                    primary="Sign in"
                    primaryTypographyProps={{
                      fontSize: '0.9rem',
                      color: T.text,
                      fontWeight: 700,
                    }}
                  />
                </ListItemButton>

                <ListItemButton
                  onClick={() => handleNav(Constants.REGISTRATION_ROUTE)}
                  sx={{
                    borderRadius: 1.7,
                    minHeight: 50,
                    ...focusSx(T.teal),
                    '&:hover': {
                      bgcolor: T.tealBg,
                    },
                  }}
                >
                  <ListItemIcon sx={{ color: T.teal, minWidth: 38 }}>
                    <RegisterIcon />
                  </ListItemIcon>

                  <ListItemText
                    primary="Create account"
                    primaryTypographyProps={{
                      fontSize: '0.9rem',
                      color: T.text,
                      fontWeight: 700,
                    }}
                  />
                </ListItemButton>
              </>
            )}
          </Box>
        </Box>
      </Drawer>
    </>
  );
};

export default Header;