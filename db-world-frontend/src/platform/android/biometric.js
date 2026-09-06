import { Capacitor } from '@capacitor/core';
import { NativeBiometric } from '@capgo/capacitor-native-biometric';
import { enrollDevice, exchangeDeviceToken, revokeDevice } from '@features/auth/api/biometricApi';

/** Keystore credential namespace for the stored device token. */
const SERVER = 'com.db.dbworld.biometric';
const DEVICE_ID_KEY = 'dbworld_device_id';
const ENABLED_KEY = 'dbworld_biometric_enabled';

const isNative = () => Capacitor.getPlatform() === 'android';

/** Stable per-install device identifier (one enrolled credential per user + device). */
function getDeviceId() {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : `dev-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

/** Best-effort friendly device label for the management UI. */
function deviceLabel() {
  const m = navigator.userAgent.match(/Android[^;]*;\s*([^)]+)\)/);
  return (m?.[1] || 'Android device').split(';')[0].trim().slice(0, 60);
}

/** The stored device id for this install, or null if none has been minted yet (read-only). */
export function getStoredDeviceId() {
  return localStorage.getItem(DEVICE_ID_KEY);
}

/** Whether the user has turned on biometric unlock on this device. */
export function isBiometricEnabled() {
  return isNative() && localStorage.getItem(ENABLED_KEY) === '1';
}

/** Whether the device has usable biometrics enrolled (hardware present + a fingerprint/face set). */
export async function isBiometricAvailable() {
  if (!isNative()) return { available: false, reason: 'not-native' };
  try {
    const res = await NativeBiometric.isAvailable({ useFallback: true });
    return { available: !!res.isAvailable, biometryType: res.biometryType, reason: res.errorCode };
  } catch {
    return { available: false, reason: 'error' };
  }
}

/**
 * Can we lock the app on this device? True when biometrics are enrolled OR a
 * device screen-lock (PIN/pattern/password) is set — either can unlock the app.
 */
export async function canLockApp() {
  if (!isNative()) return false;
  try {
    const res = await NativeBiometric.isAvailable({ useFallback: true });
    return !!(res?.isAvailable || res?.deviceIsSecure);
  } catch {
    return false;
  }
}

/**
 * App-lock unlock: prompt for biometric OR device credential (PIN/pattern/password).
 * Resolves on success; throws on cancel/failure. Not tied to the login token flow.
 */
export async function verifyDeviceOwner(reason = 'Unlock DB World') {
  await NativeBiometric.verifyIdentity({ reason, title: 'DB World', subtitle: reason, useFallback: true });
  return true;
}

/**
 * Enroll: mint a device token server-side (authenticated) and store it in the hardware Keystore.
 * Caller must already be logged in.
 */
export async function enableBiometric() {
  const deviceId = getDeviceId();
  const token = await enrollDevice(deviceId, deviceLabel());
  if (!token) throw new Error('No device token returned from enroll');
  await NativeBiometric.setCredentials({ username: deviceId, password: token, server: SERVER });
  localStorage.setItem(ENABLED_KEY, '1');
}

/**
 * Unlock: prompt for fingerprint/face, read the stored token, exchange it for a session.
 * @returns {Promise<{accessToken: string, user: object}>}
 */
/**
 * What actually went wrong, from the plugin's numeric error code.
 *
 * Everything used to be caught into one branch that said "Not recognised", so tapping
 * Cancel accused you of failing a scan you never attempted, and a 30-second lockout
 * showed a retry button that could not work.
 *
 * Codes are @capgo/capacitor-native-biometric's BiometricAuthError enum — see
 * node_modules/@capgo/capacitor-native-biometric/dist/esm/definitions.d.ts. Numbers
 * rather than names because the plugin ships the enum as TypeScript and this is a .js
 * module; keep them in step if the dependency is upgraded.
 */
export const BIOMETRIC_OUTCOME = {
  CANCELLED: 'cancelled',
  FAILED: 'failed',
  LOCKED_OUT: 'lockedOut',
  UNAVAILABLE: 'unavailable',
  FALLBACK: 'fallback',
  ERROR: 'error',
};

export function classifyBiometricError(e) {
  switch (Number(e?.code)) {
    // Dismissed on purpose — by the user, the app, or the system. Not a failure, and
    // must never be reported as one.
    case 11: case 15: case 16:
      return BIOMETRIC_OUTCOME.CANCELLED;

    // The user asked for the passcode instead. Take them there rather than looping.
    case 17:
      return BIOMETRIC_OUTCOME.FALLBACK;

    // Too many attempts. Android will refuse for ~30s (4) or until a passcode unlock
    // (2), so offering "try again" here is offering something that cannot work.
    case 2: case 4:
      return BIOMETRIC_OUTCOME.LOCKED_OUT;

    // A real non-match.
    case 10:
      return BIOMETRIC_OUTCOME.FAILED;

    // No hardware, nothing enrolled, or no device passcode — biometric is not a route
    // on this device at all, so stop offering it.
    case 1: case 3: case 14:
      return BIOMETRIC_OUTCOME.UNAVAILABLE;

    default:
      return BIOMETRIC_OUTCOME.ERROR;
  }
}

export async function biometricUnlock(reason = 'Unlock DB World') {
  await NativeBiometric.verifyIdentity({ reason, title: 'Unlock DB World', useFallback: true });
  const cred = await NativeBiometric.getCredentials({ server: SERVER });
  const token = cred?.password;
  if (!token) throw new Error('No stored device credential');
  return exchangeDeviceToken(token);
}

/** Disable: revoke server-side, wipe the Keystore credential, clear the local flag. */
export async function disableBiometric() {
  const deviceId = getDeviceId();
  try { await revokeDevice(deviceId); } catch { /* revoke is best-effort */ }
  try { await NativeBiometric.deleteCredentials({ server: SERVER }); } catch { /* ignore */ }
  localStorage.removeItem(ENABLED_KEY);
}

/** Local-only teardown (e.g. the server rejected the token) — no network call. */
export function clearBiometricLocal() {
  localStorage.removeItem(ENABLED_KEY);
  if (isNative()) NativeBiometric.deleteCredentials({ server: SERVER }).catch(() => {});
}
