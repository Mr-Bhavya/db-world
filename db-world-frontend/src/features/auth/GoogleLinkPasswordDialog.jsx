import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
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
import { LockRounded, Visibility, VisibilityOff } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import Constants from '@shared/constants';
import { useT } from '@shared/theme';
import { linkGoogleWithPassword } from './api/recoveryApi';

/**
 * Asks for the account password so a Google identity can be attached to it.
 *
 * Shown only when the server refuses to auto-link, which it does when the matching account has
 * a password and an address nobody ever verified. In that state the email proves the caller
 * owns the mailbox but not the account, and those are not the same thing — anyone can register
 * against an address they do not own, so linking on the match alone would drop the real mailbox
 * owner into a stranger's account.
 *
 * The escape hatch matters as much as the form: if the password is not theirs, the account is
 * not theirs either, and a reset from their own mailbox is how they take it back.
 */
export default function GoogleLinkPasswordDialog({ open, idToken, email, onClose, onLinked }) {
  const T = useT();
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) {
      setPassword('');
      setShowPassword(false);
      setError('');
    }
  }, [open]);

  const handleSubmit = useCallback(async (event) => {
    event.preventDefault();
    if (loading || !password) return;
    setLoading(true);
    setError('');
    try {
      const payload = await linkGoogleWithPassword(idToken, password);
      onLinked?.(payload);
    } catch (err) {
      setError(err?.response?.data?.message || 'That password is not correct.');
      setLoading(false);
    }
  }, [idToken, loading, onLinked, password]);

  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{ sx: { bgcolor: T.sidebar, border: `1px solid ${T.glassBorder}`, borderRadius: 3 } }}
    >
      <DialogTitle sx={{ pb: 0.5 }}>
        <Typography sx={{ fontWeight: 800, color: T.textPrimary, fontSize: '1.05rem' }}>
          Connect Google to your account
        </Typography>
      </DialogTitle>

      <Box component="form" onSubmit={handleSubmit} noValidate>
        <DialogContent sx={{ pt: 1 }}>
          <Typography sx={{ fontSize: '0.86rem', color: T.textMuted, lineHeight: 1.6, mb: 2 }}>
            An account already exists for <strong>{email}</strong>. Enter its password once to
            connect Google — you will not be asked again.
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 2, bgcolor: T.errorBg,
                                          color: T.error, border: `1px solid ${T.error}33` }}>
              {error}
            </Alert>
          )}

          <TextField
            fullWidth
            type={showPassword ? 'text' : 'password'}
            label="Account password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            autoComplete="current-password"
            autoFocus
            helperText=" "
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

          <Button
            onClick={() => { onClose?.(); navigate(Constants.RESET_PASSWORD_ROUTE); }}
            disabled={loading}
            sx={{ fontSize: '0.8rem', fontWeight: 700, color: T.textMuted, p: 0.5,
                  textTransform: 'none', '&:hover': { color: T.teal, bgcolor: 'transparent' } }}
          >
            Not your password? Reset it
          </Button>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button
            onClick={onClose}
            disabled={loading}
            sx={{ color: T.textMuted, textTransform: 'none', fontWeight: 700 }}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={loading || !password}
            sx={{ px: 2.5, minHeight: 42, borderRadius: 2, textTransform: 'none', fontWeight: 800,
                  bgcolor: T.teal, '&:hover': { bgcolor: T.tealHover },
                  '&.Mui-disabled': { bgcolor: T.tealBg, color: T.textFaint } }}
          >
            {loading ? <CircularProgress size={18} color="inherit" /> : 'Connect'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
