import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  Avatar, 
  Box, 
  Button, 
  Card, 
  CardContent, 
  CircularProgress, 
  Divider, 
  Grid, 
  Paper, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableRow, 
  Typography,
  useMediaQuery,
  useTheme,
  createTheme,
  ThemeProvider
} from '@mui/material';
import { motion } from 'framer-motion';
import PersonIcon from '@mui/icons-material/Person';
import EditIcon from '@mui/icons-material/Edit';
import Constants from '../Constants';
import { getUserDetail } from '../ApiServices';

// Custom teal theme
const theme = createTheme({
  palette: {
    primary: {
      main: '#008080', // Teal
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#006666', // Darker teal
    },
    background: {
      default: '#f5f5f5',
      paper: '#ffffff',
    },
  },
});

const Profile = (props) => {
  const isMobile = useMediaQuery('(max-width:900px)');
  const navigate = useNavigate();
  const location = useLocation();
  const [userData, setUserData] = useState({});
  const [loading, setLoading] = useState(true);

  const getDetails = async () => {
    try {
      const getUserRes = await getUserDetail();
      if (getUserRes.httpStatusCode === 200) {
        const user = getUserRes.data[0];
        if (user.dob) {
          const dob = new Intl.DateTimeFormat('fr-ca', { 
            year: 'numeric', 
            month: '2-digit', 
            day: '2-digit' 
          }).format(new Date(user.dob)).split(" ")[0];
          user.dob = dob;
        }
        setUserData(user);
      } else if ([401, 403].includes(getUserRes.httpStatusCode)) {
        navigate(Constants.LOGIN_ROUTE, { state: { from: location } });
      }
    } catch (error) {
      console.error("Error fetching user details:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getDetails();
  }, []);

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        when: "beforeChildren"
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 100
      }
    }
  };

  const handleEditProfile = () => {
    navigate(Constants.EDIT_USER_PROFILE_ROUTE, {
      state: { userData }
    });
  };

  return (
    <ThemeProvider theme={theme}>
      <Box
        sx={{
          minHeight: '100vh',
        //   bgcolor: 'background.default',
          p: isMobile ? 2 : 4,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'start'
        }}
      >
        <motion.div
          initial="hidden"
          animate="visible"
          variants={containerVariants}
          style={{ width: '100%', maxWidth: '1000px' }}
        >
          <Card 
            sx={{ 
              width: '100%',
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              boxShadow: 3
            }}
          >
            {loading ? (
              <Box 
                display="flex" 
                justifyContent="center" 
                alignItems="center" 
                minHeight={300}
              >
                <CircularProgress color="primary" />
              </Box>
            ) : (
              <motion.div variants={containerVariants}>
                <CardContent sx={{ p: isMobile ? 2 : 4 }}>
                  {/* Header */}
                  <motion.div variants={itemVariants}>
                    <Typography 
                      variant="h4" 
                      component="h1" 
                      gutterBottom
                      sx={{ 
                        fontWeight: 'bold',
                        color: 'primary.main',
                        textAlign: 'center',
                        mb: 3
                      }}
                    >
                      User Profile
                    </Typography>
                  </motion.div>

                  <Divider sx={{ mb: 3, bgcolor: 'primary.main' }} />

                  <Grid container spacing={isMobile ? 2 : 4} sx={{justifyContent: 'space-evenly'}}>
                    {/* Avatar Section - Centered and responsive */}
                    <Grid item xs={12} md={6} sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <motion.div variants={itemVariants}>
                        <Avatar
                          alt={`${userData.firstName} ${userData.lastName}`}
                          sx={{ 
                            width: isMobile ? 120 : 150, 
                            height: isMobile ? 120 : 150,
                            mb: 2,
                            bgcolor: 'primary.main',
                            fontSize: isMobile ? '3rem' : '3.5rem'
                          }}
                        >
                          {userData.firstName?.charAt(0)?.toUpperCase()}{userData.lastName?.charAt(0).toUpperCase()}
                        </Avatar>
                        <Typography 
                          variant={isMobile ? "h6" : "h5"} 
                          component="h2"
                          sx={{ 
                            fontWeight: 'medium', 
                            textAlign: 'center',
                            color: 'text.primary'
                          }}
                        >
                          {userData.firstName} {userData.lastName}
                        </Typography>
                        <Typography 
                          variant="subtitle1" 
                          sx={{ 
                            textAlign: 'center',
                            color: 'primary.main',
                            fontWeight: '500'
                          }}
                        >
                          {userData?.userRole?.name}
                        </Typography>
                      </motion.div>
                    </Grid>

                    {/* Profile Details - Properly aligned and full width */}
                    <Grid item xs={12} md={6}>
                      <motion.div variants={itemVariants}>
                        <TableContainer 
                          component={Paper} 
                          sx={{ 
                            boxShadow: 'none',
                            bgcolor: 'transparent'
                          }}
                        >
                          <Table>
                            <TableBody>
                              <TableRow>
                                <TableCell sx={{ 
                                  fontWeight: 'bold', 
                                  width: '40%',
                                  color: 'primary.main'
                                }}>
                                  DOB/Age
                                </TableCell>
                                <TableCell>{userData.dob || userData.age || 'N/A'}</TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell sx={{ 
                                  fontWeight: 'bold',
                                  color: 'primary.main'
                                }}>Gender</TableCell>
                                <TableCell>{userData.gender || 'N/A'}</TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell sx={{ 
                                  fontWeight: 'bold',
                                  color: 'primary.main'
                                }}>Mobile</TableCell>
                                <TableCell>{userData.mobileNo || 'N/A'}</TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell sx={{ 
                                  fontWeight: 'bold',
                                  color: 'primary.main'
                                }}>Email</TableCell>
                                <TableCell>{userData.email || 'N/A'}</TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell sx={{ 
                                  fontWeight: 'bold',
                                  color: 'primary.main'
                                }}>Logins</TableCell>
                                <TableCell>{userData?.noOfLogin || 0}</TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </TableContainer>

                        <Box 
                          display="flex" 
                          justifyContent="center"
                          mt={4}
                        >
                          <motion.div
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            <Button
                              variant="contained"
                              color="primary"
                              startIcon={<EditIcon />}
                              onClick={handleEditProfile}
                              size="large"
                              sx={{
                                px: 4,
                                py: 1.5,
                                borderRadius: 2,
                                textTransform: 'none',
                                fontSize: '1rem'
                              }}
                            >
                              Edit Profile
                            </Button>
                          </motion.div>
                        </Box>
                      </motion.div>
                    </Grid>
                  </Grid>
                </CardContent>
              </motion.div>
            )}
          </Card>
        </motion.div>
      </Box>
    </ThemeProvider>
  );
};

export default Profile;