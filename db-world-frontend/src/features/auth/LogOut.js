import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, CircularProgress, Typography } from '@mui/material';
import { useAuth } from '@features/auth/context/Authentication';
import Constants from '@shared/constants';

/**
 * Logout route — cleans up auth state then redirects to login.
 *
 * Rendered as a full-screen page so the user sees feedback while
 * the server revokes the refresh token.
 */
function LogOut() {
  const navigate     = useNavigate();
  const { logout }   = useAuth();
  const didLogout    = useRef(false); // prevent double-call in StrictMode

  useEffect(() => {
    if (didLogout.current) return;
    didLogout.current = true;

    logout().finally(() => {
      navigate(Constants.LOGIN_ROUTE, { replace: true });
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
      }}
    >
      <CircularProgress size={36} />
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        Signing out…
      </Typography>
    </Box>
  );
}

export default LogOut;
