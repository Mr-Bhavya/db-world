import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  Box, 
  Button, 
  Card, 
  CardContent, 
  Checkbox, 
  CircularProgress, 
  Divider, 
  FormControl, 
  FormHelperText, 
  Grid, 
  InputLabel, 
  MenuItem, 
  Select, 
  TextField, 
  Typography,
  useTheme,
  createTheme,
  ThemeProvider
} from '@mui/material';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Constants from '../Constants';
import { register } from '../ApiServices';

// Custom teal theme
const theme = createTheme({
  palette: {
    primary: {
      main: '#008080', // Teal
    },
    secondary: {
      main: '#006666', // Darker teal
    },
    error: {
      main: '#d32f2f',
    },
    background: {
      default: '#f5f5f5',
    },
  },
});

const Registration = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const muiTheme = useTheme();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    gender: "",
    dob: "",
    mobileNo: "",
    email: "",
    password: "",
    agreeCheckBox: false
  });
  const [errors, setErrors] = useState({
    firstName: false,
    lastName: false,
    gender: false,
    dob: false,
    mobileNo: false,
    email: false,
    password: false,
    agreeCheckBox: false
  });

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

  const validateField = (name, value) => {
    let isValid = true;
    let newErrors = { ...errors };

    switch (name) {
      case 'firstName':
      case 'lastName':
        isValid = !!value && !/[" "]{2,}/.test(value);
        newErrors[name] = !isValid;
        break;
      case 'dob':
        const dobPattern = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/;
        const year = value?.split('-')[0];
        const currentYear = new Date().getFullYear();
        isValid = !!value && dobPattern.test(value) && year >= 1900 && year <= currentYear;
        newErrors.dob = !isValid;
        break;
      case 'gender':
        isValid = !!value;
        newErrors.gender = !isValid;
        break;
      case 'mobileNo':
        isValid = /^[0-9]{10}$/.test(value);
        newErrors.mobileNo = !isValid;
        break;
      case 'email':
        isValid = !!value && !/[" "]{1,}/.test(value) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
        newErrors.email = !isValid;
        break;
      case 'password':
        isValid = !!value && !/[" "]{1,}/.test(value) && value.length >= 6;
        newErrors.password = !isValid;
        break;
      case 'agreeCheckBox':
        isValid = !!value;
        newErrors.agreeCheckBox = !isValid;
        break;
      default:
        break;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    const fieldValue = type === 'checkbox' ? checked : value;
    
    setFormData(prev => ({
      ...prev,
      [name]: fieldValue
    }));

    validateField(name, fieldValue);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    // Validate all fields
    const isFormValid = Object.entries(formData).every(([key, value]) => {
      return validateField(key, value);
    });

    if (!isFormValid) {
      Constants.showToast.warning("Please fill all required fields correctly.");
      setLoading(false);
      return;
    }

    try {
      const { firstName, lastName, gender, dob, mobileNo, email, password } = formData;
      const registerRes = await register({ firstName, lastName, gender, dob, mobileNo, email, password });

      if (registerRes.httpStatusCode === 200 || registerRes.httpStatusCode === 201) {
        Constants.showToast.success("Registration successful! Redirecting to login...", {
          onClose: () => navigate(Constants.LOGIN_ROUTE, { state: { from: location } }),
          autoClose: 1000
        });
      } else {
        Constants.showToast.error(registerRes?.message || registerRes?.error || "Registration failed");
      }
    } catch (error) {
      Constants.showToast.error("An error occurred during registration");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <Box
        sx={{
          minHeight: '100vh',
          p: { xs: 2, md: 4 },
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'start'
        }}
      >
        <motion.div
          initial="hidden"
          animate="visible"
          variants={containerVariants}
          style={{ width: '100%', maxWidth: '800px' }}
        >
          <Card
            sx={{
              width: '100%',
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              boxShadow: 3
            }}
          >
            <CardContent sx={{ p: { xs: 2, md: 4 } }}>
              <motion.div variants={itemVariants}>
                <Typography
                  variant="h4"
                  component="h1"
                  gutterBottom
                  sx={{
                    fontWeight: 'bold',
                    color: 'primary.main',
                    borderBottom: '2px solid',
                    borderColor: 'primary.main',
                    pb: 1,
                    mb: 3
                  }}
                >
                  Registration Form
                </Typography>
              </motion.div>

              <Grid container spacing={3}>
                {/* First Name */}
                <Grid item xs={12} md={6}>
                  <motion.div variants={itemVariants}>
                    <TextField
                      fullWidth
                      label="First Name"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleChange}
                      error={errors.firstName}
                      helperText={errors.firstName && "First name is required"}
                      variant="outlined"
                      InputProps={{
                        startAdornment: (
                          <Box sx={{ mr: 1, color: 'text.secondary' }}>👤</Box>
                        ),
                      }}
                    />
                  </motion.div>
                </Grid>

                {/* Last Name */}
                <Grid item xs={12} md={6}>
                  <motion.div variants={itemVariants}>
                    <TextField
                      fullWidth
                      label="Last Name"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleChange}
                      error={errors.lastName}
                      helperText={errors.lastName && "Last name is required"}
                      variant="outlined"
                    />
                  </motion.div>
                </Grid>

                {/* Mobile Number */}
                <Grid item xs={12} md={6}>
                  <motion.div variants={itemVariants}>
                    <TextField
                      fullWidth
                      label="Mobile Number"
                      name="mobileNo"
                      value={formData.mobileNo}
                      onChange={handleChange}
                      error={errors.mobileNo}
                      helperText={errors.mobileNo ? "10 digits required" : ""}
                      variant="outlined"
                      InputProps={{
                        startAdornment: (
                          <Box sx={{ mr: 1, color: 'text.secondary' }}>📞</Box>
                        ),
                      }}
                    />
                  </motion.div>
                </Grid>

                {/* Gender */}
                <Grid item xs={12} md={6} sx={{width: '150px'}}>
                  <motion.div variants={itemVariants}>
                    <FormControl fullWidth error={errors.gender}>
                      <InputLabel>Gender</InputLabel>
                      <Select
                        name="gender"
                        value={formData.gender}
                        onChange={handleChange}
                        label="Gender"
                        width="100px"
                      >
                        <MenuItem value=""><em>Select Gender</em></MenuItem>
                        <MenuItem value="male">Male</MenuItem>
                        <MenuItem value="female">Female</MenuItem>
                      </Select>
                      {errors.gender && (
                        <FormHelperText>Please select gender</FormHelperText>
                      )}
                    </FormControl>
                  </motion.div>
                </Grid>

                {/* Date of Birth */}
                <Grid item xs={12} md={6}>
                  <motion.div variants={itemVariants}>
                    <TextField
                      fullWidth
                      label="Date of Birth"
                      name="dob"
                      type="date"
                      value={formData.dob}
                      onChange={handleChange}
                      error={errors.dob}
                      helperText={errors.dob && "Please enter valid date"}
                      variant="outlined"
                      InputLabelProps={{ shrink: true }}
                      InputProps={{
                        startAdornment: (
                          <Box sx={{ mr: 1, color: 'text.secondary' }}>📅</Box>
                        ),
                      }}
                    />
                  </motion.div>
                </Grid>

                {/* Email */}
                <Grid item xs={12} md={6}>
                  <motion.div variants={itemVariants}>
                    <TextField
                      fullWidth
                      label="Email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      error={errors.email}
                      helperText={errors.email && "Please enter valid email"}
                      variant="outlined"
                      InputProps={{
                        startAdornment: (
                          <Box sx={{ mr: 1, color: 'text.secondary' }}>📧</Box>
                        ),
                      }}
                    />
                  </motion.div>
                </Grid>

                {/* Password */}
                <Grid item xs={12}>
                  <motion.div variants={itemVariants}>
                    <TextField
                      fullWidth
                      label="Password (min 6 characters)"
                      name="password"
                      type="password"
                      value={formData.password}
                      onChange={handleChange}
                      error={errors.password}
                      helperText={errors.password && "Minimum 6 characters required"}
                      variant="outlined"
                      InputProps={{
                        startAdornment: (
                          <Box sx={{ mr: 1, color: 'text.secondary' }}>🔐</Box>
                        ),
                      }}
                    />
                  </motion.div>
                </Grid>

                {/* Terms Checkbox */}
                <Grid item xs={12}>
                  <motion.div variants={itemVariants}>
                    <FormControl error={errors.agreeCheckBox}>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Checkbox
                          name="agreeCheckBox"
                          checked={formData.agreeCheckBox}
                          onChange={handleChange}
                          color="primary"
                        />
                        <Typography variant="body1">
                          I agree to terms and conditions <span style={{ color: muiTheme.palette.error.main }}>*</span>
                        </Typography>
                      </Box>
                      {errors.agreeCheckBox && (
                        <FormHelperText>Please accept terms and conditions</FormHelperText>
                      )}
                    </FormControl>
                  </motion.div>
                </Grid>

                {/* Buttons */}
                <Grid item xs={12}>
                  <motion.div variants={itemVariants}>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-start', gap: 2 }}>
                      <motion.div
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <Button
                          variant="contained"
                          color="primary"
                          onClick={handleSubmit}
                          disabled={loading || !formData.agreeCheckBox}
                          size="large"
                          sx={{ px: 4 }}
                        >
                          {loading ? (
                            <>
                              <CircularProgress size={24} color="inherit" />
                              <Box component="span" sx={{ ml: 1 }}>Registering</Box>
                            </>
                          ) : 'Register'}
                        </Button>
                      </motion.div>
                      <motion.div
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <Button
                          variant="outlined"
                          color="error"
                          onClick={() => navigate(Constants.DB_WORLD_HOME_ROUTE)}
                          size="large"
                        >
                          Cancel
                        </Button>
                      </motion.div>
                    </Box>
                  </motion.div>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </motion.div>
      </Box>
    </ThemeProvider>
  );
};

export default Registration;