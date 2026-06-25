import React, { useCallback, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import {
  Alert,
  Avatar,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  InputAdornment,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';

import {
  ArrowForward as ArrowForwardIcon,
  CalendarToday as CalendarIcon,
  Close as CloseIcon,
  Email as EmailIcon,
  Lock as LockIcon,
  Visibility,
  VisibilityOff,
} from '@mui/icons-material';

import { motion, useReducedMotion } from 'framer-motion';

import { useAuth } from '@features/auth/context/Authentication';
import axiosInstance from '@shared/components/ui/utils/AxiosInstants';
import Constants from '@shared/constants';
import db_world_icon from '@assets/images/db-circle-icon.webp';
import { useT, getFieldSx, getGlowProps } from '@shared/theme';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const APP_ROLES = [
  Constants.OWNER_USER_ROLE,
  Constants.ADMIN_USER_ROLE,
  Constants.VIEWER_USER_ROLE,
];

const extractLoginRole = (payload) => {
  const candidates = [
    payload?.user?.role,
    ...(Array.isArray(payload?.user?.roles) ? payload.user.roles : []),
    ...(Array.isArray(payload?.roles) ? payload.roles : []),
  ].filter(Boolean);

  return candidates.find((role) => APP_ROLES.includes(role)) ?? null;
};

const isValidEmail = (value) => {
  return Boolean(value) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
};

const isValidPassword = (value) => {
  return Boolean(value) && !/\s/.test(value);
};

const isValidDob = (value) => {
  const year = Number(value?.split('-')?.[0]);

  return (
    Boolean(value) &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    year >= 1900 &&
    year <= new Date().getFullYear()
  );
};

const focusSx = (color) => ({
  '&:focus-visible': {
    outline: `3px solid ${color}`,
    outlineOffset: 3,
  },
});

const getSafeDestination = (location) => {
  const from = location.state?.from?.pathname;

  const blockedDestinations = [
    Constants.LOGIN_ROUTE,
    Constants.REGISTRATION_ROUTE,
    Constants.LOGOUT_ROUTE,
  ];

  if (!from || blockedDestinations.includes(from)) {
    return Constants.DB_WORLD_HOME_ROUTE;
  }

  return from;
};

// ─────────────────────────────────────────────────────────────────────────────
// Login
// ─────────────────────────────────────────────────────────────────────────────

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const T = useT();
  const FIELD = useMemo(() => ({ ...getFieldSx(T), mb: 2 }), [T]);
  const GLOW = useMemo(() => getGlowProps(T), [T]);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const prefersReducedMotion = useReducedMotion();

  const destination = useMemo(() => getSafeDestination(location), [location]);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const [errors, setErrors] = useState({
    email: false,
    password: false,
  });

  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [dob, setDob] = useState('');
  const [dobError, setDobError] = useState(false);
  const [dobOpen, setDobOpen] = useState(false);
  const [dobLoading, setDobLoading] = useState(false);

  // ───────────────────────────────────────────────────────────────────────────
  // Validation
  // ───────────────────────────────────────────────────────────────────────────

  const validateField = useCallback((name, value) => {
    if (name === 'email') {
      const ok = isValidEmail(value);
      setErrors((prev) => ({ ...prev, email: !ok }));
      return ok;
    }

    if (name === 'password') {
      const ok = isValidPassword(value);
      setErrors((prev) => ({ ...prev, password: !ok }));
      return ok;
    }

    if (name === 'dob') {
      const ok = isValidDob(value);
      setDobError(!ok);
      return ok;
    }

    return true;
  }, []);

  const handleChange = useCallback(
    (event) => {
      const { name, value } = event.target;

      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));

      if (loginError) {
        setLoginError('');
      }

      validateField(name, value);
    },
    [loginError, validateField]
  );

  // ───────────────────────────────────────────────────────────────────────────
  // Login submit
  // ───────────────────────────────────────────────────────────────────────────

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault();

      if (loading) return;

      const email = formData.email.trim().toLowerCase();
      const password = formData.password;

      const emailOk = validateField('email', email);
      const passwordOk = validateField('password', password);

      if (!emailOk || !passwordOk) return;

      setLoading(true);
      setLoginError('');

      try {
        const res = await axiosInstance.post('/api/auth/login', {
          email,
          password,
        });

        const payload = res.data?.data;

        if (!payload?.token || !payload?.user) {
          throw new Error('Unexpected response from server');
        }

        const role = extractLoginRole(payload);

        if (!role) {
          throw new Error('Unable to determine user role');
        }

        login(payload.token, payload.user, role);

        if (!payload.user.dob) {
          setDobOpen(true);
          return;
        }

        navigate(destination, { replace: true });
      } catch (err) {
        const msg =
          err.response?.data?.message ||
          err.message ||
          'Invalid email or password';

        setLoginError(msg);
      } finally {
        setLoading(false);
      }
    },
    [destination, formData.email, formData.password, loading, login, navigate, validateField]
  );

  // ───────────────────────────────────────────────────────────────────────────
  // DOB submit
  // ───────────────────────────────────────────────────────────────────────────

  const handleDobSubmit = useCallback(async () => {
    if (dobLoading) return;

    if (!validateField('dob', dob)) return;

    setDobLoading(true);

    try {
      await axiosInstance.put(`/api/user/dob=${dob}`);
      setDobOpen(false);
      navigate(destination, { replace: true });
    } catch (err) {
      setDobError(true);
    } finally {
      setDobLoading(false);
    }
  }, [destination, dob, dobLoading, navigate, validateField]);

  const handleDobClose = useCallback(() => {
    /*
     * User is already logged in at this point.
     * If DOB is optional, allow closing and continue.
     * If DOB is mandatory in your backend, remove this function and make the dialog non-closable.
     */
    setDobOpen(false);
    navigate(destination, { replace: true });
  }, [destination, navigate]);

  // ───────────────────────────────────────────────────────────────────────────
  // Render
  // ───────────────────────────────────────────────────────────────────────────

  return (
    <Box
      sx={{
        minHeight: '100dvh',
        bgcolor: T.bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        px: {
          xs: 1.5,
          sm: 2,
        },
        pt: {
          xs: 'calc(56px + 28px)',
          md: 'calc(64px + 32px)',
        },
        pb: 4,
        position: 'relative',
        overflow: 'hidden auto',
      }}
    >
      <motion.div {...GLOW} />

      <motion.div
        initial={
          prefersReducedMotion
            ? false
            : {
                opacity: 0,
                y: 28,
              }
        }
        animate={{
          opacity: 1,
          y: 0,
        }}
        transition={{
          duration: 0.42,
          ease: 'easeOut',
        }}
        style={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          maxWidth: 440,
          minWidth: 0,
        }}
      >
        <Box
          sx={{
            bgcolor: T.glass,
            border: `1px solid ${T.glassBorder}`,
            borderRadius: {
              xs: 3,
              sm: 4,
            },
            p: {
              xs: 2.5,
              sm: 4,
            },
            backdropFilter: 'blur(20px)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
            minWidth: 0,
          }}
        >
          {/* Brand */}
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              mb: {
                xs: 3,
                sm: 4,
              },
              textAlign: 'center',
              minWidth: 0,
            }}
          >
            <Avatar
              src={db_world_icon}
              alt="DB World"
              sx={{
                width: {
                  xs: 50,
                  sm: 56,
                },
                height: {
                  xs: 50,
                  sm: 56,
                },
                bgcolor: T.tealBg,
                border: `1px solid ${T.teal}`,
                boxShadow: `0 0 24px ${T.tealGlow}`,
                mb: 2,
              }}
            />

            <Typography
              component="h1"
              sx={{
                fontWeight: 900,
                color: T.text,
                fontSize: {
                  xs: '1.35rem',
                  sm: '1.55rem',
                },
                lineHeight: 1.15,
                letterSpacing: '-0.03em',
                overflowWrap: 'anywhere',
                wordBreak: 'break-word',
              }}
            >
              Welcome back
            </Typography>

            <Typography
              sx={{
                color: T.textMuted,
                fontSize: {
                  xs: '0.84rem',
                  sm: '0.9rem',
                },
                mt: 0.6,
                lineHeight: 1.45,
                overflowWrap: 'anywhere',
                wordBreak: 'break-word',
              }}
            >
              Sign in to continue to DB World
            </Typography>
          </Box>

          {/* Error alert */}
          {loginError && (
            <Alert
              severity="error"
              onClose={() => setLoginError('')}
              sx={{
                mb: 2,
                borderRadius: 1.5,
                fontSize: '0.875rem',
                '& .MuiAlert-message': {
                  overflowWrap: 'anywhere',
                  wordBreak: 'break-word',
                },
              }}
            >
              {loginError}
            </Alert>
          )}

          {/* Form */}
          <Box component="form" onSubmit={handleSubmit} noValidate>
            <TextField
              label="Email address"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              fullWidth
              autoFocus
              autoComplete="email"
              error={errors.email}
              helperText={errors.email ? 'Enter a valid email address' : ''}
              disabled={loading}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <EmailIcon
                      sx={{
                        fontSize: 18,
                        color: errors.email ? T.error : T.textMuted,
                      }}
                    />
                  </InputAdornment>
                ),
              }}
              sx={FIELD}
            />

            <TextField
              label="Password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              value={formData.password}
              onChange={handleChange}
              fullWidth
              autoComplete="current-password"
              error={errors.password}
              helperText={
                errors.password
                  ? 'Password cannot be empty or contain spaces'
                  : ''
              }
              disabled={loading}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockIcon
                      sx={{
                        fontSize: 18,
                        color: errors.password ? T.error : T.textMuted,
                      }}
                    />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      onClick={() => setShowPassword((prev) => !prev)}
                      disabled={loading}
                      aria-label={
                        showPassword ? 'Hide password' : 'Show password'
                      }
                      sx={{
                        color: T.textMuted,
                        ...focusSx(T.teal),
                        '&:hover': {
                          color: T.text,
                        },
                      }}
                    >
                      {showPassword ? (
                        <VisibilityOff sx={{ fontSize: 18 }} />
                      ) : (
                        <Visibility sx={{ fontSize: 18 }} />
                      )}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={FIELD}
            />

            <Button
              type="submit"
              fullWidth
              disabled={loading}
              endIcon={!loading ? <ArrowForwardIcon /> : null}
              sx={{
                mt: 1,
                py: 1.4,
                bgcolor: T.teal,
                color: '#fff',
                fontWeight: 800,
                fontSize: '0.95rem',
                borderRadius: 1.7,
                textTransform: 'none',
                minHeight: 48,
                ...focusSx(T.teal),
                '&:hover': {
                  bgcolor: T.tealHover,
                },
                '&.Mui-disabled': {
                  bgcolor: T.tealBg,
                  color: T.textFaint,
                },
              }}
            >
              {loading ? (
                <>
                  <CircularProgress
                    size={18}
                    color="inherit"
                    sx={{ mr: 1 }}
                  />
                  Signing in…
                </>
              ) : (
                'Sign in'
              )}
            </Button>
          </Box>

          <Divider sx={{ borderColor: T.border, my: 3 }}>
            <Typography
              sx={{
                color: T.textFaint,
                fontSize: '0.75rem',
                px: 1,
                fontWeight: 700,
                letterSpacing: '0.08em',
              }}
            >
              NEW TO DB WORLD?
            </Typography>
          </Divider>

          <Button
            fullWidth
            onClick={() => navigate(Constants.REGISTRATION_ROUTE)}
            disabled={loading}
            sx={{
              py: 1.2,
              border: `1px solid ${T.glassBorder}`,
              color: T.textMuted,
              borderRadius: 1.7,
              textTransform: 'none',
              fontWeight: 650,
              minHeight: 44,
              ...focusSx(T.teal),
              '&:hover': {
                borderColor: T.teal,
                color: T.teal,
                bgcolor: T.tealBg,
              },
            }}
          >
            Create an account
          </Button>
        </Box>
      </motion.div>

      {/* DOB Dialog */}
      <Dialog
        open={dobOpen}
        onClose={handleDobClose}
        maxWidth="xs"
        fullWidth
        fullScreen={isMobile}
        PaperProps={{
          sx: {
            bgcolor: T.sidebar,
            backgroundImage: 'none',
            border: isMobile ? 'none' : `1px solid ${T.glassBorder}`,
            borderRadius: isMobile ? 0 : 3,
          },
        }}
      >
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
            color: T.text,
            pb: 1,
            px: {
              xs: 2,
              sm: 3,
            },
          }}
        >
          <Typography
            sx={{
              fontWeight: 800,
              fontSize: '1rem',
              overflowWrap: 'anywhere',
              wordBreak: 'break-word',
            }}
          >
            One more thing…
          </Typography>

          <IconButton
            size="small"
            onClick={handleDobClose}
            aria-label="Close date of birth dialog"
            sx={{
              color: T.textMuted,
              flexShrink: 0,
              ...focusSx(T.teal),
              '&:hover': {
                color: T.text,
              },
            }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent
          sx={{
            px: {
              xs: 2,
              sm: 3,
            },
            pb: {
              xs: 2.5,
              sm: 3,
            },
          }}
        >
          <Typography
            sx={{
              color: T.textMuted,
              fontSize: '0.875rem',
              lineHeight: 1.55,
              mb: 3,
              overflowWrap: 'anywhere',
              wordBreak: 'break-word',
            }}
          >
            Please provide your date of birth to complete your profile.
          </Typography>

          <TextField
            fullWidth
            type="date"
            label="Date of birth"
            InputLabelProps={{ shrink: true }}
            value={dob}
            onChange={(event) => {
              setDob(event.target.value);
              validateField('dob', event.target.value);
            }}
            error={dobError}
            helperText={dobError ? 'Enter a valid date (YYYY-MM-DD)' : ''}
            disabled={dobLoading}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <CalendarIcon
                    sx={{
                      fontSize: 18,
                      color: dobError ? T.error : T.textMuted,
                    }}
                  />
                </InputAdornment>
              ),
            }}
            sx={{
              ...FIELD,
              mb: 3,
            }}
          />

          <Button
            fullWidth
            onClick={handleDobSubmit}
            disabled={dobLoading}
            sx={{
              py: 1.3,
              bgcolor: T.teal,
              color: '#fff',
              fontWeight: 800,
              borderRadius: 1.7,
              textTransform: 'none',
              minHeight: 46,
              ...focusSx(T.teal),
              '&:hover': {
                bgcolor: T.tealHover,
              },
              '&.Mui-disabled': {
                bgcolor: T.tealBg,
                color: T.textFaint,
              },
            }}
          >
            {dobLoading ? (
              <CircularProgress size={18} color="inherit" />
            ) : (
              'Save & Continue'
            )}
          </Button>
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default Login;