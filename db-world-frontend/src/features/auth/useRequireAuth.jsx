import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, IconButton, useMediaQuery, useTheme } from '@mui/material';
import { CloseRounded } from '@mui/icons-material';
import { useQueryClient } from '@tanstack/react-query';

import AuthPanel from '@features/auth/AuthPanel';
import { useAuth } from '@features/auth/context/Authentication';
import { addBackInterceptor } from '@platform/android/backInterceptors';
import Constants from '@shared/constants';
import { useT } from '@shared/theme/ThemeContext';

/**
 * Sign-in, without leaving the page.
 *
 * Browsing the catalog, the IPO tracker and the weather needs no account, but acting on what
 * you find does — playback, downloads, requests, votes, watchlist and the rest. Those controls
 * stay visible for everyone and route through `requireAuth`, which opens this modal instead of
 * acting.
 *
 * Two things make it worth being a modal rather than the `/login` route:
 *
 * 1. **The action is resumed.** `requireAuth` is handed the thing the visitor was trying to do,
 *    so pressing Play, signing in, and having the film start is one gesture instead of three.
 *    The old flow showed a teaser dialog, then navigated to a different page, and then dropped
 *    the visitor back where they started with the button still unpressed.
 * 2. **The page behind stays live.** Every query is invalidated on success, so the hub's widgets
 *    and the record you were reading fill in with your data as the modal closes.
 *
 * `/login` and `/register` remain real routes — `PrivateRoute` redirects there, password-reset
 * mail links there, and a crawler has to be able to reach it. Both shells render the same
 * {@link AuthPanel}, so there is one form and one design.
 */

const RequireAuthContext = createContext(null);

export const RequireAuthProvider = ({ children }) => {
  const { auth } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const T = useT();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  /** `{ message, action }` while the modal is open, otherwise null. */
  const [prompt, setPrompt] = useState(null);
  // Read through a ref inside the back interceptor, which is registered once.
  const promptRef = useRef(prompt);
  promptRef.current = prompt;

  const close = useCallback(() => setPrompt(null), []);

  /**
   * Wrap an action so it only runs for a signed-in visitor.
   *
   * @param {Function} action  what to run — before signing in if already authenticated, straight
   *                           after if the modal has to open first
   * @param {string}   message what the visitor is being asked to sign in FOR, shown as the heading
   * @returns {Function} a handler safe to drop straight onto onClick
   */
  const requireAuth = useCallback((action, message) => (...args) => {
    if (auth.isAuthenticated) return action?.(...args);
    // Hold the loader case too: mid-verify we don't yet know, and prompting someone who turns
    // out to be signed in would be wrong.
    if (auth.loading) return undefined;
    setPrompt({ message, action: action ? () => action(...args) : null });
    return undefined;
  }, [auth.isAuthenticated, auth.loading]);

  /** Opens the modal with nothing to resume — the header and the hub's sign-in buttons. */
  const promptSignIn = useCallback((message) => {
    if (auth.isAuthenticated || auth.loading) return;
    setPrompt({ message, action: null });
  }, [auth.isAuthenticated, auth.loading]);

  const handleComplete = useCallback(() => {
    const resume = prompt?.action;
    setPrompt(null);

    // Everything on screen was fetched anonymously: the hub's widgets are showing their
    // signed-out panels and the public endpoints answered without a user. Without this the
    // modal closes onto a page that still believes nobody is signed in.
    queryClient.invalidateQueries();

    resume?.();
  }, [prompt, queryClient]);

  const handleRegister = useCallback(() => {
    setPrompt(null);
    // Carries the current location so the full registration page can return the visitor here.
    navigate(Constants.REGISTRATION_ROUTE, { state: { from: location } });
  }, [navigate, location]);

  // Same shape as handleRegister: dismiss first, or the dialog sits over the destination.
  // Deliberately NOT handleComplete — nobody has signed in, so the resume-the-blocked-action
  // path must not fire.
  const handleForgotPassword = useCallback(() => {
    setPrompt(null);
    navigate(Constants.RESET_PASSWORD_ROUTE, { state: { from: location } });
  }, [navigate, location]);

  // Android hardware back closes the modal instead of navigating the page behind it away.
  useEffect(() => addBackInterceptor(() => {
    if (!promptRef.current) return false;
    setPrompt(null);
    return true;
  }), []);

  // A session that arrives some other way — a biometric unlock, a token refresh, another tab —
  // makes an open prompt meaningless.
  useEffect(() => {
    if (auth.isAuthenticated) setPrompt(null);
  }, [auth.isAuthenticated]);

  const value = useMemo(
    () => ({ requireAuth, promptSignIn, isAuthenticated: auth.isAuthenticated }),
    [requireAuth, promptSignIn, auth.isAuthenticated]
  );

  return (
    <RequireAuthContext.Provider value={value}>
      {children}

      <Dialog
        open={Boolean(prompt)}
        onClose={close}
        fullScreen={fullScreen}
        maxWidth="xs"
        fullWidth
        slotProps={{
          backdrop: {
            sx: {
              // A scrim, not a blur. `backdrop-filter` over the dashboard would re-blur a large
              // animated subtree every frame, and those widgets are themselves glass panels —
              // nested backdrop filters are the pathological case, worst of all in the Android
              // WebView. This reads as "the page is locked" for no compositing cost.
              backgroundColor: 'rgba(0,0,0,0.72)',
            },
          },
          paper: {
            sx: {
              bgcolor: T.bg,
              backgroundImage: 'none',
              border: fullScreen ? 'none' : `1px solid ${T.glassBorder}`,
              borderRadius: fullScreen ? 0 : 4,
              boxShadow: `0 32px 80px rgba(0,0,0,0.55)`,
              m: fullScreen ? 0 : 2,
            },
          },
        }}
      >
        <IconButton
          onClick={close}
          aria-label="Close"
          sx={{
            position: 'absolute', top: 10, right: 10, zIndex: 1, color: T.textMuted,
            '&:hover': { color: T.textPrimary, bgcolor: T.hoverBg },
          }}
        >
          <CloseRounded sx={{ fontSize: 20 }} />
        </IconButton>

        <DialogContent
          sx={{
            px: { xs: 3, sm: 4 },
            pt: { xs: 7, sm: 5 },
            pb: { xs: 4, sm: 4 },
            display: 'flex',
            flexDirection: 'column',
            justifyContent: fullScreen ? 'center' : 'flex-start',
          }}
        >
          <AuthPanel
            reason={prompt?.message}
            onComplete={handleComplete}
            onRegister={handleRegister}
            onForgotPassword={handleForgotPassword}
            // A dialog that steals focus the moment it opens fights screen readers announcing it,
            // and on a phone it throws the keyboard up over the heading explaining why you are
            // being asked. The field is one tap away.
            autoFocus={!fullScreen}
          />
        </DialogContent>
      </Dialog>
    </RequireAuthContext.Provider>
  );
};

/**
 * Returns `{ requireAuth, promptSignIn, isAuthenticated }`. Outside the provider it degrades to
 * running the action as-is, so a component can be rendered in isolation (tests, storybook)
 * without having to stand the provider up.
 */
export const useRequireAuth = () => {
  const ctx = useContext(RequireAuthContext);
  if (!ctx) {
    return {
      requireAuth: (action) => (...args) => action?.(...args),
      promptSignIn: () => {},
      isAuthenticated: true,
    };
  }
  return ctx;
};

export default useRequireAuth;
