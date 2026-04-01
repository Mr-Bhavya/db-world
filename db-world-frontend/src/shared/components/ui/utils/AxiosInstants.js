import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

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
];

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

      // If a refresh is already in-flight, queue this request.
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          waitQueue.push({ resolve, reject });
        }).then((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          return axiosInstance(original);
        });
      }

      isRefreshing = true;
      try {
        // Use a plain axios call (not the instance) to avoid interceptor loops.
        const { data } = await axios.post(
          `${BASE_URL}/api/auth/refresh-token`,
          {},
          { withCredentials: true }
        );

        const newToken = data?.data?.accessToken;
        if (!newToken) throw new Error('No accessToken in refresh response');

        localStorage.setItem('token', newToken);
        original.headers.Authorization = `Bearer ${newToken}`;
        drainQueue(null, newToken);
        return axiosInstance(original);

      } catch (refreshError) {
        drainQueue(refreshError, null);
        localStorage.clear();
        window.dispatchEvent(new CustomEvent('auth:force-logout'));
        return Promise.reject(refreshError);

      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;
