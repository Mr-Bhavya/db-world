import { Capacitor, registerPlugin } from '@capacitor/core';

/**
 * Key-value storage for the refresh token on native builds.
 *
 * Web never uses this — there the refresh token lives in an httpOnly cookie that JavaScript
 * cannot read, which is strictly safer. Native cannot rely on that cookie: WKWebView's tracking
 * prevention drops cross-site cookies, so an iOS build would silently lose its session on every
 * cold start. The token therefore has to be held by the app itself.
 *
 * Backend selection is at runtime, best first:
 *
 *   1. SecureStoragePlugin — iOS Keychain / Android Keystore. This is the one we want, and the
 *      only one that keeps the token out of an unencrypted device backup.
 *   2. localStorage — app-private to the WebView. Works today with no extra dependency, but a
 *      rooted/jailbroken device or an unencrypted backup can reach it.
 *
 * To get (1), install the plugin and re-sync:
 *
 *   npm i @aparajita/capacitor-secure-storage && npx cap sync
 *
 * No code change is needed after installing — the check below picks it up. Do this before
 * shipping iOS.
 */

const SecureStoragePlugin = registerPlugin('SecureStoragePlugin');

const isNative = () => Capacitor.isNativePlatform?.() === true;

/** True when a real Keychain/Keystore backend is installed. */
export const hasSecureBackend = () =>
  isNative() && Capacitor.isPluginAvailable?.('SecureStoragePlugin') === true;

/**
 * Reads a value. Never throws — a missing key, a plugin that is not installed, or storage that
 * was wiped by an OS restore all mean the same thing to callers: no stored session.
 */
export async function secureGet(key) {
  if (!isNative()) return null;

  if (hasSecureBackend()) {
    try {
      const { value } = await SecureStoragePlugin.get({ key });
      return value ?? null;
    } catch {
      return null; // not found, or the keychain item was invalidated
    }
  }

  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Stores a value. Falls back rather than failing, so a sign-in is never lost to storage. */
export async function secureSet(key, value) {
  if (!isNative()) return;

  if (hasSecureBackend()) {
    try {
      await SecureStoragePlugin.set({ key, value });
      return;
    } catch {
      /* fall through to localStorage so the session still survives a restart */
    }
  }

  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* storage full or blocked — the session simply won't survive a cold start */
  }
}

/**
 * Removes a value from BOTH backends.
 *
 * Deliberately not short-circuited on `hasSecureBackend()`: a build that once fell back to
 * localStorage and later gained the plugin would otherwise leave a stale token behind in the
 * old location forever.
 */
export async function secureRemove(key) {
  if (!isNative()) return;

  if (hasSecureBackend()) {
    try {
      await SecureStoragePlugin.remove({ key });
    } catch {
      /* already gone */
    }
  }
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
