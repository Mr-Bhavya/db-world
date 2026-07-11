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
  Logout as LogoutIcon,
  Menu as MenuIcon,
  Person as PersonIcon,
} from '@mui/icons-material';

import DbWorldLogo from '@assets/images/db-circle-icon.webp';
import { useAuth } from '@features/auth/context/Authentication';
import Constants from '@shared/constants';
import { useThemeMode } from '@shared/theme';
import { APPS } from '@shared/components/layout/home/homeData';

// ─────────────────────────────────────────────────────────────────────────────
// Navigation — apps come from the shared home launcher list (homeData.APPS) so
// the header never has to be kept in sync by hand and never crowds the bar: all
// apps live behind a single "Apps" dropdown.
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

  const initial = useMemo(() => getInitial(user), [user]);

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

  const handleNav = useCallback(
    (route) => {
      navigate(route);
      setDrawerOpen(false);
      setMenuAnchor(null);
      setAppsAnchor(null);
    },
    [navigate]
  );

  const handleLogout = useCallback(() => {
    logout();
    setMenuAnchor(null);
    setDrawerOpen(false);
  }, [logout]);

  const shouldHideHeader =
    location.pathname.includes(Constants.DB_CINEMA_ROUTE) ||
    location.pathname.startsWith(Constants.DB_ADMIN_BASE_ROUTE);

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

            {/* Desktop nav — a single "Apps" dropdown that lists every app, so
                the bar never crowds as more apps are added. */}
            {!isMobile && isAuth && (
              <Box
                component="nav"
                aria-label="Main navigation"
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  flex: '1 1 auto',
                  minWidth: 0,
                }}
              >
                <Box
                  component="button"
                  type="button"
                  onClick={(event) => setAppsAnchor(event.currentTarget)}
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
              </Box>
            )}

            {!isMobile && !isAuth && <Box sx={{ flex: 1, minWidth: 0 }} />}

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
                ) : (
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
                      onClick={() => handleNav(Constants.LOGIN_ROUTE)}
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
                      Login
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
                      Register
                    </Box>
                  </Box>
                )}
              </Box>
            )}

            {/* Mobile hamburger */}
            {isMobile && (
              <Box
                sx={{
                  ml: 'auto',
                  flexShrink: 0,
                }}
              >
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

      {/* Desktop apps menu */}
      <Menu
        anchorEl={appsAnchor}
        open={Boolean(appsAnchor)}
        onClose={() => setAppsAnchor(null)}
        transformOrigin={{ horizontal: 'left', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'left', vertical: 'bottom' }}
        PaperProps={{
          sx: {
            mt: 1,
            minWidth: 240,
            maxWidth: 300,
            borderRadius: 2.5,
            bgcolor: T.sidebar,
            backdropFilter: 'blur(20px)',
            border: `1px solid ${T.glassBorder}`,
            backgroundImage: 'none',
            '& .MuiMenuItem-root': {
              fontSize: '0.875rem',
              color: T.textMuted,
              py: 1.1,
              minHeight: 44,
              '&:hover': { bgcolor: T.tealBg, color: T.text },
              '&.Mui-selected': { bgcolor: T.tealBg, color: T.teal },
              '&.Mui-selected:hover': { bgcolor: T.tealBg, color: T.teal },
            },
          },
        }}
      >
        {visibleApps.map((app) => {
          const AppIcon = app.Icon;
          const active = isRouteActive(location.pathname, app.route);

          return (
            <MenuItem
              key={app.id}
              selected={active}
              onClick={() => handleNav(app.route)}
            >
              {AppIcon && (
                <AppIcon
                  sx={{
                    fontSize: 19,
                    mr: 1.5,
                    color: active ? T.teal : T.textMuted,
                  }}
                />
              )}
              {app.label}
            </MenuItem>
          );
        })}
      </Menu>

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
            {(isAuth ? visibleApps : []).map((item) => {
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
                  onClick={() => handleNav(Constants.LOGIN_ROUTE)}
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
                    primary="Login"
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
                    primary="Register"
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