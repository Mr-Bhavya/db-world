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
    Star as StarIcon,
    Info as AboutIcon,
} from '@mui/icons-material';
import { useAuth } from '@features/auth/context/Authentication';
import Constants from '@shared/constants';
import { useT } from '@shared/theme';

// ── App catalogue ──────────────────────────────────────────────────────────────
const APPS = [
    {
        id: 'cinema',
        label: 'DB Cinema',
        description: 'Stream movies & TV shows in your personal library.',
        icon: CinemaIcon,
        route: Constants.DB_CINEMA_BROWSE_ROUTE,
        adminOnly: false,
        gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    },
    {
        id: 'weather',
        label: 'DB Weather',
        description: 'Real-time forecasts and interactive weather maps.',
        icon: WeatherIcon,
        route: Constants.DB_WEATHER_ROUTE,
        adminOnly: false,
        gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    },
    {
        id: 'games',
        label: 'DB Games',
        description: 'Browser games with cloud save and leaderboards.',
        icon: GamesIcon,
        route: Constants.DB_GAMES_ROUTE,
        adminOnly: false,
        gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    },
    {
        id: 'password',
        label: 'Password Manager',
        description: 'Encrypted vault for all your credentials.',
        icon: PasswordIcon,
        route: Constants.DB_PASSWORD_MANAGER_ROUTE,
        adminOnly: false,
        gradient: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    },
    {
        id: 'admin',
        label: 'Admin Console',
        description: 'System management, analytics and content control.',
        icon: AdminIcon,
        route: `${Constants.DB_ADMIN_BASE_ROUTE}/dashboard`,
        adminOnly: true,
        gradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    },
];

const RECENT_KEY = 'dbworld_recent';
const FAVORITES_KEY = 'dbworld_favorites';

// ── Utility functions ─────────────────────────────────────────────────────────
const getRecent = () => {
    try {
        return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    } catch {
        return [];
    }
};

const saveRecent = (appId, route) => {
    const prev = getRecent().filter(e => e.appId !== appId);
    const next = [{ appId, route, ts: Date.now() }, ...prev].slice(0, 5);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
};

const getFavorites = () => {
    try {
        return JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]');
    } catch {
        return [];
    }
};

const toggleFavorite = (appId) => {
    const favorites = getFavorites();
    const index = favorites.indexOf(appId);
    if (index > -1) {
        favorites.splice(index, 1);
    } else {
        favorites.push(appId);
    }
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
    return favorites;
};

const timeAgo = (ts) => {
    const diff = Date.now() - ts;
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
};

// ── Optimized App Card ───────────────────────────────────────────────────────
const AppCard = memo(({ app, index, onNavigate, isFavorite, onToggleFavorite }) => {
    const T = useT();
    const Icon = app.icon;
    const [isHovered, setIsHovered] = useState(false);

    const handleFavoriteClick = useCallback((e) => {
        e.stopPropagation();
        onToggleFavorite(app.id);
    }, [app.id, onToggleFavorite]);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
            style={{ height: '100%' }}
        >
            <Paper
                elevation={isHovered ? 3 : 1}
                onClick={() => onNavigate(app)}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                sx={{
                    height: '100%',
                    minHeight: 200,
                    p: 2.5,
                    bgcolor: T.glass,
                    backdropFilter: 'blur(10px)',
                    border: `1px solid ${alpha(T.glassBorder, isHovered ? 0.5 : 0.2)}`,
                    borderRadius: 3,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    position: 'relative',
                    overflow: 'hidden',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                        transform: 'translateY(-4px)',
                        borderColor: alpha(T.teal, 0.4),
                    },
                    '&::before': {
                        content: '""',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: '3px',
                        background: app.gradient,
                        transform: isHovered ? 'scaleX(1)' : 'scaleX(0)',
                        transition: 'transform 0.3s ease',
                    },
                }}
            >
                {/* Favorite button */}
                <Box
                    onClick={handleFavoriteClick}
                    sx={{
                        position: 'absolute',
                        top: 12,
                        right: 12,
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: alpha(T.bg, 0.5),
                        backdropFilter: 'blur(5px)',
                        opacity: isHovered || isFavorite ? 1 : 0,
                        transition: 'all 0.2s',
                        cursor: 'pointer',
                        zIndex: 2,
                        '&:hover': {
                            bgcolor: alpha('#fbbf24', 0.2),
                        },
                    }}
                >
                    <StarIcon sx={{
                        fontSize: 18,
                        color: isFavorite ? '#fbbf24' : T.textFaint,
                        transition: 'color 0.2s',
                    }} />
                </Box>

                {/* Icon */}
                <Box
                    sx={{
                        width: 48,
                        height: 48,
                        borderRadius: 2,
                        background: app.gradient,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mb: 2,
                    }}
                >
                    <Icon sx={{ fontSize: 24, color: '#fff' }} />
                </Box>

                {/* Content */}
                <Typography sx={{
                    fontSize: '1rem',
                    fontWeight: 700,
                    color: T.textPrimary,
                    mb: 0.5,
                }}>
                    {app.label}
                </Typography>
                <Typography sx={{
                    fontSize: '0.8rem',
                    color: T.textMuted,
                    lineHeight: 1.5,
                    mb: 2,
                    flex: 1,
                }}>
                    {app.description}
                </Typography>

                {/* Arrow */}
                <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <ArrowIcon sx={{
                        fontSize: 16,
                        color: T.teal,
                        opacity: isHovered ? 1 : 0.5,
                        transition: 'all 0.2s',
                        transform: isHovered ? 'translateX(4px)' : 'none',
                    }} />
                </Box>
            </Paper>
        </motion.div>
    );
});

// ── Optimized Recent Card ────────────────────────────────────────────────────
const RecentCard = memo(({ entry, onNavigate }) => {
    const T = useT();
    const app = APPS.find(a => a.id === entry.appId);

    if (!app) return null;
    const Icon = app.icon;

    return (
        <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2 }}
            whileHover={{ y: -2 }}
        >
            <Paper
                elevation={1}
                onClick={() => onNavigate(app)}
                sx={{
                    p: 1.5,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    bgcolor: alpha(T.glass, 0.3),
                    backdropFilter: 'blur(10px)',
                    border: `1px solid ${alpha(T.glassBorder, 0.2)}`,
                    borderRadius: 2,
                    cursor: 'pointer',
                    width: '100%',
                    minWidth: { xs: '100%', sm: 200 },
                    transition: 'all 0.2s',
                    '&:hover': {
                        bgcolor: alpha(T.glassHover, 0.3),
                        borderColor: alpha(T.teal, 0.3),
                    },
                }}
            >
                <Box
                    sx={{
                        width: 36,
                        height: 36,
                        borderRadius: 1.5,
                        background: app.gradient,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                    }}
                >
                    <Icon sx={{ fontSize: 18, color: '#fff' }} />
                </Box>

                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        color: T.textPrimary,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                    }}>
                        {app.label}
                    </Typography>
                    <Typography sx={{ fontSize: '0.7rem', color: T.textFaint }}>
                        {timeAgo(entry.ts)}
                    </Typography>
                </Box>

                <ArrowIcon sx={{ fontSize: 14, color: T.teal, opacity: 0.5, flexShrink: 0 }} />
            </Paper>
        </motion.div>
    );
});

// ── About Section ────────────────────────────────────────────────────────────
const AboutSection = memo(({ onClose }) => {
    const T = useT();

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
        >
            <Paper
                sx={{
                    p: 4,
                    bgcolor: T.glass,
                    backdropFilter: 'blur(20px)',
                    border: `1px solid ${T.glassBorder}`,
                    borderRadius: 3,
                    maxWidth: 600,
                    mx: 'auto',
                    position: 'relative',
                }}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                    <Box
                        sx={{
                            width: 48,
                            height: 48,
                            borderRadius: 2,
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: '1.5rem' }}>
                            D
                        </Typography>
                    </Box>
                    <Box>
                        <Typography variant="h5" sx={{ fontWeight: 700, color: T.textPrimary }}>
                            DB World
                        </Typography>
                        <Typography sx={{ color: T.textMuted, fontSize: '0.9rem' }}>
                            Version 2.0.0
                        </Typography>
                    </Box>
                </Box>

                <Typography sx={{ color: T.textPrimary, mb: 2 }}>
                    Your personal media universe — everything in one place. DB World brings together
                    entertainment, productivity, and management tools in a seamless, unified experience.
                </Typography>

                <Typography variant="h6" sx={{ fontWeight: 600, color: T.textPrimary, mb: 1, mt: 3 }}>
                    Features
                </Typography>
                <Box component="ul" sx={{ color: T.textMuted, pl: 2, mb: 2 }}>
                    <li>Stream movies and TV shows with DB Cinema</li>
                    <li>Check real-time weather with DB Weather</li>
                    <li>Play browser games with DB Games</li>
                    <li>Secure password management</li>
                    <li>Admin console for system management</li>
                </Box>

                <Typography sx={{ color: T.textFaint, fontSize: '0.8rem', mt: 3 }}>
                    © 2024 DB World. All rights reserved.
                </Typography>

                <Button
                    onClick={onClose}
                    sx={{
                        position: 'absolute',
                        top: 16,
                        right: 16,
                        minWidth: 'auto',
                        p: 1,
                        color: T.textFaint,
                    }}
                >
                    ✕
                </Button>
            </Paper>
        </motion.div>
    );
});

// ── Main Component ──────────────────────────────────────────────────────────
const Home = () => {
    const T = useT();
    const navigate = useNavigate();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const isTablet = useMediaQuery(theme.breakpoints.down('md'));
    const { auth } = useAuth();
    const user = auth?.user;
    const role = auth?.role;
    const isAdmin = role === Constants.OWNER_USER_ROLE || role === Constants.ADMIN_USER_ROLE;

    const [recent, setRecent] = useState([]);
    const [favorites, setFavorites] = useState([]);
    const [scrolled, setScrolled] = useState(false);
    const [showAbout, setShowAbout] = useState(false);

    useEffect(() => {
        setRecent(getRecent());
        setFavorites(getFavorites());
    }, []);

    useEffect(() => {
        const handleScroll = () => {
            const isScrolled = window.scrollY > 40;
            if (isScrolled !== scrolled) {
                setScrolled(isScrolled);
            }
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, [scrolled]);

    const handleNavigate = useCallback((app) => {
        saveRecent(app.id, app.route);
        setRecent(getRecent());
        navigate(app.route);
    }, [navigate]);

    const handleToggleFavorite = useCallback((appId) => {
        const updated = toggleFavorite(appId);
        setFavorites(updated);
    }, []);

    const scrollToApps = useCallback(() => {
        document.getElementById('apps')?.scrollIntoView({ behavior: 'smooth' });
    }, []);

    const firstName = user?.firstName ?? user?.name?.split(' ')[0] ?? null;
    const lastRecent = recent[0] ? APPS.find(a => a.id === recent[0].appId) : null;
    const visibleApps = APPS.filter(a => !a.adminOnly || isAdmin);
    const favoriteApps = visibleApps.filter(app => favorites.includes(app.id));

    // Determine grid columns based on screen size
    const getGridSize = () => {
        if (isMobile) return 12;
        if (isTablet) return 6;
        return 3;
    };

    return (
        <Box sx={{ bgcolor: T.bg, minHeight: '100vh', color: T.textPrimary }}>

            {/* ── Hero Section ────────────────────────────────────────────────────── */}
            <Box
                sx={{
                    minHeight: '100vh',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    pt: { xs: '56px', md: '64px' },
                    px: 3,
                    position: 'relative',
                    overflow: 'hidden',
                    textAlign: 'center',
                }}
            >
                {/* Background gradient */}
                <Box
                    sx={{
                        position: 'absolute',
                        inset: 0,
                        background: `radial-gradient(circle at 50% 50%, ${alpha(T.teal, 0.08)} 0%, transparent 70%)`,
                        pointerEvents: 'none',
                    }}
                />

                <Box sx={{ position: 'relative', zIndex: 1, maxWidth: 700, width: '100%' }}>

                    {/* Greeting */}
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        <Typography
                            sx={{
                                fontWeight: 800,
                                fontSize: { xs: '2rem', sm: '2.5rem', md: '3.5rem' },
                                letterSpacing: '-0.03em',
                                lineHeight: 1.2,
                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                backgroundClip: 'text',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
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
                        <Typography sx={{
                            mt: 2,
                            fontSize: { xs: '1rem', md: '1.15rem' },
                            color: T.textMuted,
                        }}>
                            Your personal media universe — everything in one place.
                        </Typography>
                    </motion.div>

                    {/* Continue chip */}
                    {lastRecent && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.3 }}
                            style={{ marginTop: 24 }}
                        >
                            <Chip
                                icon={<lastRecent.icon sx={{ fontSize: '16px !important', color: `${T.teal} !important` }} />}
                                label={`Continue: ${lastRecent.label}`}
                                onClick={() => handleNavigate(lastRecent)}
                                sx={{
                                    bgcolor: alpha(T.teal, 0.1),
                                    color: T.teal,
                                    border: `1px solid ${alpha(T.teal, 0.3)}`,
                                    fontWeight: 600,
                                    fontSize: '0.85rem',
                                    cursor: 'pointer',
                                    '&:hover': { bgcolor: alpha(T.teal, 0.18) },
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
                            mt: 4,
                            display: 'flex',
                            gap: 2,
                            justifyContent: 'center',
                            flexWrap: 'wrap'
                        }}>
                            <Button
                                variant="contained"
                                size="large"
                                onClick={() => navigate(Constants.DB_CINEMA_BROWSE_ROUTE)}
                                sx={{
                                    bgcolor: T.teal,
                                    color: '#fff',
                                    fontWeight: 700,
                                    px: 3.5,
                                    py: 1.25,
                                    borderRadius: 2,
                                    textTransform: 'none',
                                    fontSize: '0.95rem',
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
                                    borderColor: alpha(T.teal, 0.4),
                                    color: T.teal,
                                    fontWeight: 600,
                                    px: 3.5,
                                    py: 1.25,
                                    borderRadius: 2,
                                    textTransform: 'none',
                                    fontSize: '0.95rem',
                                    '&:hover': {
                                        borderColor: T.teal,
                                        bgcolor: alpha(T.teal, 0.06)
                                    },
                                }}
                            >
                                Explore Apps
                            </Button>
                        </Box>
                    </motion.div>
                </Box>

                {/* Scroll indicator */}
                <AnimatePresence>
                    {!scrolled && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            style={{ position: 'absolute', bottom: 32 }}
                        >
                            <motion.div
                                animate={{ y: [0, 8, 0] }}
                                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                            >
                                <ChevronDown sx={{ fontSize: 28, color: T.textFaint }} />
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </Box>

            {/* ── Favorites Section ────────────────────────────────────────────────── */}
            {favoriteApps.length > 0 && (
                <Box sx={{ py: 6, px: { xs: 2, md: 3 } }}>
                    <Container maxWidth="lg">
                        <Box sx={{ mb: 4 }}>
                            <Typography
                                sx={{
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    color: '#fbbf24',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.15em',
                                    mb: 1,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 1,
                                }}
                            >
                                <StarIcon sx={{ fontSize: 14 }} />
                                Favorites
                            </Typography>
                            <Typography variant="h5" sx={{ fontWeight: 700, color: T.textPrimary }}>
                                Your starred apps
                            </Typography>
                        </Box>

                        <Grid container spacing={2}>
                            {favoriteApps.map((app, i) => (
                                <Grid key={app.id} item xs={12} sm={6} md={4} lg={3}>
                                    <AppCard
                                        app={app}
                                        index={i}
                                        onNavigate={handleNavigate}
                                        isFavorite={true}
                                        onToggleFavorite={handleToggleFavorite}
                                    />
                                </Grid>
                            ))}
                        </Grid>
                    </Container>
                </Box>
            )}

            {/* ── All Apps Grid ────────────────────────────────────────────────────── */}
            <Box id="apps" sx={{ py: { xs: 6, md: 10 }, px: { xs: 2, md: 3 } }}>
                <Container maxWidth="lg">
                    <Box sx={{ mb: 5, textAlign: 'center' }}>
                        <Typography sx={{
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            color: T.teal,
                            textTransform: 'uppercase',
                            letterSpacing: '0.12em',
                            mb: 1,
                        }}>
                            Your Apps
                        </Typography>
                        <Typography variant="h5" sx={{ fontWeight: 700, color: T.textPrimary }}>
                            Everything in one place
                        </Typography>
                    </Box>

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
                </Container>
            </Box>

            {/* ── Recent Activity ──────────────────────────────────────────────────── */}
            {recent.length > 0 && (
                <Box sx={{ pb: { xs: 6, md: 8 }, px: { xs: 2, md: 3 } }}>
                    <Container maxWidth="lg">
                        <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: T.textMuted }}>
                                Recent Activity
                            </Typography>
                            <Button
                                size="small"
                                sx={{ color: T.teal, fontSize: '0.75rem' }}
                                onClick={() => {
                                    localStorage.removeItem(RECENT_KEY);
                                    setRecent([]);
                                }}
                            >
                                Clear
                            </Button>
                        </Box>

                        <Grid container spacing={1.5}>
                            {recent.slice(0, isMobile ? 2 : 4).map((entry) => (
                                <Grid key={entry.appId} item xs={12} sm={6} md={3}>
                                    <RecentCard entry={entry} onNavigate={handleNavigate} />
                                </Grid>
                            ))}
                        </Grid>
                    </Container>
                </Box>
            )}

            {/* ── About Section Modal ──────────────────────────────────────────────── */}
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
                            bgcolor: alpha(T.bg, 0.8),
                            backdropFilter: 'blur(10px)',
                        }}
                        onClick={() => setShowAbout(false)}
                    >
                        <Box onClick={(e) => e.stopPropagation()}>
                            <AboutSection onClose={() => setShowAbout(false)} />
                        </Box>
                    </Box>
                )}
            </AnimatePresence>

            {/* ── Footer ───────────────────────────────────────────────────────────── */}
            <Box sx={{
                bgcolor: alpha(T.glass, 0.2),
                backdropFilter: 'blur(10px)',
                borderTop: `1px solid ${alpha(T.border, 0.3)}`,
                py: 3,
                px: { xs: 2, md: 3 },
            }}>
                <Container maxWidth="lg">
                    <Box sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: 2,
                    }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                            <Typography
                                sx={{
                                    fontSize: '0.9rem',
                                    fontWeight: 700,
                                    color: T.textPrimary,
                                    cursor: 'pointer',
                                }}
                                onClick={() => navigate(Constants.DB_WORLD_HOME_ROUTE)}
                            >
                                DB World
                            </Typography>

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
                                About
                            </Button>
                        </Box>

                        <Typography sx={{ fontSize: '0.8rem', color: T.textFaint }}>
                            v2.0.0
                        </Typography>
                    </Box>
                </Container>
            </Box>
        </Box>
    );
};

export default Home;