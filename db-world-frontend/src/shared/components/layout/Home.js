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
    Bookmark as BookmarkFilledIcon,
    BookmarkBorder as BookmarkIcon,
    Info as AboutIcon,
} from '@mui/icons-material';
import { useAuth } from '@features/auth/context/Authentication';
import Constants from '@shared/constants';
import { useT } from '@shared/theme';
import BokehBackground from '@shared/components/ui/BokehBackground';
import SectionHeading from '@shared/components/ui/SectionHeading';
import { StaggerContainer, StaggerItem } from '@shared/components/ui/Stagger';

// ── App catalogue ──────────────────────────────────────────────────────────────
const APPS = [
    {
        id: 'cinema',
        label: 'DB Cinema',
        description: 'Browse movies, series, and streams',
        Icon: CinemaIcon,
        route: Constants.DB_CINEMA_BROWSE_ROUTE,
        adminOnly: false,
        accent: '#ef4444',
        gradient: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
    },
    {
        id: 'weather',
        label: 'DB Weather',
        description: 'Live weather for any location',
        Icon: WeatherIcon,
        route: Constants.DB_WEATHER_ROUTE,
        adminOnly: false,
        accent: '#38bdf8',
        gradient: 'linear-gradient(135deg, #38bdf8 0%, #0284c7 100%)',
    },
    {
        id: 'games',
        label: 'DB Games',
        description: 'Mini-games and leaderboards',
        Icon: GamesIcon,
        route: Constants.DB_GAMES_ROUTE,
        adminOnly: false,
        accent: '#a855f7',
        gradient: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)',
    },
    {
        id: 'password',
        label: 'Password Manager',
        description: 'Secure credential vault',
        Icon: PasswordIcon,
        route: Constants.DB_PASSWORD_MANAGER_ROUTE,
        adminOnly: false,
        accent: '#0d9488',
        gradient: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
    },
    {
        id: 'admin',
        label: 'Admin Console',
        description: 'Content and system administration',
        Icon: AdminIcon,
        route: `${Constants.DB_ADMIN_BASE_ROUTE}/dashboard`,
        adminOnly: true,
        accent: '#f59e0b',
        gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
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
const AppCard = React.memo(function AppCard({ app, isFavorite, onNavigate, onToggleFavorite }) {
    const T = useT();
    const [hovered, setHovered] = useState(false);

    return (
        <Box
            onClick={() => onNavigate(app.route)}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            sx={{
                border: `1px solid ${T.glassBorder}`,
                borderRadius: '16px',
                overflow: 'hidden',
                cursor: 'pointer',
                bgcolor: T.bg,
                transition: 'transform 0.25s ease, box-shadow 0.25s ease',
                transform: hovered ? 'translateY(-4px)' : 'translateY(0)',
                boxShadow: hovered
                    ? `0 8px 32px ${app.accent}44`
                    : `0 2px 8px rgba(0,0,0,0.12)`,
                position: 'relative',
            }}
        >
            {/* Colored band */}
            <Box
                sx={{
                    height: 80,
                    bgcolor: app.accent,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    filter: hovered ? 'brightness(1.15)' : 'brightness(1)',
                    transition: 'filter 0.25s ease',
                    boxShadow: hovered ? `inset 0 0 24px ${app.accent}88` : 'none',
                    position: 'relative',
                }}
            >
                <app.Icon sx={{ fontSize: 36, color: '#fff', filter: hovered ? `drop-shadow(0 0 8px ${app.accent})` : 'none', transition: 'filter 0.25s ease' }} />
            </Box>

            {/* Card body */}
            <Box sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography
                        sx={{ fontWeight: 700, fontSize: '0.95rem', color: T.textPrimary }}
                    >
                        {app.label}
                    </Typography>
                    <Box
                        component="button"
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onToggleFavorite(app.id); }}
                        sx={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: isFavorite ? app.accent : T.textMuted,
                            display: 'flex',
                            alignItems: 'center',
                            p: 0.5,
                            borderRadius: 1,
                            transition: 'color 0.2s ease',
                            '&:hover': { color: app.accent },
                        }}
                        aria-label={isFavorite ? `Remove ${app.label} from favorites` : `Add ${app.label} to favorites`}
                    >
                        {isFavorite ? (
                            <BookmarkFilledIcon sx={{ fontSize: 20 }} />
                        ) : (
                            <BookmarkIcon sx={{ fontSize: 20 }} />
                        )}
                    </Box>
                </Box>
                <Typography sx={{ fontSize: '0.78rem', color: T.textMuted }}>
                    {app.description}
                </Typography>
            </Box>
        </Box>
    );
});

// ── Optimized Recent Card ────────────────────────────────────────────────────
const RecentCard = memo(({ entry, onNavigate }) => {
    const T = useT();
    const app = APPS.find(a => a.id === entry.appId);

    if (!app) return null;
    const Icon = app.Icon;

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
            setScrolled(window.scrollY > 40);
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const handleNavigate = useCallback((appOrRoute) => {
        if (typeof appOrRoute === 'string') {
            // Called with just a route string (new AppCard / Favorites pill)
            const app = APPS.find(a => a.route === appOrRoute);
            if (app) {
                saveRecent(app.id, app.route);
                setRecent(getRecent());
            }
            navigate(appOrRoute);
        } else {
            // Called with a full app object (RecentCard)
            saveRecent(appOrRoute.id, appOrRoute.route);
            setRecent(getRecent());
            navigate(appOrRoute.route);
        }
    }, [navigate]);

    const handleToggleFavorite = useCallback((appId) => {
        const updated = toggleFavorite(appId);
        setFavorites(updated);
    }, []);

    const firstName = user?.firstName ?? user?.name?.split(' ')[0] ?? null;
    const lastRecent = recent[0] ? APPS.find(a => a.id === recent[0].appId) : null;
    const visibleApps = APPS.filter(a => !a.adminOnly || isAdmin);

    // Determine grid columns based on screen size
    const getGridSize = () => {
        if (isMobile) return 12;
        if (isTablet) return 6;
        return 3;
    };

    return (
        <Box sx={{ bgcolor: T.bg, minHeight: '100vh', color: T.textPrimary }}>

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
                        maxWidth: { md: 600 },
                        position: 'relative',
                    }}
                >
                    {/* Eyebrow */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0, type: 'spring', stiffness: 100, damping: 14 }}
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
                            YOUR PERSONAL UNIVERSE
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
                            <Box
                                component="button"
                                type="button"
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

                            <Box
                                component="button"
                                type="button"
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

                    {/* Scroll indicator */}
                    <motion.div
                        aria-hidden="true"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 1.5 }}
                        style={{ position: 'absolute', bottom: 40, left: '50%', transform: 'translateX(-50%)' }}
                    >
                        <AnimatePresence>
                            {!scrolled && (
                                <motion.div
                                    initial={{ opacity: 1 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.4 }}
                                >
                                    {/* Thin animated line — extends downward with a repeating scale animation */}
                                    <motion.div
                                        style={{
                                            width: 2,
                                            height: 40,
                                            background: T.teal,
                                            borderRadius: 4,
                                            margin: '0 auto',
                                        }}
                                        animate={{ scaleY: [1, 0.5, 1], opacity: [0.6, 1, 0.6] }}
                                        transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                                    />
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                </Box>
            </BokehBackground>

            {/* Favorites Section */}
            <Box component="section" sx={{ mb: 6 }}>
                <SectionHeading label="Favorites" />
                <StaggerContainer
                    style={{
                        display: 'flex',
                        flexWrap: isMobile ? 'nowrap' : 'wrap',
                        gap: 12,
                        overflowX: isMobile ? 'auto' : 'visible',
                        paddingBottom: isMobile ? 8 : 0,
                        WebkitOverflowScrolling: isMobile ? 'touch' : 'unset',
                    }}
                >
                    {favorites.length === 0 ? (
                        <Typography sx={{ color: T.textMuted, fontSize: '0.85rem', py: 2 }}>
                            No favorites yet — bookmark an app below.
                        </Typography>
                    ) : (
                        favorites.map((appId) => {
                            const app = APPS.find((a) => a.id === appId);
                            if (!app) return null;
                            return (
                                <StaggerItem key={app.id} style={{ flexShrink: 0 }}>
                                    <Box
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => handleNavigate(app.route)}
                                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleNavigate(app.route); } }}
                                        aria-label={`Open ${app.label}`}
                                        sx={{
                                            cursor: 'pointer',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: 1,
                                            px: 2,
                                            py: 1,
                                            borderRadius: 999,
                                            border: `2px solid ${app.accent}`,
                                            bgcolor: `${app.accent}22`,
                                            transition: 'box-shadow 0.2s ease, background-color 0.2s ease',
                                            '&:hover': {
                                                boxShadow: `0 0 12px ${app.accent}88`,
                                                bgcolor: `${app.accent}44`,
                                            },
                                        }}
                                    >
                                        <app.Icon sx={{ fontSize: 18, color: app.accent }} />
                                        <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: app.accent }}>
                                            {app.label}
                                        </Typography>
                                        <Box
                                            component="button"
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleToggleFavorite(app.id);
                                            }}
                                            sx={{
                                                background: 'none',
                                                border: 'none',
                                                cursor: 'pointer',
                                                color: app.accent,
                                                display: 'flex',
                                                alignItems: 'center',
                                                p: 0,
                                                ml: 0.5,
                                            }}
                                            aria-label={`Remove ${app.label} from favorites`}
                                        >
                                            <BookmarkFilledIcon sx={{ fontSize: 16 }} />
                                        </Box>
                                    </Box>
                                </StaggerItem>
                            );
                        })
                    )}
                </StaggerContainer>
            </Box>

            {/* ── All Apps Grid ────────────────────────────────────────────────────── */}
            <Box sx={{ py: { xs: 6, md: 10 }, px: { xs: 2, md: 3 } }}>
                <Container maxWidth="lg">
                    <Box component="section" id="apps" sx={{ mb: 6 }}>
                        <SectionHeading label="All Apps" />
                        <StaggerContainer>
                            <Grid container spacing={2}>
                                {visibleApps.map((app) => (
                                    <Grid key={app.id} item xs={12} sm={6} md={4} lg={3}>
                                        <StaggerItem style={{ height: '100%' }}>
                                            <AppCard
                                                app={app}
                                                isFavorite={favorites.includes(app.id)}
                                                onNavigate={handleNavigate}
                                                onToggleFavorite={handleToggleFavorite}
                                            />
                                        </StaggerItem>
                                    </Grid>
                                ))}
                            </Grid>
                        </StaggerContainer>
                    </Box>
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