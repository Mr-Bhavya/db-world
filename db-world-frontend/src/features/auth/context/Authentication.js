import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import axiosInstance, { refreshAccessToken } from '@shared/components/ui/utils/AxiosInstants';
import { isBiometricEnabled } from '@platform/android/biometric';
import constants from '@shared/constants';

const AuthContext = createContext(null);

/**
 * True when the stored JWT is missing an exp, already expired, or expires
 * within `thresholdMs`. Used to decide whether returning to the foreground
 * warrants a silent token refresh. Returns false when there's no token at all
 * (nothing to keep alive — the user simply isn't logged in).
 */
const tokenExpiringSoon = (thresholdMs = 120_000) => {
  const token = localStorage.getItem('token');
  if (!token) return false;
  try {
    const part = token.split('.')[1];
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
    const { exp } = JSON.parse(json);
    if (!exp) return true; // no expiry claim — refresh to be safe
    return exp * 1000 - Date.now() < thresholdMs;
  } catch {
    return true; // unparseable — let a refresh attempt sort it out
  }
};

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

  const login = useCallback((token, user, role) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('role', role);
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
      localStorage.clear();
      setAuth({ ...INITIAL_AUTH, loading: false });
    }
  }, []);

  /* ── Force-logout event from axios interceptor ───────────────────── */

  useEffect(() => {
    const handler = () => {
      // The interceptor already cleared localStorage.
      setAuth({ ...INITIAL_AUTH, loading: false });
    };
    window.addEventListener('auth:force-logout', handler);
    return () => window.removeEventListener('auth:force-logout', handler);
  }, []);

  /* ── Keep the session warm when returning to the foreground ──────────
     A long-running background download can outlive the short-lived access
     token. Without this, the first call after resuming (or a cold WebView
     remount) hits a 401 and — if anything about that refresh is racy — bounces
     the user to login mid-download. So on every foreground transition we
     silently mint a fresh token from the refresh cookie if the current one is
     expiring. Failures stay quiet here: the next real 401 still force-logs-out
     if the refresh cookie is genuinely dead. */
  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android') return undefined;
    let listener;
    const keepAlive = async () => {
      if (!tokenExpiringSoon()) return; // no token, or still valid → nothing to do
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

    // Biometric unlock enabled → lock at launch instead of auto-authenticating from the stored
    // token/refresh cookie. The BiometricGate prompts for fingerprint/face and exchanges the
    // device token for a fresh session (or the user falls back to password login).
    if (isBiometricEnabled()) {
      setAuth({ ...INITIAL_AUTH, loading: false, locked: true });
      return;
    }

    const verify = async () => {
      const storedToken = localStorage.getItem('token');
      const storedUser = JSON.parse(localStorage.getItem('user') || 'null');

      // No stored credentials → immediately mark as unauthenticated.
      if (!storedToken || !storedUser) {
        setAuth({ ...INITIAL_AUTH, loading: false });
        return;
      }

      try {
        // verify() carries the Bearer token; if it's expired the axios interceptor
        // silently refreshes it and retries before we ever see the response.
        const res = await axiosInstance.get('/api/auth/verify');
        const roles = res.data?.data?.roles ?? [];
        const role = extractAppRole(roles);

        if (!role) {
          localStorage.clear();
          setAuth({ ...INITIAL_AUTH, loading: false });
          return;
        }

        const freshToken = localStorage.getItem('token') ?? storedToken;
        login(freshToken, storedUser, role);


      } catch {
        // Distinguish a dead session from a transient failure. On a genuine auth
        // failure the axios interceptor has already cleared localStorage and
        // dispatched 'auth:force-logout'. If the token is STILL present, the failure
        // was transient (offline / 5xx / timeout) — keep the stored session so a
        // flaky network or a server blip doesn't bounce a still-valid login to the
        // login screen. The next protected request re-runs the real refresh flow.
        const storedRole = localStorage.getItem('role');
        if (localStorage.getItem('token') && storedUser && storedRole) {
          login(storedToken, storedUser, storedRole);
        } else {
          setAuth({ ...INITIAL_AUTH, loading: false });
        }
      }
    };

    verify();
  }, []); // ← empty: run exactly once on mount

  /* ── Context value ───────────────────────────────────────────────── */

  return (
    <AuthContext.Provider value={{ auth, login, logout, cancelBiometricLock }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
