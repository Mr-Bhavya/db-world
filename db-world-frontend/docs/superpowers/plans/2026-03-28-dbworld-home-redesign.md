# DB World Home Page & Header Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite `Header.js` and `Home.js` in place with a dark glassmorphism design — teal accent, scroll-aware sticky header, personalised hero, glassmorphic app grid, recent activity, and footer.

**Architecture:** Two self-contained rewrites. `Header.js` handles sticky scroll-aware nav with desktop/mobile layouts. `Home.js` composes Hero + AppGrid + RecentActivity + Footer sections. Recent-activity state lives in `localStorage` key `dbworld_recent` and is read/written by `Home.js`.

**Tech Stack:** React 18, MUI v7, Framer Motion 12, React Router v6, `useAuth` hook, `@shared/constants`

---

## Design tokens (reference throughout)

```js
const T = {
  bg:           '#0a0a0f',
  bgAlt:        '#0d1a1a',
  teal:         '#0d9488',
  tealHover:    '#0f766e',
  tealGlow:     'rgba(13,148,136,0.15)',
  glass:        'rgba(255,255,255,0.04)',
  glassBorder:  'rgba(255,255,255,0.08)',
  glassHover:   'rgba(255,255,255,0.07)',
  headerSolid:  'rgba(10,10,15,0.85)',
  textPrimary:  '#f1f5f9',
  textMuted:    'rgba(241,245,249,0.55)',
  textFaint:    'rgba(241,245,249,0.35)',
  footerBg:     'rgba(255,255,255,0.03)',
  footerBorder: 'rgba(255,255,255,0.06)',
};
```

---

## File map

| File | Action |
|------|--------|
| `src/shared/components/layout/Header.js` | Full rewrite |
| `src/shared/components/layout/Home.js` | Full rewrite |

---

## Task 1 — Rewrite Header.js

**File:** `src/shared/components/layout/Header.js`

- [ ] **Step 1: Write the full Header component**

Replace the entire file with:

```jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
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
  const theme   = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate  = useNavigate();
  const location  = useLocation();
  const { auth, logout } = useAuth();
  const isAuth  = auth?.isAuthenticated;
  const user    = auth?.user;
  const role    = auth?.role;
  const isAdmin = role === Constants.OWNER_USER_ROLE || role === Constants.ADMIN_USER_ROLE;

  const [scrolled,     setScrolled]     = useState(false);
  const [drawerOpen,   setDrawerOpen]   = useState(false);
  const [menuAnchor,   setMenuAnchor]   = useState(null);

  // Hide on cinema and admin routes — keep existing behaviour
  if (location.pathname.includes(Constants.DB_CINEMA_ROUTE)) return null;
  if (location.pathname.startsWith(Constants.DB_ADMIN_BASE_ROUTE))  return null;

  // Scroll detection
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const initial = user?.firstName?.[0] ?? user?.name?.[0] ?? user?.email?.[0] ?? 'U';

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

  // ── Desktop nav link ────────────────────────────────────────────────────────
  const NavLink = ({ item }) => {
    const active = location.pathname.startsWith(item.route);
    return (
      <Box
        component="button"
        onClick={() => handleNav(item.route)}
        sx={{
          background: 'none', border: 'none', cursor: 'pointer',
          px: 1.5, py: 0.75, borderRadius: 1,
          color: active ? TEAL : 'rgba(241,245,249,0.7)',
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
                  border: `1px solid rgba(13,148,136,0.4)`,
                  boxShadow: '0 0 12px rgba(13,148,136,0.3)',
                }}
              />
              <Typography sx={{ fontWeight: 800, color: '#f1f5f9', fontSize: '1rem', letterSpacing: '-0.02em' }}>
                DB World
              </Typography>
            </Box>

            {/* Desktop nav */}
            {!isMobile && isAuth && (
              <Box sx={{ display: 'flex', gap: 0.5, flexGrow: 1 }}>
                {NAV.map(item => <NavLink key={item.id} item={item} />)}
              </Box>
            )}
            {!isMobile && !isAuth && <Box sx={{ flexGrow: 1 }} />}

            {/* Desktop right — authenticated */}
            {!isMobile && isAuth && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Tooltip title={user?.firstName ?? user?.name ?? 'Account'}>
                  <IconButton onClick={(e) => setMenuAnchor(e.currentTarget)} sx={{ p: 0.5 }}>
                    <Avatar sx={{ width: 34, height: 34, bgcolor: TEAL, fontSize: '0.85rem', fontWeight: 700 }}>
                      {initial.toUpperCase()}
                    </Avatar>
                  </IconButton>
                </Tooltip>
              </Box>
            )}

            {/* Desktop right — guest */}
            {!isMobile && !isAuth && (
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Box component="button" onClick={() => handleNav(Constants.LOGIN_ROUTE)}
                  sx={{ background: 'none', border: `1px solid rgba(13,148,136,0.4)`, cursor: 'pointer',
                    color: TEAL, px: 2, py: 0.75, borderRadius: 1, fontSize: '0.875rem', fontFamily: 'inherit',
                    transition: 'all 0.2s', '&:hover': { bgcolor: 'rgba(13,148,136,0.1)' } }}>
                  Login
                </Box>
                <Box component="button" onClick={() => handleNav(Constants.REGISTRATION_ROUTE)}
                  sx={{ background: TEAL, border: 'none', cursor: 'pointer',
                    color: '#fff', px: 2, py: 0.75, borderRadius: 1, fontSize: '0.875rem', fontFamily: 'inherit',
                    transition: 'background 0.2s', '&:hover': { bgcolor: '#0f766e' } }}>
                  Register
                </Box>
              </Box>
            )}

            {/* Mobile hamburger */}
            {isMobile && (
              <Box sx={{ ml: 'auto' }}>
                <IconButton onClick={() => setDrawerOpen(true)}
                  sx={{ color: 'rgba(241,245,249,0.7)', '&:hover': { color: TEAL } }}>
                  <MenuIcon />
                </IconButton>
              </Box>
            )}
          </Toolbar>
        </Container>
      </AppBar>

      {/* Avatar dropdown menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        PaperProps={{
          sx: {
            mt: 1, minWidth: 200, borderRadius: 2,
            bgcolor: 'rgba(15,15,20,0.95)', backdropFilter: 'blur(20px)',
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

      {/* Mobile drawer */}
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

        {isAuth && (
          <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Avatar sx={{ width: 38, height: 38, bgcolor: TEAL, fontSize: '0.9rem', fontWeight: 700 }}>
              {initial.toUpperCase()}
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

        <List sx={{ px: 1, pt: 1 }}>
          {(isAuth ? NAV : []).map(item => {
            const active = location.pathname.startsWith(item.route);
            return (
              <ListItemButton key={item.id} onClick={() => handleNav(item.route)}
                sx={{
                  borderRadius: 1.5, mb: 0.5,
                  bgcolor: active ? 'rgba(13,148,136,0.12)' : 'transparent',
                  borderLeft: active ? `3px solid ${TEAL}` : '3px solid transparent',
                  '&:hover': { bgcolor: 'rgba(13,148,136,0.08)' },
                }}>
                <ListItemIcon sx={{ color: active ? TEAL : 'rgba(241,245,249,0.5)', minWidth: 36 }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText primary={item.label}
                  primaryTypographyProps={{ fontSize: '0.875rem', color: active ? TEAL : 'rgba(241,245,249,0.8)', fontWeight: active ? 600 : 400 }} />
              </ListItemButton>
            );
          })}
        </List>

        <Box sx={{ mt: 'auto', px: 1, pb: 2 }}>
          <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)', mb: 1 }} />
          {isAuth ? (
            <>
              <ListItemButton onClick={() => handleNav(Constants.USER_PROFILE_ROUTE)}
                sx={{ borderRadius: 1.5, mb: 0.5, '&:hover': { bgcolor: 'rgba(13,148,136,0.08)' } }}>
                <ListItemIcon sx={{ color: TEAL, minWidth: 36 }}><PersonIcon /></ListItemIcon>
                <ListItemText primary="My Profile" primaryTypographyProps={{ fontSize: '0.875rem', color: 'rgba(241,245,249,0.8)' }} />
              </ListItemButton>
              {isAdmin && (
                <ListItemButton onClick={() => handleNav(`${Constants.DB_ADMIN_BASE_ROUTE}/dashboard`)}
                  sx={{ borderRadius: 1.5, mb: 0.5, '&:hover': { bgcolor: 'rgba(13,148,136,0.08)' } }}>
                  <ListItemIcon sx={{ color: TEAL, minWidth: 36 }}><AdminIcon /></ListItemIcon>
                  <ListItemText primary="Admin Console" primaryTypographyProps={{ fontSize: '0.875rem', color: 'rgba(241,245,249,0.8)' }} />
                </ListItemButton>
              )}
              <ListItemButton onClick={handleLogout}
                sx={{ borderRadius: 1.5, '&:hover': { bgcolor: 'rgba(248,113,113,0.08)' } }}>
                <ListItemIcon sx={{ color: '#f87171', minWidth: 36 }}><LogoutIcon /></ListItemIcon>
                <ListItemText primary="Sign Out" primaryTypographyProps={{ fontSize: '0.875rem', color: '#f87171' }} />
              </ListItemButton>
            </>
          ) : (
            <>
              <ListItemButton onClick={() => handleNav(Constants.LOGIN_ROUTE)}
                sx={{ borderRadius: 1.5, mb: 0.5, '&:hover': { bgcolor: 'rgba(13,148,136,0.08)' } }}>
                <ListItemIcon sx={{ color: TEAL, minWidth: 36 }}><LockIcon /></ListItemIcon>
                <ListItemText primary="Login" primaryTypographyProps={{ fontSize: '0.875rem', color: 'rgba(241,245,249,0.8)' }} />
              </ListItemButton>
              <ListItemButton onClick={() => handleNav(Constants.REGISTRATION_ROUTE)}
                sx={{ borderRadius: 1.5, '&:hover': { bgcolor: 'rgba(13,148,136,0.08)' } }}>
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
```

- [ ] **Step 2: Verify Header renders**

Start the dev server (`npm start` or `yarn start` inside `db-world-frontend/`) and open `/db-world`. Check:
- Header is transparent over hero, turns glassy on scroll
- Desktop: logo left, nav links center, avatar right
- Mobile: logo left, hamburger right — drawer opens from right
- Drawer closes after any nav item click
- Guest state shows Login/Register buttons instead of nav+avatar
- Admin menu item visible only for ADMIN/OWNER roles

- [ ] **Step 3: Commit Header**

```bash
cd db-world-frontend
git add src/shared/components/layout/Header.js
git commit -m "feat(home): redesign Header — dark glass, scroll-aware, mobile drawer"
```

---

## Task 2 — Rewrite Home.js

**File:** `src/shared/components/layout/Home.js`

- [ ] **Step 1: Write the full Home component**

Replace the entire file with:

```jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import {
  Box, Typography, Button, Chip, Grid, Container,
  useMediaQuery, useTheme,
} from '@mui/material';
import {
  MovieFilter as CinemaIcon,
  WbSunny as WeatherIcon,
  SportsEsports as GamesIcon,
  Lock as PasswordIcon,
  AdminPanelSettings as AdminIcon,
  ArrowForward as ArrowIcon,
  KeyboardArrowDown as ChevronDown,
} from '@mui/icons-material';
import { useAuth } from '@features/auth/context/Authentication';
import Constants from '@shared/constants';

// ── Design tokens ─────────────────────────────────────────────────────────────
const T = {
  bg:          '#0a0a0f',
  teal:        '#0d9488',
  tealHover:   '#0f766e',
  glass:       'rgba(255,255,255,0.04)',
  glassBorder: 'rgba(255,255,255,0.08)',
  glassHover:  'rgba(255,255,255,0.07)',
  textPrimary: '#f1f5f9',
  textMuted:   'rgba(241,245,249,0.55)',
  textFaint:   'rgba(241,245,249,0.35)',
};

// ── App catalogue ─────────────────────────────────────────────────────────────
const APPS = [
  {
    id: 'cinema',
    label: 'DB Cinema',
    description: 'Stream movies & TV shows in your personal library.',
    icon: CinemaIcon,
    route: Constants.DB_CINEMA_BROWSE_ROUTE,
    adminOnly: false,
  },
  {
    id: 'weather',
    label: 'DB Weather',
    description: 'Real-time forecasts and interactive weather maps.',
    icon: WeatherIcon,
    route: Constants.DB_WEATHER_ROUTE,
    adminOnly: false,
  },
  {
    id: 'games',
    label: 'DB Games',
    description: 'Browser games with cloud save and leaderboards.',
    icon: GamesIcon,
    route: Constants.DB_GAMES_ROUTE,
    adminOnly: false,
  },
  {
    id: 'password',
    label: 'Password Manager',
    description: 'Encrypted vault for all your credentials.',
    icon: PasswordIcon,
    route: Constants.DB_PASSWORD_MANAGER_ROUTE,
    adminOnly: false,
  },
  {
    id: 'admin',
    label: 'Admin Console',
    description: 'System management, analytics and content control.',
    icon: AdminIcon,
    route: `${Constants.DB_ADMIN_BASE_ROUTE}/dashboard`,
    adminOnly: true,
  },
];

const RECENT_KEY = 'dbworld_recent';

function getRecent() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveRecent(appId, route) {
  const prev = getRecent().filter(e => e.appId !== appId);
  const next = [{ appId, route, ts: Date.now() }, ...prev].slice(0, 5);
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
}

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Glassmorphic app card ──────────────────────────────────────────────────────
const AppCard = ({ app, index, onNavigate }) => {
  const Icon = app.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08 }}
      whileHover={{ y: -4 }}
      style={{ height: '100%' }}
    >
      <Box
        onClick={() => onNavigate(app)}
        sx={{
          height: '100%',
          minHeight: 180,
          p: 3,
          bgcolor: T.glass,
          border: `1px solid ${T.glassBorder}`,
          borderRadius: 3,
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5,
          transition: 'background 0.2s, border-color 0.2s, box-shadow 0.2s',
          '&:hover': {
            bgcolor: T.glassHover,
            borderColor: 'rgba(13,148,136,0.4)',
            boxShadow: '0 0 24px rgba(13,148,136,0.12)',
          },
        }}
      >
        <Box sx={{
          width: 44, height: 44, borderRadius: 2,
          bgcolor: 'rgba(13,148,136,0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '1px solid rgba(13,148,136,0.2)',
        }}>
          <Icon sx={{ fontSize: 22, color: T.teal }} />
        </Box>

        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontSize: '0.95rem', fontWeight: 600, color: T.textPrimary, mb: 0.5 }}>
            {app.label}
          </Typography>
          <Typography sx={{ fontSize: '0.8rem', color: T.textMuted, lineHeight: 1.5 }}>
            {app.description}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <ArrowIcon sx={{ fontSize: 16, color: 'rgba(13,148,136,0.5)' }} />
        </Box>
      </Box>
    </motion.div>
  );
};

// ── Recent mini-card ───────────────────────────────────────────────────────────
const RecentCard = ({ entry, index, onNavigate }) => {
  const app = APPS.find(a => a.id === entry.appId);
  if (!app) return null;
  const Icon = app.icon;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, delay: index * 0.06 }}
    >
      <Box
        onClick={() => onNavigate(app)}
        sx={{
          px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 1.5,
          bgcolor: T.glass, border: `1px solid ${T.glassBorder}`,
          borderRadius: 2, cursor: 'pointer', minWidth: 160, flexShrink: 0,
          transition: 'background 0.2s, border-color 0.2s',
          '&:hover': { bgcolor: T.glassHover, borderColor: 'rgba(13,148,136,0.3)' },
        }}
      >
        <Icon sx={{ fontSize: 18, color: T.teal }} />
        <Box>
          <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: T.textPrimary }}>
            {app.label}
          </Typography>
          <Typography sx={{ fontSize: '0.7rem', color: T.textFaint }}>
            {timeAgo(entry.ts)}
          </Typography>
        </Box>
      </Box>
    </motion.div>
  );
};

// ── Main component ─────────────────────────────────────────────────────────────
const Home = () => {
  const navigate  = useNavigate();
  const theme     = useTheme();
  const isMobile  = useMediaQuery(theme.breakpoints.down('md'));
  const { auth }  = useAuth();
  const user      = auth?.user;
  const role      = auth?.role;
  const isAdmin   = role === Constants.OWNER_USER_ROLE || role === Constants.ADMIN_USER_ROLE;

  const [recent,    setRecent]    = useState([]);
  const [scrolled,  setScrolled]  = useState(false);
  const heroRef = useRef(null);

  useEffect(() => {
    setRecent(getRecent());
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleNavigate = useCallback((app) => {
    saveRecent(app.id, app.route);
    setRecent(getRecent());
    navigate(app.route);
  }, [navigate]);

  const scrollToApps = () => {
    document.getElementById('apps')?.scrollIntoView({ behavior: 'smooth' });
  };

  const firstName = user?.firstName ?? user?.name?.split(' ')[0] ?? null;
  const lastRecent = recent[0] ? APPS.find(a => a.id === recent[0].appId) : null;

  const visibleApps = APPS.filter(a => !a.adminOnly || isAdmin);

  return (
    <Box sx={{ bgcolor: T.bg, minHeight: '100vh', color: T.textPrimary }}>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <Box
        ref={heroRef}
        sx={{
          minHeight: '100vh',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          pt: { xs: '56px', md: '64px' },
          px: 3,
          position: 'relative',
          background: 'linear-gradient(135deg, #0a0a0f 0%, #0d1a1a 60%, #0a0f0f 100%)',
          overflow: 'hidden',
          textAlign: 'center',
        }}
      >
        {/* Teal radial glow */}
        <motion.div
          animate={{ opacity: [0.08, 0.18, 0.08] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: 'radial-gradient(ellipse 60% 50% at 60% 40%, rgba(13,148,136,0.18) 0%, transparent 70%)',
          }}
        />

        {/* Content */}
        <Box sx={{ position: 'relative', zIndex: 1, maxWidth: 700 }}>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Typography
              variant={isMobile ? 'h3' : 'h2'}
              sx={{
                fontWeight: 800, color: T.textPrimary,
                letterSpacing: '-0.03em', lineHeight: 1.15,
                fontSize: { xs: '2rem', sm: '2.5rem', md: '3.25rem' },
              }}
            >
              {firstName ? `Welcome back, ${firstName}` : 'Welcome to DB World'}
            </Typography>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <Typography sx={{ mt: 2, fontSize: { xs: '1rem', md: '1.15rem' }, color: T.textMuted, lineHeight: 1.7 }}>
              Your personal media universe — everything in one place.
            </Typography>
          </motion.div>

          {/* Continue chip */}
          {lastRecent && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              style={{ marginTop: 20 }}
            >
              <Chip
                icon={<lastRecent.icon sx={{ fontSize: '16px !important', color: `${T.teal} !important` }} />}
                label={`Continue: ${lastRecent.label} →`}
                onClick={() => handleNavigate(lastRecent)}
                sx={{
                  bgcolor: 'rgba(13,148,136,0.1)', color: T.teal,
                  border: '1px solid rgba(13,148,136,0.3)',
                  fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
                  '&:hover': { bgcolor: 'rgba(13,148,136,0.18)' },
                  '& .MuiChip-icon': { color: T.teal },
                }}
              />
            </motion.div>
          )}

          {/* CTA buttons */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <Box sx={{
              mt: 4, display: 'flex', gap: 2,
              justifyContent: 'center', flexWrap: 'wrap',
            }}>
              <Button
                variant="contained"
                size="large"
                onClick={() => navigate(Constants.DB_CINEMA_BROWSE_ROUTE)}
                sx={{
                  bgcolor: T.teal, color: '#fff', fontWeight: 700,
                  px: 3.5, py: 1.25, borderRadius: 2, textTransform: 'none', fontSize: '0.95rem',
                  boxShadow: '0 4px 20px rgba(13,148,136,0.35)',
                  '&:hover': { bgcolor: T.tealHover },
                }}
              >
                Open Cinema
              </Button>
              <Button
                variant="outlined"
                size="large"
                onClick={scrollToApps}
                sx={{
                  borderColor: 'rgba(13,148,136,0.4)', color: T.teal,
                  fontWeight: 600, px: 3.5, py: 1.25, borderRadius: 2,
                  textTransform: 'none', fontSize: '0.95rem',
                  '&:hover': { borderColor: T.teal, bgcolor: 'rgba(13,148,136,0.06)' },
                }}
              >
                Explore Apps
              </Button>
            </Box>
          </motion.div>
        </Box>

        {/* Scroll chevron */}
        <motion.div
          animate={{ y: [0, 8, 0], opacity: scrolled ? 0 : 1 }}
          transition={{ y: { duration: 1.5, repeat: Infinity, ease: 'easeInOut' }, opacity: { duration: 0.3 } }}
          style={{ position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)' }}
        >
          <ChevronDown sx={{ fontSize: 28, color: T.textFaint }} />
        </motion.div>
      </Box>

      {/* ── App Grid ──────────────────────────────────────────────────────── */}
      <Box id="apps" sx={{ py: { xs: 6, md: 10 }, px: { xs: 2, md: 3 } }}>
        <Container maxWidth="lg">
          <Box sx={{ mb: 5, textAlign: 'center' }}>
            <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: T.teal,
              textTransform: 'uppercase', letterSpacing: '0.12em', mb: 1 }}>
              YOUR APPS
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 700, color: T.textPrimary, letterSpacing: '-0.02em' }}>
              Everything in one place
            </Typography>
          </Box>

          <Grid container spacing={2.5}>
            {visibleApps.map((app, i) => (
              <Grid key={app.id} item xs={12} sm={6} md={6} lg={3}>
                <AppCard app={app} index={i} onNavigate={handleNavigate} />
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* ── Recent Activity ────────────────────────────────────────────────── */}
      {recent.length > 0 && (
        <Box sx={{ pb: { xs: 6, md: 8 }, px: { xs: 2, md: 3 } }}>
          <Container maxWidth="lg">
            <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, color: T.textMuted, mb: 2 }}>
              Continue where you left off
            </Typography>
            <Box sx={{ display: 'flex', gap: 1.5, overflowX: 'auto', pb: 1,
              '&::-webkit-scrollbar': { height: 4 },
              '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,255,255,0.1)', borderRadius: 2 },
            }}>
              {recent.slice(0, 3).map((entry, i) => (
                <RecentCard key={entry.appId} entry={entry} index={i} onNavigate={handleNavigate} />
              ))}
            </Box>
          </Container>
        </Box>
      )}

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <Box sx={{
        bgcolor: 'rgba(255,255,255,0.03)',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        py: 3, px: { xs: 2, md: 3 },
      }}>
        <Container maxWidth="lg">
          <Box sx={{
            display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 2,
            justifyContent: { xs: 'center', md: 'space-between' },
          }}>
            <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: T.textFaint, cursor: 'pointer' }}
              onClick={() => navigate(Constants.DB_WORLD_HOME_ROUTE)}>
              DB World
            </Typography>
            <Typography sx={{ fontSize: '0.78rem', color: T.textFaint }}>v2.0</Typography>
            <Box /> {/* right placeholder */}
          </Box>
        </Container>
      </Box>
    </Box>
  );
};

export default Home;
```

- [ ] **Step 2: Verify Home renders correctly**

With dev server running, open `/db-world` and check:

1. **Hero** — dark gradient background, teal glow animates, greeting shows first name if logged in, "Continue" chip appears after first app click, CTA buttons work (Cinema opens `/db-world/db-cinema/browse`, Explore scrolls to `#apps`)
2. **Scroll chevron** — bounces at bottom of hero, fades when scrolled
3. **Header** — transparent over hero, turns glass on scroll down
4. **App grid** — 4 columns on desktop (lg+), 2 on tablet (sm/md), 1 on mobile (xs) — admin card only visible to ADMIN/OWNER
5. **Recent activity** — hidden on first load; after clicking any app card and navigating back, the row appears with the correct app and timestamp
6. **Footer** — single row, correct background
7. **Responsive** — shrink browser to mobile width: hamburger appears in header, grid goes to 1 col, CTA buttons stack

- [ ] **Step 3: Commit Home**

```bash
cd db-world-frontend
git add src/shared/components/layout/Home.js
git commit -m "feat(home): redesign Home — dark glass, hero, app grid, recent activity, footer"
```

---

## Task 3 — Final check

- [ ] **Step 1: Check both components together**

Navigate the full flow:
1. `/db-world` → hero loads, header transparent
2. Scroll down → header turns glass
3. Click "Explore Apps" → smooth scroll to grid
4. Click an app card → navigates to app, saves to recent
5. Navigate back → recent activity row visible
6. Mobile: hamburger drawer opens/closes correctly, all links work
7. Guest (logged out): header shows Login/Register buttons; hero greeting says "Welcome to DB World"

- [ ] **Step 2: Final commit**

```bash
cd db-world-frontend
git add docs/superpowers/specs/2026-03-28-dbworld-home-redesign-design.md \
        docs/superpowers/plans/2026-03-28-dbworld-home-redesign.md
git commit -m "docs: add home redesign spec and implementation plan"
```
