import { Capacitor } from '@capacitor/core';
import { secureGet, secureSet, secureRemove } from './secureStore';

/**
 * The single source of truth for auth tokens.
 *
 * The access token lives in a module variable and is NEVER written to localStorage. Anything
 * localStorage holds is readable by any script that gets injected into the page, and this app
 * carries a document wallet of government IDs and a password vault — a stolen access token is
 * worth more here than on a typical site. In memory it dies with the tab.
 *
 * The cost of that is a page reload starts with no token, so boot has to mint one from the
 * refresh token. {@link hasStoredSession} is what tells the app whether that is even worth
 * trying: it is a non-secret marker, not a credential, so keeping it in localStorage is fine.
 * Without it we could not tell "signed in, token lost to a reload" from "never signed in", and
 * every anonymous visitor would trigger a pointless refresh that 401s.
 */

const REFRESH_TOKEN_KEY = 'dbworld.refreshToken';   // native secure storage only
const SESSION_MARKER_KEY = 'dbworld.hasSession';    // non-secret boolean
const USER_KEY = 'user';
const ROLE_KEY = 'role';

let accessToken = null;
let refreshToken = null;   // native only; mirrors secure storage so reads stay synchronous

/** Header the backend reads to decide how to hand the refresh token back. */
export const clientPlatform = () => {
  const platform = Capacitor.getPlatform?.();
  if (platform === 'android') return 'ANDROID';
  if (platform === 'ios') return 'IOS';
  return 'WEB';
};

export const isNativeClient = () => Capacitor.isNativePlatform?.() === true;

/* ── Access token (memory only) ─────────────────────────────────────── */

export const getAccessToken = () => accessToken;

export function setAccessToken(token) {
  accessToken = token ?? null;
  if (token) markSessionStarted();
}

/* ── Refresh token (native only — web uses the httpOnly cookie) ─────── */

export const getRefreshToken = () => refreshToken;

export async function setRefreshToken(token) {
  if (!isNativeClient()) return;   // web must never hold this in JS
  refreshToken = token ?? null;
  if (token) {
    await secureSet(REFRESH_TOKEN_KEY, token);
  } else {
    await secureRemove(REFRESH_TOKEN_KEY);
  }
}

/** Loads the stored refresh token into memory at boot. No-op on web. */
export async function loadRefreshToken() {
  if (!isNativeClient()) return null;
  refreshToken = await secureGet(REFRESH_TOKEN_KEY);
  return refreshToken;
}

/* ── Session marker ─────────────────────────────────────────────────── */

/**
 * Whether this browser/app has an established session worth trying to refresh.
 *
 * On native the stored refresh token is the real answer; the marker is only consulted before
 * {@link loadRefreshToken} has run.
 */
export function hasStoredSession() {
  if (isNativeClient() && refreshToken) return true;
  try {
    return window.localStorage.getItem(SESSION_MARKER_KEY) === '1';
  } catch {
    return false;
  }
}

export function markSessionStarted() {
  try {
    window.localStorage.setItem(SESSION_MARKER_KEY, '1');
  } catch {
    /* private mode — the session just won't survive a reload */
  }
}

/* ── Cached identity (non-secret, for first paint) ──────────────────── */

export function getStoredUser() {
  try {
    const raw = window.localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function getStoredRole() {
  try {
    return window.localStorage.getItem(ROLE_KEY);
  } catch {
    return null;
  }
}

export function setStoredIdentity(user, role) {
  try {
    if (user) window.localStorage.setItem(USER_KEY, JSON.stringify(user));
    if (role) window.localStorage.setItem(ROLE_KEY, role);
  } catch {
    /* ignore */
  }
}

/**
 * Updates the cached role in place.
 *
 * Needed because a role can change while the user is signed in — an admin promoting or demoting
 * them. Previously the role was written once at login and never again, so a demoted admin kept
 * seeing the entire admin UI until they manually signed out.
 */
export function setStoredRole(role) {
  try {
    if (role) window.localStorage.setItem(ROLE_KEY, role);
  } catch {
    /* ignore */
  }
}

/* ── Teardown ───────────────────────────────────────────────────────── */

/** Wipes every trace of the session. Safe to call when nothing is signed in. */
export async function clearSession() {
  accessToken = null;
  refreshToken = null;
  try {
    window.localStorage.removeItem(SESSION_MARKER_KEY);
    window.localStorage.removeItem(USER_KEY);
    window.localStorage.removeItem(ROLE_KEY);
  } catch {
    /* ignore */
  }
  await secureRemove(REFRESH_TOKEN_KEY);
}

/** Decoded payload of the current access token, or null. Never throws. */
export function decodeAccessToken() {
  if (!accessToken) return null;
  try {
    const payload = accessToken.split('.')[1];
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return null;
  }
}

/**
 * True when the access token is missing, unreadable, or about to expire.
 * Used to decide whether returning to the foreground warrants a silent refresh.
 */
export function accessTokenExpiringSoon(thresholdMs = 120_000) {
  if (!accessToken) return true;
  const claims = decodeAccessToken();
  if (!claims?.exp) return true;
  return claims.exp * 1000 - Date.now() < thresholdMs;
}
