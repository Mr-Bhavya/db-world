/**
 * Native (Capacitor / Android) push via `@capacitor/push-notifications`. Unlike web push this uses
 * the OS's native FCM integration — no VAPID / service worker. The plugin is dynamic-imported so it
 * never loads in a plain web bundle. Permission strings are mapped to the same
 * 'default' | 'granted' | 'denied' vocabulary the web path uses; every call is defensive.
 */
async function plugin() {
  const mod = await import('@capacitor/push-notifications');
  return mod.PushNotifications;
}

const mapPermission = (receive) => {
  if (receive === 'granted') return 'granted';
  if (receive === 'denied') return 'denied';
  return 'default'; // 'prompt' | 'prompt-with-rationale'
};

/** Current native push permission, mapped to the shared vocabulary. */
export async function nativeCheckPermission() {
  try {
    const perm = await (await plugin()).checkPermissions();
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
  const PushNotifications = await plugin();
  await PushNotifications.removeAllListeners();
  await PushNotifications.addListener('registration', (t) => onToken?.(t?.value ?? null));
  await PushNotifications.addListener('registrationError', () => onToken?.(null));
  await PushNotifications.addListener('pushNotificationReceived', (n) => onMessage?.(n));
  await PushNotifications.addListener('pushNotificationActionPerformed', (a) => onAction?.(a?.notification));

  let perm = await PushNotifications.checkPermissions();
  if (request && (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale')) {
    perm = await PushNotifications.requestPermissions();
  }
  if (perm.receive === 'granted') {
    await PushNotifications.register(); // fires 'registration' → onToken
  }
  return mapPermission(perm.receive);
}
