/**
 * Firebase Cloud Messaging (web) — thin, defensive wrapper around the modular SDK.
 *
 * Everything here is guarded so the app never breaks when push isn't available: missing config
 * (env not set), an unsupported browser, or a denied permission all resolve to "no token / no-op"
 * rather than throwing. The public Firebase web config comes from build-time `VITE_FIREBASE_*` env
 * (safe to ship in the bundle); the actual background delivery is handled by the separate
 * `public/firebase-messaging-sw.js` service worker.
 */
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

/** True only when the public web config + VAPID key are present (i.e. push is provisioned). */
export const isPushConfigured = () => Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && VAPID_KEY);

let messagingPromise = null;

/** Lazily returns the FCM messaging instance, or null when push isn't configured/supported. */
async function getMessagingInstance() {
  if (!isPushConfigured()) return null;
  const supported = await isSupported().catch(() => false);
  if (!supported) return null;
  if (!messagingPromise) {
    const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    messagingPromise = Promise.resolve(getMessaging(app));
  }
  return messagingPromise;
}

/**
 * Registers the FCM service worker and returns this device's FCM token (needs an already-granted
 * Notification permission). Returns null when push isn't configured/supported.
 */
export async function getFcmToken() {
  const messaging = await getMessagingInstance();
  if (!messaging || !('serviceWorker' in navigator)) return null;
  const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
  return getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
}

/**
 * Subscribes to FOREGROUND messages (app focused); background messages are shown by the service
 * worker. Resolves to an unsubscribe function (a no-op when push isn't available).
 */
export async function onForegroundMessage(handler) {
  const messaging = await getMessagingInstance();
  if (!messaging) return () => {};
  return onMessage(messaging, handler);
}
