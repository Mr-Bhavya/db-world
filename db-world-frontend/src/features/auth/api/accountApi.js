import axiosInstance from '@shared/components/ui/utils/AxiosInstants';

const BASE = '/api/account';
const unwrap = (r) => r.data?.data ?? r.data;

/**
 * The caller's own sessions.
 *
 * Returns `{ sessions, activeSessions, loginHistory, biometricDevices, currentSessionId }`.
 * `currentSessionId` is the rotation family of the device making the request, so the UI can
 * label it and avoid offering a button that signs the user out of the page they are on.
 */
export const getMySessions = () => axiosInstance.get(`${BASE}/sessions`).then(unwrap);

/** Signs one device out. `familyId` is the session id from {@link getMySessions}. */
export const revokeMySession = (familyId) =>
  axiosInstance.delete(`${BASE}/sessions/${encodeURIComponent(familyId)}`).then((r) => r.data);

/**
 * Signs the caller out everywhere.
 * @param keepCurrent spare this device — "sign out my other devices".
 */
export const revokeAllMySessions = (keepCurrent = true) =>
  axiosInstance.post(`${BASE}/sessions/revoke-all?keepCurrent=${keepCurrent}`).then(unwrap);

/**
 * Deletes the caller's account.
 *
 * `password` may be omitted for a Google-only account, which has none; `confirmEmail` must match
 * the account email exactly and is always required.
 */
export const deleteMyAccount = ({ password, confirmEmail }) =>
  axiosInstance.post(`${BASE}/delete`, { password, confirmEmail }).then(unwrap);

/** `{ pendingDeletion, deletedAt, purgeAfter, graceDays }`. */
export const getDeletionStatus = () =>
  axiosInstance.get(`${BASE}/deletion-status`).then(unwrap);
