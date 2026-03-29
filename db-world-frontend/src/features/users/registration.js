import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box, Button, Checkbox, CircularProgress, FormControl, FormHelperText,
  Grid, IconButton, InputAdornment, MenuItem,
  TextField, Typography, Avatar, Divider,
} from '@mui/material';
import {
  Person as PersonIcon,
  Email as EmailIcon,
  Lock as LockIcon,
  Phone as PhoneIcon,
  CalendarToday as CalendarIcon,
  HowToReg as RegisterIcon,
  ArrowBack as ArrowBackIcon,
  Visibility,
  VisibilityOff,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import Constants from '@shared/constants';
import { register } from '@shared/services/ApiServices';
import { toast } from '@shared/components/ui/Toast';
import db_world_icon from '@assets/images/db_world_teal.svg';
import { useT, getFieldSx, getSelectMenuProps, getGlowProps } from '@shared/theme';

// ─── Section label ────────────────────────────────────────────────────────────
const SectionLabel = ({ children }) => {
  const T = useT();
  return (
    <Typography sx={{
      fontSize: '0.68rem', fontWeight: 700, color: T.textFaint,
      textTransform: 'uppercase', letterSpacing: '0.1em',
      mt: 2, mb: 1.5,
    }}>
      {children}
    </Typography>
  );
};

const Registration = () => {
  const navigate  = useNavigate();
  const location  = useLocation();
  const T            = useT();
  const FIELD        = getFieldSx(T);
  const SELECT_MENU  = getSelectMenuProps(T);
  const GLOW         = getGlowProps(T);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState({
    firstName: '', lastName: '', gender: '', dob: '',
    mobileNo: '', email: '', password: '', agreeCheckBox: false,
  });
  const [errors, setErrors] = useState({
    firstName: false, lastName: false, gender: false, dob: false,
    mobileNo: false, email: false, password: false, agreeCheckBox: false,
  });

  // ── Validation ───────────────────────────────────────────────────────────
  const validateField = (name, value) => {
    let ok = true;
    switch (name) {
      case 'firstName':
      case 'lastName':
        ok = !!value && !/[ ]{2,}/.test(value);
        break;
      case 'dob': {
        const pattern = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/;
        const year = value?.split('-')[0];
        const now  = new Date().getFullYear();
        ok = !!value && pattern.test(value) && year >= 1900 && year <= now;
        break;
      }
      case 'gender':
        ok = !!value;
        break;
      case 'mobileNo':
        ok = /^[0-9]{10}$/.test(value);
        break;
      case 'email':
        ok = !!value && !/\s/.test(value) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
        break;
      case 'password':
        ok = !!value && !/\s/.test(value) && value.length >= 6;
        break;
      case 'agreeCheckBox':
        ok = !!value;
        break;
      default:
        break;
    }
    setErrors(p => ({ ...p, [name]: !ok }));
    return ok;
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const fieldValue = type === 'checkbox' ? checked : value;
    setFormData(p => ({ ...p, [name]: fieldValue }));
    validateField(name, fieldValue);
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    const isValid = Object.entries(formData).every(([k, v]) => validateField(k, v));
    if (!isValid) {
      toast.warning('Please fill all required fields correctly.');
      return;
    }
    setLoading(true);
    try {
      const { firstName, lastName, gender, dob, mobileNo, email, password } = formData;
      const res = await register({ firstName, lastName, gender, dob, mobileNo, email, password });
      if (res.httpStatusCode === 200 || res.httpStatusCode === 201) {
        toast.success('Account created! Redirecting to sign in…', {
          autoClose: 1200,
          onClose: () => navigate(Constants.LOGIN_ROUTE, { state: { from: location } }),
        });
      } else {
        toast.error(res?.message || res?.error || 'Registration failed.');
      }
    } catch {
      toast.error('An error occurred during registration.');
    } finally {
      setLoading(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Box sx={{
      minHeight: '100vh',
      bgcolor: T.bg,
      background: T.bgGradient,
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      px: 2,
      pt: { xs: 'calc(56px + 24px)', md: 'calc(64px + 40px)' },
      pb: { xs: 3, md: 5 },
      position: 'relative',
    }}>
      {/* Radial glow */}
      <motion.div {...GLOW} />

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 700 }}
      >
        <Box sx={{
          bgcolor: T.glass,
          border: `1px solid ${T.glassBorder}`,
          borderRadius: 3,
          p: { xs: 3, sm: 4 },
          backdropFilter: 'blur(20px)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
        }}>

          {/* Brand header */}
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 4 }}>
            <Avatar
              src={db_world_icon}
              sx={{
                width: 48, height: 48,
                bgcolor: T.tealBg,
                border: `1px solid ${T.teal}`,
                boxShadow: `0 0 22px ${T.tealGlow}`,
                mb: 2,
              }}
            />
            <Typography sx={{ fontWeight: 800, color: T.text, fontSize: '1.4rem', letterSpacing: '-0.02em' }}>
              Create your account
            </Typography>
            <Typography sx={{ color: T.textMuted, fontSize: '0.875rem', mt: 0.5 }}>
              Join DB World — it only takes a minute
            </Typography>
          </Box>

          {/* Form */}
          <Box component="form" onSubmit={handleSubmit} noValidate>

            {/* ── Personal info ────────────────────────────────────────────── */}
            <SectionLabel>Personal information</SectionLabel>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth label="First name" name="firstName"
                  value={formData.firstName} onChange={handleChange}
                  error={errors.firstName}
                  helperText={errors.firstName ? 'First name is required' : ''}
                  InputProps={{ startAdornment: (
                    <InputAdornment position="start">
                      <PersonIcon sx={{ fontSize: 18, color: errors.firstName ? T.error : T.textMuted }} />
                    </InputAdornment>
                  )}}
                  sx={FIELD}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth label="Last name" name="lastName"
                  value={formData.lastName} onChange={handleChange}
                  error={errors.lastName}
                  helperText={errors.lastName ? 'Last name is required' : ''}
                  InputProps={{ startAdornment: (
                    <InputAdornment position="start">
                      <PersonIcon sx={{ fontSize: 18, color: errors.lastName ? T.error : T.textMuted }} />
                    </InputAdornment>
                  )}}
                  sx={FIELD}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  select
                  fullWidth
                  label="Gender"
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                  error={errors.gender}
                  helperText={errors.gender ? 'Please select a gender' : ''}
                  SelectProps={{ MenuProps: SELECT_MENU }}
                  sx={FIELD}
                >
                  <MenuItem value=""><em style={{ color: T.textFaint }}>Select gender</em></MenuItem>
                  <MenuItem value="male">Male</MenuItem>
                  <MenuItem value="female">Female</MenuItem>
                  <MenuItem value="other">Prefer not to say</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth label="Date of birth" name="dob" type="date"
                  value={formData.dob} onChange={handleChange}
                  InputLabelProps={{ shrink: true }}
                  error={errors.dob}
                  helperText={errors.dob ? 'Enter a valid date' : ''}
                  InputProps={{ startAdornment: (
                    <InputAdornment position="start">
                      <CalendarIcon sx={{ fontSize: 18, color: errors.dob ? T.error : T.textMuted }} />
                    </InputAdornment>
                  )}}
                  sx={FIELD}
                />
              </Grid>
            </Grid>

            {/* ── Contact ──────────────────────────────────────────────────── */}
            <SectionLabel>Contact &amp; security</SectionLabel>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth label="Mobile number" name="mobileNo"
                  value={formData.mobileNo} onChange={handleChange}
                  error={errors.mobileNo}
                  helperText={errors.mobileNo ? '10-digit number required' : ''}
                  InputProps={{ startAdornment: (
                    <InputAdornment position="start">
                      <PhoneIcon sx={{ fontSize: 18, color: errors.mobileNo ? T.error : T.textMuted }} />
                    </InputAdornment>
                  )}}
                  sx={FIELD}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth label="Email address" name="email" type="email"
                  value={formData.email} onChange={handleChange}
                  autoComplete="email"
                  error={errors.email}
                  helperText={errors.email ? 'Enter a valid email address' : ''}
                  InputProps={{ startAdornment: (
                    <InputAdornment position="start">
                      <EmailIcon sx={{ fontSize: 18, color: errors.email ? T.error : T.textMuted }} />
                    </InputAdornment>
                  )}}
                  sx={FIELD}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth label="Password (min 6 characters)" name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password} onChange={handleChange}
                  autoComplete="new-password"
                  error={errors.password}
                  helperText={errors.password ? 'Minimum 6 characters, no spaces' : ''}
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
                          sx={{ color: T.textMuted, '&:hover': { color: T.text } }}
                        >
                          {showPassword
                            ? <VisibilityOff sx={{ fontSize: 18 }} />
                            : <Visibility sx={{ fontSize: 18 }} />
                          }
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                  sx={FIELD}
                />
              </Grid>
            </Grid>

            {/* ── Terms ────────────────────────────────────────────────────── */}
            <FormControl error={errors.agreeCheckBox} sx={{ mt: 1, mb: 3, display: 'block' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Checkbox
                  name="agreeCheckBox"
                  checked={formData.agreeCheckBox}
                  onChange={handleChange}
                  sx={{
                    color: errors.agreeCheckBox ? T.error : T.textMuted,
                    '&.Mui-checked': { color: T.teal },
                    p: 0.5,
                  }}
                />
                <Typography sx={{ fontSize: '0.875rem', color: T.textMuted }}>
                  I agree to the{' '}
                  <Box component="span" sx={{ color: T.teal, cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}>
                    terms and conditions
                  </Box>
                  <Box component="span" sx={{ color: T.error }}> *</Box>
                </Typography>
              </Box>
              {errors.agreeCheckBox && (
                <FormHelperText sx={{ color: T.error, ml: 0, mt: 0.5 }}>
                  You must accept the terms to continue
                </FormHelperText>
              )}
            </FormControl>

            {/* ── Buttons ──────────────────────────────────────────────────── */}
            <Button
              type="submit"
              fullWidth
              disabled={loading || !formData.agreeCheckBox}
              startIcon={!loading && <RegisterIcon />}
              sx={{
                py: 1.4, mb: 1.5,
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
                ? <><CircularProgress size={18} color="inherit" sx={{ mr: 1 }} />Creating account…</>
                : 'Create account'
              }
            </Button>
          </Box>

          {/* ── Back to login ────────────────────────────────────────────── */}
          <Divider sx={{ borderColor: T.border, mb: 2 }} />
          <Button
            fullWidth
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate(Constants.LOGIN_ROUTE)}
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
            Already have an account? Sign in
          </Button>

        </Box>
      </motion.div>
    </Box>
  );
};

export default Registration;
