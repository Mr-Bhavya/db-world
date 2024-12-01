import React, { useEffect, useState } from 'react';
// import './App.css';
import Header from './components/Header';
import Footer from './components/Footer';
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import MovieHome from './components/DB_Movies/MovieHome';
import Login from './components/Login';
import LogOut from './components/LogOut';
import Registration from './components/DB_Users/registration';
import Weather from './components/DB_Weather/weather';
import TicTacToe from './components/DB_Games/TicTacToe';
import SeriesDetails from './components/DB_Movies/Series/SeriesDetails';
import Home from './components/Home';
// import { useSelector } from 'react-redux';
import ErrorPage from './components/ErrorPage';
import Search from './components/DB_Movies/Search/Search';
import MovieDetails from './components/DB_Movies/Movies/MovieDetails';
import MovieDetailsDesktop from './components/DB_Movies/Movies/MovieDetailsDesktop';
// import LoadingSpinner from './components/LoadingSpinner';
import PasswordManagment from './components/DB_Password_Management/PasswordManagement';
import GeneratePassword from './components/DB_Password_Management/GeneratePassword';
import AddPassword from './components/DB_Password_Management/AddPassword';
import Constants from './components/Constants';
import AdminTools from './components/DB_Admin_Tools/AdminTools';
import ViewPassword from './components/DB_Password_Management/ViewPassword';
import Profile from './components/DB_Users/Profile';
import EditProfile from './components/DB_Users/EditProfile';
import AddRecord from './components/DB_Admin_Tools/AddRecord';
import EditRecord from './components/DB_Admin_Tools/EditRecord';
import Authentication from './contexts/Authentication';
import PrivateRoute from './components/PrivateRoute';

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
      {/* <PrivateRoute><Header /></PrivateRoute> */}
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
          <Route exact path={Constants.DB_MOVIES_ROUTE} element={<MovieHome />} />
          <Route path={Constants.DB_ADD_PASSWORD_ROUTE} element={<AddPassword />} />
          <Route path={Constants.DB_GENERATE_PASSWORD_ROUTE} element={<GeneratePassword />} />
          <Route path={Constants.DB_VIEW_PASSWORD_ROUTE} element={<ViewPassword />} />
          <Route path={Constants.EDIT_USER_PROFILE_ROUTE} element={<EditProfile />} />
          <Route path="/search" element={<Search />} />
          <Route path={Constants.DB_MOVIE_DETIALS_ROUTE} element={!matches && <MovieDetails /> || <MovieDetailsDesktop />} />
          <Route path={Constants.DB_SERIES_DETIALS_ROUTE} element={<SeriesDetails />} />
          <Route path={Constants.USER_PROFILE_ROUTE} element={<Profile />} />
          <Route path={Constants.LOGOUT_ROUTE} element={<LogOut />} />
        </Route>

        {/* Protected Routes for only admin and owner */}
        <Route element={<PrivateRoute allowedRoles={[Constants.ADMIN_USER_ROLE, Constants.OWNER_USER_ROLE]} />}>
          <Route path={Constants.DB_ADMIN_TOOLS_ROUTE} element={<AdminTools />} />
          <Route path={Constants.ADD_RECORD_ROUTE} element={<AddRecord />} />
          <Route path={Constants.EDIT_RECORD_ROUTE} element={<EditRecord />} />
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