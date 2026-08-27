import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Box, Button, Dialog, DialogActions, DialogContent, Stack, Typography,
} from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';

import { useAuth } from '@features/auth/context/Authentication';
import Constants from '@shared/constants';
import { useT } from '@shared/theme/ThemeContext';

/**
 * Sign-in gate for the open browse surface.
 *
 * Browsing the catalog and the IPO tracker needs no account, but acting on what you
 * find does — playback, downloads, requests, votes, watchlist and the rest. Rather
 * than hide those controls from signed-out visitors (which makes the site look
 * emptier than it is, and gives them nothing to convert on), the controls stay
 * visible and route through `requireAuth`, which prompts instead of acting.
 *
 * The prompt carries the current location, so signing in returns the visitor to
 * exactly where they were rather than dumping them on the home page.
 */

const RequireAuthContext = createContext(null);

const DEFAULT_MESSAGE = 'Sign in to continue';

export const RequireAuthProvider = ({ children }) => {
  const { auth } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const T = useT();
  const [prompt, setPrompt] = useState(null);

  const close = useCallback(() => setPrompt(null), []);

  /**
   * Wrap an action so it only runs for a signed-in visitor.
   *
   * @param {Function} action  what to run once signed in
   * @param {string}   message what the visitor is being asked to sign in FOR
   * @returns {Function} a handler safe to drop straight onto onClick
   */
  const requireAuth = useCallback((action, message = DEFAULT_MESSAGE) => (...args) => {
    if (auth.isAuthenticated) return action?.(...args);
    // Hold the loader case too: mid-verify we don't yet know, and prompting someone
    // who turns out to be signed in would be wrong.
    if (auth.loading) return undefined;
    setPrompt({ message });
    return undefined;
  }, [auth.isAuthenticated, auth.loading]);

  const goToLogin = useCallback(() => {
    const message = prompt?.message;
    setPrompt(null);
    navigate(Constants.LOGIN_ROUTE, { state: { from: location, reason: message } });
  }, [navigate, location, prompt]);

  const value = useMemo(() => ({ requireAuth, isAuthenticated: auth.isAuthenticated }), [requireAuth, auth.isAuthenticated]);

  return (
    <RequireAuthContext.Provider value={value}>
      {children}
      <Dialog
        open={!!prompt}
        onClose={close}
        maxWidth="xs"
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: 3, bgcolor: T.bg, backgroundImage: 'none', border: `1px solid ${T.glassBorder}` } } }}
      >
        <DialogContent sx={{ pt: 4, pb: 2, textAlign: 'center' }}>
          <Stack spacing={2} alignItems="center">
            <Box sx={{
              width: 56, height: 56, borderRadius: '50%',
              display: 'grid', placeItems: 'center',
              bgcolor: T.tealBg,
            }}>
              <LockOutlinedIcon sx={{ fontSize: 28, color: T.teal }} />
            </Box>
            <Typography sx={{ fontWeight: 800, fontSize: '1.15rem', color: T.text }}>
              {prompt?.message ?? DEFAULT_MESSAGE}
            </Typography>
            <Typography sx={{ fontSize: '0.875rem', color: T.textMuted, maxWidth: 320 }}>
              Browsing is open to everyone. You only need an account to play, download,
              request or save titles.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
          <Button onClick={close} sx={{ color: T.textMuted, fontWeight: 700 }}>
            Not now
          </Button>
          <Button
            onClick={goToLogin}
            variant="contained"
            sx={{ fontWeight: 800, borderRadius: 2, px: 3, bgcolor: T.teal, '&:hover': { bgcolor: T.tealHover } }}
          >
            Sign in
          </Button>
        </DialogActions>
      </Dialog>
    </RequireAuthContext.Provider>
  );
};

/**
 * Returns `requireAuth(action, message)`. Outside the provider it degrades to running
 * the action as-is, so a component can be rendered in isolation (tests, storybook)
 * without having to stand the provider up.
 */
export const useRequireAuth = () => {
  const ctx = useContext(RequireAuthContext);
  if (!ctx) {
    return { requireAuth: (action) => (...args) => action?.(...args), isAuthenticated: true };
  }
  return ctx;
};

export default useRequireAuth;
