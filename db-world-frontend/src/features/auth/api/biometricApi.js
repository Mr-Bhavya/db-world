import axiosInstance from '@shared/components/ui/utils/AxiosInstants';

const BASE = '/api/auth/biometric';
const unwrap = (r) => r.data?.data ?? r.data;

/** Enroll this device (authenticated). Returns the raw device token — store it once, securely. */
export const enrollDevice = (deviceId, deviceLabel) =>
  axiosInstance.post(`${BASE}/enroll`, { deviceId, deviceLabel }).then((r) => unwrap(r)?.deviceToken);

/**
 * Exchange a device token for a fresh session. PUBLIC — must NOT carry a (possibly stale) bearer
 * token, so `${BASE}/exchange` is listed in the axios NO_TOKEN_PATHS.
 *
 * Returns { accessToken, refreshToken, user }. The endpoint answers with the same shape as
 * /login, whose access-token field is named `token` — it is renamed here because every caller
 * destructures `accessToken`, and reading the wrong key silently produced an undefined token.
 * `refreshToken` is present only on native, which stores it itself.
 */
export const exchangeDeviceToken = (deviceToken) =>
  axiosInstance.post(`${BASE}/exchange`, { deviceToken }).then((r) => {
    const payload = unwrap(r) ?? {};
    return {
      accessToken: payload.token ?? payload.accessToken,
      refreshToken: payload.refreshToken,
      user: payload.user,
    };
  });

/** List the current user's enrolled devices (authenticated). */
export const listDevices = () => axiosInstance.get(`${BASE}/devices`).then(unwrap);

/** Revoke one enrolled device (authenticated). */
export const revokeDevice = (deviceId) =>
  axiosInstance.delete(`${BASE}/devices/${encodeURIComponent(deviceId)}`).then((r) => r.data);
