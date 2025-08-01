import React, { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';
import Constants from './Constants';
import { doLogin, updateDobForUser } from './ApiServices';
// import Authentication from '../contexts/Authentication';
import loginImage from '../images/login.png';

// MUI Components
import {
  Box,
  Button,
  Card,
  CardContent,
  CardMedia,
  CircularProgress,
  Container,
  Divider,
  FormControl,
  FormHelperText,
  Grid,
  IconButton,
  InputAdornment,
  Modal,
  TextField,
  Typography,
  useTheme
} from '@mui/material';
import {
  Lock as LockIcon,
  Email as EmailIcon,
  Close as CloseIcon,
  CalendarToday as CalendarIcon,
  Login as LoginIcon,
  PersonAdd as PersonAddIcon,
  VisibilityOff,
  Visibility
} from '@mui/icons-material';

// Animation
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/Authentication';
import { toast } from './Toast';

// Styles
const modalStyle = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 400,
  bgcolor: 'background.paper',
  boxShadow: 24,
  p: 4,
  borderRadius: 2
};

const Login = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const { login, logout } = useAuth();

  // State
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [errors, setErrors] = useState({
    email: false,
    password: false
  });
  const [loading, setLoading] = useState(false);
  const [dob, setDob] = useState('');
  const [dobError, setDobError] = useState(false);
  const [dobModalOpen, setDobModalOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  // useEffect(() => {
  //   logout(); // Clear auth state on mount
  // }, [logout]);

  // Helpers
  const getRedirectPath = () => {
    if (location.search) {
      return location.search.replace('?redirectTo=', '');
    }
    return null;
  };

  // Handlers
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    validateField(name, value);
  };

  const validateField = (name, value) => {
    let isValid = true;

    if (name === 'email') {
      isValid = !!value && !/\s/.test(value) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      setErrors(prev => ({ ...prev, email: !isValid }));
    } else if (name === 'password') {
      isValid = !!value && !/\s/.test(value);
      setErrors(prev => ({ ...prev, password: !isValid }));
    } else if (name === 'dob') {
      const dobPattern = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/;
      const year = value.split('-')[0];
      const currentYear = new Date().getFullYear();
      isValid = !!value && dobPattern.test(value) && year >= 1900 && year <= currentYear;
      setDobError(!isValid);
    }

    return isValid;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    // Validate all fields
    const isEmailValid = validateField('email', formData.email);
    const isPasswordValid = validateField('password', formData.password);

    if (!isEmailValid || !isPasswordValid) {
      toast.warning('Please fill all required fields correctly.');
      setLoading(false);
      return;
    }

    const loginRes = await doLogin(formData.email, formData.password);
    if (loginRes && loginRes.httpStatusCode === 200) {
      toast.success('Login successful!', {
        duration: 1000, // MUI uses 'duration' instead of 'autoClose'
        onClose: () => {
          login(loginRes.data.token, loginRes.data.user, loginRes.data.user.role);
          if (!loginRes.data.user.dob) {
            setUser(loginRes.data.user);
            setDobModalOpen(true);
          } else {
            navigate(location.state?.from?.pathname || Constants.DB_WORLD_HOME_ROUTE, { replace: true });
          }
        }
      });
    }
    setLoading(false);
  };

  const handleDobSubmit = async () => {
    if (!validateField('dob', dob)) {
      toast.warning('Please enter a valid date of birth');
      return;
    }

    try {
      const res = await updateDobForUser(dob);
      if (res.httpStatusCode === 200) {
        toast.success('Date of birth updated successfully');
        setDobModalOpen(false);
        navigate(location.state?.from?.pathname || Constants.DB_WORLD_HOME_ROUTE);
      } else {
        toast.error(res.message || 'Failed to update date of birth');
      }
    } catch (err) {
      toast.error('Error updating date of birth');
    }
  };

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

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Toast container */}
      

      {/* Login Card */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card sx={{ display: 'flex', borderRadius: 4, overflow: 'hidden' }}>
          {/* Image Section */}
          <CardMedia
            component="img"
            sx={{
              width: { xs: 0, md: '35%' },
              objectFit: 'cover',
              display: { xs: 'none', md: 'block' }
            }}
            image={loginImage}
            alt="Login illustration"
          />

          {/* Form Section */}
          <Box sx={{ flex: 1 }}>
            <CardContent sx={{ p: 4 }}>
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
              >
                <motion.div variants={itemVariants}>
                  <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 'bold' }}>
                    Welcome Back
                  </Typography>
                  <Typography variant="body1" color="text.secondary" gutterBottom>
                    Sign in to continue to your account
                  </Typography>
                  <Divider sx={{ my: 3 }} />
                </motion.div>

                <Box component="form" onSubmit={handleSubmit} noValidate>
                  <motion.div variants={itemVariants}>
                    <FormControl fullWidth margin="normal" error={errors.email}>
                      <TextField
                        label="Email Address"
                        name="email"
                        type="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        required
                        fullWidth
                        autoFocus
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <EmailIcon color={errors.email ? 'error' : 'action'} />
                            </InputAdornment>
                          ),
                        }}
                        error={errors.email}
                        helperText={errors.email ? 'Please enter a valid email' : ''}
                      />
                    </FormControl>
                  </motion.div>

                  <motion.div variants={itemVariants}>
                    <FormControl fullWidth margin="normal" error={errors.password}>
                      <TextField
                        label="Password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        value={formData.password}
                        onChange={handleInputChange}
                        required
                        fullWidth
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <LockIcon color={errors.password ? 'error' : 'action'} />
                            </InputAdornment>
                          ),
                          endAdornment: (
                            <InputAdornment position="end">
                              <IconButton
                                onClick={() => setShowPassword(!showPassword)}
                                edge="end"
                              >
                                {showPassword ? <VisibilityOff /> : <Visibility />}
                              </IconButton>
                            </InputAdornment>
                          )
                        }}
                        error={errors.password}
                        helperText={errors.password ? 'Password cannot be empty or contain spaces' : ''}
                      />
                    </FormControl>
                  </motion.div>

                  <motion.div variants={itemVariants}>
                    <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between' }}>
                      <Button
                        type="submit"
                        variant="contained"
                        color="primary"
                        size="large"
                        startIcon={<LoginIcon />}
                        disabled={loading}
                        sx={{ minWidth: 120 }}
                      >
                        {loading ? (
                          <>
                            <CircularProgress size={24} color="inherit" />
                            <Box component="span" sx={{ ml: 1 }}>Signing In...</Box>
                          </>
                        ) : 'Sign In'}
                      </Button>

                      <Button
                        variant="outlined"
                        color="secondary"
                        size="large"
                        onClick={() => navigate(Constants.DB_WORLD_HOME_ROUTE)}
                        startIcon={<CloseIcon />}
                      >
                        Cancel
                      </Button>
                    </Box>
                  </motion.div>
                </Box>

                <motion.div variants={itemVariants}>
                  <Divider sx={{ my: 3 }} />
                  <Typography variant="body2" align="center" sx={{ mb: 2 }}>
                    Don't have an account?
                  </Typography>
                  <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                    <Button
                      variant="outlined"
                      color="primary"
                      startIcon={<PersonAddIcon />}
                      onClick={() => navigate(Constants.REGISTRATION_ROUTE)}
                    >
                      Create Account
                    </Button>
                  </Box>
                </motion.div>
              </motion.div>
            </CardContent>
          </Box>
        </Card>
      </motion.div>

      {/* DOB Modal */}
      <Modal
        open={dobModalOpen}
        onClose={() => setDobModalOpen(false)}
        aria-labelledby="dob-modal-title"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
        >
          <Box sx={modalStyle}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography id="dob-modal-title" variant="h6" component="h2">
                Update Your Date of Birth
              </Typography>
              <IconButton onClick={() => setDobModalOpen(false)}>
                <CloseIcon />
              </IconButton>
            </Box>

            <Typography variant="body1" sx={{ mb: 3 }}>
              Please provide your date of birth to continue. This information is required.
            </Typography>

            <TextField
              fullWidth
              type="date"
              label="Date of Birth"
              variant="outlined"
              InputLabelProps={{ shrink: true }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <CalendarIcon color={dobError ? 'error' : 'action'} />
                  </InputAdornment>
                ),
              }}
              value={dob}
              onChange={(e) => {
                setDob(e.target.value);
                validateField('dob', e.target.value);
              }}
              error={dobError}
              helperText={dobError ? 'Please enter a valid date (YYYY-MM-DD)' : ''}
              sx={{ mb: 3 }}
            />

            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant="contained"
                onClick={handleDobSubmit}
                startIcon={<CalendarIcon />}
              >
                Submit
              </Button>
            </Box>
          </Box>
        </motion.div>
      </Modal>
    </Container>
  );
};

export default Login;