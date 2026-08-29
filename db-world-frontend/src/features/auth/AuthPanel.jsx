import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert, Box, Button, CircularProgress, IconButton, InputAdornment, TextField, Typography,
} from '@mui/material';
import {
  ArrowForwardRounded, CalendarTodayRounded, EmailRounded, LockRounded, Visibility, VisibilityOff,
} from '@mui/icons-material';
import { motion, useReducedMotion } from 'framer-motion';

import { useAuth } from '@features/auth/context/Authentication';
import axiosInstance from '@shared/components/ui/utils/AxiosInstants';
import { updateDobForUser } from '@shared/services/ApiServices';
import Constants from '@shared/constants';
import db_world_icon from '@assets/images/db-circle-icon.webp';
import GoogleSignInButton from '@features/auth/GoogleSignInButton';
import { useT, getFieldSx } from '@shared/theme';

/**
 * The sign-in form itself — no surface of its own.
 *
 * Rendered in two shells: the `/login` route wraps it in a glass card, and the app-wide auth
 * modal drops it straight into its dialog. Keeping the surface out of here is what stops the
 * modal from being a card inside a card, and means the form is written and redesigned once.
 *
 * {@link onComplete} fires when the visitor is *fully* signed in — after the date-of-birth step,
 * not before it — so a shell can navigate or resume a held action without racing that step.
 */

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

const isValidEmail = (value) => Boolean(value) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

/** Anything without whitespace. The real strength rules are the server's to enforce. */
const isValidPassword = (value) => Boolean(value) && !/\s/.test(value);

const isValidDob = (value) => {
  const year = Number(value?.split('-')?.[0]);
  return (
    Boolean(value)
    && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && year >= 1900
    && year <= new Date().getFullYear()
  );
};

export default function AuthPanel({ reason, onComplete, onRegister, autoFocus = true }) {
  const T = useT();
  const FIELD = useMemo(() => getFieldSx(T), [T]);
  const reduce = useReducedMotion();
  const { login } = useAuth();

  const [step, setStep] = useState('credentials');
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({ email: false, password: false });
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [dob, setDob] = useState('');
  const [dobError, setDobError] = useState(false);
  const [dobLoading, setDobLoading] = useState(false);
  const [pendingUser, setPendingUser] = useState(null);

  const handleChange = useCallback((event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setLoginError('');
    setErrors((prev) => ({
      ...prev,
      [name]: name === 'email' ? !isValidEmail(value) : !isValidPassword(value),
    }));
  }, []);

  /**
   * Completes a sign-in, whatever produced it.
   *
   * Password and Google both land here so there is one place that decides the role, stores the
   * session and handles the date-of-birth step. Google accounts arrive without a date of birth,
   * so they hit the same second step a fresh registration does.
   *
   * `payload.refreshToken` is only present for native clients, which keep it in secure storage;
   * web receives an httpOnly cookie instead and it is undefined here.
   */
  const finishSignIn = useCallback((payload) => {
    const role = extractLoginRole(payload);
    if (!role) throw new Error('Unable to determine user role');

    login(payload.token, payload.user, role, payload.refreshToken);

    // Signed in either way — the date of birth is a second step, not a second gate.
    if (!payload.user.dob) {
      setPendingUser(payload.user);
      setStep('dob');
      return;
    }
    onComplete?.();
  }, [login, onComplete]);

  const handleSubmit = useCallback(async (event) => {
    event.preventDefault();
    if (loading) return;

    const email = formData.email.trim().toLowerCase();
    const { password } = formData;
    const emailOk = isValidEmail(email);
    const passwordOk = isValidPassword(password);

    setErrors({ email: !emailOk, password: !passwordOk });
    if (!emailOk || !passwordOk) return;

    setLoading(true);
    setLoginError('');

    try {
      const res = await axiosInstance.post('/api/auth/login', { email, password });
      const payload = res.data?.data;

      if (!payload?.token || !payload?.user) throw new Error('Unexpected response from server');

      finishSignIn(payload);
    } catch (err) {
      setLoginError(err.response?.data?.message || err.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  }, [finishSignIn, formData, loading]);

  const handleDobSubmit = useCallback(async (event) => {
    event.preventDefault();
    if (dobLoading) return;
    if (!isValidDob(dob)) { setDobError(true); return; }

    setDobLoading(true);
    try {
      await updateDobForUser(pendingUser, dob);
      // Keep the cached user in sync so the prompt doesn't reappear later this session.
      try {
        const stored = JSON.parse(localStorage.getItem('user') || 'null');
        if (stored) { stored.dob = dob; localStorage.setItem('user', JSON.stringify(stored)); }
      } catch { /* storage unavailable — the prompt reappearing is the whole cost */ }
      onComplete?.();
    } catch {
      setDobError(true);
    } finally {
      setDobLoading(false);
    }
  }, [dob, dobLoading, onComplete, pendingUser]);

  const primaryButtonSx = {
    bgcolor: T.teal,
    color: '#fff',
    fontWeight: 800,
    minHeight: 48,
    borderRadius: 2.5,
    boxShadow: `0 12px 32px ${T.tealGlow}`,
    '&:hover': { bgcolor: T.tealHover },
    '&.Mui-disabled': { bgcolor: T.tealBg, color: T.textFaint },
  };

  // -- Date of birth ---------------------------------------------------------

  if (step === 'dob') {
    return (
      <Box
        component={motion.form}
        onSubmit={handleDobSubmit}
        initial={reduce ? false : { opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      >
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Box
            sx={{
              width: 56, height: 56, mx: 'auto', mb: 2, borderRadius: '50%', display: 'grid',
              placeItems: 'center', bgcolor: T.tealBg, border: `1px solid ${T.teal}44`,
            }}
          >
            <CalendarTodayRounded sx={{ fontSize: 25, color: T.teal }} />
          </Box>
          <Typography sx={{ fontSize: '1.2rem', fontWeight: 900, color: T.textPrimary }}>
            One last thing
          </Typography>
          <Typography sx={{ fontSize: '0.88rem', color: T.textMuted, mt: 0.75, lineHeight: 1.6 }}>
            We need your date of birth to know which titles we can show you.
          </Typography>
        </Box>

        <TextField
          fullWidth
          type="date"
          name="dob"
          label="Date of birth"
          value={dob}
          onChange={(event) => { setDob(event.target.value); setDobError(false); }}
          error={dobError}
          helperText={dobError ? 'Enter a valid date of birth.' : ' '}
          autoComplete="bday"
          slotProps={{ inputLabel: { shrink: true } }}
          sx={FIELD}
        />

        <Button type="submit" fullWidth variant="contained" disabled={dobLoading} sx={{ ...primaryButtonSx, mt: 1 }}>
          {dobLoading ? <CircularProgress size={20} color="inherit" /> : 'Save and continue'}
        </Button>

        {/* Already authenticated at this point, so skipping costs the visitor nothing but an
            age-restricted catalog. Blocking here would strand someone who just signed in. */}
        <Button
          fullWidth
          onClick={() => onComplete?.()}
          sx={{ mt: 1, color: T.textMuted, fontWeight: 700, minHeight: 44, '&:hover': { color: T.textPrimary, bgcolor: T.hoverBg } }}
        >
          Skip for now
        </Button>
      </Box>
    );
  }

  // -- Credentials -----------------------------------------------------------

  return (
    <Box component="form" onSubmit={handleSubmit} noValidate>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
        <Box
          component="img"
          src={db_world_icon}
          alt=""
          sx={{ width: 44, height: 44, borderRadius: '50%', flexShrink: 0 }}
        />
        <Box sx={{ minWidth: 0 }}>
          <Typography component="h1" sx={{ fontSize: '1.3rem', fontWeight: 900, color: T.textPrimary, letterSpacing: '-0.02em', lineHeight: 1.15 }}>
            {reason ?? 'Welcome back'}
          </Typography>
          <Typography sx={{ fontSize: '0.84rem', color: T.textMuted, mt: 0.25 }}>
            {reason ? 'Sign in to continue.' : 'Sign in to your DB World account.'}
          </Typography>
        </Box>
      </Box>

      {loginError && (
        <Alert
          severity="error"
          sx={{
            mb: 2, borderRadius: 2, bgcolor: T.errorBg, color: T.error,
            border: `1px solid ${T.error}33`, '& .MuiAlert-icon': { color: T.error },
          }}
        >
          {loginError}
        </Alert>
      )}

      <TextField
        fullWidth
        name="email"
        type="email"
        label="Email address"
        value={formData.email}
        onChange={handleChange}
        error={errors.email}
        helperText={errors.email ? 'Enter a valid email address.' : ' '}
        autoFocus={autoFocus}
        // Spelled out so password managers recognise the pair and offer to fill it. A dialog is
        // fine for them; an input they cannot classify is not.
        autoComplete="email"
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <EmailRounded sx={{ fontSize: 19, color: T.textMuted }} />
              </InputAdornment>
            ),
          },
        }}
        sx={FIELD}
      />

      <TextField
        fullWidth
        name="password"
        type={showPassword ? 'text' : 'password'}
        label="Password"
        value={formData.password}
        onChange={handleChange}
        error={errors.password}
        helperText={errors.password ? 'Password cannot contain spaces.' : ' '}
        autoComplete="current-password"
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <LockRounded sx={{ fontSize: 19, color: T.textMuted }} />
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  onClick={() => setShowPassword((shown) => !shown)}
                  edge="end"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  sx={{ color: T.textMuted }}
                >
                  {showPassword ? <VisibilityOff sx={{ fontSize: 19 }} /> : <Visibility sx={{ fontSize: 19 }} />}
                </IconButton>
              </InputAdornment>
            ),
          },
        }}
        sx={FIELD}
      />

      <Button
        type="submit"
        fullWidth
        variant="contained"
        disabled={loading}
        endIcon={loading ? null : <ArrowForwardRounded />}
        sx={{ ...primaryButtonSx, mt: 0.5 }}
      >
        {loading ? <CircularProgress size={20} color="inherit" /> : 'Sign in'}
      </Button>

      <GoogleSignInButton
        onSuccess={finishSignIn}
        onError={(message) => setLoginError(message ?? '')}
      />

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.75, mt: 2.5 }}>
        <Typography sx={{ fontSize: '0.85rem', color: T.textMuted }}>
          New to DB World?
        </Typography>
        <Button
          onClick={onRegister}
          sx={{ fontSize: '0.85rem', fontWeight: 800, color: T.teal, minWidth: 0, p: 0.5, '&:hover': { bgcolor: T.tealBg } }}
        >
          Create an account
        </Button>
      </Box>
    </Box>
  );
}
