import { useCallback, useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';

import { notify } from '@shared/notify';

import { getFcmToken, isPushConfigured, onForegroundMessage } from './firebaseMessaging';
import { nativeCheckPermission, nativeSetup } from './nativePush';
import { registerPushToken } from './pushApi';

const isNative = () => Capacitor.isNativePlatform();
const webPermission = () => (typeof Notification !== 'undefined' ? Notification.permission : 'denied');
const platform = () => (isNative() ? 'android' : 'web');

/** Web push needs the Notification API + service worker + provisioned config; native needs Capacitor. */
const webSupported = () =>
  typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator && isPushConfigured();

const deepLink = (data) => data?.link || '/db-world';

const toastMessage = (title, body) => {
  if (title) notify.info(body ? `${title} — ${body}` : title);
};

/**
 * Unified push wiring for web (FCM JS SDK + service worker + VAPID) and native Android (Capacitor
 * `@capacitor/push-notifications`). Exposes `{ supported, permission, busy, enable }`:
 *  - `enable()` requests permission, obtains the FCM token, registers it with the backend (→ topic
 *    subscription) and starts surfacing messages.
 *  - already-granted devices silently re-sync their token on mount (tokens rotate).
 *  - foreground messages → `notify()` toast; a tapped native notification deep-links into the IPO.
 * Degrades to a no-op when unsupported/unconfigured, so it's safe to mount unconditionally.
 */
export function usePushNotifications({ autoSyncWhenGranted = true } = {}) {
  const native = isNative();
  const supported = native || webSupported();
  const [permission, setPermission] = useState(() => (native ? 'default' : webPermission()));
  const [busy, setBusy] = useState(false);

  const persist = useCallback((token) => {
    if (token) registerPushToken(token, platform()).catch(() => {});
  }, []);

  const onMessage = useCallback((n) => toastMessage(n?.title, n?.body), []);
  const onAction = useCallback((n) => window.location.assign(deepLink(n?.data)), []);

  // Native permission resolves asynchronously — read it once on mount.
  useEffect(() => {
    if (!native) return undefined;
    let alive = true;
    nativeCheckPermission().then((p) => { if (alive) setPermission(p); });
    return () => { alive = false; };
  }, [native]);

  // Silent re-sync + listener attach for already-granted devices (token can rotate over time).
  useEffect(() => {
    if (!autoSyncWhenGranted || !supported || permission !== 'granted') return undefined;

    if (native) {
      nativeSetup({ request: false, onToken: persist, onMessage, onAction }).catch(() => {});
      return undefined; // native listeners persist for the app session
    }

    let unsubscribe = () => {};
    let active = true;
    getFcmToken().then(persist).catch(() => {});
    onForegroundMessage((payload) => onMessage(payload?.notification))
      .then((u) => { if (active) unsubscribe = u; else u(); })
      .catch(() => {});
    return () => { active = false; unsubscribe(); };
  }, [autoSyncWhenGranted, supported, permission, native, persist, onMessage, onAction]);

  const enable = useCallback(async () => {
    if (!supported) {
      notify.error('Notifications aren’t supported on this device or browser.');
      return;
    }
    setBusy(true);
    try {
      if (native) {
        let perm;
        try {
          perm = await nativeSetup({ request: true, onToken: persist, onMessage, onAction });
        } catch (e) {
          // Surface the staged reason (e.g. "push stalled at: request-permissions") so a hung
          // native setup is diagnosable from the toast instead of an endless spinner.
          notify.error(e?.message || 'Couldn’t enable notifications.');
          return;
        }
        setPermission(perm);
        if (perm !== 'granted') {
          notify.info('Notifications stayed off — you can enable them in device settings.');
          return;
        }
        notify.success('Notifications on — you’ll get IPO alerts.');
        return;
      }

      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') {
        notify.info('Notifications stayed off. You can enable them anytime in your browser settings.');
        return;
      }
      const token = await getFcmToken();
      if (!token) {
        notify.error('Couldn’t enable notifications just now. Please try again.');
        return;
      }
      // Only claim success once the token is actually registered (→ topic subscription).
      // Registration needs a signed-in session, so a 401 surfaces as "sign in" rather than a
      // misleading "Notifications on".
      try {
        await registerPushToken(token, 'web');
        notify.success('Notifications on — you’ll get IPO alerts.');
      } catch {
        notify.error('Please sign in to turn on notifications, then try again.');
      }
    } catch {
      notify.error('Couldn’t enable notifications.');
    } finally {
      setBusy(false);
    }
  }, [supported, native, persist, onMessage, onAction]);

  return { supported, permission, busy, enable };
}
