import axios from 'axios';
import { Capacitor } from '@capacitor/core';
import { getApiBaseUrl } from '@shared/config/apiBaseUrl';
import {
  clientPlatform,
  clearSession,
  getAccessToken,
  getRefreshToken,
  hasStoredSession,
  isNativeClient,
  setAccessToken,
  setRefreshToken,
} from '@shared/auth/tokenStore';

const BASE_URL = getApiBaseUrl();

// On a native Capacitor build the CapacitorHttp plugin patches XMLHttpRequest with a
// native-backed shim whose setRequestHeader runs before open() finishes — which axios's
// XHR adapter trips over ("setRequestHeader … state must be OPENED"), breaking every
// request from the bundled app (capacitor://localhost → api.db-world.in cross-origin).
// axios 1.7's fetch adapter uses CapacitorHttp's patched fetch instead, which is native
// (no CORS) and has no such bug. Web keeps the default XHR adapter.
if (Capacitor?.isNativePlatform?.()) {
  axios.defaults.adapter = 'fetch';
}

/**
 * Paths that must NOT carry a Bearer token.
 *
 * Spring Security's JWT decoder rejects requests with an invalid/expired
 * Bearer token with 401 even on permitAll() paths. Login, register and the
 * refresh endpoint are public — stale tokens must not be sent to them.
 *
 * /api/auth/verify and /api/auth/logout still carry the token so that
 * Spring can authenticate the request and they are NOT on this list.
 */
const NO_TOKEN_PATHS = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/refresh-token',
  // Google sign-in runs before a session exists; a stale Bearer token would be rejected 401
  // by the JWT decoder even on this permitAll path.
  '/api/auth/google',
  '/api/auth/providers',
  // Biometric exchange runs at launch before a session exists, same reasoning.
  '/api/auth/biometric/exchange',
  '/api/wallet/shared/',
];

/** Header native clients use to present the refresh token they hold in secure storage. */
const REFRESH_TOKEN_HEADER = 'X-Refresh-Token';

/**
 * True only for a genuine authentication failure — the server explicitly rejected
 * the credentials (401/403). A network error (no response), timeout, or 5xx is NOT
 * an auth failure: the session may well still be valid, we just couldn't reach or
 * get a clean answer from the server. Those must never end the session.
 */
export const isAuthFailure = (err) => {
  const s = err?.response?.status;
  return s === 401 || s === 403;
};

/** In-flight refresh state */
let isRefreshing = false;
let waitQueue = []; // Array<{ resolve, reject }>

/** Drain the wait queue — resolve with new token or reject with error. */
const drainQueue = (error, token) => {
  waitQueue.forEach(({ resolve, reject }) =>
    error ? reject(error) : resolve(token)
  );
  waitQueue = [];
};

/**
 * Mints a fresh access token, and — now that tokens rotate — a fresh refresh token too.
 *
 * Coalescing concurrent callers onto one in-flight request is no longer just an optimisation.
 * The server spends the presented refresh token on every call, so two parallel refreshes would
 * make the second one look like a replay of an already-used token, which the backend correctly
 * treats as a stolen credential and responds to by revoking the entire session.
 *
 * Throws WITHOUT clearing the session — callers decide whether a failure is fatal (the 401
 * interceptor force-logs-out; the resume keep-alive stays quiet).
 */
export async function refreshAccessToken() {
  if (isRefreshing) {
    return new Promise((resolve, reject) => { waitQueue.push({ resolve, reject }); });
  }
  isRefreshing = true;
  try {
    const headers = { 'X-Client-Platform': clientPlatform() };

    // Native has no usable cross-site cookie, so it presents the token it holds.
    const stored = getRefreshToken();
    if (stored) headers[REFRESH_TOKEN_HEADER] = stored;

    // Plain axios (not the instance) to avoid interceptor recursion.
    const { data } = await axios.post(
      `${BASE_URL}/api/auth/refresh-token`,
      {},
      { withCredentials: true, headers }
    );

    const newToken = data?.data?.accessToken;
    if (!newToken) throw new Error('No accessToken in refresh response');
    setAccessToken(newToken);

    // Rotation: the old refresh token is now spent, so the successor has to replace it or the
    // next refresh would present a dead token and trip reuse detection.
    if (data?.data?.refreshToken) {
      await setRefreshToken(data.data.refreshToken);
    }

    // The fresh token carries the user's CURRENT role. Announcing it lets the auth context
    // adopt a promotion that happened while the user was signed in — a demotion revokes the
    // sessions outright, but a promotion deliberately leaves them alive, and without this the
    // UI would keep rendering the old role until the user signed out by hand.
    window.dispatchEvent(new CustomEvent('auth:token-refreshed'));

    drainQueue(null, newToken);
    return newToken;
  } catch (err) {
    drainQueue(err, null);
    throw err;
  } finally {
    isRefreshing = false;
  }
}

/* ─── Instance ──────────────────────────────────────────────────────── */

const axiosInstance = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,       // send HttpOnly refresh-token cookie (web)
  headers: { 'Content-Type': 'application/json' },
});

/* ─── Request interceptor: attach access token ──────────────────────── */

axiosInstance.interceptors.request.use((config) => {
  // Tells the backend which transport to use for the refresh token in its response.
  config.headers['X-Client-Platform'] = clientPlatform();

  const isPublic = NO_TOKEN_PATHS.some(p => config.url?.includes(p));
  if (!isPublic) {
    const token = getAccessToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, Promise.reject);

/* ─── Response interceptor: handle 401/403 with silent token refresh ── */

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const status   = error.response?.status;

    const isPublicPath = NO_TOKEN_PATHS.some(p => original?.url?.includes(p));

    // A visitor who has never signed in has no session at all. The browse pages are open to
    // them, and the personalised calls those pages make (progress, watchlist state) answer 401
    // by design. Attempting a refresh here would POST to /api/auth/refresh-token with no
    // credential on every such call, 401 again, and then fire auth:force-logout at someone who
    // was never logged in.
    //
    // This checks the persisted session marker, NOT the access token: the token now lives in
    // memory and is legitimately absent right after a page reload, when the session is very
    // much alive and a refresh is exactly the right move.
    const neverSignedIn = !hasStoredSession();

    // Only intercept 401/403 on protected endpoints and only once per request.
    if ((status === 401 || status === 403) && !original._retry && !isPublicPath && !neverSignedIn) {
      original._retry = true;
      try {
        const newToken = await refreshAccessToken();
        original.headers.Authorization = `Bearer ${newToken}`;
        return axiosInstance(original);

      } catch (refreshError) {
        // Only end the session when the refresh endpoint itself says the refresh
        // token is invalid/revoked (401/403). A network error or 5xx during refresh
        // is transient — keep the session so a blip doesn't bounce the user to login;
        // the next request retries the refresh once connectivity/server recovers.
        if (isAuthFailure(refreshError)) {
          await clearSession();
          window.dispatchEvent(new CustomEvent('auth:force-logout'));
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;
export { isNativeClient };
