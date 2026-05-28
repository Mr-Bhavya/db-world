import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box, Button, CircularProgress, Dialog, DialogContent, DialogTitle,
  Divider, IconButton, InputAdornment, TextField, Typography, Avatar, Alert,
} from '@mui/material';
import {
  Lock as LockIcon,
  Email as EmailIcon,
  CalendarToday as CalendarIcon,
  Visibility,
  VisibilityOff,
  Close as CloseIcon,
  ArrowForward as ArrowForwardIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useAuth } from '@features/auth/context/Authentication';
import axiosInstance from '@shared/components/ui/utils/AxiosInstants';
import Constants from '@shared/constants';
import db_world_icon from '@assets/images/db-circle-icon.webp';
import { useT, getFieldSx, getGlowProps } from '@shared/theme';

const Login = () => {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { login } = useAuth();

  const T     = useT();
  const FIELD = { ...getFieldSx(T), mb: 2 };
  const GLOW  = getGlowProps(T);

  const [formData,     setFormData]     = useState({ email: '', password: '' });
  const [errors,       setErrors]       = useState({ email: false, password: false });
  const [loading,      setLoading]      = useState(false);
  const [loginError,   setLoginError]   = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // DOB dialog state
  const [dob,        setDob]        = useState('');
  const [dobError,   setDobError]   = useState(false);
  const [dobOpen,    setDobOpen]    = useState(false);
  const [dobLoading, setDobLoading] = useState(false);

  // ── Validation ──────────────────────────────────────────────────────
  const validateField = (name, value) => {
    if (name === 'email') {
      const ok = !!value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      setErrors(p => ({ ...p, email: !ok }));
      return ok;
    }
    if (name === 'password') {
      const ok = !!value && !/\s/.test(value);
      setErrors(p => ({ ...p, password: !ok }));
      return ok;
    }
    if (name === 'dob') {
      const year = Number(value?.split('-')[0]);
      const ok   = !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && year >= 1900 && year <= new Date().getFullYear();
      setDobError(!ok);
      return ok;
    }
    return true;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(p => ({ ...p, [name]: value }));
    if (loginError) setLoginError('');
    validateField(name, value);
  };

  // ── Submit ──────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    const emailOk = validateField('email',    formData.email);
    const passOk  = validateField('password', formData.password);
    if (!emailOk || !passOk) return;

    setLoading(true);
    setLoginError('');

    try {
      const res = await axiosInstance.post('/api/auth/login', {
        email:    formData.email.trim().toLowerCase(),
        password: formData.password,
      });

      const payload = res.data?.data; // { token, user: { userId, email, name, dob, role } }
      if (!payload?.token) throw new Error('Unexpected response from server');

      login(payload.token, payload.user, payload.user.role);

      const destination = location.state?.from?.pathname || Constants.DB_WORLD_HOME_ROUTE;

      if (!payload.user.dob) {
        setDobOpen(true);
      } else {
        navigate(destination, { replace: true });
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Invalid email or password';
      setLoginError(msg);
    } finally {
      setLoading(false);
    }
  };

  // ── DOB submit ──────────────────────────────────────────────────────
  const handleDobSubmit = async () => {
    if (!validateField('dob', dob)) return;

    setDobLoading(true);
    try {
      await axiosInstance.put(`/api/user/dob=${dob}`);
      setDobOpen(false);
      const destination = location.state?.from?.pathname || Constants.DB_WORLD_HOME_ROUTE;
      navigate(destination, { replace: true });
    } catch {
      setDobError(true);
    } finally {
      setDobLoading(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <Box sx={{
      minHeight: '100vh',
      bgcolor: T.bg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      px: 2,
      pt: { xs: 'calc(56px + 32px)', md: 'calc(64px + 32px)' },
      pb: 4,
      position: 'relative',
    }}>
      <motion.div {...GLOW} />

      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 440 }}
      >
        <Box sx={{
          bgcolor: T.glass,
          border: `1px solid ${T.glassBorder}`,
          borderRadius: 3,
          p: { xs: 3, sm: 4 },
          backdropFilter: 'blur(20px)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
        }}>

          {/* Brand */}
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 4 }}>
            <Avatar
              src={db_world_icon}
              sx={{
                width: 52, height: 52,
                bgcolor: T.tealBg,
                border: `1px solid ${T.teal}`,
                boxShadow: `0 0 24px ${T.tealGlow}`,
                mb: 2,
              }}
            />
            <Typography sx={{ fontWeight: 800, color: T.text, fontSize: '1.5rem', letterSpacing: '-0.02em' }}>
              Welcome back
            </Typography>
            <Typography sx={{ color: T.textMuted, fontSize: '0.875rem', mt: 0.5 }}>
              Sign in to continue to DB World
            </Typography>
          </Box>

          {/* Error alert */}
          {loginError && (
            <Alert
              severity="error"
              onClose={() => setLoginError('')}
              sx={{ mb: 2, borderRadius: 1.5, fontSize: '0.875rem' }}
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
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <EmailIcon sx={{ fontSize: 18, color: errors.email ? T.error : T.textMuted }} />
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
              helperText={errors.password ? 'Password cannot be empty or contain spaces' : ''}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockIcon sx={{ fontSize: 18, color: errors.password ? T.error : T.textMuted }} />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      onClick={() => setShowPassword(p => !p)}
                      tabIndex={-1}
                      sx={{ color: T.textMuted, '&:hover': { color: T.text } }}
                    >
                      {showPassword ? <VisibilityOff sx={{ fontSize: 18 }} /> : <Visibility sx={{ fontSize: 18 }} />}
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
              endIcon={!loading && <ArrowForwardIcon />}
              sx={{
                mt: 1, py: 1.4,
                bgcolor: T.teal,
                color: '#fff',
                fontWeight: 700,
                fontSize: '0.95rem',
                borderRadius: 1.5,
                textTransform: 'none',
                '&:hover': { bgcolor: T.tealHover },
                '&.Mui-disabled': { bgcolor: T.tealBg, color: T.textFaint },
              }}
            >
              {loading
                ? <><CircularProgress size={18} color="inherit" sx={{ mr: 1 }} />Signing in…</>
                : 'Sign in'
              }
            </Button>
          </Box>

          <Divider sx={{ borderColor: T.border, my: 3 }}>
            <Typography sx={{ color: T.textFaint, fontSize: '0.75rem', px: 1 }}>
              NEW TO DB WORLD?
            </Typography>
          </Divider>

          <Button
            fullWidth
            onClick={() => navigate(Constants.REGISTRATION_ROUTE)}
            sx={{
              py: 1.2,
              border: `1px solid ${T.glassBorder}`,
              color: T.textMuted,
              borderRadius: 1.5,
              textTransform: 'none',
              fontWeight: 500,
              '&:hover': { borderColor: T.teal, color: T.teal, bgcolor: T.tealBg },
            }}
          >
            Create an account
          </Button>
        </Box>
      </motion.div>

      {/* DOB Dialog */}
      <Dialog
        open={dobOpen}
        onClose={() => setDobOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: T.sidebar,
            border: `1px solid ${T.glassBorder}`,
            borderRadius: 3,
          },
        }}
      >
        <DialogTitle sx={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          color: T.text, pb: 1,
        }}>
          <Typography sx={{ fontWeight: 700, fontSize: '1rem' }}>One more thing…</Typography>
          <IconButton size="small" onClick={() => setDobOpen(false)}
            sx={{ color: T.textMuted, '&:hover': { color: T.text } }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent>
          <Typography sx={{ color: T.textMuted, fontSize: '0.875rem', mb: 3 }}>
            Please provide your date of birth to complete your profile.
          </Typography>

          <TextField
            fullWidth
            type="date"
            label="Date of birth"
            InputLabelProps={{ shrink: true }}
            value={dob}
            onChange={(e) => { setDob(e.target.value); validateField('dob', e.target.value); }}
            error={dobError}
            helperText={dobError ? 'Enter a valid date (YYYY-MM-DD)' : ''}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <CalendarIcon sx={{ fontSize: 18, color: dobError ? T.error : T.textMuted }} />
                </InputAdornment>
              ),
            }}
            sx={{ ...FIELD, mb: 3 }}
          />

          <Button
            fullWidth
            onClick={handleDobSubmit}
            disabled={dobLoading}
            sx={{
              py: 1.3,
              bgcolor: T.teal,
              color: '#fff',
              fontWeight: 700,
              borderRadius: 1.5,
              textTransform: 'none',
              '&:hover': { bgcolor: T.tealHover },
              '&.Mui-disabled': { bgcolor: T.tealBg, color: T.textFaint },
            }}
          >
            {dobLoading ? <CircularProgress size={18} color="inherit" /> : 'Save & Continue'}
          </Button>
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default Login;
