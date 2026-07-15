import React, { useEffect, useState } from 'react';
import { Box, Button, Dialog, Drawer, Typography, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { notify } from '@shared/notify';
import { useT } from '@shared/theme';
import { haptic } from '@shared/platform/platform';
import { useAuth } from '@features/auth/context/Authentication';
import { PERMISSIONS_ONBOARDED_KEY } from '@shared/components/PermissionOnboardingGate';
import { isBiometricAvailable, isBiometricEnabled, enableBiometric } from '@platform/android/biometric';
import FingerprintPulse from './components/FingerprintPulse';

const PROMPTED_KEY = 'dbworld_biometric_prompted';

/**
 * One-time offer to turn on fingerprint/face unlock, shown after login on a native device that has
 * biometrics enrolled and hasn't been set up yet. Deferred until after the permission onboarding so
 * the two first-run dialogs don't stack. Dismissing (or enabling) marks it done. No-op on web.
 * Renders as a native-feeling bottom sheet on phones, a centered dialog on larger screens.
 */
export default function BiometricEnrollPrompt() {
  const T = useT();
  const theme = useTheme();
  const isPhone = useMediaQuery(theme.breakpoints.down('sm'));
  const { auth } = useAuth();
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
      haptic.success();
      notify.success('Fingerprint/face unlock enabled');
      markPrompted();
      setOpen(false);
    } catch (_e) {
      notify.error('Could not enable biometric unlock');
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  const body = (
    <Box sx={{ p: 3, pb: 'calc(24px + env(safe-area-inset-bottom))', textAlign: 'center' }}>
      {isPhone && <Box sx={{ width: 40, height: 4, borderRadius: 2, bgcolor: T.glassBorder, mx: 'auto', mb: 2.5 }} />}
      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1.5 }}>
        <FingerprintPulse state="idle" size={92} />
      </Box>
      <Typography variant="h6" sx={{ fontWeight: 800 }}>Faster, safer sign-in</Typography>
      <Typography sx={{ color: T.textMuted, mt: 1, fontSize: 14, maxWidth: 320, mx: 'auto' }}>
        Use your fingerprint or face to unlock DB World next time, instead of typing your password.
      </Typography>
      <Box sx={{ display: 'flex', gap: 1, mt: 3, ...(isPhone ? { flexDirection: 'column-reverse' } : { justifyContent: 'center' }) }}>
        <Button onClick={dismiss} disabled={busy} sx={{ color: T.textMuted, textTransform: 'none', py: isPhone ? 1.1 : undefined }}>
          Not now
        </Button>
        <Button
          onClick={enable}
          disabled={busy}
          variant="contained"
          sx={{ bgcolor: T.teal, textTransform: 'none', fontWeight: 700, px: 3, py: 1.1, borderRadius: 2, '&:hover': { bgcolor: T.tealHover } }}
        >
          {busy ? 'Enabling…' : 'Enable'}
        </Button>
      </Box>
    </Box>
  );

  return isPhone ? (
    <Drawer
      anchor="bottom"
      open
      onClose={dismiss}
      PaperProps={{ sx: { bgcolor: T.bg, color: T.text, backgroundImage: 'none', borderTopLeftRadius: 20, borderTopRightRadius: 20, border: `1px solid ${T.glassBorder}`, borderBottom: 0 } }}
    >
      {body}
    </Drawer>
  ) : (
    <Dialog open onClose={dismiss} PaperProps={{ sx: { bgcolor: T.bg, color: T.text, backgroundImage: 'none', borderRadius: 3, maxWidth: 400, m: 2 } }}>
      {body}
    </Dialog>
  );
}
