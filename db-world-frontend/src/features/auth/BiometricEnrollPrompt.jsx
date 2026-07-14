import React, { useEffect, useState } from 'react';
import { Box, Button, Dialog, Typography } from '@mui/material';
import FingerprintIcon from '@mui/icons-material/Fingerprint';
import { useSnackbar } from 'notistack';
import { useT } from '@shared/theme';
import { useAuth } from '@features/auth/context/Authentication';
import { PERMISSIONS_ONBOARDED_KEY } from '@shared/components/PermissionOnboardingGate';
import { isBiometricAvailable, isBiometricEnabled, enableBiometric } from '@platform/android/biometric';

const PROMPTED_KEY = 'dbworld_biometric_prompted';

/**
 * One-time offer to turn on fingerprint/face unlock, shown after login on a native device that has
 * biometrics enrolled and hasn't been set up yet. Deferred until after the permission onboarding so
 * the two first-run dialogs don't stack. Dismissing (or enabling) marks it done. No-op on web.
 */
export default function BiometricEnrollPrompt() {
  const T = useT();
  const { auth } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!auth.isAuthenticated) return undefined;
    if (isBiometricEnabled()) return undefined;
    if (localStorage.getItem(PROMPTED_KEY)) return undefined;
    // Let the permission onboarding go first (avoid two stacked first-run dialogs).
    if (!localStorage.getItem(PERMISSIONS_ONBOARDED_KEY)) return undefined;
    isBiometricAvailable().then(({ available }) => { if (!cancelled && available) setOpen(true); });
    return () => { cancelled = true; };
  }, [auth.isAuthenticated]);

  const markPrompted = () => { try { localStorage.setItem(PROMPTED_KEY, '1'); } catch { /* best-effort */ } };
  const dismiss = () => { markPrompted(); setOpen(false); };

  const enable = async () => {
    setBusy(true);
    try {
      await enableBiometric();
      enqueueSnackbar('Fingerprint/face unlock enabled', { variant: 'success' });
      markPrompted();
      setOpen(false);
    } catch (_e) {
      enqueueSnackbar('Could not enable biometric unlock', { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <Dialog open onClose={dismiss}
      PaperProps={{ sx: { bgcolor: T.bg, color: T.text, borderRadius: 3, maxWidth: 400, m: 2 } }}>
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <FingerprintIcon sx={{ fontSize: 48, color: T.teal, mb: 1 }} />
        <Typography variant="h6" sx={{ fontWeight: 800 }}>Faster, safer sign-in</Typography>
        <Typography sx={{ color: T.textMuted, mt: 1, fontSize: 14 }}>
          Use your fingerprint or face to unlock DB World next time, instead of typing your password.
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', mt: 3 }}>
          <Button onClick={dismiss} disabled={busy} sx={{ color: T.textMuted, textTransform: 'none' }}>Not now</Button>
          <Button onClick={enable} disabled={busy} variant="contained"
            sx={{ bgcolor: T.teal, textTransform: 'none', fontWeight: 700, px: 3, '&:hover': { bgcolor: T.tealHover } }}>
            {busy ? 'Enabling…' : 'Enable'}
          </Button>
        </Box>
      </Box>
    </Dialog>
  );
}
