import React, { useEffect, useState, Suspense, lazy } from 'react';
import Header from '@shared/components/layout/Header';
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Login from '@features/auth/Login';
import LogOut from '@features/auth/LogOut';
import Registration from '@features/users/registration';
import Weather from '@features/weather/weather';
import TicTacToe from '@features/games/TicTacToe';
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
import { CategoryProvider } from '@features/cinema/navbar/CategoryContext.js';
import FlmngrStandalone from '@features/admin/FileExplorer/FlmngrStandalone.js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

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
const LazyAdminTools          = lazy(() => import('@features/admin/AdminPage/AdminPage.js'));
const LazyAdminDashboard      = lazy(() => import('@features/admin/dashboard/AdminDashboard.jsx'));
const LazyUserManagement      = lazy(() => import('@features/admin/UserManagment/index.js'));
const LazyActivityLogs        = lazy(() => import('@features/admin/ActivityLogs/ActivityLogs.js'));
const LazyRecordsManagement   = lazy(() => import('@features/admin/RecordsManagment/index.js'));
const LazyMediaFilesManagement = lazy(() => import('@features/admin/MediaFilesManagement/MediaFilesManagement.js'));
const LazyTagsRailsManager    = lazy(() => import('@features/admin/TagsRails/TagsRailsManager.jsx'));
const LazyTmdbSyncManager     = lazy(() => import('@features/admin/TmdbSync/TmdbSyncManager.jsx'));
const LazyDownloadManager     = lazy(() => import('@features/admin/DownloadManager/index.js'));
const LazyUserCinemaActivity  = lazy(() => import('@features/admin/UserCinemaActivity/index.js'));
const LazyServerInfo          = lazy(() => import('@features/admin/ServerInfo/ServerInfo.js'));
const LazyLogDashboard        = lazy(() => import('@features/admin/LogDashboard/LogDashboard.jsx'));
const LazyRedisManager        = lazy(() => import('@features/admin/RedisManager.js'));
const LazyFlmngrManager       = lazy(() => import('@features/admin/FileExplorer/FlmngrManager.js'));
const LazySchedulerPanel      = lazy(() => import('@features/admin/Scheduler/SchedulerPanel.jsx'));
const LazyUserManagementV2    = lazy(() => import('../features/adminv2/users'));
const LazyRecordManagementV2  = lazy(() => import('../features/adminv2/records'));
const LazyMediaDownloadViewer = lazy(() => import('@features/cinema/screens/download/index.js'));
const LazyMovieDetailsPage    = lazy(() => import('@features/cinema/screens/movie-details/index.js'));
const LazySeriesDetailsPage   = lazy(() => import('@features/cinema/screens/series-details/SeriesDetailsPage.js'));
const LazyCinemaPage          = lazy(() => import('@features/cinema/screens/CinemaPage/CinemaPage.jsx'));

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
      return (
        <div style={{
          padding: '2rem',
          textAlign: 'center',
          color: '#d32f2f'
        }}>
          <h2>Something went wrong</h2>
          <p>Please try refreshing the page</p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#008080',
              color: 'black',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Themes
const lightTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#008080',
      contrastText: '#ffffff'
    },
    secondary: {
      main: '#4db6ac',
      contrastText: '#ffffff'
    },
    background: {
      default: '#f5f5f5',
      paper: '#ffffff'
    },
    text: {
      primary: '#333333',
      secondary: '#555555'
    }
  },
  shape: {
    borderRadius: 8
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
  }
});

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#008080',
      contrastText: '#ffffff'
    },
    secondary: {
      main: '#4db6ac',
      contrastText: '#ffffff'
    },
    background: {
      default: '#121212',
      paper: '#1e1e1e'
    },
    text: {
      primary: '#ffffff',
      secondary: '#bbbbbb'
    }
  },
  shape: {
    borderRadius: 8
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
  }
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
    { path: Constants.DB_GAMES_ROUTE, element: <TicTacToe /> },
    { path: Constants.DB_PASSWORD_MANAGER_ROUTE, element: <PasswordManagment />, exact: true },
  ],
  protected: [
    { path: Constants.DB_CINEMA_ROUTE, element: <Navigate to={Constants.DB_CINEMA_BROWSE_ROUTE} />, exact: true },
    { path: Constants.DB_CINEMA_BROWSE_ROUTE, element: <CinemaPageWrapper pageType="home"   key="home"   /> },
    { path: Constants.DB_CINEMA_MOVIES_ROUTE, element: <CinemaPageWrapper pageType="movies" key="movies" /> },
    { path: Constants.DB_CINEMA_SERIES_ROUTE, element: <CinemaPageWrapper pageType="series" key="series" /> },
    { path: Constants.DB_DONWLOAD_RECORD_ROUTE, element: <LazyMediaDownloadViewer /> },
    { path: Constants.DB_ADD_PASSWORD_ROUTE, element: <AddPassword /> },
    { path: Constants.DB_GENERATE_PASSWORD_ROUTE, element: <GeneratePassword /> },
    { path: Constants.DB_VIEW_PASSWORD_ROUTE, element: <ViewPassword /> },
    { path: Constants.EDIT_USER_PROFILE_ROUTE, element: <EditProfile /> },
    { path: Constants.DB_MOVIE_DETIALS_ROUTE, element: <LazyMovieDetailsPage /> },
    { path: Constants.DB_SERIES_DETIALS_ROUTE, element: <LazySeriesDetailsPage /> },
    { path: Constants.USER_PROFILE_ROUTE, element: <Profile /> },
    { path: Constants.LOGOUT_ROUTE, element: <LogOut /> },
  ],
  admin: [
    { path: Constants.DB_ADMIN_TOOLS_ROUTE, element: <LazyAdminTools /> },
    { path: Constants.DB_FILE_MANAGER_ROUTE, element: <FlmngrStandalone /> },
  ]
};

function App() {
  const [matches, setMatches] = useState(
    window.matchMedia("(min-width: 900px)").matches
  );
  const [darkMode, setDarkMode] = useState(true);
  const [loading, setLoading] = useState(true);

  // Initialize app
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Set up media query listener
        const mediaQuery = window.matchMedia("(min-width: 900px)");
        const handleMediaChange = (e) => setMatches(e.matches);

        mediaQuery.addEventListener('change', handleMediaChange);

        // Hide status bar for native platforms
        if (Capacitor.isNativePlatform()) {
          try {
            await StatusBar.hide();
          } catch (error) {
            console.warn('StatusBar hide failed:', error);
          }
        }

        // Simulate initial loading (you can replace this with actual initialization)
        const initTimer = setTimeout(() => {
          setLoading(false);
        }, 1000);

        return () => {
          mediaQuery.removeEventListener('change', handleMediaChange);
          clearTimeout(initTimer);
        };
      } catch (error) {
        console.error('App initialization error:', error);
        setLoading(false);
      }
    };

    initializeApp();
  }, []);

  // Render routes based on configuration
  const renderRoutes = (routes, wrapper = null) => {
    return routes.map((route, index) => {
      const routeElement = wrapper ? (
        React.cloneElement(wrapper, { key: index }, route.element)
      ) : (
        <Route key={index} path={route.path} element={route.element} exact={route.exact} />
      );

      return routeElement;
    });
  };

  if (loading) {
    return (
      <ThemeProvider theme={darkMode ? darkTheme : lightTheme}>
        <CssBaseline />
        <LoadingFallback />
      </ThemeProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <ThemeProvider theme={darkMode ? darkTheme : lightTheme}>
            <CssBaseline />
            <CategoryProvider>
              <div>
                <BackButtonHandler />
                <Header />

                <Suspense fallback={<LoadingFallback />}>
                  <Routes>
                    {/* Public Routes */}
                    {renderRoutes(routeConfig.public)}

                    {/* Protected Routes */}
                    <Route element={<PrivateRoute allowedRoles={[Constants.VIEWER_USER_ROLE, Constants.ADMIN_USER_ROLE, Constants.OWNER_USER_ROLE]} />}>
                      {renderRoutes(routeConfig.protected)}
                    </Route>

                    {/* Admin Routes (legacy tab-based) */}
                    <Route element={<PrivateRoute allowedRoles={[Constants.ADMIN_USER_ROLE, Constants.OWNER_USER_ROLE]} />}>
                      {renderRoutes(routeConfig.admin)}
                    </Route>

                    {/* Admin — new sidebar layout with nested routes */}
                    <Route element={<PrivateRoute allowedRoles={[Constants.ADMIN_USER_ROLE, Constants.OWNER_USER_ROLE]} />}>
                      <Route path={Constants.DB_ADMIN_BASE_ROUTE} element={<AdminLayout />}>
                        <Route index element={<Navigate to="dashboard" replace />} />
                        <Route path="dashboard"     element={<LazyAdminDashboard />} />
                        <Route path="users"         element={<LazyUserManagement />} />
                        <Route path="activity-logs" element={<LazyActivityLogs />} />
                        <Route path="records"       element={<LazyRecordsManagement />} />
                        <Route path="media-files"   element={<LazyMediaFilesManagement />} />
                        <Route path="tags-rails"    element={<LazyTagsRailsManager />} />
                        <Route path="tmdb-sync"     element={<LazyTmdbSyncManager />} />
                        <Route path="downloads"     element={<LazyDownloadManager />} />
                        <Route path="user-activity" element={<LazyUserCinemaActivity />} />
                        <Route path="system-info"   element={<LazyServerInfo />} />
                        <Route path="logs"          element={<LazyLogDashboard />} />
                        <Route path="redis"         element={<LazyRedisManager />} />
                        <Route path="files"         element={<LazyFlmngrManager />} />
                        <Route path="scheduler"     element={<LazySchedulerPanel />} />
                        <Route path="v2/users"      element={<LazyUserManagementV2 />} />
                        <Route path="v2/records"    element={<LazyRecordManagementV2 />} />
                      </Route>
                    </Route>

                    {/* 404 Route */}
                    <Route path="*" element={<ErrorPage />} />
                  </Routes>
                </Suspense>
              </div>
            </CategoryProvider>
          </ThemeProvider>
        </Router>
      </AuthProvider>
    </ErrorBoundary>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}

export default App;