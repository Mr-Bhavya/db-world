import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Box, LinearProgress } from '@mui/material';
import { useAuth } from '@features/auth/context/Authentication';
import ErrorPage from '@shared/components/layout/ErrorPage';
import Constants from '@shared/constants';

/** Thin top-of-page loading bar shown while auth state is resolving. */
const RouteLoader = () => (
  <Box sx={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1400 }}>
    <LinearProgress />
  </Box>
);

/**
 * Protects routes behind authentication + optional role check.
 *
 * Usage:
 *   <Route element={<PrivateRoute allowedRoles={['ADMIN', 'OWNER']} />}>
 *     <Route path="dashboard" element={<Dashboard />} />
 *   </Route>
 */
const PrivateRoute = ({ allowedRoles }) => {
  const { auth }   = useAuth();
  const location   = useLocation();

  // Auth is still being verified on app load — show a non-blocking loader.
  if (auth.loading) return <RouteLoader />;

  // Not authenticated → redirect to login, preserving the intended destination.
  if (!auth.isAuthenticated) {
    return (
      <Navigate
        to={Constants.LOGIN_ROUTE}
        state={{ from: location }}
        replace
      />
    );
  }

  // Authenticated but missing the required role → show access-denied page.
  if (allowedRoles && !allowedRoles.includes(auth.role)) {
    return <ErrorPage />;
  }

  return <Outlet />;
};

export default PrivateRoute;
