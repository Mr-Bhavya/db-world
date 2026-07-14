import React, { useCallback, useEffect, useState } from 'react';
import { Box, Button, CircularProgress, Typography } from '@mui/material';
import FingerprintIcon from '@mui/icons-material/Fingerprint';
import { useT } from '@shared/theme';
import { useAuth } from '@features/auth/context/Authentication';
import { extractAppRole } from '@features/auth/roleUtils';
import { biometricUnlock, clearBiometricLocal } from '@platform/android/biometric';
import db_world_icon from '@assets/images/db-circle-icon.webp';

/**
 * Full-screen launch lock shown when biometric unlock is enabled (auth.locked). Prompts for
 * fingerprint/face, exchanges the stored device token for a fresh session, then hands off to
 * login(). If the server rejects the token (revoked/expired) we drop biometric and fall back to
 * password login; a transient failure just lets the user retry. Renders nothing when not locked.
 */
export default function BiometricGate() {
  const T = useT();
  const { auth, login, cancelBiometricLock } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const attempt = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const { accessToken, user } = await biometricUnlock();
      login(accessToken, user, extractAppRole(user));
    } catch (e) {
      const status = e?.response?.status;
      if (status === 401 || status === 403) {
        // Device token revoked/expired server-side — stop offering biometric, use password.
        clearBiometricLocal();
        cancelBiometricLock();
        return;
      }
      // Biometric cancelled/failed, or network/5xx — let the user retry or use a password.
      setError('Unlock failed. Try again, or sign in with your password.');
    } finally {
      setBusy(false);
    }
  }, [login, cancelBiometricLock]);

  // Auto-prompt as soon as the app locks.
  useEffect(() => {
    if (auth.locked) attempt();
  }, [auth.locked, attempt]);

  if (!auth.locked) return null;

  return (
    <Box
      sx={{
        position: 'fixed', inset: 0, zIndex: 2000,
        bgcolor: T.bg, color: T.text,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 2, px: 3, textAlign: 'center',
      }}
    >
      <Box component="img" src={db_world_icon} alt="DB World" sx={{ width: 64, height: 64, borderRadius: '50%', mb: 1 }} />
      <Typography sx={{ fontWeight: 800, fontSize: 20 }}>Unlock DB World</Typography>
      <Typography sx={{ color: T.textMuted, fontSize: 14, maxWidth: 300 }}>
        Confirm your fingerprint or face to continue.
      </Typography>

      {busy && <CircularProgress sx={{ color: T.teal, mt: 1 }} />}
      {error && <Typography sx={{ color: T.error, fontSize: 13, mt: 1 }}>{error}</Typography>}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 2, width: '100%', maxWidth: 280 }}>
        <Button
          onClick={attempt}
          disabled={busy}
          variant="contained"
          startIcon={<FingerprintIcon />}
          sx={{ bgcolor: T.teal, textTransform: 'none', fontWeight: 700, py: 1.2, '&:hover': { bgcolor: T.tealHover } }}
        >
          {busy ? 'Unlocking…' : 'Unlock'}
        </Button>
        <Button onClick={cancelBiometricLock} disabled={busy} sx={{ color: T.textMuted, textTransform: 'none' }}>
          Use password instead
        </Button>
      </Box>
    </Box>
  );
}
