import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  Box,
  Container,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';

import { useAuth } from '@features/auth/context/Authentication';
import Constants from '@shared/constants';
import { useT } from '@shared/theme';

import Footer from '@shared/components/layout/Footer';
import SectionHeading from '@shared/components/ui/SectionHeading';

import { APPS } from './homeData';

import {
  getFavorites,
  getRecent,
  saveRecent,
  toggleFavorite,
} from './homeStorage';

import {
  appsGridSx,
  horizontalScrollSx,
} from './homeStyles';

import AppCard from './AppCard';
import FavoritePill from './FavoritePill';
import HeroSection from './HeroSection';
import RecentCard from './RecentCard';

const Home = () => {
  const T = useT();
  const navigate = useNavigate();
  const theme = useTheme();

  const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const isTabletDown = useMediaQuery(theme.breakpoints.down('md'));

  const { auth } = useAuth();

  const user = auth?.user;
  const role = auth?.role;

  const isAdmin =
    role === Constants.OWNER_USER_ROLE ||
    role === Constants.ADMIN_USER_ROLE;

  const [recent, setRecent] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    setRecent(getRecent());
    setFavorites(getFavorites());
  }, []);

  useEffect(() => {
    let frameId = null;

    const handleScroll = () => {
      if (frameId) return;

      frameId = window.requestAnimationFrame(() => {
        setScrolled(window.scrollY > 40);
        frameId = null;
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);

      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, []);

  const visibleApps = useMemo(() => {
    return APPS.filter((app) => !app.adminOnly || isAdmin);
  }, [isAdmin]);

  const visibleAppIds = useMemo(() => {
    return new Set(visibleApps.map((app) => app.id));
  }, [visibleApps]);

  const favoriteApps = useMemo(() => {
    return favorites
      .filter((appId) => visibleAppIds.has(appId))
      .map((appId) => visibleApps.find((app) => app.id === appId))
      .filter(Boolean);
  }, [favorites, visibleApps, visibleAppIds]);

  const visibleRecent = useMemo(() => {
    return recent.filter((item) => visibleAppIds.has(item.appId));
  }, [recent, visibleAppIds]);

  const firstName =
    user?.firstName ??
    user?.name?.split(' ')?.[0] ??
    user?.username ??
    null;

  const handleNavigate = useCallback(
    (appOrRoute) => {
      if (typeof appOrRoute === 'string') {
        const app = APPS.find((candidate) => candidate.route === appOrRoute);

        if (app) {
          saveRecent(app.id, app.route);
          setRecent(getRecent());
        }

        navigate(appOrRoute);
        return;
      }

      if (!appOrRoute?.route) return;

      saveRecent(appOrRoute.id, appOrRoute.route);
      setRecent(getRecent());
      navigate(appOrRoute.route);
    },
    [navigate]
  );

  const handleToggleFavorite = useCallback((appId) => {
    const updated = toggleFavorite(appId);
    setFavorites(Array.isArray(updated) ? [...updated] : []);
  }, []);

  const openCinema = useCallback(() => {
    const app = APPS.find((candidate) => candidate.id === 'cinema');

    if (app) {
      handleNavigate(app);
    }
  }, [handleNavigate]);

  const openVault = useCallback(() => {
    const app = APPS.find((candidate) => candidate.id === 'password');

    if (app) {
      handleNavigate(app);
    }
  }, [handleNavigate]);

  return (
    <Box
      sx={{
        bgcolor: T.bg,
        minHeight: '100vh',
        color: T.textPrimary,
        overflowX: 'hidden',
      }}
    >
      <HeroSection
        T={T}
        firstName={firstName}
        visibleApps={visibleApps}
        scrolled={scrolled}
        onNavigate={handleNavigate}
        openCinema={openCinema}
        openVault={openVault}
      />

      <Box
        id="apps"
        component="main"
        sx={{
          scrollMarginTop: {
            xs: 72,
            md: 88,
          },
          py: {
            xs: 5,
            sm: 6,
            md: 8,
            xl: 10,
          },
          px: {
            xs: 1.5,
            sm: 2.5,
            md: 3,
            xl: 5,
          },
        }}
      >
        <Container
          maxWidth={false}
          sx={{
            width: '100%',
            maxWidth: {
              xs: '100%',
              sm: 760,
              md: 1040,
              lg: 1240,
              xl: 1540,
            },
            '@media (min-width:1920px)': {
              maxWidth: 1840,
            },
            px: {
              xs: 0,
              sm: 0,
            },
          }}
        >
          {/* Favorites */}
          <Box
            component="section"
            sx={{
              mb: {
                xs: 5,
                md: 7,
                xl: 9,
              },
              minWidth: 0,
            }}
          >
            <SectionHeading label="Favorites" />

            {favoriteApps.length === 0 ? (
              <Box
                sx={{
                  border: `1px dashed ${T.glassBorder}`,
                  bgcolor: 'rgba(255,255,255,0.018)',
                  borderRadius: 3,
                  px: {
                    xs: 1.5,
                    sm: 2,
                    xl: 2.5,
                  },
                  py: {
                    xs: 1.6,
                    xl: 2.2,
                  },
                }}
              >
                <Typography
                  sx={{
                    color: T.textMuted,
                    fontSize: {
                      xs: '0.84rem',
                      xl: '1rem',
                    },
                    lineHeight: 1.5,
                  }}
                >
                  No favorites yet — bookmark an app below for faster access.
                </Typography>
              </Box>
            ) : (
              <Box
                sx={{
                  display: 'flex',
                  flexWrap: {
                    xs: 'nowrap',
                    md: 'wrap',
                  },
                  gap: {
                    xs: 1.25,
                    sm: 1.5,
                    xl: 1.75,
                  },
                  overflowX: {
                    xs: 'auto',
                    md: 'visible',
                  },
                  overflowY: 'hidden',
                  WebkitOverflowScrolling: 'touch',
                  scrollbarWidth: 'thin',
                  pb: 1,
                  mx: {
                    xs: -1.5,
                    sm: 0,
                  },
                  px: {
                    xs: 1.5,
                    sm: 0,
                  },
                  minWidth: 0,
                }}
              >
                {favoriteApps.map((app) => (
                  <FavoritePill
                    key={app.id}
                    app={app}
                    onNavigate={handleNavigate}
                    onToggleFavorite={handleToggleFavorite}
                  />
                ))}
              </Box>
            )}
          </Box>

          {/* All Apps */}
          <Box
            component="section"
            sx={{
              mb: {
                xs: 5,
                md: 7,
                xl: 9,
              },
              minWidth: 0,
            }}
          >
            <SectionHeading label="All Apps" />

            <Box sx={appsGridSx}>
              {visibleApps.map((app) => (
                <Box
                  key={`${app.id}-${isAdmin ? 'admin' : 'user'}`}
                  sx={{
                    display: 'flex',
                    width: '100%',
                    minWidth: 0,
                  }}
                >
                  <AppCard
                    app={app}
                    isFavorite={favorites.includes(app.id)}
                    onNavigate={handleNavigate}
                    onToggleFavorite={handleToggleFavorite}
                  />
                </Box>
              ))}
            </Box>
          </Box>

          {/* Recent Activity */}
          {visibleRecent.length > 0 && (
            <Box
              component="section"
              sx={{
                mb: {
                  xs: 5,
                  md: 7,
                },
                minWidth: 0,
              }}
            >
              <SectionHeading label="Recent Activity" />

              {isTabletDown ? (
                <Box sx={horizontalScrollSx}>
                  <Stack
                    direction="row"
                    spacing={1.25}
                    sx={{
                      minWidth: 0,
                    }}
                  >
                    {visibleRecent.map((item) => (
                      <RecentCard
                        key={`${item.appId}-${item.ts ?? item.timestamp}`}
                        item={item}
                        onNavigate={handleNavigate}
                        compact
                      />
                    ))}
                  </Stack>
                </Box>
              ) : (
                <Box
                  sx={{
                    position: 'relative',
                    minWidth: 0,
                    maxWidth: {
                      md: 680,
                      xl: 820,
                    },
                    '@media (min-width:1920px)': {
                      maxWidth: 980,
                    },
                  }}
                >
                  <Box
                    sx={{
                      position: 'absolute',
                      left: {
                        md: 21,
                        xl: 24,
                      },
                      top: 10,
                      bottom: 10,
                      width: 2,
                      bgcolor: T.teal,
                      opacity: 0.28,
                      borderRadius: 1,
                    }}
                  />

                  {visibleRecent.map((item) => (
                    <RecentCard
                      key={`${item.appId}-${item.ts ?? item.timestamp}`}
                      item={item}
                      onNavigate={handleNavigate}
                      compact={false}
                    />
                  ))}
                </Box>
              )}
            </Box>
          )}
        </Container>
      </Box>

      <Footer />
    </Box>
  );
};

export default Home;