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
  Slide,
  Chip,
  Badge,
  alpha,
  Container,
  Tooltip,
  Collapse
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
  Menu as MenuIcon,
  Notifications as NotificationsIcon,
  Settings as SettingsIcon,
  Dashboard as DashboardIcon,
  KeyboardArrowDown
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
  const isSmallMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const { auth } = useAuth();
  const isLoggedIn = auth?.isAuthenticated;
  const userData = auth?.user || null;
  const [accountOpen, setAccountOpen] = useState(false);

  const navItems = [
    {
      id: "db-world",
      title: "DB World",
      icon: <HomeIcon />,
      route: Constants.DB_WORLD_HOME_ROUTE,
      visible: true,
      color: "#00bfa5"
    },
    {
      id: "db-weather",
      title: "Weather & Time",
      icon: <WeatherIcon />,
      route: Constants.DB_WEATHER_ROUTE,
      visible: isLoggedIn,
      color: "#4fc3f7"
    },
    {
      id: "db-password-manager",
      title: "Password Manager",
      icon: <PasswordIcon />,
      route: Constants.DB_PASSWORD_MANAGER_ROUTE,
      visible: isLoggedIn,
      color: "#ffb74d"
    },
    {
      id: "db-cinema",
      title: "DB Cinema",
      icon: <CinemaIcon />,
      route: Constants.DB_CINEMA_BROWSE_ROUTE,
      visible: isLoggedIn,
      color: "#ba68c8"
    },
    {
      id: "db-games",
      title: "Games",
      icon: <GamesIcon />,
      route: Constants.DB_GAMES_ROUTE,
      visible: isLoggedIn,
      color: "#4db6ac"
    }
  ];

  const profileItems = [
    {
      id: "profile",
      title: "My Profile",
      icon: <PersonIcon />,
      route: Constants.USER_PROFILE_ROUTE,
      visible: true,
      color: "#00bfa5"
    },
    {
      id: "admin-tools",
      title: "Admin Tools",
      icon: <AdminIcon />,
      route: Constants.DB_ADMIN_TOOLS_ROUTE,
      visible: auth?.role === Constants.OWNER_USER_ROLE || auth?.role === Constants.ADMIN_USER_ROLE,
      color: "#f06292"
    },
    {
      id: "logout",
      title: "Logout",
      icon: <LogoutIcon />,
      route: Constants.LOGOUT_ROUTE,
      visible: true,
      color: "#ef5350"
    }
  ];

  const guestItems = [
    {
      id: "home",
      title: "Home",
      icon: <HomeIcon />,
      route: Constants.DB_WORLD_HOME_ROUTE,
      visible: true,
      color: "#00bfa5"
    },
    {
      id: "register",
      title: "Registration",
      icon: <RegisterIcon />,
      route: Constants.REGISTRATION_ROUTE,
      visible: true,
      color: "#7986cb"
    },
    {
      id: "login",
      title: "Login",
      icon: <LockIcon />,
      route: Constants.LOGIN_ROUTE,
      visible: true,
      color: "#4db6ac"
    }
  ];

  const handleProfileMenuOpen = (event) => setAnchorEl(event.currentTarget);
  const handleMenuClose = () => setAnchorEl(null);
  const toggleMobileMenu = () => setMobileMenuOpen(!mobileMenuOpen);
  const handleNotificationsOpen = (event) => setNotificationsOpen(event.currentTarget);
  const handleNotificationsClose = () => setNotificationsOpen(false);

  const getCurrentTitle = () => {
    const currentItem = [...navItems, ...profileItems, ...guestItems].find(item => item.route === location.pathname);
    return currentItem?.title || "DB World";
  };

  const getInitials = (name) => {
    return name ? name.charAt(0).toUpperCase() : <PersonIcon />;
  };

  useEffect(() => {
    setLoading(false);
  }, [auth, location.pathname]);

  if (location.pathname.includes(Constants.DB_CINEMA_ROUTE)) return null;

  const containerVariants = {
    hidden: { opacity: 0, y: -50 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: "spring",
        stiffness: 100,
        damping: 20
      }
    }
  };

  const itemVariants = {
    hidden: { y: -20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 100
      }
    },
    hover: {
      scale: 1.05,
      transition: {
        type: "spring",
        stiffness: 400,
        damping: 10
      }
    },
    tap: {
      scale: 0.95
    }
  };

  return (
    <>
      <Slide direction="down" in={true} mountOnEnter unmountOnExit>
        <AppBar
          position="sticky"
          sx={{
            background: `linear-gradient(135deg, ${alpha('#121212', 0.95)} 0%, ${alpha('#1a1a1a', 0.95)} 100%)`,
            backdropFilter: 'blur(20px)',
            borderBottom: `1px solid ${alpha('#00bfa5', 0.2)}`,
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
          }}
        >
          <Container maxWidth="xl">
            <Toolbar sx={{ py: 1 }}>
              {/* Logo and Brand */}
              <motion.div
                variants={itemVariants}
                initial="hidden"
                animate="visible"
                whileHover="hover"
                whileTap="tap"
              >
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    mr: 3,
                    cursor: 'pointer'
                  }}
                  onClick={() => navigate(Constants.DB_WORLD_HOME_ROUTE)}
                >
                  <Avatar
                    src={db_world_icon}
                    alt="DB World Logo"
                    sx={{
                      bgcolor: '#00bfa5',
                      width: isSmallMobile ? 40 : 50,
                      height: isSmallMobile ? 40 : 50,
                      mr: 2,
                      border: `2px solid ${alpha('#00bfa5', 0.3)}`,
                      boxShadow: '0 4px 20px rgba(0,191,165,0.3)'
                    }}
                  />
                  <Typography
                    variant={isSmallMobile ? "h6" : "h5"}
                    noWrap
                    sx={{
                      fontWeight: 'bold',
                      background: 'linear-gradient(135deg, #00bfa5 0%, #4db6ac 100%)',
                      backgroundClip: 'text',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent'
                    }}
                  >
                    {getCurrentTitle()}
                  </Typography>
                </Box>
              </motion.div>

              {/* Desktop Navigation */}
              {!isMobile && (
                <Box sx={{ flexGrow: 1, display: 'flex', ml: 3, gap: 1 }}>
                  <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    style={{ display: 'flex', gap: 1 }}
                  >
                    {(isLoggedIn ? navItems : guestItems)
                      .filter(item => item.visible)
                      .map((item, index) => (
                        <motion.div
                          key={item.id}
                          variants={itemVariants}
                          custom={index}
                          whileHover="hover"
                          whileTap="tap"
                        >
                          <Chip
                            icon={item.icon}
                            label={item.title}
                            component={Link}
                            to={item.route}
                            clickable
                            sx={{
                              mx: 0.5,
                              color: location.pathname === item.route ? 'white' : '#e0f2f1',
                              background: location.pathname === item.route
                                ? `linear-gradient(135deg, ${item.color} 0%, ${alpha(item.color, 0.7)} 100%)`
                                : alpha('#263238', 0.6),
                              border: `1px solid ${alpha(item.color, location.pathname === item.route ? 0.8 : 0.2)}`,
                              backdropFilter: 'blur(10px)',
                              fontWeight: 600,
                              '&:hover': {
                                background: `linear-gradient(135deg, ${alpha(item.color, 0.8)} 0%, ${alpha(item.color, 0.4)} 100%)`,
                                transform: 'translateY(-1px)',
                                boxShadow: `0 4px 20px ${alpha(item.color, 0.3)}`
                              },
                              transition: 'all 0.3s ease',
                            }}
                            onClick={() => document.title = item.route === Constants.DB_WORLD_HOME_ROUTE ? item.title : `DB World | ${item.title}`}
                          />
                        </motion.div>
                      ))}
                  </motion.div>
                </Box>
              )}

              {/* User Section */}
              {isLoggedIn && !isMobile && (
                <motion.div
                  variants={itemVariants}
                  initial="hidden"
                  animate="visible"
                  style={{ display: 'flex', alignItems: 'center', gap: 1 }}
                >
                  {/* Notifications */}
                  <Tooltip title="Notifications">
                    <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                      <IconButton
                        onClick={handleNotificationsOpen}
                        sx={{
                          color: '#e0f2f1',
                          background: alpha('#00bfa5', 0.1),
                          '&:hover': {
                            background: alpha('#00bfa5', 0.2),
                            color: '#00bfa5'
                          }
                        }}
                      >
                        <Badge badgeContent={3} color="error">
                          <NotificationsIcon />
                        </Badge>
                      </IconButton>
                    </motion.div>
                  </Tooltip>

                  {/* Profile Menu */}
                  <Tooltip title="Account settings">
                    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                      <IconButton
                        onClick={handleProfileMenuOpen}
                        sx={{
                          ml: 1,
                          borderRadius: '8px', // ✅ Change from circle to rounded rectangle
                          padding: '6px 10px', // ✅ Adds nice shape
                          '&:hover': {
                            background: `linear-gradient(135deg, ${alpha('#00bfa5', 0.3)} 0%, ${alpha('#4db6ac', 0.3)} 100%)`,
                            borderColor: alpha('#00bfa5', 0.5)
                          }
                        }}
                      >
                        <Avatar
                          sx={{
                            bgcolor: '#00bfa5',
                            width: 36,
                            height: 36,
                            fontSize: '1rem',
                            fontWeight: 'bold'
                          }}
                        >
                          {getInitials(userData?.name)}
                        </Avatar>
                        {!isSmallMobile && (
                          <Typography variant="body2" sx={{ ml: 1, color: '#e0f2f1', fontWeight: 600 }}>
                            {userData?.name}
                          </Typography>
                        )}
                      </IconButton>
                    </motion.div>
                  </Tooltip>
                </motion.div>
              )}

              {/* Mobile Menu Button */}
              {isMobile && (
                <motion.div
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  style={{ marginLeft: 'auto' }}
                >
                  <IconButton
                    color="inherit"
                    onClick={toggleMobileMenu}
                    sx={{
                      background: alpha('#00bfa5', 0.1),
                      '&:hover': {
                        background: alpha('#00bfa5', 0.2),
                        color: '#00bfa5'
                      }
                    }}
                  >
                    <MenuIcon />
                  </IconButton>
                </motion.div>
              )}
            </Toolbar>
          </Container>
        </AppBar>
      </Slide>

      {/* Profile Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        PaperProps={{
          elevation: 8,
          sx: {
            bgcolor: alpha('#1e1e1e', 0.95),
            backdropFilter: 'blur(20px)',
            color: '#e0f2f1',
            mt: 1.5,
            border: `1px solid ${alpha('#00bfa5', 0.2)}`,
            borderRadius: 3,
            minWidth: 200,
            '& .MuiMenuItem-root': {
              py: 1.5,
              '&:hover': {
                bgcolor: alpha('#00bfa5', 0.1),
                color: '#00bfa5'
              }
            }
          }
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        {profileItems.filter(item => item.visible).map((item, index) => (
          <motion.div
            key={item.id}
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: index * 0.1 }}
          >
            <MenuItem
              component={Link}
              to={item.route}
              onClick={handleMenuClose}
              sx={{
                borderLeft: `3px solid ${item.color}`,
                ml: 1,
                mr: 1,
                borderRadius: 1
              }}
            >
              <Box sx={{ color: item.color, mr: 2 }}>
                {item.icon}
              </Box>
              <Typography variant="body2" fontWeight={500}>
                {item.title}
              </Typography>
            </MenuItem>
          </motion.div>
        ))}
      </Menu>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobile && mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            style={{ overflow: 'hidden' }}
          >
            <Box
              sx={{
                bgcolor: alpha('#1c1c1c', 0.98),
                backdropFilter: 'blur(20px)',
                borderBottom: `1px solid ${alpha('#00bfa5', 0.2)}`,
                boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
              }}
            >
              {/* Navigation Items */}
              {(isLoggedIn ? navItems : guestItems)
                .filter(item => item.visible)
                .map((item, index) => (
                  <motion.div
                    key={item.id}
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: index * 0.1 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <MenuItem
                      component={Link}
                      to={item.route}
                      selected={location.pathname === item.route}
                      onClick={() => {
                        document.title =
                          item.route === Constants.DB_WORLD_HOME_ROUTE
                            ? item.title
                            : `DB World | ${item.title}`;
                        setMobileMenuOpen(false);
                      }}
                      sx={{
                        borderLeft:
                          location.pathname === item.route
                            ? `4px solid ${item.color}`
                            : 'none',
                        color:
                          location.pathname === item.route
                            ? item.color
                            : '#e0f2f1',
                        background:
                          location.pathname === item.route
                            ? alpha(item.color, 0.1)
                            : 'transparent',
                        py: 2,
                        '&:hover': {
                          backgroundColor: alpha(item.color, 0.15),
                          color: item.color
                        }
                      }}
                    >
                      <Box sx={{ color: item.color, mr: 2 }}>
                        {item.icon}
                      </Box>
                      <Typography variant="body1" fontWeight={500}>
                        {item.title}
                      </Typography>
                    </MenuItem>
                  </motion.div>
                ))}

              {/* Collapsible Account Section */}
              {/* User Info and Profile Actions */}
              {/* Collapsible User Section */}
              {isLoggedIn && (
                <>
                  <Divider sx={{ bgcolor: alpha('#00bfa5', 0.2), my: 1 }} />

                  {/* User Header (click to expand/collapse) */}
                  <Box
                    onClick={() => setAccountOpen((prev) => !prev)}
                    sx={{
                      p: 2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      '&:hover': {
                        backgroundColor: alpha('#00bfa5', 0.08)
                      },
                      transition: 'all 0.3s ease'
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Avatar
                        sx={{
                          bgcolor: '#00bfa5',
                          width: 48,
                          height: 48,
                          fontSize: '1.2rem',
                          fontWeight: 'bold',
                          border: `2px solid ${alpha('#00bfa5', 0.3)}`,
                          boxShadow: `0 0 10px ${alpha('#00bfa5', 0.4)}`
                        }}
                      >
                        {getInitials(userData?.name)}
                      </Avatar>
                      <Box>
                        <Typography
                          variant="body1"
                          fontWeight="bold"
                          color="#e0f2f1"
                          noWrap
                          sx={{ maxWidth: 160 }}
                        >
                          {userData?.name}
                        </Typography>
                        <Typography
                          variant="caption"
                          color="#90a4ae"
                          noWrap
                          sx={{ maxWidth: 160 }}
                        >
                          {userData?.email}
                        </Typography>
                      </Box>
                    </Box>

                    <KeyboardArrowDown
                      sx={{
                        color: '#00bfa5',
                        transform: accountOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.3s ease'
                      }}
                    />
                  </Box>

                  {/* Collapsible Actions */}
                  <Collapse in={accountOpen} timeout="auto" unmountOnExit>
                    <Box sx={{ pb: 1 }}>
                      {profileItems
                        .filter((item) => item.visible)
                        .map((item, index) => (
                          <motion.div
                            key={item.id}
                            initial={{ x: -10, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ delay: index * 0.05 }}
                          >
                            <MenuItem
                              component={Link}
                              to={item.route}
                              onClick={() => {
                                setMobileMenuOpen(false);
                                setAccountOpen(false);
                                handleMenuClose();
                              }}
                              sx={{
                                pl: 6,
                                py: 1.6,
                                color:
                                  item.id === 'logout'
                                    ? '#ef5350'
                                    : '#e0f2f1',
                                '&:hover': {
                                  backgroundColor: alpha(
                                    item.id === 'logout' ? '#ef5350' : item.color,
                                    0.15
                                  ),
                                  color: item.id === 'logout' ? '#ef5350' : item.color
                                },
                                transition: 'all 0.25s ease'
                              }}
                            >
                              <Box
                                sx={{
                                  color:
                                    item.id === 'logout'
                                      ? '#ef5350'
                                      : item.color,
                                  mr: 2
                                }}
                              >
                                {item.icon}
                              </Box>
                              <Typography variant="body1" fontWeight={500}>
                                {item.title}
                              </Typography>
                            </MenuItem>
                          </motion.div>
                        ))}
                    </Box>
                  </Collapse>

                  <Divider sx={{ bgcolor: alpha('#00bfa5', 0.2), my: 1 }} />
                </>
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