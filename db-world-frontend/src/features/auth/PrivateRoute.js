// components/PrivateRoute.jsx
import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@features/auth/context/Authentication';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import Constants from '@shared/constants';
import { Box, LinearProgress } from '@mui/material';
import ErrorPage from '@shared/components/layout/ErrorPage';

// Session cache with expiration
const sessionCache = {
  role: null,
  expiresAt: 0,
};

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Slim top progress bar — non-blocking, doesn't replace the page
const RouteLoader = () => (
  <Box sx={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1400 }}>
    <LinearProgress />
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
    validateAccess();
  }, [auth.isAuthenticated, auth.role, validateAccess]);

  if (status.loading || auth.loading || status.isValid === null) {
    return <RouteLoader />;
  }

  if (!status.isValid) {
    return <Navigate to={Constants.LOGIN_ROUTE} state={{ from: location }} replace />;
  }

  return status.isAllowed ? <Outlet /> : <ErrorPage />;
};

export default PrivateRoute;