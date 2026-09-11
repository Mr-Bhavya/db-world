import React, { useCallback, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  InputAdornment,
  TextField,
  Typography,
} from '@mui/material';
import {
  CheckCircleRounded,
  LockRounded,
  Visibility,
  VisibilityOff,
} from '@mui/icons-material';
import Constants from '@shared/constants';
import usePageMeta from '@shared/hooks/usePageMeta';
import { useT, getFieldSx } from '@shared/theme';
import AuthPageShell from './AuthPageShell';
import { forgotPassword, resetPassword } from './api/recoveryApi';

/**
 * `/reset-password` — both halves of the forgotten-password flow.
 *
 * With no `?token=` it asks for an email and sends a link; with one it takes the new password.
 * One route rather than two because they are one journey, and because someone whose link has
 * expired needs to request another without hunting for a different page.
 */
export default function ResetPassword() {
  usePageMeta('Reset password', { description: 'Reset your DB World password.' });

  const T = useT();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [done, setDone] = useState(false);

  const mismatch = confirm.length > 0 && password !== confirm;
  const tooShort = password.length > 0 && password.length < 6;
  const canSubmit = password.length >= 6 && password === confirm && !loading;

  const heading = useMemo(() => {
    if (done) return 'Password updated';
    if (sent) return 'Check your email';
    return token ? 'Choose a new password' : 'Reset your password';
  }, [done, sent, token]);

  const handleRequest = useCallback(async (event) => {
    event.preventDefault();
    if (loading || !email.trim()) return;
    setLoading(true);
    setError('');
    try {
      await forgotPassword(email.trim());
      // Always the same outcome, even for an address with no account. The server gives no
      // signal either way, and inventing one here would leak which emails are registered.
      setSent(true);
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not send the email. Try again.');
    } finally {
      setLoading(false);
    }
  }, [email, loading]);

  const handleReset = useCallback(async (event) => {
    event.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError('');
    try {
      await resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(err?.response?.data?.message
        || 'This link is no longer valid. Request a new one.');
    } finally {
      setLoading(false);
    }
  }, [canSubmit, password, token]);

  /* ── Done ──────────────────────────────────────────────────────────── */
  if (done) {
    return (
      <AuthPageShell>
        <Box sx={{ textAlign: 'center' }}>
          <CheckCircleRounded sx={{ fontSize: 48, color: T.teal, mb: 1.5 }} />
          <Typography component="h1" sx={{ fontSize: '1.3rem', fontWeight: 900, color: T.textPrimary }}>
            {heading}
          </Typography>
          <Typography sx={{ fontSize: '0.88rem', color: T.textMuted, mt: 1, lineHeight: 1.6 }}>
            You have been signed out everywhere, including any device you did not recognise.
            Sign in with your new password.
          </Typography>
          <Button
            fullWidth
            variant="contained"
            onClick={() => navigate(Constants.LOGIN_ROUTE, { replace: true })}
            sx={{ mt: 3, minHeight: 46, borderRadius: 2, textTransform: 'none', fontWeight: 800,
                  bgcolor: T.teal, '&:hover': { bgcolor: T.tealHover } }}
          >
            Sign in
          </Button>
        </Box>
      </AuthPageShell>
    );
  }

  /* ── Link sent ─────────────────────────────────────────────────────── */
  if (sent) {
    return (
      <AuthPageShell>
        <Box sx={{ textAlign: 'center' }}>
          <Typography component="h1" sx={{ fontSize: '1.3rem', fontWeight: 900, color: T.textPrimary }}>
            {heading}
          </Typography>
          <Typography sx={{ fontSize: '0.88rem', color: T.textMuted, mt: 1, lineHeight: 1.6 }}>
            If <strong>{email.trim()}</strong> has an account, a reset link is on its way. It
            expires in an hour.
          </Typography>
          <Button
            fullWidth
            onClick={() => navigate(Constants.LOGIN_ROUTE)}
            sx={{ mt: 3, minHeight: 44, color: T.textMuted, fontWeight: 700, textTransform: 'none' }}
          >
            Back to sign in
          </Button>
        </Box>
      </AuthPageShell>
    );
  }

  /* ── Form ──────────────────────────────────────────────────────────── */
  return (
    <AuthPageShell>
      <Box component="form" onSubmit={token ? handleReset : handleRequest} noValidate>
        <Typography component="h1" sx={{ fontSize: '1.3rem', fontWeight: 900, color: T.textPrimary }}>
          {heading}
        </Typography>
        <Typography sx={{ fontSize: '0.84rem', color: T.textMuted, mt: 0.5, mb: 2.5, lineHeight: 1.6 }}>
          {token
            ? 'Choosing a new password signs you out on every device.'
            : 'We will email you a link to choose a new one.'}
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: 2, bgcolor: T.errorBg, color: T.error,
                                        border: `1px solid ${T.error}33` }}>
            {error}
          </Alert>
        )}

        {token ? (
          <>
            <TextField
              fullWidth
              type={showPassword ? 'text' : 'password'}
              label="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={tooShort}
              helperText={tooShort ? 'At least 6 characters.' : ' '}
              autoComplete="new-password"
              autoFocus
              sx={getFieldSx(T)}
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
                        onClick={() => setShowPassword((s) => !s)}
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
            />

            <TextField
              fullWidth
              type={showPassword ? 'text' : 'password'}
              label="Confirm new password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              error={mismatch}
              helperText={mismatch ? 'Passwords do not match.' : ' '}
              autoComplete="new-password"
              sx={getFieldSx(T)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockRounded sx={{ fontSize: 19, color: T.textMuted }} />
                    </InputAdornment>
                  ),
                },
              }}
            />
          </>
        ) : (
          <TextField
            fullWidth
            type="email"
            label="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            autoFocus
            helperText=" "
            sx={getFieldSx(T)}
          />
        )}

        <Button
          type="submit"
          fullWidth
          variant="contained"
          disabled={token ? !canSubmit : (loading || !email.trim())}
          sx={{ mt: 0.5, minHeight: 46, borderRadius: 2, textTransform: 'none', fontWeight: 800,
                bgcolor: T.teal, '&:hover': { bgcolor: T.tealHover },
                '&.Mui-disabled': { bgcolor: T.tealBg, color: T.textFaint } }}
        >
          {loading
            ? <CircularProgress size={20} color="inherit" />
            : (token ? 'Update password' : 'Email me a link')}
        </Button>

        <Button
          fullWidth
          onClick={() => navigate(Constants.LOGIN_ROUTE)}
          sx={{ mt: 1, minHeight: 44, color: T.textMuted, fontWeight: 700, textTransform: 'none' }}
        >
          Back to sign in
        </Button>
      </Box>
    </AuthPageShell>
  );
}
