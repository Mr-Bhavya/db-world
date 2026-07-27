import { useCallback, useEffect, useState } from 'react';

import { notify } from '@shared/notify';

import { getFcmToken, isPushConfigured, onForegroundMessage } from './firebaseMessaging';
import { registerPushToken } from './pushApi';

const currentPermission = () =>
  (typeof Notification !== 'undefined' ? Notification.permission : 'denied');

const platform = () => (window.Capacitor?.isNativePlatform?.() ? 'android' : 'web');

/** Push is usable only when the browser exposes the Notification API AND push is provisioned. */
const isSupported = () =>
  typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator && isPushConfigured();

/**
 * Web push wiring for the signed-in user:
 *  - `permission` — the current Notification permission ('default' | 'granted' | 'denied').
 *  - `enable()` — request permission, fetch the FCM token, register it with the backend (→ topic
 *    subscription), and start showing foreground messages as toasts.
 *  - when permission is already 'granted', silently re-syncs the token on mount (tokens rotate),
 *    so returning users/devices stay subscribed without re-prompting.
 *
 * Everything degrades to a no-op when unsupported/unconfigured, so it's safe to mount unconditionally.
 */
export function usePushNotifications({ autoSyncWhenGranted = true } = {}) {
  const supported = isSupported();
  const [permission, setPermission] = useState(currentPermission);
  const [busy, setBusy] = useState(false);

  const register = useCallback(async () => {
    const token = await getFcmToken();
    if (token) await registerPushToken(token, platform());
    return token;
  }, []);

  // Foreground messages (app focused) → toast; background ones are shown by the service worker.
  useEffect(() => {
    if (!supported || permission !== 'granted') return undefined;
    let unsubscribe = () => {};
    let active = true;
    onForegroundMessage((payload) => {
      const n = payload?.notification;
      if (n?.title) notify.info(n.body ? `${n.title} — ${n.body}` : n.title);
    })
      .then((u) => { if (active) unsubscribe = u; else u(); })
      .catch(() => {});
    return () => { active = false; unsubscribe(); };
  }, [supported, permission]);

  // Silent re-sync for already-opted-in devices (token can change over time).
  useEffect(() => {
    if (autoSyncWhenGranted && supported && permission === 'granted') {
      register().catch(() => {});
    }
  }, [autoSyncWhenGranted, supported, permission, register]);

  const enable = useCallback(async () => {
    if (!supported) {
      notify.error('Notifications aren’t supported on this device or browser.');
      return;
    }
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') {
        notify.info('Notifications stayed off. You can enable them anytime in your browser settings.');
        return;
      }
      const token = await register();
      if (token) notify.success('Notifications on — you’ll get IPO alerts.');
      else notify.error('Couldn’t enable notifications just now. Please try again.');
    } catch {
      notify.error('Couldn’t enable notifications.');
    } finally {
      setBusy(false);
    }
  }, [supported, register]);

  return { supported, permission, busy, enable };
}
