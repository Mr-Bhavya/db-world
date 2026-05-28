// src/shared/components/layout/Header.js
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AppBar, Toolbar, Box, IconButton, Avatar, Typography,
  Menu, MenuItem, Divider, Drawer, List, ListItemButton,
  ListItemIcon, ListItemText, Tooltip, Container, useMediaQuery, useTheme,
} from '@mui/material';
import {
  Menu as MenuIcon, Close as CloseIcon,
  Person as PersonIcon, AdminPanelSettings as AdminIcon,
  Logout as LogoutIcon, HowToReg as RegisterIcon, Lock as LockIcon,
  Cloud as WeatherIcon, Movie as CinemaIcon, SportsEsports as GamesIcon,
  VpnKey as PasswordIcon, DarkMode as DarkModeIcon, LightMode as LightModeIcon,
} from '@mui/icons-material';
import DbWorldLogo from '@assets/images/db-circle-icon.webp';
import { useAuth } from '@features/auth/context/Authentication';
import { useThemeMode } from '@shared/theme';
import Constants from '@shared/constants';

const NAV = [
  { id: 'cinema',   label: 'Cinema',           icon: <CinemaIcon />,   route: Constants.DB_CINEMA_BROWSE_ROUTE },
  { id: 'weather',  label: 'Weather',           icon: <WeatherIcon />,  route: Constants.DB_WEATHER_ROUTE },
  { id: 'games',    label: 'Games',             icon: <GamesIcon />,    route: Constants.DB_GAMES_ROUTE },
  { id: 'password', label: 'Password Manager',  icon: <PasswordIcon />, route: Constants.DB_PASSWORD_MANAGER_ROUTE },
];

const NavLink = ({ item, location, handleNav, T }) => {
  const active = location.pathname.startsWith(item.route);
  return (
    <Box
      component="button"
      onClick={() => handleNav(item.route)}
      sx={{
        background: active ? T.tealBg : 'none',
        border: 'none',
        cursor: 'pointer',
        px: 1.75,
        py: 0.75,
        borderRadius: 1.5,
        color: active ? T.teal : T.textMuted,
        fontFamily: 'inherit',
        fontSize: '0.875rem',
        fontWeight: active ? 600 : 400,
        transition: 'color 0.2s, background 0.2s, box-shadow 0.2s',
        '&:hover': {
          color: T.teal,
          background: T.tealBg,
          boxShadow: `0 2px 0 0 ${T.teal}, 0 4px 8px ${T.tealGlow}`,
        },
        boxShadow: active ? `0 2px 0 0 ${T.teal}` : 'none',
      }}
    >
      {item.label}
    </Box>
  );
};

const ThemeToggleIcon = ({ mode }) => (
  <AnimatePresence mode="wait" initial={false}>
    <motion.div
      key={mode}
      initial={{ rotate: -180, scale: 0, opacity: 0 }}
      animate={{ rotate: 0,    scale: 1, opacity: 1 }}
      exit={{    rotate: 180,  scale: 0, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      style={{ display: 'flex', alignItems: 'center' }}
    >
      {mode === 'dark'
        ? <LightModeIcon sx={{ fontSize: 20 }} />
        : <DarkModeIcon  sx={{ fontSize: 20 }} />
      }
    </motion.div>
  </AnimatePresence>
);

const Header = () => {
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('md'));
  const navigate  = useNavigate();
  const location  = useLocation();
  const { auth, logout } = useAuth();
  const { mode, toggleMode, T } = useThemeMode();

  const isAuth  = auth?.isAuthenticated;
  const user    = auth?.user;
  const role    = auth?.role;
  const isAdmin = role === Constants.OWNER_USER_ROLE || role === Constants.ADMIN_USER_ROLE;

  const [scrolled,   setScrolled]   = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleNav = useCallback((route) => {
    navigate(route);
    setDrawerOpen(false);
    setMenuAnchor(null);
  }, [navigate]);

  const handleLogout = useCallback(() => {
    logout();
    setMenuAnchor(null);
    setDrawerOpen(false);
  }, [logout]);

  if (location.pathname.includes(Constants.DB_CINEMA_ROUTE)) return null;
  if (location.pathname.startsWith(Constants.DB_ADMIN_BASE_ROUTE)) return null;

  const initial = (user?.firstName?.[0] ?? user?.name?.[0] ?? user?.email?.[0] ?? 'U').toUpperCase();

  const scrolledBg = mode === 'dark' ? 'rgba(10,10,15,0.88)' : 'rgba(255,255,255,0.92)';
  const drawerBg   = mode === 'dark' ? 'rgba(10,10,15,0.97)' : 'rgba(255,255,255,0.97)';

  return (
    <>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          background: scrolled ? scrolledBg : 'transparent',
          backdropFilter: scrolled ? 'blur(12px)' : 'none',
          borderBottom: scrolled ? `1px solid ${T.glassBorder}` : 'none',
          transition: 'background 0.3s, backdrop-filter 0.3s, border-color 0.3s',
          zIndex: 1200,
        }}
      >
        <Container maxWidth="xl">
          <Toolbar sx={{ px: { xs: 0 }, minHeight: { xs: 56, md: 64 } }}>

            {/* Cinematic logo */}
            <Box
              onClick={() => handleNav(Constants.DB_WORLD_HOME_ROUTE)}
              sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer', mr: 4 }}
            >
              <motion.div
                initial={{ opacity: 0.6 }}
                animate={{ opacity: [0.6, 1, 0.6] }}
                transition={{ duration: 0.8, times: [0, 0.5, 1], repeat: 0 }}
                style={{ display: 'flex', alignItems: 'center' }}
              >
                <img src={DbWorldLogo} alt="DB World" style={{ width: 28, height: 28 }} />
              </motion.div>
              <Typography
                sx={{
                  fontWeight: 800,
                  fontSize: '1rem',
                  letterSpacing: '-0.02em',
                  background: 'linear-gradient(90deg, #0d9488, #14b8a6)', // fixed brand gradient — same in both modes
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                DB World
              </Typography>
            </Box>

            {/* Desktop nav */}
            {!isMobile && isAuth && (
              <Box sx={{ display: 'flex', gap: 0.5, flexGrow: 1 }}>
                {NAV.map(item => (
                  <NavLink key={item.id} item={item} location={location} handleNav={handleNav} T={T} />
                ))}
              </Box>
            )}
            {!isMobile && !isAuth && <Box sx={{ flexGrow: 1 }} />}

            {/* Desktop theme toggle */}
            {!isMobile && (
              <Tooltip title={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
                <IconButton
                  onClick={toggleMode}
                  size="small"
                  sx={{
                    color: T.textMuted, mr: 1,
                    '&:hover': { color: T.teal, bgcolor: T.tealBg },
                    transition: 'color 0.2s',
                  }}
                >
                  <ThemeToggleIcon mode={mode} />
                </IconButton>
              </Tooltip>
            )}

            {/* Desktop avatar (auth) */}
            {!isMobile && isAuth && (
              <Tooltip title={user?.firstName ?? user?.name ?? 'Account'}>
                <IconButton onClick={(e) => setMenuAnchor(e.currentTarget)} sx={{ p: 0.5 }}>
                  <Avatar sx={{ width: 34, height: 34, bgcolor: T.teal, fontSize: '0.85rem', fontWeight: 700 }}>
                    {initial}
                  </Avatar>
                </IconButton>
              </Tooltip>
            )}

            {/* Desktop guest buttons */}
            {!isMobile && !isAuth && (
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Box
                  component="button"
                  onClick={() => handleNav(Constants.LOGIN_ROUTE)}
                  sx={{
                    background: 'none', border: `1px solid ${T.teal}66`, cursor: 'pointer',
                    color: T.teal, px: 2, py: 0.75, borderRadius: 1, fontSize: '0.875rem',
                    fontFamily: 'inherit', transition: 'all 0.2s',
                    '&:hover': { bgcolor: T.tealBg },
                  }}
                >
                  Login
                </Box>
                <Box
                  component="button"
                  onClick={() => handleNav(Constants.REGISTRATION_ROUTE)}
                  sx={{
                    bgcolor: T.teal, border: 'none', cursor: 'pointer',
                    color: '#fff', px: 2, py: 0.75, borderRadius: 1, fontSize: '0.875rem',
                    fontFamily: 'inherit', transition: 'background 0.2s',
                    '&:hover': { bgcolor: T.tealHover },
                  }}
                >
                  Register
                </Box>
              </Box>
            )}

            {/* Mobile hamburger */}
            {isMobile && (
              <Box sx={{ ml: 'auto' }}>
                <IconButton
                  onClick={() => setDrawerOpen(true)}
                  sx={{ color: T.textMuted, '&:hover': { color: T.teal } }}
                >
                  <MenuIcon />
                </IconButton>
              </Box>
            )}
          </Toolbar>
        </Container>
      </AppBar>

      {/* Avatar dropdown */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        PaperProps={{
          sx: {
            mt: 1, minWidth: 200, borderRadius: 2,
            bgcolor: T.sidebar, backdropFilter: 'blur(20px)',
            border: `1px solid ${T.glassBorder}`,
            '& .MuiMenuItem-root': {
              fontSize: '0.875rem', color: T.textMuted, py: 1.25,
              '&:hover': { bgcolor: T.tealBg, color: T.text },
            },
          },
        }}
      >
        <Box sx={{ px: 2, py: 1.5 }}>
          <Typography sx={{ fontSize: '0.9rem', fontWeight: 600, color: T.text }}>
            {user?.firstName ?? user?.name ?? 'User'}
          </Typography>
          <Typography sx={{ fontSize: '0.75rem', color: T.textFaint }}>
            {user?.email ?? role}
          </Typography>
        </Box>
        <Divider sx={{ borderColor: T.border }} />
        <MenuItem onClick={() => handleNav(Constants.USER_PROFILE_ROUTE)}>
          <PersonIcon sx={{ fontSize: 18, mr: 1.5, color: T.teal }} /> My Profile
        </MenuItem>
        {isAdmin && (
          <MenuItem onClick={() => handleNav(`${Constants.DB_ADMIN_BASE_ROUTE}/dashboard`)}>
            <AdminIcon sx={{ fontSize: 18, mr: 1.5, color: T.teal }} /> Admin Console
          </MenuItem>
        )}
        <Divider sx={{ borderColor: T.border }} />
        <MenuItem onClick={handleLogout} sx={{ color: `${T.error} !important` }}>
          <LogoutIcon sx={{ fontSize: 18, mr: 1.5, color: T.error }} /> Sign Out
        </MenuItem>
      </Menu>

      {/* Mobile drawer */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{
          sx: {
            width: 280, bgcolor: drawerBg,
            backdropFilter: 'blur(20px)',
            borderLeft: `1px solid ${T.glassBorder}`,
            overflow: 'hidden',
          },
        }}
      >
        {/* Teal accent vertical line — scaleY 0→1 on drawer open */}
        <motion.div
          initial={{ scaleY: 0 }}
          animate={{ scaleY: drawerOpen ? 1 : 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
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

        {/* Drawer header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <img src={DbWorldLogo} alt="DB World" style={{ width: 24, height: 24 }} />
            <Typography
              sx={{
                fontWeight: 800,
                fontSize: '0.95rem',
                background: 'linear-gradient(90deg, #0d9488, #14b8a6)', // fixed brand gradient — same in both modes
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              DB World
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Tooltip title={mode === 'dark' ? 'Light mode' : 'Dark mode'}>
              <IconButton size="small" onClick={toggleMode} sx={{ color: T.textMuted, '&:hover': { color: T.teal } }}>
                <ThemeToggleIcon mode={mode} />
              </IconButton>
            </Tooltip>
            <IconButton onClick={() => setDrawerOpen(false)} sx={{ color: T.textMuted }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>
        <Divider sx={{ borderColor: T.border }} />

        {/* User info */}
        {isAuth && (
          <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Avatar sx={{ width: 38, height: 38, bgcolor: T.teal, fontSize: '0.9rem', fontWeight: 700 }}>
              {initial}
            </Avatar>
            <Box>
              <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: T.text }}>
                {user?.firstName ?? user?.name ?? 'User'}
              </Typography>
              <Typography sx={{ fontSize: '0.72rem', color: T.textFaint }}>
                {user?.email ?? role}
              </Typography>
            </Box>
          </Box>
        )}

        {/* Nav links */}
        <List sx={{ px: 1, pt: 1 }}>
          {(isAuth ? NAV : []).map(item => {
            const active = location.pathname.startsWith(item.route);
            return (
              <ListItemButton
                key={item.id}
                onClick={() => handleNav(item.route)}
                sx={{
                  borderRadius: 1.5, mb: 0.5, minHeight: 48,
                  bgcolor: active ? T.tealBg : 'transparent',
                  borderLeft: active ? `3px solid ${T.teal}` : '3px solid transparent',
                  '&:hover': { bgcolor: T.tealBg },
                }}
              >
                <ListItemIcon sx={{ color: active ? T.teal : T.textMuted, minWidth: 36 }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{
                    fontSize: '0.875rem',
                    color: active ? T.teal : T.text,
                    fontWeight: active ? 600 : 400,
                  }}
                />
              </ListItemButton>
            );
          })}
        </List>

        {/* Bottom actions */}
        <Box sx={{ mt: 'auto', px: 1, pb: 2 }}>
          <Divider sx={{ borderColor: T.border, mb: 1 }} />
          {isAuth ? (
            <>
              <ListItemButton
                onClick={() => handleNav(Constants.USER_PROFILE_ROUTE)}
                sx={{ borderRadius: 1.5, mb: 0.5, minHeight: 48, '&:hover': { bgcolor: T.tealBg } }}
              >
                <ListItemIcon sx={{ color: T.teal, minWidth: 36 }}><PersonIcon /></ListItemIcon>
                <ListItemText primary="My Profile" primaryTypographyProps={{ fontSize: '0.875rem', color: T.text }} />
              </ListItemButton>
              {isAdmin && (
                <ListItemButton
                  onClick={() => handleNav(`${Constants.DB_ADMIN_BASE_ROUTE}/dashboard`)}
                  sx={{ borderRadius: 1.5, mb: 0.5, minHeight: 48, '&:hover': { bgcolor: T.tealBg } }}
                >
                  <ListItemIcon sx={{ color: T.teal, minWidth: 36 }}><AdminIcon /></ListItemIcon>
                  <ListItemText primary="Admin Console" primaryTypographyProps={{ fontSize: '0.875rem', color: T.text }} />
                </ListItemButton>
              )}
              <ListItemButton
                onClick={handleLogout}
                sx={{ borderRadius: 1.5, minHeight: 48, '&:hover': { bgcolor: T.errorBg } }}
              >
                <ListItemIcon sx={{ color: T.error, minWidth: 36 }}><LogoutIcon /></ListItemIcon>
                <ListItemText primary="Sign Out" primaryTypographyProps={{ fontSize: '0.875rem', color: T.error }} />
              </ListItemButton>
            </>
          ) : (
            <>
              <ListItemButton
                onClick={() => handleNav(Constants.LOGIN_ROUTE)}
                sx={{ borderRadius: 1.5, mb: 0.5, minHeight: 48, '&:hover': { bgcolor: T.tealBg } }}
              >
                <ListItemIcon sx={{ color: T.teal, minWidth: 36 }}><LockIcon /></ListItemIcon>
                <ListItemText primary="Login" primaryTypographyProps={{ fontSize: '0.875rem', color: T.text }} />
              </ListItemButton>
              <ListItemButton
                onClick={() => handleNav(Constants.REGISTRATION_ROUTE)}
                sx={{ borderRadius: 1.5, minHeight: 48, '&:hover': { bgcolor: T.tealBg } }}
              >
                <ListItemIcon sx={{ color: T.teal, minWidth: 36 }}><RegisterIcon /></ListItemIcon>
                <ListItemText primary="Register" primaryTypographyProps={{ fontSize: '0.875rem', color: T.text }} />
              </ListItemButton>
            </>
          )}
        </Box>
      </Drawer>
    </>
  );
};

export default Header;
