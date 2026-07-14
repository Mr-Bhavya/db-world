import axios from 'axios';
import { Capacitor } from '@capacitor/core';
import { getApiBaseUrl } from '@shared/config/apiBaseUrl';

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
  // Biometric exchange runs at launch before a session exists; a stale Bearer token would be
  // rejected 401 by the JWT decoder even on this permitAll path, so it must go token-free.
  '/api/auth/biometric/exchange',
  '/api/wallet/shared/',
];

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
 * Mint a fresh access token from the HttpOnly refresh cookie and persist it.
 * Concurrent callers coalesce onto the single in-flight refresh. Throws on
 * failure WITHOUT clearing the session — callers decide whether a failure is
 * fatal (the 401 interceptor force-logs-out; the resume keep-alive stays quiet).
 */
export async function refreshAccessToken() {
  if (isRefreshing) {
    return new Promise((resolve, reject) => { waitQueue.push({ resolve, reject }); });
  }
  isRefreshing = true;
  try {
    // Plain axios (not the instance) to avoid interceptor recursion.
    const { data } = await axios.post(
      `${BASE_URL}/api/auth/refresh-token`,
      {},
      { withCredentials: true }
    );
    const newToken = data?.data?.accessToken;
    if (!newToken) throw new Error('No accessToken in refresh response');
    localStorage.setItem('token', newToken);
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
  withCredentials: true,       // send HttpOnly refresh-token cookie
  headers: { 'Content-Type': 'application/json' },
});

/* ─── Request interceptor: attach access token ──────────────────────── */

axiosInstance.interceptors.request.use((config) => {
  const isPublic = NO_TOKEN_PATHS.some(p => config.url?.includes(p));
  if (!isPublic) {
    const token = localStorage.getItem('token');
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

    // Only intercept 401/403 on protected endpoints and only once per request.
    if ((status === 401 || status === 403) && !original._retry && !isPublicPath) {
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
          localStorage.clear();
          window.dispatchEvent(new CustomEvent('auth:force-logout'));
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;
