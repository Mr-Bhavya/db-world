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
