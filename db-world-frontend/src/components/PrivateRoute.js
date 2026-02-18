// components/PrivateRoute.jsx
import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/Authentication';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import Constants from './Constants';
import ErrorPage from './ErrorPage';
import { Box, CircularProgress, Typography, Fade, Paper } from '@mui/material';

// Session cache with expiration
const sessionCache = {
  role: null,
  expiresAt: 0,
};

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Enhanced Loader Component with White Transparent Background
const RouteLoader = ({ message = "Checking access..." }) => (
  <Box
    sx={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '60vh',
      gap: 2
    }}
  >
    <Paper
      elevation={8}
      sx={{
        padding: 4,
        borderRadius: 3,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        textAlign: 'center',
        minWidth: 280
      }}
    >
      <CircularProgress 
        size={50}
        thickness={4}
        sx={{
          color: 'black',
          animation: 'pulse 1.5s ease-in-out infinite alternate',
          mb: 2
        }}
      />
      <Typography 
        variant="h6" 
        color="black"
        fontWeight="medium"
        gutterBottom
      >
        Please Wait
      </Typography>
      <Typography 
        variant="body2" 
        color="black"
        sx={{
          animation: 'fadeInOut 2s ease-in-out infinite'
        }}
      >
        {message}
      </Typography>
    </Paper>
    <style>
      {`
        @keyframes pulse {
          0% { opacity: 0.6; transform: scale(0.95); }
          100% { opacity: 1; transform: scale(1.05); }
        }
        @keyframes fadeInOut {
          0%, 100% { opacity: 0.7; }
          50% { opacity: 1; }
        }
      `}
    </style>
  </Box>
);

const PrivateRoute = ({ allowedRoles }) => {
  const { auth } = useAuth();
  const location = useLocation();
  const [status, setStatus] = useState({ isValid: null, isAllowed: false, loading: true });

  const validateAccess = useCallback(() => {
    const now = Date.now();

    if (!auth.isAuthenticated) {
      setStatus({ isValid: false, isAllowed: false, loading: false });
      return;
    }

    // Use cached role if still valid
    if (sessionCache.role && now < sessionCache.expiresAt) {
      const isAllowed = allowedRoles ? allowedRoles.includes(sessionCache.role) : true;
      setStatus({ isValid: true, isAllowed, loading: false });
      return;
    }

    const role = auth.role;
    if (role) {
      sessionCache.role = role;
      sessionCache.expiresAt = now + CACHE_DURATION;

      const isAllowed = allowedRoles ? allowedRoles.includes(role) : true;
      setStatus({ isValid: true, isAllowed, loading: false });
    } else {
      console.warn('No role found in auth context.');
      setStatus({ isValid: false, isAllowed: false, loading: false });
    }
  }, [auth.isAuthenticated, auth.role, allowedRoles]);

  useEffect(() => {
    setStatus(prev => ({ ...prev, loading: true }));
    
    // Small delay to show loader for better UX
    const timer = setTimeout(() => {
      validateAccess();
    }, 300);

    return () => clearTimeout(timer);
  }, [auth.isAuthenticated, auth.role, location.pathname, validateAccess]);

  // Show loader while checking authentication
  if (status.loading || auth.loading) {
    return <RouteLoader message="Verifying your access..." />;
  }

  if (status.isValid === null) {
    return <RouteLoader message="Checking permissions..." />;
  }

  if (!status.isValid) {
    return (
      <Fade in timeout={500}>
        <div>
          <Navigate to={Constants.LOGIN_ROUTE} state={{ from: location }} replace />
        </div>
      </Fade>
    );
  }

  return status.isAllowed ? (
    <Fade in timeout={500}>
      <div>
        <Outlet />
      </div>
    </Fade>
  ) : (
    <Fade in timeout={500}>
      <div>
        <ErrorPage />
      </div>
    </Fade>
  );
};

export default PrivateRoute;