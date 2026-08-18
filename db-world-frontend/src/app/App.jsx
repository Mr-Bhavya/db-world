import React, { useEffect, useState, Suspense, lazy, useMemo } from 'react';
import Header from '@shared/components/layout/Header';
import { ThemeTokensProvider, useThemeMode } from '@shared/theme';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import Login from '@features/auth/Login';
import LogOut from '@features/auth/LogOut';
import Registration from '@features/users/registration';
import Home from '@shared/components/layout/home/Home';
import ErrorPage from '@shared/components/layout/ErrorPage';
import PasswordManagment from '@features/password-manager/PasswordManagement';
import GeneratePassword from '@features/password-manager/GeneratePassword';
import AddPassword from '@features/password-manager/AddPassword';
import Constants from '@shared/constants';
import ViewPassword from '@features/password-manager/ViewPassword';
import Profile from '@features/users/Profile';
import EditProfile from '@features/users/EditProfile';
import { AuthProvider } from '@features/auth/context/Authentication';
import PrivateRoute from '@features/auth/PrivateRoute';
import BackButtonHandler from '@platform/android/BackButtonHandler.js';
import CssBaseline from '@mui/material/CssBaseline';
import { Box, createTheme, ThemeProvider, useMediaQuery } from '@mui/material';
import { StatusBar } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { CategoryProvider } from '@features/cinema/navbar/CategoryContext.js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import NotifyProvider from '@shared/notify/NotifyProvider';
import DbWorldDownload from '@platform/android/DbWorldDownload';
import { useDownloadEventReporter } from '@features/cinema/download-queue/useDownloadEventReporter';
import AppUpdateGate from '@shared/components/AppUpdateGate';
import InstallAppPrompt from '@shared/components/InstallAppPrompt';
import PermissionOnboardingGate, { PERMISSIONS_ONBOARDED_KEY } from '@shared/components/PermissionOnboardingGate';
import BiometricGate from '@features/auth/BiometricGate';
import BiometricEnrollPrompt from '@features/auth/BiometricEnrollPrompt';
import AppLockGate from '@features/auth/AppLockGate';
import { useAppLinks } from '@shared/deeplink/useAppLinks';
import { isChunkLoadError, reloadForStaleChunks } from '@shared/utils/chunkReload';
import AppLoader from '@shared/components/ui/AppLoader';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      gcTime: 1000 * 60 * 10,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Admin layout + pages
import AdminLayout from '@features/admin/layout/AdminLayout.jsx';
// Admin module route components come from the single registry (auto-wires
// sidebar + dashboard + router). Add a module there, not here.
import { ADMIN_MODULES } from '@features/admin/adminModules';

// Lazy load heavy components for better performance
const LazyMediaFilesPage      = lazy(() => import('@features/cinema/screens/media-files/index.js'));
const LazyRecordDetailPage    = lazy(() => import('@features/cinema/screens/RecordDetailPage/index.jsx'));
const LazyCollectionPage      = lazy(() => import('@features/cinema/screens/CollectionPage/index.jsx'));
const LazyRecordDetailModal   = lazy(() => import('@features/cinema/screens/RecordDetailPage/RecordDetailModal.jsx'));
const LazyRecordDetailSheet   = lazy(() => import('@features/cinema/screens/RecordDetailPage/RecordDetailSheet.jsx'));
const LazyCinemaPage          = lazy(() => import('@features/cinema/screens/CinemaPage/CinemaPage.jsx'));
const LazyDownloadQueuePage   = lazy(() => import('@features/cinema/download-queue/index.jsx'));
const LazyHybridPlayerPage    = lazy(() => import('@features/cinema/player/hybrid/HybridPlayerPage.jsx'));
const LazyPlayerDemo          = lazy(() => import('@features/cinema/player/hybrid/PlayerDemo.jsx'));
const LazyMyActivityPage      = lazy(() => import('@features/cinema/me/activity/index.jsx'));
const LazyWallet              = lazy(() => import('@features/wallet'));
const LazySharedDocument      = lazy(() => import('@features/wallet/SharedDocumentPage'));
const LazyIpoListPage         = lazy(() => import('@features/ipo/pages/IpoListPage.jsx'));
const LazyIpoDetailPage       = lazy(() => import('@features/ipo/pages/IpoDetailPage.jsx'));
const LazyMyIposPage          = lazy(() => import('@features/ipo/pages/MyIposPage.jsx'));
// Imported eagerly (it's tiny) so it can serve as the detail route's OWN Suspense fallback —
// a page-shaped placeholder during the code-split chunk download, instead of the generic top bar.
import IpoDetailSkeleton from '@features/ipo/components/IpoDetailSkeleton.jsx';

// Non-critical standalone routes — split out of the initial (cinema) bundle.
// Weather pulls in Leaflet; Games are five separate mini-apps rarely hit first.
const Weather     = lazy(() => import('@features/weather/weather'));
const Games       = lazy(() => import('@features/games/Games'));
const TicTacToe   = lazy(() => import('@features/games/TicTacToe'));
const Snake       = lazy(() => import('@features/games/Snake'));
const MemoryMatch = lazy(() => import('@features/games/MemoryMatch'));
const Game2048    = lazy(() => import('@features/games/Game2048'));


// Error Boundary Component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, reloading: false };
  }

  static getDerivedStateFromError(error) {
    // For stale-chunk failures (old hashes 404 after a deploy) show a brief
    // "updating" screen instead of the generic error card — componentDidCatch
    // triggers the actual reload, or clears this flag if the loop guard fires.
    return { hasError: true, error, reloading: isChunkLoadError(error) };
  }

  componentDidCatch(error, errorInfo) {
    if (isChunkLoadError(error)) {
      // New build deployed while this page was open — reload once to fetch the
      // current chunks. If the guard suppresses it, fall through to the error UI.
      if (reloadForStaleChunks()) return;
      this.setState({ reloading: false });
      return;
    }
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.reloading) {
      return <AppLoader message="Updating to the latest version…" />;
    }

    if (this.state.hasError) {
      const isDark = localStorage.getItem('dbworld-theme') !== 'light';
      const bg     = isDark ? '#000000' : '#ffffff';
      const card   = isDark ? '#111111' : '#f8fafc';
      const text   = isDark ? '#ffffff' : '#000000';
      const muted  = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)';
      const border = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)';
      return (
        <div style={{ minHeight: '100vh', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
          <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 16, padding: '2.5rem 2rem', maxWidth: 420, width: '100%', textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
            <h2 style={{ color: text, margin: '0 0 0.5rem', fontSize: '1.25rem', fontWeight: 700 }}>
              Something went wrong
            </h2>
            <p style={{ color: muted, margin: '0 0 1.5rem', fontSize: '0.875rem', lineHeight: 1.6 }}>
              An unexpected error occurred on this page. You can go back to the previous page or reload.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                onClick={() => { window.history.back(); }}
                style={{ padding: '0.6rem 1.25rem', background: 'transparent', color: '#0d9488', border: '1px solid #0d9488', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem' }}
              >
                Go Back
              </button>
              <button
                onClick={() => window.location.reload()}
                style={{ padding: '0.6rem 1.25rem', background: '#0d9488', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem' }}
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const buildMuiTheme = (mode) => createTheme({
  palette: {
    mode,
    primary:    { main: '#0d9488', contrastText: '#ffffff' },
    secondary:  { main: '#4db6ac', contrastText: '#ffffff' },
    background: {
      default: mode === 'dark' ? '#000000' : '#ffffff',
      paper:   mode === 'dark' ? '#111111' : '#ffffff',
    },
  },
  shape: { borderRadius: 8 },
  typography: { fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif' },
});

/** Thin wrapper so the lazy import receives the pageType prop. */
const CinemaPageWrapper = ({ pageType }) => <LazyCinemaPage pageType={pageType} />;


// Route configuration for better maintainability
const routeConfig = {
  public: [
    { path: '/', element: <Navigate to={Constants.DB_WORLD_HOME_ROUTE} />, exact: true },
    { path: Constants.DB_WORLD_HOME_ROUTE, element: <Home /> },
    { path: Constants.LOGIN_ROUTE, element: <Login /> },
    { path: Constants.DB_WEATHER_ROUTE, element: <Weather /> },
    { path: Constants.REGISTRATION_ROUTE, element: <Registration /> },
    { path: Constants.DB_GAMES_ROUTE,              element: <Games /> },
    { path: Constants.DB_GAMES_TIC_TAC_TOE_ROUTE, element: <TicTacToe /> },
    { path: Constants.DB_GAMES_SNAKE_ROUTE,        element: <Snake /> },
    { path: Constants.DB_GAMES_MEMORY_MATCH_ROUTE, element: <MemoryMatch /> },
    { path: Constants.DB_GAMES_2048_ROUTE,         element: <Game2048 /> },
    { path: Constants.DB_PASSWORD_MANAGER_ROUTE, element: <PasswordManagment />, exact: true },
    { path: Constants.DB_PLAYER_DEMO_ROUTE, element: <LazyPlayerDemo /> },
    { path: Constants.DB_WALLET_SHARE_ROUTE, element: <LazySharedDocument /> },
  ],
  protected: [
    { path: Constants.DB_CINEMA_ROUTE, element: <Navigate to={Constants.DB_CINEMA_BROWSE_ROUTE} />, exact: true },
    { path: Constants.DB_CINEMA_BROWSE_ROUTE, element: <CinemaPageWrapper pageType="home"   key="home"   /> },
    { path: Constants.DB_CINEMA_MOVIES_ROUTE, element: <CinemaPageWrapper pageType="movies" key="movies" /> },
    { path: Constants.DB_CINEMA_SERIES_ROUTE, element: <CinemaPageWrapper pageType="series" key="series" /> },
    // Genre landing pages — same page component, genre read from :genreSlug.
    { path: Constants.DB_CINEMA_BROWSE_GENRE_ROUTE, element: <CinemaPageWrapper pageType="home"   key="home-genre"   /> },
    { path: Constants.DB_CINEMA_MOVIES_GENRE_ROUTE, element: <CinemaPageWrapper pageType="movies" key="movies-genre" /> },
    { path: Constants.DB_CINEMA_SERIES_GENRE_ROUTE, element: <CinemaPageWrapper pageType="series" key="series-genre" /> },
    { path: Constants.DB_RECORD_MEDIA_FILES_ROUTE, element: <LazyMediaFilesPage /> },
    { path: Constants.DB_ADD_PASSWORD_ROUTE, element: <AddPassword /> },
    { path: Constants.DB_GENERATE_PASSWORD_ROUTE, element: <GeneratePassword /> },
    { path: Constants.DB_VIEW_PASSWORD_ROUTE, element: <ViewPassword /> },
    { path: Constants.EDIT_USER_PROFILE_ROUTE, element: <EditProfile /> },
    { path: Constants.DB_MOVIE_DETIALS_ROUTE, element: <LazyRecordDetailPage /> },
    { path: Constants.DB_SERIES_DETIALS_ROUTE, element: <LazyRecordDetailPage /> },
    { path: Constants.DB_CINEMA_COLLECTION_ROUTE, element: <LazyCollectionPage /> },
    { path: Constants.DB_DOWNLOAD_QUEUE_ROUTE, element: <LazyDownloadQueuePage /> },
    { path: Constants.DB_PLAYER_ROUTE_PATTERN, element: <LazyHybridPlayerPage /> },
    { path: Constants.USER_PROFILE_ROUTE, element: <Profile /> },
    { path: Constants.DB_MY_ACTIVITY_ROUTE, element: <LazyMyActivityPage /> },
    { path: Constants.DB_WALLET_ROUTE, element: <LazyWallet /> },
    { path: Constants.DB_IPO_ROUTE, element: <LazyIpoListPage /> },
    { path: Constants.DB_IPO_MY_ROUTE, element: <LazyMyIposPage /> },
    { path: Constants.DB_IPO_DETAIL_ROUTE, element: <Suspense fallback={<IpoDetailSkeleton />}><LazyIpoDetailPage /></Suspense> },
    { path: Constants.LOGOUT_ROUTE, element: <LogOut /> },
  ],
  admin: []
};

// ─── Inner app — reads mode from ThemeTokensContext ──────────────────────────
const ThemedApp = () => {
  const { mode } = useThemeMode();
  const [loading, setLoading] = useState(true);
  // Guarantee the boot loader runs at least one full animation loop (~2.6s: the
  // character build-in + one white-shimmer sweep) before we swap in the app, even
  // when init resolves faster — so the loader never flashes/cuts off mid-animation.
  const [minElapsed, setMinElapsed] = useState(false);
  const muiTheme = useMemo(() => buildMuiTheme(mode), [mode]);
  const location = useLocation();
  const navigate = useNavigate();

  // App-wide download lifecycle → /api/track/events reporter (Android-only,
  // no-op elsewhere). Mounted here (not in the download-queue page) so it
  // keeps listening regardless of which screen is on top.
  useDownloadEventReporter();

  // A tapped https://db-world.in/db-world/… link (Android App Links) routes into
  // the SPA instead of bouncing to the browser. No-op on web.
  useAppLinks(navigate);

  // A download-notification tap persists a one-shot route flag natively (see
  // MainActivity). We pull it from the plugin on mount (cold launch) and whenever the
  // app returns to the foreground (warm) — the SPA drives navigation when it's actually
  // ready, so there's no race with the WebView still booting.
  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android') return undefined;
    let cancelled = false;
    let stateListener;
    const ROUTE_MAP = { downloads: Constants.DB_DOWNLOAD_QUEUE_ROUTE };
    const consumePending = async () => {
      try {
        const { route } = await DbWorldDownload.consumePendingRoute();
        if (!cancelled && route && ROUTE_MAP[route]) navigate(ROUTE_MAP[route]);
      } catch { /* older native build / web — ignore */ }
    };
    consumePending();
    (async () => {
      try {
        stateListener = await CapacitorApp.addListener('appStateChange', ({ isActive }) => {
          if (isActive) consumePending();
        });
      } catch { /* not native */ }
    })();
    return () => { cancelled = true; stateListener?.remove?.(); };
  }, [navigate]);
  // When set, the user opened a record detail in-app. The main <Routes>
  // renders against this background location so the underlying page stays
  // mounted (no refetch, scroll preserved); a second <Routes> mounts the
  // detail overlay on top — a bottom sheet on mobile, a modal on desktop.
  const background = location.state?.background;
  const isSheetViewport = useMediaQuery('(max-width:899.95px)');
  // While the mobile sheet is open, shrink the page behind it slightly for an
  // iOS-style "card stack" depth cue.
  const pageScaled = !!background && isSheetViewport;

  const renderRoutes = (routes) =>
    routes.map((route, i) => (
      <Route key={i} path={route.path} element={route.element} exact={route.exact} />
    ));

  useEffect(() => {
    let timeoutId;
    let resumeListener;
    let stateListener;

    const hideNativeStatusBar = async () => {
      if (!Capacitor.isNativePlatform()) return;
      try { await StatusBar.hide(); } catch { /* ignore */ }
    };

    const init = async () => {
      try {
        if (Capacitor.getPlatform() === 'android') {
          await hideNativeStatusBar();
          // On the very first launch the rationale screen (PermissionOnboardingGate) drives the
          // initial permission request; only auto-ensure once that has been shown, so the raw
          // system prompt doesn't pre-empt the explanation.
          if (localStorage.getItem(PERMISSIONS_ONBOARDED_KEY)) {
            try { await DbWorldDownload.ensurePermissions(); } catch { /* ignore */ }
          }
          try { resumeListener = await CapacitorApp.addListener('resume', hideNativeStatusBar); } catch { /* ignore */ }
          try {
            stateListener = await CapacitorApp.addListener('appStateChange', ({ isActive }) => {
              if (isActive) hideNativeStatusBar();
            });
          } catch { /* ignore */ }
        }
        timeoutId = setTimeout(() => setLoading(false), 1000);
      } catch {
        setLoading(false);
      }
    };

    init();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      resumeListener?.remove?.();
      stateListener?.remove?.();
    };
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setMinElapsed(true), 2800);
    return () => clearTimeout(t);
  }, []);

  // Fade out + remove the pre-React boot loader (lives in index.html, outside
  // #root) once the app is ready. The boot loader is the ONLY loader on cold
  // start — it plays its build-in + shimmer once, then we hand off to the app,
  // so there's no second in-app loader restarting the animation.
  useEffect(() => {
    if (loading || !minElapsed) return undefined;
    const el = document.getElementById('app-loader');
    if (!el) return undefined;
    el.classList.add('dbl-hide');
    const t = setTimeout(() => el.remove(), 500);
    return () => clearTimeout(t);
  }, [loading, minElapsed]);

  // Cold start: render nothing while the boot overlay is up (it covers the screen).
  if (loading || !minElapsed) {
    return null;
  }

  return (
    <ThemeProvider theme={muiTheme}>
      <CssBaseline />
      <NotifyProvider>
        <CategoryProvider>
          {/* Transparent by default so the hybrid player's native video layer
              (behind the transparent WebView) shows through. Only paint the dark
              backdrop when the mobile detail sheet scales the page back. */}
          <div style={{ background: pageScaled ? '#000' : 'transparent' }}>
            <AppLockGate />
            <BackButtonHandler />
            <AppUpdateGate />
            <InstallAppPrompt />
            <PermissionOnboardingGate />
            <BiometricEnrollPrompt />
            <BiometricGate />
            {/* in-app self-update prompt (Android only) */}
            {/* Page chrome. Scales back slightly when the mobile detail sheet
                is open (depth cue); the sheet/backdrop render as siblings on
                top so they aren't affected by this transform.

                IMPORTANT: transform MUST be 'none' (not scale(1)) when idle —
                any transform here makes position:fixed descendants (the bottom
                nav, AppBar) anchor to this box instead of the viewport. */}
            <Box
              sx={{
                transform: pageScaled ? 'scale(0.94)' : 'none',
                borderRadius: pageScaled ? '16px' : 0,
                transformOrigin: 'top center',
                overflow: pageScaled ? 'hidden' : 'visible',
                transition: 'transform 0.32s cubic-bezier(0.32,0.72,0,1), border-radius 0.32s ease',
                minHeight: '100vh',
              }}
            >
            {/* Hide app chrome on full-screen player routes so the video isn't blocked. */}
            {!location.pathname.includes('/player') && <Header />}
            <Suspense fallback={<AppLoader variant="bar" />}>
              <Routes location={background || location}>
                {renderRoutes(routeConfig.public)}
                <Route element={<PrivateRoute allowedRoles={[Constants.VIEWER_USER_ROLE, Constants.ADMIN_USER_ROLE, Constants.OWNER_USER_ROLE]} />}>
                  {renderRoutes(routeConfig.protected)}
                </Route>
                <Route element={<PrivateRoute allowedRoles={[Constants.ADMIN_USER_ROLE, Constants.OWNER_USER_ROLE]} />}>
                  {renderRoutes(routeConfig.admin)}
                </Route>
                <Route element={<PrivateRoute allowedRoles={[Constants.ADMIN_USER_ROLE, Constants.OWNER_USER_ROLE]} />}>
                  <Route path={Constants.DB_ADMIN_BASE_ROUTE} element={<AdminLayout />}>
                    <Route index element={<Navigate to="dashboard" replace />} />
                    {/* All module routes come from the registry — one source of truth. */}
                    {ADMIN_MODULES.map((m) => {
                      const El = m.element;
                      return <Route key={m.id} path={m.path} element={<El />} />;
                    })}
                    {/* Legacy redirects — keep old links working */}
                    <Route path="activity-logs"    element={<Navigate to="../activity-center" replace />} />
                    <Route path="user-activity"    element={<Navigate to="../activity-center" replace />} />
                    <Route path="analytics"        element={<Navigate to="../activity-center" replace />} />
                    <Route path="media-requests"   element={<Navigate to="../requests?tab=media" replace />} />
                    <Route path="catalog-requests" element={<Navigate to="../requests?tab=catalog" replace />} />
                    <Route path="tmdb-sync"        element={<Navigate to="../records" replace />} />
                  </Route>
                </Route>
                <Route path="*" element={<ErrorPage />} />
              </Routes>

            </Suspense>
            </Box>

            {/* Detail overlay — only mounted when a record was opened IN-APP
                (location.state.background is set). Cold loads, shared URLs, and
                refreshes render the full RecordDetailPage instead via the main
                Routes above. The overlay is responsive: a bottom sheet on
                mobile (<md), a Netflix-style modal on desktop.

                NOTE: wrapped in its own Suspense with a `null` fallback so that
                when the lazy chunk loads on first open, the fallback does not
                replace the underlying page (which would lose scroll position
                and trigger a full re-fetch). */}
            {background && (
              <Suspense fallback={null}>
                <Routes>
                  <Route element={<PrivateRoute allowedRoles={[Constants.VIEWER_USER_ROLE, Constants.ADMIN_USER_ROLE, Constants.OWNER_USER_ROLE]} />}>
                    <Route path={Constants.DB_MOVIE_DETIALS_ROUTE}  element={isSheetViewport ? <LazyRecordDetailSheet /> : <LazyRecordDetailModal />} />
                    <Route path={Constants.DB_SERIES_DETIALS_ROUTE} element={isSheetViewport ? <LazyRecordDetailSheet /> : <LazyRecordDetailModal />} />
                  </Route>
                </Routes>
              </Suspense>
            )}
          </div>
        </CategoryProvider>
      </NotifyProvider>
    </ThemeProvider>
  );
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <ThemeTokensProvider>
          <AuthProvider>
            <Router>
              <ThemedApp />
            </Router>
          </AuthProvider>
        </ThemeTokensProvider>
      </ErrorBoundary>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}

export default App;
