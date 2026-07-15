import React, { useCallback, useEffect, useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import FingerprintRoundedIcon from '@mui/icons-material/FingerprintRounded';
import { motion } from 'framer-motion';
import { useT } from '@shared/theme';
import { useAuth } from '@features/auth/context/Authentication';
import { extractAppRole } from '@features/auth/roleUtils';
import { biometricUnlock, clearBiometricLocal } from '@platform/android/biometric';
import { haptic } from '@shared/platform/platform';
import FingerprintPulse from './components/FingerprintPulse';
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
  const [phase, setPhase] = useState('idle'); // idle | scanning | success | error
  const [error, setError] = useState(null);
  const busy = phase === 'scanning';

  const attempt = useCallback(async () => {
    setPhase('scanning');
    setError(null);
    try {
      const { accessToken, user } = await biometricUnlock();
      setPhase('success');
      haptic.success();
      // Let the success tick land before handing off to the app.
      setTimeout(() => login(accessToken, user, extractAppRole(user)), 480);
    } catch (e) {
      const status = e?.response?.status;
      if (status === 401 || status === 403) {
        // Device token revoked/expired server-side — stop offering biometric, use password.
        clearBiometricLocal();
        cancelBiometricLock();
        return;
      }
      // Biometric cancelled/failed, or network/5xx — let the user retry or use a password.
      haptic.error();
      setPhase('error');
      setError('Unlock failed. Try again, or sign in with your password.');
    }
  }, [login, cancelBiometricLock]);

  // Auto-prompt as soon as the app locks.
  useEffect(() => {
    if (auth.locked) attempt();
  }, [auth.locked, attempt]);

  if (!auth.locked) return null;

  const subtitle = phase === 'error' ? error
    : phase === 'success' ? 'Unlocked'
    : busy ? 'Scanning…'
    : 'Confirm your fingerprint or face to continue.';

  return (
    <Box
      sx={{
        position: 'fixed', inset: 0, zIndex: 2000,
        bgcolor: T.bg, color: T.text,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        px: 3, textAlign: 'center', overflow: 'hidden',
        pt: 'env(safe-area-inset-top)', pb: 'env(safe-area-inset-bottom)',
      }}
    >
      {/* Ambient teal glow (matches the app's signature background accent). */}
      <Box
        component={motion.div}
        aria-hidden
        animate={{ opacity: [0.06, 0.14, 0.06] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        sx={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: `radial-gradient(ellipse 60% 45% at 50% 34%, ${T.tealGlow} 0%, transparent 70%)` }}
      />

      <Box
        component="img"
        src={db_world_icon}
        alt="DB World"
        sx={{ width: 52, height: 52, borderRadius: '50%', position: 'absolute', top: 'calc(env(safe-area-inset-top) + 28px)' }}
      />

      <Box sx={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2.5 }}>
        <FingerprintPulse state={phase} size={128} />

        <Box>
          <Typography sx={{ fontWeight: 800, fontSize: 22 }}>Unlock DB World</Typography>
          <Typography sx={{ color: phase === 'error' ? T.error : T.textMuted, fontSize: 14, maxWidth: 300, mt: 0.5 }}>
            {subtitle}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, width: '100%', maxWidth: 300, mt: 1 }}>
          <Button
            onClick={attempt}
            disabled={busy || phase === 'success'}
            variant="contained"
            startIcon={<FingerprintRoundedIcon />}
            sx={{ bgcolor: T.teal, textTransform: 'none', fontWeight: 700, py: 1.3, borderRadius: 2, '&:hover': { bgcolor: T.tealHover } }}
          >
            {busy ? 'Unlocking…' : phase === 'error' ? 'Try again' : 'Unlock'}
          </Button>
          <Button onClick={cancelBiometricLock} disabled={busy} sx={{ color: T.textMuted, textTransform: 'none' }}>
            Use password instead
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
