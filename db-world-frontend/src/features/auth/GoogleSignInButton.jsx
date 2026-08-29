import React, { useCallback, useEffect, useState } from 'react';
import { Box, Button, CircularProgress, Divider, Typography } from '@mui/material';
import { useT } from '@shared/theme';
import {
  canUseGoogleSignIn,
  describeGoogleError,
  fetchGoogleEnabled,
  signInWithGoogle,
} from './googleAuth';

/** Google's mark, inlined so the button renders without a network round-trip. */
const GoogleMark = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </svg>
);

/**
 * "Continue with Google" — renders nothing unless BOTH sides are provisioned.
 *
 * The client check catches a missing Firebase config or a native build without the plugin; the
 * server check catches a backend with no Google client IDs, which would reject every token. A
 * button that cannot possibly succeed is worse than no button.
 *
 * @param onSuccess called with the backend login payload ({ token, refreshToken?, user }).
 * @param onError   called with a message to display, or null when the user simply cancelled.
 * @param divider   where the "OR" rule sits: 'top' below an existing submit button, 'bottom'
 *                  when this leads a form, 'none' to omit it. The rule is part of THIS
 *                  component so it disappears with the button — a stray divider above a form
 *                  that no longer has anything above it looks like a rendering bug.
 */
export default function GoogleSignInButton({
  onSuccess,
  onError,
  label = 'Continue with Google',
  divider = 'top',
}) {
  const T = useT();
  const [serverEnabled, setServerEnabled] = useState(null); // null = still checking
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // Both sides have to be provisioned, and when one is not the button simply does not render.
    // That is right in production but baffling in development, so say which half is missing.
    if (!canUseGoogleSignIn()) {
      if (import.meta.env.DEV) {
        console.warn(
          '[GoogleSignInButton] hidden: the CLIENT is not configured. On web that means the '
          + 'VITE_FIREBASE_* build env is missing; on a native build it means '
          + '@capacitor-firebase/authentication is not installed.'
        );
      }
      setServerEnabled(false);
      return undefined;
    }

    fetchGoogleEnabled().then(enabled => {
      if (cancelled) return;
      if (!enabled && import.meta.env.DEV) {
        console.warn(
          '[GoogleSignInButton] hidden: the SERVER reports Google is off. Set GOOGLE_CLIENT_IDS '
          + 'on the backend (see /api/auth/providers).'
        );
      }
      setServerEnabled(enabled);
    });
    return () => { cancelled = true; };
  }, []);

  const handleClick = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    onError?.(null);
    try {
      const payload = await signInWithGoogle();
      onSuccess?.(payload);
    } catch (err) {
      // describeGoogleError returns null for a cancelled popup — not worth an error message.
      onError?.(describeGoogleError(err));
    } finally {
      setLoading(false);
    }
  }, [loading, onError, onSuccess]);

  if (!serverEnabled) return null;

  // `divider` accepts a boolean for callers that only care whether there is one at all.
  const placement = divider === true ? 'top' : divider === false ? 'none' : divider;

  const rule = (
    <Divider sx={{ my: 2.5, '&::before, &::after': { borderColor: T.divider } }}>
      <Typography sx={{ color: T.textMuted, fontSize: 12, letterSpacing: 0.6 }}>
        OR
      </Typography>
    </Divider>
  );

  return (
    <Box sx={{ width: '100%' }}>
      {placement === 'top' && rule}

      <Button
        fullWidth
        onClick={handleClick}
        disabled={loading}
        startIcon={loading ? null : <GoogleMark />}
        sx={{
          py: 1.25,
          borderRadius: 2,
          textTransform: 'none',
          fontWeight: 600,
          fontSize: 15,
          color: T.text,
          bgcolor: T.surface2 ?? 'transparent',
          border: `1px solid ${T.divider}`,
          '&:hover': { bgcolor: T.surfaceHover ?? T.surface2, borderColor: T.textMuted },
        }}
      >
        {loading ? <CircularProgress size={20} sx={{ color: T.text }} /> : label}
      </Button>

      {placement === 'bottom' && rule}
    </Box>
  );
}
