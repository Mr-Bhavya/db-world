import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { addUser } from '@app/redux/action/allActions';
import axiosInstance from '@shared/components/ui/utils/AxiosInstants';

const AuthContext = createContext(null);

const INITIAL_AUTH = {
  isAuthenticated: false,
  user: null,
  token: null,
  role: null,
  loading: true,   // true until the initial verify completes
};

export const AuthProvider = ({ children }) => {
  const dispatch   = useDispatch();
  const [auth, setAuth] = useState(INITIAL_AUTH);
  const initialized = useRef(false); // guard against strict-mode double-mount

  /* ── login ──────────────────────────────────────────────────────── */

  const login = useCallback((token, user, role) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user',  JSON.stringify(user));
    localStorage.setItem('role',  role);
    dispatch(addUser(user));
    setAuth({ isAuthenticated: true, token, user, role, loading: false });
  }, [dispatch]);

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
      dispatch(addUser(null));
      setAuth({ ...INITIAL_AUTH, loading: false });
    }
  }, [dispatch]);

  /* ── Force-logout event from axios interceptor ───────────────────── */

  useEffect(() => {
    const handler = () => {
      // The interceptor already cleared localStorage.
      dispatch(addUser(null));
      setAuth({ ...INITIAL_AUTH, loading: false });
    };
    window.addEventListener('auth:force-logout', handler);
    return () => window.removeEventListener('auth:force-logout', handler);
  }, [dispatch]);

  /* ── One-time session verification on app mount ──────────────────── */

  useEffect(() => {
    // React StrictMode mounts twice in dev; the ref prevents double-verification.
    if (initialized.current) return;
    initialized.current = true;

    const verify = async () => {
      const storedToken = localStorage.getItem('token');
      const storedUser  = JSON.parse(localStorage.getItem('user') || 'null');

      // No stored credentials → immediately mark as unauthenticated.
      if (!storedToken || !storedUser) {
        setAuth({ ...INITIAL_AUTH, loading: false });
        return;
      }

      try {
        // verify() carries the Bearer token; if it's expired the axios interceptor
        // silently refreshes it and retries before we ever see the response.
        const res   = await axiosInstance.get('/api/auth/verify');
        const roles = res.data?.data?.roles ?? [];
        const role  = roles[0] ?? null;

        if (!role) {
          // Token decoded OK but no role claim — treat as invalid.
          localStorage.clear();
          dispatch(addUser(null));
          setAuth({ ...INITIAL_AUTH, loading: false });
          return;
        }

        // The interceptor may have stored a newer token while refresh happened.
        const freshToken = localStorage.getItem('token') ?? storedToken;
        login(freshToken, storedUser, role);

      } catch {
        // The interceptor already dispatched 'auth:force-logout' and cleared
        // localStorage if this was a refresh failure. Just reset local state.
        setAuth({ ...INITIAL_AUTH, loading: false });
      }
    };

    verify();
  }, []); // ← empty: run exactly once on mount

  /* ── Context value ───────────────────────────────────────────────── */

  return (
    <AuthContext.Provider value={{ auth, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
