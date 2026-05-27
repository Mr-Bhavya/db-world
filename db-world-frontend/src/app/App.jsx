import React, { useEffect, useState, Suspense, lazy, useMemo } from 'react';
import Header from '@shared/components/layout/Header';
import { ThemeTokensProvider, useThemeMode } from '@shared/theme';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import Login from '@features/auth/Login';
import LogOut from '@features/auth/LogOut';
import Registration from '@features/users/registration';
import Weather from '@features/weather/weather';
import Games from '@features/games/Games';
import TicTacToe from '@features/games/TicTacToe';
import Snake from '@features/games/Snake';
import MemoryMatch from '@features/games/MemoryMatch';
import Game2048 from '@features/games/Game2048';
import Home from '@shared/components/layout/Home';
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
import { Box, createTheme, ThemeProvider, Typography } from '@mui/material';
import { StatusBar } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { CategoryProvider } from '@features/cinema/navbar/CategoryContext.js';
import FlmngrStandalone from '@features/admin/FileExplorer/FlmngrStandalone.js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { SnackbarProvider } from 'notistack';
import DbWorldDownload from '@platform/android/DbWorldDownload';

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

// Lazy load heavy components for better performance
const LazyAdminDashboard       = lazy(() => import('@features/admin/dashboard/AdminDashboard.jsx'));
const LazyActivityCenter       = lazy(() => import('@features/admin/activity-center'));
const LazyMediaFilesManagement = lazy(() => import('@features/admin/mediafiles'));
const LazyRequestsAdmin        = lazy(() => import('@features/admin/requests'));
const LazyTmdbSyncManager      = lazy(() => import('@features/admin/tmdb-sync'));
const LazyIngestionPage        = lazy(() => import('@features/admin/ingestion'));
const LazyServerInfo           = lazy(() => import('@features/admin/system-info'));
const LazyRedisManager         = lazy(() => import('@features/admin/redis'));
const LazyFileManager          = lazy(() => import('@features/admin/filemanager'));
const LazySchedulerPanel       = lazy(() => import('@features/admin/Scheduler/SchedulerPanel.jsx'));
const LazyUserManagement       = lazy(() => import('@features/admin/users'));
const LazyRecordManagement     = lazy(() => import('@features/admin/records'));
const LazyLogViewer            = lazy(() => import('@features/admin/logs/LogViewer.jsx'));
const LazyTagManagement        = lazy(() => import('@features/admin/tags'));
const LazyMediaFilesPage      = lazy(() => import('@features/cinema/screens/media-files/index.js'));
const LazyRecordDetailPage    = lazy(() => import('@features/cinema/screens/RecordDetailPage/index.jsx'));
const LazyRecordDetailModal   = lazy(() => import('@features/cinema/screens/RecordDetailPage/RecordDetailModal.jsx'));
const LazyCinemaPage          = lazy(() => import('@features/cinema/screens/CinemaPage/CinemaPage.jsx'));
const LazyDownloadQueuePage   = lazy(() => import('@features/cinema/download-queue/index.jsx'));
const LazyMyActivityPage      = lazy(() => import('@features/cinema/me/activity/index.jsx'));

// Loading Component
const LoadingFallback = () => (
   <Box
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 1300,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        backdropFilter: 'blur(2px)',
      }}
    >
      {/* Spinner */}
      <Box
        sx={{
          width: 52,
          height: 52,
          borderRadius: '50%',
          border: '4px solid rgba(255,255,255,0.2)',
          borderTopColor: 'primary.main',
          animation: 'spin 0.9s linear infinite',
          mb: 2,
        }}
      />

      <Typography
        variant="body2"
        sx={{
          color: 'rgba(255,255,255,0.85)',
          letterSpacing: 1,
          textTransform: 'uppercase',
        }}
      >
        Loading, please wait...
      </Typography>

      {/* Keyframes */}
      <style>
        {`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}
      </style>
    </Box>
  );

// Error Boundary Component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
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
  ],
  protected: [
    { path: Constants.DB_CINEMA_ROUTE, element: <Navigate to={Constants.DB_CINEMA_BROWSE_ROUTE} />, exact: true },
    { path: Constants.DB_CINEMA_BROWSE_ROUTE, element: <CinemaPageWrapper pageType="home"   key="home"   /> },
    { path: Constants.DB_CINEMA_MOVIES_ROUTE, element: <CinemaPageWrapper pageType="movies" key="movies" /> },
    { path: Constants.DB_CINEMA_SERIES_ROUTE, element: <CinemaPageWrapper pageType="series" key="series" /> },
    { path: Constants.DB_RECORD_MEDIA_FILES_ROUTE, element: <LazyMediaFilesPage /> },
    { path: Constants.DB_ADD_PASSWORD_ROUTE, element: <AddPassword /> },
    { path: Constants.DB_GENERATE_PASSWORD_ROUTE, element: <GeneratePassword /> },
    { path: Constants.DB_VIEW_PASSWORD_ROUTE, element: <ViewPassword /> },
    { path: Constants.EDIT_USER_PROFILE_ROUTE, element: <EditProfile /> },
    { path: Constants.DB_MOVIE_DETIALS_ROUTE, element: <LazyRecordDetailPage /> },
    { path: Constants.DB_SERIES_DETIALS_ROUTE, element: <LazyRecordDetailPage /> },
    { path: Constants.DB_DOWNLOAD_QUEUE_ROUTE, element: <LazyDownloadQueuePage /> },
    { path: Constants.USER_PROFILE_ROUTE, element: <Profile /> },
    { path: Constants.DB_MY_ACTIVITY_ROUTE, element: <LazyMyActivityPage /> },
    { path: Constants.LOGOUT_ROUTE, element: <LogOut /> },
  ],
  admin: [
    { path: Constants.DB_FILE_MANAGER_ROUTE, element: <FlmngrStandalone /> },
  ]
};

// ─── Inner app — reads mode from ThemeTokensContext ──────────────────────────
const ThemedApp = () => {
  const { mode } = useThemeMode();
  const [loading, setLoading] = useState(true);
  const muiTheme = useMemo(() => buildMuiTheme(mode), [mode]);
  const location = useLocation();
  // When set, the user clicked a record card in-app on desktop. The main
  // <Routes> renders against this background location so the underlying
  // cinema page stays visible; a second <Routes> mounts the modal on top.
  const background = location.state?.background;

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
          try { await DbWorldDownload.ensurePermissions(); } catch { /* ignore */ }
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

  if (loading) {
    return (
      <ThemeProvider theme={muiTheme}>
        <CssBaseline />
        <LoadingFallback />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={muiTheme}>
      <CssBaseline />
      <SnackbarProvider maxSnack={4} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} autoHideDuration={3000}>
        <CategoryProvider>
          <div>
            <BackButtonHandler />
            <Header />
            <Suspense fallback={<LoadingFallback />}>
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
                    <Route path="dashboard"     element={<LazyAdminDashboard />} />
                    <Route path="users"         element={<LazyUserManagement />} />
                    <Route path="activity-center" element={<LazyActivityCenter />} />
                    {/* legacy redirects */}
                    <Route path="activity-logs"  element={<Navigate to="../activity-center" replace />} />
                    <Route path="user-activity"  element={<Navigate to="../activity-center" replace />} />
                    <Route path="analytics"      element={<Navigate to="../activity-center" replace />} />
                    <Route path="records"       element={<LazyRecordManagement />} />
                    <Route path="media-files"   element={<LazyMediaFilesManagement />} />
                    <Route path="requests"       element={<LazyRequestsAdmin />} />
                    {/* legacy redirects — keep links to the old split pages working */}
                    <Route path="media-requests"   element={<Navigate to="../requests?tab=media" replace />} />
                    <Route path="catalog-requests" element={<Navigate to="../requests?tab=catalog" replace />} />
                    <Route path="tag-management" element={<LazyTagManagement />} />
                    <Route path="tmdb-sync"     element={<LazyTmdbSyncManager />} />
                    <Route path="ingestion"     element={<LazyIngestionPage />} />
                    <Route path="system-info"   element={<LazyServerInfo />} />
                    <Route path="logs"          element={<LazyLogViewer />} />
                    <Route path="redis"         element={<LazyRedisManager />} />
                    <Route path="files"         element={<LazyFileManager />} />
                    <Route path="scheduler"     element={<LazySchedulerPanel />} />
                  </Route>
                </Route>
                <Route path="*" element={<ErrorPage />} />
              </Routes>

            </Suspense>

            {/* Netflix-style modal overlay — only mounted when the user
                navigated to a detail route IN-APP (location.state.background
                is set). Cold loads, shared URLs, and refreshes render the
                full RecordDetailPage instead via the main Routes above.

                NOTE: wrapped in its own Suspense with a `null` fallback so
                that when the lazy modal chunk loads on first open, the
                fallback does not replace the underlying cinema page (which
                would lose scroll position and trigger a full re-fetch). */}
            {background && (
              <Suspense fallback={null}>
                <Routes>
                  <Route element={<PrivateRoute allowedRoles={[Constants.VIEWER_USER_ROLE, Constants.ADMIN_USER_ROLE, Constants.OWNER_USER_ROLE]} />}>
                    <Route path={Constants.DB_MOVIE_DETIALS_ROUTE}  element={<LazyRecordDetailModal />} />
                    <Route path={Constants.DB_SERIES_DETIALS_ROUTE} element={<LazyRecordDetailModal />} />
                  </Route>
                </Routes>
              </Suspense>
            )}
          </div>
        </CategoryProvider>
      </SnackbarProvider>
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
