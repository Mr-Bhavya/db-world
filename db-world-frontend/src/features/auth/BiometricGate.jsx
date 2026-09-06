import React, { useCallback, useEffect, useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useT } from '@shared/theme';
import { useAuth } from '@features/auth/context/Authentication';
import { extractAppRole } from '@features/auth/roleUtils';
import { biometricUnlock, clearBiometricLocal } from '@platform/android/biometric';
import { haptic } from '@shared/platform/platform';
import UnlockSensor from './components/UnlockSensor';
import db_world_icon from '@assets/images/db-circle-icon.webp';

/**
 * Full-screen launch lock shown when biometric unlock is enabled (auth.locked). Prompts for
 * fingerprint/face, exchanges the stored device token for a fresh session, then hands off to
 * login(). If the server rejects the token (revoked/expired) we drop biometric and fall back to
 * password login; a transient failure just lets the user retry. Renders nothing when not locked.
 *
 * <h3>Why it looks like this</h3>
 * This is the first thing seen on every app open, so it is built to be forgettable in the way a
 * system lock screen is forgettable. The previous layout was a web call-to-action — a large
 * pulsing emblem with a filled "Unlock" button centred beneath it — which asks the user to make
 * a decision they have already made by opening the app.
 *
 * So: identity at the top, deliberate emptiness through the middle, and the unlock affordance
 * low where a thumb already rests. The filled button is gone, because the system biometric sheet
 * opens by itself; the only reason to touch anything here is to retry, and the sensor glyph is
 * the understood target for that. The one moving part is the status line.
 */

/**
 * Every state's words, in one place.
 *
 * Fixed slots rather than assembled strings, so the line can never reflow between states — text
 * that shifts position as it changes is the single clearest tell that a screen is a web page.
 * Failures say what happened and what to do, and do not apologise.
 */
const STATES = {
  idle: { title: 'Locked', hint: 'Confirm your fingerprint or face' },
  scanning: { title: 'Scanning', hint: 'Hold still' },
  success: { title: 'Unlocked', hint: 'Signing you in' },
  error: { title: 'Not recognised', hint: 'Tap the sensor to try again' },
};

export default function BiometricGate() {
  const T = useT();
  const reduce = useReducedMotion();
  const { auth, login, cancelBiometricLock } = useAuth();
  const [phase, setPhase] = useState('idle'); // idle | scanning | success | error
  const busy = phase === 'scanning';

  const attempt = useCallback(async () => {
    setPhase('scanning');
    try {
      const { accessToken, refreshToken, user } = await biometricUnlock();
      setPhase('success');
      haptic.success();
      // Let the success state land before handing off, so the screen does not flash past.
      setTimeout(() => login(accessToken, user, extractAppRole(user), refreshToken), 480);
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
    }
  }, [login, cancelBiometricLock]);

  // Auto-prompt as soon as the app locks.
  useEffect(() => {
    if (auth.locked) attempt();
  }, [auth.locked, attempt]);

  if (!auth.locked) return null;

  const { title, hint } = STATES[phase];

  return (
    <Box
      component={motion.div}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        bgcolor: T.bg,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        px: 4,
        textAlign: 'center',
        overflow: 'hidden',
        pt: 'calc(env(safe-area-inset-top) + 44px)',
        pb: 'calc(env(safe-area-inset-bottom) + 28px)',
      }}
    >
      {/* ── Identity ─────────────────────────────────────────────────────
          Quiet and small. The app is not selling itself to someone who already
          chose to open it; this is the system-chrome register. */}
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.25 }}>
        <Box
          component="img"
          src={db_world_icon}
          alt=""
          sx={{ width: 34, height: 34, borderRadius: '50%', opacity: 0.9 }}
        />
        <Typography
          component="p"
          sx={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: T.textFaint,
          }}
        >
          DB World
        </Typography>
      </Box>

      {/* ── Status ───────────────────────────────────────────────────────
          The only thing on screen that changes. minHeight pins it so the two
          lines never move as the words swap. */}
      <Box sx={{ minHeight: 92, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <AnimatePresence mode="wait" initial={false}>
          <Box
            key={phase}
            component={motion.div}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <Typography
              component="h1"
              sx={{
                // Light and large reads as system typography; heavy and large reads as
                // marketing, which is the wrong register for a lock screen.
                fontSize: 27,
                fontWeight: 300,
                letterSpacing: '-0.01em',
                color: phase === 'error' ? T.error : T.textPrimary,
              }}
            >
              {title}
            </Typography>
            <Typography sx={{ mt: 0.75, fontSize: 14, color: T.textMuted }}>
              {hint}
            </Typography>
          </Box>
        </AnimatePresence>
      </Box>

      {/* ── Actions ──────────────────────────────────────────────────────
          Bottom third, inside comfortable thumb reach on a tall phone. */}
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2.5 }}>
        <UnlockSensor
          state={phase}
          onPress={attempt}
          disabled={busy || phase === 'success'}
        />

        <Button
          onClick={cancelBiometricLock}
          disabled={busy || phase === 'success'}
          sx={{
            minHeight: 44,
            px: 2,
            color: T.textMuted,
            fontSize: 14,
            fontWeight: 600,
            textTransform: 'none',
            '&:hover': { color: T.textPrimary, bgcolor: 'transparent' },
          }}
        >
          Use password instead
        </Button>
      </Box>
    </Box>
  );
}
