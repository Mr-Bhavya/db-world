import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import axiosInstance, { refreshAccessToken } from '@shared/components/ui/utils/AxiosInstants';
import { isBiometricEnabled } from '@platform/android/biometric';
import { clearAllOfflineVault } from '@features/password-manager/offline/vaultCache';
import {
  accessTokenExpiringSoon,
  clearSession,
  decodeAccessToken,
  getAccessToken,
  getStoredRole,
  getStoredUser,
  hasStoredSession,
  loadRefreshToken,
  setAccessToken,
  setRefreshToken,
  setStoredIdentity,
  setStoredRole,
} from '@shared/auth/tokenStore';
import constants from '@shared/constants';

const AuthContext = createContext(null);

const INITIAL_AUTH = {
  isAuthenticated: false,
  user: null,
  token: null,
  role: null,
  loading: true,   // true until the initial verify completes
  locked: false,   // biometric unlock enabled and awaiting fingerprint/face at launch
};

const APP_ROLES = [
  constants.OWNER_USER_ROLE,
  constants.ADMIN_USER_ROLE,
  constants.VIEWER_USER_ROLE,
];

const extractAppRole = (roles = []) => {
  if (!Array.isArray(roles)) return null;
  return roles.find((role) => APP_ROLES.includes(role)) ?? null;
};

export const AuthProvider = ({ children }) => {
  const [auth, setAuth] = useState(INITIAL_AUTH);
  const initialized = useRef(false); // guard against strict-mode double-mount

  /* ── login ──────────────────────────────────────────────────────── */

  /**
   * @param refreshToken only sent by the backend to native clients, which store it themselves.
   *                     Web gets an httpOnly cookie instead and passes undefined here.
   */
  const login = useCallback((token, user, role, refreshToken) => {
    setAccessToken(token);
    setStoredIdentity(user, role);
    if (refreshToken) void setRefreshToken(refreshToken);
    setAuth({ isAuthenticated: true, token, user, role, loading: false, locked: false });
  }, []);

  /* ── Give up on biometric unlock → fall back to password login ────── */
  const cancelBiometricLock = useCallback(() => {
    setAuth({ ...INITIAL_AUTH, loading: false, locked: false });
  }, []);

  /* ── logout ─────────────────────────────────────────────────────── */

  const logout = useCallback(async () => {
    try {
      // Tell the server to revoke the refresh token.
      // This may fail (404/401/network) if the cookie already expired — that is fine.
      await axiosInstance.post('/api/auth/logout', {});
    } catch {
      // Intentionally swallowed — client-side cleanup always runs.
    } finally {
      await clearSession();
      clearAllOfflineVault(); // wipe the encrypted offline snapshot + device keypair
      setAuth({ ...INITIAL_AUTH, loading: false });
    }
  }, []);

  /* ── Force-logout event from axios interceptor ───────────────────── */

  useEffect(() => {
    const handler = () => {
      // The interceptor already cleared the session.
      clearAllOfflineVault(); // dead session → drop the encrypted offline snapshot too
      setAuth({ ...INITIAL_AUTH, loading: false });
    };
    window.addEventListener('auth:force-logout', handler);
    return () => window.removeEventListener('auth:force-logout', handler);
  }, []);

  /**
   * Adopts a role change that happened server-side while the user was signed in.
   *
   * An admin can promote or demote someone mid-session. A demotion revokes the sessions
   * outright, so that case resolves itself as a forced logout — but a PROMOTION deliberately
   * leaves the session alive, and without this the UI would keep rendering the old role until
   * the user signed out by hand.
   */
  const syncRole = useCallback((nextRole) => {
    if (!nextRole) return;
    setAuth(prev => {
      if (!prev.isAuthenticated || prev.role === nextRole) return prev;
      setStoredRole(nextRole);
      return { ...prev, role: nextRole };
    });
  }, []);

  /* ── Adopt a role change picked up by a token refresh ───────────────── */

  useEffect(() => {
    const handler = () => syncRole(decodeAccessToken()?.role);
    window.addEventListener('auth:token-refreshed', handler);
    return () => window.removeEventListener('auth:token-refreshed', handler);
  }, [syncRole]);

  /* ── Keep the session warm when returning to the foreground ──────────
     A long-running background download can outlive the short-lived access
     token. Without this, the first call after resuming (or a cold WebView
     remount) hits a 401 and — if anything about that refresh is racy — bounces
     the user to login mid-download. So on every foreground transition we
     silently mint a fresh token if the current one is expiring. Failures stay
     quiet here: the next real 401 still force-logs-out if the refresh token is
     genuinely dead. */
  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android') return undefined;
    let listener;
    const keepAlive = async () => {
      if (!hasStoredSession()) return;          // nobody signed in — nothing to keep warm
      if (!accessTokenExpiringSoon()) return;   // still valid
      try {
        const fresh = await refreshAccessToken();
        setAuth(prev => (prev.isAuthenticated ? { ...prev, token: fresh } : prev));
      } catch {
        /* leave it — the next protected request will trigger the real flow */
      }
    };
    (async () => {
      try {
        listener = await CapacitorApp.addListener('appStateChange', ({ isActive }) => {
          if (isActive) keepAlive();
        });
      } catch { /* not on a native platform / plugin missing */ }
    })();
    return () => { listener?.remove?.(); };
  }, []);

  /* ── One-time session verification on app mount ──────────────────── */

  useEffect(() => {
    // React StrictMode mounts twice in dev; the ref prevents double-verification.
    if (initialized.current) return;
    initialized.current = true;

    const verify = async () => {
      // Native holds its refresh token itself, so it has to come out of secure storage before
      // anything can decide whether a session exists.
      await loadRefreshToken();

      // Biometric unlock enabled → lock at launch instead of auto-authenticating from the
      // stored session. BiometricGate prompts for fingerprint/face and exchanges the device
      // token for a fresh session (or the user falls back to password login).
      if (isBiometricEnabled()) {
        setAuth({ ...INITIAL_AUTH, loading: false, locked: true });
        return;
      }

      const storedUser = getStoredUser();

      // No established session → anonymous visitor. Browse pages still work.
      if (!hasStoredSession() || !storedUser) {
        setAuth({ ...INITIAL_AUTH, loading: false });
        return;
      }

      try {
        // The access token now lives in memory, so after a reload there is none — mint one
        // from the refresh token before asking the server who we are. (Previously the token
        // came out of localStorage and survived reloads, which is exactly the XSS exposure
        // this change removes.)
        if (!getAccessToken()) {
          await refreshAccessToken();
        }

        const res = await axiosInstance.get('/api/auth/verify');
        const roles = res.data?.data?.roles ?? [];
        const role = extractAppRole(roles);

        if (!role) {
          await clearSession();
          setAuth({ ...INITIAL_AUTH, loading: false });
          return;
        }

        // The role comes from the freshly-minted token, so a promotion that happened while the
        // user was away is picked up here rather than being read back out of a stale cache.
        login(getAccessToken(), storedUser, role);

      } catch {
        // Distinguish a dead session from a transient failure. On a genuine auth failure the
        // axios interceptor has already cleared the session and dispatched 'auth:force-logout'.
        // If the marker is STILL present, the failure was transient (offline / 5xx / timeout) —
        // keep the stored session so a flaky network doesn't bounce a still-valid login to the
        // login screen. The next protected request re-runs the real refresh flow.
        const storedRole = getStoredRole();
        if (hasStoredSession() && storedUser && storedRole) {
          setAuth({
            isAuthenticated: true,
            token: getAccessToken(),
            user: storedUser,
            role: storedRole,
            loading: false,
            locked: false,
          });
        } else {
          setAuth({ ...INITIAL_AUTH, loading: false });
        }
      }
    };

    verify();
  }, []); // ← empty: run exactly once on mount

  /* ── Context value ───────────────────────────────────────────────── */

  return (
    <AuthContext.Provider value={{ auth, login, logout, cancelBiometricLock, syncRole }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
