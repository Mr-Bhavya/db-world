import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Box, Container, Typography } from '@mui/material';

import { useAuth } from '@features/auth/context/Authentication';
import Constants from '@shared/constants';
import { useRequireAuth } from '@features/auth/useRequireAuth';
import usePageMeta from '@shared/hooks/usePageMeta';
import { useT } from '@shared/theme';
import AdSlot from '@shared/ads/AdSlot';

import NotificationsPrompt from '@shared/push/NotificationsPrompt';

import { APPS } from './homeData';
import { getRecent, saveRecent } from './homeStorage';

import DashboardGrid from './dashboard/DashboardGrid';
import DashboardIntro from './dashboard/DashboardIntro';
import DashboardToolbar from './dashboard/DashboardToolbar';
import buildWidgets from './dashboard/widgetRegistry';
import useDashboardLayout from './dashboard/useDashboardLayout';
import { useHomeSummary } from './dashboard/homeSummaryApi';

/**
 * The DB World hub — a dashboard of live widgets rather than a wall of static app cards.
 *
 * Three things shape the layout:
 *
 *  1. Every tile carries live content (see `dashboard/widgets`), fed by one `/api/home/summary`
 *     call so the busiest page in the app costs one request, not one per app.
 *  2. The arrangement is the user's: widgets can be reordered, resized and hidden, and the layout
 *     persists per device in localStorage.
 *  3. It works signed out, and sells. This route is public — it is what search engines and
 *     first-time visitors land on — so the public widgets render for everyone, and the
 *     user-scoped ones swap their figures for what the app does plus a way in, rather than
 *     sitting there as empty shells.
 */
const Home = () => {
  usePageMeta(null, {
    description:
      'DB World — your all-in-one hub for movies and TV, live IPO tracking, a secure password vault, an encrypted document wallet, games and the weather.',
  });

  const T = useT();
  const navigate = useNavigate();
  const { promptSignIn } = useRequireAuth();

  const { auth } = useAuth();

  const user = auth?.user;
  const role = auth?.role;
  const isAuthenticated = Boolean(auth?.isAuthenticated);

  const isAdmin =
    role === Constants.OWNER_USER_ROLE || role === Constants.ADMIN_USER_ROLE;

  const [recent, setRecent] = useState([]);
  const [editing, setEditing] = useState(false);

  const { data: summary, isLoading } = useHomeSummary();

  useEffect(() => {
    setRecent(getRecent());
  }, []);

  const visibleApps = useMemo(
    () => APPS.filter((app) => !app.adminOnly || isAdmin),
    [isAdmin]
  );

  const widgets = useMemo(() => buildWidgets(isAdmin), [isAdmin]);

  const { visible, available, move, cycleSize, setHidden, reset, isCustomised } =
    useDashboardLayout(widgets);

  /**
   * The footprint each tile actually renders at.
   *
   * A widget may ask for a different size than the saved layout when its content warrants one — an
   * empty wallet shrinks, a signed-out one grows to fit its pitch (see `widgetRegistry`). Suspended
   * while editing so the size button and the tile the user is looking at never disagree.
   */
  const tiles = useMemo(() => {
    if (editing) return visible;

    const context = { isAuthenticated, summary, isLoading };

    return visible.map((widget) =>
      widget.resolveSize
        ? { ...widget, size: widget.resolveSize(widget.size, context) }
        : widget
    );
  }, [visible, editing, isAuthenticated, summary, isLoading]);

  const firstName =
    user?.firstName ??
    user?.name?.split(' ')?.[0] ??
    user?.username ??
    null;

  /** Navigate to an app (recording it in the recent trail) or to a plain route. */
  const handleNavigate = useCallback(
    (appOrRoute) => {
      const app =
        typeof appOrRoute === 'string'
          ? APPS.find((candidate) => candidate.route === appOrRoute)
          : appOrRoute;

      const route = typeof appOrRoute === 'string' ? appOrRoute : appOrRoute?.route;
      if (!route) return;

      if (app?.id) {
        saveRecent(app.id, app.route);
        setRecent(getRecent());
      }

      navigate(route);
    },
    [navigate]
  );

  // Opens the sign-in modal rather than leaving the hub: the tiles behind it repopulate with
  // the visitor's own figures as it closes, which is the whole point of asking here.
  const handleSignIn = useCallback(() => promptSignIn(), [promptSignIn]);
  const handleRegister = useCallback(() => navigate(Constants.REGISTRATION_ROUTE), [navigate]);

  const handleHide = useCallback((id) => setHidden(id, true), [setHidden]);
  const handleShow = useCallback((id) => setHidden(id, false), [setHidden]);

  return (
    <Box
      sx={{
        bgcolor: T.bg,
        minHeight: '100vh',
        color: T.textPrimary,
        overflowX: 'hidden',
      }}
    >
      <Box
        component="main"
        sx={{
          pt: { xs: '76px', sm: '88px', md: '104px', xl: '120px' },
          pb: { xs: 5, sm: 6, md: 8 },
          px: { xs: 1.5, sm: 2.5, md: 3, xl: 5 },
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
            '@media (min-width:1920px)': { maxWidth: 1840 },
            px: { xs: 0, sm: 0 },
          }}
        >
          <DashboardIntro
            firstName={firstName}
            isAuthenticated={isAuthenticated}
            summary={summary}
            onSignIn={handleSignIn}
            onRegister={handleRegister}
            actions={
              <DashboardToolbar
                editing={editing}
                onToggleEditing={() => setEditing((current) => !current)}
                available={available}
                onShow={handleShow}
                onReset={reset}
                isCustomised={isCustomised}
              />
            }
          />

          {/* Push-notification opt-in (only shows when supported + not yet decided) */}
          <NotificationsPrompt />

          {editing && (
            <Typography
              sx={{
                color: T.textMuted,
                fontSize: { xs: '0.76rem', sm: '0.82rem' },
                fontWeight: 600,
                mb: 1.5,
              }}
            >
              Drag a tile to reorder it, or use the size and remove buttons in its corner. Your
              layout is saved on this device.
            </Typography>
          )}

          <DashboardGrid
            items={tiles}
            editing={editing}
            onMove={move}
            renderItem={(widget, index) => {
              const Widget = widget.Component;

              return (
                <Widget
                  widget={widget}
                  index={index}
                  total={tiles.length}
                  editing={editing}
                  summary={summary}
                  isLoading={isLoading}
                  isAuthenticated={isAuthenticated}
                  apps={visibleApps}
                  recent={recent}
                  onOpen={handleNavigate}
                  onNavigate={handleNavigate}
                  onSignIn={handleSignIn}
                  onMove={move}
                  onCycleSize={cycleSize}
                  onHide={handleHide}
                />
              );
            }}
          />

          {/* Last thing on the hub, below the tiles.

              Not between them: they are a grid of tap targets, and a unit in that flow invites the
              mis-taps AdSense counts as invalid traffic. Renders nothing until VITE_AD_SLOT_HOME
              is set. */}
          <AdSlot slot="home" minHeight={120} sx={{ mt: 5 }} />
        </Container>
      </Box>
    </Box>
  );
};

export default Home;
