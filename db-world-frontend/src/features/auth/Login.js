import React, { useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Box, Typography } from '@mui/material';
import { motion, useReducedMotion } from 'framer-motion';

import AuthPanel from '@features/auth/AuthPanel';
import Constants from '@shared/constants';
import usePageMeta from '@shared/hooks/usePageMeta';
import { useT } from '@shared/theme';
import { Aurora, GlassPanel } from '@shared/ui/surfaces';

/**
 * The `/login` route.
 *
 * Deliberately thin. Signing in from inside the app happens in the modal that
 * {@code RequireAuthProvider} hosts; this page exists for the entries a modal cannot serve —
 * `PrivateRoute` redirecting a signed-out visitor off a protected URL, a link in a mail, a
 * bookmark, a crawler. It renders the very same {@link AuthPanel}, so there is one form to
 * maintain and one design to keep in step.
 */

/**
 * Where to land after signing in.
 *
 * Guards against bouncing straight back to an auth route: arriving at `/login` from `/logout`
 * and being returned to `/logout` would sign the visitor out again.
 */
const getSafeDestination = (location) => {
  const from = location.state?.from?.pathname;

  const blockedDestinations = [
    Constants.LOGIN_ROUTE,
    Constants.REGISTRATION_ROUTE,
    Constants.LOGOUT_ROUTE,
  ];

  if (!from || blockedDestinations.includes(from)) {
    return Constants.DB_WORLD_HOME_ROUTE;
  }

  return from;
};

const Login = () => {
  usePageMeta('Sign In', { description: 'Sign in to your DB World account.' });

  const navigate = useNavigate();
  const location = useLocation();
  const T = useT();
  const reduce = useReducedMotion();

  const destination = useMemo(() => getSafeDestination(location), [location]);

  const handleComplete = useCallback(
    () => navigate(destination, { replace: true }),
    [destination, navigate]
  );

  // Hands the onward destination to the registration page so it can return the visitor to
  // whatever they were originally trying to reach, not just to the hub.
  const handleRegister = useCallback(
    () => navigate(Constants.REGISTRATION_ROUTE, { state: location.state }),
    [navigate, location.state]
  );

  return (
    <Box
      sx={{
        position: 'relative',
        minHeight: '100dvh',
        bgcolor: T.bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        px: { xs: 2, sm: 3 },
        pt: { xs: 'calc(56px + 24px)', md: 'calc(64px + 32px)' },
        pb: 5,
        overflowX: 'hidden',
      }}
    >
      <Aurora />

      <Box
        component={motion.div}
        initial={reduce ? false : { opacity: 0, y: 22 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
        sx={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 440, minWidth: 0 }}
      >
        <GlassPanel sx={{ p: { xs: 2.5, sm: 4 } }}>
          <AuthPanel
            reason={location.state?.reason}
            onComplete={handleComplete}
            onRegister={handleRegister}
          />
        </GlassPanel>

        <Typography
          sx={{
            mt: 2.5, textAlign: 'center', fontSize: '0.74rem', color: T.textFaint, lineHeight: 1.6,
          }}
        >
          Browsing DB World needs no account. You only need one to play, download, request or
          save titles.
        </Typography>
      </Box>
    </Box>
  );
};

export default Login;
