import React from 'react';
import { useNavigate } from 'react-router-dom';
import Constants from './Constants';
import { motion } from 'framer-motion';

// MUI Components
import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  Container,
  Grid,
  Typography,
  Divider
} from '@mui/material';

// Icons
import {
  WbSunny as WeatherIcon,
  VpnKey as PasswordIcon,
  Movie as CinemaIcon,
  SportsEsports as GamesIcon,
  AdminPanelSettings as AdminIcon
} from '@mui/icons-material';

const Home = () => {
  const navigate = useNavigate();

  const cardDetails = [
    {
      id: "db-weather",
      icon: <WeatherIcon fontSize="large" />,
      title: "DB Weather",
      route: Constants.DB_WEATHER_ROUTE,
      description: "Weather by city/pincode with map",
      color: '#008080'
    },
    {
      id: "db-password-manager",
      icon: <PasswordIcon fontSize="large" />,
      title: "Password Manager",
      route: Constants.DB_PASSWORD_MANAGER_ROUTE,
      description: "Secure password storage",
      color: '#006666'
    },
    {
      id: "db-cinema",
      icon: <CinemaIcon fontSize="large" />,
      title: "DB Cinema",
      route: Constants.DB_CINEMA_BROWSE_ROUTE,
      description: "Browse movies & TV shows",
      color: '#5f9ea0'
    },
    {
      id: "db-games",
      icon: <GamesIcon fontSize="large" />,
      title: "DB Games",
      route: Constants.DB_GAMES_ROUTE,
      description: "Classic browser games",
      color: '#20b2aa'
    },
    {
      id: "db-admin-tools",
      icon: <AdminIcon fontSize="large" />,
      title: "Admin Tools",
      route: Constants.DB_ADMIN_TOOLS_ROUTE,
      description: "System management",
      color: '#008b8b'
    }
  ];

  const handleCardClick = (card) => {
    document.title = card.title;
    navigate(card.route);
  };

  // Animation variants
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { y: 20, opacity: 0 },
    show: {
      y: 0,
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 100
      }
    },
    hover: {
      scale: 1.03,
      transition: { duration: 0.2 }
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        backgroundImage: 'url(/your-background-image.jpg)', // Add your background image path
        backgroundSize: 'cover',
        backgroundAttachment: 'fixed',
        pt: 4,
        pb: 8
      }}
    >
      <Container maxWidth="lg">
        <Box
          sx={{
            backgroundColor: 'rgba(255, 255, 255, 0.85)', // Dark semi-transparent
            borderRadius: 4,
            p: 4,
            backdropFilter: 'blur(4px)'
          }}
        >
          <motion.div
            initial="hidden"
            animate="show"
            variants={container}
          >
            {/* Header */}
            <Box textAlign="center" mb={4}>
              <Typography 
                variant="h3" 
                component="h1"
                color="#008080"
                fontWeight="bold"
                gutterBottom
              >
                DB World Portal
              </Typography>
              <Typography variant="subtitle1" color="text.secondary">
                Your gateway to digital services
              </Typography>
              <Divider sx={{ my: 3, bgcolor: '#008080' }} />
            </Box>

            {/* Cards Grid - Responsive layout */}
            <Grid container spacing={3} justifyContent="center">
              {cardDetails.map((card) => (
                <Grid 
                  item 
                  key={card.id}
                  xs={12}   // Full width on mobile
                  sm={6}    // 2 per row on small tablets
                  md={3}    // 3 per row on medium screens
                  lg={2.4}  // 5 per row on large screens
                  sx={{
                    display: 'flex',
                    // justifyContent: 'center'
                  }}
                >
                  <motion.div
                    variants={item}
                    whileHover="hover"
                    style={{ width: '100%', minWidth: '250px', maxWidth: '300px' }}
                  >
                    <Card
                      sx={{
                        height: '100%',
                        bgcolor: 'rgba(255, 255, 255, 0.7)',
                        // maxWidthwidth: '100%',
                        border: '1px solid #008080',
                        transition: 'all 0.3s ease',
                        '&:hover': {
                          borderColor: '#00b3b3',
                          boxShadow: '0 4px 20px rgba(0, 179, 179, 0.3)'
                        }
                      }}
                    >
                      <CardActionArea
                        onClick={() => handleCardClick(card)}
                        sx={{
                          height: '100%',
                          p: 2,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          textAlign: 'center'
                        }}
                      >
                        <Box
                          sx={{
                            width: 60,
                            height: 60,
                            borderRadius: '50%',
                            bgcolor: `${card.color}30`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            mb: 2
                          }}
                        >
                          {React.cloneElement(card.icon, {
                            sx: { color: card.color }
                          })}
                        </Box>
                        <CardContent sx={{ p: 0 }}>
                          <Typography 
                            variant="h6" 
                            gutterBottom
                            color="#008080"
                          >
                            {card.title}
                          </Typography>
                          <Typography 
                            variant="body2" 
                            color="rgba(0,0,0,0.7)"
                            sx={{
                              fontSize: '0.8rem',
                              lineHeight: 1.3
                            }}
                          >
                            {card.description}
                          </Typography>
                        </CardContent>
                      </CardActionArea>
                    </Card>
                  </motion.div>
                </Grid>
              ))}
            </Grid>
          </motion.div>
        </Box>
      </Container>
    </Box>
  );
};

export default Home;