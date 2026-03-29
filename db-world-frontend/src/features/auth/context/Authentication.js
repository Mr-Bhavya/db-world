// contexts/Authentication.js
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { addUser } from '@app/redux/action/allActions';
import axiosInstance from '@shared/components/ui/utils/AxiosInstants';
import { logOut, verify } from '@shared/services/ApiServices';
import { Box, LinearProgress, Typography, Backdrop, Paper } from '@mui/material';

const AuthContext = createContext();

// Network Status Checker
const useNetworkStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
};

const AuthProvider = ({ children }) => {
  const dispatch = useDispatch();
  const [auth, setAuth] = useState({
    isAuthenticated: false,
    user: null,
    token: null,
    role: null,
    loading: true,
    error: null
  });
  
  const isOnline = useNetworkStatus();

  const login = useCallback((token, user, role = null) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('role', role);

    setAuth({
      isAuthenticated: true,
      token,
      user,
      role,
      loading: false,
      error: null
    });

    dispatch(addUser(user));
  }, [dispatch]);

  const logout = useCallback(async () => {
    try {
      await logOut();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.clear();
      setAuth({
        isAuthenticated: false,
        user: null,
        token: null,
        role: null,
        loading: false,
        error: null
      });
    }
  }, []);

  const setUserRole = useCallback((role) => {
    localStorage.setItem('role', role);
    setAuth(prev => ({ ...prev, role }));
  }, []);

  const setAuthError = useCallback((error) => {
    setAuth(prev => ({ ...prev, error, loading: false }));
  }, []);

  // Listen for forced-logout events dispatched by the axios interceptor
  // when both the access token and refresh token are expired.
  useEffect(() => {
    const handleForceLogout = () => {
      setAuth({ isAuthenticated: false, user: null, token: null, role: null, loading: false, error: null });
    };
    window.addEventListener('auth:force-logout', handleForceLogout);
    return () => window.removeEventListener('auth:force-logout', handleForceLogout);
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      setAuth(prev => ({ ...prev, loading: true }));

      const token = localStorage.getItem('token');
      const user = JSON.parse(localStorage.getItem('user') || 'null');

      if (!isOnline) {
        setAuth({ isAuthenticated: false, user: null, token: null, role: null, loading: false, error: 'No internet connection' });
        return;
      }

      if (!token || !user) {
        setAuth(prev => ({ ...prev, loading: false }));
        return;
      }

      try {
        const response = await verify();
        const roles = response?.data?.roles || [];
        const role = roles[0] || null;

        if (role) {
          // Re-read token from localStorage — the axios interceptor may have
          // silently refreshed it while verify() was in-flight, so the
          // `token` variable captured above could already be stale.
          const currentToken = localStorage.getItem('token') || token;
          login(currentToken, user, role);
        } else {
          setAuthError('No valid role found');
          logout();
        }
      } catch (error) {
        console.error('Auth verification failed:', error);
        // The interceptor already cleared localStorage and dispatched
        // auth:force-logout, so just clean up React state.
        setAuth({ isAuthenticated: false, user: null, token: null, role: null, loading: false, error: null });
      }
    };

    checkAuth();
  }, [login, logout, setAuthError, isOnline]);

  if (!isOnline && auth.loading) {
    return (
      <Backdrop open={true} sx={{ bgcolor: 'rgba(0,0,0,0.75)', zIndex: 9999 }}>
        <Paper sx={{
          p: 4, borderRadius: 3, textAlign: 'center', minWidth: 300,
          bgcolor: '#12121e', border: '1px solid rgba(255,255,255,0.08)',
          backdropFilter: 'blur(12px)',
        }}>
          <Typography variant="h6" sx={{ color: '#f1f5f9', fontWeight: 700 }} gutterBottom>
            No Internet Connection
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(241,245,249,0.55)' }}>
            Please check your network connection and try again
          </Typography>
        </Paper>
      </Backdrop>
    );
  }

  if (auth.error && !auth.loading) {
    return (
      <Backdrop open={true} sx={{ bgcolor: 'rgba(0,0,0,0.75)', zIndex: 9999 }}>
        <Paper sx={{
          p: 4, borderRadius: 3, textAlign: 'center', minWidth: 300,
          bgcolor: '#12121e', border: '1px solid rgba(255,255,255,0.08)',
          backdropFilter: 'blur(12px)',
        }}>
          <Typography variant="h6" sx={{ color: '#f87171', fontWeight: 700 }} gutterBottom>
            Authentication Error
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(241,245,249,0.55)' }} gutterBottom>
            {auth.error}
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(241,245,249,0.35)' }}>
            Redirecting to login…
          </Typography>
        </Paper>
      </Backdrop>
    );
  }

  return (
    <AuthContext.Provider value={{
      auth,
      setUserRole,
      login,
      logout,
      setAuthError
    }}>
      {auth.loading && (
        <Box sx={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1400 }}>
          <LinearProgress />
        </Box>
      )}
      {children}
    </AuthContext.Provider>
  );
};

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export { AuthProvider, useAuth };