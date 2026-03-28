import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
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

// ── Design tokens ──────────────────────────────────────────────────────────────
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

// ── App catalogue ──────────────────────────────────────────────────────────────
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

// ── App card ───────────────────────────────────────────────────────────────────
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
          flexShrink: 0,
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
          px: 2, py: 1.5,
          display: 'flex', alignItems: 'center', gap: 1.5,
          bgcolor: T.glass,
          border: `1px solid ${T.glassBorder}`,
          borderRadius: 2,
          cursor: 'pointer',
          minWidth: 160,
          flexShrink: 0,
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

// ── Main ───────────────────────────────────────────────────────────────────────
const Home = () => {
  const navigate = useNavigate();
  const theme    = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { auth } = useAuth();
  const user     = auth?.user;
  const role     = auth?.role;
  const isAdmin  = role === Constants.OWNER_USER_ROLE || role === Constants.ADMIN_USER_ROLE;

  const [recent,   setRecent]   = useState([]);
  const [scrolled, setScrolled] = useState(false);

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

  const firstName  = user?.firstName ?? user?.name?.split(' ')[0] ?? null;
  const lastRecent = recent[0] ? APPS.find(a => a.id === recent[0].appId) : null;
  const visibleApps = APPS.filter(a => !a.adminOnly || isAdmin);

  return (
    <Box sx={{ bgcolor: T.bg, minHeight: '100vh', color: T.textPrimary }}>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <Box
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
        {/* Animated teal glow */}
        <motion.div
          animate={{ opacity: [0.08, 0.18, 0.08] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: 'radial-gradient(ellipse 60% 50% at 60% 40%, rgba(13,148,136,0.18) 0%, transparent 70%)',
          }}
        />

        {/* Hero content */}
        <Box sx={{ position: 'relative', zIndex: 1, maxWidth: 700, width: '100%' }}>

          {/* Greeting */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Typography
              sx={{
                fontWeight: 800,
                color: T.textPrimary,
                letterSpacing: '-0.03em',
                lineHeight: 1.15,
                fontSize: { xs: '2rem', sm: '2.5rem', md: '3.25rem' },
              }}
            >
              {firstName ? `Welcome back, ${firstName}` : 'Welcome to DB World'}
            </Typography>
          </motion.div>

          {/* Subtitle */}
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
                  bgcolor: 'rgba(13,148,136,0.1)',
                  color: T.teal,
                  border: '1px solid rgba(13,148,136,0.3)',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
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
            <Box sx={{ mt: 4, display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                size="large"
                onClick={() => navigate(Constants.DB_CINEMA_BROWSE_ROUTE)}
                sx={{
                  bgcolor: T.teal, color: '#fff', fontWeight: 700,
                  px: 3.5, py: 1.25, borderRadius: 2,
                  textTransform: 'none', fontSize: '0.95rem',
                  boxShadow: '0 4px 20px rgba(13,148,136,0.35)',
                  '&:hover': { bgcolor: T.tealHover, boxShadow: '0 6px 24px rgba(13,148,136,0.45)' },
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
          animate={{ y: [0, 8, 0], opacity: scrolled ? 0 : 0.6 }}
          transition={{
            y: { duration: 1.5, repeat: Infinity, ease: 'easeInOut' },
            opacity: { duration: 0.3 },
          }}
          style={{ position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)' }}
        >
          <ChevronDown sx={{ fontSize: 28, color: T.textFaint }} />
        </motion.div>
      </Box>

      {/* ── App grid ────────────────────────────────────────────────────────── */}
      <Box id="apps" sx={{ py: { xs: 6, md: 10 }, px: { xs: 2, md: 3 } }}>
        <Container maxWidth="lg">
          <Box sx={{ mb: 5, textAlign: 'center' }}>
            <Typography sx={{
              fontSize: '0.72rem', fontWeight: 700, color: T.teal,
              textTransform: 'uppercase', letterSpacing: '0.12em', mb: 1,
            }}>
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

      {/* ── Recent activity ──────────────────────────────────────────────────── */}
      {recent.length > 0 && (
        <Box sx={{ pb: { xs: 6, md: 8 }, px: { xs: 2, md: 3 } }}>
          <Container maxWidth="lg">
            <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, color: T.textMuted, mb: 2 }}>
              Continue where you left off
            </Typography>
            <Box
              sx={{
                display: 'flex', gap: 1.5, overflowX: 'auto', pb: 1,
                '&::-webkit-scrollbar': { height: 4 },
                '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,255,255,0.1)', borderRadius: 2 },
              }}
            >
              {recent.slice(0, 3).map((entry, i) => (
                <RecentCard key={entry.appId} entry={entry} index={i} onNavigate={handleNavigate} />
              ))}
            </Box>
          </Container>
        </Box>
      )}

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
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
            <Typography
              sx={{ fontSize: '0.85rem', fontWeight: 700, color: T.textFaint, cursor: 'pointer' }}
              onClick={() => navigate(Constants.DB_WORLD_HOME_ROUTE)}
            >
              DB World
            </Typography>
            <Typography sx={{ fontSize: '0.78rem', color: T.textFaint }}>v2.0</Typography>
            <Box />
          </Box>
        </Container>
      </Box>
    </Box>
  );
};

export default Home;
