import React, { useEffect, useState } from 'react';
import Header from './components/Header';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, redirect } from "react-router-dom";
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
import AdminTools from './components/DB_Admin_Tools/AdminTools';
import ViewPassword from './components/DB_Password_Management/ViewPassword';
import Profile from './components/DB_Users/Profile';
import EditProfile from './components/DB_Users/EditProfile';
import { AuthProvider } from './contexts/Authentication';
import PrivateRoute from './components/PrivateRoute';
import MediaDownloadViewer from './components/DBCinema/screens/download/index.js';
import MovieDetailsPage from './components/DBCinema/screens/movie-details/index.js';
import BackButtonHandler from './android-app-components/BackButtonHandler.js';
import SeriesDetailsPage from './components/DBCinema/screens/series-details/SeriesDetailsPage.js';

// import { createTheme, ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { createTheme, ThemeProvider } from '@mui/material';
import { StatusBar } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';
import { CINEMA_PAGE_TILES } from './components/DBCinema/components/CinemaTiles.js';
import { CinemaPageWithDefaults } from './components/DBCinema/screens/CinemaPage/CinemaPage.js';

const lightTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#008080', // Teal
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
  }
});

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#008080', // Teal
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
  }
});

function App() {

  const [matches, setMatches] = useState(
    window.matchMedia("(min-width: 900px)").matches
  )
  const [darkMode, setDarkMode] = useState(true);


  useEffect(() => {
    window
      .matchMedia("(min-width: 900px)")
      .addEventListener('change', e => setMatches(e.matches));
    if (Capacitor.isNativePlatform()) {
      StatusBar.hide();
    }
  }, []);


  var app =
    <div>

      <BackButtonHandler />

      <Header />

      <Routes>
        {/* Public Routes */}
        <Route exact path="/" element={<Navigate to={Constants.DB_WORLD_HOME_ROUTE} />} />
        <Route children path={Constants.DB_WORLD_HOME_ROUTE} element={<Home />} />
        <Route path={Constants.LOGIN_ROUTE} element={<Login />} />
        <Route path={Constants.DB_WEATHER_ROUTE} element={<Weather />} />
        <Route path={Constants.REGISTRATION_ROUTE} element={<Registration />} />
        <Route path={Constants.DB_GAMES_ROUTE} element={<TicTacToe />} />
        <Route exact path={Constants.DB_PASSWORD_MANAGER_ROUTE} element={<PasswordManagment />} />
        <Route path="*" element={<ErrorPage />} />

        {/* Protected Routes */}
        <Route element={<PrivateRoute allowedRoles={[Constants.VIEWER_USER_ROLE, Constants.ADMIN_USER_ROLE, Constants.OWNER_USER_ROLE]} />}>
          <Route exact path={Constants.DB_CINEMA_ROUTE} element={<Navigate to={Constants.DB_CINEMA_BROWSE_ROUTE} />} />
          <Route path={Constants.DB_CINEMA_BROWSE_ROUTE}
            element={
              <CinemaPageWithDefaults
                tilesConfig={CINEMA_PAGE_TILES.BROWSE}
                showTopFade={true}
                pageTitle="Browse All"
                key="browse"
              />
            }
          />
          <Route path={Constants.DB_CINEMA_MOVIES_ROUTE}
            element={
              <CinemaPageWithDefaults
                tilesConfig={CINEMA_PAGE_TILES.MOVIES}
                showTopFade={false}
                showCover={true}
                pageTitle="Movies"
                key="movies"
              />
            }
          />
          <Route path={Constants.DB_CINEMA_SERIES_ROUTE}
            element={
              <CinemaPageWithDefaults
                tilesConfig={CINEMA_PAGE_TILES.SERIES}
                showTopFade={true}
                pageTitle="TV Shows"
                key="series"
              />
            }
          />
          <Route path={Constants.DB_DONWLOAD_RECORD_ROUTE} element={<MediaDownloadViewer />} />
          <Route path={Constants.DB_ADD_PASSWORD_ROUTE} element={<AddPassword />} />
          <Route path={Constants.DB_GENERATE_PASSWORD_ROUTE} element={<GeneratePassword />} />
          <Route path={Constants.DB_VIEW_PASSWORD_ROUTE} element={<ViewPassword />} />
          <Route path={Constants.EDIT_USER_PROFILE_ROUTE} element={<EditProfile />} />
          <Route path={Constants.DB_MOVIE_DETIALS_ROUTE} element={<MovieDetailsPage />} />
          <Route path={Constants.DB_SERIES_DETIALS_ROUTE} element={<SeriesDetailsPage />} />
          <Route path={Constants.USER_PROFILE_ROUTE} element={<Profile />} />
          <Route path={Constants.LOGOUT_ROUTE} element={<LogOut />} />
        </Route>

        {/* Protected Routes for only admin and owner */}
        <Route element={<PrivateRoute allowedRoles={[Constants.ADMIN_USER_ROLE, Constants.OWNER_USER_ROLE]} />}>
          <Route path={Constants.DB_ADMIN_TOOLS_ROUTE} element={<AdminTools />} />
        </Route>

      </Routes>




    </div>

  return (
    <AuthProvider>
      <Router>
        <ThemeProvider theme={darkMode ? darkTheme : lightTheme}>
          <CssBaseline />
          {app}
        </ThemeProvider>
      </Router>
    </AuthProvider>
  )
}

export default App;