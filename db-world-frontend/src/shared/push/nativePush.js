/**
 * Native (Capacitor / Android) push via `@capacitor/push-notifications`. Unlike web push this uses
 * the OS's native FCM integration — no VAPID / service worker. Imported STATICALLY: a dynamic
 * `import()` of the plugin chunk hung in the release WebView ("push stalled at: load-plugin"), so
 * the plugin now rides in the main bundle. It's harmless on web (methods just aren't called there).
 * Permission strings map to the shared 'default' | 'granted' | 'denied' vocabulary; calls are defensive.
 */
import { PushNotifications } from '@capacitor/push-notifications';

const mapPermission = (receive) => {
  if (receive === 'granted') return 'granted';
  if (receive === 'denied') return 'denied';
  return 'default'; // 'prompt' | 'prompt-with-rationale'
};

/**
 * Reject if a native bridge call doesn't settle in `ms`, naming the `stage`. A Capacitor plugin
 * call that never resolves (e.g. an unregistered/misbehaving native plugin) would otherwise leave
 * the Enable button spinning forever; this turns that into a surfaced "push stalled at: <stage>"
 * so the failing step is obvious without device logs.
 */
const withTimeout = (promise, ms, stage) =>
  Promise.race([
    Promise.resolve(promise),
    new Promise((_, reject) => setTimeout(() => reject(new Error(`push stalled at: ${stage}`)), ms)),
  ]);

/** Current native push permission, mapped to the shared vocabulary. */
export async function nativeCheckPermission() {
  try {
    const perm = await PushNotifications.checkPermissions();
    return mapPermission(perm.receive);
  } catch {
    return 'denied';
  }
}

/**
 * One-shot native setup: (re)attach the listeners, optionally request permission, and register for
 * a token when granted. Listeners are cleared first so repeated calls (enable + auto-sync) never
 * stack duplicates. The FCM token arrives asynchronously via the `registration` event → `onToken`.
 * Returns the (mapped) resulting permission.
 */
export async function nativeSetup({ request = false, onToken, onMessage, onAction } = {}) {
  await withTimeout(PushNotifications.removeAllListeners(), 5000, 'remove-listeners');
  await withTimeout(PushNotifications.addListener('registration', (t) => onToken?.(t?.value ?? null)), 5000, 'listen-registration');
  await withTimeout(PushNotifications.addListener('registrationError', () => onToken?.(null)), 5000, 'listen-registration-error');
  await withTimeout(PushNotifications.addListener('pushNotificationReceived', (n) => onMessage?.(n)), 5000, 'listen-received');
  await withTimeout(PushNotifications.addListener('pushNotificationActionPerformed', (a) => onAction?.(a?.notification)), 5000, 'listen-action');

  let perm = await withTimeout(PushNotifications.checkPermissions(), 5000, 'check-permissions');
  if (request && (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale')) {
    // Longer budget — this awaits the user tapping the OS permission dialog.
    perm = await withTimeout(PushNotifications.requestPermissions(), 60000, 'request-permissions');
  }
  if (perm.receive === 'granted') {
    // Fire registration but DON'T await it — the token (or a registrationError) arrives via the
    // listeners above. Awaiting can hang forever when native FCM init fails (e.g. a release APK
    // built without google-services.json), which would leave the Enable button spinning.
    PushNotifications.register().catch(() => onToken?.(null));
  }
  return mapPermission(perm.receive);
}
