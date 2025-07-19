import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import db_world_icon from '../images/db_world_teal.svg';
import {
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Box,
  Menu,
  MenuItem,
  Avatar,
  Divider,
  useMediaQuery,
  useTheme,
  Slide
} from '@mui/material';
import {
  Home as HomeIcon,
  Person as PersonIcon,
  Lock as LockIcon,
  HowToReg as RegisterIcon,
  AdminPanelSettings as AdminIcon,
  ExitToApp as LogoutIcon,
  Cloud as WeatherIcon,
  Movie as CinemaIcon,
  SportsEsports as GamesIcon,
  VpnKey as PasswordIcon,
  Menu as MenuIcon
} from '@mui/icons-material';
import LoadingSpinner from './LoadingSpinner';
import Constants from './Constants';
import { getUserRole } from './ApiServices';
import { addUser } from '../redux/action/allActions';
import CommonServices from './CommonServices';
import Authentication, { useAuth } from '../contexts/Authentication';

const Header = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
//   const userData = useSelector(state => state.userReducer);
  const [loading, setLoading] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { auth } = useAuth();
  const isLoggedIn = auth?.isAuthenticated;
  const userData = auth?.user || null;

  const navItems = [
    { id: "db-world", title: "DB World", icon: <HomeIcon />, route: Constants.DB_WORLD_HOME_ROUTE, visible: true },
    { id: "db-weather", title: "Weather & Time", icon: <WeatherIcon />, route: Constants.DB_WEATHER_ROUTE, visible: isLoggedIn },
    { id: "db-password-manager", title: "Password Manager", icon: <PasswordIcon />, route: Constants.DB_PASSWORD_MANAGER_ROUTE, visible: isLoggedIn },
    { id: "db-cinema", title: "DB Cinema", icon: <CinemaIcon />, route: Constants.DB_CINEMA_BROWSE_ROUTE, visible: isLoggedIn },
    { id: "db-games", title: "Games", icon: <GamesIcon />, route: Constants.DB_GAMES_ROUTE, visible: isLoggedIn }
  ];

  const profileItems = [
    { id: "profile", title: "My Profile", icon: <PersonIcon />, route: Constants.USER_PROFILE_ROUTE, visible: true },
    { id: "admin-tools", title: "Admin Tools", icon: <AdminIcon />, route: Constants.DB_ADMIN_TOOLS_ROUTE, visible: auth?.role === Constants.OWNER_USER_ROLE || auth?.role === Constants.ADMIN_USER_ROLE },
    { id: "logout", title: "Logout", icon: <LogoutIcon />, route: Constants.LOGOUT_ROUTE, visible: true }
  ];

  const guestItems = [
    { id: "home", title: "Home", icon: <HomeIcon />, route: Constants.DB_WORLD_HOME_ROUTE, visible: true },
    { id: "register", title: "Registration", icon: <RegisterIcon />, route: Constants.REGISTRATION_ROUTE, visible: true },
    { id: "login", title: "Login", icon: <LockIcon />, route: Constants.LOGIN_ROUTE, visible: true }
  ];

  const handleProfileMenuOpen = (event) => setAnchorEl(event.currentTarget);
  const handleMenuClose = () => setAnchorEl(null);
  const toggleMobileMenu = () => setMobileMenuOpen(!mobileMenuOpen);

  const getCurrentTitle = () => {
    const currentItem = [...navItems, ...profileItems, ...guestItems].find(item => item.route === location.pathname);
    return currentItem?.title || "DB World";
  };

  useEffect(() => {
    setLoading(false);
  }, [auth, location.pathname]);

  if (location.pathname.includes(Constants.DB_CINEMA_ROUTE)) return null;

  return (
    <>
      <Slide direction="down" in={true} mountOnEnter unmountOnExit>
        <AppBar position="sticky" sx={{ bgcolor: '#121212', color: '#e0f2f1', boxShadow: 3 }}>
          <Toolbar>
            <Box sx={{ display: 'flex', alignItems: 'center', mr: 2 }}>
              <Avatar src={db_world_icon} alt="DB World Logo" sx={{ bgcolor: '#00bfa5', width: 50, height: 50, mr: 2 }} onClick={()=>navigate(Constants.DB_WORLD_HOME_ROUTE)}/>
              <Typography variant="h6" noWrap>{getCurrentTitle()}</Typography>
            </Box>

            {!isMobile && (
              <Box sx={{ flexGrow: 1, display: 'flex', ml: 3 }}>
                {(isLoggedIn ? navItems : guestItems)
                  .filter(item => item.visible)
                  .map(item => (
                    <motion.div
                      key={item.id}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <IconButton
                        component={Link}
                        to={item.route}
                        sx={{
                          mx: 1,
                          color: location.pathname === item.route ? '#00bfa5' : '#e0f2f1',
                          transition: 'all 0.3s ease',
                          '&:hover': {
                            backgroundColor: 'rgba(0,191,165,0.1)',
                            color: '#00bfa5'
                          }
                        }}
                        onClick={() => document.title = item.route === Constants.DB_WORLD_HOME_ROUTE ? item.title : `DB World | ${item.title}`}
                      >
                        {item.icon}
                        <Typography variant="body2" sx={{ ml: 1 }}>{item.title}</Typography>
                      </IconButton>
                    </motion.div>
                  ))}
              </Box>
            )}

            {isLoggedIn && !isMobile && (
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <motion.div whileHover={{ scale: 1.1 }}>
                  <IconButton onClick={handleProfileMenuOpen} color="inherit" sx={{ ml: 'auto' }}>
                    <Avatar sx={{ bgcolor: '#00bfa5' }}>{userData?.name?.charAt(0) || <PersonIcon />}</Avatar>
                    <Typography variant="body2" sx={{ ml: 1 }}>{userData?.name}</Typography>
                  </IconButton>
                </motion.div>
                <Menu
                  anchorEl={anchorEl}
                  open={Boolean(anchorEl)}
                  onClose={handleMenuClose}
                  PaperProps={{
                    elevation: 2,
                    sx: {
                      bgcolor: '#1e1e1e',
                      color: '#e0f2f1',
                      mt: 1.5,
                      '& .MuiMenuItem-root:hover': {
                        bgcolor: '#263238'
                      }
                    }
                  }}
                  transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                  anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                >
                  {profileItems.filter(item => item.visible).map(item => (
                    <motion.div key={item.id} whileHover={{ x: 5 }}>
                      <MenuItem component={Link} to={item.route} onClick={handleMenuClose}>
                        {item.icon}
                        <Typography sx={{ ml: 1 }}>{item.title}</Typography>
                      </MenuItem>
                    </motion.div>
                  ))}
                </Menu>
              </Box>
            )}

            {isMobile && (
              <IconButton edge="end" color="inherit" aria-label="menu" onClick={toggleMobileMenu} sx={{ ml: 'auto' }}>
                <MenuIcon />
              </IconButton>
            )}
          </Toolbar>
        </AppBar>
      </Slide>

      <AnimatePresence>
        {isMobile && mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            style={{ overflow: 'hidden' }}
          >
            <Box sx={{ bgcolor: '#1c1c1c', boxShadow: 3 }}>
              {(isLoggedIn ? navItems : guestItems)
                .filter(item => item.visible)
                .map(item => (
                  <motion.div key={item.id} whileTap={{ scale: 0.98 }}>
                    <MenuItem
                      component={Link}
                      to={item.route}
                      selected={location.pathname === item.route}
                      onClick={() => {
                        document.title = item.route === Constants.DB_WORLD_HOME_ROUTE ? item.title : `DB World | ${item.title}`;
                        setMobileMenuOpen(false);
                      }}
                      sx={{
                        borderLeft: location.pathname === item.route ? `4px solid #00bfa5` : 'none',
                        color: '#e0f2f1',
                        '&:hover': {
                          backgroundColor: 'rgba(0,191,165,0.1)',
                          color: '#00bfa5'
                        }
                      }}
                    >
                      {item.icon}
                      <Typography sx={{ ml: 2 }}>{item.title}</Typography>
                    </MenuItem>
                  </motion.div>
                ))}
              <Divider sx={{ bgcolor: '#37474f' }} />
              {isLoggedIn && (
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <motion.div whileHover={{ scale: 1.1 }}>
                  <IconButton onClick={handleProfileMenuOpen} color="inherit" sx={{ ml: 'auto' }}>
                    <Avatar sx={{ bgcolor: '#00bfa5' }}>{userData?.name?.charAt(0)?.toUpperCase() || <PersonIcon />}</Avatar>
                    <Typography variant="body2" sx={{ ml: 1, color: '#e0f2f1' }}>{userData?.name}</Typography>
                  </IconButton>
                </motion.div>
                <Menu
                  anchorEl={anchorEl}
                  open={Boolean(anchorEl)}
                  onClose={handleMenuClose}
                  PaperProps={{
                    elevation: 2,
                    sx: {
                      bgcolor: '#1e1e1e',
                      color: '#e0f2f1',
                      mt: 1.5,
                      '& .MuiMenuItem-root:hover': {
                        bgcolor: '#263238'
                      }
                    }
                  }}
                  transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                  anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                >
                  {profileItems.filter(item => item.visible).map(item => (
                    <motion.div key={item.id} whileHover={{ x: 5 }}>
                      <MenuItem component={Link} to={item.route} onClick={handleMenuClose}>
                        {item.icon}
                        <Typography sx={{ ml: 1 }}>{item.title}</Typography>
                      </MenuItem>
                    </motion.div>
                  ))}
                </Menu>
              </Box>
            )}
            </Box>
          </motion.div>
        )}
      </AnimatePresence>

      {loading && <LoadingSpinner />}
    </>
  );
};

export default Header;
