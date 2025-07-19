// components/PrivateRoute.jsx
import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/Authentication';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import Constants from './Constants';
import ErrorPage from './ErrorPage';

// Session cache with expiration
const sessionCache = {
  role: null,
  expiresAt: 0,
};

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

const PrivateRoute = ({ allowedRoles }) => {
  const { auth } = useAuth();
  const location = useLocation();
  const [status, setStatus] = useState({ isValid: null, isAllowed: false });

  const validateAccess = useCallback(() => {
    const now = Date.now();

    if (!auth.isAuthenticated) {
      setStatus({ isValid: false, isAllowed: false });
      return;
    }

    // Use cached role if still valid
    if (sessionCache.role && now < sessionCache.expiresAt) {
      const isAllowed = allowedRoles ? allowedRoles.includes(sessionCache.role) : true;
      setStatus({ isValid: true, isAllowed });
      return;
    }

    const role = auth.role;
    if (role) {
      sessionCache.role = role;
      sessionCache.expiresAt = now + CACHE_DURATION;

      const isAllowed = allowedRoles ? allowedRoles.includes(role) : true;
      setStatus({ isValid: true, isAllowed });
    } else {
      console.warn('No role found in auth context.');
      setStatus({ isValid: false, isAllowed: false });
    }
  }, [auth.isAuthenticated, auth.role, allowedRoles]);

  useEffect(() => {
    validateAccess();
  }, [auth.isAuthenticated, auth.role, location.pathname, validateAccess]);

  if (status.isValid === null) {
    return Constants.LOADER;
  }

  if (!status.isValid) {
    return <Navigate to={Constants.LOGIN_ROUTE} state={{ from: location }} replace />;
  }

  return status.isAllowed ? <Outlet /> : <ErrorPage />;
};

export default PrivateRoute;
