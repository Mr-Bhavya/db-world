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
import Authentication from './contexts/Authentication';
import PrivateRoute from './components/PrivateRoute';
import MainPage from './components//DBCinema/screens/mainPage/index.js'
import MoviesPage from './components//DBCinema/screens/movies/index.js'
import SeriesPage from './components//DBCinema/screens/series/index.js'
import DownloadPage from './components/DBCinema/screens/download/index.js';
import MovieDetailsPage from './components/DBCinema/screens/movie-details/index.js';
import BackButtonHandler from './android-app-components/BackButtonHandler.js';
import SeriesDetailsPage from './components/DBCinema/screens/series-details/SeriesDetailsPage.js';

function App() {

  // const loginReducer = useSelector(state => state.loginReducer);
  // const userReducer = useSelector(state => state.userReducer);
  // const [userData, setUserData] = useState({});
  // const [loader, setLoader] = useState(false);
  const [matches, setMatches] = useState(
    window.matchMedia("(min-width: 900px)").matches
  )

  useEffect(() => {
    window
      .matchMedia("(min-width: 900px)")
      .addEventListener('change', e => setMatches(e.matches));
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
          <Route path={Constants.DB_CINEMA_BROWSE_ROUTE} element={<MainPage />} />
          <Route path={Constants.DB_CINEMA_MOVIES_ROUTE} element={<MoviesPage />} />
          <Route path={Constants.DB_CINEMA_SERIES_ROUTE} element={<SeriesPage />} />
          <Route path={Constants.DB_DONWLOAD_RECORD_ROUTE} element={<DownloadPage />} />
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
      <Authentication.AuthProvider>
        <Router>
          {app}
        </Router>
      </Authentication.AuthProvider>
  )
}

export default App;