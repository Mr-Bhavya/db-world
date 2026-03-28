import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import db_world_icon from '@assets/images/db_world_teal.svg';
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
  VpnKey as PasswordIcon,
} from '@mui/icons-material';
import { useAuth } from '@features/auth/context/Authentication';
import Constants from '@shared/constants';

const NAV = [
  { id: 'cinema',   label: 'Cinema',           icon: <CinemaIcon />,   route: Constants.DB_CINEMA_BROWSE_ROUTE },
  { id: 'weather',  label: 'Weather',           icon: <WeatherIcon />,  route: Constants.DB_WEATHER_ROUTE },
  { id: 'games',    label: 'Games',             icon: <GamesIcon />,    route: Constants.DB_GAMES_ROUTE },
  { id: 'password', label: 'Password Manager',  icon: <PasswordIcon />, route: Constants.DB_PASSWORD_MANAGER_ROUTE },
];

const TEAL = '#0d9488';

const Header = () => {
  const theme    = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const location = useLocation();
  const { auth, logout } = useAuth();
  const isAuth = auth?.isAuthenticated;
  const user   = auth?.user;
  const role   = auth?.role;
  const isAdmin = role === Constants.OWNER_USER_ROLE || role === Constants.ADMIN_USER_ROLE;

  const [scrolled,   setScrolled]   = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState(null);

  // Keep existing behaviour — hide on cinema and admin routes
  if (location.pathname.includes(Constants.DB_CINEMA_ROUTE)) return null;
  if (location.pathname.startsWith(Constants.DB_ADMIN_BASE_ROUTE)) return null;

  // Scroll detection
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const initial = (user?.firstName?.[0] ?? user?.name?.[0] ?? user?.email?.[0] ?? 'U').toUpperCase();

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

  // ── Nav link (desktop) ────────────────────────────────────────────────────
  const NavLink = ({ item }) => {
    const active = location.pathname.startsWith(item.route);
    return (
      <Box
        component="button"
        onClick={() => handleNav(item.route)}
        sx={{
          background: 'none', border: 'none', cursor: 'pointer',
          px: 1.5, py: 0.75, borderRadius: 1,
          color: active ? TEAL : 'rgba(241,245,249,0.65)',
          fontFamily: 'inherit', fontSize: '0.875rem', fontWeight: active ? 600 : 400,
          position: 'relative',
          transition: 'color 0.2s',
          '&:hover': { color: TEAL },
          '&::after': {
            content: '""',
            position: 'absolute', bottom: 0, left: '50%',
            transform: active ? 'translateX(-50%) scaleX(1)' : 'translateX(-50%) scaleX(0)',
            transformOrigin: 'center',
            width: '60%', height: 2,
            bgcolor: TEAL, borderRadius: 1,
            transition: 'transform 0.2s',
          },
          '&:hover::after': { transform: 'translateX(-50%) scaleX(1)' },
        }}
      >
        {item.label}
      </Box>
    );
  };

  return (
    <>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          background: scrolled ? 'rgba(10,10,15,0.85)' : 'transparent',
          backdropFilter: scrolled ? 'blur(16px)' : 'none',
          borderBottom: scrolled ? '1px solid rgba(255,255,255,0.06)' : 'none',
          transition: 'background 0.3s, backdrop-filter 0.3s, border-color 0.3s',
          zIndex: 1200,
        }}
      >
        <Container maxWidth="xl">
          <Toolbar sx={{ px: { xs: 0 }, minHeight: { xs: 56, md: 64 } }}>

            {/* Logo */}
            <Box
              onClick={() => handleNav(Constants.DB_WORLD_HOME_ROUTE)}
              sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer', mr: 4 }}
            >
              <Avatar
                src={db_world_icon}
                sx={{
                  width: 32, height: 32,
                  bgcolor: TEAL,
                  border: '1px solid rgba(13,148,136,0.4)',
                  boxShadow: '0 0 12px rgba(13,148,136,0.3)',
                }}
              />
              <Typography sx={{ fontWeight: 800, color: '#f1f5f9', fontSize: '1rem', letterSpacing: '-0.02em' }}>
                DB World
              </Typography>
            </Box>

            {/* Desktop nav — authenticated */}
            {!isMobile && isAuth && (
              <Box sx={{ display: 'flex', gap: 0.5, flexGrow: 1 }}>
                {NAV.map(item => <NavLink key={item.id} item={item} />)}
              </Box>
            )}
            {!isMobile && !isAuth && <Box sx={{ flexGrow: 1 }} />}

            {/* Desktop right — authenticated */}
            {!isMobile && isAuth && (
              <Tooltip title={user?.firstName ?? user?.name ?? 'Account'}>
                <IconButton onClick={(e) => setMenuAnchor(e.currentTarget)} sx={{ p: 0.5 }}>
                  <Avatar sx={{ width: 34, height: 34, bgcolor: TEAL, fontSize: '0.85rem', fontWeight: 700 }}>
                    {initial}
                  </Avatar>
                </IconButton>
              </Tooltip>
            )}

            {/* Desktop right — guest */}
            {!isMobile && !isAuth && (
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Box
                  component="button"
                  onClick={() => handleNav(Constants.LOGIN_ROUTE)}
                  sx={{
                    background: 'none', border: '1px solid rgba(13,148,136,0.4)', cursor: 'pointer',
                    color: TEAL, px: 2, py: 0.75, borderRadius: 1, fontSize: '0.875rem',
                    fontFamily: 'inherit', transition: 'all 0.2s',
                    '&:hover': { bgcolor: 'rgba(13,148,136,0.1)' },
                  }}
                >
                  Login
                </Box>
                <Box
                  component="button"
                  onClick={() => handleNav(Constants.REGISTRATION_ROUTE)}
                  sx={{
                    bgcolor: TEAL, border: 'none', cursor: 'pointer',
                    color: '#fff', px: 2, py: 0.75, borderRadius: 1, fontSize: '0.875rem',
                    fontFamily: 'inherit', transition: 'background 0.2s',
                    '&:hover': { bgcolor: '#0f766e' },
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
                  sx={{ color: 'rgba(241,245,249,0.7)', '&:hover': { color: TEAL } }}
                >
                  <MenuIcon />
                </IconButton>
              </Box>
            )}
          </Toolbar>
        </Container>
      </AppBar>

      {/* ── Avatar dropdown ─────────────────────────────────────────────────── */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        PaperProps={{
          sx: {
            mt: 1, minWidth: 200, borderRadius: 2,
            bgcolor: 'rgba(15,15,20,0.97)', backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.08)',
            '& .MuiMenuItem-root': {
              fontSize: '0.875rem', color: 'rgba(241,245,249,0.8)', py: 1.25,
              '&:hover': { bgcolor: 'rgba(13,148,136,0.1)', color: '#f1f5f9' },
            },
          },
        }}
      >
        <Box sx={{ px: 2, py: 1.5 }}>
          <Typography sx={{ fontSize: '0.9rem', fontWeight: 600, color: '#f1f5f9' }}>
            {user?.firstName ?? user?.name ?? 'User'}
          </Typography>
          <Typography sx={{ fontSize: '0.75rem', color: 'rgba(241,245,249,0.45)' }}>
            {user?.email ?? role}
          </Typography>
        </Box>
        <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />
        <MenuItem onClick={() => handleNav(Constants.USER_PROFILE_ROUTE)}>
          <PersonIcon sx={{ fontSize: 18, mr: 1.5, color: TEAL }} /> My Profile
        </MenuItem>
        {isAdmin && (
          <MenuItem onClick={() => handleNav(`${Constants.DB_ADMIN_BASE_ROUTE}/dashboard`)}>
            <AdminIcon sx={{ fontSize: 18, mr: 1.5, color: TEAL }} /> Admin Console
          </MenuItem>
        )}
        <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />
        <MenuItem onClick={handleLogout} sx={{ color: '#f87171 !important' }}>
          <LogoutIcon sx={{ fontSize: 18, mr: 1.5, color: '#f87171' }} /> Sign Out
        </MenuItem>
      </Menu>

      {/* ── Mobile drawer ────────────────────────────────────────────────────── */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{
          sx: {
            width: 280, bgcolor: 'rgba(10,10,15,0.97)',
            backdropFilter: 'blur(20px)',
            borderLeft: '1px solid rgba(255,255,255,0.06)',
          },
        }}
      >
        {/* Drawer header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Avatar src={db_world_icon} sx={{ width: 28, height: 28, bgcolor: TEAL }} />
            <Typography sx={{ fontWeight: 700, color: '#f1f5f9', fontSize: '0.95rem' }}>DB World</Typography>
          </Box>
          <IconButton onClick={() => setDrawerOpen(false)} sx={{ color: 'rgba(241,245,249,0.5)' }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
        <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />

        {/* User info */}
        {isAuth && (
          <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Avatar sx={{ width: 38, height: 38, bgcolor: TEAL, fontSize: '0.9rem', fontWeight: 700 }}>
              {initial}
            </Avatar>
            <Box>
              <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#f1f5f9' }}>
                {user?.firstName ?? user?.name ?? 'User'}
              </Typography>
              <Typography sx={{ fontSize: '0.72rem', color: 'rgba(241,245,249,0.45)' }}>
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
                  borderRadius: 1.5, mb: 0.5,
                  bgcolor: active ? 'rgba(13,148,136,0.12)' : 'transparent',
                  borderLeft: active ? `3px solid ${TEAL}` : '3px solid transparent',
                  '&:hover': { bgcolor: 'rgba(13,148,136,0.08)' },
                }}
              >
                <ListItemIcon sx={{ color: active ? TEAL : 'rgba(241,245,249,0.5)', minWidth: 36 }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{
                    fontSize: '0.875rem',
                    color: active ? TEAL : 'rgba(241,245,249,0.8)',
                    fontWeight: active ? 600 : 400,
                  }}
                />
              </ListItemButton>
            );
          })}
        </List>

        {/* Bottom actions */}
        <Box sx={{ mt: 'auto', px: 1, pb: 2 }}>
          <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)', mb: 1 }} />
          {isAuth ? (
            <>
              <ListItemButton
                onClick={() => handleNav(Constants.USER_PROFILE_ROUTE)}
                sx={{ borderRadius: 1.5, mb: 0.5, '&:hover': { bgcolor: 'rgba(13,148,136,0.08)' } }}
              >
                <ListItemIcon sx={{ color: TEAL, minWidth: 36 }}><PersonIcon /></ListItemIcon>
                <ListItemText primary="My Profile" primaryTypographyProps={{ fontSize: '0.875rem', color: 'rgba(241,245,249,0.8)' }} />
              </ListItemButton>
              {isAdmin && (
                <ListItemButton
                  onClick={() => handleNav(`${Constants.DB_ADMIN_BASE_ROUTE}/dashboard`)}
                  sx={{ borderRadius: 1.5, mb: 0.5, '&:hover': { bgcolor: 'rgba(13,148,136,0.08)' } }}
                >
                  <ListItemIcon sx={{ color: TEAL, minWidth: 36 }}><AdminIcon /></ListItemIcon>
                  <ListItemText primary="Admin Console" primaryTypographyProps={{ fontSize: '0.875rem', color: 'rgba(241,245,249,0.8)' }} />
                </ListItemButton>
              )}
              <ListItemButton
                onClick={handleLogout}
                sx={{ borderRadius: 1.5, '&:hover': { bgcolor: 'rgba(248,113,113,0.08)' } }}
              >
                <ListItemIcon sx={{ color: '#f87171', minWidth: 36 }}><LogoutIcon /></ListItemIcon>
                <ListItemText primary="Sign Out" primaryTypographyProps={{ fontSize: '0.875rem', color: '#f87171' }} />
              </ListItemButton>
            </>
          ) : (
            <>
              <ListItemButton
                onClick={() => handleNav(Constants.LOGIN_ROUTE)}
                sx={{ borderRadius: 1.5, mb: 0.5, '&:hover': { bgcolor: 'rgba(13,148,136,0.08)' } }}
              >
                <ListItemIcon sx={{ color: TEAL, minWidth: 36 }}><LockIcon /></ListItemIcon>
                <ListItemText primary="Login" primaryTypographyProps={{ fontSize: '0.875rem', color: 'rgba(241,245,249,0.8)' }} />
              </ListItemButton>
              <ListItemButton
                onClick={() => handleNav(Constants.REGISTRATION_ROUTE)}
                sx={{ borderRadius: 1.5, '&:hover': { bgcolor: 'rgba(13,148,136,0.08)' } }}
              >
                <ListItemIcon sx={{ color: TEAL, minWidth: 36 }}><RegisterIcon /></ListItemIcon>
                <ListItemText primary="Register" primaryTypographyProps={{ fontSize: '0.875rem', color: 'rgba(241,245,249,0.8)' }} />
              </ListItemButton>
            </>
          )}
        </Box>
      </Drawer>
    </>
  );
};

export default Header;
