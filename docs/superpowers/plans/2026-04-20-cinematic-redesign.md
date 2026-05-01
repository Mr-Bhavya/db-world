# Cinematic Frontend Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the DB World home page, header, footer, and error page with a cinematic streaming-platform aesthetic — dark/light aware via `useT()`, framer-motion scroll-triggered animations, and a shared `BokehBackground` component.

**Architecture:** Three new shared UI primitives (`BokehBackground`, `SectionHeading`, `Stagger`) live in `src/shared/components/ui/` and are consumed by `Home.js`, `Header.js`, `Footer.js`, and `ErrorPage.js`. All color values come from `useT()` token calls inside component bodies (never module-level static T). No new npm packages.

**Tech Stack:** React (JS), framer-motion, MUI v7, `useT()` / `useThemeMode()` from `@shared/theme`, `useMediaQuery` from MUI, `useNavigate` / `useLocation` from react-router-dom.

---

## File Map

| Status | File | Change |
|--------|------|--------|
| Create | `src/shared/components/ui/BokehBackground.js` | Reusable bokeh + film grain + orb background |
| Create | `src/shared/components/ui/SectionHeading.js` | Teal-bar + all-caps label + hairline rule |
| Create | `src/shared/components/ui/Stagger.js` | StaggerContainer + StaggerItem exports |
| Modify | `src/shared/components/layout/Header.js` | Cinematic logo, glow nav, sun/moon icon, drawer accent line |
| Modify | `src/shared/components/layout/Footer.js` | Full rebuild from empty placeholder |
| Modify | `src/shared/components/layout/ErrorPage.js` | Replace hardcoded gradient + mouse tracking with BokehBackground + useT() |
| Modify | `src/shared/components/layout/Home.js` | Cinematic hero, pill favorites, banded app cards, timeline recent, glass about |

---

## Task 1: BokehBackground Component

**Files:**
- Create: `src/shared/components/ui/BokehBackground.js`

- [ ] **Step 1: Create the file**

```jsx
// src/shared/components/ui/BokehBackground.js
import React, { useId } from 'react';
import { Box } from '@mui/material';
import { motion } from 'framer-motion';
import { useMediaQuery, useTheme } from '@mui/material';
import { useT } from '@shared/theme';

const ORB_DARK_OPACITY = 0.25;
const ORB_LIGHT_OPACITY = 0.12;
const GRAIN_DARK_OPACITY = 0.03;
const GRAIN_LIGHT_OPACITY = 0.015;

// Six static bokeh dot configs — reduced to 3 on mobile via slice
const DOTS = [
  { size: 12, x: '15%', delay: 0,   duration: 8  },
  { size: 7,  x: '40%', delay: 1.2, duration: 10 },
  { size: 16, x: '65%', delay: 0.6, duration: 12 },
  { size: 5,  x: '80%', delay: 2,   duration: 9  },
  { size: 10, x: '25%', delay: 1.8, duration: 11 },
  { size: 8,  x: '55%', delay: 0.3, duration: 7  },
];

export default function BokehBackground({ children, vignette = false, height = '100vh' }) {
  const T = useT();
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('sm'));
  const filterId = useId().replace(/:/g, '');

  // Light mode reduces orb and grain opacity so it stays soft on white
  const isDark = T.bg === '#000000';
  const orbOpacity = isDark ? ORB_DARK_OPACITY : ORB_LIGHT_OPACITY;
  const grainOpacity = isDark ? GRAIN_DARK_OPACITY : GRAIN_LIGHT_OPACITY;

  const dots = isMobile ? DOTS.slice(0, 3) : DOTS;

  return (
    <Box
      sx={{
        position: 'relative',
        height,
        width: '100%',
        overflow: 'hidden',
        bgcolor: T.bg,
      }}
    >
      {/* SVG film grain filter definition */}
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <filter id={`grain-${filterId}`}>
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.65"
              numOctaves="3"
              stitchTiles="stitch"
            />
            <feColorMatrix type="saturate" values="0" />
          </filter>
        </defs>
      </svg>

      {/* Teal orb */}
      <motion.div
        animate={{ x: [0, 30, -20, 0], y: [0, -25, 15, 0] }}
        transition={{ duration: 30, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          position: 'absolute',
          top: '10%',
          left: '5%',
          width: '45%',
          height: '45%',
          borderRadius: '50%',
          background: 'radial-gradient(circle, #0d9488, transparent 70%)',
          opacity: orbOpacity,
          pointerEvents: 'none',
          filter: 'blur(40px)',
        }}
      />

      {/* Indigo orb */}
      <motion.div
        animate={{ x: [0, -25, 20, 0], y: [0, 20, -30, 0] }}
        transition={{ duration: 30, repeat: Infinity, ease: 'easeInOut', delay: 5 }}
        style={{
          position: 'absolute',
          bottom: '10%',
          right: '5%',
          width: '40%',
          height: '40%',
          borderRadius: '50%',
          background: 'radial-gradient(circle, #4f46e5, transparent 70%)',
          opacity: orbOpacity,
          pointerEvents: 'none',
          filter: 'blur(40px)',
        }}
      />

      {/* Film grain overlay */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          opacity: grainOpacity,
          pointerEvents: 'none',
          filter: `url(#grain-${filterId})`,
          zIndex: 1,
        }}
      />

      {/* Bokeh dots */}
      {dots.map((dot, i) => (
        <motion.div
          key={i}
          animate={{ y: [0, -120, 0], opacity: [dot.delay ? 0.15 : 0.3, 0.4, 0.15] }}
          transition={{
            duration: dot.duration,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: dot.delay,
          }}
          style={{
            position: 'absolute',
            bottom: '15%',
            left: dot.x,
            width: dot.size,
            height: dot.size,
            borderRadius: '50%',
            background: '#0d9488',
            opacity: 0.2,
            pointerEvents: 'none',
            zIndex: 2,
          }}
        />
      ))}

      {/* Bottom vignette */}
      {vignette && (
        <Box
          sx={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '30%',
            background: `linear-gradient(to bottom, transparent, ${T.bg})`,
            pointerEvents: 'none',
            zIndex: 3,
          }}
        />
      )}

      {/* Content */}
      <Box sx={{ position: 'relative', zIndex: 4, height: '100%' }}>
        {children}
      </Box>
    </Box>
  );
}
```

- [ ] **Step 2: Verify file created correctly**

Open `src/shared/components/ui/BokehBackground.js` and confirm it has no syntax errors by checking that the export default is present.

- [ ] **Step 3: Commit**

```bash
cd db-world-frontend
git add src/shared/components/ui/BokehBackground.js
git commit -m "feat: add BokehBackground shared UI primitive"
```

---

## Task 2: SectionHeading Component

**Files:**
- Create: `src/shared/components/ui/SectionHeading.js`

- [ ] **Step 1: Create the file**

```jsx
// src/shared/components/ui/SectionHeading.js
import React from 'react';
import { Box, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import { useT } from '@shared/theme';

export default function SectionHeading({ label }) {
  const T = useT();

  return (
    <motion.div
      initial={{ opacity: 0, x: -24 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
        {/* 3px teal accent bar */}
        <Box
          sx={{
            width: 3,
            height: 20,
            borderRadius: 4,
            bgcolor: T.teal,
            flexShrink: 0,
          }}
        />

        {/* Label */}
        <Typography
          sx={{
            fontSize: '0.7rem',
            fontWeight: 700,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: T.teal,
            flexShrink: 0,
          }}
        >
          {label}
        </Typography>

        {/* Hairline rule */}
        <Box
          sx={{
            flex: 1,
            height: '1px',
            bgcolor: T.border,
          }}
        />
      </Box>
    </motion.div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/shared/components/ui/SectionHeading.js
git commit -m "feat: add SectionHeading shared UI primitive"
```

---

## Task 3: Stagger Components

**Files:**
- Create: `src/shared/components/ui/Stagger.js`

- [ ] **Step 1: Create the file**

```jsx
// src/shared/components/ui/Stagger.js
import React from 'react';
import { motion } from 'framer-motion';

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.07,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 120,
      damping: 14,
    },
  },
};

export function StaggerContainer({ children, style, className }) {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
      style={style}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, style, className }) {
  return (
    <motion.div variants={itemVariants} style={style} className={className}>
      {children}
    </motion.div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/shared/components/ui/Stagger.js
git commit -m "feat: add StaggerContainer/StaggerItem shared UI primitives"
```

---

## Task 4: Header Redesign

**Files:**
- Modify: `src/shared/components/layout/Header.js`

This task upgrades the existing Header with:
- Gradient "DB World" text + PlayCircle icon with one-time glow pulse
- Nav hover: teal glow `box-shadow` bar instead of flat underline
- Active link: faint `T.tealBg` pill background
- Theme toggle: sun↔moon icon rotates 180° + scales on swap
- Mobile drawer: 2px teal vertical line animates `scaleY` 0→1 on open

- [ ] **Step 1: Replace Header.js**

```jsx
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
  PlayCircle as PlayCircleIcon,
} from '@mui/icons-material';
import { useAuth } from '@features/auth/context/Authentication';
import { useThemeMode } from '@shared/theme';
import Constants from '@shared/constants';

const NAV = [
  { id: 'cinema',   label: 'Cinema',           icon: <CinemaIcon />,   route: Constants.DB_CINEMA_BROWSE_ROUTE },
  { id: 'weather',  label: 'Weather',           icon: <WeatherIcon />,  route: Constants.DB_WEATHER_ROUTE },
  { id: 'games',    label: 'Games',             icon: <GamesIcon />,    route: Constants.DB_GAMES_ROUTE },
  { id: 'password', label: 'Password Manager',  icon: <PasswordIcon />, route: Constants.DB_PASSWORD_MANAGER_ROUTE },
];

// Cinematic desktop nav link with teal glow bar on hover
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
        position: 'relative',
        transition: 'color 0.2s, background 0.2s',
        '&:hover': {
          color: T.teal,
          background: T.tealBg,
          // Glow bar via box-shadow on ::after is CSS-only; we use boxShadow on the element
          boxShadow: `0 2px 0 0 ${T.teal}, 0 4px 8px ${T.tealGlow}`,
        },
        boxShadow: active ? `0 2px 0 0 ${T.teal}` : 'none',
      }}
    >
      {item.label}
    </Box>
  );
};

// Animated theme toggle icon (rotate + scale on swap)
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

            {/* ── Cinematic logo ──── */}
            <Box
              onClick={() => handleNav(Constants.DB_WORLD_HOME_ROUTE)}
              sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer', mr: 4 }}
            >
              {/* One-time glow pulse on mount */}
              <motion.div
                initial={{ opacity: 0.6 }}
                animate={{ opacity: [0.6, 1, 0.6] }}
                transition={{ duration: 0.8, times: [0, 0.5, 1], repeat: 0 }}
                style={{ display: 'flex', alignItems: 'center' }}
              >
                <PlayCircleIcon sx={{ color: T.teal, fontSize: 28 }} />
              </motion.div>
              <Typography
                sx={{
                  fontWeight: 800,
                  fontSize: '1rem',
                  letterSpacing: '-0.02em',
                  background: 'linear-gradient(90deg, #0d9488, #14b8a6)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                DB World
              </Typography>
            </Box>

            {/* ── Desktop nav ──── */}
            {!isMobile && isAuth && (
              <Box sx={{ display: 'flex', gap: 0.5, flexGrow: 1 }}>
                {NAV.map(item => (
                  <NavLink key={item.id} item={item} location={location} handleNav={handleNav} T={T} />
                ))}
              </Box>
            )}
            {!isMobile && !isAuth && <Box sx={{ flexGrow: 1 }} />}

            {/* ── Desktop theme toggle ──── */}
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

            {/* ── Desktop avatar (auth) ──── */}
            {!isMobile && isAuth && (
              <Tooltip title={user?.firstName ?? user?.name ?? 'Account'}>
                <IconButton onClick={(e) => setMenuAnchor(e.currentTarget)} sx={{ p: 0.5 }}>
                  <Avatar sx={{ width: 34, height: 34, bgcolor: T.teal, fontSize: '0.85rem', fontWeight: 700 }}>
                    {initial}
                  </Avatar>
                </IconButton>
              </Tooltip>
            )}

            {/* ── Desktop guest buttons ──── */}
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

            {/* ── Mobile hamburger ──── */}
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

      {/* ── Avatar dropdown ──── */}
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

      {/* ── Mobile drawer ──── */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{
          sx: {
            width: 280, bgcolor: drawerBg,
            backdropFilter: 'blur(20px)',
            borderLeft: `1px solid ${T.glassBorder}`,
            position: 'relative',
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
            <PlayCircleIcon sx={{ color: T.teal, fontSize: 24 }} />
            <Typography
              sx={{
                fontWeight: 800,
                fontSize: '0.95rem',
                background: 'linear-gradient(90deg, #0d9488, #14b8a6)',
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

        {/* Nav links — 48px height rows with teal active accent */}
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
```

- [ ] **Step 2: Start dev server and verify visually**

```bash
cd db-world-frontend
npm run dev:local
```

Open the app in browser. Check:
- Logo shows PlayCircle icon (teal) + gradient "DB World" text
- On mount, icon briefly pulses (opacity 0.6→1→0.6)
- Desktop nav links show teal glow bar + pill background on active
- Theme toggle shows animated sun↔moon swap when clicked
- Mobile: open drawer — teal vertical line slides down from top

- [ ] **Step 3: Commit**

```bash
git add src/shared/components/layout/Header.js
git commit -m "feat: cinematic header — gradient logo, glow nav, animated theme toggle, drawer accent line"
```

---

## Task 5: Footer Rebuild

**Files:**
- Modify: `src/shared/components/layout/Footer.js`

- [ ] **Step 1: Replace Footer.js**

```jsx
// src/shared/components/layout/Footer.js
import React from 'react';
import { Box, Container, Typography, IconButton, Tooltip } from '@mui/material';
import { motion } from 'framer-motion';
import { DarkMode as DarkModeIcon, LightMode as LightModeIcon } from '@mui/icons-material';
import { AnimatePresence } from 'framer-motion';
import { useThemeMode } from '@shared/theme';

const APP_VERSION = '1.0.0';

// Reuse the same animated icon from Header to avoid duplicating logic
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
        ? <LightModeIcon sx={{ fontSize: 18 }} />
        : <DarkModeIcon  sx={{ fontSize: 18 }} />
      }
    </motion.div>
  </AnimatePresence>
);

export default function Footer() {
  const { mode, toggleMode, T } = useThemeMode();

  return (
    <Box
      component="footer"
      sx={{
        bgcolor: T.bg,
        position: 'relative',
        pt: 0,
      }}
    >
      {/* Top gradient accent line — scaleX 0→1 on scroll entry */}
      <motion.div
        initial={{ scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        style={{
          height: 1,
          background: `linear-gradient(to right, ${T.teal}, transparent)`,
          transformOrigin: 'left',
        }}
      />

      <Container maxWidth="xl">
        {/* Desktop: single row. Mobile: two centered lines */}
        <Box
          sx={{
            display: { xs: 'flex', sm: 'flex' },
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: 'center',
            justifyContent: { xs: 'center', sm: 'space-between' },
            textAlign: { xs: 'center', sm: 'left' },
            gap: { xs: 1, sm: 0 },
            py: { xs: 2.5, sm: 1.75 },
          }}
        >
          {/* Left: copyright */}
          <Typography sx={{ fontSize: '0.75rem', color: T.textFaint }}>
            © 2026 DB World
          </Typography>

          {/* Center: version pill */}
          <Box
            sx={{
              border: `1px solid ${T.glassBorder}`,
              borderRadius: 10,
              px: 1.5,
              py: 0.25,
              display: 'inline-flex',
            }}
          >
            <Typography sx={{ fontSize: '0.68rem', color: T.textFaint, letterSpacing: '0.04em' }}>
              v{APP_VERSION}
            </Typography>
          </Box>

          {/* Right: theme toggle */}
          <Tooltip title={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
            <IconButton
              size="small"
              onClick={toggleMode}
              sx={{ color: T.textFaint, '&:hover': { color: T.teal, bgcolor: T.tealBg } }}
            >
              <ThemeToggleIcon mode={mode} />
            </IconButton>
          </Tooltip>
        </Box>
      </Container>
    </Box>
  );
}
```

- [ ] **Step 2: Verify visually**

In the browser (dev server already running):
- Scroll to bottom of home page — gradient teal line animates in from left
- Desktop: copyright left, version pill center, theme toggle right
- Mobile: stacked two-line layout, all centered
- Theme toggle works and animates

- [ ] **Step 3: Commit**

```bash
git add src/shared/components/layout/Footer.js
git commit -m "feat: cinematic footer — gradient top line, version pill, animated theme toggle"
```

---

## Task 6: ErrorPage Rebuild

**Files:**
- Modify: `src/shared/components/layout/ErrorPage.js`

Replace the hardcoded purple gradient + mouse tracking with `BokehBackground` + `useT()` tokens throughout.

- [ ] **Step 1: Replace ErrorPage.js**

```jsx
// src/shared/components/layout/ErrorPage.js
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Box, Typography } from '@mui/material';
import { useT } from '@shared/theme';
import Constants from '@shared/constants';
import BokehBackground from '@shared/components/ui/BokehBackground';

const itemVariants = {
  hidden:   { y: 20, opacity: 0 },
  visible:  { y: 0,  opacity: 1, transition: { type: 'spring', stiffness: 100, damping: 12 } },
};

const containerVariants = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.1, delayChildren: 0.2 } },
};

export default function ErrorPage() {
  const T = useT();
  const navigate = useNavigate();

  return (
    <BokehBackground height="100vh" vignette>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20,
        }}
      >
        {/* Glass content card */}
        <motion.div
          variants={itemVariants}
          style={{ maxWidth: 480, width: '90%' }}
        >
          <Box
            sx={{
              bgcolor: T.glass,
              backdropFilter: 'blur(16px)',
              border: `1px solid ${T.glassBorder}`,
              borderRadius: '24px',
              p: { xs: '32px 24px', md: '48px 40px' },
              textAlign: 'center',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* "404" — each digit staggered spring scale-in */}
            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, mb: 3 }}>
              {[4, 0, 4].map((num, i) => (
                <motion.div
                  key={i}
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1,   opacity: 1 }}
                  transition={{ delay: i * 0.1, type: 'spring', stiffness: 200, damping: 15 }}
                >
                  <Typography
                    sx={{
                      fontSize: { xs: '5rem', md: '6rem' },
                      fontWeight: 800,
                      lineHeight: 1,
                      background: 'linear-gradient(135deg, #0d9488, #4f46e5)',
                      backgroundClip: 'text',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                    }}
                  >
                    {num}
                  </Typography>
                </motion.div>
              ))}
            </Box>

            {/* Headline */}
            <motion.div variants={itemVariants}>
              <Typography
                sx={{ fontSize: '1.4rem', fontWeight: 700, color: T.textPrimary, mb: 1 }}
              >
                Lost in the void
              </Typography>
            </motion.div>

            {/* Subline */}
            <motion.div variants={itemVariants}>
              <Typography sx={{ color: T.textMuted, mb: 3 }}>
                This page doesn't exist in any dimension.
              </Typography>
            </motion.div>

            {/* Buttons */}
            <motion.div
              variants={itemVariants}
              style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}
            >
              {/* Go Home — teal filled */}
              <Box
                component="button"
                onClick={() => navigate(Constants.DB_WORLD_HOME_ROUTE)}
                sx={{
                  bgcolor: T.teal,
                  color: '#fff',
                  border: 'none',
                  borderRadius: '50px',
                  px: 3,
                  py: 1.25,
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'box-shadow 0.2s, background 0.2s',
                  '&:hover': {
                    bgcolor: T.tealHover,
                    boxShadow: `0 0 16px ${T.tealGlow}`,
                  },
                }}
              >
                Go Home
              </Box>

              {/* Login — glass outline */}
              <Box
                component="button"
                onClick={() => navigate(Constants.LOGIN_ROUTE)}
                sx={{
                  bgcolor: 'transparent',
                  color: T.teal,
                  border: `1px solid ${T.glassBorder}`,
                  borderRadius: '50px',
                  px: 3,
                  py: 1.25,
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'background 0.2s, border-color 0.2s',
                  '&:hover': {
                    bgcolor: T.tealBg,
                    borderColor: T.teal,
                  },
                }}
              >
                Login
              </Box>
            </motion.div>
          </Box>
        </motion.div>
      </motion.div>
    </BokehBackground>
  );
}
```

- [ ] **Step 2: Verify visually**

Navigate to a non-existent route (e.g., `/does-not-exist`). Check:
- Full-page bokeh background with drifting teal + indigo orbs
- Background is theme-aware (dark = black base, light = white base)
- "404" digits scale in with stagger, teal→indigo gradient text
- "Lost in the void" headline and subline use T.textPrimary / T.textMuted
- Buttons: teal filled "Go Home" and glass outline "Login"
- No hardcoded colors remain

- [ ] **Step 3: Commit**

```bash
git add src/shared/components/layout/ErrorPage.js
git commit -m "feat: cinematic error page — BokehBackground, glass card, themed 404 digits"
```

---

## Task 7: Home — Hero Section

**Files:**
- Modify: `src/shared/components/layout/Home.js`

Replace the hero's inline radial-gradient + centered layout with `BokehBackground` + left-aligned cinematic layout (centered on mobile). Keep all existing state, utility functions, and sub-components — only the JSX and Hero section changes in this task.

- [ ] **Step 1: Add import for new primitives and update Hero in Home.js**

At the top of `Home.js`, add three imports after the existing ones:

```jsx
import BokehBackground from '@shared/components/ui/BokehBackground';
import SectionHeading from '@shared/components/ui/SectionHeading';
import { StaggerContainer, StaggerItem } from '@shared/components/ui/Stagger';
```

Also add `PlayCircle as PlayCircleIcon` to the MUI icons import block and `Bookmark as BookmarkFilledIcon, BookmarkBorder as BookmarkIcon` for the favorites section.

Full updated imports block:

```jsx
import React, { useState, useEffect, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Box, Typography, Button, Chip, Grid, Container,
    useMediaQuery, useTheme, Paper, alpha,
} from '@mui/material';
import {
    MovieFilter as CinemaIcon,
    WbSunny as WeatherIcon,
    SportsEsports as GamesIcon,
    Lock as PasswordIcon,
    AdminPanelSettings as AdminIcon,
    ArrowForward as ArrowIcon,
    KeyboardArrowDown as ChevronDown,
    Bookmark as BookmarkFilledIcon,
    BookmarkBorder as BookmarkIcon,
    Info as AboutIcon,
    Close as CloseIcon,
} from '@mui/icons-material';
import { useAuth } from '@features/auth/context/Authentication';
import Constants from '@shared/constants';
import { useT } from '@shared/theme';
import BokehBackground from '@shared/components/ui/BokehBackground';
import SectionHeading from '@shared/components/ui/SectionHeading';
import { StaggerContainer, StaggerItem } from '@shared/components/ui/Stagger';
```

- [ ] **Step 2: Update the APPS array to use flat accent colors**

Replace the `APPS` array so each app has an `accent` color (used for the colored band in the redesigned AppCard) alongside the existing `gradient` (kept for backward compat with RecentCard):

```jsx
const APPS = [
    {
        id: 'cinema',
        label: 'DB Cinema',
        description: 'Stream movies & TV shows in your personal library.',
        icon: CinemaIcon,
        route: Constants.DB_CINEMA_BROWSE_ROUTE,
        adminOnly: false,
        accent: '#ef4444',
        gradient: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
    },
    {
        id: 'weather',
        label: 'DB Weather',
        description: 'Real-time forecasts and interactive weather maps.',
        icon: WeatherIcon,
        route: Constants.DB_WEATHER_ROUTE,
        adminOnly: false,
        accent: '#38bdf8',
        gradient: 'linear-gradient(135deg, #38bdf8 0%, #0284c7 100%)',
    },
    {
        id: 'games',
        label: 'DB Games',
        description: 'Browser games with cloud save and leaderboards.',
        icon: GamesIcon,
        route: Constants.DB_GAMES_ROUTE,
        adminOnly: false,
        accent: '#a855f7',
        gradient: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)',
    },
    {
        id: 'password',
        label: 'Password Manager',
        description: 'Encrypted vault for all your credentials.',
        icon: PasswordIcon,
        route: Constants.DB_PASSWORD_MANAGER_ROUTE,
        adminOnly: false,
        accent: '#0d9488',
        gradient: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
    },
    {
        id: 'admin',
        label: 'Admin Console',
        description: 'System management, analytics and content control.',
        icon: AdminIcon,
        route: `${Constants.DB_ADMIN_BASE_ROUTE}/dashboard`,
        adminOnly: true,
        accent: '#f59e0b',
        gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    },
];
```

- [ ] **Step 3: Replace the Hero JSX inside the Home component**

Find the `{/* ── Hero Section */}` block (lines 479–642 of original Home.js) and replace it entirely with:

```jsx
{/* ── Hero Section ──────────────────────────────────────────────────────────── */}
<BokehBackground height={{ xs: '85vh', md: '100vh' }} vignette>
    <Box
        sx={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: { xs: 'center', md: 'flex-start' },
            justifyContent: 'center',
            pt: { xs: '56px', md: '64px' },
            px: { xs: 3, md: 8, lg: 12 },
            maxWidth: { md: 720 },
        }}
    >
        {/* Eyebrow */}
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0, duration: 0.6 }}
        >
            <Typography
                sx={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    letterSpacing: '0.2em',
                    textTransform: 'uppercase',
                    color: T.textMuted,
                    mb: 1.5,
                    textAlign: { xs: 'center', md: 'left' },
                }}
            >
                Your Personal Universe
            </Typography>
        </motion.div>

        {/* Headline */}
        <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, type: 'spring', stiffness: 100, damping: 14 }}
        >
            <Typography
                sx={{
                    fontWeight: 800,
                    fontSize: { xs: '2.2rem', sm: '2.8rem', md: '3.6rem' },
                    letterSpacing: '-0.03em',
                    lineHeight: 1.15,
                    color: T.textPrimary,
                    mb: 2,
                    textAlign: { xs: 'center', md: 'left' },
                }}
            >
                {firstName ? `Welcome back, ${firstName}` : 'Welcome back'}
            </Typography>
        </motion.div>

        {/* Subline */}
        <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, type: 'spring', stiffness: 100, damping: 14 }}
        >
            <Typography
                sx={{
                    fontSize: { xs: '1rem', md: '1.1rem' },
                    color: T.textMuted,
                    mb: 3.5,
                    textAlign: { xs: 'center', md: 'left' },
                    maxWidth: 500,
                }}
            >
                Your personal media universe — stream, play, and manage everything in one place.
            </Typography>
        </motion.div>

        {/* CTA buttons */}
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, type: 'spring', stiffness: 100, damping: 14 }}
        >
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: { xs: 'center', md: 'flex-start' } }}>
                {/* Primary: teal filled, glow on hover */}
                <Box
                    component="button"
                    onClick={() => navigate(Constants.DB_CINEMA_BROWSE_ROUTE)}
                    sx={{
                        bgcolor: T.teal,
                        color: '#fff',
                        border: 'none',
                        borderRadius: 2,
                        px: 3.5,
                        py: 1.25,
                        fontSize: '0.95rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        transition: 'box-shadow 0.2s, background 0.2s',
                        '&:hover': {
                            bgcolor: T.tealHover,
                            boxShadow: `0 0 16px ${T.tealGlow}`,
                        },
                    }}
                >
                    Browse Cinema
                </Box>

                {/* Secondary: glass outline */}
                <Box
                    component="button"
                    onClick={() => navigate(Constants.DB_PASSWORD_MANAGER_ROUTE)}
                    sx={{
                        bgcolor: 'transparent',
                        color: T.teal,
                        border: `1px solid ${T.glassBorder}`,
                        borderRadius: 2,
                        px: 3.5,
                        py: 1.25,
                        fontSize: '0.95rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        transition: 'background 0.2s, border-color 0.2s',
                        '&:hover': {
                            bgcolor: T.tealBg,
                            borderColor: T.teal,
                        },
                    }}
                >
                    Open Vault
                </Box>
            </Box>
        </motion.div>

        {/* Scroll indicator line */}
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5 }}
            style={{ position: 'absolute', bottom: 40, left: '50%', transform: 'translateX(-50%)' }}
        >
            <AnimatePresence>
                {!scrolled && (
                    <motion.div
                        animate={{ y: [0, 8, 0] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                    >
                        <ChevronDown sx={{ fontSize: 28, color: T.textFaint }} />
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    </Box>
</BokehBackground>
```

- [ ] **Step 4: Verify visually**

In browser:
- Hero uses bokeh background (drifting orbs, film grain, vignette at bottom)
- Desktop: content left-aligned in left 40% of screen
- Mobile: content centered
- "Browse Cinema" button has teal fill + glow on hover
- "Open Vault" button has glass outline, fills on hover
- Scroll indicator appears after 1.5s, disappears on scroll

- [ ] **Step 5: Commit**

```bash
git add src/shared/components/layout/Home.js
git commit -m "feat: cinematic hero section — BokehBackground, left-aligned layout, CTA buttons"
```

---

## Task 8: Home — Favorites Section Redesign

**Files:**
- Modify: `src/shared/components/layout/Home.js`

Replace the full `AppCard` grid in the Favorites section with pill-shaped compact cards using app accent colors and a `BookmarkBorder`/`Bookmark` toggle icon.

- [ ] **Step 1: Replace the AppCard memo component with a new version**

Find the existing `AppCard` memo (lines 121–253 of original) and replace with:

```jsx
const AppCard = memo(({ app, index, onNavigate, isFavorite, onToggleFavorite }) => {
    const T = useT();
    const Icon = app.icon;
    const [isHovered, setIsHovered] = useState(false);

    const handleFavoriteClick = useCallback((e) => {
        e.stopPropagation();
        onToggleFavorite(app.id);
    }, [app.id, onToggleFavorite]);

    return (
        <StaggerItem>
            <Paper
                elevation={0}
                onClick={() => onNavigate(app)}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                sx={{
                    height: '100%',
                    overflow: 'hidden',
                    borderRadius: 2,
                    cursor: 'pointer',
                    bgcolor: T.glass,
                    border: `1px solid ${T.glassBorder}`,
                    backdropFilter: 'blur(10px)',
                    transition: 'transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease',
                    '&:hover': {
                        transform: 'translateY(-4px)',
                        borderColor: `${app.accent}66`,
                        boxShadow: `0 8px 24px ${app.accent}22`,
                    },
                }}
            >
                {/* Colored band with centered icon + soft glow */}
                <Box
                    sx={{
                        height: 80,
                        bgcolor: app.accent,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'relative',
                        transition: 'filter 0.25s ease',
                        filter: isHovered ? 'brightness(1.15)' : 'brightness(1)',
                    }}
                >
                    <Box
                        sx={{
                            position: 'absolute',
                            inset: 0,
                            background: `radial-gradient(circle at center, ${app.accent}88 0%, transparent 70%)`,
                            opacity: isHovered ? 1 : 0.5,
                            transition: 'opacity 0.25s ease',
                        }}
                    />
                    <Icon sx={{ fontSize: 32, color: '#fff', position: 'relative', zIndex: 1 }} />

                    {/* Bookmark favorite toggle */}
                    <Box
                        onClick={handleFavoriteClick}
                        sx={{
                            position: 'absolute',
                            top: 8,
                            right: 8,
                            width: 28,
                            height: 28,
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            bgcolor: 'rgba(0,0,0,0.25)',
                            cursor: 'pointer',
                            opacity: isHovered || isFavorite ? 1 : 0,
                            transition: 'opacity 0.2s',
                            zIndex: 2,
                        }}
                    >
                        {isFavorite
                            ? <BookmarkFilledIcon sx={{ fontSize: 16, color: '#fff' }} />
                            : <BookmarkIcon sx={{ fontSize: 16, color: 'rgba(255,255,255,0.8)' }} />
                        }
                    </Box>
                </Box>

                {/* Name + description */}
                <Box sx={{ p: 2 }}>
                    <Typography sx={{ fontSize: '0.9rem', fontWeight: 700, color: T.textPrimary, mb: 0.5 }}>
                        {app.label}
                    </Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: T.textMuted, lineHeight: 1.5 }}>
                        {app.description}
                    </Typography>
                </Box>
            </Paper>
        </StaggerItem>
    );
});
```

- [ ] **Step 2: Replace the Favorites section JSX**

Find the `{/* ── Favorites Section */}` block and replace with:

```jsx
{/* ── Favorites Section ──────────────────────────────────────────────────────── */}
{favoriteApps.length > 0 && (
    <Box sx={{ py: 6, px: { xs: 2, md: 3 } }}>
        <Container maxWidth="lg">
            <SectionHeading label="Favorites" />

            {/* Pill row: wrap on desktop, horizontal scroll on mobile */}
            <Box
                sx={{
                    display: 'flex',
                    flexWrap: { xs: 'nowrap', sm: 'wrap' },
                    overflowX: { xs: 'auto', sm: 'visible' },
                    WebkitOverflowScrolling: 'touch',
                    gap: 1.5,
                    pb: { xs: 1, sm: 0 },
                }}
            >
                <StaggerContainer style={{ display: 'contents' }}>
                    {favoriteApps.map((app) => {
                        const Icon = app.icon;
                        return (
                            <StaggerItem key={app.id}>
                                <Box
                                    onClick={() => handleNavigate(app)}
                                    sx={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 1,
                                        px: 2,
                                        py: 1,
                                        borderRadius: '50px',
                                        border: `1px solid ${app.accent}44`,
                                        bgcolor: `${app.accent}11`,
                                        cursor: 'pointer',
                                        flexShrink: 0,
                                        transition: 'box-shadow 0.2s, background 0.2s',
                                        '&:hover': {
                                            bgcolor: `${app.accent}22`,
                                            boxShadow: `0 0 12px ${app.accent}44`,
                                        },
                                    }}
                                >
                                    <Icon sx={{ fontSize: 18, color: app.accent }} />
                                    <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: T.textPrimary, whiteSpace: 'nowrap' }}>
                                        {app.label}
                                    </Typography>
                                    {/* Bookmark filled icon indicates favorited */}
                                    <BookmarkFilledIcon sx={{ fontSize: 14, color: app.accent }} />
                                </Box>
                            </StaggerItem>
                        );
                    })}
                </StaggerContainer>
            </Box>
        </Container>
    </Box>
)}
```

- [ ] **Step 3: Verify visually**

- Add a favorite via the apps grid — Favorites section appears with pill chips
- Desktop: pills wrap
- Mobile: pills scroll horizontally without wrapping
- Each pill uses its app accent color for border, bg, and icon

- [ ] **Step 4: Commit**

```bash
git add src/shared/components/layout/Home.js
git commit -m "feat: cinematic favorites — pill chips with accent colors, bookmark toggle on app cards"
```

---

## Task 9: Home — All Apps Grid Redesign

**Files:**
- Modify: `src/shared/components/layout/Home.js`

Replace the Apps Grid heading and wrap `AppCard` items in `StaggerContainer`. The new `AppCard` from Task 8 already has the colored-band design.

- [ ] **Step 1: Replace the All Apps Grid section JSX**

Find the `{/* ── All Apps Grid */}` block and replace with:

```jsx
{/* ── All Apps Grid ──────────────────────────────────────────────────────────── */}
<Box id="apps" sx={{ py: { xs: 6, md: 10 }, px: { xs: 2, md: 3 } }}>
    <Container maxWidth="lg">
        <SectionHeading label="All Apps" />

        <StaggerContainer>
            <Grid container spacing={2}>
                {visibleApps.map((app, i) => (
                    <Grid key={app.id} item xs={12} sm={6} md={4} lg={3}>
                        <AppCard
                            app={app}
                            index={i}
                            onNavigate={handleNavigate}
                            isFavorite={favorites.includes(app.id)}
                            onToggleFavorite={handleToggleFavorite}
                        />
                    </Grid>
                ))}
            </Grid>
        </StaggerContainer>
    </Container>
</Box>
```

- [ ] **Step 2: Verify visually**

- Scroll past hero to All Apps section
- "ALL APPS" section heading appears with teal bar + hairline rule, slides in from left
- Cards animate in with stagger on scroll-entry
- Each card: colored band (80px) with centered icon + inner glow, name + description below
- Hover: card lifts (`translateY -4px`), band brightens

- [ ] **Step 3: Commit**

```bash
git add src/shared/components/layout/Home.js
git commit -m "feat: cinematic apps grid — SectionHeading, StaggerContainer, banded AppCard"
```

---

## Task 10: Home — Recent Activity Redesign

**Files:**
- Modify: `src/shared/components/layout/Home.js`

Replace `RecentCard` and the Recent Activity section with: desktop timeline (vertical teal line + circular dot per entry), mobile horizontal chip row.

- [ ] **Step 1: Replace the RecentCard memo component**

Find the existing `RecentCard` memo and replace with:

```jsx
const RecentCard = memo(({ entry, onNavigate, isMobile }) => {
    const T = useT();
    const app = APPS.find(a => a.id === entry.appId);
    if (!app) return null;
    const Icon = app.icon;

    if (isMobile) {
        // Chip: icon + app name + time
        return (
            <Box
                onClick={() => onNavigate(app)}
                sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 1,
                    px: 2,
                    py: 0.75,
                    borderRadius: '50px',
                    border: `1px solid ${T.glassBorder}`,
                    bgcolor: T.glass,
                    cursor: 'pointer',
                    flexShrink: 0,
                    transition: 'border-color 0.2s, background 0.2s',
                    '&:hover': { borderColor: T.teal, bgcolor: T.tealBg },
                }}
            >
                <Icon sx={{ fontSize: 16, color: app.accent }} />
                <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: T.textPrimary, whiteSpace: 'nowrap' }}>
                    {app.label}
                </Typography>
                <Typography sx={{ fontSize: '0.7rem', color: T.textFaint }}>
                    {timeAgo(entry.ts)}
                </Typography>
            </Box>
        );
    }

    // Desktop timeline entry
    return (
        <motion.div
            initial={{ opacity: 0, x: -16 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ type: 'spring', stiffness: 120, damping: 14 }}
        >
            <Box
                onClick={() => onNavigate(app)}
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    cursor: 'pointer',
                    py: 1.25,
                    borderRadius: 2,
                    px: 1,
                    transition: 'background 0.2s',
                    '&:hover': { bgcolor: T.tealBg },
                }}
            >
                {/* Timeline dot with app icon */}
                <Box
                    sx={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        bgcolor: app.accent,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        boxShadow: `0 0 12px ${app.accent}44`,
                    }}
                >
                    <Icon sx={{ fontSize: 20, color: '#fff' }} />
                </Box>

                {/* Text */}
                <Box sx={{ flex: 1 }}>
                    <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: T.textPrimary }}>
                        {app.label}
                    </Typography>
                    <Typography sx={{ fontSize: '0.72rem', color: T.textFaint }}>
                        {timeAgo(entry.ts)}
                    </Typography>
                </Box>

                <ArrowIcon sx={{ fontSize: 16, color: T.teal, opacity: 0.5 }} />
            </Box>
        </motion.div>
    );
});
```

- [ ] **Step 2: Replace the Recent Activity section JSX**

Find the `{/* ── Recent Activity */}` block and replace with:

```jsx
{/* ── Recent Activity ────────────────────────────────────────────────────────── */}
{recent.length > 0 && (
    <Box sx={{ pb: { xs: 6, md: 8 }, px: { xs: 2, md: 3 } }}>
        <Container maxWidth="lg">
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <SectionHeading label="Recent Activity" />
                <Button
                    size="small"
                    sx={{ color: T.teal, fontSize: '0.75rem', textTransform: 'none', mb: 3 }}
                    onClick={() => { localStorage.removeItem(RECENT_KEY); setRecent([]); }}
                >
                    Clear
                </Button>
            </Box>

            {/* Mobile: horizontal chip row */}
            {isMobile ? (
                <Box
                    sx={{
                        display: 'flex',
                        gap: 1.5,
                        overflowX: 'auto',
                        WebkitOverflowScrolling: 'touch',
                        pb: 1,
                    }}
                >
                    {recent.slice(0, 5).map((entry) => (
                        <RecentCard key={entry.appId} entry={entry} onNavigate={handleNavigate} isMobile />
                    ))}
                </Box>
            ) : (
                /* Desktop: timeline with vertical teal line */
                <Box sx={{ position: 'relative', pl: 3 }}>
                    {/* Vertical teal timeline line */}
                    <Box
                        sx={{
                            position: 'absolute',
                            left: 20,
                            top: 0,
                            bottom: 0,
                            width: 2,
                            bgcolor: T.teal,
                            opacity: 0.25,
                            borderRadius: 1,
                        }}
                    />
                    {recent.slice(0, 5).map((entry) => (
                        <RecentCard key={entry.appId} entry={entry} onNavigate={handleNavigate} isMobile={false} />
                    ))}
                </Box>
            )}
        </Container>
    </Box>
)}
```

- [ ] **Step 3: Verify visually**

- Desktop: recent items appear as timeline entries with teal vertical line + circular app icon dots + stagger slide-in
- Mobile: recent items appear as horizontal scrollable chips
- Clicking any entry navigates to the app

- [ ] **Step 4: Commit**

```bash
git add src/shared/components/layout/Home.js
git commit -m "feat: cinematic recent activity — desktop timeline, mobile chip row"
```

---

## Task 11: Home — About Modal + Footer Wire-up

**Files:**
- Modify: `src/shared/components/layout/Home.js`

Update the About modal to use the glass card with spring entrance. Update the Home footer area to use the standalone `Footer` component. Ensure the About trigger button is still accessible.

- [ ] **Step 1: Replace AboutSection memo component**

Find the `AboutSection` memo and replace with:

```jsx
const AboutSection = memo(({ onClose }) => {
    const T = useT();

    return (
        <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 200, damping: 22 }}
        >
            <Box
                sx={{
                    bgcolor: T.glass,
                    backdropFilter: 'blur(16px)',
                    border: `1px solid ${T.glassBorder}`,
                    borderRadius: '24px',
                    p: { xs: 3, md: 4 },
                    maxWidth: 560,
                    position: 'relative',
                }}
            >
                {/* Close button */}
                <Box
                    component="button"
                    onClick={onClose}
                    sx={{
                        position: 'absolute',
                        top: 16,
                        right: 16,
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: T.textFaint,
                        display: 'flex',
                        alignItems: 'center',
                        '&:hover': { color: T.teal },
                    }}
                >
                    <CloseIcon fontSize="small" />
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                    <Box
                        sx={{
                            width: 48, height: 48, borderRadius: 2,
                            background: 'linear-gradient(135deg, #0d9488, #14b8a6)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                    >
                        <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: '1.4rem' }}>D</Typography>
                    </Box>
                    <Box>
                        <Typography variant="h5" sx={{ fontWeight: 700, color: T.textPrimary }}>
                            DB World
                        </Typography>
                        <Typography sx={{ color: T.textMuted, fontSize: '0.85rem' }}>Version 1.0.0</Typography>
                    </Box>
                </Box>

                <Typography sx={{ color: T.textPrimary, mb: 2, lineHeight: 1.7 }}>
                    Your personal media universe — everything in one place. DB World brings together
                    entertainment, productivity, and management tools in a seamless, unified experience.
                </Typography>

                <Typography variant="h6" sx={{ fontWeight: 600, color: T.textPrimary, mb: 1, mt: 3, fontSize: '0.95rem' }}>
                    Features
                </Typography>
                <Box component="ul" sx={{ color: T.textMuted, pl: 2, mb: 0 }}>
                    {[
                        'Stream movies and TV shows with DB Cinema',
                        'Check real-time weather with DB Weather',
                        'Play browser games with DB Games',
                        'Secure password management',
                        'Admin console for system management',
                    ].map((f) => <li key={f} style={{ marginBottom: 4 }}>{f}</li>)}
                </Box>
            </Box>
        </motion.div>
    );
});
```

- [ ] **Step 2: Import and add Footer component, update the bottom of Home JSX**

Add the Footer import at the top:

```jsx
import Footer from '@shared/components/layout/Footer';
```

Find the existing `{/* ── Footer ───── */}` block inside the `Home` component JSX (the inline footer at the bottom) and replace with:

```jsx
{/* ── About trigger + Footer ───────────────────────────────────────────────── */}
<Box
    sx={{
        display: 'flex',
        justifyContent: 'center',
        pb: 2,
        px: 3,
    }}
>
    <Button
        startIcon={<AboutIcon />}
        onClick={() => setShowAbout(true)}
        sx={{
            color: T.textMuted,
            textTransform: 'none',
            fontSize: '0.85rem',
            '&:hover': { color: T.teal },
        }}
    >
        About DB World
    </Button>
</Box>
<Footer />
```

- [ ] **Step 3: Update the About modal backdrop**

Find the `{/* ── About Section Modal */}` AnimatePresence block and update the backdrop to match the spec (dark `rgba(0,0,0,0.7)` blur):

```jsx
{/* ── About Section Modal ──────────────────────────────────────────────────── */}
<AnimatePresence>
    {showAbout && (
        <Box
            sx={{
                position: 'fixed',
                inset: 0,
                zIndex: 9999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                p: 2,
                bgcolor: 'rgba(0,0,0,0.7)',
                backdropFilter: 'blur(8px)',
            }}
            onClick={() => setShowAbout(false)}
        >
            <Box onClick={(e) => e.stopPropagation()}>
                <AboutSection onClose={() => setShowAbout(false)} />
            </Box>
        </Box>
    )}
</AnimatePresence>
```

- [ ] **Step 4: Final visual verification — full page golden path**

With dev server running:
1. Land on home page — hero bokeh background, left-aligned content on desktop
2. Scroll — "All Apps" heading slides in from left with teal bar
3. Hover an app card — it lifts, band brightens, border glows with accent color
4. Click the bookmark on a card — card appears in Favorites section as a pill
5. Scroll to recent activity — timeline on desktop, chips on mobile
6. Click "About DB World" — glass modal slides up with spring, backdrop blurs
7. Press ESC or click outside — modal closes
8. Scroll to bottom — footer shows gradient line, copyright, version pill, theme toggle
9. Navigate to a bad URL — error page shows bokeh background + glass 404 card
10. Toggle theme — header logo, nav, error page, footer all switch correctly

- [ ] **Step 5: Commit**

```bash
git add src/shared/components/layout/Home.js
git commit -m "feat: cinematic about modal (glass + spring), wire Footer component into Home"
```

---

## Spec Coverage Checklist

| Spec requirement | Task |
|-----------------|------|
| BokehBackground: orbs + grain + dots + vignette | Task 1 |
| SectionHeading: teal bar + label + hairline | Task 2 |
| StaggerContainer / StaggerItem | Task 3 |
| Header: gradient logo + PlayCircle icon + glow pulse | Task 4 |
| Header: nav hover glow bar + active pill | Task 4 |
| Header: sun↔moon animated toggle | Task 4 |
| Header: drawer teal vertical accent line | Task 4 |
| Footer: gradient top line (scaleX) | Task 5 |
| Footer: copyright + version pill + theme toggle | Task 5 |
| ErrorPage: BokehBackground | Task 6 |
| ErrorPage: glass card, 404 digits teal→indigo gradient | Task 6 |
| ErrorPage: themed buttons (teal filled + glass outline) | Task 6 |
| Hero: 100vh/85vh, BokehBackground + vignette | Task 7 |
| Hero: left-aligned desktop, centered mobile | Task 7 |
| Hero: staggered entrance (eyebrow, headline, subline, CTA) | Task 7 |
| Hero: scroll indicator line fade in at 1.5s | Task 7 |
| Favorites: pill chips with accent colors + bookmark toggle | Task 8 |
| Favorites: mobile horizontal scroll | Task 8 |
| AppCard: 80px colored band + icon glow + hover lift | Tasks 8–9 |
| All Apps: SectionHeading + StaggerContainer | Task 9 |
| Recent: desktop timeline (teal line + circular dots) | Task 10 |
| Recent: mobile horizontal chip row | Task 10 |
| About: glass card + spring slide-up + backdrop blur | Task 11 |
| Footer component wired into Home | Task 11 |
| All colors from useT() tokens (no hardcoded theme colors) | All tasks |
| Light mode compatibility | All tasks |
| Mobile / tablet / desktop responsive | All tasks |
