import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  TextField,
  Typography,
} from '@mui/material';
import {
  Close as CloseIcon,
  Visibility,
  VisibilityOff,
  WarningAmberRounded as WarningIcon,
} from '@mui/icons-material';
import { useT } from '@shared/theme';
import { notify } from '@shared/notify';
import { useAuth } from '@features/auth/context/Authentication';
import { deleteMyAccount } from './api/accountApi';

/**
 * Self-service account deletion.
 *
 * The friction here is deliberate. This wipes a document wallet holding government IDs and a
 * password vault, so holding a valid session is not on its own enough proof of intent — an
 * unattended laptop should not be one click away from destroying all of it. The user re-enters
 * their password AND types their email back.
 *
 * Google-only accounts have no password to re-enter, so the typed email is what confirms them.
 */
export default function DeleteAccountDialog({ open, onClose, email, hasPassword = true }) {
  const T = useT();
  const { logout } = useAuth();

  const [password, setPassword] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) {
      setPassword('');
      setConfirmEmail('');
      setShowPassword(false);
      setError('');
    }
  }, [open]);

  const emailMatches = useMemo(
    () => Boolean(email) && confirmEmail.trim().toLowerCase() === email.trim().toLowerCase(),
    [confirmEmail, email]
  );

  const canSubmit = emailMatches && (!hasPassword || password.length > 0) && !submitting;

  const handleDelete = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError('');
    try {
      const result = await deleteMyAccount({
        password: hasPassword ? password : undefined,
        confirmEmail: confirmEmail.trim(),
      });

      notify.success('Your account has been deleted.');
      onClose?.();

      // The backend has already revoked every session, so the local state is stale either way.
      // Going through logout() also clears the encrypted offline vault snapshot from this device.
      await logout();

      // Surfaced after the redirect so the user knows the deletion is still reversible.
      if (result?.purgeAfter) {
        notify.info(
          `Sign in again before ${new Date(result.purgeAfter).toLocaleDateString()} to restore your account.`
        );
      }
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not delete your account. Please try again.');
      setSubmitting(false);
    }
  }, [canSubmit, confirmEmail, hasPassword, logout, onClose, password]);

  return (
    <Dialog
      open={open}
      onClose={submitting ? undefined : onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{ sx: { bgcolor: T.sidebar, border: `1px solid ${T.glassBorder}`, borderRadius: 3 } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningIcon sx={{ color: T.red ?? '#ef4444' }} />
          <Typography sx={{ fontWeight: 700, color: T.text, fontSize: '1rem' }}>
            Delete your account
          </Typography>
        </Box>
        <IconButton
          size="small"
          onClick={onClose}
          disabled={submitting}
          sx={{ color: T.textMuted, '&:hover': { color: T.text } }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        <Alert
          severity="warning"
          icon={false}
          sx={{ mb: 2.5, bgcolor: 'transparent', border: `1px solid ${T.red ?? '#ef4444'}`, color: T.text }}
        >
          <AlertTitle sx={{ fontWeight: 700, fontSize: '0.875rem' }}>This erases your data</AlertTitle>
          <Typography sx={{ fontSize: '0.8125rem', color: T.textMuted }}>
            Your document wallet, saved passwords, watch history and requests will be permanently
            deleted. You have <strong>30 days</strong> to change your mind — signing in again
            before then restores everything.
          </Typography>
        </Alert>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {hasPassword && (
          <TextField
            fullWidth
            type={showPassword ? 'text' : 'password'}
            label="Your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={submitting}
            autoComplete="current-password"
            sx={{ mb: 2 }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setShowPassword(p => !p)} sx={{ color: T.textMuted }}>
                    {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        )}

        <TextField
          fullWidth
          label="Type your email to confirm"
          placeholder={email}
          value={confirmEmail}
          onChange={(e) => setConfirmEmail(e.target.value)}
          disabled={submitting}
          autoComplete="off"
          error={confirmEmail.length > 0 && !emailMatches}
          helperText={
            confirmEmail.length > 0 && !emailMatches
              ? 'This does not match your account email.'
              : ' '
          }
        />
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button
          onClick={onClose}
          disabled={submitting}
          sx={{ color: T.textMuted, textTransform: 'none', fontWeight: 600 }}
        >
          Cancel
        </Button>
        <Button
          onClick={handleDelete}
          disabled={!canSubmit}
          sx={{
            px: 2.5,
            bgcolor: T.red ?? '#ef4444',
            color: '#fff',
            textTransform: 'none',
            fontWeight: 700,
            borderRadius: 1.7,
            '&:hover': { bgcolor: T.redDark ?? '#dc2626' },
            '&.Mui-disabled': { bgcolor: T.glassBorder, color: T.textFaint },
          }}
        >
          {submitting ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : 'Delete my account'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
