import React, { useEffect, useState, Suspense, lazy } from 'react';
import Header from './components/Header';
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Login from './components/Login';
import LogOut from './components/LogOut';
import Registration from './components/DB_Users/registration';
import Weather from './components/DB_Weather/weather';
import TicTacToe from './components/DB_Games/TicTacToe';
import Home from './components/Home';
import ErrorPage from './components/ErrorPage';
import PasswordManagment from './components/DB_Password_Management/PasswordManagement';
import GeneratePassword from './components/DB_Password_Management/GeneratePassword';
import AddPassword from './components/DB_Password_Management/AddPassword';
import Constants from './components/Constants';
import ViewPassword from './components/DB_Password_Management/ViewPassword';
import Profile from './components/DB_Users/Profile';
import EditProfile from './components/DB_Users/EditProfile';
import { AuthProvider } from './contexts/Authentication';
import PrivateRoute from './components/PrivateRoute';
import MediaDownloadViewer from './components/DBCinema/screens/download/index.js';
import MovieDetailsPage from './components/DBCinema/screens/movie-details/index.js';
import BackButtonHandler from './android-app-components/BackButtonHandler.js';
import SeriesDetailsPage from './components/DBCinema/screens/series-details/SeriesDetailsPage.js';
import CssBaseline from '@mui/material/CssBaseline';
import { Box, createTheme, ThemeProvider, Typography } from '@mui/material';
import { StatusBar } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';
import { CINEMA_PAGE_TILES } from './components/DBCinema/components/CinemaTiles.js';

// Import CinemaPage components correctly
import CinemaPage from './components/DBCinema/screens/CinemaPage/CinemaPage.js';
import { CategoryProvider } from './components/DBCinema/navbar/CategoryContext.js';
import FlmngrStandalone from './components/DB_Admin_Tools/FileExplorer/FlmngrStandalone.js';

// Lazy load heavy components for better performance
const LazyAdminTools = lazy(() => import('./components/DB_Admin_Tools/AdminPage/AdminPage.js'));
const LazyMediaDownloadViewer = lazy(() => import('./components/DBCinema/screens/download/index.js'));
const LazyMovieDetailsPage = lazy(() => import('./components/DBCinema/screens/movie-details/index.js'));
const LazySeriesDetailsPage = lazy(() => import('./components/DBCinema/screens/series-details/SeriesDetailsPage.js'));

// Lazy load cinema pages to avoid circular dependencies
const LazyCinemaPage = lazy(() => import('./components/DBCinema/screens/CinemaPage/CinemaPage.js'));

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

// Simple CinemaPage wrapper to avoid import issues
const CinemaPageWrapper = ({ tilesConfig, showTopFade, pageTitle, showCover = true }) => (
  <LazyCinemaPage
    tilesConfig={tilesConfig}
    showTopFade={showTopFade}
    pageTitle={pageTitle}
    showCover={showCover}
  />
);

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
    {
      path: Constants.DB_CINEMA_BROWSE_ROUTE,
      element: (
        <CinemaPageWrapper
          tilesConfig={CINEMA_PAGE_TILES.BROWSE}
          showTopFade={true}
          pageTitle="Browse All"
          key="browse"
        />
      )
    },
    {
      path: Constants.DB_CINEMA_MOVIES_ROUTE,
      element: (
        <CinemaPageWrapper
          tilesConfig={CINEMA_PAGE_TILES.MOVIES}
          showTopFade={false}
          showCover={true}
          pageTitle="Movies"
          key="movies"
        />
      )
    },
    {
      path: Constants.DB_CINEMA_SERIES_ROUTE,
      element: (
        <CinemaPageWrapper
          tilesConfig={CINEMA_PAGE_TILES.SERIES}
          showTopFade={true}
          pageTitle="TV Shows"
          key="series"
        />
      )
    },
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

                    {/* Admin Routes */}
                    <Route element={<PrivateRoute allowedRoles={[Constants.ADMIN_USER_ROLE, Constants.OWNER_USER_ROLE]} />}>
                      {renderRoutes(routeConfig.admin)}
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
  );
}

export default App;