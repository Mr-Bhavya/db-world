// contexts/Authentication.js
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { addUser } from '../redux/action/allActions';
import axiosInstance from '../components/Utils/AxiosInstants';
import { logOut, verify } from '../components/ApiServices';
import { Box, CircularProgress, Typography, Backdrop, Paper } from '@mui/material';

const AuthContext = createContext();

// Enhanced Auth Loader Component with White Transparent Background
const AuthLoader = () => (
  <Backdrop
    open={true}
    sx={{
      backgroundColor: 'rgba(0, 0, 0, 0.5)', // Semi-dark backdrop
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      gap: 3
    }}
  >
    <Paper
      elevation={16}
      sx={{
        padding: 5,
        borderRadius: 4,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(15px)',
        border: '1px solid rgba(255, 255, 255, 0.3)',
        textAlign: 'center',
        minWidth: 320,
        maxWidth: 400
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 3
        }}
      >
        <CircularProgress 
          size={60}
          thickness={4}
          sx={{
            color: 'primary.main',
            animation: 'rotate 2s linear infinite'
          }}
        />
        <Box>
          <Typography 
            variant="h5" 
            color="text.primary"
            fontWeight="bold"
            gutterBottom
          >
            Welcome Back
          </Typography>
          <Typography 
            variant="body1" 
            color="black"
            sx={{
              animation: 'fadeInOut 2s ease-in-out infinite',
              mb: 1
            }}
          >
            Initializing your session...
          </Typography>
          <Typography 
            variant="body2" 
            color="black"
            sx={{ opacity: 0.8 }}
          >
            Please wait while we secure your access
          </Typography>
        </Box>
      </Box>
    </Paper>
    <style>
      {`
        @keyframes rotate {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes fadeInOut {
          0%, 100% { opacity: 0.7; }
          50% { opacity: 1; }
        }
      `}
    </style>
  </Backdrop>
);

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

  useEffect(() => {
    const checkAuth = async () => {
      // Show loading state immediately
      setAuth(prev => ({ ...prev, loading: true }));

      const token = localStorage.getItem('token');
      const user = JSON.parse(localStorage.getItem('user') || 'null');

      // Check network connectivity
      if (!isOnline) {
        setAuth({
          isAuthenticated: false,
          user: null,
          token: null,
          role: null,
          loading: false,
          error: 'No internet connection'
        });
        return;
      }

      if (!token || !user) {
        setAuth(prev => ({ ...prev, loading: false }));
        return;
      }

      try {
        // Add artificial delay to show loader (remove in production if not needed)
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const response = await verify();
        //console.log('Auth verification response:', response);
        const roles = response?.data?.roles || [];
        const role = roles[0] || null;

        if (role) {
          login(token, user, role);
        } else {
          setAuthError('No valid role found');
          logout();
        }
      } catch (error) {
        console.error('Auth verification failed:', error);
        setAuthError('Authentication failed. Please login again.');
        
        // Auto logout on verification failure
        setTimeout(() => {
          logout();
        }, 2000);
      }
    };

    checkAuth();
  }, [login, logout, setAuthError, isOnline]);

  // Show network error with white transparent background
  if (!isOnline && auth.loading) {
    return (
      <Backdrop open={true} sx={{ backgroundColor: 'rgba(0, 0, 0, 0.6)', zIndex: 9999 }}>
        <Paper
          sx={{
            padding: 4,
            borderRadius: 3,
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)',
            textAlign: 'center',
            minWidth: 300
          }}
        >
          <Typography variant="h6" color="text.primary" gutterBottom fontWeight="bold">
            No Internet Connection
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Please check your network connection and try again
          </Typography>
        </Paper>
      </Backdrop>
    );
  }

  // Show auth error with white transparent background
  if (auth.error && !auth.loading) {
    return (
      <Backdrop open={true} sx={{ backgroundColor: 'rgba(0, 0, 0, 0.6)', zIndex: 9999 }}>
        <Paper
          sx={{
            padding: 4,
            borderRadius: 3,
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)',
            textAlign: 'center',
            minWidth: 300
          }}
        >
          <Typography variant="h6" color="error.main" gutterBottom fontWeight="bold">
            Authentication Error
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {auth.error}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ opacity: 0.7 }}>
            Redirecting to login...
          </Typography>
        </Paper>
      </Backdrop>
    );
  }

  // Show loader while checking authentication
  if (auth.loading) {
    return <AuthLoader />;
  }

  return (
    <AuthContext.Provider value={{ 
      auth, 
      setUserRole, 
      login, 
      logout,
      setAuthError 
    }}>
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