import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import { App as CapacitorApp } from '@capacitor/app';
import { useT } from '@shared/theme';
import { isAndroid } from '@shared/platform/platform';
import { isBiometricEnabled, canLockApp, verifyDeviceOwner } from '@platform/android/biometric';
import { useAuth } from '@features/auth/context/Authentication';
import FingerprintPulse from '@features/auth/components/FingerprintPulse';

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
export default function AppLockGate() {
  const T = useT();
  const { auth } = useAuth();

  // Biometric-login already prompts at cold start — only cold-lock when it doesn't.
  const startLocked = isAndroid && !isBiometricEnabled();
  const [locked, setLocked] = useState(startLocked);
  const [state, setState] = useState('idle'); // idle | scanning | success | error

  const bgAt = useRef(0);            // when we last went to background
  const canLock = useRef(true);      // device has biometric or a screen lock
  const authLocked = useRef(auth.locked);
  useEffect(() => { authLocked.current = auth.locked; }, [auth.locked]);

  const prompt = useCallback(async () => {
    setState('scanning');
    try {
      await verifyDeviceOwner('Unlock DB-World to continue');
      setState('success');
      setTimeout(() => { setLocked(false); setState('idle'); }, 380);
    } catch {
      setState('error');
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

  const isError = state === 'error';

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
      <Box aria-hidden sx={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: `radial-gradient(60% 40% at 50% 32%, ${T.tealGlow} 0%, transparent 70%)` }} />

      <FingerprintPulse state={state === 'success' ? 'success' : isError ? 'error' : state === 'scanning' ? 'scanning' : 'idle'} size={128} />

      <Box sx={{ position: 'relative', maxWidth: 320 }}>
        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, color: T.textPrimary, mb: 1 }}>
          <LockRoundedIcon sx={{ fontSize: 20, color: T.teal }} />
          <Typography sx={{ fontWeight: 800, fontSize: '1.2rem' }}>DB-World is locked</Typography>
        </Box>
        <Typography sx={{ color: isError ? T.error : T.textMuted, fontSize: '0.9rem', lineHeight: 1.5 }}>
          {isError
            ? 'Couldn’t verify it’s you. Try again with your fingerprint, face, or screen lock.'
            : 'Unlock with your fingerprint, face, or device screen lock to continue.'}
        </Typography>
      </Box>

      <Button
        onClick={prompt}
        disabled={state === 'scanning'}
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
        {state === 'scanning' ? 'Waiting…' : isError ? 'Try again' : 'Unlock'}
      </Button>
    </Box>
  );
}
