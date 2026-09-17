import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useT } from '@shared/theme';
import { useAuth } from '@features/auth/context/Authentication';
import { extractAppRole } from '@features/auth/roleUtils';
import {
  BIOMETRIC_OUTCOME, biometricUnlock, classifyBiometricError, clearBiometricLocal, isNetworkError,
} from '@platform/android/biometric';
import { haptic } from '@shared/platform/platform';
import db_world_icon from '@assets/images/db-circle-icon.webp';

/**
 * Full-screen launch lock, shown when biometric unlock is enabled (`auth.locked`).
 *
 * <h3>While the system sheet is up, this screen says NOTHING</h3>
 *
 * The previous version ran a little state machine — "Scanning / Hold still", then
 * "Unlocked / Signing you in" — and every word of it rendered BEHIND Android's own
 * biometric sheet, which was already saying "Confirm your fingerprint". Two voices
 * narrating one action, and the app's half mostly hidden under the system dialog. That
 * is what made the screen read as mismatched: not the styling, the fact that there was
 * a second UI competing with the OS one.
 *
 * So while the sheet is open this is a still, branded backdrop and nothing more — the
 * shape a system lock screen has, and the shape the sheet is designed to sit on. It
 * cannot clash because there is nothing left to clash with.
 *
 * The app only speaks once the sheet is GONE, and only about things the OS does not
 * own: dismissed, not recognised, locked out.
 *
 * <h3>No success state</h3>
 *
 * There used to be a deliberate `setTimeout(..., 480)` before the handoff so "Unlocked"
 * could be read. That was half a second added to every single app launch to display a
 * message the user already knew the answer to — the OS sheet confirms the match with
 * its own checkmark and haptic, and the reward for unlocking is the app. It hands off
 * the instant the token exchange resolves.
 */

/**
 * How long the post-scan network exchange may run before the screen admits it is waiting.
 *
 * <p>Long enough that a healthy connection never reaches it — the handoff stays instant and the
 * "no success state" rule above is untouched — and short enough that a stalled one does not sit
 * there looking inert. This is not the old "Unlocked" screen returning: that narrated something
 * the OS had already confirmed and cost every launch 480ms. This narrates a real wait, only when
 * there is one, and adds nothing to the fast path.
 */
const SLOW_EXCHANGE_MS = 450;

/** Only the states the system sheet does NOT already communicate. */
const MESSAGES = {
  [BIOMETRIC_OUTCOME.CANCELLED]: {
    title: 'Locked',
    // Not "Not recognised": they dismissed the sheet, they did not fail a scan.
    hint: 'Unlock to continue',
  },
  [BIOMETRIC_OUTCOME.FAILED]: {
    title: 'Not recognised',
    hint: 'Try again, or use your password',
  },
  [BIOMETRIC_OUTCOME.LOCKED_OUT]: {
    title: 'Too many attempts',
    // Retry is deliberately not offered — Android will refuse until it cools off.
    hint: 'Biometric unlock is blocked for now. Use your password.',
  },
  [BIOMETRIC_OUTCOME.ERROR]: {
    title: 'Could not unlock',
    hint: 'Try again, or use your password',
  },
  [BIOMETRIC_OUTCOME.NETWORK]: {
    // Names the real problem. The scan worked; the connection did not. Saying "Not recognised"
    // or "Could not unlock" here would send them to re-scan a finger that was never the issue.
    title: 'No connection',
    hint: 'Your fingerprint was accepted — we just could not reach DB World. Try again.',
  },
};

/** Outcomes where offering "Try again" would be offering something that cannot work. */
const NO_RETRY = new Set([BIOMETRIC_OUTCOME.LOCKED_OUT]);

export default function BiometricGate() {
  const T = useT();
  const reduce = useReducedMotion();
  const { auth, login, cancelBiometricLock } = useAuth();

  // null = nothing to say. That covers both "waiting to prompt" and "the sheet is open",
  // which are indistinguishable to the user and should be indistinguishable here.
  const [outcome, setOutcome] = useState(null);

  // ...but NOT the wait after a successful scan, which is a third state and looks nothing like
  // the other two. The fingerprint is verified on-device in an instant; exchanging the device
  // token for a session is a network round trip that on a weak signal runs for seconds. With both
  // hidden behind `outcome === null`, the OS sheet dismissed on success and dropped the user back
  // onto an apparently idle lock screen — no spinner, no text, nothing to say the tap had worked —
  // until the response landed and the app jumped onward. Reported as "on low network it stays on
  // the same screen, then after some time it goes to the next screen".
  const [signingIn, setSigningIn] = useState(false);
  const slowTimer = useRef(null);

  const stopSlowTimer = useCallback(() => {
    clearTimeout(slowTimer.current);
    slowTimer.current = null;
    setSigningIn(false);
  }, []);

  useEffect(() => () => clearTimeout(slowTimer.current), []);

  const attempt = useCallback(async () => {
    setOutcome(null);
    try {
      const { accessToken, refreshToken, user } = await biometricUnlock(undefined, {
        // Fires on the LOCAL proof, so the confirmation lands with the gesture rather than
        // whenever the network gets round to answering. The haptic used to wait for the
        // response too, which on a slow connection made a successful scan feel ignored.
        onVerified: () => {
          haptic.success();
          // Deliberately NOT immediate. On a normal connection the exchange resolves faster than
          // this, the timer never fires, and the handoff stays exactly as instant as it is now —
          // no flash of a loading state nobody needed to see. It only speaks when the wait has
          // already become long enough to look like nothing is happening.
          slowTimer.current = setTimeout(() => setSigningIn(true), SLOW_EXCHANGE_MS);
        },
      });
      // Cleared the instant the exchange resolves, so a response that lands just either side of
      // the threshold can never flash "Signing you in" on its way out.
      stopSlowTimer();
      // Straight through. No success screen, no timeout — see the note above.
      login(accessToken, user, extractAppRole(user), refreshToken);
    } catch (e) {
      stopSlowTimer();
      const status = e?.response?.status;
      if (status === 401 || status === 403) {
        // Device token revoked or expired server-side — stop offering biometric.
        clearBiometricLocal();
        cancelBiometricLock();
        return;
      }

      // Checked before the plugin classifier, which only understands plugin error codes: an axios
      // failure has no numeric `code` it recognises, so it fell through to the generic ERROR and
      // told the user their unlock failed when in fact their scan was fine and their signal wasn't.
      if (isNetworkError(e)) {
        setOutcome(BIOMETRIC_OUTCOME.NETWORK);
        return;
      }

      const kind = classifyBiometricError(e);

      // Nothing to unlock with on this device, or they explicitly asked for the
      // password. Either way, biometric is not the route — go to password login
      // rather than leaving them on a lock screen that cannot help.
      if (kind === BIOMETRIC_OUTCOME.UNAVAILABLE) {
        clearBiometricLocal();
        cancelBiometricLock();
        return;
      }
      if (kind === BIOMETRIC_OUTCOME.FALLBACK) {
        cancelBiometricLock();
        return;
      }

      // Only a genuine non-match deserves the error haptic; a dismissal is not a failure.
      if (kind === BIOMETRIC_OUTCOME.FAILED) haptic.error();
      setOutcome(kind);
    }
  }, [login, cancelBiometricLock, stopSlowTimer]);

  // Prompt as soon as the app locks.
  useEffect(() => {
    if (auth.locked) attempt();
  }, [auth.locked, attempt]);

  if (!auth.locked) return null;

  const message = outcome ? MESSAGES[outcome] ?? MESSAGES[BIOMETRIC_OUTCOME.ERROR] : null;
  const canRetry = outcome && !NO_RETRY.has(outcome);

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
        justifyContent: 'center',
        px: 4,
        textAlign: 'center',
        overflow: 'hidden',
        pb: 'calc(env(safe-area-inset-bottom) + 28px)',
      }}
    >
      {/* Centred identity, and that is the whole screen while the sheet is open. */}
      <Box
        component="img"
        src={db_world_icon}
        alt=""
        sx={{ width: 56, height: 56, borderRadius: '50%' }}
      />
      <Typography
        component="p"
        sx={{
          mt: 1.75,
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: T.textFaint,
        }}
      >
        DB World
      </Typography>

      {/* Reserved whether or not there is a message, so the logo never shifts when one
          arrives — a lock screen that jumps as the sheet closes reads as a web page. */}
      <Box sx={{ minHeight: 132, width: '100%', maxWidth: 320, mt: 3 }}>
        <AnimatePresence mode="wait" initial={false}>
          {signingIn && !message && (
            <Box
              key="signingIn"
              component={motion.div}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              <Typography
                component="h1"
                // Not "Unlocked". The scan is the OS's to confirm and it already has; the only
                // thing this screen knows that the user does not is that a request is in flight.
                sx={{ fontSize: 20, fontWeight: 400, letterSpacing: '-0.01em', color: T.textPrimary }}
              >
                Signing you in
              </Typography>
              <Typography sx={{ mt: 0.75, fontSize: 14, lineHeight: 1.5, color: T.textMuted }}>
                Connection is slow — this may take a moment
              </Typography>
              {/* A determinate-looking bar would be a lie: there is no progress to report, only
                  a request that has not come back. A breathing line says "still working". */}
              <Box
                component={motion.div}
                aria-hidden
                animate={reduce ? undefined : { opacity: [0.25, 0.85, 0.25] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                sx={{ mt: 2.5, mx: 'auto', width: 96, height: 2, borderRadius: 1, bgcolor: T.textFaint }}
              />
            </Box>
          )}
          {message && (
            <Box
              key={outcome}
              component={motion.div}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              <Typography
                component="h1"
                sx={{
                  fontSize: 20,
                  fontWeight: 400,
                  letterSpacing: '-0.01em',
                  color: outcome === BIOMETRIC_OUTCOME.FAILED ? T.error : T.textPrimary,
                }}
              >
                {message.title}
              </Typography>
              <Typography sx={{ mt: 0.75, fontSize: 14, lineHeight: 1.5, color: T.textMuted }}>
                {message.hint}
              </Typography>

              {canRetry && (
                <Button
                  onClick={attempt}
                  variant="outlined"
                  sx={{
                    mt: 2.5,
                    minHeight: 44,
                    px: 3,
                    borderRadius: 2,
                    textTransform: 'none',
                    fontWeight: 700,
                    color: T.textPrimary,
                    borderColor: T.border,
                    '&:hover': { borderColor: T.borderHover, bgcolor: 'transparent' },
                  }}
                >
                  Try again
                </Button>
              )}
            </Box>
          )}
        </AnimatePresence>
      </Box>

      {/* Always available, and the only way out when biometric is locked out. */}
      <Button
        onClick={cancelBiometricLock}
        sx={{
          position: 'absolute',
          bottom: 'calc(env(safe-area-inset-bottom) + 24px)',
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
  );
}
