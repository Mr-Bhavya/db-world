import axiosInstance from '@shared/components/ui/utils/AxiosInstants';

const BASE = '/api/auth/biometric';
const unwrap = (r) => r.data?.data ?? r.data;

/** Enroll this device (authenticated). Returns the raw device token — store it once, securely. */
export const enrollDevice = (deviceId, deviceLabel) =>
  axiosInstance.post(`${BASE}/enroll`, { deviceId, deviceLabel }).then((r) => unwrap(r)?.deviceToken);

/**
 * Exchange a device token for a fresh session. PUBLIC — must NOT carry a (possibly stale) bearer
 * token, so `${BASE}/exchange` is listed in the axios NO_TOKEN_PATHS. Returns { accessToken, user }.
 */
export const exchangeDeviceToken = (deviceToken) =>
  axiosInstance.post(`${BASE}/exchange`, { deviceToken }).then(unwrap);

/** List the current user's enrolled devices (authenticated). */
export const listDevices = () => axiosInstance.get(`${BASE}/devices`).then(unwrap);

/** Revoke one enrolled device (authenticated). */
export const revokeDevice = (deviceId) =>
  axiosInstance.delete(`${BASE}/devices/${encodeURIComponent(deviceId)}`).then((r) => r.data);
