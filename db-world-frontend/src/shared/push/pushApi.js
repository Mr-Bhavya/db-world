import axiosInstance from '@shared/components/ui/utils/AxiosInstants';

/** Register (or refresh) this device's FCM token so it receives broadcast push. */
export const registerPushToken = (token, platform) =>
  axiosInstance.post('/api/push/register', { token, platform }).then((r) => r.data);

/** Forget this device's token (logout / permission revoked). */
export const unregisterPushToken = (token) =>
  axiosInstance.post('/api/push/unregister', { token }).then((r) => r.data);
