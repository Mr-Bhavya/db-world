import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Constants from './Constants';
import { motion, AnimatePresence } from 'framer-motion';

// MUI Components
import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  Container,
  Grid,
  Typography,
  Divider,
  useTheme,
  useMediaQuery,
  alpha,
  Chip,
  Fade,
  Zoom,
  IconButton,
  Tooltip
} from '@mui/material';

// Icons
import {
  WbSunny as WeatherIcon,
  VpnKey as PasswordIcon,
  Movie as CinemaIcon,
  SportsEsports as GamesIcon,
  AdminPanelSettings as AdminIcon,
  RocketLaunch as RocketIcon,
  Search as SearchIcon,
  Favorite as FavoriteIcon,
  TrendingUp as TrendingIcon,
  Star as StarIcon
} from '@mui/icons-material';

const Home = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const isMediumScreen = useMediaQuery(theme.breakpoints.between('sm', 'md'));
  const [hoveredCard, setHoveredCard] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [recentApps, setRecentApps] = useState([]);

  // Gradient backgrounds for different times
  const backgrounds = [
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    'linear-gradient(135deg, #fa709a 0%, #fee140 100%)'
  ];

  const [currentBackground, setCurrentBackground] = useState(0);

  // Rotate background every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentBackground((prev) => (prev + 1) % backgrounds.length);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const cardDetails = [
    {
      id: "db-weather",
      icon: <WeatherIcon />,
      title: "DB Weather",
      route: Constants.DB_WEATHER_ROUTE,
      description: "Real-time weather forecasts with interactive maps",
      color: '#008080',
      category: 'Tools',
      popularity: 95,
      isNew: false,
      isFeatured: true
    },
    {
      id: "db-password-manager",
      icon: <PasswordIcon />,
      title: "Password Manager",
      route: Constants.DB_PASSWORD_MANAGER_ROUTE,
      description: "Military-grade encrypted password storage",
      color: '#006666',
      category: 'Security',
      popularity: 88,
      isNew: true,
      isFeatured: false
    },
    {
      id: "db-cinema",
      icon: <CinemaIcon />,
      title: "DB Cinema",
      route: Constants.DB_CINEMA_BROWSE_ROUTE,
      description: "Stream movies & TV shows in 4K quality",
      color: '#5f9ea0',
      category: 'Entertainment',
      popularity: 92,
      isNew: false,
      isFeatured: true
    },
    {
      id: "db-games",
      icon: <GamesIcon />,
      title: "DB Games",
      route: Constants.DB_GAMES_ROUTE,
      description: "Premium gaming experience with cloud saves",
      color: '#20b2aa',
      category: 'Gaming',
      popularity: 78,
      isNew: true,
      isFeatured: false
    },
    {
      id: "db-admin-tools",
      icon: <AdminIcon />,
      title: "Admin Tools",
      route: Constants.DB_ADMIN_TOOLS_ROUTE,
      description: "Advanced system management & analytics",
      color: '#008b8b',
      category: 'Admin',
      popularity: 85,
      isNew: false,
      isFeatured: false
    }
  ];

  const filteredCards = cardDetails.filter(card =>
    card.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    card.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    card.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCardClick = (card) => {
    document.title = card.title;
    // Add to recent apps
    setRecentApps(prev => {
      const filtered = prev.filter(app => app.id !== card.id);
      return [card, ...filtered].slice(0, 3);
    });
    navigate(card.route);
  };

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.3
      }
    }
  };

  const itemVariants = {
    hidden: { 
      y: 60, 
      opacity: 0,
      scale: 0.8
    },
    show: {
      y: 0,
      opacity: 1,
      scale: 1,
      transition: {
        type: "spring",
        stiffness: 100,
        damping: 15
      }
    },
    hover: {
      y: -8,
      scale: 1.05,
      transition: { 
        type: "spring", 
        stiffness: 400, 
        damping: 25 
      }
    },
    tap: {
      scale: 0.95,
      transition: { duration: 0.1 }
    }
  };

  const backgroundVariants = {
    enter: { opacity: 1 },
    exit: { opacity: 0 }
  };

  const StatsCard = ({ icon, value, label }) => (
    <motion.div
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <Card
        sx={{
          background: alpha(theme.palette.background.paper, 0.6),
          backdropFilter: 'blur(20px)',
          border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
          borderRadius: 3,
          p: 2,
          textAlign: 'center',
          minWidth: 100
        }}
      >
        <Box sx={{ color: 'primary.main', mb: 1 }}>
          {icon}
        </Box>
        <Typography variant="h6" fontWeight="bold" color="white">
          {value}
        </Typography>
        <Typography variant="caption" color="grey.300">
          {label}
        </Typography>
      </Card>
    </motion.div>
  );

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: backgrounds[currentBackground],
        backgroundSize: 'cover',
        backgroundAttachment: 'fixed',
        backgroundPosition: 'center',
        position: 'relative',
        overflow: 'hidden',
        pt: { xs: 2, sm: 4 },
        pb: { xs: 4, sm: 8 },
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'radial-gradient(circle at 30% 20%, rgba(120, 119, 198, 0.3) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(255, 119, 198, 0.3) 0%, transparent 50%)',
          zIndex: 0
        }
      }}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={currentBackground}
          variants={backgroundVariants}
          initial="exit"
          animate="enter"
          exit="exit"
          transition={{ duration: 1.5 }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
      </AnimatePresence>

      <Container 
        maxWidth="xl" 
        sx={{ 
          position: 'relative',
          zIndex: 1,
          px: { xs: 1, sm: 2, md: 3 }
        }}
      >
        {/* Stats Bar */}
        <Fade in timeout={1000}>
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', mb: 3, flexWrap: 'wrap' }}>
            <StatsCard icon={<RocketIcon />} value="5+" label="Apps" />
            <StatsCard icon={<TrendingIcon />} value="99.9%" label="Uptime" />
            <StatsCard icon={<FavoriteIcon />} value="4.8" label="Rating" />
            <StatsCard icon={<StarIcon />} value="1K+" label="Users" />
          </Box>
        </Fade>

        <motion.div
          initial="hidden"
          animate="show"
          variants={containerVariants}
        >
          <Box
            sx={{
              background: alpha(theme.palette.background.paper, 0.75),
              backdropFilter: 'blur(20px)',
              borderRadius: { xs: 2, sm: 4 },
              p: { xs: 2, sm: 3, md: 4 },
              border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.1)',
              mx: 'auto',
              position: 'relative',
              overflow: 'hidden',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 4,
                background: `linear-gradient(90deg, ${backgrounds[currentBackground]})`,
                zIndex: 1
              }
            }}
          >
            {/* Header */}
            <Box textAlign="center" mb={{ xs: 3, sm: 4 }}>
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
              >
                <Typography 
                  variant={isSmallScreen ? "h3" : "h2"}
                  component="h1"
                  fontWeight="bold"
                  gutterBottom
                  sx={{ 
                    fontSize: { xs: '2rem', sm: '3rem', md: '4rem' },
                    background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    textShadow: '0 4px 20px rgba(0,0,0,0.1)'
                  }}
                >
                  DB World Portal
                </Typography>
              </motion.div>
              
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                <Typography 
                  variant="h6" 
                  color="text.secondary"
                  sx={{ 
                    fontSize: { xs: '1rem', sm: '1.2rem' },
                    mb: 2
                  }}
                >
                  Your Gateway to Premium Digital Services
                </Typography>
              </motion.div>

              {/* Search Bar */}
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.6 }}
              >
                <Box
                  sx={{
                    maxWidth: 400,
                    mx: 'auto',
                    position: 'relative'
                  }}
                >
                  <SearchIcon 
                    sx={{ 
                      position: 'absolute',
                      left: 12,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'text.secondary',
                      zIndex: 1
                    }} 
                  />
                  <input
                    type="text"
                    placeholder="Search apps..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 12px 12px 40px',
                      borderRadius: 25,
                      border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                      background: alpha(theme.palette.background.paper, 0.8),
                      backdropFilter: 'blur(10px)',
                      fontSize: '1rem',
                      outline: 'none',
                      transition: 'all 0.3s ease',
                      color: 'white'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = theme.palette.primary.main;
                      e.target.style.boxShadow = `0 0 0 2px ${alpha(theme.palette.primary.main, 0.2)}`;
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = alpha(theme.palette.primary.main, 0.2);
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                </Box>
              </motion.div>

              <Divider 
                sx={{ 
                  my: { xs: 3, sm: 4 },
                  background: `linear-gradient(90deg, transparent, ${alpha(theme.palette.primary.main, 0.3)}, transparent)`,
                  height: 2
                }} 
              />
            </Box>

            {/* Cards Grid */}
            <Grid 
              container 
              spacing={{ xs: 2, sm: 3, md: 4 }}
              justifyContent="center"
              sx={{ mx: 'auto' }}
            >
              <AnimatePresence>
                {filteredCards.map((card, index) => (
                  <Grid 
                    item 
                    key={card.id}
                    xs={6}
                    sm={4}
                    md={3}
                    lg={2.4}
                    sx={{
                      display: 'flex',
                      justifyContent: 'center'
                    }}
                  >
                    <motion.div
                      variants={itemVariants}
                      whileHover="hover"
                      whileTap="tap"
                      initial="hidden"
                      animate="show"
                      exit={{ opacity: 0, scale: 0.5 }}
                      transition={{ delay: index * 0.1 }}
                      style={{ width: '100%', maxWidth: 280 }}
                      onHoverStart={() => setHoveredCard(card.id)}
                      onHoverEnd={() => setHoveredCard(null)}
                    >
                      <Card
                        sx={{
                          height: '100%',
                          background: `linear-gradient(135deg, ${alpha(card.color, 0.1)} 0%, ${alpha(theme.palette.background.paper, 0.8)} 100%)`,
                          backdropFilter: 'blur(10px)',
                          border: `1px solid ${alpha(card.color, 0.2)}`,
                          borderRadius: 4,
                          transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                          overflow: 'visible',
                          position: 'relative',
                          '&::before': {
                            content: '""',
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background: `linear-gradient(135deg, ${alpha(card.color, 0.1)} 0%, transparent 50%)`,
                            borderRadius: 4,
                            opacity: hoveredCard === card.id ? 1 : 0,
                            transition: 'opacity 0.3s ease'
                          }
                        }}
                      >
                        <CardActionArea
                          onClick={() => handleCardClick(card)}
                          sx={{
                            height: '100%',
                            p: { xs: 2, sm: 3 },
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            textAlign: 'center',
                            position: 'relative',
                            zIndex: 1
                          }}
                        >
                          {/* Badges */}
                          <Box sx={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 0.5 }}>
                            {card.isNew && (
                              <Chip
                                label="NEW"
                                size="small"
                                sx={{
                                  background: 'linear-gradient(45deg, #FF6B6B, #FF8E53)',
                                  color: 'white',
                                  fontSize: '0.6rem',
                                  height: 20,
                                  fontWeight: 'bold'
                                }}
                              />
                            )}
                            {card.isFeatured && (
                              <Chip
                                label="FEATURED"
                                size="small"
                                sx={{
                                  background: 'linear-gradient(45deg, #4ECDC4, #44A08D)',
                                  color: 'white',
                                  fontSize: '0.6rem',
                                  height: 20,
                                  fontWeight: 'bold'
                                }}
                              />
                            )}
                          </Box>

                          {/* Icon Container */}
                          <motion.div
                            whileHover={{ rotate: 360 }}
                            transition={{ duration: 0.6 }}
                          >
                            <Box
                              sx={{
                                width: { xs: 70, sm: 80 },
                                height: { xs: 70, sm: 80 },
                                borderRadius: '50%',
                                background: `linear-gradient(135deg, ${card.color}30, ${card.color}10)`,
                                border: `2px solid ${alpha(card.color, 0.3)}`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                mb: { xs: 2, sm: 3 },
                                position: 'relative',
                                '&::after': {
                                  content: '""',
                                  position: 'absolute',
                                  width: '100%',
                                  height: '100%',
                                  borderRadius: '50%',
                                  background: `radial-gradient(circle at 30% 30%, ${alpha(card.color, 0.4)} 0%, transparent 70%)`,
                                  opacity: hoveredCard === card.id ? 1 : 0,
                                  transition: 'opacity 0.3s ease'
                                }
                              }}
                            >
                              {React.cloneElement(card.icon, {
                                sx: { 
                                  color: card.color,
                                  fontSize: { xs: '2rem', sm: '2.5rem' },
                                  filter: `drop-shadow(0 4px 8px ${alpha(card.color, 0.3)})`
                                }
                              })}
                            </Box>
                          </motion.div>

                          <CardContent sx={{ p: 0, width: '100%' }}>
                            <Typography 
                              variant="h6"
                              gutterBottom
                              sx={{ 
                                fontSize: { xs: '1rem', sm: '1.1rem' },
                                fontWeight: 'bold',
                                background: `linear-gradient(135deg, ${card.color}, ${alpha(card.color, 0.8)})`,
                                backgroundClip: 'text',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent'
                              }}
                            >
                              {card.title}
                            </Typography>
                            
                            <Typography 
                              variant="body2" 
                              color="text.secondary"
                              sx={{
                                fontSize: { xs: '0.75rem', sm: '0.85rem' },
                                lineHeight: 1.4,
                                mb: 1,
                                minHeight: 40
                              }}
                            >
                              {card.description}
                            </Typography>

                            {/* Category and Popularity */}
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
                              <Chip
                                label={card.category}
                                size="small"
                                variant="outlined"
                                sx={{ 
                                  fontSize: '0.6rem',
                                  borderColor: alpha(card.color, 0.3),
                                  color: card.color
                                }}
                              />
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <FavoriteIcon sx={{ fontSize: 12, color: '#FF6B6B' }} />
                                <Typography variant="caption" color="text.secondary">
                                  {card.popularity}%
                                </Typography>
                              </Box>
                            </Box>
                          </CardContent>
                        </CardActionArea>
                      </Card>
                    </motion.div>
                  </Grid>
                ))}
              </AnimatePresence>
            </Grid>

            {/* Empty State */}
            {filteredCards.length === 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <Box textAlign="center" py={8}>
                  <SearchIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2, opacity: 0.5 }} />
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    No apps found
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Try adjusting your search terms
                  </Typography>
                </Box>
              </motion.div>
            )}
          </Box>
        </motion.div>
      </Container>
    </Box>
  );
};

export default Home;