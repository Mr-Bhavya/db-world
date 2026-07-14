import Constants from '@shared/constants';

const APP_ROLES = [
  Constants.OWNER_USER_ROLE,
  Constants.ADMIN_USER_ROLE,
  Constants.VIEWER_USER_ROLE,
];

/**
 * Extracts the app-level role from a user/login payload. Mirrors the login-response handling so the
 * biometric exchange (which returns the same shape) resolves the role identically.
 */
export const extractAppRole = (user) => {
  const candidates = [
    user?.role,
    ...(Array.isArray(user?.roles) ? user.roles : []),
  ].filter(Boolean);
  return candidates.find((role) => APP_ROLES.includes(role)) ?? null;
};
