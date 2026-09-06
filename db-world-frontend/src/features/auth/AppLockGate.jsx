import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import { App as CapacitorApp } from '@capacitor/app';
import { useT } from '@shared/theme';
import { isAndroid } from '@shared/platform/platform';
import { isBiometricEnabled, canLockApp, verifyDeviceOwner } from '@platform/android/biometric';
import { useAuth } from '@features/auth/context/Authentication';
import { BIOMETRIC_OUTCOME, classifyBiometricError } from '@platform/android/biometric';

// Re-lock only after a real trip to the background, not a momentary blur.
const LOCK_AFTER_MS = 60_000;

/**
 * App-launch privacy lock (Android only). Requires biometric or the device
 * screen-lock (PIN / pattern / password) to open the app, and re-locks after the
 * app has been in the background for a while.
 *
 * It defers to BiometricGate: when biometric *login* is enabled, that gate already
 * authenticates at cold start, so we don't cold-lock (no double prompt) — but we
 * still own re-locking on resume. On devices with no lock screen at all we can't
 * enforce anything, so we quietly let the user through.
 *
 * Renders a full-screen blocking overlay; a no-op (null) on web/iOS and once unlocked.
 */
/** Only what the system sheet does NOT already say. Silent otherwise. */
const MESSAGES = {
  [BIOMETRIC_OUTCOME.CANCELLED]: 'Unlock with your fingerprint, face, or device screen lock to continue.',
  [BIOMETRIC_OUTCOME.FAILED]: 'That did not match. Try again, or use your device screen lock.',
  [BIOMETRIC_OUTCOME.LOCKED_OUT]: 'Too many attempts. Unlock your device with its passcode, then reopen the app.',
  [BIOMETRIC_OUTCOME.UNAVAILABLE]: 'Biometric unlock is not available on this device.',
  [BIOMETRIC_OUTCOME.ERROR]: 'Could not verify it is you. Try again.',
};

/** Retrying here cannot succeed until the OS cools off, so do not offer it. */
const NO_RETRY = new Set([BIOMETRIC_OUTCOME.LOCKED_OUT, BIOMETRIC_OUTCOME.UNAVAILABLE]);

export default function AppLockGate() {
  const T = useT();
  const { auth } = useAuth();

  // Biometric-login already prompts at cold start — only cold-lock when it doesn't.
  const startLocked = isAndroid && !isBiometricEnabled();
  const [locked, setLocked] = useState(startLocked);
  // null while there is nothing to say — which covers both "about to prompt" and
  // "the system sheet is open". Those are indistinguishable to the user and should be
  // indistinguishable here: anything this screen renders during the scan sits BEHIND
  // Android's own sheet, competing with it. Same reasoning as BiometricGate.
  const [outcome, setOutcome] = useState(null); // null | 'cancelled' | 'failed' | 'lockedOut' | 'error'

  const bgAt = useRef(0);            // when we last went to background
  const canLock = useRef(true);      // device has biometric or a screen lock
  const authLocked = useRef(auth.locked);
  useEffect(() => { authLocked.current = auth.locked; }, [auth.locked]);

  const prompt = useCallback(async () => {
    setOutcome(null);
    try {
      await verifyDeviceOwner('Unlock DB-World to continue');
      // Straight through. There was a setTimeout(..., 380) here so a "success" state
      // could be seen — 380ms added to every return from the background, to show a
      // message the system sheet already confirmed with its own checkmark.
      setLocked(false);
    } catch (e) {
      const kind = classifyBiometricError(e);
      // A dismissal is not a failure and must not be reported as one.
      setOutcome(kind === BIOMETRIC_OUTCOME.FALLBACK ? BIOMETRIC_OUTCOME.CANCELLED : kind);
    }
  }, []);

  // Cold start.
  useEffect(() => {
    if (!isAndroid) { setLocked(false); return undefined; }
    let cancelled = false;
    (async () => {
      const able = await canLockApp();
      if (cancelled) return;
      canLock.current = able;
      if (startLocked) {
        if (able) prompt();
        else setLocked(false); // device isn't securable — can't enforce a lock
      }
    })();
    return () => { cancelled = true; };
  }, [prompt, startLocked]);

  // Re-lock when returning to the foreground after a spell in the background.
  useEffect(() => {
    if (!isAndroid) return undefined;
    let listener;
    (async () => {
      try {
        listener = await CapacitorApp.addListener('appStateChange', ({ isActive }) => {
          if (!isActive) { bgAt.current = Date.now(); return; }
          if (locked || !canLock.current) return;
          if (authLocked.current) return; // BiometricGate owns the cold-login prompt
          if (bgAt.current && Date.now() - bgAt.current > LOCK_AFTER_MS) {
            setLocked(true);
            prompt();
          }
        });
      } catch { /* not native */ }
    })();
    return () => { listener?.remove?.(); };
  }, [locked, prompt]);

  if (!locked) return null;

  const message = MESSAGES[outcome] ?? null;
  const canRetry = !outcome || !NO_RETRY.has(outcome);

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        bgcolor: T.bg,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        px: 3,
        textAlign: 'center',
      }}
    >
      {/* The animated FingerprintPulse and the glow wash are gone. Both sat behind
          Android's own sheet while it was open — an animation nobody can see, on the
          one frame budget that matters. What is left is identity, and it holds still. */}
      <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, color: T.textPrimary }}>
        <LockRoundedIcon sx={{ fontSize: 20, color: T.teal }} />
        <Typography sx={{ fontWeight: 800, fontSize: '1.2rem' }}>DB-World is locked</Typography>
      </Box>

      {/* Reserved either way, so nothing shifts when a message arrives as the sheet
          closes. Silent while the sheet is up: the OS is already doing the talking. */}
      <Box sx={{ position: 'relative', maxWidth: 320, minHeight: 44 }}>
        {message && (
          <Typography sx={{
            color: outcome === BIOMETRIC_OUTCOME.FAILED ? T.error : T.textMuted,
            fontSize: '0.9rem', lineHeight: 1.5,
          }}>
            {message}
          </Typography>
        )}
      </Box>

      {canRetry && (
      <Button
        onClick={prompt}
        variant="contained"
        disableElevation
        sx={{
          position: 'relative',
          px: 4,
          py: 1,
          borderRadius: 2.5,
          textTransform: 'none',
          fontWeight: 800,
          color: '#fff',
          background: `linear-gradient(135deg, ${T.teal}, ${T.tealHover})`,
          boxShadow: `0 10px 26px ${T.tealGlow}`,
          '&:hover': { background: `linear-gradient(135deg, ${T.tealHover}, ${T.tealHover})` },
          '&.Mui-disabled': { color: 'rgba(255,255,255,0.75)', background: T.tealHover, opacity: 0.85 },
        }}
      >
        {outcome ? 'Try again' : 'Unlock'}
      </Button>
      )}
    </Box>
  );
}
