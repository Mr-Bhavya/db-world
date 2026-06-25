import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Box, LinearProgress } from '@mui/material';

import { useAuth } from '@features/auth/context/Authentication';
import ErrorPage from '@shared/components/layout/ErrorPage';
import Constants from '@shared/constants';

const RouteLoader = () => (
  <Box
    sx={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 1400,
    }}
  >
    <LinearProgress />
  </Box>
);

const normalizeRole = (role) => {
  if (!role) return null;

  if (typeof role === 'object') {
    return String(role.name ?? role.role ?? role.authority ?? '')
      .replace(/^ROLE_/i, '')
      .trim()
      .toUpperCase();
  }

  return String(role)
    .replace(/^ROLE_/i, '')
    .trim()
    .toUpperCase();
};

const PrivateRoute = ({ allowedRoles }) => {
  const { auth } = useAuth();
  const location = useLocation();

  const hasRoleRestriction = Array.isArray(allowedRoles) && allowedRoles.length > 0;

  const normalizedUserRole = normalizeRole(auth.role);

  const normalizedAllowedRoles = hasRoleRestriction ? allowedRoles.map(normalizeRole).filter(Boolean) : [];

  if (auth.loading) {
    return <RouteLoader />;
  }

  if (!auth.isAuthenticated) {
    return (
      <Navigate
        to={Constants.LOGIN_ROUTE}
        state={{ from: location }}
        replace
      />
    );
  }

  /*
   * Important:
   * User is authenticated but role is not ready yet.
   * Do NOT show ErrorPage during this temporary state.
   */
  if (hasRoleRestriction && !normalizedUserRole) {
    return <RouteLoader />;
  }

  if (hasRoleRestriction && !normalizedAllowedRoles.includes(normalizedUserRole)) {
    return <ErrorPage />;
  }

  return <Outlet />;
};

export default PrivateRoute;