import React, { useState } from 'react';
import { useLocation, useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Box, Button, Checkbox, CircularProgress, FormControl, FormHelperText,
  Grid, IconButton, InputAdornment, MenuItem, TextField, Typography,
} from '@mui/material';
import {
  CalendarTodayRounded, EmailRounded, LockRounded, PersonRounded, PhoneRounded,
  Visibility, VisibilityOff,
} from '@mui/icons-material';
import { motion, useReducedMotion } from 'framer-motion';

import Constants from '@shared/constants';
import { register } from '@shared/services/ApiServices';
import { notify } from '@shared/notify';
import db_world_icon from '@assets/images/db-circle-icon.webp';
import usePageMeta from '@shared/hooks/usePageMeta';
import { useT, getFieldSx, getSelectMenuProps } from '@shared/theme';
import { Aurora, GlassPanel } from '@shared/ui/surfaces';

/**
 * The `/registration` route.
 *
 * The only way to create an account: the sign-in modal deliberately links out here rather than
 * trying to fit seven fields, a date picker and a terms checkbox into a dialog. Every new account
 * comes through this page, which makes it the auth flow's most important screen, not its least.
 *
 * Ordered account-first. The two fields that *make* the account — email and password — come
 * before the four that describe its owner, so the page opens on the same two inputs the visitor
 * just saw in the sign-in panel they clicked out of, rather than on a wall of personal details.
 */

/** Small caption dividing the form into two readable halves. */
const SectionLabel = ({ children, first = false }) => {
  const T = useT();
  return (
    <Typography sx={{
      fontSize: '0.66rem', fontWeight: 800, color: T.textFaint,
      textTransform: 'uppercase', letterSpacing: '0.09em',
      mt: first ? 0 : 2.5, mb: 1.5,
    }}>
      {children}
    </Typography>
  );
};

const GENDERS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Prefer not to say' },
];

const Registration = () => {
  usePageMeta('Create Account', { description: 'Create your free DB World account.' });

  const navigate = useNavigate();
  // Whatever the visitor was originally trying to reach, handed over by the sign-in modal or the
  // login page. Passed straight back so signing in afterwards returns them there rather than
  // dumping them on the hub.
  const location = useLocation();
  const T = useT();
  const FIELD = getFieldSx(T);
  const SELECT_MENU = getSelectMenuProps(T);
  const reduce = useReducedMotion();

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
      notify.warning('Please fill all required fields correctly.');
      return;
    }
    setLoading(true);
    try {
      const { firstName, lastName, gender, dob, mobileNo, email, password } = formData;
      const res = await register({ firstName, lastName, gender, dob, mobileNo, email, password });
      if (res.httpStatusCode === 200 || res.httpStatusCode === 201) {
        notify.success('Account created! Redirecting to sign in…', {
          duration: 1200,
          onClose: () => navigate(Constants.LOGIN_ROUTE, { state: location.state }),
        });
      } else {
        notify.error(res?.message || res?.error || 'Registration failed.');
      }
    } catch {
      notify.error('An error occurred during registration.');
    } finally {
      setLoading(false);
    }
  };

  // ── Shared field props ────────────────────────────────────────────────────

  /**
   * Every field reserves its helper line whether or not it is in error, so validating as you type
   * cannot shunt the rest of the form down the page under your cursor.
   */
  const helper = (field, message) => (errors[field] ? message : ' ');

  const adornment = (Icon, field) => ({
    startAdornment: (
      <InputAdornment position="start">
        <Icon sx={{ fontSize: 18, color: errors[field] ? T.error : T.textMuted }} />
      </InputAdornment>
    ),
  });

  return (
    <Box sx={{
      position: 'relative',
      minHeight: '100dvh',
      bgcolor: T.bg,
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      px: { xs: 2, sm: 3 },
      pt: { xs: 'calc(56px + 24px)', md: 'calc(64px + 40px)' },
      pb: { xs: 3, md: 5 },
      overflowX: 'hidden',
    }}>
      <Aurora />

      <Box
        component={motion.div}
        initial={reduce ? false : { opacity: 0, y: 22 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
        sx={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 640, minWidth: 0 }}
      >
        <GlassPanel sx={{ p: { xs: 2.5, sm: 4 } }}>

          {/* Brand header — the same shape as the sign-in panel, so the two read as one flow. */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
            <Box
              component="img"
              src={db_world_icon}
              alt=""
              sx={{ width: 44, height: 44, borderRadius: '50%', flexShrink: 0 }}
            />
            <Box sx={{ minWidth: 0 }}>
              <Typography component="h1" sx={{ fontSize: '1.3rem', fontWeight: 900, color: T.textPrimary, letterSpacing: '-0.02em', lineHeight: 1.15 }}>
                Create your account
              </Typography>
              <Typography sx={{ color: T.textMuted, fontSize: '0.84rem', mt: 0.25 }}>
                Free, and it takes about a minute.
              </Typography>
            </Box>
          </Box>

          <Box component="form" onSubmit={handleSubmit} noValidate>

            {/* ── Account ──────────────────────────────────────────────────── */}
            <SectionLabel first>Your account</SectionLabel>
            <Grid container spacing={2}>
              <Grid size={12}>
                <TextField
                  fullWidth label="Email address" name="email" type="email"
                  value={formData.email} onChange={handleChange}
                  autoComplete="email"
                  error={errors.email}
                  helperText={helper('email', 'Enter a valid email address')}
                  slotProps={{ input: adornment(EmailRounded, 'email') }}
                  sx={FIELD}
                />
              </Grid>
              <Grid size={12}>
                <TextField
                  fullWidth label="Password" name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password} onChange={handleChange}
                  autoComplete="new-password"
                  error={errors.password}
                  // Standing guidance rather than only an error: the rule is worth knowing before
                  // you have broken it.
                  helperText={errors.password ? 'Minimum 6 characters, no spaces' : 'At least 6 characters, no spaces'}
                  slotProps={{
                    input: {
                      ...adornment(LockRounded, 'password'),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            size="small"
                            onClick={() => setShowPassword(p => !p)}
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                            sx={{ color: T.textMuted, '&:hover': { color: T.text } }}
                          >
                            {showPassword
                              ? <VisibilityOff sx={{ fontSize: 18 }} />
                              : <Visibility sx={{ fontSize: 18 }} />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    },
                  }}
                  sx={FIELD}
                />
              </Grid>
            </Grid>

            {/* ── About you ────────────────────────────────────────────────── */}
            <SectionLabel>About you</SectionLabel>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth label="First name" name="firstName"
                  value={formData.firstName} onChange={handleChange}
                  autoComplete="given-name"
                  error={errors.firstName}
                  helperText={helper('firstName', 'First name is required')}
                  slotProps={{ input: adornment(PersonRounded, 'firstName') }}
                  sx={FIELD}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth label="Last name" name="lastName"
                  value={formData.lastName} onChange={handleChange}
                  autoComplete="family-name"
                  error={errors.lastName}
                  helperText={helper('lastName', 'Last name is required')}
                  slotProps={{ input: adornment(PersonRounded, 'lastName') }}
                  sx={FIELD}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth label="Date of birth" name="dob" type="date"
                  value={formData.dob} onChange={handleChange}
                  autoComplete="bday"
                  error={errors.dob}
                  helperText={helper('dob', 'Enter a valid date')}
                  slotProps={{
                    inputLabel: { shrink: true },
                    input: adornment(CalendarTodayRounded, 'dob'),
                  }}
                  sx={FIELD}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  select
                  fullWidth
                  label="Gender"
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                  error={errors.gender}
                  helperText={helper('gender', 'Please select an option')}
                  slotProps={{ select: { MenuProps: SELECT_MENU } }}
                  sx={FIELD}
                >
                  {GENDERS.map((option) => (
                    <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid size={12}>
                <TextField
                  fullWidth label="Mobile number" name="mobileNo" type="tel"
                  value={formData.mobileNo} onChange={handleChange}
                  autoComplete="tel-national"
                  error={errors.mobileNo}
                  helperText={helper('mobileNo', '10-digit number required')}
                  slotProps={{ input: adornment(PhoneRounded, 'mobileNo') }}
                  sx={FIELD}
                />
              </Grid>
            </Grid>

            {/* ── Terms ────────────────────────────────────────────────────── */}
            <FormControl error={errors.agreeCheckBox} sx={{ mt: 1, mb: 2.5, display: 'block' }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                <Checkbox
                  name="agreeCheckBox"
                  checked={formData.agreeCheckBox}
                  onChange={handleChange}
                  sx={{
                    color: errors.agreeCheckBox ? T.error : T.textMuted,
                    '&.Mui-checked': { color: T.teal },
                    p: 0.5,
                    mt: -0.25,
                  }}
                />
                <Typography sx={{ fontSize: '0.84rem', color: T.textMuted, lineHeight: 1.6 }}>
                  I agree to the{' '}
                  {/* Real links, opened in a new tab so a half-filled form is not lost
                      on the way to reading them. Both are public routes, so a visitor
                      can read them BEFORE starting to sign up too. */}
                  <Box
                    component={RouterLink}
                    to={Constants.DB_TERMS_ROUTE}
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{ color: T.teal, fontWeight: 700, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                  >
                    Terms of Service
                  </Box>
                  {' '}and{' '}
                  <Box
                    component={RouterLink}
                    to={Constants.DB_PRIVACY_ROUTE}
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{ color: T.teal, fontWeight: 700, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                  >
                    Privacy Policy
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

            <Button
              type="submit"
              fullWidth
              variant="contained"
              disabled={loading || !formData.agreeCheckBox}
              sx={{
                bgcolor: T.teal,
                color: '#fff',
                fontWeight: 800,
                minHeight: 48,
                borderRadius: 2.5,
                boxShadow: `0 12px 32px ${T.tealGlow}`,
                '&:hover': { bgcolor: T.tealHover },
                '&.Mui-disabled': { bgcolor: T.tealBg, color: T.textFaint, boxShadow: 'none' },
              }}
            >
              {loading
                ? <CircularProgress size={20} color="inherit" />
                : 'Create account'}
            </Button>
          </Box>

          {/* Mirrors the sign-in panel's footer rather than a bordered button — the two screens
              link to each other and should not disagree about what that link looks like. */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.75, mt: 2.5 }}>
            <Typography sx={{ fontSize: '0.85rem', color: T.textMuted }}>
              Already have an account?
            </Typography>
            <Button
              onClick={() => navigate(Constants.LOGIN_ROUTE, { state: location.state })}
              sx={{ fontSize: '0.85rem', fontWeight: 800, color: T.teal, minWidth: 0, p: 0.5, '&:hover': { bgcolor: T.tealBg } }}
            >
              Sign in
            </Button>
          </Box>

        </GlassPanel>
      </Box>
    </Box>
  );
};

export default Registration;
